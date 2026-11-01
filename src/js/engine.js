// Rules engine: game creation, move evaluation and application. Pure (no DOM); the state is one
// serializable object (MECHANICS.md §2). ctx = { dict, lex } (lex may be null: no bonuses).
import { TILES, BLANKS } from './tiles.js';
import { seedState, rand, shuffle, hashString } from './rng.js';
import { has } from './dict.js';
import { N, RACK, VALUE, findWords, connectError, scorePlay } from './score.js';

export const DAILY_TURNS = 10;

export function fullBag() {
  const bag = [];
  for (const [l, t] of Object.entries(TILES)) for (let k = 0; k < t.count; k++) bag.push(l);
  for (let k = 0; k < BLANKS; k++) bag.push('?');
  return bag;
}

export const dailySeed = (date) => hashString('bathhouse-letters:' + date);

// opts: { mode: 'play' | 'daily', seats: [{ kind, level, persona, name }], seed, date }
export function createGame(opts, lex) {
  const mode = opts.mode === 'daily' ? 'daily' : 'play';
  const seed = mode === 'daily' ? dailySeed(opts.date) : (opts.seed >>> 0);
  const seats = mode === 'daily' ? [{ kind: 'human', name: (opts.seats && opts.seats[0] && opts.seats[0].name) || 'You' }] : opts.seats;
  const s = {
    v: 1, mode, seed, rng: { bag: seedState(seed), ai: seedState(seed ^ 0x5bd1e995) },
    board: Array(N * N).fill(null),
    bag: [],
    players: seats.map((p, k) => ({
      name: p.name || `Player ${k + 1}`, kind: p.kind === 'ai' ? 'ai' : 'human', level: p.level || null,
      persona: p.persona || null, rack: [], score: 0, best: null, hints: 3,
    })),
    cur: 0, move: 0, round: 0, scoreless: 0, over: false, result: null,
    featured: [], log: [],
    daily: mode === 'daily' ? { date: opts.date, turns: DAILY_TURNS } : null,
  };
  s.bag = shuffle(s, 'bag', fullBag());
  if (lex) s.featured = pickFeatured(s, lex);
  for (const p of s.players) draw(s, p);
  return s;
}

// Three featured words from three different categories, each showing one letter to start.
function pickFeatured(s, lex) {
  const pool = lex.featurable.slice();
  const out = [], cats = new Set();
  while (out.length < 3 && pool.length) {
    const k = Math.floor(rand(s, 'bag') * pool.length);
    const f = pool.splice(k, 1)[0];
    if (cats.has(f.cat)) continue;
    cats.add(f.cat);
    out.push({ id: f.id, word: f.word, cat: f.cat, shown: [Math.floor(rand(s, 'bag') * f.word.length)], by: null, at: null });
  }
  return out;
}

function draw(s, p) {
  while (p.rack.length < RACK && s.bag.length) p.rack.push(s.bag.shift());
}

const rackValue = (rack) => rack.reduce((a, l) => a + (l === '?' ? 0 : VALUE[l]), 0);

// Does `rack` hold the tiles (blanks as '?')? Returns the rack left over, or null.
function takeFromRack(rack, letters) {
  const left = rack.slice();
  for (const l of letters) {
    const k = left.indexOf(l);
    if (k < 0) return null;
    left.splice(k, 1);
  }
  return left;
}

// Evaluate a play for the current player without changing the state.
export function evaluate(s, tiles, ctx) {
  if (s.over) return { ok: false, error: 'The game is over.' };
  const p = s.players[s.cur];
  if (!tiles || !tiles.length) return { ok: false, error: 'Place at least one tile.' };
  if (tiles.length > RACK) return { ok: false, error: 'At most seven tiles.' };
  for (const t of tiles) {
    if (!/^[A-Z]$/.test(t.l || '')) return { ok: false, error: t.blank ? 'Choose a letter for the blank tile.' : 'Unknown tile.' };
  }
  if (!takeFromRack(p.rack, tiles.map((t) => (t.blank ? '?' : t.l)))) return { ok: false, error: 'Those tiles are not on your rack.' };
  // On an empty board the opening rule explains more than the geometry does, so it goes first.
  const opening = !s.board.some(Boolean);
  let conn = opening ? connectError(s.board, tiles) : null;
  if (conn) return { ok: false, error: conn };
  const found = findWords(s.board, tiles);
  if (found.error) return { ok: false, error: found.error };
  conn = connectError(s.board, tiles);
  if (conn) return { ok: false, error: conn };
  const bad = found.words.find((w) => !has(ctx.dict, w.w));
  if (bad) return { ok: false, error: `${bad.w} is not in the dictionary.`, badWord: bad.w, words: found.words.map((w) => ({ w: w.w, cells: w.cells })) };
  const sc = scorePlay(s.board, found, tiles.length, ctx.lex, s.featured);
  return { ok: true, ...sc };
}

// Apply an action for the current player. Mutates s on success.
export function apply(s, action, ctx) {
  if (s.over) return { ok: false, error: 'The game is over.' };
  const p = s.players[s.cur];
  let entry;
  if (action.type === 'play') {
    const ev = evaluate(s, action.tiles, ctx);
    if (!ev.ok) return ev;
    for (const t of action.tiles) s.board[t.i] = { l: t.l, blank: !!t.blank, p: s.cur, t: s.move };
    p.rack = takeFromRack(p.rack, action.tiles.map((t) => (t.blank ? '?' : t.l)));
    p.score += ev.score;
    if (ev.featured) { const f = s.featured.find((x) => x.word === ev.featured); f.by = s.cur; f.at = s.move; }
    const top = ev.words.reduce((a, w) => (w.score + w.bonus > a.score + a.bonus ? w : a), ev.words[0]);
    if (!p.best || top.score + top.bonus > p.best.score) p.best = { word: top.w, score: top.score + top.bonus };
    entry = { p: s.cur, kind: 'play', n: s.move, tiles: action.tiles.map((t) => ({ i: t.i, l: t.l, blank: !!t.blank })),
      words: ev.words.map((w) => ({ w: w.w, score: w.score, bonus: w.bonus, themed: w.themed, bath: w.bath })),
      score: ev.score, full: ev.full, themed: ev.themed, featured: ev.featured };
    s.scoreless = ev.score > 0 ? 0 : s.scoreless + 1;
    draw(s, p);
  } else if (action.type === 'swap') {
    const letters = action.letters || [];
    if (!letters.length) return { ok: false, error: 'Choose tiles to swap.' };
    if (s.bag.length < RACK) return { ok: false, error: 'You can swap only while the bag holds at least seven tiles.' };
    const left = takeFromRack(p.rack, letters);
    if (!left) return { ok: false, error: 'Those tiles are not on your rack.' };
    p.rack = left;
    draw(s, p);
    s.bag.push(...letters.slice().sort());
    entry = { p: s.cur, kind: 'swap', n: s.move, count: letters.length, score: 0 };
    s.scoreless++;
  } else if (action.type === 'pass') {
    entry = { p: s.cur, kind: 'pass', n: s.move, score: 0 };
    s.scoreless++;
  } else return { ok: false, error: 'Unknown action.' };

  s.log.push(entry);
  s.move++;
  // End checks
  const out = action.type === 'play' && p.rack.length === 0 && s.bag.length === 0;
  if (s.mode === 'daily') {
    s.daily.turns--;
    if (s.daily.turns <= 0 || out) finish(s, null, 'daily');
  } else if (out) finish(s, s.cur, 'out');
  else if (s.scoreless >= 2 * s.players.length) finish(s, null, 'stalled');
  if (!s.over) {
    s.cur = (s.cur + 1) % s.players.length;
    if (s.cur === 0) { s.round++; revealRound(s); }
  }
  return { ok: true, entry };
}

// One more letter of each unclaimed Featured Spring clears at each new round (never past length − 2).
function revealRound(s) {
  for (const f of s.featured) {
    if (f.by != null || f.shown.length >= f.word.length - 2) continue;
    const hidden = [...f.word].map((_, k) => k).filter((k) => !f.shown.includes(k));
    f.shown.push(hidden[Math.floor(rand(s, 'bag') * hidden.length)]);
  }
}

function finish(s, outSeat, why) {
  s.over = true;
  const adj = s.players.map(() => 0);
  if (why !== 'daily') {
    let pool = 0;
    s.players.forEach((p, k) => { const v = rackValue(p.rack); adj[k] -= v; pool += v; });
    if (outSeat != null) adj[outSeat] += pool;
    s.players.forEach((p, k) => { p.score += adj[k]; });
  }
  const top = Math.max(...s.players.map((p) => p.score));
  s.result = { why, out: outSeat, adjust: adj, winners: s.players.map((p, k) => (p.score === top ? k : -1)).filter((k) => k >= 0) };
  s.log.push({ kind: 'end', why, adjust: adj, n: s.move });
}

export const tileValue = (l) => (l === '?' ? 0 : VALUE[l]);
export const tilesLeft = (s) => s.bag.length;
// Letters still unseen by seat `k` (bag + other racks), for the tile-tracker.
export function unseen(s, k) {
  const counts = {};
  for (const l of s.bag) counts[l] = (counts[l] || 0) + 1;
  s.players.forEach((p, j) => { if (j !== k) for (const l of p.rack) counts[l] = (counts[l] || 0) + 1; });
  return counts;
}

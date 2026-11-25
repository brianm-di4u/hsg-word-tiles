// Rules engine: game creation, move evaluation and application. Pure (no DOM); the state is one
// serializable object (MECHANICS.md §2). ctx = { dict, lex } (lex may be null: no bonuses).
import { TILES, BLANKS } from './tiles.js';
import { seedState, rand, shuffle, hashString } from './rng.js';
import { has } from './dict.js';
import { deducibleFeatured } from './lexicon.js';
import { N, RACK, VALUE, findWords, connectError, scorePlay, isBath } from './score.js';

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
  // Challenge: a play with a word that is not in the dictionary costs the turn. Only written when on, so every other game and save is as before.
  if (opts.challenge && mode === 'play') s.challenge = true;
  s.bag = shuffle(s, 'bag', fullBag());
  if (mode === 'daily') curateBag(s.bag);
  if (lex) s.featured = pickFeatured(s, lex);
  for (const p of s.players) draw(s, p);
  return s;
}

// The Daily's first two racks (the first fourteen tiles) each hold 2 to 4 vowels, so no one opens on a rack of consonants.
// Tiles are swapped with the nearest later ones, in order, so the deal for a date is still the same everywhere.
export const VOWELS = 'AEIOU';
export const VOWELS_MIN = 2, VOWELS_MAX = 4;
export function curateBag(bag) {
  const isV = (l) => VOWELS.includes(l);
  for (const [a, b] of [[0, RACK], [RACK, 2 * RACK]]) {
    for (;;) {
      let v = 0;
      for (let i = a; i < b; i++) if (isV(bag[i])) v++;
      const want = v < VOWELS_MIN ? true : v > VOWELS_MAX ? false : null;
      if (want === null) break;
      let from = -1, to = -1;
      for (let i = a; i < b && from < 0; i++) if (isV(bag[i]) === !want && bag[i] !== '?') from = i;
      for (let j = 2 * RACK; j < bag.length && to < 0; j++) if (isV(bag[j]) === want && bag[j] !== '?') to = j;
      if (from < 0 || to < 0) break;
      [bag[from], bag[to]] = [bag[to], bag[from]];
    }
  }
  return bag;
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
  // `skipDict` is for the live preview of a Challenge game, which must not tell the player whether a word is in the dictionary
  const bad = ctx.skipDict ? null : found.words.find((w) => !has(ctx.dict, w.w));
  if (bad) return { ok: false, error: `${bad.w} is not in the dictionary.`, badWord: bad.w, words: found.words.map((w) => ({ w: w.w, cells: w.cells })) };
  const sc = scorePlay(s.board, found, tiles.length, ctx.lex, s.featured);
  return { ok: true, ...sc };
}

// Apply an action for the current player. Mutates s on success.
export function apply(s, action, ctx) {
  if (s.over) return { ok: false, error: 'The game is over.' };
  const p = s.players[s.cur];
  const fogWas = fogStep(s);
  const rack = p.rack.join('');   // kept in the log so the game can be looked back over (review.js)
  // the Featured Springs a person could work out on this turn, also for review.js (only written when there is one)
  const known = p.kind === 'human' ? deducibleFeatured(s.featured, ctx.lex).map((f) => f.word) : [];
  let entry;
  if (action.type === 'play') {
    const ev = evaluate(s, action.tiles, ctx);
    if (!ev.ok) return ev;
    for (const t of action.tiles) s.board[t.i] = { l: t.l, blank: !!t.blank, p: s.cur, t: s.move };
    p.rack = takeFromRack(p.rack, action.tiles.map((t) => (t.blank ? '?' : t.l)));
    p.score += ev.score;
    const claimedFeats = Array.isArray(ev.featuredAll) && ev.featuredAll.length
      ? ev.featuredAll
      : (ev.featured ? [ev.featured] : []);
    for (const fw of claimedFeats) {
      const f = s.featured.find((x) => x.word === fw && x.by == null);
      if (f) { f.by = s.cur; f.at = s.move; }
    }
    const top = ev.words.reduce((a, w) => (w.score + w.bonus > a.score + a.bonus ? w : a), ev.words[0]);
    if (!p.best || top.score + top.bonus > p.best.score) p.best = { word: top.w, score: top.score + top.bonus };
    entry = { p: s.cur, kind: 'play', n: s.move, tiles: action.tiles.map((t) => ({ i: t.i, l: t.l, blank: !!t.blank })),
      words: ev.words.map((w) => ({ w: w.w, score: w.score, bonus: w.bonus, themed: w.themed, bath: w.bath })),
      score: ev.score, full: ev.full, themed: ev.themed, featured: ev.featured,
      ...(claimedFeats.length > 1 ? { featuredAll: claimedFeats } : {}), rack };
    s.scoreless = ev.score > 0 ? 0 : s.scoreless + 1;
    draw(s, p);
    // W1-S4-01: playing any Hot Springs word in an unclaimed plaque's category immediately clears +1 fogged letter on that plaque.
    const revealedThisPlay = new Set();
    if (ctx.lex && s.featured.length) {
      const cats = new Set();
      for (const w of ev.words) {
        if (!w.themed) continue;
        const en = ctx.lex.byId.get(w.themed);
        if (en && en.cat) cats.add(en.cat);
      }
      for (const f of s.featured) {
        if (f.by == null && cats.has(f.cat) && revealOneLetter(s, f)) revealedThisPlay.add(f);
      }
    }
    // W1-S2-11: covering an uncovered Bathhouse Row medallion with any valid word (non-scoring on plain words per CD-WF1-03;
    // Hot Springs words keep their +20 ROW_BONUS per CD-WF0-09) clears +1 fogged letter on an unclaimed Featured Spring plaque.
    let rowReveals = 0;
    if (s.featured.length) {
      const rowCovers = action.tiles.filter((t) => isBath(t.i)).length;
      for (let k = 0; k < rowCovers; k++) {
        const eligible = s.featured.filter((f) => f.by == null && f.shown.length < featuredRevealCap(s, f));
        if (!eligible.length) break;
        const fresh = eligible.filter((f) => !revealedThisPlay.has(f));
        const pool = (fresh.length ? fresh : eligible).slice().sort((a, b) => (b.shown.length / b.word.length) - (a.shown.length / a.word.length));
        if (revealOneLetter(s, pool[0])) { rowReveals++; revealedThisPlay.add(pool[0]); }
      }
    }
    if (rowReveals > 0) entry.rowReveal = rowReveals;
  } else if (action.type === 'swap') {
    const letters = action.letters || [];
    if (!letters.length) return { ok: false, error: 'Choose tiles to swap.' };
    if (s.bag.length < RACK) return { ok: false, error: 'You can swap only while the bag holds at least seven tiles.' };
    const left = takeFromRack(p.rack, letters);
    if (!left) return { ok: false, error: 'Those tiles are not on your rack.' };
    p.rack = left;
    draw(s, p);
    s.bag.push(...letters.slice().sort());
    entry = { p: s.cur, kind: 'swap', n: s.move, count: letters.length, score: 0, rack };
    s.scoreless++;
  } else if (action.type === 'pass') {
    entry = { p: s.cur, kind: 'pass', n: s.move, score: 0, rack };
    s.scoreless++;
  } else return { ok: false, error: 'Unknown action.' };

  if (known.length) entry.known = known;
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
    if (s.cur === 0) s.round++;
    for (let k = fogStep(s); k > fogWas; k--) clearFog(s);
  }
  return { ok: true, entry };
}

// Maximum revealed letters allowed by fog clearing on an unclaimed Featured Spring:
// length − 2 normally, or length − 1 once bag <= 20 tiles or Daily Turn 6+ (s.daily.turns <= 5).
export function featuredRevealCap(s, f) {
  const late = s.bag.length <= 20 || (s.mode === 'daily' && s.daily && s.daily.turns <= DAILY_TURNS - 5);
  return Math.max(1, f.word.length - (late ? 1 : 2));
}

function revealOneLetter(s, f) {
  if (!f || f.by != null || f.shown.length >= featuredRevealCap(s, f)) return false;
  const hidden = [...f.word].map((_, k) => k).filter((k) => !f.shown.includes(k));
  if (!hidden.length) return false;
  f.shown.push(hidden[Math.floor(rand(s, 'bag') * hidden.length)]);
  return true;
}

// How far the fog has lifted by itself (W6-S3-03). In a game of two to four it follows the bag: one step for every twelfth of the tiles
// that were left in it after the deal, whoever draws them, so a plaque has cleared as far by the middle of the bag with four players
// as with two. (It used to be a letter a round, and four players have about half the rounds.) The Daily has one player and ten
// turns: one step a turn, as it always was, so a date clears the same letters on everyone's board. Read from the bag, so nothing is
// stored and a game saved before this goes on from where its plaques are.
export const FOG_STEPS = 12;
const ALL_TILES = fullBag().length;
export function fogStep(s) {
  if (s.mode === 'daily') return s.daily ? DAILY_TURNS - s.daily.turns : 0;
  const start = ALL_TILES - RACK * s.players.length;
  return Math.max(0, Math.floor((FOG_STEPS * (start - s.bag.length)) / start));
}

// One more letter of each unclaimed Featured Spring clears at each step (up to featuredRevealCap).
function clearFog(s) {
  for (const f of s.featured) revealOneLetter(s, f);
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

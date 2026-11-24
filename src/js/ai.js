// Computer opponents. Picks a play, a swap or a pass for the current seat. No DOM; runs in the AI
// worker (and in Node for the tools). Randomness (Easy only) comes from state.rng.ai, and the caller
// keeps the advanced stream, so games stay reproducible.
import { generateMoves } from './movegen.js';
import { rand } from './rng.js';
import { N, SQUARE, VALUE, LETTER_MULT, WORD_MULT, RACK } from './score.js';
import { LEAVE } from './leave-table.js';

// Everyday two-letter words Easy is allowed to play (no obscure tournament two-letter tools like XU, ZA, QI, KI, OY, UT).
export const EASY_TWO = new Set([
  'AM', 'AN', 'AS', 'AT', 'BE', 'BY', 'DO', 'GO', 'HE', 'IF', 'IN', 'IS', 'IT',
  'ME', 'MY', 'NO', 'OF', 'OK', 'ON', 'OR', 'SO', 'TO', 'UP', 'US', 'WE',
]);

// Easy plays everyday SCOWL common words (3–6 letters) plus the 25 everyday two-letter words in EASY_TWO,
// ignores the rack it keeps, and slips ~65% of turns into the 35th–75th percentile of its 30 best plays
// (W1-S3-01: recalibrated to an approachable ~230–270 pt beginner tier). Medium knows common words plus every
// word of 2–4 letters (`freeLen` 5), always plays its best, and weighs its leave. Hard knows the whole
// dictionary, weighs the rack it keeps, the Boiling Springs it opens and the endgame. Medium and Hard play the
// best play by their own measure (equity); plays within TIE_WINDOW equity points of it count as tied and the
// choice among them is drawn from state.rng.ai.
export const LEVELS = {
  easy: { commonOnly: true, freeLen: 0, allowTwo: EASY_TWO, maxLen: 6, leave: 0, pick: [0.35, 0.75], slip: 0.65, budget: 900000 },
  medium: { commonOnly: true, freeLen: 5, leave: 0.5, budget: 900000 },  // freeLen was 4 before wave 2
  hard: { leave: 1, defense: true, endgame: true, budget: 1500000 },
};

// A character's own habit, laid over the level they play at. Lucky bets on the big squares: he counts
// the points a play earns from premium squares again (premium) and cares little about the rack he keeps
// (leaveScale), so he will take a risky play on a Boiling Spring over a tidy one.
export const STYLES = {
  lucky: { premium: 0.5, leaveScale: 0.2 },
};

// Points a play earns from the premium squares it covers (letter multipliers, then the word multiplier).
export function premiumPoints(move) {
  let extra = 0, wm = 1;
  for (const t of move.tiles) {
    const sq = SQUARE[t.i];
    if (!t.blank) extra += VALUE[t.l] * ((LETTER_MULT[sq] || 1) - 1);
    wm *= WORD_MULT[sq] || 1;
  }
  return extra + move.score * (1 - 1 / wm);
}

const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);

// Value of the tiles kept on the rack after a play (learned by tools/selfplay.mjs).
export function leaveValue(leave, table = LEAVE) {
  if (!leave.length) return 0;
  let v = table.size[Math.min(leave.length, 6)], vowels = 0;
  const seen = {};
  for (const l of leave) {
    const n = (seen[l] = (seen[l] || 0) + 1);
    v += n === 1 ? table.single[l] || 0 : table.dup[l] || 0;
    if (VOWELS.has(l)) vowels++;
  }
  return v + table.vowelExcess[Math.max(-3, Math.min(3, vowels - Math.round(0.4 * leave.length))) + 3];
}

export const rackMinus = (rack, tiles) => {
  const left = rack.slice();
  for (const t of tiles) { const k = left.indexOf(t.blank ? '?' : t.l); if (k >= 0) left.splice(k, 1); }
  return left;
};

// What Hard takes off a play for each empty word-multiplier square it puts within reach of the opponent: a Boiling Spring
// (triple word) and, since wave 3, a Steam square (double word). Before wave 3 only the Boiling Springs counted (steam was 0).
export const DEFENSE = { boiling: 4, steam: 1.5 };

// Equity points within which Medium and Hard treat two plays as tied and choose between them with the seeded stream (0 = the old rule).
export const TIE_WINDOW = 1.5;

// The plays tied with the best one: `ranked` is sorted by equity, best first.
export const tiedWithBest = (ranked) => ranked.filter((r) => r.e >= ranked[0].e - TIE_WINDOW);

// Empty Boiling Spring and Steam squares a move puts within reach of the opponent (same line, ≤ 3 away, or adjacent),
// weighted by DEFENSE.
export function openedPremium(board, tiles) {
  let n = 0;
  for (let i = 0; i < N * N; i++) {
    const w = SQUARE[i] === 'b' ? DEFENSE.boiling : SQUARE[i] === 's' ? DEFENSE.steam : 0;
    if (!w || board[i]) continue;
    const r = Math.floor(i / N), c = i % N;
    for (const t of tiles) {
      const tr = Math.floor(t.i / N), tc = t.i % N;
      if ((tr === r && Math.abs(tc - c) <= 3) || (tc === c && Math.abs(tr - r) <= 3)) { n += w; break; }
    }
  }
  return n;
}

const rackScore = (rack) => rack.reduce((a, l) => a + (l === '?' ? 0 : VALUE[l]), 0);

// state: engine state (only board, players, cur, bag, featured and rng.ai are read; rng.ai advances).
export function chooseAction(dict, lex, s, opts = {}) {
  const p = s.players[s.cur];
  const L = LEVELS[opts.level || p.level || 'medium'];
  const style = STYLES[opts.persona || p.persona] || null;
  // W1-S3-02 / CD-WF1-06: never score hidden Featured Springs (+30) during AI move search; AI earns them organically on word merit.
  const { moves, nodes } = generateMoves(dict, s.board, p.rack, { lex, featured: [], commonOnly: L.commonOnly, freeLen: L.freeLen, allowTwo: L.allowTwo, maxLen: L.maxLen, budget: L.budget });
  const bag = s.bag.length;
  if (!moves.length) return { action: fallback(p.rack, bag), nodes };

  if (L.pick) {
    const top = moves.slice(0, 30);
    if (style) top.sort((a, b) => b.score + style.premium * premiumPoints(b) - a.score - style.premium * premiumPoints(a));
    if (L.slip < 1 && rand(s, 'ai') >= L.slip) return { action: { type: 'play', tiles: top[0].tiles }, nodes, move: top[0] };
    const lo = Math.floor(top.length * L.pick[0]), hi = Math.max(lo + 1, Math.ceil(top.length * L.pick[1]));
    const m = top[lo + Math.floor(rand(s, 'ai') * (hi - lo))];
    return { action: { type: 'play', tiles: m.tiles }, nodes, move: m };
  }

  const equity = (m) => {
    const left = rackMinus(p.rack, m.tiles);
    let e = m.score;
    if (bag === 0) e -= 2 * rackScore(left);                       // going out matters, leave doesn't
    else e += L.leave * (style ? style.leaveScale : 1) * leaveValue(left) * Math.min(1, bag / RACK);
    if (style && bag > 0) e += style.premium * premiumPoints(m);
    if (L.defense && bag > 0) e -= openedPremium(s.board, m.tiles);
    return e;
  };
  const ranked = moves.slice(0, 60).map((m) => ({ m, e: equity(m) })).sort((a, b) => b.e - a.e || (a.m.key < b.m.key ? -1 : 1));

  // Hard, 2 players, empty bag: look one reply ahead (the opponent's rack is known by then).
  if (L.endgame && bag === 0 && s.players.length === 2) {
    const opp = s.players[1 - s.cur];
    let best = null;
    for (const { m } of ranked.slice(0, 8)) {
      const board = s.board.slice();
      for (const t of m.tiles) board[t.i] = { l: t.l, blank: t.blank };
      const left = rackMinus(p.rack, m.tiles);
      let val;
      if (!left.length) val = m.score + 2 * rackScore(opp.rack);
      else {
        const reply = generateMoves(dict, board, opp.rack, { lex, featured: [], budget: 300000 }).moves[0];
        const oppOut = reply && rackMinus(opp.rack, reply.tiles).length === 0;
        val = m.score - (reply ? reply.score : 0) - (oppOut ? 2 * rackScore(left) : 0);
      }
      if (!best || val > best.val) best = { m, val };
    }
    return { action: { type: 'play', tiles: best.m.tiles }, nodes, move: best.m };
  }

  // varied: a seeded draw among the plays tied with the best (the Daily's par passes exact: true, so a date keeps one answer)
  const near = opts.exact ? [] : tiedWithBest(ranked);
  const pick = near.length > 1 ? near[Math.floor(rand(s, 'ai') * near.length)] : ranked[0];
  // a weak play with a bad rack: swap instead (Medium and Hard)
  if (bag >= RACK && pick.m.score < 8 && leaveValue(p.rack) < -6) return { action: fallback(p.rack, bag), nodes };
  return { action: { type: 'play', tiles: pick.m.tiles }, nodes, move: pick.m };
}

// No play: swap the tiles that hurt the leave most (keep the best 0–3), or pass when the bag is low.
function fallback(rack, bag) {
  if (bag < RACK) return { type: 'pass' };
  const keep = [];
  const order = rack.slice().sort((a, b) => (LEAVE.single[b] || 0) - (LEAVE.single[a] || 0));
  for (const l of order) if (keep.length < 3 && (LEAVE.single[l] || 0) > 0 && !keep.includes(l)) keep.push(l);
  const letters = rackMinus(rack, keep.map((l) => ({ l, blank: l === '?' })));
  return letters.length ? { type: 'swap', letters } : { type: 'pass' };
}

// The hint: up to three different plays for a human seat, best Medium-strength play first (score plus half the value of the tiles kept),
// each with the tiles it keeps. Two plays that make the same words count as one. Empty when nothing fits.
export function hintChoices(dict, lex, s, n = 3) {
  const p = s.players[s.cur];
  // W1-S3-02 / CD-WF1-06: Spring Guide hints never peek at hidden Featured Spring words.
  const { moves } = generateMoves(dict, s.board, p.rack, { lex, featured: [], budget: 900000 });
  const bag = s.bag.length;
  const ranked = moves.slice(0, 60).map((m) => { const keep = rackMinus(p.rack, m.tiles); return { m, keep, e: m.score + 0.5 * leaveValue(keep) * Math.min(1, bag / RACK) }; }).sort((a, b) => b.e - a.e);
  const out = [], seen = new Set();
  for (const { m, keep } of ranked) {
    const k = m.words.join(',');
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ tiles: m.tiles, score: m.score, words: m.words, keep });
    if (out.length >= n) break;
  }
  return out;
}
// The best of them, or null.
export function bestHint(dict, lex, s) {
  const [best] = hintChoices(dict, lex, s, 1);
  return best || null;
}

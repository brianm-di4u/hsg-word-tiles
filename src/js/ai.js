// Computer opponents. Picks a play, a swap or a pass for the current seat. No DOM; runs in the AI
// worker (and in Node for the tools). Randomness (Easy only) comes from state.rng.ai, and the caller
// keeps the advanced stream, so games stay reproducible.
import { generateMoves } from './movegen.js';
import { rand } from './rng.js';
import { N, SQUARE, VALUE, RACK } from './score.js';
import { LEAVE } from './leave-table.js';

// Strength comes mostly from vocabulary: Easy knows common words up to 6 letters and plays an
// ordinary move; Medium knows common words plus every 2–3 letter word and plays its best; Hard knows
// the whole dictionary and weighs the rack it keeps, the Boiling Springs it opens and the endgame.
export const LEVELS = {
  easy: { commonOnly: true, maxLen: 6, leave: 0, pick: [0.2, 0.5], budget: 400000 },
  medium: { commonOnly: true, freeLen: 4, leave: 0.5, budget: 900000 },
  hard: { leave: 1, defense: true, endgame: true, budget: 1500000 },
};

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

// Empty Boiling Spring squares a move puts within reach of the opponent (same line, ≤ 3 away, or adjacent).
function openedBoiling(board, tiles) {
  let n = 0;
  for (let i = 0; i < N * N; i++) {
    if (SQUARE[i] !== 'b' || board[i]) continue;
    const r = Math.floor(i / N), c = i % N;
    for (const t of tiles) {
      const tr = Math.floor(t.i / N), tc = t.i % N;
      if ((tr === r && Math.abs(tc - c) <= 3) || (tc === c && Math.abs(tr - r) <= 3)) { n++; break; }
    }
  }
  return n;
}

const rackScore = (rack) => rack.reduce((a, l) => a + (l === '?' ? 0 : VALUE[l]), 0);

// state: engine state (only board, players, cur, bag, featured and rng.ai are read; rng.ai advances).
export function chooseAction(dict, lex, s, opts = {}) {
  const p = s.players[s.cur];
  const L = LEVELS[opts.level || p.level || 'medium'];
  const { moves, nodes } = generateMoves(dict, s.board, p.rack, { lex, featured: s.featured, commonOnly: L.commonOnly, freeLen: L.freeLen, maxLen: L.maxLen, budget: L.budget });
  const bag = s.bag.length;
  if (!moves.length) return { action: fallback(p.rack, bag), nodes };

  if (L.pick) {
    const top = moves.slice(0, 30);
    const lo = Math.floor(top.length * L.pick[0]), hi = Math.max(lo + 1, Math.ceil(top.length * L.pick[1]));
    const m = top[lo + Math.floor(rand(s, 'ai') * (hi - lo))];
    return { action: { type: 'play', tiles: m.tiles }, nodes, move: m };
  }

  const equity = (m) => {
    const left = rackMinus(p.rack, m.tiles);
    let e = m.score;
    if (bag === 0) e -= 2 * rackScore(left);                       // going out matters, leave doesn't
    else e += L.leave * leaveValue(left) * Math.min(1, bag / RACK);
    if (L.defense && bag > 0) e -= 4 * openedBoiling(s.board, m.tiles);
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
        const reply = generateMoves(dict, board, opp.rack, { lex, featured: s.featured, budget: 300000 }).moves[0];
        const oppOut = reply && rackMinus(opp.rack, reply.tiles).length === 0;
        val = m.score - (reply ? reply.score : 0) - (oppOut ? 2 * rackScore(left) : 0);
      }
      if (!best || val > best.val) best = { m, val };
    }
    return { action: { type: 'play', tiles: best.m.tiles }, nodes, move: best.m };
  }

  const pick = ranked[0];
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

// The hint: the best Medium-strength play for a human seat, or null.
export function bestHint(dict, lex, s) {
  const p = s.players[s.cur];
  const { moves } = generateMoves(dict, s.board, p.rack, { lex, featured: s.featured, budget: 900000 });
  if (!moves.length) return null;
  const bag = s.bag.length;
  let best = null;
  for (const m of moves.slice(0, 60)) {
    const e = m.score + 0.5 * leaveValue(rackMinus(p.rack, m.tiles)) * Math.min(1, bag / RACK);
    if (!best || e > best.e) best = { m, e };
  }
  return best.m;
}

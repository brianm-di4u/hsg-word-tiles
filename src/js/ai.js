// Computer opponents. Picks a play, a swap or a pass for the current seat. No DOM; runs in the AI
// worker (and in Node for the tools). Randomness (Easy only) comes from state.rng.ai, and the caller
// keeps the advanced stream, so games stay reproducible.
import { generateMoves } from './movegen.js';
import { isCommon } from './dict.js';
import { deducibleFeatured } from './lexicon.js';
import { rand } from './rng.js';
import { N, SQUARE, VALUE, RACK, findWords, wordScore } from './score.js';
import { LEAVE } from './leave-table.js';

// Everyday two-letter words Easy is allowed to play (no obscure tournament two-letter tools like XU, ZA, QI, KI, OY, UT).
export const EASY_TWO = new Set([
  'AM', 'AN', 'AS', 'AT', 'BE', 'BY', 'DO', 'GO', 'HE', 'IF', 'IN', 'IS', 'IT',
  'ME', 'MY', 'NO', 'OF', 'OK', 'ON', 'OR', 'SO', 'TO', 'UP', 'US', 'WE',
]);

// Easy plays everyday SCOWL common words (3–6 letters) plus the 25 everyday two-letter words in EASY_TWO,
// ignores the rack it keeps, and slips ~60% of turns into the 5th–35th percentile of its 30 best plays
// (W1-S3-01, OQ-WF7-W2-01 Option B: recalibrated to an approachable ~250 pt beginner tier). Medium knows common words plus every
// word of 2–4 letters (`freeLen` 5), always plays its best, and weighs its leave. Hard knows the whole
// dictionary, weighs the rack it keeps, the Boiling Springs it opens and the endgame. Medium and Hard play the
// best play by their own measure (equity); plays within TIE_WINDOW equity points of it count as tied and the
// choice among them is drawn from state.rng.ai.
export const LEVELS = {
  easy: { commonOnly: true, freeLen: 0, allowTwo: EASY_TWO, maxLen: 6, leave: 0, bonusWeight: 0, pick: [0.05, 0.35], slip: 0.60, budget: 900000 },
  medium: { commonOnly: true, freeLen: 5, leave: 0.65, bonusWeight: 0.5, budget: 900000 },  // freeLen was 4 before wave 2; leave tuned 0.5->0.65 for S3-02 (Ruling 12)
  hard: { leave: 1, defense: true, endgame: true, bonusWeight: 1, budget: 1500000 },
};

// Each character's own trade habit, laid orthogonally over whatever difficulty level they play at (W1-S5-02):
//   - Opal Vance (bath attendant): favours baths/springs bonus words and Bathhouse Row squares.
//   - Hollis Crane (park ranger): favours compact connected cross-plays, park words, and guarding open springs.
//   - "Lucky" Delmar (racetrack tout): bets on the big multiplier squares and cares little about rack leave.
//   - Maestro Julian Fitch (1920s hotel bandleader): reaches for 5+ letter crescendo plays / Full Soaks and keeps a tidy rack.
export const STYLES = {
  opal: { premium: 0, leaveScale: 1, cats: ['baths', 'springs'], catBonus: 6, rowSquare: 3.5 },
  hollis: { premium: 0, leaveScale: 1, cats: ['park'], catBonus: 6, crossWord: 2.8, defenseExtra: 0.55 },
  lucky: { premium: 0.5, leaveScale: 0.2 },
  julian: { premium: 0, leaveScale: 1.35, tidyLeave: 0.45, longLen: 5, longBonus: 3.2, fullBonus: 4.5 },
};

// Trade-grounded style adjustment for a candidate move, independent of difficulty tier.
export function styleBonus(style, move, left, s, lex, opts = {}) {
  if (!style) return 0;
  const bag = s.bag.length;
  let delta = 0;
  if (style.premium && bag > 0) delta += style.premium * premiumPoints(move, s.board);
  if (style.cats && style.catBonus && lex) {
    for (const w of move.words) {
      const e = lex.byForm.get(w);
      if (e && style.cats.includes(e.cat)) delta += style.catBonus;
    }
  }
  if (style.rowSquare) {
    for (const t of move.tiles) if (SQUARE[t.i] === 'B') delta += style.rowSquare;
  }
  if (style.crossWord && move.words.length > 1) delta += Math.min(move.words.length - 1, 3) * style.crossWord;
  if (style.defenseExtra && bag > 0 && s.players.length > 1) delta -= style.defenseExtra * openedPremium(s.board, move.tiles, 0);   // his care is for the springs, not the Row
  if (style.longBonus && move.words[0] && move.words[0].length >= style.longLen) delta += style.longBonus;
  if (style.fullBonus && move.full) delta += style.fullBonus;
  if (opts.easy && style.tidyLeave && bag > 0) delta += style.tidyLeave * leaveValue(left) * Math.min(1, bag / RACK);
  return delta;
}

// Points a play earns from the premium squares it covers: each word it makes, with the multipliers less without (W6-S1-03). The Hot
// Springs, Featured and Full Soak bonuses and the words no multiplier touches are not part of it.
export function premiumPoints(move, board = []) {
  const { words, add } = findWords(board, move.tiles);
  let extra = 0;
  for (const w of words || []) {
    extra += wordScore(board, add, w);
    for (const k of w.cells) { const t = add.get(k) || board[k]; if (!t.blank) extra -= VALUE[t.l]; }
  }
  return extra;
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
// An open Bathhouse Row square counts half a Steam square (W1-S4-08): its +20 needs a Hot Springs word, so in Hard's own games one in
// reach was worth only about 0.5 points more a turn (and a letter of a plaque).
export const DEFENSE = { boiling: 4, steam: 1.5, row: 0.75 };

// Equity points within which Medium and Hard treat two plays as tied and choose between them with the seeded stream (0 = the old rule).
export const TIE_WINDOW = 1.5;

// The plays tied with the best one: `ranked` is sorted by equity, best first.
export const tiedWithBest = (ranked) => ranked.filter((r) => r.e >= ranked[0].e - TIE_WINDOW);

// Empty Boiling Spring, Steam and Bathhouse Row squares a move puts within reach of the opponent (same line, ≤ 3 away, or
// adjacent), weighted by DEFENSE. `row` overrides the Row's weight.
export function openedPremium(board, tiles, row = DEFENSE.row) {
  let n = 0;
  for (let i = 0; i < N * N; i++) {
    const w = SQUARE[i] === 'b' ? DEFENSE.boiling : SQUARE[i] === 's' ? DEFENSE.steam : SQUARE[i] === 'B' ? row : 0;
    if (!w || board[i]) continue;
    if (SQUARE[i] === 'B' && tiles.some((t) => t.i === i)) continue;   // covered by the play itself: closed, not opened
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
  // W1-S3-02, W6-S3-02 / CD-WF1-06: only a Featured Spring anyone can work out from its plaque is worth +30 in the search (and not to
  // Easy, which plays without Hot Springs foresight); a hidden one is earned only by chance, when a word is played on its own merit.
  // The Daily's par (plaques: false) goes for the score on the board alone, so the par of a date stays what it was.
  // W1-S2-08: scale Hot Springs lexicon-bonus foresight by tier (Easy 0%, Medium 50%, Hard 100%).
  const bonusWeight = L.bonusWeight ?? 1;
  const known = bonusWeight > 0 && opts.plaques !== false ? deducibleFeatured(s.featured, lex) : [];
  const { moves, nodes } = generateMoves(dict, s.board, p.rack, { lex, featured: known, bonusWeight, commonOnly: L.commonOnly, freeLen: L.freeLen, allowTwo: L.allowTwo, maxLen: L.maxLen, budget: L.budget });
  const bag = s.bag.length;
  if (!moves.length) return { action: fallback(p.rack, bag), nodes };

  if (L.pick) {
    const top = moves.slice(0, 30);
    if (style) {
      const scoreOf = new Map(top.map((m) => [m, (m.evalScore ?? m.score) + styleBonus(style, m, rackMinus(p.rack, m.tiles), s, lex, { easy: true })]));
      top.sort((a, b) => scoreOf.get(b) - scoreOf.get(a) || (a.key < b.key ? -1 : 1));
    }
    if (L.slip < 1 && rand(s, 'ai') >= L.slip) return { action: { type: 'play', tiles: top[0].tiles }, nodes, move: top[0] };
    const lo = Math.floor(top.length * L.pick[0]), hi = Math.max(lo + 1, Math.ceil(top.length * L.pick[1]));
    const m = top[lo + Math.floor(rand(s, 'ai') * (hi - lo))];
    return { action: { type: 'play', tiles: m.tiles }, nodes, move: m };
  }

  const dailyTurns = s.daily && typeof s.daily.turns === 'number' ? s.daily.turns : null;
  const leaveScale = dailyTurns != null
    ? Math.min(1, bag / RACK) * Math.min(1, Math.max(0, dailyTurns - 1) / 3)
    : Math.min(1, bag / RACK);
  const equity = (m) => {
    const left = rackMinus(p.rack, m.tiles);
    let e = m.evalScore ?? m.score;
    if (bag === 0) e -= 2 * rackScore(left);                       // going out matters, leave doesn't
    else e += L.leave * (style ? (style.leaveScale ?? 1) : 1) * leaveValue(left) * leaveScale;
    if (style) e += styleBonus(style, m, left, s, lex);
    if (L.defense && bag > 0 && s.players.length > 1) e -= openedPremium(s.board, m.tiles);
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
        // the reply is searched with the plaques this play leaves unclaimed
        const open = known.filter((f) => !m.words.some((w) => w === f.word || (f.id != null && lex.byForm.get(w)?.id === f.id)));
        const reply = generateMoves(dict, board, opp.rack, { lex, featured: open, budget: 300000 }).moves[0];
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
  // a weak play with a bad rack: swap instead (Medium and Hard; never on the final turn of a Daily Soak)
  if (bag >= RACK && (dailyTurns == null || dailyTurns > 1) && (pick.m.evalScore ?? pick.m.score) < 8 && leaveValue(p.rack) < -6) return { action: fallback(p.rack, bag), nodes };
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

// Equity points within which Spring Guide hints in Easy/Medium games prefer everyday/Hot Springs words over obscure ENABLE words (W1-S3-06).
export const HINT_COMMON_GAP = 6;
// Equity points within which Spring Guide 'Other plays' surfaces a competitive Hot Springs bonus word in the 3 choices (W1-S5-03).
export const HINT_THEMED_GAP = 8;

// Everyday SCOWL common words, the 25 everyday two-letter words (including OK), and all Hot Springs bonus forms.
export function isTeachableWord(dict, lex, word) {
  return !!(lex && lex.byForm && lex.byForm.has(word)) || isCommon(dict, word) || (word.length === 2 && EASY_TWO.has(word));
}

// Easy/Medium games, Pass-and-Play, and Daily Soak coach with everyday and Hot Springs vocabulary (W1-S3-06 / CD-WF1-05);
// games against a Hard AI opponent coach with the full dictionary.
export function casualAudience(s) {
  if (!s || !Array.isArray(s.players)) return true;
  return !s.players.some((p) => p && p.kind !== 'human' && p.level === 'hard');
}

// The hint: up to three different plays for a human seat, best Medium-strength play first (score plus half the value of the tiles kept),
// each with the tiles it keeps. In Easy/Medium games, prefers SCOWL common words and Hot Springs bonus words whenever one sits within
// HINT_COMMON_GAP equity points of the raw best (W1-S3-06); on the game's opening play it always sets an everyday or Hot Springs word,
// and a rarer word further ahead than that waits in the last choice (W6-S1-01, CD-WF1-05). When n >= 2 surfaces a competitive Hot Springs bonus word (within
// HINT_THEMED_GAP equity of the best choice) among the choices if none already made the top n (W1-S5-03). Two plays that make the
// same words count as one. Empty when nothing fits.
export function hintChoices(dict, lex, s, n = 3) {
  const p = s.players[s.cur];
  // W1-S3-02, W6-S3-02 / CD-WF1-06: Spring Guide hints never peek: only a plaque anyone can work out counts.
  const { moves } = generateMoves(dict, s.board, p.rack, { lex, featured: deducibleFeatured(s.featured, lex), budget: 900000 });
  if (!moves.length) return [];
  const bag = s.bag.length, bagScale = 0.5 * Math.min(1, bag / RACK);
  const casual = casualAudience(s);
  const teachable = (m) => m.words.every((w) => isTeachableWord(dict, lex, w));
  const pool = moves.slice(0, 60);
  const seenKey = new Set(pool.map((m) => m.key));
  if (casual) {
    let added = 0;
    for (const m of moves) {
      if (!teachable(m)) continue;
      if (!seenKey.has(m.key)) { seenKey.add(m.key); pool.push(m); }
      if (++added >= 60) break;
    }
  }
  if (lex) {
    let added = 0;
    for (const m of moves) {
      if (!m.bonus) continue;
      if (casual && !teachable(m)) continue;
      if (!seenKey.has(m.key)) { seenKey.add(m.key); pool.push(m); }
      if (++added >= 20) break;
    }
  }
  const ranked = pool
    .map((m) => { const keep = rackMinus(p.rack, m.tiles); return { m, keep, common: casual ? teachable(m) : true, e: m.score + leaveValue(keep) * bagScale }; })
    .sort((a, b) => b.e - a.e || (a.m.key < b.m.key ? -1 : 1));
  const ordered = [];
  let rareLast = null;
  if (casual) {
    const bestAll = ranked[0];
    const commons = ranked.filter((r) => r.common);
    const rares = ranked.filter((r) => !r.common);
    if (commons.length && bestAll.e - commons[0].e <= HINT_COMMON_GAP) {
      ordered.push(...commons, ...rares);
    } else {
      const opening = commons.length > 0 && !s.board.some(Boolean);
      if (opening) rareLast = n >= 3 ? bestAll : null;
      else if (bestAll && !bestAll.common) ordered.push(bestAll);
      ordered.push(...commons, ...rares);
    }
  } else {
    ordered.push(...ranked);
  }
  const picked = [], seen = new Set();
  for (const r of ordered) {
    const k = r.m.words.join(',');
    if (seen.has(k)) continue;
    seen.add(k);
    picked.push(r);
    if (picked.length >= n - (rareLast ? 1 : 0)) break;
  }
  if (n >= 2 && lex && picked.length >= 2 && !picked.some((r) => r.m.bonus > 0)) {
    const topE = picked[0].e;
    const themed = ordered.find((r) => r.m.bonus > 0 && (!casual || r.common) && !seen.has(r.m.words.join(',')) && topE - r.e <= HINT_THEMED_GAP);
    if (themed) picked[picked.length - 1] = themed;
  }
  if (rareLast && !picked.includes(rareLast)) picked.push(rareLast);
  return picked.map(({ m, keep }) => ({ tiles: m.tiles, score: m.score, words: m.words, keep }));
}
// The best of them, or null.
export function bestHint(dict, lex, s) {
  const [best] = hintChoices(dict, lex, s, 1);
  return best || null;
}

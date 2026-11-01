// Word finding and scoring for a placement. Shared by the engine, the AI and the hint, so a move is
// always scored one way. No DOM.
import { SIZE, CENTER, ROWS, BATHHOUSES } from './layout.js';
import { TILES } from './tiles.js';

export const N = SIZE;
export const SQUARE = ROWS.join('').split('');           // per square: . w h s b * B
export const LETTER_MULT = { w: 2, h: 3 };
export const WORD_MULT = { s: 2, b: 3 };
export const FULL_SOAK = 40, FEATURED_BONUS = 30, RACK = 7;
export const VALUE = {};
for (const [l, t] of Object.entries(TILES)) VALUE[l] = t.value;

export const isBath = (i) => SQUARE[i] === 'B';
export { CENTER, BATHHOUSES };

// The letter at square i, given the board and a map of new tiles { i: {l, blank} }.
const at = (board, add, i) => add.get(i) || board[i];

// Words formed by placing `tiles` ([{i, l, blank}]) on `board` (array of null | {l, blank}).
// Returns { error } or { dir, words: [{ w, cells: [i], newCells: [i] }] }. Geometry only: no dictionary.
export function findWords(board, tiles) {
  if (!tiles.length) return { error: 'Place at least one tile.' };
  const add = new Map();
  for (const t of tiles) {
    if (t.i < 0 || t.i >= N * N) return { error: 'That square is off the board.' };
    if (board[t.i]) return { error: 'That square is already taken.' };
    if (add.has(t.i)) return { error: 'Two tiles on one square.' };
    add.set(t.i, t);
  }
  const rows = new Set(tiles.map((t) => Math.floor(t.i / N))), cols = new Set(tiles.map((t) => t.i % N));
  let dir;
  if (tiles.length === 1) dir = 0;
  else if (rows.size === 1) dir = 1;          // across
  else if (cols.size === 1) dir = N;          // down
  else return { error: 'Tiles must be in one row or one column.' };

  const words = [];
  const scan = (i, step) => {
    // walk back to the word start, then forward; step 1 = across, N = down
    const same = (a, b) => (step === 1 ? Math.floor(a / N) === Math.floor(b / N) : true);
    let s = i;
    while (s - step >= 0 && same(s - step, i) && at(board, add, s - step)) s -= step;
    const cells = [];
    for (let k = s; k < N * N && same(k, i) && at(board, add, k); k += step) cells.push(k);
    return cells;
  };
  const sorted = [...tiles].sort((a, b) => a.i - b.i);
  if (dir) {
    const main = scan(sorted[0].i, dir);
    // no gaps: the main word must contain every new tile
    if (!sorted.every((t) => main.includes(t.i))) return { error: 'Leave no gaps between your tiles.' };
    words.push(main);
    const cross = dir === 1 ? N : 1;
    for (const t of sorted) { const c = scan(t.i, cross); if (c.length > 1) words.push(c); }
  } else {
    const across = scan(sorted[0].i, 1), down = scan(sorted[0].i, N);
    if (across.length > 1) words.push(across);
    if (down.length > 1) words.push(down);
    dir = across.length >= down.length ? 1 : N;
  }
  const out = [];
  for (const cells of words) {
    if (cells.length < 2) continue;
    out.push({ w: cells.map((k) => at(board, add, k).l).join(''), cells, newCells: cells.filter((k) => add.has(k)) });
  }
  if (!out.length) return { error: 'Make a word of at least two letters.' };
  return { dir, words: out, add };
}

// Connection rule: the first play covers the centre with ≥ 2 tiles; later plays touch a tile.
export function connectError(board, tiles) {
  const empty = !board.some(Boolean);
  if (empty) {
    if (!tiles.some((t) => t.i === CENTER)) return 'The first word must cover the Display Spring at the centre.';
    if (tiles.length < 2) return 'The first word needs at least two tiles.';
    return null;
  }
  const touches = (i) => {
    const r = Math.floor(i / N), c = i % N;
    return (r > 0 && board[i - N]) || (r < N - 1 && board[i + N]) || (c > 0 && board[i - 1]) || (c < N - 1 && board[i + 1]);
  };
  return tiles.some((t) => touches(t.i)) ? null : 'Your word must join the tiles already on the board.';
}

// Score one found word. Premiums count only for squares covered by this play.
export function wordScore(board, add, word) {
  let sum = 0, mult = 1;
  for (const k of word.cells) {
    const t = add.get(k) || board[k];
    const v = t.blank ? 0 : VALUE[t.l];
    if (add.has(k)) {
      const sq = SQUARE[k];
      sum += v * (LETTER_MULT[sq] || 1);
      mult *= WORD_MULT[sq] || 1;
    } else sum += v;
  }
  return sum * mult;
}

// Full scoring of a geometrically valid placement. `lex` may be null (no bonuses), `featured` is the
// game's featured list (claimed ones are skipped). Returns totals and a per-word breakdown.
export function scorePlay(board, found, tilesPlaced, lex, featured) {
  let total = 0, themed = 0, feat = null;
  const words = found.words.map((wd) => {
    const base = wordScore(board, found.add, wd);
    let bonus = 0, entry = null, bath = false;
    if (lex) {
      entry = lex.entry(wd.w);
      if (entry) {
        bath = wd.newCells.some(isBath);
        bonus = lex.bonusOf(entry) * (bath ? 2 : 1);
      }
    }
    total += base + bonus;
    themed += bonus;
    return { w: wd.w, cells: wd.cells, score: base, bonus, themed: entry ? entry.id : null, bath };
  });
  if (featured) {
    for (const f of featured) {
      if (f.by != null) continue;
      if (words.some((x) => x.w === f.word)) { feat = f.word; total += FEATURED_BONUS; break; }
    }
  }
  const full = tilesPlaced === RACK ? FULL_SOAK : 0;
  total += full;
  return { score: total, words, full, themed, featured: feat, featuredBonus: feat ? FEATURED_BONUS : 0 };
}

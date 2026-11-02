// Independent reference for placement legality and scoring, written separately from src/js/score.js
// and engine.js on purpose: it rescans the whole board after placing the tiles, checks words against a
// plain Set built from the raw ENABLE list minus the blocklist, and scores from the layout strings
// directly. tests/03-reference compares it with the engine on random plays.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rawDir } from './raw-dir.mjs';
import { ROWS, BATHHOUSES } from '../src/js/layout.js';
import { TILES } from '../src/js/tiles.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function referenceWordSet() {
  const lines = (f) => fs.readFileSync(f, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const stems = [], exact = new Set();
  for (const l of lines(path.join(root, 'data/blocklist.txt'))) {
    if (l.startsWith('#')) continue;
    if (l.startsWith('stem:')) stems.push(l.slice(5)); else exact.add(l);
  }
  const set = new Set();
  for (const w of lines(path.join(rawDir(root), 'enable1.txt'))) {
    if (!/^[a-z]{2,15}$/.test(w) || exact.has(w) || stems.some((s) => w.startsWith(s))) continue;
    set.add(w.toUpperCase());
  }
  return set;
}

const SQ = ROWS.map((r) => r.split(''));
const LM = { w: 2, h: 3 }, WM = { s: 2, b: 3 };

// board: 15×15 array [r][c] of null | {l, blank}; tiles: [{r, c, l, blank}]. themed: Map form → bonus.
// Returns { ok:false, reason } or { ok:true, score, words:[string] }.
export function refPlay(board, tiles, words, themed = new Map(), featuredWords = []) {
  const n = 15;
  if (!tiles.length) return { ok: false, reason: 'none' };
  const g = board.map((row) => row.slice());
  for (const t of tiles) {
    if (t.r < 0 || t.r >= n || t.c < 0 || t.c >= n || g[t.r][t.c]) return { ok: false, reason: 'occupied' };
    g[t.r][t.c] = { l: t.l, blank: t.blank, fresh: true };
  }
  const sameRow = tiles.every((t) => t.r === tiles[0].r), sameCol = tiles.every((t) => t.c === tiles[0].c);
  if (!sameRow && !sameCol) return { ok: false, reason: 'line' };
  // every maximal run of ≥ 2 that contains a fresh tile is a formed word
  const formed = [];
  const runs = (get, lenA) => {
    for (let a = 0; a < n; a++) {
      let run = [];
      for (let b = 0; b <= n; b++) {
        const cell = b < n ? get(a, b) : null;
        if (cell) run.push(cell);
        else { if (run.length >= 2 && run.some((x) => x.t.fresh)) formed.push(run); run = []; }
      }
    }
  };
  runs((r, c) => (g[r][c] ? { t: g[r][c], r, c } : null));
  runs((c, r) => (g[r][c] ? { t: g[r][c], r, c } : null));
  // gaps: all fresh tiles must lie in one formed run along their line (or a single tile)
  if (tiles.length > 1) {
    const line = formed.find((run) => tiles.every((t) => run.some((x) => x.r === t.r && x.c === t.c)) &&
      (sameRow ? run.every((x) => x.r === tiles[0].r) : run.every((x) => x.c === tiles[0].c)));
    if (!line) return { ok: false, reason: 'gap' };
  }
  const empty = board.every((row) => row.every((x) => !x));
  if (empty) {
    if (!tiles.some((t) => t.r === 7 && t.c === 7) || tiles.length < 2) return { ok: false, reason: 'start' };
  } else {
    const nb = (r, c) => [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].some(([y, x]) => y >= 0 && y < n && x >= 0 && x < n && board[y][x]);
    if (!tiles.some((t) => nb(t.r, t.c))) return { ok: false, reason: 'connect' };
  }
  if (!formed.length) return { ok: false, reason: 'noword' };
  let total = 0;
  const list = [];
  for (const run of formed) {
    const w = run.map((x) => x.t.l).join('');
    if (!words.has(w)) return { ok: false, reason: 'word', word: w };
    let s = 0, m = 1, bath = false;
    for (const x of run) {
      const v = x.t.blank ? 0 : TILES[x.t.l].value;
      const k = x.t.fresh ? SQ[x.r][x.c] : '.';
      s += v * (LM[k] || 1);
      m *= WM[k] || 1;
      if (x.t.fresh && BATHHOUSES[x.r * n + x.c]) bath = true;
    }
    total += s * m + (themed.has(w) ? themed.get(w) * (bath ? 2 : 1) : 0);
    list.push(w);
  }
  if (tiles.length === 7) total += 40;
  for (const f of featuredWords) if (list.includes(f)) { total += 30; break; }
  return { ok: true, score: total, words: list.sort() };
}

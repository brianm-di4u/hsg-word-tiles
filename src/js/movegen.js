// Move generation: Appel & Jacobson (1988) on the dictionary DAWG, written from the paper.
// Across moves are generated on the board; down moves on its transpose with the same code. Each
// move is scored as it is recorded, with the same rules as score.js (tests/04-movegen checks every
// generated move against the engine). No DOM; runs in the AI worker and in Node.
import { EOW, LAST, COMMON } from './dict.js';
import { N, SQUARE, VALUE, LETTER_MULT, WORD_MULT, FULL_SOAK, FEATURED_BONUS, CENTER, RACK } from './score.js';

const ALL = (1 << 26) - 1;
const LV = new Int8Array(26);
for (let k = 0; k < 26; k++) LV[k] = VALUE[String.fromCharCode(65 + k)];
const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Premium tables for the board (across) and its transpose (down).
function premiumTables(transposed) {
  const lm = new Int8Array(N * N), wm = new Int8Array(N * N), bath = new Uint8Array(N * N);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const sq = SQUARE[transposed ? c * N + r : r * N + c];
    lm[r * N + c] = LETTER_MULT[sq] || 1;
    wm[r * N + c] = WORD_MULT[sq] || 1;
    bath[r * N + c] = sq === 'B' ? 1 : 0;
  }
  return { lm, wm, bath };
}
const PREM = [premiumTables(false), premiumTables(true)];

// board (engine form: null | {l, blank}) → grid of codes: 0 empty, 1–26 letter, +32 when a blank.
export function toGrid(board) {
  const g = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) { const t = board[i]; if (t) g[i] = (t.l.charCodeAt(0) - 64) | (t.blank ? 32 : 0); }
  return g;
}
const transpose = (g) => { const t = new Uint8Array(N * N); for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) t[r * N + c] = g[c * N + r]; return t; };

function edgeFor(E, node, letter) {
  if (!node) return -1;
  for (let i = node; ; i++) {
    const e = E[i], l = e & 31;
    if (l === letter) return i;
    if (l > letter || e & LAST) return -1;
  }
}

// rack: array of letters ('?' = blank). opts: { featured, lex, budget, commonOnly, freeLen, maxLen }
export function generateMoves(d, board, rack, opts = {}) {
  const E = d.edges, root = d.root;
  const lex = opts.lex || null;
  const featured = (opts.featured || []).filter((f) => f.by == null).map((f) => f.word);
  const budget = opts.budget || 2e6;
  // commonOnly: every word formed must be common, except words shorter than freeLen (Medium knows the short ones)
  const commonOnly = !!opts.commonOnly, freeLen = opts.freeLen || 0, maxLen = opts.maxLen || N;
  const counts = new Int8Array(27);
  for (const l of rack) counts[l === '?' ? 26 : l.charCodeAt(0) - 65]++;
  const rackSize = rack.length;
  const g0 = toGrid(board);
  const empty = !g0.some((x) => x);
  const moves = [];
  let nodes = 0, stopped = false;

  const isCommonWord = (w) => {
    let node = root, e = -1;
    for (let k = 0; k < w.length; k++) { if (k) node = E[e] >>> 8; e = edgeFor(E, node, w.charCodeAt(k) - 65); if (e < 0) return false; }
    return (E[e] & EOW) !== 0 && (E[e] & COMMON) !== 0;
  };

  for (let pass = 0; pass < 2; pass++) {
    const G = pass ? transpose(g0) : g0;
    const { lm, wm, bath } = PREM[pass];
    const toSq = pass ? (r, c) => c * N + r : (r, c) => r * N + c;
    // cross-checks along G's columns
    const mask = new Int32Array(N * N), cscore = new Int16Array(N * N), cup = new Array(N * N), cdown = new Array(N * N), anchor = new Uint8Array(N * N);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const i = r * N + c;
      if (G[i]) continue;
      const nb = (r > 0 && G[i - N]) || (r < N - 1 && G[i + N]) || (c > 0 && G[i - 1]) || (c < N - 1 && G[i + 1]);
      anchor[i] = empty ? (toSq(r, c) === CENTER ? 1 : 0) : nb ? 1 : 0;
      let up = '', down = '', sc = 0;
      for (let k = r - 1; k >= 0 && G[k * N + c]; k--) { const x = G[k * N + c]; up = A[(x & 31) - 1] + up; if (!(x & 32)) sc += LV[(x & 31) - 1]; }
      for (let k = r + 1; k < N && G[k * N + c]; k++) { const x = G[k * N + c]; down += A[(x & 31) - 1]; if (!(x & 32)) sc += LV[(x & 31) - 1]; }
      if (!up && !down) { mask[i] = ALL; cscore[i] = -1; continue; }
      cup[i] = up; cdown[i] = down; cscore[i] = sc;
      // prefix node
      let node = root, ok = true;
      for (let k = 0; k < up.length; k++) { const e = edgeFor(E, node, up.charCodeAt(k) - 65); if (e < 0) { ok = false; break; } node = E[e] >>> 8; }
      let m = 0;
      if (ok && node) {
        for (let j = node; ; j++) {
          const e = E[j];
          let good;
          if (!down) good = (e & EOW) !== 0;
          else {
            let n2 = e >>> 8, e2 = -1;
            good = true;
            for (let k = 0; k < down.length; k++) { e2 = edgeFor(E, n2, down.charCodeAt(k) - 65); if (e2 < 0) { good = false; break; } n2 = E[e2] >>> 8; }
            if (good) good = (E[e2] & EOW) !== 0;
          }
          if (good) m |= 1 << (e & 31);
          if (e & LAST) break;
        }
      }
      mask[i] = m;
    }

    // stacks for the word being built: letter index, new?, blank?
    const L = new Int8Array(N), NEW = new Uint8Array(N), BL = new Uint8Array(N);
    let placed = 0, row = 0, anc = 0;

    const record = (start, len) => {
      if (len < 2 || len > maxLen && placed) return;
      if (pass === 1 && placed === 1) {
        // a single tile with neighbours in the other direction was found by the across pass
        for (let k = 0; k < len; k++) if (NEW[k] && cscore[row * N + start + k] >= 0) return;
      }
      let sum = 0, mult = 1, cross = 0, bonus = 0, feat = 0, anyBath = 0;
      let word = '';
      const words = [];
      const tiles = [];
      for (let k = 0; k < len; k++) {
        const i = row * N + start + k, l = L[k], v = BL[k] ? 0 : LV[l];
        word += A[l];
        if (NEW[k]) {
          sum += v * lm[i]; mult *= wm[i];
          if (bath[i]) anyBath = 1;
          tiles.push({ i: toSq(row, start + k), l: A[l], blank: !!BL[k] });
          if (cscore[i] >= 0) {
            const cw = cup[i] + A[l] + cdown[i];
            cross += (cscore[i] + v * lm[i]) * wm[i];
            words.push(cw);
            if (lex) { const en = lex.byForm.get(cw); if (en) bonus += lex.bonusOf(en) * (bath[i] ? 2 : 1); }
          }
        } else sum += v;
      }
      words.unshift(word);
      if (lex) { const en = lex.byForm.get(word); if (en) bonus += lex.bonusOf(en) * (anyBath ? 2 : 1); }
      if (commonOnly && !words.every((w) => w.length < freeLen || isCommonWord(w))) return;
      for (const f of featured) if (words.includes(f)) { feat = FEATURED_BONUS; break; }
      const full = placed === RACK ? FULL_SOAK : 0;
      moves.push({ tiles, score: sum * mult + cross + full + bonus + feat, words, bonus, full, featured: feat });
    };

    const extend = (c, node, eow, len) => {
      if (++nodes > budget) { stopped = true; return; }
      const i = row * N + c;
      if (c >= N || !G[i]) {
        if (eow && placed && c > anc) record(c - len, len);
        if (c >= N || !node) return;
        const m = mask[i];
        for (let j = node; ; j++) {
          const e = E[j], l = e & 31;
          if (m & (1 << l)) {
            if (counts[l]) {
              counts[l]--; placed++; L[len] = l; NEW[len] = 1; BL[len] = 0;
              extend(c + 1, e >>> 8, (e & EOW) !== 0, len + 1);
              placed--; counts[l]++;
            }
            if (counts[26]) {
              counts[26]--; placed++; L[len] = l; NEW[len] = 1; BL[len] = 1;
              extend(c + 1, e >>> 8, (e & EOW) !== 0, len + 1);
              placed--; counts[26]++;
            }
            if (stopped) return;
          }
          if (e & LAST) break;
        }
      } else {
        const x = G[i], l = (x & 31) - 1;
        const e = edgeFor(E, node, l);
        if (e < 0) return;
        L[len] = l; NEW[len] = 0; BL[len] = x & 32 ? 1 : 0;
        extend(c + 1, E[e] >>> 8, (E[e] & EOW) !== 0, len + 1);
      }
    };

    // left part: `len` letters already on the stack will occupy anc-len … anc-1
    const left = (node, eow, len, limit) => {
      extend(anc, node, eow, len);
      if (stopped || len >= limit || !node || placed >= rackSize) return;
      for (let j = node; ; j++) {
        const e = E[j], l = e & 31;
        if (counts[l]) {
          counts[l]--; placed++; L[len] = l; NEW[len] = 1; BL[len] = 0;
          left(e >>> 8, (e & EOW) !== 0, len + 1, limit);
          placed--; counts[l]++;
        }
        if (counts[26]) {
          counts[26]--; placed++; L[len] = l; NEW[len] = 1; BL[len] = 1;
          left(e >>> 8, (e & EOW) !== 0, len + 1, limit);
          placed--; counts[26]++;
        }
        if (stopped) return;
        if (e & LAST) break;
      }
    };

    for (row = 0; row < N && !stopped; row++) {
      for (let c = 0; c < N && !stopped; c++) {
        const i = row * N + c;
        if (!anchor[i]) continue;
        anc = c;
        if (c > 0 && G[i - 1]) {
          // existing tiles to the left form a fixed prefix
          let s = c - 1;
          while (s > 0 && G[row * N + s - 1]) s--;
          let node = root, e = -1, ok = true;
          for (let k = s; k < c; k++) {
            const x = G[row * N + k];
            e = edgeFor(E, node, (x & 31) - 1);
            if (e < 0) { ok = false; break; }
            L[k - s] = (x & 31) - 1; NEW[k - s] = 0; BL[k - s] = x & 32 ? 1 : 0;
            node = E[e] >>> 8;
          }
          if (ok) extend(c, node, (E[e] & EOW) !== 0, c - s);
        } else {
          let limit = 0;
          for (let k = c - 1; k >= 0 && !G[row * N + k] && !anchor[row * N + k]; k--) limit++;
          left(root, false, 0, limit);
        }
      }
    }
  }
  // Fixed order: best score first, ties by a key from the tiles.
  const key = (m) => m.tiles.map((t) => t.i * 64 + (t.l.charCodeAt(0) - 64) + (t.blank ? 32 : 0)).join(',');
  for (const m of moves) m.key = key(m);
  moves.sort((a, b) => b.score - a.score || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return { moves, nodes, stopped };
}

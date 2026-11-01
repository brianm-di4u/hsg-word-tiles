// The game dictionary.
//
// Shipped form (data/dict.b64.txt, built by tools/build-dict.mjs): the sorted word list, front-coded
// and raw-deflated, then base64. Each word is one marker byte followed by its new letters (A–Z):
//   marker = 48 + p        p = letters shared with the previous word (0–15)
//   marker = 97 + p        the same, for a common word (SCOWL size ≤ 50; the Easy AI plays only these)
//
// Runtime form: a minimal DAWG built at load time, one Uint32 per edge:
//   bits 0–4  letter index 0–25 (A–Z)
//   bit 5     a word ends after this letter
//   bit 6     last edge of its node
//   bit 7     that word is common
//   bits 8–31 index of the child node's first edge (0 = no children)
// edges[0] holds the root node's first edge index. A "node" below is always a first-edge index.
// No DOM: shared by the game, the AI worker and the Node tools.

export const EOW = 1 << 5, LAST = 1 << 6, COMMON = 1 << 7;

export function makeDict(edges) {
  return { edges, root: edges[0] };
}

// base64 → raw-inflated bytes. DecompressionStream exists in every current browser and in Node 18+.
export async function inflateB64(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Front-coded bytes → { words: [...], common: Uint8Array(1 = common) }.
export function decodeWordList(bytes) {
  const words = [], common = [];
  let prev = '', cur = null, p = 0, c = 0;
  const flush = () => { if (cur !== null) { prev = prev.slice(0, p) + cur; words.push(prev); common.push(c); } };
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b < 65 || b > 90) { flush(); c = b >= 97 ? 1 : 0; p = b - (c ? 97 : 48); cur = ''; }
    else cur += String.fromCharCode(b);
  }
  flush();
  return { words, common: Uint8Array.from(common) };
}

// The reverse, for tools/build-dict.mjs.
export function encodeWordList(words, isCommon) {
  const out = [];
  let prev = '';
  for (const w of words) {
    let p = 0;
    while (p < w.length && p < prev.length && w[p] === prev[p]) p++;
    out.push(String.fromCharCode((isCommon(w) ? 97 : 48) + p) + w.slice(p));
    prev = w;
  }
  return out.join('');
}

// Minimal DAWG from a sorted word list (Daciuk et al. 2000, incremental construction).
// Edges are packed into one flat Int32 work array while building: per node, a list of edge slots.
export function buildDawg(words, common) {
  // Build nodes as arrays of packed edge values with child node ids; node 0 is a placeholder.
  const nodeEdges = [[]];      // node id → [packed edge (letter|flags), child id, ...]
  const register = new Map();  // signature → node id
  const path = [0];            // node ids along the current word (unminimized branch)
  const root = 1;
  nodeEdges.push([]);
  path[0] = root;
  const sig = (n) => nodeEdges[n].join(',');
  // Minimize the unminimized branch below depth `depth` of the current path.
  function minimizeTo(depth) {
    for (let k = path.length - 1; k > depth; k--) {
      const child = path[k], parent = path[k - 1];
      const s = sig(child);
      const found = register.get(s);
      const pe = nodeEdges[parent];
      if (found !== undefined) { pe[pe.length - 1] = found; nodeEdges[child] = null; }
      else register.set(s, child);
    }
    path.length = depth + 1;
  }
  let prev = '';
  for (let w = 0; w < words.length; w++) {
    const word = words[w];
    let p = 0;
    while (p < word.length && p < prev.length && word.charCodeAt(p) === prev.charCodeAt(p)) p++;
    // `path` holds nodes for prefixes of prev that have children; a prefix that was a leaf has none yet
    minimizeTo(Math.min(p, path.length - 1));
    for (let i = p; i < word.length; i++) {
      let n = path[i];
      if (n === undefined) { // the previous word ended here: give its last edge a child
        n = nodeEdges.length; nodeEdges.push([]);
        const pe = nodeEdges[path[i - 1]];
        pe[pe.length - 1] = n;
        path[i] = n;
      }
      const end = i === word.length - 1;
      const v = (word.charCodeAt(i) - 65) | (end ? EOW : 0) | (end && common[w] ? COMMON : 0);
      nodeEdges[n].push(v, 0);
      if (!end) { const c = nodeEdges.length; nodeEdges.push([]); nodeEdges[n][nodeEdges[n].length - 1] = c; path[i + 1] = c; }
      else path.length = i + 1;
    }
    prev = word;
  }
  minimizeTo(0);
  // Lay out breadth-first: each node's edges contiguous; edges[0] → root.
  const start = new Int32Array(nodeEdges.length);
  const order = [root];
  let total = 1;
  start[root] = total; total += nodeEdges[root].length / 2;
  for (let i = 0; i < order.length; i++) {
    const e = nodeEdges[order[i]];
    for (let k = 1; k < e.length; k += 2) {
      const c = e[k];
      if (c && !start[c]) { start[c] = total; total += nodeEdges[c].length / 2; order.push(c); }
    }
  }
  if (total >= 1 << 24) throw new Error('DAWG too large for 24-bit child indexes');
  const edges = new Uint32Array(total);
  edges[0] = start[root];
  for (const n of order) {
    const e = nodeEdges[n];
    let i = start[n];
    for (let k = 0; k < e.length; k += 2) edges[i++] = e[k] | (k === e.length - 2 ? LAST : 0) | (e[k + 1] ? start[e[k + 1]] << 8 : 0);
  }
  return edges;
}

export async function loadDict(b64) {
  const { words, common } = decodeWordList(await inflateB64(b64));
  const d = makeDict(buildDawg(words, common));
  d.count = words.length;
  return d;
}

export const letterOf = (e) => e & 31;
export const childOf = (e) => e >>> 8;

// The edge for `letter` (0–25) leaving `node`, or -1.
export function edgeFor(d, node, letter) {
  if (!node) return -1;
  const E = d.edges;
  for (let i = node; ; i++) {
    const e = E[i], l = e & 31;
    if (l === letter) return i;
    if (l > letter || e & LAST) return -1;
  }
}

// Follow an upper-case A–Z string from `node`; returns the last edge index or -1.
export function walk(d, word, node = d.root) {
  let edge = -1;
  for (let k = 0; k < word.length; k++) {
    if (k) node = childOf(d.edges[edge]);
    edge = edgeFor(d, node, word.charCodeAt(k) - 65);
    if (edge < 0) return -1;
  }
  return edge;
}

export function has(d, word) {
  if (!word) return false;
  const e = walk(d, word);
  return e >= 0 && (d.edges[e] & EOW) !== 0;
}

export function isCommon(d, word) {
  const e = walk(d, word);
  return e >= 0 && (d.edges[e] & EOW) !== 0 && (d.edges[e] & COMMON) !== 0;
}

// Every word in the dictionary, in order (tests and tools only).
export function* words(d, node = d.root, prefix = '') {
  if (!node) return;
  const E = d.edges;
  for (let i = node; ; i++) {
    const e = E[i], w = prefix + String.fromCharCode(65 + (e & 31));
    if (e & EOW) yield w;
    yield* words(d, e >>> 8, w);
    if (e & LAST) break;
  }
}

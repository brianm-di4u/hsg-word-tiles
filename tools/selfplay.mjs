#!/usr/bin/env node
// Fits the AI's rack-leave values (src/js/leave-table.js) from self-play, our own data only.
// Games are played by Medium-strength seats (with the current table); every play records the leave
// kept and the points that player scores over its next two turns. A least-squares fit over features
// (first copy of each letter, duplicates of each letter, vowel/consonant balance) gives the value of
// keeping each, relative to the average. Runs in parallel worker threads.
//   node tools/selfplay.mjs [--games 6000] [--write]
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(here), '..');
const LET = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ?'];
const VOW = new Set(['A', 'E', 'I', 'O', 'U']);
// features: 0–6 leave size, 7–33 first copy of each letter, 34–60 extra copies, 61–67 vowels minus
// the ideal count (round(0.4 × size)) from −3 to +3
const NF = 7 + 27 + 27 + 7;
const idealVowels = (size) => Math.round(0.4 * size);
function features(leave) {
  const f = new Float64Array(NF);
  const seen = {};
  let v = 0;
  for (const l of leave) {
    const k = LET.indexOf(l);
    seen[l] = (seen[l] || 0) + 1;
    if (seen[l] === 1) f[7 + k] = 1; else f[34 + k] += 1;
    if (VOW.has(l)) v++;
  }
  f[Math.min(leave.length, 6)] = 1;
  f[61 + Math.max(-3, Math.min(3, v - idealVowels(leave.length))) + 3] = 1;
  return f;
}

if (isMainThread) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const GAMES = +arg('--games', 6000);
  const T = Math.max(1, os.cpus().length - 2);
  const per = Math.ceil(GAMES / T);
  const t0 = Date.now();
  const parts = await Promise.all(Array.from({ length: T }, (_, k) => new Promise((res, rej) => {
    const w = new Worker(here, { workerData: { from: 50000 + k * per, n: per } });
    w.on('message', res); w.on('error', rej);
  })));
  // accumulate normal equations XᵀX and Xᵀy
  const XtX = Array.from({ length: NF }, () => new Float64Array(NF)), Xty = new Float64Array(NF);
  let n = 0, ysum = 0;
  for (const part of parts) for (const [leave, y] of part) {
    const f = features(leave);
    n++; ysum += y;
    for (let i = 0; i < NF; i++) if (f[i]) { Xty[i] += f[i] * y; for (let j = 0; j < NF; j++) if (f[j]) XtX[i][j] += f[i] * f[j]; }
  }
  // ridge-regularized solve (Gaussian elimination)
  const lambda = 5;
  const M = XtX.map((row, i) => { const r = Array.from(row); r[i] += lambda; r.push(Xty[i]); return r; });
  for (let i = 0; i < NF; i++) {
    let p = i;
    for (let k = i + 1; k < NF; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k;
    [M[i], M[p]] = [M[p], M[i]];
    for (let k = 0; k < NF; k++) if (k !== i) { const f = M[k][i] / M[i][i]; for (let j = i; j <= NF; j++) M[k][j] -= f * M[i][j]; }
  }
  const beta = M.map((r, i) => r[NF] / r[i]);
  const mean = ysum / n;
  const r1 = (x) => Math.round(x * 2) / 2;
  // an empty leave is the zero point
  const size = Array.from({ length: 7 }, (_, k) => r1(beta[k] - beta[0]));
  const single = {}, dup = {};
  LET.forEach((l, k) => { single[l] = r1(beta[7 + k]); dup[l] = r1(beta[34 + k]); });
  // the size and vowel blocks are both intercepts; measure each from the empty leave's bucket
  const vowelExcess = Array.from({ length: 7 }, (_, k) => r1(beta[61 + k] - beta[61 + 3]));
  console.log(`samples ${n}, mean two-turn score ${mean.toFixed(1)}, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  console.log('size', JSON.stringify(size));
  console.log('single', JSON.stringify(single));
  console.log('dup', JSON.stringify(dup));
  console.log('vowelExcess', JSON.stringify(vowelExcess));
  if (process.argv.includes('--write')) {
    fs.writeFileSync(path.join(root, 'src/js/leave-table.js'), `// Rack-leave values for the AI, fitted by tools/selfplay.mjs from ${n} self-play samples
// (points over the next two turns, least squares with ridge ${lambda}). Regenerate rather than edit.
// value = size[tiles kept] + single[each letter's first copy] + dup[each extra copy]
//       + vowelExcess[vowels − round(0.4 × tiles kept), from −3 to +3]
export const LEAVE = {
  size: ${JSON.stringify(size)},
  single: ${JSON.stringify(single)},
  dup: ${JSON.stringify(dup)},
  vowelExcess: ${JSON.stringify(vowelExcess)},
};
`);
    console.log('wrote src/js/leave-table.js');
  }
} else {
  const { ctx } = await import('../tests/lib.mjs');
  const { createGame, apply } = await import('../src/js/engine.js');
  const { chooseAction, rackMinus } = await import('../src/js/ai.js');
  const c = await ctx();
  const out = [];
  for (let g = 0; g < workerData.n; g++) {
    const s = createGame({ mode: 'play', seats: [{ kind: 'ai', level: 'medium' }, { kind: 'ai', level: 'medium' }], seed: workerData.from + g }, c.lex);
    const pending = [[], []]; // per seat: [{leave, points, turns}]
    let guard = 0;
    while (!s.over && guard++ < 300) {
      const k = s.cur;
      const rack = s.players[k].rack.slice();
      const bagBefore = s.bag.length;
      const { action } = chooseAction(c.dict, c.lex, s, { level: 'medium' });
      const r = apply(s, action, c);
      if (!r.ok) throw new Error(r.error);
      const pts = r.entry.score || 0;
      for (const p of pending[k]) { p.points += pts; p.turns++; }
      for (const p of pending[k].filter((x) => x.turns >= 2)) out.push([p.leave, p.points]);
      pending[k] = pending[k].filter((x) => x.turns < 2);
      if (action.type === 'play' && bagBefore >= 14) pending[k].push({ leave: rackMinus(rack, action.tiles).join(''), points: 0, turns: 0 });
    }
  }
  parentPort.postMessage(out);
}

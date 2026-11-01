#!/usr/bin/env node
// Builds the game dictionary: ENABLE minus data/blocklist.txt, with SCOWL (size ≤ 50) marking common
// words. Writes the front-coded, raw-deflated, base64 word list (format in src/js/dict.js) to
// data/dict.b64.txt and a summary to data/dict-meta.json. Fails if the packed size passes the budget
// or if the DAWG the game builds from it does not list exactly the filtered words and common flags.
//   node tools/fetch-wordlists.mjs && node tools/build-dict.mjs [--show-blocked]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadDict, words as dictWords, walk, EOW, COMMON, encodeWordList } from '../src/js/dict.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const raw = path.join(root, 'data/raw');
const BUDGET_KB = 340;
const lines = (f, enc = 'utf8') => fs.readFileSync(f, enc).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

const enable = lines(path.join(raw, 'enable1.txt')).filter((w) => /^[a-z]{2,15}$/.test(w));
const stems = [], exact = new Set();
for (const l of lines(path.join(root, 'data/blocklist.txt'))) {
  if (l.startsWith('#')) continue;
  if (l.startsWith('stem:')) stems.push(l.slice(5)); else exact.add(l);
}
const blocked = enable.filter((w) => exact.has(w) || stems.some((s) => w.startsWith(s)));
const blockedSet = new Set(blocked);
const list = enable.filter((w) => !blockedSet.has(w)).map((w) => w.toUpperCase()).sort();
if (process.argv.includes('--show-blocked')) console.log(blocked.join(' '));

const common = new Set();
for (const s of [10, 20, 35, 40, 50]) for (const kind of ['english', 'american']) {
  for (const w of lines(path.join(raw, `scowl/${kind}-words.${s}`), 'latin1')) if (/^[a-z]+$/.test(w)) common.add(w.toUpperCase());
}

const packed = zlib.deflateRawSync(Buffer.from(encodeWordList(list, (w) => common.has(w)), 'latin1'), { level: 9 });
const b64 = packed.toString('base64');

// Verify through the same loader the game uses.
const t0 = performance.now();
const d = await loadDict(b64);
const buildMs = performance.now() - t0;
let i = 0;
for (const w of dictWords(d)) {
  if (w !== list[i]) throw new Error(`DAWG mismatch at ${i}: ${w} vs ${list[i]}`);
  const e = d.edges[walk(d, w)];
  if (!(e & EOW) || !!(e & COMMON) !== common.has(w)) throw new Error(`flags wrong for ${w}`);
  i++;
}
if (i !== list.length) throw new Error(`DAWG lists ${i} words, expected ${list.length}`);

fs.writeFileSync(path.join(root, 'data/dict.b64.txt'), b64);
const meta = {
  words: list.length, common: list.filter((w) => common.has(w)).length, blocked: blocked.length,
  dawgEdges: d.edges.length, packedKB: +(b64.length / 1024).toFixed(1), nodeLoadMs: Math.round(buildMs),
  listSha256: crypto.createHash('sha256').update(list.join('\n')).digest('hex'),
};
fs.writeFileSync(path.join(root, 'data/dict-meta.json'), JSON.stringify(meta, null, 2) + '\n');
console.log(meta);
if (meta.packedKB > BUDGET_KB) { console.error(`packed dictionary ${meta.packedKB} KB is over the ${BUDGET_KB} KB budget`); process.exit(1); }

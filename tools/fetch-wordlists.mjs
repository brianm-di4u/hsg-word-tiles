#!/usr/bin/env node
// Downloads the raw word lists (git-ignored; tools/raw-dir.mjs: the workspace's reference/word-lists/ or data/raw/)
// and checks their SHA-256.
// Only build-dict.mjs reads them; the game ships the packed dictionary in data/dict.b64.txt.
//   node tools/fetch-wordlists.mjs
//
// Sources and licences (see SAMPLES.md and data/LICENSES/):
//   ENABLE (enable1.txt)  public domain        github.com/dolph/dictionary @ 233d25a5
//   SCOWL 2020.12.07      MIT-like (Atkinson)  sourceforge.net/projects/wordlist  (only english/american-words.10–50)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { rawDir } from './raw-dir.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const raw = rawDir(root);
fs.mkdirSync(path.join(raw, 'scowl'), { recursive: true });

const FILES = [
  { out: 'enable1.txt', url: 'https://raw.githubusercontent.com/dolph/dictionary/233d25a56b9ac8bef906916ccf091a976995cce0/enable1.txt',
    sha: '3f16130220645692ed49c7134e24a18504c2ca55b3c012f7290e3e77c63b1a89' },
];

const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

for (const f of FILES) {
  const dest = path.join(raw, f.out);
  if (!fs.existsSync(dest)) {
    const res = await fetch(f.url);
    if (!res.ok) throw new Error(`${f.url}: HTTP ${res.status}`);
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  }
  const got = sha(dest);
  if (got !== f.sha) throw new Error(`${f.out}: sha256 ${got}, expected ${f.sha}`);
  console.log(`ok ${f.out}`);
}

const scowlDir = path.join(raw, 'scowl');
if (!fs.existsSync(path.join(scowlDir, 'english-words.50'))) {
  const tgz = path.join(scowlDir, 'scowl.tar.gz');
  const res = await fetch('https://downloads.sourceforge.net/wordlist/scowl-2020.12.07.tar.gz');
  if (!res.ok) throw new Error(`SCOWL: HTTP ${res.status}`);
  fs.writeFileSync(tgz, Buffer.from(await res.arrayBuffer()));
  const want = ['Copyright', ...[10, 20, 35, 40, 50].flatMap((s) => [`final/english-words.${s}`, `final/american-words.${s}`])];
  execFileSync('tar', ['xzf', 'scowl.tar.gz', ...want.map((w) => `scowl-2020.12.07/${w}`)], { cwd: scowlDir });
  for (const w of want) fs.renameSync(path.join(scowlDir, 'scowl-2020.12.07', w), path.join(scowlDir, path.basename(w)));
  fs.rmSync(path.join(scowlDir, 'scowl-2020.12.07'), { recursive: true });
  fs.rmSync(tgz);
}
console.log('ok scowl (english/american-words.10–50)');

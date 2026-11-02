// Shared Node-side loaders for the node: true tests and tools (dictionary and lexicon load once).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rawDir } from '../tools/raw-dir.mjs';
import { loadDict } from '../src/js/dict.js';
import { makeLexicon } from '../src/js/lexicon.js';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let cache = null;
export async function ctx() {
  if (!cache) {
    const dict = await loadDict(fs.readFileSync(path.join(root, 'data/dict.b64.txt'), 'utf8'));
    const lex = makeLexicon(JSON.parse(fs.readFileSync(path.join(root, 'data/thermal-words.json'), 'utf8')));
    cache = { dict, lex };
  }
  return cache;
}
export const hasRaw = () => fs.existsSync(path.join(rawDir(root), 'enable1.txt'));

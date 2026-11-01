#!/usr/bin/env node
// Writes data/lexicon.game.json, the bonus-word list the game inlines: data/thermal-words.json with each
// fact card's source line filled in (from the audited bank item for bank facts, as written for research
// quotes). Run tools/check-facts.mjs first; this tool only copies.
//   node tools/build-data.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bank = JSON.parse(fs.readFileSync(path.join(root, 'shared/data/trivia-questions.json'), 'utf8')).questions;
const lex = JSON.parse(fs.readFileSync(path.join(root, 'data/thermal-words.json'), 'utf8'));
for (const w of lex.words) {
  const f = w.fact;
  if (f.bank) { const q = bank.find((x) => x.id === f.bank); f.src = q.source; f.url = q.sourceUrl; }
  if (!f.src) throw new Error(`${w.id}: fact has no source line`);
  delete f.quote; delete f.ref;
}
delete lex.about;
fs.writeFileSync(path.join(root, 'data/lexicon.game.json'), JSON.stringify(lex));
console.log(`data/lexicon.game.json ${(fs.statSync(path.join(root, 'data/lexicon.game.json')).size / 1024).toFixed(1)} KB, ${lex.words.length} entries`);

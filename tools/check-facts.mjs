#!/usr/bin/env node
// Confirms every fact card the game shows traces to a source (adapted from Bathhouse Barons):
//   bank  the id exists in the audited trivia bank (shared/data/trivia-questions.json), is `confirmed`,
//         and every number on the card appears in that bank item. The card shows the bank's source.
//   ref   the quoted phrase and every number on the card appear in the cited research file.
// Exit 1 on any failure.
//   node tools/check-facts.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bank = JSON.parse(fs.readFileSync(path.join(root, 'shared/data/trivia-questions.json'), 'utf8')).questions;
const lex = JSON.parse(fs.readFileSync(path.join(root, 'data/thermal-words.json'), 'utf8'));
const norm = (t) => t.replace(/[–—]/g, '-').replace(/[’‘]/g, "'").replace(/[“”]/g, '"');
const numbers = (t) => (norm(t).match(/\d[\d,.]*\d|\d/g) || []).map((n) => n.replace(/[.,]$/, ''));

let bad = 0;
for (const w of lex.words) {
  const f = w.fact, problems = [];
  if (f.bank) {
    const q = bank.find((x) => x.id === f.bank);
    if (!q) problems.push('id not in the audited bank');
    else {
      if (q.confidence !== 'confirmed') problems.push(`confidence is ${q.confidence}`);
      const hay = norm(`${q.question} ${q.answer} ${q.explanation}`).replace(/,/g, '');
      for (const n of numbers(f.text)) if (!hay.includes(n.replace(/,/g, ''))) problems.push(`number ${n} not in ${f.bank}`);
    }
  } else {
    const file = path.join(root, f.ref);
    if (!fs.existsSync(file)) problems.push(`missing ${f.ref}`);
    else {
      const txt = norm(fs.readFileSync(file, 'utf8'));
      if (!txt.includes(norm(f.quote))) problems.push(`quote not found in ${f.ref}: "${f.quote}"`);
      for (const n of numbers(f.text)) if (!txt.replace(/,/g, '').includes(n.replace(/,/g, ''))) problems.push(`number ${n} not in ${f.ref}`);
    }
  }
  if (problems.length) { bad++; console.log(`FAIL ${w.id}: ${problems.join('; ')}`); }
}
console.log(`${lex.words.length - bad}/${lex.words.length} fact cards verified`);
process.exit(bad ? 1 : 0);

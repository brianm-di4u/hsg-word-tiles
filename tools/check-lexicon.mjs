#!/usr/bin/env node
// Checks data/thermal-words.json: every form is upper-case A–Z and a word in the game dictionary (so
// blocklisted words and proper nouns can't slip in), no form is listed twice, tiers and categories are
// known, and every entry has a fact. Facts themselves are checked by tools/check-facts.mjs.
//   node tools/check-lexicon.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDict, has } from '../src/js/dict.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lex = JSON.parse(fs.readFileSync(path.join(root, 'data/thermal-words.json'), 'utf8'));
const d = await loadDict(fs.readFileSync(path.join(root, 'data/dict.b64.txt'), 'utf8'));

const errors = [];
const seen = new Map(), ids = new Set();
for (const w of lex.words) {
  if (ids.has(w.id)) errors.push(`duplicate id ${w.id}`);
  ids.add(w.id);
  if (!lex.tiers[w.tier]) errors.push(`${w.id}: unknown tier ${w.tier}`);
  if (!lex.categories[w.cat]) errors.push(`${w.id}: unknown category ${w.cat}`);
  if (!w.fact || !w.fact.text || !(w.fact.bank || (w.fact.ref && w.fact.quote))) errors.push(`${w.id}: fact needs text and a bank id or ref + quote`);
  if (!w.forms.length) errors.push(`${w.id}: no forms`);
  for (const f of w.forms) {
    if (!/^[A-Z]{2,15}$/.test(f)) errors.push(`${w.id}: bad form ${f}`);
    else if (!has(d, f)) errors.push(`${w.id}: ${f} is not in the game dictionary`);
    if (seen.has(f)) errors.push(`${f} is listed under both ${seen.get(f)} and ${w.id}`);
    seen.set(f, w.id);
  }
}
const byTier = {}, byCat = {};
for (const w of lex.words) { byTier[w.tier] = (byTier[w.tier] || 0) + w.forms.length; byCat[w.cat] = (byCat[w.cat] || 0) + 1; }
console.log(`${lex.words.length} entries, ${seen.size} playable forms; forms by tier ${JSON.stringify(byTier)}; entries by category ${JSON.stringify(byCat)}`);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('lexicon ok');

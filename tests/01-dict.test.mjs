// Dictionary: the packed list decodes to exactly the filtered ENABLE list, flags are right, the
// blocklist holds, and lookups behave at the edges.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ctx, root, hasRaw } from './lib.mjs';
import { has, isCommon, words, walk } from '../src/js/dict.js';
import { referenceWordSet } from '../tools/ref-validator.mjs';

export const tests = [
  {
    name: 'decoded dictionary matches the build record', node: true,
    async run(t) {
      const { dict } = await ctx();
      const meta = JSON.parse(fs.readFileSync(path.join(root, 'data/dict-meta.json'), 'utf8'));
      const list = [...words(dict)];
      t.equal(list.length, meta.words, 'word count');
      t.equal(crypto.createHash('sha256').update(list.join('\n')).digest('hex'), meta.listSha256, 'word list hash');
      t.equal(list.filter((w) => isCommon(dict, w)).length, meta.common, 'common count');
      t.expect(list.every((w) => /^[A-Z]{2,15}$/.test(w)), 'A–Z, 2–15 letters');
    },
  },
  {
    name: 'equals ENABLE minus the blocklist', node: true,
    async run(t) {
      if (!hasRaw()) { t.log('data/raw missing: run tools/fetch-wordlists.mjs (skipped)'); return; }
      const { dict } = await ctx();
      const ref = referenceWordSet();
      const list = [...words(dict)];
      t.equal(list.length, ref.size, 'same size as the reference set');
      t.expect(list.every((w) => ref.has(w)), 'every game word is in the reference set');
    },
  },
  {
    name: 'lookups and blocklist', node: true,
    async run(t) {
      const { dict } = await ctx();
      for (const w of ['AA', 'XI', 'QAT', 'SPRING', 'BATHHOUSE', 'NOVACULITE', 'QUARTZES', 'TUFA', 'ASS', 'TIT', 'CRAPS', 'SQUAWK', 'INJUNCTION'])
        t.expect(has(dict, w), `${w} is a word`);
      for (const w of ['', 'A', 'Q', 'QI', 'ZA', 'SPRINGX', 'XYZZY', 'FORDYCE', 'OAKLAWN', 'BATHHOUSES2'.slice(0, 10) + 'Z'])
        t.expect(!has(dict, w), `${w || '(empty)'} is not a word`);
      for (const w of ['FUCK', 'SHIT', 'NIGGER', 'FAGGOT', 'CUNT', 'WHORE', 'RAPIST', 'SPIC'])
        t.expect(!has(dict, w), `blocked word ${w[0]}… is out`);
      t.expect(isCommon(dict, 'WATER') && isCommon(dict, 'SPRING'), 'common words flagged');
      t.expect(!isCommon(dict, 'QI') && !isCommon(dict, 'NOVACULITE'), 'rare words not flagged');
      t.equal(walk(dict, 'BATHHOUS') >= 0, true, 'prefix walk');
    },
  },
];

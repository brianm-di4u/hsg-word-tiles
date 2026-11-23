// Dictionary: the packed list decodes to exactly the filtered ENABLE list, the supplement (src/js/supplement.js)
// is merged in on load, flags are right, the blocklist holds, and lookups behave at the edges.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ctx, root, hasRaw } from './lib.mjs';
import { has, isCommon, words, walk, loadDict, inflateB64, decodeWordList } from '../src/js/dict.js';
import { SUPPLEMENT } from '../src/js/supplement.js';
import { referenceWordSet } from '../tools/ref-validator.mjs';

export const tests = [
  {
    name: 'the packed file decodes to the build record', node: true,
    async run(t) {
      const meta = JSON.parse(fs.readFileSync(path.join(root, 'data/dict-meta.json'), 'utf8'));
      const packed = decodeWordList(await inflateB64(fs.readFileSync(path.join(root, 'data/dict.b64.txt'), 'utf8')));
      t.equal(packed.words.length, meta.words, 'word count');
      t.equal(crypto.createHash('sha256').update(packed.words.join('\n')).digest('hex'), meta.listSha256, 'word list hash');
      t.equal(packed.common.reduce((a, b) => a + b, 0), meta.common, 'common count');
    },
  },
  {
    name: 'the loaded dictionary is the packed list plus the supplement', node: true,
    async run(t) {
      const { dict } = await ctx();
      const meta = JSON.parse(fs.readFileSync(path.join(root, 'data/dict-meta.json'), 'utf8'));
      const list = [...words(dict)];
      t.equal(SUPPLEMENT.length, 28, 'the supplement is the 28 words the owner listed');
      t.equal(dict.packed, meta.words, 'the packed words are all there');
      t.equal(dict.added.length, 28, 'every supplement word was new');
      t.equal(list.length, meta.words + 28, 'word count');
      t.equal(crypto.createHash('sha256').update(list.join('\n')).digest('hex'), '12485f1d2d27b20f525de63fe22010a9b41d608a8c0a6df78d261a5533d06ccb', 'merged word list hash');
      t.equal(list.filter((w) => isCommon(dict, w)).length, meta.common + 15, 'common count: the 15 everyday words are common, the two-letter tools are not');
      t.expect(list.every((w) => /^[A-Z]{2,15}$/.test(w)), 'A–Z, 2–15 letters');
      t.expect(list.every((w, k) => !k || list[k - 1] < w), 'the list is still sorted');
      for (const w of SUPPLEMENT) t.expect(has(dict, w), `${w} is a word`);
      t.equal(list.filter((w) => w.length === 2).length, 96 + 8, 'the two-letter list is the 96 it had plus QI, ZA, OK, EW, KI, FE, GI and OI');
    },
  },
  {
    name: 'a supplement word the list already holds is skipped, and a blocked one is refused', node: true,
    async run(t) {
      const packed = fs.readFileSync(path.join(root, 'data/dict.b64.txt'), 'utf8');
      const d = await loadDict(packed, ['QI', 'AA', 'SPRING', 'PENIS', 'RETARD', 'x1']);
      t.equal(JSON.stringify(d.added), JSON.stringify(['QI']), 'only QI was new');
      t.expect(!has(d, 'PENIS') && !has(d, 'RETARD'), 'blocked words stay out');
      t.equal(d.count, d.packed + 1, 'one word added');
    },
  },
  {
    name: 'equals ENABLE minus the blocklist, plus the supplement', node: true,
    async run(t) {
      if (!hasRaw()) { t.log('raw word lists missing: run tools/fetch-wordlists.mjs (skipped)'); return; }
      const { dict } = await ctx();
      const ref = referenceWordSet();
      const list = [...words(dict)];
      t.equal(list.length, ref.size + dict.added.length, 'the reference set plus the supplement');
      t.expect(list.every((w) => ref.has(w) || SUPPLEMENT.includes(w)), 'every game word is in the reference set or the supplement');
    },
  },
  {
    name: 'lookups and blocklist', node: true,
    async run(t) {
      const { dict } = await ctx();
      for (const w of ['AA', 'XI', 'QI', 'ZA', 'QAT', 'SPRING', 'BATHHOUSE', 'NOVACULITE', 'QUARTZES', 'TUFA', 'ASS', 'TIT', 'CRAPS', 'SQUAWK', 'INJUNCTION'])
        t.expect(has(dict, w), `${w} is a word`);
      for (const w of ['', 'A', 'Q', 'QO', 'ZZ', 'SPRINGX', 'XYZZY', 'FORDYCE', 'OAKLAWN', 'BATHHOUSES2'.slice(0, 10) + 'Z'])
        t.expect(!has(dict, w), `${w || '(empty)'} is not a word`);
      for (const w of ['FUCK', 'SHIT', 'NIGGER', 'FAGGOT', 'CUNT', 'WHORE', 'RAPIST', 'SPIC'])
        t.expect(!has(dict, w), `blocked word ${w[0]}… is out`);
      t.expect(isCommon(dict, 'WATER') && isCommon(dict, 'SPRING'), 'common words flagged');
      t.expect(!isCommon(dict, 'QI') && !isCommon(dict, 'NOVACULITE'), 'rare words not flagged');
      t.equal(walk(dict, 'BATHHOUS') >= 0, true, 'prefix walk');
    },
  },
];

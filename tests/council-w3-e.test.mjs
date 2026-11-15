// Wave 3, batch E: S4-08 (a hedge on the Capone card), S1-09 (a blank is not spent by a typo), S3-19 (score-sized
// rewards), S5-05 (your turn), S5-06 (effects and music levels), S5-08 (stings wait for the tiles) and S2-17 (soft cues).
import fs from 'node:fs';
import path from 'node:path';
import { root } from './lib.mjs';

export const tests = [
  // ---------- S4-08 ----------
  {
    name: 'S4-08 the Capone card hedges the floor it says he rented', node: true,
    async run(t) {
      const lex = JSON.parse(fs.readFileSync(path.join(root, 'data/lexicon.game.json'), 'utf8'));
      const cards = lex.words.map((w) => w.fact.text).filter((x) => /Capone/.test(x) && /entire floor/.test(x));
      t.equal(cards.length, 1, 'one card says Capone rented a floor');
      t.expect(/reportedly/.test(cards[0]), 'and it says "reportedly" (' + cards[0] + ')');
    },
  },
];

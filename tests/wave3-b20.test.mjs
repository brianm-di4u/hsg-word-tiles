// Wave 3, batch W3-B20 (WF-6 vision and cohesion): what the earlier waves left of W6-S1-01 to W6-S1-04.
import { ctx } from './lib.mjs';
import { createGame } from '../src/js/engine.js';
import { hintChoices, bestHint, isTeachableWord } from '../src/js/ai.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false }));
  }
};
const OPAL = [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }];

export const tests = [
  {
    name: 'W6-S1-01 the Spring Guide opens every casual game with an everyday or Hot Springs word and keeps a far better rare one in its last choice',
    node: true,
    async run(t) {
      const c = await ctx();
      const teach = (m) => m.words.every((w) => isTeachableWord(c.dict, c.lex, w));
      let rareFirst = 0, rareLast = 0, n = 0;
      for (const seats of [OPAL, [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }]]) {
        for (let seed = 1; seed <= 200; seed++) {
          const s = createGame({ mode: 'play', seed, seats }, c.lex);
          const h = hintChoices(c.dict, c.lex, s, 3);
          if (!h.length) continue;
          n++;
          if (!teach(h[0])) rareFirst++;
          if (h.some((m, k) => k < 2 && !teach(m)) && h.filter(teach).length >= 2) t.fail(`seed ${seed}: a rare word came before a second everyday one`);
          if (h[2] && !teach(h[2])) rareLast++;
          t.equal(new Set(h.map((m) => m.words.join())).size, h.length, `seed ${seed}: three different plays`);
          t.equal(JSON.stringify(bestHint(c.dict, c.lex, s)), JSON.stringify(h[0]), `seed ${seed}: one hint is the first of three`);
        }
      }
      t.equal(rareFirst, 0, `no rare word is the first choice of an opening play (${n} openings)`);
      t.expect(rareLast >= 40, `and the far better rare ones are still offered, last (${rareLast})`);
      const hard = createGame({ mode: 'play', seed: 3, seats: [OPAL[0], { kind: 'ai', persona: 'julian', level: 'hard' }] }, c.lex);
      t.equal(hintChoices(c.dict, c.lex, hard, 3)[0].words[0], 'CONGEE', 'a game against Hard keeps the whole dictionary');
    },
  },
  {
    name: 'W6-S1-01 in the game: the first Hint of a casual match sets an everyday word and Other plays still reaches CONGEE',
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 3, seats: OPAL });
      await t.waitIdle(8000);
      await t.game('act', 'hint');
      await t.page.waitForFunction(() => window.__game.getState().staged.length > 0 && !window.__G.hintBusy, null, { timeout: 10000 });
      const words = async () => (await t.page.textContent('#preview .words')).trim();
      const seen = [await words()];
      for (let k = 0; k < 2; k++) { await t.page.click('#preview [data-hintnext]'); seen.push(await words()); }
      t.equal(seen[0], 'GENE', 'the first play set on the board');
      t.equal(seen[2], 'CONGEE', 'the rare one is the third');
      t.equal((await t.state()).game.players[0].hints, 2, 'all three for one hint');
    },
  },
];

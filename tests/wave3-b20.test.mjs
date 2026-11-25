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
  {
    name: "W6-S1-02 a Hot Springs word of a plaque's own category says before and after the play that it clears a letter, for no extra points",
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      const set = async (cat, word, id) => {
        await t.game('newGame', { seed: 6, seats: OPAL });
        await t.waitIdle(8000);
        const g = (await t.state()).game;
        g.players[0].rack = 'STEAMXX'.split('');
        g.featured = [{ id, word, cat, shown: [0], by: null, at: null }, { id: 'casino', word: 'CASINO', cat: 'club', shown: [0], by: null, at: null }, { id: 'horse', word: 'HORSES', cat: 'track', shown: [0], by: null, at: null }];
        await t.game('setState', { game: g });
        await t.waitIdle(5000);
        await t.game('act', 'stage', [...'STEAM'].map((l, k) => ({ i: 110 + k, l })));
        await t.page.waitForFunction(() => /STEAM/.test(document.querySelector('#preview .words')?.textContent || ''));
      };
      const note = () => t.page.evaluate(() => document.querySelector('#preview .row-reveal')?.textContent || '');

      await set('baths', 'TOWELS', 'towel');
      t.equal(await note(), '', "no note when no plaque is of the word's category");
      const plain = (await t.state()).preview.score;

      await set('springs', 'THERMAL', 'thermal');
      t.equal(await note(), 'Springs · clears 1 plaque letter', 'the strip says so before the play');
      t.equal((await t.state()).preview.score, plain, 'and it is worth no points');
      const fit = await t.page.evaluate(() => { const p = document.querySelector('#preview').getBoundingClientRect(); return [...document.querySelectorAll('#preview .extra, #preview .bdbtn, #preview .pts')].every((e) => { const r = e.getBoundingClientRect(); return r.left >= p.left - 0.5 && r.right <= p.right + 0.5 && r.top >= p.top - 0.5 && r.bottom <= p.bottom + 0.5; }); });
      t.expect(fit, 'everything on the strip stays inside it');
      await t.shot('w3-b20-category-note');
      await t.page.evaluate(() => { window.__lines = []; let v = window.__G.lastLine; Object.defineProperty(window.__G, 'lastLine', { configurable: true, get: () => v, set: (x) => { v = x; if (x) window.__lines.push(x); } }); });
      const shown = await t.page.evaluate(async () => { await window.__game.act('play'); return window.__G.s.featured[0].shown.length; });
      t.equal(shown, 2, 'the plaque cleared one letter');
      await t.page.waitForFunction(() => window.__G.lastLine && window.__G.s.log.length >= 1);
      const said = await t.page.evaluate(() => window.__lines[0]);
      t.expect(/You played STEAM for .*clearing a Featured Spring letter/.test(said), `and the account read to a screen reader says it (${said})`);

      // the plaques carry their category in words, on a phone in the 44 px drawer too
      await t.page.waitForFunction(() => { const g = window.__game.getState(); return g.game.players[g.game.cur].kind === 'human' && !g.aiThinking; }, null, { timeout: 20000 });
      await t.waitIdle(8000);
      if (t.viewport === 'mobile') await t.page.click('[data-springs-toggle]');
      const tags = await t.page.evaluate(() => [...document.querySelectorAll('#springs .plaque, #springs .springs-bar')].map((p) => { const n = p.querySelector('.pcat-name'), r = p.getBoundingClientRect(), q = n.getBoundingClientRect(); return { tag: n.textContent, h: r.height, seen: q.width > 8 && q.left >= r.left && q.right <= r.right + 0.5, plaque: p.classList.contains('plaque') }; }));
      t.equal(tags.filter((x) => x.plaque).map((x) => x.tag).join(), 'Springs,Club,Track', 'Springs, Club and Track are written on the plaques');
      for (const x of tags) t.expect(x.seen && x.h >= 44, `${x.tag} shows on a ${x.h} px target`);
    },
  },
];

// Wave 3, batch E: S4-08 (a hedge on the Capone card), S1-09 (a blank is not spent by a typo), S3-19 (score-sized
// rewards), S5-05 (your turn), S5-06 (effects and music levels), S5-08 (stings wait for the tiles) and S2-17 (soft cues).
import fs from 'node:fs';
import path from 'node:path';
import { root } from './lib.mjs';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => { window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false })); };
const CENTER = 112;
async function start(t, rack, extra = {}) {
  await ready(t);
  await t.game('newGame', { seed: 3, ...extra });
  await t.waitIdle(5000);
  const s = await t.state();
  if (rack) { s.game.players[0].rack = rack.split(''); await t.game('setState', { game: s.game }); await t.waitIdle(); }
}
const across = (word, at = CENTER - 2) => [...word].map((l, k) => ({ i: at + k, l }));

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
  // ---------- S1-09 ----------
  {
    name: 'S1-09 a letter you do not hold asks before it spends your blank',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await start(t, '?ABCDEF');
      await t.page.keyboard.press('q');
      let s = await t.state();
      t.equal(s.staged.length, 0, 'one press of Q does not use the blank');
      t.expect(/Press Q again to use your blank/.test(await t.page.textContent('#preview')), 'the strip says how (' + (await t.page.textContent('#preview')).trim() + ')');
      await t.shot('S1-09-blank-ask');
      await t.page.keyboard.press('z');
      s = await t.state();
      t.equal(s.staged.length, 0, 'a different letter does not use it either');
      await t.page.keyboard.press('q');
      await t.page.keyboard.press('q');
      s = await t.state();
      t.equal(s.staged.length, 1, 'the same letter twice stages the blank');
      t.expect(s.staged[0].l === 'Q' && s.staged[0].blank, 'as a blank standing for Q (' + JSON.stringify(s.staged[0]) + ')');
      await t.page.keyboard.press('a');
      s = await t.state();
      t.equal(s.staged.length, 2, 'a letter you hold goes straight down');
      await t.game('act', 'recall');
      await t.page.keyboard.press('?');
      await t.page.click('[data-tab="keys"]');
      t.expect(/press it twice to use your blank/.test(await t.page.textContent('#screen')), 'the Controls tab says how');
    },
  },
];

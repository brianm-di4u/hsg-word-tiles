// Wave 3, batch C: P-N02 (a word check in Help), S2-15 (hint allowance), S3-07 (Hot Springs bonuses), S3-08 (Daily streak),
// P-N03 (words with no tie to their fact), S4-24 / S4-02 (the Bathhouse Row medallions) and S3-03 (Daily par and history).
import { ctx, root } from './lib.mjs';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => { window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false })); };

export const tests = [
  // ---------- P-N02 ----------
  {
    name: 'P-N02 Help has a word check that answers from the dictionary and names a Hot Springs word',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('scene', 'help');
      const ask = async (w) => {
        await t.page.fill('#wc-in', w);
        await t.page.click('.wordcheck button[type=submit]');
        return t.page.textContent('#wc-out');
      };
      t.expect(/is in the dictionary and can be played/.test(await ask('qi')), 'QI is playable');
      t.expect(/XQZVV is not in the dictionary/.test(await ask('xqzvv')), 'a made-up word is refused, in capitals');
      t.expect(/Type a word of two letters/.test(await ask('a')), 'one letter asks for more');
      const hot = await ask('spring');
      t.expect(/Hot Springs word/.test(hot) && /\+\d+/.test(hot), `SPRING is named as a Hot Springs word with its bonus (${hot})`);
      t.expect(!/Hot Springs word/.test(await ask('cat')), 'an everyday word with no town tie is not');
      await t.page.fill('#wc-in', 'spring');
      await t.page.press('#wc-in', 'Enter');
      t.expect(/SPRING is in the dictionary/.test(await t.page.textContent('#wc-out')), 'Enter submits the form');
      t.expect(await t.page.getAttribute('#wc-out', 'role') === 'status', 'the answer is a live region');
      await t.page.locator('#wc-out').scrollIntoViewIfNeeded();
      await t.shot('P-N02-word-check');
      await t.checkLayout({ allowScrollY: true });
    },
  },
];

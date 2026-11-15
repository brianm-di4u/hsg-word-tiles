// Wave 3, batch C: P-N02 (a word check in Help), S2-15 (hint allowance), S3-07 (Hot Springs bonuses), S3-08 (Daily streak),
// P-N03 (words with no tie to their fact), S4-24 / S4-02 (the Bathhouse Row medallions) and S3-03 (Daily par and history).
import { ctx, root } from './lib.mjs';
import { emptyStats, applyGame, hintsUsed } from '../src/js/stats.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => { window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false })); };

// a finished game: the human (seat 0) with 300 points against Opal, plus whatever `extra` says about the human
const game = (extra) => ({
  mode: 'play', seed: 1, rng: { bag: 1, ai: 2 }, over: true, featured: [],
  players: [{ kind: 'human', name: 'You', score: 300, best: { word: 'QUARTZ', score: 54 }, hints: 3, ...extra }, { kind: 'ai', name: 'Opal', persona: 'opal', level: 'easy', score: 50, best: null, hints: null }],
  log: [{ p: 0, kind: 'play', n: 0, score: 91, full: 0, words: [{ w: 'SPRING', score: 91, bonus: 0 }] }, { kind: 'end' }],
  result: { why: 'out', out: 0, adjust: [0, 0], winners: [0] },
});

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
  // ---------- S2-15 ----------
  {
    name: 'S2-15 the results card says Unlimited hints and how many were used, and Unaided where none were taken',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      const cards = await t.page.evaluate(async ([a, b]) => {
        const ui = await import(new URL('src/js/ui.js', location.href).href);
        return [ui.overHtml(a, window.__G.lex, null, { pb: [] }), ui.overHtml(b, window.__G.lex, null, { pb: [] })];
      }, [game({ unl: true, taken: 4 }), game({})]);
      t.expect(/Unlimited hints, 4 used/.test(cards[0]), 'unlimited: the card says so and counts them');
      t.expect(/Unaided/.test(cards[1]) && !/Unlimited/.test(cards[1]), 'three, none taken: Unaided');
    },
  },
  {
    name: 'S2-15 unlimited hints: a game with them sets no personal best, and a game with three still does',
    node: true,
    async run(t) {
      const first = applyGame(emptyStats(), game({})).stats;
      const unl = applyGame(first, game({ unl: true, taken: 0, score: 500 }));
      t.equal(unl.stats.bestScore, 300, 'unlimited hints, none taken: the best score stays');
      t.expect(unl.pb.held, 'and the game says it held a best back');
      t.equal(unl.stats.games, 2, 'but it counts as a game'); t.equal(unl.stats.wins, 2, 'and a win');
      t.equal(hintsUsed({ hints: 3, unl: true, taken: 4 }), 4, 'hints taken are counted');
      t.equal(applyGame(first, game({ unl: true, taken: 4 })).stats.hints, first.hints + 4, 'and added to the hints used');
      t.equal(applyGame(first, game({ score: 500 })).stats.bestScore, 500, 'a three-hint game with none taken still sets one');
    },
  },
  {
    name: 'S2-15 setup offers unlimited hints; with them the Hint button never runs out',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.seed(7);
      await t.game('scene', 'setup');
      t.expect(await t.page.isEnabled('[data-hints-unl]'), 'the allowance is offered while hints are on');
      await t.page.locator('[data-hints-unl]').scrollIntoViewIfNeeded();
      await t.shot('S2-15-setup-hints');
      await t.page.selectOption('[data-hints-unl]', 'unl');
      await t.page.uncheck('[data-hints]');
      t.expect(await t.page.isDisabled('[data-hints-unl]'), 'switching hints off greys the allowance');
      await t.page.check('[data-hints]');
      await t.page.click('[data-start]');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'game', null, { timeout: 15000 });
      await t.waitIdle(8000);
      t.equal((await t.page.textContent('[data-act="hint"] em')).trim(), '∞', 'the Hint button shows the infinity sign');
      for (let n = 1; n <= 4; n++) {
        await t.game('act', 'hint');
        await t.game('act', 'recall');
        await t.waitIdle(8000);
        const p = (await t.state()).game.players[0];
        t.equal(p.taken, n, 'hint ' + n + ' is counted');
        t.equal(p.hints, 3, 'and the allowance does not run down');
      }
      t.expect(await t.page.isEnabled('[data-act="hint"]'), 'a fourth hint was still allowed, and the button is still on');
      await t.shot('S2-15-hint-unlimited');
      // the setup is remembered as chosen, and a newer game of the same seats keeps it
      const st = await t.page.evaluate(() => JSON.parse(localStorage.getItem('hs-letters-settings-v1')).lastSetup);
      t.equal(st.hintsUnl, true, 'the choice is saved with the setup');
      await t.reload();
      await t.game('scene', 'setup');
      t.equal(await t.page.inputValue('[data-hints-unl]'), 'unl', 'and comes back after a reload');
      await t.checkLayout({ allowScrollY: true });
    },
  },
];

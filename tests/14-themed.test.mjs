// Hot Springs content in the UI: a bonus word's toast and fact card, a Featured Spring claim, the Bathhouse
// Register after a bonus word, and every fact card opening without errors.
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const CENTER = 112;

export const tests = [
  {
    name: 'a bonus word shows its toast and fact card, and signs the Register',
    async run(t) {
      await ready(t);
      await t.page.evaluate(() => localStorage.removeItem('hs-letters-register-v1'));
      await t.game('newGame', { seed: 3 });
      await t.waitIdle(5000);
      const s = await t.state();
      s.game.players[0].rack = 'STEAMXQ'.split('');
      await t.game('setState', { game: s.game });
      await t.game('act', 'stage', [...'STEAM'].map((l, k) => ({ i: CENTER - 2 + k, l })));
      await t.game('act', 'play');
      await t.page.waitForSelector('#toast.on', { timeout: 3000 });
      t.expect(/STEAM/.test(await t.page.textContent('#toast')), 'toast names the word');
      await t.waitForAnimations();
      await t.shot('14-toast', { wait: false });
      await t.page.click('#toast [data-fact]');
      const st = await t.state();
      t.equal(st.dialog, 'fact', 'fact card open');
      t.expect(/Valley of Vapors/.test(await t.page.textContent('#modal')), 'the steam fact');
      t.expect(/Source:/.test(await t.page.textContent('#modal')), 'with its source');
      await t.shot('14-fact');
      await t.page.click('#modal [data-close]');
      const reg = await t.page.evaluate(() => JSON.parse(localStorage.getItem('hs-letters-register-v1')));
      t.expect(reg && reg.STEAM && reg.STEAM.id === 'steam', 'STEAM signed in the Register');
      await t.waitIdle(10000);
      await t.game('scene', 'register');
      t.expect(await t.page.$('[data-reg="steam"]'), 'Register lists it');
      await t.shot('14-register');
      await t.page.click('[data-reg="steam"]');
      t.equal((await t.state()).dialog, 'fact', 'Register opens the card');
    },
  },
  {
    name: 'claiming a Featured Spring',
    viewports: ['desktop'],
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 5 });
      await t.waitIdle(5000);
      const s = await t.state();
      s.game.featured[0] = { id: 'steam', word: 'STEAM', cat: 'springs', shown: [0], by: null, at: null };
      s.game.players[0].rack = 'STEAMXQ'.split('');
      await t.game('setState', { game: s.game });
      await t.shot('14-plaques');
      await t.game('act', 'stage', [...'STEAM'].map((l, k) => ({ i: CENTER - 2 + k, l })));
      const pv = (await t.state()).preview;
      t.equal(pv.featured, 'STEAM', 'preview shows the Featured bonus');
      await t.game('act', 'play');
      await t.page.waitForSelector('#toast.featured', { timeout: 3000 });
      const s2 = await t.state();
      t.equal(s2.game.featured[0].by, 0, 'claimed by you');
      t.expect(/Featured Spring: STEAM/.test(await t.page.textContent('#toast')), 'featured toast');
      await t.waitForAnimations();
      await t.shot('14-plaque-claimed', { wait: false });
    },
  },
  {
    name: 'every fact card opens',
    viewports: ['mobile'],
    async run(t) {
      await ready(t);
      const ids = await t.page.evaluate(() => LEXICON.words.map((w) => w.id));
      for (const id of ids) {
        await t.game('act', 'fact', id);
        const txt = await t.page.textContent('#modal');
        if (!/Source:/.test(txt)) t.fail(`${id}: no source line: ${txt.slice(0, 120)}`);
        await t.game('act', 'close');
      }
      t.log(`${ids.length} cards opened`);
      await t.game('act', 'fact', 'bathhouse', 'BATHHOUSE');
      await t.shot('14-fact-mobile');
    },
  },
];

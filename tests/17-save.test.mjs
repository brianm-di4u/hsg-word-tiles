// Saves: the game runs with localStorage throwing; a corrupt save is ignored; quitting keeps the game.
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });

export const tests = [
  {
    name: 'works when localStorage throws',
    browsers: ['chromium', 'firefox', 'webkit'],
    initScript: () => { const no = () => { throw new Error('storage blocked'); }; Object.defineProperty(window, 'localStorage', { get: no }); },
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 6 });
      await t.waitIdle(5000);
      const [m] = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', m.tiles);
      const r = await t.game('act', 'play');
      t.expect(r.ok, 'played without storage');
      await t.waitIdle(10000);
      await t.game('scene', 'register');
      await t.game('scene', 'settings');
      await t.page.click('[data-set="theme"][data-val="dark"]');
      t.expect(await t.page.evaluate(() => document.body.classList.contains('theme-dark')), 'settings still apply');
    },
  },
  {
    name: 'a corrupt save is ignored',
    browsers: ['chromium', 'firefox', 'webkit'],
    initScript: () => { try { localStorage.setItem('hs-letters-save-v1', '{"v":1,"board":'); } catch (e) { /* none */ } },
    async run(t) {
      await ready(t);
      t.equal(await t.page.$('[data-go="continue"]'), null, 'no Continue for a corrupt save');
      await t.game('newGame', { seed: 6 });
      await t.waitIdle(5000);
      t.equal((await t.state()).scene, 'game', 'new game works');
    },
  },
  {
    name: 'quit to title keeps the game for Continue',
    browsers: ['chromium', 'firefox', 'webkit'],
    viewports: ['desktop'],
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 6 });
      await t.waitIdle(5000);
      await t.page.click('#b-menu');
      await t.shot('18-pause');
      await t.page.click('#modal [data-go="title"]');
      t.equal((await t.state()).scene, 'title', 'title');
      t.expect(await t.page.$('[data-go="continue"]'), 'Continue offered');
    },
  },
];

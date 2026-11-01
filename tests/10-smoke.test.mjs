// Smoke: the page boots with no errors, the dictionary loads, every screen renders, and a game starts.
export const tests = [
  {
    name: 'boots and loads the dictionary',
    browsers: ['chromium', 'firefox', 'webkit'],
    async run(t) {
      await t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
      const s = await t.state();
      t.log(`dictionary ready in ${s.dictMs} ms, AI mode ${s.ai}`);
      t.expect(s.scene === 'title', 'title scene');
      t.expect(await t.game('act', 'has', 'BATHHOUSE'), 'dictionary lookup works in the page');
      await t.shot('01-title');
      await t.checkLayout({ allowScrollY: true });
    },
  },
  {
    name: 'every screen renders',
    browsers: ['chromium', 'firefox', 'webkit'],
    async run(t) {
      await t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
      for (const [k, name] of [['02', 'setup'], ['03', 'help'], ['04', 'settings'], ['05', 'register'], ['06', 'about']]) {
        await t.game('scene', name);
        await t.shot(`${k}-${name}`);
        await t.checkLayout({ allowScrollY: true });
      }
    },
  },
  {
    name: 'a game against the computer starts',
    browsers: ['chromium', 'firefox', 'webkit'],
    async run(t) {
      await t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
      await t.game('newGame', { seed: 11, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'hollis' }] });
      await t.waitIdle(8000);
      const s = await t.state();
      t.equal(s.scene, 'game', 'game scene');
      t.equal(s.game.players[0].rack.length, 7, 'seven tiles');
      await t.shot('07-board');
      await t.checkLayout();
    },
  },
  {
    name: 'offline: the game, help and results load from file://',
    fileUrl: true,
    async run(t) {
      await t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
      await t.game('scene', 'help');
      await t.page.click('[data-tab="squares"]');
      await t.game('newGame', { seed: 11 });
      await t.waitIdle(8000);
      await t.game('act', 'autoplay', 999);
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 8000 });
      t.expect(true, 'no blocked requests or console errors (the harness fails the test otherwise)');
    },
  },
];

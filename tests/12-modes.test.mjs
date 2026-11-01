// Modes: setup seats, pass-and-play privacy, the Daily Soak, Continue after a reload.
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });

export const tests = [
  {
    name: 'setup: seats, opponents and start',
    browsers: ['chromium', 'firefox', 'webkit'],
    async run(t) {
      await ready(t);
      await t.page.click('[data-go="setup"]');
      await t.waitIdle();
      // add a third seat, make seat 2 a person
      await t.page.click('[data-add]');
      await t.page.click('[data-kind="human"][data-k="1"]');
      await t.page.fill('[data-name="0"]', 'Ada');
      await t.page.fill('[data-name="1"]', 'Bo');
      await t.shot('12-setup');
      await t.checkLayout({ allowScrollY: true });
      await t.page.click('[data-start]');
      await t.waitIdle(8000);
      const s = await t.state();
      t.equal(s.game.players.length, 3, 'three seats');
      t.equal(s.game.players.map((p) => p.kind).join(','), 'human,human,ai', 'kinds');
      t.equal(s.game.players[0].name, 'Ada', 'name');
      t.expect(s.privacy, 'privacy screen with two people');
      await t.shot('12-privacy');
    },
  },
  {
    name: 'pass and play hides the next rack until tapped',
    browsers: ['chromium', 'firefox', 'webkit'],
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 4, seats: [{ kind: 'human', name: 'Ada' }, { kind: 'human', name: 'Bo' }] });
      await t.waitIdle(5000);
      let s = await t.state();
      t.expect(s.privacy, 'hidden at the start');
      t.equal(await t.page.$$eval('#rack .rtile', (e) => e.length), 0, 'no rack tiles shown');
      await t.page.click('[data-reveal]');
      s = await t.state();
      t.expect(!s.privacy, 'revealed');
      t.equal(await t.page.$$eval('#rack .rtile', (e) => e.length), 7, 'rack shown');
      const [best] = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', best.tiles);
      await t.game('act', 'play');
      await t.waitIdle(5000);
      s = await t.state();
      t.equal(s.game.cur, 1, 'Bo to play');
      t.expect(s.privacy, 'hidden again for Bo');
      t.expect(/Bo/.test(await t.page.textContent('#privacy')), 'names Bo');
    },
  },
  {
    name: 'daily soak: same tiles on reload, ten turns, result saved',
    browsers: ['chromium', 'firefox', 'webkit'],
    async run(t) {
      await ready(t);
      await t.game('act', 'daily', '2026-11-01');
      await t.waitIdle(5000);
      const a = await t.state();
      t.equal(a.game.mode, 'daily', 'daily mode');
      t.equal(a.game.players.length, 1, 'solo');
      await t.shot('12-daily');
      await t.reload();
      await ready(t);
      await t.game('act', 'daily', '2026-11-01');
      await t.waitIdle(5000);
      const b = await t.state();
      t.equal(b.game.players[0].rack.join(''), a.game.players[0].rack.join(''), 'same rack for the same date');
      for (let k = 0; k < 10; k++) {
        const s = await t.state();
        if (s.game.over) break;
        // the next turn has begun (slow software GL can outlast waitIdle's 5 s)
        await t.page.waitForFunction(() => { const g = window.__G; return g.s.over || (!g.staged.length && performance.now() >= g.busyUntil && g.scene === 'game'); }, null, { timeout: 10000 });
        const [m] = await t.game('act', 'moves', 1);
        if (m) { await t.game('act', 'stage', m.tiles); await t.game('act', 'play'); } else await t.game('act', 'pass');
        await t.page.waitForFunction((n) => window.__G.s.move > n, s.game.move, { timeout: 10000 }).catch(() => t.fail(`turn ${k + 1} did not land`));
        await t.waitIdle(5000);
      }
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 6000 });
      const s = await t.state();
      t.expect(s.game.over && s.game.result.why === 'daily', 'daily over after ten turns');
      await t.shot('12-daily-result');
      const d = await t.page.evaluate(() => JSON.parse(localStorage.getItem('hs-letters-daily-v1')));
      t.expect(d && d.days['2026-11-01'] && d.days['2026-11-01'].score === s.game.players[0].score, 'score saved for the date');
      t.equal(d.streak, 1, 'streak 1');
    },
  },
  {
    name: 'continue resumes the saved game after a reload',
    browsers: ['chromium', 'firefox', 'webkit'],
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 9 });
      await t.waitIdle(5000);
      const [m] = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', m.tiles);
      await t.game('act', 'play');
      await t.waitIdle(10000);
      const before = await t.state();
      await t.reload();
      await ready(t);
      t.expect(await t.page.$('[data-go="continue"]'), 'Continue offered');
      await t.page.click('[data-go="continue"]');
      await t.waitIdle(5000);
      const after = await t.state();
      t.equal(JSON.stringify(after.game.board), JSON.stringify(before.game.board), 'same board');
      t.equal(after.game.players.map((p) => p.score).join(','), before.game.players.map((p) => p.score).join(','), 'same scores');
      t.equal(after.game.players[0].rack.join(''), before.game.players[0].rack.join(''), 'same rack');
      await t.shot('17-resumed');
    },
  },
];

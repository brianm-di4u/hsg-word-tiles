// Wave 1, batch W1-B02: W6-P-N01 (endgame persistence ahead of save deletion and cancellable over transition).
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const SAVE = 'hs-letters-save-v1', STATS = 'hs-letters-stats-v1', DAILY = 'hs-letters-daily-v1';
const ls = (t, k) => t.page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), k);

const spyNormal = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'normal', sound: false }));
  }
  window.__lsOps = [];
  const origSet = Storage.prototype.setItem;
  const origRem = Storage.prototype.removeItem;
  Storage.prototype.setItem = function (k, v) {
    if (this === window.localStorage) window.__lsOps.push(['set', String(k)]);
    return origSet.call(this, k, v);
  };
  Storage.prototype.removeItem = function (k) {
    if (this === window.localStorage) window.__lsOps.push(['remove', String(k)]);
    return origRem.call(this, k);
  };
};

async function freezeClock(t) { await t.page.clock.install(); await t.reload(); await ready(t); }
async function stopClock(t) { const now = await t.page.evaluate(() => Date.now()); await t.page.clock.pauseAt(now + 500); }

export const tests = [
  {
    name: 'W6-P-N01 Play endgame writes Records synchronously before deleting save and survives immediate exit',
    viewports: ['desktop'],
    initScript: spyNormal,
    async run(t) {
      await ready(t);
      await freezeClock(t);
      await t.seed(5);
      await t.game('newGame', { seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
      await t.waitIdle(8000);
      // Set up a 1-tile go-out state: CAT on row 7 cols 6-8 (111-113), empty bag, human holds S to play CATS at 114
      const st = await t.state();
      const g = st.game;
      g.board = Array(225).fill(null);
      g.board[111] = { l: 'C', blank: false };
      g.board[112] = { l: 'A', blank: false };
      g.board[113] = { l: 'T', blank: false };
      g.bag = [];
      g.move = 10;
      g.cur = 0;
      g.players[0].rack = ['S'];
      g.players[0].score = 120;
      g.players[1].rack = ['E', 'R'];
      g.players[1].score = 80;
      await t.game('setState', { game: g });
      await t.waitIdle(5000);
      await stopClock(t);
      await t.page.evaluate(() => { window.__lsOps.length = 0; });

      t.expect((await t.game('act', 'stage', [{ i: 114, l: 'S' }])).ok, 'final S staged at 114');
      t.expect((await t.game('act', 'play')).ok, 'final winning play applied');

      // At t=0 (clock paused; G.turnWait and finishGame have not fired yet):
      const after = await t.state();
      t.equal(after.game.over, true, 'game is over immediately after final play');
      const ops = await t.page.evaluate(() => window.__lsOps.slice());
      const statsIdx = ops.findIndex(([op, k]) => op === 'set' && k === STATS);
      const delIdx = ops.findIndex(([op, k]) => op === 'remove' && k === SAVE);
      t.expect(statsIdx >= 0, 'hs-letters-stats-v1 was written synchronously in afterAction (' + JSON.stringify(ops) + ')');
      t.expect(delIdx >= 0, 'hs-letters-save-v1 was retired in afterAction (' + JSON.stringify(ops) + ')');
      t.expect(statsIdx < delIdx, 'Records written BEFORE save deleted (stats@' + statsIdx + ' < del@' + delIdx + ')');

      const recNow = await ls(t, STATS);
      t.equal(recNow.games, 1, 'Records already counts the finished game before turnWait expires');
      t.equal(recNow.wins, 1, 'win already recorded');
      t.equal(recNow.bestScore, after.game.players[0].score, 'final score already persisted');
      t.equal(await ls(t, SAVE), null, 'save slot is retired');

      // Immediately leave via Pause -> Save and quit to title BEFORE G.turnWait fires
      await t.page.click('#b-menu');
      await t.page.click('#modal [data-go="title"]');
      const left = await t.state();
      t.equal(left.scene, 'title', 'exited cleanly to title');
      t.equal(left.dialog, null, 'no spurious unsaved-game confirmation');

      // Advance clock past G.turnWait and the 900 ms overTimer
      await t.page.clock.runFor(3000);
      t.equal((await t.state()).scene, 'title', 'stays on title and is not hijacked back to over');
      t.equal((await ls(t, STATS)).games, 1, 'finished game counted exactly once');

      // Survives reload
      await t.page.clock.resume();
      await t.reload();
      await ready(t);
      const recReload = await ls(t, STATS);
      t.equal(recReload.games, 1, 'Records survives reload after immediate endgame exit');
      t.equal(recReload.bestScore, after.game.players[0].score, 'score survives reload');
    },
  },
  {
    name: 'W6-P-N01 Daily Soak Turn-10 writes Daily and Records synchronously before deleting save and survives immediate exit',
    viewports: ['desktop'],
    initScript: spyNormal,
    async run(t) {
      await ready(t);
      await freezeClock(t);
      const date = '2026-11-20';
      await t.game('newGame', { mode: 'daily', date });
      await t.page.waitForFunction(() => window.__game.getState().scene === 'game', null, { timeout: 8000 });
      await t.waitIdle(5000);

      // Jump to the final turn (turns === 1) so the next legal move finishes the Daily Soak
      const st = await t.state();
      st.game.daily.turns = 1;
      await t.game('setState', { game: st.game });
      await t.waitIdle(5000);
      const [m] = await t.game('act', 'moves', 1);
      t.expect(!!m, 'found a legal Turn-10 move');

      await stopClock(t);
      await t.page.evaluate(() => { window.__lsOps.length = 0; });

      t.expect((await t.game('act', 'stage', m.tiles)).ok, 'Turn-10 move staged');
      t.expect((await t.game('act', 'play')).ok, 'Turn-10 move played');

      const after = await t.state();
      t.equal(after.game.over, true, 'Daily Soak is over immediately');
      const ops = await t.page.evaluate(() => window.__lsOps.slice());
      const dailyIdx = ops.findIndex(([op, k]) => op === 'set' && k === DAILY);
      const statsIdx = ops.findIndex(([op, k]) => op === 'set' && k === STATS);
      const delIdx = ops.findIndex(([op, k]) => op === 'remove' && k === SAVE);
      t.expect(dailyIdx >= 0 && statsIdx >= 0 && delIdx >= 0, 'Daily, Stats, and save removal all ran synchronously (' + JSON.stringify(ops) + ')');
      t.expect(dailyIdx < delIdx && statsIdx < delIdx, 'Daily and Stats written BEFORE save deleted (' + dailyIdx + ', ' + statsIdx + ' < ' + delIdx + ')');

      const dNow = await ls(t, DAILY);
      const sNow = await ls(t, STATS);
      t.equal(dNow.days[date].score, after.game.players[0].score, 'Daily score already persisted');
      t.equal(dNow.days[date].plays, 1, 'Daily play count is 1');
      t.equal(dNow.streak, 1, 'Daily streak already persisted');
      t.equal(sNow.daily.games, 1, 'Records daily.games already persisted');
      t.equal(sNow.daily.best, after.game.players[0].score, 'Records daily.best already persisted');
      t.equal(await ls(t, SAVE), null, 'save slot is retired');

      // Exit immediately before G.turnWait fires
      await t.page.click('#b-menu');
      await t.page.click('#modal [data-go="title"]');
      t.equal((await t.state()).scene, 'title', 'exited cleanly to title');

      await t.page.clock.runFor(3000);
      t.equal((await t.state()).scene, 'title', 'stays on title after timers elapse');
      t.equal((await ls(t, DAILY)).days[date].plays, 1, 'Daily counted exactly once');
      t.equal((await ls(t, STATS)).daily.games, 1, 'Records daily.games counted exactly once');

      await t.page.clock.resume();
      await t.reload();
      await ready(t);
      t.equal((await ls(t, DAILY)).days[date].score, after.game.players[0].score, 'Daily score survives reload');
    },
  },
];

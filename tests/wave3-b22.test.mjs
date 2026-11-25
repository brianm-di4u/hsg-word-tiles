// Wave 3, batch W3-B22: W6-S6-01 (the results wait for an open menu, card or sheet), W6-P-N03 (par found after the game, off the
// main thread), W6-S6-03 (nothing left on the GPU, a real context loss), W6-S6-05 (board sprites by bucket, one relayout a frame).
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => { window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false })); };
const SEATS = [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }];
const scene = async (t) => (await t.state()).scene;
const until = (t, f) => t.page.waitForFunction(f, null, { timeout: 15000 });
const b3 = (t) => t.game('act', 'b3');

async function freezeClock(t) { await t.page.clock.install(); await t.reload(); await ready(t); }
async function stopClock(t) { const now = await t.page.evaluate(() => Date.now()); await t.page.clock.pauseAt(now + 500); }
// a game whose last tile has just been played: the results are due in 900 ms
async function lastPlay(t) {
  await t.page.clock.resume();
  await t.seed(5);
  await t.game('newGame', { seats: SEATS });
  await t.waitIdle(8000);
  const g = (await t.state()).game;
  g.board = Array(225).fill(null);
  g.board[111] = { l: 'C', blank: false }; g.board[112] = { l: 'A', blank: false }; g.board[113] = { l: 'T', blank: false };
  g.bag = []; g.move = 10; g.cur = 0;
  g.players[0].rack = ['S']; g.players[0].score = 120; g.players[1].rack = ['E', 'R']; g.players[1].score = 80;
  await t.game('setState', { game: g });
  await t.waitIdle(5000);
  await stopClock(t);
  t.expect((await t.game('act', 'stage', [{ i: 114, l: 'S' }])).ok && (await t.game('act', 'play')).ok, 'the last tile is played');
  await t.page.clock.runFor(200);
  t.expect(await t.page.evaluate(() => window.__G.scene === 'game' && !!window.__G.overTimer), 'the results are on their way');
}

export const tests = [
  // ---------- W6-S6-01 ----------
  {
    name: 'W6-S6-01 the menu, a card or a sheet opened after the last tile keeps the results waiting, and they come once it is closed',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await freezeClock(t);
      // a card: it is not slammed shut by the results
      await lastPlay(t);
      await t.game('act', 'fact', 'spa', 'SPA');
      t.equal(await t.page.evaluate(() => window.__G.dialog), 'fact', 'the card is open');
      await t.page.clock.runFor(3000);
      t.equal(await t.page.evaluate(() => window.__G.dialog), 'fact', 'the card is still open three seconds later');
      t.equal(await scene(t), 'game', 'and the board is behind it');
      await t.page.click('#modal [data-close]');
      await t.page.clock.runFor(400);
      t.equal(await scene(t), 'over', 'the results come when it is closed');
      // the menu, and a sheet opened from it: coming back does not strand the player on a finished board
      for (const sheet of ['settings', 'help']) {
        await lastPlay(t);
        await t.page.click('#b-menu');
        await t.page.click(`#modal [data-go="${sheet}"]`);
        t.equal(await scene(t), sheet, sheet + ' is open');
        await t.page.clock.runFor(3000);
        t.equal(await scene(t), sheet, 'and stays open');
        await t.page.locator('#screen [data-back]').first().click();
        await t.page.clock.runFor(400);
        t.equal(await scene(t), 'over', 'back from ' + sheet + ' the results are shown');
      }
      // leaving for the title drops them
      await lastPlay(t);
      await t.page.click('#b-menu');
      await t.page.click('#modal [data-go="title"]');
      await t.page.clock.runFor(3000);
      t.equal(await scene(t), 'title', 'the title is not taken over by the results');
      t.equal(await t.page.evaluate(() => !!window.__G.aiHeld), false, 'and nothing is held');
      await t.page.clock.resume();
    },
  },
];

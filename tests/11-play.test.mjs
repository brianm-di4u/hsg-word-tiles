// The core loop through the UI: staging with a live preview, illegal plays refused, playing, the AI's reply,
// blanks, swaps, passes, hints and a full game to the end.
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
async function start(t, seed = 11, extra = {}) {
  await ready(t);
  await t.game('newGame', { seed, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'hollis' }], ...extra });
  await t.waitIdle(8000);
}
const N = 15;

export const tests = [
  {
    name: 'live preview, an illegal play refused, then a good play and the reply',
    browsers: ['chromium', 'firefox', 'webkit'],
    async run(t) {
      await start(t);
      let s = await t.state();
      // illegal: a single tile away from the centre
      const rack = s.game.players[0].rack;
      await t.game('act', 'stage', [{ i: 0, l: rack.find((l) => l !== '?') }]);
      s = await t.state();
      t.expect(s.preview && !s.preview.ok && /Display Spring/.test(s.preview.error), 'preview explains the opening rule');
      await t.shot('11-error');
      const r0 = await t.game('act', 'play');
      t.expect(!r0.ok, 'refused');
      s = await t.state();
      t.equal(s.game.move, 0, 'still move 0');
      await t.game('act', 'recall');
      // the best opening
      const [best] = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', best.tiles);
      s = await t.state();
      t.expect(s.preview.ok && s.preview.score === best.score, `preview scores ${best.score}`);
      await t.shot('11-preview');
      const r = await t.game('act', 'play');
      t.expect(r.ok, 'played');
      await t.waitIdle(10000);
      s = await t.state();
      t.expect(s.game.move >= 2, 'the computer replied');
      t.equal(s.game.cur, 0, 'back to you');
      t.equal(s.game.players[0].rack.length, 7, 'rack refilled');
      await t.shot('11-after-reply');
    },
  },
  {
    name: 'blank tile asks for a letter',
    browsers: ['chromium', 'firefox', 'webkit'],
    async run(t) {
      await start(t, 5);
      const s = await t.state();
      const g = s.game;
      g.players[0].rack = ['?', 'A', 'T', 'E', 'R', 'S', 'N'];
      await t.game('setState', { game: g });
      // click-free: open the blank dialog by staging the blank through the UI path (drag), here via a tap
      const tile = await t.game('act', 'rackTile', 0);
      await t.page.mouse.click(tile[0], tile[1]);
      const cell = await t.game('act', 'screen', 7 * N + 7);
      await t.page.mouse.click(cell[0], cell[1]);
      await t.waitIdle();
      const st = await t.state();
      t.equal(st.dialog, 'blank', 'blank dialog open');
      await t.shot('11-blank');
      await t.page.keyboard.press('w');
      const st2 = await t.state();
      t.equal(st2.staged.length, 1, 'blank staged');
      t.equal(st2.staged[0].l, 'W', 'as W');
      t.expect(st2.staged[0].blank, 'marked blank');
    },
  },
  {
    name: 'swap dialog and pass',
    browsers: ['chromium', 'firefox', 'webkit'],
    async run(t) {
      await start(t, 6);
      await t.page.keyboard.press('Shift+S');
      await t.waitIdle();
      let s = await t.state();
      t.equal(s.dialog, 'swap', 'swap dialog open');
      const btns = await t.page.$$('[data-sw]');
      await btns[0].click(); await btns[1].click();
      await t.shot('11-swap');
      await t.page.click('[data-swap-go]');
      await t.waitIdle(10000);
      s = await t.state();
      t.equal(s.game.log[0].kind, 'swap', 'swap logged');
      t.equal(s.game.log[0].count, 2, 'two tiles');
      t.equal(s.game.cur, 0, 'computer has replied');
      await t.page.keyboard.press('Shift+P');
      await t.page.click('#modal [data-ok]');
      await t.waitIdle(10000);
      s = await t.state();
      t.expect(s.game.log.some((e, k) => k > 1 && e.kind === 'pass' && e.p === 0), 'pass logged');
    },
  },
  {
    name: 'hint stages a strong play',
    browsers: ['chromium', 'firefox', 'webkit'],
    async run(t) {
      await start(t, 8);
      const n = await t.game('act', 'hint');
      t.expect(n > 0, 'hint staged tiles');
      const s = await t.state();
      t.expect(s.preview && s.preview.ok, 'the hinted play is legal');
      t.equal(s.game.players[0].hints, 2, 'one hint used');
      await t.shot('11-hint');
    },
  },
  {
    name: 'autoplay finishes a game and shows the result',
    browsers: ['chromium', 'firefox', 'webkit'],
    async run(t) {
      await start(t, 21);
      const r = await t.game('act', 'autoplay', 999);
      t.expect(r.over, 'game over');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 5000 });
      await t.shot('12-over');
      await t.checkLayout({ allowScrollY: true });
    },
  },
];

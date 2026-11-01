// Real input: mouse drag and drop, touch drag with the lifted tile and snapped ghost, tap to place, dragging a staged
// tile back, reordering the rack, and a whole play made with the keyboard.
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const N = 15, CENTER = 112;
async function start(t, rack) {
  await ready(t);
  await t.game('newGame', { seed: 3 });
  await t.waitIdle(5000);
  const s = await t.state();
  if (rack) { s.game.players[0].rack = rack.split(''); await t.game('setState', { game: s.game }); await t.waitIdle(); }
}

export const tests = [
  {
    name: 'mouse: drag rack tiles to the board, drag one back, reorder the rack',
    browsers: ['chromium', 'firefox', 'webkit'],
    viewports: ['desktop'],
    async run(t) {
      await start(t, 'SPRINGE');
      const drag = async (from, to) => {
        await t.page.mouse.move(from[0], from[1]); await t.page.mouse.down();
        await t.page.mouse.move((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, { steps: 6 });
        await t.page.mouse.move(to[0], to[1], { steps: 6 }); await t.page.mouse.up();
      };
      // S P R I N G across from the centre
      for (let k = 0; k < 6; k++) {
        const tile = await t.game('act', 'rackTile', 0);
        await drag(tile, await t.game('act', 'screen', CENTER - 2 + k));
      }
      let s = await t.state();
      t.equal(s.staged.map((x) => x.l).join(''), 'SPRING', 'six tiles staged by drag');
      t.expect(s.preview && s.preview.ok, 'SPRING is a legal opening');
      await t.shot('13-dragged');
      // drag the G back to the rack
      const g = await t.game('act', 'screen', CENTER + 3);
      const rb = await t.page.$eval('#rack', (e) => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
      await drag(g, rb);
      s = await t.state();
      t.equal(s.staged.length, 5, 'one tile dragged back');
      t.equal(s.order.length, 2, 'two tiles on the rack');
      // drop the G before the E
      const first = await t.game('act', 'rackTile', 0), second = await t.game('act', 'rackTile', 1);
      await drag(second, [first[0] - 10, first[1]]);
      s = await t.state();
      t.equal(s.game.players[0].rack[s.order[0]], second[2], 'rack reordered by drag');
    },
  },
  {
    name: 'touch: no auto-zoom, the lifted tile lands on its ghost square, tap to recall',
    viewports: ['mobile'],
    async run(t) {
      await start(t, 'SPRINGE');
      const c = await t.game('act', 'screen', CENTER);
      await t.tap(c);
      await t.waitIdle();
      let s = await t.state();
      t.equal(s.view.zoom, 1, 'tapping the board does not zoom');
      // the tile floats `lift` px above the finger and lands on the square under the tile, not the finger
      const lift = await t.game('act', 'dragLift');
      const tile = await t.game('act', 'rackTile', 0);
      await t.touchDrag([tile[0], tile[1]], [c[0], c[1] + lift], { steps: 14, holdEndMs: 120 });
      s = await t.state();
      t.equal(s.staged.length, 1, 'tile placed by touch');
      t.equal(s.staged[0] && s.staged[0].i, CENTER, 'on the square under the lifted tile');
      t.equal(s.view.zoom, 1, 'the board never zoomed');
      // tap the staged tile: back to the rack
      await t.tap(c);
      s = await t.state();
      t.equal(s.staged.length, 0, 'tap recalls');
      // tap-to-place: tap a rack tile, then a square
      const r0 = await t.game('act', 'rackTile', 0);
      await t.tap([r0[0], r0[1]]);
      await t.tap(c);
      s = await t.state();
      t.equal(s.staged.length, 1, 'tap a tile, tap a square');
    },
  },
  {
    name: 'touch: snapped ghost, target hysteresis, taken squares send the tile back',
    viewports: ['mobile'],
    async run(t) {
      await start(t, 'SPRINGE');
      await t.game('act', 'stage', [{ l: 'S', i: CENTER }]);
      const lift = await t.game('act', 'dragLift');
      const a = await t.game('act', 'screen', CENTER + 1), b = await t.game('act', 'screen', CENTER + 2);
      const cell = b[0] - a[0];
      const tile = await t.game('act', 'rackTile', 0);
      const cdp = await t.page.context().newCDPSession(t.page);
      const pt = (x, y) => [{ x, y, id: 1 }];
      const move = async (x, y) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(x, y) }); await t.waitFrames(2); };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(tile[0], tile[1]) });
      for (let k = 1; k <= 12; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(tile[0] + (a[0] - tile[0]) * k / 12, tile[1] + (a[1] + lift - tile[1]) * k / 12) });
      await t.waitFrames(3);
      let s = await t.state();
      t.equal(s.drag && s.drag.target, CENTER + 1, 'the ghost sits on the square under the tile');
      t.expect(s.view.zoom === 1, 'no zoom while dragging');
      await t.shot('13-drag-ghost', { wait: false });
      await move(a[0] + cell * 0.55, a[1] + lift);
      s = await t.state();
      t.equal(s.drag && s.drag.target, CENTER + 1, 'just past the edge of the square: the target holds');
      await move(a[0] + cell, a[1] + lift);
      s = await t.state();
      t.equal(s.drag && s.drag.target, CENTER + 2, 'a whole square on: the target moves');
      const c = await t.game('act', 'screen', CENTER);
      await move(c[0], c[1] + lift);
      s = await t.state();
      t.equal(s.drag && s.drag.blocked, CENTER, 'over a taken square: blocked');
      t.equal(s.drag && s.drag.target, null, 'no target on a taken square');
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      s = await t.state();
      t.equal(s.staged.length, 1, 'nothing new staged');
      t.equal(s.order.length, 6, 'the tile went back to the rack');
    },
  },
  {
    name: 'keyboard: cursor, typing, direction, backspace and enter',
    browsers: ['chromium', 'firefox', 'webkit'],
    async run(t) {
      await start(t, 'STEAMXQ');
      await t.page.focus('#board');
      // cursor starts at the centre; go two left and type STEAM across
      await t.page.keyboard.press('ArrowLeft'); await t.page.keyboard.press('ArrowLeft');
      await t.page.keyboard.type('STEAZ');
      let s = await t.state();
      t.equal(s.staged.length, 4, 'Z is not on the rack: four placed');
      await t.page.keyboard.press('Backspace');
      s = await t.state();
      t.equal(s.staged.length, 3, 'backspace takes back the A');
      await t.page.keyboard.type('AM');
      s = await t.state();
      t.equal(s.staged.map((x) => x.l).join(''), 'STEAM', 'STEAM typed');
      await t.shot('16-keyboard');
      await t.page.keyboard.press('Enter');
      await t.waitIdle(10000);
      s = await t.state();
      t.expect(s.game.log[0] && s.game.log[0].words[0].w === 'STEAM', 'played with Enter');
      t.expect(s.game.log[0].themed > 0, 'STEAM earned the Hot Springs bonus');
    },
  },
];

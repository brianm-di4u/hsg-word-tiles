// Wave 3, batch B: S2-21 (Shuffle stays while tiles are staged), S3-16 (the computer waits for a dialog),
// S6-08 (the checks a green run used to skip), S1-01 (the rack is yours during the computer's turn),
// S1-03 (phone placement), S3-13 (what you missed) and S4-03 (fact cards).
import { ctx, root } from './lib.mjs';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
// a pre-wave profile with a settings key: no first-run tips, no sound; the computer answers at once unless a test asks for a pace
const instant = () => { window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false })); };
const paced = () => { window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'normal', sound: false })); };
const SEATS = [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }];

export const tests = [
  // ---------- S2-21 ----------
  {
    name: 'S2-21 Shuffle stays beside Recall while tiles are placed, and moves only the tiles still on the rack',
    viewports: ['desktop', 'mobile'],
    initScript: instant,
    async run(t) {
      await ready(t);
      await t.seed(5);
      await t.game('newGame', { seats: SEATS });
      await t.waitIdle(8000);
      t.expect(await t.page.locator('[data-act="shuffle"]').count() === 1 && await t.page.locator('[data-act="recall"]').count() === 0, 'with nothing placed: Shuffle, no Recall');
      const [m] = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', m.tiles.slice(0, 1));
      const before = await t.state();
      t.equal(before.staged.length, 1, 'one tile is placed');
      t.expect(await t.page.locator('[data-act="shuffle"]').isVisible() && await t.page.locator('[data-act="recall"]').isVisible(), 'both Shuffle and Recall show');
      await t.shot('S2-21-shuffle-and-recall');
      // the shuffle's dice: a fixed one, so the result is the same every run
      await t.page.evaluate(() => { window.__rand = Math.random; Math.random = () => 0; });
      await t.page.click('[data-act="shuffle"]');
      await t.page.evaluate(() => { Math.random = window.__rand; });
      const after = await t.state();
      t.expect(JSON.stringify(after.order) !== JSON.stringify(before.order), 'the rack order changed');
      t.equal(JSON.stringify([...after.order].sort()), JSON.stringify([...before.order].sort()), 'with the same tiles on the rack');
      t.equal(JSON.stringify(after.staged), JSON.stringify(before.staged), 'and the placed tile where it was');
      await t.page.keyboard.press('Shift+R');
      t.equal((await t.state()).staged.length, 1, 'Shift+R with a tile placed leaves it there');
      await t.page.click('[data-act="recall"]');
      const back = await t.state();
      t.equal(back.staged.length, 0, 'Recall takes the tile back');
      t.equal(back.order.length, 7, 'and the rack is whole again');
      await t.checkLayout();
    },
  },
  // ---------- S3-16 ----------
  {
    name: 'S3-16 the computer holds its move while the pause sheet is open and plays it once the sheet closes',
    viewports: ['desktop', 'mobile'],
    initScript: paced,
    async run(t) {
      await ready(t);
      await t.seed(5);
      await t.game('newGame', { seats: SEATS });
      await t.waitIdle(8000);
      const [m] = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', m.tiles);
      // play and open the menu in one breath, so the sheet is up before the computer can answer
      await t.page.evaluate(() => { window.__game.act('play'); window.__game.act('open', 'pause'); });
      const move = (await t.state()).game.move;
      await t.page.waitForFunction(() => window.__game.getState().aiHeld, null, { timeout: 15000 });
      let s = await t.state();
      t.equal(s.dialog, 'pause', 'the pause sheet is still open');
      t.equal(s.game.move, move, 'the computer has not played under it');
      await t.game('act', 'close');
      await t.page.waitForFunction((n) => window.__game.getState().game.move > n, move, { timeout: 15000 });
      s = await t.state();
      t.expect(!s.aiHeld, 'the held reply was used');
      t.equal(s.game.move, move + 1, 'the computer played its one move after the sheet closed');
    },
  },
  {
    name: 'S3-16 a reply held for the menu is not lost when the menu opens the tile tracker first',
    viewports: ['desktop'],
    initScript: paced,
    async run(t) {
      await ready(t);
      await t.seed(6);
      await t.game('newGame', { seats: SEATS });
      await t.waitIdle(8000);
      const [m] = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', m.tiles);
      await t.page.evaluate(() => { window.__game.act('play'); window.__game.act('open', 'pause'); });
      const move = (await t.state()).game.move;
      await t.page.waitForFunction(() => window.__game.getState().aiHeld, null, { timeout: 15000 });
      await t.page.evaluate(() => window.__game.act('open', 'tracker'));
      t.equal((await t.state()).game.move, move, 'still held on the second sheet');
      await t.game('act', 'close');
      await t.page.waitForFunction((n) => window.__game.getState().game.move > n, move, { timeout: 15000 });
      t.equal((await t.state()).game.move, move + 1, 'played once, after the last sheet closed');
    },
  },
  // ---------- S1-01 ----------
  {
    name: "S1-01 during the computer's turn the rack can be shuffled and rearranged, nothing can be placed, and the order is there on your turn",
    viewports: ['desktop', 'mobile'],
    initScript: paced,
    async run(t) {
      await ready(t);
      await t.seed(5);
      await t.game('newGame', { seats: SEATS });
      await t.waitIdle(8000);
      const [m] = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', m.tiles);
      // play, and make the tab look hidden in the same breath: the computer's reply is then held, so the turn waits for us
      await t.page.evaluate(() => { window.__game.act('play'); Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); });
      await t.page.waitForFunction(() => window.__game.getState().aiHeld, null, { timeout: 15000 });
      const letters = () => t.page.evaluate(() => [...document.querySelectorAll('#rack .rtile')].map((b) => b.getAttribute('aria-label')[0]).join(''));
      const boxes = () => t.page.evaluate(() => [...document.querySelectorAll('#rack .rtile')].map((b) => { const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }));
      const settled = () => t.page.waitForFunction(() => document.querySelector('#ghost').hidden && !document.querySelector('#rack .lifted'), null, { timeout: 5000 });
      const move = (await t.state()).game.move;
      t.equal((await t.state()).game.players[(await t.state()).game.cur].kind, 'ai', "it is the computer's turn");
      t.expect(await t.page.evaluate(() => document.querySelector('#rack').classList.contains('dim') && [...document.querySelectorAll('#rack .rtile')].length === 7 && [...document.querySelectorAll('#rack .rtile')].every((b) => !b.disabled)), 'the rack is shown, dimmed, and its tiles are live');
      t.expect(await t.page.locator('[data-act="shuffle"]').isEnabled(), 'Shuffle is on');
      t.expect(await t.page.locator('[data-act="pass"]').isDisabled() && await t.page.locator('[data-act="play"]').isDisabled(), 'Pass and Play are still off');
      await t.shot('S1-01-rack-during-computer-turn');
      const start = await letters();
      // Shuffle, with fixed dice so the result is the same every run
      await t.page.evaluate(() => { window.__rand = Math.random; Math.random = () => 0; });
      await t.page.click('[data-act="shuffle"]');
      await t.page.evaluate(() => { Math.random = window.__rand; });
      const shuffled = await letters();
      t.expect(shuffled !== start, 'the shuffle changed the order');
      t.equal([...shuffled].sort().join(''), [...start].sort().join(''), 'and kept the same seven tiles');
      // a real drag: the first tile to the far end of the rack
      let b = await boxes();
      await t.page.mouse.move(b[0][0], b[0][1]); await t.page.mouse.down();
      await t.page.mouse.move(b[0][0] + 20, b[0][1], { steps: 3 }); await t.page.mouse.move(b[6][0] + 30, b[6][1], { steps: 8 });
      await t.page.mouse.up(); await settled();
      const dragged = await letters();
      t.equal(dragged, shuffled.slice(1) + shuffled[0], 'dragging the first tile to the end moved it there');
      // a tile dropped on the board goes back to the rack, and nothing is placed
      b = await boxes();
      const cell = await t.game('act', 'screen', 112);
      await t.page.mouse.move(b[2][0], b[2][1]); await t.page.mouse.down();
      await t.page.mouse.move(b[2][0], b[2][1] - 30, { steps: 3 }); await t.page.mouse.move(cell[0], cell[1], { steps: 8 });
      await t.page.mouse.up(); await settled();
      const s = await t.state();
      t.equal(s.staged.length, 0, 'nothing was placed on the board');
      t.equal(s.game.move, move, "and the computer's turn goes on");
      t.equal(await letters(), dragged, 'the tile is back where it was in the rack');
      // a tap does not pick a tile up
      b = await boxes();
      await t.page.mouse.click(b[1][0], b[1][1]);
      t.equal(await t.page.locator('#rack .rtile.sel').count(), 0, 'a tap leaves nothing selected');
      // the computer plays; the rack is as it was left
      await t.page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
      await t.page.waitForFunction((n) => { const g = window.__game.getState(); return g.game.move > n && g.game.players[g.game.cur].kind === 'human'; }, move, { timeout: 15000 });
      await t.waitIdle(8000);
      t.equal(await letters(), dragged, 'on your turn the rack is in the order you left it');
      t.expect(await t.page.evaluate(() => !document.querySelector('#rack').classList.contains('dim') && [...document.querySelectorAll('#rack .rtile')].every((x) => !x.disabled)), 'and it is live again');
      const [m2] = await t.game('act', 'moves', 1);
      t.expect((await t.game('act', 'stage', m2.tiles)).ok, 'tiles can be placed on your turn');
      await t.checkLayout();
    },
  },
];

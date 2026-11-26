// Wave 4, batch W4-B08 (WF-2 discovery sightlines): W2-S1-18 (the brass inspect ring on an empty special square; the blank's sea glass
// was built by 050386d, tests: wave4-b01), W2-S3-14 (Bathhouse Row and the Display Spring on the zoomed minimap) and W2-S4-16 (what the
// Daily is and what a Hot Springs word pays, on Turn 1; the kinds on the strip and the plaques' names were built by fe9ce1b and cfbabc1).
import { ctx } from './lib.mjs';
import { createGame } from '../src/js/engine.js';
import { todaysSprings } from '../src/js/ui.js';
import { SQUARE, BATHHOUSES, CENTER } from '../src/js/score.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false }));
};
const TWO = { seed: 3, seats: [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }] };
const WARM = 62, PLAIN = 63;   // row 4: an empty Warm spring and the plain square beside it
async function table(t) {
  await t.game('newGame', TWO);
  await t.waitIdle(8000);
  await t.game('act', 'reveal');
  await t.waitIdle(8000);
  await t.waitFrames(3);
}
// the board canvas around square i, against a copy taken by snap(): how many pixels of the ring band changed, and how many of those
// are brass; and how many changed outside the band (in the square's own box)
const snap = (t, i) => t.page.evaluate(async (i) => {
  const [cx, cy] = await window.__game.act('cell', i), [nx] = await window.__game.act('cell', i + 1);
  const cv = document.querySelector('#board'), k = cv.width / cv.getBoundingClientRect().width, cell = (nx - cx) * k;
  const x0 = Math.round(cx * k - cell * 0.6), y0 = Math.round(cy * k - cell * 0.6), w = Math.round(cell * 1.2);
  window.__b08 = { i, x0, y0, w, cell, cx: cx * k, cy: cy * k, d: cv.getContext('2d').getImageData(x0, y0, w, w).data };
}, i);
const ring = (t) => t.page.evaluate(() => {
  const b = window.__b08, cv = document.querySelector('#board'), d = cv.getContext('2d').getImageData(b.x0, b.y0, b.w, b.w).data;
  let band = 0, brass = 0, out = 0;
  for (let y = 0; y < b.w; y++) for (let x = 0; x < b.w; x++) {
    const p = (y * b.w + x) * 4, diff = Math.abs(d[p] - b.d[p]) + Math.abs(d[p + 1] - b.d[p + 1]) + Math.abs(d[p + 2] - b.d[p + 2]) + Math.abs(d[p + 3] - b.d[p + 3]);
    if (diff < 60) continue;
    const r = Math.hypot(b.x0 + x - b.cx, b.y0 + y - b.cy) / b.cell;
    if (r >= 0.3 && r <= 0.56) { band++; if (d[p + 3] > 180 && d[p] > 170 && d[p + 1] > 130 && d[p + 2] < 130 && d[p] - d[p + 2] > 80) brass++; } else if (r < 0.3) out++;
  }
  return { band, brass, out, cell: b.cell };
});

export const tests = [
  // ---------- W2-S1-18 ----------
  {
    name: 'W2-S1-18 an empty special square whose rule the strip shows wears a thin brass ring on the board: under the mouse, and after a tap on a touch screen while its tip shows',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      t.equal(SQUARE[WARM] + SQUARE[PLAIN], 'w.', 'a Warm spring with a plain square beside it');
      await table(t);
      const mode3d = (await t.state()).view.mode3d;
      await snap(t, WARM);
      const pt = (i) => t.game('act', 'screen', i);
      if (t.viewport === 'desktop') {
        const [x, y] = await pt(WARM);
        await t.page.mouse.move(x, y);
        await t.page.waitForFunction(() => /Warm spring/.test(document.querySelector('#preview').textContent), null, { timeout: 3000 });
        await t.waitFrames(3);
        const on = await ring(t);
        t.expect(on.band > on.cell * 2 && on.brass > on.cell, `${mode3d ? '3D' : '2D'}: a brass ring round the Warm spring (${on.band} px changed in the ring's band, ${on.brass} brass; a square is ${on.cell.toFixed(1)} px)`);
        t.expect(on.out < on.cell * 0.5, `and the square's own middle is left alone (${on.out} px)`);
        await t.shot('w4-b08-inspect-ring');
        const [px, py] = await pt(PLAIN);
        await t.page.mouse.move(px, py);
        await t.waitFrames(3);
        t.expect((await ring(t)).band < on.cell * 0.5, 'gone when the mouse moves to a plain square');
        await snap(t, PLAIN);
        await t.waitFrames(2);
        t.expect((await ring(t)).band < on.cell * 0.5, 'and a plain square, which has no rule to show, gets none');
        await t.page.mouse.move(x, y);
        await t.waitFrames(3);
        await t.page.mouse.move(5, 5);
        await t.waitFrames(3);
        await snap(t, WARM);
        await t.page.mouse.move(x, y);
        await t.waitFrames(3);
        t.expect((await ring(t)).band > on.cell * 2, 'back on the Warm spring');
        await t.page.mouse.move(5, 5);
        await t.waitFrames(3);
        t.expect((await ring(t)).band < on.cell * 0.5, 'and gone when the mouse leaves the board');
        return;
      }
      await t.tap(await pt(WARM));
      const t0 = Date.now();
      await t.page.waitForFunction(() => /Warm spring/.test(document.querySelector('#preview').textContent), null, { timeout: 3000 });
      await t.shot('w4-b08-inspect-ring');
      // the board takes focus from the touch and draws the keyboard cursor's box on the square (seen before this batch, W4-B07's
      // notes); blurring it leaves the ring alone to measure
      await t.page.evaluate(() => document.activeElement && document.activeElement.blur());
      await t.waitFrames(3);
      const on = await ring(t);
      t.expect(on.band > on.cell * 2 && on.brass > on.cell, `${mode3d ? '3D' : '2D'}: a tapped Warm spring wears the ring (${on.band} px changed in the band, ${on.brass} brass; a square is ${on.cell.toFixed(1)} px)`);
      t.expect(on.out < on.cell * 0.5, `and the square's own middle is left alone (${on.out} px)`);
      // it goes when the tip does (3.6 s)
      await t.page.waitForFunction(() => !/Warm spring/.test(document.querySelector('#preview').textContent), null, { timeout: 7000 });
      await t.waitFrames(3);
      const gone = Date.now() - t0;
      t.expect(gone > 2500, `the ring stays while the tip shows (${gone} ms)`);
      t.expect((await ring(t)).band < on.cell * 0.5, 'and is gone with the tip');
    },
  },
];

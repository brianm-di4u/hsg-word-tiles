// Wave 3, batch W3-B18: W6-S4-05 (the part left after f6db630 and 7bc5acc: the desk bell is never cut by the edge of the
// board area, and every rail stays inside it, at the window sizes the older tests do not use).
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, theme: 'light' }));
  }
};
// the window sizes, and whether the bell has room beside the board there
const SIZES = [[1280, 800, true], [1024, 768, false], [1366, 768, true], [1180, 820, false], [1024, 600, true], [1920, 1080, true], [1280, 800, true]];

export const tests = [
  {
    name: 'W6-S4-05 the desk bell is whole or not there, and all four rails are inside the board area, at every desktop window size',
    viewports: ['desktop'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 41, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'julian' }] });
      await t.waitIdle(8000);
      if (!(await t.game('act', 'b3')).on) { t.log('no 3D board here (software GL); run with --gpu'); return; }
      for (const [w, h, shown] of SIZES) {
        await t.page.setViewportSize({ width: w, height: h });
        // wait until the board has been laid out at this size
        await t.page.waitForFunction(async () => {
          const r = document.getElementById('boardwrap').getBoundingClientRect(), b = (await window.__game.act('b3')).bezel;
          return b && Math.abs(b.W - r.width) < 1.5 && Math.abs(b.H - r.height) < 1.5;
        }, null, { timeout: 8000 });
        await t.waitFrames(2);
        const { bezel: z, props: { bell, towel }, fit, tall } = await t.game('act', 'b3');
        const at = `${w}x${h} (board ${Math.round(z.W)}x${Math.round(z.H)}): `;
        t.equal(tall, false, at + 'the desktop camera');
        t.equal(bell.visible, shown, at + 'the bell is ' + (shown ? 'there' : 'left out'));
        if (bell.visible) t.expect(bell.minX >= 0 && bell.maxX <= z.W && bell.minY >= 0 && bell.maxY <= z.H, at + `the bell is whole (${bell.minX}..${bell.maxX} of ${z.W})`);
        else t.expect(bell.maxX > z.W, at + `it would have been cut (${bell.minX}..${bell.maxX} of ${z.W})`);
        t.expect(z.minX >= 0 && z.maxX <= z.W && z.minY >= 0 && z.maxY <= z.H, at + `all four rails are inside (${[z.minX, z.W - z.maxX, z.minY, z.H - z.maxY].map((x) => x.toFixed(1)).join(', ')} px to spare)`);
        t.expect(towel.visible && towel.minX < 0 && towel.maxX > 0, at + 'the towel corner is cropped by the left edge');
        t.log(at + `fit ${fit.toFixed(2)}, bell ${bell.visible ? 'shown' : 'left out'} ${bell.minX}..${bell.maxX}`);
        if (w === 1024) await t.shot(`w3-b18-props-${w}x${h}`, { timeout: 15000 });
      }
    },
  },
  {
    name: 'W6-S4-05 on phones and portrait tablets every rail, the southern one included, is inside the board area',
    viewports: ['mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 41, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'julian' }] });
      await t.waitIdle(8000);
      if (!(await t.game('act', 'b3')).on) { t.log('no 3D board here (software GL); run with --gpu'); return; }
      for (const [w, h] of [[390, 844], [320, 568], [360, 640], [430, 932], [768, 1024], [390, 844]]) {
        await t.page.setViewportSize({ width: w, height: h });
        await t.page.waitForFunction(async () => {
          const r = document.getElementById('boardwrap').getBoundingClientRect(), b = (await window.__game.act('b3')).bezel;
          return b && Math.abs(b.W - r.width) < 1.5 && Math.abs(b.H - r.height) < 1.5;
        }, null, { timeout: 8000 });
        await t.waitFrames(2);
        const b3 = await t.game('act', 'b3'), z = b3.bezel, at = `${w}x${h} (board ${Math.round(z.W)}x${Math.round(z.H)}): `;
        t.equal(b3.tall, true, at + 'the portrait camera');
        t.expect(b3.tilt >= 0.08 && b3.tilt <= 0.10, at + `drawn at ${b3.tilt} rad`);
        const gaps = [z.minX, z.W - z.maxX, z.minY, z.H - z.maxY];
        t.expect(gaps.every((x) => x >= 0.5), at + `all four rails are inside (left, right, top, bottom: ${gaps.map((x) => x.toFixed(1)).join(', ')} px to spare)`);
        t.equal(b3.props.bell.visible || b3.props.towel.visible, false, at + 'no props on phones');
      }
    },
  },
];

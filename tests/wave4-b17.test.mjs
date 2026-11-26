// Wave 4, batch W4-B17: W4-S2-05 (tap-on-occupied error nudge + Space direction liveSay),
// W4-S3-11 (returnTimer race + coarse-pointer 6 ms pick haptic),
// W4-S4-14 (keyboard cursor/rotate wooden tick, soft recall on returnToRack, blocked-drop haptics, deselect unpick),
// W4-S2-03 (continuous edgePan, reduced-motion-safe :active press states, in-rackbar live slot parting, smooth board-tile blocked return).
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const CENTER = 112;
const withVibrate = (extra = {}) => new Function(`
  window.__TEST_TIPS__ = false;
  window.__vib = [];
  navigator.vibrate = (p) => { window.__vib.push(p); return true; };
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify(Object.assign({ ai: 'instant', sound: true, motion: 'full', vibrate: true }, ${JSON.stringify(extra)})));
  }
`);

async function start(t, rack, seed = 7) {
  await ready(t);
  await t.game('newGame', { seed });
  await t.waitIdle(5000);
  if (rack) {
    const s = await t.state();
    s.game.players[0].rack = rack.split('');
    await t.game('setState', { game: s.game });
    await t.waitIdle(5000);
  }
}

export const tests = [
  // ---------- W4-S2-05 ----------
  {
    name: 'W4-S2-05 tapping an occupied square with a selected rack tile nudges with oops() and flash, and Space announces direction',
    viewports: ['desktop', 'mobile'],
    initScript: withVibrate(),
    async run(t) {
      await start(t, 'SPRINGE');
      // Place a committed word across the centre so CENTER is occupied on the board
      await t.game('act', 'stage', [...'SPRING'].map((l, k) => ({ l, i: CENTER - 2 + k })));
      await t.game('act', 'play');
      await t.waitIdle(10000);
      // Select the first rack tile
      const r0 = await t.game('act', 'rackTile', 0);
      if (t.viewport === 'mobile') await t.tap([r0[0], r0[1]]);
      else await t.page.mouse.click(r0[0], r0[1]);
      await t.page.waitForFunction(() => window.__G.selected != null, null, { timeout: 3000 });
      const selBefore = await t.page.evaluate(() => window.__G.selected);
      const vibBefore = await t.page.evaluate(() => window.__vib.length);
      const sfxBefore = await t.page.evaluate(() => window.__game.audioState().total);
      // Tap/click the occupied CENTER square
      const occ = await t.game('act', 'screen', CENTER);
      if (t.viewport === 'mobile') await t.tap(occ);
      else await t.page.mouse.click(occ[0], occ[1]);
      await t.page.waitForFunction(() => /That square is taken/i.test(document.querySelector('#preview').textContent), null, { timeout: 2000 });
      await t.page.waitForFunction(() => /That square is taken/i.test(document.querySelector('#live').textContent), null, { timeout: 2000 });
      const after = await t.page.evaluate((n0) => ({
        sel: window.__G.selected,
        preview: document.querySelector('#preview').textContent,
        live: document.querySelector('#live').textContent,
        vibs: window.__vib.slice(n0),
        sfx: window.__game.audioState().played.slice(-3),
        total: window.__game.audioState().total,
        staged: window.__G.staged.length,
      }), vibBefore);
      t.equal(after.staged, 0, 'nothing staged on the occupied square');
      t.equal(after.sel, selBefore, 'rack tile remains selected for an immediate retry');
      t.expect(after.total > sfxBefore && after.sfx.includes('error'), `error cue played (${after.sfx.join(',')})`);
      t.expect(after.vibs.some((p) => JSON.stringify(p) === '[30,40,30]'), `error haptic pulsed (${JSON.stringify(after.vibs)})`);
      // Tapping an empty square next stages the still-selected tile cleanly
      const emptyIdx = await t.page.evaluate(() => window.__G.s.board.findIndex((x, i) => !x && i >= 60 && i < 160));
      const emptyPt = await t.game('act', 'screen', emptyIdx);
      if (t.viewport === 'mobile') await t.tap(emptyPt);
      else await t.page.mouse.click(emptyPt[0], emptyPt[1]);
      await t.page.waitForFunction((i) => window.__G.staged.some((x) => x.i === i), emptyIdx, { timeout: 2000 });
      await t.game('act', 'recall');
      // Space direction toggle live announcement (95abf2c still holds)
      await t.page.focus('#board');
      await t.page.keyboard.press('Space');
      await t.page.waitForFunction(() => /Direction: down/i.test(document.querySelector('#live').textContent), null, { timeout: 2000 });
      await t.page.keyboard.press('Space');
      await t.page.waitForFunction(() => /Direction: across/i.test(document.querySelector('#live').textContent), null, { timeout: 2000 });
    },
  },
];

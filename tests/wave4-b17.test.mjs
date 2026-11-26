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
  // ---------- W4-S3-11 ----------
  {
    name: 'W4-S3-11 rackDown/boardDown cancel returnTimer immediately (8d45148) and coarse-pointer pickup emits a 6 ms pick haptic',
    viewports: ['desktop', 'mobile'],
    initScript: withVibrate(),
    async run(t) {
      await start(t, 'SPRINGE');
      // 1. Touch/coarse-pointer pickup emits 6 ms haptic; fine-pointer desktop mouse does not
      const r0 = await t.game('act', 'rackTile', 0);
      await t.page.evaluate(() => { window.__vib.length = 0; });
      if (t.viewport === 'mobile') {
        await t.tap([r0[0], r0[1]]);
        const vTouch = await t.page.evaluate(() => window.__vib.slice());
        t.expect(vTouch.includes(6), `touch pickup emitted 6 ms pick pulse (${JSON.stringify(vTouch)})`);
        // Vibration off suppresses the 6 ms pick pulse
        await t.page.evaluate(() => { window.__G.settings.vibrate = false; window.__vib.length = 0; });
        const r1 = await t.game('act', 'rackTile', 1);
        await t.tap([r1[0], r1[1]]);
        t.equal((await t.page.evaluate(() => window.__vib.length)), 0, 'no pick pulse when vibrate is off');
        // Reduced motion suppresses the 6 ms pick pulse
        await t.page.evaluate(() => { window.__G.settings.vibrate = true; window.__G.settings.motion = 'reduce'; window.__vib.length = 0; });
        const r2 = await t.game('act', 'rackTile', 2);
        await t.tap([r2[0], r2[1]]);
        t.equal((await t.page.evaluate(() => window.__vib.length)), 0, 'no pick pulse under reduced motion');
        await t.page.evaluate(() => { window.__G.settings.motion = 'full'; window.__G.selected = null; });
      } else {
        // Desktop mouse (fine pointer) does not fire coarse-pointer pick haptic
        await t.page.mouse.click(r0[0], r0[1]);
        t.equal((await t.page.evaluate(() => window.__vib.length)), 0, 'fine-pointer mouse click does not emit coarse pick pulse');
        // Synthetic touch pointerdown on desktop still emits 6 ms pick pulse when vibrate is enabled
        await t.page.evaluate(() => {
          window.__G.selected = null;
          window.__vib.length = 0;
          const b = document.querySelector('#rack .rtile[data-pos="1"]');
          const rc = b.getBoundingClientRect();
          b.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 91, pointerType: 'touch', isPrimary: true, clientX: rc.left + rc.width / 2, clientY: rc.top + rc.height / 2, bubbles: true }));
          window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 91, pointerType: 'touch', isPrimary: true, clientX: rc.left + rc.width / 2, clientY: rc.top + rc.height / 2, bubbles: true }));
        });
        const vSynth = await t.page.evaluate(() => window.__vib.slice());
        t.expect(vSynth.includes(6), `touch pointerdown emitted 6 ms pick pulse (${JSON.stringify(vSynth)})`);
      }
      // 2. Quick rackDown / boardDown within 210 ms of returnToRack() cancels returnTimer so #ghost stays visible on the new drag
      await t.page.clock.install();
      await t.reload();
      await start(t, 'SPRINGE');
      const now0 = await t.page.evaluate(() => Date.now());
      await t.page.clock.pauseAt(now0 + 500);
      const t0 = await t.game('act', 'rackTile', 0);
      const mid = await t.game('act', 'screen', CENTER);
      // Drag tile 0 off the board into dead space so returnToRack() starts its 210 ms returnTimer
      await t.page.mouse.move(t0[0], t0[1]);
      await t.page.mouse.down();
      await t.page.mouse.move(mid[0], mid[1], { steps: 6 });
      await t.page.mouse.move(4, 4, { steps: 4 });
      await t.page.mouse.up();
      const returningNow = await t.page.evaluate(() => ({ timer: window.__G.returnTimer, returning: window.__G.returning }));
      t.expect(returningNow.timer > 0 && returningNow.returning != null, 'returnToRack scheduled returnTimer');
      // 50 ms later (< 210 ms), press another rack tile before exceeding DRAG_PX: rackDown must cancel returnTimer immediately
      await t.page.clock.runFor(50);
      const t1 = await t.game('act', 'rackTile', 1);
      await t.page.mouse.move(t1[0], t1[1]);
      await t.page.mouse.down();
      const afterDown = await t.page.evaluate(() => ({ timer: window.__G.returnTimer, returning: window.__G.returning }));
      t.equal(afterDown.timer, 0, 'rackDown immediately cancelled stale returnTimer before DRAG_PX');
      t.equal(afterDown.returning, null, 'rackDown immediately cleared G.returning');
      // Drag past DRAG_PX and advance 250 ms past the old timer window: #ghost must stay visible
      await t.page.mouse.move(mid[0], mid[1], { steps: 8 });
      await t.page.clock.runFor(250);
      const ghostDuringDrag = await t.page.evaluate(() => ({ active: !!(window.__G.drag && window.__G.drag.active), hidden: document.querySelector('#ghost').hidden }));
      t.expect(ghostDuringDrag.active && !ghostDuringDrag.hidden, 'stale returnTimer never hid fresh drag #ghost');
      await t.page.mouse.up();
      // Same check for boardDown cancelling a pending returnTimer immediately
      await t.page.clock.runFor(50);
      const t2 = await t.game('act', 'rackTile', 0);
      await t.page.mouse.move(t2[0], t2[1]); await t.page.mouse.down();
      await t.page.mouse.move(mid[0], mid[1], { steps: 6 });
      await t.page.mouse.move(4, 4, { steps: 4 }); await t.page.mouse.up();
      t.expect((await t.page.evaluate(() => window.__G.returnTimer)) > 0, 'second returnToRack scheduled returnTimer');
      await t.page.clock.runFor(40);
      const stPt = await t.game('act', 'screen', CENTER);
      await t.page.mouse.move(stPt[0], stPt[1]); await t.page.mouse.down();
      t.equal(await t.page.evaluate(() => window.__G.returnTimer), 0, 'boardDown immediately cancelled stale returnTimer');
      await t.page.mouse.up();
    },
  },
  // ---------- W4-S4-14 ----------
  {
    name: 'W4-S4-14 keyboard cursor/rotate wooden tick, soft recall on returnToRack, blocked-drop haptics, and gentle downward deselect tap',
    viewports: ['desktop', 'mobile'],
    initScript: withVibrate(),
    async run(t) {
      await start(t, 'SPRINGE');
      // 1. Offline acoustic calibration of new cues (tick ~-12 dB wooden tick, unpick gentler downward tap, zero full-vol clipping)
      if (t.viewport === 'desktop') {
        const placePeaks = [], pickPeaks = [], tickPeaks = [], unpickPeaks = [];
        for (let k = 0; k < 10; k++) {
          placePeaks.push((await t.game('act', 'renderSfx', 'place', 0.35)).peak);
          pickPeaks.push(await t.game('act', 'renderSfx', 'pick', 0.35));
          tickPeaks.push(await t.game('act', 'renderSfx', 'tick', 0.35));
          unpickPeaks.push(await t.game('act', 'renderSfx', 'unpick', 0.35));
        }
        const med = (xs) => [...xs].sort((a, b) => a - b)[xs.length >> 1];
        const mPlace = med(placePeaks);
        const mPick = med(pickPeaks.map((r) => r.peak));
        const mTick = med(tickPeaks.map((r) => r.peak));
        const mUnpick = med(unpickPeaks.map((r) => r.peak));
        const tickDb = 20 * Math.log10(mTick / mPlace);
        const tickFull = await t.game('act', 'renderSfx', 'tick', 1);
        const unpickFull = await t.game('act', 'renderSfx', 'unpick', 1);
        const rotTick = await t.game('act', 'renderSfx', 'tick', 0.35, { rotate: true });
        t.log(`W4-S4-14 peaks@0.35: place=${mPlace.toFixed(3)}, pick=${mPick.toFixed(3)}, tick=${mTick.toFixed(3)} (${tickDb.toFixed(1)} dB vs place), unpick=${mUnpick.toFixed(3)}; full prePeak: tick=${tickFull.prePeak}, unpick=${unpickFull.prePeak}`);
        t.expect(mTick >= 0.04 && mTick <= 0.16, `tick is whisper-quiet wooden cue at default vol (${mTick})`);
        t.expect(tickDb <= -8 && tickDb >= -18, `tick sits ~-12 dB below place (${tickDb.toFixed(1)} dB)`);
        t.expect(rotTick.peak >= 0.04 && rotTick.peak <= 0.16, `rotate tick is audible and quiet (${rotTick.peak})`);
        t.expect(mUnpick >= 0.06 && mUnpick < mPick, `unpick (${mUnpick}) is gentler than pick (${mPick})`);
        t.expect(med(unpickPeaks.map((r) => r.zc)) < med(pickPeaks.map((r) => r.zc)), 'unpick pitches lower/downward than pick');
        t.expect(tickFull.prePeak < 0.5 && unpickFull.prePeak < 0.7, `no clipping at full volume (tick=${tickFull.prePeak}, unpick=${unpickFull.prePeak})`);
      }
      // 2. Keyboard Arrow movement and Space rotate emit wooden 'tick' cues
      await t.page.focus('#board');
      const n0 = await t.page.evaluate(() => window.__game.audioState().total);
      await t.page.keyboard.press('ArrowRight');
      await t.page.keyboard.press('Space');
      const keyCues = await t.page.evaluate((n) => {
        const a = window.__game.audioState();
        return { delta: a.total - n, last: a.played.slice(-2) };
      }, n0);
      t.equal(keyCues.delta, 2, `arrow + Space emitted 2 cues (got ${keyCues.delta}: ${keyCues.last.join(',')})`);
      t.equal(keyCues.last.join(','), 'tick,tick', `arrow + Space both emitted tick (${keyCues.last.join(',')})`);
      // 3. Tapping a selected rack tile to deselect does NOT fire 'pick' on pointerdown; plays 'unpick' on release
      const r0 = await t.game('act', 'rackTile', 0);
      if (t.viewport === 'mobile') await t.tap([r0[0], r0[1]]);
      else await t.page.mouse.click(r0[0], r0[1]);
      await t.page.waitForFunction(() => window.__G.selected != null, null, { timeout: 2000 });
      const beforeDeselect = await t.page.evaluate(() => window.__game.audioState().total);
      if (t.viewport === 'mobile') await t.tap([r0[0], r0[1]]);
      else await t.page.mouse.click(r0[0], r0[1]);
      await t.page.waitForFunction(() => window.__G.selected === null, null, { timeout: 2000 });
      const deselectCues = await t.page.evaluate((n) => {
        const a = window.__game.audioState();
        return a.played.slice(-(a.total - n));
      }, beforeDeselect);
      t.equal(deselectCues.join(','), 'unpick', `deselecting played only unpick, not pick (${deselectCues.join(',')})`);
      // 4. Missed drag from rack flies back with a soft 'recall' cue
      const t0 = await t.game('act', 'rackTile', 0);
      const mid = await t.game('act', 'screen', CENTER);
      const beforeMiss = await t.page.evaluate(() => window.__game.audioState().total);
      await t.page.mouse.move(t0[0], t0[1]);
      await t.page.mouse.down();
      await t.page.mouse.move(mid[0], mid[1], { steps: 6 });
      await t.page.mouse.move(4, 4, { steps: 4 });
      await t.page.mouse.up();
      await t.page.waitForFunction(() => document.querySelector('#ghost').hidden, null, { timeout: 3000 });
      const missCues = await t.page.evaluate((n) => {
        const a = window.__game.audioState();
        return a.cues.slice(-(a.total - n));
      }, beforeMiss);
      const softRecall = missCues.find((c) => c.name === 'recall');
      t.expect(!!softRecall && softRecall.gain < 0.85, `missed rack drag played soft recall (${JSON.stringify(missCues)})`);
      // 5. Blocked drop onto an occupied square pairs buzz('error') with sfx('error')
      await t.game('act', 'stage', [{ l: 'S', i: CENTER }]);
      const t1 = await t.game('act', 'rackTile', 0);
      await t.page.evaluate(() => { window.__vib.length = 0; });
      const beforeBlocked = await t.page.evaluate(() => window.__game.audioState().total);
      await t.page.mouse.move(t1[0], t1[1]);
      await t.page.mouse.down();
      await t.page.mouse.move(mid[0], mid[1], { steps: 8 });
      await t.page.mouse.up();
      await t.page.waitForFunction(() => document.querySelector('#ghost').hidden, null, { timeout: 3000 });
      const blockedRes = await t.page.evaluate((n) => {
        const a = window.__game.audioState();
        return { played: a.played.slice(-(a.total - n)), vibs: window.__vib.slice() };
      }, beforeBlocked);
      t.expect(blockedRes.played.includes('error'), `blocked drop played error cue (${blockedRes.played.join(',')})`);
      t.expect(blockedRes.vibs.some((p) => JSON.stringify(p) === '[30,40,30]'), `blocked drop pulsed error haptic (${JSON.stringify(blockedRes.vibs)})`);
    },
  },
  // ---------- W4-S2-03 ----------
  {
    name: 'W4-S2-03 reduced-motion-safe :active press states on .rtile/.abtn, live in-rackbar slot parting (steady d.pos0 above rack per CD-WF4-06), and smooth blocked board-tile return',
    viewports: ['desktop', 'mobile'],
    initScript: withVibrate(),
    async run(t) {
      await start(t, 'SPRINGE');
      // 1. Frame-1 :active press feedback on .rtile and .abtn (reduced-motion safe, hit boxes never move)
      const r0 = await t.game('act', 'rackTile', 0);
      const rtileBefore = await t.page.$eval('#rack .rtile[data-pos="0"]', (b) => {
        const br = b.getBoundingClientRect();
        return { top: br.top, tx: getComputedStyle(b.firstChild).transform };
      });
      await t.page.mouse.move(r0[0], r0[1]);
      await t.page.mouse.down();
      const rtileActive = await t.page.$eval('#rack .rtile[data-pos="0"]', (b) => {
        const br = b.getBoundingClientRect();
        return { top: br.top, tx: getComputedStyle(b.firstChild).transform, filter: getComputedStyle(b.firstChild).filter };
      });
      await t.page.mouse.up();
      t.expect(Math.abs(rtileActive.top - rtileBefore.top) < 0.5, '.rtile button hit box stays stationary on :active');
      t.expect(rtileActive.tx !== 'none' && rtileActive.tx !== rtileBefore.tx, `.rtile canvas transforms on :active (${rtileActive.tx})`);
      // Check .abtn:active on Pass (always enabled)
      const passBtn = t.page.locator('#actions [data-act="pass"]');
      const pbBox = await passBtn.boundingBox();
      const abtnBefore = await passBtn.evaluate((b) => ({ top: b.getBoundingClientRect().top, shadow: getComputedStyle(b).boxShadow, childTx: getComputedStyle(b.firstElementChild).transform }));
      await t.page.mouse.move(pbBox.x + pbBox.width / 2, pbBox.y + pbBox.height / 2);
      await t.page.mouse.down();
      const abtnActive = await passBtn.evaluate((b) => ({ top: b.getBoundingClientRect().top, shadow: getComputedStyle(b).boxShadow, childTx: getComputedStyle(b.firstElementChild).transform }));
      // Move off button before releasing so we do not open Pass confirm dialog
      await t.page.mouse.move(4, 4);
      await t.page.mouse.up();
      t.expect(Math.abs(abtnActive.top - abtnBefore.top) < 0.5, '.abtn hit box stays stationary on :active');
      t.expect(abtnActive.childTx !== 'none' && abtnActive.childTx !== abtnBefore.childTx, `.abtn child nudges on :active (${abtnActive.childTx})`);
      t.expect(abtnActive.shadow !== abtnBefore.shadow, `.abtn shows inset press shadow on :active (${abtnActive.shadow})`);
      // Under body.reduce, :active transforms are disabled (reduced-motion safe)
      await t.page.evaluate(() => { window.__G.settings.motion = 'reduce'; document.body.classList.add('reduce'); });
      await t.page.mouse.move(r0[0], r0[1]); await t.page.mouse.down();
      const rtileRed = await t.page.$eval('#rack .rtile[data-pos="0"]', (b) => getComputedStyle(b.firstChild).transform);
      await t.page.mouse.up();
      t.equal(rtileRed, 'none', '.rtile:active canvas transform disabled under reduced motion');
      await t.page.mouse.move(pbBox.x + pbBox.width / 2, pbBox.y + pbBox.height / 2); await t.page.mouse.down();
      const abtnRed = await passBtn.evaluate((b) => ({ childTx: getComputedStyle(b.firstElementChild).transform, shadow: getComputedStyle(b).boxShadow }));
      await t.page.mouse.move(4, 4); await t.page.mouse.up();
      t.equal(abtnRed.childTx, 'none', '.abtn:active child transform disabled under reduced motion');
      t.expect(abtnRed.shadow !== abtnBefore.shadow, '.abtn keeps non-vestibular press shadow under reduced motion');
      await t.page.evaluate(() => { window.__G.settings.motion = 'full'; document.body.classList.remove('reduce'); window.__G.selected = null; });
      // 2. Live rack-slot parting strictly inside #rackbar; steady d.pos0 hole once lifted toward the board (CD-WF4-06)
      const slot0 = await t.game('act', 'rackTile', 0);
      const slot4 = await t.game('act', 'rackTile', 4);
      await t.page.mouse.move(slot0[0], slot0[1]);
      await t.page.mouse.down();
      // Drag horizontally inside #rackbar to slot 4
      await t.page.mouse.move(slot4[0], slot4[1], { steps: 10 });
      await t.waitFrames(2);
      const inBar = await t.page.evaluate(() => {
        const kids = [...document.querySelector('#rack').children].filter((el) => !el.classList.contains('lifted'));
        const holeIdx = kids.findIndex((el) => el.classList.contains('rslot'));
        const parting = holeIdx >= 0 && kids[holeIdx].classList.contains('parting');
        return { holeIdx, parting, drag: window.__game.getState().drag };
      });
      t.equal(inBar.holeIdx, 4, `live rack-slot hole parted to index 4 inside #rackbar (got ${inBar.holeIdx})`);
      t.expect(inBar.parting, 'parted .rslot carries .parting indicator inside #rackbar');
      t.equal(inBar.drag && inBar.drag.rackSlot, 4, 'state exposes rackSlot=4 while inside #rackbar');
      await t.shot('w4-b17-rack-parting', { wait: false });
      // Lift toward the board: hole must return steadily to d.pos0 (0) per CD-WF4-06
      const boardMid = await t.game('act', 'screen', CENTER);
      await t.page.mouse.move(boardMid[0], boardMid[1], { steps: 10 });
      await t.waitFrames(2);
      const onBoard = await t.page.evaluate(() => {
        const kids = [...document.querySelector('#rack').children].filter((el) => !el.classList.contains('lifted'));
        const holeIdx = kids.findIndex((el) => el.classList.contains('rslot'));
        const parting = holeIdx >= 0 && kids[holeIdx].classList.contains('parting');
        return { holeIdx, parting, drag: window.__game.getState().drag };
      });
      t.equal(onBoard.holeIdx, 0, `once lifted to board, hole stays steady at d.pos0=0 per CD-WF4-06 (got ${onBoard.holeIdx})`);
      t.equal(onBoard.parting, false, 'no .parting highlight once lifted off #rackbar');
      // Move back inside #rackbar to visual slot 3 and release: tile lands at slot 3
      const slot3 = [slot0[0] + (slot4[0] - slot0[0]) * 3 / 4, slot0[1]];
      await t.page.mouse.move(slot3[0], slot3[1], { steps: 8 });
      await t.waitFrames(2);
      const beforeDropOrder = (await t.state()).order.slice();
      await t.page.mouse.up();
      await t.page.waitForFunction(() => document.querySelector('#ghost').hidden, null, { timeout: 2000 });
      const afterDrop = await t.state();
      t.equal(afterDrop.order[3], 0, `tile 0 dropped into parted slot 3 (order=${afterDrop.order.join(',')}, before=${beforeDropOrder.join(',')})`);
      // 3. Blocked from==='board' tile drop triggers oops() and smooth origin return via #ghost (instead of 1-frame snap)
      await t.game('act', 'stage', [{ l: 'S', i: CENTER }, { l: 'P', i: CENTER + 1 }]);
      const fromPt = await t.game('act', 'screen', CENTER + 1);
      const occPt = await t.game('act', 'screen', CENTER);
      await t.page.evaluate(() => { window.__vib.length = 0; });
      const sfx0 = await t.page.evaluate(() => window.__game.audioState().total);
      await t.page.mouse.move(fromPt[0], fromPt[1]);
      await t.page.mouse.down();
      await t.page.mouse.move(occPt[0], occPt[1], { steps: 8 });
      await t.waitFrames(2);
      await t.page.mouse.up();
      const midReturn = await t.page.evaluate((n0) => {
        const gh = document.querySelector('#ghost');
        const a = window.__game.audioState();
        return {
          ghostHidden: gh.hidden,
          returningCell: window.__G.returningCell,
          returnTimer: window.__G.returnTimer,
          transition: gh.style.transition,
          stagedAtOrigin: window.__G.staged.some((x) => x.i === 113),
          played: a.played.slice(-(a.total - n0)),
          vibs: window.__vib.slice(),
        };
      }, sfx0);
      t.equal(midReturn.ghostHidden, false, 'blocked board tile glides back via visible #ghost instead of 1-frame snap');
      t.equal(midReturn.returningCell, CENTER + 1, 'G.returningCell tracks the returning board square during glide');
      t.expect(midReturn.returnTimer > 0 && /transform/.test(midReturn.transition), `smooth return transition active (${midReturn.transition})`);
      t.equal(midReturn.stagedAtOrigin, true, 'staging invariant holds immediately while gliding back');
      t.expect(midReturn.played.includes('error'), `blocked board drop played error (${midReturn.played.join(',')})`);
      t.expect(midReturn.vibs.some((p) => JSON.stringify(p) === '[30,40,30]'), `blocked board drop pulsed error haptic (${JSON.stringify(midReturn.vibs)})`);
      await t.page.waitForFunction(() => document.querySelector('#ghost').hidden && window.__G.returningCell === null, null, { timeout: 2000 });
      const finalStaged = (await t.state()).staged.map((x) => x.i).sort((a, b) => a - b);
      t.equal(finalStaged.join(','), `${CENTER},${CENTER + 1}`, 'both staged tiles intact after smooth return completes');
    },
  },
];

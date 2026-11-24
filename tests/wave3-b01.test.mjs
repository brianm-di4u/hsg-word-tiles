// Wave 3, batch W3-B01: W4-S2-01, W4-P-N01, W4-P-N02, W4-S2-04.
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const normalSound = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'normal', sound: false, motion: 'full' }));
  }
};
const SEATS = [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }];
const N = 15;

async function freezeClock(t) { await t.page.clock.install(); await t.reload(); await ready(t); }
async function stopClock(t) { const now = await t.page.evaluate(() => Date.now()); await t.page.clock.pauseAt(now + 500); }

export const tests = [
  // ---------- W4-S2-01 ----------
  {
    name: 'W4-S2-01 cancelTurnTimers cancels orphaned AI clacks, stings, and yourturn on skipComputerWait and on leaving game',
    viewports: ['desktop'],
    initScript: normalSound,
    async run(t) {
      await ready(t);
      await freezeClock(t);
      await t.seed(5);
      await t.game('newGame', { seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'hard' }] });
      await t.waitIdle(8000);
      const s0 = await t.state();
      s0.game.players[1].rack = 'SPRINGX'.split('');
      await t.game('setState', { game: s0.game });
      await t.waitIdle(5000);
      await stopClock(t);

      // Human passes so Hard AI plays SPRING (multi-tile Hot Springs word -> clacks + steam/sting + yourturn timers)
      await t.game('act', 'pass');
      await t.page.clock.runFor(400);
      await t.page.waitForFunction(() => { const g = window.__game.getState(); return g.aiThinking && g.aiWait.reply; }, null, { timeout: 15000, polling: 50 });

      // 1st Space lands AI reply and schedules clacks + celebration + yourturn + G.turnWait
      await t.page.keyboard.press('Space');
      await t.page.waitForFunction(() => window.__game.getState().game.move === 2, null, { timeout: 5000, polling: 50 });
      const pendingBefore = await t.page.evaluate(() => ({
        timers: window.__G.turnTimers.size,
        turnWait: !!window.__G.turnWait,
        pulse: !!window.__G.lastPulse,
        totalSfx: window.__game.audioState().total,
      }));
      t.expect(pendingBefore.timers >= 3, 'AI play registered pending turn timers (' + pendingBefore.timers + ')');
      t.equal(pendingBefore.turnWait, true, 'G.turnWait is active');
      t.equal(pendingBefore.pulse, true, 'G.lastPulse is active');

      // 2nd Space skips AI hand-over via skipComputerWait(): must cancel all turnTimers and clear G.lastPulse
      await t.page.keyboard.press('Space');
      await t.page.waitForFunction(() => !window.__game.getState().aiWait.turn, null, { timeout: 5000, polling: 50 });
      const afterSkip = await t.page.evaluate(() => ({
        timers: window.__G.turnTimers.size,
        turnWait: !!window.__G.turnWait,
        pulse: !!window.__G.lastPulse,
        totalSfx: window.__game.audioState().total,
      }));
      t.equal(afterSkip.timers, 0, 'skipComputerWait cleared every pending turn timer');
      t.equal(afterSkip.turnWait, false, 'G.turnWait cleared');
      t.equal(afterSkip.pulse, false, 'G.lastPulse cleared');

      // Advance clock 3 seconds: ZERO orphaned clacks, stings, or yourturn may fire
      await t.page.clock.runFor(3000);
      const totalLater = await t.page.evaluate(() => window.__game.audioState().total);
      t.equal(totalLater, afterSkip.totalSfx, 'no orphaned clack/sting/yourturn cues fired after skip (' + totalLater + ' vs ' + afterSkip.totalSfx + ')');
    },
  },
  {
    name: 'W4-S2-01 click, Enter, and Space skip finishGame 900 ms overTimer straight to Game Over',
    viewports: ['desktop'],
    initScript: normalSound,
    async run(t) {
      await ready(t);
      await freezeClock(t);
      const triggerEnd = async () => {
        await t.seed(5);
        await t.game('newGame', { seats: SEATS });
        await t.waitIdle(8000);
        const st = await t.state();
        const g = st.game;
        g.board = Array(N * N).fill(null);
        g.board[111] = { l: 'C', blank: false };
        g.board[112] = { l: 'A', blank: false };
        g.board[113] = { l: 'T', blank: false };
        g.bag = []; g.move = 10; g.cur = 0;
        g.players[0].rack = ['S']; g.players[0].score = 120;
        g.players[1].rack = ['E', 'R']; g.players[1].score = 80;
        await t.game('setState', { game: g });
        await t.waitIdle(5000);
        await stopClock(t);
        t.expect((await t.game('act', 'stage', [{ i: 114, l: 'S' }])).ok, 'final S staged');
        t.expect((await t.game('act', 'play')).ok, 'final play applied');
        await t.page.clock.runFor(200);
        const hasTimer = await t.page.evaluate(() => window.__G.scene === 'game' && !!window.__G.overTimer);
        t.equal(hasTimer, true, 'finishGame scheduled 900 ms overTimer while still in game');
      };

      // 1) Enter skips straight to over without waiting 900 ms
      await triggerEnd();
      await t.page.keyboard.press('Enter');
      t.equal((await t.state()).scene, 'over', 'Enter skipped overTimer straight to over');
      t.equal(await t.page.evaluate(() => window.__G.overTimer), 0, 'overTimer cleared after Enter skip');

      // 2) Space skips straight to over
      await t.page.clock.resume();
      await triggerEnd();
      await t.page.keyboard.press('Space');
      t.equal((await t.state()).scene, 'over', 'Space skipped overTimer straight to over');

      // 3) Board click skips straight to over
      await t.page.clock.resume();
      await triggerEnd();
      const [bx, by] = await t.game('act', 'screen', 40);
      await t.page.mouse.click(bx, by);
      t.equal((await t.state()).scene, 'over', 'board click skipped overTimer straight to over');
      await t.page.clock.resume();
    },
  },

  // ---------- W4-P-N01 ----------
  {
    name: 'W4-P-N01 Pause -> Save and quit to title during an AI turn halts AI timers, cues, and save overwrites',
    viewports: ['desktop'],
    initScript: normalSound,
    async run(t) {
      await ready(t);
      await freezeClock(t);
      await t.seed(5);
      // 3-seat game (1 human + 2 AIs) so a leaked AI turn would also chain into a second AI turn
      await t.game('newGame', { seats: [
        { kind: 'human', name: 'You' },
        { kind: 'ai', persona: 'opal', level: 'easy' },
        { kind: 'ai', persona: 'hollis', level: 'medium' },
      ] });
      await t.waitIdle(8000);
      await stopClock(t);

      // Human plays so seat 1 (Opal) starts thinking
      const [m] = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', m.tiles);
      t.expect((await t.game('act', 'play')).ok, 'human played opening move');
      await t.page.clock.runFor(400);
      await t.page.waitForFunction(() => { const g = window.__game.getState(); return g.aiThinking && g.aiWait.reply; }, null, { timeout: 15000, polling: 50 });

      // Open Pause -> advance clock past 700 ms so G.aiTimer fires and parks callback in G.aiHeld
      await t.page.click('#b-menu');
      await t.page.clock.runFor(500);
      t.equal((await t.state()).aiHeld, true, 'AI reply is held in G.aiHeld while Pause is open');

      // Click Save and quit to title inside Pause
      await t.page.click('#modal [data-go="title"]');
      t.equal((await t.state()).scene, 'title', 'navigated to title');
      const snapAfterQuit = await t.page.evaluate(() => ({
        save: localStorage.getItem('hs-letters-save-v1'),
        move: window.__G.s.move,
        sfxTotal: window.__game.audioState().total,
        aiHeld: !!window.__G.aiHeld,
        aiFire: !!window.__G.aiFire,
        turnWait: !!window.__G.turnWait,
        releaseAiTimer: window.__G.releaseAiTimer,
      }));
      t.equal(snapAfterQuit.move, 1, 'saved at move 1 before AI played');
      t.equal(snapAfterQuit.aiHeld, false, 'G.aiHeld cleared on quit to title');
      t.equal(snapAfterQuit.aiFire, false, 'G.aiFire cleared on quit to title');
      t.equal(snapAfterQuit.turnWait, false, 'G.turnWait cleared on quit to title');
      t.equal(snapAfterQuit.releaseAiTimer, 0, 'releaseAiTimer cleared on quit to title');

      // Advance clock 5 seconds: zero phantom AI moves, zero cues, untouched localStorage save, still on title
      await t.page.clock.runFor(5000);
      const afterWait = await t.page.evaluate(() => ({
        scene: window.__G.scene,
        save: localStorage.getItem('hs-letters-save-v1'),
        move: window.__G.s.move,
        sfxTotal: window.__game.audioState().total,
      }));
      t.equal(afterWait.scene, 'title', 'stayed on title');
      t.equal(afterWait.move, 1, 'zero phantom AI moves executed off-screen');
      t.equal(afterWait.sfxTotal, snapAfterQuit.sfxTotal, 'zero off-screen audio cues fired on title');
      t.equal(afterWait.save, snapAfterQuit.save, 'saved game in localStorage was not overwritten');
      await t.page.clock.resume();
    },
  },
  {
    name: 'W4-P-N01 Pause -> Settings during an AI turn holds AI cleanly off-screen and resumes only on returning to game',
    viewports: ['desktop'],
    initScript: normalSound,
    async run(t) {
      await ready(t);
      await freezeClock(t);
      await t.seed(5);
      await t.game('newGame', { seats: SEATS });
      await t.waitIdle(8000);
      await stopClock(t);

      const [m] = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', m.tiles);
      t.expect((await t.game('act', 'play')).ok, 'human played opening move');
      await t.page.clock.runFor(400);
      await t.page.waitForFunction(() => { const g = window.__game.getState(); return g.aiThinking && g.aiWait.reply; }, null, { timeout: 15000, polling: 50 });

      // Open Pause -> go to Settings while AI reply is pending
      await t.page.click('#b-menu');
      await t.page.click('#modal [data-go="settings"]');
      t.equal((await t.state()).scene, 'settings', 'entered Settings sheet from Pause');
      const snap = await t.page.evaluate(() => ({
        move: window.__G.s.move,
        sfxTotal: window.__game.audioState().total,
        save: localStorage.getItem('hs-letters-save-v1'),
        aiHeld: !!window.__G.aiHeld,
      }));
      t.equal(snap.aiHeld, true, 'AI reply held while on Settings');

      // Change a setting (re-renders Settings via showScene('settings')) and advance clock 4 seconds
      await t.page.click('[data-set="theme"][data-val="dark"]');
      await t.page.clock.runFor(4000);
      const stillOnSettings = await t.page.evaluate(() => ({
        scene: window.__G.scene,
        move: window.__G.s.move,
        sfxTotal: window.__game.audioState().total,
        save: localStorage.getItem('hs-letters-save-v1'),
        aiHeld: !!window.__G.aiHeld,
      }));
      t.equal(stillOnSettings.scene, 'settings', 'still on Settings');
      t.equal(stillOnSettings.move, snap.move, 'AI did not execute while on Settings');
      t.equal(stillOnSettings.sfxTotal, snap.sfxTotal, 'zero gameplay audio fired while on Settings');
      t.equal(stillOnSettings.save, snap.save, 'save was not mutated while on Settings');
      t.equal(stillOnSettings.aiHeld, true, 'held AI callback survived Settings re-render');

      // Click Back to return to game: held AI resumes cleanly and completes its turn
      await t.page.click('#screen [data-back]');
      t.equal((await t.state()).scene, 'game', 'returned to game');
      await t.page.clock.runFor(2500);
      const resumed = await t.state();
      t.equal(resumed.game.move, 2, 'held AI turn resumed and completed after returning to game');
      t.equal(resumed.game.cur, 0, 'turn handed back to human');
      await t.page.clock.resume();
    },
  },

  // ---------- W4-P-N02 ----------
  {
    name: 'W4-P-N02 Computer speed Instant bypasses AI flight/hand-over wait and Fast scales stagger/drop/beat ~0.45x',
    viewports: ['desktop'],
    initScript: normalSound,
    async run(t) {
      await ready(t);
      await freezeClock(t);

      const measureSpeed = async (speed) => {
        await t.page.evaluate((sp) => { window.__G.settings.ai = sp; }, speed);
        await t.seed(5);
        await t.game('newGame', { seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'hard' }] });
        await t.waitIdle(8000);
        const s0 = await t.state();
        s0.game.players[1].rack = 'SPRINGX'.split('');
        await t.game('setState', { game: s0.game });
        await t.waitIdle(5000);
        await stopClock(t);

        const sfxBefore = await t.page.evaluate(() => window.__game.audioState().played.length);
        await t.game('act', 'pass');
        // Human pass sets 150 ms turnWait -> startTurn -> scheduleAi
        await t.page.clock.runFor(200);
        // Wait for worker reply to arrive
        await t.page.waitForFunction(() => {
          const g = window.__game.getState();
          return g.game.move >= 2 || (g.aiThinking && g.aiWait.reply);
        }, null, { timeout: 15000, polling: 50 });

        // Advance past thinking delay (normal 700, fast 250, instant 0) so AI afterAction runs, but NOT past flight
        const thinkAdvance = speed === 'normal' ? 750 : speed === 'fast' ? 280 : 10;
        await t.page.clock.runFor(thinkAdvance);
        await t.page.waitForFunction(() => window.__game.getState().game.move === 2, null, { timeout: 5000, polling: 50 });

        const snap = await t.page.evaluate((prevLen) => {
          const G = window.__G, now = performance.now();
          const anims = [...G.anim.values()];
          const stagger = anims.length >= 2 ? Math.round(anims[1].t0 - anims[0].t0) : 0;
          const dur = anims.length ? anims[0].dur : 0;
          const played = window.__game.audioState().played.slice(prevLen);
          const aiEntry = G.s.log[G.s.log.length - 1];
          return {
            tiles: aiEntry.tiles ? aiEntry.tiles.length : 0,
            animCount: G.anim.size,
            stagger,
            dur,
            busyRemain: Math.max(0, Math.round(G.busyUntil - now)),
            played,
          };
        }, sfxBefore);
        await t.page.clock.resume();
        return snap;
      };

      const inst = await measureSpeed('instant');
      const fast = await measureSpeed('fast');
      const norm = await measureSpeed('normal');

      t.expect(inst.tiles >= 4, 'AI played a multi-tile word (' + inst.tiles + ' tiles)');
      // Instant: 0 flying tiles, 0 ms hand-over lockout, single condensed settle clack
      t.equal(inst.animCount, 0, 'Instant bypasses AI tile flight animation');
      t.equal(inst.busyRemain, 0, 'Instant has 0 ms hand-over lockout (got ' + inst.busyRemain + ' ms)');
      t.equal(inst.played.filter((x) => x === 'place').length, 1, 'Instant fires one crisp condensed settle clack');

      // Fast: ~0.45x stagger (40 ms), drop (160 ms), and total hand-over lockout well under Normal
      t.equal(fast.animCount, fast.tiles, 'Fast animates all AI tiles');
      t.equal(fast.stagger, 40, 'Fast uses 40 ms stagger');
      t.equal(fast.dur, 160, 'Fast uses 160 ms drop duration');
      t.expect(fast.busyRemain > 0 && fast.busyRemain <= Math.round(norm.busyRemain * 0.55),
        `Fast lockout (${fast.busyRemain} ms) scales to ~0.45x of Normal (${norm.busyRemain} ms)`);

      // Normal: full 90 ms stagger, 320 ms drop, full lockout
      t.equal(norm.stagger, 90, 'Normal preserves 90 ms stagger');
      t.equal(norm.dur, 320, 'Normal preserves 320 ms drop duration');
      t.expect(norm.busyRemain >= 700, 'Normal preserves full drop + hand-over beat (' + norm.busyRemain + ' ms)');
    },
  },

  // ---------- W4-S2-04 ----------
  {
    name: 'W4-S2-04 pinch-zoom defers layout() to pinch end, preserves anchor without center-snap jump, and guards d0 >= 10',
    viewports: ['mobile'],
    initScript: () => {
      window.__TEST_TIPS__ = false;
      if (!localStorage.getItem('hs-letters-settings-v1')) {
        localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false }));
      }
    },
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 3, seats: SEATS });
      await t.waitIdle(8000);

      // Start zoomed at 1.4x so clamping does not constrain off-center pinch midpoints
      await t.game('act', 'zoom', 1.4, 7.88, 7.88);
      await t.waitFrames(2);

      // Choose an off-center target cell (row 5, col 5 -> index 80) and pinch around its screen position
      const anchorCell = 5 * N + 5;
      const [ax, ay] = await t.game('act', 'screen', anchorCell);
      const cdp = await t.page.context().newCDPSession(t.page);
      const send = (type, pts) => cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: pts.map(([id, x, y]) => ({ id, x, y, radiusX: 4, radiusY: 4, force: 1 })),
      });

      const layoutsBefore = await t.page.evaluate(() => window.__G.layoutCount || 0);
      // 1) Off-center two-finger pinch spreading outward around (ax, ay) over 10 steps
      const dx0 = 28;
      await send('touchStart', [[1, ax - dx0, ay]]);
      await send('touchStart', [[1, ax - dx0, ay], [2, ax + dx0, ay]]);
      for (let k = 1; k <= 10; k++) {
        const dx = dx0 + k * 4;
        await send('touchMove', [[1, ax - dx, ay], [2, ax + dx, ay]]);
      }
      await t.waitFrames(2);

      const midPinch = await t.page.evaluate((cell) => ({
        layouts: window.__G.layoutCount || 0,
        zoom: window.__game.getState().view.zoom,
        zoomBtnMode: document.querySelector('#b-zoomin').dataset.mode,
      }), anchorCell);
      const [axAfter, ayAfter] = await t.game('act', 'screen', anchorCell);
      const anchorDrift = Math.hypot(axAfter - ax, ayAfter - ay);

      t.equal(midPinch.layouts, layoutsBefore, 'zero layout() calls during 10 pinch pointermove frames (' + midPinch.layouts + ' vs ' + layoutsBefore + ')');
      t.expect(midPinch.zoom > 1.8 && midPinch.zoom <= 2.4, 'pinch zoomed smoothly (' + midPinch.zoom.toFixed(2) + ')');
      t.equal(midPinch.zoomBtnMode, 'out', 'syncZoomBtn updated #b-zoomin during pinch');
      t.expect(anchorDrift <= 4.0, 'anchor cell stayed pinned under two-finger midpoint (drift ' + anchorDrift.toFixed(2) + ' px, no center-snap jump)');

      // Release fingers -> layout() runs once at pinch end
      await send('touchEnd', []);
      await t.waitFrames(2);
      const layoutsAfter = await t.page.evaluate(() => window.__G.layoutCount || 0);
      t.equal(layoutsAfter, layoutsBefore + 1, 'layout() deferred and called once at pinch end');

      // 2) Zero-distance same-pixel pinch (d0 === 0 before clamping): must NOT produce NaN/Infinity
      const [cx, cy] = await t.game('act', 'screen', 112);
      await send('touchStart', [[3, cx, cy]]);
      await send('touchStart', [[3, cx, cy], [4, cx, cy]]);
      const d0Val = await t.page.evaluate(() => window.__G.pinch && window.__G.pinch.d0);
      t.expect(d0Val >= 10, 'd0 clamped to >= 10 on zero-distance pinch (' + d0Val + ')');
      await send('touchMove', [[3, cx - 15, cy], [4, cx + 15, cy]]);
      await t.waitFrames(2);
      const vZero = (await t.state()).view;
      t.expect(Number.isFinite(vZero.zoom) && vZero.zoom >= 1 && vZero.zoom <= 2.4, 'zoom stays finite after zero-distance start (' + vZero.zoom + ')');
      t.expect(Number.isFinite(vZero.cx) && Number.isFinite(vZero.cy), 'view center stays finite (' + vZero.cx + ', ' + vZero.cy + ')');
      await send('touchEnd', []);
      await cdp.detach();
    },
  },
];

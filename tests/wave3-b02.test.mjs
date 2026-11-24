// Wave 3, batch W3-B02: W4-S5-13, W4-S3-01, W4-S3-02, W4-S3-03 (VFX readability, timing, grammar & single-tier escalation).
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const normalMode = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'normal', sound: false, motion: 'full' }));
  }
};
const CENTER = 112;
const N = 15;
const across = (word, at = CENTER - 2) => [...word].map((l, k) => ({ i: at + k, l }));

async function freezeClock(t) { await t.page.clock.install(); await t.reload(); await ready(t); }
async function stopClock(t) { const now = await t.page.evaluate(() => Date.now()); await t.page.clock.pauseAt(now + 500); }

export const tests = [
  // ---------- W4-S5-13 ----------
  {
    name: 'W4-S5-13 AI play VFX (steam, goldSweep, scorePop) hold until tile touchdown and snap immediately on skipComputerWait',
    viewports: ['desktop'],
    initScript: normalMode,
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

      // 1) Normal AI touchdown: human passes -> Hard AI plays SPRING (6 tiles -> landed ~740 ms)
      await t.game('act', 'pass');
      await t.page.clock.runFor(400);
      await t.page.waitForFunction(() => { const g = window.__game.getState(); return g.aiThinking && g.aiWait.reply; }, null, { timeout: 15000, polling: 50 });
      // Land the AI reply (start drop flight)
      await t.page.keyboard.press('Space');
      await t.page.waitForFunction(() => window.__game.getState().game.move === 2, null, { timeout: 5000, polling: 50 });

      // At t = 0 (tiles still falling): ZERO premature sweeps, pops, or burst clouds on the AI's tiles
      // (CENTER may already hold an ambient Display Spring wisp emitted before the move; check non-CENTER AI cells)
      const midFlight = await t.page.evaluate(() => {
        const st = window.__game.getState();
        const aiEntry = st.game.log[st.game.log.length - 1];
        const aiCells = new Set(aiEntry.tiles.map((x) => x.i));
        const nonCenterAi = new Set([...aiCells].filter((i) => i !== 112));
        return {
          sweeps: st.sweeps,
          pops: document.querySelectorAll('.pop').length,
          burstOnNonCenterTiles: st.wisps.filter((i) => nonCenterAi.has(i)).length,
          pendingVfx: !!window.__G.pendingVfx,
          animSize: window.__G.anim.size,
        };
      });
      t.equal(midFlight.sweeps, 0, 'no premature goldSweep before AI tiles land');
      t.equal(midFlight.pops, 0, 'no premature scorePop before AI tiles land');
      t.equal(midFlight.burstOnNonCenterTiles, 0, 'no premature steamBurst on empty marble before AI tiles land');
      t.equal(midFlight.pendingVfx, true, 'visual celebration is queued in pendingVfx');
      t.expect(midFlight.animSize > 0, 'AI tiles are still in flight (' + midFlight.animSize + ')');

      // Advance clock past touchdown (~760 ms): goldSweep, steamBurst, and scorePop fire together
      await t.page.clock.runFor(820);
      const atLanding = await t.page.evaluate(() => {
        const st = window.__game.getState();
        const aiEntry = st.game.log[st.game.log.length - 1];
        const nonCenterAi = new Set(aiEntry.tiles.map((x) => x.i).filter((i) => i !== 112));
        return {
          sweeps: st.sweeps,
          pops: document.querySelectorAll('.pop').length,
          burstOnNonCenterTiles: st.wisps.filter((i) => nonCenterAi.has(i)).length,
          pendingVfx: !!window.__G.pendingVfx,
        };
      });
      t.expect(atLanding.sweeps >= 1, 'goldSweep fires at AI tile touchdown (' + atLanding.sweeps + ')');
      t.equal(atLanding.pops, 1, 'scorePop fires at AI tile touchdown');
      t.expect(atLanding.burstOnNonCenterTiles > 0, 'steamBurst fires on landed tiles (' + atLanding.burstOnNonCenterTiles + ')');
      t.equal(atLanding.pendingVfx, false, 'pendingVfx cleared after touchdown');

      // 2) Skip mid-flight via Space (skipComputerWait): snaps visual celebration immediately with zero orphaned SFX
      await t.page.clock.resume();
      await t.game('newGame', { seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'hard' }] });
      await t.waitIdle(8000);
      const s1 = await t.state();
      s1.game.players[1].rack = 'SPRINGX'.split('');
      await t.game('setState', { game: s1.game });
      await t.waitIdle(5000);
      await stopClock(t);

      await t.game('act', 'pass');
      await t.page.clock.runFor(400);
      await t.page.waitForFunction(() => { const g = window.__game.getState(); return g.aiThinking && g.aiWait.reply; }, null, { timeout: 15000, polling: 50 });
      await t.page.keyboard.press('Space');
      await t.page.waitForFunction(() => window.__game.getState().game.move === 2, null, { timeout: 5000, polling: 50 });
      t.equal(await t.page.evaluate(() => document.querySelectorAll('.pop').length), 0, 'no pop yet before skip');

      // Second Space invokes skipComputerWait(): tiles snap down AND visual celebration snaps immediately
      await t.page.keyboard.press('Space');
      await t.page.waitForFunction(() => !window.__game.getState().aiWait.turn, null, { timeout: 5000, polling: 50 });
      const afterSkip = await t.page.evaluate(() => ({
        sweeps: window.__game.getState().sweeps,
        pops: document.querySelectorAll('.pop').length,
        pendingVfx: !!window.__G.pendingVfx,
        sfxTotal: window.__game.audioState().total,
      }));
      t.expect(afterSkip.sweeps >= 1, 'skipComputerWait snapped goldSweep immediately (' + afterSkip.sweeps + ')');
      t.equal(afterSkip.pops, 1, 'skipComputerWait snapped scorePop immediately');
      t.equal(afterSkip.pendingVfx, false, 'pendingVfx cleared after skip');

      await t.page.clock.runFor(2500);
      const laterSfx = await t.page.evaluate(() => window.__game.audioState().total);
      t.equal(laterSfx, afterSkip.sfxTotal, 'zero orphaned audio cues after skip');
      await t.page.clock.resume();
    },
  },
  {
    name: 'W4-S5-13 goldSweep covers all cells of the full scored Hot Springs word, not only newly placed tiles',
    viewports: ['desktop'],
    initScript: normalMode,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 3, seats: [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }] });
      await t.waitIdle(5000);
      await t.game('act', 'reveal');
      // Place SPRING already on the board, then extend with a single tile S to form SPRINGS (7 cells)
      const st = await t.state();
      const word = 'SPRING';
      for (let k = 0; k < word.length; k++) st.game.board[CENTER - 2 + k] = { l: word[k], blank: false, p: 1, t: 0 };
      st.game.move = 1; st.game.cur = 0;
      st.game.players[0].rack = 'SXXXXXX'.split('');
      await t.game('setState', { game: st.game });
      await t.waitIdle(5000);
      await t.game('act', 'freezeFx', 0);

      await t.game('act', 'stage', [{ i: CENTER + 4, l: 'S' }]);
      const r = await t.game('act', 'play');
      t.expect(r.ok, 'extended SPRING -> SPRINGS with 1 tile');
      const swept = await t.page.evaluate(() => {
        const g = window.__game.getState();
        return { sweeps: g.sweeps, sweepCells: g.sweepCells };
      });
      t.equal(swept.sweeps, 1, 'one goldSweep started');
      t.equal(swept.sweepCells.length, 7, 'goldSweep covers all 7 cells of SPRINGS (' + swept.sweepCells.join(',') + ')');
      t.expect(swept.sweepCells.includes(CENTER) && swept.sweepCells.includes(CENTER + 4), 'includes both pre-existing CENTER and newly placed S');
      // Freeze halfway along the word (at CENTER, cell index 2 of 7, which was NOT a newly placed tile)
      const sweepAt = (await t.state()).sweepAt;
      await t.game('act', 'freezeFx', sweepAt + 180);
      await t.waitFrames(3);
      const centerGold = await t.page.evaluate(async (cell) => {
        const cv = document.getElementById('fx');
        const [x, y] = await window.__game.act('cell', cell, 0.24);
        const [x2] = await window.__game.act('cell', cell + 1, 0.24);
        const cellPx = Math.abs(x2 - x);
        const k = cv.width / cv.clientWidth;
        const r = Math.round(cellPx * 0.55 * k);
        const d = cv.getContext('2d').getImageData(Math.round(x * k) - r, Math.round(y * k) - r, 2 * r, 2 * r).data;
        let n = 0;
        for (let j = 0; j < d.length; j += 4) if (d[j + 3] > 35 && d[j] > 220 && d[j + 1] > 185 && d[j] - d[j + 2] > 45) n++;
        return n;
      }, CENTER);
      t.expect(centerGold >= 30, `goldSweep lit existing tile CENTER of SPRINGS (${centerGold} gold px)`);
      await t.game('act', 'freezeFx', null);
    },
  },
];

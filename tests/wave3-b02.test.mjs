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
  // ---------- W4-S3-01 ----------
  {
    name: 'W4-S3-01 #fx uses pre-baked stamps (zero per-frame createRadialGradient), typed 3-Read flashes/sparks, MAX_PARTICLES<=48, and halts idle RAF',
    viewports: ['desktop'],
    initScript: () => {
      window.__TEST_TIPS__ = false;
      if (!localStorage.getItem('hs-letters-settings-v1')) {
        localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, motion: 'full' }));
      }
      window.__fxGradCalls = 0;
      const orig = CanvasRenderingContext2D.prototype.createRadialGradient;
      CanvasRenderingContext2D.prototype.createRadialGradient = function (...args) {
        if (this.canvas && this.canvas.id === 'fx') window.__fxGradCalls++;
        return orig.apply(this, args);
      };
    },
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 3, seats: [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }] });
      await t.waitIdle(5000);
      await t.game('act', 'reveal');

      // 1) Play a non-themed big play (<7 tiles, score >= SCORE_BIG=45) -> Primary 'star' flash + capped 12..18 velocity-damped sparks
      const s0 = await t.state();
      // Place anchor tile at row 5 col 5 (80) so JAZZY across row 4 cols 5..9 hits Steam 2W (row 4 col 8 = 68) -> >= 60 pts, 5 tiles
      s0.game.board[CENTER] = { l: 'A', blank: false, p: 1, t: 0 };
      s0.game.board[80] = { l: 'A', blank: false, p: 1, t: 0 };
      s0.game.move = 1; s0.game.cur = 0;
      s0.game.players[0].rack = 'JAZZYAA'.split('');
      await t.game('setState', { game: s0.game });
      await t.waitIdle(5000);
      await t.page.evaluate(() => { window.__fxGradCalls = 0; });
      // Find any valid non-themed, non-Full-Soak play scoring >= 45 from a Steam 2W square
      const bigMove = await t.page.evaluate(async () => {
        const ms = await window.__game.act('moves', 60);
        return ms.find((m) => m.tiles.length < 7 && m.score >= 45 && !m.words.some((w) => w.themed));
      });
      t.expect(!!bigMove, 'found non-themed <7-tile big play >= 45 pts');
      await t.game('act', 'stage', bigMove.tiles);
      const rBig = await t.game('act', 'play');
      t.expect(rBig.ok, `big everyday play (${bigMove.score} pts, ${bigMove.tiles.length} tiles) succeeded`);
      const immBig = await t.page.evaluate(() => {
        const g = window.__game.getState();
        return { fx: g.fx || null, sparks: g.sparks };
      });
      await t.waitFrames(6);
      const afterBig = await t.page.evaluate(() => ({
        gradCalls: window.__fxGradCalls,
        stamps: !!(window.__game.getState().fx && window.__game.getState().fx.stamps),
      }));
      t.equal(afterBig.gradCalls, 0, 'zero per-frame createRadialGradient calls on #fx during sparks & flashes');
      t.equal(afterBig.stamps, true, 'pre-baked 64x64 FX stamps initialized');
      t.expect(!!immBig.fx && immBig.fx.maxParts === 48, 'MAX_PARTICLES is 48');
      t.expect(!!immBig.fx && immBig.fx.parts <= 48, `active particles <= 48 (${immBig.fx && immBig.fx.parts})`);
      t.expect(!!immBig.fx && immBig.fx.flashShapes.includes('star'), `Primary Read star flash emitted (${immBig.fx && immBig.fx.flashShapes.join(',')})`);
      t.expect(immBig.sparks >= 12 && immBig.sparks <= 18, `regular big play caps sparks at 12..18 (${immBig.sparks})`);

      // 2) Play a Hot Springs themed word -> Primary 'ribbon' flash + curled steam + goldSweep, zero per-frame gradients on #fx
      await t.game('newGame', { seed: 3, seats: [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }] });
      await t.waitIdle(5000);
      await t.game('act', 'reveal');
      const s1 = await t.state();
      s1.game.players[0].rack = 'SPRINGE'.split('');
      await t.game('setState', { game: s1.game });
      await t.waitIdle(5000);
      await t.page.evaluate(() => { window.__fxGradCalls = 0; });
      await t.game('act', 'stage', across('SPRING'));
      t.expect((await t.game('act', 'play')).ok, 'SPRING played');
      const themeFx = await t.page.evaluate(() => window.__game.getState().fx);
      t.expect(themeFx.flashShapes.includes('ribbon'), `Primary Read thermal ribbon flash emitted (${themeFx.flashShapes.join(',')})`);
      t.expect(themeFx.steamKinds > 0 && themeFx.parts <= 48, `curled steam ribbons emitted within <=48 cap (${themeFx.steamKinds}/${themeFx.parts})`);
      await t.waitFrames(6);
      t.equal(await t.page.evaluate(() => window.__fxGradCalls), 0, 'zero per-frame createRadialGradient calls on #fx during steam & sweep');

      // 3) Cover Display Spring and all 8 Bathhouse Row squares -> idle steamLoop halts RAF once active effects finish
      await t.game('newGame', { seed: 3, seats: [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }] });
      await t.waitIdle(5000);
      const s2 = await t.state();
      for (const idx of [112, 8, 9, 10, 11, 213, 214, 215, 216, 120, 135, 150, 165, 134, 149, 164, 179]) {
        if (idx < 225) s2.game.board[idx] = { l: 'A', blank: false, p: 0, t: 0 };
      }
      // Cover every B cell dynamically from layout
      await t.game('setState', { game: s2.game });
      await t.page.evaluate(() => {
        const st = window.__G.s;
        for (let i = 0; i < 225; i++) if (!st.board[i]) st.board[i] = { l: 'A', blank: false, p: 0, t: 0 };
      });
      await t.page.waitForFunction(() => !window.__game.getState().fx.on && window.__game.getState().fx.parts === 0, null, { timeout: 6000 });
      t.equal((await t.state()).fx.on, false, 'steamLoop RAF halts cleanly when all wisp cells are covered and no effects run');
    },
  },
  // ---------- W4-S3-02 ----------
  {
    name: 'W4-S3-02 goldSweep preserves 100% clear letter center, multi-themed steamBurst deduplicates & fades near drag, and .pop dark-espresso pill prevents collisions',
    viewports: ['desktop'],
    initScript: normalMode,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 3, seats: [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }] });
      await t.waitIdle(5000);
      await t.game('act', 'reveal');

      // 1) Play SPRING -> verify goldSweep lights tile perimeter/bevel at 3D lift while keeping center letter crown clear (alpha <= 10)
      const s0 = await t.state();
      s0.game.players[0].rack = 'SPRINGE'.split('');
      await t.game('setState', { game: s0.game });
      await t.waitIdle(5000);
      await t.game('act', 'freezeFx', 0);
      await t.game('act', 'stage', across('SPRING'));
      t.expect((await t.game('act', 'play')).ok, 'SPRING played');
      const swAt = (await t.state()).sweepAt;
      await t.game('act', 'freezeFx', swAt + 120);
      await t.waitFrames(3);
      const legibility = await t.page.evaluate(async (cell) => {
        const cv = document.getElementById('fx'), ctx = cv.getContext('2d'), k = cv.width / cv.clientWidth;
        const [x, y] = await window.__game.act('cell', cell, 0.24);
        const [x2] = await window.__game.act('cell', cell + 1, 0.24);
        const c = Math.abs(x2 - x);
        // Inner center crown [+-0.18*c]: must remain unobstructed (zero opaque yellow face wash over black ink)
        const cr = Math.max(2, Math.round(0.18 * c * k));
        const cd = ctx.getImageData(Math.round(x * k) - cr, Math.round(y * k) - cr, 2 * cr, 2 * cr).data;
        let centerMaxA = 0, centerGold = 0;
        for (let j = 0; j < cd.length; j += 4) {
          if (cd[j + 3] > centerMaxA) centerMaxA = cd[j + 3];
          if (cd[j + 3] > 35 && cd[j] > 220 && cd[j + 1] > 185 && cd[j] - cd[j + 2] > 45) centerGold++;
        }
        // Perimeter ring [0.38..0.54*c]: must carry crisp brass/gold rim pixels
        const pr = Math.round(0.55 * c * k);
        const pd = ctx.getImageData(Math.round(x * k) - pr, Math.round(y * k) - pr, 2 * pr, 2 * pr).data;
        let rimGold = 0;
        for (let j = 0; j < pd.length; j += 4) {
          if (pd[j + 3] > 40 && pd[j] >= 250 && pd[j + 1] >= 215 && pd[j + 2] <= 135) rimGold++;
        }
        return { centerMaxA, centerGold, rimGold };
      }, CENTER - 2);
      t.equal(legibility.centerGold, 0, `goldSweep puts 0 opaque gold pixels on center letter crown (maxA=${legibility.centerMaxA})`);
      t.expect(legibility.rimGold >= 40, `goldSweep strokes bright brass rim around bevel (${legibility.rimGold} px)`);
      await t.game('act', 'reveal');
      await t.waitFrames(2);
      await t.shot('w3-b02-gold-rim-sweep', { wait: false });

      // 2) Verify .pop uses dark-espresso pill badge (>= 7:1 contrast) and consecutive plays never collide into '+2214'
      const popStyle = await t.page.evaluate(() => {
        const el = document.querySelector('.pop');
        if (!el) return null;
        const cs = getComputedStyle(el);
        return { bg: cs.backgroundColor, color: cs.color, border: cs.borderTopColor, radius: parseFloat(cs.borderTopLeftRadius), count: document.querySelectorAll('.pop').length };
      });
      t.expect(!!popStyle && /rgba?\(24,\s*16,\s*10/.test(popStyle.bg), `dark-espresso .pop pill bg (${popStyle && popStyle.bg})`);
      t.expect(popStyle.radius >= 20, `pill border-radius (${popStyle.radius}px)`);

      // Immediately play a second word while first .pop is still alive -> only 1 .pop in DOM (no '+2214' overlap)
      await t.game('act', 'reveal');
      const s1 = await t.state();
      s1.game.players[1].rack = 'SPATUBX'.split('');
      await t.game('setState', { game: s1.game });
      await t.game('act', 'stage', [{ i: CENTER - 2 + N, l: 'P' }, { i: CENTER - 2 + 2 * N, l: 'A' }]);
      t.expect((await t.game('act', 'play')).ok, 'second play SPA succeeded immediately');
      t.equal(await t.page.locator('#boardwrap .pop').count(), 1, 'prior .pop cleared on new play (zero +2214 collision)');

      // 3) Multi-themed play (2 Hot Springs words at once: SPA across + TUB down sharing no extra double-spawn):
      // steamBurst hoisted outside loop -> capped <= 3 puffs per unique themed cell and alpha <= 0.22
      await t.game('act', 'freezeFx', null);
      await t.game('newGame', { seed: 3, seats: [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }] });
      await t.waitIdle(5000);
      await t.game('act', 'reveal');
      const s2 = await t.state();
      // Place BA on row 7 cols 6-7, and S on row 6 col 8 so playing TH on row 7 cols 8-9 forms BATH (themed) AND ST (no) — better:
      // Place S(row6,col7) P(row7,col7) and T(row8,col6) U(row8,col7): play A(row8,col7)? No, place S(112-N), P(112), and TU on 112+N-2, 112+N-1?
      // Easiest guaranteed 2-themed play: place SP at 112-1, 112 and TU at 112+N-2, 112+N-1; wait: S-P-A across row 7 and T-U-B?
      // Place S(row6,col7=97) P(row7,col7=112), and T(row8,col5=125) U(row8,col6=126), play A(row8,col7=127) -> SPA down (97,112,127) & TUA (not word).
      // Instead: S(97) P(112), and B(125) A(126) T(127) H(128)? No, SPA (97,112,127) & TUB: place T(111) U(112)... wait:
      // SPA (across: 111,112,113) + TUB (down: 112-N? no T-U-B has U at 112):
      // Place T(97) U(112) on col 7, and S(125) P(126) on row 8 -> play B(127) -> TUB down (97,112,127) & SPB no.
      // Place SP(96,97) on row 6 and T(112) U(127) on col 7? No: place S(97) P(112) on col 7, and B(126) A(127)?
      // BATH (row 8: B=126, A=127, T=128, H=129) intersects SPA (col 7: S=97, P=112, A=127) at A(127)!
      // Pre-place S(97), P(112) on board, play B(126), A(127), T(128), H(129) -> forms BOTH BATH (4 cells) AND SPA (3 cells) = 6 unique cells!
      s2.game.board[CENTER - N] = { l: 'S', blank: false, p: 1, t: 0 };
      s2.game.board[CENTER] = { l: 'P', blank: false, p: 1, t: 0 };
      s2.game.move = 1; s2.game.cur = 0;
      s2.game.players[0].rack = 'BATHXXX'.split('');
      await t.game('setState', { game: s2.game });
      await t.waitIdle(5000);
      await t.game('act', 'stage', [
        { i: CENTER + N - 1, l: 'B' },
        { i: CENTER + N, l: 'A' },
        { i: CENTER + N + 1, l: 'T' },
        { i: CENTER + N + 2, l: 'H' },
      ]);
      const rMulti = await t.game('act', 'play');
      t.expect(rMulti.ok, 'multi-themed play BATH + SPA succeeded');
      const multiCheck = await t.page.evaluate(() => {
        const g = window.__game.getState();
        const entry = g.game.log[g.game.log.length - 1];
        return {
          themedCount: entry.words.filter((w) => w.themed).length,
          sweepCells: g.sweepCells,
          steamKinds: g.fx.steamKinds,
        };
      });
      t.equal(multiCheck.themedCount, 2, 'play scored 2 Hot Springs words (BATH + SPA)');
      t.equal(multiCheck.sweepCells.length, 6, `deduplicated themed cells = 6 (${multiCheck.sweepCells.join(',')})`);
      t.expect(multiCheck.steamKinds <= 18, `hoisted steamBurst did not double-spawn (${multiCheck.steamKinds} <= 18)`);

      // 4) Drag proximity fade: wait for goldSweep to end while steamBurst puffs are mid-life, then assert active drag fades them
      await t.page.waitForFunction(() => {
        const g = window.__game.getState();
        return g.sweeps === 0 && g.flashes === 0 && g.fx && g.fx.steamKinds > 0;
      }, null, { timeout: 3000 });
      const dragFade = await t.page.evaluate(async () => {
        const cv = document.getElementById('fx'), ctx = cv.getContext('2d'), k = cv.width / cv.clientWidth;
        const [x, y] = await window.__game.act('cell', 127, 0.24);
        const r = Math.round(52 * k);
        const sumAlpha = () => {
          const d = ctx.getImageData(Math.max(0, Math.round(x * k) - r), Math.max(0, Math.round(y * k) - r), 2 * r, 2 * r).data;
          let s = 0; for (let j = 3; j < d.length; j += 4) s += d[j]; return s;
        };
        const now = performance.now();
        window.__game.act('freezeFx', now);
        await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
        const before = sumAlpha();
        window.__G.drag = { active: true, bx: x, by: y };
        await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
        const during = sumAlpha();
        window.__G.drag = null;
        window.__game.act('freezeFx', null);
        return { before, during };
      });
      t.expect(dragFade.before > 0 && dragFade.during < dragFade.before * 0.72, `steam puffs fade near active drag pointer (${dragFade.before} -> ${dragFade.during})`);
    },
  },
  // ---------- W4-S3-03 ----------
  {
    name: 'W4-S3-03 single-tier VFX arbitration: themed Full Soak fires 7-tile star cascade superseding steam, 2L/3L stay quiet, 2W/3W/Row get 160ms oct glint, Featured fires claim arc',
    viewports: ['desktop'],
    initScript: normalMode,
    async run(t) {
      await ready(t);
      const twoHumans = { seed: 3, seats: [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }] };

      // 1) Tier 3 Climax: 7-tile Hot Springs Full Soak (THERMAL) -> NEVER suppressed by themed.length, supersedes dense steamBurst, stays <= 48
      await t.game('newGame', twoHumans);
      await t.waitIdle(5000);
      await t.game('act', 'reveal');
      const s1 = await t.state();
      s1.game.players[0].rack = 'THERMAL'.split('');
      await t.game('setState', { game: s1.game });
      await t.waitIdle(5000);
      await t.game('act', 'stage', across('THERMAL', CENTER - 3));
      t.expect((await t.game('act', 'play')).ok, '7-tile themed Full Soak THERMAL played');
      const fs = await t.page.evaluate(() => window.__game.getState());
      t.equal(fs.fx.lastTier, 3, 'themed Full Soak arbitrates as Tier 3 Climax');
      t.expect(fs.sparks >= 35 && fs.fx.parts <= 48, `themed Full Soak fires 7-tile brass-star cascade (${fs.sparks} sparks, ${fs.fx.parts}/${fs.fx.maxParts} parts)`);
      t.equal(fs.fx.steamKinds, 0, 'Full Soak supersedes dense steamBurst clouds instead of stacking fog');
      t.equal(fs.sweeps, 1, 'themed Full Soak keeps crisp bevel goldSweep');
      t.expect(fs.fx.flashShapes.includes('star'), 'Full Soak emits 4-point star perimeter flashes');
      await t.game('act', 'reveal');
      await t.waitFrames(2);
      await t.shot('w3-b02-themed-full-soak', { wait: false });

      // 2) Tier 2 Quiet 2L/3L rule (CD-WF4-03): covering Warm 2L (D8 = 108) with an ordinary word stays visually quiet on #fx
      await t.game('newGame', twoHumans);
      await t.waitIdle(5000);
      await t.game('act', 'reveal');
      const s2 = await t.state();
      s2.game.board[109] = { l: 'A', blank: false, p: 1, t: 0 };
      s2.game.board[110] = { l: 'T', blank: false, p: 1, t: 0 };
      s2.game.board[111] = { l: 'E', blank: false, p: 1, t: 0 };
      s2.game.board[CENTER] = { l: 'S', blank: false, p: 1, t: 0 };
      s2.game.move = 1; s2.game.cur = 0;
      s2.game.players[0].rack = 'CXXXXXX'.split('');
      await t.game('setState', { game: s2.game });
      await t.waitIdle(5000);
      await t.game('act', 'stage', [{ i: 108, l: 'C' }]); // 108 = Warm 2L ('w'), forms CATES (non-themed)
      t.expect((await t.game('act', 'play')).ok, 'ordinary play over 2L Warm square succeeded');
      const q2l = await t.page.evaluate(() => window.__game.getState());
      t.equal(q2l.fx.lastTier, 1, 'routine 2L letter spring stays Tier 1 quiet on #fx');
      t.equal(q2l.flashes, 0, 'zero #fx flashes on routine 2L square (CD-WF4-03)');
      t.equal(q2l.sparks, 0, 'zero sparks on routine 2L square');
      t.equal(q2l.fx.steamKinds, 0, 'zero steam burst on routine 2L square');

      // 3) Tier 2 Word Spring / Bathhouse Row: covering Bathhouse Row (cell 8 = 'B') gets a single 160ms 'oct' rim glint + quiet row arc
      await t.game('newGame', twoHumans);
      await t.waitIdle(5000);
      await t.game('act', 'reveal');
      const s3 = await t.state();
      s3.game.board[9] = { l: 'T', blank: false, p: 1, t: 0 };
      s3.game.move = 1; s3.game.cur = 0;
      s3.game.players[0].rack = 'AXXXXXX'.split('');
      await t.game('setState', { game: s3.game });
      await t.waitIdle(5000);
      await t.game('act', 'stage', [{ i: 8, l: 'A' }]); // 8 = Bathhouse Row ('B'), forms AT (plain word)
      t.expect((await t.game('act', 'play')).ok, 'plain play covering Bathhouse Row square 8 succeeded');
      const rowFx = await t.page.evaluate(() => window.__game.getState());
      t.equal(rowFx.fx.lastTier, 2, 'Bathhouse Row play arbitrates as Tier 2');
      t.expect(rowFx.fx.flashShapes.includes('oct') && rowFx.fx.flashDurs.includes(160), `Bathhouse Row fires crisp 160ms octagonal rim glint (${rowFx.fx.flashShapes.join(',')}/${rowFx.fx.flashDurs.join(',')})`);
      t.expect(rowFx.arcLog.some((a) => a.from === 8 && a.reason === 'row'), 'Bathhouse Row emits quiet single-wisp fog-clear arc');

      // 4) Tier 3 Climax: Featured Spring (+30) claim -> Tier 3 'featured' + rising 'claim' sightline arc + origin star flash
      await t.game('newGame', twoHumans);
      await t.waitIdle(5000);
      await t.game('act', 'reveal');
      const s4 = await t.state();
      s4.game.featured[0] = { id: 'steam', word: 'STEAM', cat: 'springs', shown: [0], by: null, at: null };
      s4.game.players[0].rack = 'STEAMXQ'.split('');
      await t.game('setState', { game: s4.game });
      await t.waitIdle(5000);
      await t.game('act', 'stage', across('STEAM'));
      t.expect((await t.game('act', 'play')).ok, 'Featured Spring STEAM claimed');
      const featFx = await t.page.evaluate(() => window.__game.getState());
      t.equal(featFx.fx.lastTier, 3, 'Featured Spring claim arbitrates as Tier 3 Climax');
      t.equal(featFx.fx.lastEvent, 'featured', 'lastEvent is featured');
      t.expect(featFx.arcLog.some((a) => a.reason === 'claim'), 'Featured Spring claim emits rising sightline claim arc');
      t.expect(featFx.fx.flashShapes.includes('star'), 'Featured Spring claim emits board origin star flash');
      t.expect(featFx.fx.parts <= 48, `total active particles <= 48 (${featFx.fx.parts})`);
      await t.game('act', 'reveal');
      await t.waitFrames(2);
      await t.shot('w3-b02-featured-claim-arc', { wait: false });
    },
  },
];

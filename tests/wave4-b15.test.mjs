// Wave 4, batch W4-B15 (WF-4 vfx_readability): W4-S3-05 (#fx pre-baked 64x64 stamps, MAX_PARTICLES=48 swap-remove pool,
// immediate steamLoop RAF halt on document.hidden/clearFx, hidden-tab startSteam/ambientSteam guard, and idle RAF halt when landmarks are covered).
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const CENTER = 112;
const across = (word, at = CENTER - 2) => [...word].map((l, k) => ({ i: at + k, l }));

const fxInstrument = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, motion: 'full' }));
  }
  window.__fxGradCalls = 0;
  const origGrad = CanvasRenderingContext2D.prototype.createRadialGradient;
  CanvasRenderingContext2D.prototype.createRadialGradient = function (...args) {
    if (this.canvas && this.canvas.id === 'fx') window.__fxGradCalls++;
    return origGrad.apply(this, args);
  };
  window.__steamRafCount = 0;
  window.__steamLastTs = -1;
  window.__steamRafPerFrame = 0;
  window.__steamRafMaxPerTick = 0;
  const origRaf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function (cb) {
    if (cb && cb.name === 'steamLoop') {
      window.__steamRafCount++;
      const wrapped = (ts) => {
        if (window.__steamLastTs === ts) window.__steamRafPerFrame++;
        else { window.__steamLastTs = ts; window.__steamRafPerFrame = 1; }
        if (window.__steamRafPerFrame > window.__steamRafMaxPerTick) window.__steamRafMaxPerTick = window.__steamRafPerFrame;
        return cb(ts);
      };
      return origRaf(wrapped);
    }
    return origRaf(cb);
  };
};

export const tests = [
  {
    name: 'W4-S3-05 #fx halts steamLoop RAF immediately on document.hidden & clearFx, blocks hidden startSteam, preserves 64x64 stamps & <=48 pool, and halts when landmarks are covered',
    viewports: ['desktop', 'mobile'],
    initScript: fxInstrument,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 5, seats: [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }] });
      await t.waitIdle(8000);
      await t.game('act', 'reveal');

      // Wait for initial ambient Display Spring wisp loop to run and initialize stamps
      await t.page.waitForFunction(() => {
        const g = window.__game.getState();
        return g.fx && g.fx.on && g.fx.stamps;
      }, null, { timeout: 5000 });

      // 1) Emulate tab hidden -> visibilitychange MUST halt steamLoop synchronously (fx.on === false) and block startSteam while hidden
      const hiddenCheck = await t.page.evaluate(async () => {
        const setHidden = (val) => Object.defineProperty(document, 'hidden', { configurable: true, get: () => val });
        const stBefore = window.__game.getState().fx;
        setHidden(true);
        document.dispatchEvent(new Event('visibilitychange'));
        const onImmediate = window.__game.getState().fx.on;
        const rafAtHide = window.__steamRafCount;

        // Trigger renderStaging() -> startSteam() via stage + recall while tab is hidden
        const rack0 = window.__G.s.players[0].rack.find((l) => l !== '?');
        await window.__game.act('stage', [{ i: 112, l: rack0 }]);
        await window.__game.act('recall');
        const onAfterStartWhileHidden = window.__game.getState().fx.on;
        const rafAfterHiddenActions = window.__steamRafCount;

        // Wait 4 browser frames while hidden -> zero steamLoop RAF scheduling
        for (let f = 0; f < 4; f++) await new Promise((r) => requestAnimationFrame(r));
        const rafAfterHiddenFrames = window.__steamRafCount;

        // Restore visibility -> steamLoop resumes cleanly
        setHidden(false);
        document.dispatchEvent(new Event('visibilitychange'));
        const onAfterResume = window.__game.getState().fx.on;
        return {
          beforeOn: stBefore.on,
          onImmediate,
          onAfterStartWhileHidden,
          rafDeltaHidden: rafAfterHiddenActions - rafAtHide,
          rafDeltaFrames: rafAfterHiddenFrames - rafAtHide,
          onAfterResume,
        };
      });
      t.equal(hiddenCheck.beforeOn, true, 'steamLoop was active before tab hide');
      t.equal(hiddenCheck.onImmediate, false, 'visibilitychange(hidden) halted steamLoop synchronously (fx.on === false)');
      t.equal(hiddenCheck.onAfterStartWhileHidden, false, 'startSteam() while document.hidden refused to arm steamLoop');
      t.equal(hiddenCheck.rafDeltaHidden, 0, 'zero steamLoop RAF scheduled by stage/recall while hidden');
      t.equal(hiddenCheck.rafDeltaFrames, 0, 'zero steamLoop RAF ticks across 4 frames while hidden');
      t.equal(hiddenCheck.onAfterResume, true, 'visibilitychange(visible) resumed steamLoop cleanly');

      // 2) Consecutive newGame() calls while steamLoop is running must cancel prior RAF inside clearFx() (at most 1 steamLoop call per frame)
      await t.page.evaluate(() => { window.__steamRafMaxPerTick = 0; window.__steamLastTs = -1; });
      for (let g = 0; g < 3; g++) {
        await t.game('newGame', { seed: 10 + g, seats: [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }] });
        await t.waitIdle(5000);
        await t.game('act', 'reveal');
      }
      await t.waitFrames(6);
      const maxPerTick = await t.page.evaluate(() => window.__steamRafMaxPerTick);
      t.equal(maxPerTick, 1, `clearFx() prevented duplicate parallel steamLoop RAF chains (max ${maxPerTick} callback/frame)`);

      // 3) Active Hot Springs burst uses pre-baked 64x64 stamps (0 per-frame createRadialGradient on #fx) and MAX_PARTICLES = 48 pool
      const s1 = await t.state();
      s1.game.players[0].rack = 'SPRINGE'.split('');
      await t.game('setState', { game: s1.game });
      await t.waitIdle(5000);
      await t.page.evaluate(() => { window.__fxGradCalls = 0; });
      await t.game('act', 'stage', across('SPRING'));
      t.expect((await t.game('act', 'play')).ok, 'SPRING played');
      await t.waitFrames(6);
      const burst = await t.page.evaluate(() => ({
        gradCalls: window.__fxGradCalls,
        fx: window.__game.getState().fx,
      }));
      t.equal(burst.gradCalls, 0, 'zero per-frame createRadialGradient calls on #fx during active burst');
      t.equal(burst.fx.stamps, true, 'pre-baked 64x64 FX stamps active');
      t.equal(burst.fx.maxParts, 48, 'MAX_PARTICLES pool cap is 48');
      t.expect(burst.fx.parts <= 48, `active particles stay <= 48 (${burst.fx.parts})`);

      // 4) Cover Display Spring + all 8 Bathhouse Row squares -> steamLoop halts RAF cleanly once active effects finish
      await t.page.evaluate(() => {
        const s = window.__G.s;
        for (let i = 0; i < 225; i++) if (!s.board[i]) s.board[i] = { l: 'A', blank: false, p: 0, t: 0 };
      });
      await t.page.waitForFunction(() => !window.__game.getState().fx.on && window.__game.getState().fx.parts === 0, null, { timeout: 6000 });
      const rafBeforeIdle = await t.page.evaluate(() => window.__steamRafCount);
      await t.waitFrames(6);
      const rafAfterIdle = await t.page.evaluate(() => window.__steamRafCount);
      t.equal(rafAfterIdle - rafBeforeIdle, 0, 'zero steamLoop RAF calls when all landmarks are covered and effects finish');
    },
  },
];

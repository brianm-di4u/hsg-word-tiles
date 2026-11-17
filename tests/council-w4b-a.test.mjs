// Wave 4 clean-up pass, batch A: K-01 (the offline sound render).
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const normal = () => { window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'normal', sound: false })); };

export const tests = [
  // ---------- K-01 ----------
  {
    name: 'K-01 a cue is measured even when the offline render has already run past the stop point',
    viewports: ['desktop'],
    initScript: normal,
    async run(t) {
      await ready(t);
      // The failure the clerk saw ("suspend(0.25) failed to suspend at frame ... earlier than the current frame") came from a render
      // that ran ahead of the stop. Here every render is given a head start of 400 ms, far past the quarter second of audio the
      // stop waits for, so the order in which renderCue asks is what decides whether the cue is measured.
      await t.page.evaluate(() => {
        const real = OfflineAudioContext.prototype.startRendering;
        OfflineAudioContext.prototype.startRendering = function () {
          const p = real.apply(this, arguments);
          const t0 = performance.now(); while (performance.now() - t0 < 400) { /* let the render thread run on */ }
          return p;
        };
      });
      for (const n of ['pick', 'chime']) {
        const r = await t.page.evaluate((name) => window.__game.act('renderSfx', name, 0.35).then((v) => ({ v }), (e) => ({ err: String(e) })), n);
        t.expect(!r.err && r.v.peak > 0.005, `${n} is rendered and audible with a render that started early (${r.err || 'peak ' + r.v.peak})`);
      }
    },
  },
];

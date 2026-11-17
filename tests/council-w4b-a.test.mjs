// Wave 4 clean-up pass, batch A: K-01 (the offline sound render), K-02 (held Enter).
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const normal = () => { window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'normal', sound: false })); };
const SEATS = [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }];

async function freezeClock(t) { await t.page.clock.install(); await t.reload(); await ready(t); }
async function stopClock(t) { const now = await t.page.evaluate(() => Date.now()); await t.page.clock.pauseAt(now + 500); }

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

  // ---------- K-02 ----------
  {
    name: 'K-02 the repeat of a held Enter does not skip the computer\'s wait, a fresh press does',
    viewports: ['desktop'],
    initScript: normal,
    async run(t) {
      await ready(t);
      await freezeClock(t);
      await t.seed(5);
      await t.game('newGame', { seats: SEATS });
      await t.waitIdle(8000);
      await stopClock(t);
      const [m] = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', m.tiles);
      t.expect((await t.game('act', 'play')).ok, 'the human move is played');
      await t.page.clock.runFor(400);
      await t.page.waitForFunction(() => { const g = window.__game.getState(); return g.aiThinking && g.aiWait.reply; }, null, { timeout: 15000, polling: 50 });
      t.equal((await t.state()).game.move, 1, 'the computer has its reply but waits its turn');
      const key = (repeat) => t.page.evaluate((r) => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', repeat: r, bubbles: true, cancelable: true })), repeat);
      for (const k of [true, true, true]) await key(k);
      t.equal((await t.state()).game.move, 1, 'three repeats of a held key leave the move waiting');
      await key(false);
      await t.page.waitForFunction(() => window.__game.getState().game.move === 2, null, { timeout: 5000, polling: 50 });
      t.equal((await t.state()).game.move, 2, 'a fresh press lets it land');
    },
  },
];

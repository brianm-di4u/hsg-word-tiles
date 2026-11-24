// Wave 3, batch W3-B07: W4-P-N03 (iOS 'interrupted' recovery, pageshow, Settings slider unlock, delayed DUCK, zero-slider scheduler pause).
import { makeAudioKit, SCORES, SCENES } from '../src/js/music.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });

export const tests = [
  {
    name: 'W4-P-N03 makeAudioKit delays music.duck(db, ms, delay) and pauses 40 Hz scheduler when both levels are 0 (Node)',
    node: true,
    async run(t) {
      const calls = [];
      const param = () => ({
        value: 1,
        cancelScheduledValues(at) { calls.push(['cancel', at]); },
        setValueAtTime() {},
        linearRampToValueAtTime() {},
        exponentialRampToValueAtTime() {},
        setTargetAtTime(v, at, tc) { calls.push(['target', +v.toFixed(4), +at.toFixed(3), tc]); },
      });
      const node = () => ({ gain: param(), frequency: param(), Q: param(), detune: param(), pan: param(), delayTime: param(), type: '', connect(d) { return d; }, disconnect() {}, start() {}, stop() {} });
      const ctx = {
        sampleRate: 22050, state: 'running', currentTime: 10,
        createGain: node, createBiquadFilter: node, createOscillator: node, createDelay: node, createStereoPanner: node,
        createBuffer: (_, len) => ({ getChannelData: () => new Float32Array(len) }),
        createBufferSource: node,
      };
      const origSetI = globalThis.setInterval, origClrI = globalThis.clearInterval;
      const active = new Set(); let nextId = 1;
      globalThis.setInterval = () => { const id = nextId++; active.add(id); return id; };
      globalThis.clearInterval = (id) => { active.delete(id); };
      try {
        const kit = makeAudioKit(ctx, node(), { seed: 3, music: 1, ambience: 1 });
        kit.start();
        kit.music.play(SCORES.table, { at: 10, fade: 0.05 });
        kit.amb.play(SCENES.bathhouse, { at: 10, fade: 0.05 });
        t.equal(active.size, 1, 'scheduler active with music and ambience on');
        calls.length = 0;
        kit.music.duck(6, 900, 0.28);
        const cancels = calls.filter((c) => c[0] === 'cancel');
        const targets = calls.filter((c) => c[0] === 'target');
        t.equal(cancels.length, 1, 'cancelScheduledValues called once');
        t.expect(Math.abs(cancels[0][1] - 10.28) < 1e-6, 'duck cancels starting at currentTime + delay (10.28, got ' + cancels[0][1] + ')');
        t.equal(targets.length, 2, 'duck schedules dip and recovery');
        t.expect(Math.abs(targets[0][2] - 10.28) < 1e-6 && targets[0][1] < 0.6, 'duck dip starts at t=10.28 (' + JSON.stringify(targets[0]) + ')');
        t.expect(Math.abs(targets[1][2] - 11.18) < 1e-6 && targets[1][1] === 1, 'duck recovery starts at t=11.18 (' + JSON.stringify(targets[1]) + ')');

        // Zero-level sliders pause the 40 Hz scheduler (Ruling 10)
        kit.music.level(0);
        t.equal(active.size, 1, 'still ticks while ambience level > 0');
        kit.amb.level(0);
        t.equal(active.size, 0, 'scheduler pauses when both music and ambience levels are 0');
        t.equal(kit.ticking, false, 'kit.ticking is false at 0/0 levels');
        kit.music.level(1);
        t.equal(active.size, 1, 'scheduler resumes when music level rises above 0');
        t.equal(kit.ticking, true, 'kit.ticking is true again');
        kit.stop();
      } finally {
        globalThis.setInterval = origSetI;
        globalThis.clearInterval = origClrI;
      }
    },
  },
  {
    name: 'W4-P-N03 iOS interrupted AudioContext recovers on gesture, visibilitychange, and pageshow; Settings sliders unlock and pause at 0',
    viewports: ['desktop'],
    async run(t) {
      await ready(t);
      // 1. Fresh visit: navigate straight to Settings via __game.scene (no prior unlock gesture) and drag Volume slider -> unlocks AudioContext!
      await t.game('scene', 'settings');
      t.equal((await t.game('audioState')).ctx, null, 'no AudioContext before slider interaction');
      await t.page.evaluate(() => {
        const r = document.querySelector('[data-vol]');
        r.value = '0.5';
        r.dispatchEvent(new Event('input', { bubbles: true }));
        r.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await t.page.waitForFunction(() => window.__game.audioState().ctx === 'running', null, { timeout: 5000 });
      t.equal((await t.game('audioState')).ctx, 'running', 'Settings slider unlocks AudioContext on a fresh visit');
      t.equal((await t.game('audioState')).ticking, true, 'music scheduler ticks at non-zero slider');

      // 2. Dragging Music level to 0 pauses the 40 Hz scheduler; dragging back restarts it (Ruling 10)
      await t.page.evaluate(() => {
        const r = document.querySelector('[data-musicvol]');
        r.value = '0';
        r.dispatchEvent(new Event('input', { bubbles: true }));
      });
      t.equal((await t.game('audioState')).ticking, false, '40 Hz scheduler pauses when musicVol is 0');
      await t.page.evaluate(() => {
        const r = document.querySelector('[data-musicvol]');
        r.value = '1';
        r.dispatchEvent(new Event('input', { bubbles: true }));
      });
      t.equal((await t.game('audioState')).ticking, true, '40 Hz scheduler restarts when musicVol > 0');

      // 3. Simulate iOS WebKit AudioContext state === 'interrupted' and verify recovery via unlock(), visibilitychange, and pageshow
      const rec = await t.page.evaluate(() => {
        let resumes = 0;
        let fakeState = 'interrupted';
        const origResume = AudioContext.prototype.resume;
        const stateDesc = Object.getOwnPropertyDescriptor(BaseAudioContext.prototype, 'state');
        AudioContext.prototype.resume = function () {
          resumes++;
          fakeState = 'running';
          return Promise.resolve();
        };
        Object.defineProperty(BaseAudioContext.prototype, 'state', {
          configurable: true,
          get() { return fakeState; },
        });
        try {
          // A) Recovery on gesture (Settings slider input calls unlock())
          const r = document.querySelector('[data-fxvol]');
          r.value = '0.8';
          r.dispatchEvent(new Event('input', { bubbles: true }));
          const afterGesture = { resumes, state: window.__game.audioState().ctx };

          // B) Recovery on visibilitychange return from 'interrupted'
          fakeState = 'interrupted';
          Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
          document.dispatchEvent(new Event('visibilitychange'));
          const afterVis = { resumes, state: window.__game.audioState().ctx };

          // C) Recovery on bfcache pageshow from 'interrupted'
          fakeState = 'interrupted';
          window.dispatchEvent(new Event('pageshow'));
          const afterPageShow = { resumes, state: window.__game.audioState().ctx };

          return { afterGesture, afterVis, afterPageShow };
        } finally {
          AudioContext.prototype.resume = origResume;
          if (stateDesc) Object.defineProperty(BaseAudioContext.prototype, 'state', stateDesc);
          delete document.hidden;
        }
      });
      t.equal(rec.afterGesture.resumes, 1, 'unlock() resumes interrupted AudioContext on gesture');
      t.equal(rec.afterGesture.state, 'running', 'AudioContext running after gesture');
      t.equal(rec.afterVis.resumes, 2, 'visibilitychange resumes interrupted AudioContext');
      t.equal(rec.afterVis.state, 'running', 'AudioContext running after visibilitychange');
      t.equal(rec.afterPageShow.resumes, 3, 'pageshow resumes interrupted AudioContext');
      t.equal(rec.afterPageShow.state, 'running', 'AudioContext running after pageshow');

      // 4. Verify delayed sfx('chime', { delay: 0.28 }) schedules music.duck starting at +0.28 s on live audio
      const duckTiming = await t.page.evaluate(() => {
        const log = [];
        const origTarget = AudioParam.prototype.setTargetAtTime;
        AudioParam.prototype.setTargetAtTime = function (v, at, tc) {
          log.push({ v, at, tc });
          return origTarget.apply(this, arguments);
        };
        try {
          window.__game.act('sfx', 'chime', { delay: 0 });
          const at0 = log[log.length - 2].at;
          log.length = 0;
          window.__game.act('sfx', 'chime', { delay: 0.28 });
          const dip = log[log.length - 2], rec = log[log.length - 1];
          return { delta: +(dip.at - at0).toFixed(3), dur: +(rec.at - dip.at).toFixed(3) };
        } finally {
          AudioParam.prototype.setTargetAtTime = origTarget;
        }
      });
      t.expect(duckTiming.delta >= 0.24 && duckTiming.delta <= 0.34, 'chime with delay 0.28 delays music.duck by ~0.28 s (got ' + duckTiming.delta + ' s)');
      t.expect(Math.abs(duckTiming.dur - 0.9) < 0.02, 'duck duration is 900 ms (' + duckTiming.dur + ' s)');
    },
  },
];

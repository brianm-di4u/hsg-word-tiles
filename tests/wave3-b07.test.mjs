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
  {
    name: 'W4-S4-02 variable-length human play, square-tinted landings, reveal/bagempty/defeat/prompt cues, Challenge no-double-cue, and renderCue isolation',
    viewports: ['desktop'],
    initScript: new Function(`
      window.__TEST_TIPS__ = false;
      if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false }));
      let a = 19 >>> 0;
      Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    `),
    async run(t) {
      await ready(t);

      // 1. renderCue() isolation: rendering offline cues must NOT mutate live played/cues/total
      const beforeRender = await t.game('audioState');
      const p1 = await t.game('act', 'renderSfx', 'play', 0.35, { tiles: 1 });
      const p3 = await t.game('act', 'renderSfx', 'play', 0.35, { tiles: 3 });
      const p7 = await t.game('act', 'renderSfx', 'play', 0.35, { tiles: 7 });
      const afterRender = await t.game('audioState');
      t.equal(afterRender.total, beforeRender.total, 'renderCue() does not increment audio.total');
      t.equal(JSON.stringify(afterRender.played), JSON.stringify(beforeRender.played), 'renderCue() does not mutate audio.played');
      t.equal(JSON.stringify(afterRender.cues), JSON.stringify(beforeRender.cues), 'renderCue() does not mutate audio.cues');

      // 2. Variable-length human 'play' lock-in scales cleanly & finishes before STING_LAG
      t.expect(p1.peak > 0.1 && p3.peak > 0.1 && p7.peak > 0.1, 'play 1/3/7 tiles all audible (' + [p1.peak, p3.peak, p7.peak].join('/') + ')');
      t.expect(p1.ms < p3.ms && p7.zc > p1.zc * 1.4, 'play duration & confirm energy scale with tile count (' + p1.ms + 'ms/' + p1.zc + 'zc -> ' + p3.ms + 'ms/' + p3.zc + 'zc -> ' + p7.ms + 'ms/' + p7.zc + 'zc)');
      for (const n of [1, 3, 7]) {
        const pf = await t.game('act', 'renderSfx', 'play', 1, { tiles: n });
        t.expect(pf.peak < 0.88, 'play(' + n + ') stays < 0.88 at full volume (' + pf.peak + ')');
      }

      // 3. New cues ('defeat', 'prompt', 'reveal', 'bagempty') and square-tinted 'place' accents are audible & unclipped
      for (const cue of ['defeat', 'prompt', 'reveal', 'bagempty']) {
        const def = await t.game('act', 'renderSfx', cue, 0.35);
        const full = await t.game('act', 'renderSfx', cue, 1);
        t.expect(def.peak > 0.04 && def.peak < 0.48, cue + ' audible & balanced at default vol (' + def.peak + ')');
        t.expect(full.peak < 0.88, cue + ' stays < 0.88 at full volume (' + full.peak + ')');
      }
      const basePlace = await t.game('act', 'renderSfx', 'place', 0.35);
      for (const sq of ['w', 'h', 's', 'b', 'B']) {
        const r = await t.game('act', 'renderSfx', 'place', 0.35, { sq });
        const rf = await t.game('act', 'renderSfx', 'place', 1, { sq });
        t.expect(r.ms > basePlace.ms + 20, 'place on ' + sq + ' has harmonic/brass tail (' + r.ms + ' ms vs plain ' + basePlace.ms + ' ms)');
        t.expect(rf.peak < 0.88, 'place on ' + sq + ' stays < 0.88 at full vol (' + rf.peak + ')');
      }

      // 4. Live gameplay hooks: square-tinted stage(), variable tiles on play, keyboard blank-arm 'prompt', reveal & bagempty
      await t.game('newGame', { seed: 5, seats: [{ kind: 'human', name: 'You' }, { kind: 'human', name: 'Pat' }] });
      await t.waitIdle(5000);
      await t.game('act', 'reveal');
      let st = await t.state();
      // Put 'A' on H8 (112) so we can stage onto Warm spring D8 (108), Bathhouse Row B (8 -> Superior), and test blank-arm
      const g = st.game;
      g.board = Array(225).fill(null);
      g.board[112] = { l: 'A', blank: false };
      g.board[23] = { l: 'A', blank: false }; // right below Superior Bathhouse at index 8 (row 0, col 8)
      g.move = 2; g.cur = 0;
      g.players[0].rack = ['?', 'T', 'S', 'E', 'R', 'N', 'O'];
      g.bag = ['I']; // 1 tile in bag -> playing 1+ tile empties the bag -> triggers 'bagempty'
      g.featured = [{ id: 'quartz', word: 'QUARTZ', cat: 'springs', shown: [0], by: null, at: null }];
      await t.game('setState', { game: g });
      await t.waitIdle(5000);

      // A) Keyboard blank-arming fires 'prompt', NOT 'error'
      let startTot = (await t.game('audioState')).total;
      await t.page.focus('#board');
      await t.page.keyboard.press('q');
      let a = await t.game('audioState');
      let delta = a.played.slice(a.played.length - (a.total - startTot));
      t.expect(delta.includes('prompt') && !delta.includes('error'), 'keyboard blank-arm plays prompt, not error (' + delta.join(',') + ')');

      // B) Staging onto Bathhouse Row (index 8) passes sq: 'B'; playing AT down (8,23) clears 1 fog letter ('reveal') AND empties bag ('bagempty')
      startTot = (await t.game('audioState')).total;
      t.expect((await t.game('act', 'stage', [{ i: 8, l: 'T' }])).ok, 'staged T on Bathhouse Row square 8');
      a = await t.game('audioState');
      const placeCue = a.cues[a.cues.length - 1];
      t.equal(placeCue.name, 'place', 'stage emits place');
      t.equal(placeCue.sq, 'B', 'stage on Bathhouse Row passes sq="B"');

      startTot = (await t.game('audioState')).total;
      t.expect((await t.game('act', 'play')).ok, 'played TA on Bathhouse Row draining bag to 0');
      a = await t.game('audioState');
      const playCues = a.cues.slice(a.cues.length - (a.total - startTot));
      const playNames = playCues.map((c) => c.name);
      t.equal(playCues.find((c) => c.name === 'play')?.tiles, 1, '1-tile human play passes tiles=1');
      t.expect(playNames.includes('reveal'), 'fog-letter clear triggers reveal shimmer (' + playNames.join(',') + ')');
      t.expect(playNames.includes('bagempty'), 'draining bag to 0 triggers bagempty low brass tap (' + playNames.join(',') + ')');

      // 5. Challenge loseTurn() emits 'error' and skips 'turn'
      await t.game('newGame', { seed: 5, challenge: true, seats: [{ kind: 'human', name: 'You' }, { kind: 'human', name: 'Pat' }] });
      await t.waitIdle(5000);
      await t.game('act', 'reveal');
      st = await t.state();
      st.game.players[0].rack = ['Q', 'X', 'Z', 'B', 'C', 'D', 'F'];
      await t.game('setState', { game: st.game });
      await t.waitIdle(5000);
      t.expect((await t.game('act', 'stage', [{ i: 111, l: 'Q' }, { i: 112, l: 'X' }, { i: 113, l: 'Z' }])).ok, 'non-word QXZ staged in Challenge');
      startTot = (await t.game('audioState')).total;
      await t.game('act', 'play');
      a = await t.game('audioState');
      delta = a.played.slice(a.played.length - (a.total - startTot));
      t.expect(delta.includes('error') && !delta.includes('turn'), 'Challenge loseTurn fires error without duplicate turn (' + delta.join(',') + ')');

      // 6. Loss triggers 'defeat' cadence instead of neutral 'turn'
      await t.game('newGame', { seed: 5, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
      await t.waitIdle(5000);
      st = await t.state();
      const lg = st.game;
      lg.board = Array(225).fill(null);
      lg.board[111] = { l: 'C', blank: false }; lg.board[112] = { l: 'A', blank: false }; lg.board[113] = { l: 'T', blank: false };
      lg.bag = []; lg.move = 10; lg.cur = 0;
      lg.players[0].rack = ['S']; lg.players[0].score = 40;
      lg.players[1].rack = ['E']; lg.players[1].score = 240;
      await t.game('setState', { game: lg });
      await t.waitIdle(5000);
      startTot = (await t.game('audioState')).total;
      t.expect((await t.game('act', 'stage', [{ i: 114, l: 'S' }])).ok, 'final S staged for loss test');
      t.expect((await t.game('act', 'play')).ok, 'final play applied (human loses 40+ to 240)');
      await t.page.waitForFunction(() => window.__game.audioState().played.includes('defeat'), null, { timeout: 6000 });
      a = await t.game('audioState');
      delta = a.played.slice(a.played.length - (a.total - startTot));
      t.expect(delta.includes('defeat') && !delta.includes('fanfare') && !delta.includes('turn'), 'losing match fires defeat cadence, not turn/fanfare (' + delta.join(',') + ')');
    },
  },
];

// Wave 4, batch W4-B18:
// W4-S4-04 (tighter 1 ms limiter attack, 35 ms per-cue retrigger throttle + G.fast storm suppression,
//           -2 dB peaking EQ carve at 2.2-2.5 kHz on bus.mus, 4 dB DUCK on discover/big, gentle lift on hint/open).
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const seeded = (seed) => new Function(`
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: true }));
  let a = ${seed} >>> 0;
  Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  window.__audioEdges = [];
  const origConnect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    window.__audioEdges.push([this, dest]);
    return origConnect.call(this, dest, ...rest);
  };
`);

export const tests = [
  {
    name: 'W4-S4-04 limiter attack 1ms, bus.mus -2dB peaking EQ at 2.2-2.5kHz, 35ms retrigger throttle, G.fast suppression, 4dB discover/big duck, and lifted hint/open within headroom',
    viewports: ['desktop'],
    initScript: seeded(18),
    async run(t) {
      await ready(t);
      // Unlock live audio via a click on Setup
      await t.page.click('#screen [data-go="setup"]');
      await t.page.waitForFunction(() => window.__game.audioState().ctx === 'running', null, { timeout: 5000 });

      const a0 = await t.game('audioState');
      t.expect(Math.abs(a0.limAttack - 0.001) < 1e-6, `limiter attack tightened to 0.001 s (${a0.limAttack})`);
      t.expect(!!a0.musEq && a0.musEq.type === 'peaking', `bus.mus has peaking EQ (${JSON.stringify(a0.musEq)})`);
      t.expect(a0.musEq?.freq >= 2200 && a0.musEq?.freq <= 2500, `bus.mus EQ frequency in 2.2-2.5 kHz (${a0.musEq?.freq} Hz)`);
      t.expect(Math.abs((a0.musEq?.gain ?? 0) - -2) < 0.05 && a0.musEq?.q >= 0.7 && a0.musEq?.q <= 1.2, `bus.mus EQ gain -2 dB, Q~0.9 (${JSON.stringify(a0.musEq)})`);

      // Verify bus.mus is actually wired through the peaking EQ into the limiter -> WaveShaper ceiling -> destination
      const topo = await t.page.evaluate(() => {
        const edges = window.__audioEdges;
        const eq = edges.map(([a]) => a).find((n) => n instanceof BiquadFilterNode && n.type === 'peaking' && n.frequency.value >= 2200 && n.frequency.value <= 2500);
        const lim = edges.map(([a]) => a).find((n) => n instanceof DynamicsCompressorNode);
        const ceil = edges.map(([a]) => a).find((n) => n instanceof WaveShaperNode);
        const has = (src, dst) => !!src && !!dst && edges.some(([a, b]) => a === src && b === dst);
        const gainIntoEq = !!eq && edges.some(([a, b]) => a instanceof GainNode && b === eq);
        return { gainIntoEq, eqToLim: has(eq, lim), limToCeil: has(lim, ceil) };
      });
      t.equal(topo.gainIntoEq, true, 'bus.mus GainNode feeds the peaking EQ');
      t.equal(topo.eqToLim, true, 'peaking EQ feeds the master limiter');
      t.equal(topo.limToCeil, true, 'master limiter feeds the post-limiter WaveShaper ceiling');

      // 1) 35 ms per-cue retrigger throttle on live audio (allows spaced delays >= 35 ms & distinct cue names)
      const throt = await t.page.evaluate(() => {
        let oscStarts = 0;
        const origStart = OscillatorNode.prototype.start;
        OscillatorNode.prototype.start = function (...args) { oscStarts++; return origStart.apply(this, args); };
        try {
          const beforeT = window.__game.audioState().throttled;
          const beforeTot = window.__game.audioState().total;
          window.__game.act('sfx', 'turn', { delay: 0 });
          const after1 = oscStarts;
          window.__game.act('sfx', 'turn', { delay: 0.01 }); // 10 ms later -> throttled
          const after2 = oscStarts;
          window.__game.act('sfx', 'turn', { delay: 0.06 }); // 60 ms later -> allowed
          const after3 = oscStarts;
          window.__game.act('sfx', 'good', { delay: 0.01 }); // different cue name -> allowed
          const after4 = oscStarts;
          const st = window.__game.audioState();
          return {
            d1: after1,
            d2: after2 - after1,
            d3: after3 - after2,
            d4: after4 - after3,
            throttledDelta: st.throttled - beforeT,
            totalDelta: st.total - beforeTot,
          };
        } finally {
          OscillatorNode.prototype.start = origStart;
        }
      });
      t.expect(throt.d1 > 0, `first turn cue synthesized (${throt.d1} osc)`);
      t.equal(throt.d2, 0, 'same cue within 35 ms is throttled (0 osc)');
      t.equal(throt.throttledDelta, 1, 'throttled counter incremented once');
      t.expect(throt.d3 > 0, `same cue spaced >= 35 ms plays normally (${throt.d3} osc)`);
      t.expect(throt.d4 > 0, `different cue name within 35 ms is not blocked (${throt.d4} osc)`);
      t.equal(throt.totalDelta, 4, 'logical cue history still records all 4 calls');

      // 2) G.fast autoplay storm suppression: zero live oscillator/buffer starts while G.fast === true
      await t.game('newGame', { seed: 7 });
      await t.waitIdle(5000);
      const fastRes = await t.page.evaluate(async () => {
        let sfxOsc = 0;
        const origStart = OscillatorNode.prototype.start;
        OscillatorNode.prototype.start = function (...args) { sfxOsc++; return origStart.apply(this, args); };
        const beforeSup = window.__game.audioState().suppressed;
        window.__G.settings.music = false; window.__G.settings.amb = false;
        window.__G.fast = true;
        try {
          for (let k = 0; k < 12; k++) window.__game.act('sfx', k % 2 ? 'place' : 'play');
          return { sfxOsc, supDelta: window.__game.audioState().suppressed - beforeSup };
        } finally {
          window.__G.fast = false;
          OscillatorNode.prototype.start = origStart;
        }
      });
      t.equal(fastRes.sfxOsc, 0, 'G.fast suppresses live cue storm synthesis (0 oscillators)');
      t.equal(fastRes.supDelta, 12, 'all 12 rapid G.fast cues were suppressed');

      // 3) 4 dB music ducking on 'discover' and 'big' (respecting opts.delay)
      const ducks = await t.page.evaluate(() => {
        const out = {};
        const log = [];
        const origTarget = AudioParam.prototype.setTargetAtTime;
        AudioParam.prototype.setTargetAtTime = function (v, at, tc) {
          log.push({ v, at, tc });
          return origTarget.apply(this, arguments);
        };
        try {
          for (const cue of ['discover', 'big']) {
            log.length = 0;
            window.__game.act('sfx', cue, { delay: 0.28 });
            const dip = log.find((x) => x.tc === 0.02);
            const rec = log.find((x) => x.tc === 0.25);
            out[cue] = dip && rec ? { dipRatio: +dip.v.toFixed(4), dur: +(rec.at - dip.at).toFixed(3) } : null;
          }
        } finally {
          AudioParam.prototype.setTargetAtTime = origTarget;
        }
        return out;
      });
      const expected4dB = 10 ** (-4 / 20); // ~0.6310
      for (const cue of ['discover', 'big']) {
        t.expect(!!ducks[cue], `${cue} schedules music duck`);
        t.expect(Math.abs((ducks[cue]?.dipRatio ?? 0) - expected4dB) < 0.02, `${cue} ducks music by ~4 dB (got ratio ${ducks[cue]?.dipRatio}, want ~${expected4dB.toFixed(3)})`);
        t.expect((ducks[cue]?.dur ?? 0) >= 0.6 && (ducks[cue]?.dur ?? 0) <= 1.0, `${cue} duck duration in 600-1000 ms (${ducks[cue]?.dur} s)`);
      }

      // 4) Gentle lift on TRIM.hint and TRIM.open while staying soft (S2-17 <= 0.20) and <= 0.88 at full volume
      const med = (xs) => [...xs].sort((a, b) => a - b)[xs.length >> 1];
      for (const [cue, loDef, hiDef] of [['hint', 0.15, 0.20], ['open', 0.125, 0.20]]) {
        const defs = [], fulls = [];
        for (let k = 0; k < 15; k++) {
          defs.push((await t.game('act', 'renderSfx', cue, 0.35)).peak);
          fulls.push((await t.game('act', 'renderSfx', cue, 1)).prePeak);
        }
        const mDef = med(defs), maxFull = Math.max(...fulls);
        t.log(`W4-S4-04 ${cue}: default median=${mDef} (${Math.min(...defs)}..${Math.max(...defs)}), full prePeak max=${maxFull}`);
        t.expect(mDef >= loDef && mDef <= hiDef, `${cue} gently lifted into [${loDef}, ${hiDef}] at default vol (median ${mDef})`);
        t.expect(maxFull <= 0.88, `${cue} full-volume prePeak <= 0.88 (${maxFull})`);
      }

      // 5) Bell trims preserved (CD-WF4-02) and full-volume gameplay mixes stay unclipped
      for (const [mix, cap] of [
        ['play+featured@0.28+steam', 0.88],
        ['play+chime@0.28+steam', 0.88],
        ['play+big@0.28+steam', 0.88],
        ['play+discover@0.28+steam', 0.88],
        ['fanfare+steam', 0.95],
      ]) {
        let worst = 0;
        for (let k = 0; k < 8; k++) worst = Math.max(worst, (await t.game('act', 'renderSfx', mix, 1)).prePeak);
        t.log(`W4-S4-04 mix ${mix} full prePeak max=${worst}`);
        t.expect(worst <= cap, `${mix} full-volume prePeak <= ${cap} (${worst})`);
      }
    },
  },
];

// Wave 4, batch W4-B18:
// W4-S4-04 (tighter 1 ms limiter attack, 35 ms per-cue retrigger throttle + G.fast storm suppression,
//           -2 dB peaking EQ carve at 2.2-2.5 kHz on bus.mus, 4 dB DUCK on discover/big, gentle lift on hint/open).
// W4-S4-01 (lean procedural 0.22-0.30 s band-limited 350-3800 Hz tiled-bathhouse early-reflection ConvolverNode,
//           created once per AudioContext, with restrained per-family wet sends per CD-WF4-01).
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
  {
    name: 'W4-S4-01 tiled-bathhouse early-reflection ConvolverNode (0.22-0.30 s, 350-3800 Hz, created once), per-family wet sends (CD-WF4-01), acoustic tail on ceramic/brass, dry steam, and <=0.88 headroom',
    viewports: ['desktop'],
    initScript: seeded(41),
    async run(t) {
      await ready(t);
      await t.page.click('#screen [data-go="setup"]');
      await t.page.waitForFunction(() => window.__game.audioState().ctx === 'running', null, { timeout: 5000 });

      const a = await t.game('audioState');
      const rev = a.reverb;
      t.expect(!!rev, `reverb bus exists (${JSON.stringify(rev)})`);
      t.expect(rev?.dur >= 0.22 && rev?.dur <= 0.30, `IR duration in 0.22-0.30 s (${rev?.dur} s)`);
      t.equal(rev?.channels, 2, 'IR is stereo (2 channels)');
      t.expect(rev?.hp >= 300 && rev?.hp <= 400, `reverb highpass ~350 Hz (${rev?.hp} Hz)`);
      t.expect(rev?.lp >= 3500 && rev?.lp <= 4000, `reverb lowpass ~3800 Hz (${rev?.lp} Hz)`);

      // Per-family send calibration per CD-WF4-01:
      // 0-5% UI taps & broadband steam (steam === 0), 8-12% ceramic clacks, 15-20% brass reward bells
      const s = rev?.sends || {};
      t.equal(s.steam, 0, 'broadband steam wet send is 0%');
      for (const ui of ['open', 'tick', 'swap', 'turn', 'yourturn', 'prompt']) {
        t.expect(s[ui] >= 0 && s[ui] <= 0.05, `${ui} wet send in 0-5% (${s[ui]})`);
      }
      for (const cer of ['place', 'play', 'pick', 'unpick', 'recall', 'shuffle', 'error']) {
        t.expect(s[cer] >= 0.08 && s[cer] <= 0.12, `${cer} ceramic wet send in 8-12% (${s[cer]})`);
      }
      for (const br of ['chime', 'featured', 'discover', 'fanfare', 'hint', 'bell']) {
        t.expect(s[br] >= 0.15 && s[br] <= 0.20, `${br} brass wet send in 15-20% (${s[br]})`);
      }

      // Verify exact DSP graph wiring: revIn -> ConvolverNode -> hp(350) -> lp(3800) -> sfx -> lim,
      // per-family runtime send gains into revIn, and zero per-cue Convolver/Buffer creation
      const wiring = await t.page.evaluate(() => {
        const edges = window.__audioEdges;
        const conv = edges.map(([x]) => x).find((n) => n instanceof ConvolverNode);
        const revIn = conv ? edges.find(([x, y]) => x instanceof GainNode && y === conv)?.[0] : null;
        const hp = edges.map(([x]) => x).find((n) => n instanceof BiquadFilterNode && n.type === 'highpass' && n.frequency.value === 350);
        const lp = edges.map(([x]) => x).find((n) => n instanceof BiquadFilterNode && n.type === 'lowpass' && n.frequency.value === 3800);
        const has = (u, v) => !!u && !!v && edges.some(([x, y]) => x === u && y === v);
        let newConvs = 0, newBufs = 0;
        const origConv = BaseAudioContext.prototype.createConvolver;
        const origBuf = BaseAudioContext.prototype.createBuffer;
        BaseAudioContext.prototype.createConvolver = function (...args) { newConvs++; return origConv.apply(this, args); };
        BaseAudioContext.prototype.createBuffer = function (...args) { newBufs++; return origBuf.apply(this, args); };
        const sent = {};
        try {
          for (const cue of ['steam', 'open', 'place', 'chime', 'featured', 'fanfare']) {
            const before = edges.length;
            window.__game.act('sfx', cue, { delay: 0.1 });
            const wetEdge = revIn ? edges.slice(before).find(([x, y]) => x instanceof GainNode && y === revIn) : null;
            sent[cue] = wetEdge ? +wetEdge[0].gain.value.toFixed(3) : 0;
          }
        } finally {
          BaseAudioContext.prototype.createConvolver = origConv;
          BaseAudioContext.prototype.createBuffer = origBuf;
        }
        return {
          hasConv: !!conv,
          normOff: conv ? conv.normalize === false : false,
          convToHp: has(conv, hp),
          hpToLp: has(hp, lp),
          lpToGain: !!lp && edges.some(([x, y]) => x === lp && y instanceof GainNode),
          newConvs,
          newBufs,
          sent,
        };
      });
      t.equal(wiring.hasConv, true, 'ConvolverNode created once in graph()');
      t.equal(wiring.normOff, true, 'ConvolverNode.normalize is false (IR self-normalized)');
      t.equal(wiring.convToHp, true, 'ConvolverNode feeds 350 Hz highpass');
      t.equal(wiring.hpToLp, true, '350 Hz highpass feeds 3800 Hz lowpass');
      t.equal(wiring.lpToGain, true, '3800 Hz lowpass feeds sfx bus');
      t.equal(wiring.newConvs, 0, 'playing cues creates zero new ConvolverNodes');
      t.equal(wiring.newBufs, 0, 'playing cues allocates zero new AudioBuffers');
      t.equal(wiring.sent.steam, 0, 'live steam sends 0% to revIn');
      t.expect(wiring.sent.open > 0 && wiring.sent.open <= 0.05, `live open sends 0-5% to revIn (${wiring.sent.open})`);
      t.expect(wiring.sent.place >= 0.08 && wiring.sent.place <= 0.12, `live place sends 8-12% to revIn (${wiring.sent.place})`);
      t.expect(wiring.sent.chime >= 0.15 && wiring.sent.chime <= 0.20, `live chime sends 15-20% to revIn (${wiring.sent.chime})`);

      // Acoustic proof via offline renderSfx:
      // 1) Ceramic 'pick' (no lastClack state) & brass 'chime' gain measurable early-reflection tail/energy vs dry, while broadband 'steam' stays bit-identical to dry!
      const cmp = async (cue) => {
        const wet = await t.page.evaluate(async (c) => {
          let s = 4100 >>> 0;
          Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let x = s; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
          return window.__game.act('renderSfx', c, 0.35);
        }, cue);
        const dry = await t.page.evaluate(async (c) => {
          let s = 4100 >>> 0;
          Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let x = s; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
          return window.__game.act('renderSfx', c, 0.35, { dry: true });
        }, cue);
        return { wet, dry };
      };
      const pk = await cmp('pick');
      const ch = await cmp('chime');
      const st = await cmp('steam');
      t.log(`W4-S4-01 pick wet=${pk.wet.ms}ms/rms=${pk.wet.rms}/peak=${pk.wet.peak} vs dry=${pk.dry.ms}ms/rms=${pk.dry.rms}/peak=${pk.dry.peak}`);
      t.log(`W4-S4-01 chime wet=${ch.wet.ms}ms/rms=${ch.wet.rms}/sig=${ch.wet.sig} vs dry=${ch.dry.ms}ms/rms=${ch.dry.rms}/sig=${ch.dry.sig}`);
      t.log(`W4-S4-01 steam wet=${st.wet.ms}ms/rms=${st.wet.rms}/sig=${st.wet.sig} vs dry=${st.dry.ms}ms/rms=${st.dry.rms}/sig=${st.dry.sig}`);
      t.expect(pk.wet.ms > pk.dry.ms + 10 && pk.wet.sig !== pk.dry.sig, `ceramic pick gains early-reflection tail (${pk.wet.ms} ms vs dry ${pk.dry.ms} ms)`);
      t.expect(Math.abs(pk.wet.peak - pk.dry.peak) <= 0.015, `ceramic pick attack peak stays un-smeared (${pk.wet.peak} vs dry ${pk.dry.peak})`);
      t.expect(Math.abs(ch.wet.sig - ch.dry.sig) > 100000, `brass chime receives tiled-room early reflections (sig ${ch.wet.sig} vs dry ${ch.dry.sig})`);
      t.equal(st.wet.sig, st.dry.sig, 'broadband steam is 100% dry (0% reverb)');

      // 2) Full-volume headroom: all solo cues stay unclipped (< 0.95 prePeak, <= 0.90 peak) and reverb never inflates dry full-volume peaks
      for (const cue of ['place', 'play', 'pick', 'recall', 'shuffle', 'steam', 'chime', 'featured', 'discover', 'fanfare', 'hint', 'open', 'error', 'big']) {
        let maxPeak = 0, maxPre = 0;
        for (let k = 0; k < 6; k++) {
          const r = await t.game('act', 'renderSfx', cue, 1);
          maxPeak = Math.max(maxPeak, r.peak);
          maxPre = Math.max(maxPre, r.prePeak);
        }
        t.expect(maxPeak <= 0.90 && maxPre < 0.95, `${cue} solo full-volume stays unclipped with reverb (peak=${maxPeak}, prePeak=${maxPre})`);
      }
    },
  },
];

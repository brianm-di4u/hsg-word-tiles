// Wave 4, batch W4-B19 (WF-4 sonic_world_music):
// - W4-S5-03: whisper-quiet (0.08-0.15 default peak) ceramic/brass/paper UI micro-foley (uiTap, uiTile, uiClose)
//   covering menu/Setup/Help tabs/plaque/Breakdown clicks, Swap tile toggles, Blank letter picks, and closeDialog()/back().
// - W4-S5-05: independent Ambience level slider via kit.amb.level(st.ambVol) (OQ-WF6-03, default 100%) and Night-theme
//   amb.set('night', dark() ? 1 : 0, 2) low-pass warmth, softened drip/steam cadence, and ultra-faint <=2800 Hz transom pulse (CD-WF4-05).
// - W4-S5-06: whisper-quiet persona-colored grace cues on big/themed/soak opponent barks (completing 6ed2eb1 W2-S3-05 and d83c153 W4-S1-06 for B3.bell).
import { makeAudioKit, SCENES } from '../src/js/music.js';
import { barkCue } from '../src/js/voices.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const seeded = (seed) => new Function(`
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: true, fx: true, music: false, amb: false }));
  let a = ${seed} >>> 0;
  Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
`);
const CENTER = 112;

export const tests = [
  // ---------- W4-S5-03 ----------
  {
    name: 'W4-S5-03 uiTap, uiTile and uiClose sit in 0.08-0.15 default peak, vary naturally, use <=5% reverb, stay unclipped at full volume, and respect audio.on && audio.fx',
    viewports: ['desktop'],
    initScript: seeded(19),
    async run(t) {
      await ready(t);
      const med = (xs) => [...xs].sort((a, b) => a - b)[xs.length >> 1];
      const placeMed = med(await Promise.all(Array.from({ length: 10 }, () => t.game('act', 'renderSfx', 'place', 0.35)))
        .then((rs) => rs.map((r) => r.peak)));

      const summary = [];
      for (const cue of ['uiTap', 'uiTile', 'uiClose']) {
        const defs = [], fulls = [];
        for (let k = 0; k < 15; k++) {
          defs.push(await t.game('act', 'renderSfx', cue, 0.35));
          fulls.push(await t.game('act', 'renderSfx', cue, 1.0));
        }
        const mDef = med(defs.map((r) => r.peak));
        const maxFullPre = Math.max(...fulls.map((r) => r.prePeak));
        const maxMs = Math.max(...defs.map((r) => r.ms));
        const sigs = new Set(defs.map((r) => r.sig)).size;
        summary.push(`${cue}: med=${mDef.toFixed(3)} (${Math.min(...defs.map((r) => r.peak))}..${Math.max(...defs.map((r) => r.peak))}), fullPre=${maxFullPre}, ${maxMs}ms, sigs=${sigs}/15`);
        t.expect(mDef >= 0.08 && mDef <= 0.15, `${cue} default median peak in [0.08, 0.15] (${mDef.toFixed(3)})`);
        t.expect(mDef < placeMed, `${cue} (${mDef.toFixed(3)}) stays strictly below gameplay place cue (${placeMed.toFixed(3)})`);
        t.expect(maxFullPre < 0.88, `${cue} full-volume prePeak < 0.88 (${maxFullPre})`);
        t.expect(maxMs < 260, `${cue} is crisp and short (${maxMs} ms)`);
        t.expect(sigs >= 13, `${cue} varies naturally across repeats (${sigs}/15)`);
      }
      t.log(summary.join(' | '));

      // Verify distinct timbre: uiTile (dry ceramic flick) has higher zero-crossing rate than uiClose (soft downward settle)
      const tileZc = med(await Promise.all(Array.from({ length: 8 }, () => t.game('act', 'renderSfx', 'uiTile', 0.35))).then((rs) => rs.map((r) => r.zc)));
      const closeZc = med(await Promise.all(Array.from({ length: 8 }, () => t.game('act', 'renderSfx', 'uiClose', 0.35))).then((rs) => rs.map((r) => r.zc)));
      t.expect(tileZc > closeZc * 1.15, `uiTile (${tileZc} zc) is crisper than uiClose (${closeZc} zc)`);

      // Unlock live audio and verify CD-WF4-01 reverb send cap (0-5%) and audio.on / audio.fx mute gates
      await t.page.click('#screen [data-go="setup"]');
      await t.page.waitForFunction(() => window.__game.audioState().ctx === 'running', null, { timeout: 5000 });
      const rev = (await t.game('audioState')).reverb;
      for (const cue of ['uiTap', 'uiTile', 'uiClose']) {
        t.expect(rev.sends[cue] >= 0 && rev.sends[cue] <= 0.05, `${cue} reverb send in 0-5% (${rev.sends[cue]})`);
      }

      // Mute gates: when fx=false or sound=false, live synthesis produces 0 oscillators
      await t.game('scene', 'settings');
      await t.page.click('[data-set="fx"][data-val="false"]');
      const mutedFx = await t.page.evaluate(() => {
        let starts = 0;
        const orig = OscillatorNode.prototype.start;
        OscillatorNode.prototype.start = function (...a) { starts++; return orig.apply(this, a); };
        try {
          window.__game.act('sfx', 'uiTap', { delay: 0.1 });
          window.__game.act('sfx', 'uiTile', { delay: 0.2 });
          window.__game.act('sfx', 'uiClose', { delay: 0.3 });
          return starts;
        } finally {
          OscillatorNode.prototype.start = orig;
        }
      });
      t.equal(mutedFx, 0, 'uiTap/uiTile/uiClose synthesize 0 oscillators when Sound effects is Off');
      await t.page.click('[data-set="fx"][data-val="true"]');
      await t.page.click('[data-set="sound"][data-val="false"]');
      const mutedAll = await t.page.evaluate(() => {
        let starts = 0;
        const orig = OscillatorNode.prototype.start;
        OscillatorNode.prototype.start = function (...a) { starts++; return orig.apply(this, a); };
        try {
          window.__game.act('sfx', 'uiTap', { delay: 0.1 });
          return starts;
        } finally {
          OscillatorNode.prototype.start = orig;
        }
      });
      t.equal(mutedAll, 0, 'uiTap synthesizes 0 oscillators when master Sound is Off');
    },
  },
  {
    name: 'W4-S5-03 menu navigation, Setup cards, Help tabs, Swap toggles, Blank picks, Breakdown/plaque taps and dialog/sheet closes fire material-motif UI cues',
    viewports: ['desktop', 'mobile'],
    initScript: seeded(23),
    async run(t) {
      await ready(t);
      const heard = async (fn) => {
        const before = (await t.game('audioState')).total;
        await fn();
        const a = await t.game('audioState');
        return a.played.slice(a.played.length - (a.total - before));
      };

      // 1. Menu navigation -> uiTap; Setup persona card -> uiTap
      let h = await heard(() => t.page.click('#screen [data-go="setup"]'));
      t.expect(h.includes('uiTap'), `menu New game fires uiTap (${h.join(',')})`);
      h = await heard(() => t.page.click('#screen [data-persona="1"][data-val="lucky"]'));
      t.expect(h.includes('uiTap'), `Setup persona card fires uiTap (${h.join(',')})`);

      // 2. Help tab -> uiTap; sheet close (back) -> uiClose
      h = await heard(() => t.page.click('#screen [data-go="help"]'));
      t.expect(h.includes('uiTap'), `How to play navigation fires uiTap (${h.join(',')})`);
      h = await heard(() => t.page.click('#screen [data-tab="squares"]'));
      t.expect(h.includes('uiTap'), `Help tab click fires uiTap (${h.join(',')})`);
      h = await heard(() => t.page.click('#screen [data-back]'));
      t.expect(h.includes('uiClose'), `Help close (back) fires uiClose (${h.join(',')})`);

      // 3. In-game: plaque tap -> uiTap, Breakdown open/close -> uiTap/uiClose
      await t.game('newGame', { seed: 5, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
      await t.waitIdle(8000);
      const s = await t.state();
      s.game.players[0].rack = ['?', 'T', 'E', 'A', 'S', 'R', 'N'];
      await t.game('setState', { game: s.game });
      await t.waitIdle(5000);

      if (t.viewport === 'mobile') {
        h = await heard(() => t.page.click('#springs [data-springs-toggle]'));
        t.expect(h.includes('uiTap'), `mobile Featured Springs drawer toggle fires uiTap (${h.join(',')})`);
      }
      h = await heard(() => t.page.click('#springs [data-plaque="0"]'));
      t.expect(h.includes('uiTap'), `unclaimed Featured Spring plaque tap fires uiTap (${h.join(',')})`);

      // Stage TEA across center, toggle Breakdown open (uiTap) & closed (uiClose)
      await t.game('act', 'stage', [{ i: CENTER, l: 'T' }, { i: CENTER + 1, l: 'E' }, { i: CENTER + 2, l: 'A' }]);
      h = await heard(() => t.page.click('#preview .bdbtn:not([data-hintnext])'));
      t.expect(h.includes('uiTap'), `Breakdown open fires uiTap (${h.join(',')})`);
      h = await heard(() => t.page.click('#preview .bdbtn:not([data-hintnext])'));
      t.expect(h.includes('uiClose'), `Breakdown close fires uiClose (${h.join(',')})`);
      await t.game('act', 'recall');

      // 4. Swap dialog: tile toggle -> uiTile; Cancel -> uiClose
      await t.page.click('#actions [data-act="swap"]');
      await t.page.waitForSelector('#modal .swap [data-sw="0"]', { timeout: 3000 });
      h = await heard(() => t.page.click('#modal .swap [data-sw="0"]'));
      t.expect(h.includes('uiTile'), `Swap tile toggle fires uiTile (${h.join(',')})`);
      h = await heard(() => t.page.click('#modal [data-close]'));
      t.expect(h.includes('uiClose'), `Swap Cancel (closeDialog) fires uiClose (${h.join(',')})`);

      // 5. Blank picker: letter choice -> uiTile (followed by stage place, without spurious uiClose)
      const r0 = await t.game('act', 'rackTile', 0);
      if (t.viewport === 'mobile') await t.tap([r0[0], r0[1]]);
      else await t.page.mouse.click(r0[0], r0[1]);
      const ctr = await t.game('act', 'screen', CENTER);
      if (t.viewport === 'mobile') await t.tap(ctr);
      else await t.page.mouse.click(ctr[0], ctr[1]);
      await t.page.waitForSelector('#modal .blank [data-letter="S"]', { timeout: 3000 });
      h = await heard(() => t.page.click('#modal .blank [data-letter="S"]'));
      t.expect(h.includes('uiTile') && h.includes('place') && !h.includes('uiClose'), `Blank letter pick fires uiTile + place without spurious uiClose (${h.join(',')})`);
    },
  },

  // ---------- W4-S5-05 ----------
  {
    name: 'W4-S5-05 bathhouse Night param warms bed lowpass cutoffs, slows/softens drip & hiss, and uses <=2800 Hz gain<=0.008 transom pulse with zero unfiltered cricket (Node)',
    node: true,
    async run(t) {
      const spots = SCENES.bathhouse.spots;
      t.equal(spots.some((s) => s.make === 'cricket'), false, 'no raw 4.2-5.2 kHz SPOT.cricket in indoor bathhouse scene (CD-WF4-05)');
      const tr = spots.find((s) => s.make === 'transom');
      t.expect(!!tr && tr.param === 'night' && tr.gain <= 0.008, `ultra-faint night-gated transom spot present (gain=${tr?.gain} <= 0.008)`);

      const runScene = (night) => {
        const filters = [], oscs = [], freqTargets = [];
        const param = (init = 0, track = null) => ({
          value: init,
          cancelScheduledValues() {},
          setValueAtTime() {},
          linearRampToValueAtTime() {},
          exponentialRampToValueAtTime() {},
          setTargetAtTime(v, at, tc) { if (track) track.push({ v, at, tc }); },
        });
        const ctx = {
          sampleRate: 22050, state: 'running', currentTime: 0,
          createGain: () => ({ gain: param(1), connect(d) { return d; }, disconnect() {} }),
          createBiquadFilter: () => {
            const f = { type: 'lowpass', frequency: param(0, freqTargets), Q: param(0.7), connect(d) { return d; }, disconnect() {} };
            filters.push(f); return f;
          },
          createOscillator: () => {
            const o = { type: 'sine', frequency: param(0), detune: param(0), connect(d) { return d; }, disconnect() {}, start(at) { o._start = at; }, stop() {} };
            oscs.push(o); return o;
          },
          createDelay: () => ({ delayTime: param(0), connect(d) { return d; }, disconnect() {} }),
          createStereoPanner: () => ({ pan: param(0), connect(d) { return d; }, disconnect() {} }),
          createBuffer: (_, len) => ({ getChannelData: () => new Float32Array(len) }),
          createBufferSource: () => ({ buffer: null, loop: false, connect(d) { return d; }, disconnect() {}, start() {}, stop() {} }),
        };
        const kit = makeAudioKit(ctx, { connect() {} }, { seed: 11, music: 1, ambience: 1 });
        kit.amb.set('night', night, 2);
        kit.amb.play(SCENES.bathhouse, { at: 0, fade: 0.05 });
        kit.scheduleUntil(120);
        kit.stop();
        return { filters, oscs, freqTargets };
      };

      const day = runScene(0);
      const night = runScene(1);
      // Night warms all three bed filter cutoffs downward (520->340, 2400->1500, 190->160)
      t.expect(night.freqTargets.some((x) => x.v === 340) && night.freqTargets.some((x) => x.v === 1500) && night.freqTargets.some((x) => x.v === 160),
        `Night warms bed filter cutoffs to 340/1500/160 Hz (got ${night.freqTargets.map((x) => x.v).join(',')})`);
      t.expect(day.freqTargets.some((x) => x.v === 520) && day.freqTargets.some((x) => x.v === 2400),
        `Day keeps bed filter cutoffs at 520/2400 Hz (got ${day.freqTargets.map((x) => x.v).join(',')})`);

      // Drip/hiss cadence softens in Night (fewer highpass vent filters and fewer drip oscillators over 120 s)
      const countHiss = (r) => r.filters.filter((f) => f.type === 'highpass').length;
      t.expect(countHiss(night) < countHiss(day), `Night slows steam vent hiss cadence (${countHiss(night)} vs Day ${countHiss(day)} over 120 s)`);

      // Transom spot: 0 high-band (>2800 Hz) oscillators in Night; transom lowpass <= 2800 Hz present only in Night
      const transomLp = (r) => r.filters.filter((f) => f.type === 'lowpass' && f.frequency.value === 2200).length;
      t.equal(transomLp(day), 0, 'Day fires 0 transom pulses');
      t.expect(transomLp(night) >= 2, `Night fires muffled 2200 Hz lowpass transom pulses (${transomLp(night)} over 120 s)`);
      const nightOscFreqs = night.oscs.map((o) => o.frequency.value).filter((f) => f >= 1800);
      t.expect(nightOscFreqs.every((f) => f <= 2800), `no Night ambient oscillator exceeds 2800 Hz (max ${Math.max(0, ...nightOscFreqs).toFixed(0)} Hz, CD-WF4-05)`);
    },
  },
  {
    name: 'W4-S5-05 independent Ambience level slider moves only ambGain, defaults to 100%, persists across reload, and Night theme warms bathhouse ambience cleanly',
    viewports: ['desktop', 'mobile'],
    initScript: () => {
      window.__TEST_TIPS__ = false;
      if (!localStorage.getItem('hs-letters-settings-v1')) {
        localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: true, fx: true, music: true, amb: true, theme: 'light' }));
      }
    },
    async run(t) {
      await ready(t);
      // 1. Existing save without ambVol defaults to 1 (100%) so shipped mixes stay untouched (OQ-WF6-03)
      const rawBefore = await t.page.evaluate(() => JSON.parse(localStorage.getItem('hs-letters-settings-v1')));
      t.equal(rawBefore.ambVol, undefined, 'pre-wave save has no ambVol key');
      t.equal((await t.state()).settings.ambVol, 1, 'ambVol defaults to 1 (100%)');

      // 2. Open Settings, start audio, check Ambience level row & independent bus movement
      await t.game('scene', 'settings');
      await t.page.click('[data-set="amb"][data-val="true"]');
      await t.page.waitForFunction(() => window.__game.audioState().ctx === 'running', null, { timeout: 8000 });
      t.expect(await t.page.locator('[data-ambvol]').count() === 1, 'Ambience level slider present');
      await t.shot('w4-b19-settings-ambvol');
      await t.checkLayout();

      const slide = (attr, v) => t.page.evaluate(([a, val]) => {
        const r = document.querySelector(`[${a}]`);
        r.value = String(val);
        r.dispatchEvent(new Event('input', { bubbles: true }));
      }, [attr, v]);

      await slide('data-ambvol', 0.25);
      await t.page.waitForFunction(() => Math.abs(window.__game.audioState().ambGain - 0.25) < 0.02, null, { timeout: 5000 });
      let a = await t.game('audioState');
      t.expect(Math.abs(a.musGain - 1) < 0.02 && Math.abs(a.fxGain - 1) < 0.02, `Ambience slider moves only ambGain (${a.ambGain.toFixed(2)}), leaving musGain (${a.musGain.toFixed(2)}) and fxGain (${a.fxGain.toFixed(2)}) alone`);

      await slide('data-musicvol', 0.5);
      await t.page.waitForFunction(() => Math.abs(window.__game.audioState().musGain - 0.5) < 0.02, null, { timeout: 5000 });
      a = await t.game('audioState');
      t.expect(Math.abs(a.ambGain - 0.25) < 0.02, `Music slider moves musGain (${a.musGain.toFixed(2)}) without moving ambGain (${a.ambGain.toFixed(2)})`);

      // 3. Zero-level scheduler check (Ruling 10): only pauses when BOTH musicVol and ambVol are 0
      await slide('data-musicvol', 0);
      t.equal((await t.game('audioState')).ticking, true, 'scheduler keeps ticking at musicVol=0 while ambVol=0.25');
      await slide('data-ambvol', 0);
      t.equal((await t.game('audioState')).ticking, false, 'scheduler pauses when both musicVol=0 and ambVol=0');
      await slide('data-ambvol', 0.4);
      t.equal((await t.game('audioState')).ticking, true, 'scheduler resumes when ambVol rises above 0');
      await slide('data-musicvol', 0.6);

      // 4. Reload persistence & out-of-range sanitization
      await t.reload();
      await ready(t);
      t.equal((await t.state()).settings.ambVol, 0.4, 'ambVol survives reload');
      t.equal((await t.state()).settings.musicVol, 0.6, 'musicVol survives reload');
      await t.page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('hs-letters-settings-v1'));
        s.ambVol = 99;
        localStorage.setItem('hs-letters-settings-v1', JSON.stringify(s));
      });
      await t.reload();
      await ready(t);
      t.equal((await t.state()).settings.ambVol, 1, 'damaged ambVol falls back to 1');

      // 5. Night theme wires amb.set('night', 1, 2) live (and survives Day <-> Night switches)
      await t.game('scene', 'settings');
      await t.page.click('[data-set="theme"][data-val="dark"]');
      await t.page.click('[data-set="amb"][data-val="true"]');
      await t.page.waitForFunction(() => window.__game.audioState().ctx === 'running', null, { timeout: 8000 });
      t.equal((await t.game('audioState')).ambNight, 1, 'Night theme sets amb night param to 1');
      await t.page.click('[data-set="theme"][data-val="light"]');
      t.equal((await t.game('audioState')).ambNight, 0, 'Day theme resets amb night param to 0');

      // 6. Offline acoustic proof (desktop): Night bathhouse bed is measurably warmer (>3.3 kHz energy drops) & unclipped at full vol
      if (t.viewport === 'desktop') {
        const dayBed = await t.game('audioRender', 'bathhouse', 30, false, { night: 0 });
        const nightBed = await t.game('audioRender', 'bathhouse', 30, false, { night: 1 });
        const dayHi = await t.game('audioRender', 'bathhouse', 30, false, { night: 0, hp: 3300 });
        const nightHi = await t.game('audioRender', 'bathhouse', 30, false, { night: 1, hp: 3300 });
        const nightFull = await t.game('audioRender', 'bathhouse', 30, false, { night: 1, vol: 1 });
        t.log(`W4-S5-05 bathhouse Day rms=${dayBed.rmsDb}dB peak=${dayBed.peak} >3.3kHz=${dayHi.rms} | Night rms=${nightBed.rmsDb}dB peak=${nightBed.peak} >3.3kHz=${nightHi.rms} | Night@full peak=${nightFull.peak}`);
        t.expect(nightHi.rms < dayHi.rms * 0.85, `Night bathhouse has measurably less >3.3 kHz energy than Day (${nightHi.rms} < 0.85 * ${dayHi.rms})`);
        t.expect(nightBed.peak < 0.07 && nightBed.rmsDb >= -54 && nightBed.rmsDb <= -38, `Night bed stays quiet and warm (peak=${nightBed.peak}, rms=${nightBed.rmsDb} dB)`);
        t.expect(nightFull.peak < 0.88, `Night bed stays unclipped at full volume (peak=${nightFull.peak})`);
      }
    },
  },

  // ---------- W4-S5-06 ----------
  {
    name: 'W4-S5-06 barkCue gates persona grace cues strictly to big/themed/soak barks of the four town opponents (Node)',
    node: true,
    async run(t) {
      for (const p of ['opal', 'hollis', 'lucky', 'julian']) {
        for (const ev of ['big', 'themed', 'soak']) t.equal(barkCue({ persona: p, event: ev }), p, `${p} ${ev} triggers persona grace cue`);
        for (const ev of ['open', 'pass', 'out', 'win', 'lose']) t.equal(barkCue({ persona: p, event: ev }), null, `${p} ${ev} stays quiet`);
      }
      t.equal(barkCue(null), null, 'null bark returns null');
      t.equal(barkCue({ persona: 'unknown', event: 'big' }), null, 'unknown persona returns null');
    },
  },
  {
    name: 'W4-S5-06 all four opponent persona bark cues are whisper-quiet, distinct, unclipped in full-volume mixes, and fire on live AI themed/big barks (completing 6ed2eb1/d83c153)',
    viewports: ['desktop'],
    initScript: seeded(29),
    async run(t) {
      await ready(t);
      const med = (xs) => [...xs].sort((a, b) => a - b)[xs.length >> 1];
      const byPersona = {};
      const lines = [];
      for (const persona of ['opal', 'hollis', 'lucky', 'julian']) {
        const defs = [], fulls = [];
        for (let k = 0; k < 10; k++) {
          defs.push(await t.game('act', 'renderSfx', 'bark', 0.35, { persona }));
          fulls.push(await t.game('act', 'renderSfx', 'bark', 1.0, { persona }));
        }
        const mDef = med(defs.map((r) => r.peak));
        const mZc = med(defs.map((r) => r.zc));
        const maxPre = Math.max(...fulls.map((r) => r.prePeak));
        const maxMs = Math.max(...defs.map((r) => r.ms));
        byPersona[persona] = { mDef, mZc, maxPre, maxMs };
        lines.push(`${persona}: med=${mDef.toFixed(3)}, zc=${mZc}, fullPre=${maxPre}, ${maxMs}ms`);
        t.expect(mDef >= 0.06 && mDef <= 0.16, `${persona} bark grace peak in [0.06, 0.16] (${mDef.toFixed(3)})`);
        t.expect(maxPre < 0.88, `${persona} bark solo full-volume prePeak < 0.88 (${maxPre})`);
        t.expect(maxMs < 450, `${persona} bark grace is brief (${maxMs} ms)`);
      }
      t.log(lines.join(' | '));
      // Spectral distinction across personas: Hollis's low wooden trail-block has clearly lower zc than Opal's porcelain droplet & Julian's 3-note turn
      t.expect(byPersona.hollis.mZc < byPersona.opal.mZc * 0.75, `Hollis (${byPersona.hollis.mZc} zc) is warmer/lower than Opal (${byPersona.opal.mZc} zc)`);
      t.expect(byPersona.hollis.mZc < byPersona.julian.mZc * 0.85, `Hollis (${byPersona.hollis.mZc} zc) is distinct from Julian (${byPersona.julian.mZc} zc)`);
      t.expect(new Set(Object.values(byPersona).map((x) => Math.round(x.mZc / 15))).size >= 3, 'four personas span distinct spectral signatures');

      // Full-volume busy gameplay mixes with persona bark stay strictly under 0.95 prePeak
      for (const combo of ['play+featured@0.28+steam+bark@0.12', 'play+big@0.28+steam+bark@0.12', 'play+chime@0.28+steam+bark@0.12']) {
        let worst = 0;
        for (const persona of ['opal', 'hollis', 'lucky', 'julian']) {
          const r = await t.game('act', 'renderSfx', combo, 1.0, { persona });
          worst = Math.max(worst, r.prePeak);
        }
        t.expect(worst < 0.95, `full-volume mix ${combo} stays under 0.95 prePeak (worst=${worst})`);
      }

      // Live gameplay integration: Opal plays themed word SPRING -> emits bark{persona:'opal'} after place clacks & before yourturn; pass emits no bark
      await t.page.click('#screen [data-go="setup"]');
      await t.page.waitForFunction(() => window.__game.audioState().ctx === 'running', null, { timeout: 5000 });
      t.expect((await t.game('audioState')).reverb.sends.bark <= 0.05, 'bark reverb send <= 5% (CD-WF4-01)');

      await t.game('newGame', { seed: 3, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'hard' }] });
      await t.waitIdle(8000);
      const st = await t.state();
      st.game.players[1].rack = 'SPRINGX'.split('');
      await t.game('setState', { game: st.game });
      await t.waitIdle(5000);
      const startTot = (await t.game('audioState')).total;
      await t.game('act', 'pass');
      await t.page.waitForFunction((n) => {
        const a = window.__game.audioState();
        return a.total > n && a.played.slice(a.played.length - (a.total - n)).includes('yourturn');
      }, startTot, { timeout: 12000 });
      const a = await t.game('audioState');
      const delta = a.cues.slice(a.cues.length - (a.total - startTot));
      const names = delta.map((c) => c.name);
      const barkEntry = delta.find((c) => c.name === 'bark');
      t.expect(!!barkEntry && barkEntry.persona === 'opal', `Opal themed play emitted bark{persona:'opal'} (${JSON.stringify(delta)})`);
      t.expect(names.indexOf('bark') > names.lastIndexOf('place') && names.indexOf('bark') < names.lastIndexOf('yourturn'),
        `bark fires after tile landing and before yourturn (${names.join(',')})`);
    },
  },
];

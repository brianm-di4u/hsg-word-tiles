// Short, quiet WebAudio sounds (adapted from Bathhouse Barons), plus a quiet bathhouse bed and four soft tunes.
// Created on the first user gesture; Sound is the master switch, with Sound effects, Music and Ambience under it.
// Ceramic clicks for tiles, a soft hiss of steam for bonus words, a brass chime for a Full Soak and a bell for a
// Featured Spring. No two tile sounds are alike: every cue is nudged in pitch, level and colour as it is made.
import { makeAudioKit, measureAudio, SCORES, SCENES } from './music.js';

export const audio = { ctx: null, on: true, vol: 0.35, fxVol: 1, musicVol: 1, ambVol: 1, night: 0, fx: true, music: true, amb: true, played: [], cues: [], total: 0, throttled: 0, suppressed: 0, isFast: null, live: null, sfxOut: null, revIn: null, bus: null, kit: null, want: null, holds: new Set() };
const DEFAULT_VOL = 0.35;
// Cues are built this much louder than they were before the music arrived (that was 1), so that at the shipped
// volume the tile sounds peak between 0.2 and 0.45 and sit clearly over the music and the bed. Set it to 1 to undo.
const CUE_GAIN = 6;
// bells and steam are the loudest cues: a little less so they do not outrun the tile sounds (featured was 0.6: a play
// that finds a Featured Spring peaked at up to 0.98 with the volume at full, so the bell is 3 dB quieter)
const TRIM = { featured: 0.42, steam: 0.7, chime: 0.85, fanfare: 0.85, place: 0.9, play: 0.92, pick: 2.1, unpick: 1.4, tick: 1.05, recall: 1.8, turn: 2.5, swap: 1.8, error: 1.5, open: 1.1, hint: 0.92, yourturn: 1.3, good: 1.8, big: 0.57, discover: 0.6, defeat: 0.9, prompt: 1.2, reveal: 0.85, bagempty: 0.5, bell: 0.5, uiTap: 1.0, uiTile: 1.0, uiClose: 1.0 };
const masterMus = (vol = audio.vol) => Math.min(1.5, vol / DEFAULT_VOL);   // the Volume slider moves the music and bed together; their own sliders move kit.music.level and kit.amb.level independently
// Above the shipped volume the cues rise more gently than the slider: to about twice the shipped level at full, not
// 2.9 times. With the slider at full the loudest repeats of steam and place overshot the limiter and clipped (peaks
// of 1.03 in 60 renders). The music is held back above the shipped volume in the same way (musicGain).
const cueVol = (vol = audio.vol) => (vol <= DEFAULT_VOL ? vol : DEFAULT_VOL + (vol - DEFAULT_VOL) * 0.55);

// The limiter lets the first milliseconds of a loud cue past, so with the volume at full a bell on top of a tile's clack could
// still peak over 1. After it the wave is bent towards CEIL_TOP above CEIL_KNEE, and never reaches it; below the knee, which is
// everything at the shipped volume (0.7 at most), this changes nothing.
const CEIL_KNEE = 0.88, CEIL_TOP = 0.95;
export const CEILING = Float32Array.from({ length: 4097 }, (_, i) => { const x = i / 2048 - 1, over = Math.abs(x) - CEIL_KNEE, room = CEIL_TOP - CEIL_KNEE; return over <= 0 ? x : Math.sign(x) * (CEIL_KNEE + room * (1 - Math.exp(-over / room))); });

// Lean procedural tiled-bathhouse early-reflection impulse response (0.24 s, band-limited 350-3800 Hz, CD-WF4-01).
// Created once per AudioContext; >= 11 ms pre-delay preserves crisp ceramic attacks and avoids transient peak stacking.
const REV_SEC = 0.24;
export const REV_SEND = {
  steam: 0,
  open: 0.02, tick: 0.02, uiTap: 0.02, uiTile: 0.03, uiClose: 0.02, swap: 0.04, turn: 0.04, yourturn: 0.04, prompt: 0.04,
  good: 0.05, big: 0.05, reveal: 0.05,
  place: 0.08, play: 0.09, pick: 0.09, unpick: 0.09, recall: 0.09, shuffle: 0.09, error: 0.09,
  chime: 0.18, featured: 0.18, discover: 0.18, fanfare: 0.18, hint: 0.17, bell: 0.18, bagempty: 0.16, defeat: 0.16,
};
function makeReverbIr(ctx) {
  const sr = ctx.sampleRate, len = Math.max(1, Math.floor(sr * REV_SEC));
  const buf = ctx.createBuffer(2, len, sr);
  let a = 0xB47405E1 >>> 0;
  const rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  // Early-reflection clusters (11-29 ms, matching a 4-10 m tiled bathhouse hall) + exponentially decayed tail (0.24 s total).
  const taps = [
    [0.011, 0.44, -0.3], [0.015, 0.38, 0.35], [0.019, 0.31, 0.2], [0.024, 0.23, -0.35], [0.029, 0.16, 0.25],
  ];
  const startDiffuse = Math.floor(sr * 0.014), fadeLen = Math.max(1, Math.floor(sr * 0.025)), tau = 0.024;
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (const [sec, amp, bias] of taps) {
      const base = Math.floor((sec + (ch ? 0.0012 : 0)) * sr);
      const gain = amp * (1 + (ch ? bias : -bias) * 0.35);
      for (let k = 0; k < 3 && base + k < len; k++) {
        d[base + k] += gain * (k === 1 ? 0.55 : 0.3) * (rnd() < 0.5 ? 1 : -1);
      }
    }
    for (let i = startDiffuse; i < len; i++) {
      const t = (i - startDiffuse) / sr;
      const env = Math.exp(-t / tau) * (i > len - fadeLen ? (len - i) / fadeLen : 1);
      d[i] += (rnd() * 2 - 1) * 0.075 * env;
    }
    let e = 0;
    for (let i = 0; i < len; i++) e += d[i] * d[i];
    const inv = e > 0 ? 0.33 / Math.sqrt(e) : 1;
    for (let i = 0; i < len; i++) d[i] *= inv;
  }
  return buf;
}

// one master bus: cues, music and ambience all pass a limiter so the loudest cue on top of both never clips
function graph(ctx, dest, seed, levels = {}) {
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -3; lim.knee.value = 3; lim.ratio.value = 12; lim.attack.value = 0.001; lim.release.value = 0.2;
  const ceil = ctx.createWaveShaper(); ceil.curve = CEILING;
  lim.connect(ceil); ceil.connect(dest);
  const sfx = ctx.createGain(); sfx.connect(lim);
  const revIn = ctx.createGain(), revConv = ctx.createConvolver();
  revConv.normalize = false;
  revConv.buffer = makeReverbIr(ctx);
  const revHp = ctx.createBiquadFilter(); revHp.type = 'highpass'; revHp.frequency.value = 350; revHp.Q.value = 0.7;
  const revLp = ctx.createBiquadFilter(); revLp.type = 'lowpass'; revLp.frequency.value = 3800; revLp.Q.value = 0.7;
  revIn.connect(revConv); revConv.connect(revHp); revHp.connect(revLp); revLp.connect(sfx);
  const musEq = ctx.createBiquadFilter();
  musEq.type = 'peaking'; musEq.frequency.value = 2350; musEq.Q.value = 0.9; musEq.gain.value = -2;
  const mus = ctx.createGain(); mus.gain.value = masterMus(DEFAULT_VOL); mus.connect(musEq); musEq.connect(lim);
  return { lim, sfx, revIn, rev: { conv: revConv, hp: revHp, lp: revLp, sends: REV_SEND }, mus, musEq, kit: makeAudioKit(ctx, mus, { seed, music: levels.music ?? 1, ambience: levels.ambience ?? 1 }) };
}

export function unlock() {
  if (audio.ctx) { if (audio.ctx.state !== 'running' && audio.ctx.state !== 'closed' && !audio.holds.has('hidden')) audio.ctx.resume().catch(() => {}); return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    audio.ctx = audio.live = ctx;
    const mMaster = masterMus();
    audio.bus = graph(ctx, ctx.destination, (Math.random() * 0xffffff) | 0, { music: mMaster > 0 ? audio.musicVol : 0, ambience: mMaster > 0 ? audio.ambVol : 0 });
    audio.bus.mus.gain.value = mMaster;
    audio.sfxOut = audio.bus.sfx; audio.revIn = audio.bus.revIn; audio.kit = audio.bus.kit;
    noiseBank(ctx);
    audio.kit.start();
    audio.kit.amb.set('night', audio.night ? 1 : 0, 0.01);
    syncAudio();
  } catch (e) { audio.ctx = audio.live = audio.kit = audio.bus = audio.sfxOut = audio.revIn = null; }
}

// What should be heard right now: the tune named by `want` (or none) and the bathhouse bed, each only when its own
// switch and the master switch are on. Safe to call at any time; asking for what is already playing does nothing.
export function syncAudio() {
  const k = audio.kit;
  if (!k) return;
  const sound = audio.on;
  const mMaster = masterMus();
  k.music.level(mMaster > 0 ? audio.musicVol : 0);
  k.amb.level(mMaster > 0 ? audio.ambVol : 0);
  k.music.play(sound && audio.music && audio.want ? SCORES[audio.want] : null, { fade: 2.5 });
  k.amb.play(sound && audio.amb ? SCENES.bathhouse : null, { fade: 3 });
  audio.bus.mus.gain.setTargetAtTime(mMaster, audio.ctx.currentTime, 0.05);
  audio.bus.sfx.gain.setTargetAtTime(audio.fxVol, audio.ctx.currentTime, 0.05);
}
export function setTune(name) { audio.want = name; syncAudio(); }
// the pause card and a hidden tab fade the music and bed out and schedule nothing; the last hold released brings them back
export function holdAudio(why) { audio.holds.add(why); if (audio.kit) audio.kit.hold(); }
export function releaseAudio(why) { audio.holds.delete(why); if (audio.kit && !audio.holds.size) audio.kit.release(); }

export function pauseAudio() { holdAudio('hidden'); if (audio.ctx && audio.ctx.state === 'running') audio.ctx.suspend().catch(() => {}); }
export function resumeAudio() { if (audio.ctx && audio.ctx.state !== 'running' && audio.ctx.state !== 'closed') audio.ctx.resume().catch(() => {}); releaseAudio('hidden'); }

// ---------- cues ----------
let OUT = null;     // where the cue being built goes (a panner when it is placed on the board)
let CJ = { f: 1, g: 1 };   // this cue's own nudge: pitch and level
const rr = (a, b) => a + (b - a) * Math.random();
const jit = (cents = 25, db = 1.5) => ({ f: 2 ** (rr(-cents, cents) / 1200), g: 10 ** (rr(-db, 0) / 20) });

function tone(f, t0, dur, type = 'sine', g = 0.3, slide = 0, env = null) {
  const c = audio.ctx, o = c.createOscillator(), a = c.createGain(), fq = f * CJ.f;
  const peak = Math.max(0.0002, g * CJ.g * CUE_GAIN * cueVol());
  const att = (env && env.a) || 0.006;
  a.gain.value = 0.0001; o.type = type; o.frequency.setValueAtTime(fq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, fq + slide), t0 + dur);
  a.gain.setValueAtTime(0.0001, t0);
  a.gain.exponentialRampToValueAtTime(peak, t0 + att);
  if (env && env.d && env.s) {
    const sus = Math.max(0.0002, peak * env.s);
    const dEnd = Math.min(t0 + dur * 0.85, t0 + att + env.d);
    a.gain.exponentialRampToValueAtTime(sus, dEnd);
    if (env.r) a.gain.setValueAtTime(sus, Math.max(dEnd, t0 + dur - env.r));
  }
  a.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let dst = OUT;
  if (env && env.lp) {
    const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = env.q ?? 0.7;
    fl.frequency.setValueAtTime(env.lp, t0);
    if (env.lpTo) fl.frequency.exponentialRampToValueAtTime(Math.max(40, env.lpTo), t0 + dur);
    fl.connect(dst); dst = fl;
  }
  o.connect(a).connect(dst); o.start(t0); o.stop(t0 + dur + 0.02);
}
// The noise every cue is cut from: three buffers made once for an audio context and reused, each cue starting at a random
// point in one of them, so a cue no longer allocates and fills a buffer of its own (a shuffle made five, a swap seven).
const NOISE_BUFFERS = 3, NOISE_SECONDS = 1.5;   // the longest cue (steam, 0.9 s) still has 0.5 s of room for its random start
const noiseBanks = new WeakMap();
function noiseBank(c) {
  let bank = noiseBanks.get(c);
  if (!bank) {
    bank = [];
    for (let k = 0; k < NOISE_BUFFERS; k++) {
      const b = c.createBuffer(1, Math.floor(c.sampleRate * NOISE_SECONDS), c.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      bank.push(b);
    }
    noiseBanks.set(c, bank);
  }
  return bank;
}
function noise(t0, dur, g = 0.2, freq = 2400, q = 1.2, type = 'bandpass', attack = 0.004, freqTo = 0) {
  const c = audio.ctx, bank = noiseBank(c);
  const src = c.createBufferSource(), f = c.createBiquadFilter(), a = c.createGain();
  a.gain.value = 0.0001; src.buffer = bank[Math.floor(Math.random() * bank.length)]; f.type = type; f.frequency.setValueAtTime(freq * CJ.f, t0);
  if (freqTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, freqTo * CJ.f), t0 + dur);
  f.Q.value = q;
  a.gain.setValueAtTime(0.0001, t0); a.gain.exponentialRampToValueAtTime(g * CJ.g * CUE_GAIN * cueVol(), t0 + attack); a.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(a).connect(OUT); src.start(t0, Math.random() * (NOISE_SECONDS - dur - 0.05)); src.stop(t0 + dur + 0.02);
}
// A glazed tile set down on marble: a bright tick over a short low knock. Four variants (different colour of the
// tick, a triangle or a sine knock, a small glaze ring on two of them), a nudge of +-8% on the tick, +-0.5 semitone on
// the knock, 1.5 dB of level and up to 8 ms of lateness. `step` lifts the whole thing a semitone per tile along a word.
const CLACKS = [
  { nf: 3800, q: 2.2, kf: 310, kt: 'triangle', ring: 0 },
  { nf: 3500, q: 1.6, kf: 290, kt: 'sine', ring: 0 },
  { nf: 4200, q: 2.8, kf: 340, kt: 'triangle', ring: 2100 },
  { nf: 3300, q: 3, kf: 275, kt: 'sine', ring: 1750 },
];
let lastClack = -1;
const clack = (t, g = 1, step = 0) => {
  let v; do { v = (Math.random() * CLACKS.length) | 0; } while (v === lastClack);
  lastClack = v;
  const V = CLACKS[v], lift = 2 ** (Math.min(step, 12) / 12), keep = CJ, own = jit(0, 1.5), at = t + Math.random() * 0.008;
  CJ = { f: lift * 2 ** (rr(-50, 50) / 1200), g: keep.g * own.g };
  noise(at, 0.045, 0.32 * g, V.nf * rr(0.92, 1.08), V.q);
  tone(V.kf, at, 0.05, V.kt, 0.12 * g, -90);
  if (V.ring) tone(V.ring, at, 0.07, 'sine', 0.035 * g);
  CJ = keep;
};
// brass: inharmonic partials with a slow decay: the fundamental, then 2.76x and 5.4x, each shorter and quieter than the one
// below (the top one a sixth of the level and a quarter of a second, so a fanfare of five notes does not hiss), all through a
// low-pass at about 5 kHz so the 6 kHz partial of the high notes is rounded off. It was 1.2 s / 0.6 s / 0.4 s at 1, 1/2 and 1/3.
const BELL_PARTIALS = [[1, 1.2, 1], [2.76, 0.6, 1 / 2], [5.4, 0.25, 1 / 6]], BELL_TOP = 5000;
const bell = (t, f, g = 0.12) => {
  const keep = OUT, lp = audio.ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = BELL_TOP; lp.connect(keep); OUT = lp;
  try { BELL_PARTIALS.forEach(([m, dur, gain]) => tone(f * m, t, dur, 'sine', g * gain)); } finally { OUT = keep; }
};

const DUCK = { chime: [6, 900], featured: [6, 1400], fanfare: [6, 1800], discover: [4, 800], big: [4, 700] };
const CUE_THROTTLE_S = 0.035;
const lastCueAt = new WeakMap();

// opts: pan (-1..1, kept within +-0.7: the board column of a tile), step (0.. : semitones up along a word), delay
// (seconds from now: a sting that waits for the tiles it belongs to) and gain (a factor on the cue's level, 1 when left out)
export function sfx(name, opts = {}) {
  if (!opts._offline) {
    const entry = { name, delay: opts.delay || 0, gain: opts.gain ?? 1 };
    if (opts.tiles != null) entry.tiles = opts.tiles;
    if (opts.sq) entry.sq = opts.sq;
    if (opts.step) entry.step = opts.step;
    audio.played.push(name); audio.cues.push(entry); audio.total++;
    if (audio.played.length > 30) { audio.played.shift(); audio.cues.shift(); }
  }
  if (!audio.on || !audio.fx || !audio.ctx) return;
  const c = audio.ctx, t = c.currentTime + (opts.delay || 0), step = opts.step || 0;
  if (!opts._offline && c === audio.live) {
    if (audio.isFast && audio.isFast()) { audio.suppressed++; return; }
    let seen = lastCueAt.get(c);
    if (!seen) { seen = new Map(); lastCueAt.set(c, seen); }
    const prevAt = seen.get(name);
    if (prevAt != null && Math.abs(t - prevAt) < CUE_THROTTLE_S) { audio.throttled++; return; }
    seen.set(name, t);
  }
  try {
    OUT = audio.sfxOut || c.destination;
    if (opts.pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = Math.max(-0.7, Math.min(0.7, opts.pan)); p.connect(OUT); OUT = p; }
    const dryDest = OUT;
    const wetAmt = opts.dry ? 0 : (REV_SEND[name] ?? 0);
    if (wetAmt > 0 && audio.revIn) {
      const cueBus = c.createGain(), wet = c.createGain();
      wet.gain.value = wetAmt;
      cueBus.connect(dryDest);
      cueBus.connect(wet); wet.connect(audio.revIn);
      OUT = cueBus;
    }
    CJ = jit(25, 1.5); CJ.g *= (TRIM[name] || 1) * (opts.gain ?? 1);
    switch (name) {
      case 'pick': noise(t, 0.03, 0.12, 4600, 3); tone(1500, t, 0.025, 'triangle', 0.07); break;
      case 'unpick':
        noise(t, 0.024, 0.07, 3000, 2.5, 'bandpass', 0.002);
        tone(1120, t, 0.036, 'triangle', 0.055, -340, { a: 0.002, lp: 2200, lpTo: 900 });
        break;
      case 'tick':
        noise(t, 0.018, 0.045, opts.rotate ? 1950 : 1650, 2.8, 'bandpass', 0.002);
        tone(opts.rotate ? 740 : 580, t, 0.024, 'triangle', 0.038, -120, { a: 0.002, lp: 1350, lpTo: 480 });
        break;
      case 'place':
        clack(t, 1, step);
        if (opts.sq === 'w') tone(1047, t + 0.012, 0.115, 'sine', 0.032);
        else if (opts.sq === 'h') { tone(1319, t + 0.012, 0.11, 'sine', 0.034); tone(1976, t + 0.024, 0.08, 'sine', 0.018); }
        else if (opts.sq === 's') { tone(440, t + 0.01, 0.11, 'triangle', 0.045, -35); tone(880, t + 0.016, 0.08, 'sine', 0.024); }
        else if (opts.sq === 'b') { tone(392, t + 0.01, 0.13, 'triangle', 0.05, -45); tone(784, t + 0.018, 0.1, 'sine', 0.03); }
        else if (opts.sq === 'B') bell(t + 0.012, 587, 0.028);
        break;
      case 'recall': noise(t, 0.04, 0.16, 3000, 2); tone(420, t, 0.05, 'triangle', 0.06, 80); break;
      case 'shuffle': for (let k = 0; k < 5; k++) clack(t + k * (0.045 + Math.random() * 0.012), 0.45); break;
      case 'play': {
        const n = Math.max(1, Math.min(7, opts.tiles || 3));
        const clacks = Math.min(3, n), gap = 0.052;
        for (let k = 0; k < clacks; k++) clack(t + k * (gap + Math.random() * 0.008), 0.8, step + k);
        const tc = t + (clacks - 1) * gap + 0.045;
        if (n === 1) tone(523, tc, 0.12, 'sine', 0.052);
        else if (n <= 3) { tone(523, tc, 0.14, 'sine', 0.05); tone(784, tc + 0.024, 0.14, 'sine', 0.036); }
        else {
          [523, 659, 784].forEach((f, k) => tone(f, tc + k * 0.022, 0.15, 'sine', k ? 0.038 : 0.048));
          if (n >= 6) tone(1047, tc + 0.066, 0.13, 'sine', 0.028);
        }
        break;
      }
      case 'swap': for (let k = 0; k < 7; k++) noise(t + k * (0.05 + Math.random() * 0.01), 0.05, 0.15, 2000 + k * 200, 1.5); break;
      case 'steam':
        noise(t, 0.9, 0.105, 5200, 0.6, 'highpass', 0.25);
        noise(t, 0.85, 0.34, 700, 1.2, 'bandpass', 0.22, 1800);
        break;
      case 'chime': [784, 988, 1175].forEach((f, k) => bell(t + k * 0.11, f, 0.08)); break;
      case 'featured': {
        bell(t, 659, 0.14); bell(t + 0.28, 988, 0.12);
        const keep = OUT; OUT = dryDest;
        try { noise(t + 0.1, 0.9, 0.12, 5200, 0.6, 'highpass', 0.25); } finally { OUT = keep; }
        break;
      }
      // control comes back to a person after the computer has played: warm low-passed marimba/wood interval (G4 -> B4), distinct from bright rising-fifth 'good'
      case 'yourturn':
        tone(392, t, 0.17, 'triangle', 0.076, 0, { a: 0.004, d: 0.05, s: 0.36, lp: 1150, lpTo: 420 });
        tone(1560, t, 0.032, 'sine', 0.014, 0, { a: 0.002 });
        tone(494, t + 0.105, 0.26, 'triangle', 0.072, 0, { a: 0.004, d: 0.06, s: 0.32, lp: 1300, lpTo: 480 });
        tone(1965, t + 0.105, 0.035, 'sine', 0.012, 0, { a: 0.002 });
        break;
      // soft furniture sounds, well under the play cues: a paper tick for a card or sheet opening, whisper-quiet ceramic/brass/paper UI micro-foley (W4-S5-03), and a small bell for the Spring Guide
      case 'open': noise(t, 0.05, 0.1, 2800, 1.2, 'bandpass', 0.006); tone(740, t, 0.04, 'triangle', 0.03); break;
      case 'uiTap':
        noise(t, 0.022, 0.052, 2300, 2.4, 'bandpass', 0.002);
        tone(960, t, 0.038, 'triangle', 0.044, -120, { a: 0.002, lp: 2100, lpTo: 850 });
        tone(2520, t, 0.024, 'sine', 0.012, 0, { a: 0.002 });
        break;
      case 'uiTile':
        noise(t, 0.02, 0.064, 3900, 3.0, 'bandpass', 0.002);
        tone(1440, t, 0.025, 'triangle', 0.044, -220, { a: 0.002, lp: 3200, lpTo: 1300 });
        break;
      case 'uiClose':
        noise(t, 0.042, 0.046, 1500, 1.5, 'bandpass', 0.006);
        tone(620, t, 0.052, 'triangle', 0.044, -180, { a: 0.004, lp: 1350, lpTo: 500 });
        break;
      case 'bell': tone(3100, t, 0.018, 'triangle', 0.022); bell(t, 1175, 0.045); break;
      case 'hint': bell(t, 880, 0.05); tone(1320, t + 0.12, 0.2, 'sine', 0.03); break;
      case 'turn': tone(660, t, 0.12, 'sine', 0.05); break;
      // damped double marble/walnut knock replacing the bare arcade pitch-glide buzz
      case 'error':
        noise(t, 0.03, 0.11, 900, 2.2, 'bandpass', 0.003);
        tone(215, t, 0.055, 'triangle', 0.095, -32, { a: 0.003, lp: 660, lpTo: 230 });
        noise(t + 0.068, 0.032, 0.09, 760, 2.4, 'bandpass', 0.003);
        tone(168, t + 0.068, 0.068, 'triangle', 0.082, -26, { a: 0.003, lp: 560, lpTo: 195 });
        break;
      case 'prompt': tone(523, t, 0.11, 'sine', 0.048); tone(659, t + 0.08, 0.16, 'sine', 0.052, 18); break;
      case 'reveal': tone(740, t, 0.18, 'sine', 0.036, 40); tone(1109, t + 0.07, 0.26, 'sine', 0.032); noise(t, 0.22, 0.035, 3600, 1.4, 'bandpass', 0.05); break;
      case 'bagempty': bell(t, 294, 0.09); tone(147, t, 0.26, 'triangle', 0.06, -12); break;
      case 'defeat': [440, 392, 349, 294].forEach((f, k) => tone(f, t + k * 0.16, 0.34 + (k === 3 ? 0.32 : 0), 'sine', 0.068)); bell(t + 0.48, 294, 0.055); break;
      // a play worth 25 or more earns a rising pair of notes over its clacks; 45 or more, a short run up and a low thump
      case 'good': tone(659, t, 0.22, 'sine', 0.06); tone(988, t + 0.09, 0.3, 'sine', 0.055); break;
      case 'big': [523, 659, 784, 1047].forEach((f, k) => tone(f, t + k * 0.065, 0.28, 'triangle', 0.05)); tone(98, t, 0.3, 'sine', 0.16, -30); break;
      // the first time a person signs a Hot Springs word into the Register: two bells, the second a fifth above
      case 'discover': bell(t, 784, 0.08); bell(t + 0.16, 1175, 0.08); break;
      case 'fanfare': [523, 659, 784, 1047].forEach((f, k) => bell(t + k * 0.14, f, 0.08)); break;
    }
    if (DUCK[name] && audio.kit && c === audio.live) audio.kit.music.duck(DUCK[name][0], DUCK[name][1], opts.delay || 0);
  } catch (e) { /* audio is optional */ }
  CJ = { f: 1, g: 1 };
}

// ---------- for the tests: render a tune or the bed on its own, offline, at the level the game ships ----------
export const tuneName = () => { const s = audio.kit && audio.kit.music.score; return s ? Object.keys(SCORES).find((n) => SCORES[n] === s) : null; };
export const audioList = () => ({ music: Object.keys(SCORES), ambience: Object.keys(SCENES) });
export function audioRender(name, seconds, wantWav, opts = {}) {
  const music = !!SCORES[name];
  if (!music && !SCENES[name]) return Promise.reject(new Error('no such piece: ' + name));
  return measureAudio((oc, dest) => {
    let end = dest;
    if (opts && opts.hp) { end = oc.createBiquadFilter(); end.type = 'highpass'; end.frequency.value = opts.hp; end.Q.value = 0.7; end.connect(dest); }
    const g = graph(oc, end, 7, { music: opts && typeof opts.musicVol === 'number' ? opts.musicVol : 1, ambience: opts && typeof opts.ambVol === 'number' ? opts.ambVol : 1 });
    if (opts && typeof opts.vol === 'number') g.mus.gain.value = masterMus(opts.vol);
    if (opts && typeof opts.intensity === 'number') g.kit.music.intensity(opts.intensity);
    if (opts && typeof opts.night === 'number') g.kit.amb.set('night', opts.night, 0.01);
    if (music) g.kit.music.play(SCORES[name], { at: 0, fade: 0.05 }); else g.kit.amb.play(SCENES[name], { at: 0, fade: 0.05 });
    g.kit.scheduleUntil(seconds);
    return music ? () => g.kit.music.info() : null;
  }, seconds, { wav: !!wantWav });
}

// (a name like 'play+big@0.28+steam' renders those cues together, each after the delay in seconds that follows its @)
// One cue rendered offline through the same limiter the player hears, without touching the live audio. The cue is
// made a quarter of a second in, as it would be in a running game (a limiter that has only just started eats the
// first few milliseconds of whatever it is given).
export async function renderCue(name, vol, opts) {
  // two channels: what is heard, and the same wave as it leaves the limiter, before the ceiling (prePeak). The ceiling never lets
  // the first reach 0.95, so only the second can show a cue that is too loud.
  const off = new OfflineAudioContext(2, 44100 * 2, 44100), both = off.createChannelMerger(2);
  // opts.hp: measure only what lies above that many Hz (the cue is heard through a high-pass filter)
  let end = off.destination;
  if (opts && opts.hp) { end = off.createBiquadFilter(); end.type = 'highpass'; end.frequency.value = opts.hp; end.Q.value = 0.7; end.connect(off.destination); }
  both.connect(end);
  const g = graph(off, both, 1);
  g.lim.connect(both, 0, 1);
  // the stop is asked for before rendering starts: on a machine that renders fast, asking once it has begun can come too late
  // ("suspend failed ... earlier than the current frame") and the cue is never measured
  const stopped = off.suspend(0.25), done = off.startRendering();
  await stopped;
  const prev = { ctx: audio.ctx, on: audio.on, vol: audio.vol, fx: audio.fx, sfxOut: audio.sfxOut, revIn: audio.revIn };
  audio.ctx = off; audio.on = true; audio.fx = true; audio.sfxOut = g.sfx; audio.revIn = g.revIn; audio.vol = vol;
  try { for (const n of name.split('+')) { const [cue, d] = n.split('@'); sfx(cue, { ...opts, delay: d ? +d : 0, _offline: true }); } } finally { Object.assign(audio, prev); }
  off.resume();
  const buf = await done, d = buf.getChannelData(0);
  const prePeak = buf.getChannelData(1).reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  let peak = 0, sum = 0, last = 0, zc = 0;
  for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; sum += d[i] * d[i]; if (v > 0.001) last = i; if (i && d[i] * d[i - 1] < 0) zc++; }
  return { peak: +peak.toFixed(3), prePeak: +prePeak.toFixed(3), rms: +Math.sqrt(sum / d.length).toFixed(4), ms: Math.round((last - 11025) / 44.1), zc, sig: Math.round(sum * 1e6) };
}

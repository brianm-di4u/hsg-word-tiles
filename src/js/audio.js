// Short, quiet WebAudio sounds (adapted from Bathhouse Barons), plus a quiet bathhouse bed and three soft tunes.
// Created on the first user gesture; Sound is the master switch, with Sound effects, Music and Ambience under it.
// Ceramic clicks for tiles, a soft hiss of steam for bonus words, a brass chime for a Full Soak and a bell for a
// Featured Spring. No two tile sounds are alike: every cue is nudged in pitch, level and colour as it is made.
import { makeAudioKit, measureAudio, SCORES, SCENES } from './music.js';

export const audio = { ctx: null, on: true, vol: 0.35, fx: true, music: true, amb: true, played: [], live: null, sfxOut: null, bus: null, kit: null, want: null, holds: new Set() };
const DEFAULT_VOL = 0.35;
// Cues are built this much louder than they were before the music arrived (that was 1), so that at the shipped
// volume the tile sounds peak between 0.2 and 0.45 and sit clearly over the music and the bed. Set it to 1 to undo.
const CUE_GAIN = 6;
// bells and steam are the loudest cues: a little less so they do not outrun the tile sounds
const TRIM = { featured: 0.6, steam: 0.7, chime: 0.85, fanfare: 0.85, place: 0.9, play: 0.92, pick: 2.1, recall: 1.8, turn: 2.5, swap: 1.8, error: 1.5 };
const musicGain = (vol = audio.vol) => Math.min(1.5, vol / DEFAULT_VOL);   // the Volume slider moves the music with the cues

// one master bus: cues, music and ambience all pass a limiter so the loudest cue on top of both never clips
function graph(ctx, dest, seed) {
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -3; lim.knee.value = 3; lim.ratio.value = 12; lim.attack.value = 0.003; lim.release.value = 0.2;
  lim.connect(dest);
  const sfx = ctx.createGain(); sfx.connect(lim);
  const mus = ctx.createGain(); mus.gain.value = musicGain(DEFAULT_VOL); mus.connect(lim);
  return { lim, sfx, mus, kit: makeAudioKit(ctx, mus, { seed, music: 1, ambience: 1 }) };
}

export function unlock() {
  if (audio.ctx) { if (audio.ctx.state === 'suspended' && !audio.holds.has('hidden')) audio.ctx.resume(); return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    audio.ctx = audio.live = ctx;
    audio.bus = graph(ctx, ctx.destination, (Math.random() * 0xffffff) | 0);
    audio.bus.mus.gain.value = musicGain();
    audio.sfxOut = audio.bus.sfx; audio.kit = audio.bus.kit;
    audio.kit.start();
    syncAudio();
  } catch (e) { audio.ctx = audio.live = audio.kit = audio.bus = audio.sfxOut = null; }
}

// What should be heard right now: the tune named by `want` (or none) and the bathhouse bed, each only when its own
// switch and the master switch are on. Safe to call at any time; asking for what is already playing does nothing.
export function syncAudio() {
  const k = audio.kit;
  if (!k) return;
  const sound = audio.on;
  k.music.play(sound && audio.music && audio.want ? SCORES[audio.want] : null, { fade: 2.5 });
  k.amb.play(sound && audio.amb ? SCENES.bathhouse : null, { fade: 3 });
  audio.bus.mus.gain.setTargetAtTime(musicGain(), audio.ctx.currentTime, 0.05);
}
export function setTune(name) { audio.want = name; syncAudio(); }
// the pause card and a hidden tab fade the music and bed out and schedule nothing; the last hold released brings them back
export function holdAudio(why) { audio.holds.add(why); if (audio.kit) audio.kit.hold(); }
export function releaseAudio(why) { audio.holds.delete(why); if (audio.kit && !audio.holds.size) audio.kit.release(); }

export function pauseAudio() { holdAudio('hidden'); if (audio.ctx && audio.ctx.state === 'running') audio.ctx.suspend().catch(() => {}); }
export function resumeAudio() { if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {}); releaseAudio('hidden'); }

// ---------- cues ----------
let OUT = null;     // where the cue being built goes (a panner when it is placed on the board)
let CJ = { f: 1, g: 1 };   // this cue's own nudge: pitch and level
const rr = (a, b) => a + (b - a) * Math.random();
const jit = (cents = 25, db = 1.5) => ({ f: 2 ** (rr(-cents, cents) / 1200), g: 10 ** (rr(-db, 0) / 20) });

function tone(f, t0, dur, type = 'sine', g = 0.3, slide = 0) {
  const c = audio.ctx, o = c.createOscillator(), a = c.createGain(), fq = f * CJ.f;
  a.gain.value = 0.0001; o.type = type; o.frequency.setValueAtTime(fq, t0); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, fq + slide), t0 + dur);
  a.gain.setValueAtTime(0.0001, t0); a.gain.exponentialRampToValueAtTime(g * CJ.g * CUE_GAIN * audio.vol, t0 + 0.006); a.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(a).connect(OUT); o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(t0, dur, g = 0.2, freq = 2400, q = 1.2, type = 'bandpass', attack = 0.004) {
  const c = audio.ctx, n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(), f = c.createBiquadFilter(), a = c.createGain();
  a.gain.value = 0.0001; src.buffer = b; f.type = type; f.frequency.value = freq * CJ.f; f.Q.value = q;
  a.gain.setValueAtTime(0.0001, t0); a.gain.exponentialRampToValueAtTime(g * CJ.g * CUE_GAIN * audio.vol, t0 + attack); a.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(a).connect(OUT); src.start(t0); src.stop(t0 + dur + 0.02);
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
// brass: inharmonic partials with a slow decay
const bell = (t, f, g = 0.12) => [1, 2.76, 5.4].forEach((m, k) => tone(f * m, t, 1.2 / (k + 1), 'sine', g / (k + 1)));

const DUCK = { chime: [6, 900], featured: [6, 1400], fanfare: [6, 1800] };

// opts: pan (-1..1, kept within +-0.7: the board column of a tile) and step (0.. : semitones up along a word)
export function sfx(name, opts = {}) {
  audio.played.push(name); if (audio.played.length > 30) audio.played.shift();
  if (!audio.on || !audio.fx || !audio.ctx) return;
  const c = audio.ctx, t = c.currentTime, step = opts.step || 0;
  try {
    OUT = audio.sfxOut || c.destination;
    if (opts.pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = Math.max(-0.7, Math.min(0.7, opts.pan)); p.connect(OUT); OUT = p; }
    CJ = jit(25, 1.5); CJ.g *= TRIM[name] || 1;
    switch (name) {
      case 'pick': noise(t, 0.03, 0.12, 4600, 3); tone(1500, t, 0.025, 'triangle', 0.07); break;
      case 'place': clack(t, 1, step); break;
      case 'recall': noise(t, 0.04, 0.16, 3000, 2); tone(420, t, 0.05, 'triangle', 0.06, 80); break;
      case 'shuffle': for (let k = 0; k < 5; k++) clack(t + k * (0.045 + Math.random() * 0.012), 0.45); break;
      case 'play': for (let k = 0; k < 3; k++) clack(t + k * (0.06 + Math.random() * 0.012), 0.8, step + k); tone(523, t + 0.18, 0.18, 'sine', 0.06); break;
      case 'swap': for (let k = 0; k < 7; k++) noise(t + k * (0.05 + Math.random() * 0.01), 0.05, 0.15, 2000 + k * 200, 1.5); break;
      case 'steam': noise(t, 0.9, 0.16, 5200, 0.6, 'highpass', 0.25); break;
      case 'chime': [784, 988, 1175].forEach((f, k) => bell(t + k * 0.11, f, 0.08)); break;
      case 'featured': bell(t, 659, 0.14); bell(t + 0.28, 988, 0.12); noise(t + 0.1, 0.9, 0.12, 5200, 0.6, 'highpass', 0.25); break;
      case 'turn': tone(660, t, 0.12, 'sine', 0.05); break;
      case 'error': tone(196, t, 0.16, 'triangle', 0.1, -40); break;
      case 'fanfare': [523, 659, 784, 1047].forEach((f, k) => bell(t + k * 0.14, f, 0.08)); break;
    }
    if (DUCK[name] && audio.kit && c === audio.live) audio.kit.music.duck(...DUCK[name]);
  } catch (e) { /* audio is optional */ }
  CJ = { f: 1, g: 1 };
}

// ---------- for the tests: render a tune or the bed on its own, offline, at the level the game ships ----------
export const tuneName = () => { const s = audio.kit && audio.kit.music.score; return s ? Object.keys(SCORES).find((n) => SCORES[n] === s) : null; };
export const audioList = () => ({ music: Object.keys(SCORES), ambience: Object.keys(SCENES) });
export function audioRender(name, seconds, wantWav) {
  const music = !!SCORES[name];
  if (!music && !SCENES[name]) return Promise.reject(new Error('no such piece: ' + name));
  return measureAudio((oc, dest) => {
    const g = graph(oc, dest, 7);
    if (music) g.kit.music.play(SCORES[name], { at: 0, fade: 0.05 }); else g.kit.amb.play(SCENES[name], { at: 0, fade: 0.05 });
    g.kit.scheduleUntil(seconds);
    return music ? () => g.kit.music.info() : null;
  }, seconds, { wav: !!wantWav });
}

// One cue rendered offline through the same limiter the player hears, without touching the live audio. The cue is
// made a quarter of a second in, as it would be in a running game (a limiter that has only just started eats the
// first few milliseconds of whatever it is given).
export async function renderCue(name, vol, opts) {
  const off = new OfflineAudioContext(1, 44100 * 2, 44100), g = graph(off, off.destination, 1);
  const done = off.startRendering();
  await off.suspend(0.25);
  const prev = { ctx: audio.ctx, on: audio.on, vol: audio.vol, fx: audio.fx, sfxOut: audio.sfxOut };
  audio.ctx = off; audio.on = true; audio.fx = true; audio.sfxOut = g.sfx; audio.vol = vol;
  try { sfx(name, opts); } finally { Object.assign(audio, prev); }
  off.resume();
  const d = (await done).getChannelData(0);
  let peak = 0, sum = 0, last = 0, zc = 0;
  for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; sum += d[i] * d[i]; if (v > 0.001) last = i; if (i && d[i] * d[i - 1] < 0) zc++; }
  return { peak: +peak.toFixed(3), rms: +Math.sqrt(sum / d.length).toFixed(4), ms: Math.round((last - 11025) / 44.1), zc, sig: Math.round(sum * 1e6) };
}

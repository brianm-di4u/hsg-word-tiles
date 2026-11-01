// Short, quiet WebAudio sounds (adapted from Bathhouse Barons). Created on the first user gesture;
// mutable from Settings. Ceramic clicks for tiles, a soft hiss of steam for bonus words, a brass chime
// for a Full Soak and a bell for a Featured Spring.
export const audio = { ctx: null, on: true, vol: 0.35, played: [] };

export function unlock() {
  if (audio.ctx) { if (audio.ctx.state === 'suspended') audio.ctx.resume(); return; }
  try { const AC = window.AudioContext || window.webkitAudioContext; if (AC) audio.ctx = new AC(); } catch (e) { audio.ctx = null; }
}

function tone(f, t0, dur, type = 'sine', g = 0.3, slide = 0) {
  const c = audio.ctx, o = c.createOscillator(), a = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t0 + dur);
  a.gain.setValueAtTime(0.0001, t0); a.gain.exponentialRampToValueAtTime(g * audio.vol, t0 + 0.006); a.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(a).connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(t0, dur, g = 0.2, freq = 2400, q = 1.2, type = 'bandpass', attack = 0.004) {
  const c = audio.ctx, n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(), f = c.createBiquadFilter(), a = c.createGain();
  src.buffer = b; f.type = type; f.frequency.value = freq; f.Q.value = q;
  a.gain.setValueAtTime(0.0001, t0); a.gain.exponentialRampToValueAtTime(g * audio.vol, t0 + attack); a.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(a).connect(c.destination); src.start(t0); src.stop(t0 + dur + 0.02);
}
// a glazed tile set down on marble: a bright tick over a short low knock
const clack = (t, g = 1) => { noise(t, 0.045, 0.32 * g, 3800, 2.2); tone(310, t, 0.05, 'triangle', 0.12 * g, -90); };
// brass: inharmonic partials with a slow decay
const bell = (t, f, g = 0.12) => [1, 2.76, 5.4].forEach((m, k) => tone(f * m, t, 1.2 / (k + 1), 'sine', g / (k + 1)));

export function sfx(name) {
  audio.played.push(name); if (audio.played.length > 30) audio.played.shift();
  if (!audio.on || !audio.ctx) return;
  const t = audio.ctx.currentTime;
  try {
    switch (name) {
      case 'pick': noise(t, 0.03, 0.18, 4600, 3); break;
      case 'place': clack(t); break;
      case 'recall': noise(t, 0.04, 0.16, 3000, 2); tone(420, t, 0.05, 'triangle', 0.06, 80); break;
      case 'shuffle': for (let k = 0; k < 5; k++) clack(t + k * 0.045, 0.45); break;
      case 'play': for (let k = 0; k < 3; k++) clack(t + k * 0.06, 0.8); tone(523, t + 0.18, 0.18, 'sine', 0.06); break;
      case 'swap': for (let k = 0; k < 7; k++) noise(t + k * 0.05, 0.05, 0.15, 2000 + k * 200, 1.5); break;
      case 'steam': noise(t, 0.9, 0.16, 5200, 0.6, 'highpass', 0.25); break;
      case 'chime': [784, 988, 1175].forEach((f, k) => bell(t + k * 0.11, f, 0.08)); break;
      case 'featured': bell(t, 659, 0.14); bell(t + 0.28, 988, 0.12); noise(t + 0.1, 0.9, 0.12, 5200, 0.6, 'highpass', 0.25); break;
      case 'turn': tone(660, t, 0.12, 'sine', 0.05); break;
      case 'error': tone(196, t, 0.16, 'triangle', 0.1, -40); break;
      case 'fanfare': [523, 659, 784, 1047].forEach((f, k) => bell(t + k * 0.14, f, 0.08)); break;
    }
  } catch (e) { /* audio is optional */ }
}

// Wave 3, batch W3-B19: W4-S5-01 (the parlour voicing of the lobby and the table).
import { makeAudioKit, SCORES } from '../src/js/music.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });

// The kit on a stand-in audio context that writes down every oscillator it starts; composing is seeded, so every run is the same.
function compose(score, { seed = 7, seconds = 64, intensity = 0 } = {}) {
  const oscs = [];
  const param = () => ({ value: 0, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
  const node = () => ({ gain: param(), frequency: param(), Q: param(), detune: param(), pan: param(), delayTime: param(), type: '', connect(d) { return d; }, disconnect() {}, start() {}, stop() {} });
  const ctx = {
    sampleRate: 100, state: 'running', currentTime: 0, createGain: node, createBiquadFilter: node, createDelay: node, createStereoPanner: node, createBufferSource: node,
    createBuffer: (_, len) => ({ getChannelData: () => new Float32Array(len) }),
    createOscillator: () => { const o = { ...node(), start(at) { oscs.push({ at, type: o.type, f: o.frequency.value }); } }; return o; },
  };
  const kit = makeAudioKit(ctx, node(), { seed, music: 1, ambience: 1 });
  kit.music.intensity(intensity);
  kit.music.play(score, { at: 0, fade: 0.05 });
  kit.scheduleUntil(seconds);
  return { oscs, info: kit.music.info(), INST: kit.INST };
}
const leadOnly = (s) => ({ ...s, pad: null, bass: null, comp: null });
const barOf = (s, at) => Math.floor(at / (240 / s.bpm) + 1e-6);

export const tests = [
  {
    name: 'W4-S5-01 the lobby and the table swing lightly, lead with a soft mallet and a clarinet without vibrato, and keep piano out of the A sections (Node)',
    node: true,
    async run(t) {
      for (const n of ['lobby', 'table']) {
        const s = SCORES[n], { INST } = compose(s);
        t.expect(s.swing >= 0.12 && s.swing <= 0.15, `${n} swings gently (${s.swing})`);
        // off-beat notes land late by the swing; nothing lands on the straight eighth
        const off = new Set(compose(leadOnly(s)).oscs.map((o) => +((o.at / (60 / s.bpm)) % 1).toFixed(4)).filter((x) => x > 0.001 && x < 0.999));
        t.equal([...off].join(), String((1 + s.swing) / 2), `${n}: every off-beat note is swung`);
        t.expect(INST[s.lead.inst] && !INST[s.lead.inst].vib && s.lead.inst !== 'flute' && s.lead.inst !== s.comp.inst, `${n} leads with ${s.lead.inst}: no vibrato, and not the piano that accompanies`);
        // the comping is what differs between the tune and the tune without it
        const perBar = (score) => { const c = {}; for (const o of compose(score).oscs) { const b = barOf(s, o.at); c[b] = (c[b] || 0) + 1; } return c; };
        const full = perBar(s), bare = perBar({ ...s, comp: null });
        const label = [...s.form].flatMap((l) => s.sections[l].map(() => l));
        const bars = Object.keys(full).map(Number).filter((b) => b < Math.floor(64 / (240 / s.bpm)));
        const a = bars.filter((b) => label[b % label.length] === 'A'), b2 = bars.filter((b) => label[b % label.length] === 'B');
        t.expect(a.length >= 8 && a.every((b) => full[b] === bare[b]), `${n}: no piano in the ${a.length} A bars`);
        t.expect(b2.length >= 3 && b2.every((b) => full[b] > bare[b]), `${n}: piano in each of the ${b2.length} B bars`);
        t.expect(s.comp.gain <= 0.01 && s.comp.gain < SCORES.finale.comp.gain, `${n}: the piano is a whisper (${s.comp.gain})`);
        t.expect(s.bass.pattern === 'root' && !s.perc, `${n}: no walking bass, no drums (CD-WF4-05)`);
      }
    },
  },
  {
    name: 'W4-S5-01 the lobby tune uses nine to twelve pitches whatever the seed (Node)',
    node: true,
    async run(t) {
      // 400 fixed seeds: before this item 59 in 100 of them reached nine pitches in 64 s
      let ok = 0, notes = 0; const N = 400;
      for (let k = 1; k <= N; k++) { const { pitches, notes: c } = compose(SCORES.lobby, { seed: k * 7919 }).info; if (pitches >= 9 && pitches <= 12) ok++; notes += c; }
      const seed7 = compose(SCORES.lobby).info;
      t.log(`lobby over ${N} seeds: 9 to 12 pitches in ${(100 * ok / N).toFixed(1)}%, ${(notes / N).toFixed(1)} notes in 64 s; seed 7: ${seed7.pitches} pitches, ${seed7.notes} notes`);
      t.expect(ok / N >= 0.95, `nine to twelve pitches on at least 95% of seeds (${ok} of ${N})`);
      t.expect(seed7.pitches >= 9 && seed7.pitches <= 12, `and in the rendered take (${seed7.pitches})`);
      t.expect(notes / N < 56, `still unhurried: under 56 notes in 64 s (${(notes / N).toFixed(1)})`);
    },
  },
  {
    name: 'W4-S5-01 the brush and the octave lift are kept for the end of a game (Node)',
    node: true,
    async run(t) {
      const freqs = (x) => [...new Set(compose(leadOnly(SCORES.table), { intensity: x, seconds: 40 }).oscs.map((o) => Math.round(o.f)))].sort((p, q) => p - q);
      const low = freqs(0.55), high = freqs(0.9);
      t.equal(high.length, low.length, 'the same tune');
      t.expect(Math.abs(Math.min(...high) / Math.min(...low) - 2) < 0.02, `an octave up at 0.9 only (${Math.min(...low)} Hz to ${Math.min(...high)} Hz)`);
      t.equal(JSON.stringify(freqs(0.6)), JSON.stringify(low), 'not lifted at 0.6');
      const { perc2, perc } = SCORES.table;
      t.expect(!perc && perc2 && Object.keys(perc2).sort().join() === 'b,gain', 'the only drum is the brush, and only at high intensity');
    },
  },
  {
    name: 'W4-S5-01 the new voicing renders as quietly as before and never clips',
    viewports: ['desktop'],
    async run(t) {
      await ready(t);
      // before this item, 64 s: lobby -16.8 dBFS peak and -32.9 rms, table -17.8 and -30.9
      for (const n of ['lobby', 'table']) {
        const r = await t.game('audioRender', n, 64), full = await t.game('audioRender', n, 64, false, { vol: 1 });
        t.log(`${n}: peak ${r.peak} (${r.peakDb} dBFS), rms ${r.rmsDb} dB, ${r.built.pitches} pitches, ${r.built.notes} notes, at full volume ${full.peak}`);
        t.expect(r.peakDb <= -16.6 && r.peakDb >= -21 && r.rmsDb >= -33.6 && r.rmsDb <= -30.5, `${n} stays near -17 dBFS and as loud as it was (${r.peakDb} peak, ${r.rmsDb} rms)`);
        t.expect(full.peak <= 0.88, `${n} at full volume stays under 0.88 (${full.peak})`);
      }
    },
  },
];

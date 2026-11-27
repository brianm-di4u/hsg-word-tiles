// Wave 3, batch W3-B19: W4-S5-01 (the parlour voicing of the lobby and the table) and W4-S5-02 (music that follows the game,
// and a resolution tune after a loss).
import { makeAudioKit, SCORES } from '../src/js/music.js';

const heard = () => { window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant' })); };
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
const awake = async (t) => { await ready(t); await t.page.click('#screen [data-go="setup"]'); await t.page.waitForFunction(() => window.__game.audioState().ctx === 'running', null, { timeout: 5000 }); };
const mood = (t) => t.page.evaluate(() => { const a = window.__game.audioState(); return { tune: a.tune, x: a.intensity }; });
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
  {
    name: 'W4-S5-02 SCORES.dusk is a slower, darker resolution of the same length (Node)',
    node: true,
    async run(t) {
      const d = SCORES.dusk, f = SCORES.finale;
      t.expect(d && d.bpm >= 64 && d.bpm <= 66 && d.bpm < f.bpm, `dusk at 66 bpm, under the finale's ${f.bpm}`);
      t.equal(JSON.stringify(d.scale), JSON.stringify([0, 2, 3, 5, 7, 9, 10]), 'a dorian scale: a minor third');
      t.expect(d.key % 12 === 2 && d.lp === 2600 && d.lp < f.lp, 'D dorian under a 2600 Hz low-pass');
      t.expect(d.lead.inst === 'piano' && d.pad && !d.perc && !d.perc2 && !d.comp, 'a soft piano and a pad, nothing else added');
      t.equal(d.sections.A[d.sections.A.length - 1], 0, 'it comes to rest on the tonic');
      const { info } = compose(d, { seconds: 60 });
      t.expect(info.formBars * 4 * 60 / d.bpm >= 45 && info.distinctBars >= 6 && info.pitches >= 6, `form and variation (${info.formBars} bars, ${info.distinctBars} distinct, ${info.pitches} pitches)`);
    },
  },
  {
    name: 'W4-S5-02 the table music follows the bag and the Daily turns, also on a sheet opened over the table',
    viewports: ['desktop', 'mobile'],
    initScript: heard,
    async run(t) {
      await awake(t);
      await t.game('newGame', { seed: 5, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
      await t.waitIdle(8000);
      t.equal(JSON.stringify(await mood(t)), JSON.stringify({ tune: 'table', x: 0 }), 'a new game starts calm');
      const game = (await t.state()).game, got = [];
      for (const n of [46, 45, 30, 15, 14, 7, 6, 1, 0]) { game.bag = Array(n).fill('E'); await t.game('setState', { game }); got.push(n + ':' + (await mood(t)).x); }
      t.equal(got.join(' '), '46:0 45:0.25 30:0.25 15:0.25 14:0.55 7:0.55 6:0.6 1:0.6 0:0.9', 'Play: 0.25 at 45 tiles, 0.55 at 14 (the brush), 0.6 when swaps close, 0.9 when the bag is empty (the lift)');
      await t.game('scene', 'help');
      t.equal(JSON.stringify(await mood(t)), JSON.stringify({ tune: 'table', x: 0.9 }), 'Help opened over the table keeps its music as it was');
      await t.game('scene', 'title');
      t.equal(JSON.stringify(await mood(t)), JSON.stringify({ tune: 'lobby', x: 0 }), 'the title is calm');
      await t.game('newGame', { mode: 'daily', seed: 4 });
      await t.waitIdle(8000);
      const daily = [];
      for (let turn = 1; turn <= 10; turn++) {
        daily.push((await mood(t)).x);
        if (turn === 10) break;
        const move = (await t.state()).game.move;
        await t.game('act', 'pass');
        await t.page.waitForFunction((n) => window.__G.s.move > n && performance.now() >= window.__G.busyUntil, move, { timeout: 10000 });
      }
      t.equal(daily.join(' '), '0 0 0 0 0 0.3 0.3 0.55 0.55 0.9', 'Daily Soak, turns 1 to 10');
    },
  },
  {
    name: 'W4-S5-02 the results after a loss play the dusk tune; a win, a tie, computers only and a Daily keep the finale',
    viewports: ['desktop', 'mobile'],
    initScript: heard,
    async run(t) {
      await awake(t);
      const over = (winners, kinds = ['human', 'ai']) => ({
        mode: 'play', seed: 1, rng: { bag: 1, ai: 2 }, over: true, scoreless: 0, round: 5, move: 12, cur: 0, bag: [], board: Array(225).fill(null), featured: [],
        players: kinds.map((kind, k) => ({ kind, name: kind === 'ai' ? 'Opal Vance' : `P${k}`, ...(kind === 'ai' ? { persona: 'opal', level: 'easy' } : {}), score: winners.includes(k) ? 320 : 210, best: null, hints: kind === 'ai' ? null : 3, rack: [] })),
        log: [{ p: 0, kind: 'play', n: 0, score: 42, full: 0, themed: 10, words: [{ w: 'SPRING', score: 32, bonus: 10, themed: 'spring' }], tiles: [] }, { kind: 'end' }],
        result: { why: 'out', out: winners[0], adjust: kinds.map(() => 0), winners },
      });
      const tuneAfter = async (g) => { await t.game('setState', { game: g, scene: 'over' }); return (await mood(t)).tune; };
      t.equal(await tuneAfter(over([0])), 'finale', 'a win');
      t.equal(await tuneAfter(over([1])), 'dusk', 'a loss to the computer');
      t.expect(await t.page.locator('.over-loss').count() === 1, 'on the loss sheet');
      await t.game('scene', 'records');
      t.equal((await mood(t)).tune, 'dusk', 'a sheet opened from it keeps the tune');
      t.equal(await tuneAfter(over([0, 1])), 'finale', 'a tie');
      t.equal(await tuneAfter(over([1], ['human', 'human'])), 'finale', 'Pass-and-Play always has a human winner');
      t.equal(await tuneAfter(over([1], ['ai', 'ai'])), 'finale', 'computers only');
      await t.game('newGame', { seed: 5 });
      t.equal((await mood(t)).tune, 'table', 'a new game goes back to the table tune');
      const d = over([0], ['human']); d.mode = 'daily'; d.daily = { date: '2026-11-20', turns: 0 }; d.result.why = 'daily';
      t.equal(await tuneAfter(d), 'finale', 'a Daily Soak');
    },
  },
  {
    name: 'W4-S5-02 a real game lost to the computer ends on the dusk tune, and every stage of the music stays quiet and unclipped',
    viewports: ['desktop'],
    initScript: heard,
    async run(t) {
      await awake(t);
      await t.game('newGame', { seed: 5, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
      await t.waitIdle(8000);
      // far behind with an empty bag: the person passes until the engine ends the game
      const game = (await t.state()).game;
      game.bag = []; game.players[0].score = 10; game.players[1].score = 300; game.cur = 0;
      await t.game('setState', { game });
      for (let k = 0; k < 12 && !(await t.page.evaluate(() => window.__G.s.over)); k++) {
        await t.page.waitForFunction(() => window.__G.s.over || window.__G.s.players[window.__G.s.cur].kind === 'human', null, { timeout: 15000 });
        if (!(await t.page.evaluate(() => window.__G.s.over))) await t.game('act', 'pass');
      }
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 15000 });
      t.equal(JSON.stringify(await mood(t)), JSON.stringify({ tune: 'dusk', x: 0 }), 'the loss ends on the dusk tune');
      await t.shot('w3-b19-loss');
      const rows = [];
      for (const [n, x] of [['table', 0], ['table', 0.25], ['table', 0.3], ['table', 0.55], ['table', 0.6], ['table', 0.9], ['dusk', 0], ['finale', 0]]) {
        const r = await t.game('audioRender', n, 40, false, { intensity: x });
        rows.push(`${n} ${x}: ${r.peakDb} dBFS peak, ${r.rmsDb} rms`);
        t.expect(r.peakDb <= -15 && r.rmsDb <= -28 && r.longestSilence <= 2, `${n} at ${x} stays quiet (${r.peakDb} peak, ${r.rmsDb} rms)`);
        if (x !== 0 && x !== 0.9) continue;
        const full = await t.game('audioRender', n, 40, false, { intensity: x, vol: 1 });
        t.expect(full.peak <= 0.88, `${n} at ${x} and full volume stays under 0.88 (${full.peak})`);
      }
      t.log(rows.join(' | '));
    },
  },
];

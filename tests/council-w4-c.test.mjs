// Wave 4, batch C: sound (C4-07, S5-11, S5-12, S5-14); layout and accessibility, world, words and ceremony
// (S1-20, C4-02, C4-03, S2-24).
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
// the cues are random on purpose; the test seeds them, so a run gives the same peaks every time
const seeded = (seed) => new Function(`
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false }));
  let a = ${seed} >>> 0;
  Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
`);
const CENTER = 112;
async function start(t, rack, extra = {}) {
  await ready(t);
  await t.game('newGame', { seed: 3, ...extra });
  await t.waitIdle(5000);
  const s = await t.state();
  if (rack) { s.game.players[0].rack = rack.split(''); Object.assign(s.game, extra.patch || {}); await t.game('setState', { game: s.game }); await t.waitIdle(); }
}
const across = (word, at = CENTER - 3) => [...word].map((l, k) => ({ i: at + k, l }));

export const tests = [
  // ---------- C4-07 ----------
  {
    name: 'C4-07 a play that finds a Featured Spring (with a Full Soak) stays under 0.95 at full volume, over 20 repeats',
    viewports: ['desktop'],
    initScript: seeded(11),
    async run(t) {
      await start(t, 'THERMAL', { patch: { featured: [{ id: 'thermal', word: 'THERMAL', cat: 'springs', shown: [0], by: null, at: null }] } });
      // stage and play in one turn of the event loop, so the cues read are the human play's own
      const r = await t.page.evaluate(async (tl) => {
        await window.__game.act('stage', tl);
        const ok = await window.__game.act('play');
        const a = window.__game.audioState(), at = a.cues.map((c) => c.name).lastIndexOf('play');
        return { ok: ok.ok, cues: a.cues.slice(at), entry: window.__game.getState().game.log.filter((x) => x.kind === 'play').pop() };
      }, across('THERMAL'));
      t.expect(r.ok && r.entry.featured === 'THERMAL' && r.entry.full > 0, 'THERMAL was a Featured Spring and a Full Soak');
      const names = r.cues.map((c) => c.name);
      t.expect(names.includes('featured') && names.includes('chime'), 'the play made the bell and the chime (' + names.join(',') + ')');
      // what the game schedules is what is measured: each cue with its own delay
      const mix = r.cues.filter((c) => ['play', 'featured', 'chime'].includes(c.name)).map((c) => c.name + '@' + c.delay).join('+');
      const render = async (n) => { const p = []; for (let k = 0; k < 20; k++) p.push((await t.game('act', 'renderSfx', n, 1)).peak); return p; };
      for (const n of [mix, 'play+featured']) {
        const p = await render(n);
        t.log(n + ' at full volume: ' + Math.min(...p) + '..' + Math.max(...p));
        t.expect(Math.max(...p) < 0.95, n + ' stays under 0.95 with the volume at full (' + Math.max(...p) + ')');
      }
      const typical = await render('featured');
      t.expect([...typical].sort((x, y) => x - y)[10] > 0.3, 'the bell is still heard at full volume (median ' + [...typical].sort((x, y) => x - y)[10] + ')');
    },
  },
  // ---------- S5-11 ----------
  {
    name: 'S5-11 cues cut their noise from shared buffers: playing them allocates no new audio buffer, and they still differ and last',
    viewports: ['desktop'],
    initScript: new Function(`
      window.__TEST_TIPS__ = false; window.__buffers = 0;
      if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant' }));
      const made = BaseAudioContext.prototype.createBuffer;
      BaseAudioContext.prototype.createBuffer = function (...a) { window.__buffers++; return made.apply(this, a); };`),
    async run(t) {
      await ready(t);
      await t.page.click('#screen [data-go="setup"]');
      await t.page.waitForFunction(() => window.__game.audioState().ctx === 'running', null, { timeout: 5000 });
      await t.waitForStable(300);
      const before = await t.page.evaluate(() => window.__buffers);
      t.expect(before >= 3, 'the three shared buffers were made when the audio started (' + before + ')');
      const after = await t.page.evaluate(async () => {
        for (let k = 0; k < 5; k++) for (const n of ['shuffle', 'swap', 'steam', 'featured', 'play', 'place', 'pick', 'recall']) await window.__game.act('sfx', n);
        return window.__buffers;
      });
      t.equal(after, before, 'forty cues (shuffle, swap, steam, featured and more) made no new buffer');
      const sigs = []; for (let k = 0; k < 8; k++) sigs.push((await t.game('act', 'renderSfx', 'shuffle', 0.35)).sig);
      t.expect(new Set(sigs).size >= 7, 'repeats of a shuffle still differ (' + new Set(sigs).size + ' of 8)');
      const steam = await t.game('act', 'renderSfx', 'steam', 0.35);
      t.expect(steam.ms >= 700 && steam.peak > 0.05, 'the longest noise cue still plays to its end (' + steam.ms + ' ms, peak ' + steam.peak + ')');
    },
  },
];

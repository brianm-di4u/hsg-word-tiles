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
  // ---------- S5-12 ----------
  {
    name: 'S5-12 the bells are rounder: less above 5 kHz than before, and they still ring and sit where they did',
    viewports: ['desktop'],
    initScript: seeded(5),
    async run(t) {
      await ready(t);
      const med = (p) => [...p].sort((x, y) => x - y)[p.length >> 1];
      // measured on this seed before the change (medians of 12 repeats at the shipped volume, peak of what lies above 5 kHz):
      // chime 0.106, fanfare 0.094, discover 0.070; after: 0.075, 0.066, 0.049
      const LIMIT = { chime: 0.09, fanfare: 0.08, discover: 0.06 };
      for (const n of Object.keys(LIMIT)) {
        const hi = [], whole = [], ms = [];
        for (let k = 0; k < 12; k++) {
          hi.push((await t.game('act', 'renderSfx', n, 0.35, { hp: 5000 })).peak);
          const r = await t.game('act', 'renderSfx', n, 0.35); whole.push(r.peak); ms.push(r.ms);
        }
        t.log(n + ' above 5 kHz median ' + med(hi) + ', whole ' + med(whole) + ', rings ' + med(ms) + ' ms');
        t.expect(med(hi) < LIMIT[n], n + ' has little above 5 kHz (median ' + med(hi) + ', under ' + LIMIT[n] + ')');
        t.expect(med(whole) >= 0.15 && med(whole) <= 0.45, n + ' is still as loud as a bell was (median ' + med(whole) + ')');
        t.expect(med(ms) >= 1000, n + ' still rings for a second or more (' + med(ms) + ' ms)');
      }
    },
  },
  // ---------- S5-14 ----------
  {
    name: 'S5-14 a hint sets its tiles down one after another, softly, and dropping a rack tile in a new place makes the pick sound',
    viewports: ['desktop', 'mobile'],
    initScript: seeded(21),
    async run(t) {
      await ready(t);
      await t.seed(21);
      await t.game('newGame', { seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
      await t.waitIdle(8000);
      const since = async (total) => { const a = await t.game('audioState'); return a.cues.slice(a.cues.length - (a.total - total)); };
      let total = (await t.game('audioState')).total;
      const n = await t.game('act', 'hint');
      let heard = await since(total);
      const places = heard.slice(heard.map((c) => c.name).lastIndexOf('hint') + 1).filter((c) => c.name === 'place');
      t.expect(n >= 2 && places.length === n, 'one clack for each of the ' + n + ' tiles of the hint (' + places.length + ')');
      t.expect(places.every((c, k) => Math.abs(c.delay - k * 0.06) < 1e-9), 'each 60 ms after the one before (' + places.map((c) => c.delay).join(', ') + ')');
      t.expect(places.every((c) => c.gain === 0.5), 'each at half the level of a tile you place yourself');
      // a tile of the rack dragged to another place on the rack
      await t.game('act', 'recall');
      await t.waitForStable(200);
      const first = await t.game('act', 'rackTile', 0), third = await t.game('act', 'rackTile', 3);
      const orderBefore = (await t.state()).order;
      total = (await t.game('audioState')).total;
      await t.page.mouse.move(third[0], third[1]); await t.page.mouse.down();
      await t.page.mouse.move((third[0] + first[0]) / 2, third[1], { steps: 6 });
      await t.page.mouse.move(first[0] - 10, first[1], { steps: 6 }); await t.page.mouse.up();
      const order = (await t.state()).order;
      heard = (await since(total)).map((c) => c.name);
      t.expect(order[0] === orderBefore[3], 'the fourth tile moved to the front of the rack (' + orderBefore.join('') + ' became ' + order.join('') + ')');
      t.equal(heard.join(','), 'pick,pick', 'it was picked up and set down again, both with the pick sound');
      // a drag that ends where it started on the rack still sounds; a tap does not drop anything
      total = (await t.game('audioState')).total;
      const tile = await t.game('act', 'rackTile', 2);
      await t.page.mouse.click(tile[0], tile[1]);
      t.equal((await since(total)).map((c) => c.name).join(','), 'pick', 'a tap on a rack tile is one pick only');
    },
  },
  // ---------- S1-20 ----------
  {
    name: 'S1-20 a bigger play has a bigger, longer score pop and a big everyday play throws brass sparks; a small play and a Hot Springs word do not',
    viewports: ['desktop', 'mobile'],
    initScript: seeded(3),
    async run(t) {
      // two people, so no reply from the computer adds a pop of its own
      const twoPeople = { seats: [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }] };
      const best = async (rack, pick) => {
        await start(t, rack, twoPeople);
        const list = await t.game('act', 'moves', 200);
        const ok = list.filter((m) => !m.words.some((w) => w.themed || w.bonus));
        return pick(ok);
      };
      const playNow = (tiles) => t.page.evaluate(async (tl) => {
        await window.__game.act('stage', tl);
        const r = await window.__game.act('play');
        const pops = [...document.querySelectorAll('.pop')], el = pops[pops.length - 1], st = window.__game.getState();
        const cs = el && getComputedStyle(el);
        return { ok: r.ok, size: el ? parseFloat(cs.fontSize) : 0, secs: el ? parseFloat(cs.animationDuration) : 0, text: el ? el.textContent : '', sparks: st.sparks, sweeps: st.sweeps,
          inside: el ? (() => { const a = el.getBoundingClientRect(), b = document.querySelector('#boardwrap').getBoundingClientRect(); return a.left >= b.left - 1 && a.right <= b.right + 1; })() : false };
      }, tiles);
      const small = await best('AEIRSTN', (ok) => ok.reduce((a, m) => (m.score < a.score ? m : a)));
      const smallPlay = await playNow(small.tiles);
      t.expect(smallPlay.ok && small.score <= 14, 'a small everyday play of ' + small.score + ' points');
      t.equal(smallPlay.size, 25.6, 'its pop is the plain size (1.6 rem)'); t.equal(smallPlay.secs, 1.3, 'and the plain 1.3 s');
      t.equal(smallPlay.sparks, 0, 'no sparks');
      const big = await best('PLAYING', (ok) => ok.reduce((a, m) => (m.score > a.score ? m : a)));   // all seven tiles: a Full Soak, which is not a Hot Springs word
      const bigPlay = await playNow(big.tiles);
      t.expect(bigPlay.ok && big.score >= 45, 'a big everyday play of ' + big.score + ' points');
      const w = Math.min(1, Math.max(0, (big.score - 14) / 46));
      t.expect(Math.abs(bigPlay.size - 25.6 * (1 + 0.6 * w)) < 0.1 && bigPlay.size > smallPlay.size + 5, 'its pop is bigger (' + bigPlay.size + ' px against ' + smallPlay.size + ')');
      t.expect(Math.abs(bigPlay.secs - 1.3 * (1 + 0.3 * w)) < 0.02 && bigPlay.secs > smallPlay.secs, 'and lasts longer (' + bigPlay.secs + ' s against ' + smallPlay.secs + ')');
      t.expect(bigPlay.sparks >= 5 * big.tiles.length, 'it throws brass sparks (' + bigPlay.sparks + ' for ' + big.tiles.length + ' tiles)');
      t.expect(bigPlay.inside, 'the pop is inside the board area');
      // a Hot Springs word keeps its steam and sweep and gets no sparks
      await t.page.waitForFunction(() => window.__game.getState().sparks === 0, null, { timeout: 5000 });   // the first play's sparks have gone
      await start(t, 'SPRINGE', twoPeople);
      const themed = await playNow(across('SPRING'));
      t.expect(themed.ok && themed.sweeps > 0 && themed.sparks === 0, 'a Hot Springs word sweeps gold and throws no sparks');
    },
  },
  {
    name: 'S1-20 with animation off there is no pop and no sparks for a big play',
    viewports: ['desktop'],
    reducedMotion: true,
    initScript: seeded(3),
    async run(t) {
      await start(t, 'PLAYING', { seats: [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }] });
      const list = await t.game('act', 'moves', 200);
      const m = list.filter((x) => !x.words.some((w) => w.themed || w.bonus)).reduce((a, x) => (x.score > a.score ? x : a));
      await t.game('act', 'stage', m.tiles); await t.game('act', 'play');
      t.expect(m.score >= 45, 'a big play of ' + m.score);
      t.equal(await t.page.locator('.pop').count(), 0, 'no pop');
      t.equal((await t.state()).sparks, 0, 'no sparks');
    },
  },
  {
    name: 'S1-20 the big pop and the brass sparks over the tiles, as a player sees them',
    viewports: ['desktop', 'mobile'],
    initScript: new Function(`window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'slow', sound: false }));`),
    async run(t) {
      await start(t, 'PLAYING');
      const list = await t.game('act', 'moves', 50);
      const m = list.reduce((a, x) => (x.score > a.score ? x : a));
      await t.game('act', 'stage', m.tiles); await t.game('act', 'play');
      t.expect((await t.state()).sparks > 0 && await t.page.locator('.pop').count() === 1, 'the pop and the sparks are showing (' + m.score + ' points)');
      await t.shot('S1-20-big-pop', { wait: false });
    },
  },
  // ---------- C4-02 ----------
  {
    name: 'C4-02 About says how the art was made, in one plain line that fits at both sizes',
    viewports: ['desktop', 'mobile'],
    initScript: seeded(1),
    async run(t) {
      await ready(t);
      await t.game('scene', 'about');
      await t.waitForStable(300);
      const r = await t.page.evaluate(() => {
        const sheet = document.querySelector('.sheet.about'), line = [...sheet.querySelectorAll('p')].find((p) => /^Art:/.test(p.textContent));
        if (!line) return null;
        line.scrollIntoView({ block: 'center' });
        const b = line.getBoundingClientRect(), s = sheet.getBoundingClientRect();
        const lineCount = Math.round(b.height / parseFloat(getComputedStyle(line).lineHeight));
        return { text: line.textContent, left: b.left, right: b.right, vw: innerWidth, sheetOver: sheet.scrollWidth - sheet.clientWidth, docOver: document.documentElement.scrollWidth - innerWidth, lineCount, all: sheet.textContent };
      });
      t.expect(r, 'the About sheet has an Art line');
      t.equal(r.text, 'Art: painted with AI image tools for this game.', 'it says exactly that');
      t.expect(!/OpenAI|Codex|Midjourney|Claude/i.test(r.all), 'and names no company or product');
      t.expect(r.left >= 0 && r.right <= r.vw && r.sheetOver <= 1 && r.docOver <= 0, 'nothing overflows (line ' + Math.round(r.left) + ' to ' + Math.round(r.right) + ' of ' + r.vw + ' px)');
      t.expect(r.lineCount <= 2, 'it fits in two lines at most (' + r.lineCount + ')');
      await t.shot('C4-02-about-art-line', { wait: false });
    },
  },
];

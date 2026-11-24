// Wave 4, batch C: sound (C4-07, S5-11, S5-12, S5-14); layout and accessibility, world, words and ceremony
// (S1-20, C4-02, C4-03, S2-24).
import fs from 'node:fs';
import path from 'node:path';
import { ctx, root } from './lib.mjs';
import { has } from '../src/js/dict.js';
import { createGame } from '../src/js/engine.js';
import { SQUARE } from '../src/js/score.js';
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
  {
    name: 'C4-07 a plain Full Soak (no Featured Spring) has its chime follow the play and stays under 0.95 at full volume',
    viewports: ['desktop'],
    initScript: seeded(17),
    async run(t) {
      await start(t, 'SEALING');
      const r = await t.page.evaluate(async (tl) => {
        await window.__game.act('stage', tl);
        const ok = await window.__game.act('play');
        const a = window.__game.audioState(), at = a.cues.map((c) => c.name).lastIndexOf('play');
        return { ok: ok.ok, cues: a.cues.slice(at), entry: window.__game.getState().game.log.filter((x) => x.kind === 'play').pop() };
      }, across('SEALING'));
      t.expect(r.ok && !r.entry.featured && r.entry.full > 0, 'SEALING was a Full Soak and not a Featured Spring');
      const chime = r.cues.find((c) => c.name === 'chime');
      t.expect(chime && chime.delay > 0.2, 'the chime is scheduled after the play, not on it (delay ' + (chime && chime.delay) + ')');
      const mix = r.cues.filter((c) => ['play', 'chime'].includes(c.name)).map((c) => c.name + '@' + c.delay).join('+');
      const p = []; for (let k = 0; k < 40; k++) p.push((await t.game('act', 'renderSfx', mix, 1)).peak);
      t.log(mix + ' at full volume: ' + Math.min(...p) + '..' + Math.max(...p));
      t.expect(Math.max(...p) < 0.95, mix + ' stays under 0.95 with the volume at full (' + Math.max(...p) + ')');
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
    name: 'S1-20 with animation off there is no rising big pop and no sparks for a big play',
    viewports: ['desktop'],
    reducedMotion: true,
    initScript: seeded(3),
    async run(t) {
      await start(t, 'PLAYING', { seats: [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }] });
      const list = await t.game('act', 'moves', 200);
      const m = list.filter((x) => !x.words.some((w) => w.themed || w.bonus)).reduce((a, x) => (x.score > a.score ? x : a));
      await t.game('act', 'stage', m.tiles); await t.game('act', 'play');
      t.expect(m.score >= 45, 'a big play of ' + m.score);
      const pop = await t.page.evaluate(() => {
        const el = document.querySelector('.pop');
        if (!el) return null;
        const cs = getComputedStyle(el);
        return { staticCls: el.classList.contains('static'), anim: cs.animationName, rise: el.style.getPropertyValue('--rise'), size: parseFloat(cs.fontSize) };
      });
      t.expect(!!pop && pop.staticCls && pop.anim === 'pop-fade' && pop.rise === '0%' && pop.size <= 26, 'only 0px static unscaled pop crossfade, no rising big pop');
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
  // ---------- C4-03 ----------
  {
    name: 'C4-03 three card texts and eleven bonus words, as the owner approved them; every form is in the dictionary; the deal of a Daily does not move', node: true,
    async run(t) {
      const REWRITES = {"trail": "Seven of Phase One's 14 miles of the Northwoods trail system opened on Nov. 17, 2018.", "cupola": "The Quapaw's chevron-mosaic dome is topped by a small copper cupola.", "copper": "Wikipedia describes the Fordyce's marquee as stained glass and copper, with a Greek-motif parapet."};
      const NEW = [["cold", ["COLD"], 1, "springs", "Mountain Valley water comes out of its spring cold, not hot; the cold spring is about a dozen miles north of downtown Hot Springs."], ["pharmacist", ["PHARMACIST", "PHARMACISTS"], 3, "town", "Pharmacist Peter E. Greene first sold Mountain Valley water in 1871; he and his brother John renamed the water for a nearby community."], ["mob", ["MOB", "MOBS", "MOBSTER", "MOBSTERS"], 1, "club", "The Gangster Museum of America, on Central Avenue, is dedicated to Hot Springs' mob history."], ["bass", ["BASS", "BASSES"], 1, "park", "Striped bass must be stocked in Lake Ouachita every year because they do not reproduce naturally there."], ["cruise", ["CRUISE", "CRUISES"], 1, "park", "Lake Ouachita State Park runs eagle-watch cruises in January and February to look for bald eagles."], ["jellyfish", ["JELLYFISH", "JELLYFISHES"], 2, "park", "Lake Ouachita has non-stinging freshwater jellyfish, and freshwater sponges too."], ["cedar", ["CEDAR", "CEDARS"], 1, "park", "AGFC and the Corps mostly used cedar for new fish brush piles in Lake Ouachita."], ["film", ["FILM", "FILMS"], 1, "town", "Sy Gomberg's 1991 visit inspired the Hot Springs Documentary Film Festival. Gomberg then headed the Academy's documentary branch."], ["movie", ["MOVIE", "MOVIES"], 1, "town", "The Fordyce, the Arlington and Maxine's were three Hot Springs locations used to film the movie Arkansas."], ["mare", ["MARE", "MARES"], 1, "track", "Zenyatta, an unbeaten mare, won Oaklawn's Apple Blossom in 2008 and 2010; the 2010 win was her 16th straight victory."], ["bleacher", ["BLEACHER", "BLEACHERS"], 2, "track", "The surviving cement bleachers on the hillside at Hot Springs' old Ban Johnson Park are called the \"Wolves Den,\" which was a fan section."]];
      const raw = JSON.parse(fs.readFileSync(path.join(root, 'data/thermal-words.json'), 'utf8')), game = JSON.parse(fs.readFileSync(path.join(root, 'data/lexicon.game.json'), 'utf8'));
      const c = await ctx();
      for (const [id, text] of Object.entries(REWRITES)) {
        t.equal(raw.words.find((w) => w.id === id).fact.text, text, id + ' card text');
        t.equal(game.words.find((w) => w.id === id).fact.text, text, id + ' card text in the built data');
      }
      const copper = game.words.find((w) => w.id === 'copper').fact;
      t.expect(/Wikipedia/.test(copper.src), 'the COPPER card names Wikipedia as its source (' + copper.src + ')');
      for (const [id, forms, tier, cat, text] of NEW) {
        const w = raw.words.find((x) => x.id === id);
        t.expect(!!w && JSON.stringify(w.forms) === JSON.stringify(forms) && w.tier === tier && w.cat === cat && w.fact.text === text, id + ' is in with its forms, tier, category and card');
        for (const f of forms) t.expect(has(c.dict, f) && c.lex.entry(f) && c.lex.entry(f).id === id, f + ' is a dictionary word and a bonus word');
      }
      for (const f of ['RACE', 'RACER']) t.expect(!!c.lex.entry(f), f + ' keeps its bonus');
      const forms = raw.words.reduce((a, w) => a + w.forms.length, 0);
      t.equal(raw.words.length, 107, '107 entries'); t.equal(forms, 290, '290 forms');
      t.equal(game.words.length, raw.words.length, 'the built data has them all');
      const PRD = fs.readFileSync(path.join(root, 'PRD.md'), 'utf8'), REPORT = fs.readFileSync(path.join(root, 'REPORT.md'), 'utf8');
      t.expect(PRD.includes('107 entries / 290 forms') && REPORT.includes('107 entries, 290 playable forms'), 'PRD.md and REPORT.md state the new counts');
      // a Daily's three Featured Springs come from a pool that stays the size it was (82), so no past or future date is dealt differently
      t.expect(!c.lex.featurable.some((f) => NEW.some((n) => n[0] === f.id)), 'none of the new words can be a Featured Spring');
      t.equal(c.lex.featurable.length, 82, 'the Featured Spring pool is the size it was');
      const feat = (date) => createGame({ mode: 'daily', date, seats: [{ kind: 'human', name: 'You' }] }, c.lex).featured.map((f) => f.word).join();
      t.equal(feat('2026-03-04'), 'DOMED,CHAPELS,PINBALLS', 'the Featured Springs of 4 March 2026 are as they were');
    },
  },
  // ---------- S2-24 ----------
  {
    name: 'S2-24 open glass and Bathhouse Row squares are dimmed once tiles cover the board, over the 3D board',
    viewports: ['desktop', 'mobile'],
    initScript: seeded(2),
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 3 });
      await t.waitIdle(5000);
      await t.waitForStable(300);   // the board has been painted with its glass
      t.log('board mode: ' + ((await t.state()).view.mode3d ? '3D' : 'flat'));
      // an open premium square far from the first word, and a Bathhouse Row one
      const pick = (kind, from) => SQUARE.findIndex((k, i) => k === kind && i >= from);
      const squares = { glass: pick('h', 15 * 2), row: pick('B', 15 * 2) };
      // the overlay canvas: mean alpha and mean luminance in a patch near a square's corner (clear of its figures and of any tile)
      const patch = (i) => t.page.evaluate(async (cell) => {
        const cv = document.getElementById('board'), k = cv.width / cv.clientWidth, [x, y] = await window.__game.act('cell', cell), [x2] = await window.__game.act('cell', cell + 1);
        const c = Math.abs(x2 - x), r = Math.round(0.07 * c * k), px = Math.round((x - 0.36 * c) * k), py = Math.round((y - 0.36 * c) * k);
        const d = cv.getContext('2d').getImageData(px - r, py - r, 2 * r, 2 * r).data;
        let a = 0, l = 0, n = 0;
        for (let j = 0; j < d.length; j += 4) { a += d[j + 3]; l += (d[j] + d[j + 1] + d[j + 2]) / 3; n++; }
        return { alpha: a / n, lum: l / n };
      }, i);
      t.expect(squares.glass > 0 && squares.glass < 105 && squares.row > 0 && squares.row < 105, 'the squares measured are open ones (' + squares.glass + ', ' + squares.row + ')');
      const empty = { glass: await patch(squares.glass), row: await patch(squares.row) };
      // tiles along the middle row and the one below: about 24, so the wash is at its most
      const g = (await t.state()).game;
      for (let k = 0; k < 24; k++) g.board[105 + k] = { l: 'ETAOINSHR'[k % 9], blank: false };
      await t.game('setState', { game: g });
      await t.waitIdle(5000);
      await t.waitForStable(300);
      const full = { glass: await patch(squares.glass), row: await patch(squares.row) };
      const mode3d = (await t.state()).view.mode3d;
      for (const key of ['glass', 'row']) {
        t.log(key + ' square (' + (mode3d ? '3D overlay' : 'flat') + '): alpha ' + empty[key].alpha.toFixed(1) + ' to ' + full[key].alpha.toFixed(1) + ', luminance ' + empty[key].lum.toFixed(1) + ' to ' + full[key].lum.toFixed(1));
        if (mode3d) t.expect(empty[key].alpha < 1 && full[key].alpha > 25 && full[key].alpha < 55, key + ' square: no wash on the empty board, then a light one (alpha ' + full[key].alpha.toFixed(1) + ')');
        else t.expect(full[key].lum < empty[key].lum * 0.92 && full[key].lum > empty[key].lum * 0.75, key + ' square is dimmer once tiles cover the board, but not dark (' + empty[key].lum.toFixed(0) + ' to ' + full[key].lum.toFixed(0) + ')');
      }
      await t.shot('S2-24-dimmed-discs-' + (mode3d ? '3d' : 'flat'));
    },
  },
  {
    name: 'S2-24 the START banner on the flat board is wider than the old 0.84 of the square and still holds its word',
    viewports: ['desktop', 'mobile'],
    url: 'index.html?gl=0',
    initScript: seeded(2),
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 3 });
      await t.waitIdle(5000);
      t.expect(!(await t.state()).view.mode3d, 'the flat board is showing');
      const r = await t.page.evaluate(async () => {
        const cv = document.getElementById('board'), k = cv.width / cv.clientWidth, [x, y] = await window.__game.act('cell', 112), [x2] = await window.__game.act('cell', 113), c = Math.abs(x2 - x);
        const row = cv.getContext('2d').getImageData(Math.round((x - 0.6 * c) * k), Math.round(y * k), Math.round(1.2 * c * k), 1).data;   // the line across the middle of the banner: its dark ends lie outside the letters
        let lo = -1, hi = -1;
        for (let j = 0; j < row.length; j += 4) if (row[j] < 70 && row[j + 1] < 65 && row[j + 2] < 60) { if (lo < 0) lo = j / 4; hi = j / 4; }
        const mid = row;
        let gold = 0;
        for (let j = 0; j < mid.length; j += 4) if (mid[j] > 200 && mid[j + 1] > 170 && mid[j + 2] < 150) gold++;
        return { wide: (hi - lo + 1) / (k * c), gold, cell: c };
      });
      t.log('START banner ' + r.wide.toFixed(2) + ' of a cell wide, ' + r.gold + ' gold pixels on its middle line');
      t.expect(r.wide >= 0.84, 'the banner is at least 0.84 of a cell wide inside its rim (it was 0.77; now ' + r.wide.toFixed(2) + ')');
      t.expect(r.wide <= 0.98, 'and stays inside its square');
      t.expect(r.gold > 8, 'the letters are drawn on it (' + r.gold + ' gold pixels)');
      await t.shot('S2-24-start-banner');
    },
  },
];
tests.push({ ...tests.find((x) => x.name.startsWith('S2-24 open glass')), name: 'S2-24 open glass and Bathhouse Row squares are dimmed once tiles cover the board, on the flat board', url: 'index.html?gl=0' });

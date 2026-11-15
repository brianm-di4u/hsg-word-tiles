// Wave 3, batch D: S4-19, S1-04, S1-07, S2-02, S2-06, S2-09, S4-05, S4-09, S2-14 and S3-15 (feedback, teaching, help and records).
import { BATHHOUSES, ROWS, SIZE } from '../src/js/layout.js';
import { stallNote } from '../src/js/ui.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => { window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false })); };
const CENTER = 112;
const REGISTER = 'hs-letters-register-v1';
async function start(t, rack, extra = {}) {
  await ready(t);
  await t.game('newGame', { seed: 3, ...extra });
  await t.waitIdle(5000);
  const s = await t.state();
  if (rack) { s.game.players[0].rack = rack.split(''); await t.game('setState', { game: s.game }); await t.waitIdle(); }
}
const across = (word, at = CENTER - 2) => [...word].map((l, k) => ({ i: at + k, l }));
// stage and play in one go inside the page and read what the play showed in the same turn of the event loop, before any reply or timer can change it
const playNow = (t, tiles) => t.page.evaluate(async (tl) => {
  await window.__game.act('stage', tl);
  const r = await window.__game.act('play');
  return { ok: r.ok, longPops: document.querySelectorAll('.pop.themed').length, pops: document.querySelectorAll('.pop').length, toast: document.querySelector('#toast').textContent, sweeps: window.__game.getState().sweeps };
}, tiles);
const geom = (t) => t.page.evaluate(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); return { prev: Math.round(r('#preview').height), rack: Math.round(r('#rack').top), play: Math.round(r('#actions .play').top) }; });

// a finished two-seat game: seat 0 is a person; `plays` are the log entries of both seats
function finished(o) {
  return {
    mode: 'play', seed: 1, rng: { bag: 1, ai: 2 }, over: true, scoreless: 0, round: 5, move: 12, cur: 0, bag: [], board: Array(225).fill(null),
    featured: o.featured || [],
    players: [{ kind: 'human', name: 'You', score: o.you, best: { word: 'QUARTZ', score: 54 }, hints: 3, rack: [] }, { kind: 'ai', name: 'Opal', persona: 'opal', level: 'easy', score: o.opal, best: null, hints: null, rack: [] }],
    log: [...(o.log || []), { kind: 'end' }],
    result: { why: 'out', out: 0, adjust: o.adjust || [0, 0], winners: o.winners },
  };
}
const play = (p, score, extra = {}) => ({ p, kind: 'play', n: 0, score, full: 0, themed: 0, words: [{ w: 'WORD', score, bonus: 0 }], tiles: [], ...extra });

export const tests = [
  // ---------- S4-19 ----------
  {
    name: 'S4-19 a Hot Springs word sweeps gold over its tiles, its pop stays longer and a first find says it is new in the Register; an everyday word does none of it',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await start(t, 'SPRINGE');
      await t.game('act', 'freezeFx', 0);   // the sweep is not removed while the clock is frozen, so its start can be read
      const r = await playNow(t, across('SPRING'));
      t.expect(r.ok, 'SPRING is played');
      t.expect(r.sweeps >= 1, 'a gold sweep was started for the Hot Springs word (' + r.sweeps + ')');
      t.expect(/New in your Register/.test(r.toast), 'the first find says it is new in the Register (' + r.toast + ')');
      t.equal(r.longPops, 1, 'the score pop is the long one');
      let s = await t.state();
      // freeze the overlay half way through the sweep and look at its pixels: gold light over the word
      await t.game('act', 'freezeFx', s.sweepAt + 450);
      await t.page.waitForFunction(() => { const c = document.querySelector('#fx'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let k = 0; k < d.length; k += 4) if (d[k + 3] > 40 && d[k] >= 250 && d[k + 1] >= 215 && d[k + 2] <= 135) n++; return n > 200; }, null, { timeout: 5000 });
      await t.shot('S4-19-gold-sweep');
      await t.shot('S4-19-themed-word');
      // the same word again is no longer new
      await t.page.waitForFunction((k) => !!localStorage.getItem(k), REGISTER, { timeout: 5000 });
      await t.reload();
      await t.game('act', 'freezeFx', 0);
      await t.game('newGame', { seed: 3 }); await t.waitIdle(5000);
      s = await t.state(); s.game.players[0].rack = 'SPRINGE'.split(''); await t.game('setState', { game: s.game });
      const again = await playNow(t, across('SPRING'));
      t.expect(/SPRING/.test(again.toast) && !/New in your Register/.test(again.toast), 'a word already signed in is not new (' + again.toast + ')');
      // an everyday word: no sweep and the short pop
      await t.game('newGame', { seed: 3, seats: [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }] }); await t.waitIdle(5000);   // two people, so no computer reply adds a pop of its own
      await t.game('act', 'reveal');
      await t.page.waitForFunction(() => !document.querySelector('.pop.themed'), null, { timeout: 5000 });   // the first game's long pop has gone
      s = await t.state(); s.game.players[0].rack = 'QIXXXXX'.split(''); await t.game('setState', { game: s.game });
      const before = (await t.state()).sweeps;
      const q = await playNow(t, [{ i: CENTER, l: 'Q' }, { i: CENTER + 1, l: 'I' }]);
      t.expect(q.ok, 'QI is played');
      t.equal(q.sweeps, before, 'an everyday word starts no sweep');
      t.equal(q.longPops, 0, 'and has no long pop');
      t.equal(q.pops, 1, 'only the ordinary one');
    },
  },
  {
    name: 'S4-19 under reduced motion there is no sweep and no long pop, but the Register note stays',
    viewports: ['desktop'],
    reducedMotion: true,
    initScript: quiet,
    async run(t) {
      await start(t, 'SPRINGE');
      await t.game('act', 'stage', across('SPRING')); await t.game('act', 'play');
      const s = await t.state();
      t.equal(s.sweeps, 0, 'no sweep');
      t.equal(await t.page.locator('.pop').count(), 0, 'no pop');
      t.expect(/New in your Register/.test(s.toast), 'the text is still there');
    },
  },
  // ---------- S1-04 ----------
  {
    name: 'S1-04 placing a tile puts a waiting toast away so the strip shows the play again, and clears the ones queued behind it',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await start(t, 'SPRINGE');
      for (const n of [1, 2, 3]) await t.game('act', 'toast', { kind: 'themed', title: 'SPRING +10 ' + n, sub: 'Place' });
      t.expect(await t.page.locator('#toast.on').count() === 1 && await t.page.locator('#app.toasting').count() === 1, 'a toast is up and the strip is covered');
      await t.game('act', 'stage', across('SPRING'));
      t.equal(await t.page.locator('#toast.on').count(), 0, 'staging a tile puts the toast away');
      t.equal(await t.page.locator('#app.toasting').count(), 0, 'and uncovers the strip');
      await t.page.waitForFunction(() => /SPRING/.test(document.querySelector('#preview').textContent) && /pts/.test(document.querySelector('#preview').textContent), null, { timeout: 3000 });
      const col = await t.page.evaluate(() => getComputedStyle(document.querySelector('#preview .pts')).color);
      t.expect(col !== 'rgba(0, 0, 0, 0)', 'the score is readable (' + col + ')');
      // the queued toasts do not come back after the 200 ms the old code waited
      await t.page.waitForTimeout(600);
      t.equal(await t.page.locator('#toast.on').count(), 0, 'nothing queued behind it comes up');
    },
  },
  // ---------- S1-07 ----------
  {
    name: 'S1-07 the rack and the buttons stay where they are whether the strip shows nothing, a score, a refusal or a long message',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await start(t, 'SPRINGE');
      const base = await geom(t);
      const seen = [['empty', base]];
      await t.game('act', 'play');   // "Place tiles on the board first."
      seen.push(['refusal', await geom(t)]);
      await t.game('act', 'stage', [{ i: CENTER, l: 'S' }]);
      seen.push(['one tile', await geom(t)]);
      await t.game('act', 'stage', [{ i: CENTER + 1, l: 'P' }]);
      seen.push(['not a word', await geom(t)]);
      await t.game('act', 'recall');
      await t.game('act', 'stage', across('SPRING'));
      seen.push(['a word', await geom(t)]);
      await t.game('act', 'stage', [{ i: 20, l: 'S' }]);   // a tile far from the Display Spring: the opening rule is the refusal
      seen.push(['a refusal on the board', await geom(t)]);
      await t.game('act', 'recall');
      // after the computer has played the strip holds its quote and the last play, two lines
      await t.game('act', 'stage', across('SPRING')); await t.game('act', 'play');
      await t.page.waitForFunction(() => { const g = window.__game.getState(); return g.game.cur === 0 && !g.aiThinking && g.game.move >= 2; }, null, { timeout: 20000 });
      await t.game('act', 'recall');
      seen.push(['after the computer played', await geom(t)]);
      for (const [name, g] of seen) t.equal(g.rack + ',' + g.play, base.rack + ',' + base.play, name + ': the rack and Play stay put (' + JSON.stringify(g) + ')');
      if (t.viewport === 'mobile') t.expect(base.prev >= 52, 'the strip is two lines high on a phone (' + base.prev + ' px, was 40)');
      await t.shot('S1-07-strip');
    },
  },
  // ---------- S2-02 ----------
  {
    name: 'S2-02 a square says what it is: under the mouse on desktop, after a tap on a phone, with the bathhouse named and the Row bonus as it is now',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await start(t);
      const at = async (i) => t.game('act', 'screen', i);
      const say = async (i) => {
        const [x, y] = await at(i);
        if (t.viewport === 'mobile') await t.tap([x, y]); else await t.page.mouse.move(x, y);
        await t.page.waitForFunction(() => /doubles|triples|Bathhouse|Display Spring/.test(document.querySelector('#preview').textContent), null, { timeout: 3000 });
        return (await t.page.textContent('#preview')).trim();
      };
      const BATH = [[8, 'Superior'], [26, 'Hale'], [216, 'Lamar']];
      for (const [i, name] of BATH) {
        const txt = await say(i);
        t.expect(txt.includes(name + ' Bathhouse') && /\+20/.test(txt) && !/twice/.test(txt), 'square ' + i + ' names ' + name + ' and the +20 (' + txt + ')');
      }
      t.expect(/Hot spring|Warm spring|Steam|Boiling/.test(await say(4)), 'a premium square says what it multiplies');
      t.expect(/Display Spring/.test(await say(CENTER)), 'the Display Spring is named by its name');
      await t.shot('S2-02-square-info');
      if (t.viewport === 'mobile') {
        // with a tile placed the strip is for the play, not for a square
        await t.game('act', 'stage', [{ i: CENTER, l: (await t.game('act', 'rackTile', 0))[2] }]);
        const [x, y] = await at(4);
        await t.tap([x, y]);
        t.expect(!/Boiling|Steam|Warm|Hot spring/.test(await t.page.textContent('#preview')), 'a tap with tiles placed leaves the strip alone');
      }
    },
  },
  // ---------- S4-09 ----------
  {
    name: 'S4-09 reading the board from the top down, the Bathhouse Row squares come in the sourced order',
    node: true,
    async run(t) {
      const order = Object.entries(BATHHOUSES).map(([i, n]) => [+i, n]).sort((a, b) => a[0] - b[0]).map(([, n]) => n);
      t.equal(order.join(' '), 'Superior Hale Maurice Fordyce Quapaw Ozark Buckstaff Lamar', 'north to south, top row to bottom row');
      const rows = Object.keys(BATHHOUSES).map((i) => Math.floor(i / SIZE));
      t.expect(rows.every((r, k) => k === 0 || r > rows[k - 1]), 'each one is on a lower row than the one before (' + rows.join(',') + ')');
      for (const i of Object.keys(BATHHOUSES)) t.equal(ROWS[Math.floor(i / SIZE)][i % SIZE], 'B', 'square ' + i + ' is a Row square');
      for (const i of Object.keys(BATHHOUSES)) t.expect(BATHHOUSES[SIZE * SIZE - 1 - i] !== undefined, 'and it has a partner across the board (' + i + ')');
    },
  },
  // ---------- S2-06 ----------
  {
    name: 'S2-06 the stall note counts what is left: nothing early, a count within one round, and a plain warning on the last turn',
    node: true,
    async run(t) {
      const g = (n, scoreless, extra = {}) => ({ mode: 'play', over: false, players: Array.from({ length: n }, () => ({})), scoreless, ...extra });
      t.equal(stallNote(g(2, 0)), '', 'two seats, a fresh game: nothing');
      t.equal(stallNote(g(2, 1)), '', 'one pass: nothing');
      t.equal(stallNote(g(2, 2)), '2 more turns without a score end the game.', 'two seats, two in a row: two more end it');
      t.equal(stallNote(g(2, 3)), 'A turn with no score now ends the game.', 'three: the next one');
      t.equal(stallNote(g(2, 3), true), 'Passing now ends the game.', 'the same, worded for the Pass box');
      t.equal(stallNote(g(2, 2), true), 'After this, 1 more turn without a score would end the game.', 'two in a row, passing: one more after this');
      t.equal(stallNote(g(4, 3)), '', 'four seats: the limit is eight, three is not near');
      t.equal(stallNote(g(4, 4)), '4 more turns without a score end the game.', 'four seats, one round in');
      t.equal(stallNote(g(2, 3, { mode: 'daily' })), '', 'a Daily has no stall rule');
      t.equal(stallNote(g(2, 3, { over: true })), '', 'a finished game has no note');
    },
  },
  {
    name: 'S2-06 in the game the strip and the Pass box warn when passing would end the game, and say nothing early',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await start(t);
      let s = await t.state();
      await t.game('setState', { game: { ...s.game, scoreless: 1 } });
      t.expect(!/without a score/.test(await t.page.textContent('#preview')), 'one pass in a row: the strip says nothing');
      s = await t.state();
      await t.game('setState', { game: { ...s.game, scoreless: 3 } });
      t.expect(/A turn with no score now ends the game/.test(await t.page.textContent('#preview')), 'three in a row: the strip warns (' + (await t.page.textContent('#preview')).trim() + ')');
      await t.page.click('[data-act="pass"]');
      await t.page.waitForSelector('.dialog');
      const dlg = await t.page.textContent('.dialog');
      t.expect(/Passing now ends the game\./.test(dlg), 'the Pass box says so (' + dlg.trim().slice(0, 120) + ')');
      await t.shot('S2-06-pass-ends');
      await t.page.keyboard.press('Escape');
      await t.waitIdle(3000);
      s = await t.state();
      await t.game('setState', { game: { ...s.game, scoreless: 2 } });
      await t.page.click('[data-act="pass"]');
      await t.page.waitForSelector('.dialog');
      t.expect(/1 more turn without a score would end the game/.test(await t.page.textContent('.dialog')), 'two in a row: the Pass box counts one more');
    },
  },
  // ---------- S2-09 ----------
  {
    name: 'S2-09 a tap on a Featured Spring plaque names its category and what the word is worth, on a phone too',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await start(t);
      const cat = await t.page.evaluate(() => { const f = window.__G.s.featured[0]; return { cat: window.__G.lex.categories[f.cat].name, len: f.word.length }; });
      await t.page.click('[data-plaque="0"]');
      const txt = (await t.page.textContent('#preview')).trim();
      t.expect(txt.includes(cat.cat) && txt.includes(cat.len + ' letters') && /\+30/.test(txt), 'the strip says the category, the length and +30 (' + txt + ')');
      const vis = await t.page.evaluate(() => { const b = document.querySelector('.plaque'); return { label: b.getAttribute('aria-label'), cat: getComputedStyle(b.querySelector('.pcat')).display, h: Math.round(b.getBoundingClientRect().height) }; });
      t.expect(/Featured Spring 1/.test(vis.label) && vis.label.includes(cat.cat), 'a screen reader hears it too');
      await t.shot('S2-09-plaques');
    },
  },
];

// Wave 3, batch F: S2-22 (a short buzz on your own moves), S3-04 (a finished Register category), S4-04 (steam keeps rising
// after the first word), S2-08 (the board for a screen reader) and S3-05 (Hard's defence counts Steam squares).
import fs from 'node:fs';
import path from 'node:path';
import { root } from './lib.mjs';
import { categoriesCompleted } from '../src/js/ui.js';
import { makeLexicon } from '../src/js/lexicon.js';
import { openedPremium, DEFENSE } from '../src/js/ai.js';
import { ROWS, BATHHOUSES } from '../src/js/layout.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const KEY = 'hs-letters-settings-v1';
const CENTER = 112;
const lexicon = () => makeLexicon(JSON.parse(fs.readFileSync(path.join(root, 'data/thermal-words.json'), 'utf8')));
const across = (word, at = CENTER - 2) => [...word].map((l, k) => ({ i: at + k, l }));
// every call to navigator.vibrate is written down; the page has the function, as a phone does
const withVibrate = (extra) => new Function(`
  window.__TEST_TIPS__ = false; window.__vib = [];
  navigator.vibrate = (p) => { window.__vib.push(p); return true; };
  if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify(Object.assign({ ai: 'instant', sound: false }, ${JSON.stringify(extra)})));
`);
const vib = (t) => t.page.evaluate(() => window.__vib);
async function start(t, rack) {
  await ready(t);
  await t.game('newGame', { seed: 3 });
  await t.waitIdle(5000);
  const s = await t.state();
  if (rack) { s.game.players[0].rack = rack.split(''); await t.game('setState', { game: s.game }); await t.waitIdle(); }
}
const live = (t) => t.page.textContent('#live');
const liveIs = (t, text) => t.page.waitForFunction((w) => document.querySelector('#live').textContent === w, text, { timeout: 4000 }).catch(() => {});

export const tests = [
  // ---------- S2-22 ----------
  {
    name: 'S2-22 your own moves buzz a phone briefly, and the computer\'s do not',
    viewports: ['desktop', 'mobile'],
    initScript: withVibrate({ vibrate: true, motion: 'full' }),
    async run(t) {
      await start(t, 'SPRINGE');
      t.equal((await vib(t)).length, 0, 'nothing buzzes at the start of a game');
      await t.page.evaluate((tl) => window.__game.act('stage', tl), across('SPRING'));
      let v = await vib(t);
      t.equal(v.length, 6, 'one short buzz for each tile staged (' + JSON.stringify(v) + ')');
      t.expect(v.every((x) => x === 10), 'each is 10 ms');
      await t.page.evaluate(() => window.__game.act('play'));
      v = await vib(t);
      t.equal(v[v.length - 1], 20, 'playing is 20 ms (' + JSON.stringify(v.slice(-2)) + ')');
      const mine = v.length;
      await t.waitIdle(10000);
      t.equal((await vib(t)).length, mine, 'the computer\'s reply and its tiles landing buzz nothing');
      await t.page.evaluate(() => window.__game.act('play'));   // nothing staged: a refusal
      v = await vib(t);
      t.equal(JSON.stringify(v[v.length - 1]), '[30,40,30]', 'a refused move is a double pulse (' + JSON.stringify(v.slice(-1)) + ')');
    },
  },
  {
    name: 'S2-22 Vibration off, and reduced motion, keep it still; the switch is saved',
    viewports: ['desktop', 'mobile'],
    initScript: withVibrate({ vibrate: false }),
    async run(t) {
      await start(t, 'SPRINGE');
      await t.page.evaluate((tl) => window.__game.act('stage', tl), across('SPRING'));
      t.equal((await vib(t)).length, 0, 'with Vibration off nothing buzzes');
      await t.game('scene', 'settings');
      await t.page.waitForSelector('[data-set="vibrate"]');
      await t.shot('S2-22-settings');
      t.equal(await t.page.getAttribute('[data-set="vibrate"][data-val="false"]', 'aria-checked'), 'true', 'Settings shows it off');
      await t.page.click('[data-set="vibrate"][data-val="true"]');
      t.equal((await vib(t)).length, 1, 'switching it on gives one short buzz to feel');
      const set = await t.page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
      t.equal(set.vibrate, true, 'and it is saved');
      await t.reload();
      t.equal((await t.state()).settings.vibrate, true, 'it survives a reload');
      await t.page.evaluate(() => { const s = JSON.parse(localStorage.getItem('hs-letters-settings-v1')); s.motion = 'reduce'; localStorage.setItem('hs-letters-settings-v1', JSON.stringify(s)); });
      await t.reload();
      await t.page.evaluate(() => { window.__vib = []; navigator.vibrate = (p) => { window.__vib.push(p); return true; }; });
      await start(t, 'SPRINGE');
      await t.page.evaluate((tl) => window.__game.act('stage', tl), across('SPRING'));
      t.equal((await vib(t)).length, 0, 'with reduced motion nothing buzzes even with Vibration on');
      await t.page.evaluate(() => { const s = JSON.parse(localStorage.getItem('hs-letters-settings-v1')); s.vibrate = 'yes'; localStorage.setItem('hs-letters-settings-v1', JSON.stringify(s)); });
      await t.reload();
      t.equal(typeof (await t.state()).settings.vibrate, 'boolean', 'a damaged value falls back to a switch');
    },
  },
  {
    name: 'S2-22 a browser without vibration does not show the switch',
    viewports: ['desktop'],
    initScript: () => { window.__TEST_TIPS__ = false; Object.defineProperty(Navigator.prototype, 'vibrate', { value: undefined, configurable: true }); localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false })); },
    async run(t) {
      await ready(t);
      await t.game('scene', 'settings');
      await t.page.waitForSelector('[data-set="theme"]');
      t.equal(await t.page.locator('[data-set="vibrate"]').count(), 0, 'no Vibration row where nothing can buzz');
      await start(t, 'SPRINGE');
      const r = await t.page.evaluate((tl) => window.__game.act('stage', tl), across('SPRING'));
      t.expect(r.ok, 'and staging a tile still works');
    },
  },
  // ---------- S3-04 ----------
  {
    name: 'S3-04 finishing a Register category is marked (Node)', node: true,
    async run(t) {
      const lex = lexicon();
      const club = lex.data.words.filter((w) => w.cat === 'club');
      const entry = (e, form) => ({ id: e.id, first: '2026-01-01', count: 1, best: 10, form });
      const reg = {}; for (const e of club.slice(1)) reg[e.forms[0]] = entry(e);
      const last = club[0];
      t.equal(categoriesCompleted(lex, reg, [{ w: last.forms[0], themed: last.id }]).join(), 'club', 'the last word of Clubs & casinos finishes it');
      t.equal(categoriesCompleted(lex, {}, [{ w: last.forms[0], themed: last.id }]).length, 0, 'the first word of it does not');
      t.equal(categoriesCompleted(lex, reg, [{ w: 'CAT', themed: null }]).length, 0, 'an ordinary word does not');
      const done = { ...reg, [last.forms[0]]: entry(last) };
      t.equal(categoriesCompleted(lex, done, [{ w: last.forms[0], themed: last.id }]).length, 0, 'a category already complete is not announced again');
      const plural = last.forms[last.forms.length - 1];
      t.expect(plural !== last.forms[0], 'the word has a second form');
      t.equal(categoriesCompleted(lex, reg, [{ w: plural, themed: last.id }]).join(), 'club', 'another form of the word counts as well');
    },
  },
  {
    name: 'S3-04 the play that finishes a category says so, with its own cue, and the Register marks it',
    viewports: ['desktop', 'mobile'],
    initScript: withVibrate({ vibrate: false }),
    async run(t) {
      const lex = lexicon();
      const club = lex.data.words.filter((w) => w.cat === 'club');
      const target = club.slice().sort((a, b) => a.forms[0].length - b.forms[0].length)[0], word = target.forms[0];
      const reg = {}; for (const e of club) if (e !== target) reg[e.forms[0]] = { id: e.id, first: '2026-01-01', count: 1, best: 10 };
      await ready(t);
      await t.page.evaluate((r) => localStorage.setItem('hs-letters-register-v1', JSON.stringify(r)), reg);
      await t.reload();
      await start(t, (word + 'EEEEEEE').slice(0, 7));
      const placed = await t.page.evaluate((tl) => window.__game.act('stage', tl), across(word));
      t.expect(placed.ok, 'the word is staged');
      await t.page.evaluate(() => window.__game.act('play'));
      await t.page.waitForFunction(() => /complete/.test(window.__game.getState().toast), null, { timeout: 8000 });
      const toast = (await t.state()).toast;
      t.expect(/Clubs & casinos: complete/.test(toast), 'a toast names the category (' + toast + ')');
      await t.shot('S3-04-category-complete');
      const heard = (await t.game('audioState')).played;
      t.expect(heard.includes('fanfare'), 'and the fanfare sounds (' + heard.join(',') + ')');
      await t.waitIdle(10000);
      await t.game('scene', 'register');
      await t.page.waitForSelector('.reg-cat');
      const head = await t.page.textContent('.reg-cat:nth-of-type(5) h2');
      t.expect(/\d+ \/ \d+ · complete/.test(head), 'the Register marks the finished category (' + head.trim() + ')');
      t.equal(await t.page.locator('.reg-cat h2 small', { hasText: 'complete' }).count(), 1, 'and only that one');
      await t.shot('S3-04-register');
    },
  },
  {
    name: 'S3-04 a play that does not finish a category gets no completion toast',
    viewports: ['desktop'],
    initScript: withVibrate({ vibrate: false }),
    async run(t) {
      await start(t, 'SPRINGE');
      await t.page.evaluate((tl) => window.__game.act('stage', tl), across('SPRING'));
      await t.page.evaluate(() => window.__game.act('play'));
      await t.page.waitForFunction(() => /\+\d/.test(window.__game.getState().toast), null, { timeout: 8000 });
      const st = await t.state();
      t.expect(!/complete/.test(st.toast), 'no completion toast (' + st.toast + ')');
      t.expect(!(await t.game('audioState')).played.includes('fanfare'), 'no fanfare');
    },
  },
  {
    name: 'S3-04 the fanfare of a finished category sits in the mix at full volume',
    viewports: ['desktop'],
    initScript: withVibrate({ vibrate: false }),
    async run(t) {
      await ready(t);
      const med = (p) => [...p].sort((x, y) => x - y)[p.length >> 1];
      const render = async (n, vol, read = 'peak') => { const p = []; for (let k = 0; k < 20; k++) p.push((await t.game('act', 'renderSfx', n, vol))[read]); return p; };
      const typical = await render('fanfare', 0.35);
      t.log('fanfare typical median ' + med(typical));
      t.expect(med(typical) >= 0.2 && med(typical) <= 0.45, 'it is typically between 0.2 and 0.45 (median ' + med(typical) + ')');
      const full = await render('play+fanfare@0.28', 1, 'prePeak');   // before the ceiling, which would hide a cue that is too loud
      t.log('play+fanfare full-volume most ' + Math.max(...full));
      t.expect(Math.max(...full) < 0.95, 'it stays under 0.95 with the volume at full (' + Math.max(...full) + ')');
    },
  },
  // ---------- S4-04 ----------
  {
    name: 'S4-04 steam keeps rising from the Bathhouse Row squares after the first word, and not with reduced motion',
    viewports: ['desktop', 'mobile'],
    initScript: withVibrate({ vibrate: false, motion: 'full' }),
    async run(t) {
      await start(t, 'SPRINGE');
      await t.page.evaluate((tl) => window.__game.act('stage', tl), across('SPRING'));
      await t.page.evaluate(() => window.__game.act('play'));
      await t.waitIdle(10000);
      t.expect((await t.state()).game.board[CENTER], 'the Display Spring is covered');
      const rows = Object.keys(BATHHOUSES).map(Number);
      // wisps are emitted every 1.6 s: wait for one that rises from a Row square (a condition, not a time)
      await t.page.waitForFunction((r) => { const w = window.__game.getState().wisps; return w.some((i) => r.includes(i)) && !w.includes(112); }, rows, { timeout: 15000 });
      const st = await t.state();
      const w = st.wisps.filter((i) => rows.includes(i));
      t.expect(w.every((i) => !st.game.board[i]), 'only from Row squares still showing (' + w.join(',') + ')');
      t.expect(!st.wisps.includes(CENTER), 'none from the covered Display Spring');
      await t.shot('S4-04-steam-after-first-word', { wait: false });
      await t.page.evaluate(() => { const s = JSON.parse(localStorage.getItem('hs-letters-settings-v1')); s.motion = 'reduce'; localStorage.setItem('hs-letters-settings-v1', JSON.stringify(s)); });
      await t.reload();
      await t.game('scene', 'game');
      // with reduced motion the loop does not run: no wisp appears over several of its emission periods
      await t.page.waitForTimeout(4000);
      t.equal((await t.state()).wisps.length, 0, 'reduced motion: no wisps');
    },
  },
  // ---------- S2-08 ----------
  {
    name: 'S2-08 the arrow keys say what is under the cursor and what the square is worth',
    viewports: ['desktop', 'mobile'],
    initScript: withVibrate({ vibrate: false }),
    async run(t) {
      await start(t, 'SPRINGE');
      await t.page.focus('#board');
      await t.page.keyboard.press('ArrowRight');
      await liveIs(t, 'I8, empty');
      t.equal(await live(t), 'I8, empty', 'one step right of the centre is I8, plain');
      t.equal(ROWS[7][3], 'w', 'the board layout has a Warm square at D8');
      for (let k = 0; k < 5; k++) await t.page.keyboard.press('ArrowLeft');
      await liveIs(t, 'D8, empty, Warm spring: doubles the letter on it');
      t.equal(await live(t), 'D8, empty, Warm spring: doubles the letter on it', 'a premium square is named with its worth');
      for (let k = 0; k < 4; k++) await t.page.keyboard.press('ArrowRight');
      await liveIs(t, 'H8, empty, The Display Spring: the first word covers it');
      t.equal(await live(t), 'H8, empty, The Display Spring: the first word covers it', 'the centre is the Display Spring');
      await t.page.evaluate((tl) => window.__game.act('stage', tl), across('SPRING'));
      await t.page.keyboard.press('ArrowLeft'); await t.page.keyboard.press('ArrowRight'); await t.page.keyboard.press('ArrowRight');
      await liveIs(t, 'I8, your tile I, not played yet');
      t.equal(await live(t), 'I8, your tile I, not played yet', 'a tile you have placed is read, and not as played');
      await t.page.evaluate(() => window.__game.act('play'));
      await t.waitIdle(10000);
      await t.page.focus('#board');
      await t.page.evaluate((i) => { window.__G.cursor.i = i; }, CENTER);
      await t.page.keyboard.press('ArrowRight');
      await liveIs(t, 'I8, tile I');
      t.equal(await live(t), 'I8, tile I', 'a played tile is read as a tile');
    },
  },
  {
    name: 'S2-08 Read the board lists every tile by its square',
    viewports: ['desktop', 'mobile'],
    initScript: withVibrate({ vibrate: false }),
    async run(t) {
      await start(t, 'SPRINGE');
      await t.page.evaluate((tl) => window.__game.act('stage', tl), across('SPRING'));
      await t.page.evaluate(() => window.__game.act('play'));
      await t.waitIdle(10000);
      await t.game('act', 'recall');
      await t.page.keyboard.press('Escape');
      await t.page.waitForSelector('[data-open="boardtext"]');
      await t.page.click('[data-open="boardtext"]');
      await t.page.waitForSelector('.boardtext');
      const rows = await t.page.$$eval('.boardtext li', (l) => l.map((x) => x.textContent));
      t.equal(rows.length, 15, 'one line for each of the 15 rows');
      t.expect(/^Row 8: F8 S, G8 P, H8 R, I8 I, J8 N, K8 G/.test(rows[7]), 'the played word reads along row 8 (' + rows[7] + ')');
      t.equal(rows[0], 'Row 1: empty', 'an empty row says so');
      await t.shot('S2-08-read-the-board');
      await t.checkLayout();
      t.expect(await t.page.evaluate(() => !!document.activeElement.closest('.boardtext')), 'focus is inside the sheet');
    },
  },
  // ---------- S3-05 ----------
  {
    name: 'S3-05 Hard counts the Steam squares a play opens as well as the Boiling Springs (Node)', node: true,
    async run(t) {
      t.equal(DEFENSE.boiling, 4, 'a Boiling Spring is still four points of defence');
      t.expect(DEFENSE.steam > 0 && DEFENSE.steam < DEFENSE.boiling, 'a Steam square counts for something, less than a Boiling Spring (' + DEFENSE.steam + ')');
      const board = new Array(225).fill(null);
      const steamAt = 1 * 15 + 9, boilAt = 4;
      t.equal(ROWS[1][9], 's', 'layout: a Steam square at row 2, column J'); t.equal(ROWS[0][4], 'b', 'layout: a Boiling Spring at row 1, column E');
      const near = (i) => [{ i, l: 'A' }];
      t.equal(openedPremium(board, near(steamAt + 2)), DEFENSE.steam, 'a tile two squares from a Steam square opens it');
      t.equal(openedPremium(board, near(boilAt + 2)), DEFENSE.boiling, 'a tile two squares from a Boiling Spring opens it');
      t.equal(openedPremium(board, near(CENTER)), 0, 'a tile far from both opens nothing');
      const taken = board.slice(); taken[steamAt] = { l: 'Z' };
      t.equal(openedPremium(taken, near(steamAt + 2)), 0, 'a Steam square that is already covered is not counted');
    },
  },
];

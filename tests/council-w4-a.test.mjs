// Wave 4, batch A: C4-01, C4-04, C4-05, C4-06, C4-08, C4-09, S1-06, S6-14, S3-23.
import fs from 'node:fs';
import path from 'node:path';
import { root } from './lib.mjs';
import { createGameSaves, KEYS, pruneDays, validDaily, DAILY_DAYS } from '../src/js/storage.js';
import { dailyStars, dailyStrip } from '../src/js/ui.js';
import { makeLexicon } from '../src/js/lexicon.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const SAVE = 'hs-letters-save-v1', SET = 'hs-letters-settings-v1', DAILY = 'hs-letters-daily-v1';
const ls = (t, k) => t.page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), k);
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const earned = JSON.parse(read('test-fixtures/save-v1-earned-play.json'));
const lexicon = () => makeLexicon(JSON.parse(read('data/thermal-words.json')));
const CENTER = 112;
const across = (word, at = CENTER - 2) => [...word].map((l, k) => ({ i: at + k, l }));
// a pre-wave profile with a settings key: no first-run tips, instant computer, no sound
const instant = () => { window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false })); };
const normal = () => { window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'normal', sound: false })); };
const SEATS = [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }];

// the game's timers run from a fake clock that is installed before the page loads, then stopped where the test says
async function freezeClock(t) { await t.page.clock.install(); await t.reload(); await ready(t); }
async function stopClock(t) { const now = await t.page.evaluate(() => Date.now()); await t.page.clock.pauseAt(now + 500); }

// ---------- C4-01 ----------
const NEWER = { ...earned, v: 2, futureField: { a: [1, 2, 3] } };
const withNewer = new Function(`
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-save-v1')) {
    localStorage.setItem('hs-letters-save-v1', ${JSON.stringify(JSON.stringify(NEWER))});
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, theme: 'light' }));
    localStorage.setItem('hs-letters-register-v1', JSON.stringify({ SPRING: { id: 'x', first: '2026-01-01', count: 2, best: 40 } }));
    localStorage.setItem('hs-letters-daily-v1', JSON.stringify({ days: { '2026-11-01': { score: 100, plays: 1 } }, streak: 2, last: '2026-11-01' }));
    localStorage.setItem('hs-letters-stats-v1', JSON.stringify({ games: 3, wins: 2 }));
  }
`);
const snapshot = (t) => t.page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)])));
const NEWER_TEXT = /This visit is not being saved: your saved game comes from a newer version of Bathhouse Letters/;
const memStorage = (m) => ({ getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } });


export const tests = [
  {
    name: 'C4-01 the stored-save reader sets a newer version aside untouched and refuses to write (Node)', node: true,
    async run(t) {
      const mem = new Map([[KEYS.save, JSON.stringify(NEWER)]]);
      const saves = createGameSaves(() => memStorage(mem));
      const before = mem.get(KEYS.save);
      t.equal(saves.read().kind, 'newer', 'version 2 reads as newer');
      const game = JSON.parse(JSON.stringify(earned));
      const handle = saves.open(game, saves.newIntent());
      t.equal(saves.status(handle).reason, 'newer', 'a new game is refused a slot');
      game.move++; t.equal(saves.save(handle, game).reason, 'newer', 'and a later save is refused');
      game.over = true; t.equal(saves.save(handle, game).reason, 'newer', 'and so is the removal at the end of a game');
      t.equal(mem.get(KEYS.save), before, 'the stored text is exactly as it was');
      // a damaged save, and a version-1 save of the wrong shape, are not "newer"
      for (const raw of ['{"v":1,"board":', JSON.stringify({ v: 1, board: [] }), JSON.stringify({ v: 'x' })]) {
        const m = new Map([[KEYS.save, raw]]);
        const s2 = createGameSaves(() => memStorage(m));
        t.equal(s2.read().kind, 'invalid', 'damaged stays invalid: ' + raw.slice(0, 20));
        const g2 = JSON.parse(JSON.stringify(earned)); const h2 = s2.open(g2, s2.newIntent());
        t.expect(s2.status(h2).ok, 'and a new game still replaces it, as before');
      }
    },
  },
  {
    name: 'C4-01 a save from a newer version is byte-for-byte the same after a visit that would normally save everything',
    viewports: ['desktop', 'mobile'],
    initScript: withNewer,
    async run(t) {
      await ready(t);
      const first = await snapshot(t);
      t.equal(Object.keys(first).length, 5, 'five stored keys to begin with (' + Object.keys(first).join() + ')');
      t.equal(await t.page.$('[data-go="continue"]'), null, 'no Continue: this visit starts from defaults');
      t.expect(NEWER_TEXT.test(await t.page.textContent('.storage-note')), 'the title says this visit is not being saved');
      await t.shot('C4-01-title-note');
      await t.checkLayout();
      // a setting changes
      await t.game('scene', 'settings');
      await t.page.click('[data-set="theme"][data-val="dark"]');
      t.expect(await t.page.evaluate(() => document.body.classList.contains('theme-dark')), 'a setting still takes effect for this visit');
      // a game with a Hot Springs word (the register), then a finished Daily (the daily record and the records)
      await t.game('newGame', { seed: 3 });
      await t.page.waitForFunction(() => document.querySelector('#toast').textContent.includes('not saved'), null, { timeout: 8000 });
      t.expect(NEWER_TEXT.test(await t.page.textContent('#toast')), 'the first game says so once, in the toast');
      await t.waitIdle(8000);
      const s = await t.state(); s.game.players[0].rack = 'SPRINGE'.split(''); await t.game('setState', { game: s.game }); await t.waitIdle();
      t.expect((await t.page.evaluate((tl) => window.__game.act('stage', tl), across('SPRING'))).ok, 'SPRING staged');
      t.expect((await t.page.evaluate(() => window.__game.act('play'))).ok, 'and played');
      await t.waitIdle(10000);
      await t.game('newGame', { mode: 'daily', date: '2026-11-12' });
      await t.page.waitForFunction(() => window.__game.getState().scene === 'game', null, { timeout: 8000 });
      await t.game('act', 'autoplay');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 20000 });
      await t.game('scene', 'records'); await t.game('scene', 'register');
      t.equal(JSON.stringify(await snapshot(t)), JSON.stringify(first), 'every stored key is exactly as it was');
      await t.reload(); await ready(t);
      t.equal(JSON.stringify(await snapshot(t)), JSON.stringify(first), 'and after a reload');
      t.expect(NEWER_TEXT.test(await t.page.textContent('.storage-note')), 'the note is still on the title');
    },
  },
  {
    name: 'C4-01 a damaged save is repaired as before',
    viewports: ['desktop'],
    initScript: new Function(`window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) { localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false })); localStorage.setItem('hs-letters-save-v1', '{"v":1,"board":[1,2'); }`),
    async run(t) {
      await ready(t);
      t.equal(await t.page.$('.storage-note'), null, 'no newer-save note for a damaged save');
      await t.game('newGame', { seed: 6 }); await t.waitIdle(8000);
      t.equal((await ls(t, SAVE)).v, 1, 'a new game writes a fresh version-1 save over the damaged one');
      t.expect(!/not saved/.test(await t.page.textContent('#toast')), 'with no warning');
      await t.game('scene', 'settings'); await t.page.click('[data-set="theme"][data-val="dark"]');
      t.equal((await ls(t, SET)).theme, 'dark', 'settings are saved');
    },
  },

  {
    name: 'C4-04 the arrow keys move between the opponent cards, wrap at the ends, and Tab leaves the group',
    viewports: ['desktop', 'mobile'],
    initScript: instant,
    async run(t) {
      await ready(t);
      await t.page.click('#screen [data-go="setup"]');
      const vals = await t.page.$$eval('.opp[role="radio"]', (els) => els.map((e) => e.dataset.val));
      t.equal(vals.length, 4, 'four cards');
      const tabs = await t.page.$$eval('.opp[role="radio"]', (els) => els.map((e) => e.tabIndex));
      t.equal(tabs.filter((x) => x === 0).length, 1, 'one card is a Tab stop (roving tabindex: ' + tabs.join() + ')');
      const checked = () => t.page.getAttribute('.opp[aria-checked="true"]', 'data-val');
      const active = () => t.page.evaluate(() => document.activeElement.dataset.val);
      await t.page.click('.opp[data-val="' + vals[0] + '"]');
      t.equal(await checked(), vals[0], 'the first card is chosen');
      await t.page.keyboard.press('ArrowRight');
      t.equal(await checked(), vals[1], 'Right chooses the next card');
      t.equal(await active(), vals[1], 'and moves the focus with it');
      await t.page.keyboard.press('ArrowDown');
      t.equal(await checked(), vals[2], 'Down does the same');
      await t.page.keyboard.press('ArrowLeft'); await t.page.keyboard.press('ArrowUp');
      t.equal(await checked(), vals[0], 'Left and Up go back');
      await t.page.keyboard.press('ArrowLeft');
      t.equal(await checked(), vals[3], 'Left from the first wraps to the last');
      await t.page.keyboard.press('ArrowRight');
      t.equal(await checked(), vals[0], 'Right from the last wraps to the first');
      t.equal(await t.page.$$eval('.opp[role="radio"]', (els) => els.filter((e) => e.tabIndex === 0).map((e) => e.dataset.val).join()), vals[0], 'the Tab stop follows the choice');
      await t.page.keyboard.press('Tab');
      t.expect(!(await t.page.evaluate(() => document.activeElement.classList.contains('opp'))), 'Tab leaves the group instead of visiting every card');
      await t.page.focus('.opp[aria-checked="true"]');
      await t.page.keyboard.press('Enter');
      t.equal(await checked(), vals[0], 'Enter still chooses the focused card');
      await t.shot('C4-04-setup-cards');
      await t.checkLayout({ allowScrollY: true });
      t.equal(await ls(t, SET).then((s) => (s && s.lastSetup) || null), null, 'nothing is saved by choosing: the choice is written when the game starts');
    },
  },

  {
    name: 'C4-05 stars come from the two pars sorted, so the second star never comes without the first (Node)', node: true,
    async run(t) {
      const usual = { m: 300, h: 350 }, flipped = { m: 350, h: 300 };
      for (const [ref, want] of [[200, 0], [300, 0], [301, 1], [350, 1], [351, 2]]) t.equal(dailyStars(ref, usual), want, 'usual day, ' + ref);
      for (const [ref, want] of [[200, 0], [300, 0], [320, 1], [350, 1], [351, 2]]) t.equal(dailyStars(ref, flipped), want, 'flipped day, ' + ref + ' (the old rule gave 2 at 320)');
      const html = dailyStrip({ '2026-11-12': { score: 320, first: 320, plays: 1, par: flipped } }, '2026-11-12');
      t.expect(/2026-11-12: 320 points, 1 star"/.test(html), 'the strip labels it one star');
      t.expect(/lower of Hollis Crane/.test(html), 'and the note says what a star means on such a day');
      const plain = dailyStrip({ '2026-11-12': { score: 320, first: 320, plays: 1, par: usual } }, '2026-11-12');
      t.expect(/One star beats Hollis Crane on that day's tiles, two beat Maestro Julian Fitch\./.test(plain), 'a strip with no such day keeps its old sentence (' + plain.slice(-120) + ')');
    },
  },
  {
    name: 'C4-05 the records strip shows one star for a score between the pars when Medium is above Hard',
    viewports: ['desktop', 'mobile'],
    initScript: instant,
    async run(t) {
      await ready(t);
      const today = await t.page.evaluate(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
      await t.page.evaluate(([k, td]) => {
        const day = (n) => { const [y, m, d] = td.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d - n, 12)).toISOString().slice(0, 10); };
        localStorage.setItem(k, JSON.stringify({ streak: 2, last: td, days: {
          [day(0)]: { score: 320, first: 320, plays: 1, par: { m: 350, h: 300 } },
          [day(1)]: { score: 400, first: 400, plays: 1, par: { m: 350, h: 300 } },
          [day(2)]: { score: 250, first: 250, plays: 1, par: { m: 350, h: 300 } },
        } }));
      }, [DAILY, today]);
      await t.game('scene', 'records');
      const label = (n) => t.page.getAttribute('.dstrip li:nth-child(' + (14 - n) + ')', 'aria-label');
      t.expect(/1 star$/.test(await label(0)), 'between the pars: one star (' + await label(0) + ')');
      t.expect(/2 stars$/.test(await label(1)), 'above both: two (' + await label(1) + ')');
      t.expect(/no stars$/.test(await label(2)), 'below both: none (' + await label(2) + ')');
      await t.page.locator('.dstrip').scrollIntoViewIfNeeded();
      await t.shot('C4-05-star-strip');
      await t.checkLayout({ allowScrollY: true });
    },
  },

  {
    name: 'C4-06 the finished-category toast is still shown after the next tile is placed',
    viewports: ['desktop', 'mobile'],
    initScript: new Function(`window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ sound: false }));`),
    async run(t) {
      const lex = lexicon();
      const club = lex.data.words.filter((w) => w.cat === 'club');
      const target = club.slice().sort((a, b) => a.forms[0].length - b.forms[0].length)[0], word = target.forms[0];
      const reg = {}; for (const e of club) if (e !== target) reg[e.forms[0]] = { id: e.id, first: '2026-01-01', count: 1, best: 10 };
      await ready(t);
      await t.page.evaluate((r) => localStorage.setItem('hs-letters-register-v1', JSON.stringify(r)), reg);
      await t.reload(); await ready(t);
      // two people at the table: nothing answers in between, so the tile is placed in the same breath as the play
      await t.game('newGame', { seed: 3, seats: [{ kind: 'human', name: 'Ann' }, { kind: 'human', name: 'Bo' }] });
      await t.waitIdle(5000);
      const s = await t.state();
      s.game.players[0].rack = (word + 'EEEEEEE').slice(0, 7).split(''); s.game.players[1].rack = 'EEEEEEE'.split('');
      await t.game('setState', { game: s.game }); await t.waitIdle();
      const out = await t.page.evaluate(async (tl) => {
        const g = window.__game, toasts = [];
        const staged = await g.act('stage', tl); const played = await g.act('play');
        toasts.push(document.querySelector('#toast').textContent);
        const tile = await g.act('stage', [{ i: 127, l: 'E' }]);
        toasts.push(document.querySelector('#toast').textContent);
        return { staged: staged.ok, played: played.ok, tile: tile.ok, toasts };
      }, across(word));
      t.expect(out.staged && out.played && out.tile, 'the word is played and the next player places a tile (' + JSON.stringify(out) + ')');
      t.expect(/\+\d+/.test(out.toasts[0]) && !/complete/.test(out.toasts[0]), 'the word\'s own toast is showing first (' + out.toasts[0] + ')');
      t.expect(/Clubs & casinos: complete/.test(out.toasts[1]), 'after the tile is placed the category toast is showing (' + out.toasts[1] + ')');
      await t.game('act', 'reveal');   // lift the hand-over curtain so the strip and the toast can be seen
      await t.shot('C4-06-category-toast', { wait: false });
    },
  },

  {
    name: 'C4-08 tiles taken back after a paid hint do not come back after a reload; an untouched hint still does',
    viewports: ['desktop', 'mobile'],
    initScript: instant,
    async run(t) {
      await ready(t);
      await t.seed(21);
      await t.game('newGame', { seats: SEATS });
      await t.waitIdle(8000);
      const n = await t.game('act', 'hint');
      t.expect(n > 0, 'the hint staged tiles');
      let saved = await ls(t, SAVE);
      t.expect(saved.hintStaged && saved.hintStaged.tiles.length === n, 'the paid hint is in the save');
      await t.reload(); await ready(t);
      await t.page.click('#screen [data-go="continue"]'); await t.waitIdle(8000);
      t.equal((await t.state()).staged.length, n, 'an untouched hint comes back after a reload');
      await t.game('act', 'recall');
      t.equal((await t.state()).staged.length, 0, 'tiles taken back');
      saved = await ls(t, SAVE);
      t.expect(!('hintStaged' in saved), 'the save no longer carries the hint');
      await t.reload(); await ready(t);
      await t.page.click('#screen [data-go="continue"]'); await t.waitIdle(8000);
      const after = await t.state();
      t.equal(after.staged.length, 0, 'Continue leaves the board clear');
      t.equal(after.game.players[0].hints, 2, 'and the hint stays paid for');
    },
  },
  {
    name: 'C4-08 staging a different tile after a hint ends the saved hint too',
    viewports: ['desktop'],
    initScript: instant,
    async run(t) {
      await ready(t);
      await t.seed(21);
      await t.game('newGame', { seats: SEATS });
      await t.waitIdle(8000);
      const n = await t.game('act', 'hint');
      const st = await t.state();
      const spare = st.game.players[0].rack.filter((_, k) => !st.staged.some((x) => x.k === k));
      t.expect(n > 0 && spare.length > 0, 'the hint leaves a tile on the rack (' + spare.length + ')');
      const free = st.game.board.findIndex((x, i) => !x && !st.staged.some((q) => q.i === i) && i > 150);
      const r = await t.game('act', 'stage', [{ i: free, l: spare[0] === '?' ? 'E' : spare[0], blank: spare[0] === '?' }]);
      t.expect(r.ok, 'another tile is staged');
      t.expect(!('hintStaged' in (await ls(t, SAVE))), 'the saved hint is gone');
      await t.reload(); await ready(t);
      await t.page.click('#screen [data-go="continue"]'); await t.waitIdle(8000);
      t.equal((await t.state()).staged.length, 0, 'nothing is put back after the reload');
    },
  },

  {
    name: 'C4-09 the "How near a stalled game is to its end" comment sits above stallNote (Node)', node: true,
    async run(t) {
      const src = read('src/js/ui.js');
      const i = src.indexOf('// How near a stalled game'), j = src.indexOf('export function stallNote'), k = src.indexOf('export function stingFor');
      t.expect(i > 0 && j > i && src.slice(i, j).split('\n').length <= 4, 'the comment is directly above stallNote');
      t.expect(i > k, 'and no longer above the stingFor block');
    },
  },

  {
    name: 'S1-06 a tap on the board lets the computer\'s move land, and a second press ends the hand-over beat',
    viewports: ['desktop', 'mobile'],
    initScript: normal,
    async run(t) {
      await ready(t);
      await freezeClock(t);
      await t.seed(5);
      await t.game('newGame', { seats: SEATS });
      await t.waitIdle(8000);
      await stopClock(t);                           // from here every timer in the game stands still until the test says so
      const [m] = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', m.tiles);
      t.expect((await t.game('act', 'play')).ok, 'the human move is played');
      await t.page.clock.runFor(400);
      await t.page.waitForFunction(() => { const g = window.__game.getState(); return g.aiThinking && g.aiWait.reply; }, null, { timeout: 15000, polling: 50 });
      t.equal((await t.state()).game.move, 1, 'the computer has worked out a reply but waits its turn (700 ms at Normal)');
      const [x, y] = await t.game('act', 'screen', 40);
      await t.page.mouse.click(x, y);
      await t.page.waitForFunction(() => window.__game.getState().game.move === 2, null, { timeout: 5000, polling: 50 });
      let st = await t.state();
      t.expect(!st.aiThinking, 'the reply landed at once without the clock moving');
      t.expect(st.aiWait.turn, 'the tiles flying in and the hand-over are still ahead');
      await t.page.keyboard.press('Space');
      await t.page.waitForFunction(() => !window.__game.getState().aiWait.turn, null, { timeout: 5000, polling: 50 });
      st = await t.state();
      t.equal(st.game.cur, 0, 'and it is the human\'s turn');
      t.expect(st.staged.length === 0 && !st.aiThinking, 'with nothing in the way');
      await t.page.clock.resume();
      await t.shot('S1-06-after-skip');
    },
  },
  {
    name: 'S1-06 Enter while the computer thinks does the same, and a press while a menu is open does not',
    viewports: ['desktop'],
    initScript: normal,
    async run(t) {
      await ready(t);
      await freezeClock(t);
      await t.seed(5);
      await t.game('newGame', { seats: SEATS });
      await t.waitIdle(8000);
      await stopClock(t);
      const [m] = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', m.tiles); await t.game('act', 'play');
      await t.page.clock.runFor(400);
      await t.page.waitForFunction(() => { const g = window.__game.getState(); return g.aiThinking && g.aiWait.reply; }, null, { timeout: 15000, polling: 50 });
      await t.game('act', 'open', 'pause');
      t.expect(!!(await t.state()).dialog, 'the pause menu is open');
      await t.page.keyboard.press('Enter');
      t.equal((await t.state()).game.move, 1, 'with the pause menu open nothing is skipped');
      // A click where the board is lands on the menu's backdrop, which closes the menu (as it has since v1.0, main.js); that click
      // must not let the move land either. (The test used to click there and then press Enter, but by then no menu was open.)
      if ((await t.state()).dialog !== 'pause') await t.game('act', 'open', 'pause');
      const [x, y] = await t.game('act', 'screen', 40);
      await t.page.mouse.click(x, y);
      const s1 = await t.state();
      t.expect(!s1.dialog && s1.game.move === 1, `a click outside the menu closes it and lets nothing land (dialog ${s1.dialog}, move ${s1.game.move})`);
      await t.page.keyboard.press('Enter');
      await t.page.waitForFunction(() => window.__game.getState().game.move === 2, null, { timeout: 5000, polling: 50 });
      t.equal((await t.state()).game.move, 2, 'Enter lets the move land');
    },
  },

  {
    name: 'S6-14 the page carries the theme colour and, by the owner\'s ruling, no install file yet (Node)', node: true,
    async run(t) {
      for (const f of ['src/index.html', 'index.html']) {
        const html = read(f);
        t.expect(/<meta name="theme-color" content="#2B1A10">/.test(html), f + ' has the dark theme colour');
        t.expect(!/rel="manifest"|apple-mobile-web-app-capable/.test(html), f + ' has no manifest or standalone tag (they wait for the icons)');
      }
    },
  },

  {
    name: 'S3-23 the daily record keeps the last 400 days, the best day and the streak (Node)', node: true,
    async run(t) {
      const key = (n) => new Date(Date.UTC(2025, 0, 1 + n, 12)).toISOString().slice(0, 10);
      const days = {}; for (let n = 0; n < 450; n++) days[key(n)] = { score: n === 3 ? 999 : 100 + n, plays: 1 };
      const kept = pruneDays(days);
      const dates = Object.keys(kept).sort();
      t.equal(DAILY_DAYS, 400, 'the cap is 400');
      t.equal(dates.length, 401, 'the newest 400 and the best day (' + dates.length + ')');
      t.equal(dates[dates.length - 1], key(449), 'the newest day is kept');
      t.expect(kept[key(3)] && kept[key(3)].score === 999, 'the best day survives its age, so "best day" never goes down');
      t.expect(!kept[key(4)] && !kept[key(49)] && kept[key(50)], 'the oldest 49 days but the best are the ones dropped');
      t.equal(Object.keys(pruneDays(days, 400, key(10))).length, 402, 'the day being written is always kept');
      const few = { [key(0)]: { score: 1, plays: 1 } };
      t.equal(pruneDays(few), few, 'a record under the cap is returned as it is');
      t.expect(validDaily({ days: kept, streak: 4, last: key(449) }), 'what is left is a valid daily record');
    },
  },
  {
    name: 'S3-23 playing a Daily on a record of 450 days leaves 400 and keeps the streak',
    viewports: ['desktop'],
    initScript: instant,
    async run(t) {
      await ready(t);
      const key = (n) => new Date(Date.UTC(2024, 0, 1 + n, 12)).toISOString().slice(0, 10);
      await t.page.evaluate(([k, ks]) => {
        const days = {}; ks.forEach((d, n) => { days[d] = { score: n === 5 ? 700 : 100 + (n % 50), plays: 1 }; });
        localStorage.setItem(k, JSON.stringify({ days, streak: 7, last: ks[ks.length - 1] }));
      }, [DAILY, Array.from({ length: 450 }, (_, n) => key(n))]);
      const date = key(450);   // the day after the last one: the streak goes up by one
      await t.game('newGame', { mode: 'daily', date });
      await t.page.waitForFunction(() => window.__game.getState().scene === 'game', null, { timeout: 8000 });
      await t.game('act', 'autoplay');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 20000 });
      const rec = await ls(t, DAILY);
      const dates = Object.keys(rec.days);
      t.expect(dates.length === 400 || dates.length === 401, 'about 400 days are kept (' + dates.length + ')');
      t.expect(rec.days[date] && rec.days[date].score > 0, 'today is in it');
      t.equal(rec.days[key(5)].score, 700, 'the best day is still there');
      t.equal(rec.streak, 8, 'the streak went on from 7');
    },
  },
];

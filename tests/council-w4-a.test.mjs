// Wave 4, batch A: C4-01, C4-04.
import fs from 'node:fs';
import path from 'node:path';
import { root } from './lib.mjs';
import { createGameSaves, KEYS } from '../src/js/storage.js';

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
];

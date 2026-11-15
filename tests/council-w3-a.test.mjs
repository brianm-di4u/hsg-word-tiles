// Wave 3, batch A: S3-06 (hints and records), S3-12 (tile tracker), S6-09 (frame watchdog), S6-10 (storage-blocked note),
// S6-11 (a hint survives a reload), S1-02 (Enter and Space on buttons), S1-05 (tile settle), S2-05 (score breakdown),
// S4-06 (setup cards) and S4-25 (docs).
import { emptyStats, applyGame, hintsUsed } from '../src/js/stats.js';
import { TILES, BLANKS } from '../src/js/tiles.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const SET = 'hs-letters-settings-v1', SAVE = 'hs-letters-save-v1';
const ls = (t, k) => t.page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), k);
// a pre-wave profile with a settings key: no first-run tips, instant computer, no sound
const instant = () => { window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false })); };
const SEATS = [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }];

// a finished game: the human (seat 0) with `me` points against Opal, `hints` left of three
const finished = (me, hints) => ({
  mode: 'play', seed: 1, rng: { bag: 1, ai: 2 }, over: true, featured: [],
  players: [{ kind: 'human', name: 'You', score: me, best: { word: 'QUARTZ', score: 54 }, hints }, { kind: 'ai', name: 'Opal', persona: 'opal', level: 'easy', score: 50, best: null, hints: null }],
  log: [{ p: 0, kind: 'play', n: 0, score: 91, full: 0, words: [{ w: 'SPRING', score: 91, bonus: 0 }] }, { kind: 'end' }],
  result: { why: 'out', out: 0, adjust: [0, 0], winners: [0] },
});

// play a game to its end as a person would: the best scoring play each turn, a pass when nothing fits
async function playOut(t, max = 120) {
  for (let n = 0; n < max; n++) {
    const s = (await t.state()).game;
    if (s.over) return s;
    if (s.players[s.cur].kind !== 'human') { await t.page.waitForFunction(() => { const g = window.__game.getState(); return g.game.over || g.game.players[g.game.cur].kind === 'human'; }, null, { timeout: 20000 }); continue; }
    const mv = await t.game('act', 'moves', 1);
    if (mv && mv.length) {
      const st = await t.game('act', 'stage', mv[0].tiles);
      const r = st.ok ? await t.game('act', 'play') : { ok: false };
      if (!r.ok) { await t.game('act', 'recall'); await t.game('act', 'pass'); }
    } else await t.game('act', 'pass');
    await t.page.waitForTimeout(60);
  }
  return (await t.state()).game;
}

export const tests = [
  // ---------- S3-06 ----------
  {
    name: 'S3-06 a game with a hint counts as played and won but sets no personal best; an unaided game does', node: true,
    async run(t) {
      const base = applyGame(emptyStats(), finished(100, 3)).stats;
      t.equal(base.bestScore, 100, 'an unaided first game sets the best');
      const hinted = applyGame(base, finished(300, 1));
      t.equal(hinted.stats.games, 2, 'the hinted game is counted'); t.equal(hinted.stats.wins, 2, 'and the win');
      t.equal(hinted.stats.bestScore, 100, 'but the best score stays'); t.equal(hinted.stats.bestPlay.score, 91, 'and the best turn');
      t.equal(hinted.stats.hints, 2, 'two hints are added to the hints used');
      t.expect(hinted.pb.held && !hinted.pb.score && !hinted.pb.play, 'the game says it held a record back, and sets none');
      const none = applyGame(base, finished(40, 1));
      t.expect(!none.pb.held, 'a hinted game that would not have beaten anything says nothing');
      const clean = applyGame(base, finished(300, 3));
      t.expect(clean.pb.score && !clean.pb.held && clean.stats.bestScore === 300, 'an unaided game still sets the best');
      t.equal(hintsUsed({ hints: 3 }), 0, 'three left is none used'); t.equal(hintsUsed({ hints: 0 }), 3, 'none left is three used'); t.equal(hintsUsed({ hints: null }), 0, 'hints off is none used');
    },
  },
  {
    name: 'S3-06 the results card says Unaided, or how many hints were used',
    viewports: ['desktop', 'mobile'],
    initScript: instant,
    async run(t) {
      await ready(t);
      await t.seed(11);
      await t.game('newGame', { seats: SEATS });
      await t.waitIdle(8000);
      await playOut(t);
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 15000 });
      t.expect(/Unaided/.test(await t.page.textContent('.sheet.over')), 'a game with no hint says Unaided');
      await t.seed(11);
      await t.game('newGame', { seats: SEATS });
      await t.waitIdle(8000);
      await t.game('act', 'hint');
      t.equal((await t.state()).game.players[0].hints, 2, 'the hint was taken');
      await t.game('act', 'recall');
      await playOut(t);
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 15000 });
      const text = await t.page.textContent('.sheet.over');
      t.expect(/1 hint used/.test(text) && !/Unaided/.test(text), 'a game with one hint says so');
      await t.shot('S3-06-results-hinted');
      await t.checkLayout({ allowScrollY: true });
    },
  },

  // ---------- S3-12 ----------
  {
    name: 'S3-12 the pause sheet opens an Unseen tiles panel that counts the bag and the other racks, never your own',
    viewports: ['desktop', 'mobile'],
    initScript: instant,
    async run(t) {
      await ready(t);
      await t.seed(5);
      await t.game('newGame', { seats: SEATS });
      await t.waitIdle(8000);
      await t.page.click('#b-menu');
      t.expect(await t.page.locator('#modal [data-open="tracker"]').count() === 1, 'the pause sheet has an Unseen tiles button');
      await t.page.click('#modal [data-open="tracker"]');
      const g = (await t.state()).game, mine = g.players[0].rack;
      const want = {};
      for (const [l, x] of Object.entries(TILES)) want[l] = x.count;
      want['?'] = BLANKS;
      for (const c of g.board) if (c) want[c.blank ? '?' : c.l]--;
      for (const l of mine) want[l]--;
      const got = await t.page.$$eval('#modal .tchip.tk', (els) => els.map((e) => [e.querySelector('b').textContent || '?', +e.querySelector('small').textContent.replace('×', '')]));
      t.equal(got.length, 27, 'twenty-six letters and the blank');
      for (const [l, n] of got) t.equal(n, want[l], 'unseen count for ' + l);
      t.equal(got.reduce((a, [, n]) => a + n, 0), g.bag.length + g.players[1].rack.length, 'the total is the bag and the other rack');
      t.expect(/91 tiles you cannot see/.test(await t.page.textContent('#modal .tracker')), 'the panel says how many in words');
      await t.checkLayout({ allowScrollY: true });
      await t.shot('S3-12-tracker');
      await t.page.click('#modal [data-open="pause"]');
      t.expect(await t.page.locator('#modal .pause').count() === 1, 'Back returns to the pause sheet');
      await t.page.keyboard.press('Escape');
      t.equal((await t.state()).dialog, null, 'Escape closes it');
    },
  },
  {
    name: 'S3-12 the panel is not offered while a rack is hidden in pass and play',
    initScript: instant,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seats: [{ kind: 'human', name: 'Ann' }, { kind: 'human', name: 'Bo' }] });
      await t.waitIdle(8000);
      t.expect((await t.state()).privacy, 'the privacy screen is up');
      await t.game('act', 'open', 'pause');
      t.equal(await t.page.locator('#modal [data-open="tracker"]').count(), 0, 'no tracker while the next person has not taken the device');
      await t.game('act', 'close');
      await t.game('act', 'reveal');
      await t.game('act', 'open', 'pause');
      t.equal(await t.page.locator('#modal [data-open="tracker"]').count(), 1, 'it is offered once the rack is showing');
    },
  },

  // ---------- S6-10 ----------
  {
    name: 'S6-10 a browser that will not store anything is told so on the title and in the Register, before a game starts',
    viewports: ['desktop', 'mobile'],
    initScript: () => { window.__TEST_TIPS__ = false; const no = () => { throw new Error('storage blocked'); }; Object.defineProperty(window, 'localStorage', { get: no }); },
    async run(t) {
      await ready(t);
      t.expect(/progress will not be kept/.test(await t.page.textContent('#screen')), 'the title says progress will not be kept');
      await t.checkLayout({ allowScrollY: true });
      await t.shot('S6-10-title-blocked');
      await t.page.click('#screen [data-go="register"]');
      t.expect(/progress will not be kept/.test(await t.page.textContent('.sheet.register')), 'and so does the Register');
      await t.shot('S6-10-register-blocked');
      await t.checkLayout({ allowScrollY: true });
    },
  },
  {
    name: 'S6-10 a browser that stores normally sees no warning and the probe leaves nothing behind',
    initScript: instant,
    async run(t) {
      await ready(t);
      t.expect(!/will not be kept/.test(await t.page.textContent('#screen')), 'no warning on the title');
      t.equal(await t.page.evaluate(() => localStorage.getItem('hs-letters-probe')), null, 'the probe key is removed');
      await t.page.click('#screen [data-go="register"]');
      t.expect(!/will not be kept/.test(await t.page.textContent('.sheet.register')), 'no warning in the Register');
    },
  },

  // ---------- S6-11 ----------
  {
    name: 'S6-11 a hint that was paid for is still on the board after a reload, and is not saved past the move',
    viewports: ['desktop', 'mobile'],
    initScript: instant,
    async run(t) {
      await ready(t);
      await t.seed(21);
      await t.game('newGame', { seats: SEATS });
      await t.waitIdle(8000);
      const n = await t.game('act', 'hint');
      const before = await t.state();
      t.expect(n > 0 && before.staged.length === n, 'the hint put tiles on the board');
      t.equal(before.game.players[0].hints, 2, 'and cost one hint');
      const key = (st) => st.staged.map((x) => x.i + x.l).sort().join();
      await t.reload(); await ready(t);
      await t.page.click('#screen [data-go="continue"]');
      await t.waitIdle(8000);
      const after = await t.state();
      t.equal(key(after), key(before), 'the same tiles are on the same squares after Continue');
      t.equal(after.game.players[0].hints, 2, 'and the hint is not charged again');
      t.expect(after.preview && after.preview.ok, 'with the live preview');
      await t.shot('S6-11-hint-restored');
      await t.checkLayout();
      const r = await t.game('act', 'play');
      t.expect(r.ok, 'it can be played');
      t.expect(!('hintStaged' in (await ls(t, SAVE))), 'the saved game no longer carries the hint');
    },
  },
  {
    name: 'S6-11 a hint that no longer fits is left out without an error',
    initScript: instant,
    async run(t) {
      await ready(t);
      await t.seed(21);
      await t.game('newGame', { seats: SEATS });
      await t.waitIdle(8000);
      await t.game('act', 'hint');
      await t.page.evaluate((k) => { const g = JSON.parse(localStorage.getItem(k)); g.hintStaged.tiles[0].l = g.players[0].rack.includes('Q') ? 'Z' : 'Q'; g.hintStaged.tiles[0].blank = false; localStorage.setItem(k, JSON.stringify(g)); }, SAVE);
      await t.reload(); await ready(t);
      await t.page.click('#screen [data-go="continue"]');
      await t.waitIdle(8000);
      const st = await t.state();
      t.equal(st.staged.length, 0, 'nothing is staged');
      t.equal(st.game.players[0].hints, 2, 'the saved count stands');
      await t.page.evaluate((k) => { const g = JSON.parse(localStorage.getItem(k)); g.hintStaged = { move: 99, tiles: 'x' }; localStorage.setItem(k, JSON.stringify(g)); }, SAVE);
      await t.reload(); await ready(t);
      await t.page.click('#screen [data-go="continue"]');
      await t.waitIdle(8000);
      t.equal((await t.state()).staged.length, 0, 'a damaged record is ignored too');
    },
  },

  // ---------- S1-02 ----------
  {
    name: 'S1-02 Enter and Space press the focused button; on the board Enter still plays',
    viewports: ['desktop', 'mobile'],
    initScript: instant,
    async run(t) {
      await ready(t);
      await t.seed(3);
      await t.game('newGame', { seats: SEATS });
      await t.waitIdle(8000);
      await t.page.focus('#b-menu');
      await t.page.keyboard.press('Enter');
      t.equal((await t.state()).dialog, 'pause', 'Enter on Menu opens the pause sheet');
      await t.game('act', 'close');
      await t.page.focus('[data-act="swap"]');
      await t.page.keyboard.press('Space');
      t.equal((await t.state()).dialog, 'swap', 'Space on Swap opens the swap sheet');
      await t.game('act', 'close');
      await t.page.focus('[data-act="pass"]');
      await t.page.keyboard.press('Enter');
      t.equal((await t.state()).dialog, 'confirm', 'Enter on Pass asks to confirm');
      t.equal((await t.state()).staged.length, 0, 'and nothing was played');
      await t.game('act', 'close');
      const [m] = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', m.tiles);
      await t.page.focus('#board');
      const move = (await t.state()).game.move;
      await t.page.keyboard.press('Enter');
      await t.waitIdle(8000);
      t.expect((await t.state()).game.move > move, 'Enter on the board still plays the staged tiles');
    },
  },
];

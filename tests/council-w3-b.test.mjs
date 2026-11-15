// Wave 3, batch B: S2-21 (Shuffle stays while tiles are staged), S3-16 (the computer waits for a dialog),
// S6-08 (the checks a green run used to skip), S1-01 (the rack is yours during the computer's turn),
// S1-03 (phone placement), S3-13 (what you missed) and S4-03 (fact cards).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ctx, root } from './lib.mjs';
import { createGame, apply } from '../src/js/engine.js';
import { generateMoves } from '../src/js/movegen.js';
import { reviewSeat, reviewSteps, summarize, MIN_MISS } from '../src/js/review.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
// a pre-wave profile with a settings key: no first-run tips, no sound; the computer answers at once unless a test asks for a pace
const instant = () => { window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false })); };
const paced = () => { window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'normal', sound: false })); };
const SEATS = [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }];

export const tests = [
  // ---------- S2-21 ----------
  {
    name: 'S2-21 Shuffle stays beside Recall while tiles are placed, and moves only the tiles still on the rack',
    viewports: ['desktop', 'mobile'],
    initScript: instant,
    async run(t) {
      await ready(t);
      await t.seed(5);
      await t.game('newGame', { seats: SEATS });
      await t.waitIdle(8000);
      t.expect(await t.page.locator('[data-act="shuffle"]').count() === 1 && await t.page.locator('[data-act="recall"]').count() === 0, 'with nothing placed: Shuffle, no Recall');
      const [m] = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', m.tiles.slice(0, 1));
      const before = await t.state();
      t.equal(before.staged.length, 1, 'one tile is placed');
      t.expect(await t.page.locator('[data-act="shuffle"]').isVisible() && await t.page.locator('[data-act="recall"]').isVisible(), 'both Shuffle and Recall show');
      await t.shot('S2-21-shuffle-and-recall');
      // the shuffle's dice: a fixed one, so the result is the same every run
      await t.page.evaluate(() => { window.__rand = Math.random; Math.random = () => 0; });
      await t.page.click('[data-act="shuffle"]');
      await t.page.evaluate(() => { Math.random = window.__rand; });
      const after = await t.state();
      t.expect(JSON.stringify(after.order) !== JSON.stringify(before.order), 'the rack order changed');
      t.equal(JSON.stringify([...after.order].sort()), JSON.stringify([...before.order].sort()), 'with the same tiles on the rack');
      t.equal(JSON.stringify(after.staged), JSON.stringify(before.staged), 'and the placed tile where it was');
      await t.page.keyboard.press('Shift+R');
      t.equal((await t.state()).staged.length, 1, 'Shift+R with a tile placed leaves it there');
      await t.page.click('[data-act="recall"]');
      const back = await t.state();
      t.equal(back.staged.length, 0, 'Recall takes the tile back');
      t.equal(back.order.length, 7, 'and the rack is whole again');
      await t.checkLayout();
    },
  },
  // ---------- S3-16 ----------
  {
    name: 'S3-16 the computer holds its move while the pause sheet is open and plays it once the sheet closes',
    viewports: ['desktop', 'mobile'],
    initScript: paced,
    async run(t) {
      await ready(t);
      await t.seed(5);
      await t.game('newGame', { seats: SEATS });
      await t.waitIdle(8000);
      const [m] = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', m.tiles);
      // play and open the menu in one breath, so the sheet is up before the computer can answer
      await t.page.evaluate(() => { window.__game.act('play'); window.__game.act('open', 'pause'); });
      const move = (await t.state()).game.move;
      await t.page.waitForFunction(() => window.__game.getState().aiHeld, null, { timeout: 15000 });
      let s = await t.state();
      t.equal(s.dialog, 'pause', 'the pause sheet is still open');
      t.equal(s.game.move, move, 'the computer has not played under it');
      await t.game('act', 'close');
      await t.page.waitForFunction((n) => window.__game.getState().game.move > n, move, { timeout: 15000 });
      s = await t.state();
      t.expect(!s.aiHeld, 'the held reply was used');
      t.equal(s.game.move, move + 1, 'the computer played its one move after the sheet closed');
    },
  },
  {
    name: 'S3-16 a reply held for the menu is not lost when the menu opens the tile tracker first',
    viewports: ['desktop'],
    initScript: paced,
    async run(t) {
      await ready(t);
      await t.seed(6);
      await t.game('newGame', { seats: SEATS });
      await t.waitIdle(8000);
      const [m] = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', m.tiles);
      await t.page.evaluate(() => { window.__game.act('play'); window.__game.act('open', 'pause'); });
      const move = (await t.state()).game.move;
      await t.page.waitForFunction(() => window.__game.getState().aiHeld, null, { timeout: 15000 });
      await t.page.evaluate(() => window.__game.act('open', 'tracker'));
      t.equal((await t.state()).game.move, move, 'still held on the second sheet');
      await t.game('act', 'close');
      await t.page.waitForFunction((n) => window.__game.getState().game.move > n, move, { timeout: 15000 });
      t.equal((await t.state()).game.move, move + 1, 'played once, after the last sheet closed');
    },
  },
  // ---------- S1-01 ----------
  {
    name: "S1-01 during the computer's turn the rack can be shuffled and rearranged, nothing can be placed, and the order is there on your turn",
    viewports: ['desktop', 'mobile'],
    initScript: paced,
    async run(t) {
      await ready(t);
      await t.seed(5);
      await t.game('newGame', { seats: SEATS });
      await t.waitIdle(8000);
      const [m] = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', m.tiles);
      // play, and make the tab look hidden in the same breath: the computer's reply is then held, so the turn waits for us
      await t.page.evaluate(() => { window.__game.act('play'); Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); });
      await t.page.waitForFunction(() => window.__game.getState().aiHeld, null, { timeout: 15000 });
      const letters = () => t.page.evaluate(() => [...document.querySelectorAll('#rack .rtile')].map((b) => b.getAttribute('aria-label')[0]).join(''));
      const boxes = () => t.page.evaluate(() => [...document.querySelectorAll('#rack .rtile')].map((b) => { const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }));
      const settled = () => t.page.waitForFunction(() => document.querySelector('#ghost').hidden && !document.querySelector('#rack .lifted'), null, { timeout: 5000 });
      const move = (await t.state()).game.move;
      t.equal((await t.state()).game.players[(await t.state()).game.cur].kind, 'ai', "it is the computer's turn");
      t.expect(await t.page.evaluate(() => document.querySelector('#rack').classList.contains('dim') && [...document.querySelectorAll('#rack .rtile')].length === 7 && [...document.querySelectorAll('#rack .rtile')].every((b) => !b.disabled)), 'the rack is shown, dimmed, and its tiles are live');
      t.expect(await t.page.locator('[data-act="shuffle"]').isEnabled(), 'Shuffle is on');
      t.expect(await t.page.locator('[data-act="pass"]').isDisabled() && await t.page.locator('[data-act="play"]').isDisabled(), 'Pass and Play are still off');
      await t.shot('S1-01-rack-during-computer-turn');
      const start = await letters();
      // Shuffle, with fixed dice so the result is the same every run
      await t.page.evaluate(() => { window.__rand = Math.random; Math.random = () => 0; });
      await t.page.click('[data-act="shuffle"]');
      await t.page.evaluate(() => { Math.random = window.__rand; });
      const shuffled = await letters();
      t.expect(shuffled !== start, 'the shuffle changed the order');
      t.equal([...shuffled].sort().join(''), [...start].sort().join(''), 'and kept the same seven tiles');
      // a real drag: the first tile to the far end of the rack
      let b = await boxes();
      await t.page.mouse.move(b[0][0], b[0][1]); await t.page.mouse.down();
      await t.page.mouse.move(b[0][0] + 20, b[0][1], { steps: 3 }); await t.page.mouse.move(b[6][0] + 30, b[6][1], { steps: 8 });
      await t.page.mouse.up(); await settled();
      const dragged = await letters();
      t.equal(dragged, shuffled.slice(1) + shuffled[0], 'dragging the first tile to the end moved it there');
      // a tile dropped on the board goes back to the rack, and nothing is placed
      b = await boxes();
      const cell = await t.game('act', 'screen', 112);
      await t.page.mouse.move(b[2][0], b[2][1]); await t.page.mouse.down();
      await t.page.mouse.move(b[2][0], b[2][1] - 30, { steps: 3 }); await t.page.mouse.move(cell[0], cell[1], { steps: 8 });
      await t.page.mouse.up(); await settled();
      const s = await t.state();
      t.equal(s.staged.length, 0, 'nothing was placed on the board');
      t.equal(s.game.move, move, "and the computer's turn goes on");
      t.equal(await letters(), dragged, 'the tile is back where it was in the rack');
      // a tap does not pick a tile up
      b = await boxes();
      await t.page.mouse.click(b[1][0], b[1][1]);
      t.equal(await t.page.locator('#rack .rtile.sel').count(), 0, 'a tap leaves nothing selected');
      // the computer plays; the rack is as it was left
      await t.page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
      await t.page.waitForFunction((n) => { const g = window.__game.getState(); return g.game.move > n && g.game.players[g.game.cur].kind === 'human'; }, move, { timeout: 15000 });
      await t.waitIdle(8000);
      t.equal(await letters(), dragged, 'on your turn the rack is in the order you left it');
      t.expect(await t.page.evaluate(() => !document.querySelector('#rack').classList.contains('dim') && [...document.querySelectorAll('#rack .rtile')].every((x) => !x.disabled)), 'and it is live again');
      const [m2] = await t.game('act', 'moves', 1);
      t.expect((await t.game('act', 'stage', m2.tiles)).ok, 'tiles can be placed on your turn');
      await t.checkLayout();
    },
  },
  // ---------- S1-03 ----------
  {
    name: 'S1-03 on a phone a Zoom in button brings the squares up to a size a finger can place on, and the same button shows the whole board again',
    viewports: ['mobile'],
    initScript: instant,
    async run(t) {
      await ready(t);
      await t.seed(5);
      await t.game('newGame', { seats: SEATS });
      await t.waitIdle(8000);
      const zoom = async () => (await t.state()).view.zoom;
      t.equal(await zoom(), 1, 'the board starts whole: it never zooms by itself');
      const v0 = (await t.state()).view;
      t.expect(await t.page.locator('#b-zoomin').isVisible(), 'the Zoom in button is in the top bar before anything is zoomed');
      t.equal(await t.page.getAttribute('#b-zoomin', 'aria-label'), 'Zoom in on the board', 'and says what it does');
      const [m] = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', m.tiles.slice(0, 1));
      await t.shot('S1-03-zoom-button');
      await t.page.click('#b-zoomin');
      await t.page.waitForFunction(() => { const v = window.__game.getState().view; return Math.abs(v.zoom - 1.7) < 0.01 && document.querySelector('#b-zoomin').getAttribute('aria-label') === 'Show the whole board'; }, null, { timeout: 5000 });
      const v = (await t.state()).view, frame = (2 * v0.cx - 15) / 2;   // the board's frame, from where the view was centred
      const i = m.tiles[0].i;
      t.expect(Math.abs(v.cx - (frame + (i % 15) + 0.5)) < 1.5 && Math.abs(v.cy - (frame + Math.floor(i / 15) + 0.5)) < 1.5, `the view is centred on the placed tile (centre ${v.cx}, ${v.cy}; tile column ${i % 15}, row ${Math.floor(i / 15)})`);
      t.equal(await t.page.getAttribute('#b-zoomin', 'aria-label'), 'Show the whole board', 'the button now shows the whole board');
      await t.shot('S1-03-zoomed-in');
      // a tile can still be put on the zoomed board with a finger-sized square
      const [m2] = await t.game('act', 'moves', 1);
      await t.game('act', 'recall');
      t.expect((await t.game('act', 'stage', m2.tiles)).ok, 'tiles go on the zoomed board');
      await t.page.click('#b-zoomin');
      await t.page.waitForFunction(() => document.querySelector('#b-zoomin').getAttribute('aria-label') === 'Zoom in on the board', null, { timeout: 5000 });
      t.equal(await zoom(), 1, 'and back to Zoom in, with the whole board showing');
      await t.checkLayout();
    },
  },
  {
    name: 'S1-03 on a wide screen the zoom button stays out of the way until the board is zoomed, as before',
    viewports: ['desktop'],
    initScript: instant,
    async run(t) {
      await ready(t);
      await t.seed(5);
      await t.game('newGame', { seats: SEATS });
      await t.waitIdle(8000);
      t.expect(!(await t.page.locator('#b-zoom').isVisible()) && !(await t.page.locator('#b-zoomin').isVisible()), 'neither zoom button shows on a whole board');
      await t.game('act', 'zoom', 1.5);
      t.expect(await t.page.locator('#b-zoom').isVisible(), 'shown once zoomed');
      t.equal(await t.page.getAttribute('#b-zoom', 'aria-label'), 'Show the whole board', 'and it shows the whole board');
      await t.page.click('#b-zoom');
      await t.page.waitForFunction(() => document.querySelector('#b-zoom').hidden, null, { timeout: 5000 });
      t.expect(!(await t.page.locator('#b-zoom').isVisible()), 'and hides again');
    },
  },
  // ---------- S3-13 ----------
  {
    name: 'S3-13 the review finds the best play for every turn the person took, as the board and rack stood then', node: true,
    async run(t) {
      const c = await ctx();
      const s = createGame({ mode: 'play', seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', name: 'Opal' }], seed: 31 }, c.lex);
      const want = [];   // what the game itself says is best on each of the person's turns, asked at the time
      for (let turn = 0; !s.over && turn < 40; turn++) {
        const { moves } = generateMoves(c.dict, s.board, s.players[s.cur].rack, { lex: c.lex, featured: s.featured });
        let action;
        if (s.cur === 0) {
          // turn 2: the weakest play; turn 3: a pass; otherwise the best
          want.push(moves.length ? moves[0].score : null);
          if (want.length === 2 && moves.length > 1) action = { type: 'play', tiles: moves[moves.length - 1].tiles };
          else if (want.length === 3 || !moves.length) action = { type: 'pass' };
        }
        if (!action) action = moves.length ? { type: 'play', tiles: moves[0].tiles } : { type: 'pass' };
        t.expect(apply(s, action, c).ok, 'the move was legal');
      }
      t.expect(want.length >= 8, 'a game of at least eight turns for the person (' + want.length + ')');
      const steps = [...reviewSteps(s, 0, c.dict, c.lex)];
      t.equal(steps.length, want.length, 'one result for each turn the person took');
      steps.forEach((x, k) => {
        t.equal(x.best ? x.best.score : null, want[k], `turn ${k + 1}: the best play on offer was ${want[k]}`);
      });
      t.expect(steps[1].best.score - steps[1].score >= MIN_MISS, 'the weak play on turn 2 is well short of the best');
      t.equal(steps[2].kind, 'pass', 'the pass is looked at too'); t.expect(steps[2].score === 0 && steps[2].best.score > 0, 'and the play it passed up is named');
      const r = summarize(steps);
      t.equal(r.total, want.length, 'every turn counted');
      t.equal(r.found, want.length - (steps[1].best.score > steps[1].score ? 1 : 0) - (steps[2].best.score > 0 ? 1 : 0) - steps.filter((x, k) => k > 2 && x.best && x.score < x.best.score).length, 'the rate is the turns that made the best score');
      t.equal(r.misses[0].turn, [...steps.filter((x) => x.best).map((x) => x.best.score - x.score)].reduce((a, g, k, all) => (g > all[a] ? k : a), 0) + 1, 'the biggest miss is listed first');
      t.expect(r.misses.length <= 3 && r.misses.every((m) => m.gap >= MIN_MISS), 'at most three, each at least the smallest worth listing');
      t.equal(reviewSeat(s), 0, 'the person is the seat to review');
      // a game saved before the racks were kept: nothing to look at, turn by turn
      const old = JSON.parse(JSON.stringify(s)); for (const e of old.log) delete e.rack;
      t.equal(reviewSeat(old), null, 'no seat to review without racks');
      const half = JSON.parse(JSON.stringify(s)); for (const e of half.log) if (e.n < 4) delete e.rack;
      const h = summarize([...reviewSteps(half, 0, c.dict, c.lex)]);
      t.expect(h.skipped >= 1 && h.total === want.length - h.skipped, 'turns without a rack are skipped, the rest read');
      // two people, or none: no review
      t.equal(reviewSeat(createGame({ mode: 'play', seats: [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }], seed: 3 }, c.lex)), null, 'two people share a rack-hiding table: no review');
    },
  },
  {
    name: 'S3-13 What you missed on the results sheet lists the biggest miss and counts the plays that were the best',
    viewports: ['desktop', 'mobile'],
    initScript: instant,
    async run(t) {
      await ready(t);
      await t.seed(31);
      await t.game('newGame', { seats: SEATS });
      await t.waitIdle(8000);
      // the first turn is the weakest play on offer, every turn after is the best
      let first = true, plays = 0;
      for (let n = 0; n < 150; n++) {
        const g = (await t.state()).game;
        if (g.over) break;
        if (g.players[g.cur].kind !== 'human') { await t.page.waitForFunction(() => { const x = window.__game.getState(); return x.game.over || x.game.players[x.game.cur].kind === 'human'; }, null, { timeout: 20000 }); continue; }
        const mv = await t.game('act', 'moves', first ? 300 : 1);
        const pick = first ? mv[mv.length - 1] : mv[0];
        if (pick) { const st = await t.game('act', 'stage', pick.tiles); const r = st.ok ? await t.game('act', 'play') : { ok: false }; if (!r.ok) { await t.game('act', 'recall'); await t.game('act', 'pass'); } } else await t.game('act', 'pass');
        first = false; plays++;
        await t.page.waitForFunction((m) => window.__game.getState().game.move > m, g.move, { timeout: 10000 });
      }
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 15000 });
      t.expect(await t.page.locator('[data-review]').isVisible(), 'the results sheet has the button');
      await t.page.click('[data-review]');
      await t.page.waitForSelector('.review .rv-rate', { timeout: 15000 });
      const text = await t.page.textContent('.review');
      const m = /(\d+) of (\d+) turns/.exec(text);
      t.expect(m && +m[2] === plays && +m[1] === plays - 1, 'every turn but the first made the best play: ' + (m && m[0]) + ' of ' + plays);
      t.expect(/Turn 1 You played [A-Z]+ for \d+\. [A-Z]+ would have scored/.test(text) && /would have scored/.test(text), 'the first turn is listed with the play that was there');
      t.expect(/points only/.test(text), 'and the note says what it does not count');
      await t.shot('S3-13-what-you-missed');
      await t.checkLayout();
      await t.page.click('.review [data-close]');
      t.equal((await t.state()).dialog, null, 'Close puts the results sheet back');
    },
  },
  // ---------- S4-03 ----------
  {
    name: 'S4-03 the fact cards the finding named each tell their own fact, and every card still traces to a source', node: true,
    async run(t) {
      const game = JSON.parse(fs.readFileSync(path.join(root, 'data/lexicon.game.json'), 'utf8')).words;
      const src = JSON.parse(fs.readFileSync(path.join(root, 'data/thermal-words.json'), 'utf8')).words;
      const groups = [['tufa', 'travertine'], ['quartz', 'crystal'], ['soak', 'mineral'], ['steam', 'vapor'], ['gator', 'alligator'], ['farm', 'homer', 'ballpark'], ['cupola', 'copper']];
      for (const g of groups) {
        const facts = g.map((id) => game.find((w) => w.id === id).fact);
        t.equal(new Set(facts.map((f) => f.text)).size, g.length, g.join(', ') + ': each card has its own text');
        t.equal(new Set(facts.map((f) => f.bank || f.quote)).size, g.length, g.join(', ') + ': and its own source item');
      }
      t.equal(game.find((w) => w.id === 'dome').fact.bank, game.find((w) => w.id === 'mosaic').fact.bank, 'dome and mosaic still share the one item the bank holds about the Quapaw dome (reported, not fixed)');
      for (const w of src) {
        const g = game.find((x) => x.id === w.id);
        t.equal(g.fact.text, w.fact.text, w.id + ': the game data and its source file agree');
      }
      const r = spawnSync(process.execPath, [path.join(root, 'tools/check-facts.mjs')], { cwd: root, encoding: 'utf8' });
      t.equal(r.status, 0, 'every card still traces to the audited bank or a research quote: ' + (r.stdout || '').trim().split(String.fromCharCode(10)).slice(-1)[0]);
    },
  },
  {
    name: 'S4-03 SPRING shows the Fordyce painting (its fact is the Fordyce basement), the Great Fire and the water cards no longer swap pictures',
    viewports: ['desktop', 'mobile'],
    initScript: instant,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seats: SEATS });
      await t.waitIdle(8000);
      const pic = async (id) => { await t.game('act', 'fact', id); await t.page.waitForSelector('.fact .vig'); const s = await t.page.getAttribute('.fact img.vig', 'src'); await t.game('act', 'close'); return s; };
      const spring = await pic('spring');
      t.expect(spring && spring === await pic('fountain'), 'SPRING shows the same Fordyce painting as the Fordyce fountain');
      t.expect(spring !== await pic('tufa'), 'and not the travertine terraces the springs category uses');
      const fire = await pic('fire'), water = await pic('water');
      t.expect(fire && water && fire !== water, 'FIRE and WATER show different paintings');
      await t.game('act', 'fact', 'spring');
      await t.page.waitForSelector('.fact .vig');
      await t.shot('S4-03-spring-card');
      await t.checkLayout();
    },
  },
];

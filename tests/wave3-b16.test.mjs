// Wave 3, batch W3-B16: W6-S3-03 (the fog follows the bag, whatever the number of players; the rest of the bridge was built by 09095e2 and
// c37d1ad, tests: wave2-b16).
import { ctx } from './lib.mjs';
import { createGame, apply, fogStep, featuredRevealCap, FOG_STEPS, DAILY_TURNS } from '../src/js/engine.js';
import { generateMoves } from '../src/js/movegen.js';
import { isBath } from '../src/js/score.js';
import { validSavedGame } from '../src/js/storage.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const instant = () => { window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false })); };
const people = (n) => Array.from({ length: n }, (_, k) => ({ kind: 'human', name: `P${k + 1}` }));
const across = (r, c, word) => [...word].map((l, k) => ({ i: r * 15 + c + k, l, blank: false }));
const json = JSON.stringify;

export const tests = [
  // ---------- W6-S3-03 ----------
  {
    name: 'W6-S3-03 plaques clear a letter at each twelfth of the bag, at the same point of the game for two, three and four players, whoever draws',
    node: true,
    async run(t) {
      const c = await ctx();
      t.equal(FOG_STEPS, 12, 'twelve steps');
      for (const n of [2, 3, 4]) {
        const s = createGame({ mode: 'play', seats: people(n), seed: 90 + n }, c.lex);
        const start = s.bag.length;
        t.equal(start, 98 - 7 * n, `${n} players: the bag after the deal`);
        t.equal(fogStep(s), 0, 'no step yet');
        const at = [0.25, 0.5, 0.75, 1].map((x) => fogStep({ ...s, bag: s.bag.slice(0, Math.floor(start * (1 - x))) }));
        t.equal(json(at), json([3, 6, 9, 12]), `${n} players: a quarter of the steps at each quarter of the bag`);
      }
      // whole games: each play clears what its own draw earned, never past the cap, and nothing else clears a letter
      for (const n of [2, 3, 4]) {
        let midRound = 0, stepsSeen = 0, games = 0;
        for (let seed = 200; seed < 206; seed++) {
          const s = createGame({ mode: 'play', seats: people(n), seed }, c.lex);
          const start = s.bag.length;
          let steps = 0, half = null;
          for (let k = 0; !s.over && k < 120; k++) {
            const { moves } = generateMoves(c.dict, s.board, s.players[s.cur].rack, { lex: c.lex, featured: [] });
            const seat = s.cur, was = fogStep(s), shown = s.featured.map((f) => f.shown.length);
            // a plain play off the Row, so the other two ways to clear a letter stay out of it
            const mv = moves.find((m) => !m.bonus && !m.tiles.some((x) => isBath(x.i)));
            const r = apply(s, mv ? { type: 'play', tiles: mv.tiles } : { type: 'pass' }, c);
            t.expect(r.ok, r.error);
            if (s.over) break;
            const d = fogStep(s) - was;
            steps += d;
            s.featured.forEach((f, j) => {
              if (f.by != null) return;
              const want = Math.max(shown[j], Math.min(featuredRevealCap(s, f), shown[j] + d));
              if (f.shown.length !== want) t.fail(`${n} players, seed ${seed}, move ${s.move}: ${f.word} shows ${f.shown.length}, wanted ${want} (step ${was} -> ${was + d})`);
              if (new Set(f.shown).size !== f.shown.length) t.fail('a letter cleared twice');
            });
            if (d && seat !== n - 1) midRound++;
            if (half === null && s.bag.length <= start / 2) half = s.featured.filter((f) => f.by == null).map((f) => f.word.length - f.shown.length);
          }
          t.expect(half && half.every((h) => h <= 2), `${n} players, seed ${seed}: two letters or fewer in the fog at half the bag (${half})`);
          if (s.bag.length === 0 && steps === FOG_STEPS) {
            games++;
            t.expect(s.featured.every((f) => f.by != null || f.word.length - f.shown.length === 1), `${n} players, seed ${seed}: one letter short of the word once the bag is empty`);
          }
          stepsSeen += steps;
        }
        t.expect(games >= 4, `${n} players: all the steps by the last tile, in ${games} of 6 games`);
        t.expect(midRound > 0, `${n} players: letters clear on any seat's play, not only at the end of a round (${midRound} of ${stepsSeen})`);
      }
    },
  },
  {
    name: 'W6-S3-03 swaps and passes clear nothing, a full rack clears two letters where it earns two, and an older save goes on from its plaques',
    node: true,
    async run(t) {
      const c = await ctx();
      const s = createGame({ mode: 'play', seats: people(4), seed: 12 }, c.lex);
      s.featured = [{ id: 'thermal', word: 'THERMAL', cat: 'springs', shown: [0], by: null, at: null }];
      for (let k = 0; k < 3; k++) apply(s, { type: 'pass' }, c);
      apply(s, { type: 'swap', letters: s.players[3].rack.slice(0, 3) }, c);
      t.equal(s.cur + '/' + s.round, '0/1', 'a whole round went by');
      t.equal(s.featured[0].shown.length, 1, 'and nothing cleared');
      t.equal(s.bag.length, 70, 'since no tile left the bag for good');
      // four players: 70 / 12 is 5.83 tiles a step, so the seven tiles from 70 cross one and the seven from 65 cross two
      const seven = (bag) => {
        const x = createGame({ mode: 'play', seats: people(4), seed: 12 }, c.lex);
        x.featured = [{ id: 'towel', word: 'TOWELS', cat: 'baths', shown: [0], by: null, at: null }];
        x.bag = x.bag.slice(0, bag);
        x.players[0].rack = 'PLANETS'.split('');
        t.expect(apply(x, { type: 'play', tiles: across(7, 4, 'PLANETS') }, c).ok, 'PLANETS');
        return x.featured[0].shown.length - 1;
      };
      t.equal(seven(70), 1, 'seven tiles from a full bag: one step');
      t.equal(seven(65), 2, 'seven tiles from 65: two steps, two letters');
      // a game saved by the build before: no new field is needed or written
      const old = createGame({ mode: 'play', seats: people(2), seed: 40 }, c.lex);
      const keys = Object.keys(old).sort().join();
      old.featured = [{ id: 'thermal', word: 'THERMAL', cat: 'springs', shown: [0, 3, 5], by: null, at: null }];
      old.bag = old.bag.slice(0, 48); old.round = 4; old.move = 8;
      const back = JSON.parse(json(old));
      t.expect(validSavedGame(back), 'the save is good');
      back.players[0].rack = 'ADXXXXX'.split('');
      t.expect(apply(back, { type: 'play', tiles: across(7, 7, 'AD') }, c).ok, 'AD');   // 48 -> 46 of 84: no step
      t.equal(json(back.featured[0].shown), '[0,3,5]', 'what was clear stays, and nothing catches up at once');
      back.players[1].rack = 'SXXXXXX'.split('');
      back.bag = back.bag.slice(0, 43);
      t.expect(apply(back, { type: 'play', tiles: across(7, 9, 'S') }, c).ok, 'ADS');   // 43 -> 42: half the bag
      t.equal(json(back.featured[0].shown.slice(0, 3)) + back.featured[0].shown.length, '[0,3,5]4', 'the next step adds one');
      t.equal(Object.keys(back).sort().join(), keys, 'and the save holds the same fields');
    },
  },
  {
    name: 'W6-S3-03 a Daily Soak clears the same letters in the same order as before, one a turn',
    node: true,
    async run(t) {
      const c = await ctx();
      // written by the build before this one (a452cbe): the letters shown after nine passes
      const was = { '2026-01-15': '7361520 1326457 3042', '2026-07-04': '4572013 154032 532401', '2026-11-24': '405361 1243 4710523' };
      for (const [date, want] of Object.entries(was)) {
        const s = createGame({ mode: 'daily', date }, c.lex);
        const seen = [s.featured[0].shown.length];
        for (let k = 1; k < DAILY_TURNS; k++) { apply(s, { type: 'pass' }, c); seen.push(s.featured[0].shown.length); }
        t.equal(s.featured.map((f) => f.shown.join('')).join(' '), want, date);
        t.equal(json(seen.slice(0, 3)), '[1,2,3]', `${date}: one a turn`);
      }
    },
  },
  {
    name: 'W6-S3-03 in the page, four players see a letter clear on a play in mid-round, and the plaques and Help say when',
    viewports: ['desktop', 'mobile'],
    initScript: instant,
    async run(t) {
      await ready(t);
      await t.seed(61);
      await t.game('newGame', { seats: people(4) });
      await t.waitIdle(8000);
      await t.game('act', 'reveal');
      const g = (await t.state()).game;
      g.players[0].rack = 'PLANETS'.split('');
      g.featured = [{ id: 'towel', word: 'TOWELS', cat: 'baths', shown: [0], by: null, at: null }, { id: 'thermal', word: 'THERMAL', cat: 'springs', shown: [1], by: null, at: null }, { id: 'casino', word: 'CASINO', cat: 'club', shown: [2], by: null, at: null }];
      await t.game('setState', { game: g });
      await t.game('act', 'stage', across(7, 4, 'PLANETS'));
      await t.game('act', 'play');
      await t.page.waitForFunction(() => window.__game.getState().game.move === 1, null, { timeout: 10000 });
      await t.game('act', 'reveal');
      const after = (await t.state()).game;
      t.equal(after.round, 0, 'still the first round');
      t.equal(json(after.featured.map((f) => f.shown.length)), '[2,2,2]', 'each plaque has cleared a letter after one play of four');
      const open = async () => { const b = t.page.locator('[data-springs-toggle]'); if (await b.count() && await b.getAttribute('aria-expanded') !== 'true') await b.click(); };
      await open();
      const title = t.page.locator('.springs-title').first();
      t.equal((await title.textContent()).trim(), 'Featured Springs +30 each · fog lifts as the bag empties', 'the plaques say when');
      const drawn = await t.page.evaluate(() => [...document.querySelectorAll('#springs .plaque')].map((p) => p.querySelectorAll('.pword b:not(.fog)').length));
      t.equal(json(drawn), '[2,2,2]', 'and show the letters');
      const lines = await title.evaluate((el) => ({ cut: el.scrollWidth - el.clientWidth, h: el.getBoundingClientRect().height, fs: parseFloat(getComputedStyle(el.querySelector('small')).fontSize) }));
      t.expect(lines.cut <= 0 && lines.h < 2.6 * lines.fs, 'on one line, not cut off ' + json(lines));
      await t.shot('W6-S3-03-plaques');
      await t.checkLayout();
      await t.game('newGame', { mode: 'daily', date: '2026-11-24' });
      await t.waitIdle(8000);
      await open();
      t.equal((await t.page.locator('.springs-title').first().textContent()).trim(), 'Featured Springs +30 each · a letter clears every turn', 'the Daily says every turn');
      await t.shot('W6-S3-03-daily');
    },
  },
];

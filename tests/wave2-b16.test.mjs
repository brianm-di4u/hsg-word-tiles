// Wave 2, batch W2-B16: W1-S4-01 (Featured Springs entry-ID matching, dual claims, category reveals,
// late length-1 fog cap, compact plaque category labels).
import { ctx } from './lib.mjs';
import { createGame, apply, evaluate, featuredRevealCap, DAILY_TURNS } from '../src/js/engine.js';
import { generateMoves } from '../src/js/movegen.js';
import { chooseAction } from '../src/js/ai.js';
import { N, CENTER, FEATURED_BONUS } from '../src/js/score.js';
import { breakdownHtml, logHtml, decisiveLine } from '../src/js/ui.js';
import { refPlay } from '../tools/ref-validator.mjs';
import { words as wordsOf, BLOCKED } from '../src/js/dict.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, motion: 'full' }));
  }
};
const at = (r, c) => r * N + c;
const across = (r, c, word) => [...word].map((l, k) => ({ i: at(r, c + k), l }));

export const tests = [
  {
    name: 'W1-S4-01 Featured Springs match any playable form of entry id and credit dual-Featured plays across engine, movegen, reference, and UI helpers',
    node: true,
    async run(t) {
      const c = await ctx();
      const words = new Set([...wordsOf(c.dict)].filter((w) => !BLOCKED.has(w)));
      const themed = new Map();
      for (const e of c.lex.data.words) for (const f of e.forms) themed.set(f, c.lex.data.tiers[e.tier]);

      // 1) Entry-ID form matching: plaque shows STEAMS (id: 'steam'), player plays STEAM -> claims +30 once
      const s1 = createGame({ mode: 'play', seats: [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }], seed: 11 }, c.lex);
      s1.featured = [
        { id: 'steam', word: 'STEAMS', cat: 'springs', shown: [0], by: null, at: null },
        { id: 'casino', word: 'WAXES', cat: 'club', shown: [0], by: null, at: null },
      ];
      s1.players[0].rack = 'STEAMXQ'.split('');
      const ev1 = evaluate(s1, across(7, 5, 'STEAM'), c);
      t.expect(ev1.ok, ev1.error || 'STEAM is legal');
      t.equal(ev1.featured, 'STEAMS', 'playing STEAM matches plaque STEAMS by entry id');
      t.equal(ev1.featuredBonus, FEATURED_BONUS, 'awards +30 Featured bonus');
      t.equal(JSON.stringify(ev1.featuredAll), JSON.stringify(['STEAMS']), 'featuredAll lists STEAMS');

      const r1 = apply(s1, { type: 'play', tiles: across(7, 5, 'STEAM') }, c);
      t.expect(r1.ok, r1.error);
      t.equal(s1.featured[0].by, 0, 'plaque STEAMS marked claimed by seat 0');
      t.equal(s1.featured[0].word, 'STEAMS', 'plaque word preserved for save/box stability');

      // Playing another form (STEAMY) cannot re-claim an already-claimed plaque
      s1.players[1].rack = 'YEEEEEE'.split('');
      const ev1b = evaluate(s1, [{ i: at(7, 10), l: 'Y' }], c);
      t.expect(ev1b.ok, ev1b.error || 'STEAMY legal');
      t.equal(ev1b.featured, null, 'already-claimed Featured Spring does not pay again on another form');
      t.equal(ev1b.featuredBonus, 0, 'featuredBonus is 0 when already claimed');

      // 2) Dual-Featured play: single play forms STEAM across + WAX down, matching BOTH STEAMS (id: steam) and WAXES (id: casino)
      const s2 = createGame({ mode: 'play', seats: [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }], seed: 12 }, c.lex);
      s2.featured = [
        { id: 'steam', word: 'STEAMS', cat: 'springs', shown: [0], by: null, at: null },
        { id: 'casino', word: 'WAXES', cat: 'club', shown: [0], by: null, at: null },
      ];
      s2.board[at(6, 8)] = { l: 'W', blank: false, p: 1, t: 0 };
      s2.board[at(8, 8)] = { l: 'X', blank: false, p: 1, t: 0 };
      s2.players[0].rack = 'STEAMQQ'.split('');
      const tiles = across(7, 5, 'STEAM');
      const ev2 = evaluate(s2, tiles, c);
      t.expect(ev2.ok, ev2.error || 'dual-Featured STEAM/WAX play is legal');
      t.equal(ev2.featuredBonus, FEATURED_BONUS * 2, 'dual-Featured play credits +60');
      t.equal(JSON.stringify(ev2.featuredAll), JSON.stringify(['STEAMS', 'WAXES']), 'both unclaimed plaques matched');

      // Compare against movegen (with featured passed) and independent refPlay
      const gen = generateMoves(c.dict, s2.board, s2.players[0].rack, { lex: c.lex, featured: s2.featured }).moves;
      const key = tiles.map((x) => `${x.i}${x.l}`).join(',');
      const gm = gen.find((m) => m.tiles.map((x) => `${x.i}${x.l}`).join(',') === key);
      t.expect(!!gm, 'movegen generated the dual-Featured play');
      t.equal(gm.score, ev2.score, `movegen score (${gm.score}) matches engine score (${ev2.score}) on dual-Featured play`);
      t.equal(gm.featured, FEATURED_BONUS * 2, 'movegen credits +60 featured bonus');

      const grid = Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, col) => s2.board[at(r, col)]));
      const ref = refPlay(
        grid,
        tiles.map((x) => ({ r: Math.floor(x.i / N), c: x.i % N, l: x.l, blank: false })),
        words,
        themed,
        s2.featured.map((f) => c.lex.byId.get(f.id).forms),
      );
      t.expect(ref.ok && ref.score === ev2.score, `refPlay agrees on dual-Featured score (${ref.score} === ${ev2.score})`);

      // UI helpers reflect dual-Featured bonus accurately
      const bd = breakdownHtml(ev2, s2.board, tiles);
      t.expect(bd.includes('STEAMS +30') && bd.includes('WAXES +30') && bd.includes(`${ev2.score} points`), 'breakdownHtml lists both Featured Springs and exact total');

      const r2 = apply(s2, { type: 'play', tiles }, c);
      t.expect(r2.ok, r2.error);
      t.equal(s2.featured[0].by, 0, 'first plaque claimed by seat 0');
      t.equal(s2.featured[1].by, 0, 'second plaque claimed by seat 0');
      t.equal(JSON.stringify(r2.entry.featuredAll), JSON.stringify(['STEAMS', 'WAXES']), 'log entry stores featuredAll on dual claim');
      t.expect(logHtml(s2, c.lex).includes('Featured +60'), 'logHtml displays Featured +60');
      // Give seat 1 a non-featured play with equal best-turn and themed points so Featured (+60) is the decisive gap
      s2.log.push({ p: 1, kind: 'play', n: 1, tiles: [], words: [{ w: 'QUIZ', score: r2.entry.score, bonus: 0, themed: null, bath: false }], score: r2.entry.score, full: 0, themed: r2.entry.themed, featured: null, rack: '' });
      s2.players[1].score = Math.max(0, s2.players[0].score - 50);
      s2.over = true;
      s2.result = { why: 'out', out: 0, adjust: [0, 0], winners: [0] };
      t.expect(/2 more Featured Springs/.test(decisiveLine(s2)), 'decisiveLine counts both Featured Springs (' + decisiveLine(s2) + ')');

      // CD-WF1-06: AI zero-peeking remains completely intact even with entry-ID matching
      const sAi1 = createGame({ mode: 'play', seats: [{ kind: 'ai', level: 'hard' }, { kind: 'ai', level: 'hard' }], seed: 19 }, c.lex);
      sAi1.featured = [{ id: 'casino', word: 'WAXES', cat: 'club', shown: [0], by: null, at: null }];
      sAi1.players[0].rack = ['C', 'A', 'S', 'I', 'N', 'O', 'Z'];
      const sAi2 = JSON.parse(JSON.stringify(sAi1));
      sAi2.featured = [];
      t.equal(
        JSON.stringify(chooseAction(c.dict, c.lex, sAi1, { level: 'hard', exact: true }).action),
        JSON.stringify(chooseAction(c.dict, c.lex, sAi2, { level: 'hard', exact: true }).action),
        'Hard AI still never peeks at hidden Featured Springs under entry-ID matching',
      );
    },
  },
  {
    name: 'W1-S4-01 playing a Hot Springs word clears +1 fogged letter on its category plaque, and endgame unlocks length - 1 at bag <= 20 or Daily Turn 6+',
    node: true,
    async run(t) {
      const c = await ctx();
      // 1) Category reveal: playing SPRING (cat: springs) immediately clears +1 fogged letter on springs plaque (THERMAL),
      // leaving other categories (baths, club) untouched until the round ends.
      const s = createGame({ mode: 'play', seats: [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }], seed: 21 }, c.lex);
      s.featured = [
        { id: 'thermal', word: 'THERMAL', cat: 'springs', shown: [0], by: null, at: null },
        { id: 'towel', word: 'TOWELS', cat: 'baths', shown: [0], by: null, at: null },
        { id: 'casino', word: 'CASINO', cat: 'club', shown: [0], by: null, at: null },
      ];
      s.players[0].rack = 'SPRINGX'.split('');
      const r = apply(s, { type: 'play', tiles: across(7, 5, 'SPRING') }, c);
      t.expect(r.ok, r.error);
      t.equal(s.featured[0].shown.length, 2, 'same-category Hot Springs play immediately cleared +1 letter on springs plaque (1 -> 2)');
      t.equal(s.featured[1].shown.length, 1, 'unrelated baths plaque stayed at 1 before round wrap');
      t.equal(s.featured[2].shown.length, 1, 'unrelated club plaque stayed at 1 before round wrap');

      // 2) Early Play (bag > 20): cap stops strictly at length - 2
      const sEarly = createGame({ mode: 'play', seats: [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }], seed: 22 }, c.lex);
      sEarly.featured = [{ id: 'tufa', word: 'TUFAS', cat: 'springs', shown: [0, 1, 2], by: null, at: null }]; // 3 of 5 = length - 2
      t.expect(sEarly.bag.length > 20, `bag > 20 (${sEarly.bag.length})`);
      t.equal(featuredRevealCap(sEarly, sEarly.featured[0]), 3, 'cap is length - 2 when bag > 20');
      sEarly.players[0].rack = 'SPRINGX'.split('');
      apply(sEarly, { type: 'play', tiles: across(7, 5, 'SPRING') }, c);
      t.equal(sEarly.featured[0].shown.length, 3, 'bag > 20 does not reveal past length - 2');

      // 3) Late Play (bag <= 20): cap opens to length - 1 (4 of 5), never to length (5 of 5)
      sEarly.bag = sEarly.bag.slice(0, 20);
      t.equal(featuredRevealCap(sEarly, sEarly.featured[0]), 4, 'cap rises to length - 1 at bag === 20');
      sEarly.cur = 1;
      apply(sEarly, { type: 'pass' }, c); // wraps round -> revealRound runs
      t.equal(sEarly.featured[0].shown.length, 4, 'at bag <= 20, fog clears down to length - 1 (4 of 5)');
      // Another round cannot expose the 5th (final) letter while unclaimed
      sEarly.cur = 1;
      sEarly.scoreless = 0;
      apply(sEarly, { type: 'pass' }, c);
      t.equal(sEarly.featured[0].shown.length, 4, 'never reveals full word (stays <= length - 1 while unclaimed)');

      // 4) Daily Soak Turn 1..5 keeps length - 2, Turn 6+ (s.daily.turns <= 5) opens length - 1
      const sd = createGame({ mode: 'daily', date: '2026-11-15', seats: [{ kind: 'human', name: 'You' }] }, c.lex);
      sd.featured = [{ id: 'tufa', word: 'TUFAS', cat: 'springs', shown: [0], by: null, at: null }];
      // Turns 1..4 (passing 4 times -> entering Turn 5, daily.turns === 6): cap stays length - 2 = 3
      for (let k = 0; k < 4; k++) apply(sd, { type: 'pass' }, c);
      t.equal(sd.daily.turns, DAILY_TURNS - 4, '4 turns elapsed -> Turn 5 (6 turns left)');
      t.equal(sd.featured[0].shown.length, 3, 'through Turn 5, Daily caps at length - 2 (3 of 5)');
      // Turn 5 completes -> entering Turn 6 (daily.turns === 5): cap opens to length - 1 = 4
      apply(sd, { type: 'pass' }, c);
      t.equal(sd.daily.turns, DAILY_TURNS - 5, 'entering Turn 6 (5 turns left)');
      t.equal(sd.featured[0].shown.length, 4, 'on Turn 6+, Daily clears down to length - 1 (4 of 5)');
      apply(sd, { type: 'pass' }, c);
      t.equal(sd.featured[0].shown.length, 4, 'Daily never reveals all letters while unclaimed');
    },
  },
  {
    name: 'W1-S4-01 UI displays compact category labels on plaques, clears fog on category plays, and previews/claims entry-ID & dual-Featured plays',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 3, seats: [{ kind: 'human', name: 'You' }, { kind: 'human', name: 'Player 2' }] });
      await t.waitIdle(6000);
      await t.game('act', 'reveal');

      // 1) Compact short category labels beside icons on plaques (verified from cfbabc1)
      const labels = await t.page.evaluate(() => [...document.querySelectorAll('#springs .pcat-name')].map((el) => el.textContent.trim()));
      const valid = new Set(['Row', 'Springs', 'Park', 'Track', 'Club', 'Town']);
      t.expect(labels.length >= 1 && labels.every((x) => valid.has(x)), `plaques render compact short category labels (${labels.join(', ')})`);

      // 2) Same-category Hot Springs play immediately clears +1 fog box in DOM on plaque 0
      const s = await t.state();
      s.game.featured = [
        { id: 'thermal', word: 'THERMAL', cat: 'springs', shown: [0], by: null, at: null },
        { id: 'towel', word: 'TOWELS', cat: 'baths', shown: [0], by: null, at: null },
        { id: 'casino', word: 'WAXES', cat: 'club', shown: [0], by: null, at: null },
      ];
      s.game.players[0].rack = 'STEAMXQ'.split('');
      await t.game('setState', { game: s.game });
      await t.game('act', 'stage', across(7, 5, 'STEAM'));
      await t.game('act', 'play');
      const afterCat = await t.state();
      t.equal(afterCat.game.featured[0].shown.length, 2, 'playing STEAM cleared +1 fogged letter on THERMAL (springs) plaque');
      const domShown = await t.page.evaluate(() => {
        const p0 = document.querySelector('#springs [data-plaque="0"]');
        return p0 ? p0.querySelectorAll('.pword b:not(.fog)').length : -1;
      });
      t.equal(domShown, 2, 'DOM plaque 0 renders 2 cleared letters immediately');

      // 3) Dual-Featured play via entry-ID matching shows Featured +60 in #preview and claims both plaques
      await t.game('newGame', { seed: 4, seats: [{ kind: 'human', name: 'You' }, { kind: 'human', name: 'Player 2' }] });
      await t.waitIdle(6000);
      await t.game('act', 'reveal');
      const s2 = await t.state();
      s2.game.featured = [
        { id: 'steam', word: 'STEAMS', cat: 'springs', shown: [0], by: null, at: null },
        { id: 'casino', word: 'WAXES', cat: 'club', shown: [0], by: null, at: null },
        { id: 'towel', word: 'TOWELS', cat: 'baths', shown: [0], by: null, at: null },
      ];
      s2.game.board[at(6, 8)] = { l: 'W', blank: false, p: 1, t: 0 };
      s2.game.board[at(8, 8)] = { l: 'X', blank: false, p: 1, t: 0 };
      s2.game.players[0].rack = 'STEAMQQ'.split('');
      await t.game('setState', { game: s2.game });
      await t.game('act', 'stage', across(7, 5, 'STEAM'));
      const pvText = await t.page.textContent('#preview');
      t.expect(/Featured \+60/.test(pvText), `preview shows Featured +60 on dual-Featured play (${pvText})`);
      await t.page.click('#preview .bdbtn');
      const bdText = await t.page.textContent('#preview .bd');
      t.expect(bdText.includes('STEAMS +30') && bdText.includes('WAXES +30'), `breakdown lists both claimed plaques (${bdText})`);
      await t.game('act', 'play');
      const afterDual = await t.state();
      t.equal(afterDual.game.featured[0].by, 0, 'STEAMS claimed in game state');
      t.equal(afterDual.game.featured[1].by, 0, 'WAXES claimed in game state');
      t.expect(await t.page.locator('#springs .plaque.claimed').count() === 2, 'both plaques render claimed in #springs');
      await t.game('act', 'reveal');
      if (t.viewport === 'mobile') await t.page.click('#springs [data-springs-toggle]');
      await t.shot('W1-S4-01-dual-featured');
    },
  },
];

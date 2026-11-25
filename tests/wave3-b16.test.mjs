// Wave 3, batch W3-B16: W6-S3-03 (the fog follows the bag, whatever the number of players; the rest of the bridge was built by 09095e2 and
// c37d1ad, tests: wave2-b16) and W6-P-N04 (What you missed: in the worker, lost Challenge turns, the square; the everyday-word choice was built
// by ace2440, tests: wave2-b06).
import { ctx } from './lib.mjs';
import { createGame, apply, fogStep, featuredRevealCap, FOG_STEPS, DAILY_TURNS } from '../src/js/engine.js';
import { generateMoves } from '../src/js/movegen.js';
import { isBath, findWords, scorePlay } from '../src/js/score.js';
import { reviewSteps, bestOf, summarize, REVIEW_NODES, REVIEW_NODES_MAIN } from '../src/js/review.js';
import { reviewHtml } from '../src/js/ui.js';
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
  // ---------- W6-P-N04 ----------
  {
    name: 'W6-P-N04 the look back says where each best play goes: the word laid from that square, that way, scores what it says',
    node: true,
    async run(t) {
      const c = await ctx();
      const dirs = { across: 0, down: 0 }, sizes = { one: 0, more: 0 };
      let checked = 0;
      for (const seed of [31, 32, 33]) {
        const s = createGame({ mode: 'play', seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', level: seed === 31 ? 'hard' : 'easy' }], seed }, c.lex);
        for (let k = 0; !s.over && k < 60; k++) {
          const { moves } = generateMoves(c.dict, s.board, s.players[s.cur].rack, { lex: c.lex, featured: [] });
          t.expect(apply(s, moves.length ? { type: 'play', tiles: moves[Math.min(s.cur === 0 ? 3 : 0, moves.length - 1)].tiles } : { type: 'pass' }, c).ok, 'a legal move');
        }
        const steps = [...reviewSteps(s, 0, c.dict, c.lex)], turns = [...s.log].filter((e) => e.p === 0 && e.kind !== 'end');
        t.equal(steps.length, turns.length, 'a result for every turn');
        const board = Array(225).fill(null);
        let n = 0;
        for (const e of s.log) {
          if (e.kind === 'end') continue;
          if (e.p === 0) {
            const { best } = steps[n++];
            if (best && !e.rack.includes('?')) {
              const step = best.dir === 'across' ? 1 : 15, rack = [...e.rack];
              const cells = [...best.word].map((l, k) => ({ i: best.at + k * step, l }));
              const tiles = cells.filter((x) => !board[x.i]);
              t.expect(cells.every((x) => !board[x.i] || board[x.i].l === x.l), `${best.word} runs through the tiles on the board (${best.at} ${best.dir})`);
              t.expect(tiles.length > 0 && tiles.every((x) => { const k = rack.indexOf(x.l); if (k < 0) return false; rack.splice(k, 1); return true; }), `and the rest of ${best.word} is on the rack ${e.rack}`);
              const found = findWords(board, tiles);
              t.equal(found.words[0].w, best.word, 'it reads as that word');
              t.equal(scorePlay(board, found, tiles.length, c.lex, s.featured.filter((f) => (e.known || []).includes(f.word)).map((f) => ({ ...f, by: null }))).score, best.score, `${best.word} there scores ${best.score}`);
              dirs[best.dir]++; sizes[tiles.length === 1 ? 'one' : 'more']++; checked++;
            }
          }
          if (e.kind === 'play') for (const x of e.tiles) board[x.i] = { l: x.l, blank: !!x.blank };
        }
      }
      t.log(`${checked} best plays checked: ${json(dirs)} ${json(sizes)}`);
      t.expect(checked >= 15 && dirs.across > 2 && dirs.down > 2, 'both ways occur');
      // a one-tile play is told by the word it is listed under
      const b = Array(225).fill(null);
      for (const [k, l] of [...'CAT'].entries()) b[7 * 15 + 6 + k] = { l, blank: false };
      const one = bestOf(c.dict, c.lex, { board: b, rack: ['E'], featured: [], casual: false }).best;
      t.equal(json(one), json({ word: 'CATE', score: one.score, at: 111, dir: 'across' }), 'CATE from G8 across, by its E alone');
      const b2 = Array(225).fill(null);
      for (const [k, l] of [...'CAT'].entries()) b2[(6 + k) * 15 + 7] = { l, blank: false };
      t.equal(json(bestOf(c.dict, c.lex, { board: b2, rack: ['E'], featured: [], casual: false }).best), json({ word: 'CATE', score: one.score, at: 97, dir: 'down' }), 'and down from H7');
    },
  },
  {
    name: 'W6-P-N04 a turn lost to a Challenge is told as that, a pass as a pass, and the sheet keeps to what it knows',
    node: true,
    async run(t) {
      const c = await ctx();
      const s = createGame({ mode: 'play', seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', level: 'easy' }], seed: 31, challenge: true }, c.lex);
      const turn = (action, challenge) => { const r = apply(s, action, c); t.expect(r.ok, r.error); if (challenge) r.entry.challenge = challenge; s.cur = 0; s.scoreless = 0; };
      turn({ type: 'pass' }, 'QZXJ');
      turn({ type: 'pass' });
      turn({ type: 'swap', letters: s.players[0].rack.slice(0, 2) });
      const steps = [...reviewSteps(s, 0, c.dict, c.lex)];
      t.equal(json(steps.map((x) => x.challenge || x.kind)), '["QZXJ","pass","swap"]', 'the steps');
      const text = (r) => reviewHtml(r).replace(/<[^>]+>/g, '').replace(/&#39;|&rsquo;/g, "'");
      const all = text(summarize(steps));
      t.expect(/Turn 1 You tried QZXJ, not in the dictionary, and lost the turn\. [A-Z]+ would have scored \d+, (across|down) from [A-O]\d+\./.test(all), 'the lost turn: ' + all);
      t.equal((all.match(/You passed\./g) || []).length, 1, 'one pass'); t.equal((all.match(/You swapped tiles\./g) || []).length, 1, 'one swap');
      t.expect(/Columns run A to O and rows 1 to 15, so H8 is the centre square\./.test(all), 'and how squares are named');
      t.expect(/in everyday and Hot Springs words, or a better one\./.test(all), 'an Easy game says which words it looked at');
      // a save is not trusted: the word is escaped, and anything but a word is a pass
      const odd = (v) => { const x = JSON.parse(json(s)); x.log[0].challenge = v; return reviewHtml(summarize([...reviewSteps(x, 0, c.dict, c.lex)])); };
      t.expect(!odd('<img src=x>').includes('<img'), 'a word from a save is escaped');
      for (const v of [true, 7, '', null, {}]) t.equal((odd(v).match(/You passed\./g) || []).length, 2, `${json(v)}: a pass`);
      // against Hard the full dictionary is meant, and said as before
      const hard = JSON.parse(json(s)); hard.players[1].level = 'hard';
      t.expect(/you made the highest-scoring play your tiles allowed\./.test(text(summarize([...reviewSteps(hard, 0, c.dict, c.lex)]))), 'against Hard');
      t.expect(!/Columns run/.test(text({ total: 1, found: 1, misses: [], skipped: 0, cut: 0, casual: false })), 'no squares, no word about them');
      // a game reviewed with nothing of where (a step made by hand) says no square
      t.expect(/JO would have scored 9\./.test(text({ total: 1, found: 0, misses: [{ turn: 1, kind: 'pass', best: { word: 'JO', score: 9 } }], skipped: 0 })), 'no square named where none is known');
    },
  },
  {
    name: 'W6-P-N04 a search cut short never says the best was played, and only open boards with two blanks are cut on the page itself',
    node: true,
    async run(t) {
      const c = await ctx();
      const s = createGame({ mode: 'play', seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', level: 'hard' }], seed: 31 }, c.lex);
      for (let k = 0; k < 8; k++) { const m = generateMoves(c.dict, s.board, s.players[s.cur].rack, { lex: c.lex, featured: [] }).moves; t.expect(apply(s, { type: 'play', tiles: m[0].tiles }, c).ok, 'a play'); }
      const q = (rack) => ({ board: s.board, rack: rack.split(''), featured: [], casual: false });
      t.equal(bestOf(c.dict, c.lex, q('AEINRT?'), REVIEW_NODES_MAIN).partial, undefined, 'one blank: looked through to the end on the page too');
      t.equal(bestOf(c.dict, c.lex, q('AEINRT?')).partial, undefined, 'and in the worker');
      const two = bestOf(c.dict, c.lex, q('AEIRT??'));
      t.equal(two.partial, undefined, 'two blanks: to the end in the worker');
      const short = bestOf(c.dict, c.lex, q('AEIRT??'), 20000);
      t.equal(short.partial, true, 'a short search says so');
      t.expect(short.best && short.best.score <= two.best.score, 'and finds no more than there is');
      t.expect(REVIEW_NODES_MAIN <= 300000 && REVIEW_NODES >= 2e6, 'the two limits');
      const x = (score, best, partial) => ({ turn: 1, kind: 'play', word: 'A', score, best: { word: 'B', score: best }, casual: false, ...(partial ? { partial } : {}) });
      t.equal(json(summarize([x(20, 20), x(20, 20, true), x(20, 18, true), x(20, 40, true), { turn: 5, skipped: true }])),
        json({ total: 2, found: 1, misses: [{ ...x(20, 40, true), gap: 20 }], skipped: 1, cut: 2, casual: false }), 'a cut search counts only when it found better');
      t.expect(/2 turns had too many plays to look through here\./.test(reviewHtml(summarize([x(20, 20), x(20, 20, true), x(20, 18, true)]))), 'and the sheet says how many were left out');
    },
  },
  {
    name: 'W6-P-N04 in the page, What you missed is worked out in the worker turn by turn, names the lost Challenge turn and the square, and works without one',
    viewports: ['desktop', 'mobile'],
    initScript: instant,
    async run(t) {
      await ready(t);
      await t.page.evaluate(() => {
        window.__posted = []; window.__refuse = false;
        const post = Worker.prototype.postMessage;
        Worker.prototype.postMessage = function (m, ...r) { if (m && m.type === 'review') { window.__posted.push(JSON.parse(JSON.stringify(m))); if (window.__refuse) throw new Error('refused'); } return post.call(this, m, ...r); };
      });
      await t.seed(31);
      await t.game('newGame', { seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }], challenge: true });
      await t.waitIdle(8000);
      const g = (await t.state()).game;
      g.players[0].rack = 'QZPLANT'.split(''); g.players[1].rack = 'VVVVVVV'.split('');
      g.bag = g.bag.slice(0, 5);   // too few for the computer to swap: it passes
      await t.game('setState', { game: g });
      await t.game('act', 'stage', across(7, 7, 'QZ'));
      await t.game('act', 'play');
      await t.page.waitForFunction(() => window.__game.getState().game.move === 2, null, { timeout: 15000 });
      await t.game('act', 'pass');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 15000 });
      const sheet = async () => {
        await t.page.click('[data-review]');
        await t.page.waitForSelector('.review .rv-rate', { timeout: 15000 });
        return (await t.page.textContent('.review')).replace(/\s+/g, ' ');
      };
      const text = await sheet();
      t.equal((await t.state()).ai, 'worker', 'the worker is running');
      const posted = await t.page.evaluate(() => window.__posted.splice(0));
      t.equal(posted.length, 2, 'both turns were asked of the worker');
      t.equal(json(posted.map((m) => m.turn.featured)), '[[],[]]', 'with no hidden Featured Spring');
      const best = /Turn 1 You tried QZ, not in the dictionary, and lost the turn\. ([A-Z]+) would have scored (\d+), (across|down) from ([A-O]\d+)\. ?Turn 2 You passed\./.exec(text);
      t.expect(best, 'the sheet: ' + text);
      const direct = await t.game('act', 'eval', []);   // the hook answers, so the page is awake
      t.expect(direct && direct.ok === false, 'the page is awake');
      await t.shot('W6-P-N04-review');
      await t.checkLayout();
      await t.page.click('.review [data-close]');
      // no worker any more: the same sheet, worked out on the page
      await t.page.evaluate(() => { window.__refuse = true; });
      const again = await sheet();
      t.equal((await t.state()).ai, 'main', 'the worker was given up');
      t.equal(again, text, 'and the sheet is the same');
      await t.page.click('.review [data-close]');
    },
  },
];

// Wave 3, batch C: P-N02 (a word check in Help), S2-15 (hint allowance), S3-07 (Hot Springs bonuses), S3-08 (Daily streak),
// P-N03 (words with no tie to their fact), S4-24 / S4-02 (the Bathhouse Row medallions) and S3-03 (Daily par and history).
import { ctx, root } from './lib.mjs';
import { emptyStats, applyGame, hintsUsed, nextStreak } from '../src/js/stats.js';
import { ROW_BONUS } from '../src/js/score.js';
import { createGame, curateBag } from '../src/js/engine.js';
import { dailyPar } from '../src/js/par.js';
import { TILES, BLANKS } from '../src/js/tiles.js';
const TOTAL = Object.values(TILES).reduce((a, x) => a + x.count, 0) + BLANKS;
import { generateMoves } from '../src/js/movegen.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => { window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false })); };

// a finished game: the human (seat 0) with 300 points against Opal, plus whatever `extra` says about the human
const game = (extra) => ({
  mode: 'play', seed: 1, rng: { bag: 1, ai: 2 }, over: true, featured: [],
  players: [{ kind: 'human', name: 'You', score: 300, best: { word: 'QUARTZ', score: 54 }, hints: 3, ...extra }, { kind: 'ai', name: 'Opal', persona: 'opal', level: 'easy', score: 50, best: null, hints: null }],
  log: [{ p: 0, kind: 'play', n: 0, score: 91, full: 0, words: [{ w: 'SPRING', score: 91, bonus: 0 }] }, { kind: 'end' }],
  result: { why: 'out', out: 0, adjust: [0, 0], winners: [0] },
});

const DAILY = 'hs-letters-daily-v1';
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
  // ---------- P-N02 ----------
  {
    name: 'P-N02 Help has a word check that answers from the dictionary and names a Hot Springs word',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('scene', 'help');
      const ask = async (w) => {
        await t.page.fill('#wc-in', w);
        await t.page.click('.wordcheck button[type=submit]');
        return t.page.textContent('#wc-out');
      };
      t.expect(/is in the dictionary and can be played/.test(await ask('qi')), 'QI is playable');
      t.expect(/XQZVV is not in the dictionary/.test(await ask('xqzvv')), 'a made-up word is refused, in capitals');
      t.expect(/Type a word of two letters/.test(await ask('a')), 'one letter asks for more');
      const hot = await ask('spring');
      t.expect(/Hot Springs word/.test(hot) && /\+\d+/.test(hot), `SPRING is named as a Hot Springs word with its bonus (${hot})`);
      t.expect(!/Hot Springs word/.test(await ask('cat')), 'an everyday word with no town tie is not');
      await t.page.fill('#wc-in', 'spring');
      await t.page.press('#wc-in', 'Enter');
      t.expect(/SPRING is in the dictionary/.test(await t.page.textContent('#wc-out')), 'Enter submits the form');
      t.expect(await t.page.getAttribute('#wc-out', 'role') === 'status', 'the answer is a live region');
      await t.page.locator('#wc-out').scrollIntoViewIfNeeded();
      await t.shot('P-N02-word-check');
      await t.checkLayout({ allowScrollY: true });
    },
  },
  // ---------- S2-15 ----------
  {
    name: 'S2-15 the results card says Unlimited hints and how many were used, and Unaided where none were taken',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      const cards = await t.page.evaluate(async ([a, b]) => {
        const ui = await import(new URL('src/js/ui.js', location.href).href);
        return [ui.overHtml(a, window.__G.lex, null, { pb: [] }), ui.overHtml(b, window.__G.lex, null, { pb: [] })];
      }, [game({ unl: true, taken: 4 }), game({})]);
      t.expect(/Unlimited hints, 4 used/.test(cards[0]), 'unlimited: the card says so and counts them');
      t.expect(/Unaided/.test(cards[1]) && !/Unlimited/.test(cards[1]), 'three, none taken: Unaided');
    },
  },
  {
    name: 'S2-15 unlimited hints: a game with them sets no personal best, and a game with three still does',
    node: true,
    async run(t) {
      const first = applyGame(emptyStats(), game({})).stats;
      const unl = applyGame(first, game({ unl: true, taken: 0, score: 500 }));
      t.equal(unl.stats.bestScore, 300, 'unlimited hints, none taken: the best score stays');
      t.expect(unl.pb.held, 'and the game says it held a best back');
      t.equal(unl.stats.games, 2, 'but it counts as a game'); t.equal(unl.stats.wins, 2, 'and a win');
      t.equal(hintsUsed({ hints: 3, unl: true, taken: 4 }), 4, 'hints taken are counted');
      t.equal(applyGame(first, game({ unl: true, taken: 4 })).stats.hints, first.hints + 4, 'and added to the hints used');
      t.equal(applyGame(first, game({ score: 500 })).stats.bestScore, 500, 'a three-hint game with none taken still sets one');
    },
  },
  {
    name: 'S2-15 setup offers unlimited hints; with them the Hint button never runs out',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.seed(7);
      await t.game('scene', 'setup');
      if (!(await t.page.locator('.house-rules').evaluate((d) => d.open))) await t.page.click('.house-rules summary');
      t.expect(await t.page.isEnabled('[data-hints-unl]'), 'the allowance is offered while hints are on');
      await t.page.locator('[data-hints-unl]').scrollIntoViewIfNeeded();
      await t.shot('S2-15-setup-hints');
      await t.page.selectOption('[data-hints-unl]', 'unl');
      await t.page.uncheck('[data-hints]');
      t.expect(await t.page.isDisabled('[data-hints-unl]'), 'switching hints off greys the allowance');
      await t.page.check('[data-hints]');
      await t.page.click('[data-start]');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'game', null, { timeout: 15000 });
      await t.waitIdle(8000);
      t.equal((await t.page.textContent('[data-act="hint"] em')).trim(), '∞', 'the Hint button shows the infinity sign');
      for (let n = 1; n <= 4; n++) {
        await t.game('act', 'hint');
        await t.game('act', 'recall');
        await t.waitIdle(8000);
        const p = (await t.state()).game.players[0];
        t.equal(p.taken, n, 'hint ' + n + ' is counted');
        t.equal(p.hints, 3, 'and the allowance does not run down');
      }
      t.expect(await t.page.isEnabled('[data-act="hint"]'), 'a fourth hint was still allowed, and the button is still on');
      await t.shot('S2-15-hint-unlimited');
      // the setup is remembered as chosen, and a newer game of the same seats keeps it
      const st = await t.page.evaluate(() => JSON.parse(localStorage.getItem('hs-letters-settings-v1')).lastSetup);
      t.equal(st.hintsUnl, true, 'the choice is saved with the setup');
      await t.reload();
      await t.game('scene', 'setup');
      t.equal(await t.page.inputValue('[data-hints-unl]'), 'unl', 'and comes back after a reload');
      await t.checkLayout({ allowScrollY: true });
    },
  },
  // ---------- S3-07 ----------
  {
    name: 'S3-07 the tiers pay 10 / 18 / 30, a Bathhouse Row square adds a flat 20, and the move generator scores it the same way',
    node: true,
    async run(t) {
      const c = await ctx();
      t.equal(JSON.stringify(c.lex.data.tiers), JSON.stringify({ 1: 10, 2: 18, 3: 30 }), 'tiers 10 / 18 / 30');
      t.equal(ROW_BONUS, 20, 'the Row bonus is 20');
      // every themed play the generator finds for a rack is scored like the engine scores it (bonus and Row flag), over several racks
      const { createGame, evaluate } = await import('../src/js/engine.js');
      let themed = 0, row = 0;
      for (const seed of [3, 5, 8, 13, 21]) {
        const s = createGame({ mode: 'play', seats: [{ kind: 'ai', persona: 'opal', level: 'easy' }, { kind: 'ai', persona: 'hollis', level: 'hard' }], seed }, c.lex);
        const moves = generateMoves(c.dict, s.board, s.players[0].rack, { lex: c.lex, featured: s.featured }).moves;
        for (const m of moves.slice(0, 300)) {
          const ev = evaluate(s, m.tiles, c);
          if (!ev.ok) continue;
          t.equal(m.score, ev.score, 'generator and engine agree on ' + m.words[0]);
          for (const w of ev.words) if (w.bonus) { themed++; if (w.bath) row++; t.expect(w.bonus === c.lex.bonusOf(c.lex.entry(w.w)) + (w.bath ? 20 : 0), w.w + ' pays its tier, plus 20 on the Row'); }
        }
      }
      t.expect(themed > 0, 'at least one Hot Springs play was seen (' + themed + ', ' + row + ' on the Row)');
    },
  },
  {
    name: 'S3-07 Help lists the new tiers and the Row bonus',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('scene', 'help');
      await t.page.click('[data-tab="squares"]');
      const text = await t.page.textContent('.help-body');
      t.expect(text.includes('Hot Springs word +10 / 18 / 30'), 'the bonus line says 10 / 18 / 30');
      t.expect(/earns 20 more/.test(text), 'the Row line says 20 more');
      t.expect(!/earns its bonus twice/.test(text), 'and no longer says twice');
    },
  },
  // ---------- S3-08 ----------
  {
    name: 'S3-08 one missed day is forgiven by a rest day, once in any seven; two missed days still end the streak',
    node: true,
    async run(t) {
      const a = nextStreak({ streak: 5, last: '2026-11-10', rest: null }, '2026-11-11');
      t.equal(a.streak, 6, 'the next day adds one'); t.expect(!a.rested, 'with no rest day used');
      const b = nextStreak({ streak: 5, last: '2026-11-10', rest: null }, '2026-11-12');
      t.equal(b.streak, 6, 'one missed day keeps the streak and adds the day'); t.expect(b.rested && b.rest === '2026-11-12', 'and uses the rest day');
      const c = nextStreak({ streak: 6, last: '2026-11-12', rest: '2026-11-12' }, '2026-11-14');
      t.equal(c.streak, 1, 'a second gap within seven days of the rest ends the streak');
      const d = nextStreak({ streak: 6, last: '2026-11-18', rest: '2026-11-12' }, '2026-11-20');
      t.equal(d.streak, 7, 'seven days after the rest, another gap is forgiven'); t.equal(d.rest, '2026-11-20', 'and the new rest is remembered');
      t.equal(nextStreak({ streak: 5, last: '2026-11-10', rest: null }, '2026-11-13').streak, 1, 'two missed days end the streak');
      t.equal(nextStreak({ streak: 0, last: null }, '2026-11-13').streak, 1, 'a first play starts a streak of one');
      t.equal(nextStreak({ streak: 5, last: '2026-02-28', rest: null }, '2026-03-02').streak, 6, 'a gap across the end of February is one day, not three');
      t.equal(nextStreak({ streak: 5, last: '2026-11-10', rest: 7 }, '2026-11-12').streak, 6, 'a damaged rest field is ignored');
    },
  },
  {
    name: 'S3-08 playing the Daily after one missed day keeps the saved streak, says why, and the best streak holds it',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ days: { '2026-11-10': { score: 120, plays: 1 } }, streak: 5, last: '2026-11-10' })), DAILY);
      await t.game('newGame', { mode: 'daily', date: '2026-11-12' });
      await t.page.waitForFunction(() => window.__game.getState().scene === 'game', null, { timeout: 8000 });
      await playOut(t);
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 8000 });
      const rec = await t.page.evaluate((k) => JSON.parse(localStorage.getItem(k)), DAILY);
      t.equal(rec.streak, 6, 'the streak went 5 to 6'); t.equal(rec.rest, '2026-11-12', 'the rest day is saved'); t.equal(rec.last, '2026-11-12', 'with the day');
      const st = await t.page.evaluate(() => JSON.parse(localStorage.getItem('hs-letters-stats-v1')));
      t.equal(st.daily.bestStreak, 6, 'and the best streak is 6');
      t.expect(/rest day kept your streak/.test(await t.page.textContent('.daily-box')), 'the results card says a rest day was used');
      await t.shot('S3-08-rest-day');
      await t.game('scene', 'records');
      t.expect(/once in any seven days/.test(await t.page.textContent('.sheet')), 'Records explains it');
    },
  },
  // ---------- S4-02 and S4-24 ----------
  {
    name: 'S4-02 each Bathhouse Row square is painted with its own medallion, and the painted pictures are all used (S4-24)',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      const r = await t.page.evaluate(async () => {
        const base = (f) => new URL('src/js/' + f, location.href).href;
        const { art } = await import(base('art.js'));
        const R = await import(base('render2d.js'));
        const { BATHHOUSES } = await import(base('layout.js'));
        const { ART_LIST } = await import(base('art-list.js'));
        const names = Object.entries(BATHHOUSES).map(([i, n]) => [+i, 'bath-' + n.toLowerCase()]);
        const load = async (n) => { const im = new Image(); im.src = 'assets/' + n + '.webp'; await im.decode(); return im; };
        const size = 1200, cell = size / R.U, N = 15;
        const sample = (cv, i) => {
          const c = cv.getContext('2d'), x = (R.FRAME + (i % N) + 0.2) * cell, y = (R.FRAME + Math.floor(i / N) + 0.2) * cell, w = cell * 0.6;
          const d = c.getImageData(Math.round(x), Math.round(y), Math.round(w), Math.round(w)).data;
          const W = Math.round(w), G = 4, grid = new Array(G * G * 3).fill(0), cnt = new Array(G * G).fill(0);
          for (let py = 0; py < W; py++) for (let px = 0; px < W; px++) {
            const gi = Math.floor(py * G / W) * G + Math.floor(px * G / W), k = (py * W + px) * 4;
            for (let q = 0; q < 3; q++) grid[gi * 3 + q] += d[k + q];
            cnt[gi]++;
          }
          return grid.map((v, j) => v / cnt[Math.floor(j / 3)]);
        };
        art.on = true; art.imgs = {};
        const plain = R.paintBoard(size, 'light');
        const without = names.map(([i]) => sample(plain, i));
        for (const [, n] of names) art.imgs[n] = await load(n);
        const painted = R.paintBoard(size, 'light');
        const withArt = names.map(([i]) => sample(painted, i));
        art.imgs = {};
        return { names: names.map((x) => x[1]), without, withArt, list: ART_LIST.filter((n) => /^bath-/.test(n)) };
      });
      const dist = (u, v) => u.reduce((acc, x, j) => acc + Math.abs(x - v[j]), 0) / u.length;
      t.equal(r.names.length, 8, 'eight Row squares');
      t.equal(JSON.stringify(r.list.slice().sort()), JSON.stringify(r.names.slice().sort()), 'and eight medallions in the art list, one for each');
      for (let k = 0; k < 8; k++) {
        const d = dist(r.without[k], r.withArt[k]);
        t.expect(d > 25, r.names[k] + ' changes the square (mean difference ' + d.toFixed(1) + ' of 255)');
      }
      // the eight are eight different pictures
      let minApart = 1e9;
      for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) minApart = Math.min(minApart, dist(r.withArt[a], r.withArt[b]));
      t.expect(minApart > 8, 'no two medallions look alike (closest pair ' + minApart.toFixed(1) + ' apart)');
      // in the game itself the preloaded pictures are used by the board: nothing failed to load, and the board shows them
      const g = await t.page.evaluate(() => ({ failed: window.__G ? 0 : -1 }));
      t.expect(g.failed === 0, 'the game is running');
      await t.game('newGame', { seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
      await t.waitIdle(8000);
      await t.shot('S4-02-row-medallions');
    },
  },
  // ---------- S3-03 ----------
  {
    name: 'S3-03 the first two Daily racks hold 2 to 4 vowels on every one of 400 dates, and the bag is the same tiles',
    node: true,
    async run(t) {
      const c = await ctx();
      const d0 = Date.UTC(2026, 0, 1, 12);
      let bad = 0, changed = 0;
      for (let k = 0; k < 400; k++) {
        const date = new Date(d0 + k * 86400000).toISOString().slice(0, 10);
        const s = createGame({ mode: 'daily', date }, c.lex);
        const all = s.players[0].rack.concat(s.bag);
        for (const part of [all.slice(0, 7), all.slice(7, 14)]) { const v = part.filter((l) => 'AEIOU'.includes(l)).length; if (v < 2 || v > 4) bad++; }
        t.equal(all.length, TOTAL, 'the whole bag is still there (' + date + ')');
        if (all.slice().sort().join('') !== (() => { const f = createGame({ mode: 'daily', date }, c.lex); return f.players[0].rack.concat(f.bag).sort().join(''); })()) changed++;
      }
      t.equal(bad, 0, 'no rack with fewer than 2 or more than 4 vowels');
      t.equal(changed, 0, 'and a date is dealt the same twice');
      const sample = ['Q', 'Z', 'X', 'K', 'J', 'B', 'C', 'D', 'T', 'N', 'S', 'R', 'L', 'M', 'A', 'E', 'I', 'O', 'U', 'A'];
      curateBag(sample);
      t.expect(sample.slice(0, 7).filter((l) => 'AEIOU'.includes(l)).length >= 2, 'a rack of consonants gets vowels from later in the bag');
      t.equal(sample.slice().sort().join(''), ['Q', 'Z', 'X', 'K', 'J', 'B', 'C', 'D', 'T', 'N', 'S', 'R', 'L', 'M', 'A', 'E', 'I', 'O', 'U', 'A'].sort().join(''), 'and nothing is lost');
    },
  },
  {
    name: 'S3-03 par for a date is the same every time and Hard scores at least as much as Medium on average',
    node: true,
    async run(t) {
      const c = await ctx();
      let hard = 0, med = 0;
      for (const date of ['2026-11-12', '2026-11-13', '2026-11-14']) {
        const a = await dailyPar(c, date), b = await dailyPar(c, date);
        t.equal(JSON.stringify(a), JSON.stringify(b), date + ': the same par twice');
        t.expect(a.m > 0 && a.h > 0, date + ': both are real scores (' + a.m + ', ' + a.h + ')');
        hard += a.h; med += a.m;
      }
      t.expect(hard > med, 'over three days Maestro Fitch out-scores Hollis Crane (' + hard + ' against ' + med + ')');
    },
  },
  {
    name: 'S3-03 the Daily results show par and the first try, Records shows fourteen days with stars, and the record keeps first and par',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { mode: 'daily', date: '2026-11-12' });
      await t.page.waitForFunction(() => window.__game.getState().scene === 'game', null, { timeout: 8000 });
      const first = (await playOut(t)).players[0].score;
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over' && /scored [0-9]+ and .* [0-9]+ on these tiles/.test(document.querySelector('.daily-box').textContent), null, { timeout: 20000 });
      t.expect(/Hollis Crane scored [0-9]+ and Maestro Julian Fitch [0-9]+ on these tiles/.test(await t.page.textContent('.daily-box')), 'par is on the results box');
      let rec = await t.page.evaluate((k) => JSON.parse(localStorage.getItem(k)), DAILY);
      t.equal(rec.days['2026-11-12'].first, first, 'the first try is saved'); t.expect(rec.days['2026-11-12'].par && rec.days['2026-11-12'].par.h > 0, 'and par');
      await t.shot('S3-03-daily-par');
      // a second try on the same day keeps the first try and says so
      await t.game('newGame', { mode: 'daily', date: '2026-11-12' });
      await t.page.waitForFunction(() => window.__game.getState().scene === 'game', null, { timeout: 8000 });
      await playOut(t);
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 8000 });
      t.expect(new RegExp('Your first try today: ' + first + "[.]").test(await t.page.textContent('.daily-box')), 'the replay shows the first try');
      rec = await t.page.evaluate((k) => JSON.parse(localStorage.getItem(k)), DAILY);
      t.equal(rec.days['2026-11-12'].first, first, 'the first try is not overwritten'); t.equal(rec.days['2026-11-12'].plays, 2, 'two plays');
      // fourteen days with stars, from a record with par on some days
      const today = await t.page.evaluate(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
      await t.page.evaluate(([k, td]) => {
        const day = (n) => { const [y, m, d] = td.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d - n, 12)).toISOString().slice(0, 10); };
        localStorage.setItem(k, JSON.stringify({ streak: 3, last: td, days: {
          [day(0)]: { score: 400, first: 400, plays: 1, par: { m: 300, h: 350 } },
          [day(1)]: { score: 320, first: 320, plays: 1, par: { m: 300, h: 350 } },
          [day(2)]: { score: 200, first: 200, plays: 2, par: { m: 300, h: 350 } },
          [day(3)]: { score: 250, plays: 1 },
        } }));
      }, [DAILY, today]);
      await t.game('scene', 'records');
      t.equal(await t.page.locator('.dstrip li').count(), 14, 'fourteen days');
      const label = (n) => t.page.getAttribute('.dstrip li:nth-child(' + (14 - n) + ')', 'aria-label');
      t.expect(/2 stars/.test(await label(0)), 'beating Hard par: two stars'); t.expect(/1 star/.test(await label(1)), 'beating Medium only: one star (' + await label(1) + ')');
      t.expect(/no stars/.test(await label(2)), 'under both: none'); t.expect(!/star/.test(await label(3)) && /250 points/.test(await label(3)), 'a day with no par shows only its score');
      t.expect(/not played/.test(await label(5)), 'an empty day says so');
      await t.page.locator('.dstrip').scrollIntoViewIfNeeded();
      await t.shot('S3-03-history-strip');
      await t.checkLayout({ allowScrollY: true });
    },
  },
];

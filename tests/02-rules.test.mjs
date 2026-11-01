// Rules engine: board, bag, placement legality, scoring, bonuses, swaps, passes and the ending.
import { ctx } from './lib.mjs';
import { createGame, apply, evaluate, fullBag, DAILY_TURNS } from '../src/js/engine.js';
import { SQUARE, N, CENTER, VALUE, isBath } from '../src/js/score.js';
import { TILES } from '../src/js/tiles.js';

const two = [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }];
const at = (r, c) => r * N + c;
const across = (r, c, word) => [...word].map((l, k) => ({ i: at(r, c + k), l }));
const down = (r, c, word) => [...word].map((l, k) => ({ i: at(r + k, c), l }));
async function game(racks, opts = {}) {
  const c = await ctx();
  const s = createGame({ mode: 'play', seats: opts.seats || two, seed: 1 }, c.lex);
  racks.forEach((r, k) => { s.players[k].rack = r.split(''); });
  if (opts.featured) s.featured = opts.featured;
  return { s, c };
}
const sum = (w) => [...w].reduce((a, l) => a + VALUE[l], 0);

export const tests = [
  {
    name: 'layout counts and symmetry', node: true,
    run(t) {
      const count = (k) => SQUARE.filter((x) => x === k).length;
      t.equal(count('b'), 4, 'Boiling Springs');
      t.equal(count('s'), 12, 'Steam');
      t.equal(count('h'), 8, 'Hot');
      t.equal(count('w'), 22, 'Warm');
      t.equal(count('B'), 8, 'Bathhouse Row');
      t.equal(SQUARE[CENTER], '*', 'Display Spring at the centre');
      for (let i = 0; i < N * N; i++) if (SQUARE[i] !== SQUARE[N * N - 1 - i]) t.fail(`asymmetric at ${i}`);
    },
  },
  {
    name: 'bag and deal', node: true,
    async run(t) {
      const bag = fullBag();
      t.equal(bag.length, 98, '98 tiles');
      t.equal(bag.filter((l) => l === '?').length, 2, '2 blanks');
      for (const [l, x] of Object.entries(TILES)) t.equal(bag.filter((y) => y === l).length, x.count, `${l} count`);
      const c = await ctx();
      const s = createGame({ mode: 'play', seats: [...two, { kind: 'ai', level: 'easy', name: 'C' }], seed: 7 }, c.lex);
      t.expect(s.players.every((p) => p.rack.length === 7), 'every rack has 7');
      t.equal(s.bag.length, 98 - 21, 'bag after the deal');
      const s2 = createGame({ mode: 'play', seats: [...two, { kind: 'ai', level: 'easy', name: 'C' }], seed: 7 }, c.lex);
      t.equal(JSON.stringify(s2), JSON.stringify(s), 'same seed, same game');
      t.equal(s.featured.length, 3, 'three featured springs');
      t.equal(new Set(s.featured.map((f) => f.cat)).size, 3, 'from three categories');
    },
  },
  {
    name: 'placement errors', node: true,
    async run(t) {
      const { s, c } = await game(['SPRINGA', 'TUBEXYZ']);
      const err = (tiles) => evaluate(s, tiles, c).error || 'ok';
      t.expect(/Display Spring/.test(err(across(0, 0, 'SPRING'))), 'first word must cover the centre');
      t.expect(/two tiles/.test(err([{ i: CENTER, l: 'S' }])), 'first word needs two tiles');
      t.expect(/one row or one column/.test(err([{ i: at(7, 7), l: 'S' }, { i: at(8, 8), l: 'P' }])), 'one line');
      t.expect(/gaps/.test(err([{ i: at(7, 7), l: 'S' }, { i: at(7, 9), l: 'P' }])), 'no gaps');
      t.expect(/not on your rack/.test(err(across(7, 5, 'SPRINGS'))), 'rack check (second S)');
      t.expect(/not in the dictionary/.test(err(across(7, 7, 'SPGN'))), 'dictionary check');
      t.equal(err(across(7, 4, 'SPRING')), 'ok', 'a good opening');
      apply(s, { type: 'play', tiles: across(7, 4, 'SPRING') }, c);
      t.expect(/join/.test(evaluate(s, across(0, 0, 'TUB'), c).error), 'later words must connect');
      t.expect(/taken/.test(evaluate(s, [{ i: at(7, 4), l: 'T' }], c).error), 'occupied square');
      t.equal(s.cur, 1, 'turn passed');
    },
  },
  {
    name: 'premiums apply only to newly covered squares', node: true,
    async run(t) {
      // Row 7: . w . w . . . * . . . w . w .  — (7,3) and (7,11) are Warm squares
      const { s, c } = await game(['QUARTZS', 'EEEEEEE']);
      t.equal(SQUARE[at(7, 3)], 'w', 'warm square at 7,3');
      const ev = evaluate(s, across(7, 3, 'QUARTZ'), c);
      t.expect(ev.ok, 'QUARTZ is legal');
      const base = sum('QUARTZ') + VALUE.Q; // Q doubled on the Warm square
      t.equal(ev.words[0].score, base, 'letter premium');
      t.equal(ev.words[0].bonus, 15, 'QUARTZ is a tier-2 bonus word');
      apply(s, { type: 'play', tiles: across(7, 3, 'QUARTZ') }, c);
      // B extends QUARTZ? no: B plays a word through existing tiles using the Q square again → no premium
      s.players[1].rack = 'ESETTSS'.split('');
      const ev2 = evaluate(s, [{ i: at(7, 9), l: 'E' }, { i: at(7, 10), l: 'S' }], c);
      t.expect(ev2.ok, 'QUARTZES');
      t.equal(ev2.words[0].score, sum('QUARTZES'), 'old Warm square no longer doubles Q');
    },
  },
  {
    name: 'word premiums multiply', node: true,
    async run(t) {
      const { s, c } = await game(['TUFAQQQ', 'EEEEEEE']);
      // Put a tile structure to reach a Steam square: (4,6) is Steam. Play down through col 6 from row 4 to row 7.
      t.equal(SQUARE[at(4, 6)], 's', 'steam at 4,6');
      s.board[at(7, 6)] = { l: 'A', blank: false };
      s.board[at(7, 7)] = { l: 'T', blank: false };
      // TUFA down col 6 ending on the existing A at row 7
      const ev = evaluate(s, [{ i: at(4, 6), l: 'T' }, { i: at(5, 6), l: 'U' }, { i: at(6, 6), l: 'F' }], c);
      t.expect(ev.ok, ev.error || 'TUFA legal');
      t.equal(ev.words[0].w, 'TUFA', 'main word');
      t.equal(ev.words[0].score, sum('TUFA') * 2, 'Steam doubles the word');
      t.equal(ev.words[0].bonus, 25, 'TUFA tier-3 bonus');
    },
  },
  {
    name: 'full soak and blanks', node: true,
    async run(t) {
      const { s, c } = await game(['STEAMI?', 'EEEEEEE']);
      // AMITIES from S T E A M I and a blank standing for the second I
      const play = across(7, 1, 'AMITIES');
      play[4].blank = true;
      const ev = evaluate(s, play, c);
      t.expect(ev.ok, ev.error || 'AMITIES with a blank');
      t.equal(ev.full, 40, 'Full Soak +40');
      const expectWord = (() => {
        let total = 0, mult = 1;
        play.forEach((x) => { const v = x.blank ? 0 : VALUE[x.l]; const k = SQUARE[x.i]; total += v * ({ w: 2, h: 3 }[k] || 1); mult *= { s: 2, b: 3 }[k] || 1; });
        return total * mult;
      })();
      t.equal(ev.words[0].score, expectWord, 'blank scores 0');
      t.equal(ev.score, expectWord + 40, 'total');
    },
  },
  {
    name: 'bonus doubled on a Bathhouse Row square', node: true,
    async run(t) {
      const { s, c } = await game(['SPAEEEE', 'EEEEEEE']);
      // (0,8) is the Superior square. Put an A at (1,8) and an existing column to connect.
      t.expect(isBath(at(0, 8)), 'bathhouse square');
      s.board[at(1, 8)] = { l: 'P', blank: false };
      s.board[at(2, 8)] = { l: 'A', blank: false };
      // S on (0,8) forms SPA down
      const ev = evaluate(s, [{ i: at(0, 8), l: 'S' }], c);
      t.expect(ev.ok, ev.error || 'SPA legal');
      const spa = ev.words.find((w) => w.w === 'SPA');
      t.equal(spa.bonus, 20, 'tier-1 bonus 10 doubled');
      t.expect(spa.bath, 'flagged as a Bathhouse Row word');
    },
  },
  {
    name: 'featured spring pays once', node: true,
    async run(t) {
      const featured = [{ id: 'steam', word: 'STEAM', cat: 'springs', shown: [0], by: null, at: null }];
      const { s, c } = await game(['STEAMXX', 'STEAMQQ'], { featured });
      const r = apply(s, { type: 'play', tiles: across(7, 5, 'STEAM') }, c);
      t.expect(r.ok, r.error);
      t.equal(r.entry.featured, 'STEAM', 'featured claimed');
      t.equal(s.featured[0].by, 0, 'claimed by seat 0');
      // seat 1 plays STEAM down from the S
      const r2 = apply(s, { type: 'play', tiles: down(8, 5, 'TEAM') }, c);
      t.expect(r2.ok, r2.error);
      t.equal(r2.entry.featured, null, 'no second featured bonus');
    },
  },
  {
    name: 'swap and pass', node: true,
    async run(t) {
      const { s, c } = await game(['ABCDEFG', 'HIJKLMN']);
      const before = s.bag.slice(0, 2);
      const r = apply(s, { type: 'swap', letters: ['G', 'A'] }, c);
      t.expect(r.ok, r.error);
      t.equal(s.players[0].rack.length, 7, 'rack refilled');
      t.equal(JSON.stringify(s.players[0].rack.slice(5)), JSON.stringify(before), 'drew from the top');
      t.equal(JSON.stringify(s.bag.slice(-2)), JSON.stringify(['A', 'G']), 'returned to the bottom in order');
      t.equal(s.cur, 1, 'turn passed');
      t.expect(apply(s, { type: 'pass' }, c).ok, 'pass');
      t.equal(s.scoreless, 2, 'two scoreless turns');
      s.bag = s.bag.slice(0, 5);
      t.expect(/at least seven/.test(apply(s, { type: 'swap', letters: ['A'] }, c).error || ''), 'no swap with < 7 in the bag');
    },
  },
  {
    name: 'ending: going out and stalling', node: true,
    async run(t) {
      const { s, c } = await game(['AT', 'QZ']);
      s.bag = [];
      const r = apply(s, { type: 'play', tiles: across(7, 7, 'AT') }, c);
      t.expect(r.ok, r.error);
      t.expect(s.over, 'game over when a player goes out on an empty bag');
      t.equal(s.result.why, 'out', 'reason');
      const pen = VALUE.Q + VALUE.Z;
      t.equal(s.players[1].score, -pen, 'rack penalty');
      t.equal(s.players[0].score, sum('AT') + pen, 'go-out gain');
      const g2 = await game(['ABCDEFG', 'HIJKLMN']);
      for (let k = 0; k < 4; k++) apply(g2.s, { type: 'pass' }, g2.c);
      t.expect(g2.s.over && g2.s.result.why === 'stalled', 'two scoreless rounds end the game');
    },
  },
  {
    name: 'daily: one player, ten turns, same tiles for a date', node: true,
    async run(t) {
      const c = await ctx();
      const a = createGame({ mode: 'daily', date: '2026-11-01' }, c.lex);
      const b = createGame({ mode: 'daily', date: '2026-11-01' }, c.lex);
      const z = createGame({ mode: 'daily', date: '2026-11-02' }, c.lex);
      t.equal(JSON.stringify(a.bag), JSON.stringify(b.bag), 'same date, same bag');
      t.expect(JSON.stringify(a.bag) !== JSON.stringify(z.bag), 'another date, another bag');
      t.equal(a.players.length, 1, 'solo');
      for (let k = 0; k < DAILY_TURNS; k++) apply(a, { type: 'pass' }, c);
      t.expect(a.over && a.result.why === 'daily', 'ends after 10 turns');
    },
  },
  {
    name: 'featured plaques clear a letter each round', node: true,
    async run(t) {
      const { s, c } = await game(['ABCDEFG', 'HIJKLMN']);
      const before = s.featured.map((f) => f.shown.length);
      apply(s, { type: 'pass' }, c);
      apply(s, { type: 'pass' }, c);
      t.equal(JSON.stringify(s.featured.map((f) => f.shown.length)), JSON.stringify(before.map((n) => n + 1)), 'one more letter each');
      for (const f of s.featured) for (let k = 0; k < 20; k++) { s.cur = 1; s.over = false; s.scoreless = 0; apply(s, { type: 'pass' }, c); }
      t.expect(s.featured.every((f) => f.shown.length <= f.word.length - 2), 'never more than length − 2');
    },
  },
];

// The engine against the independent reference (tools/ref-validator.mjs) on 50,000 plays: legal moves
// from the generator plus mutated and random placements, on positions from seeded greedy games.
// Both must agree on legal / illegal and, when legal, on the score.
import { ctx, hasRaw } from './lib.mjs';
import { createGame, apply, evaluate } from '../src/js/engine.js';
import { generateMoves } from '../src/js/movegen.js';
import { N } from '../src/js/score.js';
import { referenceWordSet, refPlay } from '../tools/ref-validator.mjs';
import { seedState, rand } from '../src/js/rng.js';

const TARGET = 50000;

export const tests = [
  {
    name: 'engine agrees with the reference on 50,000 plays', node: true,
    async run(t) {
      if (!hasRaw()) { t.log('raw word lists missing: run tools/fetch-wordlists.mjs (skipped)'); return; }
      const c = await ctx();
      const words = referenceWordSet();
      const themed = new Map();
      for (const e of c.lex.data.words) for (const f of e.forms) themed.set(f, c.lex.data.tiers[e.tier]);
      const r = { rng: { x: seedState(2026) } };
      const R = () => rand(r, 'x');
      const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let plays = 0, legal = 0, mismatches = 0;
      const compare = (s, tiles) => {
        plays++;
        // the engine checks the rack too; give the player exactly these tiles
        const saved = s.players[s.cur].rack;
        s.players[s.cur].rack = tiles.map((x) => (x.blank ? '?' : x.l));
        const ev = evaluate(s, tiles, c);
        s.players[s.cur].rack = saved;
        const grid = Array.from({ length: N }, (_, y) => Array.from({ length: N }, (_, x) => s.board[y * N + x]));
        const ref = refPlay(grid, tiles.map((x) => ({ r: Math.floor(x.i / N), c: x.i % N, l: x.l, blank: !!x.blank })), words, themed,
          s.featured.filter((f) => f.by == null).map((f) => f.word));
        if (ev.ok !== ref.ok || (ev.ok && ev.score !== ref.score)) {
          mismatches++;
          if (mismatches <= 10) t.fail(`mismatch: ${JSON.stringify(tiles)} engine ${ev.ok ? ev.score : ev.error} ref ${ref.ok ? ref.score : ref.reason + ' ' + (ref.word || '')}`);
        }
        if (ev.ok) legal++;
      };
      for (let seed = 1; plays < TARGET; seed++) {
        const s = createGame({ mode: 'play', seats: [{ kind: 'ai', name: 'A' }, { kind: 'ai', name: 'B' }], seed }, c.lex);
        while (!s.over && plays < TARGET) {
          const { moves } = generateMoves(c.dict, s.board, s.players[s.cur].rack, { lex: c.lex, featured: s.featured });
          for (let k = 0; k < Math.min(25, moves.length); k++) {
            const m = moves[Math.floor(R() * moves.length)];
            compare(s, m.tiles);
            // mutations: change a letter, shift one tile, drop one tile, add a random neighbour tile
            const mut = m.tiles.map((x) => ({ ...x }));
            const j = Math.floor(R() * mut.length);
            const kind = Math.floor(R() * 4);
            if (kind === 0) mut[j].l = A[Math.floor(R() * 26)];
            else if (kind === 1) mut[j].i = Math.max(0, Math.min(N * N - 1, mut[j].i + [1, -1, N, -N][Math.floor(R() * 4)]));
            else if (kind === 2 && mut.length > 1) mut.splice(j, 1);
            else mut.push({ i: Math.max(0, Math.min(N * N - 1, mut[j].i + [2, -2, 2 * N, -2 * N][Math.floor(R() * 4)])), l: A[Math.floor(R() * 26)] });
            if (new Set(mut.map((x) => x.i)).size === mut.length) compare(s, mut);
          }
          // a few fully random placements in a line
          for (let k = 0; k < 5; k++) {
            const len = 1 + Math.floor(R() * 4), start = Math.floor(R() * N * N), across = R() < 0.5;
            const tiles = [];
            for (let q = 0; q < len; q++) {
              const i = across ? start + q : start + q * N;
              if (i >= N * N || (across && Math.floor(i / N) !== Math.floor(start / N)) || s.board[i]) break;
              tiles.push({ i, l: A[Math.floor(R() * 26)] });
            }
            if (tiles.length) compare(s, tiles);
          }
          const best = moves[0];
          apply(s, best ? { type: 'play', tiles: best.tiles } : { type: 'pass' }, c);
        }
      }
      t.log(`${plays} plays compared, ${legal} legal, ${mismatches} mismatches`);
      t.equal(mismatches, 0, 'no mismatches');
    },
  },
];

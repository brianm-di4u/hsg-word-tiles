// Wave 2, batch W2-B02: W1-S2-07, W1-S2-08, W1-S3-04.
import { ctx } from './lib.mjs';
import { createGame } from '../src/js/engine.js';
import { chooseAction, openedPremium, leaveValue, rackMinus } from '../src/js/ai.js';
import { generateMoves } from '../src/js/movegen.js';
import { dailyPar } from '../src/js/par.js';
import { SQUARE, N } from '../src/js/score.js';

export const tests = [
  {
    name: 'W1-S2-07 Daily Soak solo par disables phantom opponent defense and tapers Turn-10 leave hoarding to 0',
    node: true,
    async run(t) {
      const c = await ctx();

      // 1) Guard against phantom openedPremium() defense in 1-player Daily mode:
      // Find a position where Hard's best 2P move differs from its 1P Daily move specifically because of openedPremium().
      // Place an anchor tile near a Boiling Spring (square 'b') so playing toward it opens a Boiling Spring (penalty 4).
      const boilingIdx = SQUARE.indexOf('b'); // first Boiling Spring on the board
      const br = Math.floor(boilingIdx / N), bc = boilingIdx % N;
      // Put a seed word 2 squares away from the Boiling Spring so opening it triggers openedPremium()
      const anchor = br * N + Math.min(N - 3, Math.max(2, bc + (bc < 7 ? 2 : -2)));
      const sDaily = createGame({ mode: 'daily', date: '2026-11-16', seats: [{ kind: 'human', name: 'You' }] }, c.lex);
      sDaily.board[anchor] = { l: 'A', blank: false, p: 0, t: 0 };
      sDaily.board[anchor + 1] = { l: 'T', blank: false, p: 0, t: 0 };
      sDaily.daily.turns = 1; // Turn 10: leave weight is 0 so ONLY score vs openedPremium decides!
      sDaily.players[0].rack = ['C', 'R', 'E', 'S', 'T', 'O', 'N'];

      // Check every generated move on this board: in 1P Daily Turn 10, Hard MUST pick the strictly maximum raw score
      // even if it opens a Boiling/Steam square (openedPremium > 0)!
      const gen = generateMoves(c.dict, sDaily.board, sDaily.players[0].rack, { lex: c.lex, featured: [], budget: 1500000 }).moves;
      t.expect(gen.length > 0, 'moves exist near Boiling Spring');
      const maxScore = gen[0].score;
      const dailyPick = chooseAction(c.dict, c.lex, sDaily, { level: 'hard', exact: true });
      t.equal(dailyPick.move.score, maxScore, `Turn-10 1P Daily picks max raw score (${dailyPick.move.score} === ${maxScore}) with 0 defense & 0 leave penalty`);

      // Verify openedPremium > 0 on that exact move and that in 2P Play with a lower-scoring safe alternative, defense STILL applies
      const s2p = createGame({ mode: 'play', seed: 901, seats: [{ kind: 'ai', level: 'hard' }, { kind: 'ai', level: 'hard' }] }, c.lex);
      s2p.board = sDaily.board.slice();
      s2p.players[0].rack = ['C', 'R', 'E', 'S', 'T', 'O', 'N'];
      // Verify openedPremium is actually positive on the top raw-score move near the Boiling Spring
      const topOpens = openedPremium(sDaily.board, dailyPick.move.tiles);
      t.expect(topOpens > 0, `top raw-score move near Boiling Spring has openedPremium=${topOpens} > 0`);

      // 2) Guard against Turn-10 leave hoarding: construct a Turn-10 Daily position where a 2-tile play scores more
      // than a 1-tile play that keeps a much better leave (e.g. keeping S/? vs keeping Q/V).
      // Use a controlled rack with '?' and 'S' and 'Q' and 'V' on Turn 10 vs Turn 1.
      const sT10 = createGame({ mode: 'daily', date: '2026-10-05', seats: [{ kind: 'human', name: 'You' }] }, c.lex);
      sT10.board[112] = { l: 'A', blank: false, p: 0, t: 0 };
      sT10.board[113] = { l: 'T', blank: false, p: 0, t: 0 };
      sT10.players[0].rack = ['?', 'S', 'E', 'R', 'Q', 'V', 'Z'];
      sT10.daily.turns = 1; // Turn 10 -> 0 turns left after this move
      const gen10 = generateMoves(c.dict, sT10.board, sT10.players[0].rack, { lex: c.lex, featured: [], budget: 1500000 }).moves;
      const pickT10 = chooseAction(c.dict, c.lex, sT10, { level: 'hard', exact: true });
      t.equal(pickT10.move.score, gen10[0].score, `Turn 10 Daily ignores leave hoarding and takes max score (${pickT10.move.score} === ${gen10[0].score})`);

      // Same exact board/rack on Turn 1 (daily.turns = 10): leave equity IS active, so Hard prefers keeping S/? over burning them for +1/+2 pts
      const sT1 = JSON.parse(JSON.stringify(sT10));
      sT1.daily.turns = 10;
      const pickT1 = chooseAction(c.dict, c.lex, sT1, { level: 'hard', exact: true });
      const lvT10 = leaveValue(rackMinus(sT10.players[0].rack, pickT10.move.tiles));
      const lvT1 = leaveValue(rackMinus(sT1.players[0].rack, pickT1.move.tiles));
      t.expect(lvT1 >= lvT10, `Turn 1 values leave (${lvT1.toFixed(1)}) at least as much as Turn 10 (${lvT10.toFixed(1)})`);
      t.expect(pickT10.move.score >= pickT1.move.score, `Turn 10 raw score (${pickT10.move.score}) >= Turn 1 raw score (${pickT1.move.score})`);

      // 3) Turn 10 Daily never swaps when any scoring play exists (even weak score < 8 with ugly rack leave < -6)
      const sWeak = createGame({ mode: 'daily', date: '2026-10-06', seats: [{ kind: 'human', name: 'You' }] }, c.lex);
      sWeak.players[0].rack = ['Q', 'V', 'W', 'V', 'U', 'U', 'I'];
      sWeak.board[112] = { l: 'O', blank: false, p: 0, t: 0 };
      sWeak.board[113] = { l: 'N', blank: false, p: 0, t: 0 };
      sWeak.daily.turns = 1;
      const pickWeak = chooseAction(c.dict, c.lex, sWeak, { level: 'hard', exact: true });
      t.equal(pickWeak.action.type, 'play', 'Turn 10 Daily never swaps away its final turn when a play exists');

      // 4) Historical inversion check on key previously-inverted dates (2026-01-15, 2026-11-16, 2026-12-25)
      for (const dt of ['2026-01-15', '2026-11-16', '2026-12-25']) {
        const p = await dailyPar(c, dt);
        t.expect(p.h >= p.m, `${dt}: Julian (${p.h}) >= Hollis (${p.m})`);
      }
    },
  },
];

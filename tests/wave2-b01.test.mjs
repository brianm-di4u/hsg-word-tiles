// Wave 2, batch W2-B01: W1-S3-01, W1-S3-02.
import { ctx } from './lib.mjs';
import { createGame, apply } from '../src/js/engine.js';
import { chooseAction, hintChoices, LEVELS, EASY_TWO } from '../src/js/ai.js';
import { reviewSteps } from '../src/js/review.js';
import { isCommon } from '../src/js/dict.js';

export const tests = [
  {
    name: 'W1-S3-01 Easy AI plays only everyday common words + EASY_TWO, avoids Full Soaks, and averages ~220-290 pts',
    node: true,
    async run(t) {
      const c = await ctx();
      t.equal(LEVELS.easy.freeLen, 0, 'Easy freeLen is 0');
      t.expect(LEVELS.easy.slip >= 0.6, 'Easy slip is softened (' + LEVELS.easy.slip + ')');
      t.expect(LEVELS.easy.maxLen <= 6, 'Easy maxLen caps routine 7-tile Full Soaks (' + LEVELS.easy.maxLen + ')');

      // Explicit guard against obscure 2-3 letter tournament words: rack with only rare 2-3 letter tools (QI, ZA, XI, ZAX, XU, KI)
      const sRare = createGame({ mode: 'play', seats: [{ kind: 'ai', level: 'easy' }, { kind: 'ai', level: 'medium' }], seed: 42 }, c.lex);
      sRare.players[0].rack = ['Q', 'I', 'Z', 'X', 'U', 'K', 'J'];
      const rRare = chooseAction(c.dict, c.lex, sRare, { level: 'easy' });
      if (rRare.action.type === 'play') {
        for (const w of rRare.move.words) {
          t.expect(w.length === 2 ? EASY_TWO.has(w) : isCommon(c.dict, w), `Easy must not play rare word ${w}`);
        }
      }

      // Explicit check that everyday 2-letter OK is playable by Easy even though OK is not marked SCOWL common
      const sOk = createGame({ mode: 'play', seats: [{ kind: 'ai', level: 'easy' }, { kind: 'ai', level: 'medium' }], seed: 43 }, c.lex);
      sOk.players[0].rack = ['O', 'K', 'Q', 'V', 'Z', 'J', 'X'];
      const rOk = chooseAction(c.dict, c.lex, sOk, { level: 'easy' });
      t.equal(rOk.action.type, 'play', 'Easy can play everyday OK when no longer word fits');
      t.expect(rOk.move.words.includes('OK'), 'Easy played OK (' + rOk.move.words.join(',') + ')');

      // 40 seeded Easy-vs-Medium games: verify beginner score band and zero obscure short words or 7-tile Full Soaks
      let words = 0, bad = 0, easyFulls = 0;
      const easyScores = [];
      for (let g = 0; g < 40; g++) {
        const flip = g % 2 === 1;
        const seats = flip ? [{ kind: 'ai', level: 'easy' }, { kind: 'ai', level: 'medium' }] : [{ kind: 'ai', level: 'medium' }, { kind: 'ai', level: 'easy' }];
        const s = createGame({ mode: 'play', seats, seed: 3000 + g }, c.lex);
        let guard = 0;
        while (!s.over && guard++ < 400) {
          const lv = s.players[s.cur].level;
          const { action } = chooseAction(c.dict, c.lex, s, { level: lv });
          const r = apply(s, action, c);
          if (!r.ok) throw new Error(`illegal move: ${r.error}`);
          if (lv === 'easy' && r.entry.kind === 'play') {
            if (r.entry.full) easyFulls++;
            for (const w of r.entry.words) {
              words++;
              const ok = w.w.length === 2 ? EASY_TWO.has(w.w) : isCommon(c.dict, w.w);
              if (!ok) bad++;
            }
          }
        }
        easyScores.push(s.players[flip ? 0 : 1].score);
      }
      const avg = easyScores.reduce((a, b) => a + b, 0) / easyScores.length;
      t.equal(bad, 0, `zero non-common/obscure words across ${words} Easy words`);
      t.equal(easyFulls, 0, 'Easy drops zero 7-tile Full Soaks');
      t.expect(avg >= 190 && avg <= 285, `Easy avg vs Medium is approachable beginner tier (${avg.toFixed(1)} pts)`);
      t.log(`Easy vs Medium (40g): avg=${avg.toFixed(1)} pts, words=${words}, nonCommon=${bad}, fullSoaks=${easyFulls}`);
    },
  },
  {
    name: 'W1-S3-02 AI opponents, Spring Guide hints, and post-game Review never peek at hidden Featured Springs (+30)',
    node: true,
    async run(t) {
      const c = await ctx();
      // Construct a position where the rack can play either a fogged Featured Spring (CASINO) or a higher-scoring non-featured word (CASINOS/etc.)
      // Compare chooseAction & hintChoices WITH the hidden Featured Spring vs WITH featured: [] — results must be byte-identical across all levels!
      for (const level of ['easy', 'medium', 'hard']) {
        const makeState = (feat) => {
          const s = createGame({ mode: 'play', seats: [{ kind: 'ai', level }, { kind: 'ai', level }], seed: 777 }, c.lex);
          // Rack can make CASINO (tier 2, +18) or CAZIQUE/etc., or ZAX/CASINO — use a rack where CASINO is beaten by a plain/themed play WITHOUT +30, but wins WITH +30!
          s.players[0].rack = ['C', 'A', 'S', 'I', 'N', 'O', 'Z'];
          s.featured = feat;
          return s;
        };
        const hiddenFeat = [{ id: 'casino', word: 'CASINO', cat: 'club', shown: [0], by: null, at: null }];
        const withFeat = chooseAction(c.dict, c.lex, makeState(hiddenFeat), { level, exact: true });
        const withoutFeat = chooseAction(c.dict, c.lex, makeState([]), { level, exact: true });
        t.equal(JSON.stringify(withFeat.action), JSON.stringify(withoutFeat.action), `${level} AI action is identical with or without hidden Featured Spring`);
        t.equal(withFeat.move?.featured || 0, 0, `${level} AI move scoring adds 0 hidden Featured equity`);
      }

      // Spring Guide hints must be identical with or without hidden Featured Spring
      const hWith = createGame({ mode: 'play', seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', level: 'medium' }], seed: 778 }, c.lex);
      hWith.players[0].rack = ['C', 'A', 'S', 'I', 'N', 'O', 'Z'];
      hWith.featured = [{ id: 'casino', word: 'CASINO', cat: 'club', shown: [0], by: null, at: null }];
      const hWithout = JSON.parse(JSON.stringify(hWith));
      hWithout.featured = [];
      t.equal(JSON.stringify(hintChoices(c.dict, c.lex, hWith, 3)), JSON.stringify(hintChoices(c.dict, c.lex, hWithout, 3)), 'hintChoices ignores hidden Featured Spring');

      // Review must not add +30 hidden Featured equity
      const revState = JSON.parse(JSON.stringify(hWith));
      const applied = apply(revState, { type: 'play', tiles: [{ i: 112, l: 'I', blank: false }, { i: 113, l: 'N', blank: false }] }, c);
      t.expect(applied.ok, 'setup play applied');
      const revNoFeat = JSON.parse(JSON.stringify(revState));
      revNoFeat.featured = [];
      const stepsWith = [...reviewSteps(revState, 0, c.dict, c.lex)];
      const stepsWithout = [...reviewSteps(revNoFeat, 0, c.dict, c.lex)];
      t.equal(JSON.stringify(stepsWith), JSON.stringify(stepsWithout), 'reviewSteps ignores hidden Featured Spring');

      // Hard empty-bag 1-ply lookahead must also ignore hidden Featured Springs on opponent's reply
      const endWith = createGame({ mode: 'play', seats: [{ kind: 'ai', level: 'hard' }, { kind: 'ai', level: 'hard' }], seed: 780 }, c.lex);
      endWith.bag = [];
      endWith.board[112] = { l: 'S', blank: false, p: 1, t: 0 };
      endWith.board[113] = { l: 'O', blank: false, p: 1, t: 0 };
      endWith.players[0].rack = ['A', 'T', 'E'];
      endWith.players[1].rack = ['C', 'A', 'S', 'I', 'N', 'O'];
      endWith.featured = [{ id: 'casino', word: 'CASINO', cat: 'club', shown: [0], by: null, at: null }];
      const endWithout = JSON.parse(JSON.stringify(endWith));
      endWithout.featured = [];
      const e1 = chooseAction(c.dict, c.lex, endWith, { level: 'hard', exact: true });
      const e2 = chooseAction(c.dict, c.lex, endWithout, { level: 'hard', exact: true });
      t.equal(JSON.stringify(e1.action), JSON.stringify(e2.action), 'Hard 1-ply empty-bag lookahead ignores hidden Featured Spring');

      // Verify organic claims STILL work in the engine when an AI happens to play the Featured word on its own merit
      const org = createGame({ mode: 'play', seats: [{ kind: 'ai', level: 'hard' }, { kind: 'ai', level: 'hard' }], seed: 779 }, c.lex);
      org.players[0].rack = ['C', 'A', 'S', 'I', 'N', 'O', 'S'];
      org.featured = [{ id: 'casino', word: 'CASINOS', cat: 'club', shown: [0], by: null, at: null }];
      const pick = chooseAction(c.dict, c.lex, org, { level: 'hard', exact: true });
      t.equal(pick.move.featured, 0, 'Hard AI did not see +30 during search');
      const res = apply(org, pick.action, c);
      t.expect(res.ok && res.entry.words.some((w) => w.w === 'CASINOS'), 'Hard AI organically played 7-tile CASINOS on word merit');
      t.equal(res.entry.featured, 'CASINOS', 'Engine still awards organic Featured Spring claim');
      t.equal(org.featured[0].by, 0, 'Featured plaque marked claimed by seat 0');
    },
  },
];

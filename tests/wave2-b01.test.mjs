// Wave 2, batch W2-B01: W1-S3-01 (Easy AI calibration & everyday vocab).
import { ctx } from './lib.mjs';
import { createGame, apply } from '../src/js/engine.js';
import { chooseAction, LEVELS, EASY_TWO } from '../src/js/ai.js';
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
];

// AI: every action from every level is legal over many games; Easy plays only common words up to six
// letters; Medium only common words or words of two or three letters; the leave table is sane.
import { ctx } from './lib.mjs';
import { createGame, apply } from '../src/js/engine.js';
import { chooseAction, leaveValue, LEVELS } from '../src/js/ai.js';
import { isCommon } from '../src/js/dict.js';

async function games(levels, n, from, onPlay) {
  const c = await ctx();
  let actions = 0;
  for (let g = 0; g < n; g++) {
    const s = createGame({ mode: 'play', seats: levels.map((level) => ({ kind: 'ai', level })), seed: from + g }, c.lex);
    let guard = 0;
    while (!s.over && guard++ < 400) {
      const level = s.players[s.cur].level;
      const { action } = chooseAction(c.dict, c.lex, s, { level });
      const r = apply(s, action, c);
      if (!r.ok) throw new Error(`seed ${from + g}: ${level} made an illegal ${action.type}: ${r.error}`);
      actions++;
      if (onPlay && r.entry.kind === 'play') onPlay(level, r.entry, c);
    }
    if (!s.over) throw new Error(`seed ${from + g}: game did not finish`);
  }
  return actions;
}

export const tests = [
  {
    name: 'every AI action is legal (300 games, all pairings and a 4-seat table)', node: true,
    async run(t) {
      let n = 0;
      n += await games(['easy', 'medium'], 80, 100);
      n += await games(['medium', 'hard'], 80, 200);
      n += await games(['hard', 'easy'], 80, 300);
      n += await games(['easy', 'medium', 'hard', 'hard'], 60, 400);
      t.log(`${n} AI actions, all legal`);
    },
  },
  {
    name: 'Easy and Medium keep to their vocabularies', node: true,
    async run(t) {
      let easy = 0, medium = 0;
      await games(['easy', 'medium'], 60, 500, (level, e, c) => {
        for (const w of e.words) {
          if (level === 'easy') { easy++; if (!isCommon(c.dict, w.w) || e.words[0].w.length > LEVELS.easy.maxLen) t.fail(`Easy played ${w.w}`); }
          if (level === 'medium') { medium++; if (!(w.w.length < 4 || isCommon(c.dict, w.w))) t.fail(`Medium played ${w.w}`); }
        }
      });
      t.log(`${easy} Easy words, ${medium} Medium words checked`);
    },
  },
  {
    name: 'leave values: blanks and S are kept, Q and duplicates are not', node: true,
    run(t) {
      t.expect(leaveValue(['?']) > leaveValue(['Q']), 'blank beats Q');
      t.expect(leaveValue(['S']) > leaveValue(['V']), 'S beats V');
      t.expect(leaveValue(['E', 'R', 'S']) > leaveValue(['U', 'U', 'U']), 'ERS beats UUU');
      t.expect(leaveValue(['A', 'I', 'O', 'U']) < leaveValue(['A', 'R', 'S', 'T']), 'vowel-heavy leaves are worse');
      t.equal(leaveValue([]), 0, 'empty leave is zero');
    },
  },
];

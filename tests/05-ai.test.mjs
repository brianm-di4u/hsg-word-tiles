// AI: every action from every level is legal over many games; Beginner, Easy and Medium play only everyday words (and the
// everyday two-letter words), Beginner and Easy never a word over four letters, Medium a longer one only onto a premium square
// and never on two turns running (owner, 2026-11-27, OQ-POST-REL-01); the leave table is sane.
import { ctx } from './lib.mjs';
import { createGame, apply } from '../src/js/engine.js';
import { chooseAction, leaveValue, LEVELS, EASY_TWO, usesPremium } from '../src/js/ai.js';
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
      n += await games(['beginner', 'expert'], 40, 450);
      t.log(`${n} AI actions, all legal`);
    },
  },
  {
    name: 'Beginner, Easy and Medium keep to their vocabularies and word lengths', node: true,
    async run(t) {
      const n = { beginner: 0, easy: 0, medium: 0 };
      let mediumLong = 0, mediumPlays = 0;
      const lastLong = {};
      const everyday = (w, c) => (w.length === 2 ? EASY_TWO.has(w) : isCommon(c.dict, w));
      await games(['beginner', 'easy', 'medium'], 40, 500, (level, e, c) => {
        if (!(level in n)) return;
        const longest = Math.max(...e.words.map((w) => w.w.length));
        for (const w of e.words) { n[level]++; if (!everyday(w.w, c)) t.fail(`${level} played ${w.w}`); }
        if (level !== 'medium') { if (longest > 4) t.fail(`${level} played ${e.words.map((w) => w.w).join(',')} (over four letters)`); return; }
        mediumPlays++;
        const long = longest > LEVELS.medium.wordMax;
        if (long) {
          mediumLong++;
          if (lastLong[e.p]) t.fail(`Medium went past four letters on two turns running (${e.words[0].w})`);
          if (!usesPremium({ tiles: e.tiles, bonus: e.words.reduce((a, w) => a + w.bonus, 0) })) t.fail(`Medium played ${e.words[0].w} without a premium square`);
        }
        lastLong[e.p] = long;
      });
      t.expect(mediumLong > 0 && mediumLong < mediumPlays / 4, `Medium goes long now and then, not often (${mediumLong} of ${mediumPlays} plays)`);
      t.log(`${n.beginner} Beginner, ${n.easy} Easy and ${n.medium} Medium words checked; Medium went long on ${mediumLong} of ${mediumPlays} plays`);
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

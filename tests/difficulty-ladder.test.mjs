// The five-level difficulty ladder (owner, 2026-11-27, OQ-POST-REL-01): difficulty can be changed in Settings during a game, the
// change is saved with the game, and Records count the game at the easiest level the opponent played in it.
import { applyGame, oppKey } from '../src/js/stats.js';
import { LEVEL_ORDER, easierLevel } from '../src/js/ai.js';
import { LEVEL_NAME } from '../src/js/personas.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });

export const tests = [
  {
    name: 'Ladder: five levels easiest first, and a game counts at the easiest level it was played on (Node)', node: true,
    run(t) {
      t.equal(LEVEL_ORDER.join(','), 'beginner,easy,medium,hard,expert', 'the ladder');
      t.equal(Object.keys(LEVEL_NAME).join(','), LEVEL_ORDER.join(','), 'the names follow the ladder');
      t.equal(easierLevel('hard', 'beginner'), 'beginner', 'Beginner is easier than Hard');
      t.equal(easierLevel('beginner', 'expert'), 'beginner', 'and stays the easiest once played');
      t.equal(oppKey({ persona: 'opal', level: 'expert', lvlLow: 'beginner' }), 'opal:beginner', 'the record key uses the easiest level');
      t.equal(oppKey({ persona: 'opal', level: 'easy' }), 'opal:easy', 'and the level itself when it never changed');
      const s = {
        mode: 'play', featured: [], log: [{ kind: 'play', p: 0, n: 0, score: 30, words: [{ w: 'TUFA', score: 30, bonus: 0 }], full: 0 }],
        players: [{ kind: 'human', name: 'You', score: 300, hints: 3 }, { kind: 'ai', persona: 'opal', level: 'expert', lvlLow: 'beginner', score: 100 }],
        result: { winners: [0] },
      };
      const { stats } = applyGame(null, s);
      t.expect(stats.opp['opal:beginner'] && !stats.opp['opal:expert'], `the win is filed under Beginner (${Object.keys(stats.opp).join(', ')})`);
    },
  },
  {
    name: 'Ladder: Settings changes a computer\'s difficulty during a game, and the game keeps it',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await ready(t);
      await t.page.click('#screen [data-go="settings"]');
      t.equal(await t.page.$$eval('.set-diff', (x) => x.length), 0, 'Settings from the title has no difficulty section');
      await t.page.click('#screen [data-back]');
      await t.page.evaluate(() => window.__game.newGame({ seed: 11, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal' }] }));
      await t.page.waitForFunction(() => window.__game.getState().scene === 'game');
      await t.page.click('#b-menu');
      await t.page.click('#modal [data-go="settings"]');
      t.equal(await t.page.inputValue('[data-difflevel="1"]'), 'easy', 'Opal starts at her usual Easy');
      t.equal((await t.page.$$eval('[data-difflevel="1"] option', (o) => o.map((x) => x.value))).join(','), 'beginner,easy,medium,hard,expert', 'all five levels to choose from');
      await t.page.selectOption('[data-difflevel="1"]', 'beginner');
      let p = (await t.state()).game.players[1];
      t.equal(`${p.level} ${p.lvlLow}`, 'beginner beginner', 'the change reaches the game');
      t.expect(/gentlest/.test(await t.page.textContent('[data-diff-note="1"]')), 'and the note follows the level');
      await t.page.selectOption('[data-difflevel="1"]', 'expert');
      p = (await t.state()).game.players[1];
      t.equal(`${p.level} ${p.lvlLow}`, 'expert beginner', 'raising it again keeps the easiest level played for Records');
      await t.checkLayout({ allowScrollY: true });
      await t.shot('ladder-settings');
      await t.page.click('#screen [data-back]');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'game');
      // the desktop score cards name the level; the compact phone chips show only the score
      if (t.viewport === 'desktop') t.expect((await t.page.textContent('#app')).includes('Expert · fictional'), 'the scoreboard names the new level');
      await t.page.reload();
      await ready(t);
      await t.page.click('#screen [data-go="continue"]');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'game');
      p = (await t.state()).game.players[1];
      t.equal(`${p.level} ${p.lvlLow}`, 'expert beginner', 'the saved game keeps both after a reload');
    },
  },
];

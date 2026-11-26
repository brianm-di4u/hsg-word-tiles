// Wave 4, follow-up W4-B33-hotfix: the winner's halo on the results settles (W3-S2-07, OQ-WF7-W4-01); an existing player's
// Ambience level starts at their Music level (W4-S5-05, OQ-WF7-W4-02); the Daily streak shows when the device's date is behind
// (OQ-WF7-W3-05); presses and the picked swap tile never move a button's own hit box (ruling 30: W5-S4-01, W5-S4-04).
import { activeStreak, streakRestReady } from '../src/js/stats.js';
import { dailyLine } from '../src/js/ui.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const full = () => { window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, motion: 'full' })); };
const SEATS = [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'hard' }];

// the person's last tile ends the game and they win: the results screen with its winner badge
async function results(t) {
  await t.seed(5);
  await t.game('newGame', { seats: SEATS });
  await t.waitIdle(8000);
  const g = (await t.state()).game;
  g.board = g.board.map(() => null);
  [...'CAT'].forEach((l, k) => { g.board[111 + k] = { l, blank: false }; });
  g.bag = []; g.move = 10; g.cur = 0;
  g.players[0].rack = ['S']; g.players[0].score = 120; g.players[1].rack = ['E', 'R']; g.players[1].score = 80;
  await t.game('setState', { game: g });
  await t.waitIdle(5000);
  await t.game('act', 'stage', [{ i: 114, l: 'S' }]);
  t.expect((await t.game('act', 'play')).ok, 'the last play');
  await t.page.waitForFunction(() => document.querySelector('#screen .over .winner .badge.mood-win'), null, { timeout: 8000 });
}

export const tests = [
  // ---------- W3-S2-07 / OQ-WF7-W4-01 ----------
  {
    name: "W3-S2-07 the winner's halo on the results swells two or three slow times and rests as a steady brass ring; in the game it still breathes",
    viewports: ['desktop', 'mobile'],
    initScript: full,
    async run(t) {
      await ready(t);
      await results(t);
      const halo = await t.page.evaluate(() => {
        const el = document.querySelector('#screen .over .winner .badge.mood-win');
        const a = el.getAnimations().find((x) => x.animationName);
        const tm = a ? a.effect.getComputedTiming() : {};
        // the same badge in the game, outside the results
        const chip = document.createElement('span'); chip.className = 'badge mood-win'; chip.style.setProperty('--s', '40px'); document.body.appendChild(chip);
        const b = chip.getAnimations().find((x) => x.animationName), btm = b ? b.effect.getComputedTiming() : {};
        chip.remove();
        return { name: a && a.animationName, iterations: tm.iterations, duration: tm.duration, fill: tm.fill, game: b && b.animationName, gameIterations: btm.iterations };
      });
      t.log(JSON.stringify(halo));
      t.expect(halo.iterations >= 2 && halo.iterations <= 3, `the results' halo pulses two or three times (${halo.iterations})`);
      t.expect(halo.duration >= 1800, `slowly (${halo.duration} ms a pulse)`);
      t.expect(halo.iterations * halo.duration <= 4500, `and has come to rest within 4.5 s (${halo.iterations * halo.duration} ms), so the results settle`);
      t.expect(halo.fill === 'none' || halo.fill === 'auto', `and leaves nothing running behind it (fill ${halo.fill})`);
      t.equal(halo.gameIterations, Infinity, `in the game the halo keeps breathing (${halo.game})`);
      // at rest: the steady ring, the same as the badge's own style, with no jump at the end of the last pulse
      const rest = await t.page.evaluate(() => {
        const box = document.querySelector('#screen .over'), el = box.querySelector('.winner .badge.mood-win');
        const a = el.getAnimations().find((x) => x.animationName), tm = a.effect.getComputedTiming();
        a.pause(); a.currentTime = tm.iterations * tm.duration - 2;   // 2 ms before the halo stops
        const end = getComputedStyle(el).boxShadow;
        box.getAnimations({ subtree: true }).forEach((x) => x.finish());
        return { end, still: getComputedStyle(el).boxShadow, left: box.getAnimations({ subtree: true }).length };
      });
      const nums = (s) => (s.match(/-?[\d.]+/g) || []).map(Number);
      const [e, s] = [nums(rest.end), nums(rest.still)];
      t.equal(rest.left, 0, 'nothing on the results is still moving');
      t.expect(e.length === s.length && e.every((v, k) => Math.abs(v - s[k]) < 0.05), `the last pulse ends on the steady ring, with no jump (${rest.end} -> ${rest.still})`);
      t.expect(/2\.5px/.test(rest.still), `a brass ring 2.5 px wide at rest (${rest.still})`);
    },
  },
];

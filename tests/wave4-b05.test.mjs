// Wave 4, batch W4-B05 (WF-2 visual hierarchy). W2-P-N03 (open-square dimming under the 3D tiles) was built by 8cd758a (tests: wave2-b10),
// W2-P-N04 (the dual-tone keyboard cursor, lifted onto tiles) by 13b1d1d and e365c46 (tests: 16-a11y), W2-S1-05 (calmer steamBurst, drag
// fade, sea-glass wisps) by aaba8f9, 2f4e95e and f1d3560 (tests: wave3-b02, wave3-b17), and the .pop espresso pill of W2-S1-03 by 2f4e95e
// (tests: wave3-b02). What was left of W2-S1-03: a staged 3D tile's crown looked like a placed one's once Challenge hid the teal outline.
import { CENTER } from '../src/js/score.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, motion: 'full', theme: 'light' }));
};
// warm-gold (#D9A23A) pixels the overlay canvas draws in the four corners of a square's crown, and in the middle of it (over the letter)
const gold = (t, i, lift) => t.page.evaluate(async ([i, lift]) => {
  const cv = document.getElementById('board'), k = cv.width / cv.clientWidth, g = window.__game, c2 = cv.getContext('2d');
  const [x, y] = await g.act('cell', i, lift), [x2] = await g.act('cell', i + 1, lift), c = Math.abs(x2 - x);
  const count = (x0, y0, w, h) => {
    const d = c2.getImageData(Math.round(x0 * k), Math.round(y0 * k), Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))).data;
    let n = 0; for (let p = 0; p < d.length; p += 4) if (d[p + 3] > 120 && d[p] > 180 && d[p + 1] > 120 && d[p + 1] < 200 && d[p + 2] < 120) n++;
    return n;
  };
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => count(x + sx * 0.5 * c - (sx > 0 ? 0.3 * c : 0), y + sy * 0.5 * c - (sy > 0 ? 0.3 * c : 0), 0.3 * c, 0.3 * c));
  return { corners, middle: count(x - 0.22 * c, y - 0.16 * c, 0.44 * c, 0.32 * c) };
}, [i, lift]);

export const tests = [
  // ---------- W2-S1-03 ----------
  {
    name: 'W2-S1-03 a staged tile on the 3D board wears warm-gold corners in Challenge mode, a placed tile does not, and the letter stays clear',
    viewports: ['desktop', 'mobile'],
    url: 'index.html?gl=3d',
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 7, challenge: true, seats: [{ kind: 'human', name: 'Ann' }, { kind: 'human', name: 'Bo' }] });
      await t.waitIdle(8000);
      await t.game('act', 'reveal');
      const s = await t.state();
      t.expect(s.game.challenge === true, 'a Challenge game');
      [...'SPA'].forEach((l, k) => { s.game.board[CENTER - 1 + k] = { l, blank: false, p: 0, t: 0 }; });
      s.game.move = 1; s.game.cur = 0; s.game.players[0].rack = 'SEATRIN'.split('');
      await t.game('setState', { game: s.game });
      await t.waitIdle(6000);
      await t.page.addStyleTag({ content: '#fx, #toast { visibility: hidden !important; }' });
      t.equal((await t.state()).view.mode3d, true, '3D board on (run with --gpu)');
      const at = CENTER + 2;
      const empty = await gold(t, at, 0.3);
      t.expect((await t.game('act', 'stage', [{ l: 'S', i: at }])).ok, 'S staged after SPA');
      await t.waitIdle(4000);
      await t.waitFrames(4);
      const staged = await gold(t, at, 0.3), placed = await gold(t, CENTER, 0.24);
      t.log(`gold px: empty ${empty.corners} / ${empty.middle}, staged ${staged.corners} / ${staged.middle}, placed ${placed.corners} / ${placed.middle}`);
      t.equal((await t.page.evaluate(() => window.__G.preview && window.__G.preview.ok)) ? 'ok' : 'not ok', 'ok', 'SPAS is a play');
      t.expect(empty.corners.every((n) => n === 0), 'no gold on the empty square before staging');
      t.expect(staged.corners.every((n) => n >= 6), `each of the staged tile's four corners shows warm gold (${staged.corners})`);
      t.equal(staged.middle, 0, 'no gold over the letter in the middle of the crown');
      t.expect(placed.corners.every((n) => n === 0) && placed.middle === 0, `a placed tile has no gold corners (${placed.corners})`);
      await t.shot('w4-b05-staged-3d-challenge', { timeout: 15000 });
      // recalled to the rack, the corners go with the tile
      await t.game('act', 'recall');
      await t.waitIdle(4000);
      await t.waitFrames(3);
      t.expect((await gold(t, at, 0.3)).corners.every((n) => n === 0), 'recalled: the corners are gone');
    },
  },
];

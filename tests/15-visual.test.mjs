// The fixed capture set for visual reviews (reviews/RUBRIC.md). Run on the GPU for the 3D board:
//   node shared/test-harness/run.mjs . --file visual --gpu --milestone visual-N
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const CENTER = 112;
const seats = [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'julian' }];

async function midGame(t, moves = 12) {
  await t.game('newGame', { seed: 41, seats });
  await t.waitIdle(8000);
  await t.game('act', 'autoplay', moves);
  await t.waitIdle(12000);
  await t.game('act', 'freezeFx', 0);
}

export const tests = [
  {
    name: 'visual: title, setup, help, register',
    async run(t) {
      await ready(t);
      await t.page.evaluate(() => localStorage.setItem('hs-letters-register-v1', JSON.stringify({
        SPRING: { id: 'spring', first: '2026-10-30', count: 2, best: 31 }, TUFA: { id: 'tufa', first: '2026-10-31', count: 1, best: 44 },
        DERBY: { id: 'derby', first: '2026-10-31', count: 1, best: 27 }, MAGNOLIA: { id: 'magnolia', first: '2026-11-01', count: 1, best: 52 },
        STEAM: { id: 'steam', first: '2026-11-01', count: 3, best: 24 } })));
      await t.reload(); await ready(t);
      await t.shot('v01-title');
      await t.game('scene', 'setup'); await t.shot('v11-setup');
      await t.game('scene', 'help'); await t.page.click('[data-tab="squares"]'); await t.shot('v07-help-squares');
      await t.game('scene', 'register'); await t.shot('v08-register');
    },
  },
  {
    name: 'visual: the board in play',
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 41, seats });
      await t.waitIdle(8000);
      await t.game('act', 'freezeFx', 0.9);
      await t.shot('v02-board-start', { timeout: 15000 });
      const s = await t.state();
      s.game.players[0].rack = 'SPRINGE'.split('');
      await t.game('setState', { game: s.game });
      await t.game('act', 'stage', [...'SPRING'].map((l, k) => ({ i: CENTER - 2 + k, l })));
      await t.shot('v03-staging', { timeout: 15000 });
      await t.game('act', 'recall');
      await midGame(t);
      await t.shot('v04-midgame', { timeout: 15000 });
    },
  },
  {
    name: 'visual: bonus word card and game over',
    async run(t) {
      await ready(t);
      await midGame(t, 6);
      await t.game('act', 'fact', 'magnolia', 'MAGNOLIA');
      await t.shot('v05-fact', { timeout: 15000 });
      await t.game('act', 'close');
      await t.game('act', 'autoplay', 999);
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 8000 });
      await t.shot('v06-over');
    },
  },
  {
    name: 'visual: night theme',
    colorScheme: 'dark',
    async run(t) {
      await ready(t);
      await midGame(t);
      await t.shot('v09-night', { timeout: 15000 });
    },
  },
  {
    name: 'visual: phone drag ghost',
    viewports: ['mobile'],
    async run(t) {
      await ready(t);
      await midGame(t, 8);
      const lift = await t.game('act', 'dragLift');
      const tile = await t.game('act', 'rackTile', 1);
      const target = await t.game('act', 'screen', CENTER - 16);
      const cdp = await t.page.context().newCDPSession(t.page);
      const pt = (x, y) => [{ x, y, id: 1 }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(tile[0], tile[1]) });
      for (let k = 1; k <= 12; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(tile[0] + (target[0] - tile[0]) * k / 12, tile[1] + (target[1] + lift - tile[1]) * k / 12) });
      await t.waitFrames(4);
      await t.shot('v10-drag-ghost', { wait: false });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    },
  },
];

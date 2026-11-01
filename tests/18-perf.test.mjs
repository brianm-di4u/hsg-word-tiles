// Performance and size: index.html under 2 MB, idle and drag frame cost, AI time at 4x CPU throttle,
// the dictionary build time, and the AI running in a worker (with a working fallback when it can't).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 30000 });

export const tests = [
  {
    name: 'size budget', node: true,
    run(t) {
      const kb = fs.statSync(path.join(root, 'index.html')).size / 1024;
      t.log(`index.html ${kb.toFixed(0)} KB`);
      t.expect(kb < 2048, 'index.html under 2 MB');
    },
  },
  {
    name: 'frame cost idle and while dragging',
    viewports: ['desktop'],
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 7 });
      await t.waitIdle(5000);
      const idle = await t.frameCost(1500);
      t.log(`idle: ${JSON.stringify(idle)}`);
      t.expect(idle.taskMs < 8, `idle task ${idle.taskMs} ms per frame`);
      const tile = await t.game('act', 'rackTile', 0);
      const c = await t.game('act', 'screen', 112);
      await t.page.mouse.move(tile[0], tile[1]); await t.page.mouse.down();
      const drag = t.frameCost(1500);
      for (let k = 0; k < 60; k++) await t.page.mouse.move(tile[0] + (c[0] - tile[0]) * k / 60, tile[1] + (c[1] - tile[1]) * k / 60);
      const d = await drag;
      await t.page.mouse.up();
      t.log(`drag: ${JSON.stringify(d)}`);
      t.expect(d.taskMs < 12, `drag task ${d.taskMs} ms per frame`);
    },
  },
  {
    name: 'dictionary and AI at 4x CPU throttle',
    viewports: ['mobile'],
    slow: true,
    async run(t) {
      await t.cpuThrottle(4);
      await t.reload();
      await ready(t);
      const s0 = await t.state();
      t.log(`dictionary ${s0.dictMs} ms at 4x`);
      t.expect(s0.dictMs < 1500, 'dictionary ready within 1.5 s at 4x');
      // time the AI worker on real positions: eight turns per level
      const r = {};
      for (const [persona, lv] of [['opal', 'easy'], ['hollis', 'medium'], ['julian', 'hard']]) {
        await t.game('newGame', { seed: 12, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona }] });
        await t.waitIdle(15000);
        r[lv] = await t.game('act', 'timeAi', 8, lv);
      }
      await t.cpuThrottle(1);
      t.log(JSON.stringify(r));
      t.expect(r.easy.max < 250 && r.medium.max < 250, 'Easy and Medium under 250 ms');
      t.expect(r.hard.max < 1200, 'Hard under 1.2 s');
    },
  },
  {
    name: 'AI time at 4x CPU throttle on the main thread (worst case: no Worker)',
    url: 'index.html?worker=0',
    viewports: ['mobile'],
    slow: true,
    async run(t) {
      await ready(t);
      await t.cpuThrottle(4);
      const r = {};
      for (const [persona, lv] of [['opal', 'easy'], ['hollis', 'medium'], ['julian', 'hard']]) {
        await t.game('newGame', { seed: 12, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona }] });
        await t.waitIdle(30000);
        r[lv] = await t.game('act', 'timeAi', 10, lv);
      }
      await t.cpuThrottle(1);
      t.log(JSON.stringify(r));
      t.expect(r.easy.max < 250 && r.medium.max < 250, 'Easy and Medium under 250 ms at 4x');
      t.expect(r.hard.max < 1200, 'Hard under 1.2 s at 4x');
    },
  },
  {
    name: 'AI works without Workers (fallback)',
    url: 'index.html?worker=0',
    async run(t) {
      await ready(t);
      t.equal((await t.state()).ai, 'main', 'fallback mode');
      await t.game('newGame', { seed: 8 });
      await t.waitIdle(5000);
      const [m] = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', m.tiles);
      await t.game('act', 'play');
      await t.waitIdle(10000);
      t.expect((await t.state()).game.move >= 2, 'the computer replied');
    },
  },
];

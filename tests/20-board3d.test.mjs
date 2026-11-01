// The 3D board (needs --gpu; without a GPU the game falls back to 2D and this test checks the fallback),
// picking through the 3D camera, and the 2D board with ?gl=0.
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });

export const tests = [
  {
    name: '3D board mid-game',
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 31, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'julian' }] });
      await t.waitIdle(8000);
      await t.game('act', 'autoplay', 8);
      await t.waitIdle(10000);
      const s = await t.state();
      t.log(`3D ${s.view.mode3d ? 'on' : `off (${s.view.reason3d})`}`);
      if (t.gpu) t.expect(s.view.mode3d, '3D board on with a GPU');
      else t.expect(!s.view.mode3d && s.view.reason3d === 'software-gl', 'software GL falls back to 2D');
      await t.shot('20-board-3d', { timeout: 15000 });
      // picking: the square under each square's projected centre is that square
      let bad = 0;
      for (const i of [0, 7, 14, 112, 210, 224, 37, 188]) {
        const [x, y] = await t.game('act', 'cell', i);
        const got = await t.game('act', 'cellAt', x, y);
        if (got !== i) { bad++; t.log(`square ${i} picked as ${got}`); }
      }
      t.equal(bad, 0, 'picking round-trips');
    },
  },
  {
    name: '3D board zoomed in (phone play zoom)',
    viewports: ['mobile'],
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 31, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'julian' }] });
      await t.waitIdle(8000);
      await t.game('act', 'autoplay', 6);
      await t.waitIdle(10000);
      await t.game('act', 'zoom', 1.9, 8, 8);
      await t.shot('20-board-3d-zoom', { timeout: 15000 });
    },
  },
  {
    name: '2D board with ?gl=0',
    url: 'index.html?gl=0',
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 31, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'julian' }] });
      await t.waitIdle(8000);
      await t.game('act', 'autoplay', 8);
      await t.waitIdle(10000);
      const s = await t.state();
      t.expect(!s.view.mode3d, '2D board');
      await t.shot('21-board-2d');
    },
  },
];

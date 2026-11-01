// Accessibility: text contrast by day and by night on every screen, a live region that announces plays,
// reduced motion, and text size.
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });

async function sweep(t, label) {
  let fails = 0;
  for (const scene of ['title', 'setup', 'help', 'settings', 'register', 'about', 'game']) {
    if (scene === 'game') { await t.game('newGame', { seed: 2 }); await t.waitIdle(5000); }
    else await t.game('scene', scene);
    const r = await t.contrastReport({ fallbackBg: [46, 28, 16] });
    for (const f of r.fails) { fails++; t.log(`${label} ${scene}: ${f}`); }
  }
  return fails;
}

export const tests = [
  {
    name: 'contrast by day',
    colorScheme: 'light',
    async run(t) {
      await ready(t);
      t.equal(await sweep(t, 'day'), 0, 'no contrast failures by day');
    },
  },
  {
    name: 'contrast by night',
    colorScheme: 'dark',
    async run(t) {
      await ready(t);
      t.equal(await sweep(t, 'night'), 0, 'no contrast failures by night');
      await t.game('newGame', { seed: 2 });
      await t.waitIdle(5000);
      await t.shot('16-night');
      await t.game('scene', 'title');
      await t.shot('16-night-title');
    },
  },
  {
    name: 'live region announces each play',
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 2 });
      await t.waitIdle(5000);
      const [m] = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', m.tiles);
      await t.game('act', 'play');
      await t.page.waitForFunction(() => /You played/.test(document.querySelector('#live').textContent), null, { timeout: 3000 });
      await t.waitIdle(10000);
      await t.page.waitForFunction(() => /Hollis Crane (played|swapped|passed)/.test(document.querySelector('#live').textContent), null, { timeout: 5000 });
      t.log(await t.page.textContent('#live'));
    },
  },
  {
    name: 'reduced motion: no flying tiles, feedback still shown',
    reducedMotion: true,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 2 });
      await t.waitIdle(5000);
      const [m] = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', m.tiles);
      await t.game('act', 'play');
      const anim = await t.page.evaluate(() => window.__G.anim.size);
      t.equal(anim, 0, 'no tile animation');
      await t.waitIdle(10000);
      t.expect(/played/.test(await t.page.textContent('#preview')), 'the play is still reported');
    },
  },
  {
    name: 'text size 130% keeps the layout',
    async run(t) {
      await ready(t);
      await t.page.evaluate(() => { const s = JSON.parse(localStorage.getItem('hs-letters-settings-v1') || '{}'); s.text = 1.3; localStorage.setItem('hs-letters-settings-v1', JSON.stringify(s)); });
      await t.reload(); await ready(t);
      await t.game('newGame', { seed: 2 });
      await t.waitIdle(5000);
      await t.checkLayout();
      await t.shot('16-text130');
    },
  },
];

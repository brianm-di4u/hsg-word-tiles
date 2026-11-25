// Wave 3, batch W3-B17: W6-S4-03 (poked tile crown, default-name plaque owners).
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, motion: 'full', theme: 'light' }));
};

export const tests = [
  // ---------- W6-S4-03 ----------
  {
    name: 'W6-S4-03 the glazed tile top has a raised centre, level corners and nothing else moved',
    node: true,
    async run(t) {
      const { MESHES } = await import(new URL('../src/js/pieces-mesh.js', import.meta.url).href);
      const d = MESHES.tile, top = d.g.find((g) => g.mat.name === 'tiletop');
      const raw = Buffer.from(top.p, 'base64'), q = new Int16Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length));
      const pts = [];
      for (let i = 0; i < q.length; i += 3) pts.push([0, 1, 2].map((k) => d.lo[k] + (q[i + k] + 32768) / 65535 * (d.hi[k] - d.lo[k])));
      const at = (x, y) => pts.find((p) => Math.hypot(p[0] - x, p[1] - y) < 0.005);
      const mid = at(0, 0);
      t.expect(!!mid, 'the crown has a centre vertex');
      if (mid) t.expect(Math.abs(mid[2] - 0.25) < 0.001, `the centre is 0.010 above the crown's edge (${mid[2].toFixed(4)})`);
      for (const [x, y] of [[-0.38, -0.38], [0.38, -0.38], [0.38, 0.38], [-0.38, 0.38]]) t.expect(at(x, y) && Math.abs(at(x, y)[2] - 0.24) < 0.001, `the crown corner ${x},${y} stays at 0.240`);
      t.expect(pts.every((p) => Math.abs(p[0]) <= 0.4505 && Math.abs(p[1]) <= 0.4505), 'the tile keeps its footprint');
      t.equal(pts.length, 17, 'one vertex more than the flat top');
    },
  },
  {
    name: 'W6-S4-03 a claimed plaque names its owner: the character by first name, a default seat as P1 or P2',
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 5, seats: [{ kind: 'human', name: 'Player 1' }, { kind: 'human', name: 'Player 2' }, { kind: 'ai', persona: 'julian' }] });
      await t.waitIdle(5000);
      await t.game('act', 'reveal');
      const s = await t.state();
      s.game.featured.forEach((f, k) => { f.by = k; f.at = 1; });
      await t.game('setState', { game: s.game });
      if (t.viewport === 'mobile') await t.page.click('#springs [data-springs-toggle]');
      const got = await t.page.$$eval('#springs .plaque', (els) => els.map((e) => ({ by: e.querySelector('.pby').textContent, label: e.getAttribute('aria-label') })));
      t.equal(got.map((g) => g.by), ['P1', 'P2', 'Julian'], 'owners on the plaques');
      t.expect(/found by Player 1$/.test(got[0].label) && /found by Player 2$/.test(got[1].label) && /found by Maestro Julian Fitch$/.test(got[2].label), 'and the full name in the label: ' + got.map((g) => g.label).join(' | '));
      await t.shot('w3-b17-plaque-owners');
    },
  },
];

// Wave 4, batch W4-B11 (WF-3 character_iconography):
// - W3-S1-02: dedicated frosted sea-glass 3D tile body material B3.blankBodyMat (roughness 0.62) + instanced pool
//   B3.blankInst, completing 050386d's frosted sea-glass faces & etched steam curls across 2D/3D and Day/Night.
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, theme: 'light' }));
  }
};

export const tests = [
  // ---------- W3-S1-02 ----------
  {
    name: 'W3-S1-02 3D blank Steam tiles use dedicated frosted sea-glass B3.blankBodyMat (roughness 0.62) in Day and Night with clean GPU disposal',
    viewports: ['desktop'],
    url: 'index.html?gl=3d',
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 41, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'julian' }] });
      await t.waitIdle(8000);
      const s = await t.state();
      s.game.board[111] = { l: 'S', blank: false, p: 1, t: 0 };
      s.game.board[112] = { l: 'P', blank: true, p: 1, t: 0 };
      s.game.board[113] = { l: 'A', blank: false, p: 1, t: 0 };
      s.game.board[127] = { l: 'I', blank: true, p: 0, t: 1 };
      s.game.move = 2; s.game.cur = 0;
      s.game.players[0].rack = ['?', 'E', 'A', 'R', 'T', 'S', 'N'];
      await t.game('setState', { game: s.game });
      await t.waitIdle(6000);
      await t.waitFrames(3);

      const b3 = await t.game('act', 'b3');
      if (!t.gpu || !b3 || !b3.on) {
        t.log('software GL active; skipping live 3D B3.blankBodyMat checks');
        return;
      }
      t.expect(!!b3.blankBodyMat, 'B3.blankBodyMat is initialized');
      t.equal(b3.blankBodyMat.type, 'MeshStandardMaterial', 'B3.blankBodyMat uses frosted MeshStandardMaterial');
      t.equal(b3.blankBodyMat.roughness, 0.62, `B3.blankBodyMat roughness is 0.62 (got ${b3.blankBodyMat.roughness})`);
      t.equal(b3.blankBodyMat.color, 'cfe6e2', `Day B3.blankBodyMat uses frosted sea-glass #cfe6e2 (got #${b3.blankBodyMat.color})`);
      t.equal(b3.bodyInstanced, true, 'all tilebody pools including B3.blankInst are InstancedMesh');
      t.equal(b3.bodyCounts.blank, 2, `placed blank tiles route to B3.blankInst (got ${b3.bodyCounts.blank})`);
      t.equal(b3.bodyCounts.board, 2, `regular placed tiles route to B3.bodyInst (got ${b3.bodyCounts.board})`);
      await t.game('act', 'zoom', 2.2, 7.9, 8.1);
      await t.waitFrames(3);
      await t.shot('w4-b11-blank-3d-day', { timeout: 15000 });

      // Night theme shifts B3.blankBodyMat to twilight sea-glass #c3d8d4
      await t.game('scene', 'settings');
      await t.page.click('[data-set="theme"][data-val="dark"]');
      await t.game('scene', 'game');
      await t.waitIdle(6000);
      await t.waitFrames(3);
      const b3Night = await t.game('act', 'b3');
      t.equal(b3Night.blankBodyMat.color, 'c3d8d4', `Night B3.blankBodyMat shifts to #c3d8d4 (got #${b3Night.blankBodyMat.color})`);
      t.equal(b3Night.blankBodyMat.roughness, 0.62, 'Night B3.blankBodyMat preserves roughness 0.62');
      t.equal(b3Night.bodyCounts.blank, 2, 'Night mode keeps both blanks in B3.blankInst');
      await t.shot('w4-b11-blank-3d-night', { timeout: 15000 });

      // Turning 3D off disposes B3.blankBodyMat and B3.blankInst with 0 GPU leftovers
      await t.game('scene', 'settings');
      await t.page.click('[data-set="board3d"][data-val="off"]');
      await t.game('scene', 'game');
      await t.waitFrames(3);
      const off = await t.game('act', 'b3');
      t.equal(off.on, false, '3D turned off cleanly');
      t.equal(off.blankBodyMat, null, 'B3.destroy() clears B3.blankBodyMat');
      t.equal(off.disposed.left.geometries, 0, '0 geometries leaked on GPU');
      t.equal(off.disposed.left.textures, 0, '0 textures leaked on GPU');
    },
  },
];

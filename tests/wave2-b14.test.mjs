// Wave 2, batch W2-B14: W3-S3-01 (1:1 human-scale desktop 3D desk bell & left-edge-cropped folded linen towel corner,
// pieces-mesh.js <= 25 KB & prop triangle budgets, clamped z >= 0, box UVs on towel, tightened desktop framing,
// and portrait 3D fitDistance() walnut bezel framing).
import fs from 'node:fs';
import path from 'node:path';
import { root } from './lib.mjs';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, theme: 'light' }));
  }
};
const b64 = (s, T) => {
  const b = Buffer.from(s, 'base64');
  return new T(b.buffer, b.byteOffset, b.byteLength / T.BYTES_PER_ELEMENT);
};

export const tests = [
  {
    name: 'W3-S3-01 pieces-mesh.js stays <= 25 KB with compact <= 400-tri bronze-plinth bell (~2.0-2.2 cells), <= 300-tri single folded linen towel (z >= 0, box UVs)',
    node: true,
    async run(t) {
      const meshPath = path.join(root, 'src', 'js', 'pieces-mesh.js');
      const bytes = fs.statSync(meshPath).size;
      t.expect(bytes <= 25 * 1024, `pieces-mesh.js size ${bytes} B (${(bytes / 1024).toFixed(2)} KB) <= 25 KB (CD-WF3-04)`);

      const { MESHES } = await import(new URL('../src/js/pieces-mesh.js', import.meta.url).href);
      t.expect(!!MESHES.bell && !!MESHES.towels && !!MESHES.tile && !!MESHES.frame, 'all 4 canonical pieces present (no extra prop sprawl)');
      t.equal(Object.keys(MESHES).length, 4, 'no bespoke tumbler/coaster/ticket prop sprawl (CD-WF3-04)');

      // Bell: ~2.0-2.2 cells diameter, chamfered warm-bronze plinth, <= 400 tris, z >= 0
      const bell = MESHES.bell;
      const bellTris = bell.g.reduce((s, g) => s + b64(g.i, Uint16Array).length / 3, 0);
      const bellDiamX = bell.hi[0] - bell.lo[0];
      const bellDiamY = bell.hi[1] - bell.lo[1];
      t.expect(bellTris > 80 && bellTris <= 400, `bell triangle count ${bellTris} <= 400`);
      t.expect(bellDiamX >= 2.0 && bellDiamX <= 2.2, `bell X diameter ${bellDiamX.toFixed(3)} cells in [2.0, 2.2]`);
      t.expect(bellDiamY >= 2.0 && bellDiamY <= 2.2, `bell Y diameter ${bellDiamY.toFixed(3)} cells in [2.0, 2.2]`);
      t.expect(bell.lo[2] >= 0, `bell floor z=${bell.lo[2]} >= 0 (zero counter clipping)`);
      const plinth = bell.g.find((g) => g.mat && g.mat.name === 'bronze');
      t.expect(!!plinth, 'bell plinth uses warm-bronze material instead of disappearing black base');
      t.expect(plinth.mat.c !== '#1F1A16', `bell plinth color ${plinth.mat.c} is warm bronze`);
      t.expect(!!bell.g.find((g) => g.mat && g.mat.name === 'brass'), 'bell dome/knob uses brass material');

      // Towel: single modular folded linen corner <= 300 tris, clamped z >= 0, human-scale footprint, box UVs exported
      const towels = MESHES.towels;
      const towelTris = towels.g.reduce((s, g) => s + b64(g.i, Uint16Array).length / 3, 0);
      const towelSpanX = towels.hi[0] - towels.lo[0];
      const towelSpanY = towels.hi[1] - towels.lo[1];
      t.expect(towelTris > 40 && towelTris <= 300, `towel triangle count ${towelTris} <= 300`);
      t.expect(towels.lo[2] >= 0, `towel floor z=${towels.lo[2]} >= 0 (eliminated z=-0.005 clipping)`);
      t.expect(towelSpanX >= 5.0 && towelSpanY >= 7.0, `towel corner spans ${towelSpanX.toFixed(2)}x${towelSpanY.toFixed(2)} cells for 1:1 human scale`);
      for (const g of towels.g) {
        t.expect(typeof g.u === 'string' && g.u.length > 0, `towel group ${g.mat.name} exports box/triplanar UVs`);
      }
      t.log(`W3-S3-01 mesh stats: pieces-mesh.js=${(bytes / 1024).toFixed(2)} KB, bell=${bellTris} tris (${bellDiamX.toFixed(2)} cells), towel=${towelTris} tris (${towelSpanX.toFixed(2)}x${towelSpanY.toFixed(2)} cells, zMin=${towels.lo[2]})`);
    },
  },
  {
    name: 'W3-S3-01 desktop 3D framing prioritizes 90% board, seats ~2.1-cell bell inside right margin, and crops 1:1 folded linen towel off left border',
    viewports: ['desktop'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 41, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'julian' }] });
      await t.waitIdle(8000);
      await t.game('act', 'autoplay', 6);
      await t.waitIdle(10000);
      await t.game('act', 'freezeFx', 0);
      await t.waitFrames(3);

      const b3 = await t.game('act', 'b3');
      if (!t.gpu || !b3 || !b3.on) {
        t.log('software GL active; skipping live 3D desktop framing projection assertions');
        return;
      }

      // 1) All 4 walnut rails stay cleanly framed inside #boardwrap with tightened desktop fitDistance (CD-WF2-06)
      t.equal(b3.tall, false, 'desktop viewport is landscape/desktop mode');
      t.expect(b3.fit < 35.8, `desktop fitDistance tightened to ${b3.fit.toFixed(2)} (< 35.8 vs old ~36.3/37.0 at 1.12)`);
      t.expect(b3.bezel.minX >= 0 && b3.bezel.maxX <= b3.bezel.W, `desktop walnut bezel X inside #boardwrap (${b3.bezel.minX.toFixed(1)}..${b3.bezel.maxX.toFixed(1)} of ${b3.bezel.W})`);
      t.expect(b3.bezel.minY >= 0 && b3.bezel.maxY <= b3.bezel.H, `desktop walnut bezel Y inside #boardwrap (${b3.bezel.minY.toFixed(1)}..${b3.bezel.maxY.toFixed(1)} of ${b3.bezel.H})`);
      const boardHeightRatio = (b3.bezel.maxY - b3.bezel.minY) / b3.bezel.H;
      t.expect(boardHeightRatio >= 0.90, `desktop 3D board + walnut bezel fills ${(boardHeightRatio * 100).toFixed(1)}% >= 90% of #boardwrap height (CD-WF2-06)`);

      // 2) Compact ~2.0-2.2 cell front-desk bell seated cleanly inside right margin (clear of frame and inside right viewport edge)
      const { bell, towel } = b3.props;
      t.equal(bell.visible, true, 'bell visible on desktop 3D');
      t.expect(bell.tris <= 400, `bell rendered mesh <= 400 tris (${bell.tris})`);
      t.expect(bell.diameter >= 2.0 && bell.diameter <= 2.2, `bell world diameter ${bell.diameter} cells in [2.0, 2.2]`);
      t.expect(bell.worldMinY >= 0, `bell sits cleanly on counter y=${bell.worldMinY} >= 0`);
      t.expect(bell.worldMinX > 8.85, `bell clears outer right walnut frame rail (worldMinX=${bell.worldMinX} > 8.85)`);
      t.expect(bell.minX > b3.bezel.W * 0.80 && bell.maxX <= b3.bezel.W, `bell seated cleanly inside right viewport margin (${bell.minX}..${bell.maxX} of ${b3.bezel.W})`);

      // 3) Single folded linen towel corner intentionally cropped off the left viewport border at 1:1 human scale
      t.equal(towel.visible, true, 'folded linen towel visible on desktop 3D');
      t.expect(towel.tris <= 300, `towel rendered mesh <= 300 tris (${towel.tris})`);
      t.expect(towel.worldMinY >= 0, `towel sits cleanly on counter y=${towel.worldMinY} >= 0`);
      t.expect(towel.worldMaxX < -8.85, `towel clears outer left walnut frame rail (worldMaxX=${towel.worldMaxX} < -8.85)`);
      t.expect(towel.minX < 0 && towel.maxX > 24, `towel corner intentionally crops off left border (${towel.minX}..${towel.maxX}) for true 1:1 human scale`);
      t.log(`W3-S3-01 desktop 3D: fit=${b3.fit.toFixed(2)}, boardH=${(boardHeightRatio * 100).toFixed(1)}%, bell=[${bell.minX}..${bell.maxX}]/${bell.W} diam=${bell.diameter}, towel=[${towel.minX}..${towel.maxX}]`);
      await t.shot('w2-b14-desktop-3d-props', { timeout: 15000 });
    },
  },
  {
    name: 'W3-S3-01 portrait mobile 3D keeps all 4 walnut rails inside #boardwrap at 0.08-0.10 rad and hides peripheral props',
    viewports: ['mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 41, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'julian' }] });
      await t.waitIdle(8000);
      await t.waitFrames(3);
      const b3 = await t.game('act', 'b3');
      if (!t.gpu || !b3 || !b3.on) {
        t.log('software GL active; skipping live mobile 3D projection assertions');
        return;
      }
      t.equal(b3.tall, true, 'portrait mobile detected');
      t.expect(b3.tilt >= 0.08 && b3.tilt <= 0.10, `portrait tilt ${b3.tilt} rad in [0.08, 0.10]`);
      t.equal(b3.props.bell.visible, false, 'peripheral bell hidden on portrait mobile');
      t.equal(b3.props.towel.visible, false, 'peripheral towel hidden on portrait mobile');
      t.expect(b3.bezel.minX >= 0 && b3.bezel.maxX <= b3.bezel.W, `portrait walnut rails X inside #boardwrap (${b3.bezel.minX.toFixed(1)}..${b3.bezel.maxX.toFixed(1)} of ${b3.bezel.W})`);
      t.expect(b3.bezel.minY >= 0 && b3.bezel.maxY <= b3.bezel.H, `portrait walnut rails Y inside #boardwrap (${b3.bezel.minY.toFixed(1)}..${b3.bezel.maxY.toFixed(1)} of ${b3.bezel.H})`);
      // Ruling 11: keep phone squares at or above 20.4 px
      const [x0] = await t.game('act', 'cell', 112);
      const [x1] = await t.game('act', 'cell', 113);
      const cellPx = Math.abs(x1 - x0);
      t.expect(cellPx >= 20.4, `portrait phone square size ${cellPx.toFixed(2)} px >= 20.4 px (Ruling 11)`);
      await t.shot('w2-b14-mobile-3d-bezel', { timeout: 15000 });
    },
  },
];

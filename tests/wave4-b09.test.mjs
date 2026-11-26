// Wave 4, batch W4-B09 (WF-2 concept constraints):
// - W2-S2-04 (frosted sea-glass blank Steam tiles & etched unplayed steam curls in rack/drag/3D faces): already built by 050386d
//   (W1-S5-04, tests: wave4-b01). This suite confirms the unplayed drag-ghost blank also stays intact.
// - W2-S5-09: Art Deco stepped-fan brass corner brackets on the outer terrazzo border (+ matching roughnessMap) and native-res
//   1:1 ClampToEdgeWrapping counter.webp UVs with subtle peripheral vignetting (zero 2x2 MirroredRepeatWrapping seams).
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

export const tests = [
  // ---------- W2-S5-09 (Part A: Art Deco stepped-fan corner brackets + roughnessMap) ----------
  {
    name: 'W2-S5-09 all four corners render Art Deco stepped-fan brass brackets strictly on the outer terrazzo border with matching glossy roughnessMap and zero marble bleed',
    viewports: ['desktop'],
    url: 'index.html?gl=0',
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 41, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'julian' }] });
      await t.waitIdle(6000);
      await t.waitFrames(3);

      const audit = await t.page.evaluate(async () => {
        const R = await import(new URL('src/js/render2d.js', location.href).href);
        const size = 2048, cell = size / R.U, f = R.FRAME * cell, band = f * 0.78;
        const outerR = band * 0.18, innerR = f - cell * 0.06, bw = innerR - outerR;
        const mid = (outerR + innerR) / 2;
        const cv = R.paintBoard(size, 'light', false), ctx = cv.getContext('2d');
        const rv = R.boardRoughnessTexture(), rctx = rv.getContext('2d');
        const rScale = rv.width / size;

        const isBrass = (r, g, b) => r > 170 && g > 125 && b < 130 && r - b >= 60;
        const isDarkBronze = (r, g, b) => r < 95 && g < 68 && b < 45 && r >= b;
        const countBox = (x, y, w, h) => {
          const d = ctx.getImageData(Math.round(x), Math.round(y), Math.max(2, Math.round(w)), Math.max(2, Math.round(h))).data;
          let brass = 0, brightGold = 0, darkBronze = 0, n = d.length / 4;
          for (let i = 0; i < d.length; i += 4) {
            const r = d[i], g = d[i + 1], b = d[i + 2];
            if (isBrass(r, g, b)) brass++;
            if (r > 225 && g > 195 && b < 175 && r - b >= 65) brightGold++;
            if (isDarkBronze(r, g, b)) darkBronze++;
          }
          return { brass, brightGold, darkBronze, ratio: brass / n };
        };
        const roughAt = (x, y) => rctx.getImageData(Math.round(x * rScale), Math.round(y * rScale), 1, 1).data[1] / 255;

        // Control: empty outer terrazzo strip at top col 2 (clear of corner bracket & Bathhouse Row markers)
        const ctrl = countBox(f + 2.3 * cell, mid - bw * 0.25, cell * 0.2, bw * 0.5);

        const corners = [];
        for (const [sx, sy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
          const mapX = (lx, lw) => (sx ? size - lx - lw : lx);
          const mapY = (ly, lh) => (sy ? size - ly - lh : ly);
          const mapPt = (lx, ly) => [sx ? size - lx : lx, sy ? size - ly : ly];

          // 1) Stepped tier-2 horizontal & vertical arms (x in [f+0.20*cell .. f+0.38*cell], beyond the old f*0.36 circle!)
          const hArm2 = countBox(mapX(f + cell * 0.20, cell * 0.18), mapY(mid - bw * 0.16, bw * 0.32), cell * 0.18, bw * 0.32);
          const vArm2 = countBox(mapX(mid - bw * 0.16, bw * 0.32), mapY(f + cell * 0.20, cell * 0.18), bw * 0.32, cell * 0.18);
          // 2) Stepped tier-3 finial tongue center vs stepped-away outer edge (proves ziggurat step-down, not a flat bar)
          const hFinCenter = countBox(mapX(f + cell * 0.48, cell * 0.14), mapY(mid - bw * 0.08, bw * 0.16), cell * 0.14, bw * 0.16);
          const hFinOuter = countBox(mapX(f + cell * 0.48, cell * 0.14), mapY(outerR + bw * 0.10, bw * 0.14), cell * 0.14, bw * 0.14);
          // 3) Inset quarter-fan sunburst medallion inside corner block [outerR..innerR]^2
          const fan = countBox(mapX(outerR + bw * 0.06, bw * 0.88), mapY(outerR + bw * 0.06, bw * 0.88), bw * 0.88, bw * 0.88);
          // 4) Interior corner marble square (row 0/14, col 0/14) stays free of bracket brass (CD-WF2-03)
          const interior = countBox(mapX(f + cell * 0.14, cell * 0.55), mapY(f + cell * 0.14, cell * 0.55), cell * 0.55, cell * 0.55);
          // 5) Roughness map along tier-2 horizontal & vertical arms is glossy brass (~0.22), while empty terrazzo is ~0.58
          const [rhx, rhy] = mapPt(f + cell * 0.28, mid);
          const [rvx, rvy] = mapPt(mid, f + cell * 0.28);
          corners.push({
            id: `${sx},${sy}`,
            hArm2: hArm2.ratio, vArm2: vArm2.ratio,
            hFinCenter: hFinCenter.ratio, hFinOuter: hFinOuter.ratio,
            fanBright: fan.brightGold, fanDark: fan.darkBronze,
            interiorBrass: interior.brass,
            roughH: roughAt(rhx, rhy), roughV: roughAt(rvx, rvy),
          });
        }
        const roughCtrl = roughAt(f + 2.4 * cell, mid);
        return { ctrlRatio: ctrl.ratio, roughCtrl, corners };
      });

      t.expect(audit.ctrlRatio < 0.20, `empty outer terrazzo control has low brass ratio (${audit.ctrlRatio.toFixed(2)})`);
      t.expect(audit.roughCtrl >= 0.50 && audit.roughCtrl <= 0.65, `empty terrazzo roughness ~0.58 (got ${audit.roughCtrl.toFixed(2)})`);
      for (const c of audit.corners) {
        t.expect(c.hArm2 >= 0.65 && c.vArm2 >= 0.65, `corner (${c.id}) stepped L-bracket arms extend along both rails beyond old circle (H=${c.hArm2.toFixed(2)}, V=${c.vArm2.toFixed(2)})`);
        t.expect(c.hFinCenter >= 0.55 && c.hFinOuter < 0.25, `corner (${c.id}) tier-3 finial steps narrower than tier-1/2 (center=${c.hFinCenter.toFixed(2)}, stepped-out=${c.hFinOuter.toFixed(2)})`);
        t.expect(c.fanBright >= 60 && c.fanDark >= 60, `corner (${c.id}) inset quarter-fan renders contrasting bright-gold sunburst rays & dark-bronze flutes (bright=${c.fanBright}, dark=${c.fanDark})`);
        t.equal(c.interiorBrass, 0, `corner (${c.id}) bracket stays strictly on outer terrazzo with zero interior marble bleed (CD-WF2-03)`);
        t.expect(c.roughH <= 0.28 && c.roughV <= 0.28, `corner (${c.id}) roughnessMap matches glossy brass bracket arms (H=${c.roughH.toFixed(2)}, V=${c.roughV.toFixed(2)})`);
      }

      // Visual check: 2D full board + zoomed top-left corner close-up
      await t.shot('w4-b09-corners-2d');
      await t.game('act', 'zoom', 2.4, 1.5, 1.5);
      await t.waitFrames(3);
      await t.shot('w4-b09-corner-zoom-2d');
      await t.game('act', 'zoom', 1);
    },
  },

  // ---------- W2-S5-09 (Part B: 3D counter.webp UV scale, zero MirroredRepeatWrapping seams & peripheral vignette) ----------
  {
    name: 'W2-S5-09 3D walnut counter uses native 1600x1066 1:1 ClampToEdgeWrapping (zero MirroredRepeatWrapping seams) with subtle peripheral vignetting in Day and Night',
    viewports: ['desktop'],
    initScript: quiet,
    async run(t) {
      // Static guard: board3d.js no longer applies MirroredRepeatWrapping or 2048x1365 upscale to B3.table
      const b3Src = fs.readFileSync(path.join(root, 'src', 'js', 'board3d.js'), 'utf8');
      const b3Code = b3Src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
      t.equal(b3Code.includes('MirroredRepeatWrapping'), false, 'board3d.js removes MirroredRepeatWrapping from counter tabletop');
      t.equal(b3Code.includes('1365'), false, 'board3d.js no longer upscales counter.webp to 2048x1365');

      await ready(t);
      await t.game('newGame', { seed: 41, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'julian' }] });
      await t.waitIdle(8000);
      await t.page.waitForFunction(async () => {
        const b = await window.__game.act('b3');
        return !b || !b.on || b.counterArt === true;
      }, null, { timeout: 8000 });
      await t.waitFrames(3);

      const dayB3 = await t.game('act', 'b3');
      if (!t.gpu || !dayB3 || !dayB3.on) {
        t.log('software GL active; skipping live 3D counter texture assertions');
        return;
      }

      const tm = dayB3.tableMap;
      t.expect(!!tm, 'B3.debug() reports tableMap telemetry');
      t.equal(tm.w, 1600, `counter texture stays at native 1600 px width (got ${tm.w})`);
      t.equal(tm.h, 1066, `counter texture stays at native 1066 px height (got ${tm.h})`);
      t.equal(tm.repeatX, 1, `counter UV repeatX === 1 (got ${tm.repeatX})`);
      t.equal(tm.repeatY, 1, `counter UV repeatY === 1 (got ${tm.repeatY})`);
      t.equal(tm.wrapS, 1001, `counter wrapS === ClampToEdgeWrapping (1001, got ${tm.wrapS})`);
      t.equal(tm.wrapT, 1001, `counter wrapT === ClampToEdgeWrapping (1001, got ${tm.wrapT})`);
      t.equal(tm.planeW, 54, `counter plane width 54 matches 3:2 counter aspect (got ${tm.planeW})`);
      t.equal(tm.planeH, 36, `counter plane height 36 matches 3:2 counter aspect (got ${tm.planeH})`);

      // Measure raw counter.webp center vs corner luminance so the vignette ratio is exact (independent of woodgrain shade)
      const rawRatio = await t.page.evaluate(async () => {
        const im = new Image(); im.src = 'assets/counter.webp'; await im.decode();
        const cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight;
        const ctx = cv.getContext('2d'); ctx.drawImage(im, 0, 0);
        const box = (x, y, s) => {
          const d = ctx.getImageData(Math.round(x), Math.round(y), s, s).data;
          let sum = 0; for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
          return sum / (d.length / 4);
        };
        const s = 32, w = cv.width, h = cv.height;
        const center = box(w * 0.5 - s / 2, h * 0.48 - s / 2, s);
        const corner = (box(8, 8, s) + box(w - s - 8, 8, s) + box(8, h - s - 8, s) + box(w - s - 8, h - s - 8, s)) / 4;
        return { center, corner, ratio: corner / center };
      });
      const dayEdgeFactor = (tm.cornerLum / tm.centerLum) / rawRatio.ratio;
      t.log(`Day counter vignette: centerLum=${tm.centerLum}, cornerLum=${tm.cornerLum}, rawRatio=${rawRatio.ratio.toFixed(3)}, edgeFactor=${dayEdgeFactor.toFixed(3)}`);
      t.expect(dayEdgeFactor <= 0.74 && dayEdgeFactor >= 0.45, `Day counter applies subtle peripheral vignetting without crushing corners (edgeFactor=${dayEdgeFactor.toFixed(3)}, target 0.45..0.74)`);

      await t.shot('w4-b09-counter-3d-day', { timeout: 15000 });
      // Also capture a wider 1600x900 desktop shot to verify seamless counter margins on wide screens
      await t.page.setViewportSize({ width: 1600, height: 900 });
      await t.waitFrames(4);
      await t.shot('w4-b09-counter-3d-wide', { timeout: 15000 });
      await t.page.setViewportSize({ width: 1280, height: 800 });

      // Night theme preserves native 1:1 counter map and subtle peripheral vignetting
      await t.game('scene', 'settings');
      await t.page.click('[data-set="theme"][data-val="dark"]');
      await t.game('scene', 'game');
      await t.waitIdle(6000);
      await t.waitFrames(3);
      const nightB3 = await t.game('act', 'b3');
      const ntm = nightB3.tableMap;
      const nightEdgeFactor = (ntm.cornerLum / ntm.centerLum) / rawRatio.ratio;
      t.log(`Night counter vignette: centerLum=${ntm.centerLum}, cornerLum=${ntm.cornerLum}, edgeFactor=${nightEdgeFactor.toFixed(3)}`);
      t.equal(ntm.w, 1600, 'Night counter stays 1600 px');
      t.equal(ntm.repeatX, 1, 'Night counter stays repeatX === 1');
      t.expect(nightEdgeFactor <= 0.70 && nightEdgeFactor >= 0.35, `Night counter applies subtle peripheral vignetting (edgeFactor=${nightEdgeFactor.toFixed(3)}, target 0.35..0.70)`);
      await t.shot('w4-b09-counter-3d-night', { timeout: 15000 });
    },
  },

  // ---------- W2-S2-04 (verification of already_done 050386d in live drag ghost) ----------
  {
    name: 'W2-S2-04 unplayed blank Steam tile keeps frosted sea-glass glaze and etched steam curls inside live #ghost during rack drag (verifies 050386d)',
    viewports: ['desktop'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 3, seats: [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }] });
      await t.waitIdle(6000);
      await t.game('act', 'reveal');
      const g = (await t.state()).game;
      g.players[0].rack = '?ATQQQQ'.split('');
      await t.game('setState', { game: g });
      await t.waitIdle(4000);

      // Start dragging the blank rack tile without dropping so #ghost renders the unplayed blank
      const box = await t.page.locator('#rack .rtile').first().boundingBox();
      await t.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await t.page.mouse.down();
      await t.page.mouse.move(box.x + box.width / 2, box.y - 80, { steps: 6 });
      await t.waitFrames(3);

      const ghostInfo = await t.page.evaluate(() => {
        const gh = document.getElementById('ghost');
        if (!gh || gh.hidden) return { visible: false };
        const ctx = gh.getContext('2d'), w = gh.width, h = gh.height;
        const d = ctx.getImageData(0, 0, w, h).data;
        const px = (fx, fy) => { const o = (Math.round(fy * h) * w + Math.round(fx * w)) * 4; return [d[o], d[o + 1], d[o + 2]]; };
        const glaze = px(0.20, 0.80);
        const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
        const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
        const bgLum = lum(glaze);
        let darkMarks = 0, total = 0;
        for (let fy = 0.24; fy < 0.76; fy += 0.02) {
          for (let fx = 0.24; fx < 0.76; fx += 0.02) {
            total++;
            if (lum(px(fx, fy)) < bgLum * 0.72) darkMarks++;
          }
        }
        return { visible: true, w, h, glaze, markRatio: darkMarks / total };
      });
      await t.shot('w4-b09-drag-blank-ghost');
      await t.page.mouse.up();

      t.equal(ghostInfo.visible, true, '#ghost canvas is visible while dragging an unplayed blank');
      t.expect(ghostInfo.glaze[1] - ghostInfo.glaze[0] >= 8 && ghostInfo.glaze[2] > ghostInfo.glaze[0], `drag #ghost blank uses frosted sea-glass tint (${ghostInfo.glaze})`);
      t.expect(ghostInfo.markRatio >= 0.06, `drag #ghost unplayed blank renders crisp etched steam curls (${(ghostInfo.markRatio * 100).toFixed(1)}%)`);
    },
  },
];

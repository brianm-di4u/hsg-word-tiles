// Wave 2, batch W2-B12: W3-S1-01 (Q10 tile typography & 3D crown UVs), W3-S1-03 (portrait circular alpha, baton clearance, SHORT name & ?art=0 initials).
import fs from 'node:fs';
import path from 'node:path';
import { root } from './lib.mjs';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false }));
  }
};

export const tests = [
  // ---------- W3-S1-01 ----------
  {
    name: 'W3-S1-01 3D tiletop UVs map flat crown [-0.38..+0.38] to [0..1] and Q (10-pt) tail clears 10 numeral in 3D face and 2D/rack sprites',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 7 });
      await t.waitIdle(6000);

      // 1) Check 3D tiletop UVs when 3D board is active (GPU run)
      const b3 = await t.game('act', 'b3');
      if (b3 && b3.on) {
        t.expect(!!b3.tileTopUv, 'B3.debug() reports tileTopUv bounds');
        t.expect(b3.tileTopUv.crownMinU <= 0.001 && b3.tileTopUv.crownMaxU >= 0.999, `tiletop crown U spans [0..1] (got ${b3.tileTopUv.crownMinU.toFixed(3)}..${b3.tileTopUv.crownMaxU.toFixed(3)})`);
        t.expect(b3.tileTopUv.crownMinV <= 0.001 && b3.tileTopUv.crownMaxV >= 0.999, `tiletop crown V spans [0..1] (got ${b3.tileTopUv.crownMinV.toFixed(3)}..${b3.tileTopUv.crownMaxV.toFixed(3)})`);
        t.expect(b3.tileTopUv.minU >= 0 && b3.tileTopUv.maxU <= 1 && b3.tileTopUv.minV >= 0 && b3.tileTopUv.maxV <= 1, 'all tiletop UVs stay clamped in [0..1]');
      }

      // 2) Connected-component pixel separation audit on real Fraunces/Josefin rendered tiles (face 512px, board 128px, rack 48px)
      const tileAudit = await t.page.evaluate(async () => {
        await document.fonts.ready;
        const base = (f) => new URL('src/js/' + f, location.href).href;
        const R = await import(base('render2d.js'));

        const analyzeTile = (letter, w, kind, theme = 'light') => {
          const cv = R.tileSprite(letter, false, w, kind, theme);
          const ctx = cv.getContext('2d');
          const { data } = ctx.getImageData(0, 0, w, w);
          // For 2D tileSprite, exclude the outer tile bevel border (inset = 0.05w + stroke ~0.04w)
          const pad = kind === 'face' ? 2 : Math.ceil(w * 0.10);
          const mask = new Uint8Array(w * w);
          for (let y = pad; y < w - pad; y++) {
            for (let x = pad; x < w - pad; x++) {
              const o = (y * w + x) * 4;
              const lum = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
              if (lum < 145) mask[y * w + x] = 1;
            }
          }
          // 8-connected components
          const seen = new Uint8Array(w * w);
          const comps = [];
          for (let y = pad; y < w - pad; y++) {
            for (let x = pad; x < w - pad; x++) {
              const i0 = y * w + x;
              if (!mask[i0] || seen[i0]) continue;
              const stack = [i0];
              seen[i0] = 1;
              let minX = x, maxX = x, minY = y, maxY = y, count = 0;
              const pts = [];
              while (stack.length) {
                const i = stack.pop();
                const cx = i % w, cy = (i / w) | 0;
                if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
                if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
                count++;
                if (w <= 512) pts.push(i);
                for (let dy = -1; dy <= 1; dy++) {
                  for (let dx = -1; dx <= 1; dx++) {
                    if (!dx && !dy) continue;
                    const nx = cx + dx, ny = cy + dy;
                    if (nx < pad || nx >= w - pad || ny < pad || ny >= w - pad) continue;
                    const ni = ny * w + nx;
                    if (mask[ni] && !seen[ni]) { seen[ni] = 1; stack.push(ni); }
                  }
                }
              }
              if (count >= Math.max(4, Math.floor(w * 0.04))) {
                comps.push({ minX, maxX, minY, maxY, count, pts });
              }
            }
          }
          comps.sort((a, b) => b.count - a.count);
          // Main glyph is largest component; numerals are remaining components in bottom-right
          const glyph = comps[0] || null;
          const nums = comps.slice(1).filter((c) => c.maxX > w * 0.50 && c.maxY > w * 0.55);
          // Compute exact minimum pixel distance between glyph boundary and numeral pixels
          let minDist = Infinity;
          if (glyph && nums.length) {
            // Subsample boundary pixels of glyph (pixels with at least one 4-neighbor == 0)
            const gBorder = [];
            for (const i of glyph.pts) {
              const x = i % w, y = (i / w) | 0;
              if (!mask[i - 1] || !mask[i + 1] || !mask[i - w] || !mask[i + w]) gBorder.push([x, y]);
            }
            const nBorder = [];
            for (const nc of nums) {
              for (const i of nc.pts) {
                const x = i % w, y = (i / w) | 0;
                if (!mask[i - 1] || !mask[i + 1] || !mask[i - w] || !mask[i + w]) nBorder.push([x, y]);
              }
            }
            for (let a = 0; a < gBorder.length; a++) {
              const [gx, gy] = gBorder[a];
              for (let b = 0; b < nBorder.length; b++) {
                const dx = gx - nBorder[b][0], dy = gy - nBorder[b][1];
                const d2 = dx * dx + dy * dy;
                if (d2 < minDist) minDist = d2;
              }
            }
            minDist = Math.sqrt(minDist);
          }
          const numMaxX = nums.length ? Math.max(...nums.map((c) => c.maxX)) / w : 0;
          const numMaxY = nums.length ? Math.max(...nums.map((c) => c.maxY)) / w : 0;
          const numMinX = nums.length ? Math.min(...nums.map((c) => c.minX)) / w : 0;
          const numMinY = nums.length ? Math.min(...nums.map((c) => c.minY)) / w : 0;
          return {
            w, kind,
            compCount: comps.length,
            numCompCount: nums.length,
            minDistPx: Number.isFinite(minDist) ? Number(minDist.toFixed(2)) : 0,
            minDistRatio: Number.isFinite(minDist) ? Number((minDist / w).toFixed(4)) : 0,
            glyphBox: glyph ? [glyph.minX / w, glyph.minY / w, glyph.maxX / w, glyph.maxY / w].map((v) => Number(v.toFixed(3))) : null,
            numBox: nums.length ? [numMinX, numMinY, numMaxX, numMaxY].map((v) => Number(v.toFixed(3))) : null,
          };
        };

        return {
          faceQ512: analyzeTile('Q', 512, 'face', 'light'),
          faceQ512Dark: analyzeTile('Q', 512, 'face', 'dark'),
          boardQ128: analyzeTile('Q', 128, 'board', 'light'),
          rackQ48: analyzeTile('Q', 48, 'rack', 'light'),
          faceA512: analyzeTile('A', 512, 'face', 'light'),
          faceJ512: analyzeTile('J', 512, 'face', 'light'),
        };
      });

      // Q (10-pt) must have 3 disjoint components: Q, 1, 0 (never Q colliding into 1!)
      t.equal(tileAudit.faceQ512.compCount, 3, `3D face Q512 has 3 disjoint ink components [Q,1,0] (got ${JSON.stringify(tileAudit.faceQ512)})`);
      t.expect(tileAudit.faceQ512.minDistPx >= 10, `3D face Q512 clears '10' by >= 10 px (got ${tileAudit.faceQ512.minDistPx} px, boxes=${JSON.stringify(tileAudit.faceQ512)})`);
      t.expect(tileAudit.faceQ512.numBox[2] <= 0.88 && tileAudit.faceQ512.numBox[3] <= 0.88, `3D face Q512 '10' stays cleanly inset inside flat crown <= 0.88w (got ${JSON.stringify(tileAudit.faceQ512.numBox)})`);
      t.equal(tileAudit.faceQ512Dark.compCount, 3, `3D dark face Q512 has 3 disjoint ink components (got ${JSON.stringify(tileAudit.faceQ512Dark)})`);
      t.equal(tileAudit.boardQ128.compCount, 3, `2D board Q128 has 3 disjoint ink components [Q,1,0] (got ${JSON.stringify(tileAudit.boardQ128)})`);
      t.expect(tileAudit.boardQ128.minDistPx >= 2.5, `2D board Q128 clears '10' by >= 2.5 px (got ${tileAudit.boardQ128.minDistPx} px)`);
      t.equal(tileAudit.rackQ48.compCount, 3, `rack Q48 has 3 disjoint ink components [Q,1,0] (got ${JSON.stringify(tileAudit.rackQ48)})`);
      t.expect(tileAudit.faceA512.numBox[2] <= 0.88 && tileAudit.faceJ512.numBox[2] <= 0.88, `single-digit numerals stay cleanly inset <= 0.88w (A=${JSON.stringify(tileAudit.faceA512.numBox)}, J=${JSON.stringify(tileAudit.faceJ512.numBox)})`);

      // 3) Place SQUID & QI on the live board and capture zoomed close-up screenshot for visual inspection
      if (t.viewport === 'desktop') {
        await t.page.evaluate(() => {
          const G = window.__G;
          const s = G.s;
          const word = 'SQUID';
          for (let k = 0; k < word.length; k++) s.board[7 * 15 + 6 + k] = { l: word[k], blank: false };
          s.board[8 * 15 + 7] = { l: 'I', blank: false };
          s.board[6 * 15 + 9] = { l: 'J', blank: false };
          s.board[8 * 15 + 9] = { l: 'Z', blank: false };
          s.players[0].rack = ['Q', 'U', 'I', 'D', 'J', 'X', 'Z'];
          G.order = [0, 1, 2, 3, 4, 5, 6];
        });
        await t.game('act', 'reveal');
        await t.game('act', 'zoom', 2.4, 8.2, 7.9);
        await t.waitFrames(3);
        await t.shot(b3 && b3.on ? 'w2-b12-q10-board-3d' : 'w2-b12-q10-board-2d');
        await t.game('act', 'zoom', 1);
      }
    },
  },
];

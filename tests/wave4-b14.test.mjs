// Wave 4, batch W4-B14 (WF-3 modular_economy): W3-S4-04 (stained-glass Smart Transforms).
import { SQUARE, N } from '../src/js/score.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, theme: 'light' }));
  }
};

export const tests = [
  // ---------- W3-S4-04 ----------
  {
    name: 'W3-S4-04 46 stained-glass springs apply deterministic Smart Transforms (rotations+mirror on w/h/b, vertical-preserving mirror+flip+shift on glass-s) before upright labels',
    viewports: ['desktop'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 41, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'julian' }] });
      await t.waitIdle(8000);
      await t.waitFrames(3);

      const audit = await t.page.evaluate(async ({ sq, gridN }) => {
        const R = await import(new URL('src/js/render2d.js', location.href).href);
        const { art } = await import(new URL('src/js/art.js', location.href).href);
        const load = (name) => new Promise((res, rej) => {
          if (art.ready(name)) { res(art.img(name)); return; }
          const im = new Image();
          im.onload = () => { art.imgs[name] = im; res(im); };
          im.onerror = rej;
          im.src = `assets/${name}.webp`;
        });
        const imgs = {};
        for (const k of ['w', 'h', 's', 'b']) imgs[k] = await load('glass-' + k);
        const imgToKey = new Map(Object.entries(imgs).map(([k, im]) => [im, k]));

        const draws = { w: [], h: [], s: [], b: [] };
        const labels = [];
        const origDraw = CanvasRenderingContext2D.prototype.drawImage;
        const origText = CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.drawImage = function (img, ...args) {
          const k = imgToKey.get(img);
          if (k) {
            const m = this.getTransform();
            draws[k].push({
              a: Math.round(m.a), b: Math.round(m.b), c: Math.round(m.c), d: Math.round(m.d),
              dx: args[0], dy: args[1], dw: args[2], dh: args[3],
            });
          }
          return origDraw.call(this, img, ...args);
        };
        CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
          if (/^(2L|3L|2W|3W)$/.test(String(text))) {
            const m = this.getTransform();
            labels.push({ text: String(text), a: +m.a.toFixed(3), b: +m.b.toFixed(3), c: +m.c.toFixed(3), d: +m.d.toFixed(3) });
          }
          return origText.call(this, text, ...args);
        };
        let cv1, cv2;
        try {
          cv1 = R.paintBoard(2048, 'light', true);
        } finally {
          CanvasRenderingContext2D.prototype.drawImage = origDraw;
          CanvasRenderingContext2D.prototype.fillText = origText;
        }
        cv2 = R.paintBoard(2048, 'light', true);

        // Compare rendered outer glass-ring pixels across squares of each spring type (excluding center upright label disc)
        const size = 2048, cell = size / R.U, f = R.FRAME * cell, gap = Math.max(1, cell * 0.035), w = cell - gap;
        const ctx1 = cv1.getContext('2d'), ctx2 = cv2.getContext('2d');
        const cellsByType = { w: [], h: [], s: [], b: [] };
        for (let i = 0; i < gridN * gridN; i++) if (cellsByType[sq[i]]) cellsByType[sq[i]].push(i);

        const patchOf = (ctx, idx) => {
          const r = Math.floor(idx / gridN), c = idx % gridN;
          const x0 = Math.round(f + c * cell + gap / 2 + w * 0.06);
          const y0 = Math.round(f + r * cell + gap / 2 + w * 0.06);
          const pw = Math.round(w * 0.88);
          return { data: ctx.getImageData(x0, y0, pw, pw).data, pw };
        };
        const outerDiff = (pA, pB) => {
          const pw = pA.pw, half = pw / 2, innerR = pw * 0.42;
          let sum = 0, n = 0;
          for (let y = 0; y < pw; y += 2) {
            for (let x = 0; x < pw; x += 2) {
              if (Math.hypot(x - half, y - half) < innerR) continue;
              const o = (y * pw + x) * 4;
              sum += Math.abs(pA.data[o] - pB.data[o]) + Math.abs(pA.data[o + 1] - pB.data[o + 1]) + Math.abs(pA.data[o + 2] - pB.data[o + 2]);
              n += 3;
            }
          }
          return n ? sum / n : 0;
        };

        const pixelVariety = {};
        let deterministicDiff = 0;
        for (const k of ['w', 'h', 's', 'b']) {
          const list = cellsByType[k];
          const p0 = patchOf(ctx1, list[0]);
          const p0Repeat = patchOf(ctx2, list[0]);
          deterministicDiff += outerDiff(p0, p0Repeat);
          let varied = 0, maxDiff = 0;
          for (let j = 1; j < list.length; j++) {
            const diff = outerDiff(p0, patchOf(ctx1, list[j]));
            if (diff >= 5) varied++;
            if (diff > maxDiff) maxDiff = diff;
          }
          const orientKeys = new Set(draws[k].map((e) => `${e.a},${e.b},${e.c},${e.d}`));
          const uniqueDys = new Set(draws[k].map((e) => Number((e.dy + e.dh / 2).toFixed(2))));
          pixelVariety[k] = {
            count: list.length,
            drawCount: draws[k].length,
            orients: orientKeys.size,
            rotated90: draws[k].filter((e) => Math.abs(e.b) === 1 || Math.abs(e.c) === 1).length,
            mirrored: draws[k].filter((e) => e.a * e.d - e.b * e.c < 0).length,
            uniqueDys: uniqueDys.size,
            variedPeers: varied,
            maxDiff: +maxDiff.toFixed(1),
          };
        }
        return {
          pixelVariety,
          deterministicDiff,
          labelCount: labels.length,
          allLabelsUpright: labels.every((l) => l.a === 1 && l.b === 0 && l.c === 0 && l.d === 1),
        };
      }, { sq: SQUARE, gridN: N });

      t.log('W3-S4-04 glass Smart Transforms: ' + JSON.stringify(audit.pixelVariety));
      t.equal(audit.deterministicDiff, 0, 'paintBoard() glass Smart Transforms are 100% deterministic across calls');
      t.equal(audit.labelCount, 46, 'all 46 spring labels stamped');
      t.equal(audit.allLabelsUpright, true, 'all 46 spring labels stamped upright after ctx.restore()');

      // Radial w/h/b: 4x 90-degree rotations + horizontal mirror
      t.equal(audit.pixelVariety.w.drawCount, 22, '22 Warm glass-w draws');
      t.expect(audit.pixelVariety.w.orients >= 5, `Warm (w) uses >= 5 distinct rotation/mirror transforms (got ${audit.pixelVariety.w.orients})`);
      t.expect(audit.pixelVariety.w.rotated90 >= 4 && audit.pixelVariety.w.mirrored >= 4, `Warm (w) uses both 90-degree rotations (${audit.pixelVariety.w.rotated90}) and mirrors (${audit.pixelVariety.w.mirrored})`);
      t.expect(audit.pixelVariety.w.variedPeers >= 14 && audit.pixelVariety.w.maxDiff >= 25, `Warm (w) outer glass ring pixels vary across squares (${audit.pixelVariety.w.variedPeers}/21 peers differ, maxDiff=${audit.pixelVariety.w.maxDiff})`);

      t.equal(audit.pixelVariety.h.drawCount, 8, '8 Hot glass-h draws');
      t.expect(audit.pixelVariety.h.orients >= 4, `Hot (h) uses >= 4 distinct rotation/mirror transforms (got ${audit.pixelVariety.h.orients})`);
      t.expect(audit.pixelVariety.h.variedPeers >= 4 && audit.pixelVariety.h.maxDiff >= 25, `Hot (h) outer glass ring pixels vary across squares (${audit.pixelVariety.h.variedPeers}/7 peers differ, maxDiff=${audit.pixelVariety.h.maxDiff})`);

      t.equal(audit.pixelVariety.b.drawCount, 4, '4 Boiling glass-b draws');
      t.expect(audit.pixelVariety.b.orients >= 2, `Boiling (b) uses >= 2 distinct rotation/mirror transforms across the 4 corners (got ${audit.pixelVariety.b.orients})`);
      t.expect(audit.pixelVariety.b.variedPeers >= 2 && audit.pixelVariety.b.maxDiff >= 25, `Boiling (b) outer bubble pixels vary across corners (${audit.pixelVariety.b.variedPeers}/3 peers differ, maxDiff=${audit.pixelVariety.b.maxDiff})`);

      // Wavy s: vertical-preserving mirror + flip + subtle vertical shift (zero 90-degree sideways rotation)
      t.equal(audit.pixelVariety.s.drawCount, 12, '12 Steam glass-s draws');
      t.equal(audit.pixelVariety.s.rotated90, 0, 'Steam (s) never rotates 90 degrees sideways so rising steam stays vertical');
      t.expect(audit.pixelVariety.s.orients >= 3, `Steam (s) uses >= 3 mirror/flip transforms (got ${audit.pixelVariety.s.orients})`);
      t.expect(audit.pixelVariety.s.uniqueDys >= 6, `Steam (s) applies subtle seeded vertical offset variation (got ${audit.pixelVariety.s.uniqueDys} unique offsets)`);
      t.expect(audit.pixelVariety.s.variedPeers >= 6 && audit.pixelVariety.s.maxDiff >= 25, `Steam (s) outer glass ring pixels vary across squares (${audit.pixelVariety.s.variedPeers}/11 peers differ, maxDiff=${audit.pixelVariety.s.maxDiff})`);

      await t.shot('w4-b14-glass-transforms', { timeout: 15000 });
    },
  },
];

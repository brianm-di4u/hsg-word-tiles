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
  // ---------- W3-S1-03 ----------
  {
    name: 'W3-S1-03 art.json uses geometric circleMask (zero keyWhite per CD-WF3-01) and shared initials() helper formats all 4 personas',
    node: true,
    async run(t) {
      const spec = JSON.parse(fs.readFileSync(path.join(root, 'art-src/art.json'), 'utf8'));
      const faces = spec.items.filter((it) => /^face-/.test(it.name));
      t.equal(faces.length, 4, 'art.json defines all 4 face-* portraits');
      for (const f of faces) {
        t.equal(f.keyWhite, undefined, `${f.name}: zero keyWhite flood-fill (CD-WF3-01)`);
        t.expect(typeof f.circleMask === 'number' && f.circleMask > 0, `${f.name}: geometric circleMask enabled (${f.circleMask})`);
        t.expect(Array.isArray(f.crop) && f.crop.length === 4 && f.crop[2] < 1, `${f.name}: tight inner cameo crop configured (${JSON.stringify(f.crop)})`);
      }
      const { initials } = await import(new URL('../src/js/ui.js', import.meta.url).href);
      t.equal(initials('Opal Vance'), 'OV', 'initials(Opal Vance) === OV');
      t.equal(initials('Hollis Crane'), 'HC', 'initials(Hollis Crane) === HC');
      t.equal(initials('"Lucky" Delmar'), 'LD', 'initials("Lucky" Delmar) === LD');
      t.equal(initials('Maestro Julian Fitch'), 'MJ', 'initials(Maestro Julian Fitch) === MJ');
      const uiSrc = fs.readFileSync(path.join(root, 'src/js/ui.js'), 'utf8');
      t.equal(/\.match\(\/[\s\x08]\[A-Z\]\/g\)/.test(uiSrc), false, 'corrupted /\\x08[A-Z]/g / space-anchored regex typo removed from ui.js');
    },
  },
  {
    name: 'W3-S1-03 face-*.webp have transparent circular corners + opaque Opal interior, .badge i hidden on AI scorecards/toast, and claimed plaque prints Julian',
    viewports: ['desktop', 'mobile'],
    initScript: () => {
      window.__TEST_TIPS__ = false;
      localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, theme: 'dark' }));
    },
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 11, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'julian', level: 'hard' }] });
      await t.waitIdle(6000);

      // 1) Inspect all 4 face-*.webp alpha masks & perimeter cream-rim elimination
      const faceAudit = await t.page.evaluate(async () => {
        const load = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
        const out = {};
        for (const name of ['face-opal', 'face-hollis', 'face-lucky', 'face-julian']) {
          const im = await load(`assets/${name}.webp`);
          const w = im.naturalWidth, h = im.naturalHeight;
          const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
          const ctx = cv.getContext('2d'); ctx.drawImage(im, 0, 0);
          const d = ctx.getImageData(0, 0, w, h).data;
          const alphaAt = (x, y) => d[(y * w + x) * 4 + 3];
          const corners = [alphaAt(0, 0), alphaAt(w - 1, 0), alphaAt(0, h - 1), alphaAt(w - 1, h - 1)];
          let minInteriorAlpha = 255, aaPx = 0, brightInteriorOpaque = 0, julianTopRimBlue = 0, julianTopRimRed = 0, rimN = 0;
          const cx = w / 2, cy = h / 2;
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const o = (y * w + x) * 4, a = d[o + 3];
              const r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
              if (r <= 88) {
                if (a < minInteriorAlpha) minInteriorAlpha = a;
                if (d[o] > 205 && d[o + 1] > 200 && d[o + 2] > 190 && a === 255) brightInteriorOpaque++;
              }
              if (a > 0 && a < 255) aaPx++;
              // Sample upper-right twilight-indigo backdrop rim on Julian (90 <= r <= 93.5, x > cx + 20, y < cy - 20)
              if (name === 'face-julian' && r >= 90 && r <= 93.5 && x > cx + 20 && y < cy - 20) {
                julianTopRimRed += d[o]; julianTopRimBlue += d[o + 2]; rimN++;
              }
            }
          }
          out[name] = { w, h, corners, minInteriorAlpha, aaPx, brightInteriorOpaque, rimRed: rimN ? Math.round(julianTopRimRed / rimN) : null, rimBlue: rimN ? Math.round(julianTopRimBlue / rimN) : null };
        }
        return out;
      });
      for (const [name, info] of Object.entries(faceAudit)) {
        t.equal(JSON.stringify(info.corners), '[0,0,0,0]', `${name} corners are 100% transparent (got ${JSON.stringify(info.corners)})`);
        t.equal(info.minInteriorAlpha, 255, `${name} interior (r <= 88) stays 100% opaque (minAlpha=${info.minInteriorAlpha}, CD-WF3-01)`);
        t.expect(info.aaPx >= 200, `${name} has feathered circular AA edge (${info.aaPx} px)`);
      }
      t.expect(faceAudit['face-opal'].brightInteriorOpaque > 2000, `Opal white cap/collar/towel stays opaque (${faceAudit['face-opal'].brightInteriorOpaque} bright interior px)`);
      t.expect(faceAudit['face-julian'].rimBlue > faceAudit['face-julian'].rimRed + 40, `Julian perimeter rim is clean twilight indigo, not cream halo (R=${faceAudit['face-julian'].rimRed}, B=${faceAudit['face-julian'].rimBlue})`);

      // 2) Verify .badge i is hidden on Julian's scorecard & toast (baton unobstructed) and claimed plaque shows 'Julian'
      await t.page.evaluate(() => {
        const G = window.__G;
        if (G.s.featured && G.s.featured[0]) G.s.featured[0].by = 1; // claimed by Maestro Julian Fitch
      });
      await t.game('act', 'reveal');
      await t.page.evaluate(() => {
        const G = window.__G;
        window.__game.act('toast', { kind: 'bark', who: { p: G.s.players[1], k: 1 }, title: 'Maestro Julian Fitch: STEAM +38', sub: '“A fine crescendo!”' });
      });
      await t.waitFrames(2);
      if (t.viewport === 'mobile') {
        const bar = t.page.locator('[data-springs-toggle]');
        if (await bar.isVisible()) await bar.click();
        await t.waitFrames(2);
      }

      const uiCheck = await t.page.evaluate(() => {
        const aiBadges = [...document.querySelectorAll('.badge.has-face i')].map((el) => getComputedStyle(el).display);
        const toastBadgeI = document.querySelector('#toast .badge.has-face i');
        const pby = document.querySelector('.plaque.claimed .pby');
        return {
          aiBadges,
          toastPipDisplay: toastBadgeI ? getComputedStyle(toastBadgeI).display : null,
          claimedOwner: pby ? pby.textContent.trim() : null,
        };
      });
      t.expect(uiCheck.aiBadges.length >= 2 && uiCheck.aiBadges.every((d) => d === 'none'), `all AI .badge.has-face i pips hidden (${JSON.stringify(uiCheck.aiBadges)})`);
      t.equal(uiCheck.toastPipDisplay, 'none', '#toast AI .badge i hidden so Julian baton is unobstructed');
      t.equal(uiCheck.claimedOwner, 'Julian', `claimed Featured Spring plaque prints SHORT name 'Julian' (got ${uiCheck.claimedOwner})`);

      if (t.viewport === 'desktop') await t.shot('w2-b12-night-julian-portrait');
    },
  },
  {
    name: 'W3-S1-03 ?art=0 Setup portrait() renders full two-letter initials OV/HC/LD/MJ via shared helper',
    viewports: ['desktop'],
    url: 'index.html?art=0',
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('scene', 'setup');
      await t.waitFrames(2);
      const got = await t.page.evaluate(() => [...document.querySelectorAll('.opps .opp .badge b')].map((el) => el.textContent));
      t.equal(JSON.stringify(got), JSON.stringify(['OV', 'HC', 'LD', 'MJ']), `?art=0 Setup portrait monograms match OV/HC/LD/MJ (got ${JSON.stringify(got)})`);
      await t.shot('w2-b12-noart-setup-initials');
    },
  },
];

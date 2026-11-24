// Wave 2, batch W2-B15: W3-S4-02 (single-source CANVAS_ART preload & art-data.js trim),
// W3-S4-03 (modular prop triangle/size budgets & 256x256 tiled perimeter terrazzo),
// W3-S4-01 (shared 2048x1024 256px-per-glyph 3D tile atlas, InstancedMesh tilebody, tiletop castShadow=false, GPU disposal).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { root } from './lib.mjs';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, theme: 'light' }));
  }
};

const EXPECTED_CANVAS_ART = [
  'bath-buckstaff', 'bath-fordyce', 'bath-hale', 'bath-lamar',
  'bath-maurice', 'bath-ozark', 'bath-quapaw', 'bath-superior',
  'counter', 'glass-b', 'glass-c', 'glass-h', 'glass-s', 'glass-w',
  'marble', 'terrazzo',
];

export const tests = [
  // ---------- W3-S4-02 ----------
  {
    name: 'W3-S4-02 art.json canvas:true drives single-source CANVAS_ART (16) and trims art-data.js to CANVAS_ART only (<= 700 KB)',
    node: true,
    async run(t) {
      const spec = JSON.parse(fs.readFileSync(path.join(root, 'art-src', 'art.json'), 'utf8'));
      const flagged = (spec.items || []).filter((it) => it && it.canvas === true).map((it) => it.name).sort();
      t.equal(JSON.stringify(flagged), JSON.stringify(EXPECTED_CANVAS_ART), `art.json marks exactly the 16 canvas textures (${flagged.length})`);

      const { ART_LIST, CANVAS_ART } = await import(new URL('../src/js/art-list.js', import.meta.url).href);
      t.equal(ART_LIST.length, 46, `ART_LIST keeps all 46 manifest entries (got ${ART_LIST.length})`);
      t.equal(JSON.stringify(CANVAS_ART), JSON.stringify(EXPECTED_CANVAS_ART), `CANVAS_ART exports the exact 16 canvas textures`);

      // Evaluate assets/art-data.js in a sandboxed context and inspect keys + byte budget
      const artDataPath = path.join(root, 'assets', 'art-data.js');
      const artDataBytes = fs.statSync(artDataPath).size;
      const sandbox = { window: {} };
      vm.runInNewContext(fs.readFileSync(artDataPath, 'utf8'), sandbox);
      const dataKeys = Object.keys(sandbox.window.__ART_DATA || {}).sort();
      t.equal(JSON.stringify(dataKeys), JSON.stringify(EXPECTED_CANVAS_ART), `assets/art-data.js packs ONLY CANVAS_ART (${dataKeys.length} keys, zero card-/title/face-/vig-)`);
      t.expect(artDataBytes <= 700 * 1024, `assets/art-data.js ${(artDataBytes / 1024).toFixed(1)} KB <= 700 KB (down from ~1,133 KB)`);
      t.log(`W3-S4-02 art-data.js: ${(artDataBytes / 1024).toFixed(1)} KB (${dataKeys.length} canvas textures)`);

      const pipeOut = execFileSync(process.execPath, [path.join(root, 'tools', 'check-pipeline.mjs'), '--fresh'], { cwd: root, encoding: 'utf8' });
      t.expect(pipeOut.includes('check-pipeline ok'), `check-pipeline --fresh passes (${pipeOut.trim()})`);
    },
  },
  {
    name: 'W3-S4-02 Title boot preloads only 16 CANVAS_ART textures (zero card-*.webp fetches, no duplicate title.webp canvas decode) and loads cards on demand',
    viewports: ['desktop'],
    initScript: quiet,
    async run(t) {
      const webpReqs = [];
      t.page.on('request', (req) => {
        const m = req.url().match(/\/assets\/([a-z0-9-]+)\.webp(?:\?|$)/i);
        if (m) webpReqs.push(m[1]);
      });
      await t.page.reload({ waitUntil: 'networkidle' });
      await ready(t);
      await t.waitFrames(3);

      const bootInfo = await t.page.evaluate(() => ({
        titleImgCount: document.querySelectorAll('img[src*="title.webp"]').length,
      }));
      // Inspect actual boot requests on Title
      const cardReqs = webpReqs.filter((n) => n.startsWith('card-'));
      const titleReqs = webpReqs.filter((n) => n === 'title');
      const faceReqs = webpReqs.filter((n) => n.startsWith('face-'));
      const vigReqs = webpReqs.filter((n) => n.startsWith('vig-'));
      const canvasReqs = [...new Set(webpReqs.filter((n) => EXPECTED_CANVAS_ART.includes(n)))].sort();

      t.equal(cardReqs.length, 0, `zero card-*.webp eagerly fetched on Title boot (got: ${cardReqs.join(', ')})`);
      t.equal(faceReqs.length, 0, `zero face-*.webp eagerly fetched on Title boot (got: ${faceReqs.join(', ')})`);
      t.equal(vigReqs.length, 0, `zero vig-*.webp eagerly fetched on Title boot (got: ${vigReqs.join(', ')})`);
      t.equal(titleReqs.length, 1, `title.webp fetched exactly once by DOM <img> (no redundant canvas preload, got ${titleReqs.length})`);
      t.equal(bootInfo.titleImgCount, 1, 'Title DOM renders title.webp once');
      t.equal(JSON.stringify(canvasReqs), JSON.stringify(EXPECTED_CANVAS_ART), `all 16 CANVAS_ART textures preloaded (${canvasReqs.length})`);

      // Verify DOM-only card-*.webp still loads cleanly on demand when opening a Fact Card
      await t.game('newGame', { seed: 41 });
      await t.waitIdle(6000);
      await t.game('act', 'fact', 'magnolia', 'MAGNOLIA');
      await t.page.waitForFunction(() => {
        const img = document.querySelector('#modal img.vig');
        return img && img.complete && img.naturalWidth > 0;
      }, null, { timeout: 8000 });
      const cardLoaded = await t.page.evaluate(() => {
        const img = document.querySelector('#modal img.vig');
        return img ? { src: img.getAttribute('src'), w: img.naturalWidth, h: img.naturalHeight } : null;
      });
      t.expect(!!cardLoaded && cardLoaded.w > 0 && /card-magnolia\.webp/.test(cardLoaded.src), `Fact Card loads card-magnolia.webp on demand (${JSON.stringify(cardLoaded)})`);
      await t.game('act', 'close');
    },
  },
  {
    name: 'W3-S4-02 file:// injects only 16 CANVAS_ART entries in window.__ART_DATA and still renders Fact Card <img>',
    viewports: ['desktop'],
    fileUrl: true,
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 41 });
      await t.waitIdle(8000);
      const keys = await t.page.evaluate(() => Object.keys(window.__ART_DATA || {}).sort());
      t.equal(JSON.stringify(keys), JSON.stringify(EXPECTED_CANVAS_ART), `file:// window.__ART_DATA holds only the 16 CANVAS_ART keys (${keys.length})`);
      await t.game('act', 'fact', 'magnolia', 'MAGNOLIA');
      await t.page.waitForFunction(() => {
        const img = document.querySelector('#modal img.vig');
        return img && img.complete && img.naturalWidth > 0;
      }, null, { timeout: 8000 });
      const cardSrc = await t.page.evaluate(() => {
        const img = document.querySelector('#modal img.vig');
        return img ? { src: img.getAttribute('src'), w: img.naturalWidth } : null;
      });
      t.expect(!!cardSrc && cardSrc.w > 0 && /card-magnolia\.webp/.test(cardSrc.src), `file:// Fact Card loads card-magnolia.webp directly via <img> (${JSON.stringify(cardSrc)})`);
      await t.game('act', 'close');
    },
  },
  // ---------- W3-S4-03 ----------
  {
    name: 'W3-S4-03 terrazzo.webp is 256x256 (~15-20 KB), art-data.js <= 550 KB, pieces-mesh.js <= 25 KB with compact props (CD-WF3-04), and render2d tiles via createPattern',
    node: true,
    async run(t) {
      const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'manifest.json'), 'utf8'));
      const tz = manifest.terrazzo;
      t.expect(!!tz, 'manifest contains terrazzo entry');
      t.equal(tz.w, 256, `terrazzo width is 256 (got ${tz.w})`);
      t.equal(tz.h, 256, `terrazzo height is 256 (got ${tz.h})`);
      t.expect(tz.bytes >= 8 * 1024 && tz.bytes <= 25 * 1024, `terrazzo.webp size ${(tz.bytes / 1024).toFixed(1)} KB within 8-25 KB (~15-20 KB target, down from 133.5 KB)`);

      const artDataBytes = fs.statSync(path.join(root, 'assets', 'art-data.js')).size;
      t.expect(artDataBytes <= 550 * 1024, `post-terrazzo assets/art-data.js ${(artDataBytes / 1024).toFixed(1)} KB <= 550 KB`);

      // Part (1) already solved by 7bc5acc (W3-S3-01 under CD-WF3-04): verify budgets still hold
      const meshBytes = fs.statSync(path.join(root, 'src', 'js', 'pieces-mesh.js')).size;
      t.expect(meshBytes <= 25 * 1024, `pieces-mesh.js ${(meshBytes / 1024).toFixed(2)} KB <= 25 KB`);
      const { MESHES } = await import(new URL('../src/js/pieces-mesh.js', import.meta.url).href);
      const trisOf = (p) => p.g.reduce((a, g) => a + Buffer.from(g.i, 'base64').byteLength / 6, 0);
      const bellTris = trisOf(MESHES.bell), towelTris = trisOf(MESHES.towels);
      t.expect(bellTris <= 400, `bell ${bellTris} tris <= 400`);
      t.expect(towelTris <= 300, `single modular towel ${towelTris} tris <= 300 (CD-WF3-04)`);

      const r2d = fs.readFileSync(path.join(root, 'src', 'js', 'render2d.js'), 'utf8');
      t.expect(r2d.includes("createPattern(art.img('terrazzo'), 'repeat')"), 'render2d.js tiles terrazzo via createPattern(..., "repeat")');
      t.equal(/drawImage\(\s*art\.img\(['"]terrazzo['"]\)/.test(r2d), false, 'render2d.js no longer stretches full-square terrazzo via drawImage');
      t.log(`W3-S4-03 stats: terrazzo=${tz.w}x${tz.h} (${(tz.bytes / 1024).toFixed(1)} KB), art-data=${(artDataBytes / 1024).toFixed(1)} KB, pieces-mesh=${(meshBytes / 1024).toFixed(1)} KB (bell=${bellTris}, towel=${towelTris})`);
    },
  },
  {
    name: 'W3-S4-03 paintBoard() tiles 256x256 terrazzo strictly along the 4 perimeter border strips with zero drawImage interior overpaint',
    viewports: ['desktop'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 41 });
      await t.waitIdle(6000);
      await t.waitFrames(3);

      const audit = await t.page.evaluate(async () => {
        const R = await import(new URL('src/js/render2d.js', location.href).href);
        const { art } = await import(new URL('src/js/art.js', location.href).href);
        // Load terrazzo into this module's art cache if needed
        if (!art.ready('terrazzo')) {
          const im = new Image();
          im.src = 'assets/terrazzo.webp';
          await im.decode();
          art.imgs.terrazzo = im;
        }
        const tzImg = art.img('terrazzo');
        let patternCalls = 0, drawImgCalls = 0;
        const fillRectsWithPat = [];
        const origPat = CanvasRenderingContext2D.prototype.createPattern;
        const origDraw = CanvasRenderingContext2D.prototype.drawImage;
        const origFillRect = CanvasRenderingContext2D.prototype.fillRect;
        let activePat = null;
        CanvasRenderingContext2D.prototype.createPattern = function (img, rep) {
          const p = origPat.call(this, img, rep);
          if (img === tzImg && rep === 'repeat') { patternCalls++; activePat = p; }
          return p;
        };
        CanvasRenderingContext2D.prototype.drawImage = function (img, ...rest) {
          if (img === tzImg) drawImgCalls++;
          return origDraw.call(this, img, ...rest);
        };
        CanvasRenderingContext2D.prototype.fillRect = function (x, y, w, h) {
          if (activePat && this.fillStyle === activePat) fillRectsWithPat.push([x, y, w, h]);
          return origFillRect.call(this, x, y, w, h);
        };
        let cv;
        try {
          cv = R.paintBoard(2048, 'light', false);
        } finally {
          CanvasRenderingContext2D.prototype.createPattern = origPat;
          CanvasRenderingContext2D.prototype.drawImage = origDraw;
          CanvasRenderingContext2D.prototype.fillRect = origFillRect;
        }
        // Check that none of the 4 filled pattern strips cover the center of the 15x15 board (1024, 1024)
        const coversCenter = fillRectsWithPat.some(([x, y, w, h]) => 1024 >= x && 1024 <= x + w && 1024 >= y && 1024 <= y + h);
        // Compute total area filled by terrazzo pattern vs full board area (should be <= 12% border only, never ~98% full-square!)
        const patArea = fillRectsWithPat.reduce((s, [, , w, h]) => s + w * h, 0);
        const areaRatio = patArea / (2048 * 2048);
        // Sample terrazzo texture richness on top border strip (clear of promenade markers: col 2, y midpoint of border)
        const ctx = cv.getContext('2d');
        const cell = 2048 / R.U, f = R.FRAME * cell, o = f * 0.78 * 0.18;
        const midY = Math.round((o + f) / 2);
        const stripData = ctx.getImageData(Math.round(f + 2 * cell), midY - 10, 120, 20).data;
        let sum = 0, sum2 = 0, n = stripData.length / 4;
        for (let i = 0; i < stripData.length; i += 4) {
          const lum = 0.299 * stripData[i] + 0.587 * stripData[i + 1] + 0.114 * stripData[i + 2];
          sum += lum; sum2 += lum * lum;
        }
        const mean = sum / n, std = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
        return {
          tzW: tzImg.naturalWidth, tzH: tzImg.naturalHeight,
          patternCalls, drawImgCalls, stripCount: fillRectsWithPat.length,
          coversCenter, areaRatio: +areaRatio.toFixed(4), borderMeanLum: +mean.toFixed(1), borderStdLum: +std.toFixed(1),
        };
      });

      t.equal(audit.tzW, 256, `loaded terrazzo naturalWidth=256 (got ${audit.tzW})`);
      t.equal(audit.tzH, 256, `loaded terrazzo naturalHeight=256 (got ${audit.tzH})`);
      t.equal(audit.patternCalls, 1, `paintBoard() calls createPattern(terrazzo, 'repeat') once (got ${audit.patternCalls})`);
      t.equal(audit.drawImgCalls, 0, `paintBoard() never stretches terrazzo with drawImage (got ${audit.drawImgCalls})`);
      t.equal(audit.stripCount, 4, `terrazzo fills exactly 4 perimeter border strips (got ${audit.stripCount})`);
      t.equal(audit.coversCenter, false, 'terrazzo strips never overpaint the interior 15x15 marble grid');
      t.expect(audit.areaRatio > 0.05 && audit.areaRatio < 0.12, `terrazzo painted area ratio ${(audit.areaRatio * 100).toFixed(1)}% strictly perimeter-only (< 12% vs old 98%)`);
      t.expect(audit.borderStdLum >= 8, `tiled terrazzo border has crisp stone-chip contrast (stdLum=${audit.borderStdLum})`);
      await t.shot('w2-b15-terrazzo-board', { timeout: 15000 });
    },
  },
  // ---------- W3-S4-01 ----------
  {
    name: 'W3-S4-01 build-three exports InstancedMesh, board3d uses 256px atlas + InstancedMesh with zero onBeforeCompile (CD-WF3-05)',
    node: true,
    async run(t) {
      const buildThree = fs.readFileSync(path.join(root, 'tools', 'build-three.mjs'), 'utf8');
      t.expect(buildThree.includes("'InstancedMesh'"), 'tools/build-three.mjs exports InstancedMesh');
      const { THREE } = await import(new URL('../src/js/three-lib.js', import.meta.url).href);
      t.equal(typeof THREE.InstancedMesh, 'function', 'src/js/three-lib.js exposes THREE.InstancedMesh');
      t.equal(typeof THREE.Matrix4, 'function', 'src/js/three-lib.js exposes THREE.Matrix4');

      const b3Src = fs.readFileSync(path.join(root, 'src', 'js', 'board3d.js'), 'utf8');
      const b3Code = b3Src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
      t.equal(b3Code.includes('onBeforeCompile'), false, 'zero brittle onBeforeCompile shader hacks in code (CD-WF3-05)');
      t.expect(b3Src.includes('new THREE.InstancedMesh'), 'board3d.js batches tilebody via standard THREE.InstancedMesh');
      t.expect(b3Src.includes('ATLAS_CELL = 256'), 'board3d.js keeps crisp 256x256 per glyph (never 128px per CD-WF3-05)');
      t.expect(b3Src.includes('mf.castShadow = false'), 'flat tiletop meshes disable redundant castShadow');
    },
  },
  {
    name: 'W3-S4-01 3D board uses single 2048x1024 256px-per-glyph atlas, InstancedMesh tilebody (<= 3 draw calls), castShadow=false on tiletop, crisp 256px Q10, and clean GPU disposal',
    viewports: ['desktop'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 41, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'julian' }] });
      await t.waitIdle(8000);
      await t.game('act', 'autoplay', 10);
      await t.waitIdle(10000);

      // Add Q (10-pt), assigned blanks, and a staged tile so all 3 instanced body pools + blank atlas slots are exercised
      await t.page.evaluate(() => {
        const G = window.__G;
        const s = G.s;
        const row = 7;
        const word = 'QUARTZ';
        for (let k = 0; k < word.length; k++) s.board[row * 15 + 4 + k] = { l: word[k], blank: k === 3 };
        s.board[(row + 1) * 15 + 4] = { l: 'I', blank: true };
        s.board[(row + 1) * 15 + 5] = { l: 'X', blank: false };
        s.board[(row + 1) * 15 + 6] = { l: 'J', blank: false };
        s.players[0].rack = ['Q', 'A', 'E', 'I', 'O', 'U', '?'];
        G.order = [0, 1, 2, 3, 4, 5, 6];
      });
      await t.game('act', 'reveal');
      await t.game('act', 'stage', [{ i: 15 * 0 + 0, l: 'Q' }, { i: 15 * 0 + 1, l: 'I', blank: true }]);
      await t.game('act', 'freezeFx', 0);
      await t.waitFrames(4);

      // Verify 256x256 paintFace Q10 still separates Q, 1, 0 into 3 disjoint components
      const q256 = await t.page.evaluate(async () => {
        await document.fonts.ready;
        const R = await import(new URL('src/js/render2d.js', location.href).href);
        const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
        R.paintFace(cv.getContext('2d'), 'Q', false, 256, 'light');
        const { data } = cv.getContext('2d').getImageData(0, 0, 256, 256);
        const mask = new Uint8Array(256 * 256);
        for (let i = 0; i < 256 * 256; i++) {
          const o = i * 4;
          if (0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2] < 145) mask[i] = 1;
        }
        const seen = new Uint8Array(256 * 256);
        let comps = 0;
        for (let i = 0; i < 256 * 256; i++) {
          if (!mask[i] || seen[i]) continue;
          const st = [i]; seen[i] = 1; let cnt = 0;
          while (st.length) {
            const p = st.pop(), x = p % 256, y = (p / 256) | 0; cnt++;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || nx >= 256 || ny < 0 || ny >= 256) continue;
              const ni = ny * 256 + nx;
              if (mask[ni] && !seen[ni]) { seen[ni] = 1; st.push(ni); }
            }
          }
          if (cnt >= 10) comps++;
        }
        return { comps };
      });
      t.equal(q256.comps, 3, `256px atlas paintFace('Q') keeps 3 disjoint ink components [Q,1,0] (got ${q256.comps})`);

      const b3 = await t.game('act', 'b3');
      if (!t.gpu || !b3 || !b3.on) {
        t.log('software GL active; skipping live 3D atlas/instancing assertions');
        return;
      }

      t.expect(!!b3.faceAtlas, 'B3.debug() reports shared faceAtlas');
      t.equal(b3.faceAtlas.w, 2048, `faceAtlas width=2048 (got ${b3.faceAtlas.w})`);
      t.equal(b3.faceAtlas.h, 1024, `faceAtlas height=1024 (got ${b3.faceAtlas.h})`);
      t.equal(b3.faceAtlas.cell, 256, `faceAtlas cell=256 (CD-WF3-05, got ${b3.faceAtlas.cell})`);
      t.equal(b3.faceAtlas.textures, 1, `single shared GPU CanvasTexture for all tile faces (got ${b3.faceAtlas.textures})`);
      t.equal(b3.faceAtlas.sharedMaterial, true, 'all visible tiletop meshes share one MeshPhysicalMaterial');
      t.expect(b3.faceAtlas.slots >= 12, `faceAtlas populated multiple regular+blank glyphs (${b3.faceAtlas.slots})`);

      t.equal(b3.bodyInstanced, true, 'tilebody pools use standard THREE.InstancedMesh');
      t.expect(b3.bodyDrawCalls >= 1 && b3.bodyDrawCalls <= 3, `tilebody renders in <= 3 instanced draw calls (got ${b3.bodyDrawCalls})`);
      const instTotal = b3.bodyCounts.board + b3.bodyCounts.last + b3.bodyCounts.staged;
      t.equal(instTotal, b3.tiles, `instanced tilebody count (${instTotal}) matches visible tile count (${b3.tiles})`);
      t.expect(b3.bodyCounts.staged >= 2, `staged instanced pool active (staged=${b3.bodyCounts.staged})`);
      t.equal(b3.tileTopCastShadow, false, 'zero flat tiletop meshes cast redundant shadows');
      t.expect(b3.gpuTextures <= 12, `total renderer GPU textures stayed <= 12 via shared atlas (got ${b3.gpuTextures} vs ~35+ before)`);
      t.log(`W3-S4-01 GPU stats: tiles=${b3.tiles}, bodyDrawCalls=${b3.bodyDrawCalls}, atlas=${b3.faceAtlas.w}x${b3.faceAtlas.h} (${b3.faceAtlas.slots} slots, 1 tex), gpuTextures=${b3.gpuTextures}, renderCalls=${b3.drawCalls}`);

      await t.shot('w2-b15-atlas-3d-midgame', { timeout: 15000 });
      await t.game('act', 'zoom', 2.4, 7.2, 7.6);
      await t.waitFrames(3);
      await t.shot('w2-b15-atlas-3d-zoom', { timeout: 15000 });
      await t.game('act', 'zoom', 1);

      // Live Day -> Night toggle rebuilds atlas cleanly with zero texture leak
      await t.game('scene', 'settings');
      await t.page.click('[data-set="theme"][data-val="dark"]');
      await t.game('scene', 'game');
      await t.waitIdle(6000);
      await t.waitFrames(3);
      const b3Night = await t.game('act', 'b3');
      t.equal(b3Night.dark, true, '3D switched to Night');
      t.equal(b3Night.faceAtlas.textures, 1, 'Night mode keeps single shared atlas texture');
      t.expect(b3Night.gpuTextures <= 12, `Night toggle leaked zero GPU textures (gpuTextures=${b3Night.gpuTextures})`);

      // Verify B3.destroy() disposes atlas + instanced pools cleanly and webglcontextrestored recovers
      await t.page.evaluate(() => document.getElementById('gl').dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
      await t.waitFrames(3);
      const afterLoss = await t.game('act', 'b3');
      t.equal(afterLoss.on, false, 'context loss destroys 3D cleanly');
      t.equal(afterLoss.faceAtlas, null, 'B3.destroy() clears faceAtlas');
      t.equal(afterLoss.bodyInstanced, false, 'B3.destroy() clears InstancedMesh pools');
      await t.page.evaluate(() => document.getElementById('gl').dispatchEvent(new Event('webglcontextrestored')));
      await t.waitFrames(4);
      const afterRestore = await t.game('act', 'b3');
      t.equal(afterRestore.on, true, 'context restore recovers 3D cleanly');
      t.equal(afterRestore.bodyInstanced, true, 'InstancedMesh pools restored after context restore');
      t.equal(afterRestore.faceAtlas.textures, 1, 'shared atlas restored after context restore');
    },
  },
];

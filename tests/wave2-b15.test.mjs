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
];

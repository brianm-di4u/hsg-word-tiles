// Wave 2, batch W2-B13: W3-S2-01 (LIGHTING_PROFILES, Coat Roughness export, Night PMREM envMap swap),
// W3-S2-02 (board 512x512 roughnessMap, mitred along-rail frame UVs, walnut frame diffuse+roughness),
// W3-S2-04 (3D !mode3d gating of baked 2D lamp pool & inner frame drop shadows).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { root } from './lib.mjs';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, theme: 'light' }));
  }
};

function decodePng(buf) {
  let pos = 8, width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    pos += 12 + len;
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
  }
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(height * stride);
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const srcOff = y * (stride + 1) + 1;
    const dstOff = y * stride;
    for (let x = 0; x < stride; x++) {
      const val = raw[srcOff + x];
      const a = x >= bpp ? out[dstOff + x - bpp] : 0;
      const b = y > 0 ? out[dstOff - stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[dstOff - stride + x - bpp] : 0;
      let u = val;
      if (f === 1) u = (val + a) & 255;
      else if (f === 2) u = (val + b) & 255;
      else if (f === 3) u = (val + ((a + b) >> 1)) & 255;
      else if (f === 4) u = (val + paeth(a, b, c)) & 255;
      out[dstOff + x] = u;
    }
  }
  return { width, height, bpp, data: out };
}

function samplePngBox(png, x0, y0, x1, y1) {
  const lx = Math.max(0, Math.floor(x0)), rx = Math.min(png.width, Math.ceil(x1));
  const ty = Math.max(0, Math.floor(y0)), by = Math.min(png.height, Math.ceil(y1));
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = ty; y < by; y++) {
    for (let x = lx; x < rx; x++) {
      const o = (y * png.width + x) * png.bpp;
      r += png.data[o]; g += png.data[o + 1]; b += png.data[o + 2]; n++;
    }
  }
  if (!n) return { r: 0, g: 0, b: 0, lum: 0 };
  r /= n; g /= n; b /= n;
  return { r, g, b, lum: 0.2126 * r + 0.7152 * g + 0.0722 * b };
}

export const tests = [
  // ---------- W3-S2-01 ----------
  {
    name: 'W3-S2-01 pieces.py exports Coat Roughness (kr) for all clearcoated materials into pieces-mesh.js',
    node: true,
    async run(t) {
      const { MESHES } = await import(new URL('../src/js/pieces-mesh.js', import.meta.url).href);
      const coated = [];
      for (const [pieceName, piece] of Object.entries(MESHES)) {
        for (const g of piece.g) {
          if (g.mat && g.mat.k > 0) {
            coated.push(`${pieceName}.${g.mat.name}`);
            t.equal(typeof g.mat.kr, 'number', `${pieceName}.${g.mat.name} exports Coat Roughness kr`);
            t.expect(g.mat.kr > 0 && g.mat.kr <= 0.25, `${pieceName}.${g.mat.name} kr=${g.mat.kr} in (0..0.25]`);
            t.equal(g.mat.kr, 0.08, `${pieceName}.${g.mat.name} preserves Blender Coat Roughness 0.08`);
          }
        }
      }
      t.expect(coated.length >= 4, `at least 4 clearcoated Blender materials export kr (${coated.join(', ')})`);
    },
  },
  {
    name: 'W3-S2-01 unified LIGHTING_PROFILES swaps cool-twilight PMREM envMap on Night toggle, applies exported Coat Roughness, and calibrates nocturnal lighting',
    viewports: ['desktop'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 41, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'julian' }] });
      await t.waitIdle(8000);
      await t.game('act', 'autoplay', 8);
      await t.waitIdle(10000);
      await t.game('act', 'freezeFx', 0);
      await t.waitFrames(3);

      const profiles = await t.page.evaluate(async () => {
        const B3 = await import(new URL('src/js/board3d.js', location.href).href);
        return B3.LIGHTING_PROFILES || null;
      });
      t.expect(!!profiles && !!profiles.day && !!profiles.night, 'board3d.js exports unified LIGHTING_PROFILES.day and LIGHTING_PROFILES.night');
      t.equal(profiles.night.key.color, 0xffe1b0, 'LIGHTING_PROFILES.night key is warm brass-lamp 0xffe1b0');
      t.expect(profiles.night.key.intensity >= 480 && profiles.night.key.intensity <= 520, `LIGHTING_PROFILES.night key intensity in 480..520 (${profiles.night.key.intensity})`);
      t.equal(profiles.night.fill.color, 0x5c72b8, 'LIGHTING_PROFILES.night fill is cool twilight 0x5c72b8');
      t.expect(profiles.night.fill.intensity >= 0.30 && profiles.night.fill.intensity <= 0.40, `LIGHTING_PROFILES.night fill intensity ~0.35 (${profiles.night.fill.intensity})`);
      t.expect(profiles.night.env.sphere !== profiles.day.env.sphere, 'Night PMREM envMap palette differs from Day studio PMREM');

      const dayB3 = await t.game('act', 'b3');
      if (!t.gpu || !dayB3 || !dayB3.on) {
        t.log('skipping 3D GPU PMREM checks without GPU');
        return;
      }
      t.equal(dayB3.lightingProfile, 'day', 'Day mode activates LIGHTING_PROFILES.day');
      t.equal(dayB3.envTheme, 'day', 'Day mode builds warm studio PMREM envMap');
      t.equal(dayB3.envSwaps, 1, 'initial Day boot builds PMREM exactly once');
      t.equal(dayB3.envTempDisposed, 5, 'envMap disposes all 5 temporary scene meshes');
      t.equal(dayB3.tileCoatRoughness, 0.08, `tile body consumes exported Blender Coat Roughness 0.08 (got ${dayB3.tileCoatRoughness})`);

      // Toggle live Day -> Night and confirm cool-twilight PMREM envMap swaps cleanly
      await t.game('scene', 'settings');
      await t.page.click('[data-set="theme"][data-val="dark"]');
      await t.game('scene', 'game');
      await t.waitIdle(6000);
      await t.waitFrames(3);

      const nightB3 = await t.game('act', 'b3');
      t.equal(nightB3.lightingProfile, 'night', 'Night mode activates LIGHTING_PROFILES.night');
      t.equal(nightB3.envTheme, 'night', 'setTheme(dark) swaps scene.environment to cool-twilight PMREM');
      t.equal(nightB3.envSwaps, 2, `PMREM envMap swapped cleanly on Day -> Night (swaps=${nightB3.envSwaps})`);
      t.equal(nightB3.envTempDisposed, 5, 'Night envMap disposes all 5 temporary meshes');
      t.equal(nightB3.keyColor, 'ffe1b0', 'Night key uses warm brass-lamp 0xffe1b0');
      t.expect(nightB3.keyIntensity >= 480 && nightB3.keyIntensity <= 520, `Night key intensity ${nightB3.keyIntensity} in 480..520`);
      t.equal(nightB3.fillColor, '5c72b8', 'Night fill uses cool twilight 0x5c72b8');
      t.expect(Math.abs(nightB3.fillIntensity - 0.35) < 0.01, `Night fill intensity is 0.35 (got ${nightB3.fillIntensity})`);
      t.equal(nightB3.towelColor, '524b61', 'Night towels use darkened twilight linen #524b61');

      // Verify rendered Night board luminance stays calm twilight marble beneath warm-ivory tiles
      const shotBuf = await t.page.locator('#boardwrap').screenshot();
      const png = decodePng(shotBuf);
      const pts = await t.page.evaluate(async () => {
        const st = window.__game.getState();
        const bw = document.getElementById('boardwrap').getBoundingClientRect();
        const { SQUARE: SQ } = await import(new URL('src/js/score.js', location.href).href);
        const empties = [], tiles = [];
        for (let i = 0; i < 225; i++) {
          const r = Math.floor(i / 15), c = i % 15;
          if (r < 2 || r > 12 || c < 2 || c > 12) continue;
          if (SQ[i] === '.' && !st.game.board[i] && empties.length < 8) empties.push(await window.__game.act('cell', i));
          else if (st.game.board[i] && !st.game.board[i].blank && tiles.length < 6) tiles.push(await window.__game.act('cell', i));
        }
        const [c0] = await window.__game.act('cell', 112);
        const [c1] = await window.__game.act('cell', 113);
        return { w: bw.width, h: bw.height, cell: Math.abs(c1 - c0), empties, tiles };
      });
      const sx = png.width / pts.w, sy = png.height / pts.h;
      let mSum = 0, tSum = 0;
      for (const [cx, cy] of pts.empties) {
        mSum += samplePngBox(png, (cx - pts.cell * 0.22) * sx, (cy - pts.cell * 0.22) * sy, (cx + pts.cell * 0.22) * sx, (cy + pts.cell * 0.22) * sy).lum;
      }
      for (const [cx, cy] of pts.tiles) {
        tSum += samplePngBox(png, (cx - pts.cell * 0.32) * sx, (cy - pts.cell * 0.32) * sy, (cx - pts.cell * 0.14) * sx, (cy - pts.cell * 0.14) * sy).lum;
      }
      const nightMarble = mSum / pts.empties.length, nightTile = tSum / pts.tiles.length;
      t.log(`W3-S2-01 Night 3D (cool-twilight PMREM): marbleLum=${nightMarble.toFixed(1)}, tileLum=${nightTile.toFixed(1)}, delta=${(nightTile - nightMarble).toFixed(1)}`);
      t.expect(nightMarble >= 42 && nightMarble <= 118, `Night marble stays calm twilight slate-limestone (${nightMarble.toFixed(1)})`);
      t.expect(nightTile >= 165, `Night warm-ivory tiles stay readable (${nightTile.toFixed(1)})`);
      t.expect(nightTile - nightMarble >= 75, `Night tile-to-marble separation >= 75 (${(nightTile - nightMarble).toFixed(1)})`);
      await t.shot('w2-b13-night-pmrem-3d', { timeout: 15000 });

      // Toggle back Night -> Day and confirm PMREM swaps back to warm studio
      await t.game('scene', 'settings');
      await t.page.click('[data-set="theme"][data-val="light"]');
      await t.game('scene', 'game');
      await t.waitIdle(6000);
      await t.waitFrames(3);
      const backDay = await t.game('act', 'b3');
      t.equal(backDay.envTheme, 'day', 'setTheme(light) swaps PMREM back to day studio');
      t.equal(backDay.envSwaps, 3, `PMREM envMap swapped back cleanly (swaps=${backDay.envSwaps})`);
    },
  },
  // ---------- W3-S2-02 ----------
  {
    name: 'W3-S2-02 pieces.py exports mitred along-rail UVs on frame (zero vertical-wall collapse, east/west rails run along grain)',
    node: true,
    async run(t) {
      const { MESHES } = await import(new URL('../src/js/pieces-mesh.js', import.meta.url).href);
      const frame = MESHES.frame;
      t.expect(!!frame && Array.isArray(frame.g) && frame.g.length >= 2, 'MESHES.frame present with walnut and brass groups');
      const b64 = (s, T) => { const b = Buffer.from(s, 'base64'); return new T(b.buffer, b.byteOffset, b.byteLength / T.BYTES_PER_ELEMENT); };
      const walnut = frame.g.find((g) => g.mat && g.mat.name === 'walnut');
      t.expect(!!walnut && typeof walnut.u === 'string' && walnut.u.length > 0, 'frame walnut group exports quantized along-rail UVs (u)');
      const q = b64(walnut.p, Int16Array), n = b64(walnut.n, Int8Array), uq = b64(walnut.u, Uint16Array), idx = b64(walnut.i, Uint16Array);
      t.equal(uq.length, (q.length / 3) * 2, 'UV buffer length matches 2 floats per vertex');
      let ewAlongOk = 0, nsAlongOk = 0, vertWallNonZeroV = 0, vertWallTotal = 0;
      const posAt = (vi) => [
        frame.lo[0] + (q[vi * 3] + 32768) / 65535 * (frame.hi[0] - frame.lo[0]),
        frame.lo[1] + (q[vi * 3 + 1] + 32768) / 65535 * (frame.hi[1] - frame.lo[1]),
        frame.lo[2] + (q[vi * 3 + 2] + 32768) / 65535 * (frame.hi[2] - frame.lo[2]),
      ];
      for (let k = 0; k < idx.length; k += 3) {
        const tri = [idx[k], idx[k + 1], idx[k + 2]];
        const ps = tri.map(posAt);
        const us = tri.map((v) => uq[v * 2] / 65535);
        const vs = tri.map((v) => uq[v * 2 + 1] / 65535);
        const nx = (n[tri[0] * 3] + n[tri[1] * 3] + n[tri[2] * 3]) / (3 * 127);
        const ny = (n[tri[0] * 3 + 1] + n[tri[1] * 3 + 1] + n[tri[2] * 3 + 1]) / (3 * 127);
        const nz = (n[tri[0] * 3 + 2] + n[tri[1] * 3 + 2] + n[tri[2] * 3 + 2]) / (3 * 127);
        const du = Math.max(...us) - Math.min(...us);
        const dv = Math.max(...vs) - Math.min(...vs);
        const dx = Math.max(...ps.map((p) => p[0])) - Math.min(...ps.map((p) => p[0]));
        const dy = Math.max(...ps.map((p) => p[1])) - Math.min(...ps.map((p) => p[1]));
        if (Math.abs(nz) < 0.2) {
          vertWallTotal++;
          if (dv > 0.01 && du > 0.05) vertWallNonZeroV++;
        }
        if (Math.abs(nx) > 0.5 && dy > 2 && du > 0.5) ewAlongOk++;
        if (Math.abs(ny) > 0.5 && dx > 2 && du > 0.5) nsAlongOk++;
      }
      t.expect(vertWallTotal >= 8 && vertWallNonZeroV === vertWallTotal, `all ${vertWallTotal} vertical frame wall triangles have non-collapsed UV spans (ok=${vertWallNonZeroV})`);
      t.expect(ewAlongOk >= 4, `east/west frame rails run U along Y length (ewAlongOk=${ewAlongOk})`);
      t.expect(nsAlongOk >= 4, `north/south frame rails run U along X length (nsAlongOk=${nsAlongOk})`);
    },
  },
  {
    name: 'W3-S2-02 board 512x512 roughnessMap (grout 0.85, travertine 0.62, glass/brass 0.22) binds to B3.top (roughness=1) and walnut diffuse+roughness textures bind to B3.frame',
    viewports: ['desktop'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 41, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'julian' }] });
      await t.waitIdle(8000);
      await t.game('act', 'autoplay', 8);
      await t.waitIdle(10000);
      await t.game('act', 'freezeFx', 0);
      await t.waitFrames(3);

      // 1) Inspect procedural 512x512 board roughnessMap values directly
      const roughAudit = await t.page.evaluate(async () => {
        const R = await import(new URL('src/js/render2d.js', location.href).href);
        const { SQUARE, N, CENTER } = await import(new URL('src/js/score.js', location.href).href);
        const cv = R.boardRoughnessTexture();
        const ctx = cv.getContext('2d');
        const cell = cv.width / R.U, f = R.FRAME * cell;
        const sampleAt = (x, y) => ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data[1] / 255;
        // Sample grout line right on boundary between row 3 and row 4
        const grout = sampleAt(f + 2.5 * cell, f + 4 * cell);
        // Sample neutral travertine cell
        const neutralIdx = SQUARE.findIndex((k, i) => k === '.' && i > 30 && i < 120);
        const nr = Math.floor(neutralIdx / N), nc = neutralIdx % N;
        const travertine = sampleAt(f + (nc + 0.5) * cell, f + (nr + 0.5) * cell);
        // Sample glossy stained-glass square
        const glassIdx = SQUARE.findIndex((k) => k === 'h');
        const gr = Math.floor(glassIdx / N), gc = glassIdx % N;
        const glass = sampleAt(f + (gc + 0.5) * cell, f + (gr + 0.5) * cell);
        // Sample Display Spring center pool
        const cr = Math.floor(CENTER / N), cc = CENTER % N;
        const centerPool = sampleAt(f + (cc + 0.5) * cell, f + (cr + 0.5) * cell);
        // Sample brass inner rail
        const brassRail = sampleAt(f - cell * 0.06, cv.height * 0.5);
        return { w: cv.width, h: cv.height, grout, travertine, glass, centerPool, brassRail };
      });
      t.equal(roughAudit.w, 512, 'board roughnessMap is 512 px wide');
      t.equal(roughAudit.h, 512, 'board roughnessMap is 512 px tall');
      t.expect(roughAudit.grout >= 0.80 && roughAudit.grout <= 0.90, `matte grout roughness ~0.85 (got ${roughAudit.grout.toFixed(2)})`);
      t.expect(roughAudit.travertine >= 0.56 && roughAudit.travertine <= 0.68, `honed travertine roughness ~0.62 (got ${roughAudit.travertine.toFixed(2)})`);
      t.expect(roughAudit.glass >= 0.18 && roughAudit.glass <= 0.28, `glossy stained-glass roughness ~0.22 (got ${roughAudit.glass.toFixed(2)})`);
      t.expect(roughAudit.centerPool >= 0.18 && roughAudit.centerPool <= 0.28, `glossy Display Spring roughness ~0.22 (got ${roughAudit.centerPool.toFixed(2)})`);
      t.expect(roughAudit.brassRail >= 0.18 && roughAudit.brassRail <= 0.28, `glossy brass rail roughness ~0.22 (got ${roughAudit.brassRail.toFixed(2)})`);

      // 2) Verify 3D B3.top and B3.frame material bindings on GPU
      const b3 = await t.game('act', 'b3');
      if (!t.gpu || !b3 || !b3.on) return;
      t.equal(b3.topMat, 'MeshStandardMaterial', 'B3.top uses MeshStandardMaterial');
      t.equal(b3.topRoughness, 1, `B3.top roughness=1.0 so roughnessMap drives exact values (got ${b3.topRoughness})`);
      t.equal(b3.topRoughnessMap, true, 'B3.top binds 512x512 procedural roughnessMap');
      t.equal(b3.frameWalnutMap, true, 'B3.frame walnut binds diffuse woodgrain texture');
      t.equal(b3.frameWalnutRoughnessMap, true, 'B3.frame walnut binds wood-pore roughnessMap');
      t.equal(b3.frameWalnutFromCounter, true, 'B3.frame walnut diffuse refreshes from counter.webp inside setTheme()');
      await t.shot('w2-b13-day-materials-3d', { timeout: 15000 });
    },
  },
  // ---------- W3-S2-04 ----------
  {
    name: 'W3-S2-04 paintBoard() gates baked radial lamp pool and 0.35-cell inner frame shadows strictly on !mode3d while 3D uses real-time lighting + depth-tested dimming',
    viewports: ['desktop'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 41, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'julian' }] });
      await t.waitIdle(8000);
      await t.game('act', 'autoplay', 8);
      await t.waitIdle(10000);
      await t.game('act', 'freezeFx', 0);
      await t.waitFrames(3);

      const bakeAudit = await t.page.evaluate(async () => {
        const R = await import(new URL('src/js/render2d.js', location.href).href);
        const lumOf = (cv, x, y, w, h) => {
          const d = cv.getContext('2d').getImageData(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))).data;
          let r = 0, g = 0, b = 0, n = 0;
          for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
          r /= n; g /= n; b /= n;
          return { r, g, b, lum: 0.2126 * r + 0.7152 * g + 0.0722 * b };
        };
        const S = 512, cell = S / R.U, f = R.FRAME * cell;
        const day2d = R.paintBoard(S, 'light', false);
        const day3d = R.paintBoard(S, 'light', true);
        const night2d = R.paintBoard(S, 'dark', false);
        const night3d = R.paintBoard(S, 'dark', true);
        // Sample neutral top-edge square (row 0, col 1 — empty neutral '.') right next to inner frame (0.08..0.22 cells inside f)
        const edge2d = lumOf(day2d, f + 1.2 * cell, f + 0.08 * cell, 0.6 * cell, 0.14 * cell);
        const edge3d = lumOf(day3d, f + 1.2 * cell, f + 0.08 * cell, 0.6 * cell, 0.14 * cell);
        // Sample interior of the same neutral top-row cell (0.45..0.75 cells inside f, clear of the 0.35-cell frame shadow)
        const mid2d = lumOf(day2d, f + 1.2 * cell, f + 0.48 * cell, 0.6 * cell, 0.25 * cell);
        const mid3d = lumOf(day3d, f + 1.2 * cell, f + 0.48 * cell, 0.6 * cell, 0.25 * cell);
        // Sample Night board near baked warm lamp pool center (row 5, col 6 — neutral '.')
        const pool2d = lumOf(night2d, f + 6.2 * cell, f + 5.2 * cell, 0.6 * cell, 0.6 * cell);
        const pool3d = lumOf(night3d, f + 6.2 * cell, f + 5.2 * cell, 0.6 * cell, 0.6 * cell);
        // Verify boardTexture cache separates mode3d=true vs mode3d=false cleanly
        const tex2d = R.boardTexture('light', false);
        const tex3d = R.boardTexture('light', true);
        return { edge2d, edge3d, mid2d, mid3d, pool2d, pool3d, distinctCache: tex2d !== tex3d };
      });

      t.equal(bakeAudit.distinctCache, true, 'boardTexture(theme, mode3d) caches 2D and 3D textures separately');
      const dayEdgeDrop2d = bakeAudit.mid2d.lum - bakeAudit.edge2d.lum;
      const dayEdgeDrop3d = bakeAudit.mid3d.lum - bakeAudit.edge3d.lum;
      t.log(`W3-S2-04 Day outer-edge drop: 2D=${dayEdgeDrop2d.toFixed(1)} lum (baked shadow), 3D=${dayEdgeDrop3d.toFixed(1)} lum (clean for real PCF shadows)`);
      t.expect(dayEdgeDrop2d >= 18, `2D fallback retains baked 0.35-cell inner frame shadow (drop=${dayEdgeDrop2d.toFixed(1)} >= 18)`);
      t.expect(Math.abs(dayEdgeDrop3d) < 8, `3D boardTexture omits baked inner frame shadow (drop=${dayEdgeDrop3d.toFixed(1)}, |drop| < 8)`);
      t.expect(bakeAudit.edge3d.lum - bakeAudit.edge2d.lum >= 18, `3D outer ring avoids baked shadow darkening (${bakeAudit.edge3d.lum.toFixed(1)} vs 2D ${bakeAudit.edge2d.lum.toFixed(1)})`);
      t.log(`W3-S2-04 Night center pool red: 2D=${bakeAudit.pool2d.r.toFixed(1)}, 3D=${bakeAudit.pool3d.r.toFixed(1)}`);
      t.expect(bakeAudit.pool2d.r - bakeAudit.pool3d.r >= 5, `3D Night boardTexture omits baked warm yellow lamp pool (2D r=${bakeAudit.pool2d.r.toFixed(1)} vs 3D r=${bakeAudit.pool3d.r.toFixed(1)})`);

      const b3 = await t.game('act', 'b3');
      if (!t.gpu || !b3 || !b3.on) return;
      t.equal(b3.boardMode3d, true, 'B3.render() requests R.boardTexture(theme, true)');
      await t.shot('w2-b13-day-3d-clean-shadows', { timeout: 15000 });
    },
  },
];

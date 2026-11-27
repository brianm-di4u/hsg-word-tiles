// Wave 4, batch W4-B32: W3-S3-02 (subtle ceramic kiln-edge warmth in paintFace() and gentle brushed-brass
// crevice darkening on B3.frame's brass bead and B3.bell, preserving CD-WF2-06 peripheral rest, CD-WF3-04/05
// budgets, gpuTextures <= 12, and #rackbar's walnut-and-brass styling).
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, theme: 'light' }));
  }
};

export const tests = [
  {
    name: 'W3-S3-02 paintFace() adds subtle kiln-edge ceramic warmth on Day and Night ivory tiles without tinting blank sea-glass tiles or hurting Q10 ink separation',
    viewports: ['desktop'],
    url: 'index.html?gl=0',
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 41, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'julian' }] });
      await t.waitIdle(6000);

      const audit = await t.page.evaluate(async () => {
        await document.fonts.ready;
        const R = await import(new URL('src/js/render2d.js', location.href).href);
        const sample = (ctx, x, y, s) => {
          const d = ctx.getImageData(Math.round(x), Math.round(y), s, s).data;
          let r = 0, g = 0, b = 0, n = d.length / 4;
          for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
          r /= n; g /= n; b /= n;
          return { r: +r.toFixed(1), g: +g.toFixed(1), b: +b.toFixed(1), lum: +(0.2126 * r + 0.7152 * g + 0.0722 * b).toFixed(1), rb: +(r - b).toFixed(1) };
        };
        const inspectFace = (blank, theme) => {
          const w = 256, cv = document.createElement('canvas'); cv.width = cv.height = w;
          const ctx = cv.getContext('2d');
          R.paintFace(ctx, '', blank, w, theme);
          const center = sample(ctx, w * 0.46, w * 0.46, 20);
          const edges = [
            sample(ctx, 2, w * 0.46, 10),
            sample(ctx, w - 12, w * 0.46, 10),
            sample(ctx, w * 0.46, 2, 10),
            sample(ctx, w * 0.46, w - 12, 10),
          ];
          const corners = [
            sample(ctx, 2, 2, 10),
            sample(ctx, w - 12, 2, 10),
            sample(ctx, 2, w - 12, 10),
            sample(ctx, w - 12, w - 12, 10),
          ];
          const avg = (arr, k) => +(arr.reduce((a, o) => a + o[k], 0) / arr.length).toFixed(1);
          return {
            center,
            edgeLum: avg(edges, 'lum'),
            edgeRb: avg(edges, 'rb'),
            cornerLum: avg(corners, 'lum'),
            cornerRb: avg(corners, 'rb'),
          };
        };
        // Also confirm #rackbar retains walnut-and-brass styling
        const rackCs = getComputedStyle(document.getElementById('rackbar'));
        return {
          dayIvory: inspectFace(false, 'light'),
          nightIvory: inspectFace(false, 'dark'),
          dayBlank: inspectFace(true, 'light'),
          rackBorder: rackCs.borderTopColor,
          rackBg: rackCs.backgroundImage,
        };
      });

      for (const [label, res, minCornerLum] of [['Day', audit.dayIvory, 175], ['Night', audit.nightIvory, 158]]) {
        const edgeDrop = res.center.lum - res.edgeLum;
        const cornerDrop = res.center.lum - res.cornerLum;
        const cornerWarmth = res.cornerRb - res.center.rb;
        t.log(`W3-S3-02 ${label} paintFace: centerLum=${res.center.lum} (R-B=${res.center.rb}), edgeLum=${res.edgeLum} (R-B=${res.edgeRb}), cornerLum=${res.cornerLum} (R-B=${res.cornerRb})`);
        t.expect(edgeDrop >= 8 && edgeDrop <= 40, `${label} kiln rim gently shades edge below bright ivory center (drop=${edgeDrop.toFixed(1)}, target 8..40)`);
        t.expect(cornerDrop >= 18 && cornerDrop <= 65, `${label} kiln corners softly pool warmer glaze below center (drop=${cornerDrop.toFixed(1)}, target 18..65)`);
        t.expect(cornerWarmth >= 12, `${label} kiln corners warm chroma (R-B delta=+${cornerWarmth.toFixed(1)} >= 12)`);
        t.expect(res.cornerLum >= minCornerLum, `${label} kiln corner luminance stays bright above ink threshold (${res.cornerLum} >= ${minCornerLum})`);
      }
      // Blank Steam tile stays cool frosted sea-glass (zero warm ochre kiln rim)
      t.expect(audit.dayBlank.cornerRb <= 5, `blank Steam tile retains cool sea-glass edge (R-B=${audit.dayBlank.cornerRb} <= 5)`);
      t.expect(/counter\.webp|gradient/i.test(audit.rackBg), `#rackbar keeps existing walnut woodgrain styling (${audit.rackBg.slice(0, 60)})`);
    },
  },
  {
    name: 'W3-S3-02 3D B3.frame brass bead and B3.bell apply shared brushed-brass patina + crevice vertex darkening within gpuTextures <= 12 and clean disposal',
    viewports: ['desktop'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 41, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'julian' }] });
      await t.waitIdle(8000);
      const s = await t.state();
      const word = 'QUARTZ';
      for (let k = 0; k < word.length; k++) s.game.board[7 * 15 + 4 + k] = { l: word[k], blank: k === 3, p: 1, t: 0 };
      s.game.board[8 * 15 + 4] = { l: 'I', blank: false, p: 0, t: 1 };
      s.game.board[8 * 15 + 5] = { l: 'N', blank: false, p: 0, t: 1 };
      s.game.move = 4; s.game.cur = 0;
      await t.game('setState', { game: s.game });
      await t.waitIdle(6000);
      await t.game('act', 'freezeFx', 0);
      await t.waitFrames(4);

      const dayB3 = await t.game('act', 'b3');
      if (!t.gpu || !dayB3 || !dayB3.on) {
        t.log('software GL active; skipping live 3D brass patina GPU assertions');
        return;
      }

      const bp = dayB3.brassPatina;
      t.expect(!!bp, 'B3.debug() reports brassPatina telemetry');
      t.equal(bp.sharedTex, true, 'B3.frame brass bead and B3.bell share one brushed-brass CanvasTexture');
      t.equal(bp.frameVertexColors, true, 'B3.frame brass bead enables vertex-color crevice darkening');
      t.equal(bp.bellVertexColors, true, 'B3.bell brass dome/knob enables vertex-color crevice darkening');
      t.equal(bp.bronzeVertexColors, true, 'B3.bell bronze plinth enables vertex-color crevice shading');
      t.expect(bp.crownLum - bp.seamLum >= 45, `brushed-brass texture darkens crevices vs burnished crown (seam=${bp.seamLum}, crown=${bp.crownLum})`);
      t.expect(bp.brushedStd >= 1.5, `brushed-brass texture shows fine metallic grain variation (std=${bp.brushedStd} >= 1.5)`);
      t.expect(bp.frameCrevice && bp.frameCrevice.min <= 0.75 && bp.frameCrevice.max >= 0.98, `frame brass crevice AO spans seam-to-crown (${JSON.stringify(bp.frameCrevice)})`);
      t.expect(bp.bellCrevice && bp.bellCrevice.min <= 0.72 && bp.bellCrevice.max >= 0.98, `bell brass crevice AO spans plinth/collar-to-touchpoint (${JSON.stringify(bp.bellCrevice)})`);
      t.expect(bp.bronzeCrevice && bp.bronzeCrevice.min <= 0.80 && bp.bronzeCrevice.max >= 0.95, `bell bronze plinth spans floor/lip crevice shading (${JSON.stringify(bp.bronzeCrevice)})`);

      // Preserve all upstream budgets & closed doors (W3-S4-01, CD-WF2-06, CD-WF3-02/04/05, CD-WF6-01)
      t.expect(dayB3.gpuTextures <= 12, `Day 3D stays within gpuTextures <= 12 budget (got ${dayB3.gpuTextures})`);
      t.equal(dayB3.bellMats.slice().sort().join(), 'brass:MeshStandardMaterial,bronze:MeshStandardMaterial', 'bell stays MeshStandardMaterial (CD-WF3-02/CD-WF6-01)');
      const boardH = (dayB3.bezel.maxY - dayB3.bezel.minY) / dayB3.bezel.H;
      t.expect(boardH >= 0.90, `desktop 3D keeps >=90% board priority (CD-WF2-06, ${(boardH * 100).toFixed(1)}%)`);
      t.expect(dayB3.props.bell.visible && dayB3.props.bell.tris <= 400, `bell visible & <= 400 tris (${dayB3.props.bell.tris})`);
      t.log(`W3-S3-02 Day 3D: gpuTextures=${dayB3.gpuTextures}, seamLum=${bp.seamLum}, crownLum=${bp.crownLum}, brushedStd=${bp.brushedStd}, frameAO=${bp.frameCrevice.min}..${bp.frameCrevice.max}, bellAO=${bp.bellCrevice.min}..${bp.bellCrevice.max}`);

      await t.shot('w4-b32-day-3d', { timeout: 15000 });
      await t.game('act', 'zoom', 2.2, 7.6, 7.6);
      await t.waitFrames(3);
      await t.shot('w4-b32-day-tiles-zoom', { timeout: 15000 });
      await t.game('act', 'zoom', 1);

      // Night theme stays within gpuTextures <= 12 and retains brass patina
      await t.game('scene', 'settings');
      await t.page.click('[data-set="theme"][data-val="dark"]');
      await t.game('scene', 'game');
      await t.waitIdle(6000);
      await t.waitFrames(3);
      const nightB3 = await t.game('act', 'b3');
      t.equal(nightB3.dark, true, 'Night 3D active');
      t.expect(nightB3.gpuTextures <= 12, `Night 3D stays within gpuTextures <= 12 budget (got ${nightB3.gpuTextures})`);
      t.equal(nightB3.brassPatina.sharedTex, true, 'Night 3D retains shared brushed-brass patina');
      await t.shot('w4-b32-night-3d', { timeout: 15000 });

      // Turning 3D off disposes brassPatinaTex with 0 GPU leaks
      await t.game('scene', 'settings');
      await t.page.click('[data-set="board3d"][data-val="off"]');
      await t.game('scene', 'game');
      await t.waitFrames(3);
      const off = await t.game('act', 'b3');
      t.equal(off.on, false, '3D turned off cleanly');
      t.equal(off.brassPatina, null, 'B3.destroy() clears brass patina references');
      t.equal(off.disposed.left.geometries, 0, '0 geometries leaked on GPU');
      t.equal(off.disposed.left.textures, 0, '0 textures leaked on GPU');
    },
  },
];

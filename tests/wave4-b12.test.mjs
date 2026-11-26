// Wave 4, batch W4-B12 (WF-3 tech_art_pipeline): W3-S1-15, W3-S3-14, W3-S5-05, W3-S5-04.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { root } from './lib.mjs';
import { rawDir } from '../tools/raw-dir.mjs';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, theme: 'light' }));
  }
};

export const tests = [
  // ---------- W3-S1-15 ----------
  {
    name: 'W3-S1-15 shared declarative LOOK config is unified across render2d.js and board3d.js and inspectable via b3',
    viewports: ['desktop'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 41, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'julian' }] });
      await t.waitIdle(8000);
      await t.waitFrames(3);

      // 1) Both modules share the exact same LOOK object reference (single source of truth)
      const modAudit = await t.page.evaluate(async () => {
        const R = await import(new URL('src/js/render2d.js', location.href).href);
        const B3 = await import(new URL('src/js/board3d.js', location.href).href);
        // Verify render2d paintBoard reads marble tint directly from LOOK (mutating and restoring)
        const origTint = R.LOOK.day.marble.boardTint;
        const cvBefore = R.paintBoard(128, 'light', true);
        const beforePx = [...cvBefore.getContext('2d').getImageData(64, 64, 1, 1).data];
        R.LOOK.day.marble.boardTint = 'rgba(0,0,255,0.5)';
        let afterPx;
        try {
          const cvAfter = R.paintBoard(128, 'light', true);
          afterPx = [...cvAfter.getContext('2d').getImageData(64, 64, 1, 1).data];
        } finally {
          R.LOOK.day.marble.boardTint = origTint;
        }
        return {
          sameRef: !!R.LOOK && R.LOOK === B3.LOOK && B3.LIGHTING_PROFILES === R.LOOK,
          hasDayNight: !!(R.LOOK && R.LOOK.day && R.LOOK.night),
          dayKeys: R.LOOK ? Object.keys(R.LOOK.day).sort() : [],
          nightKeys: R.LOOK ? Object.keys(R.LOOK.night).sort() : [],
          dayClearcoat: R.LOOK?.day?.tile?.clearcoat,
          dayClearcoatRough: R.LOOK?.day?.tile?.clearcoatRoughness,
          dayMarbleBase: R.LOOK?.day?.marble?.base,
          nightMarbleTint: R.LOOK?.night?.marble?.boardTint,
          dayTowelCloth: R.LOOK?.day?.towel?.cloth,
          nightTowelCloth: R.LOOK?.night?.towel?.cloth,
          tintResponds: afterPx[2] > beforePx[2] + 20,
        };
      });

      t.equal(modAudit.sameRef, true, 'render2d.js LOOK, board3d.js LOOK, and LIGHTING_PROFILES are the exact same object');
      t.equal(modAudit.hasDayNight, true, 'LOOK declares both day and night presets');
      for (const sec of ['env', 'envIntensity', 'fill', 'hemi', 'key', 'marble', 'preDimColor', 'table', 'tile', 'top', 'towel']) {
        t.expect(modAudit.dayKeys.includes(sec), `LOOK.day includes ${sec}`);
        t.expect(modAudit.nightKeys.includes(sec), `LOOK.night includes ${sec}`);
      }
      t.equal(modAudit.dayClearcoat, 0.25, 'LOOK.day.tile exposes clearcoat');
      t.equal(modAudit.dayClearcoatRough, 0.4, 'LOOK.day.tile exposes clearcoatRoughness');
      t.equal(JSON.stringify(modAudit.dayMarbleBase), JSON.stringify(['#D0C5AF', '#C8BCA5']), 'LOOK.day.marble holds calm travertine base');
      t.equal(modAudit.nightMarbleTint, 'rgba(20,18,31,0.22)', 'LOOK.night.marble holds twilight boardTint');
      t.equal(modAudit.dayTowelCloth, 0xb5a892, 'LOOK.day.towel holds Day taupe cloth albedo');
      t.equal(modAudit.nightTowelCloth, 0x524b61, 'LOOK.night.towel holds Night twilight cloth albedo');
      t.equal(modAudit.tintResponds, true, 'paintBoard() reads LOOK.day.marble.boardTint dynamically');

      // 2) Inspectable via window.__game.act('b3') in both Day and Night
      const dayB3 = await t.game('act', 'b3');
      t.expect(!!dayB3 && !!dayB3.look, 'window.__game.act("b3") exposes declarative look config');
      t.equal(dayB3.look.active, 'day', 'b3.look.active is "day" in Day theme');
      t.equal(dayB3.look.key.intensity, 600, 'b3.look.key.intensity matches Day spotlight');
      t.equal(dayB3.look.fill.color, 0xcfe0ff, 'b3.look.fill.color matches Day fill');
      t.equal(dayB3.look.tile.emissiveIntensity, 0.14, 'b3.look.tile.emissiveIntensity matches Day tile');
      t.equal(dayB3.look.tile.clearcoat, 0.25, 'b3.look.tile.clearcoat exposed via b3');
      t.equal(dayB3.look.towel.cloth, 0xb5a892, 'b3.look.towel.cloth exposed via b3');
      t.equal(dayB3.look.marble.grout, '#7A6340', 'b3.look.marble.grout exposed via b3');

      await t.game('scene', 'settings');
      await t.page.click('[data-set="theme"][data-val="dark"]');
      await t.game('scene', 'game');
      await t.waitIdle(6000);
      await t.waitFrames(2);

      const nightB3 = await t.game('act', 'b3');
      t.equal(nightB3.look.active, 'night', 'b3.look.active switches to "night" in Night theme');
      t.equal(nightB3.look.key.color, 0xffe1b0, 'b3.look.key.color matches Night brass lamp');
      t.equal(nightB3.look.fill.color, 0x5c72b8, 'b3.look.fill.color matches Night twilight fill');
      t.equal(nightB3.look.tile.emissiveIntensity, 0.11, 'b3.look.tile.emissiveIntensity matches Night tile');
      t.equal(nightB3.look.towel.cloth, 0x524b61, 'b3.look.towel.cloth matches Night towel');
      t.equal(nightB3.look.marble.boardTint, 'rgba(20,18,31,0.22)', 'b3.look.marble.boardTint matches Night marble tint');
    },
  },
  // ---------- W3-S3-14 ----------
  {
    name: 'W3-S3-14 raw-dir.mjs gates external reference lookup on explicit HSG_WORKSPACE opt-in; layout comments state flat +20 and style guide keeps 46 WebPs (Node)',
    node: true,
    run(t) {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hsg-rawdir-'));
      try {
        const fakeWs = path.join(tmp, 'ws');
        const fakeRepo = path.join(fakeWs, 'repos', 'hsg-word-tiles');
        fs.mkdirSync(path.join(fakeWs, 'reference', 'word-lists'), { recursive: true });
        fs.mkdirSync(fakeRepo, { recursive: true });

        // Without HSG_WORKSPACE, rawDir stays strictly repo-local even when ../../reference exists
        t.equal(rawDir(fakeRepo, {}), path.join(fakeRepo, 'data/raw'), 'unset HSG_WORKSPACE defaults strictly to repo-local data/raw');
        t.equal(rawDir(fakeRepo, { HSG_WORKSPACE: '  ' }), path.join(fakeRepo, 'data/raw'), 'blank HSG_WORKSPACE defaults to repo-local data/raw');
        // Explicit HSG_WORKSPACE opt-in resolves <HSG_WORKSPACE>/reference/word-lists when reference/ exists
        t.equal(rawDir(fakeRepo, { HSG_WORKSPACE: fakeWs }), path.join(fakeWs, 'reference', 'word-lists'), 'explicit HSG_WORKSPACE opts into shared reference/word-lists');
        // Explicit HSG_WORKSPACE without reference/ falls back cleanly to repo-local data/raw
        t.equal(rawDir(fakeRepo, { HSG_WORKSPACE: path.join(tmp, 'missing') }), path.join(fakeRepo, 'data/raw'), 'absent HSG_WORKSPACE/reference falls back cleanly to repo-local data/raw');
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }

      const rawSrc = fs.readFileSync(path.join(root, 'tools/raw-dir.mjs'), 'utf8');
      t.equal(/\.\.['"]\s*,\s*['"]\.\./.test(rawSrc), false, 'tools/raw-dir.mjs no longer walks ../.. outside the repo by default');

      // Layout header comments (landed in 27353a3) and visual-style-guide.md:22 (P-F08)
      const buildLayout = fs.readFileSync(path.join(root, 'tools/build-layout.mjs'), 'utf8');
      const layoutJs = fs.readFileSync(path.join(root, 'src/js/layout.js'), 'utf8');
      const guide = fs.readFileSync(path.join(root, 'research/visual-style-guide.md'), 'utf8');
      t.expect(buildLayout.includes('adds a flat +20 to a Hot Springs word'), 'tools/build-layout.mjs states flat +20 Bathhouse Row scoring');
      t.expect(layoutJs.includes('adds a flat +20 to a Hot Springs word'), 'src/js/layout.js states flat +20 Bathhouse Row scoring');
      t.expect(guide.includes('46 painted `.webp` files'), 'research/visual-style-guide.md keeps verified 46 painted .webp files count (P-F08)');
    },
  },
  // ---------- W3-S5-05 ----------
  {
    name: 'W3-S5-05 3D lift projection forwards elevation (0.24/0.30/0.25), clothTexture uses seeded PRNG, and steam/spark VFX are deterministic under __TEST__ and freezeFx',
    viewports: ['desktop'],
    initScript: quiet,
    async run(t) {
      // Static guard: zero Math.random() in board3d.js (clothTexture seeded) and zero Math.random() inside steam/spark FX in main.js
      const b3Src = fs.readFileSync(path.join(root, 'src/js/board3d.js'), 'utf8');
      const mainSrc = fs.readFileSync(path.join(root, 'src/js/main.js'), 'utf8');
      t.equal(/Math\.random/.test(b3Src), false, 'board3d.js has zero unseeded Math.random() calls');
      t.expect(/R\.proj\.fn\s*=\s*\(bx,\s*by,\s*lift\s*=\s*0\)\s*=>\s*screenOf\(bx,\s*by,\s*lift\)/.test(b3Src), 'board3d.js forwards lift through R.proj.fn');
      const fxSlice = mainSrc.slice(mainSrc.indexOf('function wispAt()'), mainSrc.indexOf('function goldSweep('));
      t.equal(/Math\.random/.test(fxSlice), false, 'main.js steam/spark emitters use seeded fxRand() instead of Math.random()');

      await ready(t);
      const runSteamPlay = async (seed, testFlag = true) => {
        await t.page.evaluate((flag) => { window.__TEST__ = flag; }, testFlag);
        await t.game('seed', seed);
        await t.game('act', 'freezeFx', 1000);
        await t.game('newGame', { seed, seats: [{ kind: 'human', name: 'You' }, { kind: 'human', name: 'P2' }] });
        await t.waitIdle(6000);
        await t.game('act', 'reveal');
        const st = await t.state();
        st.game.players[0].rack = 'STEAMQQ'.split('');
        await t.game('setState', { game: st.game });
        await t.game('act', 'stage', [...'STEAM'].map((l, k) => ({ i: 7 * 15 + 5 + k, l })));
        await t.game('act', 'play');
        await t.waitFrames(2);
        const after = await t.state();
        await t.game('act', 'freezeFx', null);
        return after.fx;
      };

      // 1) Same seed under __TEST__ produces byte-for-byte identical steam particle vectors
      const fxA = await runSteamPlay(41, true);
      const fxB = await runSteamPlay(41, true);
      t.equal(fxA.seeded, true, 'steam FX reports seeded mode under __TEST__');
      t.equal(fxA.rngSeed, 41, 'steam FX seeds from game seed 41');
      t.expect(fxA.sample.length >= 4, `captured >= 4 steam particles (got ${fxA.sample.length})`);
      t.equal(JSON.stringify(fxA.sample), JSON.stringify(fxB.sample), 'same seed produces identical deterministic steam particles across runs');

      // 2) Different seed produces a different particle sequence
      const fxC = await runSteamPlay(99, true);
      t.equal(fxC.rngSeed, 99, 'steam FX seeds from game seed 99');
      t.expect(JSON.stringify(fxC.sample) !== JSON.stringify(fxA.sample), 'different seed yields a distinct steam particle sequence');

      // 3) freezeFx alone (even when __TEST__ is false) still runs deterministically
      const fxFreezeA = await runSteamPlay(47, false);
      const fxFreezeB = await runSteamPlay(47, false);
      await t.page.evaluate(() => { window.__TEST__ = true; });
      t.equal(JSON.stringify(fxFreezeA.sample), JSON.stringify(fxFreezeB.sample), 'freezeFx keeps steam particles deterministic even without __TEST__');

      // 4) On GPU, 3D lift projection elevates placed (0.24) and staged (0.30) overlays above board slab (0)
      const b3 = await t.game('act', 'b3');
      if (t.gpu && b3 && b3.on) {
        const [, y0] = await t.game('act', 'cell', 112, 0);
        const [, y24] = await t.game('act', 'cell', 112, 0.24);
        const [, y30] = await t.game('act', 'cell', 112, 0.30);
        t.expect(y24 < y0 - 2, `placed TILE_LIFT=0.24 projects visibly above slab y (${y24} < ${y0})`);
        t.expect(y30 < y24 - 0.5, `staged STAGED_LIFT=0.30 projects above placed lift (${y30} < ${y24})`);
      }
    },
  },
  // ---------- W3-S5-04 ----------
  {
    name: 'W3-S5-04 check-pipeline enforces pieces-mesh budgets, dead code (FONT_DECO/bathGlyph/tile-glaze/texKey/REVISION) removed, and balance.mjs reports all 4 personas, common-word rates, and --daily-par (Node)',
    node: true,
    async run(t) {
      // 1) check-pipeline.mjs enforces pieces-mesh.js <= 25 KB & peripheral props <= 500 tris each
      const pipeSrc = fs.readFileSync(path.join(root, 'tools/check-pipeline.mjs'), 'utf8');
      t.expect(pipeSrc.includes('pieces-mesh.js') && pipeSrc.includes('25 * 1024') && pipeSrc.includes('500'), 'check-pipeline.mjs checks pieces-mesh.js <= 25 KB and peripheral props <= 500 tris');
      const pipeOut = execFileSync(process.execPath, [path.join(root, 'tools/check-pipeline.mjs'), '--fresh'], { cwd: root, encoding: 'utf8' });
      t.expect(pipeOut.includes('check-pipeline ok') && pipeOut.includes('pieces-mesh.js'), `check-pipeline --fresh reports pieces-mesh.js ok (${pipeOut.trim()})`);

      // 2) Dead code removed across render2d.js, board3d.js, build-three.mjs, and three-lib.js
      const r2d = fs.readFileSync(path.join(root, 'src/js/render2d.js'), 'utf8');
      const b3 = fs.readFileSync(path.join(root, 'src/js/board3d.js'), 'utf8');
      const buildThree = fs.readFileSync(path.join(root, 'tools/build-three.mjs'), 'utf8');
      t.equal(/\bFONT_DECO\b/.test(r2d), false, 'unused FONT_DECO removed from render2d.js');
      t.equal(/\bbathGlyph\b|tile-glaze/.test(r2d), false, 'dead bathGlyph() and tile-glaze absent from render2d.js');
      t.equal(/\btexKey\b/.test(b3), false, 'write-only B3.texKey removed from board3d.js');
      t.equal(/['"]REVISION['"]/.test(buildThree), false, 'unused REVISION removed from tools/build-three.mjs');
      const { THREE } = await import(new URL('../src/js/three-lib.js', import.meta.url).href);
      t.equal(THREE.REVISION, undefined, 'rebuilt src/js/three-lib.js drops unused THREE.REVISION');

      // 3) balance.mjs reports all 4 personas + commonWordShare and supports --daily-par
      const balOut = execFileSync(process.execPath, [path.join(root, 'tools/balance.mjs'), '--games', '2', '--daily-par', '5'], { cwd: root, encoding: 'utf8' });
      const rows = balOut.trim().split(/\r?\n/).map((line) => JSON.parse(line));
      const matchups = rows.filter((r) => r.matchup);
      const personasSeen = new Set(matchups.flatMap((r) => Object.keys(r.commonWordShare || {})));
      for (const id of ['opal', 'hollis', 'lucky', 'julian']) {
        t.expect(personasSeen.has(id), `balance.mjs reports commonWordShare for persona "${id}" (${[...personasSeen].join(', ')})`);
      }
      for (const r of matchups) {
        const shares = Object.values(r.commonWordShare || {});
        t.expect(shares.length >= 2 && shares.every((v) => typeof v === 'number' && v >= 0 && v <= 1), `${r.matchup}: valid commonWordShare (${JSON.stringify(r.commonWordShare)})`);
      }
      const daily = rows.find((r) => r.kind === 'daily-par');
      t.expect(!!daily && daily.days === 5, `balance.mjs --daily-par 5 outputs daily-par summary (${JSON.stringify(daily)})`);
      t.expect(typeof daily.avgMedium === 'number' && typeof daily.avgHard === 'number' && typeof daily.inversionRate === 'number', 'daily-par reports avgMedium, avgHard, and inversionRate');
    },
  },
  {
    name: 'W3-S5-04 CD-WF3-06 window.__G remains intact alongside window.__game',
    viewports: ['desktop'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 41 });
      await t.waitIdle(6000);
      const hooks = await t.page.evaluate(() => ({
        hasGame: !!window.__game && typeof window.__game.getState === 'function',
        hasG: !!window.__G && !!window.__G.s && !!window.__G.lex,
      }));
      t.equal(hooks.hasGame, true, 'window.__game intact');
      t.equal(hooks.hasG, true, 'CD-WF3-06: window.__G remains intact for dependent Playwright suites');
    },
  },
];

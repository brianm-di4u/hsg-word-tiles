// Wave 4, batch W4-B11 (WF-3 character_iconography):
// - W3-S1-02: dedicated frosted sea-glass 3D tile body material B3.blankBodyMat (roughness 0.62) + instanced pool
//   B3.blankInst, completing 050386d's frosted sea-glass faces & etched steam curls across 2D/3D and Day/Night.
// - W3-S2-07: Art Deco brass-beveled double-ring medallion on human badges + reduced-motion-safe expression states
//   (active/big-play/pass/win/loss) on opponent badges, completing e1ce26f's ?art=0 initials() fix.
// - W3-S1-05: align Maestro Julian Fitch's role copy to '1920s hotel orchestra leader' matching his white-tie/baton portrait.
// - W3-S1-04: already solved by 7e3aa7d (poked tile crown) and 6cc8b2f/16745f2 (unified #0F1713 ink & numeral proportions).
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, theme: 'light' }));
  }
};

export const tests = [
  // ---------- W3-S1-02 ----------
  {
    name: 'W3-S1-02 3D blank Steam tiles use dedicated frosted sea-glass B3.blankBodyMat (roughness 0.62) in Day and Night with clean GPU disposal',
    viewports: ['desktop'],
    url: 'index.html?gl=3d',
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 41, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'julian' }] });
      await t.waitIdle(8000);
      const s = await t.state();
      s.game.board[111] = { l: 'S', blank: false, p: 1, t: 0 };
      s.game.board[112] = { l: 'P', blank: true, p: 1, t: 0 };
      s.game.board[113] = { l: 'A', blank: false, p: 1, t: 0 };
      s.game.board[127] = { l: 'I', blank: true, p: 0, t: 1 };
      s.game.move = 2; s.game.cur = 0;
      s.game.players[0].rack = ['?', 'E', 'A', 'R', 'T', 'S', 'N'];
      await t.game('setState', { game: s.game });
      await t.waitIdle(6000);
      await t.waitFrames(3);

      const b3 = await t.game('act', 'b3');
      if (!t.gpu || !b3 || !b3.on) {
        t.log('software GL active; skipping live 3D B3.blankBodyMat checks');
        return;
      }
      t.expect(!!b3.blankBodyMat, 'B3.blankBodyMat is initialized');
      t.equal(b3.blankBodyMat.type, 'MeshStandardMaterial', 'B3.blankBodyMat uses frosted MeshStandardMaterial');
      t.equal(b3.blankBodyMat.roughness, 0.62, `B3.blankBodyMat roughness is 0.62 (got ${b3.blankBodyMat.roughness})`);
      t.equal(b3.blankBodyMat.color, 'cfe6e2', `Day B3.blankBodyMat uses frosted sea-glass #cfe6e2 (got #${b3.blankBodyMat.color})`);
      t.equal(b3.bodyInstanced, true, 'all tilebody pools including B3.blankInst are InstancedMesh');
      t.equal(b3.bodyCounts.blank, 2, `placed blank tiles route to B3.blankInst (got ${b3.bodyCounts.blank})`);
      t.equal(b3.bodyCounts.board, 2, `regular placed tiles route to B3.bodyInst (got ${b3.bodyCounts.board})`);
      await t.game('act', 'zoom', 2.2, 7.9, 8.1);
      await t.waitFrames(3);
      await t.shot('w4-b11-blank-3d-day', { timeout: 15000 });

      // Night theme shifts B3.blankBodyMat to twilight sea-glass #c3d8d4
      await t.game('scene', 'settings');
      await t.page.click('[data-set="theme"][data-val="dark"]');
      await t.game('scene', 'game');
      await t.waitIdle(6000);
      await t.waitFrames(3);
      const b3Night = await t.game('act', 'b3');
      t.equal(b3Night.blankBodyMat.color, 'c3d8d4', `Night B3.blankBodyMat shifts to #c3d8d4 (got #${b3Night.blankBodyMat.color})`);
      t.equal(b3Night.blankBodyMat.roughness, 0.62, 'Night B3.blankBodyMat preserves roughness 0.62');
      t.equal(b3Night.bodyCounts.blank, 2, 'Night mode keeps both blanks in B3.blankInst');
      await t.shot('w4-b11-blank-3d-night', { timeout: 15000 });

      // Turning 3D off disposes B3.blankBodyMat and B3.blankInst with 0 GPU leftovers
      await t.game('scene', 'settings');
      await t.page.click('[data-set="board3d"][data-val="off"]');
      await t.game('scene', 'game');
      await t.waitFrames(3);
      const off = await t.game('act', 'b3');
      t.equal(off.on, false, '3D turned off cleanly');
      t.equal(off.blankBodyMat, null, 'B3.destroy() clears B3.blankBodyMat');
      t.equal(off.disposed.left.geometries, 0, '0 geometries leaked on GPU');
      t.equal(off.disposed.left.textures, 0, '0 textures leaked on GPU');
    },
  },
  // ---------- W3-S2-07 ----------
  {
    name: 'W3-S2-07 seatMood() maps big play/pass/swap/win/loss deterministically without touching saves',
    node: true,
    async run(t) {
      const { seatMood, initials } = await import(new URL('../src/js/ui.js', import.meta.url).href);
      t.equal([initials('Opal Vance'), initials('Hollis Crane'), initials('"Lucky" Delmar'), initials('Maestro Julian Fitch')], ['OV', 'HC', 'LD', 'MJ'], 'shared initials() renders two-letter monograms for all personas');
      t.equal(seatMood({ log: [] }, 0), '', 'neutral before first move');
      t.equal(seatMood({ log: [{ p: 1, kind: 'play', score: 18 }] }, 1), '', 'ordinary play stays neutral');
      t.equal(seatMood({ log: [{ p: 1, kind: 'play', score: 34 }] }, 1), 'big', 'big play (>= BIG_PLAY) sets big mood');
      t.equal(seatMood({ log: [{ p: 1, kind: 'play', score: 22, featured: 'STEAM' }] }, 1), 'big', 'Featured Spring play sets big mood');
      t.equal(seatMood({ log: [{ p: 1, kind: 'play', score: 34 }, { p: 1, kind: 'pass' }] }, 1), 'pass', 'subsequent pass switches to pass mood');
      t.equal(seatMood({ log: [{ p: 1, kind: 'swap', count: 2 }] }, 1), 'pass', 'swap sets pass mood');
      t.equal(seatMood({ log: [{ p: 1, kind: 'pass' }, { p: 1, kind: 'play', score: 14 }] }, 1), '', 'ordinary play clears pass mood');
      t.equal(seatMood({ mode: 'play', over: true, result: { winners: [1] }, log: [] }, 1), 'win', 'winner gets win mood');
      t.equal(seatMood({ mode: 'play', over: true, result: { winners: [1] }, log: [] }, 0), 'loss', 'non-winner gets loss mood');
      t.equal(seatMood({ mode: 'play', over: true, result: { winners: [0, 1] }, log: [] }, 0), 'win', 'tied winner gets win mood');
      t.equal(seatMood({ mode: 'daily', over: true, result: { winners: [0] }, log: [] }, 0), '', 'Daily Soak skips head-to-head win/loss mood');
    },
  },
  {
    name: 'W3-S2-07 human badges show Art Deco brass double-ring medallion and opponent badges show big-play/pass/win/loss states respecting reduced motion',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 19, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'julian', level: 'hard' }] });
      await t.waitIdle(6000);

      // 1) Human badge has Art Deco brass double-ring inset box-shadow + radial medallion sheen (both desktop .pcard and mobile .chip)
      const humanBadge = await t.page.evaluate(() => {
        const b = document.querySelector('.pcard .badge:not(.has-face), .chip .badge:not(.has-face)');
        if (!b) return null;
        const cs = getComputedStyle(b);
        return { bgImage: cs.backgroundImage, shadow: cs.boxShadow, insetCount: (cs.boxShadow.match(/inset/g) || []).length };
      });
      t.expect(!!humanBadge, 'human monogram badge rendered');
      t.expect(humanBadge.bgImage.includes('radial-gradient'), `human badge has medallion sheen (${humanBadge.bgImage})`);
      t.expect(humanBadge.insetCount >= 2, `human badge renders etched double-ring inset shadow (${humanBadge.shadow})`);

      // 2) Opponent big play -> warm brass halo pulse (.mood-big); pass -> cool dim (.mood-pass)
      const s = await t.state();
      s.game.log = [{ p: 1, kind: 'play', words: [{ w: 'STEAM' }], tiles: [{ i: 112, l: 'S' }], score: 36 }];
      s.game.cur = 0;
      await t.game('setState', { game: s.game });
      await t.waitFrames(2);
      const bigState = await t.page.evaluate(() => {
        const sel = window.innerWidth <= 860 ? '#turnline .chip:nth-of-type(2) .badge' : '#scores .pcard:nth-of-type(2) .badge';
        const b = document.querySelector(sel);
        const cs = b && getComputedStyle(b);
        return b ? { cls: b.className, anim: cs.animationName, shadow: cs.boxShadow } : null;
      });
      t.expect(bigState && bigState.cls.includes('mood-big'), `big play sets .mood-big (${JSON.stringify(bigState)})`);
      t.equal(bigState.anim, 'badge-halo', 'full motion animates warm brass halo pulse');
      await t.shot('w4-b11-badge-big');

      // Reduced motion disables pulse animation while keeping static warm brass halo
      await t.page.emulateMedia({ reducedMotion: 'reduce' });
      await t.page.waitForFunction(() => document.body.classList.contains('reduce'), null, { timeout: 2000 });
      const bigReduced = await t.page.evaluate(() => {
        const sel = window.innerWidth <= 860 ? '#turnline .chip:nth-of-type(2) .badge' : '#scores .pcard:nth-of-type(2) .badge';
        const cs = getComputedStyle(document.querySelector(sel));
        return { anim: cs.animationName, shadow: cs.boxShadow };
      });
      t.equal(bigReduced.anim, 'none', 'reduced motion stops badge-halo pulse');
      t.expect(bigReduced.shadow.includes('243, 221, 139'), `reduced motion keeps static warm brass halo (${bigReduced.shadow})`);
      await t.page.emulateMedia({ reducedMotion: 'no-preference' });
      await t.page.waitForFunction(() => !document.body.classList.contains('reduce'), null, { timeout: 2000 });

      // Pass -> subtle cool dim (.mood-pass)
      s.game.log = [{ p: 1, kind: 'pass' }];
      await t.game('setState', { game: s.game });
      await t.waitFrames(2);
      const passState = await t.page.evaluate(() => {
        const sel = window.innerWidth <= 860 ? '#turnline .chip:nth-of-type(2) .badge' : '#scores .pcard:nth-of-type(2) .badge';
        const b = document.querySelector(sel);
        const cs = b && getComputedStyle(b);
        return b ? { cls: b.className, filter: cs.filter, border: cs.borderColor } : null;
      });
      t.expect(passState && passState.cls.includes('mood-pass'), `pass sets .mood-pass (${JSON.stringify(passState)})`);
      t.expect(passState.filter.includes('saturate') && passState.filter.includes('brightness'), `pass applies subtle cool dim (${passState.filter})`);

      // 3) Final Soak game-over winner (.mood-win) & runner-up (.mood-loss)
      s.game.over = true;
      s.game.players[0].score = 210; s.game.players[1].score = 265;
      s.game.result = { why: 'out', out: 1, winners: [1], adjust: [-8, 8] };
      await t.game('setState', { game: s.game });
      await t.game('scene', 'over');
      await t.waitFrames(2);
      const overBadges = await t.page.evaluate(() => {
        const w = document.querySelector('.winner .badge');
        const l = document.querySelector('.final li .badge');
        return {
          winCls: w ? w.className : '',
          winAnim: w ? getComputedStyle(w).animationName : '',
          winIter: w ? getComputedStyle(w).animationIterationCount : '',
          lossCls: l ? l.className : '',
          lossFilter: l ? getComputedStyle(l).filter : '',
          lossInset: l ? (getComputedStyle(l).boxShadow.match(/inset/g) || []).length : 0,
        };
      });
      t.expect(overBadges.winCls.includes('mood-win'), `Final Soak winner badge gets .mood-win (${overBadges.winCls})`);
      // on the results the halo swells twice and rests as a steady ring (owner decision OQ-WF7-W4-01, W4-B33-hotfix); old: 'badge-halo', infinite
      t.expect(overBadges.winAnim === 'badge-settle' && overBadges.winIter === '2', `Final Soak winner badge pulses warm brass halo, twice (${overBadges.winAnim} x ${overBadges.winIter})`);
      t.expect(overBadges.lossCls.includes('mood-loss'), `Final Soak runner-up badge gets .mood-loss (${overBadges.lossCls})`);
      t.expect(overBadges.lossFilter.includes('saturate'), `runner-up badge gets subtle cool dim (${overBadges.lossFilter})`);
      t.expect(overBadges.lossInset >= 2, `human runner-up keeps Art Deco double-ring medallion under .mood-loss (${overBadges.lossInset})`);
      if (t.viewport === 'desktop') {
        await t.page.waitForFunction(() => {
          const el = document.querySelector('.final');
          return el && parseFloat(getComputedStyle(el).opacity) >= 0.99;
        }, null, { timeout: 3000 });
        await t.shot('w4-b11-over-badges');
      }
    },
  },
  // ---------- W3-S1-05 ----------
  {
    name: 'W3-S1-05 Maestro Julian Fitch role copy aligns to 1920s hotel orchestra leader across Setup and personas.js while preserving portrait',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('scene', 'setup');
      await t.waitFrames(2);
      const info = await t.page.evaluate(async () => {
        const { persona } = await import(new URL('src/js/personas.js', location.href).href);
        const btn = document.querySelector('.opps .opp[data-val="julian"]');
        const img = btn && btn.querySelector('img');
        if (img && !img.complete) await img.decode().catch(() => {});
        const role = btn && btn.querySelector('small');
        const br = btn && btn.getBoundingClientRect();
        const rr = role && role.getBoundingClientRect();
        return {
          personaRole: persona('julian').role,
          cardRole: role ? role.textContent.trim() : '',
          imgLoaded: !!(img && img.complete && img.naturalWidth === 192 && img.naturalHeight === 192),
          fitsCard: !!(br && rr && rr.right <= br.right + 1 && rr.bottom <= br.bottom + 1),
        };
      });
      t.equal(info.personaRole, '1920s hotel orchestra leader', 'personas.js aligns Julian role copy');
      t.equal(info.cardRole, '1920s hotel orchestra leader', 'Setup card displays aligned role copy');
      t.equal(info.imgLoaded, true, 'assets/face-julian.webp silhouette preserved intact (192x192)');
      t.equal(info.fitsCard, true, 'aligned role copy fits cleanly inside Setup opponent card');
      await t.page.click('.opps .opp[data-val="julian"]');
      const note = await t.page.textContent('.seat-note');
      t.expect(note.includes('1920s hotel orchestra leader.'), `Setup seat-note reflects aligned role (${note})`);
      if (t.viewport === 'desktop') await t.shot('w4-b11-julian-setup');
    },
  },
  // ---------- W3-S1-04 (already_done guard: 7e3aa7d + 6cc8b2f + 16745f2) ----------
  {
    name: 'W3-S1-04 poked 3D tile crown (+0.010 center) and unified #0F1713 typography across paintFace and tileSprite hold',
    node: true,
    async run(t) {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const { root } = await import('./lib.mjs');
      const { MESHES } = await import(new URL('../src/js/pieces-mesh.js', import.meta.url).href);
      t.equal(MESHES.tile.hi[2], 0.25, `poked tile crown center lifted to z=0.250 (got ${MESHES.tile.hi[2]})`);
      const r2d = fs.readFileSync(path.join(root, 'src/js/render2d.js'), 'utf8');
      const inks = r2d.match(/blank \? STEAM_INK : '#0F1713'/g) || [];
      t.equal(inks.length, 2, `both paintFace() and tileSprite() share unified #0F1713 ink (found ${inks.length})`);
    },
  },
];

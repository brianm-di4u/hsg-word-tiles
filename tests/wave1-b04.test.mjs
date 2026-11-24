// Wave 1, batch W1-B04 (W5-S3-02): >=44 px mobile touch targets (collapsible #springs drawer,
// landscape .abtn, #preview .bdbtn, vertical .rtile touch padding), landscape 568x320 layout math
// (clamp(288px, 48vw, 340px) + 3 px #rack gap + 6 px #topbar gap + constant 5-slot mobile / 6-slot
// desktop #actions), portrait 3D fitDistance() at 0.08-0.10 rad including the walnut bezel, and full
// 4-edge env(safe-area-inset-*) padding on #screen, #modal, and #app.
import fs from 'node:fs';
import path from 'node:path';
import { root } from './lib.mjs';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const CENTER = 112;
const instant = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false }));
  }
};
const SEATS = [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'julian', level: 'hard' }];

export const tests = [
  {
    name: 'W5-S3-02 portrait mobile: >=44 px collapsible #springs drawer, labeled plaques with SHORT[per.id], >=44 px .bdbtn & .rtile',
    viewports: ['mobile'],
    initScript: instant,
    async run(t) {
      await ready(t);
      await t.seed(5);
      await t.game('newGame', { seats: SEATS });
      await t.waitIdle(8000);
      // Mark Featured Spring 0 as claimed by Maestro Julian Fitch (persona julian -> SHORT['julian'] = 'Julian')
      const s0 = await t.state();
      s0.game.featured[0].by = 1;
      await t.game('setState', { game: s0.game });
      await t.waitIdle(5000);

      // Collapsed drawer bar >= 44 px, tray starts hidden
      const collapsed = await t.page.evaluate(() => {
        const bar = document.querySelector('#springs [data-springs-toggle]');
        const tray = document.querySelector('#springs-tray');
        return {
          hasBar: !!bar,
          barH: bar ? bar.getBoundingClientRect().height : 0,
          expanded: bar && bar.getAttribute('aria-expanded'),
          trayHidden: !!tray && tray.hidden,
        };
      });
      t.equal(collapsed.hasBar, true, 'mobile #springs renders collapsible drawer bar');
      t.expect(collapsed.barH >= 44, `collapsible #springs bar height ${collapsed.barH.toFixed(1)} px >= 44 px`);
      t.equal(collapsed.expanded, 'false', 'drawer starts collapsed (aria-expanded=false)');
      t.equal(collapsed.trayHidden, true, '#springs-tray starts hidden');
      await t.shot('w1-b04-portrait-collapsed');

      // Expand drawer: all 3 plaques >= 44 px tall with visible short category tags & SHORT[per.id] claim badge
      await t.page.click('#springs [data-springs-toggle]');
      const expanded = await t.page.evaluate(() => {
        const bar = document.querySelector('#springs [data-springs-toggle]');
        const tray = document.querySelector('#springs-tray');
        const plaques = [...document.querySelectorAll('#springs-tray .plaque')].map((p) => {
          const b = p.getBoundingClientRect();
          const catEl = p.querySelector('.pcat-name');
          const pbyEl = p.querySelector('.pby');
          return {
            h: b.height,
            l: b.left,
            r: b.right,
            catVisible: !!catEl && getComputedStyle(catEl).display !== 'none' && catEl.textContent.trim().length > 0,
            catText: catEl ? catEl.textContent.trim() : '',
            pbyVisible: !!pbyEl && getComputedStyle(pbyEl).display !== 'none',
            pbyText: pbyEl ? pbyEl.textContent.trim() : '',
          };
        });
        return { expanded: bar.getAttribute('aria-expanded'), trayHidden: tray.hidden, plaques, W: innerWidth };
      });
      t.equal(expanded.expanded, 'true', 'drawer bar sets aria-expanded=true when open');
      t.equal(expanded.trayHidden, false, '#springs-tray becomes visible');
      t.equal(expanded.plaques.length, 3, 'all 3 plaques shown in drawer');
      const shortCats = new Set(['Row', 'Springs', 'Park', 'Track', 'Club', 'Town']);
      for (let k = 0; k < expanded.plaques.length; k++) {
        const p = expanded.plaques[k];
        t.expect(p.h >= 44, `plaque ${k} height ${p.h.toFixed(1)} px >= 44 px`);
        t.expect(p.l >= 0 && p.r <= expanded.W + 0.5, `plaque ${k} inside viewport width`);
        t.equal(p.catVisible, true, `plaque ${k} shows short category tag`);
        t.expect(shortCats.has(p.catText), `plaque ${k} tag "${p.catText}" is a valid short category label`);
      }
      t.equal(expanded.plaques[0].pbyVisible, true, 'claimed plaque shows .pby owner badge on mobile');
      t.equal(expanded.plaques[0].pbyText, 'Julian', 'claimed plaque uses SHORT[per.id] ("Julian", not "Maestro")');
      await t.shot('w1-b04-portrait-drawer-open');
      await t.checkLayout();

      // Escape closes drawer and returns focus to toggle button
      await t.page.keyboard.press('Escape');
      const afterEsc = await t.page.evaluate(() => ({
        expanded: document.querySelector('#springs [data-springs-toggle]')?.getAttribute('aria-expanded'),
        trayHidden: document.querySelector('#springs-tray')?.hidden,
      }));
      t.equal(afterEsc.expanded, 'false', 'Escape closes #springs drawer');
      t.equal(afterEsc.trayHidden, true, '#springs-tray hidden after Escape');

      // Stage a legal move: #preview .bdbtn >= 44 px tall
      const [m] = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', m.tiles);
      const bdbtnH = await t.page.evaluate(() => {
        const b = document.querySelector('#preview .bdbtn:not([data-hintnext])');
        return b ? b.getBoundingClientRect().height : 0;
      });
      t.expect(bdbtnH >= 44, `portrait #preview .bdbtn height ${bdbtnH.toFixed(1)} px >= 44 px`);
      await t.game('act', 'recall');

      // Narrow 320x568 phone: all 7 .rtile buttons keep >= 44 px touch height and stay inside 320 px width
      await t.page.setViewportSize({ width: 320, height: 568 });
      for (let k = 0; k < 3; k++) { await t.page.evaluate(() => dispatchEvent(new Event('resize'))); await t.waitFrames(1); }
      const narrow = await t.page.evaluate(() => {
        const tiles = [...document.querySelectorAll('#rack .rtile')].map((el) => {
          const b = el.getBoundingClientRect();
          const c = el.querySelector('canvas').getBoundingClientRect();
          return { h: b.height, w: b.width, l: b.left, r: b.right, cw: c.width, ch: c.height };
        });
        return { tiles, W: innerWidth };
      });
      t.equal(narrow.tiles.length, 7, '320x568 renders all 7 rack tiles');
      for (let k = 0; k < narrow.tiles.length; k++) {
        const r = narrow.tiles[k];
        t.expect(r.h >= 44, `320x568 .rtile[${k}] height ${r.h.toFixed(1)} px >= 44 px`);
        t.expect(Math.abs(r.cw - r.ch) <= 1, `320x568 .rtile[${k}] canvas stays square (${r.cw.toFixed(1)}x${r.ch.toFixed(1)})`);
        t.expect(r.l >= 0 && r.r <= narrow.W + 0.5, `320x568 .rtile[${k}] fits inside 320 px`);
      }
      await t.checkLayout();
      await t.page.setViewportSize({ width: t.vp.width, height: t.vp.height });
    },
  },
  {
    name: 'W5-S3-02 landscape 568x320 math, >=44 px touch targets, 3 px #rack gap, 6 px #topbar gap & constant 5-slot mobile #actions',
    viewports: ['mobile'],
    initScript: instant,
    async run(t) {
      await ready(t);
      await t.seed(5);
      await t.game('newGame', { seats: SEATS });
      await t.waitIdle(8000);
      await t.page.setViewportSize({ width: 568, height: 320 });
      for (let k = 0; k < 3; k++) { await t.page.evaluate(() => dispatchEvent(new Event('resize'))); await t.waitFrames(1); }

      const before = await t.page.evaluate(() => {
        const appCs = getComputedStyle(document.querySelector('#app'));
        const tracks = appCs.gridTemplateColumns.split(' ').map(parseFloat).filter((v) => v > 0);
        const topGap = parseFloat(getComputedStyle(document.querySelector('#topbar')).columnGap || getComputedStyle(document.querySelector('#topbar')).gap);
        const rackGap = parseFloat(getComputedStyle(document.querySelector('#rack')).columnGap || getComputedStyle(document.querySelector('#rack')).gap);
        const bw = document.querySelector('#boardwrap').getBoundingClientRect();
        const bar = document.querySelector('#springs [data-springs-toggle]').getBoundingClientRect();
        const tiles = [...document.querySelectorAll('#rack .rtile')].map((el) => el.getBoundingClientRect());
        const acts = [...document.querySelectorAll('#actions .abtn')].map((el) => ({
          act: el.dataset.act,
          l: el.getBoundingClientRect().left,
          r: el.getBoundingClientRect().right,
          w: el.getBoundingClientRect().width,
          h: el.getBoundingClientRect().height,
          b: el.getBoundingClientRect().bottom,
        }));
        return { tracks, topGap, rackGap, bw: { w: bw.width, h: bw.height }, barH: bar.height, tiles: tiles.map((x) => ({ l: x.left, r: x.right, h: x.height, b: x.bottom })), acts, W: innerWidth, H: innerHeight };
      });
      t.expect(before.tracks[1] >= 287.5, `568x320 control column ${before.tracks[1].toFixed(1)} px >= 288 px`);
      t.expect(before.bw.w >= 255 && before.bw.h >= 255, `568x320 board expanded to ${before.bw.w.toFixed(0)}x${before.bw.h.toFixed(0)} px (was 208x208)`);
      t.equal(before.topGap, 6, 'landscape #topbar gap is 6 px');
      t.equal(before.rackGap, 3, 'landscape #rack gap is 3 px');
      t.expect(before.barH >= 44, `landscape #springs bar height ${before.barH.toFixed(1)} px >= 44 px`);
      t.equal(before.tiles.length, 7, 'all 7 tiles present on 568x320');
      for (let k = 0; k < before.tiles.length; k++) {
        t.expect(before.tiles[k].h >= 44, `568x320 .rtile[${k}] height ${before.tiles[k].h.toFixed(1)} px >= 44 px`);
        t.expect(before.tiles[k].r <= before.W + 0.5 && before.tiles[k].b <= before.H + 0.5, `568x320 .rtile[${k}] inside viewport`);
      }
      t.equal(before.acts.length, 5, 'mobile #actions has constant 5 slots at 0 staged');
      t.equal(before.acts[0].act, 'shuffle', 'Slot 1 starts as Shuffle');
      for (const a of before.acts) {
        t.expect(a.h >= 44, `568x320 .abtn[${a.act}] height ${a.h.toFixed(1)} px >= 44 px`);
        t.expect(a.w >= 52, `568x320 .abtn[${a.act}] width ${a.w.toFixed(1)} px >= 52 px`);
        t.expect(a.r <= before.W + 0.5 && a.b <= before.H + 0.5, `568x320 .abtn[${a.act}] inside viewport`);
      }
      await t.shot('w1-b04-landscape-568x320');

      // Stage a legal move: Slot 1 toggles Shuffle -> Recall in-place with 0 px shift on Swap/Pass/Hint/Play, and .bdbtn >= 44 px
      const [m] = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', m.tiles);
      const staged = await t.page.evaluate(() => {
        const acts = [...document.querySelectorAll('#actions .abtn')].map((el) => ({
          act: el.dataset.act,
          l: el.getBoundingClientRect().left,
          w: el.getBoundingClientRect().width,
          h: el.getBoundingClientRect().height,
        }));
        const bd = document.querySelector('#preview .bdbtn:not([data-hintnext])');
        return { acts, bdH: bd ? bd.getBoundingClientRect().height : 0 };
      });
      t.equal(staged.acts.length, 5, 'mobile #actions stays 5 slots when staged (CD-WF5-05)');
      t.equal(staged.acts[0].act, 'recall', 'Slot 1 toggles in-place to Recall when staged');
      for (let k = 1; k < 5; k++) {
        t.expect(Math.abs(staged.acts[k].l - before.acts[k].l) <= 0.5, `568x320 slot ${k} (${staged.acts[k].act}) shifted by 0 px`);
      }
      t.expect(staged.bdH >= 44, `landscape #preview .bdbtn height ${staged.bdH.toFixed(1)} px >= 44 px`);
      await t.checkLayout();
      await t.page.setViewportSize({ width: t.vp.width, height: t.vp.height });
    },
  },
  {
    name: 'W5-S3-02 desktop: constant 6-slot #actions (Recall disabled at 0 staged), >=44 px .bdbtn, labeled plaques with SHORT[per.id]',
    viewports: ['desktop'],
    initScript: instant,
    async run(t) {
      await ready(t);
      await t.seed(5);
      await t.game('newGame', { seats: SEATS });
      await t.waitIdle(8000);
      const s0 = await t.state();
      s0.game.featured[0].by = 1;
      await t.game('setState', { game: s0.game });
      await t.waitIdle(5000);

      const before = await t.page.evaluate(() => {
        const acts = [...document.querySelectorAll('#actions .abtn')].map((el) => ({
          act: el.dataset.act,
          disabled: el.disabled,
          l: el.getBoundingClientRect().left,
        }));
        const p0 = document.querySelector('#springs .plaque');
        return {
          acts,
          catTag: p0?.querySelector('.pcat-name')?.textContent.trim(),
          pby: p0?.querySelector('.pby')?.textContent.trim(),
          hasToggle: !!document.querySelector('#springs [data-springs-toggle]'),
        };
      });
      t.equal(before.hasToggle, false, 'desktop #springs stays inline without mobile drawer button');
      t.expect(before.catTag && before.catTag.length > 0, `desktop plaque shows short category tag (${before.catTag})`);
      t.equal(before.pby, 'Julian', 'desktop claimed plaque uses SHORT[per.id] ("Julian")');
      t.equal(before.acts.length, 6, 'desktop #actions has constant 6 slots at 0 staged (CD-WF5-05)');
      t.equal(before.acts[0].act, 'shuffle', 'Slot 1 is Shuffle');
      t.equal(before.acts[1].act, 'recall', 'Slot 2 is Recall');
      t.equal(before.acts[1].disabled, true, 'Recall is disabled at 0 staged');

      const [m] = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', m.tiles);
      const staged = await t.page.evaluate(() => ({
        acts: [...document.querySelectorAll('#actions .abtn')].map((el) => ({
          act: el.dataset.act,
          disabled: el.disabled,
          l: el.getBoundingClientRect().left,
        })),
        bdH: document.querySelector('#preview .bdbtn:not([data-hintnext])')?.getBoundingClientRect().height || 0,
      }));
      t.equal(staged.acts.length, 6, 'desktop #actions stays 6 slots when staged');
      t.equal(staged.acts[1].disabled, false, 'Recall becomes enabled when staged');
      for (let k = 0; k < 6; k++) {
        t.expect(Math.abs(staged.acts[k].l - before.acts[k].l) <= 0.5, `desktop slot ${k} (${staged.acts[k].act}) has 0 px shift`);
      }
      t.expect(staged.bdH >= 44, `desktop #preview .bdbtn height ${staged.bdH.toFixed(1)} px >= 44 px`);
      await t.shot('w1-b04-desktop-actions');
      await t.checkLayout();
    },
  },
  {
    name: 'W5-S3-02 full 4-edge env(safe-area-inset-*) on #screen, #modal, #app & clean dead-rule removal in CSS',
    node: true,
    async run(t) {
      const css = fs.readFileSync(path.join(root, 'src', 'styles', 'main.css'), 'utf8');
      const hasAllFour = (block) => ['top', 'right', 'bottom', 'left'].every((s) => block.includes(`env(safe-area-inset-${s})`));
      const screenRule = css.match(/#screen\s*\{[^}]+\}/)?.[0] || '';
      const modalRule = css.match(/#modal\s*\{[^}]+\}/)?.[0] || '';
      const appRules = css.match(/#app\s*\{[^}]*padding:[^}]+\}/g) || [];
      t.expect(hasAllFour(screenRule), '#screen padding includes all 4 env(safe-area-inset-*) insets');
      t.expect(hasAllFour(modalRule), '#modal padding includes all 4 env(safe-area-inset-*) insets');
      t.expect(appRules.length >= 3 && appRules.every(hasAllFour), `all #app padding rules (${appRules.length}) include all 4 env(safe-area-inset-*) insets`);
      t.expect(!/\.plaque\s*\{[^}]*min-height:\s*30px/.test(css), 'dead sub-44px .plaque { min-height: 30px } removed');
      t.expect(!/\.plaque\s+\.pcat\s*\{\s*display:\s*none/.test(css), 'dead .plaque .pcat { display: none } removed');
      t.expect(!/\.abtn\s*\{\s*min-height:\s*40px/.test(css), 'sub-44px landscape .abtn { min-height: 40px } removed');
      t.expect(!/#preview\s+\.bdbtn\s*\{[^}]*min-height:\s*28px/.test(css), 'sub-44px #preview .bdbtn { min-height: 28px } removed');
      t.expect(css.includes('clamp(288px, 48vw, 340px)'), 'landscape control column uses clamp(288px, 48vw, 340px)');
    },
  },
  {
    name: 'W5-S3-02 portrait 3D fitDistance() solves at 0.08-0.10 rad tilt with all four walnut rails inside #boardwrap',
    viewports: ['mobile'],
    initScript: instant,
    async run(t) {
      await ready(t);
      await t.seed(5);
      await t.game('newGame', { seats: SEATS });
      await t.waitIdle(8000);
      const b3 = await t.game('act', 'b3');
      if (!b3 || !b3.on) {
        // Software GL falls back to 2D unless --gpu is passed: verify board3d.js source directly so the guard still runs
        const src = fs.readFileSync(path.join(root, 'src', 'js', 'board3d.js'), 'utf8');
        const m = src.match(/const\s+PORTRAIT_TILT\s*=\s*([0-9.]+)/);
        t.expect(!!m && +m[1] >= 0.08 && +m[1] <= 0.10, `PORTRAIT_TILT (${m && m[1]}) is in [0.08, 0.10] rad`);
        t.expect(!/PORTRAIT_FIT_TILT/.test(src), 'post-fit tilt mismatch hack (PORTRAIT_FIT_TILT) removed');
        t.expect(/FRAME_EXTENT/.test(src), 'fitDistance() includes walnut FRAME_EXTENT');
        t.log('software GL active; verified board3d.js parameters directly (run with --gpu for live 3D projection check)');
        return;
      }
      t.equal(b3.tall, true, 'portrait mode detected on mobile');
      t.expect(b3.tilt >= 0.08 && b3.tilt <= 0.10, `portrait 3D tilt ${b3.tilt} rad in [0.08, 0.10]`);
      t.expect(!!b3.bezel, 'bezelBounds computed');
      t.expect(b3.bezel.minX >= 0 && b3.bezel.maxX <= b3.bezel.W, `left/right walnut rails inside #boardwrap (${b3.bezel.minX.toFixed(1)}..${b3.bezel.maxX.toFixed(1)} of ${b3.bezel.W})`);
      t.expect(b3.bezel.minY >= 0 && b3.bezel.maxY <= b3.bezel.H, `top/bottom walnut rails inside #boardwrap (${b3.bezel.minY.toFixed(1)}..${b3.bezel.maxY.toFixed(1)} of ${b3.bezel.H})`);
      await t.shot('w1-b04-portrait-3d-bezel');
    },
  },
];

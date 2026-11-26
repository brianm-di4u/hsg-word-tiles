// Wave 4, batch W4-B24: WF-5 ui_ecosystem
// - W5-S1-08: already_done on pipeline/wave-4 by 801bfbf (W3-P-N02: body.no-art CSS overrides) and 2f4e95e (W4-S3-02: dark-espresso .pop pill).
// - W5-S2-03: font-variant-numeric: tabular-nums on secondary score readouts (.wscore, .fscore, .daily-stats b, #preview .pts, .log li em, .bests li b).
// - W5-S2-05: antique-brass Deco <select>/range chrome, inner brass hairlines on .card.dialog/.privacy-card, and UI.ICON topbar SVG consolidation.
import fs from 'node:fs';
import path from 'node:path';
import { root } from './lib.mjs';
import { ICON } from '../src/js/ui.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, theme: 'light' }));
  }
};
const CENTER = 112;

export const tests = [
  {
    name: 'W5-S2-03 secondary score readouts use font-variant-numeric: tabular-nums across Play, Final Soak, Daily Soak, and Records (preserving CD-WF5-03 hierarchy)',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.seed(7);
      await t.game('newGame', { seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
      await t.waitIdle(8000);

      // Put SPA in player's rack so Final Soak also renders a Hot Springs .wchip alongside .fchip (CD-WF5-03).
      const s0 = await t.state();
      s0.game.players[0].rack = ['S', 'P', 'A', 'T', 'E', 'R', 'N'];
      await t.game('setState', { game: s0.game });
      await t.waitIdle(4000);

      // 1) Staged preview (#preview .pts)
      await t.game('act', 'stage', [{ i: CENTER - 1, l: 'S' }, { i: CENTER, l: 'P' }, { i: CENTER + 1, l: 'A' }]);
      await t.waitFrames(2);
      const pvFvn = await t.page.evaluate(() => {
        const el = document.querySelector('#preview .pts');
        return el ? getComputedStyle(el).fontVariantNumeric : null;
      });
      t.expect(pvFvn && pvFvn.includes('tabular-nums'), `#preview .pts uses tabular-nums (got ${pvFvn})`);

      // 2) Committed play (#ledger .log li em)
      const r = await t.game('act', 'play');
      t.equal(r.ok, true, 'SPA played cleanly');
      await t.waitIdle(8000);
      const logFvn = await t.page.evaluate(() => {
        const els = [...document.querySelectorAll('#ledger .log li em')];
        return els.map((el) => getComputedStyle(el).fontVariantNumeric);
      });
      t.expect(logFvn.length > 0, `Steam ledger has score entries (${logFvn.length})`);
      for (const v of logFvn) t.expect(v.includes('tabular-nums'), `#ledger .log li em uses tabular-nums (got ${v})`);

      // 3) Final Soak (.wscore, .fscore) + CD-WF5-03 Limelight masthead & .wchip/.fchip preservation
      const s1 = await t.state();
      s1.game.scoreless = 3;
      await t.game('setState', { game: s1.game });
      await t.game('act', 'pass');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 6000 });
      await t.waitIdle(4000);
      const overInfo = await t.page.evaluate(() => {
        const ws = document.querySelector('.wscore');
        const fs = document.querySelector('.fscore');
        const mh = document.querySelector('.masthead h1');
        const wc = document.querySelector('.wchip');
        const fc = document.querySelector('.fchip');
        return {
          wscore: ws ? getComputedStyle(ws).fontVariantNumeric : null,
          fscore: fs ? getComputedStyle(fs).fontVariantNumeric : null,
          mastheadFont: mh ? getComputedStyle(mh).fontFamily : '',
          wchipBg: wc ? getComputedStyle(wc).backgroundImage : null,
          fchipBg: fc ? getComputedStyle(fc).backgroundColor : null,
        };
      });
      t.expect(overInfo.wscore && overInfo.wscore.includes('tabular-nums'), `Final Soak .wscore uses tabular-nums (got ${overInfo.wscore})`);
      t.expect(overInfo.fscore && overInfo.fscore.includes('tabular-nums'), `Final Soak .fscore uses tabular-nums (got ${overInfo.fscore})`);
      t.expect(/Limelight/i.test(overInfo.mastheadFont), `CD-WF5-03 Final Soak masthead preserves Limelight (${overInfo.mastheadFont})`);
      t.expect(overInfo.wchipBg && /gradient/.test(overInfo.wchipBg) && overInfo.fchipBg !== null, 'CD-WF5-03 gold .wchip and parchment .fchip hierarchy preserved');

      // 4) Records (.bests li b & .bests li b small) + CD-WF5-03 Fraunces sheet heading
      await t.game('scene', 'records');
      await t.waitIdle(4000);
      const recInfo = await t.page.evaluate(() => ({
        h1Font: getComputedStyle(document.querySelector('.sheet h1')).fontFamily,
        bests: [...document.querySelectorAll('.bests li b')].map((el) => getComputedStyle(el).fontVariantNumeric),
        bestSmalls: [...document.querySelectorAll('.bests li b small')].map((el) => getComputedStyle(el).fontVariantNumeric),
      }));
      t.expect(recInfo.bests.length >= 6, `Records .bests has ${recInfo.bests.length} entries`);
      for (const v of recInfo.bests) t.expect(v.includes('tabular-nums'), `Records .bests li b uses tabular-nums (got ${v})`);
      t.expect(recInfo.bestSmalls.length >= 1, 'Records .bests has <small> score detail');
      for (const v of recInfo.bestSmalls) t.expect(v.includes('tabular-nums'), `Records .bests li b small uses tabular-nums (got ${v})`);
      t.expect(/Fraunces/i.test(recInfo.h1Font) && !/Limelight/i.test(recInfo.h1Font), `CD-WF5-03 Records sheet h1 preserves Fraunces (${recInfo.h1Font})`);

      // 5) Daily Soak results (.daily-stats b)
      await t.game('newGame', { mode: 'daily', date: '2026-06-15' });
      await t.waitIdle(8000);
      const sd = await t.state();
      sd.game.daily.turns = 1;
      await t.game('setState', { game: sd.game });
      await t.game('act', 'pass');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 6000 });
      await t.waitIdle(4000);
      const dailyStats = await t.page.evaluate(() => [...document.querySelectorAll('.daily-stats b')].map((el) => getComputedStyle(el).fontVariantNumeric));
      t.equal(dailyStats.length, 3, 'Daily Soak results has 3 .daily-stats b readouts');
      for (const v of dailyStats) t.expect(v.includes('tabular-nums'), `Daily Soak .daily-stats b uses tabular-nums (got ${v})`);
    },
  },
  {
    name: 'W5-S2-05 src/index.html consolidates #b-menu, #b-zoomin, and #b-zoom SVGs into UI.ICON (Node)',
    node: true,
    async run(t) {
      const html = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
      for (const id of ['b-menu', 'b-zoomin', 'b-zoom', 'b-sound']) {
        const m = html.match(new RegExp(`<button[^>]*id="${id}"[^>]*>([\\s\\S]*?)</button>`));
        t.expect(!!m, `src/index.html contains #${id} button`);
        t.equal(m && /<svg\b/i.test(m[1]), false, `src/index.html #${id} has no hardcoded inline <svg>`);
      }
      t.expect(typeof ICON.menu === 'string' && ICON.menu.includes('<svg') && ICON.menu.includes('aria-hidden="true"'), 'UI.ICON.menu exports SVG');
      t.expect(typeof ICON.zoomIn === 'string' && ICON.zoomIn.includes('<svg') && ICON.zoomIn.includes('class="zin"') && ICON.zoomIn.includes('aria-hidden="true"'), 'UI.ICON.zoomIn exports SVG with .zin path');
      t.expect(typeof ICON.zoomOut === 'string' && ICON.zoomOut.includes('<svg') && ICON.zoomOut.includes('aria-hidden="true"'), 'UI.ICON.zoomOut exports SVG');
    },
  },
  {
    name: 'W5-S2-05 antique-brass Deco <select> & range chrome, inner brass hairlines on .card.dialog/.privacy-card, and UI.ICON topbar hydration (Day & Night)',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.seed(7);
      await t.game('newGame', { seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
      await t.waitIdle(8000);

      // 1) Topbar icons hydrated from UI.ICON and zoom +/- toggle preserved
      const icons = await t.page.evaluate(() => {
        const ids = ['b-menu', 'b-zoomin', 'b-zoom', 'b-sound'];
        const out = {};
        for (const id of ids) {
          const svg = document.querySelector(`#${id} svg`);
          out[id] = svg ? { hidden: svg.getAttribute('aria-hidden'), paths: svg.querySelectorAll('path, circle').length, hasZin: !!svg.querySelector('.zin') } : null;
        }
        return out;
      });
      for (const id of ['b-menu', 'b-zoomin', 'b-zoom', 'b-sound']) {
        t.expect(!!icons[id] && icons[id].paths >= 1, `#${id} renders hydrated SVG from UI.ICON`);
        t.equal(icons[id] && icons[id].hidden, 'true', `#${id} SVG has aria-hidden="true"`);
      }
      t.equal(icons['b-zoomin'] && icons['b-zoomin'].hasZin, true, '#b-zoomin SVG preserves .zin vertical bar');

      await t.game('act', 'zoom', 1.7);
      const zinOut = await t.page.evaluate(() => getComputedStyle(document.querySelector('#b-zoomin .zin')).display);
      t.equal(zinOut, 'none', '#b-zoomin[data-mode="out"] hides .zin bar');
      await t.game('act', 'zoom', 1);
      const zinIn = await t.page.evaluate(() => getComputedStyle(document.querySelector('#b-zoomin .zin')).display);
      t.expect(zinIn !== 'none', '#b-zoomin[data-mode="in"] restores .zin bar');

      // 2) Non-Pause .card.dialog inner brass hairlines (Swap & Tracker)
      const checkHairline = (sel) => t.page.evaluate((s) => {
        const el = document.querySelector(s);
        if (!el) return null;
        const b = getComputedStyle(el, '::before');
        return {
          pos: getComputedStyle(el).position,
          content: b.content,
          bPos: b.position,
          pe: b.pointerEvents,
          borderStyle: b.borderTopStyle,
          borderW: parseFloat(b.borderTopWidth),
          borderCol: b.borderTopColor,
          top: b.top,
        };
      }, sel);

      await t.game('act', 'open', 'swap');
      const swapFrame = await checkHairline('.card.dialog.swap');
      t.equal(swapFrame && swapFrame.pos, 'relative', 'Swap .card.dialog is position:relative');
      t.expect(swapFrame && swapFrame.content !== 'none' && swapFrame.borderStyle === 'solid' && swapFrame.borderW >= 1, `Swap .card.dialog::before renders 1px brass hairline (${JSON.stringify(swapFrame)})`);
      t.equal(swapFrame && swapFrame.pe, 'none', 'Swap .card.dialog::before has pointer-events:none');
      t.equal((await t.contrastReport({ selector: '#modal', min: 4.5, largeMin: 3 })).fails.length, 0, 'Day Swap dialog passes contrast');
      if (t.viewport === 'desktop') await t.shot('w4-b24-dialog-swap-day');
      await t.checkLayout();
      await t.game('act', 'close');

      await t.game('act', 'open', 'tracker');
      const tkFrame = await checkHairline('.card.dialog.tracker');
      t.expect(tkFrame && tkFrame.content !== 'none' && tkFrame.borderStyle === 'solid' && tkFrame.borderW >= 1, `Tracker .card.dialog::before renders 1px brass hairline (${JSON.stringify(tkFrame)})`);
      await t.game('act', 'close');

      // 3) .privacy-card inner brass hairline + CD-WF5-02 blur(10px) preservation
      await t.game('newGame', { seats: [{ kind: 'human', name: 'Ann' }, { kind: 'human', name: 'Bo' }] });
      await t.waitIdle(6000);
      const privFrame = await checkHairline('.privacy-card');
      const privBackdrop = await t.page.evaluate(() => getComputedStyle(document.querySelector('#privacy')).backdropFilter);
      t.equal(privFrame && privFrame.pos, 'relative', '.privacy-card is position:relative');
      t.expect(privFrame && privFrame.content !== 'none' && privFrame.borderStyle === 'solid' && privFrame.borderW >= 1, `.privacy-card::before renders 1px brass hairline (${JSON.stringify(privFrame)})`);
      t.equal(privFrame && privFrame.pe, 'none', '.privacy-card::before has pointer-events:none');
      t.expect(/blur\(10px\)/.test(privBackdrop || ''), `CD-WF5-02 #privacy preserves blur(10px) (${privBackdrop})`);
      if (t.viewport === 'desktop') await t.shot('w4-b24-privacy-day');

      // 4) Setup <select> antique-brass chevron chrome (Day)
      await t.game('scene', 'setup');
      await t.waitIdle(4000);
      await t.page.click('.house-rules summary');
      const selDay = await t.page.evaluate(() => {
        const els = [...document.querySelectorAll('.field select')];
        return els.map((el) => {
          const cs = getComputedStyle(el);
          return {
            appearance: cs.appearance,
            bgImg: cs.backgroundImage,
            padR: parseFloat(cs.paddingRight),
            h: el.getBoundingClientRect().height,
            borderCol: cs.borderTopColor,
          };
        });
      });
      t.expect(selDay.length >= 2, `Setup has ${selDay.length} styled <select> controls`);
      for (const s of selDay) {
        t.equal(s.appearance, 'none', 'Day <select> uses appearance:none');
        t.expect(/data:image\/svg\+xml/i.test(s.bgImg), `Day <select> uses custom SVG brass chevron (${s.bgImg.slice(0, 60)})`);
        t.expect(s.padR >= 32, `Day <select> leaves right padding for chevron (${s.padR}px)`);
        t.expect(s.h >= 44, `Day <select> meets >=44px touch floor (${s.h}px)`);
      }
      t.equal((await t.contrastReport({ selector: '.house-rules', min: 4.5, largeMin: 3 })).fails.length, 0, 'Day Setup House rules passes contrast');
      await t.shot('w4-b24-setup-select-day');
      await t.checkLayout();

      // 5) Settings <input type="range"> antique-brass Deco chrome + live --p sync (Day)
      await t.game('scene', 'settings');
      await t.waitIdle(4000);
      const rngDay = await t.page.evaluate(() => [...document.querySelectorAll('.setrow input[type="range"]')].map((el) => {
        const cs = getComputedStyle(el);
        return {
          id: el.id,
          appearance: cs.appearance,
          h: el.getBoundingClientRect().height,
          pVar: el.style.getPropertyValue('--p').trim(),
          out: document.querySelector(`output[for="${el.id}"]`)?.textContent?.trim(),
        };
      }));
      t.equal(rngDay.length, 4, 'Settings has all 4 styled range sliders');
      for (const r of rngDay) {
        t.equal(r.appearance, 'none', `${r.id} uses appearance:none`);
        t.expect(r.h >= 44, `${r.id} meets >=44px touch floor (${r.h}px)`);
        t.equal(r.pVar, r.out, `${r.id} inline --p (${r.pVar}) matches <output> (${r.out})`);
      }
      await t.page.evaluate(() => {
        const el = document.querySelector('#set-vol');
        el.value = '0.65';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      const volLive = await t.page.evaluate(() => ({
        pVar: document.querySelector('#set-vol').style.getPropertyValue('--p').trim(),
        out: document.querySelector('output[for="set-vol"]').textContent.trim(),
      }));
      t.equal(volLive.pVar, '65%', '#set-vol --p updates live to 65% on input');
      t.equal(volLive.out, '65%', '#set-vol <output> updates live to 65% on input');
      t.equal((await t.contrastReport({ selector: '.sheet.settings', min: 4.5, largeMin: 3 })).fails.length, 0, 'Day Settings passes contrast');
      await t.shot('w4-b24-settings-range-day');
      await t.checkLayout();

      // 6) Night theme: Settings range, Setup <select> light-gold chevron, and Swap .card.dialog hairline
      await t.page.click('[data-set="theme"][data-val="dark"]');
      await t.waitIdle(4000);
      t.equal((await t.contrastReport({ selector: '.sheet.settings', min: 4.5, largeMin: 3 })).fails.length, 0, 'Night Settings passes contrast');
      if (t.viewport === 'desktop') await t.shot('w4-b24-settings-range-night');

      await t.game('scene', 'setup');
      await t.waitIdle(4000);
      if (await t.page.evaluate(() => !document.querySelector('.house-rules').open)) {
        await t.page.click('.house-rules summary');
      }
      await t.page.evaluate(() => document.querySelector('.house-rules').scrollIntoView({ block: 'center' }));
      const selNight = await t.page.evaluate(() => {
        const el = document.querySelector('.field select');
        const cs = getComputedStyle(el);
        return { appearance: cs.appearance, bgImg: cs.backgroundImage };
      });
      t.equal(selNight.appearance, 'none', 'Night <select> keeps appearance:none');
      t.expect(/data:image\/svg\+xml/i.test(selNight.bgImg) && /F3DD8B/i.test(selNight.bgImg), `Night <select> uses bright antique-gold chevron (${selNight.bgImg.slice(0, 80)})`);
      t.equal((await t.contrastReport({ selector: '.house-rules', min: 4.5, largeMin: 3 })).fails.length, 0, 'Night Setup House rules passes contrast');
      if (t.viewport === 'desktop') await t.shot('w4-b24-setup-select-night');

      await t.game('newGame', { seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
      await t.waitIdle(6000);
      await t.game('act', 'open', 'swap');
      const nightSwap = await checkHairline('.card.dialog.swap');
      t.expect(nightSwap && nightSwap.content !== 'none' && nightSwap.borderStyle === 'solid' && nightSwap.borderW >= 1, `Night Swap .card.dialog::before renders 1px brass hairline (${JSON.stringify(nightSwap)})`);
      if (t.viewport === 'desktop') await t.shot('w4-b24-dialog-swap-night');
      await t.game('act', 'close');
    },
  },
];

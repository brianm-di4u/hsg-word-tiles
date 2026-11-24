// Wave 2, batch W2-B04: W2-S5-08, W2-S1-07, W2-S2-02, W2-S2-03.
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
  // ---------- W2-S5-08 ----------
  {
    name: 'W2-S5-08 dead bathGlyph/BATH_COLORS and tile-glaze code removed from render2d.js',
    node: true,
    async run(t) {
      const src = fs.readFileSync(path.join(root, 'src/js/render2d.js'), 'utf8');
      t.equal(/bathGlyph\s*\(/.test(src), false, 'dead bathGlyph() removed from src/js/render2d.js');
      t.equal(/BATH_COLORS/.test(src), false, 'dead BATH_COLORS removed from src/js/render2d.js');
      t.equal(/tile-glaze/.test(src), false, 'dead tile-glaze check removed from src/js/render2d.js');
    },
  },
  {
    name: 'W2-S5-08 Help -> Squares displays a real painted Bathhouse Row medallion inside the octagonal bezel + +20 pip, and board hover showcases the medallion',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('scene', 'help');
      await t.page.click('[data-tab="squares"]');
      await t.waitFrames(2);

      const helpRow = await t.page.evaluate(() => {
        const sq = document.querySelector('.legend .sq-B');
        const img = sq && sq.querySelector('img.row-med');
        const bez = sq && sq.querySelector('.row-bez');
        const pip = sq && sq.querySelector('.row-pip');
        const oldIcon = sq && sq.querySelector('i.row');
        return {
          found: !!sq,
          hasImg: !!img,
          imgSrc: img ? img.getAttribute('src') : '',
          imgLoaded: !!img && img.complete && img.naturalWidth > 0,
          bezClip: bez ? getComputedStyle(bez).clipPath : '',
          pipText: pip ? pip.textContent.trim() : '',
          hasOldIcon: !!oldIcon,
        };
      });
      t.equal(helpRow.found, true, 'Help -> Squares renders .sq-B swatch');
      t.equal(helpRow.hasOldIcon, false, 'retired i.row vector-only arch icon replaced');
      t.equal(helpRow.hasImg, true, 'Help -> Squares displays real painted Bathhouse Row medallion <img>');
      t.expect(/bath-/.test(helpRow.imgSrc), `Help -> Squares uses painted bath-*.webp asset (${helpRow.imgSrc})`);
      t.equal(helpRow.imgLoaded, true, 'painted Bathhouse Row medallion thumbnail loaded cleanly');
      t.expect(/polygon/.test(helpRow.bezClip), `Help -> Squares wraps medallion in octagonal bezel (${helpRow.bezClip})`);
      t.equal(helpRow.pipText, '+20', 'Help -> Squares includes crisp +20 corner pip');

      const cDay = await t.contrastReport({ selector: '.help', min: 4.5, largeMin: 3 });
      t.equal(cDay.fails.length, 0, 'Help -> Squares passes Day WCAG contrast (' + JSON.stringify(cDay.fails) + ')');
      await t.shot('W2-S5-08-help-squares');

      // Desktop hover on a Bathhouse Row square showcases its painted medallion in #preview
      if (t.viewport === 'desktop') {
        await t.game('newGame', { seed: 3 });
        await t.waitIdle(6000);
        const pt = await t.game('act', 'screen', 8); // Superior Bathhouse (cell 8)
        await t.page.mouse.move(pt[0], pt[1]);
        await t.waitFrames(2);
        const hov = await t.page.evaluate(() => {
          const prev = document.querySelector('#preview');
          const img = prev && prev.querySelector('.preview-bath img.row-med');
          return {
            text: prev ? prev.textContent.trim() : '',
            hasImg: !!img,
            src: img ? img.getAttribute('src') : '',
          };
        });
        t.expect(/Superior Bathhouse/.test(hov.text), `hovering cell 8 describes Superior Bathhouse (${hov.text})`);
        t.equal(hov.hasImg, true, 'hovering Bathhouse Row square showcases painted medallion thumbnail in #preview');
        t.expect(/bath-superior/.test(hov.src), `medallion thumbnail matches hovered bathhouse (${hov.src})`);
      }
    },
  },
  // ---------- W2-S1-07 ----------
  {
    name: 'W2-S1-07 landscape phone (844x390, 568x320) clears inner brass frame and compact desktop (1024x600) + 1280x800 keep full menu above fold with Continue',
    viewports: ['desktop'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      const fixture = await t.page.evaluate(() => fetch('test-fixtures/save-v1-earned-play.json').then((r) => r.text()));
      await t.page.evaluate((raw) => localStorage.setItem('hs-letters-save-v1', raw), fixture);
      await t.reload(); await ready(t);

      const measure = async (w, h) => {
        await t.page.setViewportSize({ width: w, height: h });
        await t.waitFrames(2);
        return t.page.evaluate(() => {
          const card = document.querySelector('.title-card');
          const words = document.querySelector('.title-words');
          const kicker = words.querySelector('.kicker');
          const h1 = words.querySelector('h1');
          const cr = card.getBoundingClientRect();
          const kr = kicker.getBoundingClientRect();
          const hr = h1.getBoundingClientRect();
          const btns = [...document.querySelectorAll('.title .menu button')].map((b) => ({
            text: b.textContent.trim().slice(0, 20),
            h: b.getBoundingClientRect().height,
            bot: b.getBoundingClientRect().bottom,
          }));
          return {
            W: innerWidth, H: innerHeight,
            containerType: getComputedStyle(card).containerType,
            padTop: parseFloat(getComputedStyle(words).paddingTop),
            kickerGap: kr.top - cr.top,
            h1LeftGap: hr.left - cr.left,
            h1RightGap: cr.right - hr.right,
            h1BotGap: cr.bottom - hr.bottom,
            cardH: cr.height,
            menuBottom: Math.max(...btns.map((b) => b.bot)),
            minBtnH: Math.min(...btns.map((b) => b.h)),
            belowFold: btns.filter((b) => b.bot > innerHeight + 0.5).map((b) => b.text),
            hasContinue: !!document.querySelector('[data-go="continue"]'),
          };
        });
      };

      // 1) Landscape phone 844x390 & 568x320: inner brass frame clearance (8px inset) + container-type: inline-size
      for (const [w, h] of [[844, 390], [568, 320]]) {
        const m = await measure(w, h);
        t.equal(m.containerType, 'inline-size', `${w}x${h}: .title-card uses inline-size container queries`);
        t.equal(m.padTop, 16, `${w}x${h}: .title-words restores 16px top padding`);
        t.expect(m.kickerGap >= 15, `${w}x${h}: kicker clears inner brass border (${m.kickerGap.toFixed(1)} >= 15 px)`);
        t.expect(m.h1LeftGap >= 12 && m.h1RightGap >= 12 && m.h1BotGap >= 12, `${w}x${h}: h1 clears inner frame on all sides (L=${m.h1LeftGap.toFixed(1)}, R=${m.h1RightGap.toFixed(1)}, B=${m.h1BotGap.toFixed(1)})`);
        t.expect(m.minBtnH >= 44, `${w}x${h}: all title buttons >= 44 px (${m.minBtnH.toFixed(1)} px)`);
        if (w === 844) await t.shot('W2-S1-07-title-844x390');
      }

      // 2) Small laptop 1024x600 with Continue: FULL menu sits above the fold
      const m1024 = await measure(1024, 600);
      t.equal(m1024.hasContinue, true, '1024x600: Continue button present');
      t.expect(m1024.belowFold.length === 0, `1024x600: full menu sits above 600 px fold (menuBottom=${m1024.menuBottom.toFixed(1)}, below=${JSON.stringify(m1024.belowFold)})`);
      t.expect(m1024.kickerGap >= 15 && m1024.h1RightGap >= 12, `1024x600: title typography stays inside inner brass frame`);
      t.expect(m1024.minBtnH >= 44, `1024x600: all title buttons >= 44 px (${m1024.minBtnH.toFixed(1)} px)`);
      await t.shot('W2-S1-07-title-1024x600');

      // 3) Standard desktop 1280x800 with Continue: FULL menu sits above 800 px fold & card capped <= 380 px
      const m1280 = await measure(1280, 800);
      t.equal(m1280.hasContinue, true, '1280x800: Continue button present');
      t.expect(m1280.cardH <= 380.5, `1280x800: .title-card capped <= 380 px (${m1280.cardH.toFixed(1)} px)`);
      t.expect(m1280.belowFold.length === 0, `1280x800: full menu sits above 800 px fold (menuBottom=${m1280.menuBottom.toFixed(1)}, below=${JSON.stringify(m1280.belowFold)})`);
      await t.shot('W2-S1-07-title-1280x800');

      await t.page.setViewportSize({ width: t.vp.width, height: t.vp.height });
    },
  },
];

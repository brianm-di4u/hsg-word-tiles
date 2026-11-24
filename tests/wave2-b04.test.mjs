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
];

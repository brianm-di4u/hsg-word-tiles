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
  // ---------- W2-S2-02 ----------
  {
    name: 'W2-S2-02 Premium Springs encode explicit 2L/3L/2W/3W tags with circular Letter vs chamfered-octagonal Word badges on board and in Help',
    viewports: ['desktop', 'mobile'],
    url: 'index.html?gl=0',
    initScript: quiet,
    async run(t) {
      await ready(t);
      // 1) Help -> How to play worked example & Help -> Squares swatches match 2L/3L/2W/3W and circle vs octagon shapes
      await t.game('scene', 'help');
      const egTags = await t.page.evaluate(() => [...document.querySelectorAll('.example .sq i')].map((el) => el.textContent.trim()));
      t.equal(JSON.stringify(egTags), JSON.stringify(['2L', '2W']), `worked example renders explicit 2L and 2W tags (${JSON.stringify(egTags)})`);

      await t.page.click('[data-tab="squares"]');
      await t.waitFrames(2);
      const helpSwatches = await t.page.evaluate(() => ['w', 'h', 's', 'b'].map((k) => {
        const el = document.querySelector(`.legend .sq-${k} i`);
        const cs = el && getComputedStyle(el);
        return { k, text: el ? el.textContent.trim() : '', radius: cs ? cs.borderRadius : '', clip: cs ? cs.clipPath : '' };
      }));
      t.equal(JSON.stringify(helpSwatches.map((x) => x.text)), JSON.stringify(['2L', '3L', '2W', '3W']), 'Help -> Squares prints explicit 2L/3L/2W/3W');
      for (const s of helpSwatches) {
        if (s.k === 'w' || s.k === 'h') {
          t.expect(/50%/.test(s.radius) && s.clip === 'none', `Letter spring ${s.k} uses circular badge (radius=${s.radius}, clip=${s.clip})`);
        } else {
          t.expect(/polygon/.test(s.clip), `Word spring ${s.k} uses chamfered-octagonal badge (clip=${s.clip})`);
        }
      }
      const cDay = await t.contrastReport({ selector: '.help', min: 4.5, largeMin: 3 });
      t.equal(cDay.fails.length, 0, 'Help -> Squares 2L/3L/2W/3W passes Day WCAG contrast (' + JSON.stringify(cDay.fails) + ')');
      await t.shot('W2-S2-02-help-squares');

      // 2) Board texture: verify PREMIUM mults are 2L/3L/2W/3W, stained glass preserved beneath (CD-WF2-04),
      //    and Word badge outer chamfer differs cleanly from Letter circular badge at diagonal corners.
      await t.game('newGame', { seed: 3 });
      await t.waitIdle(6000);
      const boardCheck = await t.page.evaluate(async () => {
        const base = (f) => new URL('src/js/' + f, location.href).href;
        const R = await import(base('render2d.js'));
        const { SQUARE } = await import(base('score.js'));
        const mults = { w: R.PREMIUM.w.mult, h: R.PREMIUM.h.mult, s: R.PREMIUM.s.mult, b: R.PREMIUM.b.mult };
        const size = 2048, cell = size / R.U, f = R.FRAME * cell, gap = Math.max(1, cell * 0.035), w = cell - gap;
        const cv = R.paintBoard(size, 'light'), ctx = cv.getContext('2d');
        const inspectSq = (code) => {
          const i = SQUARE.indexOf(code), r = Math.floor(i / 15), c = i % 15;
          const cx = f + c * cell + gap / 2 + w / 2, cy = f + r * cell + gap / 2 + w / 2;
          // Center interior of badge vs outer stained-glass corner (0.40 * cell)
          const center = ctx.getImageData(Math.round(cx - cell * 0.18), Math.round(cy - cell * 0.14), Math.round(cell * 0.36), Math.round(cell * 0.28)).data;
          // At 45 deg diagonal: circle of r=0.34 stops at 0.34*cos(45)=0.240; octagon of r=0.36 with cut=0.28 reaches (1-0.28)*0.36 = 0.259 along x+y=0.518 -> diagonal radius = 0.366!
          // Sample diagonal point at distance 0.352 * cell from center (outside 0.34 circle, INSIDE 0.36 octagon brass rim!)
          const dpt = Math.round(cell * 0.352 * Math.SQRT1_2);
          const diag = ctx.getImageData(Math.round(cx + dpt) - 2, Math.round(cy + dpt) - 2, 5, 5).data;
          let diagDarkOrGold = 0, diagN = 0;
          for (let j = 0; j < diag.length; j += 4) {
            diagN++;
            const Rr = diag[j], Gg = diag[j + 1], Bb = diag[j + 2];
            if ((Rr < 80 && Gg < 70 && Bb < 55) || (Rr > 190 && Gg > 155 && Bb < 120)) diagDarkOrGold++;
          }
          // Sample outer stained-glass rim at 0.40 * cell straight above center (outside 0.36 badge, inside 0.44 glass disc)
          const glass = ctx.getImageData(Math.round(cx - 4), Math.round(cy - cell * 0.42), 8, 6).data;
          let sat = 0, gn = 0;
          for (let j = 0; j < glass.length; j += 4) { sat += Math.max(glass[j], glass[j + 1], glass[j + 2]) - Math.min(glass[j], glass[j + 1], glass[j + 2]); gn++; }
          return { diagRatio: diagDarkOrGold / diagN, glassSat: sat / gn, centerPx: center.length / 4 };
        };
        return { mults, w: inspectSq('w'), h: inspectSq('h'), s: inspectSq('s'), b: inspectSq('b') };
      });
      t.equal(JSON.stringify(boardCheck.mults), JSON.stringify({ w: '2L', h: '3L', s: '2W', b: '3W' }), 'PREMIUM table encodes 2L/3L/2W/3W');
      t.expect(boardCheck.w.glassSat > 25 && boardCheck.h.glassSat > 25 && boardCheck.s.glassSat > 25 && boardCheck.b.glassSat > 25, `stained-glass art preserved beneath all 4 spring types (CD-WF2-04: sat=${boardCheck.w.glassSat.toFixed(1)},${boardCheck.h.glassSat.toFixed(1)},${boardCheck.s.glassSat.toFixed(1)},${boardCheck.b.glassSat.toFixed(1)})`);
      t.expect(boardCheck.s.diagRatio >= 0.4 && boardCheck.b.diagRatio >= 0.4, `Word springs (2W/3W) extend chamfered octagon into diagonal radius 0.352 (s=${boardCheck.s.diagRatio.toFixed(2)}, b=${boardCheck.b.diagRatio.toFixed(2)})`);
      if (t.viewport === 'desktop') await t.shot('W2-S2-02-board-springs');
    },
  },
];

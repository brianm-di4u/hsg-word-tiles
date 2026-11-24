// Wave 1, batch W1-B05 item 1 (W6-S5-01): modal/privacy inert + Tab focus trap + G.returnFocus
// restoration (preserving instant 0 ms blur(10px) #privacy per CD-WF5-02), sheet <h1> tabindex="-1"
// and single active <main> / sr-only <h1> landmarks, mobile .chip player-name labels + human seat
// numerals (hiding .badge i only on painted AI portraits), and dashed crimson + corner-tick badCells
// populated for all !G.preview.ok errors.
import { CENTER, N } from '../src/js/score.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const instant = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false }));
  }
};

export const tests = [
  {
    name: 'W6-S5-01 landmarks (<main>, sr-only <h1>) and sheet <h1 tabindex="-1"> focus',
    viewports: ['desktop'],
    initScript: instant,
    async run(t) {
      await ready(t);
      // Title: #screen is the sole visible <main>
      const titleLm = await t.page.evaluate(() => ({
        visibleMains: [...document.querySelectorAll('main')].filter((m) => !m.hidden).map((m) => m.id),
      }));
      t.equal(titleLm.visibleMains.join(','), 'screen', 'Title exposes exactly one visible <main> (#screen)');

      // Every sheet receives focus on its <h1 tabindex="-1"> (Setup has .primary later in DOM, so h1 comes first)
      for (const scene of ['setup', 'help', 'settings', 'register', 'records', 'about']) {
        await t.game('scene', scene);
        const info = await t.page.evaluate(() => {
          const h1 = document.querySelector('#screen h1');
          return {
            tabIndex: h1 ? h1.getAttribute('tabindex') : null,
            focused: document.activeElement === h1,
            tag: document.activeElement ? document.activeElement.tagName : null,
          };
        });
        t.equal(info.tabIndex, '-1', `${scene}: sheet <h1> carries tabindex="-1"`);
        t.equal(info.focused, true, `${scene}: sheet <h1> receives programmatic focus (got ${info.tag})`);
      }

      // Game scene: #app is the sole visible <main> and exposes sr-only <h1>
      await t.game('newGame', { seed: 2 });
      await t.waitIdle(6000);
      const gameLm = await t.page.evaluate(() => {
        const mains = [...document.querySelectorAll('main')].filter((m) => !m.hidden).map((m) => m.id);
        const h1 = document.querySelector('#app h1.sr-only');
        return { mains, h1Text: h1 ? h1.textContent.trim() : '' };
      });
      t.equal(gameLm.mains.join(','), 'app', 'Game scene exposes exactly one visible <main> (#app)');
      t.equal(gameLm.h1Text, 'Bathhouse Letters', 'Game scene exposes sr-only <h1>');
    },
  },
  {
    name: 'W6-S5-01 #modal and #privacy inert, Tab/Shift+Tab trap, G.returnFocus restoration & CD-WF5-02 0 ms blur(10px)',
    viewports: ['desktop'],
    initScript: instant,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 2 });
      await t.waitIdle(6000);

      // Focus #b-menu, open Pause modal via click, verify inert + Tab wrap + synchronous G.returnFocus restoration
      await t.page.focus('#b-menu');
      await t.page.click('#b-menu');
      const modalOpen = await t.page.evaluate(() => {
        const app = document.querySelector('#app');
        const scr = document.querySelector('#screen');
        const modal = document.querySelector('#modal');
        const btns = [...modal.querySelectorAll('button:not([disabled])')];
        return {
          appInert: app.inert,
          scrInert: scr.inert,
          firstText: btns[0] ? btns[0].textContent.trim() : '',
          lastText: btns[btns.length - 1] ? btns[btns.length - 1].textContent.trim() : '',
          activeInside: modal.contains(document.activeElement),
          activeText: document.activeElement ? document.activeElement.textContent.trim() : '',
        };
      });
      t.equal(modalOpen.appInert, true, '#app is inert while #modal is open');
      t.equal(modalOpen.scrInert, true, '#screen is inert while #modal is open');
      t.equal(modalOpen.activeInside, true, 'focus moves inside #modal on open');

      // Shift+Tab from first button wraps to last button inside #modal
      await t.page.keyboard.press('Shift+Tab');
      const wrappedBack = await t.page.evaluate(() => ({
        inside: document.querySelector('#modal').contains(document.activeElement),
        text: document.activeElement ? document.activeElement.textContent.trim() : '',
      }));
      t.equal(wrappedBack.inside, true, 'Shift+Tab stays trapped inside #modal');
      t.equal(wrappedBack.text, modalOpen.lastText, 'Shift+Tab wraps from first to last focusable control');

      // Tab from last button wraps back to first button inside #modal
      await t.page.keyboard.press('Tab');
      const wrappedFwd = await t.page.evaluate(() => ({
        inside: document.querySelector('#modal').contains(document.activeElement),
        text: document.activeElement ? document.activeElement.textContent.trim() : '',
      }));
      t.equal(wrappedFwd.inside, true, 'Tab stays trapped inside #modal');
      t.equal(wrappedFwd.text, modalOpen.firstText, 'Tab wraps from last to first focusable control');

      // Escape closes #modal synchronously (0 ms) and restores focus to #b-menu
      await t.page.keyboard.press('Escape');
      const afterClose = await t.page.evaluate(() => ({
        dialog: window.__G.dialog,
        modalHidden: document.querySelector('#modal').hidden,
        appInert: document.querySelector('#app').inert,
        scrInert: document.querySelector('#screen').inert,
        activeId: document.activeElement ? document.activeElement.id : '',
      }));
      t.equal(afterClose.dialog, null, 'closeDialog() clears G.dialog synchronously');
      t.equal(afterClose.modalHidden, true, '#modal hides synchronously');
      t.equal(afterClose.appInert, false, '#app inert cleared synchronously');
      t.equal(afterClose.scrInert, false, '#screen inert cleared synchronously');
      t.equal(afterClose.activeId, 'b-menu', 'G.returnFocus restored focus to #b-menu');

      // Non-game openFact (Register -> Fact card): inert + Tab trap + focus restoration back to Register item
      await t.page.evaluate(() => {
        localStorage.setItem('hs-letters-register-v1', JSON.stringify({ SPRING: { id: 'spring', first: '2026-11-20', count: 1, best: 24 } }));
      });
      await t.game('scene', 'register');
      await t.page.focus('[data-reg="spring"]');
      await t.page.click('[data-reg="spring"]');
      const regModal = await t.page.evaluate(() => ({
        scrInert: document.querySelector('#screen').inert,
        inside: document.querySelector('#modal').contains(document.activeElement),
      }));
      t.equal(regModal.scrInert, true, 'Register Fact Card sets #screen inert');
      t.equal(regModal.inside, true, 'Register Fact Card focuses inside #modal');
      await t.page.keyboard.press('Escape');
      const regRestored = await t.page.evaluate(() => ({
        scrInert: document.querySelector('#screen').inert,
        reg: document.activeElement ? document.activeElement.getAttribute('data-reg') : '',
      }));
      t.equal(regRestored.scrInert, false, 'closing Register Fact Card clears #screen inert');
      t.equal(regRestored.reg, 'spring', 'closing Register Fact Card restores focus to [data-reg="spring"]');

      // Pass-and-Play #privacy: role="dialog" aria-modal="true", instant 0 ms blur(10px), inert, Tab trap, focus on [data-reveal]
      await t.game('newGame', { seed: 2, seats: [{ kind: 'human', name: 'Player 1' }, { kind: 'human', name: 'Player 2' }] });
      await t.waitIdle(6000);
      const priv = await t.page.evaluate(() => {
        const el = document.querySelector('#privacy');
        const cs = getComputedStyle(el);
        return {
          hidden: el.hidden,
          role: el.getAttribute('role'),
          ariaModal: el.getAttribute('aria-modal'),
          backdrop: cs.backdropFilter || cs.webkitBackdropFilter || '',
          transition: cs.transitionDuration,
          animation: cs.animationName,
          appInert: document.querySelector('#app').inert,
          scrInert: document.querySelector('#screen').inert,
          revealFocused: document.activeElement === el.querySelector('[data-reveal]'),
        };
      });
      t.equal(priv.hidden, false, '#privacy opens immediately for Pass-and-Play');
      t.equal(priv.role, 'dialog', '#privacy has role="dialog"');
      t.equal(priv.ariaModal, 'true', '#privacy has aria-modal="true"');
      t.expect(/blur\(10px\)/.test(priv.backdrop), `#privacy preserves blur(10px) backdrop (${priv.backdrop})`);
      t.equal(priv.animation, 'none', '#privacy has 0 ms instant concealment (CD-WF5-02)');
      t.equal(priv.appInert, true, '#app is inert while #privacy is open');
      t.equal(priv.scrInert, true, '#screen is inert while #privacy is open');
      t.equal(priv.revealFocused, true, '[data-reveal] is focused when #privacy opens');
      await t.page.keyboard.press('Tab');
      const privTrap = await t.page.evaluate(() => document.querySelector('#privacy').contains(document.activeElement));
      t.equal(privTrap, true, 'Tab stays trapped inside #privacy');
      await t.page.click('#privacy [data-reveal]');
      const afterReveal = await t.page.evaluate(() => ({
        hidden: document.querySelector('#privacy').hidden,
        appInert: document.querySelector('#app').inert,
      }));
      t.equal(afterReveal.hidden, true, '#privacy closes immediately on reveal');
      t.equal(afterReveal.appInert, false, '#app inert cleared immediately on reveal');
    },
  },
  {
    name: 'W6-S5-01 mobile .chip player-name labels & human seat numerals vs painted AI portraits',
    viewports: ['mobile'],
    initScript: instant,
    async run(t) {
      await ready(t);
      // 1) Pass-and-Play with two default-named humans ("Player 1", "Player 2")
      await t.game('newGame', { seed: 2, seats: [{ kind: 'human', name: 'Player 1' }, { kind: 'human', name: 'Player 2' }] });
      await t.waitIdle(6000);
      await t.game('act', 'reveal');
      const pnp = await t.page.evaluate(() => [...document.querySelectorAll('#turnline .chip')].map((ch) => {
        const num = ch.querySelector('.badge i');
        const mono = ch.querySelector('.badge b');
        const sr = ch.querySelector('.sr-only');
        return {
          ariaLabel: ch.getAttribute('aria-label') || '',
          srText: sr ? sr.textContent.trim() : '',
          mono: mono ? mono.textContent.trim() : '',
          numText: num ? num.textContent.trim() : '',
          numVisible: !!num && getComputedStyle(num).display !== 'none',
        };
      }));
      t.equal(pnp.length, 2, 'two mobile score chips rendered');
      t.expect(/Player 1/.test(pnp[0].ariaLabel) && pnp[0].srText === 'Player 1', 'chip 0 carries Player 1 name label');
      t.expect(/Player 2/.test(pnp[1].ariaLabel) && pnp[1].srText === 'Player 2', 'chip 1 carries Player 2 name label');
      t.equal(pnp[0].mono, 'P1', 'Player 1 monogram formats as P1');
      t.equal(pnp[1].mono, 'P2', 'Player 2 monogram formats as P2');
      t.equal(pnp[0].numVisible && pnp[0].numText === '1', true, 'human chip 0 keeps visible seat numeral 1');
      t.equal(pnp[1].numVisible && pnp[1].numText === '2', true, 'human chip 1 keeps visible seat numeral 2');
      await t.shot('w1-b05-mobile-pnp-chips');

      // 2) Human vs painted AI portrait: human keeps seat numeral, painted AI hides .badge i
      await t.game('newGame', { seed: 2, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'hollis', level: 'medium' }] });
      await t.waitIdle(6000);
      const vsAi = await t.page.evaluate(() => [...document.querySelectorAll('#turnline .chip')].map((ch) => {
        const badge = ch.querySelector('.badge');
        const num = ch.querySelector('.badge i');
        const hasImg = !!ch.querySelector('.badge img');
        return {
          ariaLabel: ch.getAttribute('aria-label') || '',
          hasImg,
          hasFaceClass: badge ? badge.classList.contains('has-face') : false,
          numVisible: !!num && getComputedStyle(num).display !== 'none',
        };
      }));
      t.equal(vsAi.length, 2, 'human + AI chips rendered');
      t.expect(/You/.test(vsAi[0].ariaLabel) && vsAi[0].numVisible, 'human chip keeps name label and visible seat numeral');
      t.expect(/Hollis Crane/.test(vsAi[1].ariaLabel), 'AI chip carries Hollis Crane name label');
      t.equal(vsAi[1].hasImg && vsAi[1].hasFaceClass, true, 'AI chip carries painted portrait with .has-face');
      t.equal(vsAi[1].numVisible, false, 'painted AI portrait hides .badge i');
    },
  },
  {
    name: 'W6-S5-01 badCells populated for all !G.preview.ok errors with dashed crimson borders & corner ticks',
    viewports: ['desktop'],
    url: 'index.html?gl=0',
    initScript: instant,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 2 });
      await t.waitIdle(6000);
      const s = await t.state();
      // Place two tiles OFF the centre square (row 0, cols 0-1) -> non-dictionary placement error (!p.ok, no p.words/p.badWord)
      const [l0, l1] = s.game.players[0].rack.map((ch) => (ch === '?' ? 'A' : ch));
      await t.game('act', 'stage', [
        { i: 0, l: l0, blank: s.game.players[0].rack[0] === '?' },
        { i: 1, l: l1, blank: s.game.players[0].rack[1] === '?' },
      ]);
      await t.waitFrames(2);
      const offCentre = await t.page.evaluate(() => {
        const cv = document.querySelector('#board');
        const ctx = cv.getContext('2d');
        const rect = cv.getBoundingClientRect();
        const dpr = cv.width / rect.width;
        return window.__game.act('cell', 0).then(([cx, cy]) => {
          const cellPx = Math.min(rect.width, rect.height) / 15.76;
          // Sample top edge of cell 0 for dashed crimson segments (both crimson and non-crimson pixels along the border)
          const yTop = Math.round((cy - cellPx * 0.47) * dpr);
          const xStart = Math.round((cx - cellPx * 0.44) * dpr);
          const xEnd = Math.round((cx + cellPx * 0.44) * dpr);
          let redTop = 0, gapTop = 0;
          const row = ctx.getImageData(xStart, Math.max(0, yTop - 2), Math.max(4, xEnd - xStart), 5).data;
          const w = Math.max(4, xEnd - xStart);
          for (let x = 0; x < w; x++) {
            let hasRed = false;
            for (let dy = 0; dy < 5; dy++) {
              const off = (dy * w + x) * 4;
              if (row[off] > 140 && row[off + 1] < 75 && row[off + 2] < 65) hasRed = true;
            }
            if (hasRed) redTop++; else gapTop++;
          }
          // Sample interior top-left corner tick diagonal around (0.14, 0.14) of cell 0
          const tx = Math.round((cx - cellPx * 0.34) * dpr);
          const ty = Math.round((cy - cellPx * 0.34) * dpr);
          const tickData = ctx.getImageData(Math.max(0, tx - 4), Math.max(0, ty - 4), 9, 9).data;
          let tickRed = 0;
          for (let i = 0; i < tickData.length; i += 4) {
            if (tickData[i] > 140 && tickData[i + 1] < 75 && tickData[i + 2] < 65) tickRed++;
          }
          return { ok: window.__G.preview && window.__G.preview.ok, err: window.__G.preview && window.__G.preview.error, redTop, gapTop, tickRed };
        });
      });
      t.equal(offCentre.ok, false, 'off-centre placement produces !G.preview.ok');
      t.expect(offCentre.redTop > 4 && offCentre.gapTop > 2, `off-centre badCells renders dashed crimson border (red=${offCentre.redTop}, gaps=${offCentre.gapTop})`);
      t.expect(offCentre.tickRed > 0, `off-centre badCells renders diagonal corner warning tick (${offCentre.tickRed} red px)`);
      await t.shot('w1-b05-badcells-dashed');
      await t.game('act', 'recall');
    },
  },
];

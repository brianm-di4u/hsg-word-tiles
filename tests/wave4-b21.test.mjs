// Wave 4, batch W4-B21: WF-5 input_accessibility
// - W5-P-N05: Active game view <main id="app"> + <h1 class="sr-only"> (from 9c7d5cf) and boot() in-place .title-art / .loading patching without wiping title DOM, focus, or scroll
// - W5-S2-22: Mirror aria-label into title tooltips on #b-menu, #b-zoomin, #b-zoom, and #b-sound (updating sound/zoom on state toggles)
// - W5-S5-06: Frosted .stile.blank + ICON.steam in swapHtml() (preserving aria-label="Blank") and (blank) markers + 1-line Your rack summary in boardTextHtml()
import { swapHtml, boardTextHtml, ICON } from '../src/js/ui.js';
import { CENTER, N } from '../src/js/score.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });

const watchBootTitle = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false }));
  }
  window.__bootProbe = { screenRebuilds: 0, captured: false, sawLoading: false, root: null, focusBtn: null, wantedScroll: 0 };
  const captureFirst = (scr) => {
    const root = scr.querySelector('.title');
    const btn = scr.querySelector('[data-go="records"]');
    if (!window.__bootProbe.captured && root && btn) {
      window.__bootProbe.captured = true;
      window.__bootProbe.root = root;
      window.__bootProbe.focusBtn = btn;
      window.__bootProbe.sawLoading = !!scr.querySelector('.loading');
      root.style.paddingBottom = '600px';
      scr.scrollTop = 120;
      window.__bootProbe.wantedScroll = scr.scrollTop;
      btn.focus({ preventScroll: true });
    }
  };
  let screenObs = null;
  const attach = () => {
    const scr = document.getElementById('screen');
    if (!scr || screenObs) return !!screenObs;
    screenObs = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.target === scr && m.addedNodes.length) {
          window.__bootProbe.screenRebuilds++;
          captureFirst(scr);
        }
      }
    });
    screenObs.observe(scr, { childList: true });
    if (scr.querySelector('.title')) {
      window.__bootProbe.screenRebuilds++;
      captureFirst(scr);
    }
    return true;
  };
  const docObs = new MutationObserver(() => { if (attach()) docObs.disconnect(); });
  docObs.observe(document, { childList: true, subtree: true });
};

export const tests = [
  {
    name: 'W5-P-N05 boot patches .title-art and removes .loading in place without rebuilding #screen, dropping focus, or resetting scroll (and preserves <main>/<h1> landmarks)',
    viewports: ['desktop', 'mobile'],
    initScript: watchBootTitle,
    async run(t) {
      await ready(t);
      await t.waitIdle(15000);
      const res = await t.page.evaluate(() => {
        const scr = document.getElementById('screen');
        const p = window.__bootProbe;
        const curRoot = scr.querySelector('.title');
        const curArt = scr.querySelector('.title-art');
        const visibleMains = [...document.querySelectorAll('main')].filter((m) => !m.hidden).map((m) => m.id);
        return {
          captured: p.captured,
          sawLoading: p.sawLoading,
          screenRebuilds: p.screenRebuilds,
          sameRoot: curRoot === p.root,
          btnConnected: !!(p.focusBtn && p.focusBtn.isConnected),
          focusPreserved: document.activeElement === p.focusBtn,
          wantedScroll: p.wantedScroll,
          scrollTop: scr.scrollTop,
          loadingGone: scr.querySelector('.loading') === null,
          artTag: curArt ? curArt.tagName : null,
          painted: !!(curRoot && curRoot.classList.contains('painted')),
          visibleMains,
        };
      });
      t.equal(res.captured, true, 'captured initial title mount before async boot callbacks settled');
      t.equal(res.sawLoading, true, 'initial title mount displayed .loading status');
      t.equal(res.loadingGone, true, 'loadDict completion removed .loading in place');
      t.equal(res.screenRebuilds, 1, `boot rebuilt #screen only once (initial mount), not on loadArt/loadDict (got ${res.screenRebuilds})`);
      t.equal(res.sameRoot, true, '.title DOM root stayed intact across loadArt and loadDict');
      t.equal(res.btnConnected, true, 'focused menu button remained connected (never wiped by innerHTML)');
      t.equal(res.focusPreserved, true, 'keyboard focus stayed on [data-go="records"] across boot callbacks');
      t.expect(res.wantedScroll > 0 && res.scrollTop === res.wantedScroll, `#screen.scrollTop preserved (${res.scrollTop} === ${res.wantedScroll})`);
      t.equal(res.artTag, 'IMG', '.title-art renders painted <img>');
      t.equal(res.painted, true, '.title carries .painted class');
      t.equal(res.visibleMains.join(','), 'screen', 'Title exposes single unhidden <main> (#screen)');

      // Verify active game view still holds single unhidden <main id="app"> + <h1 class="sr-only"> (from 9c7d5cf)
      await t.game('newGame', { seed: 2 });
      await t.waitIdle(6000);
      const gameLm = await t.page.evaluate(() => ({
        visibleMains: [...document.querySelectorAll('main')].filter((m) => !m.hidden).map((m) => m.id),
        h1Text: document.querySelector('#app h1.sr-only')?.textContent?.trim() || '',
      }));
      t.equal(gameLm.visibleMains.join(','), 'app', 'Active game exposes single unhidden <main> (#app)');
      t.equal(gameLm.h1Text, 'Bathhouse Letters', 'Active game exposes sr-only <h1>Bathhouse Letters</h1>');
    },
  },
  {
    name: 'W5-S2-22 icon-only topbar controls mirror aria-label into title tooltips and sync on sound/zoom toggle',
    viewports: ['desktop', 'mobile'],
    initScript: () => {
      window.__TEST_TIPS__ = false;
      localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false }));
    },
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 2 });
      await t.waitIdle(6000);
      const readControls = () => t.page.evaluate(() => {
        const out = {};
        for (const id of ['b-menu', 'b-zoomin', 'b-zoom', 'b-sound']) {
          const el = document.getElementById(id);
          out[id] = el ? { aria: el.getAttribute('aria-label'), title: el.getAttribute('title') } : null;
        }
        return out;
      });
      const initial = await readControls();
      t.equal(initial['b-menu'].title, 'Menu (Esc)', '#b-menu title matches Menu (Esc)');
      t.equal(initial['b-menu'].title, initial['b-menu'].aria, '#b-menu title mirrors aria-label');
      t.equal(initial['b-zoom'].title, 'Show the whole board', '#b-zoom title matches Show the whole board');
      t.equal(initial['b-zoom'].title, initial['b-zoom'].aria, '#b-zoom title mirrors aria-label');
      t.equal(initial['b-zoomin'].title, 'Zoom in on the board', '#b-zoomin initial title matches Zoom in on the board');
      t.equal(initial['b-zoomin'].title, initial['b-zoomin'].aria, '#b-zoomin initial title mirrors aria-label');
      t.equal(initial['b-sound'].title, 'Sound off (click to unmute)', '#b-sound initial title reflects muted state');
      t.equal(initial['b-sound'].title, initial['b-sound'].aria, '#b-sound initial title mirrors aria-label');

      // Toggle sound on -> title and aria-label both update
      await t.page.click('#b-sound');
      const soundOn = await readControls();
      t.equal(soundOn['b-sound'].title, 'Sound on (click to mute)', '#b-sound title updates when unmuted');
      t.equal(soundOn['b-sound'].title, soundOn['b-sound'].aria, '#b-sound title mirrors aria-label after toggle on');
      await t.page.click('#b-sound');
      const soundOff = await readControls();
      t.equal(soundOff['b-sound'].title, 'Sound off (click to unmute)', '#b-sound title updates when muted again');

      // Toggle zoom -> #b-zoomin title and aria-label both update
      await t.game('act', 'zoom', 1.7);
      const zoomedIn = await readControls();
      t.equal(zoomedIn['b-zoomin'].title, 'Show the whole board', '#b-zoomin title updates to Show the whole board when zoomed');
      t.equal(zoomedIn['b-zoomin'].title, zoomedIn['b-zoomin'].aria, '#b-zoomin title mirrors aria-label when zoomed');
      t.equal(zoomedIn['b-zoom'].title, 'Show the whole board', '#b-zoom keeps Show the whole board title when visible');
      await t.game('act', 'zoom', 1);
      const zoomedOut = await readControls();
      t.equal(zoomedOut['b-zoomin'].title, 'Zoom in on the board', '#b-zoomin title returns to Zoom in on the board at 1x');
      t.equal(zoomedOut['b-zoomin'].title, zoomedOut['b-zoomin'].aria, '#b-zoomin title mirrors aria-label at 1x');
    },
  },
  {
    name: 'W5-S5-06 swapHtml blank steam emblem and boardTextHtml (blank) markers + Your rack summary (Node)',
    node: true,
    async run(t) {
      const sw = swapHtml(['S', '?', 'A']);
      t.expect(sw.includes('class="stile blank"'), 'swapHtml marks blank tile with .stile.blank');
      t.expect(sw.includes('aria-label="Blank"'), 'swapHtml preserves aria-label="Blank"');
      t.expect(sw.includes(ICON.steam), 'swapHtml renders UI.ICON.steam inside blank tile');
      t.expect(sw.includes('class="stile" data-sw="0" aria-pressed="false" aria-label="S">S</button>'), 'non-blank swap tiles stay plain letter buttons');

      const board = new Array(N * N).fill(null);
      board[CENTER - 1] = { l: 'S', blank: false };
      board[CENTER] = { l: 'P', blank: true };
      board[CENTER + 1] = { l: 'A', blank: false };
      const s = { board, cur: 0, players: [{ kind: 'human', name: 'You', rack: ['T', '?', 'E', 'R'] }] };
      const staged = [{ k: 0, i: CENTER + N, l: 'T', blank: false }, { k: 1, i: CENTER + 2 * N, l: 'O', blank: true }];
      const bt = boardTextHtml(s, staged);
      t.expect(bt.includes('H8 P (blank)'), 'boardTextHtml annotates played blank tile with (blank)');
      t.expect(bt.includes('G8 S, H8 P (blank), I8 A'), 'non-blank played tiles omit (blank)');
      t.expect(bt.includes('H9 T (not played yet)'), 'non-blank staged tile omits (blank)');
      t.expect(bt.includes('H10 O (blank) (not played yet)'), 'staged blank tile shows both (blank) and (not played yet)');
      t.expect(bt.includes('<p class="bt-rack"><b>Your rack:</b> E, R</p>'), 'boardTextHtml includes 1-line Your rack summary excluding staged tiles');

      const btBlankRack = boardTextHtml(s, [], ['S', '?', 'A']);
      t.expect(btBlankRack.includes('<p class="bt-rack"><b>Your rack:</b> S, Blank, A</p>'), 'Your rack labels ? as Blank');

      const btHidden = boardTextHtml(s, [], null);
      t.expect(!btHidden.includes('bt-rack'), 'explicit null rack (privacy / AI-only) omits Your rack line');
    },
  },
  {
    name: 'W5-S5-06 Swap dialog frosted blank tile (Day & Night) and Read the board (blank) + Your rack in browser',
    viewports: ['desktop', 'mobile'],
    initScript: () => {
      window.__TEST_TIPS__ = false;
      localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, theme: 'light' }));
    },
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 2, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'hollis' }] });
      await t.waitIdle(6000);
      const st = await t.state();
      st.game.players[0].rack = ['S', '?', 'A', 'T', 'E', 'R', 'N'];
      st.game.board[CENTER - 1] = { l: 'S', blank: false };
      st.game.board[CENTER] = { l: 'P', blank: true };
      st.game.board[CENTER + 1] = { l: 'A', blank: false };
      await t.game('setState', { game: st.game });
      await t.waitIdle(4000);

      // 1) Swap dialog in Day: blank tile has .blank, steam SVG, frosted sea-glass distinct from cream tile, aria-label="Blank"
      await t.game('act', 'open', 'swap');
      const daySwap = await t.page.evaluate(() => {
        const reg = document.querySelector('#modal .stile[data-sw="0"]');
        const blk = document.querySelector('#modal .stile.blank[data-sw="1"]');
        const svg = blk && blk.querySelector('svg');
        const rcs = reg && getComputedStyle(reg), bcs = blk && getComputedStyle(blk);
        return {
          hasBlank: !!blk,
          hasSvg: !!svg,
          svgHidden: svg ? svg.getAttribute('aria-hidden') : null,
          aria: blk ? blk.getAttribute('aria-label') : null,
          regBg: rcs && rcs.backgroundImage,
          blkBg: bcs && bcs.backgroundImage,
          blkCol: bcs && bcs.color,
        };
      });
      t.equal(daySwap.hasBlank, true, 'Day Swap renders blank tile with .stile.blank');
      t.equal(daySwap.hasSvg, true, 'Day Swap renders steam SVG inside blank tile');
      t.equal(daySwap.svgHidden, 'true', 'steam SVG inside blank tile is aria-hidden="true"');
      t.equal(daySwap.aria, 'Blank', 'Day Swap blank tile preserves aria-label="Blank"');
      t.expect(daySwap.blkBg !== daySwap.regBg && /gradient/.test(daySwap.blkBg || ''), `Day .stile.blank frosted background differs from cream .stile (${daySwap.blkBg})`);
      await t.page.click('#modal .stile.blank[data-sw="1"]');
      const selSwap = await t.page.evaluate(() => {
        const blk = document.querySelector('#modal .stile.blank[data-sw="1"]');
        return { pressed: blk.getAttribute('aria-pressed'), bg: getComputedStyle(blk).backgroundImage };
      });
      t.equal(selSwap.pressed, 'true', 'blank tile toggles aria-pressed="true" in Swap dialog');
      t.expect(selSwap.bg !== daySwap.blkBg, 'selected blank tile transitions cleanly to selected highlight');
      await t.page.click('#modal .stile.blank[data-sw="1"]'); // unselect so screenshot shows frosted sea-glass blank beside cream tiles
      if (t.viewport === 'desktop') await t.shot('w4-b21-swap-blank-day');
      await t.checkLayout();
      await t.game('act', 'close');

      // 2) Swap dialog in Night: frosted dark sea-glass distinct from Night .stile
      await t.game('scene', 'settings');
      await t.page.click('[data-set="theme"][data-val="dark"]');
      await t.game('scene', 'game');
      await t.waitIdle(4000);
      await t.game('act', 'open', 'swap');
      const nightSwap = await t.page.evaluate(() => {
        const reg = document.querySelector('#modal .stile[data-sw="0"]');
        const blk = document.querySelector('#modal .stile.blank[data-sw="1"]');
        const rcs = reg && getComputedStyle(reg), bcs = blk && getComputedStyle(blk);
        return { regBg: rcs && rcs.backgroundImage, blkBg: bcs && bcs.backgroundImage, blkCol: bcs && bcs.color };
      });
      t.expect(nightSwap.blkBg !== nightSwap.regBg && /gradient/.test(nightSwap.blkBg || ''), `Night .stile.blank frosted dark sea-glass differs from Night .stile (${nightSwap.blkBg})`);
      if (t.viewport === 'desktop') await t.shot('w4-b21-swap-blank-night');
      await t.game('act', 'close');
      await t.game('scene', 'settings');
      await t.page.click('[data-set="theme"][data-val="light"]');
      await t.game('scene', 'game');
      await t.waitIdle(4000);

      // 3) Read the board: played blank (H8 P (blank)), staged blank (H9 O (blank) (not played yet)), 1-line Your rack, still exactly 15 row <li> items
      await t.game('act', 'stage', [{ i: CENTER + N, l: 'O', blank: true }]);
      await t.game('act', 'open', 'boardtext');
      const bt = await t.page.evaluate(() => {
        const rows = [...document.querySelectorAll('.boardtext li')].map((li) => li.textContent);
        const rack = document.querySelector('.boardtext .bt-rack')?.textContent || '';
        return { rows, rack };
      });
      t.equal(bt.rows.length, 15, 'Read the board keeps exactly 15 row list items');
      t.expect(bt.rows[7].includes('G8 S, H8 P (blank), I8 A'), `Row 8 marks played blank (${bt.rows[7]})`);
      t.expect(bt.rows[8].includes('H9 O (blank) (not played yet)'), `Row 9 marks staged blank (${bt.rows[8]})`);
      t.equal(bt.rack, 'Your rack: S, A, T, E, R, N', `Read the board shows 1-line Your rack summary (${bt.rack})`);
      await t.shot('w4-b21-boardtext');
      await t.checkLayout();
      await t.game('act', 'close');

      // 4) Pass-and-Play privacy curtain: opening Read the board before reveal never leaks the hidden player's rack
      await t.game('newGame', { seed: 2, seats: [{ kind: 'human', name: 'Ann' }, { kind: 'human', name: 'Bo' }] });
      await t.waitIdle(5000);
      await t.game('act', 'open', 'boardtext');
      const hiddenRack = await t.page.evaluate(() => document.querySelector('.boardtext .bt-rack'));
      t.equal(hiddenRack, null, 'Read the board omits Your rack while Pass-and-Play privacy screen is up');
      await t.game('act', 'close');
    },
  },
];

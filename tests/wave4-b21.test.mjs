// Wave 4, batch W4-B21: WF-5 input_accessibility
// - W5-P-N05: Active game view <main id="app"> + <h1 class="sr-only"> (from 9c7d5cf) and boot() in-place .title-art / .loading patching without wiping title DOM, focus, or scroll
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
];

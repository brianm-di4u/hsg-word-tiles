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
];

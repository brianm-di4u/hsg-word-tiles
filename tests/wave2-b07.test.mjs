// Wave 2, batch W2-B07: W2-P-N02 (1024x600 desktop #coach overflow-y: auto & compact padding preventing
// #coach over #preview collision in 2P/4P at 100% and 130% text size, completing Wave 1 c153702) and
// W2-S3-03 (interactive zoomed minimap tap/drag panning with zero click pass-through, 3D B3.boardAt()
// frustum viewport polygon, and hiding redundant in-canvas #b-zoom when #b-zoomin is visible).

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const withTips = () => {
  window.__TEST_TIPS__ = true;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, tipsSeen: false }));
  }
};
const TWO_SEATS = [
  { kind: 'human', name: 'You' },
  { kind: 'ai', persona: 'opal', level: 'easy' },
];
const FOUR_SEATS = [
  ...TWO_SEATS,
  { kind: 'ai', persona: 'hollis', level: 'medium' },
  { kind: 'ai', persona: 'julian', level: 'hard' },
];

export const tests = [
  {
    name: 'W2-P-N02 desktop 1024x600 with #coach active (2P & 4P, 100% & 130%): zero #coach over #preview collision, #actions unclipped',
    viewports: ['desktop'],
    initScript: withTips,
    async run(t) {
      await ready(t);
      await t.page.setViewportSize({ width: 1024, height: 600 });

      const checkCase = async (label, seats, textScale, stageMove, shotName) => {
        await t.page.evaluate((ts) => {
          const s = JSON.parse(localStorage.getItem('hs-letters-settings-v1') || '{}');
          s.text = ts;
          s.tipsSeen = false;
          localStorage.setItem('hs-letters-settings-v1', JSON.stringify(s));
        }, textScale);
        await t.reload();
        await ready(t);
        await t.game('newGame', { seed: 5, seats });
        await t.waitIdle(8000);
        for (let k = 0; k < 2; k++) { await t.page.evaluate(() => dispatchEvent(new Event('resize'))); await t.waitFrames(1); }
        if (stageMove) {
          const [mv] = await t.game('act', 'moves', 1);
          await t.game('act', 'stage', mv.tiles);
          await t.waitFrames(2);
        }
        const m = await t.page.evaluate(() => {
          const coach = document.querySelector('#coach');
          const card = document.querySelector('#coach .coach-card');
          const prev = document.querySelector('#preview');
          const bw = document.querySelector('#boardwrap');
          const sc = document.querySelector('#scores');
          const acts = [...document.querySelectorAll('#actions .abtn')];
          const coachBtns = [...document.querySelectorAll('#coach button')];
          const cr = coach.getBoundingClientRect();
          const pr = prev.getBoundingClientRect();
          const bwr = bw.getBoundingClientRect();
          const ccs = getComputedStyle(coach);
          const scs = getComputedStyle(sc);
          return {
            W: innerWidth,
            H: innerHeight,
            hasCard: !!card,
            coachOverflowY: ccs.overflowY,
            coachTop: cr.top,
            coachBottom: cr.bottom,
            coachScrollH: coach.scrollHeight,
            coachClientH: coach.clientHeight,
            previewTop: pr.top,
            previewBottom: pr.bottom,
            previewLeft: pr.left,
            boardRight: bwr.right,
            boardHeight: bwr.height,
            scoresCols: scs.gridTemplateColumns.split(' ').filter(Boolean).length,
            coachBtnMinH: coachBtns.length ? Math.min(...coachBtns.map((b) => b.getBoundingClientRect().height)) : 0,
            acts: acts.map((b) => ({ act: b.dataset.act, h: b.getBoundingClientRect().height, b: b.getBoundingClientRect().bottom, r: b.getBoundingClientRect().right })),
          };
        });
        t.equal(m.hasCard, true, `${label}: #coach card is visible`);
        t.equal(m.coachOverflowY, 'auto', `${label}: #coach uses overflow-y: auto`);
        t.expect(m.coachBottom <= m.previewTop + 0.5, `${label}: #coach bottom (${m.coachBottom.toFixed(1)}) does not collide over #preview top (${m.previewTop.toFixed(1)})`);
        t.expect(m.coachBtnMinH >= 44, `${label}: #coach buttons >= 44 px (${m.coachBtnMinH.toFixed(1)} px)`);
        t.equal(m.scoresCols, 2, `${label}: desktop 1024x600 #scores stays 2-column grid`);
        t.expect(m.previewLeft >= m.boardRight - 1, `${label}: CD-WF5-01 #preview stays in right sidebar`);
        t.expect(m.boardHeight >= 470, `${label}: CD-WF5-01 1024x600 board keeps >= 470 px height (${Math.round(m.boardHeight)} px)`);
        for (const a of m.acts) {
          t.expect(a.h >= 44, `${label}: .abtn[${a.act}] >= 44 px (${a.h.toFixed(1)})`);
          t.expect(a.b <= m.H + 0.5 && a.r <= m.W + 0.5, `${label}: .abtn[${a.act}] unclipped (bottom ${a.b.toFixed(1)} <= ${m.H})`);
        }
        const ok = await t.contrastReport({ selector: '#coach', min: 4.5, largeMin: 3 });
        t.equal(ok.fails.length, 0, `${label}: #coach contrast >= 4.5:1 (${JSON.stringify(ok.fails)})`);
        if (shotName) await t.shot(shotName);
      };

      await checkCase('1024x600 2P 100%', TWO_SEATS, 1, false, null);
      await checkCase('1024x600 4P 100%', FOUR_SEATS, 1, false, 'W2-P-N02-1024x600-4p-coach-100');
      await checkCase('1024x600 4P 130%', FOUR_SEATS, 1.3, false, 'W2-P-N02-1024x600-4p-coach-130');
      await checkCase('1024x600 4P 130% staged', FOUR_SEATS, 1.3, true, null);
      await t.page.setViewportSize({ width: t.vp.width, height: t.vp.height });
    },
  },
  {
    name: 'W2-S3-03 mobile zoomed minimap: tap/drag panning, zero click pass-through, 3D B3.boardAt() frustum polygon, and #b-zoom hidden when #b-zoomin is visible',
    viewports: ['mobile'],
    initScript: () => {
      window.__TEST_TIPS__ = false;
      if (!localStorage.getItem('hs-letters-settings-v1')) {
        localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false }));
      }
    },
    async run(t) {
      await ready(t);
      await t.seed(5);
      await t.game('newGame', { seats: TWO_SEATS });
      await t.waitIdle(8000);

      // Zoom in via #b-zoomin in #topbar
      await t.page.click('#b-zoomin');
      await t.page.waitForFunction(() => window.__game.getState().view.zoom > 1.65, null, { timeout: 5000 });
      await t.waitFrames(3);

      // 1) Redundant in-canvas #b-zoom stays hidden whenever #b-zoomin is visible in #topbar
      const zoomBtns = await t.page.evaluate(() => ({
        zoominVis: getComputedStyle(document.querySelector('#b-zoomin')).display !== 'none',
        zoomHidden: document.querySelector('#b-zoom').hidden,
        zoomDisplay: getComputedStyle(document.querySelector('#b-zoom')).display,
      }));
      t.equal(zoomBtns.zoominVis, true, 'portrait mobile shows #b-zoomin in #topbar');
      t.equal(zoomBtns.zoomHidden, true, 'redundant in-canvas #b-zoom has hidden=true on mobile');
      t.equal(zoomBtns.zoomDisplay, 'none', 'redundant in-canvas #b-zoom has display:none on mobile');

      // 2) Minimap viewport polygon uses B3.boardAt() corners in 3D mode (or rect in 2D fallback)
      const st0 = await t.state();
      const boardRect = await t.page.evaluate(() => {
        const r = document.querySelector('#board').getBoundingClientRect();
        return { left: r.left, top: r.top, width: r.width, height: r.height };
      });
      const mm0 = (await t.game('act', 'minimap')) || { on: st0.view.zoom > 1.2, box: { x0: 10, y0: boardRect.height - 84, S: 74 }, view: null };
      t.equal(mm0.on, true, 'minimap is active when zoomed > 1.2');
      t.expect(!!mm0.view, 'minimap viewport recorded');
      if (st0.view.mode3d) {
        t.equal(mm0.view && mm0.view.kind, 'poly', '3D mode computes minimap viewport polygon from B3.boardAt() corners');
        if (mm0.view && mm0.view.pts) {
          t.equal(mm0.view.pts.length, 4, '3D minimap viewport has 4 frustum corners');
          const [tl, tr, br, bl] = mm0.view.pts;
          const topW = Math.hypot(tr[0] - tl[0], tr[1] - tl[1]);
          const botW = Math.hypot(br[0] - bl[0], br[1] - bl[1]);
          t.expect(topW > botW + 0.05, `3D perspective frustum top width (${topW.toFixed(2)}) > bottom width (${botW.toFixed(2)})`);
        }
      } else {
        t.equal(mm0.view && mm0.view.kind, 'rect', '2D fallback computes orthographic rect');
      }
      await t.shot('W2-S3-03-mobile-zoomed');

      // 3) Zero pass-through when a rack tile is selected: tapping top-right of minimap pans camera without staging
      await t.page.evaluate(() => {
        const b = document.querySelector('#rack .rtile');
        b.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
      });
      await t.waitFrames(1);
      const trX = boardRect.left + mm0.box.x0 + mm0.box.S * 0.82;
      const trY = boardRect.top + mm0.box.y0 + mm0.box.S * 0.18;
      await t.page.mouse.click(trX, trY);
      await t.waitFrames(3);
      const afterTap = await t.state();
      t.equal(afterTap.staged.length, 0, 'tapping minimap with selected tile does NOT stage onto occluded board cell');
      t.expect(afterTap.view.cx > st0.view.cx + 1.5, `minimap tap panned cx right (${st0.view.cx.toFixed(2)} -> ${afterTap.view.cx.toFixed(2)})`);
      t.expect(afterTap.view.cy < st0.view.cy - 1.5, `minimap tap panned cy up (${st0.view.cy.toFixed(2)} -> ${afterTap.view.cy.toFixed(2)})`);

      // 4) Dragging inside minimap smoothly pans camera to top-left corner
      const tlX = boardRect.left + mm0.box.x0 + mm0.box.S * 0.15;
      const tlY = boardRect.top + mm0.box.y0 + mm0.box.S * 0.18;
      await t.page.mouse.move(trX, trY);
      await t.page.mouse.down();
      await t.page.mouse.move((trX + tlX) / 2, trY, { steps: 4 });
      await t.page.mouse.move(tlX, tlY, { steps: 4 });
      await t.page.mouse.up();
      await t.waitFrames(3);
      const afterDrag = await t.state();
      t.expect(afterDrag.view.cx < afterTap.view.cx - 3, `dragging minimap panned cx left (${afterTap.view.cx.toFixed(2)} -> ${afterDrag.view.cx.toFixed(2)})`);
      await t.shot('W2-S3-03-mobile-panned');

      // 5) Zero pass-through onto an occluded STAGED tile sitting behind the minimap
      await t.game('act', 'zoom', 1.9, 7.88, 7.88);
      await t.waitFrames(3);
      const mm1 = (await t.game('act', 'minimap')) || { box: { x0: 10, y0: boardRect.height - 84, S: 74 } };
      const midX = mm1.box.x0 + mm1.box.S * 0.5;
      const midY = mm1.box.y0 + mm1.box.S * 0.5;
      const occludedCell = await t.game('act', 'cellAt', midX, midY);
      t.expect(occludedCell >= 0, `found real board cell (${occludedCell}) occluded beneath minimap center`);
      const rack0 = (await t.state()).game.players[0].rack[0];
      const stageTile = rack0 === '?' ? { i: occludedCell, l: 'A', blank: true } : { i: occludedCell, l: rack0 };
      const stRes = await t.game('act', 'stage', [stageTile]);
      t.equal(stRes.ok, true, 'staged tile onto cell occluded by minimap');
      await t.waitFrames(2);
      // Click directly on the minimap pixel right over that occluded staged tile
      await t.page.mouse.click(boardRect.left + midX, boardRect.top + midY);
      await t.waitFrames(3);
      const afterOccludedTap = await t.state();
      t.equal(afterOccludedTap.staged.length, 1, 'tapping minimap over an occluded staged tile does NOT unstage it');
      t.equal(afterOccludedTap.staged[0].i, occludedCell, 'occluded staged tile stays on its square');
      await t.game('act', 'recall');

      // 6) Landscape 568x320 also hides redundant #b-zoom while #b-zoomin is visible
      await t.page.setViewportSize({ width: 568, height: 320 });
      for (let k = 0; k < 2; k++) { await t.page.evaluate(() => dispatchEvent(new Event('resize'))); await t.waitFrames(1); }
      const landBtns = await t.page.evaluate(() => ({
        zoominVis: getComputedStyle(document.querySelector('#b-zoomin')).display !== 'none',
        zoomHidden: document.querySelector('#b-zoom').hidden,
        zoomDisplay: getComputedStyle(document.querySelector('#b-zoom')).display,
      }));
      t.equal(landBtns.zoominVis, true, 'landscape 568x320 shows #b-zoomin');
      t.equal(landBtns.zoomHidden, true, 'landscape 568x320 hides #b-zoom');
      t.equal(landBtns.zoomDisplay, 'none', 'landscape 568x320 display:none on #b-zoom');
      await t.page.setViewportSize({ width: t.vp.width, height: t.vp.height });
    },
  },
  {
    name: 'W2-S3-03 desktop zoomed minimap: mouse click/drag panning, zero occluded hover leak, and #b-zoom stays visible when #b-zoomin is hidden',
    viewports: ['desktop'],
    initScript: () => {
      window.__TEST_TIPS__ = false;
      if (!localStorage.getItem('hs-letters-settings-v1')) {
        localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false }));
      }
    },
    async run(t) {
      await ready(t);
      await t.seed(5);
      await t.game('newGame', { seats: TWO_SEATS });
      await t.waitIdle(8000);
      await t.game('act', 'zoom', 1.8, 7.88, 7.88);
      await t.waitFrames(3);

      const deskBtns = await t.page.evaluate(() => ({
        zoominVis: getComputedStyle(document.querySelector('#b-zoomin')).display !== 'none',
        zoomHidden: document.querySelector('#b-zoom').hidden,
        zoomDisplay: getComputedStyle(document.querySelector('#b-zoom')).display,
      }));
      t.equal(deskBtns.zoominVis, false, 'desktop wide hides #b-zoomin');
      t.equal(deskBtns.zoomHidden, false, 'desktop wide keeps #b-zoom visible when zoomed');
      t.expect(deskBtns.zoomDisplay !== 'none', 'desktop wide #b-zoom is rendered');

      const st0 = await t.state();
      const boardRect = await t.page.evaluate(() => {
        const r = document.querySelector('#board').getBoundingClientRect();
        return { left: r.left, top: r.top, height: r.height };
      });
      const mm = (await t.game('act', 'minimap')) || { box: { x0: 10, y0: boardRect.height - 84, S: 74 }, view: null };

      // Hover over minimap: pointer cursor, no occluded-square tooltip leak
      const mx = boardRect.left + mm.box.x0 + mm.box.S * 0.82;
      const my = boardRect.top + mm.box.y0 + mm.box.S * 0.82;
      await t.page.mouse.move(mx, my);
      await t.waitFrames(2);
      const hoverCursor = await t.page.evaluate(() => document.querySelector('#board').style.cursor);
      t.equal(hoverCursor, 'pointer', 'hovering desktop minimap sets pointer cursor');

      // Click bottom-right of minimap: pans camera down-right
      await t.page.mouse.click(mx, my);
      await t.waitFrames(3);
      const st1 = await t.state();
      t.expect(st1.view.cx > st0.view.cx + 1.5 && st1.view.cy > st0.view.cy + 1.5, `desktop minimap click panned down-right (${st0.view.cx.toFixed(1)},${st0.view.cy.toFixed(1)} -> ${st1.view.cx.toFixed(1)},${st1.view.cy.toFixed(1)})`);
      if (st1.view.mode3d) {
        const mm3 = await t.game('act', 'minimap');
        t.equal(mm3 && mm3.view && mm3.view.kind, 'poly', 'desktop 3D minimap uses B3.boardAt() frustum polygon');
      }
      await t.shot('W2-S3-03-desktop-zoomed');

      // Click #b-zoom: zooms back out to 1 and hides #b-zoom
      await t.page.click('#b-zoom');
      await t.page.waitForFunction(() => document.querySelector('#b-zoom').hidden, null, { timeout: 5000 });
      t.equal((await t.state()).view.zoom, 1, 'desktop #b-zoom zooms back out to whole board');
    },
  },
];

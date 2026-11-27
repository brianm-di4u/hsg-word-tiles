// Wave 1, batch W1-B05 item 2 (W6-S5-02): desktop 1024x600 2-column compaction (3-4P & 130% text)
// preserving 2-column 90% board priority (CD-WF5-01), live '+pts' badge on #actions .play, landscape
// .title-words safe padding (16px 18px 8px) + container-scaled h1 + capped .title-card max-height,
// Records .opp-table native table layout + .stats.cols4, and root html font-size: calc(100% * var(--ts))
// fixing 130% rem scaling inversion.

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const instant = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false }));
  }
};
const FOUR_SEATS = [
  { kind: 'human', name: 'You' },
  { kind: 'ai', persona: 'opal', level: 'easy' },
  { kind: 'ai', persona: 'hollis', level: 'medium' },
  { kind: 'ai', persona: 'julian', level: 'hard' },
];

export const tests = [
  {
    name: 'W6-S5-02 desktop 1024x600 4-player & 130% text: 2-column board priority, 2-col #scores, unclipped #actions, live +pts badge on .play',
    viewports: ['desktop'],
    initScript: instant,
    async run(t) {
      await ready(t);
      await t.page.setViewportSize({ width: 1024, height: 600 });
      await t.game('newGame', { seed: 5, seats: FOUR_SEATS });
      await t.waitIdle(8000);
      for (let k = 0; k < 2; k++) { await t.page.evaluate(() => dispatchEvent(new Event('resize'))); await t.waitFrames(1); }

      const m100 = await t.page.evaluate(() => {
        const bw = document.querySelector('#boardwrap').getBoundingClientRect();
        const sc = document.querySelector('#scores');
        const scCs = getComputedStyle(sc);
        const cards = [...sc.querySelectorAll('.pcard')].map((c) => c.getBoundingClientRect());
        const acts = [...document.querySelectorAll('#actions .abtn')].map((b) => ({ act: b.dataset.act, r: b.getBoundingClientRect() }));
        const prev = document.querySelector('#preview').getBoundingClientRect();
        return {
          W: innerWidth, H: innerHeight,
          bw: { l: bw.left, r: bw.right, t: bw.top, b: bw.bottom, w: bw.width, h: bw.height },
          prevL: prev.left,
          scoresDisplay: scCs.display,
          scoresCols: scCs.gridTemplateColumns.split(' ').filter(Boolean).length,
          scoreRows: new Set(cards.map((c) => Math.round(c.top))).size,
          acts: acts.map((a) => ({ act: a.act, h: a.r.height, b: a.r.bottom, r: a.r.right })),
        };
      });
      t.equal(m100.scoresDisplay, 'grid', '1024x600 4P switches #scores to grid');
      t.equal(m100.scoresCols, 2, '1024x600 4P compacts #scores into 2 columns');
      t.equal(m100.scoreRows, 2, '4 players occupy 2 rows in #scores');
      t.expect(m100.prevL >= m100.bw.r - 1, 'CD-WF5-01: #preview stays in right sidebar beside #boardwrap');
      t.expect(m100.bw.h >= 470, `CD-WF5-01: 1024x600 board keeps tall height (${Math.round(m100.bw.h)} px of 600)`);
      for (const a of m100.acts) {
        t.expect(a.h >= 44, `1024x600 .abtn[${a.act}] height ${a.h.toFixed(1)} >= 44 px`);
        t.expect(a.b <= m100.H + 0.5 && a.r <= m100.W + 0.5, `1024x600 .abtn[${a.act}] unclipped (bottom ${a.b.toFixed(1)} <= 600, right ${a.r.toFixed(1)} <= 1024)`);
      }

      // Stage a valid play: live '+pts' badge renders inside #actions .play with exact score
      const [mv] = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', mv.tiles);
      const badge = await t.page.evaluate(() => {
        const b = document.querySelector('#actions .abtn.play');
        const pts = b && b.querySelector('.play-pts');
        return {
          hasPts: !!pts,
          text: pts ? pts.textContent.trim() : '',
          playRect: b ? b.getBoundingClientRect() : null,
          W: innerWidth, H: innerHeight,
        };
      });
      t.equal(badge.hasPts, true, 'valid staged play renders live .play-pts badge inside #actions .play');
      t.equal(badge.text, `+${mv.score}`, `live .play-pts badge matches staged move score (+${mv.score})`);
      t.expect(badge.playRect.right <= badge.W + 0.5 && badge.playRect.bottom <= badge.H + 0.5, 'Play button with +pts badge stays unclipped');
      await t.shot('w1-b05-desktop-1024x600-4p');

      // Recall removes +pts badge
      await t.game('act', 'recall');
      const afterRecall = await t.page.evaluate(() => !!document.querySelector('#actions .abtn.play .play-pts'));
      t.equal(afterRecall, false, 'recalling tiles removes .play-pts badge');

      // Switch to 130% text size on 1024x600 4-player: #actions still unclipped!
      await t.page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('hs-letters-settings-v1') || '{}');
        s.text = 1.3;
        localStorage.setItem('hs-letters-settings-v1', JSON.stringify(s));
      });
      await t.reload(); await ready(t);
      await t.game('newGame', { seed: 5, seats: FOUR_SEATS });
      await t.waitIdle(8000);
      const m130 = await t.page.evaluate(() => {
        const acts = [...document.querySelectorAll('#actions .abtn')].map((b) => ({ act: b.dataset.act, r: b.getBoundingClientRect() }));
        return { W: innerWidth, H: innerHeight, acts: acts.map((a) => ({ act: a.act, h: a.r.height, b: a.r.bottom, r: a.r.right })) };
      });
      for (const a of m130.acts) {
        t.expect(a.h >= 44, `1024x600 130% .abtn[${a.act}] height ${a.h.toFixed(1)} >= 44 px`);
        t.expect(a.b <= m130.H + 0.5 && a.r <= m130.W + 0.5, `1024x600 130% .abtn[${a.act}] unclipped (bottom ${a.b.toFixed(1)} <= 600)`);
      }
      await t.shot('w1-b05-desktop-1024x600-130');
      await t.page.setViewportSize({ width: t.vp.width, height: t.vp.height });
    },
  },
  {
    name: 'W6-S5-02 landscape Title safe .title-words padding, container-scaled h1, and capped .title-card max-height',
    viewports: ['desktop', 'mobile'],
    initScript: instant,
    async run(t) {
      await ready(t);
      // 1) Landscape phone 568x320 Title: kicker sits strictly below .title-card::after's 8 px frame line, h1 stays inside card
      await t.page.setViewportSize({ width: 568, height: 320 });
      await t.game('scene', 'title');
      await t.waitFrames(2);
      const land = await t.page.evaluate(() => {
        const card = document.querySelector('.title-card');
        const words = document.querySelector('.title-words');
        const kicker = document.querySelector('.title-words .kicker');
        const h1 = document.querySelector('.title-words h1');
        const newBtn = document.querySelector('.title .menu [data-go="setup"]');
        const cr = card.getBoundingClientRect();
        const kr = kicker.getBoundingClientRect();
        const hr = h1.getBoundingClientRect();
        const wcs = getComputedStyle(words);
        return {
          padTop: parseFloat(wcs.paddingTop),
          padRight: parseFloat(wcs.paddingRight),
          padBottom: parseFloat(wcs.paddingBottom),
          padLeft: parseFloat(wcs.paddingLeft),
          containerType: getComputedStyle(card).containerType,
          kickerTopOffset: kr.top - cr.top,
          h1Inside: hr.left >= cr.left + 8 && hr.right <= cr.right - 8 && hr.bottom <= cr.bottom - 8,
          newBtnBottom: newBtn.getBoundingClientRect().bottom,
          H: innerHeight,
        };
      });
      t.equal(land.padTop, 16, 'landscape .title-words padding-top is 16 px');
      t.equal(land.padLeft, 18, 'landscape .title-words padding-left is 18 px');
      t.equal(land.padRight, 18, 'landscape .title-words padding-right is 18 px');
      t.equal(land.padBottom, 8, 'landscape .title-words padding-bottom is 8 px');
      t.equal(land.containerType, 'inline-size', '.title-card uses inline-size container queries');
      t.expect(land.kickerTopOffset >= 15, `landscape kicker clears .title-card::after frame (${land.kickerTopOffset.toFixed(1)} px >= 15 px)`);
      t.equal(land.h1Inside, true, 'landscape Title h1 stays cleanly inside .title-card inner frame');
      t.expect(land.newBtnBottom <= land.H + 0.5, 'landscape New game button sits above fold');
      if (t.viewport === 'mobile') await t.shot('w1-b05-title-landscape-568x320');

      // 2) Desktop 1280x800 & Portrait 390x844 capped .title-card height
      if (t.viewport === 'desktop') {
        await t.page.setViewportSize({ width: 1280, height: 800 });
        await t.waitFrames(2);
        const desk = await t.page.evaluate(() => {
          const cr = document.querySelector('.title-card').getBoundingClientRect();
          const daily = document.querySelector('.title .menu [data-go="daily"]').getBoundingClientRect();
          return { cardH: cr.height, dailyBottom: daily.bottom, H: innerHeight };
        });
        t.expect(desk.cardH <= 380.5, `desktop .title-card capped <= 380 px (got ${desk.cardH.toFixed(1)} px)`);
        t.expect(desk.dailyBottom <= desk.H + 0.5, `desktop Daily Soak CTA stays above fold (${desk.dailyBottom.toFixed(1)} <= 800)`);
        await t.shot('w1-b05-title-desktop');
      } else {
        await t.page.setViewportSize({ width: 390, height: 844 });
        await t.waitFrames(2);
        const port = await t.page.evaluate(() => {
          const cr = document.querySelector('.title-card').getBoundingClientRect();
          const daily = document.querySelector('.title .menu [data-go="daily"]').getBoundingClientRect();
          return { cardH: cr.height, maxAllowed: innerHeight * 0.38 + 1, dailyBottom: daily.bottom, H: innerHeight };
        });
        t.expect(port.cardH <= port.maxAllowed, `portrait .title-card capped <= 38dvh (${port.cardH.toFixed(1)} <= ${port.maxAllowed.toFixed(1)})`);
        t.expect(port.dailyBottom <= port.H + 0.5, `portrait Daily Soak CTA stays above fold (${port.dailyBottom.toFixed(1)} <= 844)`);
        await t.shot('w1-b05-title-portrait');
      }
      await t.page.setViewportSize({ width: t.vp.width, height: t.vp.height });
    },
  },
  {
    name: 'W6-S5-02 Records .opp-table native table layout + .stats.cols4 + zero 390 px overflow',
    viewports: ['desktop', 'mobile'],
    initScript: instant,
    async run(t) {
      await ready(t);
      await t.page.evaluate(() => {
        const row = (g, w, b) => ({ games: g, wins: w, best: b, total: b * g });
        localStorage.setItem('hs-letters-stats-v1', JSON.stringify({
          v: 1, games: 23, wins: 14, ties: 1, totalScore: 7480, bestScore: 512,
          bestWord: { word: 'JUXTAPOSE', score: 96 }, bestPlay: { word: 'MAGNOLIA', score: 131 },
          fullSoaks: 4, featured: 9, themed: 37, hints: 11, streak: 2, bestStreak: 5,
          opp: { 'opal:easy': row(6, 6, 402), 'hollis:medium': row(7, 5, 430), 'lucky:medium': row(4, 2, 512), 'julian:hard': row(6, 1, 377) },
          daily: { games: 12, best: 301, bestStreak: 6 },
        }));
      });
      await t.game('scene', 'records');
      await t.waitFrames(2);
      const rec = await t.page.evaluate(() => {
        const tbl = document.querySelector('table.opp-table');
        const oldTbl = document.querySelector('table.opp');
        const cs = tbl ? getComputedStyle(tbl) : null;
        const ths = tbl ? [...tbl.querySelectorAll('thead th')].map((x) => x.getBoundingClientRect()) : [];
        const cols4 = document.querySelector('.stats.cols4');
        const c4Cols = cols4 ? getComputedStyle(cols4).gridTemplateColumns.split(' ').filter(Boolean).length : 0;
        const scr = document.querySelector('#screen');
        return {
          hasNewTbl: !!tbl,
          hasOldTbl: !!oldTbl,
          display: cs ? cs.display : '',
          headColsSameRow: ths.length === 4 && new Set(ths.map((r) => Math.round(r.top))).size === 1,
          headIncreasingX: ths.length === 4 && ths[0].left < ths[1].left && ths[1].left < ths[2].left && ths[2].left < ths[3].left,
          c4Cols,
          overflowX: scr.scrollWidth - scr.clientWidth,
        };
      });
      t.equal(rec.hasNewTbl, true, 'Records renders table.opp-table');
      t.equal(rec.hasOldTbl, false, 'Records no longer collides with .opp class');
      t.equal(rec.display, 'table', 'table.opp-table keeps native display: table');
      t.equal(rec.headColsSameRow && rec.headIncreasingX, true, 'all 4 table header columns sit on one row left-to-right');
      t.equal(rec.c4Cols, t.viewport === 'desktop' ? 4 : 2, `Daily Soak .stats.cols4 renders ${t.viewport === 'desktop' ? '4' : '2'} columns`);
      t.expect(rec.overflowX <= 0, `Records has zero horizontal overflow (${rec.overflowX} px)`);
      await t.shot('w1-b05-records');
    },
  },
  {
    name: 'W6-S5-02 root html font-size: calc(100% * var(--ts)) fixes 130% rem inversion',
    viewports: ['desktop'],
    initScript: instant,
    async run(t) {
      await ready(t);
      await t.game('scene', 'help');
      const at100 = await t.page.evaluate(() => ({
        htmlPx: parseFloat(getComputedStyle(document.documentElement).fontSize),
        bodyPx: parseFloat(getComputedStyle(document.body).fontSize),
        h1Px: parseFloat(getComputedStyle(document.querySelector('.sheet h1')).fontSize),
        h2Px: parseFloat(getComputedStyle(document.querySelector('.sheet h2')).fontSize),
      }));
      await t.page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('hs-letters-settings-v1') || '{}');
        s.text = 1.3;
        localStorage.setItem('hs-letters-settings-v1', JSON.stringify(s));
      });
      await t.reload(); await ready(t);
      await t.game('scene', 'help');
      const at130 = await t.page.evaluate(() => ({
        htmlPx: parseFloat(getComputedStyle(document.documentElement).fontSize),
        bodyPx: parseFloat(getComputedStyle(document.body).fontSize),
        h1Px: parseFloat(getComputedStyle(document.querySelector('.sheet h1')).fontSize),
        h2Px: parseFloat(getComputedStyle(document.querySelector('.sheet h2')).fontSize),
      }));
      await t.game('newGame', { seed: 2 });
      await t.waitIdle(6000);
      const ledger130 = await t.page.evaluate(() => ({
        bodyPx: parseFloat(getComputedStyle(document.body).fontSize),
        ledgerH2Px: parseFloat(getComputedStyle(document.querySelector('#ledger h2')).fontSize),
      }));
      t.expect(Math.abs(at100.htmlPx - 16) < 0.2, `100% html font-size is 16 px (got ${at100.htmlPx})`);
      t.expect(Math.abs(at130.htmlPx - 20.8) < 0.3, `130% html font-size scales to 20.8 px (got ${at130.htmlPx})`);
      t.expect(Math.abs(at130.h1Px / at100.h1Px - 1.3) < 0.05, `sheet h1 scales by 1.3x without double-scaling (${at100.h1Px} -> ${at130.h1Px})`);
      t.expect(Math.abs(at130.h2Px / at100.h2Px - 1.3) < 0.05, `sheet h2 scales by 1.3x (${at100.h2Px} -> ${at130.h2Px})`);
      t.expect(ledger130.ledgerH2Px > ledger130.bodyPx, `#ledger h2 (${ledger130.ledgerH2Px.toFixed(1)} px) stays larger than body (${ledger130.bodyPx.toFixed(1)} px) at 130% (no rem inversion)`);
    },
  },
];

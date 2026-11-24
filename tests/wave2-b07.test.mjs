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
];

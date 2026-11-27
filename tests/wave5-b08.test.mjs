// Wave 5, hotfix W5-B08 (W1-S3-03 / OQ-WF7-W5-05): reserve the Daily par pip row's space in the mobile turn line
// before async dailyPar finishes, so #boardwrap and #rack never move when the par pips arrive across 5 sizes x 2 text sizes.
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const KEY = 'hs-letters-settings-v1';
const quiet = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false }));
  }
};

const SIZES = [[320, 568], [360, 640], [390, 844], [568, 320], [844, 390]];
// Distinct dates for each of the 10 size x text openings so every opening exercises an uncached async dailyPar run.
const DATES = [
  '2026-01-04', '2026-07-04', '2026-11-25', '2026-03-02', '2026-05-14',
  '2026-08-19', '2026-09-22', '2026-10-11', '2026-12-03', '2026-04-17',
];

const traceDailyOpening = (t, date) => t.page.evaluate(async (dt) => {
  await document.fonts.ready;
  if (window.__G && window.__G.parCache) delete window.__G.parCache[dt];
  try { localStorage.removeItem('hs-letters-daily-v1'); } catch {}

  const snap = (frame) => {
    const rack = document.querySelector('#rack');
    const board = document.querySelector('#boardwrap');
    const topbar = document.querySelector('#topbar');
    const pips = document.querySelectorAll('#turnline .par-pip');
    return {
      frame,
      pips: pips.length,
      holds: document.querySelectorAll('#turnline .par-pip-hold').length,
      rackTop: rack ? rack.getBoundingClientRect().top : NaN,
      boardTop: board ? board.getBoundingClientRect().top : NaN,
      topbarH: topbar ? topbar.getBoundingClientRect().height : NaN,
    };
  };

  window.__game.newGame({ mode: 'daily', date: dt });
  const samples = [snap(0)];

  await new Promise((resolve, reject) => {
    const t0 = performance.now();
    let frame = 0;
    let afterPips = 0;
    const step = () => {
      frame += 1;
      const s = snap(frame);
      samples.push(s);
      if (s.pips === 2) {
        afterPips += 1;
        if (afterPips >= 4) { resolve(); return; }
      }
      if (performance.now() - t0 > 15000) {
        reject(new Error(`Timed out waiting for Daily par pips on ${dt} (got ${s.pips} pips after ${frame} frames)`));
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });

  const pipEls = [...document.querySelectorAll('#turnline .par-pip')];
  const pipTexts = pipEls.map((el) => el.textContent.trim());
  const pipClipped = pipEls.some((el) => el.scrollWidth > el.clientWidth + 1);
  return {
    samples,
    par: window.__G?.parCache?.[dt] || null,
    pipTexts,
    pipClipped,
  };
}, date);

export const tests = [
  {
    name: 'W1-S3-03 (W5-B08) Daily par pips reserve space on mobile before par arrives: #rack and #boardwrap never move across 5 sizes x 2 text sizes',
    viewports: ['mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      let dateIdx = 0;
      const results = [];
      for (const text of [1, 1.3]) {
        await t.page.evaluate(([k, v]) => {
          const s = JSON.parse(localStorage.getItem(k) || '{}');
          localStorage.setItem(k, JSON.stringify({ ...s, text: v }));
        }, [KEY, text]);
        await t.reload();
        await ready(t);
        for (const [width, height] of SIZES) {
          await t.page.setViewportSize({ width, height });
          await t.waitFrames(2);
          const date = DATES[dateIdx++];
          const trace = await traceDailyOpening(t, date);
          const first = trace.samples[0];
          const last = trace.samples[trace.samples.length - 1];
          const rackTops = trace.samples.map((s) => s.rackTop);
          const boardTops = trace.samples.map((s) => s.boardTop);
          const topbarHs = trace.samples.map((s) => s.topbarH);
          const rackSpan = Math.max(...rackTops) - Math.min(...rackTops);
          const boardSpan = Math.max(...boardTops) - Math.min(...boardTops);
          const topbarSpan = Math.max(...topbarHs) - Math.min(...topbarHs);
          const at = `${width}x${height} ${Math.round(text * 100)}% ${date}`;
          const line = `${at}: frames=${trace.samples.length}, rack ${first.rackTop.toFixed(2)}->${last.rackTop.toFixed(2)} (span ${rackSpan.toFixed(2)} px), board span ${boardSpan.toFixed(2)} px, topbar ${first.topbarH.toFixed(2)}->${last.topbarH.toFixed(2)} (span ${topbarSpan.toFixed(2)} px), pips=[${trace.pipTexts.join(', ')}]`;
          t.log(line);
          results.push({ at, rackSpan, boardSpan, topbarSpan, first, last, trace });
          if (width === 320 && height === 568 && text === 1.3) await t.shot('w5-b08-320x568-130');
          if (width === 568 && height === 320 && text === 1) await t.shot('w5-b08-568x320-100');
        }
      }
      for (const r of results) {
        t.equal(r.first.pips, 0, `${r.at}: opening frame has 0 live .par-pip before async par arrives`);
        t.equal(r.last.pips, 2, `${r.at}: 2 live .par-pip arrive`);
        t.equal(r.last.holds, 0, `${r.at}: placeholders are replaced once live par pips arrive`);
        t.equal(r.trace.pipClipped, false, `${r.at}: par pips are not clipped`);
        t.expect(r.trace.pipTexts.every((s) => /^★+\s+\d+$/.test(s)), `${r.at}: par pips show star targets (${r.trace.pipTexts.join(', ')})`);
        t.expect(r.rackSpan <= 0.5, `${r.at}: #rack top never moves from Daily opening until par arrives (span ${r.rackSpan.toFixed(2)} px, ${r.first.rackTop.toFixed(2)} -> ${r.last.rackTop.toFixed(2)} px)`);
        t.expect(r.boardSpan <= 0.5, `${r.at}: #boardwrap top never moves from Daily opening until par arrives (span ${r.boardSpan.toFixed(2)} px)`);
      }
      // Restore standard mobile viewport for final visual check and contrast check
      await t.page.setViewportSize({ width: 390, height: 844 });
      await t.waitFrames(2);
      const cr = await t.contrastReport({ selector: '#turnline', min: 4.5, largeMin: 3 });
      t.equal(cr.fails.length, 0, `Daily #turnline contrast clean (${JSON.stringify(cr.fails)})`);
      await t.shot('w5-b08-390x844-130');
    },
  },
  {
    name: 'W1-S3-03 (W5-B08) desktop Daily turn line stays unchanged without mobile placeholder (OQ-WF7-W5-02)',
    viewports: ['desktop'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      const trace = await traceDailyOpening(t, '2026-06-15');
      const first = trace.samples[0];
      const last = trace.samples[trace.samples.length - 1];
      const rackTops = trace.samples.map((s) => s.rackTop);
      const boardTops = trace.samples.map((s) => s.boardTop);
      const rackSpan = Math.max(...rackTops) - Math.min(...rackTops);
      const boardSpan = Math.max(...boardTops) - Math.min(...boardTops);
      t.log(`desktop 1280x800: frames=${trace.samples.length}, first holds=${first.holds}, rack span ${rackSpan.toFixed(2)} px, board span ${boardSpan.toFixed(2)} px, pips=[${trace.pipTexts.join(', ')}]`);
      t.equal(first.pips, 0, 'desktop opening frame has 0 live .par-pip before async par arrives');
      t.equal(first.holds, 0, 'desktop adds no mobile par placeholder (OQ-WF7-W5-02)');
      t.equal(last.pips, 2, 'desktop receives 2 live .par-pip');
      t.equal(trace.pipClipped, false, 'desktop par pips are not clipped');
      t.expect(rackSpan <= 0.5, `desktop #rack top never moves (span ${rackSpan.toFixed(2)} px)`);
      t.expect(boardSpan <= 0.5, `desktop #boardwrap top never moves (span ${boardSpan.toFixed(2)} px)`);
      const cr = await t.contrastReport({ selector: '#turnline', min: 4.5, largeMin: 3 });
      t.equal(cr.fails.length, 0, `desktop #turnline contrast clean (${JSON.stringify(cr.fails)})`);
    },
  },
];

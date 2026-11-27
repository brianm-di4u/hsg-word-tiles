// Wave 5, hotfixes W5-B08 / W5-B09 (W1-S3-03 / OQ-WF7-W5-05): reserve the Daily par pip row's exact space in the mobile
// turn line before async dailyPar finishes, so #boardwrap and #rack never move when the par pips arrive across 5 sizes x 2
// text sizes, Practice replays without cached par, and narrow/wide par widths.
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

// W5-B09 follow-up cases from wave-5-HOTFIX-B08-VERIFY.md: Practice replay without cached par and narrow/wide forced pars.
const EDGE_CASES = [
  { label: '390x844 100% Practice (real par)', width: 390, height: 844, text: 1, date: '2026-02-11', prior: 240, forcedPar: null, shot: 'w5-b09-390x844-100-practice' },
  { label: '390x844 100% Practice (par 800/908)', width: 390, height: 844, text: 1, date: '2026-02-12', prior: 240, forcedPar: { m: 800, h: 908 } },
  { label: '568x320 100% par 111/111', width: 568, height: 320, text: 1, date: '2026-02-13', prior: null, forcedPar: { m: 111, h: 111 }, shot: 'w5-b09-568x320-100-111' },
  { label: '568x320 100% par 141/171', width: 568, height: 320, text: 1, date: '2026-02-14', prior: null, forcedPar: { m: 141, h: 171 } },
  { label: '320x568 130% par 111/111', width: 320, height: 568, text: 1.3, date: '2026-02-15', prior: null, forcedPar: { m: 111, h: 111 }, shot: 'w5-b09-320x568-130-111' },
];

const traceDailyOpening = (t, date, opts = {}) => t.page.evaluate(async ({ dt, prior, forcedPar }) => {
  await document.fonts.ready;
  if (window.__G && window.__G.parCache) delete window.__G.parCache[dt];
  try {
    if (prior != null) {
      localStorage.setItem('hs-letters-daily-v1', JSON.stringify({
        days: { [dt]: { score: prior, first: prior, plays: 1 } },
        streak: 1,
        last: dt,
      }));
    } else {
      localStorage.removeItem('hs-letters-daily-v1');
    }
  } catch {}

  const snap = (frame) => {
    const rack = document.querySelector('#rack');
    const board = document.querySelector('#boardwrap');
    const topbar = document.querySelector('#topbar');
    const pars = document.querySelector('#turnline .daily-pars');
    const pips = document.querySelectorAll('#turnline .par-pip');
    const holds = document.querySelectorAll('#turnline .par-pip-hold');
    return {
      frame,
      pips: pips.length,
      holds: holds.length,
      priorShown: !!document.querySelector('#turnline .daily-prior'),
      rackTop: rack ? rack.getBoundingClientRect().top : NaN,
      boardTop: board ? board.getBoundingClientRect().top : NaN,
      topbarH: topbar ? topbar.getBoundingClientRect().height : NaN,
      parsW: pars ? pars.getBoundingClientRect().width : 0,
      pipWs: [...(pips.length ? pips : holds)].map((el) => el.getBoundingClientRect().width),
    };
  };

  const origPost = Worker.prototype.postMessage;
  let held = null;
  let heldAt = -1;
  let delivered = false;
  if (forcedPar) {
    Worker.prototype.postMessage = function (msg, ...rest) {
      if (msg && msg.type === 'dailyPar' && msg.date === dt) {
        held = { worker: this, id: msg.id };
        return;
      }
      return origPost.call(this, msg, ...rest);
    };
  }

  try {
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
        if (forcedPar && held && !delivered) {
          if (heldAt < 0) heldAt = frame;
          if (frame - heldAt >= 2) {
            delivered = true;
            const { worker, id } = held;
            if (typeof worker.onmessage === 'function') {
              worker.onmessage({ data: { type: 'dailyPar', id, par: forcedPar } });
            }
          }
        }
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
    const tl = document.querySelector('#turnline');
    const pars = document.querySelector('#turnline .daily-pars');
    const parsOverflow = !!(tl && pars && pars.getBoundingClientRect().width > tl.getBoundingClientRect().width + 0.5);
    return {
      samples,
      par: window.__G?.parCache?.[dt] || null,
      pipTexts,
      pipClipped,
      parsOverflow,
    };
  } finally {
    Worker.prototype.postMessage = origPost;
    try { localStorage.removeItem('hs-letters-daily-v1'); } catch {}
    if (window.__G && window.__G.parCache) delete window.__G.parCache[dt];
  }
}, { dt: date, prior: opts.prior ?? null, forcedPar: opts.forcedPar ?? null });

const setTextScale = async (t, text) => {
  await t.page.evaluate(([k, v]) => {
    const s = JSON.parse(localStorage.getItem(k) || '{}');
    localStorage.setItem(k, JSON.stringify({ ...s, text: v }));
  }, [KEY, text]);
  await t.reload();
  await ready(t);
};

export const tests = [
  {
    name: 'W1-S3-03 (W5-B08/B09) Daily par pips reserve exact space on mobile before par arrives: #rack and #boardwrap never move across 5 sizes x 2 text sizes, Practice replay, and narrow/wide pars',
    viewports: ['mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      let dateIdx = 0;
      const results = [];
      const record = (at, trace, extra = {}) => {
        const first = trace.samples[0];
        const last = trace.samples[trace.samples.length - 1];
        const rackTops = trace.samples.map((s) => s.rackTop);
        const boardTops = trace.samples.map((s) => s.boardTop);
        const topbarHs = trace.samples.map((s) => s.topbarH);
        const rackSpan = Math.max(...rackTops) - Math.min(...rackTops);
        const boardSpan = Math.max(...boardTops) - Math.min(...boardTops);
        const topbarSpan = Math.max(...topbarHs) - Math.min(...topbarHs);
        const holdWs = first.pipWs.map((w) => w.toFixed(2)).join('+');
        const liveWs = last.pipWs.map((w) => w.toFixed(2)).join('+');
        const line = `${at}: frames=${trace.samples.length}, rack ${first.rackTop.toFixed(2)}->${last.rackTop.toFixed(2)} (span ${rackSpan.toFixed(2)} px), board span ${boardSpan.toFixed(2)} px, topbar ${first.topbarH.toFixed(2)}->${last.topbarH.toFixed(2)} (span ${topbarSpan.toFixed(2)} px), parsW ${first.parsW.toFixed(2)}->${last.parsW.toFixed(2)} [${holdWs} -> ${liveWs}], pips=[${trace.pipTexts.join(', ')}]`;
        t.log(line);
        results.push({ at, rackSpan, boardSpan, topbarSpan, first, last, trace, ...extra });
      };

      for (const text of [1, 1.3]) {
        await setTextScale(t, text);
        for (const [width, height] of SIZES) {
          await t.page.setViewportSize({ width, height });
          await t.waitFrames(2);
          const date = DATES[dateIdx++];
          const trace = await traceDailyOpening(t, date);
          record(`${width}x${height} ${Math.round(text * 100)}% ${date}`, trace);
          if (width === 320 && height === 568 && text === 1.3) await t.shot('w5-b08-320x568-130');
          if (width === 568 && height === 320 && text === 1) await t.shot('w5-b08-568x320-100');
        }
      }

      // W5-B09 edge cases: Practice replay without cached par + narrow/wide forced pars
      let currentText = 1.3;
      for (const c of EDGE_CASES) {
        if (c.text !== currentText) {
          await setTextScale(t, c.text);
          currentText = c.text;
        }
        await t.page.setViewportSize({ width: c.width, height: c.height });
        await t.waitFrames(2);
        const trace = await traceDailyOpening(t, c.date, { prior: c.prior, forcedPar: c.forcedPar });
        record(c.label, trace, { expectPrior: c.prior != null, forcedPar: c.forcedPar });
        if (c.shot) await t.shot(c.shot);
      }

      for (const r of results) {
        t.equal(r.first.pips, 0, `${r.at}: opening frame has 0 live .par-pip before async par arrives`);
        t.equal(r.first.holds, 2, `${r.at}: opening frame renders 2 mobile placeholder pips`);
        t.equal(r.last.pips, 2, `${r.at}: 2 live .par-pip arrive`);
        t.equal(r.last.holds, 0, `${r.at}: placeholders are replaced once live par pips arrive`);
        if (r.expectPrior) {
          t.equal(r.first.priorShown, true, `${r.at}: Practice line present before par arrives`);
          t.equal(r.last.priorShown, true, `${r.at}: Practice line remains after par arrives`);
        }
        if (r.forcedPar) {
          const lo = Math.min(r.forcedPar.m, r.forcedPar.h), hi = Math.max(r.forcedPar.m, r.forcedPar.h);
          t.equal(r.trace.pipTexts.join(' | '), `★ ${lo} | ★★ ${hi}`, `${r.at}: forced par rendered`);
        }
        t.equal(r.trace.pipClipped, false, `${r.at}: par pips are not clipped`);
        t.equal(r.trace.parsOverflow, false, `${r.at}: .daily-pars fits within #turnline width`);
        t.expect(Math.abs(r.first.parsW - r.last.parsW) <= 0.5, `${r.at}: reserved .daily-pars width matches live width (${r.first.parsW.toFixed(2)} -> ${r.last.parsW.toFixed(2)} px)`);
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
    name: 'W1-S3-03 (W5-B08/B09) desktop Daily turn line stays unchanged without mobile placeholder (OQ-WF7-W5-02)',
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
      t.log(`desktop 1280x800: frames=${trace.samples.length}, first holds=${first.holds}, rack span ${rackSpan.toFixed(2)} px, board span ${boardSpan.toFixed(2)} px, parsW ${first.parsW.toFixed(2)}->${last.parsW.toFixed(2)} [${last.pipWs.map((w) => w.toFixed(2)).join('+')}], pips=[${trace.pipTexts.join(', ')}]`);
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

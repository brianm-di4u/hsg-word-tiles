// Wave 4, batch W4-B24: WF-5 ui_ecosystem
// - W5-S1-08: already_done on pipeline/wave-4 by 801bfbf (W3-P-N02: body.no-art CSS overrides) and 2f4e95e (W4-S3-02: dark-espresso .pop pill).
// - W5-S2-03: font-variant-numeric: tabular-nums on secondary score readouts (.wscore, .fscore, .daily-stats b, #preview .pts, .log li em, .bests li b).
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, theme: 'light' }));
  }
};
const CENTER = 112;

export const tests = [
  {
    name: 'W5-S2-03 secondary score readouts use font-variant-numeric: tabular-nums across Play, Final Soak, Daily Soak, and Records (preserving CD-WF5-03 hierarchy)',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.seed(7);
      await t.game('newGame', { seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
      await t.waitIdle(8000);

      // Put SPA in player's rack so Final Soak also renders a Hot Springs .wchip alongside .fchip (CD-WF5-03).
      const s0 = await t.state();
      s0.game.players[0].rack = ['S', 'P', 'A', 'T', 'E', 'R', 'N'];
      await t.game('setState', { game: s0.game });
      await t.waitIdle(4000);

      // 1) Staged preview (#preview .pts)
      await t.game('act', 'stage', [{ i: CENTER - 1, l: 'S' }, { i: CENTER, l: 'P' }, { i: CENTER + 1, l: 'A' }]);
      await t.waitFrames(2);
      const pvFvn = await t.page.evaluate(() => {
        const el = document.querySelector('#preview .pts');
        return el ? getComputedStyle(el).fontVariantNumeric : null;
      });
      t.expect(pvFvn && pvFvn.includes('tabular-nums'), `#preview .pts uses tabular-nums (got ${pvFvn})`);

      // 2) Committed play (#ledger .log li em)
      const r = await t.game('act', 'play');
      t.equal(r.ok, true, 'SPA played cleanly');
      await t.waitIdle(8000);
      const logFvn = await t.page.evaluate(() => {
        const els = [...document.querySelectorAll('#ledger .log li em')];
        return els.map((el) => getComputedStyle(el).fontVariantNumeric);
      });
      t.expect(logFvn.length > 0, `Steam ledger has score entries (${logFvn.length})`);
      for (const v of logFvn) t.expect(v.includes('tabular-nums'), `#ledger .log li em uses tabular-nums (got ${v})`);

      // 3) Final Soak (.wscore, .fscore) + CD-WF5-03 Limelight masthead & .wchip/.fchip preservation
      const s1 = await t.state();
      s1.game.scoreless = 3;
      await t.game('setState', { game: s1.game });
      await t.game('act', 'pass');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 6000 });
      await t.waitIdle(4000);
      const overInfo = await t.page.evaluate(() => {
        const ws = document.querySelector('.wscore');
        const fs = document.querySelector('.fscore');
        const mh = document.querySelector('.masthead h1');
        const wc = document.querySelector('.wchip');
        const fc = document.querySelector('.fchip');
        return {
          wscore: ws ? getComputedStyle(ws).fontVariantNumeric : null,
          fscore: fs ? getComputedStyle(fs).fontVariantNumeric : null,
          mastheadFont: mh ? getComputedStyle(mh).fontFamily : '',
          wchipBg: wc ? getComputedStyle(wc).backgroundImage : null,
          fchipBg: fc ? getComputedStyle(fc).backgroundColor : null,
        };
      });
      t.expect(overInfo.wscore && overInfo.wscore.includes('tabular-nums'), `Final Soak .wscore uses tabular-nums (got ${overInfo.wscore})`);
      t.expect(overInfo.fscore && overInfo.fscore.includes('tabular-nums'), `Final Soak .fscore uses tabular-nums (got ${overInfo.fscore})`);
      t.expect(/Limelight/i.test(overInfo.mastheadFont), `CD-WF5-03 Final Soak masthead preserves Limelight (${overInfo.mastheadFont})`);
      t.expect(overInfo.wchipBg && /gradient/.test(overInfo.wchipBg) && overInfo.fchipBg !== null, 'CD-WF5-03 gold .wchip and parchment .fchip hierarchy preserved');

      // 4) Records (.bests li b & .bests li b small) + CD-WF5-03 Fraunces sheet heading
      await t.game('scene', 'records');
      await t.waitIdle(4000);
      const recInfo = await t.page.evaluate(() => ({
        h1Font: getComputedStyle(document.querySelector('.sheet h1')).fontFamily,
        bests: [...document.querySelectorAll('.bests li b')].map((el) => getComputedStyle(el).fontVariantNumeric),
        bestSmalls: [...document.querySelectorAll('.bests li b small')].map((el) => getComputedStyle(el).fontVariantNumeric),
      }));
      t.expect(recInfo.bests.length >= 6, `Records .bests has ${recInfo.bests.length} entries`);
      for (const v of recInfo.bests) t.expect(v.includes('tabular-nums'), `Records .bests li b uses tabular-nums (got ${v})`);
      t.expect(recInfo.bestSmalls.length >= 1, 'Records .bests has <small> score detail');
      for (const v of recInfo.bestSmalls) t.expect(v.includes('tabular-nums'), `Records .bests li b small uses tabular-nums (got ${v})`);
      t.expect(/Fraunces/i.test(recInfo.h1Font) && !/Limelight/i.test(recInfo.h1Font), `CD-WF5-03 Records sheet h1 preserves Fraunces (${recInfo.h1Font})`);

      // 5) Daily Soak results (.daily-stats b)
      await t.game('newGame', { mode: 'daily', date: '2026-06-15' });
      await t.waitIdle(8000);
      const sd = await t.state();
      sd.game.daily.turns = 1;
      await t.game('setState', { game: sd.game });
      await t.game('act', 'pass');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 6000 });
      await t.waitIdle(4000);
      const dailyStats = await t.page.evaluate(() => [...document.querySelectorAll('.daily-stats b')].map((el) => getComputedStyle(el).fontVariantNumeric));
      t.equal(dailyStats.length, 3, 'Daily Soak results has 3 .daily-stats b readouts');
      for (const v of dailyStats) t.expect(v.includes('tabular-nums'), `Daily Soak .daily-stats b uses tabular-nums (got ${v})`);
    },
  },
];

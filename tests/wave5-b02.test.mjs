// Wave 5, batch W5-B02:
// - W6-S5-03: Landscape touchscreens (@media (pointer: coarse), width > 860 px) give .ledger-all >= 44x44 px and #turnline .bag-btn / .bag-link a >= 44 px ::after hit target without shifting layout or stealing taps.
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, theme: 'light' }));
  }
};

export const tests = [
  // ---------- W6-S5-03 ----------
  {
    name: 'W6-S5-03 landscape coarse-pointer touchscreens (1024x768, 1280x800, 1024x600) give .ledger-all and #turnline .bag-btn/.bag-link >= 44x44 px tap targets at 100% and 130% text without moving layout or stealing taps',
    viewports: ['mobile'], // mobile context has hasTouch: true -> Chromium matches @media (pointer: coarse)
    initScript: quiet,
    async run(t) {
      await ready(t);
      const isCoarse = await t.page.evaluate(() => matchMedia('(pointer: coarse)').matches);
      t.equal(isCoarse, true, 'mobile test context emulates (pointer: coarse)');

      const ai = (persona, level) => ({ kind: 'ai', persona, level });
      const you = { kind: 'human', name: 'You' };
      const GAMES = {
        'two players': { seed: 5, seats: [you, ai('opal', 'easy')] },
        'four players': { seed: 5, seats: [you, ai('opal', 'easy'), ai('hollis', 'medium'), ai('julian', 'hard')] },
        'final stretch': { seed: 5, seats: [you, ai('opal', 'easy')], bag: ['A', 'B', 'C'] },
        'empty bag': { seed: 5, seats: [you, ai('opal', 'easy')], bag: [] },
        'Daily Soak': { mode: 'daily', date: '2026-11-20' },
      };

      for (const text of [1, 1.3]) {
        await t.page.evaluate((v) => {
          const k = 'hs-letters-settings-v1';
          const s = JSON.parse(localStorage.getItem(k) || '{}');
          s.text = v;
          localStorage.setItem(k, JSON.stringify(s));
        }, text);
        await t.reload();
        await ready(t);

        for (const [w, h] of [[1024, 768], [1280, 800], [1024, 600]]) {
          await t.page.setViewportSize({ width: w, height: h });
          await t.waitFrames(3);

          // Confirm desktop 2-column breakpoint (> 860 px, > 520 px, aspect > 1/1) is active
          const wideCheck = await t.page.evaluate(() => ({
            narrowMedia: matchMedia('(max-width: 860px), (max-aspect-ratio: 1/1), (max-height: 520px)').matches,
            coarse: matchMedia('(pointer: coarse)').matches,
          }));
          t.equal(wideCheck.narrowMedia, false, `${w}x${h} sits outside mobile media query`);
          t.equal(wideCheck.coarse, true, `${w}x${h} matches (pointer: coarse)`);

          for (const [what, { bag, ...game }] of Object.entries(GAMES)) {
            const where = `${w}x${h} ${text * 100}% ${what}`;
            await t.game('newGame', game);
            await t.waitIdle(8000);
            if (game.mode === 'daily') {
              await t.page.waitForFunction(() => document.querySelectorAll('#turnline .par-pip').length === 2, null, { timeout: 15000 });
            }
            if (bag) {
              const g = (await t.state()).game;
              g.bag = bag;
              await t.game('setState', { game: g });
              await t.waitFrames(2);
            }

            const m = await t.page.evaluate(() => {
              const ledger = document.querySelector('#ledger');
              const lr = ledger.getBoundingClientRect();
              const allBtn = document.querySelector('#b-ledger');
              const ar = allBtn.getBoundingClientRect();
              const allCenterHit = allBtn.contains(document.elementFromPoint(ar.left + ar.width / 2, ar.top + ar.height / 2));

              const bagBtn = document.querySelector('#turnline [data-open-tracker]');
              const br = bagBtn.getBoundingClientRect();
              const cx = br.left + br.width / 2;
              const cy = br.top + br.height / 2;
              const span = (at, from, limit) => {
                let lo = from, hi = from;
                while (lo > 0 && bagBtn.contains(at(lo - 0.5))) lo -= 0.5;
                while (hi < limit && bagBtn.contains(at(hi + 0.5))) hi += 0.5;
                return [lo, hi];
              };
              const [top, low] = span((y) => document.elementFromPoint(cx, y), cy, innerHeight);
              const [left, right] = span((x) => document.elementFromPoint(x, cy), cx, innerWidth);

              const rects = () => JSON.stringify(['#topbar', '#turnline', '#scores', '#springs', '#boardwrap', '#rackbar', '#actions', '#b-menu', '#b-sound'].map((q) => {
                const b = document.querySelector(q).getBoundingClientRect();
                return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)];
              }));
              const others = () => {
                const o = {};
                for (let y = 2; y < innerHeight; y += 8) {
                  for (let x = 2; x < innerWidth; x += 8) {
                    const e = document.elementFromPoint(x, y)?.closest('button, a, input, canvas, [tabindex]');
                    if (e && e !== bagBtn) o[`${x},${y}`] = e;
                  }
                }
                return o;
              };
              const withPseudo = rects(), tapsWith = others();
              const st = document.createElement('style');
              st.textContent = '#turnline .bag-btn::after, #turnline .bag-link::after { display: none !important; }';
              document.head.append(st);
              const withoutPseudo = rects(), tapsWithout = others();
              st.remove();

              const lost = Object.keys(tapsWithout).filter((k) => tapsWith[k] !== tapsWithout[k]).map((k) => `${tapsWithout[k].id || tapsWithout[k].className}@${k}`);
              const app = document.querySelector('#app');
              const playRect = document.querySelector('#actions .abtn.play').getBoundingClientRect();
              return {
                ledgerH: +lr.height.toFixed(1),
                allW: +ar.width.toFixed(1),
                allH: +ar.height.toFixed(1),
                allCenterHit,
                bagW: +(right - left).toFixed(1),
                bagH: +(low - top).toFixed(1),
                bagTop: +top.toFixed(1),
                bagLow: +low.toFixed(1),
                bagCx: +cx.toFixed(1),
                moved: withPseudo !== withoutPseudo,
                lost,
                playBottom: +playRect.bottom.toFixed(1),
                overflowX: app.scrollWidth - app.clientWidth,
              };
            });

            t.expect(m.allW >= 44 && m.allH >= 44, `${where}: .ledger-all >= 44x44 px (${m.allW}x${m.allH})`);
            if (text === 1 || m.ledgerH >= 58) {
              t.equal(m.allCenterHit, true, `${where}: .ledger-all center is directly clickable (ledgerH=${m.ledgerH})`);
            }
            t.expect(m.bagW >= 44 && m.bagH >= 44, `${where}: #turnline bag trigger hit box >= 44x44 px (${m.bagW}x${m.bagH})`);
            t.expect(m.bagTop >= 0 && m.bagLow <= h, `${where}: #turnline bag hit box stays inside viewport (${m.bagTop}..${m.bagLow})`);
            t.equal(m.moved, false, `${where}: ::after hit target moves zero layout boxes`);
            t.equal(m.lost.join(', '), '', `${where}: ::after hit target steals zero taps from other controls`);
            t.equal(m.overflowX, 0, `${where}: zero horizontal overflow`);
            t.expect(m.playBottom <= h + 0.5, `${where}: Play button stays on screen (${m.playBottom} <= ${h})`);

            // Real taps on 1024x768 at 100% text: tap top edge of expanded bag hit box AND tap .ledger-all
            if (text === 1 && w === 1024 && h === 768 && (what === 'two players' || what === 'Daily Soak')) {
              await t.tap([m.bagCx, m.bagTop + 3]);
              await t.page.waitForFunction(() => window.__game.getState().dialog === 'tracker', null, { timeout: 5000 });
              await t.game('act', 'close');
              await t.waitFrames(2);

              const allPt = await t.page.evaluate(() => {
                const r = document.querySelector('#b-ledger').getBoundingClientRect();
                return [r.left + r.width / 2, r.top + r.height / 2];
              });
              await t.tap(allPt);
              await t.page.waitForFunction(() => window.__game.getState().dialog === 'ledger', null, { timeout: 5000 });
              await t.game('act', 'close');
              await t.waitFrames(2);

              if (what === 'two players') {
                const cDay = await t.contrastReport({ selector: '#ledger', min: 4.5, largeMin: 3 });
                t.equal(cDay.fails.length, 0, `1024x768 coarse Day #ledger contrast ok (${cDay.fails.join('; ')})`);
                await t.shot('w5-b02-1024x768-coarse-touch');
              }
            }
          }
        }
      }
    },
  },
  {
    name: 'W6-S5-03 fine-pointer desktop keeps compact 28 px .ledger-all and does not add coarse ::after on #turnline .bag-btn',
    viewports: ['desktop'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.page.setViewportSize({ width: 1024, height: 768 });
      await t.game('newGame', { seed: 5 });
      await t.waitIdle(6000);
      const info = await t.page.evaluate(() => {
        const coarse = matchMedia('(pointer: coarse)').matches;
        const allBtn = document.querySelector('#b-ledger');
        const bagBtn = document.querySelector('#turnline .bag-btn');
        return {
          coarse,
          allH: Math.round(allBtn.getBoundingClientRect().height),
          bagAfterContent: getComputedStyle(bagBtn, '::after').content,
        };
      });
      t.equal(info.coarse, false, 'desktop context is fine pointer');
      t.expect(info.allH >= 26 && info.allH < 44, `fine-pointer desktop keeps compact .ledger-all (${info.allH} px)`);
      t.equal(info.bagAfterContent, 'none', 'fine-pointer desktop does not inject coarse ::after hit box');
    },
  },
];

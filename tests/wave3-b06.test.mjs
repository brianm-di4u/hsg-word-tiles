// Wave 3, batch W3-B06: W6-S2-03 (CD-WF5-06 native #ledger scrolling + 'All' button in #ledger h2).
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false }));
  }
};

export const tests = [
  {
    name: 'W6-S2-03 #ledger preserves native scrolling with zero li.hidden truncation (CD-WF5-06), keeps older Hot Springs chips reachable, and #ledger h2 All button opens full ledger dialog',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 3, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
      await t.waitIdle(6000);

      // Seed 10 ledger plays with an early Hot Springs word (STEAM) near the bottom of the reversed list
      const st = (await t.state()).game;
      st.log = [
        { p: 0, kind: 'play', n: 0, score: 28, full: 0, themed: 10, words: [{ w: 'STEAM', score: 18, bonus: 10, themed: 'steam' }], tiles: [] },
        { p: 1, kind: 'play', n: 1, score: 14, full: 0, themed: 0, words: [{ w: 'TONE', score: 14, bonus: 0, themed: null }], tiles: [] },
        { p: 0, kind: 'play', n: 2, score: 16, full: 0, themed: 0, words: [{ w: 'LANE', score: 16, bonus: 0, themed: null }], tiles: [] },
        { p: 1, kind: 'play', n: 3, score: 12, full: 0, themed: 0, words: [{ w: 'RATE', score: 12, bonus: 0, themed: null }], tiles: [] },
        { p: 0, kind: 'play', n: 4, score: 18, full: 0, themed: 0, words: [{ w: 'CARE', score: 18, bonus: 0, themed: null }], tiles: [] },
        { p: 1, kind: 'play', n: 5, score: 15, full: 0, themed: 0, words: [{ w: 'BORE', score: 15, bonus: 0, themed: null }], tiles: [] },
        { p: 0, kind: 'play', n: 6, score: 17, full: 0, themed: 0, words: [{ w: 'PINE', score: 17, bonus: 0, themed: null }], tiles: [] },
        { p: 1, kind: 'play', n: 7, score: 13, full: 0, themed: 0, words: [{ w: 'MINT', score: 13, bonus: 0, themed: null }], tiles: [] },
        { p: 0, kind: 'play', n: 8, score: 19, full: 0, themed: 0, words: [{ w: 'PORT', score: 19, bonus: 0, themed: null }], tiles: [] },
        { p: 1, kind: 'play', n: 9, score: 11, full: 0, themed: 0, words: [{ w: 'WEST', score: 11, bonus: 0, themed: null }], tiles: [] },
      ];
      await t.game('setState', { game: st });
      await t.waitFrames(4);

      const info = await t.page.evaluate(() => {
        const box = document.querySelector('#ledger');
        const items = [...document.querySelectorAll('#log > li')];
        const hiddenCount = items.filter((li) => li.hidden || getComputedStyle(li).display === 'none').length;
        const allBtn = document.querySelector('#ledger h2 #b-ledger');
        const ar = allBtn ? allBtn.getBoundingClientRect() : null;
        const chip = document.querySelector('#log button.themed-link[data-fact="steam"]');
        return {
          total: items.length,
          hiddenCount,
          overflowY: getComputedStyle(box).overflowY,
          scrollH: box.scrollHeight,
          clientH: box.clientHeight,
          hasAll: !!allBtn,
          allText: allBtn ? allBtn.textContent.trim() : '',
          allH: ar ? ar.height : 0,
          allW: ar ? ar.width : 0,
          hasOldChip: !!chip && !chip.closest('li').hidden,
        };
      });

      t.equal(info.total, 10, 'all 10 plays rendered in inline #log');
      t.equal(info.hiddenCount, 0, 'CD-WF5-06: zero li.hidden / display:none truncation in inline #ledger');
      t.expect(info.overflowY === 'auto' || info.overflowY === 'scroll', `#ledger keeps native scroll (${info.overflowY})`);
      t.expect(info.scrollH > info.clientH, `#ledger natively overflows and scrolls with 10 entries (${info.scrollH} > ${info.clientH})`);
      t.equal(info.hasOldChip, true, 'early Hot Springs STEAM chip stays unhidden in #log');
      t.equal(info.hasAll, true, '#ledger h2 renders the All button');
      t.equal(info.allText, 'All', 'All button label matches spec');
      if (t.viewport === 'mobile') {
        t.expect(info.allH >= 44 && info.allW >= 44, `mobile #b-ledger meets >= 44 px touch floor (${info.allW.toFixed(1)}x${info.allH.toFixed(1)})`);
      }

      // Contrast check and visual shot of #ledger h2 + All button at top of scroll
      const cDay = await t.contrastReport({ selector: '#ledger', min: 4.5, largeMin: 3 });
      t.equal(cDay.fails.length, 0, 'Day #ledger + All button passes WCAG contrast (' + JSON.stringify(cDay.fails) + ')');
      await t.shot('w3-b06-ledger-all-day');

      // Scroll #ledger natively to the bottom and click the older STEAM chip to open its Fact Card
      await t.page.evaluate(() => { const b = document.querySelector('#ledger'); b.scrollTop = b.scrollHeight; });
      const scrolledTop = await t.page.evaluate(() => document.querySelector('#ledger').scrollTop);
      t.expect(scrolledTop > 0, `#ledger actually scrolled natively (scrollTop=${scrolledTop})`);
      await t.page.click('#log button.themed-link[data-fact="steam"]');
      t.equal((await t.state()).dialog, 'fact', 'clicking scrolled-to older STEAM chip opens Fact Card');
      await t.game('act', 'close');

      // Click #ledger h2 All button -> opens full Steam ledger modal with all 10 entries & Back/Close buttons
      await t.page.click('#b-ledger');
      t.equal((await t.state()).dialog, 'ledger', 'clicking All opens full Steam ledger dialog');
      const dlgInfo = await t.page.evaluate(() => ({
        count: document.querySelectorAll('#modal .ledger-dlg .log > li').length,
        hasBack: !!document.querySelector('#modal .ledger-dlg [data-open="pause"]'),
        hasClose: !!document.querySelector('#modal .ledger-dlg [data-close]'),
      }));
      t.equal(dlgInfo.count, 10, 'full ledger modal shows all 10 plays');
      t.equal(dlgInfo.hasBack && dlgInfo.hasClose, true, 'full ledger modal keeps symmetric Back + Close buttons');
      await t.page.click('#modal .ledger-dlg [data-close]');
      t.equal((await t.state()).dialog, null, 'Close dismisses ledger dialog');
      t.equal(await t.page.evaluate(() => document.activeElement && document.activeElement.id), 'b-ledger', 'closing ledger dialog restores focus to #b-ledger');

      // Night mode contrast check
      await t.game('scene', 'settings');
      await t.page.click('[data-set="theme"][data-val="dark"]');
      await t.game('scene', 'game');
      const cNight = await t.contrastReport({ selector: '#ledger', min: 4.5, largeMin: 3 });
      t.equal(cNight.fails.length, 0, 'Night #ledger + All button passes WCAG contrast (' + JSON.stringify(cNight.fails) + ')');
      await t.checkLayout({ allowScrollY: true });
    },
  },
];

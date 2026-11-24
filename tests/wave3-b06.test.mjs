// Wave 3, batch W3-B06: W6-S2-03 (CD-WF5-06 native #ledger scrolling + 'All' button in #ledger h2)
// and W6-S2-04 (1-tap #turnline .bag Unseen Tiles + Shift+U, swapHtml bag vowel/consonant odds + stallNote, Daily Turn 8-9 perc2 brush).
import { swapHtml, stallNote } from '../src/js/ui.js';

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
  {
    name: 'W6-S2-04 swapHtml renders exact bag vowel/consonant/blank counts and swap stallNote warnings (Node)',
    node: true,
    async run(t) {
      const rack = ['Q', 'V', 'W', 'Z', 'B', 'C', 'D'];
      const noState = swapHtml(rack);
      t.expect(!/swap-bag|swap-stall/.test(noState), 'swapHtml(rack) stays backward-compatible without game state');

      const s1 = { mode: 'play', over: false, scoreless: 0, players: [{}, {}], bag: ['A', 'E', 'I', 'O', 'T', 'R', 'S', 'N', 'L', '?'] };
      const h1 = swapHtml(rack, s1);
      t.expect(h1.includes('In the bag (10):') && h1.includes('4 vowels') && h1.includes('5 consonants') && h1.includes('1 blank'), 'swapHtml lists exact bag vowels, consonants, and blanks: ' + h1);
      t.expect(!/swap-stall/.test(h1), 'no stall warning at scoreless=0');

      const sNoBlank = { mode: 'play', over: false, scoreless: 2, players: [{}, {}], bag: ['A', 'T', 'R', 'S', 'N', 'L', 'D'] };
      const h2 = swapHtml(rack, sNoBlank);
      t.expect(h2.includes('1 vowel') && h2.includes('6 consonants') && !/blank/.test(h2), 'singular vowel and omitted 0 blanks');
      t.expect(h2.includes('After this, 1 more turn without a score would end the game.'), 'scoreless=2 in 2P warns 1 more turn after swap');

      const sEnd = { mode: 'play', over: false, scoreless: 3, players: [{}, {}], bag: ['A', 'E', 'T', 'R', 'S', 'N', 'L'] };
      const h3 = swapHtml(rack, sEnd);
      t.expect(h3.includes('Swapping now ends the game.'), 'scoreless=3 in 2P warns swapping now ends the game');
      t.equal(stallNote(sEnd, true), 'Passing now ends the game.', 'stallNote(s, true) preserves Pass wording');
      t.equal(stallNote(sEnd, 'swap'), 'Swapping now ends the game.', 'stallNote(s, "swap") uses Swap wording');

      const sDaily = { mode: 'daily', over: false, scoreless: 3, players: [{}], bag: ['A', 'E', 'T', 'R', 'S', 'N', 'L'] };
      t.expect(!/swap-stall/.test(swapHtml(rack, sDaily)), 'Daily mode omits stall warning in swapHtml');
    },
  },
  {
    name: 'W6-S2-04 1-tap #turnline .bag and Shift+U open Unseen Tiles, Swap shows bag odds & stall warning, and Daily Turn 8-9 activates perc2 brush',
    viewports: ['desktop', 'mobile'],
    initScript: () => {
      window.__TEST_TIPS__ = false;
      if (!localStorage.getItem('hs-letters-settings-v1')) {
        localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: true }));
      }
    },
    async run(t) {
      await ready(t);
      await t.page.click('[data-go="setup"]');
      await t.game('newGame', { seed: 3, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
      await t.waitIdle(6000);

      // 1) 1-tap #turnline .bag opens Unseen Tiles (Play mode)
      const bagBtn = await t.page.evaluate(() => {
        const b = document.querySelector('#turnline button.bag[data-open-tracker]');
        return b ? { text: b.textContent.trim(), label: b.getAttribute('aria-label') } : null;
      });
      t.expect(!!bagBtn && /tiles in the bag/.test(bagBtn.text), `Play #turnline .bag is a clickable button (${JSON.stringify(bagBtn)})`);
      await t.page.click('#turnline [data-open-tracker]');
      t.equal((await t.state()).dialog, 'tracker', 'clicking #turnline .bag opens Unseen tiles');
      t.expect(/tiles you cannot see/.test(await t.page.textContent('#modal .tracker')), 'Unseen tiles content rendered');
      await t.page.click('#modal [data-close]');
      t.equal((await t.state()).dialog, null, 'Unseen tiles closed');

      // 2) Shift+U opens Unseen Tiles on keyboard
      await t.page.keyboard.press('Shift+U');
      t.equal((await t.state()).dialog, 'tracker', 'Shift+U opens Unseen tiles');
      await t.game('act', 'close');

      // 3) Swap dialog displays live bag vowel/consonant counts + stall warning when near stall
      const st = (await t.state()).game;
      st.bag = ['A', 'E', 'I', 'O', 'U', 'T', 'R', 'S', 'N', 'L', 'D', '?'];
      st.scoreless = 3;
      await t.game('setState', { game: st });
      await t.page.click('[data-act="swap"]');
      t.equal((await t.state()).dialog, 'swap', 'Swap dialog opened');
      const swapInfo = await t.page.evaluate(() => ({
        bag: document.querySelector('#modal .swap-bag')?.textContent.trim() || '',
        stall: document.querySelector('#modal .swap-stall')?.textContent.trim() || '',
        role: document.querySelector('#modal .swap-stall')?.getAttribute('role') || '',
      }));
      t.equal(swapInfo.bag, 'In the bag (12): 5 vowels, 6 consonants, 1 blank.', 'Swap dialog shows exact bag vowel/consonant/blank counts');
      t.equal(swapInfo.stall, 'Swapping now ends the game.', 'Swap dialog shows prominent stall warning');
      t.equal(swapInfo.role, 'alert', 'Swap stall warning carries role=alert');
      const cSwapDay = await t.contrastReport({ selector: '#modal .swap', min: 4.5, largeMin: 3 });
      t.equal(cSwapDay.fails.length, 0, 'Day Swap dialog passes WCAG contrast (' + JSON.stringify(cSwapDay.fails) + ')');
      await t.shot('w3-b06-swap-odds-stall');
      await t.game('act', 'close');

      // Night contrast on Swap dialog and #turnline .bag
      await t.game('scene', 'settings');
      await t.page.click('[data-set="theme"][data-val="dark"]');
      await t.game('scene', 'game');
      const cTlNight = await t.contrastReport({ selector: '#turnline', min: 4.5, largeMin: 3 });
      t.equal(cTlNight.fails.length, 0, 'Night #turnline .bag button passes WCAG contrast (' + JSON.stringify(cTlNight.fails) + ')');
      await t.page.click('[data-act="swap"]');
      const cSwapNight = await t.contrastReport({ selector: '#modal .swap', min: 4.5, largeMin: 3 });
      t.equal(cSwapNight.fails.length, 0, 'Night Swap dialog passes WCAG contrast (' + JSON.stringify(cSwapNight.fails) + ')');
      await t.game('act', 'close');

      // 4) Pass-and-Play privacy curtain hides #turnline [data-open-tracker] so hidden racks never leak
      await t.game('newGame', { seed: 4, seats: [{ kind: 'human', name: 'Ann' }, { kind: 'human', name: 'Bo' }] });
      await t.waitIdle(6000);
      t.equal(await t.page.locator('#turnline [data-open-tracker]').count(), 0, 'privacy curtain suppresses #turnline tracker trigger');
      await t.game('act', 'reveal');
      t.equal(await t.page.locator('#turnline [data-open-tracker]').count(), 1, 'revealing rack restores #turnline tracker trigger');

      // 5) Desktop: Daily Turn 8-9 (intensity 0.5) activates perc2 brush layer, and Daily #turnline bag opens Unseen Tiles
      if (t.viewport === 'desktop') {
        const percOnly = await t.page.evaluate(async () => {
          const { makeAudioKit, measureAudio, SCORES } = await import(new URL('src/js/music.js', location.href).href);
          const brushOnly = { bpm: SCORES.table.bpm, key: SCORES.table.key, form: 'A', sections: { A: [0, 0] }, perc2: SCORES.table.perc2, lp: SCORES.table.lp, delay: 0 };
          const at04 = await measureAudio((oc, dst) => { const k = makeAudioKit(oc, dst, { seed: 7, music: 1, ambience: 0 }); k.music.intensity(0.4); k.music.play(brushOnly, { at: 0, fade: 0.01 }); k.scheduleUntil(4); }, 4);
          const at05 = await measureAudio((oc, dst) => { const k = makeAudioKit(oc, dst, { seed: 7, music: 1, ambience: 0 }); k.music.intensity(0.5); k.music.play(brushOnly, { at: 0, fade: 0.01 }); k.scheduleUntil(4); }, 4);
          return { p04: at04.peak, p05: at05.peak };
        });
        t.equal(percOnly.p04, 0, 'perc2 stays silent below intensity 0.5');
        t.expect(percOnly.p05 > 0.01, `perc2 brush activates cleanly at Daily Turn 8-9 intensity=0.5 (peak=${percOnly.p05})`);
        const r0 = await t.game('audioRender', 'table', 20, false, { intensity: 0 });
        const r5 = await t.game('audioRender', 'table', 20, false, { intensity: 0.5 });
        const r9Full = await t.game('audioRender', 'table', 20, false, { intensity: 0.9, vol: 1 });
        t.log(`Daily perc2 check (20s): perc2@0.4=${percOnly.p04} perc2@0.5=${percOnly.p05} | table i=0 peak=${r0.peak} | i=0.5 peak=${r5.peak} | i=0.9@vol1 peak=${r9Full.peak}`);
        t.expect(r5.peak > r0.peak, `Daily Turn 8-9 intensity=0.5 lifts peak over baseline (${r5.peak} > ${r0.peak})`);
        t.expect(r9Full.peak <= 0.88, `full-volume endgame table stays <= 0.88 (${r9Full.peak})`);

        await t.page.evaluate(() => localStorage.removeItem('hs-letters-save-v1'));
        await t.game('scene', 'title');
        await t.page.click('[data-go="daily"]');
        await t.page.waitForFunction(() => window.__game.getState().scene === 'game', null, { timeout: 10000 });
        await t.waitIdle(6000);
        await t.page.click('#turnline [data-open-tracker]');
        t.equal((await t.state()).dialog, 'tracker', 'Daily desktop #turnline bag link opens Unseen tiles');
        await t.game('act', 'close');
      }
    },
  },
];

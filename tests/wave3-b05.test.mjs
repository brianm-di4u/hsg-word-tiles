// Wave 3, batch W3-B05: W6-S2-01, W6-P-N02, W6-S2-05.
import { activeStreak, streakRestReady, nextStreak } from '../src/js/stats.js';
import { dailyLine } from '../src/js/ui.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false }));
  }
};

export const tests = [
  {
    name: 'W6-S2-01 selecting a persona card clears custom seat.level override and same-scene Setup/Settings/Help updates preserve #screen.scrollTop and focus',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.page.click('#screen [data-go="setup"]');
      await t.waitFrames(2);

      // 1) Open House rules, override seat 1 (Opal) difficulty to Hard, then select Hollis -> seat.level must clear to Hollis's default (medium)
      await t.page.click('.house-rules summary');
      await t.page.selectOption('[data-level="1"]', 'hard');
      t.equal(await t.page.inputValue('[data-level="1"]'), 'hard', 'difficulty override applied');
      t.expect(/Custom difficulty/.test(await t.page.textContent('.house-rules summary')), 'House rules summary reflects Custom difficulty');

      await t.page.click('[data-persona="1"][data-val="hollis"]');
      const afterPersona = await t.page.evaluate(() => ({
        levelProp: window.__G.setup.seats[1].level ?? null,
        selectVal: document.querySelector('[data-level="1"]')?.value,
        summary: document.querySelector('.house-rules summary')?.textContent || '',
        focusedVal: document.activeElement?.getAttribute('data-val'),
      }));
      t.equal(afterPersona.levelProp, null, 'clicking persona card clears seat.level override');
      t.equal(afterPersona.selectVal, 'medium', 'difficulty select resets to Hollis default (medium)');
      t.expect(!/Custom difficulty/.test(afterPersona.summary), 'House rules summary drops Custom difficulty');
      t.equal(afterPersona.focusedVal, 'hollis', 'focus stays on clicked persona card');

      // Now select Opal -> resets to Easy and starts an Easy match
      await t.page.selectOption('[data-level="1"]', 'hard');
      await t.page.click('[data-persona="1"][data-val="opal"]');
      t.equal(await t.page.inputValue('[data-level="1"]'), 'easy', 'clicking Opal clears Hard override back to Easy');

      // 2) Same-scene Setup updates preserve #screen.scrollTop and focused control identity
      await t.page.click('[data-add]');
      await t.page.click('[data-add]');
      const setupScroll = await t.page.evaluate(() => {
        const scr = document.querySelector('#screen');
        scr.scrollTop = 180;
        return scr.scrollTop;
      });
      t.expect(setupScroll > 40, `Setup is scrollable for scrollTop preservation test (${setupScroll}px)`);
      await t.page.click('[data-kind="human"][data-k="2"]');
      const afterKind = await t.page.evaluate(() => ({
        top: document.querySelector('#screen').scrollTop,
        focusKind: document.activeElement?.getAttribute('data-kind'),
        focusK: document.activeElement?.getAttribute('data-k'),
      }));
      t.expect(Math.abs(afterKind.top - setupScroll) <= 2, `Setup data-kind preserves #screen.scrollTop (${setupScroll} -> ${afterKind.top})`);
      t.equal(`${afterKind.focusKind}:${afterKind.focusK}`, 'human:2', 'Setup data-kind keeps focus on clicked radio');

      await t.page.click('[data-remove="3"]');
      const afterRem = await t.page.evaluate(() => ({
        top: document.querySelector('#screen').scrollTop,
        focusAttr: document.activeElement?.hasAttribute('data-remove') || document.activeElement?.hasAttribute('data-add'),
      }));
      t.expect(afterRem.top > 0, `Setup data-remove preserves scroll instead of snapping to 0 (${afterRem.top})`);
      t.equal(afterRem.focusAttr, true, 'Setup data-remove keeps focus on valid seat control');

      // 3) Same-scene Settings update preserves #screen.scrollTop and focused control identity
      await t.game('scene', 'settings');
      const setScroll = await t.page.evaluate(() => {
        const scr = document.querySelector('#screen');
        scr.scrollTop = Math.min(220, scr.scrollHeight - scr.clientHeight);
        return scr.scrollTop;
      });
      t.expect(setScroll > 20, `Settings is scrollable (${setScroll}px)`);
      await t.page.evaluate(() => {
        document.querySelector('[data-set="townCue"][data-val="false"]').click();
      });
      const afterSet = await t.page.evaluate(() => ({
        top: document.querySelector('#screen').scrollTop,
        setKey: document.activeElement?.getAttribute('data-set'),
        setVal: document.activeElement?.getAttribute('data-val'),
      }));
      t.expect(Math.abs(afterSet.top - setScroll) <= 2, `Settings preserves #screen.scrollTop (${setScroll} -> ${afterSet.top})`);
      t.equal(`${afterSet.setKey}:${afterSet.setVal}`, 'townCue:false', 'Settings keeps focus on toggled radio');

      // 4) Same-scene Help tab switch preserves #screen.scrollTop and focused tab identity
      await t.game('scene', 'help');
      const helpScroll = await t.page.evaluate(() => {
        const scr = document.querySelector('#screen');
        scr.scrollTop = 140;
        return scr.scrollTop;
      });
      t.expect(helpScroll > 40, `Help is scrollable (${helpScroll}px)`);
      await t.page.evaluate(() => {
        document.querySelector('[data-tab="squares"]').click();
      });
      const afterHelp = await t.page.evaluate(() => ({
        top: document.querySelector('#screen').scrollTop,
        tab: document.activeElement?.getAttribute('data-tab'),
      }));
      t.expect(Math.abs(afterHelp.top - helpScroll) <= 2, `Help tab update preserves #screen.scrollTop (${helpScroll} -> ${afterHelp.top})`);
      t.equal(afterHelp.tab, 'squares', 'Help tab update keeps focus on selected tab');

      // Navigating to a different scene still resets scrollTop to 0
      await t.game('scene', 'setup');
      const freshTop = await t.page.evaluate(() => document.querySelector('#screen').scrollTop);
      t.equal(freshTop, 0, 'entering a different scene resets #screen.scrollTop to 0');
    },
  },
  {
    name: 'W6-P-N02 activeStreak, streakRestReady, nextStreak gap<=0 guard, and dailyLine handle live, rest-day, expired, and backward dates (Node)',
    node: true,
    async run(t) {
      t.equal(activeStreak({ streak: 7, last: '2026-11-24', rest: null }, '2026-11-24'), 7, 'gap 0 returns live streak');
      t.equal(activeStreak({ streak: 7, last: '2026-11-23', rest: null }, '2026-11-24'), 7, 'gap 1 returns live streak');
      t.equal(activeStreak({ streak: 7, last: '2026-11-22', rest: null }, '2026-11-24'), 7, 'gap 2 with spare rest returns live streak');
      t.equal(streakRestReady({ streak: 7, last: '2026-11-22', rest: null }, '2026-11-24'), true, 'gap 2 with spare rest sets streakRestReady');
      t.equal(activeStreak({ streak: 7, last: '2026-11-22', rest: '2026-11-20' }, '2026-11-24'), 0, 'gap 2 without spare rest expires to 0');
      t.equal(streakRestReady({ streak: 7, last: '2026-11-22', rest: '2026-11-20' }, '2026-11-24'), false, 'gap 2 without spare rest is not rest-ready');
      t.equal(activeStreak({ streak: 7, last: '2026-11-22', rest: '2026-11-17' }, '2026-11-24'), 7, 'gap 2 exactly 7 days after prior rest is live again');
      t.equal(activeStreak({ streak: 14, last: '2026-11-01', rest: null }, '2026-11-24'), 0, 'gap > 2 expires streak to 0');
      t.equal(activeStreak({ streak: 5, last: '2026-11-25', rest: null }, '2026-11-24'), 0, 'gap < 0 returns 0 from activeStreak');
      t.equal(activeStreak({ streak: 5, last: null }, '2026-11-24'), 0, 'missing last returns 0');

      const back = nextStreak({ streak: 8, last: '2026-11-24', rest: null }, '2026-11-22');
      t.equal(back.streak, 8, 'nextStreak with gap < 0 preserves active streak');
      const same = nextStreak({ streak: 8, last: '2026-11-24', rest: null }, '2026-11-24');
      t.equal(same.streak, 8, 'nextStreak with gap === 0 preserves active streak');

      t.equal(dailyLine({ streak: 14, last: '2026-11-01', today: null, todayDate: '2026-11-24' }), '10 turns, the same tiles for everyone', 'expired streak hidden on Title dailyLine');
      t.equal(dailyLine({ streak: 6, last: '2026-11-22', rest: null, today: null, todayDate: '2026-11-24' }), '10 turns · streak 6 · rest day ready', 'rest-day window surfaces subtle rest-day cue on Title');
      t.equal(dailyLine({ streak: 6, last: '2026-11-23', rest: null, today: null, todayDate: '2026-11-24' }), '10 turns · streak 6', 'gap 1 shows live streak without rest-day cue');
    },
  },
  {
    name: 'W6-P-N02 Title and Records hide expired Daily streaks, show rest-day cue on gap=2+spare, and preserve active streak on backward-date completions',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      const dates = await t.page.evaluate(() => {
        const d = new Date();
        const fmt = (off) => {
          const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() + off, 12));
          return x.toISOString().slice(0, 10);
        };
        return { today: fmt(0), d1: fmt(-1), d2: fmt(-2), d3: fmt(-3), d14: fmt(-14) };
      });

      // 1) Expired streak (14 days ago): Title hides dead streak, Records shows 0 day streak while keeping best streak 14
      await t.page.evaluate((d14) => {
        localStorage.setItem('hs-letters-daily-v1', JSON.stringify({ days: { [d14]: { score: 210, first: 210, plays: 1 } }, streak: 14, last: d14 }));
      }, dates.d14);
      await t.game('scene', 'title');
      const expiredTitle = (await t.page.textContent('[data-go="daily"] small')).trim();
      t.equal(expiredTitle, '10 turns, the same tiles for everyone', `expired streak not advertised on Title (${expiredTitle})`);
      await t.game('scene', 'records');
      const expRec = await t.page.evaluate(() => {
        const stats = [...document.querySelectorAll('.sheet.records .stat')];
        const get = (re) => stats.find((el) => re.test(el.textContent))?.querySelector('b')?.textContent.trim();
        return { dayStreak: get(/day streak/i), bestStreak: get(/best streak/i), cue: document.querySelector('.rest-cue')?.textContent || null };
      });
      t.equal(expRec.dayStreak, '0', 'Records shows 0 day streak when expired');
      t.equal(expRec.bestStreak, '14', 'Records preserves historical best streak');
      t.equal(expRec.cue, null, 'no rest-day cue when expired');

      // 2) Rest-day window (gap === 2 && spare): Title and Records show live streak + subtle rest-day status cue
      await t.page.evaluate((d2) => {
        localStorage.setItem('hs-letters-daily-v1', JSON.stringify({ days: { [d2]: { score: 225, first: 225, plays: 1 } }, streak: 6, last: d2, rest: null }));
      }, dates.d2);
      await t.game('scene', 'title');
      const restTitle = (await t.page.textContent('[data-go="daily"] small')).trim();
      t.expect(/streak 6/.test(restTitle) && /rest day ready/i.test(restTitle), `Title shows live streak + rest-day cue (${restTitle})`);
      await t.game('scene', 'records');
      const restRec = await t.page.evaluate(() => {
        const stats = [...document.querySelectorAll('.sheet.records .stat')];
        const get = (re) => stats.find((el) => re.test(el.textContent))?.querySelector('b')?.textContent.trim();
        return { dayStreak: get(/day streak/i), cue: document.querySelector('.rest-cue')?.textContent?.trim() || '' };
      });
      t.equal(restRec.dayStreak, '6', 'Records shows active streak 6 during rest-day window');
      t.expect(/Rest day ready/i.test(restRec.cue) && /6-day streak/.test(restRec.cue), `Records shows rest-day cue (${restRec.cue})`);
      await t.page.locator('.rest-cue').scrollIntoViewIfNeeded();
      await t.shot('w3-b05-records-rest-cue');

      // 3) Backward-date completion (completing d2 when d.last is already today with streak 5) must NOT wipe streak or overwrite d.last backward
      await t.page.evaluate((td) => {
        localStorage.setItem('hs-letters-daily-v1', JSON.stringify({ days: { [td]: { score: 240, first: 240, plays: 1 } }, streak: 5, last: td, rest: null }));
      }, dates.today);
      await t.game('newGame', { mode: 'daily', date: dates.d2 });
      await t.page.waitForFunction(() => window.__game.getState().scene === 'game', null, { timeout: 10000 });
      await t.waitIdle(5000);
      for (let k = 0; k < 10; k++) { await t.game('act', 'pass'); await t.waitIdle(5000); }
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 10000 });
      const afterBack = await t.page.evaluate(() => JSON.parse(localStorage.getItem('hs-letters-daily-v1')));
      t.equal(afterBack.streak, 5, 'completing older date preserves active streak 5');
      t.equal(afterBack.last, dates.today, 'completing older date does not move d.last backward');
      t.expect(!!afterBack.days[dates.d2], 'older date result is still recorded in d.days');
    },
  },
  {
    name: 'W6-S2-05 Escape dismisses any toast, rackDown clears transient toasts, non-keep toasts never hide #preview during staging, and empty-square tooltips render beneath #preview while staging',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      const CENTER = 112;
      await t.game('newGame', { seed: 3, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
      await t.waitIdle(8000);
      const s = await t.state();
      s.game.players[0].rack = 'SPRINGE'.split('');
      await t.game('setState', { game: s.game });
      await t.waitIdle(5000);

      // 1) with nothing placed, one Escape dismisses a live toast and opens the menu (ruling 23: Read the board stays one Escape away; with tiles placed it only dismisses the toast, below)
      await t.game('act', 'toast', { kind: 'soak', title: 'Full Soak! +40', sub: 'All seven tiles played.' });
      await t.page.waitForSelector('#toast.on', { timeout: 3000 });
      await t.page.keyboard.press('Escape');
      await t.page.waitForFunction(() => !document.querySelector('#toast').classList.contains('on'), null, { timeout: 3000 });
      t.equal((await t.state()).dialog, 'pause', 'the same Escape opened the menu');
      t.expect(await t.page.isVisible('#modal [data-open="boardtext"]'), 'Read the board is in it');
      await t.page.keyboard.press('Escape');
      t.equal((await t.state()).dialog, null, 'the next Escape closes the menu');

      // 2) Pressing down on a rack tile (rackDown, before any drag motion) clears a transient toast immediately
      await t.game('act', 'toast', { kind: 'bark', title: 'Opal Vance: TEA +18', sub: '“Nice warm cup.”' });
      await t.page.waitForSelector('#toast.on', { timeout: 3000 });
      const [rx, ry] = await t.game('act', 'rackTile', 0);
      await t.page.mouse.move(rx, ry);
      await t.page.mouse.down();
      await t.page.waitForFunction(() => !document.querySelector('#toast').classList.contains('on'), null, { timeout: 3000 });
      t.equal(await t.page.locator('#app.toasting').count(), 0, 'rackDown cleared transient toast before drag activation');
      await t.page.mouse.up();

      // 3) Even a non-keep toast triggered while tiles are staged NEVER sets #app.toasting or hides #preview
      await t.game('act', 'stage', [...'SPRING'].map((l, k) => ({ i: CENTER - 2 + k, l })));
      await t.game('act', 'toast', { kind: 'save', title: 'Notice', sub: 'Test notice while staging.' });
      await t.page.waitForSelector('#toast.on', { timeout: 3000 });
      const stgToast = await t.page.evaluate(() => ({
        toasting: document.querySelector('#app').classList.contains('toasting'),
        keepChip: document.querySelector('#toast').classList.contains('keep-chip'),
        ptsColor: getComputedStyle(document.querySelector('#preview .pts')).color,
      }));
      t.equal(stgToast.toasting, false, '#app.toasting is never set while G.staged.length > 0');
      t.equal(stgToast.keepChip, true, 'non-keep toast lifts into non-blocking chip during staging');
      t.expect(stgToast.ptsColor !== 'rgba(0, 0, 0, 0)', `staged #preview .pts remains opaque (${stgToast.ptsColor})`);
      // Escape dismisses the toast while leaving staged tiles untouched
      await t.page.keyboard.press('Escape');
      await t.page.waitForFunction(() => !document.querySelector('#toast').classList.contains('on'), null, { timeout: 3000 });
      t.equal((await t.state()).staged.length, 6, 'Escape dismissed toast without recalling staged tiles');
      t.equal((await t.state()).dialog, null, 'and without opening the menu over them');

      // 4) Empty-square premium & Bathhouse Row tooltips render as a quiet .sq-tip sub-line beneath live #preview during active staging
      const inspectCell = async (idx) => {
        const [x, y] = await t.game('act', 'screen', idx);
        if (t.viewport === 'mobile') await t.tap([x, y]);
        else await t.page.mouse.move(x, y);
      };
      await inspectCell(4); // empty premium square
      await t.page.waitForFunction(() => /Warm|Hot|Steam|Boiling/.test(document.querySelector('#preview .sq-tip')?.textContent || ''), null, { timeout: 3000 });
      const premTip = await t.page.evaluate(() => ({
        preview: document.querySelector('#preview').textContent,
        tip: document.querySelector('#preview .sq-tip')?.textContent?.trim() || '',
        tipVisible: getComputedStyle(document.querySelector('#preview .sq-tip')).display !== 'none',
      }));
      t.equal(premTip.tipVisible, true, 'premium .sq-tip sub-line is visible during staging');
      t.expect(/SPRING/.test(premTip.preview) && /pts/.test(premTip.preview), 'live staged score stays visible alongside .sq-tip');
      t.expect(/Warm|Hot|Steam|Boiling/.test(premTip.tip), `premium rule tooltip shown during staging (${premTip.tip})`);

      await inspectCell(8); // Superior Bathhouse Row square
      await t.page.waitForFunction(() => /Superior Bathhouse/.test(document.querySelector('#preview .sq-tip')?.textContent || ''), null, { timeout: 3000 });
      const bathTip = await t.page.evaluate(() => ({
        tip: document.querySelector('#preview .sq-tip')?.textContent?.trim() || '',
        hasMed: !!document.querySelector('#preview .sq-tip .preview-bath'),
      }));
      t.expect(/Superior Bathhouse/.test(bathTip.tip) && /\+20/.test(bathTip.tip), `Bathhouse Row rule tooltip shown during staging (${bathTip.tip})`);
      t.equal(bathTip.hasMed, true, 'Bathhouse Row sub-line shows medallion icon');
      const contrast = await t.contrastReport({ selector: '#preview', min: 4.5, largeMin: 3 });
      t.equal(contrast.fails.length, 0, `staged #preview with .sq-tip passes WCAG contrast (${JSON.stringify(contrast.fails)})`);
      await t.shot('w3-b05-staging-sq-tip');
    },
  },
];

// Wave 3, batch W3-B05: W6-S2-01, W6-P-N02, W6-S2-05.
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
];

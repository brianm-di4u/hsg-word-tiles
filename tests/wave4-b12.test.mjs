// Wave 4, batch W4-B12 (WF-3 tech_art_pipeline): W3-S1-15 (shared declarative LOOK config).
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, theme: 'light' }));
  }
};

export const tests = [
  // ---------- W3-S1-15 ----------
  {
    name: 'W3-S1-15 shared declarative LOOK config is unified across render2d.js and board3d.js and inspectable via b3',
    viewports: ['desktop'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 41, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'julian' }] });
      await t.waitIdle(8000);
      await t.waitFrames(3);

      // 1) Both modules share the exact same LOOK object reference (single source of truth)
      const modAudit = await t.page.evaluate(async () => {
        const R = await import(new URL('src/js/render2d.js', location.href).href);
        const B3 = await import(new URL('src/js/board3d.js', location.href).href);
        // Verify render2d paintBoard reads marble tint directly from LOOK (mutating and restoring)
        const origTint = R.LOOK.day.marble.boardTint;
        const cvBefore = R.paintBoard(128, 'light', true);
        const beforePx = [...cvBefore.getContext('2d').getImageData(64, 64, 1, 1).data];
        R.LOOK.day.marble.boardTint = 'rgba(0,0,255,0.5)';
        let afterPx;
        try {
          const cvAfter = R.paintBoard(128, 'light', true);
          afterPx = [...cvAfter.getContext('2d').getImageData(64, 64, 1, 1).data];
        } finally {
          R.LOOK.day.marble.boardTint = origTint;
        }
        return {
          sameRef: !!R.LOOK && R.LOOK === B3.LOOK && B3.LIGHTING_PROFILES === R.LOOK,
          hasDayNight: !!(R.LOOK && R.LOOK.day && R.LOOK.night),
          dayKeys: R.LOOK ? Object.keys(R.LOOK.day).sort() : [],
          nightKeys: R.LOOK ? Object.keys(R.LOOK.night).sort() : [],
          dayClearcoat: R.LOOK?.day?.tile?.clearcoat,
          dayClearcoatRough: R.LOOK?.day?.tile?.clearcoatRoughness,
          dayMarbleBase: R.LOOK?.day?.marble?.base,
          nightMarbleTint: R.LOOK?.night?.marble?.boardTint,
          dayTowelCloth: R.LOOK?.day?.towel?.cloth,
          nightTowelCloth: R.LOOK?.night?.towel?.cloth,
          tintResponds: afterPx[2] > beforePx[2] + 20,
        };
      });

      t.equal(modAudit.sameRef, true, 'render2d.js LOOK, board3d.js LOOK, and LIGHTING_PROFILES are the exact same object');
      t.equal(modAudit.hasDayNight, true, 'LOOK declares both day and night presets');
      for (const sec of ['env', 'envIntensity', 'fill', 'hemi', 'key', 'marble', 'preDimColor', 'table', 'tile', 'top', 'towel']) {
        t.expect(modAudit.dayKeys.includes(sec), `LOOK.day includes ${sec}`);
        t.expect(modAudit.nightKeys.includes(sec), `LOOK.night includes ${sec}`);
      }
      t.equal(modAudit.dayClearcoat, 0.25, 'LOOK.day.tile exposes clearcoat');
      t.equal(modAudit.dayClearcoatRough, 0.4, 'LOOK.day.tile exposes clearcoatRoughness');
      t.equal(JSON.stringify(modAudit.dayMarbleBase), JSON.stringify(['#D0C5AF', '#C8BCA5']), 'LOOK.day.marble holds calm travertine base');
      t.equal(modAudit.nightMarbleTint, 'rgba(20,18,31,0.22)', 'LOOK.night.marble holds twilight boardTint');
      t.equal(modAudit.dayTowelCloth, 0xb5a892, 'LOOK.day.towel holds Day taupe cloth albedo');
      t.equal(modAudit.nightTowelCloth, 0x524b61, 'LOOK.night.towel holds Night twilight cloth albedo');
      t.equal(modAudit.tintResponds, true, 'paintBoard() reads LOOK.day.marble.boardTint dynamically');

      // 2) Inspectable via window.__game.act('b3') in both Day and Night
      const dayB3 = await t.game('act', 'b3');
      t.expect(!!dayB3 && !!dayB3.look, 'window.__game.act("b3") exposes declarative look config');
      t.equal(dayB3.look.active, 'day', 'b3.look.active is "day" in Day theme');
      t.equal(dayB3.look.key.intensity, 600, 'b3.look.key.intensity matches Day spotlight');
      t.equal(dayB3.look.fill.color, 0xcfe0ff, 'b3.look.fill.color matches Day fill');
      t.equal(dayB3.look.tile.emissiveIntensity, 0.14, 'b3.look.tile.emissiveIntensity matches Day tile');
      t.equal(dayB3.look.tile.clearcoat, 0.25, 'b3.look.tile.clearcoat exposed via b3');
      t.equal(dayB3.look.towel.cloth, 0xb5a892, 'b3.look.towel.cloth exposed via b3');
      t.equal(dayB3.look.marble.grout, '#7A6340', 'b3.look.marble.grout exposed via b3');

      await t.game('scene', 'settings');
      await t.page.click('[data-set="theme"][data-val="dark"]');
      await t.game('scene', 'game');
      await t.waitIdle(6000);
      await t.waitFrames(2);

      const nightB3 = await t.game('act', 'b3');
      t.equal(nightB3.look.active, 'night', 'b3.look.active switches to "night" in Night theme');
      t.equal(nightB3.look.key.color, 0xffe1b0, 'b3.look.key.color matches Night brass lamp');
      t.equal(nightB3.look.fill.color, 0x5c72b8, 'b3.look.fill.color matches Night twilight fill');
      t.equal(nightB3.look.tile.emissiveIntensity, 0.11, 'b3.look.tile.emissiveIntensity matches Night tile');
      t.equal(nightB3.look.towel.cloth, 0x524b61, 'b3.look.towel.cloth matches Night towel');
      t.equal(nightB3.look.marble.boardTint, 'rgba(20,18,31,0.22)', 'b3.look.marble.boardTint matches Night marble tint');
    },
  },
];

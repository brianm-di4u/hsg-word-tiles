// Wave 3, hotfix batch W3-B24 (W4-S4-03): the clip checks read a sound before the ceiling after the limiter, so a cue that is too loud shows.
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });

export const tests = [
  {
    name: 'W4-S4-03 the peak before the ceiling shows a cue that is too loud, which the heard peak cannot, and is the same number below it',
    viewports: ['desktop'],
    initScript: () => {
      window.__TEST_TIPS__ = false;
      if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false }));
      let a = 24; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
    },
    async run(t) {
      await ready(t);
      // four times too loud: over full scale as it leaves the limiter, and still under 0.95 as it is heard
      for (const cue of ['featured', 'place', 'steam', 'play+featured']) {
        const r = await t.game('act', 'renderSfx', cue, 1, { gain: 4 });
        t.log(`${cue} four times too loud: ${r.prePeak} before the ceiling, heard at ${r.peak}`);
        t.expect(r.prePeak > 1 && r.peak < 0.95, `${cue} four times too loud: over 1 before the ceiling (${r.prePeak}), under 0.95 after it (${r.peak})`);
      }
      // as the game plays them the ceiling does nothing, and both numbers are the same
      for (const cue of ['featured', 'place', 'steam', 'yourturn', 'play+featured']) {
        const r = await t.game('act', 'renderSfx', cue, 0.35), hp = await t.game('act', 'renderSfx', cue, 0.35, { hp: 3500 });
        t.expect(r.peak > 0.05 && r.prePeak === r.peak, `${cue} at the shipped volume: ${r.prePeak} before the ceiling, ${r.peak} after`);
        t.expect(hp.peak > 0 && hp.prePeak === hp.peak, `${cue} above 3500 Hz: ${hp.prePeak} and ${hp.peak}`);
      }
    },
  },
];

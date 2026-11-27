// Sound: every effect, rendered offline at the default volume and at full volume, is audible, never clips, and is short.
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const NAMES = ['pick', 'place', 'recall', 'shuffle', 'play', 'swap', 'steam', 'chime', 'featured', 'turn', 'error', 'fanfare'];

export const tests = [
  {
    name: 'every sound is audible, unclipped and short',
    viewports: ['desktop'],
    // the cues are random on purpose (pitch, level and colour are nudged as each is made); a fixed seed gives the same peaks every run
    initScript: new Function('window.__TEST_TIPS__ = false; let a = 7 >>> 0; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };'),
    async run(t) {
      await ready(t);
      const rows = [];
      for (const n of NAMES) {
        const def = await t.game('act', 'renderSfx', n, 0.35);
        const full = await t.game('act', 'renderSfx', n, 1);
        rows.push(`${n} peak ${def.peak}/${full.peak} ${def.ms} ms`);
        t.expect(def.peak > 0.005, `${n} is audible at the default volume`);
        // before the ceiling after the limiter, which never lets the heard peak reach 0.95
        t.expect(full.prePeak < 0.98, `${n} does not clip at full volume (${full.prePeak})`);
        t.expect(def.ms < 1800, `${n} is short (${def.ms} ms)`);
      }
      t.log(rows.join('; '));
    },
  },
];

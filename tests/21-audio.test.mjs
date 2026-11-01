// Sound: every effect, rendered offline at the default volume and at full volume, is audible, never clips, and is short.
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const NAMES = ['pick', 'place', 'recall', 'shuffle', 'play', 'swap', 'steam', 'chime', 'featured', 'turn', 'error', 'fanfare'];

export const tests = [
  {
    name: 'every sound is audible, unclipped and short',
    viewports: ['desktop'],
    async run(t) {
      await ready(t);
      const rows = [];
      for (const n of NAMES) {
        const def = await t.game('act', 'renderSfx', n, 0.35);
        const full = await t.game('act', 'renderSfx', n, 1);
        rows.push(`${n} peak ${def.peak}/${full.peak} ${def.ms} ms`);
        t.expect(def.peak > 0.005, `${n} is audible at the default volume`);
        t.expect(full.peak < 0.98, `${n} does not clip at full volume (${full.peak})`);
        t.expect(def.ms < 1800, `${n} is short (${def.ms} ms)`);
      }
      t.log(rows.join('; '));
    },
  },
];

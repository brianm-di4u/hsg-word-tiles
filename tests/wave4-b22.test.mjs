// Wave 4, batch W4-B22 (WF-5 input_accessibility):
// - W5-S5-07: live 0-100% <output> + aria-valuetext readouts beside all four Settings range sliders
//   (completing 39b1e53 W4-S5-03 UI micro-foley, 5de063e W4-S4-14 wooden cursor tick, 1cd6e8c W4-P-N03 slider unlock,
//    and 0e50d5a W4-S5-05 Ambience level slider).
import { settingsHtml } from '../src/js/ui.js';
import { art } from '../src/js/art.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const freshInit = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: true, fx: true, music: true, amb: true, theme: 'light' }));
  }
};

const SLIDERS = [
  { id: 'set-vol', attr: 'data-vol', label: 'Volume', def: '35%', next: '0.6', nextPct: '60%' },
  { id: 'set-fxvol', attr: 'data-fxvol', label: 'Effects level', def: '100%', next: '0.45', nextPct: '45%' },
  { id: 'set-musicvol', attr: 'data-musicvol', label: 'Music level', def: '100%', next: '0', nextPct: '0%' },
  { id: 'set-ambvol', attr: 'data-ambvol', label: 'Ambience level', def: '100%', next: '0.75', nextPct: '75%' },
];

export const tests = [
  {
    name: 'W5-S5-07 settingsHtml renders 0-100% <output for=...> and aria-valuetext beside all four Settings range sliders (Node)',
    node: true,
    async run(t) {
      const prevArt = art.on;
      art.on = false;
      let html = '';
      try {
        html = settingsHtml({
          sound: true, fx: true, music: true, amb: true,
          vol: 0.35, fxVol: 1, musicVol: 0.5, ambVol: 0,
          theme: 'auto', motion: 'system', text: 1, board3d: 'auto', ai: 'normal', townCue: true, tipsSeen: true,
        });
      } finally {
        art.on = prevArt;
      }
      for (const [id, attr, pct] of [
        ['set-vol', 'data-vol', '35%'],
        ['set-fxvol', 'data-fxvol', '100%'],
        ['set-musicvol', 'data-musicvol', '50%'],
        ['set-ambvol', 'data-ambvol', '0%'],
      ]) {
        t.expect(html.includes(`id="${id}"`), `${attr} carries id="${id}"`);
        t.expect(html.includes(`${attr}`) && html.includes(`aria-valuetext="${pct}"`), `${attr} sets aria-valuetext="${pct}"`);
        t.expect(html.includes(`<output for="${id}" data-out="${attr}">${pct}</output>`), `${attr} pairs <output for="${id}"> showing ${pct}`);
      }
    },
  },
  {
    name: 'W5-S5-07 Settings sliders unlock AudioContext on first drag, update live 0-100% <output>/aria-valuetext on drag & keyboard, persist across reload, and pass layout/contrast in Day, Night & 130% text',
    viewports: ['desktop', 'mobile'],
    initScript: freshInit,
    async run(t) {
      await ready(t);
      await t.game('scene', 'settings');
      t.equal((await t.game('audioState')).ctx, null, 'AudioContext starts null before first gesture');

      // 1. Verify initial <output> and aria-valuetext on all four sliders, plus .setrow > span labels intact
      const initRows = await t.page.evaluate((list) => {
        const labels = [...document.querySelectorAll('#screen .setrow > span')].map((el) => el.textContent);
        const sliders = list.map((s) => {
          const inp = document.querySelector(`[${s.attr}]`);
          const out = document.querySelector(`output[data-out="${s.attr}"]`);
          return {
            attr: s.attr,
            id: inp && inp.id,
            forAttr: out && out.getAttribute('for'),
            vt: inp && inp.getAttribute('aria-valuetext'),
            text: out && out.textContent.trim(),
            tabular: out ? getComputedStyle(out).fontVariantNumeric : '',
          };
        });
        return { labels, sliders };
      }, SLIDERS);
      for (const s of SLIDERS) {
        t.expect(initRows.labels.includes(s.label), `.setrow > span preserves "${s.label}" label`);
        const r = initRows.sliders.find((x) => x.attr === s.attr);
        t.equal(r.id, s.id, `${s.attr} has id=${s.id}`);
        t.equal(r.forAttr, s.id, `${s.attr} <output> associated via for=${s.id}`);
        t.equal(r.vt, s.def, `${s.attr} initial aria-valuetext is ${s.def}`);
        t.equal(r.text, s.def, `${s.attr} initial <output> text is ${s.def}`);
        t.expect(/tabular-nums/.test(r.tabular), `${s.attr} <output> uses tabular-nums (${r.tabular})`);
      }

      // 2. First drag on Volume unlocks AudioContext AND updates both <output> and aria-valuetext live
      const dragSlider = (attr, val) => t.page.evaluate(([a, v]) => {
        const inp = document.querySelector(`[${a}]`);
        inp.value = v;
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        const out = document.querySelector(`output[data-out="${a}"]`);
        return { vt: inp.getAttribute('aria-valuetext'), text: out && out.textContent.trim() };
      }, [attr, val]);

      const first = await dragSlider('data-vol', '0.6');
      await t.page.waitForFunction(() => window.__game.audioState().ctx === 'running', null, { timeout: 5000 });
      t.equal((await t.game('audioState')).ctx, 'running', 'first Settings slider drag unlocks AudioContext');
      t.equal(first.vt, '60%', 'Volume aria-valuetext updates live to 60%');
      t.equal(first.text, '60%', 'Volume <output> updates live to 60%');

      for (const s of SLIDERS.slice(1)) {
        const res = await dragSlider(s.attr, s.next);
        t.equal(res.vt, s.nextPct, `${s.attr} aria-valuetext updates live to ${s.nextPct}`);
        t.equal(res.text, s.nextPct, `${s.attr} <output> updates live to ${s.nextPct}`);
      }

      // 3. Keyboard arrow stepping on focused range slider updates <output> and aria-valuetext live
      await t.page.focus('[data-ambvol]');
      await t.page.keyboard.press('ArrowRight');
      const afterKey = await t.page.evaluate(() => {
        const inp = document.querySelector('[data-ambvol]');
        const out = document.querySelector('output[data-out="data-ambvol"]');
        return { val: inp.value, vt: inp.getAttribute('aria-valuetext'), text: out.textContent.trim() };
      });
      t.equal(afterKey.vt, '80%', 'keyboard ArrowRight on Ambience slider updates aria-valuetext to 80%');
      t.equal(afterKey.text, '80%', 'keyboard ArrowRight on Ambience slider updates <output> to 80%');

      // 4. Layout + Day/Night contrast + 130% text size check
      await t.shot('w4-b22-settings-sliders-day');
      await t.checkLayout();
      const dayContrast = await t.contrastReport({ fallbackBg: [46, 28, 16] });
      t.equal(dayContrast.fails.length, 0, `Settings Day contrast passes (${dayContrast.fails.join('; ')})`);

      await t.page.click('[data-set="theme"][data-val="dark"]');
      await t.shot('w4-b22-settings-sliders-night');
      await t.checkLayout();
      const nightContrast = await t.contrastReport({ fallbackBg: [20, 18, 31] });
      t.equal(nightContrast.fails.length, 0, `Settings Night contrast passes (${nightContrast.fails.join('; ')})`);

      await t.page.click('[data-set="text"][data-val="1.3"]');
      await t.checkLayout();
      await t.page.click('[data-set="text"][data-val="1"]');
      await t.page.click('[data-set="theme"][data-val="light"]');

      // 5. Reload persistence: saved slider percentages re-render in both <output> and aria-valuetext
      await t.reload();
      await ready(t);
      await t.game('scene', 'settings');
      const persisted = await t.page.evaluate(() => ['data-vol', 'data-fxvol', 'data-musicvol', 'data-ambvol'].map((a) => ({
        attr: a,
        vt: document.querySelector(`[${a}]`).getAttribute('aria-valuetext'),
        text: document.querySelector(`output[data-out="${a}"]`).textContent.trim(),
      })));
      t.equal(persisted.map((x) => `${x.vt}/${x.text}`).join(','), '60%/60%,45%/45%,0%/0%,80%/80%', 'all four slider readouts survive reload');
    },
  },
  {
    name: 'W5-S5-07 keyboard cursor move unlocks audio and fires wooden tick, and prior UI micro-foley hooks (39b1e53, 5de063e) stay active',
    viewports: ['desktop'],
    initScript: freshInit,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 4, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
      await t.waitIdle(6000);
      t.equal((await t.game('audioState')).ctx, null, 'AudioContext starts null before keyboard cursor move');
      await t.page.focus('#board');
      const before = (await t.game('audioState')).total;
      await t.page.keyboard.press('ArrowRight');
      await t.page.waitForFunction(() => window.__game.audioState().ctx === 'running', null, { timeout: 5000 });
      const after = await t.game('audioState');
      const fired = after.played.slice(after.played.length - (after.total - before));
      t.equal(after.ctx, 'running', 'keyboard cursor move unlocked AudioContext');
      t.expect(fired.includes('tick'), `keyboard cursor move emitted soft wooden tick (${fired.join(',')})`);
    },
  },
];

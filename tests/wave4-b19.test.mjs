// Wave 4, batch W4-B19 (WF-4 sonic_world_music):
// - W4-S5-03: whisper-quiet (0.08-0.15 default peak) ceramic/brass/paper UI micro-foley (uiTap, uiTile, uiClose)
//   covering menu/Setup/Help tabs/plaque/Breakdown clicks, Swap tile toggles, Blank letter picks, and closeDialog()/back().
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const seeded = (seed) => new Function(`
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: true, fx: true, music: false, amb: false }));
  let a = ${seed} >>> 0;
  Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
`);
const CENTER = 112;

export const tests = [
  // ---------- W4-S5-03 ----------
  {
    name: 'W4-S5-03 uiTap, uiTile and uiClose sit in 0.08-0.15 default peak, vary naturally, use <=5% reverb, stay unclipped at full volume, and respect audio.on && audio.fx',
    viewports: ['desktop'],
    initScript: seeded(19),
    async run(t) {
      await ready(t);
      const med = (xs) => [...xs].sort((a, b) => a - b)[xs.length >> 1];
      const placeMed = med(await Promise.all(Array.from({ length: 10 }, () => t.game('act', 'renderSfx', 'place', 0.35)))
        .then((rs) => rs.map((r) => r.peak)));

      const summary = [];
      for (const cue of ['uiTap', 'uiTile', 'uiClose']) {
        const defs = [], fulls = [];
        for (let k = 0; k < 15; k++) {
          defs.push(await t.game('act', 'renderSfx', cue, 0.35));
          fulls.push(await t.game('act', 'renderSfx', cue, 1.0));
        }
        const mDef = med(defs.map((r) => r.peak));
        const maxFullPre = Math.max(...fulls.map((r) => r.prePeak));
        const maxMs = Math.max(...defs.map((r) => r.ms));
        const sigs = new Set(defs.map((r) => r.sig)).size;
        summary.push(`${cue}: med=${mDef.toFixed(3)} (${Math.min(...defs.map((r) => r.peak))}..${Math.max(...defs.map((r) => r.peak))}), fullPre=${maxFullPre}, ${maxMs}ms, sigs=${sigs}/15`);
        t.expect(mDef >= 0.08 && mDef <= 0.15, `${cue} default median peak in [0.08, 0.15] (${mDef.toFixed(3)})`);
        t.expect(mDef < placeMed, `${cue} (${mDef.toFixed(3)}) stays strictly below gameplay place cue (${placeMed.toFixed(3)})`);
        t.expect(maxFullPre < 0.88, `${cue} full-volume prePeak < 0.88 (${maxFullPre})`);
        t.expect(maxMs < 260, `${cue} is crisp and short (${maxMs} ms)`);
        t.expect(sigs >= 13, `${cue} varies naturally across repeats (${sigs}/15)`);
      }
      t.log(summary.join(' | '));

      // Verify distinct timbre: uiTile (dry ceramic flick) has higher zero-crossing rate than uiClose (soft downward settle)
      const tileZc = med(await Promise.all(Array.from({ length: 8 }, () => t.game('act', 'renderSfx', 'uiTile', 0.35))).then((rs) => rs.map((r) => r.zc)));
      const closeZc = med(await Promise.all(Array.from({ length: 8 }, () => t.game('act', 'renderSfx', 'uiClose', 0.35))).then((rs) => rs.map((r) => r.zc)));
      t.expect(tileZc > closeZc * 1.15, `uiTile (${tileZc} zc) is crisper than uiClose (${closeZc} zc)`);

      // Unlock live audio and verify CD-WF4-01 reverb send cap (0-5%) and audio.on / audio.fx mute gates
      await t.page.click('#screen [data-go="setup"]');
      await t.page.waitForFunction(() => window.__game.audioState().ctx === 'running', null, { timeout: 5000 });
      const rev = (await t.game('audioState')).reverb;
      for (const cue of ['uiTap', 'uiTile', 'uiClose']) {
        t.expect(rev.sends[cue] >= 0 && rev.sends[cue] <= 0.05, `${cue} reverb send in 0-5% (${rev.sends[cue]})`);
      }

      // Mute gates: when fx=false or sound=false, live synthesis produces 0 oscillators
      await t.game('scene', 'settings');
      await t.page.click('[data-set="fx"][data-val="false"]');
      const mutedFx = await t.page.evaluate(() => {
        let starts = 0;
        const orig = OscillatorNode.prototype.start;
        OscillatorNode.prototype.start = function (...a) { starts++; return orig.apply(this, a); };
        try {
          window.__game.act('sfx', 'uiTap', { delay: 0.1 });
          window.__game.act('sfx', 'uiTile', { delay: 0.2 });
          window.__game.act('sfx', 'uiClose', { delay: 0.3 });
          return starts;
        } finally {
          OscillatorNode.prototype.start = orig;
        }
      });
      t.equal(mutedFx, 0, 'uiTap/uiTile/uiClose synthesize 0 oscillators when Sound effects is Off');
      await t.page.click('[data-set="fx"][data-val="true"]');
      await t.page.click('[data-set="sound"][data-val="false"]');
      const mutedAll = await t.page.evaluate(() => {
        let starts = 0;
        const orig = OscillatorNode.prototype.start;
        OscillatorNode.prototype.start = function (...a) { starts++; return orig.apply(this, a); };
        try {
          window.__game.act('sfx', 'uiTap', { delay: 0.1 });
          return starts;
        } finally {
          OscillatorNode.prototype.start = orig;
        }
      });
      t.equal(mutedAll, 0, 'uiTap synthesizes 0 oscillators when master Sound is Off');
    },
  },
  {
    name: 'W4-S5-03 menu navigation, Setup cards, Help tabs, Swap toggles, Blank picks, Breakdown/plaque taps and dialog/sheet closes fire material-motif UI cues',
    viewports: ['desktop', 'mobile'],
    initScript: seeded(23),
    async run(t) {
      await ready(t);
      const heard = async (fn) => {
        const before = (await t.game('audioState')).total;
        await fn();
        const a = await t.game('audioState');
        return a.played.slice(a.played.length - (a.total - before));
      };

      // 1. Menu navigation -> uiTap; Setup persona card -> uiTap
      let h = await heard(() => t.page.click('#screen [data-go="setup"]'));
      t.expect(h.includes('uiTap'), `menu New game fires uiTap (${h.join(',')})`);
      h = await heard(() => t.page.click('#screen [data-persona="1"][data-val="lucky"]'));
      t.expect(h.includes('uiTap'), `Setup persona card fires uiTap (${h.join(',')})`);

      // 2. Help tab -> uiTap; sheet close (back) -> uiClose
      h = await heard(() => t.page.click('#screen [data-go="help"]'));
      t.expect(h.includes('uiTap'), `How to play navigation fires uiTap (${h.join(',')})`);
      h = await heard(() => t.page.click('#screen [data-tab="squares"]'));
      t.expect(h.includes('uiTap'), `Help tab click fires uiTap (${h.join(',')})`);
      h = await heard(() => t.page.click('#screen [data-back]'));
      t.expect(h.includes('uiClose'), `Help close (back) fires uiClose (${h.join(',')})`);

      // 3. In-game: plaque tap -> uiTap, Breakdown open/close -> uiTap/uiClose
      await t.game('newGame', { seed: 5, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
      await t.waitIdle(8000);
      const s = await t.state();
      s.game.players[0].rack = ['?', 'T', 'E', 'A', 'S', 'R', 'N'];
      await t.game('setState', { game: s.game });
      await t.waitIdle(5000);

      if (t.viewport === 'mobile') {
        h = await heard(() => t.page.click('#springs [data-springs-toggle]'));
        t.expect(h.includes('uiTap'), `mobile Featured Springs drawer toggle fires uiTap (${h.join(',')})`);
      }
      h = await heard(() => t.page.click('#springs [data-plaque="0"]'));
      t.expect(h.includes('uiTap'), `unclaimed Featured Spring plaque tap fires uiTap (${h.join(',')})`);

      // Stage TEA across center, toggle Breakdown open (uiTap) & closed (uiClose)
      await t.game('act', 'stage', [{ i: CENTER, l: 'T' }, { i: CENTER + 1, l: 'E' }, { i: CENTER + 2, l: 'A' }]);
      h = await heard(() => t.page.click('#preview .bdbtn:not([data-hintnext])'));
      t.expect(h.includes('uiTap'), `Breakdown open fires uiTap (${h.join(',')})`);
      h = await heard(() => t.page.click('#preview .bdbtn:not([data-hintnext])'));
      t.expect(h.includes('uiClose'), `Breakdown close fires uiClose (${h.join(',')})`);
      await t.game('act', 'recall');

      // 4. Swap dialog: tile toggle -> uiTile; Cancel -> uiClose
      await t.page.click('#actions [data-act="swap"]');
      await t.page.waitForSelector('#modal .swap [data-sw="0"]', { timeout: 3000 });
      h = await heard(() => t.page.click('#modal .swap [data-sw="0"]'));
      t.expect(h.includes('uiTile'), `Swap tile toggle fires uiTile (${h.join(',')})`);
      h = await heard(() => t.page.click('#modal [data-close]'));
      t.expect(h.includes('uiClose'), `Swap Cancel (closeDialog) fires uiClose (${h.join(',')})`);

      // 5. Blank picker: letter choice -> uiTile (followed by stage place, without spurious uiClose)
      const r0 = await t.game('act', 'rackTile', 0);
      if (t.viewport === 'mobile') await t.tap([r0[0], r0[1]]);
      else await t.page.mouse.click(r0[0], r0[1]);
      const ctr = await t.game('act', 'screen', CENTER);
      if (t.viewport === 'mobile') await t.tap(ctr);
      else await t.page.mouse.click(ctr[0], ctr[1]);
      await t.page.waitForSelector('#modal .blank [data-letter="S"]', { timeout: 3000 });
      h = await heard(() => t.page.click('#modal .blank [data-letter="S"]'));
      t.expect(h.includes('uiTile') && h.includes('place') && !h.includes('uiClose'), `Blank letter pick fires uiTile + place without spurious uiClose (${h.join(',')})`);
    },
  },
];

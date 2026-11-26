// Wave 5, batch W5-B03:
// - W6-S2-03: Restrict board-to-plaque comet arcs strictly to claim/row/themed triggers (never passive Daily or bag-depletion clearFog).
// - W6-S4-01: Toggle #rackbar.has-cue and clear .rack-cue below rack tile canvases across portrait, landscape, and desktop without shifting layout.
// - W6-S5-02: Tap-to-place masks destination cell during 120 ms #ghost flight via { cellI: i } and fires place audio on touchdown (cancelled cleanly on interrupt).
import { ctx } from './lib.mjs';
import { createGame, apply } from '../src/js/engine.js';
import { CENTER } from '../src/js/score.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const fullMotion = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, motion: 'full', theme: 'light' }));
  }
};

export const tests = [
  // ---------- W6-S2-03 (Node) ----------
  {
    name: 'W6-S2-03 engine apply() records entry.revealed strictly for themed/row triggers and omits it on passive clearFog()',
    node: true,
    async run(t) {
      const c = await ctx();

      // 1) Daily Soak Turn 1 plain play -> passive clearFog reveals 1 letter per plaque, entry.revealed is absent
      const d = createGame({ mode: 'daily', date: '2026-11-20' }, c.lex);
      d.players[0].rack = 'QATXXXX'.split('');
      d.featured = [
        { id: 'mineral', word: 'MINERAL', cat: 'springs', shown: [0], by: null, at: null },
        { id: 'fordyce', word: 'FORDYCE', cat: 'baths', shown: [0], by: null, at: null },
        { id: 'quapaw', word: 'QUAPAW', cat: 'town', shown: [0], by: null, at: null },
      ];
      const rd = apply(d, { type: 'play', tiles: [{ i: CENTER - 1, l: 'Q' }, { i: CENTER, l: 'A' }, { i: CENTER + 1, l: 'T' }] }, c);
      t.equal(rd.ok, true, 'Daily Turn-1 QAT accepted');
      t.equal(d.featured.every((f) => f.shown.length === 2), true, 'passive Daily clearFog cleared 1 letter per plaque');
      t.equal(rd.entry.revealed, undefined, 'passive Daily fog clear records no entry.revealed');

      // 2) Play mode plain play crossing FOG_STEPS bag threshold -> passive clearFog clears letters, entry.revealed is absent
      const s = createGame({ mode: 'play', seed: 7, seats: [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }] }, c.lex);
      s.players[0].rack = 'ADXXXXX'.split('');
      s.bag.length = 78; // drawing 2 tiles crosses FOG_STEPS step 1
      s.featured = [
        { id: 'mineral', word: 'MINERAL', cat: 'springs', shown: [0], by: null, at: null },
        { id: 'fordyce', word: 'FORDYCE', cat: 'baths', shown: [0], by: null, at: null },
        { id: 'quapaw', word: 'QUAPAW', cat: 'town', shown: [0], by: null, at: null },
      ];
      const rp = apply(s, { type: 'play', tiles: [{ i: CENTER, l: 'A' }, { i: CENTER + 1, l: 'D' }] }, c);
      t.equal(rp.ok, true, 'Play-mode AD accepted');
      t.equal(s.featured.every((f) => f.shown.length === 2), true, 'passive bag-depletion clearFog cleared 1 letter per plaque');
      t.equal(rp.entry.revealed, undefined, 'passive bag-depletion clearFog records no entry.revealed');

      // 3) Category-matching Hot Springs play records { k, reason: 'themed' }
      const st = createGame({ mode: 'play', seed: 8, seats: [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }] }, c.lex);
      st.players[0].rack = 'STEAMXX'.split('');
      st.featured = [
        { id: 'mineral', word: 'MINERAL', cat: 'springs', shown: [0], by: null, at: null },
        { id: 'fordyce', word: 'FORDYCE', cat: 'baths', shown: [0], by: null, at: null },
        { id: 'quapaw', word: 'QUAPAW', cat: 'town', shown: [0], by: null, at: null },
      ];
      const rt = apply(st, { type: 'play', tiles: [...'STEAM'].map((l, k) => ({ i: CENTER - 2 + k, l })) }, c);
      t.equal(rt.ok, true, 'STEAM play accepted');
      t.equal(JSON.stringify(rt.entry.revealed), JSON.stringify([{ k: 0, reason: 'themed' }]), 'themed category match recorded on entry.revealed');

      // 4) Bathhouse Row cover (cell 8 = Superior Bathhouse) records { k, reason: 'row' }
      const sr = createGame({ mode: 'play', seed: 9, seats: [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }] }, c.lex);
      sr.board[7] = { l: 'A', blank: false, p: 1, t: 0 };
      sr.players[0].rack = 'TXXXXXX'.split('');
      sr.featured = [
        { id: 'mineral', word: 'MINERAL', cat: 'springs', shown: [0], by: null, at: null },
        { id: 'fordyce', word: 'FORDYCE', cat: 'baths', shown: [0], by: null, at: null },
        { id: 'quapaw', word: 'QUAPAW', cat: 'town', shown: [0], by: null, at: null },
      ];
      const rr = apply(sr, { type: 'play', tiles: [{ i: 8, l: 'T' }] }, c);
      t.equal(rr.ok, true, 'plain Bathhouse Row cover AT accepted');
      t.equal(Array.isArray(rr.entry.revealed) && rr.entry.revealed.length === 1 && rr.entry.revealed[0].reason === 'row', true, 'Bathhouse Row cover recorded on entry.revealed');
    },
  },
  // ---------- W6-S2-03 (Browser) ----------
  {
    name: 'W6-S2-03 passive Daily and bag-depletion fog clears animate locally (.fog-clear) with zero board-origin comet arcs, while claim/row/themed arcs still fire',
    viewports: ['desktop', 'mobile'],
    initScript: fullMotion,
    async run(t) {
      await ready(t);

      // 1) Daily Soak Turn 1: plain non-themed QAT on center H8 -> local .fog-clear animates, 0 comet arcs
      await t.game('newGame', { mode: 'daily', date: '2026-11-20' });
      await t.waitIdle(8000);
      const sd = await t.state();
      sd.game.players[0].rack = 'QATXXXX'.split('');
      sd.game.featured = [
        { id: 'mineral', word: 'MINERAL', cat: 'springs', shown: [0], by: null, at: null },
        { id: 'fordyce', word: 'FORDYCE', cat: 'baths', shown: [0], by: null, at: null },
        { id: 'quapaw', word: 'QUAPAW', cat: 'town', shown: [0], by: null, at: null },
      ];
      await t.game('setState', { game: sd.game });
      await t.game('act', 'stage', [{ i: CENTER - 1, l: 'Q' }, { i: CENTER, l: 'A' }, { i: CENTER + 1, l: 'T' }]);
      t.equal((await t.game('act', 'play')).ok, true, 'Daily Turn-1 QAT played');
      const afterDaily = await t.page.evaluate(() => ({
        state: window.__game.getState(),
        fogClears: document.querySelectorAll('#springs .fog-clear').length,
      }));
      t.equal(afterDaily.state.game.featured.every((f) => f.shown.length === 2), true, 'Daily Turn 1 cleared 1 passive letter per plaque');
      t.equal(afterDaily.state.arcs, 0, 'Daily Turn-1 plain word fires 0 active comet arcs');
      t.equal(afterDaily.state.arcLog.length, 0, `Daily Turn-1 plain word logs 0 comet arcs (${JSON.stringify(afterDaily.state.arcLog)})`);
      t.expect(afterDaily.fogClears >= 1, `passive Daily clear still animates local .fog-clear on plaques (${afterDaily.fogClears})`);
      await t.shot('w5-b03-daily-no-arc');

      // 2) Play mode: plain AD crossing passive FOG_STEPS bag threshold -> local .fog-clear animates, 0 comet arcs
      await t.game('newGame', { seed: 7, seats: [{ kind: 'human', name: 'You' }, { kind: 'human', name: 'Player 2' }] });
      await t.waitIdle(8000);
      await t.game('act', 'reveal');
      const sp = await t.state();
      sp.game.players[0].rack = 'ADXXXXX'.split('');
      sp.game.bag.length = 78;
      sp.game.featured = [
        { id: 'mineral', word: 'MINERAL', cat: 'springs', shown: [0], by: null, at: null },
        { id: 'fordyce', word: 'FORDYCE', cat: 'baths', shown: [0], by: null, at: null },
        { id: 'quapaw', word: 'QUAPAW', cat: 'town', shown: [0], by: null, at: null },
      ];
      await t.game('setState', { game: sp.game });
      await t.game('act', 'stage', [{ i: CENTER, l: 'A' }, { i: CENTER + 1, l: 'D' }]);
      t.equal((await t.game('act', 'play')).ok, true, 'Play-mode plain AD played');
      const afterBag = await t.page.evaluate(() => ({
        state: window.__game.getState(),
        fogClears: document.querySelectorAll('#springs .fog-clear').length,
      }));
      t.equal(afterBag.state.game.featured.every((f) => f.shown.length === 2), true, 'bag-depletion threshold cleared 1 passive letter per plaque');
      t.equal(afterBag.state.arcs, 0, 'bag-depletion plain word fires 0 active comet arcs');
      t.equal(afterBag.state.arcLog.length, 0, `bag-depletion plain word logs 0 comet arcs (${JSON.stringify(afterBag.state.arcLog)})`);
      t.expect(afterBag.fogClears >= 1, `passive bag-depletion clear still animates local .fog-clear (${afterBag.fogClears})`);

      // 3) Positive controls: themed category reveal, Bathhouse Row reveal, and Featured Spring claim still fire arcs
      await t.game('newGame', { seed: 8, seats: [{ kind: 'human', name: 'You' }, { kind: 'human', name: 'Player 2' }] });
      await t.waitIdle(8000);
      await t.game('act', 'reveal');
      const sc = await t.state();
      sc.game.players[0].rack = 'STEAMXX'.split('');
      sc.game.featured = [
        { id: 'mineral', word: 'MINERAL', cat: 'springs', shown: [0], by: null, at: null },
        { id: 'fordyce', word: 'FORDYCE', cat: 'baths', shown: [0], by: null, at: null },
        { id: 'quapaw', word: 'QUAPAW', cat: 'town', shown: [0], by: null, at: null },
      ];
      await t.game('setState', { game: sc.game });
      await t.game('act', 'stage', [...'STEAM'].map((l, k) => ({ i: CENTER - 2 + k, l })));
      t.equal((await t.game('act', 'play')).ok, true, 'STEAM themed play succeeded');
      const afterThemed = await t.state();
      t.equal(afterThemed.arcLog.length, 1, 'themed play fires exactly 1 arc (only to matching category plaque)');
      t.equal(afterThemed.arcLog[0].plaque, 0, 'themed arc targets matching plaque 0');
      t.equal(afterThemed.arcLog[0].reason, 'themed', 'themed arc carries reason=themed');

      // Bathhouse Row cover (cell 8)
      const sr = await t.state();
      sr.game.cur = 0;
      sr.game.board[7] = { l: 'A', blank: false, p: 1, t: 0 };
      sr.game.players[0].rack = 'TXXXXXX'.split('');
      await t.game('setState', { game: sr.game });
      await t.game('act', 'reveal');
      await t.game('act', 'stage', [{ i: 8, l: 'T' }]);
      t.equal((await t.game('act', 'play')).ok, true, 'plain Bathhouse Row cover played');
      const afterRow = await t.state();
      t.expect(afterRow.arcLog.some((a) => a.from === 8 && a.reason === 'row'), `Bathhouse Row cover fires row arc from cell 8 (${JSON.stringify(afterRow.arcLog)})`);

      // Featured Spring claim
      const sf = await t.state();
      sf.game.cur = 0;
      sf.game.board = Array(225).fill(null);
      sf.game.featured[0] = { id: 'steam', word: 'STEAM', cat: 'springs', shown: [0], by: null, at: null };
      sf.game.players[0].rack = 'STEAMXX'.split('');
      await t.game('setState', { game: sf.game });
      await t.game('act', 'reveal');
      await t.game('act', 'stage', [...'STEAM'].map((l, k) => ({ i: CENTER - 2 + k, l })));
      t.equal((await t.game('act', 'play')).ok, true, 'STEAM Featured claim played');
      const afterClaim = await t.state();
      t.expect(afterClaim.arcLog.some((a) => a.plaque === 0 && a.reason === 'claim'), `Featured Spring claim fires claim arc (${JSON.stringify(afterClaim.arcLog)})`);
    },
  },
  // ---------- W6-S4-01 ----------
  {
    // W5-B05-hotfix (OQ-WF7-W5-02): the cue padding is for phones only; the desktop rack bar (and so the board, S4-10) keeps its
    // pre-wave-5 box, so the desktop cases pin that box instead of the phone clearance.
    name: 'W6-S4-01 #rackbar.has-cue toggles cleanly and .rack-cue never overlaps rack tile canvases (Q_10 numerals) on portrait and landscape phones at 100% & 130% text with zero layout shift; the desktop rack bar keeps its pre-wave-5 box',
    viewports: ['desktop', 'mobile'],
    initScript: fullMotion,
    async run(t) {
      await ready(t);
      const cases = t.viewport === 'mobile'
        ? [[390, 844, 'portrait'], [568, 320, 'landscape-568'], [844, 390, 'landscape-844']]
        : [[1280, 800, 'desktop-1280'], [1024, 600, 'desktop-1024']];
      // the desktop #rackbar padding and brass lip as they were at the wave-5 base (4960743)
      const DESKTOP_BOX = { 'desktop-1280': { pad: '10px 22px 16px', lip: '6px' }, 'desktop-1024': { pad: '6px 14px 11px', lip: '4px' } };

      const measure = () => t.page.evaluate(() => {
        const bar = document.querySelector('#rackbar');
        const cue = document.querySelector('#rack-cue');
        const br = bar.getBoundingClientRect();
        const cr = cue && !cue.hidden ? cue.getBoundingClientRect() : null;
        const canvases = [...document.querySelectorAll('#rack .rtile canvas')];
        const maxTileBottom = canvases.length ? Math.max(...canvases.map((c) => c.getBoundingClientRect().bottom)) : 0;
        const rackTop = Math.round(document.querySelector('#rack').getBoundingClientRect().top);
        const playRect = document.querySelector('#actions .play').getBoundingClientRect();
        const app = document.querySelector('#app');
        return {
          hasCue: bar.classList.contains('has-cue'),
          visible: !!cr && cr.width > 0 && cr.height > 0,
          cueTop: cr ? +cr.top.toFixed(1) : null,
          cueBottom: cr ? +cr.bottom.toFixed(1) : null,
          barTop: +br.top.toFixed(1),
          barBottom: +br.bottom.toFixed(1),
          maxTileBottom: +maxTileBottom.toFixed(1),
          clearance: cr ? +(cr.top - maxTileBottom).toFixed(1) : null,
          insideBar: !!cr && cr.left >= br.left - 1 && cr.right <= br.right + 1 && cr.top >= br.top - 1 && cr.bottom <= br.bottom + 1,
          rackTop,
          playTop: Math.round(playRect.top),
          playBottom: +playRect.bottom.toFixed(1),
          overflowX: app.scrollWidth - app.clientWidth,
          pad: getComputedStyle(bar).padding,
          lip: getComputedStyle(bar, '::after').bottom,
        };
      });

      for (const textScale of [1, 1.3]) {
        await t.page.evaluate((ts) => {
          const s = JSON.parse(localStorage.getItem('hs-letters-settings-v1') || '{}');
          s.text = ts;
          s.townCue = true;
          localStorage.setItem('hs-letters-settings-v1', JSON.stringify(s));
        }, textScale);
        await t.reload();
        await ready(t);

        for (const [w, h, label] of cases) {
          const tag = `${label} ${Math.round(textScale * 100)}%`;
          await t.page.setViewportSize({ width: w, height: h });
          await t.game('newGame', { seed: 9, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
          await t.waitIdle(6000);
          for (let k = 0; k < 2; k++) { await t.page.evaluate(() => dispatchEvent(new Event('resize'))); await t.waitFrames(1); }

          // Off state: no Hot Springs word in rack
          let st = (await t.state()).game;
          st.players[0].rack = ['Q', 'X', 'Z', 'V', 'W', 'Y', 'B'];
          await t.game('setState', { game: st });
          await t.waitFrames(1);
          const off = await measure();
          t.equal(off.hasCue, false, `${tag}: #rackbar omits .has-cue when rack has no town word`);
          t.equal(off.visible, false, `${tag}: #rack-cue hidden when rack has no town word`);

          // On state: SPA + Q_10 in center slots where the pill sits
          st = (await t.state()).game;
          st.players[0].rack = ['S', 'P', 'A', 'Q', 'X', 'Z', 'V'];
          await t.game('setState', { game: st });
          await t.waitFrames(1);
          const on = await measure();
          t.equal(on.hasCue, true, `${tag}: #rackbar carries .has-cue when town word is in rack`);
          t.equal(on.visible, true, `${tag}: #rack-cue visible`);
          t.equal(on.insideBar, true, `${tag}: #rack-cue stays strictly inside #rackbar (${on.cueTop}..${on.cueBottom} in ${on.barTop}..${on.barBottom})`);
          if (t.viewport === 'mobile') {
            t.expect(on.cueTop >= on.maxTileBottom - 0.1, `${tag}: #rack-cue clears all rack tile canvases including Q_10 (cueTop ${on.cueTop} >= tileBottom ${on.maxTileBottom}, clearance=${on.clearance} px)`);
          } else {
            const box = DESKTOP_BOX[label];
            t.equal(on.pad, box.pad, `${tag}: desktop #rackbar padding is the pre-wave-5 ${box.pad} with the cue showing`);
            t.equal(off.pad, box.pad, `${tag}: and without it`);
            t.equal(on.lip, box.lip, `${tag}: desktop brass lip sits at its pre-wave-5 bottom ${box.lip}`);
            t.log(`${tag}: desktop cue ${on.cueTop}..${on.cueBottom}, tile bottom ${on.maxTileBottom} (clearance ${on.clearance} px), bar ${on.barTop}..${on.barBottom}`);
          }
          t.equal(on.rackTop, off.rackTop, `${tag}: toggling .has-cue causes 0 px shift on #rack`);
          t.equal(on.playTop, off.playTop, `${tag}: toggling .has-cue causes 0 px shift on #actions .play`);
          t.expect(on.playBottom <= h + 0.5, `${tag}: Play button stays on screen (${on.playBottom} <= ${h})`);
          t.equal(on.overflowX, 0, `${tag}: zero horizontal overflow`);

          if (textScale === 1 && t.viewport === 'mobile' && (label === 'portrait' || label === 'landscape-568')) {
            await t.shot(`w5-b03-rack-cue-${label}`);
          }
        }
      }
      await t.page.setViewportSize({ width: t.vp.width, height: t.vp.height });
    },
  },
  // ---------- W6-S5-02 ----------
  {
    name: 'W6-S5-02 tap-to-place masks destination cell during 120 ms #ghost flight, fires place audio at touchdown, and cancels cleanly on interrupt',
    viewports: ['desktop', 'mobile'],
    url: 'index.html?gl=0',
    initScript: () => {
      window.__TEST_TIPS__ = false;
      if (!localStorage.getItem('hs-letters-settings-v1')) {
        localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: true, fx: true, music: false, amb: false, motion: 'full', theme: 'light' }));
      }
    },
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 3, seats: [{ kind: 'human', name: 'You' }, { kind: 'human', name: 'Player 2' }] });
      await t.waitIdle(6000);
      await t.game('act', 'reveal');
      const st = await t.state();
      st.game.players[0].rack = ['S', 'P', 'R', 'I', 'N', 'G', 'E'];
      await t.game('setState', { game: st.game });
      await t.waitFrames(2);

      // Neutral empty cell adjacent to center (row 7 col 8 = CENTER + 1) so empty marble vs landed ceramic tile has clear pixel diff
      const targetCell = CENTER + 1;
      const sampleCell = async (cellIdx) => {
        const [cx, cy] = await t.game('act', 'cell', cellIdx);
        return t.page.evaluate(([x, y]) => {
          const cv = document.querySelector('#board'), dpr = cv.width / cv.getBoundingClientRect().width;
          const r = Math.max(4, Math.round(5 * dpr));
          const px = Math.round(x * dpr) - r, py = Math.round(y * dpr) - r;
          const data = cv.getContext('2d').getImageData(px, py, r * 2, r * 2).data;
          let sum = 0;
          const out = [];
          for (let k = 0; k < data.length; k += 4) { sum += data[k] + data[k + 1] + data[k + 2]; out.push(data[k], data[k + 1], data[k + 2]); }
          return { mean: +(sum / (data.length / 4 * 3)).toFixed(2), pixels: out };
        }, [cx, cy]);
      };
      const patchDiff = (a, b) => {
        let tot = 0;
        for (let k = 0; k < a.pixels.length; k++) tot += Math.abs(a.pixels[k] - b.pixels[k]);
        return +(tot / a.pixels.length).toFixed(2);
      };

      const emptyBefore = await sampleCell(targetCell);

      // Select rack tile 0 (also unlocks AudioContext via user gesture)
      const r0 = await t.game('act', 'rackTile', 0);
      const cellPt = await t.game('act', 'screen', targetCell);
      await t.page.mouse.click(r0[0], r0[1]);
      await t.page.waitForFunction(() => window.__game.audioState().ctx === 'running', null, { timeout: 5000 });
      const placesBefore = await t.page.evaluate(() => window.__game.audioState().played.filter((x) => x === 'place').length);

      // Tap target board square -> 120 ms #ghost flight with destination cell masked
      await t.page.mouse.click(cellPt[0], cellPt[1]);
      await t.waitFrames(1);
      const mid = await t.page.evaluate(() => {
        const gh = document.querySelector('#ghost');
        return {
          ghostVisible: !gh.hidden,
          tr: gh.style.transition,
          returningCell: window.__G.returningCell,
          hasOnLand: typeof window.__G.returnOnLand === 'function',
          places: window.__game.audioState().played.filter((x) => x === 'place').length,
          stagedCount: window.__G.staged.length,
        };
      });
      const duringFlight = await sampleCell(targetCell);
      const diffMid = patchDiff(emptyBefore, duringFlight);

      t.equal(mid.ghostVisible, true, 'tap-to-place shows #ghost during flight');
      t.expect(/120ms/.test(mid.tr), `tap-to-place runs 120 ms #ghost flight (${mid.tr})`);
      t.equal(mid.returningCell, targetCell, 'G.returningCell masks destination cell during flight');
      t.equal(mid.hasOnLand, true, 'touchdown audio callback queued on G.returnOnLand');
      t.equal(mid.stagedCount, 1, 'tile is logically staged immediately');
      t.equal(mid.places, placesBefore, 'place audio does NOT fire early before touchdown');
      t.expect(diffMid < 4, `destination cell on #board stays masked (no duplicate tile rendered) during flight (pixel diff=${diffMid})`);

      // Wait for #ghost touchdown (state-driven wait)
      await t.page.waitForFunction(() => document.querySelector('#ghost').hidden && window.__G.returningCell === null, null, { timeout: 4000 });
      await t.waitFrames(1);
      const landed = await t.page.evaluate(() => ({
        places: window.__game.audioState().played.filter((x) => x === 'place').length,
        hasOnLand: window.__G.returnOnLand !== null,
      }));
      const afterLand = await sampleCell(targetCell);
      const diffLand = patchDiff(emptyBefore, afterLand);

      t.equal(landed.places, placesBefore + 1, 'place audio fires once at touchdown');
      t.equal(landed.hasOnLand, false, 'G.returnOnLand cleared after touchdown');
      t.expect(diffLand > 15, `destination cell renders landed ceramic tile after endReturn() (pixel diff=${diffLand})`);

      // 1b) W5-B05-hotfix follow-up 3: a tap that cuts the flight short but keeps the tile staged (the next rack tile, a tap on
      // another square) lands it at once, with its clack, settle and haptic. The 135 ms flight timer is held so the interrupt
      // always comes mid-flight (state, not timing); haptics are recorded through a stub, as a phone has the function.
      await t.page.evaluate(() => {
        window.__vib = []; navigator.vibrate = (p) => { window.__vib.push(p); return true; }; window.__G.settings.vibrate = true;
        window.__heldFlights = 0; window.__origSetTimeout = window.setTimeout;
        window.setTimeout = function (fn, ms, ...a) { if (ms === 135) { window.__heldFlights++; return 0; } return window.__origSetTimeout(fn, ms, ...a); };
      });
      const keepCases = [
        { cell: CENTER + 3, label: 'the next rack tile', interrupt: async () => { const r = await t.game('act', 'rackTile', 0); await t.page.mouse.click(r[0], r[1]); } },
        { cell: CENTER + 15, label: 'a tap on another square', interrupt: async () => { const p = await t.game('act', 'screen', CENTER - 15); await t.page.mouse.click(p[0], p[1]); } },
      ];
      for (const kc of keepCases) {
        const rk = await t.game('act', 'rackTile', 0);
        const pk = await t.game('act', 'screen', kc.cell);
        await t.page.mouse.click(rk[0], rk[1]);
        const pre = await t.page.evaluate(() => ({ places: window.__game.audioState().played.filter((x) => x === 'place').length, vib: window.__vib.length, held: window.__heldFlights }));
        await t.page.mouse.click(pk[0], pk[1]);
        const flying = await t.page.evaluate((c) => ({ pending: typeof window.__G.returnOnLand === 'function', cell: window.__G.returningCell, held: window.__heldFlights, places: window.__game.audioState().played.filter((x) => x === 'place').length }), kc.cell);
        t.expect(flying.pending && flying.cell === kc.cell && flying.held === pre.held + 1, `${kc.label}: the tile is in flight to its square with its landing pending (${JSON.stringify(flying)})`);
        t.equal(flying.places, pre.places, `${kc.label}: no clack before touchdown`);
        await kc.interrupt();
        const after = await t.page.evaluate((c) => ({
          places: window.__game.audioState().played.filter((x) => x === 'place').length,
          vib: window.__vib.length,
          settle: window.__G.settle.has(c),
          staged: window.__G.staged.some((x) => x.i === c),
          pending: window.__G.returnOnLand !== null,
          cell: window.__G.returningCell,
        }), kc.cell);
        t.equal(after.staged, true, `${kc.label}: the tile stays staged on its square`);
        t.equal(after.places, pre.places + 1, `${kc.label}: the interrupted flight still gives its touchdown clack, once`);
        t.equal(after.settle, true, `${kc.label}: and its settle`);
        t.expect(after.vib >= pre.vib + 1, `${kc.label}: and its haptic (${pre.vib} -> ${after.vib})`);
        t.expect(!after.pending && after.cell === null, `${kc.label}: nothing is left pending`);
        await t.game('act', 'recall');
        await t.page.evaluate(() => { window.__G.selected = null; });   // the rack press above also selected a tile
      }
      await t.page.evaluate(() => { window.setTimeout = window.__origSetTimeout; window.__G.settings.vibrate = false; });
      await t.waitIdle(3000);

      // 2) Interruption mid-flight cancels pending touchdown audio cleanly (no phantom delayed place cue)
      const cell2 = CENTER + 2;
      const rNext = await t.game('act', 'rackTile', 0);
      const pt2 = await t.game('act', 'screen', cell2);
      await t.page.mouse.click(rNext[0], rNext[1]);
      const placesPreInt = await t.page.evaluate(() => window.__game.audioState().played.filter((x) => x === 'place').length);
      await t.page.mouse.click(pt2[0], pt2[1]); // starts 120 ms flight to cell2
      // Immediately tap cell2 again to interrupt flight and unstage it
      await t.page.mouse.click(pt2[0], pt2[1]);
      const afterInt = await t.page.evaluate(() => ({
        returningCell: window.__G.returningCell,
        hasOnLand: window.__G.returnOnLand !== null,
        places: window.__game.audioState().played.filter((x) => x === 'place').length,
      }));
      t.equal(afterInt.returningCell, null, 'interrupting flight clears G.returningCell immediately');
      t.equal(afterInt.hasOnLand, false, 'interrupting flight cancels pending onLand callback');
      t.equal(afterInt.places, placesPreInt, 'interrupted flight fires zero phantom place audio');

      // Wait for unstage flight to finish (state-driven) and verify still zero phantom place cue
      await t.page.waitForFunction(() => document.querySelector('#ghost').hidden && window.__G.returning === null, null, { timeout: 4000 });
      const placesPostInt = await t.page.evaluate(() => window.__game.audioState().played.filter((x) => x === 'place').length);
      t.equal(placesPostInt, placesPreInt, 'no delayed place cue leaked after interrupted flight');

      // 3) Reduced motion: skips #ghost flight and fires place audio immediately
      await t.game('scene', 'settings');
      await t.page.click('[data-set="motion"][data-val="reduce"]');
      await t.game('scene', 'game');
      const rRed = await t.game('act', 'rackTile', 0);
      await t.page.mouse.click(rRed[0], rRed[1]);
      const placesPreRed = await t.page.evaluate(() => window.__game.audioState().played.filter((x) => x === 'place').length);
      await t.page.mouse.click(pt2[0], pt2[1]);
      const afterRed = await t.page.evaluate(() => ({
        ghostHidden: document.querySelector('#ghost').hidden,
        returningCell: window.__G.returningCell,
        places: window.__game.audioState().played.filter((x) => x === 'place').length,
      }));
      t.equal(afterRed.ghostHidden, true, 'reduced motion skips #ghost flight');
      t.equal(afterRed.returningCell, null, 'reduced motion leaves G.returningCell null');
      t.equal(afterRed.places, placesPreRed + 1, 'reduced motion fires place audio immediately');
    },
  },
];

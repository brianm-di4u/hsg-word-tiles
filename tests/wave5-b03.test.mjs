// Wave 5, batch W5-B03:
// - W6-S2-03: Restrict board-to-plaque comet arcs strictly to claim/row/themed triggers (never passive Daily or bag-depletion clearFog).
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
];

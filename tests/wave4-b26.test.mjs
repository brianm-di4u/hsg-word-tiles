// Wave 4, batch W4-B26 (WF-6 vision_cohesion):
// - W6-P-N05: entry-level Register discovery check in celebrate() so 'New in your Register' toast and 'discover' bell
//   fire strictly when unlocking one of the 107 Register entries, not on alternate inflections of already-discovered entries.
// - W6-S1-05: already_done across 3369189, 22d616f, 27353a3, 0402493, e1ce26f, f6db630, c153702 (covered by wave4-b03, wave4-b04, wave2-b12, wave1-b04).

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false }));
  }
};
const CENTER = 112;
const REGISTER = 'hs-letters-register-v1';
const TWO_HUMANS = { seed: 26, seats: [{ kind: 'human', name: 'Ann' }, { kind: 'human', name: 'Bo' }] };
const across = (word, at = CENTER - 2) => [...word].map((l, k) => ({ i: at + k, l }));

async function setupTable(t, rack, opts = {}) {
  await t.game('newGame', opts.seats ? { seed: 26, seats: opts.seats } : TWO_HUMANS);
  await t.waitIdle(6000);
  if (!opts.seats || opts.seats.filter((s) => s.kind === 'human').length >= 2) await t.game('act', 'reveal');
  const s = await t.state();
  // Ensure Featured Springs do not collide with our test words so stingFor() reaches the discover branch cleanly.
  s.game.featured = s.game.featured.filter((f) => !['spring', 'steam', 'spa'].includes(f.id));
  if (opts.board) {
    for (const [i, l] of opts.board) s.game.board[i] = { l, blank: false, p: 1, t: 0 };
    s.game.move = 1;
    s.game.cur = 0;
  }
  s.game.players[0].rack = rack.split('');
  await t.game('setState', { game: s.game });
  await t.waitIdle(4000);
}

// Stage and play inside the page, returning the immediate toast(s), newly fired audio cues, and Register storage read count.
const playAndInspect = (t, tiles) => t.page.evaluate(async (tl) => {
  const beforeTotal = window.__game.audioState().total;
  const beforePlayedLen = window.__game.audioState().played.length;
  const origGet = Storage.prototype.getItem;
  let regReads = 0;
  Storage.prototype.getItem = function (k) {
    if (k === 'hs-letters-register-v1') regReads++;
    return origGet.call(this, k);
  };
  try {
    await window.__game.act('stage', tl);
    const r = await window.__game.act('play');
    const ast = window.__game.audioState();
    const added = ast.total - beforeTotal;
    const newCues = added > 0 ? ast.played.slice(Math.max(0, ast.played.length - added)) : [];
    const activeToast = {
      title: document.querySelector('#toast .tt b')?.textContent?.trim() || '',
      sub: document.querySelector('#toast .tt small')?.textContent?.trim() || '',
      text: document.querySelector('#toast')?.textContent?.trim() || '',
    };
    const queuedToasts = (window.__G.toastQ || []).map((q) => ({ title: q.title || '', sub: q.sub || '' }));
    return { ok: r.ok, error: r.error || null, activeToast, queuedToasts, newCues, regReads, beforePlayedLen };
  } finally {
    Storage.prototype.getItem = origGet;
  }
}, tiles);

const registerEntryCount = (t) => t.page.evaluate(() => {
  const reg = JSON.parse(localStorage.getItem('hs-letters-register-v1') || '{}');
  return window.__G.lex.data.words.filter((e) => e.forms.some((f) => reg[f])).length;
});

export const tests = [
  {
    name: 'W6-P-N05 first discovery fires New in your Register + discover cue; alternate inflection SPRINGS after SPRING fires neither while keeping form stats and entry count',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.page.evaluate((k) => localStorage.removeItem(k), REGISTER);

      // 1) First discovery of entry 'spring' via SPRING -> toast says 'New in your Register' and 'discover' fires.
      await setupTable(t, 'SPRINGQ');
      const r1 = await playAndInspect(t, across('SPRING'));
      t.equal(r1.ok, true, 'SPRING played legally');
      t.expect(r1.activeToast.title.includes('SPRING'), `first find toast titles SPRING (${r1.activeToast.title})`);
      t.equal(r1.activeToast.sub, 'New in your Register', `first find subtitle is New in your Register (got "${r1.activeToast.sub}")`);
      t.expect(r1.newCues.includes('discover'), `first find fires discover cue (${JSON.stringify(r1.newCues)})`);
      t.equal(await registerEntryCount(t), 1, 'Register entry count is 1 after SPRING');

      // 2) Alternate inflection SPRINGS of already-discovered entry 'spring' (6 tiles played off an existing S so e.full === 0
      // and stingFor() would fire 'discover' if fresh were wrongly true) -> category subtitle, NO 'New in your Register', NO 'discover' cue.
      await setupTable(t, 'PRINGSQ', { board: [[CENTER - 3, 'S']] });
      const r2 = await playAndInspect(t, across('PRINGS', CENTER - 2));
      t.equal(r2.ok, true, 'SPRINGS played legally');
      t.expect(r2.activeToast.title.includes('SPRINGS'), `alternate inflection toast titles SPRINGS (${r2.activeToast.title})`);
      t.equal(r2.activeToast.sub, 'Springs & stone', `alternate inflection shows category name, not New in your Register (got "${r2.activeToast.sub}")`);
      t.expect(!r2.activeToast.text.includes('New in your Register'), `toast omits New in your Register (${r2.activeToast.text})`);
      t.equal(r2.newCues.includes('discover'), false, `alternate inflection does not fire discover cue (${JSON.stringify(r2.newCues)})`);
      if (t.viewport === 'desktop') {
        await t.game('act', 'reveal');
        await t.waitFrames(2);
        await t.shot('w4-b26-alt-inflection-toast');
      }

      // Register still preserves both played forms under hs-letters-register-v1 while entry count stays 1 of 107.
      const regAfterAlt = await t.page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), REGISTER);
      t.expect(!!regAfterAlt.SPRING && !!regAfterAlt.SPRINGS, 'both SPRING and SPRINGS recorded in Register storage');
      t.equal(await registerEntryCount(t), 1, 'Register entry count stays 1 (not inflated by alternate inflection)');

      // 3) Brand-new different entry STEAM still triggers 'New in your Register' + 'discover' and bumps count to 2.
      await setupTable(t, 'STEAMXQ');
      const r3 = await playAndInspect(t, across('STEAM'));
      t.equal(r3.ok, true, 'STEAM played legally');
      t.equal(r3.activeToast.sub, 'New in your Register', `new entry STEAM shows New in your Register (got "${r3.activeToast.sub}")`);
      t.expect(r3.newCues.includes('discover'), `new entry STEAM fires discover cue (${JSON.stringify(r3.newCues)})`);
      t.equal(await registerEntryCount(t), 2, 'Register entry count increments to 2');

      // 4) Single move forming TWO inflections of the same undiscovered entry ('spa': SPA across + SPAS down)
      // reads register() once in celebrate() (+ once in recordRegister() = 2 total, not per-word), fires 'discover' once,
      // and marks only the first toast 'New in your Register'.
      const boardForDualSpa = [
        [6 * 15 + 7, 'S'],
        [8 * 15 + 7, 'A'],
        [9 * 15 + 7, 'S'],
        [7 * 15 + 6, 'S'],
        [7 * 15 + 8, 'A'],
      ];
      await setupTable(t, 'PQQQQQQ', { board: boardForDualSpa });
      const r4 = await playAndInspect(t, [{ i: 7 * 15 + 7, l: 'P' }]);
      t.equal(r4.ok, true, 'single P forms SPA across and SPAS down');
      const allToasts = [r4.activeToast, ...r4.queuedToasts];
      const newCount = allToasts.filter((x) => x.sub === 'New in your Register').length;
      const catCount = allToasts.filter((x) => x.sub === 'Bathhouse Row').length;
      t.equal(allToasts.length, 2, `both SPA and SPAS produced themed toasts (${JSON.stringify(allToasts)})`);
      t.equal(newCount, 1, `only one toast says New in your Register for dual inflections (${JSON.stringify(allToasts)})`);
      t.equal(catCount, 1, `second inflection toast in same play falls back to category name (${JSON.stringify(allToasts)})`);
      t.equal(r4.newCues.filter((c) => c === 'discover').length, 1, `discover fires once (${JSON.stringify(r4.newCues)})`);
      t.expect(r4.regReads <= 2, `celebrate() reads Register once before the themed loop (+1 in recordRegister, got ${r4.regReads} reads)`);
      t.equal(await registerEntryCount(t), 3, 'Register entry count increments to 3');

      // Title screen reflects exact entry count (3 of 107).
      await t.game('scene', 'title');
      const titleReg = await t.page.textContent('[data-go="register"]');
      t.expect(/3 of 107 words found/.test(titleReg), `Title screen shows 3 of 107 words found (${titleReg.trim()})`);
    },
  },
];

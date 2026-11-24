// Wave 2, Batch W2-B05: W1-P-N01 (hint PB parity & transparency), W1-S2-04 (Challenge invariants), W1-S2-05 (Pause audio hold & modal-dismiss skip guard).
import { emptyStats, applyGame } from '../src/js/stats.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const STATS = 'hs-letters-stats-v1';
const ls = (t, k) => t.page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), k);
const instant = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false }));
  }
};
const SEATS = [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }];

const finished = (me, opts = {}) => {
  const { hints = 3, unl = false, taken = 0, opp = 'opal', level = 'easy', oppScore = 50 } = opts;
  const players = [
    { kind: 'human', name: 'You', score: me, best: { word: 'QUARTZ', score: 54 }, hints, ...(unl ? { unl: true, taken } : {}) },
    { kind: 'ai', name: 'Opal', persona: opp, level, score: oppScore, best: null, hints: null },
  ];
  const top = Math.max(me, oppScore);
  return {
    mode: 'play', seed: 7, rng: { bag: 1, ai: 2 }, over: true, featured: [],
    players,
    log: [
      { p: 0, kind: 'play', n: 0, score: 78, full: 0, words: [{ w: 'SPRING', score: 78, bonus: 0 }] },
      { kind: 'end' },
    ],
    result: { why: 'out', out: 0, adjust: [0, 0], winners: players.map((p, k) => (p.score === top ? k : -1)).filter((k) => k >= 0) },
  };
};

async function playOut(t, max = 140) {
  for (let n = 0; n < max; n++) {
    const s = (await t.state()).game;
    if (s.over) return s;
    if (s.players[s.cur].kind !== 'human') {
      await t.page.waitForFunction(() => {
        const g = window.__game.getState();
        return g.game.over || g.game.players[g.game.cur].kind === 'human';
      }, null, { timeout: 20000 });
      continue;
    }
    const mv = await t.game('act', 'moves', 1);
    if (mv && mv.length) {
      const st = await t.game('act', 'stage', mv[0].tiles);
      const r = st.ok ? await t.game('act', 'play') : { ok: false };
      if (!r.ok) { await t.game('act', 'recall'); await t.game('act', 'pass'); }
    } else {
      await t.game('act', 'pass');
    }
  }
  return (await t.state()).game;
}

export const tests = [
  // ---------- W1-P-N01 ----------
  {
    name: 'W1-P-N01 unaided-only PB parity: aided games exclude opp.best, report pb.held on Game 1, and distinguish Unlimited vs hint copy (Node)',
    node: true,
    async run(t) {
      // Game 1 with 1 of 3 default hints taken: career bests AND opp.best stay 0, and pb.held is true on Game 1
      const g1Hinted = applyGame(emptyStats(), finished(280, { hints: 2 }));
      t.equal(g1Hinted.stats.games, 1, 'Game 1 counts as a game');
      t.equal(g1Hinted.stats.wins, 1, 'Game 1 counts as a win');
      t.equal(g1Hinted.stats.bestScore, 0, 'aided Game 1 sets no career bestScore');
      t.equal(g1Hinted.stats.bestPlay, null, 'aided Game 1 sets no bestPlay');
      t.equal(g1Hinted.stats.bestWord, null, 'aided Game 1 sets no bestWord');
      t.equal(g1Hinted.stats.opp['opal:easy'].best, 0, 'aided Game 1 does not populate opp.best above career bestScore');
      t.expect(g1Hinted.pb.first && g1Hinted.pb.held && g1Hinted.pb.heldBy === 'hint', 'Game 1 reports pb.held with heldBy="hint"');

      // Existing saved bests are preserved untouched when later aided games score higher
      const base = applyGame(emptyStats(), finished(200, { hints: 3 })).stats;
      t.equal(base.bestScore, 200, 'unaided base sets career bestScore');
      t.equal(base.opp['opal:easy'].best, 200, 'unaided base sets opp.best');

      const hintedLater = applyGame(base, finished(350, { hints: 2 }));
      t.equal(hintedLater.stats.bestScore, 200, 'hinted game preserves existing career bestScore');
      t.equal(hintedLater.stats.opp['opal:easy'].best, 200, 'hinted game preserves existing opp.best (never higher than career best)');
      t.expect(hintedLater.pb.held && hintedLater.pb.heldBy === 'hint', 'hinted later game reports heldBy="hint"');

      // Unlimited hints enabled with 0 hints taken: excludes career & opp.best and sets heldBy="unlimited"
      const unlZero = applyGame(base, finished(420, { unl: true, taken: 0 }));
      t.equal(unlZero.stats.bestScore, 200, 'Unlimited 0-hint game sets no career bestScore');
      t.equal(unlZero.stats.opp['opal:easy'].best, 200, 'Unlimited 0-hint game sets no opp.best');
      t.expect(unlZero.pb.held && unlZero.pb.heldBy === 'unlimited', 'Unlimited 0-hint game reports heldBy="unlimited"');

      // Aided game vs a brand-new opponent where score <= career bestScore still withholds that opponent best and reports held
      const newOppAided = applyGame(base, finished(150, { hints: 2, opp: 'julian', level: 'hard' }));
      t.equal(newOppAided.stats.opp['julian:hard'].games, 1, 'new opponent games counted');
      t.equal(newOppAided.stats.opp['julian:hard'].best, 0, 'new opponent best withheld when aided');
      t.expect(newOppAided.pb.held && newOppAided.pb.heldBy === 'hint', 'withheld new opponent best sets pb.held');
    },
  },
  {
    name: 'W1-P-N01 Setup, Help, Hint tooltip, Game 1 aided notice, and Unlimited 0-hint distinct copy',
    viewports: ['desktop', 'mobile'],
    initScript: instant,
    async run(t) {
      await ready(t);
      // 1) Setup & Help clearly state unaided-only personal bests
      await t.page.click('#screen [data-go="setup"]');
      const setupNote = await t.page.textContent('[data-hints-note]');
      t.expect(/taking any hint.*Unlimited hints.*no personal best/i.test(setupNote), 'Setup states any hint or Unlimited sets no personal best (' + setupNote + ')');
      await t.shot('W1-P-N01-setup');
      await t.page.click('[data-go="help"]');
      const helpText = await t.page.textContent('.help-body');
      t.expect(/taking any hint.*Unlimited hints.*no personal best/i.test(helpText), 'Help states any hint or Unlimited sets no personal best');

      // 2) Game 1 with 1 default hint taken: Hint tooltip warns, Game Over shows Game 1 held notice, Records shows '-' for both bestScore and opp.best
      await t.seed(11);
      await t.game('newGame', { seats: SEATS });
      await t.waitIdle(8000);
      const hintTitle = await t.page.getAttribute('[data-act="hint"]', 'title');
      t.expect(/aided.*no personal best/i.test(hintTitle || ''), 'Hint button tooltip states using any hint sets no personal best (' + hintTitle + ')');
      await t.game('act', 'hint');
      await t.game('act', 'recall');
      await playOut(t);
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 15000 });
      const pbs1 = await t.page.textContent('.over .pbs');
      t.expect(/First game on your record\./.test(pbs1), 'Game 1 shows first-game chip');
      t.expect(/You took a hint, so this game sets no personal best\./.test(pbs1), 'Game 1 shows aided held notice (' + pbs1 + ')');
      const rec1 = await ls(t, STATS);
      t.equal(rec1.bestScore, 0, 'saved career bestScore stays 0');
      t.equal(rec1.opp['opal:easy'].best, 0, 'saved opp.best stays 0');
      await t.game('scene', 'records');
      const oppBestCell = (await t.page.textContent('.opp-table tbody tr td:last-child')).trim();
      t.equal(oppBestCell, '-', 'Records opp table shows "-" when no unaided best exists');
      await t.shot('W1-P-N01-records-aided');

      // 3) Unlimited hints enabled with 0 hints taken: emits distinct "Unlimited hints were on" copy (never "You took a hint")
      await t.seed(13);
      await t.game('newGame', { seats: SEATS, hints: true, hintsUnl: true });
      await t.waitIdle(8000);
      await playOut(t);
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 15000 });
      const pbsUnl = await t.page.textContent('.over .pbs');
      t.expect(/Unlimited hints were on, so this game sets no personal best\./.test(pbsUnl), 'Unlimited 0-hint shows distinct copy (' + pbsUnl + ')');
      t.expect(!/You took a hint/.test(pbsUnl), 'Unlimited 0-hint never claims "You took a hint"');
      await t.shot('W1-P-N01-over-unlimited');
    },
  },

  // ---------- W1-S2-04 ----------
  {
    name: 'W1-S2-04 Challenge mode enforces end-to-end invariants across collapsed House rules, Hints, Help 2-letter table, #turnline badge, and Continue',
    viewports: ['desktop', 'mobile'],
    initScript: instant,
    async run(t) {
      await ready(t);
      // 1) Setup: House rules starts collapsed with >=44px summary, accurate Pass-and-Play/veteran copy, and auto-disables Hints
      await t.page.click('#screen [data-go="setup"]');
      const hr = await t.page.evaluate(() => {
        const d = document.querySelector('.house-rules');
        const s = d && d.querySelector('summary');
        return { open: !!d?.open, sumH: s ? s.getBoundingClientRect().height : 0, text: s ? s.textContent : '' };
      });
      t.equal(hr.open, false, 'House rules disclosure starts collapsed');
      t.expect(hr.sumH >= 44, 'House rules summary meets >=44px floor (' + hr.sumH + ')');
      t.expect(/House rules/i.test(hr.text), 'summary labeled House rules');
      await t.page.click('.house-rules summary');
      const hrBody = await t.page.textContent('.house-rules .house-body');
      t.expect(/Pass-and-Play/i.test(hrBody) && /veteran/i.test(hrBody) && /human seats only/i.test(hrBody), 'Challenge copy frames Pass-and-Play / veteran strict-dictionary rule accurately');
      await t.page.check('[data-challenge]');
      t.equal(await t.page.isChecked('[data-hints]'), false, 'enabling Challenge unchecks Hints');
      t.equal(await t.page.isDisabled('[data-hints]'), true, 'enabling Challenge disables Hints checkbox');
      t.equal(await t.page.isDisabled('[data-hints-unl]'), true, 'enabling Challenge disables Hints allowance select');
      await t.page.locator('.house-rules').scrollIntoViewIfNeeded();
      await t.shot('W1-S2-04-setup-challenge');
      await t.page.uncheck('[data-challenge]');
      t.equal(await t.page.isDisabled('[data-hints]'), false, 'disabling Challenge re-enables Hints checkbox');
      t.equal(await t.page.isChecked('[data-hints]'), true, 'disabling Challenge restores previous Hints state');
      await t.page.check('[data-challenge]');
      await t.page.click('[data-start]');
      await t.waitIdle(8000);

      // 2) Active Challenge game: no Hint button, doHint() guarded, persistent Challenge badge in #turnline
      const st = await t.state();
      t.equal(st.game.challenge, true, 'started game is in Challenge mode');
      t.equal(st.game.players[0].hints, null, 'human seat has hints === null');
      t.equal(await t.page.locator('[data-act="hint"]').count(), 0, 'Hint button is omitted in Challenge mode');
      t.equal(await t.game('act', 'hint'), 0, 'doHint() stages nothing in Challenge mode');
      const badge = await t.page.evaluate(() => {
        const el = document.querySelector('#turnline .mode-badge');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { text: el.textContent.trim(), visible: r.width > 0 && r.height > 0 && r.right <= innerWidth + 1 };
      });
      t.expect(badge && badge.text === 'Challenge' && badge.visible, 'persistent Challenge badge visible in #turnline (' + JSON.stringify(badge) + ')');
      const contrastDay = await t.contrastReport({ selector: '#turnline .mode-badge', min: 4.5, largeMin: 3 });
      t.equal(contrastDay.fails.length, 0, 'Challenge badge passes Day WCAG contrast (' + JSON.stringify(contrastDay.fails) + ')');
      await t.shot('W1-S2-04-turnline-challenge');

      // 3) Legacy resumed Challenge save that still held p.hints = 3 must still hide Hint and guard doHint()
      const legacy = (await t.state()).game;
      legacy.players[0].hints = 3;
      await t.game('setState', { game: legacy });
      t.equal(await t.page.locator('[data-act="hint"]').count(), 0, 'legacy Challenge save still hides Hint button');
      t.equal(await t.game('act', 'hint'), 0, 'legacy Challenge save still guards doHint()');

      // 4) Active Challenge game hides Help 2-letter table and locks Check a word
      await t.game('scene', 'help');
      t.equal(await t.page.locator('#screen .twos').count(), 0, '2-letter word list is hidden during active Challenge game');
      t.expect(/Hidden while a Challenge game is in progress/.test(await t.page.textContent('[data-twos-hidden]')), 'Help explains 2-letter list is hidden');
      await t.page.fill('#wc-in', 'SPRING');
      await t.page.click('.wordcheck button[type="submit"]');
      t.expect(/off while a Challenge game is in progress/.test(await t.page.textContent('#wc-out')), 'Check a word remains locked');
      await t.shot('W1-S2-04-help-challenge');

      // 5) Title Continue subtitle shows Challenge badge after reload
      await t.reload();
      await ready(t);
      const cont = await t.page.textContent('[data-go="continue"]');
      t.expect(/Challenge/.test(cont), 'Continue subtitle shows Challenge (' + cont + ')');
      await t.shot('W1-S2-04-title-continue');

      // 6) Non-Challenge game restores 2-letter word list in Help
      await t.game('newGame', { seats: SEATS, challenge: false });
      await t.waitIdle(8000);
      t.equal(await t.page.locator('#turnline .mode-badge').count(), 0, 'normal game has no Challenge badge');
      await t.game('scene', 'help');
      t.equal(await t.page.locator('#screen .twos').count(), 1, '2-letter list returns outside Challenge mode');
      t.equal((await t.page.textContent('#screen .twos')).trim().split(/\s+/).length, 104, 'all 104 two-letter words present');
    },
  },
];

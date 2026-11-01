// Seeded random walks through the real UI paths (stage, recall, shuffle, play, swap, pass, hint, setState
// round-trips, reload and Continue), with invariants checked against a shadow model after every step:
// tiles are conserved, scores equal the ledger, turn order holds, staging is consistent, and the save matches.
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const STEPS = 400;

function check(t, s, label) {
  const g = s.game;
  if (!g) return;
  const onBoard = g.board.filter(Boolean).length;
  const inRacks = g.players.reduce((a, p) => a + p.rack.length, 0);
  if (onBoard + inRacks + g.bag.length !== 98) t.fail(`${label}: ${onBoard} + ${inRacks} + ${g.bag.length} tiles ≠ 98`);
  // scores = sum of plays + end adjustment
  const adj = g.result ? g.result.adjust : g.players.map(() => 0);
  g.players.forEach((p, k) => {
    const sum = g.log.filter((e) => e.p === k && e.kind === 'play').reduce((a, e) => a + e.score, 0) + (adj[k] || 0);
    if (sum !== p.score) t.fail(`${label}: seat ${k} score ${p.score} ≠ ledger ${sum}`);
  });
  const acts = g.log.filter((e) => e.kind !== 'end').length;
  if (acts !== g.move) t.fail(`${label}: ${acts} actions but move ${g.move}`);
  if (!g.over && g.cur !== g.move % g.players.length) t.fail(`${label}: cur ${g.cur} after ${g.move} moves`);
  // staging
  const ks = new Set();
  for (const st of s.staged) {
    if (g.board[st.i]) t.fail(`${label}: staged on a taken square ${st.i}`);
    if (ks.has(st.k)) t.fail(`${label}: rack tile ${st.k} staged twice`);
    ks.add(st.k);
  }
  if (!g.over && g.players[g.cur].kind === 'human' && s.order.length + s.staged.length !== g.players[g.cur].rack.length) t.fail(`${label}: rack ${s.order.length} + staged ${s.staged.length} ≠ ${g.players[g.cur].rack.length}`);
  for (const f of g.featured) if (f.by == null && f.shown.length > f.word.length - 2 && f.shown.length > 1) t.fail(`${label}: featured ${f.word} shows too much`);
}

export const tests = [
  {
    name: 'state fuzz: random walks with a shadow model',
    slow: true,
    async run(t) {
      await ready(t);
      let seed = 1234567 ^ (t.viewport === 'mobile' ? 99 : 0);
      const R = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
      let steps = 0, plays = 0, games = 0;
      const begin = async () => {
        games++;
        const n = 2 + Math.floor(R() * 3);
        const seats = Array.from({ length: n }, (_, k) => (k === 0 || R() < 0.4 ? { kind: 'human', name: `P${k + 1}` } : { kind: 'ai', persona: ['opal', 'hollis', 'lucky', 'julian'][Math.floor(R() * 4)] }));
        await t.game('newGame', { seed: Math.floor(R() * 1e9), seats });
        await t.waitIdle(15000);
      };
      await begin();
      while (steps < STEPS) {
        let s = await t.state();
        if (s.scene !== 'game' || s.game.over) { await begin(); continue; }
        if (s.privacy) await t.game('act', 'reveal');
        s = await t.state();
        const p = s.game.players[s.game.cur];
        if (p.kind !== 'human') { await t.waitIdle(15000); continue; }
        const r = R();
        if (r < 0.45) {
          const moves = await t.game('act', 'moves', 8);
          if (moves.length) { const m = moves[Math.floor(R() * moves.length)]; await t.game('act', 'stage', m.tiles); await t.game('act', 'play'); plays++; }
          else await t.game('act', 'pass');
        } else if (r < 0.6) {
          // random junk staging, then recall or a refused play
          const rack = p.rack;
          const tiles = [];
          for (let k = 0; k < 1 + Math.floor(R() * 3); k++) { const i = Math.floor(R() * 225); if (!s.game.board[i] && !tiles.some((x) => x.i === i)) tiles.push({ i, l: rack[k] === '?' ? 'E' : rack[k], blank: rack[k] === '?' }); }
          await t.game('act', 'stage', tiles);
          if (R() < 0.5) await t.game('act', 'recall');
          else {
            const before = (await t.state()).game;
            const res = await t.game('act', 'play');
            const after = (await t.state()).game;
            if (!res.ok && (after.move !== before.move || JSON.stringify(after.board) !== JSON.stringify(before.board))) t.fail(`step ${steps}: a refused play changed the game`);
            if (res.ok && after.move <= before.move) t.fail(`step ${steps}: an accepted play did not advance the game`);
            await t.game('act', 'recall');
          }
        } else if (r < 0.7 && s.game.bag.length >= 7) {
          const k = 1 + Math.floor(R() * 3);
          await t.game('act', 'swap', p.rack.slice(0, k));
        } else if (r < 0.75) await t.game('act', 'pass');
        else if (r < 0.82) await t.page.keyboard.press('Shift+R');
        else if (r < 0.9) { await t.game('setState', { game: s.game }); }
        else if (r < 0.94) {
          await t.reload(); await ready(t);
          if (await t.page.$('[data-go="continue"]')) await t.page.click('[data-go="continue"]'); else await begin();
        }
        else if (p.hints > 0) { await t.game('act', 'hint'); await t.game('act', 'recall'); }
        await t.waitIdle(15000);
        steps++;
        const after = await t.state();
        check(t, after, `step ${steps}`);
        // the save matches the live game whenever a game is in progress
        if (after.scene === 'game' && after.game && !after.game.over) {
          const saved = await t.page.evaluate(() => localStorage.getItem('hs-letters-save-v1'));
          if (saved && JSON.stringify(JSON.parse(saved).board) !== JSON.stringify(after.game.board)) t.fail(`step ${steps}: save out of date`);
        }
      }
      t.log(`${steps} steps, ${plays} plays, ${games} games`);
    },
  },
];

// Seeded random walks through the real UI paths (stage, recall, shuffle, play, swap, pass, hint, setState
// round-trips, reload and Continue), with invariants checked against a shadow model after every step:
// tiles are conserved, scores equal the ledger, turn order holds, staging is consistent, and the save matches.
// The input fuzz does the same with real touch and mouse drags, taps, cancels, second fingers and focus loss.
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const STEPS = 400, INPUT_STEPS = 160;

// no tile in limbo between the rack and the board (run in the page)
function limbo() {
  const G = window.__G, s = G.s, out = [];
  if (!s || G.scene !== 'game') return out;
  if (G.drag && G.drag.active) out.push('a drag is still active');
  if (!document.querySelector('#ghost').hidden) out.push('the ghost tile is still showing');
  const p = s.players[s.cur];
  if (!s.over && p.kind === 'human' && !G.privacy && !G.dialog) {
    const ks = [...G.order, ...G.staged.map((x) => x.k)].sort((a, b) => a - b).join();
    if (ks !== p.rack.map((_, k) => k).join()) out.push(`order ${G.order.join()} + staged ${G.staged.map((x) => x.k).join()} for a ${p.rack.length}-tile rack`);
    if (document.querySelectorAll('#rack .rtile:not(.lifted)').length !== G.order.length) out.push('rack buttons out of step with the rack');
  }
  return out;
}

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
  {
    name: 'input fuzz: random real drags, taps, cancels and interruptions',
    slow: true,
    async run(t) {
      await ready(t);
      let seed = 7654321 ^ (t.viewport === 'mobile' ? 77 : 0);
      const R = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
      const pickOf = (a) => a[Math.floor(R() * a.length)];
      const touch = t.viewport === 'mobile';
      const cdp = touch ? await t.page.context().newCDPSession(t.page) : null;
      const pts = new Map();
      const send = (type) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [...pts].map(([id, [x, y]]) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 })) });
      const down = async (p, id = 1) => { if (touch) { pts.set(id, p); await send('touchStart'); } else { await t.page.mouse.move(p[0], p[1]); await t.page.mouse.down(); } };
      const move = async (p, n = 8, id = 1) => {
        if (!touch) { await t.page.mouse.move(p[0], p[1], { steps: n }); return; }
        const [x0, y0] = pts.get(id);
        for (let k = 1; k <= n; k++) { pts.set(id, [x0 + (p[0] - x0) * k / n, y0 + (p[1] - y0) * k / n]); await send('touchMove'); }
      };
      const up = async (id = 1) => { if (touch) { pts.delete(id); await send(pts.size ? 'touchMove' : 'touchEnd'); } else await t.page.mouse.up(); };
      const cellPt = async (i) => { const c = await t.game('act', 'screen', i), lift = touch ? await t.game('act', 'dragLift') : 0; return [c[0], c[1] + lift]; };
      const counts = {};
      let steps = 0, games = 0;
      const begin = async () => {
        games++;
        const two = R() < 0.25;
        await t.game('newGame', { seed: Math.floor(R() * 1e9), seats: two ? [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }] : [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: pickOf(['opal', 'hollis', 'lucky', 'julian']) }] });
        await t.waitIdle(15000);
      };
      // a drag with a random ending: a clean drop, a cancelled touch, the window losing focus, a second finger, Enter, Esc
      const carry = async (from, to) => {
        await down(from);
        await move(to, 6 + Math.floor(R() * 8));
        const r = R();
        let how = 'drop';
        if (r < 0.1 && touch) { how = 'cancel'; pts.clear(); await send('touchCancel'); }
        else if (r < 0.18) { how = 'blur'; await t.page.evaluate(() => dispatchEvent(new Event('blur'))); await up(); }
        else if (r < 0.28 && touch) { how = 'finger2'; const o = await cellPt(Math.floor(R() * 225)); await down(o, 2); await move([o[0] + 30, o[1] - 30], 3, 2); await up(2); await up(); }
        else if (r < 0.33) { how = 'enter'; await t.page.keyboard.press('Enter'); await up(); }
        else if (r < 0.38) { how = 'escape'; await t.page.keyboard.press('Escape'); await up(); }
        else await up();
        counts['drag:' + how] = (counts['drag:' + how] || 0) + 1;
      };
      await begin();
      while (steps < INPUT_STEPS) {
        let s = await t.state();
        if (s.scene !== 'game' || s.game.over) { await begin(); continue; }
        if (s.dialog) { await t.game('act', 'close'); await t.waitIdle(); }
        if (s.privacy) { await t.game('act', 'reveal'); s = await t.state(); }
        const p = s.game.players[s.game.cur];
        if (p.kind !== 'human') { await t.waitIdle(15000); continue; }
        const empty = s.game.board.map((x, i) => (x || s.staged.some((y) => y.i === i) ? -1 : i)).filter((i) => i >= 0);
        const r = R();
        let what;
        if (r < 0.3 && s.order.length) {
          what = 'rack→board';
          const tile = await t.game('act', 'rackTile', Math.floor(R() * s.order.length));
          const dest = R() < 0.8 ? await cellPt(pickOf(empty)) : R() < 0.5 ? [tile[0] + 40, tile[1]] : [5, 5];
          await carry([tile[0], tile[1]], dest);
        } else if (r < 0.45 && s.staged.length) {
          what = 'board→' + (R() < 0.3 ? 'rack' : 'board');
          const from = await t.game('act', 'screen', pickOf(s.staged).i);
          const rk = await t.page.$eval('#rack', (e) => { const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
          await carry(from, what === 'board→rack' ? rk : await cellPt(R() < 0.7 ? pickOf(empty) : pickOf(s.staged).i));
        } else if (r < 0.55 && s.order.length) {
          what = 'tap-tap';
          const tile = await t.game('act', 'rackTile', Math.floor(R() * s.order.length));
          const c = await t.game('act', 'screen', pickOf(empty));
          if (touch) { await t.tap([tile[0], tile[1]]); await t.tap(c); } else { await t.page.mouse.click(tile[0], tile[1]); await t.page.mouse.click(c[0], c[1]); }
        } else if (r < 0.6 && s.staged.length) {
          what = 'tap-recall';
          const c = await t.game('act', 'screen', pickOf(s.staged).i);
          if (touch) await t.tap(c); else await t.page.mouse.click(c[0], c[1]);
        } else if (r < 0.8) {
          // a legal play made with real drags, then the Play button
          what = 'play';
          await t.game('act', 'recall');
          const m = pickOf(await t.game('act', 'moves', 6));
          if (m) {
            for (const tl of m.tiles) {
              const st = await t.state(), rack = st.game.players[st.game.cur].rack;
              const pos = st.order.findIndex((k) => (tl.blank ? rack[k] === '?' : rack[k] === tl.l));
              if (pos < 0) break;
              const tile = await t.game('act', 'rackTile', pos);
              await down([tile[0], tile[1]]); await move(await cellPt(tl.i), 10); await up();
              await t.waitFrames(2);
              if ((await t.state()).dialog === 'blank') await t.page.click(`#modal [data-letter="${tl.l}"]`);
            }
            const ok = (await t.state()).preview;
            if (!(ok && ok.ok)) t.fail(`input step ${steps + 1}: a legal move staged by drags is not legal (${ok && ok.error})`);
            await t.page.click('[data-act="play"]').catch(() => {});
          }
        } else if (r < 0.86) { what = 'recall'; await t.page.click('[data-act="recall"]').catch(() => {}); }
        else if (r < 0.9) { what = 'shuffle'; await t.page.click('[data-act="shuffle"]').catch(() => {}); }
        else if (r < 0.95 && touch) {
          what = 'rotate';
          const [w, h] = pickOf([[390, 844], [844, 390], [375, 667], [430, 932]]);
          await t.page.setViewportSize({ width: w, height: h });
        } else { what = 'pass'; await t.game('act', 'pass'); }
        counts[what] = (counts[what] || 0) + 1;
        await t.waitFrames(2);
        s = await t.state();
        if (s.dialog === 'blank') { if (R() < 0.5) await t.page.click('#modal [data-close]'); else await t.page.click('#modal [data-letter="E"]'); }
        else if (s.dialog) await t.game('act', 'close');
        await t.page.waitForTimeout(260);
        await t.waitIdle(15000);
        steps++;
        check(t, await t.state(), `input step ${steps} (${what})`);
        for (const x of await t.page.evaluate(limbo)) t.fail(`input step ${steps} (${what}): ${x}`);
      }
      if (cdp) await cdp.detach();
      t.log(`${steps} steps, ${games} games: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')}`);
    },
  },
];

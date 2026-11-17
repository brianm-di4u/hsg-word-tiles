// Wave 4 clean-up pass, batch A: K-01 (the offline sound render), K-02 (held Enter), K-04 (a pop near the board's edge).
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const normal = () => { window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'normal', sound: false })); };
const slow = () => { window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'slow', sound: false })); };
const SEATS = [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }];
const N = 15;

async function freezeClock(t) { await t.page.clock.install(); await t.reload(); await ready(t); }
async function stopClock(t) { const now = await t.page.evaluate(() => Date.now()); await t.page.clock.pauseAt(now + 500); }

export const tests = [
  // ---------- K-01 ----------
  {
    name: 'K-01 a cue is measured even when the offline render has already run past the stop point',
    viewports: ['desktop'],
    initScript: normal,
    async run(t) {
      await ready(t);
      // The failure the clerk saw ("suspend(0.25) failed to suspend at frame ... earlier than the current frame") came from a render
      // that ran ahead of the stop. Here every render is given a head start of 400 ms, far past the quarter second of audio the
      // stop waits for, so the order in which renderCue asks is what decides whether the cue is measured.
      await t.page.evaluate(() => {
        const real = OfflineAudioContext.prototype.startRendering;
        OfflineAudioContext.prototype.startRendering = function () {
          const p = real.apply(this, arguments);
          const t0 = performance.now(); while (performance.now() - t0 < 400) { /* let the render thread run on */ }
          return p;
        };
      });
      for (const n of ['pick', 'chime']) {
        const r = await t.page.evaluate((name) => window.__game.act('renderSfx', name, 0.35).then((v) => ({ v }), (e) => ({ err: String(e) })), n);
        t.expect(!r.err && r.v.peak > 0.005, `${n} is rendered and audible with a render that started early (${r.err || 'peak ' + r.v.peak})`);
      }
    },
  },

  // ---------- K-02 ----------
  {
    name: 'K-02 the repeat of a held Enter does not skip the computer\'s wait, a fresh press does',
    viewports: ['desktop'],
    initScript: normal,
    async run(t) {
      await ready(t);
      await freezeClock(t);
      await t.seed(5);
      await t.game('newGame', { seats: SEATS });
      await t.waitIdle(8000);
      await stopClock(t);
      const [m] = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', m.tiles);
      t.expect((await t.game('act', 'play')).ok, 'the human move is played');
      await t.page.clock.runFor(400);
      await t.page.waitForFunction(() => { const g = window.__game.getState(); return g.aiThinking && g.aiWait.reply; }, null, { timeout: 15000, polling: 50 });
      t.equal((await t.state()).game.move, 1, 'the computer has its reply but waits its turn');
      const key = (repeat) => t.page.evaluate((r) => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', repeat: r, bubbles: true, cancelable: true })), repeat);
      for (const k of [true, true, true]) await key(k);
      t.equal((await t.state()).game.move, 1, 'three repeats of a held key leave the move waiting');
      await key(false);
      await t.page.waitForFunction(() => window.__game.getState().game.move === 2, null, { timeout: 5000, polling: 50 });
      t.equal((await t.state()).game.move, 2, 'a fresh press lets it land');
    },
  },

  // ---------- K-04 ----------
  {
    name: 'K-04 the pop of a play on the top row, and in the last column, stays inside the board for all of its life',
    viewports: ['desktop', 'mobile'],
    initScript: slow,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 3, seats: SEATS });
      await t.waitIdle(5000);
      // a word on row 1, so that a play along row 0 above it is joined to it: the pop sits on the top row
      const WORD = 'PLAYING', at = N + (N - WORD.length);
      const place = async () => {
        const s = await t.state();
        s.game.board = Array(N * N).fill(null);
        [...WORD].forEach((l, k) => { s.game.board[at + k] = { l, blank: false, p: 1, t: 0 }; });
        s.game.move = 1; s.game.cur = 0; s.game.players[0].rack = 'STREAMS'.split('');
        await t.game('setState', { game: s.game });
        await t.waitIdle(5000);
      };
      await place();
      const list = await t.game('act', 'moves', 400);
      const top = list.filter((m) => Math.floor(m.tiles[m.tiles.length - 1].i / N) === 0);
      t.expect(top.length > 3, 'there are plays that end on the top row (' + top.length + ')');
      const byScore = top.reduce((a, m) => (m.score > a.score ? m : a));
      const byColumn = top.reduce((a, m) => ((m.tiles[m.tiles.length - 1].i > a.tiles[a.tiles.length - 1].i || (m.tiles[m.tiles.length - 1].i === a.tiles[a.tiles.length - 1].i && m.score > a.score)) ? m : a));
      for (const [label, m] of [['the best play', byScore], ['the play furthest to the right', byColumn]]) {
        await place();
        // every sample is the pop paused at a set point of its life, so no frame is left to chance
        const r = await t.page.evaluate(async (tl) => {
          await window.__game.act('stage', tl);
          const ok = await window.__game.act('play');
          const el = [...document.querySelectorAll('.pop')].pop(), box = document.querySelector('#boardwrap').getBoundingClientRect();
          const anim = el.getAnimations()[0], ms = parseFloat(getComputedStyle(el).animationDuration) * 1000;
          anim.pause();
          const out = [];
          for (let p = 0.1; p <= 1.001; p += 0.1) {
            anim.currentTime = ms * p;
            const b = el.getBoundingClientRect(), op = parseFloat(getComputedStyle(el).opacity);
            out.push({ p: +p.toFixed(1), op, over: Math.max(box.top - b.top, b.bottom - box.bottom, box.left - b.left, b.right - box.right) });
          }
          anim.currentTime = ms * 0.5;   // left where it is biggest, for the screenshot
          return { ok: ok.ok, out, text: el.textContent };
        }, m.tiles);
        t.expect(r.ok, label + ' is played');
        const seen = r.out.filter((s) => s.op > 0.05 && s.p >= 0.2);
        const worst = Math.max(...seen.map((s) => s.over));
        t.expect(seen.length >= 6 && worst <= 0.5, label + ' (' + r.text + ', last tile ' + m.tiles[m.tiles.length - 1].i + ') stays inside the board while it shows: ' + seen.length + ' samples, worst overshoot ' + worst.toFixed(1) + ' px');
        await t.shot('K-04-' + (m === byScore ? 'best' : 'edge') + '-pop', { wait: false });
      }
    },
  },
];

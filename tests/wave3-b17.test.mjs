// Wave 3, batch W3-B17: W6-S4-03 (poked tile crown, default-name plaque owners), W6-S4-01 (3D figure-ground and ink),
// W6-S4-02 (spring labels and Row paintings readable under the 3D lamp),
// W6-S4-04 (steam off the letters, one celebration at a time, the last-play ring from the first frame).
import { SQUARE, CENTER } from '../src/js/score.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, motion: 'full', theme: 'light' }));
};

// A fixed midgame on the 3D board, its picture measured: 25 tiles down, so the open squares are dimmed as far as they go.
const WORDS = [['QUARTZ', 110, 1], ['JAZZ', 80, 15], ['UNIT', 111, 15], ['SPRING', 155, 1], ['QI', 95, 1], ['MILL', 172, 1]];
async function midgame(t) {
  await ready(t);
  await t.game('newGame', { seed: 41, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'julian' }] });
  await t.waitIdle(8000);
  const s = await t.state();
  for (const [w, i, d] of WORDS) [...w].forEach((l, k) => { s.game.board[i + k * d] = { l, blank: false, p: 1, t: 0 }; });
  s.game.move = 6; s.game.cur = 0; s.game.players[0].rack = 'QJZXATE'.split('');
  await t.game('setState', { game: s.game });
  await t.waitIdle(8000);
  await t.page.addStyleTag({ content: '#fx, #toast { visibility: hidden !important; }' });
  await t.waitFrames(3);
}
// neutral squares, tile faces and their ink, and the figures of the 46 spring labels, as the player sees them
async function measure(t) {
  const b64 = (await t.page.locator('#boardwrap').screenshot()).toString('base64');
  return t.page.evaluate(async ([b64, SQ]) => {
    const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
    const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
    const c = cv.getContext('2d', { willReadFrequently: true }); c.drawImage(im, 0, 0);
    const bw = document.getElementById('boardwrap').getBoundingClientRect(), b = document.getElementById('board').getBoundingClientRect(), k = im.width / bw.width;
    const box = (x, y, hw, hh) => { const d = c.getImageData(Math.round((x + b.left - bw.left - hw) * k), Math.round((y + b.top - bw.top - hh) * k), Math.max(2, Math.round(2 * hw * k)), Math.max(2, Math.round(2 * hh * k))).data, o = []; for (let i = 0; i < d.length; i += 4) o.push([d[i], d[i + 1], d[i + 2]]); return o; };
    const lum = (p) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2], lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const rel = (p) => 0.2126 * lin(p[0]) + 0.7152 * lin(p[1]) + 0.0722 * lin(p[2]), mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const g = window.__game, board = g.getState().game.board, cell = Math.abs((await g.act('cell', 113))[0] - (await g.act('cell', 112))[0]);
    const neutral = [], tile = [], ink = [], label = [];
    for (let i = 0; i < 225; i++) {
      const [x, y] = await g.act('cell', i, board[i] ? 0.24 : 0);
      if (board[i]) {
        const face = box(x + cell * 0.26, y - cell * 0.26, cell * 0.08, cell * 0.06), m = box(x - cell * 0.02, y - cell * 0.02, cell * 0.24, cell * 0.22).map(rel).sort((p, q) => p - q);
        tile.push(mean(face.map(lum))); ink.push((mean(face.map(rel)) + 0.05) / (m[Math.floor(m.length * 0.04)] + 0.05));
      } else if (SQ[i] === '.') neutral.push(mean(box(x, y, cell * 0.25, cell * 0.25).map(lum)));
      else if ('whsb'.includes(SQ[i])) { const m = box(x, y, cell * 0.2, cell * 0.13).map(rel).sort((p, q) => p - q); label.push([(m[Math.floor(m.length * 0.95)] + 0.05) / (m[Math.floor(m.length * 0.05)] + 0.05), i]); }
    }
    label.sort((p, q) => p[0] - q[0]); ink.sort((p, q) => p - q);
    return { neutral: mean(neutral), tile: mean(tile), step: mean(tile) - mean(neutral), ink: ink[0], label: label[0][0], labelAt: label[0][1], labelMid: label[label.length >> 1][0], labels: label.length };
  }, [b64, SQUARE]);
}
const said = (m) => Object.entries(m).map(([k, v]) => `${k} ${+v.toFixed(2)}`).join(', ');
const dark = async (t) => {
  await t.game('scene', 'settings');
  await t.page.click('[data-set="theme"][data-val="dark"]');
  await t.game('scene', 'game');
  await t.waitIdle(6000);
  await t.waitFrames(3);
};

export const tests = [
  // ---------- W6-S4-03 ----------
  {
    name: 'W6-S4-03 the glazed tile top has a raised centre, level corners and nothing else moved',
    node: true,
    async run(t) {
      const { MESHES } = await import(new URL('../src/js/pieces-mesh.js', import.meta.url).href);
      const d = MESHES.tile, top = d.g.find((g) => g.mat.name === 'tiletop');
      const raw = Buffer.from(top.p, 'base64'), q = new Int16Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length));
      const pts = [];
      for (let i = 0; i < q.length; i += 3) pts.push([0, 1, 2].map((k) => d.lo[k] + (q[i + k] + 32768) / 65535 * (d.hi[k] - d.lo[k])));
      const at = (x, y) => pts.find((p) => Math.hypot(p[0] - x, p[1] - y) < 0.005);
      const mid = at(0, 0);
      t.expect(!!mid, 'the crown has a centre vertex');
      if (mid) t.expect(Math.abs(mid[2] - 0.25) < 0.001, `the centre is 0.010 above the crown's edge (${mid[2].toFixed(4)})`);
      for (const [x, y] of [[-0.38, -0.38], [0.38, -0.38], [0.38, 0.38], [-0.38, 0.38]]) t.expect(at(x, y) && Math.abs(at(x, y)[2] - 0.24) < 0.001, `the crown corner ${x},${y} stays at 0.240`);
      t.expect(pts.every((p) => Math.abs(p[0]) <= 0.4505 && Math.abs(p[1]) <= 0.4505), 'the tile keeps its footprint');
      t.equal(pts.length, 17, 'one vertex more than the flat top');
    },
  },
  {
    name: 'W6-S4-03 a claimed plaque names its owner: the character by first name, a default seat as P1 or P2',
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 5, seats: [{ kind: 'human', name: 'Player 1' }, { kind: 'human', name: 'Player 2' }, { kind: 'ai', persona: 'julian' }] });
      await t.waitIdle(5000);
      await t.game('act', 'reveal');
      const s = await t.state();
      s.game.featured.forEach((f, k) => { f.by = k; f.at = 1; });
      await t.game('setState', { game: s.game });
      if (t.viewport === 'mobile') await t.page.click('#springs [data-springs-toggle]');
      const got = await t.page.$$eval('#springs .plaque', (els) => els.map((e) => ({ by: e.querySelector('.pby').textContent, label: e.getAttribute('aria-label') })));
      t.equal(got.map((g) => g.by), ['P1', 'P2', 'Julian'], 'owners on the plaques');
      t.expect(/found by Player 1$/.test(got[0].label) && /found by Player 2$/.test(got[1].label) && /found by Maestro Julian Fitch$/.test(got[2].label), 'and the full name in the label: ' + got.map((g) => g.label).join(' | '));
      await t.shot('w3-b17-plaque-owners');
    },
  },
  // ---------- W6-S4-01 ----------
  {
    name: 'W6-S4-01 on the 3D board, Day tiles stand clear of the marble with dark ink, and Night ink and labels stay dark',
    url: 'index.html?gl=3d',
    initScript: quiet,
    async run(t) {
      await midgame(t);
      t.equal((await t.state()).view.mode3d, true, '3D board on');
      const day = await measure(t);
      t.log('day: ' + said(day));
      t.expect(day.step >= 26, `Day tiles are at least 26 brighter than the marble (${day.step.toFixed(1)}; it was 15.5)`);
      t.expect(day.ink >= 6.5, `Day letters hold 6.5:1 on their tiles (worst ${day.ink.toFixed(2)}; it was 3.8)`);
      t.expect(day.neutral >= 180, `the marble stays a light warm stone (${day.neutral.toFixed(1)})`);
      await t.shot('w3-b17-day-3d', { timeout: 15000 });
      await dark(t);
      const night = await measure(t);
      t.log('night: ' + said(night));
      t.expect(night.ink >= 5.8, `Night letters hold 5.8:1 (worst ${night.ink.toFixed(2)}; it was 4.9)`);
      t.expect(night.labelMid >= 3.2, `the middle Night label holds 3.2:1 (${night.labelMid.toFixed(2)}; it was 2.7)`);
      t.expect(night.neutral >= 42 && night.neutral <= 75, `Night marble stays a twilight slate (${night.neutral.toFixed(1)})`);
      t.expect(night.step >= 120, `Night tiles stand clear (${night.step.toFixed(1)})`);
      await t.shot('w3-b17-night-3d', { timeout: 15000 });
    },
  },
  {
    name: 'W6-S4-01 the START halo is not drawn over a tile staged beside the open Display Spring',
    url: 'index.html?gl=3d',
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 41, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'julian' }] });
      await t.waitIdle(8000);
      const read = () => t.page.evaluate(async () => {
        const cv = document.getElementById('board'), k = cv.width / cv.clientWidth, g = window.__game;
        const [x, y] = await g.act('cell', 113, 0.3), [x2] = await g.act('cell', 114, 0.3), c = Math.abs(x2 - x);
        const d = cv.getContext('2d').getImageData(Math.round((x - 0.36 * c) * k), Math.round((y - 0.1 * c) * k), Math.round(0.3 * c * k), Math.round(0.2 * c * k)).data;
        let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
        return n;
      });
      const bare = await read();
      const l = (await t.state()).game.players[0].rack.find((x) => x !== '?');
      await t.game('act', 'stage', [{ l, i: 113 }]);
      await t.waitIdle(4000);
      await t.waitFrames(3);
      t.expect(bare > 0, `the halo reaches that square while it is empty (${bare} px)`);
      t.equal(await read(), 0, 'and none of it is drawn over the staged tile');
      await t.shot('w3-b17-halo-beside', { timeout: 15000 });
    },
  },
  // ---------- W6-S4-02 ----------
  {
    name: 'W6-S4-02 every spring label on the 3D board reads under the lamp, Day and Night',
    url: 'index.html?gl=3d',
    initScript: quiet,
    async run(t) {
      await midgame(t);
      t.equal((await t.state()).view.mode3d, true, '3D board on');
      for (const theme of ['day', 'night']) {
        if (theme === 'night') await dark(t);
        const m = await measure(t);
        t.log(theme + ': ' + said(m));
        t.equal(m.labels, 42, 'the 42 labels not under a tile are measured');
        t.expect(m.label >= 3.2, `${theme}: the faintest label holds 3.2:1 with the squares dimmed as far as they go (square ${m.labelAt}, ${m.label.toFixed(2)}; it was 1.01 to 1.09)`);
        t.expect(m.labelMid >= 3.6, `${theme}: the middle label holds 3.6:1 (${m.labelMid.toFixed(2)})`);
      }
    },
  },
  // ---------- W6-S4-04 ----------
  {
    name: 'W6-S4-04 the steam of a Hot Springs word never veils its letters, and the last-play ring is there from the first frame',
    initScript: () => {
      window.__TEST_TIPS__ = false;
      let s = 7; Math.random = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };   // the same puffs every run
      if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, motion: 'full', theme: 'light' }));
    },
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 3, seats: [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }] });
      await t.waitIdle(5000);
      await t.game('act', 'reveal');
      const s = await t.state();
      s.game.players[0].rack = 'SPRINGE'.split('');
      await t.game('setState', { game: s.game });
      await t.waitIdle(5000);
      await t.game('act', 'stage', [...'SPRING'].map((l, k) => ({ l, i: CENTER - 2 + k })));
      const r = await t.page.evaluate(async (first) => {
        const g = window.__game, frame = () => new Promise((f) => requestAnimationFrame(f));
        const played = (await g.act('play')).ok;
        await g.act('reveal');
        // the ring: dark brass on the board canvas round a tile that is still pressing home (held there for the look)
        const G = window.__G; for (const a of G.anim.values()) a.t0 += 1e6; G.animUntil += 1e6;
        const pressing = [...G.anim.values()].filter((a) => a.kind === 'commit').length;
        await frame(); await frame();
        const bc = document.getElementById('board'), bk = bc.width / bc.clientWidth, pos = [];
        for (let k = 0; k < 6; k++) pos.push(await g.act('cell', first + k, 0.24));
        const cell = pos[1][0] - pos[0][0], h = Math.round(0.56 * cell * bk);
        const bd = bc.getContext('2d').getImageData(Math.round(pos[2][0] * bk) - h, Math.round(pos[2][1] * bk) - h, 2 * h, 2 * h).data;
        let ring = 0; for (let i = 0; i < bd.length; i += 4) if (bd[i + 3] > 180 && Math.abs(bd[i] - 122) < 18 && Math.abs(bd[i + 1] - 75) < 18 && bd[i + 2] < 30) ring++;
        for (const a of G.anim.values()) a.t0 -= 1e6; G.animUntil -= 1e6;
        // the steam: from the moment the sweep, the flash and the arc have gone, every frame until the steam has
        const fc = document.getElementById('fx'), fx = fc.getContext('2d'), k = fc.width / fc.clientWidth;
        let seen = 0, most = 0, any = 0;
        for (;;) {
          await frame();
          const st = g.getState();
          if (st.sweeps || st.flashes || st.arcs) continue;
          if (!st.fx.steamKinds) break;
          seen++;
          for (const [x, y] of pos) {
            const q = Math.round(0.2 * cell * k), d = fx.getImageData(Math.round(x * k) - q, Math.round(y * k) - q, 2 * q, 2 * q).data;
            for (let i = 3; i < d.length; i += 4) most = Math.max(most, d[i]);
          }
          const all = fx.getImageData(0, 0, fc.width, fc.height).data;
          for (let i = 3; i < all.length; i += 16) any = Math.max(any, all[i]);
        }
        return { played, pressing, ring, seen, most: most / 255, any: any / 255 };
      }, CENTER - 2);
      t.log(`ring ${r.ring} px, ${r.seen} frames of steam, at most ${r.most.toFixed(3)} over a letter and ${r.any.toFixed(3)} anywhere`);
      t.expect(r.played, 'SPRING is played');
      t.equal(r.pressing, 6, 'its six tiles are pressing home');
      t.expect(r.ring >= 20, `the dark-brass last-play ring is drawn at once (${r.ring} px)`);
      t.expect(r.seen > 3 && r.any > 0.03, `the steam itself is still there (${r.seen} frames, ${r.any.toFixed(3)})`);
      t.expect(r.most <= 0.15, `it lies at most 15% strong over a letter (${r.most.toFixed(3)}; unthinned it is 0.22 to 0.28)`);
    },
  },
  {
    name: 'W6-S4-04 one celebration at a time: a Featured Spring claim without steam, a big play without a glint or a puff',
    viewports: ['desktop'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      const fresh = async (edit) => {
        await t.game('newGame', { seed: 3, seats: [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }] });
        await t.waitIdle(5000);
        await t.game('act', 'reveal');
        const s = await t.state();
        edit(s.game);
        await t.game('setState', { game: s.game });
        await t.waitIdle(5000);
      };
      await fresh((g) => { g.featured[0] = { id: 'steam', word: 'STEAM', cat: 'springs', shown: [0], by: null, at: null }; g.players[0].rack = 'STEAMXQ'.split(''); });
      await t.game('act', 'stage', [...'STEAM'].map((l, k) => ({ l, i: CENTER - 2 + k })));
      t.expect((await t.game('act', 'play')).ok, 'STEAM claims the Featured Spring');
      const f = await t.state();
      t.equal([f.fx.lastEvent, f.fx.steamKinds, f.sweeps], ['featured', 0, 1], 'the claim has its sweep, star and arc, and no steam under them');
      t.expect(f.arcLog.some((a) => a.reason === 'claim'), 'the arc is there');

      // a big everyday play that covers a word square
      await fresh((g) => { g.board[CENTER] = { l: 'A', blank: false, p: 1, t: 0 }; g.board[80] = { l: 'A', blank: false, p: 1, t: 0 }; g.move = 1; g.cur = 0; g.players[0].rack = 'JAZZYAA'.split(''); });
      const big = await t.page.evaluate(async (SQ) => (await window.__game.act('moves', 400)).find((m) => m.tiles.length < 7 && m.score >= 45 && !m.words.some((w) => w.themed) && m.tiles.some((x) => 'sb'.includes(SQ[x.i]))), SQUARE);
      t.expect(!!big, 'a big everyday play covers a word square');
      await t.game('act', 'stage', big.tiles);
      t.expect((await t.game('act', 'play')).ok, 'it is played');
      const b = await t.state();
      t.equal([b.fx.lastEvent, b.fx.flashShapes.includes('oct'), b.fx.steamKinds], ['big', false, 0], 'its sparks have the board to themselves');
      t.expect(b.sparks >= 12, `the sparks are there (${b.sparks})`);
    },
  },
];

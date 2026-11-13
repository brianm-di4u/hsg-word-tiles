// Wave 1, batch C: S6-12 (tiny window board), S6-02 (small landscape phones), P-N04 (blocklist).
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });

async function measure(t, w, h) {
  await t.page.setViewportSize({ width: w, height: h });
  for (let k = 0; k < 3; k++) { await t.page.evaluate(() => dispatchEvent(new Event('resize'))); await t.waitFrames(1); }
  return t.page.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
    const tiles = [...document.querySelectorAll('#rack .rtile')].map((e) => e.getBoundingClientRect());
    return { W: innerWidth, H: innerHeight, board: r('#boardwrap'), rack: r('#rack'), play: r('[data-act=play]'), pass: r('[data-act=pass]'), hint: r('[data-act=hint]'),
      tileL: Math.min(...tiles.map((x) => x.left)), tileR: Math.max(...tiles.map((x) => x.right)), tileB: Math.max(...tiles.map((x) => x.bottom)), n: tiles.length };
  });
}
async function live(t) {
  await ready(t);
  await t.game('newGame', { seed: 6 });
  await t.waitIdle(5000);
}
const inside = (t, m, name) => {
  for (const k of ['play', 'pass', 'hint']) t.expect(m[k] && m[k].b <= m.H + 0.5 && m[k].r <= m.W + 0.5 && m[k].t >= 0, `${m.W}x${m.H}: ${k} button inside the viewport (${m[k] && Math.round(m[k].b)} of ${m.H})`);
  t.expect(m.n === 7 && m.tileL >= 0 && m.tileR <= m.W + 0.5 && m.tileB <= m.H + 0.5, `${m.W}x${m.H}: all 7 rack tiles inside the viewport (${Math.round(m.tileL)}-${Math.round(m.tileR)} of ${m.W}, bottom ${Math.round(m.tileB)} of ${m.H})`);
};

export const tests = [
  {
    name: 'S6-12 a 320x480 window keeps a playable board',
    viewports: ['desktop'],
    async run(t) {
      await live(t);
      const m = await measure(t, 320, 480);
      t.expect(m.board.w >= 230 && m.board.h >= 230, `board at least 230 px across (${Math.round(m.board.w)}x${Math.round(m.board.h)})`);
      t.expect(m.rack.t >= m.board.b - 0.5, 'the rack does not overlap the board (rack top ' + Math.round(m.rack.t) + ', board bottom ' + Math.round(m.board.b) + ')');
      t.expect(m.rack.r <= m.W + 0.5 && m.play.r <= m.W + 0.5, 'rack and buttons inside the width');
      const sc = await t.page.evaluate(() => { const a = document.querySelector('#app'); a.scrollTop = a.scrollHeight; const p = document.querySelector('[data-act=play]').getBoundingClientRect(); return { top: a.scrollTop, b: p.bottom, H: innerHeight }; });
      t.expect(sc.b <= sc.H + 0.5, 'the buttons can be scrolled into view (' + Math.round(sc.b) + ' of ' + sc.H + ')');
    },
  },
];

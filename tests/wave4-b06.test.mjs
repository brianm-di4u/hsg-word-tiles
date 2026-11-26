// Wave 4, batch W4-B06 (WF-2 visual hierarchy). W2-S1-06: the title's kicker and italic tagline ("Build words. Find the springs.")
// cross the sunlit stucco of title.webp where the .title-words scrim fades out. They get the same kind of dark separation the h1 has
// (a soft and a tight umber text-shadow) and the scrim's mid-stop is deepened to rgba(20,14,8,0.48) at 78%. Earlier title work kept:
// c153702 / W2-B04 / W3-B13 (padding, frame clearance, card caps; tests: wave1-b05-layout, wave2-b04, wave3-b13).
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, theme: 'light' }));
};
const size = async (t, w, h) => { await t.page.setViewportSize({ width: w, height: h }); await t.waitFrames(3); };

// the page-space box of the last word of the tagline ("springs."), or of the whole line
const wordBox = (t, sel, last) => t.page.evaluate(([sel, last]) => {
  const p = document.querySelector(sel), n = p.firstChild, s = n.textContent, g = document.createRange();
  const from = last ? s.lastIndexOf(' ') + 1 : 0;
  g.setStart(n, from); g.setEnd(n, s.length);
  const r = g.getBoundingClientRect();
  return { x: r.left, y: r.top, width: r.width, height: r.height };
}, [sel, last]);

// relative luminance (WCAG) of the pixels in a page box: the 90th percentile and the brightest
const lum = async (t, box) => {
  const png = await t.page.screenshot({ clip: box, animations: 'disabled' });
  return t.page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data, lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const L = [];
    for (let p = 0; p < d.length; p += 4) L.push(0.2126 * lin(d[p]) + 0.7152 * lin(d[p + 1]) + 0.0722 * lin(d[p + 2]));
    L.sort((a, b) => a - b);
    return { p90: L[Math.floor(L.length * 0.9)], max: L[L.length - 1] };
  }, png.toString('base64'));
};
const TEXT = 0.9406;   // #FFF8E6, the tagline's colour
const ratio = (l) => (TEXT + 0.05) / (l + 0.05);

export const tests = [
  {
    name: 'W2-S1-06 the title kicker and tagline carry an umber text-shadow and sit on a deeper scrim, so "springs." stands off the sunlit stucco',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('scene', 'title');
      await t.page.waitForFunction(() => { const i = document.querySelector('.title-art'); return i && i.tagName === 'IMG' && i.complete && i.naturalWidth > 0; }, null, { timeout: 15000 });
      await t.page.evaluate(() => document.querySelector('.title-art').decode());
      const sizes = t.viewport === 'desktop' ? [[t.vp.width, t.vp.height], [1024, 600], [1366, 768]] : [[t.vp.width, t.vp.height], [844, 390], [360, 640]];
      for (const [w, h] of sizes) {
        await size(t, w, h);
        await t.game('scene', 'title');
        await t.waitFrames(3);
        const what = `${w}x${h}`;
        const css = await t.page.evaluate(() => {
          const cs = (s) => getComputedStyle(document.querySelector(s));
          return { kicker: cs('.title-words .kicker').textShadow, tag: cs('.title-words .tag').textShadow, scrim: cs('.title-words').backgroundImage };
        });
        for (const k of ['kicker', 'tag']) {
          t.expect(/rgba\(16, 10, 4, 0\.9\) 0px 1px 6px/.test(css[k]) && /rgba\(16, 10, 4, 0\.85\) 0px 1px 2px/.test(css[k]), `${what}: .${k} has the soft and the tight umber shadow (${css[k]})`);
        }
        t.expect(/rgba\(20, 14, 8, 0\.48\) 78%/.test(css.scrim), `${what}: the scrim's mid-stop is rgba(20,14,8,0.48) at 78% (${css.scrim})`);
        // "springs." against what is behind it: with the letters hidden but their shadow kept (what frames each glyph), and with the scrim alone
        const box = await wordBox(t, '.title-words .tag', true), line = await wordBox(t, '.title-words .tag', false);
        const pad = { x: box.x - 2, y: box.y, width: box.width + 4, height: box.height };
        const style = await t.page.addStyleTag({ content: '.title-words .tag, .title-words .kicker { color: transparent !important; }' });
        const halo = await lum(t, pad);
        await style.evaluate((n) => n.remove());
        const style2 = await t.page.addStyleTag({ content: '.title-words .tag, .title-words .kicker { color: transparent !important; text-shadow: none !important; }' });
        const bare = await lum(t, pad);
        await style2.evaluate((n) => n.remove());
        await t.waitFrames(2);
        t.log(`${what}: "springs." box ${JSON.stringify(pad)}; scrim only p90 ${bare.p90.toFixed(3)} (${ratio(bare.p90).toFixed(2)}:1), max ${bare.max.toFixed(3)}; with shadow p90 ${halo.p90.toFixed(3)} (${ratio(halo.p90).toFixed(2)}:1), max ${halo.max.toFixed(3)}`);
        // before this fix (no shadow, 0.25 at 75%) the ground read 2.16 to 2.92:1 at these sizes; after it 4.48 to 7.40:1 with the
        // shadow (90th-percentile pixel of the word's box, gaps between letters included) and 2.90 to 5.22:1 for the scrim alone
        t.expect(ratio(halo.p90) >= 4.2, `${what}: "springs." reads at >= 4.2:1 against its shadowed ground (${ratio(halo.p90).toFixed(2)}:1)`);
        t.expect(ratio(bare.p90) >= 2.8, `${what}: the deeper scrim alone keeps the ground behind "springs." at >= 2.8:1 (${ratio(bare.p90).toFixed(2)}:1)`);
        t.expect(line.width > 0 && box.width > 0, `${what}: the tagline is laid out`);
        if (w === t.vp.width) await t.shot(`w4-b06-title-${what}`);
      }
    },
  },
];

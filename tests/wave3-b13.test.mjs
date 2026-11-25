// Wave 3, batch W3-B13: W5-S1-12 (coach beside the preview strip, compact hint strip), W5-S3-04 (constant #actions, turn line tokens),
// W5-S3-05 (title card cap and compact menu), W5-S3-03 (action labels at 130% text). Earlier parts: f6db630, c153702, 4bf89ec, 0b7f0b6, 8eb82a6, 9922cf2.
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const KEY = 'hs-letters-settings-v1';
const withTips = () => { window.__TEST_TIPS__ = true; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, theme: 'light', tipsSeen: false })); };
const noTips = () => { window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, theme: 'light' })); };
const textSize = async (t, v) => {
  await t.page.evaluate(([key, k]) => { const s = JSON.parse(localStorage.getItem(key)); s.text = k; localStorage.setItem(key, JSON.stringify(s)); }, [KEY, v]);
  await t.reload();
  await ready(t);
};
const size = async (t, w, h) => { await t.page.setViewportSize({ width: w, height: h }); await t.waitFrames(3); };
const box = (t, sels) => t.page.evaluate((list) => Object.fromEntries(list.map((s) => { const e = document.querySelector(s), r = e ? e.getBoundingClientRect() : null; return [s, r && r.width ? { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, v: getComputedStyle(e).visibility } : null]; })), sels);
const apart = (a, b) => a.r <= b.l + 0.5 || a.l >= b.r - 0.5 || a.b <= b.t + 0.5 || a.t >= b.b - 0.5;

export const tests = [
  {
    name: 'W5-S1-12 phone and tablet tips sit by the preview strip, cover nothing, keep the Steam ledger and leave Play on the screen',
    viewports: ['mobile'],
    initScript: withTips,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 5 });
      await t.waitIdle(6000);
      const CARD = '#coach .coach-card', AROUND = ['#boardwrap', '#springs', '#turnline', '#rackbar', '#actions', '#ledger'];
      const all = [CARD, '#preview', '#actions .play', ...AROUND];
      const clear = (m, what) => { for (const s of AROUND) t.expect(!!m[CARD] && !!m[s] && apart(m[CARD], m[s]), `${what}: the tip does not cover ${s} (${JSON.stringify([m[CARD], m[s]])})`); };
      // true: a row of its own above the strip; false: no spare height, so it takes the place of the strip while that has nothing to say
      for (const [w, h, row] of [[390, 844, true], [430, 932, true], [360, 780, true], [844, 390, true], [667, 375, true], [932, 430, true], [390, 664, false], [375, 667, false], [320, 568, false], [568, 320, false], [768, 1024, false], [820, 1180, false]]) {
        await size(t, w, h);
        const what = `${w}x${h}`;
        const check = (m, when) => {
          clear(m, `${what} ${when}`);
          t.expect(m['#ledger'].h >= 14, `${what} ${when}: the ledger stays (${m['#ledger'].h})`);
          t.expect(m['#actions .play'].b <= h + 0.5, `${what} ${when}: Play is on the screen (${m['#actions .play'].b})`);
          const c = m[CARD], p = m['#preview'];
          if (row) t.expect(c.v === 'visible' && p.v === 'visible' && c.b <= p.t + 0.5 && p.t - c.b <= 8, `${what} ${when}: in its own row just above the strip (${JSON.stringify([c, p])})`);
        };
        const m = await box(t, all);
        check(m, 'nothing placed');
        if (!row) t.equal(`${m[CARD].v} ${m['#preview'].v} ${Math.round(m[CARD].t - m['#preview'].t)}`, 'visible hidden 0', `${what}: the tip stands in for the empty strip`);
        t.expect(m[CARD].h <= 64, `${what}: a compact strip (${m[CARD].h})`);
        t.equal(await t.page.evaluate(() => [...document.querySelectorAll('#coach button')].filter((b) => { const r = b.getBoundingClientRect(); return r.height < 44 || r.width < 44 || !b.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)); }).length), 0, `${what}: its buttons are 44 px and on top`);
        if ([844, 320].includes(w)) await t.shot(`w3-b13-coach-${what}`);
        const [mv] = await t.game('act', 'moves', 1);
        await t.game('act', 'stage', mv.tiles);
        await t.waitFrames(2);
        const s = await box(t, all);
        check(s, 'a word placed');
        t.equal(s['#preview'].v, 'visible', `${what}: the score of a placed word shows`);
        if (!row) t.equal(s[CARD].v, 'hidden', `${what}: and the tip steps aside`);
        t.equal(await t.page.locator('#actions .play.coach-target').count(), 1, `${what}: Play is marked`);
        await t.game('act', 'recall');
        await t.waitFrames(2);
      }
      for (const theme of ['light', 'dark']) {
        await t.page.evaluate((th) => document.body.classList.toggle('theme-dark', th === 'dark'), theme);
        t.equal((await t.contrastReport({ selector: '#coach', min: 4.5, largeMin: 4.5 })).fails.length, 0, `contrast, ${theme}`);
      }
      // what the player does wins over the tip, and a dismissed tip gives the strip back
      await size(t, 390, 664);
      const look = async () => { const m = await box(t, [CARD, '#preview']); return `${m[CARD] ? m[CARD].v : 'none'} ${m['#preview'].v}`; };
      t.equal(await look(), 'visible hidden', 'the tip');
      await t.page.evaluate(() => window.__game.act('stage', [{ i: 0, l: window.__G.s.players[0].rack[0] }]));
      await t.waitFrames(2);
      t.equal(`${await look()} ${await t.page.locator('#preview.bad').count()}`, 'hidden visible 1', 'a misplaced tile: the strip says why');
      await t.game('act', 'recall');
      await t.waitFrames(2);
      t.equal(await look(), 'visible hidden', 'the tip again');
      await t.page.click('#coach [data-coach="skip"]');
      await t.waitFrames(2);
      t.equal(await look(), 'none visible', 'skipped: the strip is back');
      // 130% text: the smallest phones may scroll, but the tip still covers nothing
      await t.page.evaluate((key) => { const s = JSON.parse(localStorage.getItem(key)); s.tipsSeen = false; localStorage.setItem(key, JSON.stringify(s)); }, KEY);
      await textSize(t, 1.3);
      await t.game('newGame', { seed: 5 });
      await t.waitIdle(6000);
      for (const [w, h] of [[390, 844], [844, 390], [320, 568], [568, 320], [768, 1024]]) {
        await size(t, w, h);
        clear(await box(t, all), `${w}x${h} 130%`);
      }
    },
  },
  {
    name: 'W5-S1-12 a hint keeps Other plays and How it scores at 44 px in a compact strip that does not push the rack down',
    viewports: ['mobile'],
    initScript: noTips,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 5 });
      await t.waitIdle(6000);
      for (const [w, h, most] of [[390, 844, 0], [430, 932, 0], [844, 390, 6], [320, 568, 16], [568, 320, 26]]) {
        await size(t, w, h);
        const a = await box(t, ['#rackbar']);
        await t.game('act', 'hint');
        await t.waitIdle(6000);
        t.equal(await t.page.locator('#preview.hintlive').count(), 1, 'a hint is on the board');
        const moved = (await box(t, ['#rackbar']))['#rackbar'].t - a['#rackbar'].t;
        t.expect(moved <= most + 0.5, `${w}x${h}: the rack moves ${moved} px, at most ${most}`);
        const bs = await t.page.evaluate(() => [...document.querySelectorAll('#preview .bdbtn')].map((e) => { const r = e.getBoundingClientRect(), p = document.querySelector('#preview').getBoundingClientRect(); return { t: e.textContent.trim(), w: r.width, h: r.height, hit: e.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)), in: r.left >= p.left && r.right <= p.right && r.top >= p.top - 0.5 && r.bottom <= p.bottom + 0.5, clip: e.scrollWidth > e.clientWidth }; }));
        t.expect(/^Other plays 1\/\d$/.test(bs[0].t) && bs[1].t === 'How it scores' && bs.every((x) => x.w >= 44 && x.h >= 44 && x.hit && x.in && !x.clip), `${w}x${h}: ${JSON.stringify(bs)}`);
        if (w === 390) await t.shot('w3-b13-hint');
        await t.page.click('#preview .bdbtn:not([data-hintnext])');
        t.equal(await t.page.locator('#preview .bd').count(), 1, 'and it opens the breakdown');
        await t.game('act', 'recall');
        await t.waitIdle(6000);
        await t.page.evaluate(() => { window.__G.s.players[0].hints = 3; });
      }
      // a Challenge play's longer strip keeps its place too
      await size(t, 390, 844);
      await t.game('newGame', { seed: 5, challenge: true });
      await t.waitIdle(6000);
      const a = await box(t, ['#rackbar']);
      const [mv] = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', mv.tiles);
      await t.waitIdle(6000);
      t.equal(Math.round((await box(t, ['#rackbar']))['#rackbar'].t - a['#rackbar'].t), 0, 'Challenge: the rack stays put');
    },
  },
];

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
  {
    name: 'W5-S3-04 the action buttons never move: same slots with no tile, with tiles, and while the computer plays, and Shift+R still shuffles',
    viewports: ['desktop', 'mobile'],
    initScript: noTips,
    async run(t) {
      await ready(t);
      const mobile = t.viewport === 'mobile';
      const slots = () => t.page.evaluate(() => [...document.querySelectorAll('#actions .abtn')].map((b) => { const r = b.getBoundingClientRect(); return { act: b.dataset.act, at: `${r.left.toFixed(1)}+${r.width.toFixed(1)}`, off: b.disabled, text: b.textContent.trim() }; }));
      const sizes = mobile ? [[390, 844], [320, 568], [844, 390], [568, 320]] : [[1280, 800], [1024, 600]];
      for (const [w, h] of sizes) {
        await size(t, w, h);
        for (const challenge of [false, true]) {
          const what = `${w}x${h}${challenge ? ' Challenge' : ''}`, n = (mobile ? 5 : 6) - (challenge ? 1 : 0);
          await t.game('newGame', { seed: 5, challenge });
          await t.waitIdle(6000);
          const a = await slots();
          t.equal(a.length, n, `${what}: ${n} slots`);
          t.equal(a[0].act, 'shuffle', `${what}: Shuffle first`);
          if (!mobile) t.equal(`${a[1].act} ${a[1].off}`, 'recall true', `${what}: Recall waits in slot 2`);
          const [mv] = await t.game('act', 'moves', 1);
          await t.game('act', 'stage', mv.tiles);
          await t.waitIdle(6000);
          const b = await slots();
          t.equal(b.map((x) => x.at).join(' '), a.map((x) => x.at).join(' '), `${what}: tiles placed, nothing moved`);
          t.equal(mobile ? b[0].act : `${b[0].act} ${b[1].act} ${b[1].off}`, mobile ? 'recall' : 'shuffle recall false', `${what}: Recall is on`);
          // Shift+R, with two tiles still on the rack
          const orders = new Set();
          for (let k = 0; k < 12; k++) { await t.page.keyboard.press('Shift+R'); orders.add((await t.state()).order.join()); }
          t.expect(orders.size > 1, `${what}: Shift+R shuffles with tiles placed (${[...orders].join(' / ')})`);
          t.equal((await t.state()).staged.length, mv.tiles.length, `${what}: and takes none back`);
          await t.game('act', 'recall');
          await t.waitIdle(6000);
          // the computer's turn, read before it can play
          const c = await t.page.evaluate(() => {
            const g = window.__game.getState().game; g.cur = 1;
            window.__game.setState({ game: g });
            const at = [...document.querySelectorAll('#actions .abtn')].map((b) => { const r = b.getBoundingClientRect(); return { act: b.dataset.act, at: `${r.left.toFixed(1)}+${r.width.toFixed(1)}`, off: b.disabled, text: b.textContent.trim() }; });
            return { at, turn: window.__G.s.cur };
          });
          t.equal(c.turn, 1, `${what}: it is the computer's turn`);
          t.equal(c.at.map((x) => `${x.act} ${x.at}`).join(', '), a.map((x) => `${x.act} ${x.at}`).join(', '), `${what}: the computer's turn, nothing moved`);
          if (!challenge) { const hint = c.at.find((x) => x.act === 'hint'); t.expect(hint && hint.off && /3/.test(hint.text), `${what}: Hint waits, off, with its count (${JSON.stringify(hint)})`); }
          await t.waitIdle(8000);
        }
      }
      // no hints in this game, and the Daily Soak: no Hint button at all, on either turn
      await t.game('newGame', { seed: 5, hints: false });
      await t.waitIdle(6000);
      t.equal((await slots()).some((x) => x.act === 'hint'), false, 'hints off: no Hint');
      await t.page.evaluate(() => { const g = window.__game.getState().game; g.cur = 1; window.__game.setState({ game: g }); });
      t.equal((await slots()).some((x) => x.act === 'hint'), false, 'hints off, the computer: no Hint');
    },
  },
  {
    name: 'W5-S3-04 the phone turn line is short whole tokens at 100% and 130% text: whose turn and the bag, the Daily turn first',
    viewports: ['mobile'],
    initScript: noTips,
    async run(t) {
      await ready(t);
      const read = () => t.page.evaluate(() => {
        const tl = document.querySelector('#turnline'), bar = tl.getBoundingClientRect();
        const shown = [...tl.querySelectorAll('*')].filter((e) => !e.closest('.sr-only, .badge') && e.getBoundingClientRect().width > 0);
        return {
          first: tl.firstElementChild.firstElementChild.textContent.trim(),
          text: (tl.querySelector('.bag, .daily-bag') || tl).textContent.trim(), label: tl.querySelector('[data-open-tracker]')?.getAttribute('aria-label') || '',
          cut: shown.filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).display !== 'inline' && getComputedStyle(e).overflowX !== 'visible').map((e) => e.className),
          out: shown.filter((e) => { const r = e.getBoundingClientRect(), c = e.matches('[data-open-tracker]') ? 9 : 0.5; return r.left < bar.left - c || r.right > bar.right + c; }).map((e) => e.className),
          n: (() => { const e = tl.querySelector('.bag-n'); return e ? e.textContent.trim() : ''; })(),
        };
      });
      const SIZES = [[390, 844], [320, 568], [844, 390], [568, 320]];
      for (const text of [1, 1.3]) {
        await textSize(t, text);
        for (const [w, h] of SIZES) {
          await size(t, w, h);
          const what = `${w}x${h} ${text * 100}%`;
          await t.game('newGame', { seed: 5, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }, { kind: 'ai', persona: 'hollis', level: 'medium' }, { kind: 'ai', persona: 'julian', level: 'hard' }] });
          await t.waitIdle(6000);
          let m = await read();
          t.equal(`${m.text} | ${m.label} | ${m.cut} | ${m.out}`, 'Your turn · 70 bag | You to play · 70 tiles in the bag — open Unseen tiles |  | ', `${what}: your turn`);
          m = await t.page.evaluate(() => { const g = window.__game.getState().game; g.cur = 3; window.__game.setState({ game: g }); const e = document.querySelector('#turnline .bag'); return { text: e.textContent.trim(), cut: e.querySelector('.bag-who').scrollWidth > e.querySelector('.bag-who').clientWidth + 1 }; });
          t.equal(`${m.text} ${m.cut}`, 'Julian · 70 bag false', `${what}: the computer with the longest name`);
          await t.waitIdle(8000);
          // two people with the longest names the game takes: the name gives way, never the bag
          await t.game('newGame', { seed: 5, seats: [{ kind: 'human', name: 'Maximilianotter1' }, { kind: 'human', name: 'Wilhelminaaaaaaa' }] });
          await t.game('act', 'reveal');
          m = await read();
          t.expect(m.n === '· 84 bag' && m.out.length === 0 && m.cut.every((c) => c === 'bag-who') && /^Maximilianotter1 to play · 84 tiles in the bag/.test(m.label), `${what}: pass and play ${JSON.stringify(m)}`);
          // the Daily Soak: its turn first, then the bag and the star targets together
          await t.game('newGame', { mode: 'daily', date: '2026-11-20' });
          await t.waitIdle(6000);
          await t.page.waitForFunction(() => document.querySelectorAll('#turnline .par-pip').length === 2, null, { timeout: 15000 });
          m = await read();
          t.equal(`${m.first} | ${m.text} | ${m.label} | ${m.cut} | ${m.out}`, 'Turn 1 / 10 | 91 bag | 91 tiles in the bag — open Unseen tiles |  | ', `${what}: Daily Soak`);
          t.equal((await t.contrastReport({ selector: '#turnline', min: 4.5, largeMin: 3 })).fails.length, 0, `${what}: contrast`);
        }
        await size(t, 390, 844);
        await t.waitFrames(2);
        await t.shot(`w3-b13-daily-${text * 100}`);
        await t.page.click('#turnline .daily-bag');
        t.equal((await t.state()).dialog, 'tracker', 'the Daily bag opens Unseen tiles');
        await t.page.click('#modal [data-close]');
        await t.game('newGame', { seed: 5 });
        await t.waitIdle(6000);
        await t.shot(`w3-b13-turn-${text * 100}`);
        await t.page.click('#turnline .bag-btn');
        t.equal((await t.state()).dialog, 'tracker', 'the bag opens Unseen tiles');
        await t.page.click('#modal [data-close]');
      }
    },
  },
  {
    name: 'W5-S3-05 title: capped painting, words inside its gold frame and the whole menu on the first screen; Start and the results buttons in view',
    viewports: ['desktop', 'mobile'],
    initScript: noTips,
    async run(t) {
      await ready(t);
      const start = async () => { await t.game('newGame', { seed: 2 }); await t.waitIdle(6000); await t.game('act', 'pass'); await t.waitIdle(8000); await t.game('scene', 'title'); await t.waitFrames(2); };
      await start();   // a saved game, so Continue shows too: the menu at its longest
      const fin = async () => { const g = (await t.state()).game; return { ...g, over: true, bag: [], featured: [], result: { why: 'out', out: 0, adjust: [0, 0], winners: [0] } }; };
      const OVER = await fin();
      const sizes = t.viewport === 'desktop'
        ? [[1920, 1080], [1280, 800], [1366, 768], [1280, 720], [1024, 600], [800, 1100], [820, 1180], [768, 1024]]
        : [[390, 844], [430, 932], [360, 640], [320, 568], [844, 390], [667, 375], [568, 320]];
      for (const [w, h] of sizes) {
        await size(t, w, h);
        const what = `${w}x${h}`;
        await t.game('scene', 'title');
        await t.waitFrames(2);
        const m = await t.page.evaluate(() => {
          const card = document.querySelector('.title-card').getBoundingClientRect(), inset = 3 + 8 + 1.5;   // border, ::after inset, its line
          const words = ['.kicker', '.title-words h1', '.tag'].map((s) => { const g = document.createRange(); g.selectNodeContents(document.querySelector(s)); const r = g.getBoundingClientRect(); return { s, room: Math.round(Math.min(r.left - card.left, card.right - r.right, r.top - card.top, card.bottom - r.bottom) - inset) }; });
          const menu = [...document.querySelectorAll('.menu .btn')].map((b) => ({ go: b.dataset.go, b: b.getBoundingClientRect().bottom, h: b.getBoundingClientRect().height }));
          return { card: card.height, stacked: document.querySelector('.menu').getBoundingClientRect().top >= card.bottom, words, menu, sideways: document.querySelector('#screen').scrollWidth > document.querySelector('#screen').clientWidth };
        });
        t.equal(m.menu[0].go, 'continue', `${what}: Continue first`);
        const off = m.menu.filter((b) => b.b > h + 0.5).map((b) => b.go);
        t.equal(off.join(), w === 568 ? 'about' : '', `${what}: the menu is on the first screen`);   // seven 44 px rows cannot fit 320 px of height
        t.expect(m.menu.every((b) => b.h >= 43.5), `${what}: 44 px buttons`);
        t.expect(m.words.every((x) => x.room >= 4), `${what}: the words keep clear of the gold frame ${JSON.stringify(m.words)}`);
        t.expect(m.card <= (m.stacked ? Math.min(0.44 * h, 380) : 380) + 0.5, `${what}: the painting is ${m.card.toFixed(0)} px tall`);
        if (m.stacked && w < 561) t.expect(m.card <= 0.38 * h + 0.5, `${what}: at most 38% of a phone (${m.card.toFixed(0)} px)`);
        t.equal(m.sideways, false, `${what}: no sideways scroll`);
        if ([320, 820, 844, 1366].includes(w)) await t.shot(`w3-b13-title-${what}`);
        await t.game('scene', 'setup');
        await t.waitFrames(2);
        const s = await t.page.evaluate(() => { const r = document.querySelector('[data-start]').getBoundingClientRect(); return { b: r.bottom, pos: getComputedStyle(document.querySelector('.setup .sheet-foot')).position }; });
        t.expect(s.b <= h + 0.5 && s.pos === 'sticky', `${what}: Start in view in a sticky foot ${JSON.stringify(s)}`);
        await t.game('setState', { game: OVER, scene: 'over' });
        await t.waitFrames(2);
        const o = await t.page.evaluate(() => ({ art: document.querySelector('.over-art').getBoundingClientRect().height, pos: getComputedStyle(document.querySelector('.over .dlg-btns')).position, low: Math.max(...[...document.querySelectorAll('.over .dlg-btns .btn')].map((b) => b.getBoundingClientRect().bottom)) }));
        t.expect(o.low <= h + 0.5 && o.pos === 'sticky', `${what}: the results buttons in view in a sticky foot ${JSON.stringify(o)}`);
        if (h <= 800) t.expect(o.art <= 80, `${what}: the results painting is trimmed (${o.art})`);
        await t.game('setState', { game: { ...OVER, over: false, result: null } });
      }
      // 130% text: the words still keep clear of the frame
      await size(t, t.vp.width, t.vp.height);
      await textSize(t, 1.3);
      for (const [w, h] of t.viewport === 'desktop' ? [[1280, 800], [820, 1180]] : [[390, 844], [320, 568], [844, 390]]) {
        await size(t, w, h);
        await t.game('scene', 'title');
        await t.waitFrames(2);
        const rooms = await t.page.evaluate(() => { const card = document.querySelector('.title-card').getBoundingClientRect(); return ['.kicker', '.title-words h1', '.tag'].map((s) => { const g = document.createRange(); g.selectNodeContents(document.querySelector(s)); const r = g.getBoundingClientRect(); return Math.round(Math.min(r.left - card.left, card.right - r.right, r.top - card.top, card.bottom - r.bottom) - 12.5); }); });
        t.expect(rooms.every((x) => x >= 2), `${w}x${h} 130%: ${rooms}`);
      }
    },
  },
  {
    name: 'W5-S3-03 four players at 100% and 130% text: every action button whole on the screen with its label and +points inside, board and two columns kept',
    viewports: ['desktop'],
    initScript: noTips,
    async run(t) {
      await ready(t);
      const seats = [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }, { kind: 'ai', persona: 'hollis', level: 'medium' }, { kind: 'ai', persona: 'julian', level: 'hard' }];
      for (const text of [1, 1.3]) {
        await textSize(t, text);
        for (const n of [2, 4]) {
          await t.game('newGame', { seed: 5, seats: seats.slice(0, n) });
          await t.waitIdle(6000);
          const [mv] = await t.game('act', 'moves', 1);
          await t.game('act', 'stage', mv.tiles);
          await t.waitIdle(6000);
          for (const [w, h] of [[1024, 600], [1024, 701], [1024, 768], [1280, 720], [1366, 768], [1280, 800], [1920, 1080]]) {
            await t.page.setViewportSize({ width: w, height: h });
            await t.page.evaluate(() => { window.__G.preview.score = 104; window.__game.act('reveal'); });   // a three-figure play, the widest the badge gets; redrawn by hand, since a resize no longer rebuilds the HUD (W6-S6-05)
            await t.waitFrames(3);
            const what = `${w}x${h} ${n}P ${text * 100}%`;
            const m = await t.page.evaluate(() => {
              const R = (s) => document.querySelector(s).getBoundingClientRect(), app = document.querySelector('#app');
              return {
                acts: [...document.querySelectorAll('#actions .abtn')].map((b) => { const r = b.getBoundingClientRect(); return { act: b.dataset.act, h: r.height, b: r.bottom, r: r.right, spill: Math.max(...[...b.querySelectorAll('span, em, kbd')].map((e) => { const x = e.getBoundingClientRect(), g = document.createRange(); g.selectNodeContents(e); const y = g.getBoundingClientRect(); return Math.max(r.left - Math.min(x.left, y.left), Math.max(x.right, y.right) - r.right, x.bottom - r.bottom); })) }; }),
                pts: document.querySelector('#actions .play .play-pts').textContent, boardH: R('#boardwrap').height, boardR: R('#boardwrap').right, sideL: Math.min(R('#preview').left, R('#actions').left), over: `${app.scrollHeight - app.clientHeight} ${app.scrollWidth - app.clientWidth}`, oy: getComputedStyle(app).overflowY,
                cols: getComputedStyle(document.querySelector('#scores')).gridTemplateColumns.split(' ').length, grid: getComputedStyle(document.querySelector('#scores')).display,
              };
            });
            t.equal(m.pts, '+104', `${what}: the points are on Play`);
            for (const a of m.acts) t.expect(a.h >= 44 && a.b <= h + 0.5 && a.r <= w + 0.5 && a.spill <= 0.5, `${what}: ${JSON.stringify(a)}`);
            t.equal(`${m.over} ${m.oy}`, '0 0 auto', `${what}: nothing overflows, and a taller sidebar could scroll`);
            t.expect(m.boardR <= m.sideL + 1 && m.boardH >= 0.8 * h, `${what}: the board keeps the left column and its height (${m.boardH})`);
            if (n === 4 || h <= 700) t.equal(`${m.grid} ${m.cols}`, 'grid 2', `${what}: the scores in two columns`);
          }
          await t.page.setViewportSize({ width: 1024, height: 768 });
          await t.waitFrames(3);
          if (n === 4) await t.shot(`w3-b13-1024x768-4p-${text * 100}`);
          await t.game('act', 'recall');
        }
      }
    },
  },
];

// Wave 3, batch W3-B11: W5-P-N03 (the score breakdown), W5-S1-04 (hint and Challenge notices, Practice replay labels),
// W5-S1-01 (Final Soak footer). W5-S3-09 was built by 9c7d5cf, a8644f0 and d69352a (tests: wave2-b05, wave3-b01).
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const instant = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, theme: 'light' }));
  }
};
const CENTER = 112;
const across = (word, at = CENTER - 2) => [...word].map((l, k) => ({ i: at + k, l }));
async function game(t, rack = 'SPRINGE') {
  await t.game('newGame', { seed: 2 });
  await t.waitIdle(6000);
  const s = await t.state();
  s.game.players[0].rack = rack.split('');
  await t.game('setState', { game: s.game });
  await t.waitIdle(6000);
}

export const tests = [
  {
    name: 'W5-P-N03 the score breakdown closes when the tiles change (stage, take back, recall, hint, rack press, lifting a placed tile) and only then',
    viewports: ['desktop', 'mobile'],
    initScript: instant,
    async run(t) {
      await ready(t);
      await game(t);
      const bds = () => t.page.locator('#preview .bd').count();
      const open = async (tiles) => {
        await t.game('act', 'recall');
        await t.game('act', 'stage', tiles);
        await t.waitIdle(4000);
        await t.page.click('#preview .bdbtn:not([data-hintnext])');
        t.equal(await bds(), 1, 'open');
      };
      const closed = async (what, staged) => {
        t.equal(`${await bds()} ${await t.page.evaluate(() => window.__G.breakdown)}`, '0 false', `${what}: closed`);
        t.equal((await t.state()).staged.length, staged, `${what}: tiles placed`);
      };
      const spin = across('SPIN'), sprig = across('SPRIG');
      // reading it: a tap on any line leaves it open
      await open(spin);
      await t.page.click('#preview .bd li >> nth=0');
      t.equal(await bds(), 1, 'a tap on a line of the breakdown leaves it open');
      await t.page.click('#preview .bd li.tot');
      t.equal(await bds(), 1, 'a tap on the total too');
      await t.checkLayout();
      await t.shot('w3-b11-breakdown');
      await t.page.click('#preview .pts');
      t.equal(await bds(), 0, 'a tap on the strip still closes it');
      // a tile added
      await open(spin);
      await t.game('act', 'stage', [{ i: spin[3].i + 1, l: 'E' }]);
      await closed('a tile added', 5);
      await t.waitIdle(4000);
      // a tile taken back by a tap on the board
      await open(sprig);
      const [x, y] = await t.game('act', 'screen', sprig[4].i);
      await t.page.mouse.click(x, y);
      await closed('a tile taken back', 4);
      await t.waitIdle(4000);
      // Recall
      await open(spin);
      await t.page.click('#actions [data-act="recall"]');
      await closed('Recall', 0);
      // a press on a rack tile, before anything moves
      await open(spin);
      const [rx, ry] = await t.game('act', 'rackTile', 0);
      await t.page.mouse.move(rx, ry);
      await t.page.mouse.down();
      await closed('a press on a rack tile', 4);
      await t.page.mouse.up();
      // a placed tile lifted to be moved: closed while it is in the hand, and after it is put back
      await open(spin);
      const [bx, by] = await t.game('act', 'screen', spin[3].i);
      await t.page.mouse.move(bx, by);
      await t.page.mouse.down();
      await t.page.mouse.move(bx + 4, by - 30, { steps: 4 });
      await t.page.mouse.move(bx, by, { steps: 4 });
      t.expect((await t.state()).drag, 'the placed tile is in the hand');
      await closed('a placed tile lifted', 3);
      await t.page.mouse.up();
      await closed('and put back', 4);
      await t.waitIdle(4000);
      // the Spring Guide's play, and the next of its plays
      await open(spin);
      await t.game('act', 'hint');
      await t.waitIdle(4000);
      const n = (await t.state()).staged.length;
      t.expect(n > 0, 'the hint is on the board');
      await closed('Hint', n);
      await t.page.click('#preview .bdbtn:not([data-hintnext])');
      t.equal(await bds(), 1, 'open over a hint');
      await t.page.click('[data-hintnext]');
      t.equal(await bds(), 0, 'Other plays: closed');
    },
  },
  {
    name: 'W5-P-N03 Escape closes the score breakdown first and leaves the tiles; the next Escape takes them back, the next opens the menu',
    viewports: ['desktop'],
    initScript: instant,
    async run(t) {
      await ready(t);
      await game(t);
      const look = async () => { const s = await t.state(); return `bd=${await t.page.locator('#preview .bd').count()} staged=${s.staged.length} dialog=${s.dialog}`; };
      for (const how of ['Shift+B', 'button']) {
        await t.game('act', 'stage', across('SPIN'));
        await t.page.focus('#board');
        if (how === 'button') { await t.page.focus('#preview .bdbtn'); await t.page.keyboard.press('Enter'); } else await t.page.keyboard.press(how);
        t.equal(await look(), 'bd=1 staged=4 dialog=null', `${how}: open`);
        await t.page.keyboard.press('Escape');
        t.equal(await look(), 'bd=0 staged=4 dialog=null', `${how}: the first Escape closes the breakdown`);
        if (how === 'button') t.equal(await t.page.evaluate(() => document.activeElement.className), 'bdbtn', 'the focus stays on its button');
        await t.page.keyboard.press('Escape');
        t.equal(await look(), 'bd=0 staged=0 dialog=null', `${how}: the next takes the tiles back`);
      }
      await t.page.keyboard.press('Escape');
      t.equal(await look(), 'bd=0 staged=0 dialog=pause', 'and the next opens the menu');
      await t.page.keyboard.press('Escape');
      await t.game('scene', 'help');
      await t.page.click('[data-tab="keys"]');
      t.expect(/Esc close the score breakdown if it is open, else take back all tiles/.test(await t.page.textContent('.help-body')), 'Help says so');
    },
  },
  {
    name: 'W5-S1-04 Setup says before Start, on every size, that a hint sets no personal best, and stops saying so with hints off or in Challenge',
    viewports: ['desktop', 'mobile'],
    initScript: instant,
    async run(t) {
      await ready(t);
      await t.page.click('#screen [data-go="setup"]');
      // a notice counts only if it is on screen and nothing lies over it
      const seen = (sel) => t.page.evaluate((s) => {
        const e = document.querySelector(s), r = e && e.getClientRects().length ? e.getBoundingClientRect() : null;
        return !!r && r.top >= 0 && r.bottom <= innerHeight && [r.top + 2, r.bottom - 2].every((y) => e.contains(document.elementFromPoint(r.left + r.width / 2, y)));
      }, sel);
      const check = async (what) => {
        t.expect((await seen('.setup .foot-note')) || (await seen('[data-hints-note]')), `${what}: a hint notice is in view without scrolling`);
        t.expect(await seen('[data-start]'), `${what}: with Start`);
        t.equal(await t.page.evaluate(() => { const s = document.querySelector('#screen'); return Math.max(0, s.scrollWidth - s.clientWidth); }), 0, `${what}: no sideways scroll`);
      };
      const sizes = t.viewport === 'desktop' ? [[1280, 800], [1024, 600]] : [[390, 844], [320, 568], [844, 390]];
      for (const [width, height] of sizes) {
        await t.page.setViewportSize({ width, height });
        await t.waitFrames(2);
        await check(`${width}x${height}`);
        await t.shot(`w3-b11-setup-${width}x${height}`);
      }
      const last = sizes[sizes.length - 1];
      t.expect(await seen('.setup .foot-note'), `${last.join('x')}: it is the line in the foot`);
      for (const theme of ['light', 'dark']) {
        await t.page.evaluate((th) => { window.__G.settings.theme = th; document.body.classList.toggle('theme-dark', th === 'dark'); }, theme);
        const cr = await t.page.evaluate(() => {
          const lum = (c) => { const v = c.match(/[0-9.]+/g).slice(0, 3).map((x) => { const f = x / 255; return f <= 0.03928 ? f / 12.92 : ((f + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
          const a = lum(getComputedStyle(document.querySelector('.foot-note')).color), b = lum(getComputedStyle(document.querySelector('.sheet-foot')).backgroundColor);
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        });
        t.expect(cr >= 4.5, `${theme}: foot note contrast ${cr.toFixed(2)} >= 4.5`);
      }
      const foot = () => t.page.locator('.setup .foot-note').isVisible();
      await t.page.evaluate(() => document.querySelector('[data-hints]').click());
      t.equal(await foot(), false, 'hints off: no line');
      await t.page.evaluate(() => document.querySelector('[data-hints]').click());
      t.equal(await foot(), true, 'hints on again');
      await t.page.evaluate(() => { document.querySelector('.house-rules').open = true; document.querySelector('[data-challenge]').click(); });
      t.equal(await foot(), false, 'Challenge on (no hints): no line');
    },
  },
  {
    name: 'W5-S1-04 after today\'s Daily Soak the title calls the next one a Practice replay, and Continue says which kind is in progress',
    viewports: ['desktop', 'mobile'],
    initScript: instant,
    async run(t) {
      await ready(t);
      const daily = async () => (await t.page.textContent('#screen [data-go="daily"]')).replace(/\s+/g, ' ').trim();
      const cont = () => t.page.textContent('#screen [data-go="continue"] small');
      t.equal(await daily(), 'Daily Soak 10 turns, the same tiles for everyone', 'not played yet: no label');
      await t.page.click('#screen [data-go="daily"]');
      await t.waitIdle(8000);
      await t.game('scene', 'title');
      t.equal(await cont(), 'Daily Soak in progress', 'the official run');
      t.expect(!/Practice/.test(await daily()), 'still no label while it is in progress');
      await t.page.click('#screen [data-go="continue"]');
      await t.waitIdle(8000);
      await t.page.evaluate(() => { const s = window.__G.s; s.players[0].score = 123; });
      for (let k = 0; k < 10 && !(await t.state()).game.over; k++) { await t.game('act', 'pass'); await t.waitIdle(4000); }
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 15000 });
      await t.game('scene', 'title');
      const score = await t.page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('hs-letters-daily-v1')).days)[0].first);
      t.equal(await daily(), `Daily Soak Practice replay Today: ${score} pts · streak 1`, 'played: labelled, with the official score');
      const fit = await t.page.evaluate(() => {
        const b = document.querySelector('#screen [data-go="daily"]'), g = b.querySelector('.btn-tag').getBoundingClientRect(), r = b.getBoundingClientRect(), reg = document.querySelector('#screen [data-go="register"]').getBoundingClientRect();
        return { inside: g.left >= r.left && g.right <= r.right, tall: r.height - reg.height, small: document.querySelector('#screen [data-go="daily"] small').textContent };
      });
      t.expect(fit.inside && fit.tall <= 3, `the label fits on the button\'s own line (${JSON.stringify(fit)})`);
      await t.shot('w3-b11-title-practice');
      t.equal((await t.contrastReport({ selector: '#screen [data-go="daily"] *', min: 4.5, largeMin: 4.5 })).fails.length, 0, 'contrast, Day');
      await t.page.click('#screen [data-go="daily"]');
      await t.page.click('#modal [data-ok]');
      await t.waitIdle(8000);
      await t.game('scene', 'title');
      t.equal(await cont(), 'Daily Soak practice replay in progress', 'the replay is named');
      await t.reload();
      await ready(t);
      t.equal(await cont(), 'Daily Soak practice replay in progress', 'after a reload too');
    },
  },
  {
    name: 'W5-S1-04 a saved Challenge game keeps Help\'s two-letter list and Check a word shut after a reload; an ordinary one does not',
    viewports: ['desktop'],
    initScript: instant,
    async run(t) {
      await ready(t);
      const look = async () => {
        await t.reload();
        await ready(t);
        t.equal(await t.page.evaluate(() => window.__G.s), null, 'no game in memory');
        const line = await t.page.textContent('#screen [data-go="continue"] small');
        await t.page.click('#screen [data-go="help"]');
        await t.page.fill('#wc-in', 'CAT');
        await t.page.click('[data-wordcheck] button');
        return `${/Challenge/.test(line) ? 'badge' : 'none'} ${await t.page.locator('.twos').count()} ${/word check is off/.test(await t.page.textContent('.wc-out')) ? 'shut' : 'open'}`;
      };
      await t.game('newGame', { seed: 5, challenge: true });
      await t.waitIdle(6000);
      t.equal(await look(), 'badge 0 shut', 'Challenge saved');
      await t.game('newGame', { seed: 5 });
      await t.waitIdle(6000);
      t.equal(await look(), 'none 1 open', 'an ordinary game saved');
    },
  },
];

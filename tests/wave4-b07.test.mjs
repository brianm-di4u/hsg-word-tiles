// Wave 4, batch W4-B07 (WF-2 agency funnels): W2-S1-15 (the live strip raised over a resting ledger) and W2-S3-11 (double-tap zoom on
// touch). W2-S2-13 (square tips while staging, 2140f72) and W2-S4-03 (the table's greeting, 9027d7d) were already built and keep their tests.
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, motion: 'full' }));
  }
};
const CENTER = 112;
const TWO = { seed: 3, seats: [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }] };
async function table(t, rack) {
  await t.game('newGame', TWO);
  await t.waitIdle(8000);
  await t.game('act', 'reveal');
  const g = (await t.state()).game;
  g.players[0].rack = rack.split('');
  await t.game('setState', { game: g });
  await t.waitIdle(8000);
}
const OLD = '#preview.ok { background: var(--strip) !important; box-shadow: inset 0 0 0 1.5px rgba(127, 211, 196, 0.6) !important; } #preview.ok .pts { font-weight: 600 !important; color: #F3DD8B !important; text-shadow: none !important; }';

export const tests = [
  {
    name: 'W2-S1-15 a live play sits on a raised brass-rimmed plate with brighter points, the ledger rests on quieter parchment, and nothing moves',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      const read = () => t.page.evaluate(() => {
        const p = document.querySelector('#preview'), cs = getComputedStyle(p), pts = p.querySelector('.pts'), led = getComputedStyle(document.querySelector('#ledger'));
        const box = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map((v) => Math.round(v * 10) / 10); };
        return {
          cls: p.className, bgImage: cs.backgroundImage, bgColor: cs.backgroundColor, shadow: cs.boxShadow,
          pts: pts ? { color: getComputedStyle(pts).color, weight: getComputedStyle(pts).fontWeight } : null,
          ledgerBg: led.backgroundColor, ledgerShadow: led.boxShadow,
          strip: box('#preview'), rack: box('#rackbar'), actions: box('#actions'), board: box('#boardwrap'),
        };
      });
      for (const theme of ['light', 'dark']) {
        await t.page.emulateMedia({ colorScheme: theme });
        await t.page.waitForFunction((d) => document.body.classList.contains('theme-dark') === d, theme === 'dark');
        const night = theme === 'dark';
        await table(t, 'TEAQQQQ');
        const idle = await read();
        t.equal(idle.bgImage, 'none', `${theme}: the idle strip keeps its plain smoked glass`);
        t.equal(idle.ledgerBg, night ? 'rgb(31, 28, 46)' : 'rgb(234, 226, 208)', `${theme}: the ledger rests on ${night ? 'the Night panel (its --panel-2 is lighter)' : '--panel-2 parchment'}`);
        t.expect(!/30px/.test(idle.ledgerShadow) && /inset/.test(idle.ledgerShadow), `${theme}: the ledger is recessed, not floating (${idle.ledgerShadow})`);

        await t.game('act', 'stage', [{ i: CENTER - 1, l: 'T' }, { i: CENTER, l: 'E' }, { i: CENTER + 1, l: 'A' }]);
        await t.page.waitForFunction(() => document.querySelector('#preview.ok .pts'));
        const ok = await read();
        t.expect(/linear-gradient/.test(ok.bgImage) && /0\.97/.test(ok.bgImage), `${theme}: a valid play raises the strip to a near-opaque plate (${ok.bgImage})`);
        const brass = night ? 'rgb(154, 129, 56)' : 'rgb(184, 144, 47)';
        t.expect(ok.shadow.includes(`${brass} 0px 0px 0px 1.5px inset`), `${theme}: with a brass rim (${ok.shadow})`);
        t.expect(ok.shadow.includes('rgba(127, 211, 196, 0.75) 0px 0px 0px 3px inset'), `${theme}: and the teal ring of a good word inside it`);
        t.expect(/0px 6px 14px/.test(ok.shadow), `${theme}: lifted by a drop shadow`);
        t.equal(ok.pts.color, 'rgb(255, 233, 166)', `${theme}: brighter points`);
        t.equal(ok.pts.weight, '700', `${theme}: in bold`);
        const contrast = await t.contrastReport({ selector: '#preview', min: 4.5, largeMin: 3 });
        t.equal(contrast.fails.length, 0, `${theme}: the raised strip passes contrast (${JSON.stringify(contrast.fails)})`);
        if (!night) await t.shot('w4-b07-raised-strip');
        else await t.shot('w4-b07-raised-strip-night');

        // the same staged play with the old strip: the new one moves nothing
        const style = await t.page.addStyleTag({ content: OLD });
        const old = await read();
        await style.evaluate((el) => el.remove());
        for (const k of ['strip', 'rack', 'actions', 'board']) t.equal(JSON.stringify(ok[k]), JSON.stringify(old[k]), `${theme}: ${k} where the old strip had it`);

        await t.game('act', 'recall');
        await t.game('act', 'stage', [{ i: CENTER - 1, l: 'Q' }, { i: CENTER, l: 'Q' }]);
        await t.page.waitForFunction(() => document.querySelector('#preview.bad'));
        const bad = await read();
        t.expect(/linear-gradient/.test(bad.bgImage) && bad.shadow.includes(`${brass} 0px 0px 0px 1.5px inset`) && bad.shadow.includes('rgba(255, 138, 122, 0.85) 0px 0px 0px 3px inset'), `${theme}: a refused play is on the same plate, ringed in coral (${bad.shadow})`);
        await t.game('act', 'recall');
      }
      await t.page.emulateMedia({ colorScheme: 'light' });
    },
  },
  {
    name: 'W2-S3-11 two quick taps on an empty square zoom in there and two more show the whole board; never with a tile picked or placed, nor for a mouse',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await table(t, 'SPRINGE');
      const view = async () => (await t.state()).view;
      const zoomIs = (z) => t.page.waitForFunction((z) => Math.abs(window.__game.getState().view.zoom - z) < 0.001, z, { timeout: 4000 });
      const pt = (i) => t.game('act', 'screen', i);
      if (t.viewport === 'desktop') {
        const [x, y] = await pt(CENTER);
        await t.page.mouse.dblclick(x, y);
        await t.waitIdle(3000);
        t.equal((await view()).zoom, 1, 'a mouse double-click does not zoom');
        return;
      }
      // both taps in one touch session, so they come as quickly as a thumb's
      const taps = async (a, b = a) => {
        const cdp = await t.page.context().newCDPSession(t.page);
        for (const [x, y] of [a, b]) {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }] });
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        }
        await cdp.detach();
      };
      const onBoard = (p) => t.page.evaluate(([x, y]) => { const r = document.querySelector('#board').getBoundingClientRect(); return [x - r.left, y - r.top]; }, p);
      const cell = CENTER - 3 * 15 - 4;   // an empty square up and to the left of the centre
      t.equal(await t.game('act', 'cellAt', ...(await onBoard(await pt(cell)))), cell, 'the taps land on the chosen square');
      await taps(await pt(cell));
      await zoomIs(1.7);
      const v = await view(), U = 15 + 2 * 0.38;
      t.expect(v.cx < U / 2 - 1 && v.cy < U / 2 - 1, `zoomed in toward the tapped square, up and to the left (view centre ${v.cx.toFixed(2)},${v.cy.toFixed(2)}; the board's ${(U / 2).toFixed(2)})`);
      const [x, y] = await onBoard(await pt(cell)), box = await t.page.evaluate(() => { const r = document.querySelector('#board').getBoundingClientRect(); return [r.width, r.height]; });
      t.expect(x > 0 && y > 0 && x < box[0] && y < box[1], `and the square is in view (${x.toFixed(0)},${y.toFixed(0)} in ${box[0].toFixed(0)}x${box[1].toFixed(0)})`);
      await t.page.waitForFunction(() => /zoomed to 170 percent/.test(document.querySelector('#live').textContent), null, { timeout: 3000 });
      await t.shot('w4-b07-double-tap-in');
      await taps(await pt(cell));
      await zoomIs(1);
      await t.page.waitForFunction(() => /Whole board shown/.test(document.querySelector('#live').textContent), null, { timeout: 3000 });

      // two quick taps four squares apart, and then a single tap, do not zoom
      await taps(await pt(cell), await pt(cell + 4));
      await t.waitIdle(3000);
      t.equal((await view()).zoom, 1, 'two quick taps on different squares do not zoom');
      await t.tap(await pt(cell));
      await t.waitIdle(3000);
      t.equal((await view()).zoom, 1, 'nor does a single tap');

      // a picked-up rack tile: the first tap places it, the second picks it back up; the board never zooms
      const r = await t.game('act', 'rackTile', 0);
      await t.tap([r[0], r[1]]);
      t.equal(await t.page.locator('#rack .rtile.sel').count(), 1, 'a rack tile is picked up');
      await taps(await pt(CENTER));
      await t.waitIdle(3000);
      t.equal((await view()).zoom, 1, 'a double-tap with a tile picked up does not zoom');
      await t.game('act', 'recall');

      // tiles placed: a double-tap on an empty square only says what it is
      await t.game('act', 'stage', [{ i: CENTER, l: 'S' }, { i: CENTER + 1, l: 'P' }]);
      await taps(await pt(62));   // a Warm spring, beside the square zoomed on above
      await t.waitIdle(3000);
      const s = await t.state();
      t.equal(s.view.zoom, 1, 'a double-tap while tiles are placed does not zoom');
      t.equal(s.staged.length, 2, 'and leaves the placed tiles alone');
      await t.page.waitForFunction(() => document.querySelector('#preview .sq-tip'), null, { timeout: 3000 });
    },
  },
];

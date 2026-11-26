// Wave 4, batch W4-B07 (WF-2 agency funnels): W2-S1-15 (the live strip raised over a resting ledger). W2-S2-13 (square tips while staging, 2140f72) and W2-S4-03 (the table's greeting, 9027d7d) were already built and keep their tests.
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
];

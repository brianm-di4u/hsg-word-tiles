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
];

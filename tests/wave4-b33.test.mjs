// Wave 4, follow-up W4-B33-hotfix: the winner's halo on the results settles (W3-S2-07, OQ-WF7-W4-01); an existing player's
// Ambience level starts at their Music level (W4-S5-05, OQ-WF7-W4-02); the Daily streak shows when the device's date is behind
// (OQ-WF7-W3-05); presses and the picked swap tile never move a button's own hit box (ruling 30: W5-S4-01, W5-S4-04).
import { activeStreak, streakRestReady } from '../src/js/stats.js';
import { dailyLine } from '../src/js/ui.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const full = () => { window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, motion: 'full' })); };
const SEATS = [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'hard' }];

// the person's last tile ends the game and they win: the results screen with its winner badge
async function results(t) {
  await t.seed(5);
  await t.game('newGame', { seats: SEATS });
  await t.waitIdle(8000);
  const g = (await t.state()).game;
  g.board = g.board.map(() => null);
  [...'CAT'].forEach((l, k) => { g.board[111 + k] = { l, blank: false }; });
  g.bag = []; g.move = 10; g.cur = 0;
  g.players[0].rack = ['S']; g.players[0].score = 120; g.players[1].rack = ['E', 'R']; g.players[1].score = 80;
  await t.game('setState', { game: g });
  await t.waitIdle(5000);
  await t.game('act', 'stage', [{ i: 114, l: 'S' }]);
  t.expect((await t.game('act', 'play')).ok, 'the last play');
  await t.page.waitForFunction(() => document.querySelector('#screen .over .winner .badge.mood-win'), null, { timeout: 8000 });
}

export const tests = [
  // ---------- W3-S2-07 / OQ-WF7-W4-01 ----------
  {
    name: "W3-S2-07 the winner's halo on the results swells two or three slow times and rests as a steady brass ring; in the game it still breathes",
    viewports: ['desktop', 'mobile'],
    initScript: full,
    async run(t) {
      await ready(t);
      await results(t);
      const halo = await t.page.evaluate(() => {
        const el = document.querySelector('#screen .over .winner .badge.mood-win');
        const a = el.getAnimations().find((x) => x.animationName);
        const tm = a ? a.effect.getComputedTiming() : {};
        // the same badge in the game, outside the results
        const chip = document.createElement('span'); chip.className = 'badge mood-win'; chip.style.setProperty('--s', '40px'); document.body.appendChild(chip);
        const b = chip.getAnimations().find((x) => x.animationName), btm = b ? b.effect.getComputedTiming() : {};
        chip.remove();
        return { name: a && a.animationName, iterations: tm.iterations, duration: tm.duration, fill: tm.fill, game: b && b.animationName, gameIterations: btm.iterations };
      });
      t.log(JSON.stringify(halo));
      t.expect(halo.iterations >= 2 && halo.iterations <= 3, `the results' halo pulses two or three times (${halo.iterations})`);
      t.expect(halo.duration >= 1800, `slowly (${halo.duration} ms a pulse)`);
      t.expect(halo.iterations * halo.duration <= 4500, `and has come to rest within 4.5 s (${halo.iterations * halo.duration} ms), so the results settle`);
      t.expect(halo.fill === 'none' || halo.fill === 'auto', `and leaves nothing running behind it (fill ${halo.fill})`);
      t.equal(halo.gameIterations, Infinity, `in the game the halo keeps breathing (${halo.game})`);
      // at rest: the steady ring, the same as the badge's own style, with no jump at the end of the last pulse
      const rest = await t.page.evaluate(() => {
        const box = document.querySelector('#screen .over'), el = box.querySelector('.winner .badge.mood-win');
        const a = el.getAnimations().find((x) => x.animationName), tm = a.effect.getComputedTiming();
        a.pause(); a.currentTime = tm.iterations * tm.duration - 2;   // 2 ms before the halo stops
        const end = getComputedStyle(el).boxShadow;
        box.getAnimations({ subtree: true }).forEach((x) => x.finish());
        return { end, still: getComputedStyle(el).boxShadow, left: box.getAnimations({ subtree: true }).length };
      });
      const nums = (s) => (s.match(/-?[\d.]+/g) || []).map(Number);
      const [e, s] = [nums(rest.end), nums(rest.still)];
      t.equal(rest.left, 0, 'nothing on the results is still moving');
      t.expect(e.length === s.length && e.every((v, k) => Math.abs(v - s[k]) < 0.05), `the last pulse ends on the steady ring, with no jump (${rest.end} -> ${rest.still})`);
      t.expect(/2\.5px/.test(rest.still), `a brass ring 2.5 px wide at rest (${rest.still})`);
    },
  },
  // ---------- W4-S5-05 / OQ-WF7-W4-02 ----------
  {
    name: "W4-S5-05 a settings record from before the Ambience slider starts it at that player's Music level, once; a saved Ambience level and new players are untouched",
    viewports: ['desktop'],
    initScript: () => { window.__TEST_TIPS__ = false; },
    async run(t) {
      await ready(t);
      const KEY = 'hs-letters-settings-v1';
      const cases = [
        ['wave-3 player, Music 30%', { sound: false, ai: 'instant', vol: 0.5, musicVol: 0.3, theme: 'dark', tipsSeen: true }, 0.3],
        ['wave-3 player, Music 0 (music and bed silent)', { sound: false, ai: 'instant', musicVol: 0, tipsSeen: true }, 0],
        ['wave-3 player, Music left at 100%', { sound: false, ai: 'instant', vol: 0.35, tipsSeen: true }, 1],
        ['a player who already set Ambience', { sound: false, ai: 'instant', musicVol: 0.3, ambVol: 0.8, tipsSeen: true }, 0.8],
        ['a new player', null, 1],
      ];
      for (const [who, rec, want] of cases) {
        await t.page.evaluate(([k, r]) => { localStorage.clear(); if (r) localStorage.setItem(k, JSON.stringify(r)); }, [KEY, rec]);
        await t.reload(); await ready(t);
        const got = await t.page.evaluate((k) => ({ amb: window.__G.settings.ambVol, stored: localStorage.getItem(k) }), KEY);
        t.equal(got.amb, want, `${who}: Ambience level ${want}`);
        if (rec) t.equal(got.stored, JSON.stringify(rec), `${who}: the stored record is not rewritten on load`);
        await t.game('scene', 'settings');
        t.equal(Number(await t.page.$eval('#screen [data-ambvol]', (el) => el.value)), want, `${who}: the Ambience slider shows it`);
        await t.game('scene', 'title');
      }
      // once: after the player moves Music, the saved record carries its own Ambience level and it stays where it was
      await t.page.evaluate((k) => { localStorage.clear(); localStorage.setItem(k, JSON.stringify({ sound: false, ai: 'instant', musicVol: 0.3, tipsSeen: true })); }, KEY);
      await t.reload(); await ready(t);
      await t.game('scene', 'settings');
      await t.page.$eval('#screen [data-musicvol]', (el) => { el.value = '0.9'; el.dispatchEvent(new Event('input', { bubbles: true })); });
      await t.reload(); await ready(t);
      const after = await t.page.evaluate((k) => ({ amb: window.__G.settings.ambVol, music: window.__G.settings.musicVol, stored: JSON.parse(localStorage.getItem(k)).ambVol }), KEY);
      t.expect(after.music === 0.9 && after.amb === 0.3 && after.stored === 0.3, `Music moved to 90% later: Ambience stays at 30% (${JSON.stringify(after)})`);
    },
  },
  // ---------- OQ-WF7-W3-05 ----------
  {
    name: "OQ-WF7-W3-05 activeStreak and the Title line keep the streak when the device's date is behind the last day played (Node)",
    node: true,
    async run(t) {
      t.equal(activeStreak({ streak: 4, last: '2026-12-11', rest: null }, '2026-12-10'), 4, 'one day behind: the streak shows');
      t.equal(activeStreak({ streak: 4, last: '2026-12-11', rest: '2026-12-08' }, '2026-11-20'), 4, 'three weeks behind: the streak shows');
      t.equal(streakRestReady({ streak: 4, last: '2026-12-11', rest: null }, '2026-12-10'), false, 'and no rest-day cue for it');
      t.equal(dailyLine({ streak: 4, last: '2026-12-11', rest: null, today: null, todayDate: '2026-12-10' }), '10 turns · streak 4', 'the Title line says streak 4');
      t.equal(activeStreak({ streak: 4, last: '2026-12-06', rest: null }, '2026-12-10'), 0, 'a lapsed streak still reads 0');
    },
  },
  {
    name: "OQ-WF7-W3-05 Title and Records show the Daily streak when the device's clock is a day behind the last Daily played",
    viewports: ['desktop', 'mobile'],
    initScript: () => { window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false })); },
    async run(t) {
      await t.page.clock.install({ time: new Date(2026, 11, 10, 12, 0, 0).getTime() });   // the page's today is 2026-12-10
      await t.page.evaluate(() => localStorage.setItem('hs-letters-daily-v1', JSON.stringify({ days: { '2026-12-11': { score: 214, first: 214, plays: 1 } }, streak: 4, last: '2026-12-11', rest: null })));
      await t.reload(); await ready(t);
      await t.game('scene', 'title');
      const title = (await t.page.textContent('[data-go="daily"] small')).trim();
      t.expect(/streak 4/.test(title), `the Title says streak 4 (${title})`);
      await t.game('scene', 'records');
      const rec = await t.page.evaluate(() => {
        const stats = [...document.querySelectorAll('.sheet.records .stat')];
        const get = (re) => stats.find((el) => re.test(el.textContent))?.querySelector('b')?.textContent.trim();
        return { day: get(/day streak/i), best: get(/best streak/i) };
      });
      t.equal(rec.day, '4', 'Records shows a 4-day streak');
      t.equal(rec.best, '4', 'and best streak 4');
      t.equal(JSON.parse(await t.page.evaluate(() => localStorage.getItem('hs-letters-daily-v1'))).streak, 4, 'the saved streak is untouched');
    },
  },
  // ---------- ruling 30: W5-S4-01, W5-S4-04 ----------
  {
    name: "ruling 30 a press on a segment, a tab, the breakdown button or a plain button, and picking a swap tile, never move the button's own hit box",
    viewports: ['desktop', 'mobile'],
    initScript: full,
    async run(t) {
      await ready(t);
      const geo = (sel) => t.page.$eval(sel, (el) => {
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el), kid = el.querySelector(':scope > span');
        return { x: r.left, y: r.top, w: r.width, h: r.height, tx: cs.transform, props: cs.transitionProperty, kid: kid ? getComputedStyle(kid).transform : null,
          moving: el.getAnimations().filter((a) => a.transitionProperty === 'transform').length, shadow: cs.boxShadow };
      });
      const same = (a, b) => Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5;
      const settle = (sel) => t.page.waitForFunction((s) => document.querySelector(s).getAnimations({ subtree: true }).every((a) => !(a instanceof CSSTransition)), sel, { timeout: 3000 });
      // press and hold, read at once and once every transition is over, then slide off and let go (no click)
      const press = async (sel, label, offSel = null) => {
        await t.page.locator(sel).first().scrollIntoViewIfNeeded();
        const before = await geo(sel), c = await t.page.locator(sel).first().boundingBox();
        await t.page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
        await t.page.mouse.down();
        const now = await geo(sel);
        await settle(sel);
        const held = await geo(sel);
        const o = offSel ? await t.page.locator(offSel).first().boundingBox() : null;   // let go off the button (inside a dialog: on its heading, not the scrim)
        await t.page.mouse.move(o ? o.x + o.width / 2 : 2, o ? o.y + o.height / 2 : 2);
        await t.page.mouse.up();
        t.expect(!/transform/.test(before.props), `${label}: transform is not among its own transitions (${before.props})`);
        t.expect(now.moving === 0 && held.moving === 0, `${label}: no transform transition runs on the button`);
        return { before, now, held };
      };
      // Settings segment: the label moves, the button does not
      await t.game('scene', 'settings');
      let r = await press('#screen .seg button[aria-checked="false"]', 'Settings segment');
      t.expect(same(r.before, r.now) && same(r.before, r.held) && r.held.tx === 'none', 'Settings segment: its hit box stays put');
      t.expect(!!r.held.kid && r.held.kid !== 'none', `Settings segment: its label is pressed in (${r.held.kid})`);
      // a plain button: the 1 px nudge it always had, never eased
      await t.game('scene', 'title');
      r = await press('#screen .btn:not([disabled])', 'Plain button');
      t.equal(r.held.tx, 'matrix(1, 0, 0, 1, 0, 1)', 'Plain button: the 1 px press it had before the wave');
      // Help tab
      await t.game('scene', 'help');
      r = await press('#screen .tabs button[aria-selected="false"]', 'Help tab');
      t.expect(same(r.before, r.now) && same(r.before, r.held) && r.held.tx === 'none' && !!r.held.kid && r.held.kid !== 'none', 'Help tab: its hit box stays put and its label is pressed in');
      // the breakdown button in the strip
      await t.seed(7);
      await t.game('newGame', { seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
      await t.waitIdle(6000);
      const s = await t.state();
      s.game.players[0].rack = 'STEAMRN'.split('');
      await t.game('setState', { game: s.game });
      await t.waitIdle(4000);
      await t.game('act', 'stage', [{ i: 110, l: 'S' }, { i: 111, l: 'T' }, { i: 112, l: 'E' }, { i: 113, l: 'A' }, { i: 114, l: 'M' }]);
      await t.waitFrames(2);
      r = await press('#preview .bdbtn', 'Breakdown button');
      t.expect(same(r.before, r.now) && same(r.before, r.held) && r.held.tx === 'none' && !!r.held.kid && r.held.kid !== 'none', 'Breakdown button: its hit box stays put and its label is pressed in');
      await t.game('act', 'recall');
      await t.waitIdle(4000);
      // a swap tile: pressing and picking it move nothing
      await t.game('act', 'open', 'swap');
      await t.page.waitForFunction(() => document.querySelector('#modal .stile[data-sw="0"]'), null, { timeout: 5000 });
      await t.page.evaluate(() => document.querySelector('#modal .dialog')?.getAnimations().forEach((a) => a.finish()));
      const tile = '#modal .stile[data-sw="0"]';
      r = await press(tile, 'Swap tile', '#modal h2');
      t.expect(same(r.before, r.now) && same(r.before, r.held) && r.held.tx === 'none', 'Swap tile: pressing it moves nothing');
      const off = await geo(tile);
      await t.page.click(tile);
      const on = await geo(tile);
      await settle(tile);
      const up = await geo(tile);
      t.equal(await t.page.$eval(tile, (el) => el.getAttribute('aria-pressed')), 'true', 'the tile is picked');
      t.expect(on.moving === 0 && same(off, on) && same(off, up) && up.tx === 'none', `Swap tile: picking it leaves its hit box where it was (${off.y} -> ${up.y})`);
      t.expect(up.shadow !== off.shadow && /4px/.test(up.shadow), `and it stands up on a deeper shadow (${up.shadow})`);
      await t.page.click('#modal .stile[data-sw="2"]');   // a second one picked, one left as it was, for the picture
      await settle(tile);
      if (t.viewport === 'desktop') await t.shot('w4-b33-swap-picked');
      await t.game('act', 'close');
    },
  },
];

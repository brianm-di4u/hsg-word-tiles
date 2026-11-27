// Wave 4, batch W4-B04 (WF-1 vision and pillars): W1-S4-10 and what the earlier waves left of W1-S1-01. W1-S1-02 (letter count and
// +10/+18/+30 on the Register's locked slots, under their category) was already built by cfbabc1 (tests: wave2-b03), and W1-S1-01's
// collapsed House rules by 6e9920d and 7c4489e (tests: wave2-b05, wave2-b09), its stale REPORT.md and layout.js lines by 27353a3,
// 816db57 and 3369189 (tests: wave4-b03).
import fs from 'node:fs';
import path from 'node:path';
import { ctx, root } from './lib.mjs';
import { createGame, apply } from '../src/js/engine.js';
import { dailyOpening, todaysSprings, CAT_SHORT } from '../src/js/ui.js';

const doc = (f) => fs.readFileSync(path.join(root, f), 'utf8').replace(/\s+/g, ' ');
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const KEY = 'hs-letters-settings-v1';
const quiet = () => { window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false })); };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
// the strip as a player sees it: each part of the banner whole, gone (wrapped out of the two lines) or cut
const strip = (t) => t.page.evaluate(() => {
  const p = document.querySelector('#preview'), day = p.querySelector('.day');
  const rack = document.querySelector('#rack').getBoundingClientRect().top, h = p.getBoundingClientRect().height;
  if (!day) return { day: false, text: p.textContent.trim(), rack, h };
  const box = day.getBoundingClientRect();
  const parts = [...day.children].map((c) => {
    const r = c.getBoundingClientRect(), shown = getComputedStyle(c).display !== 'none';
    const whole = shown && r.top >= box.top - 0.6 && r.bottom <= box.bottom + 0.6 && c.scrollWidth <= c.clientWidth + 1;
    const gone = !shown || r.top >= box.bottom - 0.6;
    return { text: c.textContent, cls: c.className || c.tagName, state: whole ? 'whole' : gone ? 'gone' : 'cut' };
  });
  return { day: true, title: day.querySelector('b').textContent, chips: [...day.querySelectorAll('.extra')].map((c) => c.textContent), parts, text: p.textContent.trim(), rack, h };
});
// the rack with the strip's ordinary idle line in its place
const plainRack = (t) => t.page.evaluate(() => {
  const p = document.querySelector('#preview'), html = p.innerHTML, cls = p.className;
  p.className = 'idle'; p.textContent = 'Drag tiles to the board.';
  const top = document.querySelector('#rack').getBoundingClientRect().top;
  p.className = cls; p.innerHTML = html;
  return top;
});
// Wait for async Daily par pips (#turnline .par-pip), fonts, and two consecutive frames with an unchanged #rack top
// so strip(t) and plainRack(t) compare the banner against idle on the same settled layout (never a fixed sleep).
const dailySettled = async (t) => {
  await t.waitIdle(8000);
  await t.page.waitForFunction(() => document.querySelectorAll('#turnline .par-pip').length === 2, null, { timeout: 15000 });
  await t.page.evaluate(() => document.fonts.ready);
  await t.page.evaluate(() => new Promise((res) => {
    let prev = null, stable = 0;
    const step = () => {
      const top = document.querySelector('#rack')?.getBoundingClientRect().top;
      if (prev != null && Math.abs(top - prev) < 0.01) { if (++stable >= 2) { res(); return; } }
      else stable = 0;
      prev = top;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }));
};
const kinds = (s) => [...new Set(s.featured.map((f) => f.cat))];

export const tests = [
  // ---------- W1-S4-10 ----------
  {
    name: 'W1-S4-10 Daily Turn 1 names Today\'s Springs: the kinds of the day\'s plaques, what such a word does, read out, gone after the first turn (Node parts)',
    node: true,
    async run(t) {
      const c = await ctx();
      const H = [{ kind: 'human', name: 'You' }];
      for (const date of ['2026-01-04', '2026-07-04', '2026-11-25', '2027-02-28']) {
        const s = createGame({ mode: 'daily', date, seats: H }, c.lex);
        t.expect(dailyOpening(s), `${date}: Turn 1 of a Daily`);
        const b = todaysSprings(s, c.lex, true, true), w = todaysSprings(s, c.lex, false, false), ks = kinds(s);
        t.equal(ks.length, 3, `${date}: three plaques of three kinds (engine.js pickFeatured), so one chip a plaque`);
        const chips = [...b.html.matchAll(/<span class="extra"><svg[\s\S]*?<\/svg>([^<]*)<\/span>/g)].map((m) => m[1]);
        t.equal(JSON.stringify(chips), JSON.stringify(ks.map((k) => CAT_SHORT[k])), `${date}: the plaques' kinds, in their order (${chips.join(', ')})`);
        t.expect(b.html.includes("<b>Today's Springs</b>") && w.html.includes('<b>Springs of the day</b>'), "Today's Springs on its own date, Springs of the day on another");
        t.expect(b.html.includes('Hot Springs words of these kinds clear letters.') && w.html.includes('Hot Springs words of these kinds clear plaque letters; so does covering a Bathhouse Row square.'), 'what a word of such a kind does, short on phones');
        t.equal(b.say, `Today's Springs: ${ks.map((k) => c.lex.categories[k].name).join(', ')}. Hot Springs words of these kinds clear plaque letters; so does covering a Bathhouse Row square.`, 'the live region gets the full category names');
        for (const f of s.featured) t.expect(!b.html.includes(f.word) && !b.say.includes(f.word), `${date}: a hidden word of ${f.word.length} letters stays hidden`);
      }
      const played = createGame({ mode: 'daily', date: '2026-11-25', seats: H }, c.lex);
      t.expect(apply(played, { type: 'pass' }, c).ok, 'pass');
      t.expect(!dailyOpening(played), 'gone once Turn 1 is taken');
      t.expect(!dailyOpening(createGame({ mode: 'play', seats: [...H, { kind: 'ai', persona: 'opal', level: 'easy' }], seed: 3 }, c.lex)), 'not in Play');
    },
  },
  {
    name: 'W1-S4-10 in the game: the banner in the strip on Turn 1, read out, readable, moves nothing, and gone after the first play',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { mode: 'daily' });
      await dailySettled(t);
      const s = (await t.state()).game, g = await strip(t);
      t.equal(s.daily.date, today(), 'today\'s Daily');
      t.expect(g.day && g.title === "Today's Springs", `the strip opens on Today's Springs (${g.text})`);
      t.equal(JSON.stringify(g.chips), JSON.stringify(kinds(s).map((k) => CAT_SHORT[k])), 'one chip for each kind on the plaques');
      for (const p of g.parts.slice(0, -1)) t.equal(p.state, 'whole', `${p.text}: whole`);
      t.expect(g.parts.at(-1).state !== 'cut', `where to start is whole or left out, never cut (${g.parts.at(-1).state})`);
      for (const f of s.featured) t.expect(!g.text.includes(f.word), 'no hidden word in the strip');
      const plain = await plainRack(t);
      const at = `${t.vp.width}x${t.vp.height} 100% ${s.daily.date}`;
      t.expect(Math.abs(plain - g.rack) <= 0.5, `${at}: the rack does not move for it (banner ${g.rack.toFixed(2)} px, plain ${plain.toFixed(2)} px, diff ${(plain - g.rack).toFixed(2)} px)`);
      await t.page.waitForFunction(() => /^Today's Springs: /.test(document.querySelector('#live').textContent), null, { timeout: 3000 });
      t.expect(/clear plaque letters; so does covering a Bathhouse Row square\./.test(await t.page.textContent('#live')), 'the live region reads it');
      const cr = await t.contrastReport({ selector: '#preview', min: 4.5, largeMin: 3 });
      t.equal(cr.fails.length, 0, `readable (${JSON.stringify(cr.fails)})`);
      await t.shot('w4-b04-todays-springs');
      const mv = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', mv[0].tiles);
      t.equal((await strip(t)).day, false, 'a staged play has the strip');
      await t.game('act', 'recall');
      t.equal((await strip(t)).day, true, 'and the banner is back when its tiles are');
      await t.game('act', 'stage', mv[0].tiles);
      t.equal((await t.game('act', 'play')).ok, true, 'Turn 1 played');
      await t.waitIdle(8000);
      t.equal((await strip(t)).day, false, 'Turn 2 has its own line');
      // a Turn 1 Daily of another date says so, and a game of Play has no banner
      await t.game('newGame', { mode: 'daily', date: '2026-07-04' });
      await t.waitIdle(8000);
      t.equal((await strip(t)).title, 'Springs of the day', 'another date\'s Daily');
      await t.game('newGame', { seed: 3, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
      await t.waitIdle(8000);
      t.equal((await strip(t)).day, false, 'no banner in Play');
    },
  },
  {
    name: 'W1-S4-10 on phones and short screens the banner keeps to the strip\'s two lines at 100% and 130% text: every part whole or left out, nothing moves',
    viewports: ['mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      for (const text of [1, 1.3]) {
        await t.page.evaluate(([k, v]) => { const s = JSON.parse(localStorage.getItem(k) || '{}'); localStorage.setItem(k, JSON.stringify({ ...s, text: v })); }, [KEY, text]);
        await t.reload();
        await ready(t);
        for (const [width, height] of [[320, 568], [360, 640], [390, 844], [568, 320], [844, 390]]) {
          await t.page.setViewportSize({ width, height });
          for (const date of ['2026-01-04', '2026-07-04', '2026-11-25']) {
            await t.game('newGame', { mode: 'daily', date });
            await dailySettled(t);
            const g = await strip(t), at = `${width}x${height} ${text * 100}% ${date}`;
            t.expect(g.day, `${at}: banner`);
            t.equal(g.parts.filter((p) => p.state === 'cut').map((p) => p.text).join(' | '), '', `${at}: nothing cut`);
            t.equal(g.parts[0].state, 'whole', `${at}: the title shows`);
            t.expect(g.parts.filter((p) => p.cls === 'extra').every((p) => p.state === 'whole'), `${at}: every kind shows`);
            if (text === 1 && width >= 360 && height > 520) t.equal(g.parts.find((p) => p.cls === 'said').state, 'whole', `${at}: and what such a word does`);
            const plain = await plainRack(t);
            t.expect(Math.abs(plain - g.rack) <= 0.5, `${at}: the rack does not move (banner ${g.rack.toFixed(2)} px, plain ${plain.toFixed(2)} px, diff ${(plain - g.rack).toFixed(2)} px)`);
          }
        }
      }
      await t.page.setViewportSize({ width: 390, height: 844 });
      await t.shot('w4-b04-todays-springs-130');
    },
  },
  // ---------- W1-S1-01 ----------
  {
    name: 'W1-S1-01 PRD.md records the locked target experience, the four yes-or-no pillars and the anti-goals, and says where Challenge mode and Unlimited hints live (Node)',
    node: true,
    run(t) {
      const prd = doc('PRD.md'), one = prd.split('## 1. Vision and pillars')[1].split('## 2. ')[0];
      t.expect(/### Target experience/.test(one) && /\*\*Primary: approachable, tactile crossword craft\.\*\*/.test(one) && /\*\*Secondary: discovering Hot Springs\.\*\*/.test(one), 'primary and secondary target experience');
      const pillars = one.split('### Pillars')[1].split('### Anti-goals')[0];
      t.equal((pillars.match(/\b[1-4]\. \*\*/g) || []).length, 4, 'four pillars');
      t.equal((pillars.match(/\?/g) || []).length, 4, 'each a yes-or-no question');
      const anti = one.split('### Anti-goals')[1].split('### Design principles')[0];
      t.equal((anti.match(/\b[1-4]\. Never /g) || []).length, 4, 'four anti-goals');
      t.expect(/### Design principles 1\. \*\*Our own game\.\*\*/.test(one) && /Bathhouse Barons is the quality bar/.test(one), 'the earlier five principles are kept');
      t.expect(/collapsed "House rules & more options": each computer's difficulty, Unlimited hints and Challenge mode/.test(prd), 'Setup\'s options as built');
      t.expect(/House rules &amp; more options/.test(doc('src/js/ui.js')) && /data-hints-unl/.test(doc('src/js/ui.js').split('<details class="house-rules"')[1]) && /data-challenge/.test(doc('src/js/ui.js').split('<details class="house-rules"')[1]), 'and they are inside the disclosure');
      const report = doc('REPORT.md');
      for (const stale of ['double the bonus', 'about 200 points a game', 'the help says which list is used']) t.expect(!report.includes(stale), `REPORT.md: no "${stale}"`);
      t.expect(/Turn 1 names "Today's Springs"/.test(prd), 'PRD.md names the Daily banner');
    },
  },
];

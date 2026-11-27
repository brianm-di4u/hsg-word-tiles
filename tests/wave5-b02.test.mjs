// Wave 5, batch W5-B02:
// - W6-S5-03: Landscape touchscreens (@media (pointer: coarse), width > 860 px) give .ledger-all >= 44x44 px and #turnline .bag-btn / .bag-link a >= 44 px ::after hit target without shifting layout or stealing taps.
// - W6-S6-01: sfx() skips live synthesis when the tab is hidden or AudioContext is not running, and CUE_THROTTLE_S (0.020 s) deduplicates 0 ms bursts while letting Fast-AI Lucky's 31 ms clacks play cleanly.
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, theme: 'light' }));
  }
};
const fxOnlyFast = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'fast', sound: true, fx: true, music: false, amb: false, motion: 'full' }));
  }
};

export const tests = [
  // ---------- W6-S5-03 ----------
  {
    name: 'W6-S5-03 landscape coarse-pointer touchscreens (1024x768, 1280x800, 1024x600) give .ledger-all and #turnline .bag-btn/.bag-link >= 44x44 px tap targets at 100% and 130% text without moving layout or stealing taps',
    viewports: ['mobile'], // mobile context has hasTouch: true -> Chromium matches @media (pointer: coarse)
    initScript: quiet,
    async run(t) {
      await ready(t);
      const isCoarse = await t.page.evaluate(() => matchMedia('(pointer: coarse)').matches);
      t.equal(isCoarse, true, 'mobile test context emulates (pointer: coarse)');

      const ai = (persona, level) => ({ kind: 'ai', persona, level });
      const you = { kind: 'human', name: 'You' };
      const GAMES = {
        'two players': { seed: 5, seats: [you, ai('opal', 'easy')] },
        'four players': { seed: 5, seats: [you, ai('opal', 'easy'), ai('hollis', 'medium'), ai('julian', 'hard')] },
        'final stretch': { seed: 5, seats: [you, ai('opal', 'easy')], bag: ['A', 'B', 'C'] },
        'empty bag': { seed: 5, seats: [you, ai('opal', 'easy')], bag: [] },
        'Daily Soak': { mode: 'daily', date: '2026-11-20' },
      };

      for (const text of [1, 1.3]) {
        await t.page.evaluate((v) => {
          const k = 'hs-letters-settings-v1';
          const s = JSON.parse(localStorage.getItem(k) || '{}');
          s.text = v;
          localStorage.setItem(k, JSON.stringify(s));
        }, text);
        await t.reload();
        await ready(t);

        for (const [w, h] of [[1024, 768], [1280, 800], [1024, 600]]) {
          await t.page.setViewportSize({ width: w, height: h });
          await t.waitFrames(3);

          // Confirm desktop 2-column breakpoint (> 860 px, > 520 px, aspect > 1/1) is active
          const wideCheck = await t.page.evaluate(() => ({
            narrowMedia: matchMedia('(max-width: 860px), (max-aspect-ratio: 1/1), (max-height: 520px)').matches,
            coarse: matchMedia('(pointer: coarse)').matches,
          }));
          t.equal(wideCheck.narrowMedia, false, `${w}x${h} sits outside mobile media query`);
          t.equal(wideCheck.coarse, true, `${w}x${h} matches (pointer: coarse)`);

          for (const [what, { bag, ...game }] of Object.entries(GAMES)) {
            const where = `${w}x${h} ${text * 100}% ${what}`;
            await t.game('newGame', game);
            await t.waitIdle(8000);
            if (game.mode === 'daily') {
              await t.page.waitForFunction(() => document.querySelectorAll('#turnline .par-pip').length === 2, null, { timeout: 15000 });
            }
            if (bag) {
              const g = (await t.state()).game;
              g.bag = bag;
              await t.game('setState', { game: g });
              await t.waitFrames(2);
            }

            const m = await t.page.evaluate(() => {
              const ledger = document.querySelector('#ledger');
              const lr = ledger.getBoundingClientRect();
              const allBtn = document.querySelector('#b-ledger');
              const ar = allBtn.getBoundingClientRect();
              const allCenterHit = allBtn.contains(document.elementFromPoint(ar.left + ar.width / 2, ar.top + ar.height / 2));

              const bagBtn = document.querySelector('#turnline [data-open-tracker]');
              const br = bagBtn.getBoundingClientRect();
              const cx = br.left + br.width / 2;
              const cy = br.top + br.height / 2;
              const span = (at, from, limit) => {
                let lo = from, hi = from;
                while (lo > 0 && bagBtn.contains(at(lo - 0.5))) lo -= 0.5;
                while (hi < limit && bagBtn.contains(at(hi + 0.5))) hi += 0.5;
                return [lo, hi];
              };
              const [top, low] = span((y) => document.elementFromPoint(cx, y), cy, innerHeight);
              const [left, right] = span((x) => document.elementFromPoint(x, cy), cx, innerWidth);

              const rects = () => JSON.stringify(['#topbar', '#turnline', '#scores', '#springs', '#boardwrap', '#rackbar', '#actions', '#b-menu', '#b-sound'].map((q) => {
                const b = document.querySelector(q).getBoundingClientRect();
                return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)];
              }));
              const others = () => {
                const o = {};
                for (let y = 2; y < innerHeight; y += 8) {
                  for (let x = 2; x < innerWidth; x += 8) {
                    const e = document.elementFromPoint(x, y)?.closest('button, a, input, canvas, [tabindex]');
                    if (e && e !== bagBtn) o[`${x},${y}`] = e;
                  }
                }
                return o;
              };
              const withPseudo = rects(), tapsWith = others();
              const st = document.createElement('style');
              st.textContent = '#turnline .bag-btn::after, #turnline .bag-link::after { display: none !important; }';
              document.head.append(st);
              const withoutPseudo = rects(), tapsWithout = others();
              st.remove();

              const lost = Object.keys(tapsWithout).filter((k) => tapsWith[k] !== tapsWithout[k]).map((k) => `${tapsWithout[k].id || tapsWithout[k].className}@${k}`);
              const app = document.querySelector('#app');
              const playRect = document.querySelector('#actions .abtn.play').getBoundingClientRect();
              return {
                ledgerH: +lr.height.toFixed(1),
                allW: +ar.width.toFixed(1),
                allH: +ar.height.toFixed(1),
                allCenterHit,
                bagW: +(right - left).toFixed(1),
                bagH: +(low - top).toFixed(1),
                bagTop: +top.toFixed(1),
                bagLow: +low.toFixed(1),
                bagCx: +cx.toFixed(1),
                moved: withPseudo !== withoutPseudo,
                lost,
                playBottom: +playRect.bottom.toFixed(1),
                overflowX: app.scrollWidth - app.clientWidth,
              };
            });

            t.expect(m.allW >= 44 && m.allH >= 44, `${where}: .ledger-all >= 44x44 px (${m.allW}x${m.allH})`);
            if (text === 1 || m.ledgerH >= 58) {
              t.equal(m.allCenterHit, true, `${where}: .ledger-all center is directly clickable (ledgerH=${m.ledgerH})`);
            }
            t.expect(m.bagW >= 44 && m.bagH >= 44, `${where}: #turnline bag trigger hit box >= 44x44 px (${m.bagW}x${m.bagH})`);
            t.expect(m.bagTop >= 0 && m.bagLow <= h, `${where}: #turnline bag hit box stays inside viewport (${m.bagTop}..${m.bagLow})`);
            t.equal(m.moved, false, `${where}: ::after hit target moves zero layout boxes`);
            t.equal(m.lost.join(', '), '', `${where}: ::after hit target steals zero taps from other controls`);
            t.equal(m.overflowX, 0, `${where}: zero horizontal overflow`);
            t.expect(m.playBottom <= h + 0.5, `${where}: Play button stays on screen (${m.playBottom} <= ${h})`);

            // Real taps on 1024x768 at 100% text: tap top edge of expanded bag hit box AND tap .ledger-all
            if (text === 1 && w === 1024 && h === 768 && (what === 'two players' || what === 'Daily Soak')) {
              await t.tap([m.bagCx, m.bagTop + 3]);
              await t.page.waitForFunction(() => window.__game.getState().dialog === 'tracker', null, { timeout: 5000 });
              await t.game('act', 'close');
              await t.waitFrames(2);

              const allPt = await t.page.evaluate(() => {
                const r = document.querySelector('#b-ledger').getBoundingClientRect();
                return [r.left + r.width / 2, r.top + r.height / 2];
              });
              await t.tap(allPt);
              await t.page.waitForFunction(() => window.__game.getState().dialog === 'ledger', null, { timeout: 5000 });
              await t.game('act', 'close');
              await t.waitFrames(2);

              if (what === 'two players') {
                const cDay = await t.contrastReport({ selector: '#ledger', min: 4.5, largeMin: 3 });
                t.equal(cDay.fails.length, 0, `1024x768 coarse Day #ledger contrast ok (${cDay.fails.join('; ')})`);
                await t.shot('w5-b02-1024x768-coarse-touch');
              }
            }
          }
        }
      }
    },
  },
  {
    name: 'W6-S5-03 fine-pointer desktop keeps compact 28 px .ledger-all and does not add coarse ::after on #turnline .bag-btn',
    viewports: ['desktop'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.page.setViewportSize({ width: 1024, height: 768 });
      await t.game('newGame', { seed: 5 });
      await t.waitIdle(6000);
      const info = await t.page.evaluate(() => {
        const coarse = matchMedia('(pointer: coarse)').matches;
        const allBtn = document.querySelector('#b-ledger');
        const bagBtn = document.querySelector('#turnline .bag-btn');
        return {
          coarse,
          allH: Math.round(allBtn.getBoundingClientRect().height),
          bagAfterContent: getComputedStyle(bagBtn, '::after').content,
        };
      });
      t.equal(info.coarse, false, 'desktop context is fine pointer');
      t.expect(info.allH >= 26 && info.allH < 44, `fine-pointer desktop keeps compact .ledger-all (${info.allH} px)`);
      t.equal(info.bagAfterContent, 'none', 'fine-pointer desktop does not inject coarse ::after hit box');
    },
  },

  // ---------- W6-S6-01 ----------
  {
    name: 'W6-S6-01 sfx() skips live synthesis while tab is hidden or AudioContext is not running, queues zero bursts on resume, and keeps offline renderSfx working',
    viewports: ['desktop'],
    initScript: fxOnlyFast,
    async run(t) {
      await ready(t);
      await t.page.click('#screen [data-go="setup"]');
      await t.page.waitForFunction(() => window.__game.audioState().ctx === 'running', null, { timeout: 5000 });

      const hide = (h) => t.page.evaluate((hidden) => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
        document.dispatchEvent(new Event('visibilitychange'));
      }, h);

      // Install live node-start spies (music & amb are off so only sfx() creates nodes)
      // ...and the live context plus its clock at the first yourturn, so step 5 can wait for the audio clock (see there)
      await t.page.evaluate(() => {
        window.__sfxSpies = { osc: 0, buf: 0, ctx: null, firstAt: null };
        const origOsc = OscillatorNode.prototype.start;
        const origBuf = AudioBufferSourceNode.prototype.start;
        OscillatorNode.prototype.start = function (...a) {
          window.__sfxSpies.osc++;
          if (!window.__sfxSpies.ctx && !(this.context instanceof OfflineAudioContext)) { window.__sfxSpies.ctx = this.context; window.__sfxSpies.firstAt = this.context.currentTime; }
          return origOsc.apply(this, a);
        };
        AudioBufferSourceNode.prototype.start = function (...a) { window.__sfxSpies.buf++; return origBuf.apply(this, a); };
      });

      // 1) Visible & running -> live sfx synthesizes nodes normally
      await t.page.evaluate(() => { window.__sfxSpies.osc = 0; window.__sfxSpies.buf = 0; window.__game.act('sfx', 'yourturn'); });
      const visibleCount = await t.page.evaluate(() => ({ ...window.__sfxSpies }));
      t.expect(visibleCount.osc > 0, `visible running AudioContext synthesizes yourturn (${visibleCount.osc} osc)`);

      // 2) Tab hidden -> pauseAudio() adds 'hidden' hold & suspends AudioContext; sfx() schedules 0 live nodes
      await hide(true);
      await t.page.waitForFunction(() => {
        const a = window.__game.audioState();
        return a.holds.includes('hidden') && a.ctx === 'suspended';
      }, null, { timeout: 5000 });

      const hiddenRes = await t.page.evaluate(() => {
        window.__sfxSpies.osc = 0;
        window.__sfxSpies.buf = 0;
        const supBefore = window.__game.audioState().suppressed;
        window.__game.act('sfx', 'yourturn');
        window.__game.act('sfx', 'fanfare');
        window.__game.act('sfx', 'place');
        return {
          osc: window.__sfxSpies.osc,
          buf: window.__sfxSpies.buf,
          supDelta: window.__game.audioState().suppressed - supBefore,
        };
      });
      t.equal(hiddenRes.osc, 0, 'hidden/suspended AudioContext schedules 0 oscillators');
      t.equal(hiddenRes.buf, 0, 'hidden/suspended AudioContext schedules 0 buffer sources');
      t.equal(hiddenRes.supDelta, 3, 'all 3 hidden-tab live cues were suppressed');

      // 3) Offline renderSfx still works cleanly even while the live tab is hidden
      const off = await t.game('act', 'renderSfx', 'place', 0.35);
      t.expect(off.peak > 0.1, `offline renderSfx unaffected by hidden live tab (peak=${off.peak})`);

      // 4) Non-running state guard ('interrupted' without 'hidden' hold) also suppresses live synthesis
      const intRes = await t.page.evaluate(() => {
        const stateDesc = Object.getOwnPropertyDescriptor(BaseAudioContext.prototype, 'state');
        Object.defineProperty(BaseAudioContext.prototype, 'state', { configurable: true, get: () => 'interrupted' });
        window.__sfxSpies.osc = 0;
        window.__sfxSpies.buf = 0;
        const supBefore = window.__game.audioState().suppressed;
        try {
          window.__game.act('sfx', 'good');
          return {
            osc: window.__sfxSpies.osc,
            buf: window.__sfxSpies.buf,
            supDelta: window.__game.audioState().suppressed - supBefore,
          };
        } finally {
          if (stateDesc) Object.defineProperty(BaseAudioContext.prototype, 'state', stateDesc);
        }
      });
      t.equal(intRes.osc, 0, 'interrupted AudioContext schedules 0 oscillators');
      t.equal(intRes.buf, 0, 'interrupted AudioContext schedules 0 buffer sources');
      t.equal(intRes.supDelta, 1, 'interrupted AudioContext increments suppressed count');

      // 5) Tab visible again -> resumes cleanly with 0 burst nodes, and subsequent live sfx synthesizes again
      await t.page.evaluate(() => { window.__sfxSpies.osc = 0; window.__sfxSpies.buf = 0; });
      await hide(false);
      await t.page.waitForFunction(() => {
        const a = window.__game.audioState();
        return !a.holds.includes('hidden') && a.ctx === 'running';
      }, null, { timeout: 5000 });
      const afterResume = await t.page.evaluate(() => ({ ...window.__sfxSpies }));
      t.equal(afterResume.osc, 0, 'resuming tab fires 0 queued stale oscillators');
      t.equal(afterResume.buf, 0, 'resuming tab fires 0 queued stale buffer sources');

      // W5-B05-hotfix follow-up 2: the suspended context's clock stood still while hidden, so step 1's yourturn can be less than
      // CUE_THROTTLE_S (0.020 s) of audio time behind this one and be throttled as a duplicate. Wait for that state (the live
      // audio clock past step 1's time plus the throttle window), never for wall time; the throttle itself is unchanged.
      const spy = await t.page.evaluate(() => ({ live: !!window.__sfxSpies.ctx, firstAt: window.__sfxSpies.firstAt }));
      t.expect(spy.live && spy.firstAt != null, `step 1's live yourturn and its audio time were recorded (${spy.firstAt})`);
      await t.page.waitForFunction(() => window.__sfxSpies.ctx.currentTime >= window.__sfxSpies.firstAt + 0.020 + 0.005, null, { timeout: 5000 });
      const resumedPlay = await t.page.evaluate(() => {
        window.__sfxSpies.osc = 0;
        const thrBefore = window.__game.audioState().throttled;
        window.__game.act('sfx', 'yourturn');
        return { osc: window.__sfxSpies.osc, thrDelta: window.__game.audioState().throttled - thrBefore };
      });
      t.equal(resumedPlay.thrDelta, 0, 'the yourturn after resume is not taken for a duplicate of step 1\'s');
      t.expect(resumedPlay.osc > 0, `live sfx synthesizes normally after resume (${resumedPlay.osc} osc)`);

      await t.page.evaluate(() => { delete document.hidden; });
    },
  },
  {
    name: 'W6-S6-01 CUE_THROTTLE_S (0.020 s) deduplicates 0-10 ms bursts while Fast-AI Lucky plays every 31 ms tile contact clack cleanly and stays unclipped at full volume',
    viewports: ['desktop'],
    url: 'index.html?gl=0',
    initScript: fxOnlyFast,
    async run(t) {
      await ready(t);
      await t.page.click('#screen [data-go="setup"]');
      await t.page.waitForFunction(() => window.__game.audioState().ctx === 'running', null, { timeout: 5000 });

      // 1) Direct throttle check: 0 ms & 10 ms deduplicate; 31 ms (Lucky Fast) & +36 ms (Julian Fast) play cleanly
      const direct = await t.page.evaluate(() => {
        let bufs = 0;
        const origBuf = AudioBufferSourceNode.prototype.start;
        AudioBufferSourceNode.prototype.start = function (...a) { bufs++; return origBuf.apply(this, a); };
        try {
          const tBefore = window.__game.audioState().throttled;
          window.__game.act('sfx', 'place', { delay: 0 });
          const b1 = bufs;
          window.__game.act('sfx', 'place', { delay: 0 });     // 0 ms batch duplicate -> throttled
          const b2 = bufs;
          window.__game.act('sfx', 'place', { delay: 0.010 }); // 10 ms -> throttled (< 0.020 s)
          const b3 = bufs;
          window.__game.act('sfx', 'place', { delay: 0.031 }); // Lucky Fast 31 ms -> allowed
          const b4 = bufs;
          window.__game.act('sfx', 'place', { delay: 0.067 }); // Julian Fast +36 ms -> allowed
          const b5 = bufs;
          return {
            d1: b1,
            d2: b2 - b1,
            d3: b3 - b2,
            d4: b4 - b3,
            d5: b5 - b4,
            throttledDelta: window.__game.audioState().throttled - tBefore,
          };
        } finally {
          AudioBufferSourceNode.prototype.start = origBuf;
        }
      });
      t.equal(direct.d1, 1, 'first place clack synthesized');
      t.equal(direct.d2, 0, '0 ms duplicate place clack deduplicated');
      t.equal(direct.d3, 0, '10 ms place clack deduplicated (< 0.020 s)');
      t.equal(direct.d4, 1, '31 ms Lucky Fast place clack played cleanly');
      t.equal(direct.d5, 1, '+36 ms Julian Fast place clack played cleanly');
      t.equal(direct.throttledDelta, 2, 'only the 0 ms and 10 ms calls incremented throttled');

      // 2) Live Fast-AI Lucky gameplay: every placed tile synthesizes a real ceramic clack with 0 throttled
      await t.seed(5);
      await t.game('newGame', { seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'lucky', level: 'hard' }] });
      await t.waitIdle(8000);
      const st = await t.state();
      st.game.players[1].rack = 'SPRINGX'.split('');
      await t.game('setState', { game: st.game });
      await t.waitIdle(5000);

      const liveStart = await t.page.evaluate(() => {
        window.__luckyBufs = 0;
        const origBuf = AudioBufferSourceNode.prototype.start;
        window.__origBufStart = origBuf;
        AudioBufferSourceNode.prototype.start = function (...a) { window.__luckyBufs++; return origBuf.apply(this, a); };
        const a = window.__game.audioState();
        return { total: a.total, throttled: a.throttled };
      });

      await t.game('act', 'pass');
      await t.page.waitForFunction((n) => {
        const a = window.__game.audioState();
        const delta = a.played.slice(a.played.length - (a.total - n));
        return a.total > n && delta.includes('yourturn');
      }, liveStart.total, { timeout: 12000 });

      const liveEnd = await t.page.evaluate((start) => {
        AudioBufferSourceNode.prototype.start = window.__origBufStart;
        const a = window.__game.audioState();
        const entry = window.__G.s.log[window.__G.s.log.length - 1];
        const delta = a.played.slice(a.played.length - (a.total - start.total));
        return {
          tiles: entry.tiles ? entry.tiles.length : 0,
          places: delta.filter((x) => x === 'place').length,
          throttledDelta: a.throttled - start.throttled,
          bufs: window.__luckyBufs,
          delta,
        };
      }, liveStart);
      t.expect(liveEnd.tiles >= 5, `Fast-AI Lucky played a multi-tile word (${liveEnd.tiles} tiles)`);
      t.equal(liveEnd.places, liveEnd.tiles, `Fast-AI Lucky emitted 1 place cue per tile (${liveEnd.places}/${liveEnd.tiles})`);
      t.equal(liveEnd.throttledDelta, 0, `Fast-AI Lucky dropped 0 contact clacks to CUE_THROTTLE_S (throttledDelta=${liveEnd.throttledDelta})`);
      t.expect(liveEnd.bufs >= liveEnd.tiles, `Fast-AI Lucky synthesized real ceramic noise buffers for every tile (${liveEnd.bufs} >= ${liveEnd.tiles})`);

      // 3) Full-volume headroom: 5-tile Lucky Fast-AI 31 ms clack cascade never clips (< 0.95 prePeak)
      const cascade = await t.game('act', 'renderSfx', 'place+place@0.031+place@0.062+place@0.093+place@0.124', 1.0);
      t.log(`Lucky Fast 31 ms cascade @ full vol: peak=${cascade.peak}, prePeak=${cascade.prePeak}`);
      t.expect(cascade.prePeak < 0.95 && cascade.peak <= 0.95, `Fast-AI 31 ms clack cascade stays unclipped at full volume (prePeak=${cascade.prePeak}, peak=${cascade.peak})`);
    },
  },
];

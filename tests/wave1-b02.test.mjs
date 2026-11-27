// Wave 1, batch W1-B02: W6-P-N01 (endgame persistence ahead of save deletion) and W6-S6-02 (CD-WF0-01 zero-write boot + idle music scheduler pause).
import fs from 'node:fs';
import path from 'node:path';
import { root } from './lib.mjs';
import { makeAudioKit, SCORES, SCENES } from '../src/js/music.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const SAVE = 'hs-letters-save-v1', STATS = 'hs-letters-stats-v1', DAILY = 'hs-letters-daily-v1';
const ls = (t, k) => t.page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), k);
const earned = JSON.parse(fs.readFileSync(path.join(root, 'test-fixtures/save-v1-earned-play.json'), 'utf8'));
const NEWER_SAVE_OBJ = { ...earned, v: 2, futureField: { a: [1, 2, 3] } };

const spyNewerSave = new Function(`
  window.__TEST_TIPS__ = false;
  const origGet = Storage.prototype.getItem;
  const origSet = Storage.prototype.setItem;
  const origRem = Storage.prototype.removeItem;
  const origClr = Storage.prototype.clear;
  if (!origGet.call(localStorage, 'hs-letters-save-v1')) {
    origSet.call(localStorage, 'hs-letters-save-v1', ${JSON.stringify(JSON.stringify(NEWER_SAVE_OBJ))});
    origSet.call(localStorage, 'hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, theme: 'light' }));
    origSet.call(localStorage, 'hs-letters-register-v1', JSON.stringify({ SPRING: { id: 'x', first: '2026-01-01', count: 2, best: 40 } }));
    origSet.call(localStorage, 'hs-letters-daily-v1', JSON.stringify({ days: { '2026-11-01': { score: 100, plays: 1 } }, streak: 2, last: '2026-11-01' }));
    origSet.call(localStorage, 'hs-letters-stats-v1', JSON.stringify({ games: 3, wins: 2 }));
  }
  window.__lsWrites = [];
  Storage.prototype.setItem = function (k, v) {
    if (this === window.localStorage) window.__lsWrites.push(['set', String(k)]);
    return origSet.call(this, k, v);
  };
  Storage.prototype.removeItem = function (k) {
    if (this === window.localStorage) window.__lsWrites.push(['remove', String(k)]);
    return origRem.call(this, k);
  };
  Storage.prototype.clear = function () {
    if (this === window.localStorage) window.__lsWrites.push(['clear', '']);
    return origClr.call(this);
  };
`);

const spyWriteBlocked = () => {
  window.__TEST_TIPS__ = false;
  Storage.prototype.setItem = function () { throw new Error('QuotaExceededError'); };
};

const spyNormal = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'normal', sound: false }));
  }
  window.__lsOps = [];
  const origSet = Storage.prototype.setItem;
  const origRem = Storage.prototype.removeItem;
  Storage.prototype.setItem = function (k, v) {
    if (this === window.localStorage) window.__lsOps.push(['set', String(k)]);
    return origSet.call(this, k, v);
  };
  Storage.prototype.removeItem = function (k) {
    if (this === window.localStorage) window.__lsOps.push(['remove', String(k)]);
    return origRem.call(this, k);
  };
};

async function freezeClock(t) { await t.page.clock.install(); await t.reload(); await ready(t); }
async function stopClock(t) { const now = await t.page.evaluate(() => Date.now()); await t.page.clock.pauseAt(now + 500); }

export const tests = [
  {
    name: 'W6-P-N01 Play endgame writes Records synchronously before deleting save and survives immediate exit',
    viewports: ['desktop'],
    initScript: spyNormal,
    async run(t) {
      await ready(t);
      await freezeClock(t);
      await t.seed(5);
      await t.game('newGame', { seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
      await t.waitIdle(8000);
      // Set up a 1-tile go-out state: CAT on row 7 cols 6-8 (111-113), empty bag, human holds S to play CATS at 114
      const st = await t.state();
      const g = st.game;
      g.board = Array(225).fill(null);
      g.board[111] = { l: 'C', blank: false };
      g.board[112] = { l: 'A', blank: false };
      g.board[113] = { l: 'T', blank: false };
      g.bag = [];
      g.move = 10;
      g.cur = 0;
      g.players[0].rack = ['S'];
      g.players[0].score = 120;
      g.players[1].rack = ['E', 'R'];
      g.players[1].score = 80;
      await t.game('setState', { game: g });
      await t.waitIdle(5000);
      await stopClock(t);
      await t.page.evaluate(() => { window.__lsOps.length = 0; });

      t.expect((await t.game('act', 'stage', [{ i: 114, l: 'S' }])).ok, 'final S staged at 114');
      t.expect((await t.game('act', 'play')).ok, 'final winning play applied');

      // At t=0 (clock paused; G.turnWait and finishGame have not fired yet):
      const after = await t.state();
      t.equal(after.game.over, true, 'game is over immediately after final play');
      const ops = await t.page.evaluate(() => window.__lsOps.slice());
      const statsIdx = ops.findIndex(([op, k]) => op === 'set' && k === STATS);
      const delIdx = ops.findIndex(([op, k]) => op === 'remove' && k === SAVE);
      t.expect(statsIdx >= 0, 'hs-letters-stats-v1 was written synchronously in afterAction (' + JSON.stringify(ops) + ')');
      t.expect(delIdx >= 0, 'hs-letters-save-v1 was retired in afterAction (' + JSON.stringify(ops) + ')');
      t.expect(statsIdx < delIdx, 'Records written BEFORE save deleted (stats@' + statsIdx + ' < del@' + delIdx + ')');

      const recNow = await ls(t, STATS);
      t.equal(recNow.games, 1, 'Records already counts the finished game before turnWait expires');
      t.equal(recNow.wins, 1, 'win already recorded');
      t.equal(recNow.bestScore, after.game.players[0].score, 'final score already persisted');
      t.equal(await ls(t, SAVE), null, 'save slot is retired');

      // Immediately leave via Pause -> Save and quit to title BEFORE G.turnWait fires
      await t.page.click('#b-menu');
      await t.page.click('#modal [data-go="title"]');
      const left = await t.state();
      t.equal(left.scene, 'title', 'exited cleanly to title');
      t.equal(left.dialog, null, 'no spurious unsaved-game confirmation');

      // Advance clock past G.turnWait and the 900 ms overTimer
      await t.page.clock.runFor(3000);
      t.equal((await t.state()).scene, 'title', 'stays on title and is not hijacked back to over');
      t.equal((await ls(t, STATS)).games, 1, 'finished game counted exactly once');

      // Survives reload
      await t.page.clock.resume();
      await t.reload();
      await ready(t);
      const recReload = await ls(t, STATS);
      t.equal(recReload.games, 1, 'Records survives reload after immediate endgame exit');
      t.equal(recReload.bestScore, after.game.players[0].score, 'score survives reload');
    },
  },
  {
    name: 'W6-P-N01 Daily Soak Turn-10 writes Daily and Records synchronously before deleting save and survives immediate exit',
    viewports: ['desktop'],
    initScript: spyNormal,
    async run(t) {
      await ready(t);
      await freezeClock(t);
      const date = '2026-11-20';
      await t.game('newGame', { mode: 'daily', date });
      await t.page.waitForFunction(() => window.__game.getState().scene === 'game', null, { timeout: 8000 });
      await t.waitIdle(5000);

      // Jump to the final turn (turns === 1) so the next legal move finishes the Daily Soak
      const st = await t.state();
      st.game.daily.turns = 1;
      await t.game('setState', { game: st.game });
      await t.waitIdle(5000);
      const [m] = await t.game('act', 'moves', 1);
      t.expect(!!m, 'found a legal Turn-10 move');

      await stopClock(t);
      await t.page.evaluate(() => { window.__lsOps.length = 0; });

      t.expect((await t.game('act', 'stage', m.tiles)).ok, 'Turn-10 move staged');
      t.expect((await t.game('act', 'play')).ok, 'Turn-10 move played');

      const after = await t.state();
      t.equal(after.game.over, true, 'Daily Soak is over immediately');
      const ops = await t.page.evaluate(() => window.__lsOps.slice());
      const dailyIdx = ops.findIndex(([op, k]) => op === 'set' && k === DAILY);
      const statsIdx = ops.findIndex(([op, k]) => op === 'set' && k === STATS);
      const delIdx = ops.findIndex(([op, k]) => op === 'remove' && k === SAVE);
      t.expect(dailyIdx >= 0 && statsIdx >= 0 && delIdx >= 0, 'Daily, Stats, and save removal all ran synchronously (' + JSON.stringify(ops) + ')');
      t.expect(dailyIdx < delIdx && statsIdx < delIdx, 'Daily and Stats written BEFORE save deleted (' + dailyIdx + ', ' + statsIdx + ' < ' + delIdx + ')');

      const dNow = await ls(t, DAILY);
      const sNow = await ls(t, STATS);
      t.equal(dNow.days[date].score, after.game.players[0].score, 'Daily score already persisted');
      t.equal(dNow.days[date].plays, 1, 'Daily play count is 1');
      t.equal(dNow.streak, 1, 'Daily streak already persisted');
      t.equal(sNow.daily.games, 1, 'Records daily.games already persisted');
      t.equal(sNow.daily.best, after.game.players[0].score, 'Records daily.best already persisted');
      t.equal(await ls(t, SAVE), null, 'save slot is retired');

      // Exit immediately before G.turnWait fires
      await t.page.click('#b-menu');
      await t.page.click('#modal [data-go="title"]');
      t.equal((await t.state()).scene, 'title', 'exited cleanly to title');

      await t.page.clock.runFor(3000);
      t.equal((await t.state()).scene, 'title', 'stays on title after timers elapse');
      t.equal((await ls(t, DAILY)).days[date].plays, 1, 'Daily counted exactly once');
      t.equal((await ls(t, STATS)).daily.games, 1, 'Records daily.games counted exactly once');

      await t.page.clock.resume();
      await t.reload();
      await ready(t);
      t.equal((await ls(t, DAILY)).days[date].score, after.game.players[0].score, 'Daily score survives reload');
    },
  },
  {
    name: 'W6-S6-02 v=2 save triggers ZERO localStorage setItem/removeItem/clear calls across boot and full visit',
    viewports: ['desktop'],
    initScript: spyNewerSave,
    async run(t) {
      await ready(t);
      const bootWrites = await t.page.evaluate(() => window.__lsWrites.slice());
      t.equal(bootWrites.length, 0, 'zero localStorage writes/removes during boot with v=2 save (' + JSON.stringify(bootWrites) + ')');
      const flags = await t.page.evaluate(() => ({ newerSave: window.__G.newerSave, noSave: window.__G.noSave }));
      t.equal(flags.newerSave, true, 'G.newerSave is true');
      t.equal(flags.noSave, false, 'G.noSave is false when newer save is detected');
      const note = await t.page.textContent('.storage-note');
      t.expect(/newer version of Bathhouse Letters/.test(note), 'title shows the newer-version notice');

      // Exercise settings, game start, play, and reload
      await t.game('scene', 'settings');
      await t.page.click('[data-set="theme"][data-val="dark"]');
      await t.game('newGame', { seed: 5 });
      await t.waitIdle(8000);
      const [m] = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', m.tiles);
      t.expect((await t.game('act', 'play')).ok, 'played a move in frozen session');
      await t.waitIdle(8000);

      const visitWrites = await t.page.evaluate(() => window.__lsWrites.slice());
      t.equal(visitWrites.length, 0, 'zero localStorage writes/removes across entire v=2 visit (' + JSON.stringify(visitWrites) + ')');

      await t.reload();
      await ready(t);
      const reloadWrites = await t.page.evaluate(() => window.__lsWrites.slice());
      t.equal(reloadWrites.length, 0, 'zero localStorage writes/removes on reload (' + JSON.stringify(reloadWrites) + ')');
    },
  },
  {
    name: 'W6-S6-02 write-blocked storage with no newer save still sets G.noSave via storageBlocked()',
    viewports: ['desktop'],
    initScript: spyWriteBlocked,
    async run(t) {
      await ready(t);
      const flags = await t.page.evaluate(() => ({ newerSave: window.__G.newerSave, noSave: window.__G.noSave }));
      t.equal(flags.newerSave, false, 'G.newerSave is false');
      t.equal(flags.noSave, true, 'G.noSave is true when setItem throws');
      t.expect(/progress will not be kept/.test(await t.page.textContent('.storage-note')), 'title shows blocked-storage notice');
    },
  },
  {
    name: 'W6-S6-02 40 Hz music scheduler pauses when held or muted and resumes cleanly',
    viewports: ['desktop'],
    async run(t) {
      await ready(t);
      await t.page.click('#screen [data-go="setup"]');
      await t.page.waitForFunction(() => window.__game.audioState().ctx === 'running', null, { timeout: 8000 });
      t.equal((await t.game('audioState')).ticking, true, 'scheduler ticks while lobby music and ambience play');

      // Hold under Pause dialog
      await t.game('newGame', { seed: 6 });
      await t.waitIdle(5000);
      t.equal((await t.game('audioState')).ticking, true, 'scheduler ticks during gameplay');
      await t.page.click('#b-menu');
      let a = await t.game('audioState');
      t.equal(a.held, true, 'held under pause card');
      t.equal(a.ticking, false, '40 Hz scheduler paused while held');
      await t.page.click('#modal [data-close]');
      a = await t.game('audioState');
      t.equal(a.held, false, 'released after closing pause');
      t.equal(a.ticking, true, 'scheduler resumes after release');

      // Mute music + ambience individually, then master Sound switch
      await t.game('scene', 'settings');
      await t.page.click('[data-set="music"][data-val="false"]');
      t.equal((await t.game('audioState')).ticking, true, 'still ticks while ambience is on');
      await t.page.click('[data-set="amb"][data-val="false"]');
      t.equal((await t.game('audioState')).ticking, false, 'scheduler paused when both music and ambience are off');
      await t.page.click('[data-set="music"][data-val="true"]');
      t.equal((await t.game('audioState')).ticking, true, 'scheduler resumes when music is turned back on');
      await t.page.click('[data-set="sound"][data-val="false"]');
      t.equal((await t.game('audioState')).ticking, false, 'scheduler paused when master Sound is off');
      await t.page.click('[data-set="sound"][data-val="true"]');
      t.equal((await t.game('audioState')).ticking, true, 'scheduler resumes when master Sound is turned back on');
    },
  },
  {
    name: 'W6-S6-02 makeAudioKit pauses its interval timer when held or idle and cleans retired nodes (Node)',
    node: true,
    async run(t) {
      const param = () => ({ value: 0, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
      const node = () => ({ gain: param(), frequency: param(), Q: param(), detune: param(), pan: param(), delayTime: param(), type: '', connect(d) { return d; }, disconnect() {}, start() {}, stop() {} });
      const ctx = {
        sampleRate: 22050, state: 'running', currentTime: 0,
        createGain: node, createBiquadFilter: node, createOscillator: node, createDelay: node, createStereoPanner: node,
        createBuffer: (_, len) => ({ getChannelData: () => new Float32Array(len) }),
        createBufferSource: node,
      };
      const origSetI = globalThis.setInterval, origClrI = globalThis.clearInterval;
      const active = new Set(); let nextId = 1;
      globalThis.setInterval = (fn, ms) => { const id = nextId++; active.add(id); return id; };
      globalThis.clearInterval = (id) => { active.delete(id); };
      try {
        const kit = makeAudioKit(ctx, node(), { seed: 1 });
        kit.start();
        t.equal(active.size, 0, 'idle kit with no score or scene allocates 0 interval timers');
        t.equal(kit.ticking, false, 'idle kit ticking is false');
        kit.music.play(SCORES.lobby, { at: 0, fade: 0.05 });
        t.equal(active.size, 1, 'playing a score starts 1 interval timer');
        t.equal(kit.ticking, true, 'playing a score sets ticking true');
        kit.hold();
        t.equal(active.size, 0, 'hold() clears the 40 Hz interval timer');
        t.equal(kit.ticking, false, 'hold() sets ticking false');
        kit.release();
        t.equal(active.size, 1, 'release() restarts the interval timer');
        t.equal(kit.ticking, true, 'release() sets ticking true');
        kit.amb.play(SCENES.bathhouse, { at: 0, fade: 0.05 });
        kit.music.stop(0.05);
        t.equal(active.size, 1, 'stopping music keeps timer while ambience is active');
        kit.amb.stop(0.05);
        t.equal(active.size, 0, 'stopping both music and ambience clears the 40 Hz interval');
        t.equal(kit.ticking, false, 'stopping both sets ticking false');
        kit.stop();
        t.equal(active.size, 0, 'stop() keeps 0 interval timers');
      } finally {
        globalThis.setInterval = origSetI;
        globalThis.clearInterval = origClrI;
      }
    },
  },
];

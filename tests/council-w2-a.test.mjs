// Wave 2, batch A: S5-01 (music and ambience) and S5-03 (cue variation).
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const BPM = { lobby: 62, table: 72, finale: 84 };   // the bar is four beats
const settingsKey = 'hs-letters-settings-v1';
const stored = (t) => t.page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), settingsKey);
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const hide = (t, hidden) => t.page.evaluate((h) => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); document.dispatchEvent(new Event('visibilitychange')); }, hidden);

export const tests = [
  {
    name: 'S5-01 the game lists its tunes and its bed',
    viewports: ['desktop'],
    async run(t) {
      await ready(t);
      const l = await t.game('audioList');
      t.equal(JSON.stringify(l.music), JSON.stringify(['lobby', 'table', 'finale']), 'three tunes: the lobby, the table and the results');
      t.equal(JSON.stringify(l.ambience), JSON.stringify(['bathhouse']), 'one bed');
    },
  },
  {
    name: 'S5-01 every tune renders 60 s inside the mix limits with form and variation',
    viewports: ['desktop'],
    async run(t) {
      await ready(t);
      const rows = [];
      for (const name of (await t.game('audioList')).music) {
        const r = await t.game('audioRender', name, 60);
        const formSeconds = r.built.formBars * 4 * 60 / BPM[name];
        rows.push(`${name}: peak ${r.peak}, rms ${r.rmsDb} dB, form ${formSeconds.toFixed(0)} s, ${r.built.distinctBars} distinct bars, ${r.built.pitches} pitches, silence ${r.longestSilence} s`);
        t.expect(r.peak >= 0.06 && r.peak <= 0.16, `${name} peaks between 0.06 and 0.16 (${r.peak})`);
        t.expect(r.rmsDb >= -40 && r.rmsDb <= -28, `${name} RMS between -40 and -28 dBFS (${r.rmsDb})`);
        t.expect(formSeconds >= 45, `${name} runs at least 45 s before it repeats (${formSeconds.toFixed(1)} s)`);
        t.expect(r.built.distinctBars >= 6, `${name} has at least 6 distinct bars (${r.built.distinctBars})`);
        t.expect(r.built.pitches >= 6, `${name} uses at least 6 pitches (${r.built.pitches})`);
        t.expect(r.longestSilence <= 2, `${name} has no silence over 2 s (${r.longestSilence})`);
      }
      t.log(rows.join(' | '));
    },
  },
  {
    name: 'S5-01 the bathhouse bed renders 30 s quietly with no silent stretch',
    viewports: ['desktop'],
    async run(t) {
      await ready(t);
      const r = await t.game('audioRender', 'bathhouse', 30);
      t.log(`bathhouse: peak ${r.peak}, rms ${r.rmsDb} dB, silence ${r.longestSilence} s`);
      t.expect(r.peak < 0.07, `the bed peaks under 0.07 (${r.peak})`);
      t.expect(r.rmsDb >= -52 && r.rmsDb <= -38, `the bed RMS is between -52 and -38 dBFS (${r.rmsDb})`);
      t.expect(r.longestSilence <= 2, `no silent stretch (${r.longestSilence} s)`);
      const music = await t.game('audioRender', 'table', 30);
      t.expect(r.rms < music.rms, 'the bed sits under the music');
    },
  },
  {
    name: 'S5-03 tile sounds peak between 0.2 and 0.45 and tune, bed and loudest cue together never clip',
    viewports: ['desktop'],
    async run(t) {
      await ready(t);
      const peaks = {};
      for (const n of ['place', 'play', 'pick', 'recall', 'turn', 'swap', 'error', 'steam', 'chime', 'featured', 'fanfare']) {
        peaks[n] = [];
        for (let k = 0; k < 6; k++) peaks[n].push((await t.game('act', 'renderSfx', n, 0.35)).peak);
      }
      t.log(Object.entries(peaks).map(([n, p]) => `${n} ${Math.min(...p)}..${Math.max(...p)}`).join(', '));
      for (const n of ['place', 'play', 'pick', 'recall', 'turn', 'swap']) {
        t.expect(Math.min(...peaks[n]) >= 0.2 && Math.max(...peaks[n]) <= 0.45, `${n} stays between 0.2 and 0.45 (${Math.min(...peaks[n])}..${Math.max(...peaks[n])})`);
      }
      for (const n of Object.keys(peaks)) t.expect(Math.max(...peaks[n]) <= 0.45, `${n} stays under 0.45 (${Math.max(...peaks[n])})`);
      const loudest = Math.max(...Object.values(peaks).map((p) => Math.max(...p)));
      const bed = (await t.game('audioRender', 'bathhouse', 30)).peak;
      for (const n of ['lobby', 'table', 'finale']) {
        const m = (await t.game('audioRender', n, 60)).peak;
        t.expect(m + bed + loudest < 0.95, `${n} + bed + loudest cue stays under 0.95 (${(m + bed + loudest).toFixed(2)})`);
      }
    },
  },
  {
    name: 'S5-03 no two tile sounds are alike and a word climbs in pitch',
    viewports: ['desktop'],
    async run(t) {
      await ready(t);
      const flat = [], high = [];
      for (let k = 0; k < 30; k++) { flat.push(await t.game('act', 'renderSfx', 'place', 0.35)); high.push(await t.game('act', 'renderSfx', 'place', 0.35, { step: 10 })); }
      const sigs = new Set(flat.map((r) => r.sig));
      const peaks = flat.map((r) => r.peak);
      const spreadDb = 20 * Math.log10(Math.max(...peaks) / Math.min(...peaks));
      const zc = new Set(flat.map((r) => r.zc));
      t.log(`30 renders of place: ${sigs.size} different, ${zc.size} different zero-crossing counts, level spread ${spreadDb.toFixed(1)} dB; step 10 averages ${mean(high.map((r) => r.zc)).toFixed(0)} crossings, step 0 ${mean(flat.map((r) => r.zc)).toFixed(0)}`);
      t.expect(sigs.size >= 29, `30 renders of place are all different (${sigs.size})`);
      t.expect(zc.size >= 12, `they differ in timbre (${zc.size} zero-crossing counts)`);
      t.expect(spreadDb >= 1, `the level varies by at least 1 dB (${spreadDb.toFixed(1)})`);
      t.expect(mean(high.map((r) => r.zc)) > mean(flat.map((r) => r.zc)) * 1.1, 'ten tiles up a word the sound is higher');
      for (const n of ['pick', 'recall', 'turn', 'error']) {
        const a = [];
        for (let k = 0; k < 8; k++) a.push((await t.game('act', 'renderSfx', n, 0.35)).sig);
        t.expect(new Set(a).size >= 7, `${n} varies from one repeat to the next`);
      }
    },
  },
  {
    name: 'S5-01 nothing plays before the first gesture, then the lobby tune and the bed fade in',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await ready(t);
      let a = await t.game('audioState');
      t.equal(a.ctx, null, 'no audio context before a gesture');
      t.equal(a.tune, null, 'no tune before a gesture');
      t.equal(a.bed, false, 'no bed before a gesture');
      await t.page.click('#screen [data-go="setup"]');
      await t.waitForStable(300);
      a = await t.game('audioState');
      t.equal(a.ctx, 'running', 'the context starts on the first tap');
      t.equal(a.tune, 'lobby', 'the lobby tune plays on the setup sheet');
      t.equal(a.bed, true, 'the bathhouse bed plays');
      await t.page.waitForTimeout(1200);
      t.expect((await t.game('audioState')).bars > 0, 'the tune is being scheduled');
    },
  },
  {
    name: 'S5-01 the tune follows the screen: lobby, table, results',
    viewports: ['desktop'],
    async run(t) {
      await ready(t);
      await t.page.click('#screen [data-go="setup"]');
      await t.game('newGame', { seed: 6 });
      await t.waitIdle(5000);
      t.equal((await t.game('audioState')).tune, 'table', 'play has the table tune');
      await t.page.click('#b-menu');
      await t.page.click('#modal [data-go="help"]');
      t.equal((await t.state()).scene, 'help', 'help opens from the pause card');
      t.equal((await t.game('audioState')).tune, 'table', 'a sheet opened from play keeps the table tune');
      await t.game('scene', 'title');
      t.equal((await t.game('audioState')).tune, 'lobby', 'the title has the lobby tune');
      await t.game('newGame', { mode: 'daily', seed: 4 });
      await t.waitIdle(5000);
      for (let k = 0; k < 10; k++) {
        const move = (await t.state()).game.move;
        await t.page.waitForFunction(() => { const g = window.__G; return g.s.over || (!g.staged.length && performance.now() >= g.busyUntil && g.scene === 'game'); }, null, { timeout: 10000 });
        await t.game('act', 'pass');
        await t.page.waitForFunction((n) => window.__G.s.move > n, move, { timeout: 10000 });
      }
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 8000 });
      t.equal((await t.game('audioState')).tune, 'finale', 'the results sheet has the finale tune');
    },
  },
  {
    name: 'S5-01 the pause card and a hidden tab hold the music and bed and schedule nothing',
    viewports: ['desktop'],
    async run(t) {
      await ready(t);
      await t.page.click('#screen [data-go="setup"]');
      await t.game('newGame', { seed: 6 });
      await t.waitIdle(5000);
      await t.page.waitForTimeout(800);
      let a = await t.game('audioState');
      t.equal(a.held, false, 'not held while playing');
      await t.page.click('#b-menu');
      a = await t.game('audioState');
      t.equal(a.held, true, 'held under the pause card');
      const notes = a.notes;
      await t.page.waitForTimeout(1500);
      t.equal((await t.game('audioState')).notes, notes, 'nothing is scheduled under the pause card');
      await t.page.click('#modal [data-close]');
      a = await t.game('audioState');
      t.equal(a.held, false, 'released when the card closes');
      await hide(t, true);
      a = await t.game('audioState');
      t.equal(a.held, true, 'held while the tab is hidden');
      t.equal(a.ctx, 'suspended', 'and the context is suspended');
      await hide(t, false);
      await t.page.waitForFunction(() => window.__game.audioState().ctx === 'running', null, { timeout: 5000 }).catch(() => {});
      a = await t.game('audioState');
      t.equal(a.held, false, 'released when the tab is back');
      t.equal(a.ctx, 'running', 'the context runs again');
      await t.page.click('#b-menu');
      await hide(t, true);
      await hide(t, false);
      t.equal((await t.game('audioState')).held, true, 'a tab coming back does not lift the pause card hold');
    },
  },
  {
    name: 'S5-01 Settings has Sound effects, Music and Ambience, each silences its own part and each is remembered',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await ready(t);
      await t.page.click('#screen [data-go="settings"]');
      await t.waitForStable(300);
      for (const k of ['fx', 'music', 'amb']) t.equal(await t.page.locator(`#screen [data-set="${k}"]`).count(), 2, `${k} has an On and an Off button`);
      const labels = await t.page.locator('#screen .setrow > span').allTextContents();
      for (const l of ['Sound', 'Sound effects', 'Music', 'Ambience', 'Volume']) t.expect(labels.includes(l), `the row "${l}" is there`);
      await t.shot('S5-01-settings');
      await t.page.waitForTimeout(500);
      let a = await t.game('audioState');
      t.equal(a.tune, 'lobby', 'music is on by default');
      t.equal(a.bed, true, 'ambience is on by default');
      await t.page.click('#screen [data-set="music"][data-val="false"]');
      a = await t.game('audioState');
      t.equal(a.tune, null, 'Music off silences the tune');
      t.equal(a.bed, true, 'and leaves the bed');
      await t.page.click('#screen [data-set="amb"][data-val="false"]');
      a = await t.game('audioState');
      t.equal(a.bed, false, 'Ambience off silences the bed');
      await t.page.click('#screen [data-set="fx"][data-val="false"]');
      t.equal((await t.state()).settings.fx, false, 'Sound effects is off in the settings');
      const s = await stored(t);
      t.equal(s.music, false, 'Music off is saved'); t.equal(s.amb, false, 'Ambience off is saved'); t.equal(s.fx, false, 'Sound effects off is saved');
      await t.reload();
      const r = (await t.state()).settings;
      t.equal(r.music, false, 'Music stays off after a reload'); t.equal(r.amb, false, 'Ambience stays off after a reload'); t.equal(r.fx, false, 'Sound effects stays off after a reload');
      await t.page.click('#screen [data-go="settings"]');
      await t.page.click('#screen [data-set="music"][data-val="true"]');
      await t.page.click('#screen [data-set="amb"][data-val="true"]');
      a = await t.game('audioState');
      t.equal(a.tune, 'lobby', 'Music on brings the tune back'); t.equal(a.bed, true, 'Ambience on brings the bed back');
      await t.page.click('#screen [data-set="sound"][data-val="false"]');
      a = await t.game('audioState');
      t.equal(a.tune, null, 'the master Sound switch silences the tune'); t.equal(a.bed, false, 'and the bed');
    },
  },
  {
    name: 'S5-01 a save from before the music loads with it on, and a save with sound off stays silent',
    viewports: ['desktop'],
    async run(t) {
      await ready(t);
      await t.page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ sound: true, vol: 0.35, theme: 'auto', motion: 'system', text: 1, board3d: 'auto', ai: 'normal', hints: true })), settingsKey);
      await t.reload();
      const s = (await t.state()).settings;
      t.equal(s.music, true, 'music defaults to on'); t.equal(s.amb, true, 'ambience defaults to on'); t.equal(s.fx, true, 'sound effects default to on');
      await t.page.click('#screen [data-go="setup"]');
      let a = await t.game('audioState');
      t.equal(a.tune, 'lobby', 'the old save hears the lobby tune');
      await t.page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ sound: false, vol: 0.35 })), settingsKey);
      await t.reload();
      await t.page.click('#screen [data-go="setup"]');
      a = await t.game('audioState');
      t.equal(a.tune, null, 'a save with sound off hears no tune'); t.equal(a.bed, false, 'and no bed');
      t.equal((await stored(t)).sound, false, 'and keeps sound off');
    },
  },
  {
    name: 'S5-01 a damaged music setting is dropped and the rest of the settings are kept',
    viewports: ['desktop'],
    async run(t) {
      await ready(t);
      await t.page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ sound: true, vol: 0.5, music: 'loud', amb: 3, fx: null })), settingsKey);
      await t.reload();
      const s = (await t.state()).settings;
      t.equal(s.music, true, 'a bad music value falls back to on'); t.equal(s.amb, true, 'a bad ambience value falls back to on'); t.equal(s.fx, true, 'a bad effects value falls back to on');
      t.equal(s.vol, 0.5, 'a good volume is kept');
    },
  },
  {
    name: 'S5-01 a computer turn keeps the table tune going and the screen unharmed',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await ready(t);
      await t.page.click('#screen [data-go="setup"]');
      await t.game('newGame', { seed: 6 });
      await t.waitIdle(5000);
      await t.game('act', 'pass');
      await t.waitIdle(10000);
      const a = await t.game('audioState');
      t.equal(a.tune, 'table', 'the table tune keeps playing through a computer turn');
      const sfx = (await t.state()).sfx;
      t.expect(sfx.includes('place') || sfx.includes('play') || sfx.includes('turn'), 'the computer turn made a sound');
      await t.shot('S5-01-game');
      await t.checkLayout();
    },
  },
];

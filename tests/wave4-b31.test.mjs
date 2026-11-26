// Wave 4, batch W4-B31 (WF-6 technical_polish): W6-S6-06 (Worker Blob URL revocation after init,
// c === audio.live offline cue-buffer isolation; complements aaba8f9/800cfd8/33d707d steamLoop,
// 375b884 renderCue, and 72cffe9 raw-dir.mjs).
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });

const blobInstrument = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, theme: 'light' }));
  }
  window.__blobCreated = [];
  window.__blobRevoked = [];
  window.__workerUrls = [];
  const origCreate = URL.createObjectURL.bind(URL);
  const origRevoke = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = function (...args) {
    const u = origCreate(...args);
    window.__blobCreated.push(u);
    return u;
  };
  URL.revokeObjectURL = function (u) {
    window.__blobRevoked.push(u);
    return origRevoke(u);
  };
  const OrigWorker = window.Worker;
  window.Worker = function (u, opts) {
    window.__workerUrls.push(String(u));
    return new OrigWorker(u, opts);
  };
  window.Worker.prototype = OrigWorker.prototype;
};

export const tests = [
  {
    name: 'W6-S6-06 AI Worker revokes its Blob URL once init completes (and still answers moves/hints), and sfx() guards audio.played/cues/total on c === audio.live',
    viewports: ['desktop'],
    initScript: blobInstrument,
    async run(t) {
      await ready(t);
      // Wait for the AI worker init handshake to finish (hint/move awaits aiClient.ready)
      await t.game('newGame', { seed: 41, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
      await t.waitIdle(8000);
      await t.game('act', 'hint');
      await t.waitIdle(8000);

      const blobCheck = await t.page.evaluate(() => ({
        aiMode: window.__game.getState().ai,
        created: window.__blobCreated.slice(),
        revoked: window.__blobRevoked.slice(),
        workerUrls: window.__workerUrls.slice(),
      }));
      t.equal(blobCheck.aiMode, 'worker', 'AI runs in Web Worker mode');
      t.expect(blobCheck.workerUrls.length >= 1, `Worker started from a Blob URL (${blobCheck.workerUrls.join(', ')})`);
      const workerBlob = blobCheck.workerUrls[0];
      t.expect(workerBlob.startsWith('blob:'), `Worker URL is a blob: URL (${workerBlob})`);
      t.expect(blobCheck.revoked.includes(workerBlob), `URL.revokeObjectURL() called for Worker Blob URL after init (revoked: ${blobCheck.revoked.join(', ')})`);

      // Verify Worker still functions after its Blob URL is revoked (play an AI turn)
      await t.game('act', 'autoplay', 2);
      await t.waitIdle(10000);
      t.equal((await t.state()).ai, 'worker', 'AI Worker continues operating cleanly after Blob URL revocation');
      t.expect((await t.state()).game.move >= 2, 'AI Worker computed moves cleanly after Blob URL revocation');

      // 1) Bundled renderSfx offline render never mutates live audio.played/cues/total
      const beforeBundle = await t.game('audioState');
      const rendered = await t.game('act', 'renderSfx', 'place', 0.35);
      const afterBundle = await t.game('audioState');
      t.expect(rendered.peak > 0.05, `offline renderSfx audible (${rendered.peak})`);
      t.equal(afterBundle.total, beforeBundle.total, 'renderSfx leaves audio.total untouched');
      t.equal(JSON.stringify(afterBundle.played), JSON.stringify(beforeBundle.played), 'renderSfx leaves audio.played untouched');
      t.equal(JSON.stringify(afterBundle.cues), JSON.stringify(beforeBundle.cues), 'renderSfx leaves audio.cues untouched');

      // 2) Direct c === audio.live guard in src/js/audio.js: calling sfx() with audio.ctx = OfflineAudioContext (even WITHOUT _offline:true) must NOT mutate played/cues/total
      const liveGuard = await t.page.evaluate(async () => {
        const A = await import(new URL('src/js/audio.js', location.href).href);
        const before = { total: A.audio.total, played: A.audio.played.slice(), cues: A.audio.cues.slice() };
        const off = new OfflineAudioContext(1, 22050, 22050);
        const prev = { ctx: A.audio.ctx, on: A.audio.on, fx: A.audio.fx, sfxOut: A.audio.sfxOut };
        A.audio.ctx = off; A.audio.on = true; A.audio.fx = true; A.audio.sfxOut = off.destination;
        try {
          A.sfx('pick'); // intentionally omits _offline: true to exercise the c === audio.live guard
        } finally {
          Object.assign(A.audio, prev);
        }
        const afterOffline = { total: A.audio.total, played: A.audio.played.slice(), cues: A.audio.cues.slice() };
        // Live (pre-unlock null === null) call still records normally
        A.sfx('pick');
        const afterLive = { total: A.audio.total, played: A.audio.played.slice() };
        return { before, afterOffline, afterLive };
      });
      t.equal(liveGuard.afterOffline.total, liveGuard.before.total, 'sfx() against offline ctx (c !== audio.live) does not increment audio.total');
      t.equal(JSON.stringify(liveGuard.afterOffline.played), JSON.stringify(liveGuard.before.played), 'sfx() against offline ctx does not mutate audio.played');
      t.equal(JSON.stringify(liveGuard.afterOffline.cues), JSON.stringify(liveGuard.before.cues), 'sfx() against offline ctx does not mutate audio.cues');
      t.equal(liveGuard.afterLive.total, liveGuard.before.total + 1, 'live sfx() still records audio.total');
      t.equal(liveGuard.afterLive.played[liveGuard.afterLive.played.length - 1], 'pick', 'live sfx() still records audio.played');
    },
  },
];

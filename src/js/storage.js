// localStorage, every call in try/catch: the game works when storage is missing or throws.
export const KEYS = {
  save: 'hs-letters-save-v1',
  settings: 'hs-letters-settings-v1',
  register: 'hs-letters-register-v1',
  daily: 'hs-letters-daily-v1',
};
export const store = {
  get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { window.localStorage.setItem(k, v); return true; } catch (e) { return false; } },
  del(k) { try { window.localStorage.removeItem(k); } catch (e) { /* nothing to do */ } },
  json(k, fallback) { try { const v = JSON.parse(this.get(k) || 'null'); return v == null ? fallback : v; } catch (e) { return fallback; } },
  put(k, v) { return this.set(k, JSON.stringify(v)); },
};

// Optional persistence metadata in the existing v1 game key, never rules/RNG data.
export const SAVE_STAMP = '_hsgSlotV1';
const object = x => !!x && typeof x === 'object' && !Array.isArray(x);
const integer = x => Number.isSafeInteger(x) && x >= 0;
const finite = x => typeof x === 'number' && Number.isFinite(x);
const letter = x => typeof x === 'string' && /^[A-Z?]$/.test(x);
const uint = x => integer(x) && x <= 0xffffffff;
const categoriesV1 = ['springs', 'baths', 'park', 'track', 'club', 'town'];

// Validate only the structures consumed by the original current reader/engine.
// No defaults, normalization, dictionary/score/tile-total authentication, or writes.
export function validSavedGame(s, categories = categoriesV1) {
  if (!object(s) || s.v !== 1 || s.over !== false || !['play', 'daily'].includes(s.mode)) return false;
  if (!Array.isArray(s.players) || !s.players.length || s.players.length > 4) return false;
  const seat = n => integer(n) && n < s.players.length;
  if (!seat(s.cur) || !integer(s.move) || !integer(s.round) || !integer(s.scoreless)) return false;
  if (!object(s.rng) || !uint(s.rng.bag) || !uint(s.rng.ai) || ('seed' in s && !uint(s.seed))) return false;
  if (!Array.isArray(s.board) || s.board.length !== 225 || !s.board.every(t => t === null || (object(t) && typeof t.l === 'string' && /^[A-Z]$/.test(t.l) && (t.blank == null || typeof t.blank === 'boolean')))) return false;
  if (!Array.isArray(s.bag) || !s.bag.every(letter)) return false;
  if (!s.players.every(p => object(p) && typeof p.name === 'string' && ['human', 'ai'].includes(p.kind) && finite(p.score)
    && Array.isArray(p.rack) && p.rack.length <= 7 && p.rack.every(letter)
    && (p.hints == null || integer(p.hints)) && (p.level == null || typeof p.level === 'string') && (p.persona == null || typeof p.persona === 'string')
    && (p.best == null || (object(p.best) && typeof p.best.word === 'string' && finite(p.best.score))))) return false;
  if (!Array.isArray(s.featured) || !s.featured.every(f => object(f) && typeof f.word === 'string' && f.word.length > 0
    && categories.includes(f.cat) && Array.isArray(f.shown) && f.shown.every(n => integer(n) && n < f.word.length)
    && (f.by == null || seat(f.by)))) return false;
  if (!Array.isArray(s.log) || !s.log.every(e => object(e) && typeof e.kind === 'string' && (e.kind === 'end' || seat(e.p))
    && (e.kind !== 'play' || (Array.isArray(e.tiles) && e.tiles.every(t => object(t) && integer(t.i) && t.i < 225 && typeof t.l === 'string' && /^[A-Z]$/.test(t.l))
      && Array.isArray(e.words) && e.words.every(w => object(w) && typeof w.w === 'string' && finite(w.score) && finite(w.bonus)))))) return false;
  if (s.mode === 'daily' && (s.players.length !== 1 || !object(s.daily) || typeof s.daily.date !== 'string'
    || !/^\d{4}-\d{2}-\d{2}$/.test(s.daily.date) || !integer(s.daily.turns) || s.daily.turns < 1 || s.daily.turns > 10)) return false;
  return true;
}

function stampOf(game) {
  const m = game[SAVE_STAMP];
  if (m == null && !Object.prototype.hasOwnProperty.call(game, SAVE_STAMP)) return { kind: 'legacy' };
  if (!object(m) || typeof m.generation !== 'string' || !m.generation || m.generation.length > 128 || !integer(m.revision) || m.revision < 1) return { kind: 'untrusted' };
  return { kind: 'identified', generation: m.generation, revision: m.revision };
}
function generation() {
  try { const words = new Uint32Array(4); globalThis.crypto.getRandomValues(words); return [...words].map(x => x.toString(16).padStart(8, '0')).join(''); }
  catch { return null; } // Never consume the game's Math.random/RNG or guess an owner.
}

export function createGameSaves(getStorage, { categories = categoriesV1, newGeneration = generation } = {}) {
  const records = new WeakSet(), intents = new WeakSet(), used = new WeakSet(), controls = new WeakMap();
  const rawRead = () => { try { const raw = getStorage().getItem(KEYS.save); return typeof raw === 'string' || raw === null ? { ok: true, raw } : { ok: false, reason: 'unreadable' }; } catch { return { ok: false, reason: 'unreadable' }; } };
  const result = (c, value) => (c.last = value);
  function read() {
    const r = rawRead();
    if (!r.ok) return { kind: 'unreadable', game: null };
    if (r.raw === null) return { kind: 'absent', raw: null, game: null };
    try {
      const game = JSON.parse(r.raw);
      if (!validSavedGame(game, categories)) return { kind: 'invalid', raw: r.raw, game: null };
      const record = { kind: 'saved', raw: r.raw, game, stamp: Object.freeze(stampOf(game)) }; Object.freeze(record); records.add(record); return record;
    } catch { return { kind: 'invalid', raw: r.raw, game: null }; }
  }
  function newIntent() {
    const intent = Object.freeze({ kind: 'new', base: Object.freeze(rawRead()), generation: newGeneration() }); intents.add(intent); return intent;
  }
  function open(game, intent) {
    if (!object(game) || !object(intent) || used.has(intent) || (!intents.has(intent) && !records.has(intent))) throw new Error('An unused observed New/Continue intent is required');
    if (records.has(intent) && intent.game !== game) throw new Error('Continue game must be the observed object');
    used.add(intent);
    const handle = {}, c = { game, retired: false, conflicted: false, last: null };
    controls.set(handle, c);
    if (intents.has(intent)) {
      c.base = intent.base; c.generation = intent.generation; c.revision = 0; c.pending = true; c.baseOwnsRun = false;
      save(handle, game); return handle;
    }
    c.base = { ok: true, raw: intent.raw }; c.pending = intent.stamp.kind === 'legacy';
    c.baseOwnsRun = intent.stamp.kind !== 'untrusted'; // A valid Continue explicitly acknowledges this exact saved run.
    c.generation = c.pending ? newGeneration() : intent.stamp.generation;
    c.revision = c.pending ? 0 : intent.stamp.revision;
    if (intent.stamp.kind === 'untrusted') { c.conflicted = true; result(c, { ok: false, reason: 'untrusted-stamp' }); return handle; }
    if (c.pending) { save(handle, game); return handle; } // Metadata-only legacy adoption; game is unchanged.
    const current = rawRead();
    if (!current.ok) result(c, { ok: false, reason: 'unreadable' });
    else if (current.raw !== c.base.raw) { c.conflicted = true; result(c, { ok: false, reason: 'conflict' }); }
    else result(c, { ok: true, action: 'adopted-read-only' });
    return handle;
  }
  function save(handle, game) {
    const c = controls.get(handle);
    if (!c || c.game !== game) return { ok: false, reason: 'wrong-game' };
    if (c.retired) return result(c, { ok: true, action: 'already-retired' });
    if (c.conflicted) return result(c, { ok: false, reason: 'conflict' });
    if (!c.base.ok) return result(c, { ok: false, reason: 'no-known-base' });
    if (!c.generation) return result(c, { ok: false, reason: 'no-generation' });
    const current = rawRead();
    if (!current.ok) return result(c, { ok: false, reason: 'unreadable' });
    // The exact raw snapshot includes the generation/revision, so all must match.
    if (current.raw !== c.base.raw) { c.conflicted = true; return result(c, { ok: false, reason: 'conflict' }); }
    if (game.over) {
      // An unsaved New must not erase the prior run used as its reservation base.
      if (!c.baseOwnsRun) return result(c, { ok: false, reason: 'unacknowledged-run' });
      try { getStorage().removeItem(KEYS.save); }
      catch { return result(c, { ok: false, reason: 'write-failed' }); }
      c.base = { ok: true, raw: null }; c.retired = true; c.pending = false;
      return result(c, { ok: true, action: 'removed' });
    }
    if (!integer(c.revision) || c.revision >= Number.MAX_SAFE_INTEGER) return result(c, { ok: false, reason: 'revision-exhausted' });
    const revision = c.revision + 1;
    let payload, raw;
    try {
      const prior = !c.pending && object(game[SAVE_STAMP]) ? game[SAVE_STAMP] : {};
      payload = { ...game, [SAVE_STAMP]: { ...prior, generation: c.generation, revision } };
      raw = JSON.stringify(payload);
    } catch { return result(c, { ok: false, reason: 'serialize-failed' }); }
    try { getStorage().setItem(KEYS.save, raw); }
    catch { return result(c, { ok: false, reason: 'write-failed' }); }
    // A successful operation is paid even if a subsequent getter fails. Fresh checks occur next time.
    c.base = { ok: true, raw }; c.revision = revision; c.pending = false; c.baseOwnsRun = true;
    try { Object.defineProperty(game, SAVE_STAMP, { value: payload[SAVE_STAMP], enumerable: true, writable: true, configurable: true }); } catch { /* Ack remains valid; normal games are mutable JSON objects. */ }
    return result(c, { ok: true, action: 'written' });
  }
  function replaceFixture(handle, before, after) {
    const c = controls.get(handle); if (!c || c.game !== before || !object(after)) return false;
    c.game = after; return true; // Same logical test run/base; never read/adopt another slot.
  }
  return { read, newIntent, open, save, replaceFixture, status: handle => controls.get(handle)?.last || { ok: false, reason: 'wrong-game' } };
}

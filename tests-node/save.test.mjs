import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createGameSaves, validSavedGame, SAVE_STAMP, KEYS } from '../src/js/storage.js';

// MIT baseline39264be: exact storage module plus exact main.js save/loadSave span.
// Only export declarations are removed so the original functions can run in a document VM.
const ORIGINAL_STORAGE = "// localStorage, every call in try/catch: the game works when storage is missing or throws.\nexport const KEYS = {\n  save: 'hs-letters-save-v1',\n  settings: 'hs-letters-settings-v1',\n  register: 'hs-letters-register-v1',\n  daily: 'hs-letters-daily-v1',\n};\nexport const store = {\n  get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },\n  set(k, v) { try { window.localStorage.setItem(k, v); return true; } catch (e) { return false; } },\n  del(k) { try { window.localStorage.removeItem(k); } catch (e) { /* nothing to do */ } },\n  json(k, fallback) { try { const v = JSON.parse(this.get(k) || 'null'); return v == null ? fallback : v; } catch (e) { return fallback; } },\n  put(k, v) { return this.set(k, JSON.stringify(v)); },\n};\n";
const ORIGINAL_FUNCTIONS = "const save = () => { if (G.s && !G.s.over) store.put(KEYS.save, G.s); else store.del(KEYS.save); };\nconst loadSave = () => { const s = store.json(KEYS.save, null); return s && s.v === 1 && !s.over ? s : null; };\n";

const original = process.argv.includes('--original');
const earned = JSON.parse(readFileSync(new URL('../test-fixtures/save-v1-earned-play.json', import.meta.url), 'utf8'));
const clone = x => JSON.parse(JSON.stringify(x));
const opaque = s => { const c = clone(s); delete c[SAVE_STAMP]; return c; };
let documentId = 0;
class Storage {
  constructor(game = null) { this.data = new Map(game === null ? [] : [[KEYS.save, JSON.stringify(game)]]); this.calls = []; this.readFails = false; this.writeFails = false; this.removeFails = false; this.failReadsAfterWrite = false; }
  getItem(k) { this.calls.push(['get', k]); if (this.readFails) throw new Error('blocked getter'); return this.data.get(k) ?? null; }
  setItem(k, raw) { this.calls.push(['set', k, raw]); if (this.writeFails) throw new Error('quota'); this.data.set(k, String(raw)); if (this.failReadsAfterWrite) this.readFails = true; }
  removeItem(k) { this.calls.push(['remove', k]); if (this.removeFails) throw new Error('blocked removal'); this.data.delete(k); if (this.failReadsAfterWrite) this.readFails = true; }
  raw() { return this.data.get(KEYS.save) ?? null; }
  game() { return JSON.parse(this.raw()); }
}
function candidateDocument(storage) {
  const id = ++documentId; let next = 0, game, handle;
  const saves = createGameSaves(() => storage, { newGeneration: () => 'document-' + id + '-new-' + (++next) });
  return { saves, get game() { return game; }, get handle() { return handle; },
    new(g) { game = g; handle = saves.open(g, saves.newIntent()); return saves.status(handle); },
    continue() { const r = saves.read(); if (!r.game) return null; game = r.game; handle = saves.open(game, r); return game; },
    read: () => saves.read().game, save: () => saves.save(handle, game) };
}
function originalDocument(storage) {
  const context = vm.createContext({ window: { localStorage: storage } });
  vm.runInContext(ORIGINAL_STORAGE.replace(/^export /gm, '') + '\nconst G = { s: null };\n' + ORIGINAL_FUNCTIONS + '\nglobalThis.api = { save, loadSave, G };', context);
  const api = context.api;
  return { get game() { return api.G.s; }, new(g) { api.G.s = g; api.save(); },
    continue() { api.G.s = api.loadSave(); api.save(); return api.G.s; }, read: api.loadSave, save: api.save };
}
const document = original ? originalDocument : candidateDocument;
const candidate = (name, fn) => test(name, { skip: original ? 'Candidate-only ownership protocol; inapplicable to the original adapter' : false }, fn);
function daily() { const s = clone(earned); s.mode = 'daily'; s.players = [s.players[0]]; s.cur = 0; s.daily = { date: '2026-11-04', turns: 1 }; s.featured = []; s.log = []; return s; }
function move(s, score = 7) { s.move++; s.players[0].score += score; }

// The same four behavioral assertions run unchanged against original and candidate.
test('behavior: older terminal Daily cannot remove a newer Play save', () => {
  const st = new Storage(), a = document(st), b = document(st);
  a.new(daily()); b.new(clone(earned)); const before = st.raw();
  a.game.over = true; a.save(); assert.equal(st.raw(), before, 'foreign Play must remain byte-exact');
});
test('behavior: stale Save-and-quit cannot overwrite a newer explicit game', () => {
  const st = new Storage(earned), a = document(st), b = document(st);
  a.continue(); b.new({ ...clone(earned), move: 9 }); const before = st.raw();
  a.save(); assert.equal(st.raw(), before, 'stale game must not replace newer slot');
});
test('behavior: two Continue tabs cannot overwrite the first acknowledged turn', () => {
  const st = new Storage(earned), a = document(st), b = document(st);
  a.continue(); b.continue(); move(a.game, 11); a.save(); const before = st.raw();
  move(b.game, 3); b.save(); assert.equal(st.raw(), before, 'whole latest board/run remains coherent');
});
test('behavior: partial v1 is not offered as a playable Continue', () => {
  const st = new Storage({ v: 1 }); const raw = st.raw();
  assert.equal(document(st).read(), null, 'missing players/board cannot reach title consumers'); assert.equal(st.raw(), raw, 'invalid raw bytes remain untouched');
});

candidate('earned opaque v1 and optional/null fields pass without normalization', () => {
  assert.equal(validSavedGame(earned), true);
  const s = clone(earned); s.extra = { nested: ['retained', null] }; delete s.seed;
  for (const p of s.players) { delete p.level; delete p.persona; delete p.best; delete p.hints; }
  assert.equal(validSavedGame(s), true); const st = new Storage(s), d = candidateDocument(st); d.continue(); assert.deepEqual(opaque(st.game()), s);
});
candidate('identified Continue is read-only and passive reads never refresh authority', () => {
  const st = new Storage(), a = candidateDocument(st); a.new(clone(earned)); const raw = st.raw(); st.calls = [];
  const b = candidateDocument(st); b.continue(); b.read(); b.read(); assert.equal(st.raw(), raw); assert.equal(st.calls.filter(c => c[0] !== 'get').length, 0);
  move(a.game); a.save(); const latest = st.raw(); b.read(); assert.equal(b.save().reason, 'conflict'); assert.equal(st.raw(), latest);
});
candidate('legacy Continue adds only optional metadata and preserves opaque values', () => {
  const s = clone(earned); s.future = { value: 19 }; const st = new Storage(s), d = candidateDocument(st); d.continue();
  assert.deepEqual(opaque(st.game()), s); assert.deepEqual(d.game, st.game()); assert.equal(st.game()[SAVE_STAMP].revision, 1);
});
candidate('original current reader accepts candidate-written opaque v1', () => {
  const st = new Storage(), d = candidateDocument(st); d.new(clone(earned)); move(d.game); d.save();
  const raw = st.raw(), legacy = originalDocument(st); assert.deepEqual(JSON.parse(JSON.stringify(legacy.read())), st.game()); assert.equal(st.raw(), raw);
});
candidate('identical same-date explicit New receives a distinct generation', () => {
  const st = new Storage(), a = candidateDocument(st), b = candidateDocument(st); a.new(daily()); const first = st.game()[SAVE_STAMP];
  b.new(daily()); const second = st.game()[SAVE_STAMP]; assert.notEqual(first.generation, second.generation);
  const before = st.raw(); a.game.over = true; assert.equal(a.save().reason, 'conflict'); assert.equal(st.raw(), before);
});
candidate('two tabs adopting one generation still require its exact revision/bytes', () => {
  const st = new Storage(), first = candidateDocument(st); first.new(clone(earned)); const a = candidateDocument(st), b = candidateDocument(st); a.continue(); b.continue();
  assert.equal(a.game[SAVE_STAMP].generation, b.game[SAVE_STAMP].generation); move(a.game); a.save(); const before = st.raw();
  move(b.game); assert.equal(b.save().reason, 'conflict'); assert.equal(st.raw(), before);
});
candidate('successful terminal removal retires the handle before a later foreign New', () => {
  const st = new Storage(), a = candidateDocument(st), b = candidateDocument(st); a.new(daily()); a.game.over = true; assert.equal(a.save().action, 'removed');
  b.new(clone(earned)); const raw = st.raw(); assert.equal(a.save().action, 'already-retired'); assert.equal(st.raw(), raw);
});
candidate('failed New reservation retries against the original base only', () => {
  const st = new Storage(earned), a = candidateDocument(st); st.writeFails = true; assert.equal(a.new(clone(earned)).reason, 'write-failed');
  move(a.game); st.writeFails = false; assert.equal(a.save().ok, true); assert.equal(st.game().move, earned.move + 1); assert.equal(st.game()[SAVE_STAMP].revision, 1);
});
candidate('foreign intervention blocks retry of a failed New reservation', () => {
  const st = new Storage(earned), a = candidateDocument(st), b = candidateDocument(st); st.writeFails = true; a.new(clone(earned)); st.writeFails = false;
  b.new({ ...clone(earned), move: 15 }); const before = st.raw(); assert.equal(a.save().reason, 'conflict'); assert.equal(st.raw(), before);
});
candidate('initial unreadable base is never silently reauthorized as absence', () => {
  const st = new Storage(), a = candidateDocument(st); st.readFails = true; assert.equal(a.new(clone(earned)).reason, 'no-known-base');
  st.readFails = false; assert.equal(a.save().reason, 'no-known-base'); assert.equal(st.raw(), null);
  const b = candidateDocument(st); b.new(clone(earned)); const raw = st.raw(); assert.equal(a.save().reason, 'no-known-base'); assert.equal(st.raw(), raw);
});
candidate('known corrupt bytes may be replaced only by a deliberate New matching those bytes', () => {
  const st = new Storage(); st.data.set(KEYS.save, '{bad'); const a = candidateDocument(st); assert.equal(a.read(), null); assert.equal(st.raw(), '{bad');
  assert.equal(a.new(clone(earned)).ok, true); assert.deepEqual(opaque(st.game()), earned);
});
candidate('successful set is acknowledged even when every later getter fails', () => {
  const st = new Storage(), a = candidateDocument(st); st.failReadsAfterWrite = true; assert.equal(a.new(clone(earned)).ok, true); const raw = st.raw();
  move(a.game); assert.equal(a.save().reason, 'unreadable'); assert.equal(st.raw(), raw);
  st.failReadsAfterWrite = false; st.readFails = false; assert.equal(a.save().ok, true); assert.equal(st.game()[SAVE_STAMP].revision, 2);
});
candidate('successful remove remains retired through a later getter outage', () => {
  const st = new Storage(), a = candidateDocument(st); a.new(daily()); st.failReadsAfterWrite = true; a.game.over = true;
  assert.equal(a.save().action, 'removed'); assert.equal(a.save().action, 'already-retired'); assert.equal(st.raw(), null);
});
candidate('failed remove retains the acknowledged slot and permits a fresh matching retry', () => {
  const st = new Storage(), a = candidateDocument(st); a.new(daily()); const raw = st.raw(); a.game.over = true; st.removeFails = true;
  assert.equal(a.save().reason, 'write-failed'); assert.equal(st.raw(), raw); st.removeFails = false; assert.equal(a.save().action, 'removed');
});
candidate('failed remove cannot later clear a foreign slot', () => {
  const st = new Storage(), a = candidateDocument(st), b = candidateDocument(st); a.new(daily()); a.game.over = true; st.removeFails = true; a.save(); st.removeFails = false;
  b.new(clone(earned)); const raw = st.raw(); assert.equal(a.save().reason, 'conflict'); assert.equal(st.raw(), raw);
});
candidate('a successful autosave acknowledges exactly once without doubled revision', () => {
  const st = new Storage(), a = candidateDocument(st); a.new(clone(earned)); move(a.game); st.writeFails = true; a.save(); a.save();
  st.writeFails = false; a.save(); assert.equal(st.game()[SAVE_STAMP].revision, 2); assert.equal(st.game().players[0].score, earned.players[0].score + 7);
});
candidate('wrong game or old async object cannot borrow the new handle', () => {
  const st = new Storage(), a = candidateDocument(st); a.new(clone(earned)); const old = a.game; a.new(clone(earned)); const raw = st.raw();
  old.over = true; assert.equal(a.saves.save(a.handle, old).reason, 'wrong-game'); assert.equal(a.saves.save({}, a.game).reason, 'wrong-game'); assert.equal(st.raw(), raw);
});
candidate('fixture object replacement retains the old base instead of adopting foreign data', () => {
  const st = new Storage(), a = candidateDocument(st), b = candidateDocument(st); a.new(clone(earned)); const old = a.game, replacement = clone(old);
  b.new(clone(earned)); const raw = st.raw(); assert.equal(a.saves.replaceFixture(a.handle, old, replacement), true);
  assert.equal(a.saves.save(a.handle, replacement).reason, 'conflict'); assert.equal(st.raw(), raw); assert.equal(a.saves.replaceFixture({}, old, replacement), false);
});
candidate('malformed private stamp grants no implicit overwrite or clear authority', () => {
  const s = clone(earned); s[SAVE_STAMP] = { generation: '', revision: -1 }; const st = new Storage(s), a = candidateDocument(st); a.continue(); const raw = st.raw();
  assert.equal(a.saves.status(a.handle).reason, 'untrusted-stamp'); a.game.over = true; assert.equal(a.save().ok, false); assert.equal(st.raw(), raw);
});
candidate('opaque raw changes conflict even when the generation/revision did not change', () => {
  const st = new Storage(), a = candidateDocument(st); a.new(clone(earned)); const changed = st.game(); changed.future = true; st.data.set(KEYS.save, JSON.stringify(changed)); const raw = st.raw();
  assert.equal(a.save().reason, 'conflict'); assert.equal(st.raw(), raw);
});
candidate('an exhausted revision is refused without writing or changing the game', () => {
  const s = clone(earned); s[SAVE_STAMP] = { generation: 'future', revision: Number.MAX_SAFE_INTEGER }; const st = new Storage(s), a = candidateDocument(st); a.continue(); const raw = st.raw();
  assert.equal(a.save().reason, 'revision-exhausted'); assert.equal(st.raw(), raw);
});
candidate('observed intents cannot be forged, reused, or retargeted to another object', () => {
  const st = new Storage(earned), saves = candidateDocument(st).saves, r = saves.read(); assert.throws(() => saves.open(clone(r.game), r));
  const intent = saves.newIntent(); saves.open(clone(earned), intent); assert.throws(() => saves.open(clone(earned), intent)); assert.throws(() => saves.open(clone(earned), { kind: 'new' }));
  assert.equal(Object.isFrozen(intent), true); assert.equal(Object.isFrozen(intent.base), true); assert.equal(Object.isFrozen(r), true); assert.equal(Object.isFrozen(r.stamp), true);
});
candidate('required nested shapes reject unsafe consumers without rewriting raw storage', () => {
  const mutations = [s => delete s.players, s => s.players[0] = null, s => s.board.pop(), s => s.board[0] = { l: {} }, s => s.cur = 90,
    s => delete s.bag, s => s.rng.ai = null, s => s.featured[0].shown = null, s => s.featured[0].cat = 'unknown', s => s.featured[0].by = 50,
    s => s.log[0].tiles = null, s => s.log[0].words = null, s => s.players[0].name = null, s => s.players[0].rack = 'ABC'];
  for (const mutate of mutations) { const s = clone(earned); mutate(s); const st = new Storage(s), raw = st.raw(); assert.equal(candidateDocument(st).read(), null); assert.equal(st.raw(), raw); }
});
candidate('valid empty bag/racks, blanks and Daily structure remain usable', () => {
  const s = clone(earned); s.bag = []; for (const p of s.players) p.rack = []; s.board[0] = { l: 'A', blank: true }; assert.equal(validSavedGame(s), true);
  const d = daily(); assert.equal(validSavedGame(d), true); d.daily.turns = 0; assert.equal(validSavedGame(d), false); d.daily.turns = 1; d.daily.date = null; assert.equal(validSavedGame(d), false);
});
candidate('unknown compatible keys including __proto__ survive as data only', () => {
  const s = clone(earned); Object.defineProperty(s, '__proto__', { value: { polluted: true }, enumerable: true }); s.future = { nested: [1, null] };
  const st = new Storage(s), a = candidateDocument(st); a.continue(); move(a.game); a.save(); const saved = st.game(); assert.equal(Object.hasOwn(saved, '__proto__'), true); assert.equal(saved.__proto__.polluted, true); assert.equal({}.polluted, undefined); assert.deepEqual(saved.future, s.future);
});
candidate('all game operations leave the separate settings/Register/Daily bytes untouched', () => {
  const st = new Storage(); for (const k of [KEYS.settings, KEYS.register, KEYS.daily]) st.data.set(k, 'opaque-' + k); const before = new Map(st.data), a = candidateDocument(st);
  a.new(clone(earned)); move(a.game); a.save(); a.game.over = true; a.save(); for (const [k, raw] of before) assert.equal(st.data.get(k), raw);
  assert.equal(st.calls.every(c => c[1] === KEYS.save), true);
});

candidate('an unsaved New reaching terminal cannot remove its prior earned reservation base', () => {
  const st = new Storage(earned), a = candidateDocument(st), prior = st.raw(); st.writeFails = true;
  assert.equal(a.new(daily()).reason, 'write-failed'); move(a.game); assert.equal(a.save().reason, 'write-failed');
  a.game.over = true; st.removeFails = false; assert.equal(a.save().reason, 'unacknowledged-run'); assert.equal(st.raw(), prior);
  assert.equal(st.calls.some(c => c[0] === 'remove'), false);
});
candidate('failed legacy metadata adoption may retire only its already observed saved run', () => {
  const st = new Storage(earned), a = candidateDocument(st); st.writeFails = true; a.continue(); const prior = st.raw();
  assert.equal(a.saves.status(a.handle).reason, 'write-failed'); assert.equal(prior, JSON.stringify(earned));
  a.game.over = true; assert.equal(a.save().action, 'removed'); assert.equal(st.raw(), null);
});

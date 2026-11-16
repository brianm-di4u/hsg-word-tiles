// Controller: scenes, turn flow, staging and input, AI pacing, toasts and fact cards, saves and window.__game.
import { loadDict, has } from './dict.js';
import { makeLexicon } from './lexicon.js';
import * as E from './engine.js';
import { N, CENTER, RACK, FULL_SOAK, FEATURED_BONUS, ROW_BONUS, SQUARE as SQUARES, BATHHOUSES as BATHS } from './score.js';
import { seedState } from './rng.js';
import * as R from './render2d.js';
import { audio, unlock, sfx, pauseAudio, resumeAudio, setTune, holdAudio, releaseAudio, syncAudio, audioList, audioRender, renderCue, tuneName } from './audio.js';
import { art, loadArt } from './art.js';
import { store, KEYS, createGameSaves, validRegister, validDaily, pruneDays } from './storage.js';
import { startAi, aiMove, aiHint, aiClient } from './aiclient.js';
import { PERSONAS, persona, LEVEL_NAME, seatLevel } from './personas.js';
import { barkFor, endBark, SHORT } from './voices.js';
import { cleanStats, applyGame, applyDaily, nextStreak } from './stats.js';
import * as B3 from './board3d.js';
import * as UI from './ui.js';
import { generateMoves } from './movegen.js';
import { dailyPar } from './par.js';
import { reviewSeat, reviewSteps, summarize } from './review.js';

const { qs: $, esc } = UI;
const META = { words: 168295, added: 0 };
// every two-letter word the dictionary holds, for the Help sheet (built once the dictionary is loaded)
let twoLetters = null;
const twoLetterWords = () => {
  if (!G.dict) return [];
  if (!twoLetters) { twoLetters = []; for (let a = 65; a < 91; a++) for (let b = 65; b < 91; b++) { const w = String.fromCharCode(a, b); if (has(G.dict, w)) twoLetters.push(w); } }
  return twoLetters;
};

// The Help sheet's word check: the same dictionary that judges a play, and a nod to the town's own words.
function wordCheck(raw) {
  const w = String(raw).toUpperCase().replace(/[^A-Z]/g, '');
  if (w.length < 2) return 'Type a word of two letters or more.';
  if (!G.dict) return 'The dictionary is still loading. Try again in a moment.';
  if (G.s && G.s.challenge && !G.s.over) return 'The word check is off while a Challenge game is in progress.';
  if (!has(G.dict, w)) return `${w} is not in the dictionary, so a play that makes it is handed back.`;
  const e = G.lex.entry(w);
  return `${w} is in the dictionary and can be played.${e ? ` It is also a Hot Springs word: it pays +${G.lex.bonusOf(e)}.` : ''}`;
}

const G = {
  s: null, scene: 'title', back: 'title', dict: null, lex: makeLexicon(LEXICON), ready: false,
  settings: { sound: true, fx: true, music: true, amb: true, vol: 0.35, fxVol: 1, musicVol: 1, theme: 'auto', motion: 'system', text: 1, board3d: 'auto', ai: 'normal', hints: true, tipsSeen: true, vibrate: matchMedia('(pointer: coarse)').matches },
  setup: null, nextSeed: null,
  staged: [], order: [], selected: null, cursor: { i: CENTER, dir: 1, on: false },
  preview: null, hint: null, last: new Set(), lastPulse: null, anim: new Map(), animUntil: 0,
  breakdown: false, settle: new Map(), settleUntil: 0, chainAt: 0, aiBusy: false, aiTimer: 0, aiToken: 0, privacy: false, revealed: -1, dialog: null, toastQ: [], helpTab: 'rules',
  drag: null, returning: null, returnTimer: 0, pointers: new Map(), pinch: null, fxFrozen: null, busyUntil: 0, lastHuman: -1,
};
window.__G = G;

// ---------- settings ----------
const reduced = () => G.settings.motion === 'reduce' || (G.settings.motion === 'system' && matchMedia('(prefers-reduced-motion: reduce)').matches);
const animOn = () => !reduced() && !G.fast;
// Haptics (S2-22): short pulses on the player's own moves, where the browser has navigator.vibrate. Off with the Vibration switch
// and whenever motion is reduced. Never on the computer's moves.
const HAP = { stage: 10, play: 20, error: [30, 40, 30], big: [20, 40, 20, 40, 40] };
function buzz(kind) {
  if (!G.settings.vibrate || reduced() || typeof navigator.vibrate !== 'function') return;
  try { navigator.vibrate(HAP[kind]); } catch (e) { /* a phone that refuses a pulse is not a problem */ }
}
const oops = () => { sfx('error'); buzz('error'); };
const dark = () => G.settings.theme === 'dark' || (G.settings.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
// stored settings are trusted field by field: a value of the wrong type or range is dropped and the stored copy rewritten
const SETTING_OK = {
  sound: (v) => typeof v === 'boolean', tipsSeen: (v) => typeof v === 'boolean', fx: (v) => typeof v === 'boolean', music: (v) => typeof v === 'boolean', amb: (v) => typeof v === 'boolean', hints: (v) => typeof v === 'boolean', vibrate: (v) => typeof v === 'boolean',
  vol: (v) => typeof v === 'number' && v >= 0 && v <= 1, fxVol: (v) => typeof v === 'number' && v >= 0 && v <= 1, musicVol: (v) => typeof v === 'number' && v >= 0 && v <= 1,
  theme: (v) => ['auto', 'light', 'dark'].includes(v), motion: (v) => ['system', 'full', 'reduce'].includes(v),
  text: (v) => [1, 1.15, 1.3].includes(v), board3d: (v) => ['auto', 'on', 'off'].includes(v), ai: (v) => ['normal', 'fast', 'instant'].includes(v),
  lastSetup: (v) => !!v && typeof v === 'object' && typeof v.hints === 'boolean' && (v.challenge == null || typeof v.challenge === 'boolean') && Array.isArray(v.seats) && v.seats.length >= 2 && v.seats.length <= 4
    && v.seats.every((x) => !!x && ((x.kind === 'human' && (x.name == null || typeof x.name === 'string')) || (x.kind === 'ai' && PERSONAS.some((p) => p.id === x.persona) && (x.level == null || !!LEVEL_NAME[x.level])))),
};
function loadSettings() {
  const raw = store.json(KEYS.settings, {}, (v) => !!v && typeof v === 'object' && !Array.isArray(v));
  let bad = Object.keys(raw).some((k) => !SETTING_OK[k]);
  for (const k of Object.keys(SETTING_OK)) {
    if (!(k in raw)) continue;
    if (SETTING_OK[k](raw[k])) G.settings[k] = raw[k]; else bad = true;
  }
  // first-run tips are for a newcomer: anyone who already has a save, settings, register, daily or record of this game is not one
  // (the flag is written once a first game starts, so a tab closed mid-tips still counts as a newcomer next time)
  if (typeof raw.tipsSeen !== 'boolean') G.settings.tipsSeen = Object.values(KEYS).some((k) => store.get(k) != null) || (!!window.__TEST__ && !window.__TEST_TIPS__);
  if (bad) store.put(KEYS.settings, G.settings);
  applySettings();
}
function saveSettings() { store.put(KEYS.settings, G.settings); applySettings(); }
function applySettings() {
  const st = G.settings;
  audio.on = !!st.sound; audio.vol = st.vol; audio.fx = st.fx; audio.music = st.music; audio.amb = st.amb; audio.fxVol = st.fxVol; audio.musicVol = st.musicVol;
  syncAudio();
  document.documentElement.style.setProperty('--ts', st.text);
  document.body.classList.toggle('theme-dark', dark());
  document.body.classList.toggle('reduce', reduced());
  const sb = $('#b-sound'); if (sb) { sb.innerHTML = UI.ICON.sound(st.sound); sb.setAttribute('aria-label', st.sound ? 'Sound on (click to mute)' : 'Sound off (click to unmute)'); }
  R.invalidateBoardTexture();
  if (B3.B3.on) B3.setTheme(dark() ? 'dark' : 'light');
  layout();
}

// ---------- boot ----------
// can this browser store anything? (a private window or blocked site data cannot: settings, register and records then last one visit)
function storageBlocked() {
  const ok = store.set('hs-letters-probe', '1');
  if (ok) store.del('hs-letters-probe');
  return !ok;
}
async function boot() {
  G.noSave = storageBlocked();
  // a saved game from a newer version of the game is left alone: this visit writes nothing, under any key, and says so
  G.newerSave = gameSaves.read().kind === 'newer';
  if (G.newerSave) store.frozen = true;
  loadSettings();
  if (window.__TEST__) G.settings.ai = G.settings.ai || 'normal';
  loadArt(() => { R.invalidateBoardTexture(); draw(); if (G.scene === 'title' && !G.dialog) showScene('title'); if (G.scene === 'game') renderGame(); });
  showScene('title');
  const t0 = performance.now();
  G.dict = await loadDict(DICT_B64);
  G.dictMs = Math.round(performance.now() - t0);
  META.words = G.dict.packed; META.added = G.dict.added.length;
  startAi(DICT_B64, LEXICON, { dict: G.dict, lex: G.lex });
  G.ready = true;
  if (G.scene === 'title' && !G.dialog) showScene('title');
  if (G.afterReady) { const f = G.afterReady; G.afterReady = null; f(); }
}

// ---------- saves, register, daily ----------
const gameSaves = createGameSaves(() => window.localStorage, { categories: Object.keys(G.lex.categories) });
const gameHandles = new WeakMap(), saveNotices = new WeakSet();
function saveNotice(s, outcome) {
  if (outcome.ok || !s || saveNotices.has(s)) return;
  saveNotices.add(s);
  if (outcome.reason === 'newer') {
    if (!G.newerTold) { G.newerTold = true; toast({ kind: 'save', title: 'This game is not saved', sub: UI.NEWER_SAVE }); }
    return;
  }
  toast({ kind: 'save', title: 'This game is not saved', sub: outcome.reason === 'conflict' || outcome.reason === 'untrusted-stamp'
    ? 'The saved slot no longer matches this game. This game stays in this tab.'
    : 'Storage is unavailable. This game stays in this tab; keep it open to continue.' });
}
function save(s = G.s) {
  const outcome = gameSaves.save(gameHandles.get(s), s);
  saveNotice(s, outcome);
  return outcome;
}
const loadSave = () => gameSaves.read().game;
const register = () => store.json(KEYS.register, {}, validRegister);
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function dailyInfo() {
  const d = store.json(KEYS.daily, { days: {}, streak: 0, last: null }, validDaily);
  return { ...d, today: d.days[G.dailyDate || today()] || null };
}
// Works out par for a Daily date once (a few turns of each computer player, with a pause between turns so the screen stays
// alive), keeps it with the day's record and refreshes the results sheet if it is showing.
const parBusy = new Set();
async function findPar(date, s) {
  const d0 = store.json(KEYS.daily, { days: {}, streak: 0, last: null }, validDaily);
  if ((d0.days[date] && d0.days[date].par) || parBusy.has(date) || !G.dict) return;
  parBusy.add(date);
  try {
    const par = await dailyPar({ dict: G.dict, lex: G.lex }, date, () => new Promise((r) => setTimeout(r, 0)));
    const d = store.json(KEYS.daily, { days: {}, streak: 0, last: null }, validDaily);
    if (d.days[date]) { d.days[date].par = par; store.put(KEYS.daily, d); }
    if (G.scene === 'over' && G.s === s) showScene('over');
  } catch (e) { /* par is a comparison, never needed to play */ } finally { parBusy.delete(date); }
}
function recordRegister(entry) {
  if (!entry || entry.kind !== 'play') return;
  const p = G.s.players[entry.p];
  if (p.kind !== 'human') return;
  const reg = register();
  for (const w of entry.words) {
    if (!w.themed) continue;
    const r = reg[w.w] || { id: w.themed, first: today(), count: 0, best: 0 };
    r.count++; r.best = Math.max(r.best, w.score + w.bonus);
    reg[w.w] = r;
  }
  store.put(KEYS.register, reg);
}
function recordDaily() {
  const s = G.s;
  const d = store.json(KEYS.daily, { days: {}, streak: 0, last: null }, validDaily);
  const date = s.daily.date, score = s.players[0].score;
  const prev = d.days[date];
  // `first` is the score of the first try on the day (absent on days saved before it was kept); `par` is what Hollis and Maestro Fitch score on the same tiles
  d.days[date] = { score: prev ? Math.max(prev.score, score) : score, plays: (prev ? prev.plays : 0) + 1 };
  if (prev && prev.first != null) d.days[date].first = prev.first; else if (!prev) d.days[date].first = score;
  if (prev && prev.par) d.days[date].par = prev.par;
  if (d.last !== date) {
    const n = nextStreak(d, date);
    d.streak = n.streak; d.rest = n.rest; d.last = date;
  }
  d.days = pruneDays(d.days, undefined, date);
  store.put(KEYS.daily, d);
  return { score, streak: d.streak };
}
// The player's records: read field by field (a damaged number never costs the others), written when a game ends.
const plainObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const stats = () => cleanStats(store.json(KEYS.stats, null, plainObj));
const statsDone = new WeakSet();
function recordStats(s) {
  if (statsDone.has(s)) return;
  statsDone.add(s);
  const r = s.mode === 'daily' ? { stats: applyDaily(stats(), s.players[0].score, G.dailyStreak || 0), pb: null } : applyGame(stats(), s);
  if (s.mode === 'daily' || r.pb) store.put(KEYS.stats, r.stats);
  G.pb = { s, pb: r.pb };
}

// ---------- music and the bed ----------
// the lobby tune on the title and setup, the table tune in play, the results tune after the last move; a sheet opened
// from another screen keeps that screen's tune. The bag running dry quickens the table tune a little, and the steam
// air of the bed thickens as the board fills.
const SHEETS = ['help', 'settings', 'about', 'register', 'records'];
const tuneFor = (name) => (SHEETS.includes(name) ? tuneFor(G.back) : name === 'game' ? 'table' : name === 'over' ? 'finale' : 'lobby');
function moodUpdate() {
  setTune(tuneFor(G.scene));
  const k = audio.kit, s = G.s;
  if (!k) return;
  const live = s && !s.over && G.scene === 'game';
  k.music.intensity(live && s.bag.length === 0 ? 0.7 : 0);
  k.amb.set('steam', live ? Math.min(1, s.board.filter(Boolean).length / 90) : 0.3, 2);
}
const colPan = (i) => ((i % N) - 7) / 7 * 0.7;

// ---------- scenes ----------
function showScene(name, arg) {
  const prev = G.scene;
  if (name !== prev && !SHEETS.includes(name)) G.back = name;
  if (SHEETS.includes(name) && !SHEETS.includes(prev)) G.back = prev;
  G.scene = name;
  moodUpdate();
  cancelDrag(); G.pinch = null; G.pointers.clear();
  closeDialog(true);
  if (name !== 'game') { G.toastQ = []; hideToastNow(); }
  const app = $('#app'), scr = $('#screen');
  const game = name === 'game';
  app.hidden = !game; scr.hidden = game;
  document.body.dataset.scene = name;
  if (game) { renderGame(); layout(); return; }
  scr.innerHTML = screenHtml(name, arg);
  scr.scrollTop = 0;
  wireScreen(name);
  const f = scr.querySelector('.primary, h1, button'); if (f && name !== 'title') f.focus({ preventScroll: true });
}

function screenHtml(name) {
  const lex = G.lex;
  switch (name) {
    case 'title': {
      const sv = loadSave();
      const reg = register();
      const found = lex.data.words.filter((e) => e.forms.some((f) => reg[f])).length;
      const di = dailyInfo();
      const rec = stats();
      return UI.titleHtml({ records: rec.games ? `${UI.plural(rec.games, 'game')} · ${UI.plural(rec.wins, 'win')}` : 'Your wins and bests', noSave: G.noSave, newerSave: G.newerSave, canContinue: !!sv, continueLine: sv ? (sv.mode === 'daily' ? 'Daily Soak in progress' : `${sv.players.map((p) => p.name).join(' vs ')} · move ${sv.move + 1}`) : '', dailyLine: UI.dailyLine(di), found, total: lex.data.words.length, loading: !G.ready });
    }
    case 'setup': return UI.setupHtml(G.setup);
    case 'help': return UI.helpHtml(G.helpTab, lex, twoLetterWords());
    case 'settings': return UI.settingsHtml(G.settings, typeof navigator.vibrate === 'function');
    case 'register': return UI.registerHtml(lex, register(), G.noSave, G.newerSave);
    case 'records': return UI.recordsHtml(stats(), { found: lex.data.words.filter((e) => e.forms.some((f) => register()[f])).length, total: lex.data.words.length, daily: dailyInfo(), today: today() });
    case 'about': return UI.aboutHtml(META);
    case 'over': {
      if (G.s.mode !== 'daily') return UI.overHtml(G.s, lex, null, { pb: pbLines(), review: reviewSeat(G.s) != null, barks: G.s.players.map((p, k) => (p.kind === 'ai' ? endBark(G.s, k) : null)) });
      const d = store.json(KEYS.daily, { days: {}, streak: 0 }, validDaily), date = G.s.daily.date, day = d.days[date];
      const label = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      return UI.overHtml(G.s, lex, { label, best: day ? day.score : G.s.players[0].score, streak: d.streak || 1, rested: d.rest === date, first: day ? day.first : null, plays: day ? day.plays : 1, par: day ? day.par || null : null }, { review: reviewSeat(G.s) != null });
    }
  }
  return '';
}

function defaultSetup() {
  const last = G.settings.lastSetup;
  return last ? JSON.parse(JSON.stringify(last)) : { seats: [{ kind: 'human', name: '' }, { kind: 'ai', persona: 'hollis' }], hints: true };
}

function wireScreen(name) {
  const scr = $('#screen');
  scr.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
  scr.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', back));
  if (name === 'setup') {
    const st = G.setup;
    scr.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => {
      const k = +b.dataset.k; const seat = st.seats[k];
      if (b.dataset.kind === 'human') { seat.kind = 'human'; seat.name = seat.name || ''; }
      else { seat.kind = 'ai'; seat.persona = seat.persona || PERSONAS[(k + 1) % PERSONAS.length].id; }
      showScene('setup');
    }));
    scr.querySelectorAll('[data-name]').forEach((inp) => inp.addEventListener('input', () => { st.seats[+inp.dataset.name].name = inp.value; }));
    scr.querySelectorAll('[data-persona]').forEach((b) => b.addEventListener('click', () => { st.seats[+b.dataset.persona].persona = b.dataset.val; showScene('setup'); scr.querySelector(`[data-persona="${b.dataset.persona}"][data-val="${b.dataset.val}"]`).focus(); }));
    // the four portrait cards are one radio group: the arrow keys move to the neighbour and choose it (Tab leaves the group)
    scr.querySelectorAll('[data-persona]').forEach((b) => b.addEventListener('keydown', (e) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!step || e.altKey || e.ctrlKey || e.metaKey) return;
      const cards = [...b.parentElement.querySelectorAll('[data-persona]')];
      e.preventDefault();
      cards[(cards.indexOf(b) + step + cards.length) % cards.length].click();
    }));
    scr.querySelectorAll('[data-level]').forEach((sel) => sel.addEventListener('change', () => { st.seats[+sel.dataset.level].level = sel.value; showScene('setup'); scr.querySelector(`[data-level="${sel.dataset.level}"]`).focus(); }));
    scr.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => { st.seats.splice(+b.dataset.remove, 1); showScene('setup'); }));
    const add = scr.querySelector('[data-add]');
    if (add) add.addEventListener('click', () => { const used = new Set(st.seats.map((x) => x.persona)); st.seats.push({ kind: 'ai', persona: (PERSONAS.find((p) => !used.has(p.id)) || PERSONAS[0]).id }); showScene('setup'); });
    scr.querySelector('[data-hints]').addEventListener('change', (e) => { st.hints = e.target.checked; scr.querySelector('[data-hints-unl]').disabled = !e.target.checked; });
    scr.querySelector('[data-hints-unl]').addEventListener('change', (e) => { st.hintsUnl = e.target.value === 'unl'; });
    scr.querySelector('[data-challenge]').addEventListener('change', (e) => { st.challenge = e.target.checked; });
    scr.querySelector('[data-start]').addEventListener('click', () => {
      G.settings.lastSetup = st; saveSettings();
      replaceSave(() => newGame({ mode: 'play', hintsUnl: !!st.hintsUnl, challenge: !!st.challenge, seats: st.seats.map((x, k) => (x.kind === 'human' ? { kind: 'human', name: (x.name || '').trim() || (st.seats.filter((y) => y.kind === 'human').length > 1 ? `Player ${k + 1}` : 'You') } : { kind: 'ai', persona: x.persona, level: seatLevel(x), name: persona(x.persona).name })), hints: st.hints }));
    });
  }
  if (name === 'help') {
    const wc = scr.querySelector('[data-wordcheck]');
    if (wc) wc.addEventListener('submit', (e) => { e.preventDefault(); wc.querySelector('.wc-out').textContent = wordCheck(wc.querySelector('input').value); });
  }
  if (name === 'help') scr.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { G.helpTab = b.dataset.tab; showScene('help'); scr.querySelector(`[data-tab="${G.helpTab}"]`).focus(); }));
  if (name === 'settings') {
    scr.querySelectorAll('[data-set]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.set, raw = b.dataset.val;
      G.settings[k] = raw === 'true' ? true : raw === 'false' ? false : isNaN(+raw) ? raw : +raw;
      saveSettings(); showScene('settings'); scr.querySelector(`[data-set="${k}"][data-val="${raw}"]`).focus();
      if (['sound', 'fx', 'music', 'amb'].includes(k)) unlock();
      if (k === 'sound' && G.settings.sound) sfx('place');
      if (k === 'board3d') B3.want(G.settings.board3d);
      if (k === 'vibrate') buzz('stage');
    }));
    const again = scr.querySelector('[data-tips]');
    again.addEventListener('click', () => {
      G.settings.tipsSeen = false; G.coach = null; saveSettings();
      again.textContent = 'Tips will show in a game'; liveSay('The tips will show again in your game.');
    });
    // Volume is the master; the effects and music levels sit under it (the music level moves the bed with the tunes)
    for (const [attr, key] of [['data-vol', 'vol'], ['data-fxvol', 'fxVol'], ['data-musicvol', 'musicVol']]) {
      const r = scr.querySelector(`[${attr}]`);
      r.addEventListener('input', (e) => { G.settings[key] = +e.target.value; saveSettings(); });
      if (key !== 'musicVol') r.addEventListener('change', () => sfx('place'));
    }
  }
  if (name === 'register') scr.querySelectorAll('[data-reg]').forEach((b) => b.addEventListener('click', () => openFact(b.dataset.reg)));
  if (name === 'over') {
    scr.querySelectorAll('[data-fact]').forEach((b) => b.addEventListener('click', () => openFact(b.dataset.fact, b.dataset.form)));
    scr.querySelector('[data-review]')?.addEventListener('click', openReview);
    const again = scr.querySelector('[data-again]');
    if (again) again.addEventListener('click', () => newGame({ mode: 'play', seats: G.s.players.map((p) => ({ kind: p.kind, name: p.name, persona: p.persona, level: p.level })), hints: G.s.players.some((p) => p.hints != null), hintsUnl: G.s.players.some((p) => p.unl), challenge: !!G.s.challenge }));
  }
}

function go(where) {
  unlock();
  if (where === 'continue') { const record = gameSaves.read(); if (record.game) resumeGame(record); return; }
  if (where === 'setup') { G.setup = defaultSetup(); showScene('setup'); return; }
  if (where === 'daily') { replaceSave(() => startDaily()); return; }
  if (where === 'title' && G.scene === 'game' && !save().ok) {
    confirmDialog('Leave without saving?', 'This tab could not save its game. Stay here to keep playing, or leave without saving this game.', 'Leave', () => showScene('title'));
    return;
  }
  showScene(where);
}
// the single save slot holds one game: starting another (New game, Daily Soak) ends the one in progress, so ask first
function replaceSave(start) {
  const sv = loadSave();
  if (!sv) { start(); return; }
  const what = sv.mode === 'daily' ? 'your Daily Soak' : `your game with ${sv.players.map((p) => p.name).join(' and ')}`;
  confirmDialog('Replace your game in progress?', `Starting a new game ends ${what} (move ${sv.move + 1}). It cannot be continued afterwards.`, 'Start new', start);
}
function back() { showScene(G.back && G.back !== G.scene ? G.back : 'title'); }

// ---------- starting games ----------
function whenReady(f) { if (G.ready) f(); else { G.afterReady = f; showScene('title'); } }
function newGame(opts) {
  const intent = gameSaves.newIntent();
  whenReady(() => {
    const seed = G.nextSeed != null ? G.nextSeed : (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    G.nextSeed = null;
    const s = E.createGame({ ...opts, seed }, G.lex);
    if (opts.hints === false) for (const p of s.players) p.hints = null;
    for (const p of s.players) if (p.kind !== 'human') p.hints = null;
    if (opts.hints !== false && opts.hintsUnl) for (const p of s.players) if (p.kind === 'human') { p.unl = true; p.taken = 0; }
    beginGame(s, intent);
  });
}
function startDaily(date) {
  const intent = gameSaves.newIntent();
  whenReady(() => {
    G.dailyDate = date || today();
    const s = E.createGame({ mode: 'daily', date: G.dailyDate, seats: [{ kind: 'human', name: 'You' }] }, G.lex);
    s.players[0].hints = null;
    beginGame(s, intent);
  });
}
function resumeGame(record) { whenReady(() => beginGame(record.game, record)); }
function beginGame(s, intent) {
  if (!G.settings.tipsSeen) store.put(KEYS.settings, G.settings); // the newcomer flag is written before the first save, so a tab closed mid-tips still counts as a newcomer
  G.bark = null;
  const handle = gameSaves.open(s, intent);
  gameHandles.set(s, handle);
  G.s = s;
  G.staged = []; G.selected = null; G.hint = null; G.hintAlts = null; G.preview = null; G.anim.clear(); G.last = new Set(lastTiles(s));
  G.revealed = -1; G.lastHuman = -1; G.privacy = false;
  resetOrder();
  if (!turnPrivacy()) restoreHint(s);
  R.view.zoom = 1; R.view.cx = R.U / 2; R.view.cy = R.U / 2;
  showScene('game');
  saveNotice(s, gameSaves.status(handle));
  startTurn();
}
// A hint taken this turn comes back after a reload, put on the board as it was (only if it still fits: the rack, the board and the turn).
function restoreHint(s) {
  const h = s.hintStaged;
  if (!h || h.move !== s.move || s.over || cur().kind !== 'human' || G.staged.length || !Array.isArray(h.tiles) || h.tiles.length > RACK) return;
  const used = new Set(), seen = new Set(), staged = [];
  for (const t of h.tiles) {
    if (!t || !Number.isInteger(t.i) || t.i < 0 || t.i >= N * N || s.board[t.i] || seen.has(t.i) || typeof t.l !== 'string' || !/^[A-Z]$/.test(t.l)) return;
    const k = cur().rack.findIndex((l, j) => (t.blank ? l === '?' : l === t.l) && !used.has(j));
    if (k < 0) return;
    used.add(k); seen.add(t.i); staged.push({ k, i: t.i, l: t.l, blank: !!t.blank });
  }
  G.staged = staged; G.order = G.order.filter((x) => !used.has(x));
}
const lastTiles = (s) => { const e = [...s.log].reverse().find((x) => x.kind === 'play'); return e ? e.tiles.map((t) => t.i) : []; };
const cur = () => G.s.players[G.s.cur];
const humans = () => G.s.players.filter((p) => p.kind === 'human').length;
// the rack order and staging belong to one move (orderMove), so a turn's start never wipes what the player already did
// While the one computer opponent plays, the person's own rack stays in view and theirs to rearrange (waitSeat); the order they
// leave it in (G.kept) is the one the rack has when their turn comes round, if the tiles are still the same.
const waitSeat = () => (G.s && !G.s.over && cur().kind === 'ai' && humans() === 1 ? G.s.players.find((p) => p.kind === 'human') : null);
const waiting = () => !!waitSeat() && G.scene === 'game' && !G.dialog && !G.privacy;
function resetOrder() {
  const w = G.s ? waitSeat() : null, rack = G.s ? (w || cur()).rack : [], kept = G.kept;
  G.kept = null;
  const same = !w && kept && kept.key === rack.join('') && kept.order.length === rack.length && rack.every((_, k) => kept.order.includes(k));
  G.order = same ? [...kept.order] : rack.map((_, k) => k);
  G.staged = []; G.selected = null; G.orderMove = G.s ? G.s.move : -1;
}
// pass and play: hide the rack until the next person is ready
const turnPrivacy = () => cur().kind === 'human' && humans() >= 2 && G.revealed !== G.s.cur;

// ---------- turn flow ----------
function startTurn() {
  const s = G.s;
  clearTimeout(G.aiTimer); G.aiHeld = null; G.aiFire = null;
  // a new turn drops any AI reply still on its way (it carries the old token) and any tile still in the air from an
  // earlier move; tiles the player placed while the last move's tiles were landing stay where they are
  G.aiToken++; G.aiBusy = false;
  if (G.drag && G.drag.move !== s.move) cancelDrag();
  if (s.over) { finishGame(); return; }
  if (G.orderMove !== s.move) resetOrder();
  G.hint = null;
  updatePreview();
  if (cur().kind === 'ai') { G.privacy = false; renderGame(); scheduleAi(); return; }
  G.privacy = turnPrivacy();
  renderGame();
}

function scheduleAi() {
  const s = G.s;
  G.aiBusy = true; G.aiSkip = false;
  renderPreview();
  const delay = G.fast ? 0 : ({ normal: 700, fast: 250, instant: 0 })[G.settings.ai] ?? 700;
  const t0 = performance.now();
  const seat = s.cur, move = s.move, token = ++G.aiToken;
  const live = () => token === G.aiToken && G.s === s && s.move === move && s.cur === seat && !s.over;
  const act = (action) => {
    G.aiBusy = false;
    const res = E.apply(s, action, ctx());
    if (!res.ok) { console.warn('AI move refused', res.error); E.apply(s, { type: 'pass' }, ctx()); }
    afterAction(res.ok ? res.entry : s.log[s.log.length - 1], true);
  };
  aiMove(s, cur().level, cur().persona).then((r) => {
    const wait = G.aiSkip ? 0 : Math.max(0, delay - (performance.now() - t0));
    const fire = () => {
      G.aiFire = null;
      if (!live()) { if (token === G.aiToken) G.aiBusy = false; return; }
      s.rng.ai = r.rngAi;
      act(r.action);
    };
    // a hidden tab, or an open menu or ledger, holds the reply (and its cue) until the player is back
    G.aiFire = fire;
    G.aiTimer = setTimeout(() => { if (document.hidden || G.dialog) { G.aiFire = null; G.aiHeld = fire; } else fire(); }, wait);
  }).catch((err) => { console.warn('AI failed, passing', err); if (live()) act({ type: 'pass' }); });
}

// A tap on the board, or Space or Enter, while the computer is taking its turn lets its move land at once (the same path as the
// Instant speed, for this move only): the wait for its reply, then the tiles flying in and the hand-over beat. Never during a menu.
function skipComputerWait() {
  if (G.scene !== 'game' || G.dialog || !G.s || G.s.over || G.privacy) return false;
  if (G.aiBusy) {
    G.aiSkip = true;   // the reply is still being worked out: it lands the moment it is ready
    if (G.aiFire) { clearTimeout(G.aiTimer); const f = G.aiFire; G.aiFire = null; f(); }
    return true;
  }
  if (G.turnWait && G.turnWait.fromAi && performance.now() < G.busyUntil) {
    clearTimeout(G.turnWait.id); G.turnWait = null;
    G.anim.clear(); G.animUntil = 0; G.busyUntil = 0;
    startTurn();
    return true;
  }
  return false;
}

// lets a held reply land once the tab is back and no dialog is open
function releaseAi() {
  if (!G.aiHeld || document.hidden || G.dialog) return;
  const f = G.aiHeld; G.aiHeld = null; f();
}

const ctx = () => ({ dict: G.dict, lex: G.lex });

// run `fn` in `ms` milliseconds, as a sound that waits for the tiles to land; it is dropped if another game has begun by then
const later = (g, ms, fn) => { if (ms <= 0) fn(); else setTimeout(() => { if (G.s === g) fn(); }, ms); };

function afterAction(entry, fromAi) {
  const s = G.s;
  cancelDrag();
  G.flash = null;
  const said = s.players[entry.p].kind === 'ai' ? barkFor(s, entry) : null;
  G.bark = said ? { ...said, persona: s.players[entry.p].persona } : null;
  if (entry.kind === 'play' && s.players[entry.p].kind === 'human') coachPlayed();
  // the next player's rack is ready at once (the move is applied), even while the tiles are still landing
  resetOrder(); G.hint = null; G.breakdown = false; delete s.hintStaged;
  G.deal = !fromAi && entry.kind !== 'pass' && humans() === 1;
  if (!s.over && cur().kind === 'human') G.privacy = turnPrivacy();
  // seconds until the computer's tiles have landed (nothing to wait for on a pass or swap, or with animation off)
  const landed = fromAi && animOn() && entry.kind === 'play' ? (entry.tiles.length * 90 + 200) / 1000 : 0;
  if (entry.kind === 'play') {
    G.last = new Set(entry.tiles.map((t) => t.i)); G.lastPulse = null;
    if (fromAi && animOn()) {
      const t0 = performance.now();
      entry.tiles.forEach((t, k) => G.anim.set(t.i, { t0: t0 + k * 90, dur: 320 }));
      G.animUntil = t0 + entry.tiles.length * 90 + 340;
      G.lastPulse = { t0: G.animUntil - 20, dur: 900 };
      entry.tiles.forEach((t, k) => setTimeout(() => sfx('place', { pan: colPan(t.i), step: k }), k * 90 + 200 + Math.floor(Math.random() * 24)));
      tick();
    } else sfx('play', { pan: colPan(Math.round(entry.tiles.reduce((a, t) => a + (t.i % N), 0) / entry.tiles.length)) });
    celebrate(entry, G.bark, landed);
    try { recordRegister(entry); } catch (e) { /* the register is a keepsake: a failed write never stops the game */ }
  } else {
    sfx(entry.kind === 'swap' ? 'swap' : 'turn');
  }
  if (fromAi && !s.over && cur().kind === 'human') later(s, landed * 1000 + 300, () => { if (!s.over && cur().kind === 'human') sfx('yourturn'); });   // the hand-over, once the computer's move has landed
  announce(entry);
  moodUpdate();
  if (cur().kind === 'human' && !fromAi) G.lastHuman = s.cur;
  save(s);
  rollScores();
  const wait = G.fast ? 0 : (fromAi && animOn() ? Math.max(0, G.animUntil - performance.now()) + 250 : 150);
  G.busyUntil = performance.now() + wait;
  G.turnWait = { fromAi, id: setTimeout(() => { G.turnWait = null; if (G.s === s) startTurn(); }, wait) };
  renderGame();
}

// A game is finished once. More than one start-of-turn timer can still be pending when the last move lands (a move
// played while the tiles of the one before were in the air); without this each of them replayed the fanfare, counted a
// Daily Soak again and brought the results screen back after the player had left it.
const finishedGames = new WeakSet();
function finishGame() {
  const s = G.s;
  if (finishedGames.has(s)) return;
  finishedGames.add(s);
  save(s);
  if (s.mode === 'daily') { G.dailyStreak = recordDaily().streak; findPar(s.daily.date, s); }
  try { recordStats(s); } catch (e) { /* the records are a keepsake: a failed write never stops the game */ }
  const humanWon = s.result.winners.some((k) => s.players[k].kind === 'human');
  sfx(humanWon || s.mode === 'daily' ? 'fanfare' : 'turn');
  setTimeout(() => { if (G.s === s) showScene('over'); }, G.fast ? 0 : 900);
}

// What the finished game set, for the results screen ("new personal best").
function pbLines() {
  const r = G.pb && G.pb.s === G.s ? G.pb.pb : null;
  if (!r) return [];
  const st = stats(), out = [];
  if (r.first) out.push('First game on your record.');
  if (r.held) out.push('You took a hint, so this game sets no personal best.');
  if (r.score) out.push(`New personal best: ${st.bestScore} points.`);
  if (r.play) out.push(`New best turn: ${st.bestPlay.score} points for ${st.bestPlay.word}.`);
  if (r.word) out.push(`New best word: ${st.bestWord.word}, ${st.bestWord.score} points.`);
  return out;
}

const STING_LAG = 0.28;   // seconds: the score sting follows the clacks of the tiles instead of landing on them
// Toasts and effects for a play: Full Soak, Hot Springs words, a Featured Spring.
// `wait` is the seconds the computer's tiles take to land: the cues (not the toasts) hold back until they have
function celebrate(e, bark, wait = 0) {
  const s = G.s, cue = (name, opts) => later(s, wait * 1000, () => sfx(name, opts));
  const p = G.s.players[e.p];
  const themed = e.words.filter((w) => w.themed);
  let found = false;
  if (p.kind === 'human' && (e.full || e.featured)) buzz('big');
  const who = bark ? { p, k: e.p } : null, quote = (ev) => (bark && bark.event === ev ? `“${bark.text}”` : null);
  if (e.featured) { toast({ kind: 'featured', who, title: `Featured Spring: ${e.featured}`, sub: `${quote('themed') || `${p.name} found it`} · +${FEATURED_BONUS}`, fact: G.lex.entry(e.featured)?.id, form: e.featured }); cue('featured'); }
  for (const w of themed) {
    const entry = G.lex.byId.get(w.themed);
    const fresh = p.kind === 'human' && !register()[w.w];   // celebrate runs before recordRegister: this is the first time the word is signed in
    if (fresh) found = true;
    toast({ kind: 'themed', title: `${w.w} +${w.bonus}${w.bath ? ` · Row +${ROW_BONUS}` : ''}`, sub: fresh ? 'New in your Register' : G.lex.categories[entry.cat].name, fact: entry.id, form: w.w });
    steamBurst(e.tiles.map((t) => t.i));
  }
  if (themed.length) goldSweep(e.tiles.map((t) => t.i));
  if (themed.length && !e.featured) cue('steam');
  if (e.full) { toast({ kind: 'soak', who, title: `Full Soak! +${FULL_SOAK}`, sub: quote('soak') || `${p.name} used all seven tiles.` }); cue('chime'); }
  // one sting a play: a Featured Spring or a Full Soak has its own, then a word new to the Register, then the size of the score
  const done = p.kind === 'human' ? UI.categoriesCompleted(G.lex, register(), e.words) : [];
  for (const ck of done) toast({ kind: 'themed', title: `${G.lex.categories[ck].name}: complete`, sub: 'All its words are in your Register.', keep: true });
  const st = done.length && !e.featured && !e.full ? 'fanfare' : UI.stingFor(e, found); if (st) cue(st, { delay: STING_LAG });
  if (!e.full && bark && bark.event === 'big') toast({ kind: 'bark', who, title: `${p.name}: ${e.words[0].w} +${e.score}`, sub: quote('big') });
  scorePop(e, themed.length > 0);
}

function announce(e) {
  const p = G.s.players[e.p];
  let t;
  if (e.kind === 'play') t = `${p.name} played ${e.words.map((w) => w.w).join(' and ')} for ${e.score}${e.themed ? `, including a Hot Springs bonus of ${e.themed}` : ''}${e.full ? ', with a Full Soak' : ''}.`;
  else if (e.challenge) t = `${p.name} played ${e.challenge}, which is not in the dictionary, and lost the turn.`;
  else t = e.kind === 'swap' ? `${p.name} swapped ${UI.plural(e.count, 'tile')}.` : `${p.name} passed.`;
  const live = $('#live'); live.textContent = ''; setTimeout(() => { live.textContent = t; }, 30);
  G.lastLine = t;
}

// ---------- staging ----------
const stagedTiles = () => G.staged.map((t) => ({ i: t.i, l: t.l, blank: t.blank }));
function updatePreview() {
  if (G.flash) { G.flash = null; clearTimeout(flashTimer); }
  if (!G.s || !G.staged.length) { G.preview = null; return; }
  // a Challenge game does not say whether the words are in the dictionary until they are played
  G.preview = E.evaluate(G.s, stagedTiles(), G.s.challenge ? { ...ctx(), skipDict: true } : ctx());
}
function stage(k, i, letter) {
  const s = G.s;
  if (!s || s.over || cur().kind !== 'human') return false;
  const l = cur().rack[k];
  if (l == null || i < 0 || s.board[i] || G.staged.some((t) => t.i === i || t.k === k)) return false;
  if (l === '?' && !letter) { askBlank((ch) => stage(k, i, ch)); return true; }
  G.staged.push({ k, i, l: l === '?' ? letter : l, blank: l === '?' });
  G.order = G.order.filter((x) => x !== k);
  G.selected = null; G.hint = null;
  forgetHint(s);
  clearToasts();
  if (animOn()) { const now = performance.now(); G.settle.set(i, now); G.settleUntil = now + 130; }
  sfx('place', { pan: colPan(i) }); buzz('stage');
  updatePreview(); renderStaging();
  return true;
}
function unstage(i, toPos) {
  const t = G.staged.find((x) => x.i === i);
  if (!t) return;
  G.staged = G.staged.filter((x) => x !== t);
  forgetHint(G.s);
  clearToasts();
  if (toPos != null) G.order.splice(toPos, 0, t.k); else G.order.push(t.k);
  sfx('recall');
  updatePreview(); renderStaging();
}
// a paid hint comes back after a reload only while its tiles are untouched: taking them back, or staging another tile, ends it
function forgetHint(s) { if (s && s.hintStaged) { delete s.hintStaged; save(s); } }
function recallAll() { if (!G.staged.length) return; for (const t of [...G.staged]) G.order.push(t.k); G.staged = []; forgetHint(G.s); sfx('recall'); updatePreview(); renderStaging(); }
function shuffleRack() {
  const o = G.order;
  for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
  sfx('shuffle'); renderRack();
}

function humanCanAct() { return G.s && !G.s.over && cur().kind === 'human' && !G.aiBusy && !G.hintBusy && !G.privacy && G.scene === 'game' && !G.dialog; }

function doPlay() {
  if (!humanCanAct()) return;
  cancelDrag();   // a staged tile still in the air goes back to its square and counts
  if (!G.staged.length) { flash('Place tiles on the board first.'); oops(); return; }
  const r = E.apply(G.s, { type: 'play', tiles: stagedTiles() }, ctx());
  if (!r.ok && r.badWord && G.s.challenge) { loseTurn(r.badWord); return; }
  if (!r.ok) { flash(r.error); oops(); shake(); return; }
  buzz('play');
  afterAction(r.entry, false);
}
// Challenge: the word was not in the dictionary, so the play is not made and the turn is lost, as if the player had passed
function loseTurn(word) {
  const r = E.apply(G.s, { type: 'pass' }, ctx());
  if (!r.ok) return;
  r.entry.challenge = word;
  oops(); shake();
  afterAction(r.entry, false);
}
function doPass() {
  if (!humanCanAct()) return;
  if (G.staged.length) recallAll();
  confirmDialog('Pass this turn?', `You keep your tiles and score nothing.${UI.stallNote(G.s, true) ? ` ${UI.stallNote(G.s, true)}` : ''}`, 'Pass', () => { const r = E.apply(G.s, { type: 'pass' }, ctx()); if (r.ok) afterAction(r.entry, false); });
}
function doSwap() {
  if (!humanCanAct()) return;
  if (G.s.bag.length < RACK) { flash('You can swap only while the bag holds at least seven tiles.'); oops(); return; }
  recallAll();
  openDialog('swap');
}
async function doHint() {
  if (!humanCanAct()) return;
  const p = cur();
  if (p.hints == null || (p.hints <= 0 && !p.unl)) return;
  cancelDrag();
  recallAll();
  // staging is locked (humanCanAct) until the hint arrives, so it can't land on top of new tiles
  const s = G.s, move = s.move;
  G.hintBusy = true; renderStaging();
  let list = [];
  try { list = (await aiHint(s)) || []; } catch (err) { console.warn('hint failed', err); }
  G.hintBusy = false;
  if (G.s !== s || s.move !== move || !humanCanAct()) { renderPreview(); return; }
  recallAll();
  if (!list.length) { flash('No play found. Try a swap.'); renderStaging(); return; }
  if (p.unl) p.taken++; else p.hints--;
  sfx('hint');
  G.hintAlts = list; G.hintIx = 0; G.hintMove = s.move;   // the other plays are free to look at: the one hint was paid for
  putHint(list[0]);
}
// A Spring Guide play becomes a staged play the player can accept with Play, move, or recall.
function putHint(m) {
  const s = G.s;
  recallAll();
  for (const t of m.tiles) {
    const k = cur().rack.findIndex((l, j) => (t.blank ? l === '?' : l === t.l) && !G.staged.some((x) => x.k === j));
    if (k >= 0) { G.staged.push({ k, i: t.i, l: t.l, blank: t.blank }); G.order = G.order.filter((x) => x !== k); }
  }
  G.hint = null; clearToasts();
  s.hintStaged = { move: s.move, tiles: G.staged.map((t) => ({ i: t.i, l: t.l, blank: t.blank })) };   // kept in the save: the hint is paid for, so a reload must not lose it
  updatePreview(); save(s); renderGame();
  const keep = m.keep.length ? m.keep.map((l) => (l === '?' ? 'a blank' : l)).join('') : 'no tiles';
  liveSay(`Spring Guide: ${m.words[0]} for ${m.score}, keeping ${keep}. Play it or take the tiles back.${hintLive() ? ' Press Other plays for another idea.' : ''}`);
}
// the hint on the board while its other plays can still be cycled (same turn, the tiles untouched)
const hintLive = () => {
  const a = G.hintAlts, s = G.s;
  if (!a || a.length < 2 || !s || s.over || s.move !== G.hintMove || !G.staged.length) return false;
  const shown = a[G.hintIx].tiles;
  return shown.length === G.staged.length && shown.every((t) => G.staged.some((x) => x.i === t.i && x.l === t.l));
};
function hintNext() {
  if (!hintLive() || !humanCanAct()) return;
  G.hintIx = (G.hintIx + 1) % G.hintAlts.length;
  putHint(G.hintAlts[G.hintIx]);
}

// ---------- rendering ----------
// what a staging change touches; renderGame also rebuilds the scores, plaques and ledger
function renderStaging() {
  if (G.scene !== 'game' || !G.s) return;
  renderActions(); renderRack(); renderPreview();
  coachRender();
  draw();
  startSteam();
}
function renderGame() {
  if (G.scene !== 'game' || !G.s) return;
  const s = G.s;
  const mobile = isNarrow();
  $('#scores').innerHTML = mobile ? '' : UI.scoresHtml(s, false);
  $('#springs').innerHTML = UI.springsHtml(s, G.lex, mobile);
  $('#springs').querySelectorAll('[data-plaque]').forEach((b) => b.addEventListener('click', () => {
    const f = s.featured[+b.dataset.plaque];
    if (G.coach && G.coach.phase === 'plaques') coachDismiss('plaques');
    if (f.by != null) openFact(G.lex.entry(f.word).id, f.word);
    else flash(`Featured Spring: ${f.word.length} letters, ${G.lex.categories[f.cat].name}. Form it to claim +${FEATURED_BONUS}.`);
  }));
  $('#log').innerHTML = UI.logHtml(s, G.lex) || '<li class="empty">Every play is written here: the words, the points, and any Hot Springs bonus.</li>';
  requestAnimationFrame(trimLedger);
  const bagLine = `${UI.plural(s.bag.length, 'tile')} in the bag${s.daily ? ` · turn ${E.DAILY_TURNS - s.daily.turns + 1} of ${E.DAILY_TURNS}` : ''}`;
  $('#turnline').innerHTML = mobile
    ? `<span class="chips">${UI.scoresHtml(s, true)}</span><span class="bag">${s.over ? 'Game over' : `${esc(cur().name)}${cur().kind === 'ai' ? '' : ' to play'} · ${bagLine}`}</span>`
    : s.over ? 'Game over' : `<span class="who">${esc(cur().name)}${cur().kind === 'ai' ? '' : ' to play'}</span><span class="bag">${bagLine}</span>`;
  renderActions(); renderRack(); renderPreview(); renderPrivacy();
  coachRender();
  draw();
  startSteam();
}

// The ledger shows whole entries only; the full ledger is in the menu.
function trimLedger() {
  const box = $('#ledger'), list = $('#log');
  if (!box || !list) return;
  for (const li of list.children) li.hidden = false;
  const bottom = box.getBoundingClientRect().bottom - 12;
  let hide = false;
  for (const li of list.children) { if (!hide && li.getBoundingClientRect().bottom > bottom) hide = true; if (hide && li !== list.firstElementChild) li.hidden = true; }
}

function renderActions() {
  const s = G.s, p = cur(), human = p.kind === 'human' && !G.privacy;
  const el = $('#actions');
  el.innerHTML = UI.actionsHtml({ staged: G.staged.length > 0, canSwap: s.bag.length >= RACK, canPlay: G.staged.length > 0 && G.preview && G.preview.ok, hints: p.hints != null && p.kind === 'human' ? p.hints : null, unlimited: !!p.unl });
  el.classList.toggle('waiting', !human || s.over);
  el.querySelectorAll('[data-act]').forEach((b) => {
    if ((!human || s.over) && !(b.dataset.act === 'shuffle' && waitSeat())) b.disabled = true;
    b.addEventListener('click', () => { unlock(); ({ play: doPlay, pass: doPass, swap: doSwap, hint: doHint, recall: recallAll, shuffle: shuffleRack })[b.dataset.act](); });
  });
}

function renderRack() {
  const el = $('#rack');
  if (!G.s) return;
  const p = cur();
  const show = p.kind === 'human' && !G.privacy;
  // whose rack shows: the current human's; during AI turns, the last human's tiles stay visible but dimmed
  const wait = waitSeat();
  let rack = p.rack, order = G.order, dim = false;
  if (!show) {
    const hk = G.s.players.findIndex((x) => x.kind === 'human');
    if (wait) { rack = wait.rack; dim = true; G.kept = { key: rack.join(''), order: [...order] }; }
    else if (hk >= 0 && humans() === 1) { rack = G.s.players[hk].rack; order = rack.map((_, k) => k); dim = true; } else { rack = []; order = []; }
  }
  const size = rackTileSize(), px = Math.round(size * dpr());
  let dealt = 0;   // a rack the move has just refilled fades in tile by tile
  el.style.setProperty('--tile', size + 'px');
  el.classList.toggle('dim', dim); el.classList.toggle('live', !!wait);
  // Buttons are reused per tile, never rebuilt wholesale, and the one a finger lifted a tile from stays in the page
  // (hidden) until the drag ends: iOS WebKit sends the rest of a touch to the node it began on, and a removed node
  // never passes the pointerup on, which left tiles stuck in the air.
  const d = G.drag, lifted = (show || wait) && d && d.active && d.from === 'rack' && !order.includes(d.k) ? d.k : null;
  const old = new Map([...el.querySelectorAll('.rtile')].map((b) => [b.dataset.key, b]));
  const button = (k) => {
    const l = rack[k], key = `${k}|${l}|${px}|${dim ? (wait ? 2 : 1) : 0}`;
    let b = old.get(key);
    if (b) { old.delete(key); return b; }
    b = document.createElement('button');
    b.className = 'rtile'; b.dataset.key = key; b.dataset.k = k;
    if (G.deal && animOn()) { b.classList.add('deal'); b.style.setProperty('--i', String(dealt++)); b.addEventListener('animationend', () => b.classList.remove('deal')); }
    b.setAttribute('aria-label', l === '?' ? 'Blank tile' : `${l}, ${E.tileValue(l)} points`);
    if (dim) { b.tabIndex = -1; b.disabled = !wait; }
    const c = document.createElement('canvas'); c.width = c.height = px;
    c.getContext('2d').drawImage(R.tileSprite(l === '?' ? '' : l, l === '?', px, 'rack'), 0, 0);
    b.append(c);
    if (!dim || wait) b.addEventListener('pointerdown', (e) => rackDown(e, k));
    b.addEventListener('click', (e) => { if (e.detail === 0 && !dim) { G.selected = G.selected === k ? null : k; renderRack(); } }); // keyboard activation
    return b;
  };
  const seq = order.map((k, pos) => {
    const b = button(k);
    b.dataset.pos = pos; b.classList.remove('lifted'); b.classList.toggle('sel', G.selected === k);
    b.setAttribute('aria-pressed', G.selected === k); b.style.visibility = G.returning === k ? 'hidden' : '';
    return b;
  });
  // the lifted tile leaves its own place empty until the drag ends, so the others do not slide about under the finger
  const hole = lifted != null && d.pos0 != null ? Math.min(d.pos0, seq.length) : -1;
  if (hole >= 0) { const x = document.createElement('span'); x.className = 'rslot'; x.setAttribute('aria-hidden', 'true'); seq.splice(hole, 0, x); }
  const keep = lifted != null ? button(lifted) : null;
  if (keep) { keep.classList.add('lifted'); delete keep.dataset.pos; }
  for (const b of old.values()) b.remove();
  el.querySelectorAll('.rslot').forEach((x) => x.remove());
  for (let n = RACK - order.length - (hole >= 0 ? 1 : 0); n > 0; n--) { const x = document.createElement('span'); x.className = 'rslot'; x.setAttribute('aria-hidden', 'true'); seq.push(x); }
  // place everything in order around the kept node without ever moving it
  let ref = el.firstChild;
  for (const n of seq) {
    while (ref && ref === keep) ref = ref.nextSibling;
    if (n === ref) { ref = ref.nextSibling; continue; }
    el.insertBefore(n, ref);
  }
  if (keep && !keep.isConnected) el.append(keep);
  G.deal = false;
}

function renderPreview() {
  const el = $('#preview');
  if (!el || !G.s) return;
  let html = '', cls = '';
  if (G.s.over) html = 'Game over';
  else if (G.aiBusy) { html = `<span class="thinking">${esc(cur().name)} is thinking<i>.</i><i>.</i><i>.</i></span>`; cls = 'ai'; }
  else if (G.hintBusy) html = '<span class="thinking">Consulting the Spring Guide<i>.</i><i>.</i><i>.</i></span>';
  else if (G.flash) { html = esc(G.flash); cls = 'flash'; }
  else if (G.preview) {
    const p = G.preview;
    if (p.ok) {
      html = `<span class="words">${p.words.map((w) => `<b class="${w.themed ? 'themed' : ''}">${w.w}</b>`).join(' ')}</span><span class="pts">${p.score}<small> pts</small></span>${p.themed ? `<span class="extra">${UI.ICON.steam} +${p.themed}</span>` : ''}${p.full ? `<span class="extra">Full Soak +${FULL_SOAK}</span>` : ''}${p.featured ? `<span class="extra">Featured +${FEATURED_BONUS}</span>` : ''}${G.s.challenge ? '<span class="extra">words checked when you play</span>' : ''}`;
      if (hintLive()) html += `<span class="extra">keeps ${G.hintAlts[G.hintIx].keep.length ? G.hintAlts[G.hintIx].keep.map((l) => (l === '?' ? 'blank' : l)).join('') : 'nothing'}</span><button class="bdbtn" data-hintnext aria-label="Show another Spring Guide play, ${G.hintIx + 1} of ${G.hintAlts.length} shown">Other plays ${G.hintIx + 1}/${G.hintAlts.length}</button>`;
      html += `<button class="bdbtn" tabindex="-1">${G.breakdown ? 'Hide' : 'How it scores'}</button>`;
      if (G.breakdown) html += UI.breakdownHtml(p, G.s.board, G.staged);
      cls = hintLive() ? 'ok hintlive' : 'ok';
    } else { html = esc(p.error); cls = 'bad'; }
  } else if (G.hoverInfo) html = G.hoverInfo;
  else if (G.lastLine && G.bark) html = `<span class="bark"><b>${esc(SHORT[G.bark.persona] || '')}:</b> “${esc(G.bark.text)}”</span><span class="said">${esc(G.lastLine)}</span>`;
  else if (G.lastLine) html = esc(G.lastLine);
  else html = cur().kind === 'human' ? (G.s.move === 0 ? (isNarrow() ? 'Start on the centre square.' : 'Start on the Display Spring in the centre.') : (isNarrow() ? 'Drag tiles to the board.' : 'Drag tiles to the board to make a word.')) : '';
  const stall = !G.s.over && !G.aiBusy && !G.hintBusy && !G.flash && !G.preview && !G.hoverInfo && cur().kind === 'human' ? UI.stallNote(G.s) : '';
  if (stall) html += `<span class="said stall">${esc(stall)}</span>`;
  el.className = cls; el.innerHTML = html;
}

function renderPrivacy() {
  const el = $('#privacy');
  el.hidden = !G.privacy;
  if (!G.privacy) return;
  el.innerHTML = UI.privacyHtml(cur(), G.s.cur);
  el.querySelector('[data-reveal]').addEventListener('click', () => { unlock(); G.revealed = G.s.cur; G.privacy = false; restoreHint(G.s); updatePreview(); sfx('turn'); renderGame(); });
}

let flashTimer = 0;
function flash(text, ms = 2600) { G.flash = text; clearTimeout(flashTimer); renderPreview(); flashTimer = setTimeout(() => { G.flash = null; renderPreview(); }, ms); }
function shake() { const el = $('#preview'); el.classList.remove('shake'); void el.offsetWidth; if (animOn()) el.classList.add('shake'); }

function rollScores() {
  if (!animOn()) return;
  document.querySelectorAll('[data-score]').forEach((el) => el.classList.add('bump'));
}
const POP_MS = 1300, POP_THEMED_MS = 1600;   // how long a score pop lives; a Hot Springs word's stays 0.3 s longer
function scorePop(e, themed) {
  if (!animOn() || !e.tiles.length) return;
  const i = e.tiles[e.tiles.length - 1].i;
  const [x, y] = R.cellCenter(i);
  const el = document.createElement('div');
  el.className = themed ? 'pop themed' : 'pop'; el.textContent = `+${e.score}`;
  el.style.left = x + 'px'; el.style.top = y + 'px';
  $('#boardwrap').append(el);
  setTimeout(() => el.remove(), (themed ? POP_THEMED_MS : POP_MS) + 100);
}

// Toasts: one at a time, newest on top of the queue; click to read the card.
function toast(t) {
  G.toastQ.push(t);
  if (G.toastQ.length > 4) G.toastQ.shift();
  showToast();
}
let toastTimer = 0;
function showToast() {
  const el = $('#toast');
  if (!G.toastQ.length) { el.className = ''; el.innerHTML = ''; return; }
  if (el.dataset.busy === '1') return;
  const t = G.toastNow = G.toastQ.shift();
  el.dataset.busy = '1';
  el.className = `on ${t.kind}`;
  $('#app').classList.add('toasting');
  el.innerHTML = `<button ${t.fact ? `data-fact="${t.fact}" data-form="${t.form || ''}"` : 'tabindex="-1"'}><span class="ti">${t.who ? UI.badge(t.who.p, t.who.k, 34) : t.kind === 'soak' ? UI.ICON.play : UI.ICON.steam}</span><span class="tt"><b>${esc(t.title)}</b><small>${esc(t.sub || '')}</small></span>${t.fact ? '<em>Read the card ›</em>' : ''}</button>`;
  const b = el.querySelector('[data-fact]');
  if (b) b.addEventListener('click', () => { openFact(b.dataset.fact, b.dataset.form); hideToast(); });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, t.kind === 'themed' ? 5200 : 3200);
}
// the player has gone back to planning: a banner still over the preview strip would hide the score and the errors, so it goes (the ledger keeps the word)
// A toast marked `keep` (a finished Register category) survives it: it is the one thing the player has earned and could not yet read.
function clearToasts() {
  G.toastQ = G.toastQ.filter((t) => t.keep);
  if ($('#toast').classList.contains('on') && !(G.toastNow && G.toastNow.keep)) { hideToastNow(); showToast(); }
}
function hideToastNow() { const el = $('#toast'); clearTimeout(toastTimer); el.dataset.busy = '0'; el.className = ''; el.innerHTML = ''; $('#app').classList.remove('toasting'); }
function hideToast() { const el = $('#toast'); el.dataset.busy = '0'; el.className = ''; $('#app').classList.remove('toasting'); setTimeout(showToast, 200); }

// The strip under the board (or Shift+B) opens how the staged play adds up; the words are read out for a screen reader.
function toggleBreakdown() {
  if (!G.preview || !G.preview.ok || !G.staged.length || G.aiBusy || G.flash) return;
  G.breakdown = !G.breakdown; renderPreview();
  if (G.breakdown) { const bd = $('#preview .bd'); if (bd) liveSay(bd.textContent.replace(/\s+/g, ' ').trim()); }
}

// ---------- first-run tips ----------
// A newcomer's first game gets four short tips, one at a time, in the card that takes the ledger's place: where to start,
// how to play it, what the coloured discs do and what the plaques are. Each goes when the player does the thing, taps
// Got it, or after a wait; Skip tips ends them all. Shown once (settings.tipsSeen); Settings can bring them back.
const COACH_WAIT = { start: 30000, play: 20000, discs: 14000, plaques: 12000 };
const liveSay = (t) => { const live = $('#live'); live.textContent = ''; setTimeout(() => { live.textContent = t; }, 30); };
function coachTip() {
  const c = G.coach;
  if (!c || G.scene !== 'game' || !G.s || G.s.over || cur().kind !== 'human' || G.privacy || G.dialog) return null;
  const input = G.input || (matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse');
  if (c.phase === 'start') {
    if (G.staged.length) return { id: 'play', target: '#actions .play', text: ({ touch: 'Happy with it? Tap Play.', mouse: 'Happy with it? Click Play.', key: 'Happy with it? Press Enter.' })[input] };
    return { id: 'start', target: '#boardwrap', text: input === 'key' ? 'Score the most. Type letters to spell across the centre.' : 'Score the most. Drag tiles to the centre square.' };
  }
  if (c.phase === 'discs') return { id: 'discs', target: '#boardwrap', text: 'Cream discs boost a letter. Dark discs boost the word.' };
  if (c.phase === 'plaques') return { id: 'plaques', target: '#springs', text: `Plaques hide secret words. Form one for +${FEATURED_BONUS}.` };
  return null;
}
function coachRender() {
  if (!G.settings.tipsSeen && G.s && (!G.coach || G.coach.s !== G.s)) {
    clearTimeout(G.coachTimer);
    const played = G.s.log.some((e) => e.kind === 'play' && G.s.players[e.p].kind === 'human');
    G.coach = { s: G.s, phase: played ? 'discs' : 'start', gone: new Set(), shown: null };
  }
  if (G.coach && G.coach.phase === 'discs' && G.staged.length) { G.coach.phase = 'plaques'; clearTimeout(G.coachTimer); G.coach.shown = null; }
  const tip = coachTip(), el = $('#coach');
  document.querySelectorAll('.coach-target').forEach((x) => x.classList.remove('coach-target'));
  if (!tip || G.coach.gone.has(tip.id)) {
    el.innerHTML = ''; $('#app').classList.remove('coaching');
    if (!tip && G.coach) { G.coach.shown = null; clearTimeout(G.coachTimer); }
    return;
  }
  $('#app').classList.add('coaching');
  const target = $(tip.target); if (target) target.classList.add('coach-target');
  if (G.coach.shown !== tip.id) {
    G.coach.shown = tip.id;
    el.innerHTML = `<div class="coach-card" role="note"><span class="coach-ic" aria-hidden="true">${UI.ICON.hint}</span><p>${esc(tip.text)}</p><div class="coach-btns"><button class="btn quiet" data-coach="got">Got it</button><button class="btn quiet" data-coach="skip">Skip tips</button></div></div>`;
    el.querySelector('[data-coach="got"]').addEventListener('click', () => coachDismiss(tip.id));
    el.querySelector('[data-coach="skip"]').addEventListener('click', coachEnd);
    liveSay(`Tip: ${tip.text}`);
    clearTimeout(G.coachTimer);
    G.coachTimer = setTimeout(() => coachDismiss(tip.id), COACH_WAIT[tip.id]);
  } else {
    const p = el.querySelector('p'); if (p && p.textContent !== tip.text) p.textContent = tip.text;
  }
}
function coachDismiss(id) {
  const c = G.coach; if (!c) return;
  clearTimeout(G.coachTimer);
  if (id === 'plaques') { coachEnd(); return; }
  if (id === 'discs') { c.phase = 'plaques'; c.shown = null; } else c.gone.add(id);
  renderStaging();
}
function coachEnd() {
  clearTimeout(G.coachTimer);
  G.coach = null; G.settings.tipsSeen = true; saveSettings();
  $('#coach').innerHTML = ''; $('#app').classList.remove('coaching');
  document.querySelectorAll('.coach-target').forEach((x) => x.classList.remove('coach-target'));
}
// the player's own play finishes the first tips
function coachPlayed() {
  const c = G.coach; if (!c || c.phase !== 'start') return;
  c.phase = 'discs'; c.shown = null; c.gone.clear(); clearTimeout(G.coachTimer);
}

// ---------- dialogs ----------
// whose tiles the tracker counts around: the person to play, or the one person during the computer's turn; none while a rack is hidden
function trackerSeat() {
  if (!G.s || G.privacy) return -1;
  if (cur().kind === 'human') return G.s.cur;
  return humans() === 1 ? G.s.players.findIndex((p) => p.kind === 'human') : -1;
}
function openDialog(name, arg) {
  const m = $('#modal');
  cancelDrag();
  G.dialog = name;
  let html = '';
  if (name === 'swap') html = UI.swapHtml(cur().rack);
  else if (name === 'blank') html = UI.blankHtml();
  else if (name === 'pause') html = UI.pauseHtml({ mobile: isNarrow(), tracker: trackerSeat() >= 0 });
  else if (name === 'tracker') html = UI.trackerHtml(G.s, trackerSeat());
  else if (name === 'boardtext') html = UI.boardTextHtml(G.s, G.staged);
  else if (name === 'ledger') html = UI.ledgerHtml(G.s, G.lex);
  else if (name === 'fact') html = `<div class="dialog-wrap" role="dialog" aria-modal="true" aria-label="Hot Springs word card">${UI.factHtml(arg.entry, G.lex, arg.form, '<div class="dlg-btns"><button class="btn primary" data-close>Close</button></div>')}</div>`;
  else if (name === 'confirm') html = `<div class="card dialog" role="dialog" aria-modal="true" aria-labelledby="cf-h"><h2 id="cf-h">${esc(arg.title)}</h2><p>${esc(arg.text)}</p><div class="dlg-btns"><button class="btn quiet" data-close>Cancel</button><button class="btn primary" data-ok>${esc(arg.ok)}</button></div></div>`;
  if (G.dialog === 'pause' && name !== 'pause') releaseAudio('pause');
  if (name === 'pause') holdAudio('pause');
  m.innerHTML = html; m.hidden = false; m.dataset.name = name; G.dialogAt = performance.now();
  if (name !== 'blank') sfx('open');
  m.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => closeDialog()));
  m.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { closeDialog(); go(b.dataset.go); }));
  m.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => openDialog(b.dataset.open)));
  if (name === 'swap') {
    const picked = new Set();
    m.querySelectorAll('[data-sw]').forEach((b) => b.addEventListener('click', () => {
      const k = +b.dataset.sw; if (picked.has(k)) picked.delete(k); else picked.add(k);
      b.setAttribute('aria-pressed', picked.has(k)); m.querySelector('[data-swap-go]').disabled = !picked.size;
      m.querySelector('[data-swap-go]').textContent = picked.size ? `Swap ${UI.plural(picked.size, 'tile')}` : 'Swap';
    }));
    m.querySelector('[data-swap-go]').addEventListener('click', () => {
      const letters = [...picked].map((k) => cur().rack[k]);
      closeDialog();
      const r = E.apply(G.s, { type: 'swap', letters }, ctx());
      if (r.ok) afterAction(r.entry, false); else flash(r.error);
    });
  }
  if (name === 'blank') m.querySelectorAll('[data-letter]').forEach((b) => b.addEventListener('click', () => { const f = G.blankCb; closeDialog(); if (f) f(b.dataset.letter); }));
  if (name === 'confirm') m.querySelector('[data-ok]').addEventListener('click', () => { closeDialog(); arg.onOk(); });
  const f = m.querySelector('.primary, [data-letter], button'); if (f) f.focus();
  renderPreview();
}
function closeDialog(silent) {
  const m = $('#modal');
  if (!G.dialog && m.hidden) return;
  if (G.dialog === 'pause') releaseAudio('pause');
  G.dialog = null; G.blankCb = null; m.hidden = true; m.innerHTML = '';
  if (!silent) { const b = $('#board'); if (G.scene === 'game' && b) b.focus({ preventScroll: true }); }
  // a reply held while the dialog was open lands a moment after it closes (and not at all if another dialog opens at once)
  if (G.aiHeld) setTimeout(releaseAi, 300);
}
function askBlank(cb) { G.blankCb = cb; openDialog('blank'); }
function confirmDialog(title, text, ok, onOk) { openDialog('confirm', { title, text, ok, onOk }); }
function openFact(id, form) {
  const entry = G.lex.byId.get(id);
  if (!entry) return;
  if (G.scene === 'game') openDialog('fact', { entry, form });
  else {
    const m = $('#modal'); G.dialog = 'fact';
    m.innerHTML = `<div class="dialog-wrap" role="dialog" aria-modal="true" aria-label="Hot Springs word card">${UI.factHtml(entry, G.lex, form, '<div class="dlg-btns"><button class="btn primary" data-close>Close</button></div>')}</div>`;
    m.hidden = false; m.dataset.name = 'fact'; G.dialogAt = performance.now(); sfx('open');
    m.querySelector('[data-close]').addEventListener('click', () => closeDialog());
    m.querySelector('[data-close]').focus();
  }
}

// What you missed: the finished game looked back over, one turn at a time so the page stays awake while it works.
let reviewing = 0;
async function openReview() {
  const s = G.s, seat = s && reviewSeat(s);
  if (seat == null) return;
  const m = $('#modal'), mine = ++reviewing;
  const show = (r) => {
    G.dialog = 'review'; m.innerHTML = UI.reviewHtml(r); m.hidden = false; m.dataset.name = 'review'; G.dialogAt = performance.now();
    m.querySelector('[data-close]').addEventListener('click', () => closeDialog());
    m.querySelector('[data-close]').focus();
  };
  show(null);
  const steps = [];
  for (const step of reviewSteps(s, seat, G.dict, G.lex)) {
    steps.push(step);
    await new Promise((res) => setTimeout(res, 0));
    if (mine !== reviewing || G.dialog !== 'review' || G.s !== s) return;   // closed, or another game, meanwhile
  }
  show(summarize(steps));
}

// ---------- layout and drawing ----------
const dpr = () => Math.min(3, window.devicePixelRatio || 1);
const isNarrow = () => matchMedia('(max-width: 860px), (max-aspect-ratio: 1/1), (max-height: 520px)').matches;
// From the width of the grid column the rack sits in, not the rackbar's own width: the rackbar is as wide as the
// tiles, so measuring it fed the size back into itself and phones crept down to the minimum.
function rackTileSize() {
  const app = $('#app'), bar = $('#rackbar');
  let w = 360;
  if (app && bar && app.clientWidth) {
    const cs = getComputedStyle(app), tracks = cs.gridTemplateColumns.split(' ').map(parseFloat).filter((v) => v > 0);
    const x = bar.getBoundingClientRect().left - app.getBoundingClientRect().left - parseFloat(cs.paddingLeft);
    if (tracks.length) w = tracks.length > 1 && x >= tracks[0] ? tracks[1] : tracks[0];
  }
  const bs = bar ? getComputedStyle(bar) : null, pad = bs ? parseFloat(bs.paddingLeft) + parseFloat(bs.paddingRight) : 16;
  return Math.max(36, Math.min(isNarrow() ? 52 : 60, Math.floor((w - pad - 6 * 6) / 7)));
}
function layout() {
  if (G.scene !== 'game') return;
  const bw = $('#boardwrap'); if (art.ready('counter') && !bw.style.backgroundImage) bw.style.backgroundImage = `url(${art.src('counter')})`;
  const wrap = $('#boardwrap'), cv = $('#board');
  const W = wrap.clientWidth, H = wrap.clientHeight;
  if (!W || !H) return;
  const d = dpr();
  R.view.W = W; R.view.H = H; R.view.dpr = d;
  if (cv.width !== Math.round(W * d) || cv.height !== Math.round(H * d)) { cv.width = Math.round(W * d); cv.height = Math.round(H * d); }
  const fx = $('#fx'); if (fx.width !== cv.width || fx.height !== cv.height) { fx.width = cv.width; fx.height = cv.height; }
  R.clampView();
  ensure3d();
  B3.resize(W, H);
  syncZoomBtn();
  renderRack();
  draw();
}

// The 3D board when the setting, the device and the frame rate allow it; otherwise the 2D board.
function ensure3d() {
  const b = B3.B3, mode = G.settings.board3d;
  const want = mode !== 'off' && !/[?&]gl=0\b/.test(location.search);
  if (want && !b.on && !b.tried) {
    b.tried = true;
    const force = mode === 'on' || /[?&]gl=3d\b/.test(location.search) ? 'on' : undefined;
    const p = B3.probe(force);
    b.reason = p.ok ? '' : p.why;
    if (p.ok) {
      const old = $('#gl'), cv = old.cloneNode(); old.replaceWith(cv); cv.hidden = false;
      if (!B3.init(cv, dark() ? 'dark' : 'light')) { cv.hidden = true; }
    }
  } else if (!want && b.on) {
    B3.destroy(); $('#gl').hidden = true;
  }
}
function fallback2D(why) { B3.destroy(); B3.B3.reason = why; B3.B3.tried = true; $('#gl').hidden = true; layout(); }

let raf = 0;
function draw() {
  if (raf) return;
  raf = requestAnimationFrame(frame);
}
function frame(now) {
  raf = 0;
  // the time since the last frame of a running animation is a real frame interval; frames drawn for any other reason are not
  const interval = G.chainAt && now > G.chainAt && now - G.chainAt < 250 ? now - G.chainAt : 0;
  G.chainAt = 0;
  if (G.scene !== 'game' || !G.s) return;
  const cv = $('#board'), c2 = cv.getContext('2d');
  const d = drawData(now);
  if (B3.B3.on) {
    B3.render(d); d.flatOnly = true; d.hideTiles = true; d.mode3d = true; d.cellPx = B3.cellPx();
    if (interval) B3.noteInterval(interval);
    if (G.settings.board3d === 'auto' && B3.slowFrames()) { fallback2D('slow'); return; }
  }
  R.drawFrame(c2, d);
  if (R.view.zoom > 1.2) {
    // the visible area in board cells (the 3D camera frames the same centre and zoom)
    const wCells = R.U / R.view.zoom * (R.view.W / Math.min(R.view.W, R.view.H)), hCells = R.U / R.view.zoom * (R.view.H / Math.min(R.view.W, R.view.H));
    c2.setTransform(R.view.dpr, 0, 0, R.view.dpr, 0, 0);
    R.drawMinimap(c2, G.s.board, G.staged, [R.view.cx - wCells / 2, R.view.cy - hCells / 2, wCells, hCells]);
  }
  if (G.anim.size && now < G.animUntil + 50) { G.chainAt = now; draw(); }
  else if (G.anim.size) G.anim.clear();
  if (G.lastPulse) { if (now < G.lastPulse.t0 + G.lastPulse.dur) { G.chainAt = now; draw(); } else G.lastPulse = null; }
  if (G.settle.size) { if (now < G.settleUntil) { G.chainAt = now; draw(); } else G.settle.clear(); }
  if (G.viewAnim) stepViewAnim(now);
}
function drawData(now) {
  const p = G.preview;
  return {
    board: G.s.board, staged: G.staged, last: G.last, lastPulse: G.lastPulse, hint: G.hint, theme: dark() ? 'dark' : 'light',
    cursor: G.cursor.on && humanCanAct() ? G.cursor : null,
    goodCells: p && p.ok && !G.s.challenge ? [...new Set(p.words.flatMap((w) => w.cells))] : null,
    badCells: p && !p.ok && p.words ? p.words.filter((w) => w.w === p.badWord).flatMap((w) => w.cells) : null,
    target: G.drag && G.drag.active ? G.drag.target : null, dragFrom: G.drag && G.drag.from === 'board' && G.drag.active ? G.drag.i : null,
    dragTile: G.drag && G.drag.active ? G.drag.tile : null, blocked: G.drag && G.drag.active ? G.drag.blocked : null,
    anim: G.anim, settle: G.settle, now,
  };
}
function tick() { draw(); }

// On a phone, where the squares are small, the button in the top bar zooms in and, once zoomed, shows the whole board again (the one in the board's corner does the same, but only when zoomed).
const ZOOM_IN = 1.7;   // how far Zoom in goes: the squares grow from about 23 px to about 39 px on a 360 px phone
function syncZoomBtn() {
  const out = R.view.zoom > 1.01, b = $('#b-zoomin');
  $('#b-zoom').hidden = !out;
  b.dataset.mode = out ? 'out' : 'in';
  b.setAttribute('aria-label', out ? 'Show the whole board' : 'Zoom in on the board');
}
// zoom in on what the player is working on: the tiles they have placed, else the last play, else the Display Spring
function zoomInAt() {
  const cells = G.staged.length ? G.staged.map((t) => t.i) : G.s ? lastTiles(G.s) : [];
  const [cx, cy] = cells.length ? [cells.reduce((a, i) => a + (i % N), 0) / cells.length, cells.reduce((a, i) => a + Math.floor(i / N), 0) / cells.length] : [CENTER % N, Math.floor(CENTER / N)];
  animateView(ZOOM_IN, R.FRAME + cx + 0.5, R.FRAME + cy + 0.5);
}
// smooth zoom/pan
function animateView(zoom, cx, cy, ms = 220) {
  if (!animOn() || G.fast) { R.view.zoom = zoom; R.view.cx = cx; R.view.cy = cy; R.clampView(); layout(); return; }
  G.viewAnim = { from: { zoom: R.view.zoom, cx: R.view.cx, cy: R.view.cy }, to: { zoom, cx, cy }, t0: performance.now(), ms };
  draw();
}
function stepViewAnim(now) {
  const a = G.viewAnim, k = Math.min(1, (now - a.t0) / a.ms), e = 1 - Math.pow(1 - k, 3);
  R.view.zoom = a.from.zoom + (a.to.zoom - a.from.zoom) * e; R.view.cx = a.from.cx + (a.to.cx - a.from.cx) * e; R.view.cy = a.from.cy + (a.to.cy - a.from.cy) * e;
  R.clampView();
  if (k >= 1) { G.viewAnim = null; layout(); } else { G.chainAt = now; draw(); }
}
const pxPerCell = () => (B3.B3.on ? B3.cellPx() : R.scale());

// ---------- steam effects (ambient; not part of isIdle) ----------
const steam = { parts: [], sweeps: [], last: 0, on: false, emit: 0 };
const SWEEP_MS = 900;   // a Hot Springs word: a band of gold light runs along its tiles in this time
const ambientSteam = () => animOn() && G.scene === 'game' && !!G.s;
const covered = (i) => !!G.s.board[i] || G.staged.some((t) => t.i === i);
// where the next idle wisp rises: the Display Spring while it is uncovered; after the first word, one of the Bathhouse Row squares
// still showing (S4-04), so the board keeps breathing between plays. Nothing when they are all covered.
function wispAt() {
  if (!covered(CENTER)) return CENTER;
  const open = Object.keys(BATHS).map(Number).filter((i) => !covered(i));
  return open.length ? open[Math.floor(Math.random() * open.length)] : -1;
}
const WISP_EVERY = 0.7, ROW_WISP_EVERY = 1.6;   // seconds between idle wisps from the Display Spring / from a Bathhouse Row square
function steamBurst(cells) {
  if (!animOn()) return;
  for (const i of cells) for (let k = 0; k < 6; k++) steam.parts.push({ i, x: Math.random() - 0.5, y: 0, vx: (Math.random() - 0.5) * 0.3, vy: 0.6 + Math.random() * 0.6, life: 0, max: 1.2 + Math.random() * 0.8, r: 0.25 + Math.random() * 0.25, a: 0.45 });
  startSteam();
}
// the gold sweep over the tiles of a Hot Springs word, drawn on the same overlay as the steam
function goldSweep(cells) {
  if (!animOn() || !cells.length) return;
  steam.sweeps.push({ cells: [...cells].sort((a, b) => a - b), t0: performance.now() });
  startSteam();
}
function startSteam() { if (!steam.on && (steam.parts.length || steam.sweeps.length || ambientSteam())) { steam.on = true; steam.last = 0; requestAnimationFrame(steamLoop); } }
function steamLoop(now) {
  const fx = $('#fx');
  if (!fx || G.scene !== 'game') { steam.on = false; return; }
  const c = fx.getContext('2d'), d = R.view.dpr;
  if (G.fxFrozen != null) now = G.fxFrozen;
  c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, R.view.W, R.view.H);
  const dt = G.fxFrozen != null ? 0 : Math.min(0.05, (now - (steam.last || now)) / 1000); steam.last = now;
  const cell = pxPerCell();
  // a slow wisp from the Display Spring every ~0.7 s while it is uncovered, then from a Bathhouse Row square every ~1.6 s
  if (ambientSteam() && G.fxFrozen == null) {
    steam.emit -= dt;
    if (steam.emit <= 0) {
      const at = wispAt();
      steam.emit = at === CENTER ? WISP_EVERY : ROW_WISP_EVERY;
      if (at >= 0) steam.parts.push({ i: at, x: (Math.random() - 0.5) * 0.3, y: 0, vx: (Math.random() - 0.5) * 0.12, vy: 0.35 + Math.random() * 0.2, life: 0, max: 2.6, r: 0.22, a: at === CENTER ? 0.32 : 0.24 });
    }
  }
  steam.parts = steam.parts.filter((p) => (p.life += dt) < p.max);
  for (const p of steam.parts) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    const [cx, cy] = R.cellCenter(p.i);
    const a = Math.sin(Math.PI * p.life / p.max) * (p.a || 0.45);
    const g = c.createRadialGradient(cx + p.x * cell, cy - p.y * cell, 0, cx + p.x * cell, cy - p.y * cell, p.r * cell * (1 + p.life));
    g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.beginPath(); c.arc(cx + p.x * cell, cy - p.y * cell, p.r * cell * (1 + p.life), 0, Math.PI * 2); c.fill();
  }
  steam.sweeps = steam.sweeps.filter((w) => now - w.t0 < SWEEP_MS);
  for (const w of steam.sweeps) {
    const n = w.cells.length, head = ((now - w.t0) / SWEEP_MS) * (n + 1);
    w.cells.forEach((i, j) => {
      const a = Math.max(0, 1 - Math.abs(head - j - 0.5) / 1.8);
      if (a <= 0) return;
      const [cx, cy] = R.cellCenter(i), r = cell * 0.62;
      const g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `rgba(255,228,120,${0.75 * a})`); g.addColorStop(1, 'rgba(255,214,90,0)');
      c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
    });
  }
  if (steam.parts.length || steam.sweeps.length || ambientSteam()) requestAnimationFrame(steamLoop); else { steam.on = false; c.clearRect(0, 0, R.view.W, R.view.H); }
}

// ---------- pointer input ----------
function boardPoint(e) { const r = $('#board').getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
function pick(x, y) { return B3.B3.on ? B3.cellAt(x, y) : R.cellAt(x, y); }

// A pointer coming down while another drag or pinch is on: a second finger (not primary) is ignored, but a primary
// pointer means the old one ended without us hearing (a lost pointerup), so that drag is cancelled first.
function claimPointer(e) {
  if (!G.drag && !G.pinch && !G.pointers.size) return true;
  if (!e.isPrimary) return false;
  cancelDrag(); G.pinch = null; G.pointers.clear();
  return true;
}
function capture(el, id) { try { el.setPointerCapture(id); } catch (err) { /* synthetic or already gone */ } }

function rackDown(e, k) {
  if (!(humanCanAct() || waiting()) || e.button > 0) return;
  if (!claimPointer(e)) return;
  unlock();
  e.preventDefault();
  G.drag = { from: 'rack', k, move: G.s.move, x0: e.clientX, y0: e.clientY, id: e.pointerId, touch: e.pointerType === 'touch', active: false, tile: tileOf(k) };
  // #app outlasts every re-render, so the rest of the drag reaches us even if the tile's button goes
  capture($('#app'), e.pointerId);
  sfx('pick');
}
const tileOf = (k) => { const l = (waitSeat() || cur()).rack[k]; return { l: l === '?' ? '' : l, blank: l === '?' }; };

function boardDown(e) {
  if (G.scene !== 'game') return;
  if (e.isPrimary) claimPointer(e);
  else if (G.pinch || (G.drag && G.drag.from !== 'pan')) return;   // a tile is in hand, or a pinch is on: ignore more fingers
  unlock();
  const [x, y] = boardPoint(e);
  G.pointers.set(e.pointerId, { x, y });
  if (G.pointers.size === 2) {
    // pinch zoom
    const [a, b] = [...G.pointers.values()];
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    G.pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y), z0: R.view.zoom, mid: (B3.B3.on && B3.boardAt(mx, my)) || R.toBoard(mx, my) };
    G.drag = null;
    return;
  }
  const i = pick(x, y);
  const st = G.staged.find((t) => t.i === i);
  G.drag = { from: st && humanCanAct() ? 'board' : 'pan', i, move: G.s && G.s.move, x0: e.clientX, y0: e.clientY, bx0: x, by0: y, cx0: R.view.cx, cy0: R.view.cy, id: e.pointerId, touch: e.pointerType === 'touch', active: false, tile: st ? { l: st.l, blank: st.blank } : null, k: st ? st.k : null };
  capture($('#board'), e.pointerId);
}

// what a square is, in a sentence: the strip shows it under the mouse, and after a tap on a phone (no hover there)
function squareInfo(i) {
  const k = SQUARES[i];
  if (k === 'B') return `${BATHS[i]} Bathhouse, on Bathhouse Row: a Hot Springs word over it earns +${ROW_BONUS}`;
  return SQUARE_INFO[k] || null;
}
const SQUARE_INFO = { w: 'Warm spring: doubles the letter on it', h: 'Hot spring: triples the letter on it', s: 'Steam: doubles the whole word', b: 'Boiling Spring: triples the whole word', '*': 'The Display Spring: the first word covers it' };
// the square under the keyboard cursor, spoken through the live region: "H8, empty, Steam: doubles the whole word"
function sayCursor(i) {
  const empty = !G.s.board[i] && !G.staged.some((t) => t.i === i);
  liveSay(`${UI.squareName(i)}, ${UI.tileSpeech(G.s, G.staged, i)}${empty && squareInfo(i) ? `, ${squareInfo(i)}` : ''}`);
}
function hoverSquare(e) {
  if (G.drag || e.pointerType !== 'mouse' || G.scene !== 'game' || !G.s) return;
  const r = $('#board').getBoundingClientRect();
  const i = pick(e.clientX - r.left, e.clientY - r.top);
  let info = null;
  if (i >= 0 && !G.s.board[i] && !G.staged.length) info = squareInfo(i);
  if (info !== G.hoverInfo) { G.hoverInfo = info; renderPreview(); }
}

// Dragging works like the block puzzle's: on touch the tile floats well clear of the finger at about the size of a
// board square, it lands on the square under the tile's centre (not under the finger), and that square shows a
// snapped ghost. The board never zooms by itself.
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function dragGeom(d) {
  if (!d.touch) return { size: Math.max(40, rackTileSize()), lift: 0 };
  const cell = pxPerCell();
  return { size: Math.round(clamp(cell * 1.15, 32, 64)), lift: Math.round(clamp(cell * 1.6, 56, 84)) };
}
// the square under a board-canvas point, also snapping to the edge squares from up to half a square outside the grid
function squareNear(x, y, m = 0.5) {
  if (x < 0 || y < 0 || x > R.view.W || y > R.view.H) return -1;
  const b = B3.B3.on ? B3.boardAt(x, y) : R.toBoard(x, y);
  if (!b) return -1;
  const c = b[0] - R.FRAME, r = b[1] - R.FRAME;
  if (c < -m || r < -m || c > N + m || r > N + m) return -1;
  return clamp(Math.floor(r), 0, N - 1) * N + clamp(Math.floor(c), 0, N - 1);
}
// the board and rackbar boxes are measured once per drag (and again after a resize), not on every move
const boxes = (d) => d.boxes || (d.boxes = { board: $('#board').getBoundingClientRect(), bar: $('#rackbar').getBoundingClientRect() });
function inRackbar(e, d) { const r = boxes(d).bar; return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; }
function updateDragTarget(d, e) {
  if (waitSeat()) { d.hover = -1; d.target = null; d.blocked = null; return; }   // the computer's turn: a tile can only be moved about the rack
  const r = boxes(d).board;
  const x = e.clientX - r.left, y = e.clientY - d.lift - r.top;   // the tile's centre on the board canvas
  // where the tile is decides, not the finger: on a short phone the bottom rows sit right above the rack, so the finger
  // is over the rack while the tile is over the board. Over the rack, only a tile inside the grid counts (no edge snap).
  let i = squareNear(x, y, inRackbar(e, d) ? 0 : 0.5);
  // hysteresis: stay on the current square until the tile is well into the next one, so small squares don't flicker
  if (i >= 0 && d.hover >= 0 && i !== d.hover) {
    const [cx, cy] = R.cellCenter(d.hover), m = pxPerCell() * 0.62;
    if (Math.abs(x - cx) < m && Math.abs(y - cy) < m) i = d.hover;
  }
  d.hover = i;
  const taken = i >= 0 && (G.s.board[i] || G.staged.some((t) => t.i === i));
  d.target = i >= 0 && !taken ? i : null;
  d.blocked = taken ? i : null;
  if (i >= 0) edgePan(x, y);
}
function placeGhost(d, x, y) { $('#ghost').style.transform = `translate(${x - d.size / 2}px, ${y - d.lift - d.size / 2}px)`; }
// a tile that missed the board flies back to its place on the rack
function returnToRack(d) {
  G.order.splice(d.from === 'rack' ? slot(d) : G.order.length, 0, d.k);
  const gh = $('#ghost');
  if (!animOn()) { gh.hidden = true; updatePreview(); renderStaging(); return; }
  G.returning = d.k;
  updatePreview(); renderStaging();
  const el = document.querySelector(`#rack .rtile[data-k="${d.k}"]`);
  if (!el) { endReturn(); return; }
  const b = el.getBoundingClientRect();
  gh.style.transition = 'transform 0.2s ease-out, scale 0.2s ease-out';
  gh.style.transform = `translate(${b.left + b.width / 2 - d.size / 2}px, ${b.top + b.height / 2 - d.size / 2}px)`;
  gh.style.scale = String(b.width / d.size);
  G.returnTimer = setTimeout(endReturn, 210);
}
function endReturn() {
  clearTimeout(G.returnTimer);
  $('#ghost').hidden = true;
  if (G.returning == null) return;
  G.returning = null; renderRack();
}
const slot = (d) => Math.max(0, Math.min(d.pos0 ?? G.order.length, G.order.length));
// Ends a tile drag without a drop (cancelled touch, lost capture, the page losing focus, a new turn, a dialog or
// another screen): a rack tile goes back to its own slot, a staged tile back to its square.
function cancelDrag() {
  const d = G.drag;
  if (!d) return;
  G.drag = null;
  try { if ($('#app').hasPointerCapture(d.id)) $('#app').releasePointerCapture(d.id); } catch (err) { /* gone */ }
  if (!d.active || d.from === 'pan') return;
  if (d.from === 'board' && G.s && !G.s.board[d.i] && !G.staged.some((t) => t.i === d.i || t.k === d.k)) G.staged.push({ k: d.k, i: d.i, l: d.tile.l, blank: d.tile.blank });
  else if (!G.order.includes(d.k) && !G.staged.some((t) => t.k === d.k)) G.order.splice(slot(d), 0, d.k);
  $('#ghost').hidden = true;
  updatePreview(); renderStaging();
}

// how far a press moves before the tile lifts: a finger never holds still, so it keeps its dead zone; a mouse needs less (it was 6 for both)
const DRAG_PX_TOUCH = 6, DRAG_PX_MOUSE = 3;
function onMove(e) {
  hoverSquare(e);
  const d = G.drag;
  if (G.pinch && G.pointers.has(e.pointerId)) {
    const [x, y] = boardPoint(e); G.pointers.set(e.pointerId, { x, y });
    const [a, b] = [...G.pointers.values()];
    const z = Math.max(1, Math.min(2.4, G.pinch.z0 * Math.hypot(a.x - b.x, a.y - b.y) / G.pinch.d0));
    R.view.zoom = z; R.view.cx = G.pinch.mid[0]; R.view.cy = G.pinch.mid[1]; R.clampView(); layout();
    return;
  }
  if (!d || e.pointerId !== d.id) return;
  // a mouse moving with no button held: the button came up where we could not see it (outside the window)
  if (e.pointerType === 'mouse' && !e.buttons) { const pan = d.from === 'pan' && d.active; cancelDrag(); if (pan) layout(); draw(); return; }
  const dist = Math.hypot(e.clientX - d.x0, e.clientY - d.y0);
  if (d.from === 'pan') {
    if (R.view.zoom > 1.01 && (d.active || dist > 6)) {
      d.active = true;
      const s = pxPerCell();
      R.view.cx = d.cx0 - (e.clientX - d.x0) / s; R.view.cy = d.cy0 - (e.clientY - d.y0) / s; R.clampView(); draw();
    }
    return;
  }
  if (!d.active && dist > (d.touch ? DRAG_PX_TOUCH : DRAG_PX_MOUSE)) {
    // the tile may have moved since the press (typed onto the board, recalled): then there is nothing to lift
    if (d.from === 'board' ? !G.staged.some((t) => t.i === d.i && t.k === d.k) : !G.order.includes(d.k)) { G.drag = null; return; }
    d.active = true;
    if (d.from === 'board') G.staged = G.staged.filter((t) => t.i !== d.i);
    else { d.pos0 = G.order.indexOf(d.k); G.order = G.order.filter((x) => x !== d.k); }
    endReturn();
    Object.assign(d, dragGeom(d), { hover: -1, target: null, blocked: null });
    const gh = $('#ghost');
    gh.width = gh.height = Math.round(d.size * dpr());
    gh.style.width = gh.style.height = d.size + 'px';
    gh.getContext('2d').drawImage(R.tileSprite(d.tile.l, d.tile.blank, gh.width, 'staged'), 0, 0);
    // it grows from the size it was picked up at (a rack tile or a board square) to its drag size
    const from = d.from === 'rack' ? rackTileSize() : pxPerCell();
    gh.style.transition = 'none'; gh.style.scale = String(from / d.size);
    placeGhost(d, e.clientX, e.clientY);
    gh.hidden = false;
    void gh.offsetWidth;
    gh.style.transition = animOn() ? 'scale 0.12s ease-out' : 'none'; gh.style.scale = '1';
    updatePreview(); renderStaging();
  }
  if (!d.active) return;
  placeGhost(d, e.clientX, e.clientY);
  updateDragTarget(d, e);
  draw();
}
function edgePan(x, y) {
  if (R.view.zoom <= 1.01) return;
  const m = 36, s = R.scale(), step = 6 / s;
  let dx = 0, dy = 0;
  if (x < m) dx = -step; else if (x > R.view.W - m) dx = step;
  if (y < m) dy = -step; else if (y > R.view.H - m) dy = step;
  if (dx || dy) { R.view.cx += dx; R.view.cy += dy; R.clampView(); }
}

function onUp(e) {
  if (G.pointers.has(e.pointerId)) G.pointers.delete(e.pointerId);
  if (G.pinch) { if (G.pointers.size < 2) { G.pinch = null; G.drag = null; layout(); } return; }
  const d = G.drag;
  if (!d || e.pointerId !== d.id) return;
  G.drag = null;
  if (d.active && d.from !== 'pan') {
    // drop on exactly the square the ghost showed
    if (d.target != null) {
      // a blank waits on the rack while its letter is chosen, so Cancel leaves it there
      const wait = d.from === 'rack' && d.tile.blank;
      if (wait) G.order.splice(slot(d), 0, d.k);
      if (stage(d.k, d.target, d.tile.blank ? d.tile.l || null : null)) { $('#ghost').hidden = true; if (wait) renderStaging(); draw(); return; }
      if (wait) G.order = G.order.filter((x) => x !== d.k);
    }
    // back to the rack, at the drop position when dropped on the rack
    const pos = rackPosAt(e.clientX, e.clientY);
    if (d.from === 'board' || d.blocked != null) sfx(d.blocked != null ? 'error' : 'recall');
    if (pos != null) { $('#ghost').hidden = true; G.order.splice(pos, 0, d.k); updatePreview(); renderStaging(); }
    // a staged tile dropped on a taken square goes back to its own square
    else if (d.from === 'board' && d.blocked != null) { G.drag = d; cancelDrag(); }
    else returnToRack(d);
    draw();
    return;
  }
  if (d.active) { layout(); return; } // pan ended
  // a tap
  if (d.from === 'rack') { if (!waitSeat()) G.selected = G.selected === d.k ? null : d.k; renderRack(); return; }
  if (d.from === 'board') { unstage(d.i); return; }
  const [x, y] = boardPoint(e);
  const i = pick(x, y);
  if (G.selected != null && humanCanAct() && i >= 0) { stage(G.selected, i); return; }
  // a finger has no hover: a tap on an empty square says what it is, while nothing is placed
  if (d.touch && i >= 0 && !G.s.board[i] && !G.staged.length && !G.aiBusy && !G.hintBusy && !G.dialog) { const info = squareInfo(i); if (info) flash(info, 3600); }
  if (i >= 0 && humanCanAct()) {
    if (G.cursor.on && G.cursor.i === i) G.cursor.dir = G.cursor.dir === 1 ? N : 1;
    G.cursor.i = i; G.cursor.on = !d.touch; draw();
  }
}
function rackPosAt(x, y) {
  const r = $('#rack').getBoundingClientRect();
  if (y < r.top - 20 || y > r.bottom + 20 || x < r.left - 20 || x > r.right + 20) return null;
  const tiles = [...document.querySelectorAll('#rack .rtile:not(.lifted)')];
  let pos = tiles.length;
  tiles.forEach((t, k) => { const b = t.getBoundingClientRect(); if (pos === tiles.length && x < b.left + b.width / 2) pos = k; });
  return pos;
}

// ---------- keyboard ----------
const BLANK_ARM_MS = 3500;   // how long a second press of the same letter still means "yes, use my blank"
function onKey(e) {
  if (G.dialog) {
    if (e.key === 'Escape') { e.preventDefault(); closeDialog(); }
    if (G.dialog === 'blank' && /^[a-z]$/i.test(e.key)) { e.preventDefault(); const f = G.blankCb; closeDialog(); f && f(e.key.toUpperCase()); }
    return;
  }
  if (G.scene !== 'game') { if (e.key === 'Escape' && G.scene !== 'title') { e.preventDefault(); back(); } return; }
  if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  // Enter and Space on a focused button or link press it (Swap, Pass, Hint, Menu...); on the board or the page they play and turn the cursor
  if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.closest && e.target.closest('button, a')) return;
  if ((e.key === 'Enter' || e.key === ' ') && !G.staged.length && skipComputerWait()) { e.preventDefault(); return; }
  if (G.privacy && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); $('#privacy [data-reveal]')?.click(); return; }
  const k = e.key;
  if (k === '?') { e.preventDefault(); go('help'); return; }
  if (e.shiftKey && /^[RSPHB]$/.test(k.toUpperCase()) && k.length === 1) {
    e.preventDefault();
    ({ R: shuffleRack, S: doSwap, P: doPass, H: doHint, B: toggleBreakdown })[k.toUpperCase()]?.();
    return;
  }
  if (!humanCanAct()) { if (k === 'Escape') { e.preventDefault(); openDialog('pause'); } return; }
  const c = G.cursor;
  const move = (dr, dc) => { const r = Math.floor(c.i / N) + dr, col = (c.i % N) + dc; if (r >= 0 && r < N && col >= 0 && col < N) c.i = r * N + col; c.on = true; ensureVisible(c.i); draw(); sayCursor(c.i); };
  if (k === 'ArrowLeft') { e.preventDefault(); move(0, -1); }
  else if (k === 'ArrowRight') { e.preventDefault(); move(0, 1); }
  else if (k === 'ArrowUp') { e.preventDefault(); move(-1, 0); }
  else if (k === 'ArrowDown') { e.preventDefault(); move(1, 0); }
  else if (k === ' ') { e.preventDefault(); c.dir = c.dir === 1 ? N : 1; c.on = true; draw(); }
  else if (k === 'Enter') { e.preventDefault(); doPlay(); }
  else if (k === 'Escape') { e.preventDefault(); if (G.staged.length) recallAll(); else openDialog('pause'); }
  else if (k === 'Backspace') {
    e.preventDefault();
    const t = G.staged[G.staged.length - 1];
    if (t) { c.i = t.i; c.on = true; unstage(t.i); }
  } else if (/^[a-z]$/i.test(k) && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    const L = k.toUpperCase(), rack = cur().rack;
    let idx = G.order.find((j) => rack[j] === L);
    let blankLetter = null;
    if (idx == null) {
      idx = G.order.find((j) => rack[j] === '?');
      if (idx == null) { flash(`No ${L} on your rack.`); oops(); return; }
      // a letter you do not hold would spend your blank: the first press asks, the same letter again (within a few seconds) does it
      const arm = G.blankArm;
      if (!arm || arm.L !== L || performance.now() - arm.t > BLANK_ARM_MS) {
        G.blankArm = { L, t: performance.now() };
        flash(`No ${L} on your rack. Press ${L} again to use your blank.`, BLANK_ARM_MS); oops(); return;
      }
      blankLetter = L;
    }
    G.blankArm = null;
    if (!c.on) { c.on = true; if (G.s.board[c.i]) c.i = CENTER; }
    // skip squares already filled
    while (G.s.board[c.i] || G.staged.some((t) => t.i === c.i)) { const nx = nextCell(c.i, c.dir); if (nx < 0) { flash('No room that way.'); return; } c.i = nx; }
    if (stage(idx, c.i, blankLetter)) { const nx = nextCell(c.i, c.dir); if (nx >= 0) c.i = nx; ensureVisible(c.i); draw(); }
  }
}
function nextCell(i, dir) { if (dir === 1) return (i % N) < N - 1 ? i + 1 : -1; return i + N < N * N ? i + N : -1; }
function ensureVisible(i) {
  if (R.view.zoom <= 1.01) return;
  const [x, y] = R.cellCenter(i), m = pxPerCell();
  if (x < m || y < m || x > R.view.W - m || y > R.view.H - m) animateView(R.view.zoom, R.FRAME + (i % N) + 0.5, R.FRAME + Math.floor(i / N) + 0.5);
}

// ---------- wiring ----------
function wireStatic() {
  $('#b-menu').addEventListener('click', () => { unlock(); openDialog('pause'); });
  $('#b-sound').addEventListener('click', () => { unlock(); G.settings.sound = !G.settings.sound; saveSettings(); if (G.settings.sound) sfx('place'); });
  // the strip under the board opens the breakdown of the staged play (its button is the keyboard's way in)
  $('#preview').addEventListener('click', (e) => { if (e.target.closest('[data-hintnext]')) hintNext(); else toggleBreakdown(); });
  $('#b-zoom').addEventListener('click', () => animateView(1, R.U / 2, R.U / 2));
  $('#b-zoomin').addEventListener('click', () => { if (R.view.zoom > 1.01) animateView(1, R.U / 2, R.U / 2); else zoomInAt(); });
  const b = $('#board');
  b.addEventListener('pointerdown', boardDown);
  window.addEventListener('pointermove', onMove, { passive: false });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', (e) => {
    G.pointers.delete(e.pointerId);
    if (G.pinch && G.pointers.size < 2) { G.pinch = null; layout(); }
    if (G.drag && G.drag.id === e.pointerId) { cancelDrag(); draw(); }
  });
  // capture taken away (by the browser or the page) ends the drag; the button losing its implicit capture to #app doesn't
  for (const el of [$('#app'), b]) el.addEventListener('lostpointercapture', (e) => { if (e.target === el && G.drag && G.drag.id === e.pointerId) { cancelDrag(); draw(); } });
  // the page losing focus mid-drag (app switch, notification, alt-tab): the release may never arrive
  const away = () => { if (G.drag || G.pinch) { cancelDrag(); G.pinch = null; G.pointers.clear(); draw(); } };
  window.addEventListener('blur', away);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { away(); pauseAudio(); return; }
    resumeAudio();
    releaseAi();
  });
  // iOS: no rubber-band scroll or page zoom while a tile or the board is held (they would cancel the touch)
  document.addEventListener('touchmove', (e) => { if (G.scene === 'game' && (G.drag || G.pinch)) e.preventDefault(); }, { passive: false });
  b.addEventListener('focus', () => { if (humanCanAct()) { G.cursor.on = true; draw(); } });
  b.addEventListener('blur', () => { G.cursor.on = false; draw(); });
  document.addEventListener('keydown', onKey);
  window.addEventListener('pointerdown', (e) => { G.input = e.pointerType === 'touch' ? 'touch' : 'mouse'; }, true);
  let boardTap = null;
  window.addEventListener('pointerdown', (e) => { boardTap = e.isPrimary && e.target.closest && e.target.closest('#boardwrap') ? { id: e.pointerId, x: e.clientX, y: e.clientY } : null; }, true);
  window.addEventListener('pointerup', (e) => { const t = boardTap; boardTap = null; if (t && t.id === e.pointerId && Math.hypot(e.clientX - t.x, e.clientY - t.y) < 10) skipComputerWait(); }, true);
  window.addEventListener('keydown', (e) => { if (!['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) G.input = 'key'; }, true);
  window.addEventListener('resize', () => { if (G.drag) G.drag.boxes = null; layout(); if (G.scene === 'game') renderGame(); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applySettings);
  // no text selection, callouts or context menus on the game screen (phones)
  for (const ev of ['contextmenu', 'selectstart', 'dragstart']) $('#app').addEventListener(ev, (e) => { if (!/INPUT|TEXTAREA/.test(e.target.tagName)) e.preventDefault(); });
  $('#modal').addEventListener('click', (e) => { if (e.target === $('#modal') && G.dialog !== 'blank') closeDialog(); });
}

// ---------- test hooks ----------
const idle = () => G.ready && !art.loading && performance.now() - (G.dialogAt || 0) > 260 && !G.aiBusy && !G.hintBusy && !G.viewAnim && G.anim.size === 0 && G.settle.size === 0 && performance.now() >= G.busyUntil && !(G.s && !G.s.over && G.scene === 'game' && cur().kind === 'ai' && !G.s.over);
window.__game = {
  seed(n) { G.nextSeed = n >>> 0; return true; },
  getState() {
    return JSON.parse(JSON.stringify({ scene: G.scene, dialog: G.dialog, game: G.s, staged: G.staged, order: G.order, preview: G.preview, settings: G.settings,
      view: { zoom: R.view.zoom, cx: R.view.cx, cy: R.view.cy, W: R.view.W, H: R.view.H, mode3d: B3.B3.on, reason3d: B3.B3.reason }, aiThinking: G.aiBusy, aiHeld: !!G.aiHeld, pulse: !!G.lastPulse, aiWait: { reply: !!G.aiFire, turn: !!(G.turnWait && G.turnWait.fromAi) }, ready: G.ready, privacy: G.privacy,
      drag: G.drag && G.drag.active ? { from: G.drag.from, target: G.drag.target, blocked: G.drag.blocked, lift: G.drag.lift, size: G.drag.size } : null,
      ai: aiClient.mode, dictMs: G.dictMs, toast: $('#toast').textContent, sweeps: steam.sweeps.length, wisps: steam.parts.map((p) => p.i), sweepAt: steam.sweeps.length ? steam.sweeps[0].t0 : null, lastLine: G.lastLine || null, sfx: audio.played.slice(-10) }));
  },
  setState(o) {
    if (o.game) {
      const before = G.s, replacement = JSON.parse(JSON.stringify(o.game)), handle = gameHandles.get(before);
      if (handle && gameSaves.replaceFixture(handle, before, replacement)) gameHandles.set(replacement, handle);
      G.s = replacement; G.last = new Set(lastTiles(G.s)); resetOrder(); G.revealed = G.s.cur; G.privacy = false;
    }
    if (o.scene) showScene(o.scene); else renderGame();
    if (o.staged) { for (const t of o.staged) { const k = cur().rack.findIndex((l, j) => (t.blank ? l === '?' : l === t.l) && !G.staged.some((x) => x.k === j)); if (k >= 0) { G.staged.push({ k, i: t.i, l: t.l, blank: !!t.blank }); G.order = G.order.filter((x) => x !== k); } } updatePreview(); renderGame(); }
    if (G.s && !G.s.over && cur().kind === 'ai' && G.scene === 'game') scheduleAi();
    return true;
  },
  isIdle: idle,
  scene(name) { if (name === 'game' && !G.s) return false; if (name === 'over' && !(G.s && G.s.over)) return false; if (name === 'setup') G.setup = G.setup || defaultSetup(); showScene(name); return true; },
  newGame(opts = {}) {
    if (opts.seed != null) G.nextSeed = opts.seed >>> 0;
    if (opts.mode === 'daily') { startDaily(opts.date); return true; }
    const seats = (opts.seats || [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'hollis' }]).map((x, k) => (x.kind === 'ai'
      ? { kind: 'ai', persona: x.persona || 'hollis', level: x.level || persona(x.persona || 'hollis').level, name: x.name || persona(x.persona || 'hollis').name }
      : { kind: 'human', name: x.name || (k ? `Player ${k + 1}` : 'You') }));
    newGame({ mode: 'play', seats, hints: opts.hints !== false, hintsUnl: !!opts.hintsUnl, challenge: !!opts.challenge });
    return true;
  },
  audioList() { return audioList(); },
  audioRender(name, seconds = 30, wantWav = false) { return audioRender(name, seconds, !!wantWav); },
  audioState() {
    const k = audio.kit, i = k && k.music.info();
    return { ctx: audio.ctx ? audio.ctx.state : null, held: k ? k.held : null, holds: [...audio.holds], tune: tuneName(), bed: !!(k && k.amb.scene), notes: i ? i.notes : 0, bars: i ? i.bars : 0, want: audio.want, on: audio.on, fx: audio.fx, music: audio.music, amb: audio.amb, played: audio.played.slice(), total: audio.total, fxGain: audio.bus ? audio.bus.sfx.gain.value : null, musGain: audio.bus ? audio.bus.mus.gain.value : null };
  },
  async act(name, ...a) {
    switch (name) {
      case 'stage': for (const t of a[0]) { const k = cur().rack.findIndex((l, j) => (t.blank ? l === '?' : l === t.l) && !G.staged.some((x) => x.k === j)); if (k < 0) return { ok: false, error: 'not on rack' }; stage(k, t.i, t.blank ? t.l : null); } return { ok: true, preview: G.preview };
      case 'recall': recallAll(); return true;
      case 'play': { const before = G.s.move; doPlay(); return { ok: G.s.move > before, error: G.flash }; }
      case 'pass': { const r = E.apply(G.s, { type: 'pass' }, ctx()); if (r.ok) afterAction(r.entry, false); return r.ok; }
      case 'swap': { const r = E.apply(G.s, { type: 'swap', letters: a[0] }, ctx()); if (r.ok) afterAction(r.entry, false); return r.ok; }
      case 'ai': return idle();
      case 'autoplay': {
        G.fast = true;
        for (const p of G.s.players) { if (p.kind === 'human') { p.kind = 'ai'; p.level = p.level || 'medium'; p.wasHuman = true; } }
        const n = a[0] || 999, start = G.s.move;
        if (!G.aiBusy) startTurn();
        await new Promise((res) => { const t = setInterval(() => { if (G.s.over || G.s.move - start >= n) { clearInterval(t); res(); } }, 20); });
        for (const p of G.s.players) if (p.wasHuman) { p.kind = 'human'; delete p.wasHuman; }
        G.fast = false;
        await new Promise((res) => { const t = setInterval(() => { if (!G.aiBusy) { clearInterval(t); res(); } }, 20); });
        if (!G.s.over) startTurn();
        return { move: G.s.move, over: G.s.over, scores: G.s.players.map((p) => p.score) };
      }
      case 'eval': return E.evaluate(G.s, a[0], ctx());
      case 'cell': return R.cellCenter(a[0]).map((v) => Math.round(v * 10) / 10);
      case 'cellAt': return pick(a[0], a[1]);
      case 'screen': { const r = $('#board').getBoundingClientRect(); const [x, y] = R.cellCenter(a[0]); return [r.left + x, r.top + y]; }
      case 'rackTile': { const el = document.querySelector(`#rack .rtile[data-pos="${a[0]}"]`); if (!el) return null; const b = el.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2, cur().rack[+el.dataset.k]]; }
      case 'moves': { return generateMoves(G.dict, G.s.board, cur().rack, { lex: G.lex, featured: G.s.featured }).moves.slice(0, a[0] || 10).map((m) => ({ tiles: m.tiles, score: m.score, words: m.words })); }
      case 'freezeFx': G.fxFrozen = a[0] == null ? null : a[0]; startSteam(); return true;
      case 'open': openDialog(a[0], a[0] === 'fact' ? { entry: G.lex.byId.get(a[1]), form: a[2] } : a[1]); return true;
      case 'fact': openFact(a[0], a[1]); return true;
      case 'close': closeDialog(); return true;
      case 'dragLift': return dragGeom({ touch: true }).lift;
      case 'killWorker': { const w = aiClient.worker; if (w) { w.onmessage = null; w.onerror = null; w.terminate(); } return aiClient.mode; } // dies without a word, as iOS can do
      case 'zoom': R.view.zoom = a[0]; if (a[1] != null) { R.view.cx = a[1]; R.view.cy = a[2]; } R.clampView(); layout(); return true;
      case 'reveal': G.revealed = G.s.cur; G.privacy = false; renderGame(); return true;
      case 'hint': await doHint(); return G.staged.length;
      case 'daily': startDaily(a[0]); return true;
      case 'toast': toast(a[0]); return true;
      case 'has': return has(G.dict, a[0]);
      case 'b3': return B3.debug ? B3.debug() : null;
      case 'b3feed': if (a[2]) B3.B3.intervals.length = 0; for (let k = 0; k < a[1]; k++) B3.noteInterval(a[0]); return B3.slowFrames();   // n frame intervals of `ms` (after clearing the old ones if a[2]), as if animated frames had taken that long
      case 'renderSfx': return renderCue(a[0], a[1] ?? 0.35, a[2] || {});   // one sound offline, measured (nobody can listen in a test run)
      case 'timeAi': {
        // n AI turns at `level` from the current position, timed (the moves are applied outside the UI)
        const ms = [];
        for (let k = 0; k < a[0] && !G.s.over; k++) {
          const t0 = performance.now();
          const r = await aiMove(G.s, a[1]);
          ms.push(performance.now() - t0);
          G.s.rng.ai = r.rngAi; E.apply(G.s, r.action, ctx());
        }
        ms.sort((x, y) => x - y);
        renderGame();
        return { n: ms.length, median: Math.round(ms[ms.length >> 1]), max: Math.round(ms[ms.length - 1]) };
      }
    }
    return null;
  },
};

// an error nothing caught must not leave a dead screen: offer the way out
function crashNotice() {
  if (document.getElementById('crash')) return;
  const el = document.createElement('div');
  el.id = 'crash'; el.setAttribute('role', 'alert');
  el.innerHTML = '<span>Something went wrong.</span><button class="btn" data-crash>Back to title</button>';
  el.querySelector('[data-crash]').addEventListener('click', () => { el.remove(); showScene('title'); });
  document.body.appendChild(el);
}
window.addEventListener('error', crashNotice);
window.addEventListener('unhandledrejection', crashNotice);

wireStatic();
boot();

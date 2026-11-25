// Controller: scenes, turn flow, staging and input, AI pacing, toasts and fact cards, saves and window.__game.
import { loadDict, has } from './dict.js';
import { makeLexicon, townWordsInRack } from './lexicon.js';
import * as E from './engine.js';
import { N, CENTER, RACK, FULL_SOAK, FEATURED_BONUS, ROW_BONUS, SQUARE as SQUARES, BATHHOUSES as BATHS, findWords } from './score.js';
import { seedState } from './rng.js';
import * as R from './render2d.js';
import { audio, unlock, sfx, pauseAudio, resumeAudio, setTune, holdAudio, releaseAudio, syncAudio, audioList, audioRender, renderCue, tuneName } from './audio.js';
import { art, loadArt } from './art.js';
import { store, KEYS, createGameSaves, validRegister, validDaily, pruneDays } from './storage.js';
import { startAi, aiMove, aiHint, aiReview, aiDailyPar, aiClient } from './aiclient.js';
import { PERSONAS, PERSONA_MOTION, persona, personaMotion, LEVEL_NAME, seatLevel } from './personas.js';
import { barkFor, endBark, greeting, SHORT } from './voices.js';
import { cleanStats, applyGame, applyDaily, nextStreak, dayNumber } from './stats.js';
import * as B3 from './board3d.js';
import * as UI from './ui.js';
import { generateMoves } from './movegen.js';
import { reviewSeat, reviewTurns, summarize } from './review.js';

const { qs: $, esc } = UI;
const META = { words: 168271, added: 0 };
// every two-letter word the dictionary holds, for the Help sheet (built once the dictionary is loaded)
let twoLetters = null;
const twoLetterWords = () => {
  if (!G.dict) return [];
  if (!twoLetters) { twoLetters = []; for (let a = 65; a < 91; a++) for (let b = 65; b < 91; b++) { const w = String.fromCharCode(a, b); if (has(G.dict, w)) twoLetters.push(w); } }
  return twoLetters;
};

// a Challenge game in play, or saved and waiting under Continue (after a reload G.s is empty)
function challengeLive() {
  const s = G.s && !G.s.over ? G.s : loadSave();
  return !!(s && s.challenge && !s.over);
}

// The Help sheet's word check: the same dictionary that judges a play, and a nod to the town's own words.
function wordCheck(raw) {
  const w = String(raw).toUpperCase().replace(/[^A-Z]/g, '');
  if (w.length < 2) return 'Type a word of two letters or more.';
  if (!G.dict) return 'The dictionary is still loading. Try again in a moment.';
  if (challengeLive()) return 'The word check is off while a Challenge game is in progress.';
  if (!has(G.dict, w)) return `${w} is not in the dictionary, so a play that makes it is handed back.`;
  const e = G.lex.entry(w);
  return `${w} is in the dictionary and can be played.${e ? ` It is also a Hot Springs word: it pays +${G.lex.bonusOf(e)}.` : ''}`;
}

const G = {
  s: null, scene: 'title', back: 'title', dict: null, lex: makeLexicon(LEXICON), ready: false,
  settings: { sound: true, fx: true, music: true, amb: true, vol: 0.35, fxVol: 1, musicVol: 1, theme: 'auto', motion: 'system', text: 1, board3d: 'auto', ai: 'normal', hints: true, townCue: true, tipsSeen: true, vibrate: matchMedia('(pointer: coarse)').matches },
  setup: null, nextSeed: null,
  staged: [], order: [], selected: null, cursor: { i: CENTER, dir: 1, on: false },
  preview: null, hint: null, last: new Set(), lastPulse: null, badPulse: null, anim: new Map(), animUntil: 0,
  breakdown: false, settle: new Map(), settleUntil: 0, chainAt: 0, aiBusy: false, aiTimer: 0, aiToken: 0, overTimer: 0, releaseAiTimer: 0, turnTimers: new Set(), privacy: false, revealed: -1, dialog: null, toastQ: [], helpTab: 'rules',
  drag: null, returning: null, returnTimer: 0, pointers: new Map(), pinch: null, fxFrozen: null, pendingVfx: null, busyUntil: 0, lastHuman: -1,
  errFlash: false, scoreHi: null, scoreRollRaf: 0, flipTimer: 0, plaqueSnap: null, plaqueHi: new Set(), plaqueTimer: 0, plaqueFx: null, plaqueFxTimer: 0, springsOpen: false,
  returnFocus: null, parCache: {}, boardTap: null, houseOpen: false,
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
  sound: (v) => typeof v === 'boolean', tipsSeen: (v) => typeof v === 'boolean', fx: (v) => typeof v === 'boolean', music: (v) => typeof v === 'boolean', amb: (v) => typeof v === 'boolean', hints: (v) => typeof v === 'boolean', townCue: (v) => typeof v === 'boolean', vibrate: (v) => typeof v === 'boolean',
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
  const red = reduced();
  document.body.classList.toggle('reduce', red);
  document.body.classList.toggle('motion-full', st.motion === 'full');
  if (red) {
    clearFx();
    const fx = $('#fx'); if (fx) fx.getContext('2d').clearRect(0, 0, fx.width, fx.height);
    G.anim.clear(); G.animUntil = 0; G.lastPulse = null; G.badPulse = null; G.settle.clear(); G.settleUntil = 0;
    cancelScoreRoll(); endFlip(); endReturn(); clearPlaqueFx();
    if (G.viewAnim) { R.view.zoom = G.viewAnim.to.zoom; R.view.cx = G.viewAnim.to.cx; R.view.cy = G.viewAnim.to.cy; G.viewAnim = null; R.clampView(); }
  }
  const sb = $('#b-sound'); if (sb) { sb.innerHTML = UI.ICON.sound(st.sound); sb.setAttribute('aria-label', st.sound ? 'Sound on (click to mute)' : 'Sound off (click to unmute)'); }
  R.invalidateBoardTexture();
  R.invalidateTileCache();
  if (B3.B3.on) B3.setTheme(dark() ? 'dark' : 'light');
  else B3.invalidateFaceCache();
  layout();
  if (!red && G.scene === 'game' && G.s) startSteam();
}

// ---------- boot ----------
// can this browser store anything? (a private window or blocked site data cannot: settings, register and records then last one visit)
function storageBlocked() {
  const ok = store.set('hs-letters-probe', '1');
  if (ok) store.del('hs-letters-probe');
  return !ok;
}
async function boot() {
  // a saved game from a newer version of the game is left alone: this visit writes nothing, under any key, and says so
  G.newerSave = gameSaves.read().kind === 'newer';
  if (G.newerSave) { store.frozen = true; G.noSave = false; }
  else G.noSave = storageBlocked();
  loadSettings();
  if (window.__TEST__) G.settings.ai = G.settings.ai || 'normal';
  loadArt(() => {
    R.invalidateBoardTexture();
    R.invalidateTileCache();
    B3.invalidateFaceCache();
    const bw = $('#boardwrap');
    if (bw && art.ready('counter')) bw.style.backgroundImage = `url(${art.src('counter')})`;
    if (B3.B3.on) B3.setTheme(dark() ? 'dark' : 'light');
    if (G.scene === 'game') { layout(); renderGame(); }
    else { draw(); if (G.scene === 'title' && !G.dialog) showScene('title'); }
  });
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
  const td = today();
  // today's day is read afresh every time: a tab left open past midnight shows the new day, not the one last played
  return { ...d, today: d.days[td] || null, todayDate: td };
}
// Works out par for a Daily date once (off-thread in the AI worker with main-thread fallback), caches it in memory
// (so blocked-storage and newer-save sessions still see live par pips), persists it on the day's record when stored,
// and patches the active HUD or results box in place without rebuilding the scene.
const parBusy = new Set();
function cachedPar(date) {
  if (!date) return null;
  if (G.parCache[date]) return G.parCache[date];
  const d = store.json(KEYS.daily, { days: {}, streak: 0, last: null }, validDaily);
  if (d.days[date] && d.days[date].par) { G.parCache[date] = d.days[date].par; return d.days[date].par; }
  return null;
}
function patchOverPar(par) {
  const box = $('#screen .daily-box');
  if (!box) return;
  const text = `${persona('hollis').name} scored ${par.m} and ${persona('julian').name} ${par.h} on these tiles.`;
  let el = box.querySelector('[data-par-line]');
  if (el) { el.textContent = text; return; }
  el = document.createElement('p');
  el.className = 'par'; el.dataset.parLine = '1'; el.textContent = text;
  const anchor = box.querySelector('.note');
  if (anchor) anchor.after(el); else box.append(el);
}
async function findPar(date, s) {
  if (!date || cachedPar(date) || parBusy.has(date) || !G.dict) return;
  parBusy.add(date);
  try {
    const par = await aiDailyPar(date);
    if (!par || typeof par.m !== 'number' || typeof par.h !== 'number') return;
    G.parCache[date] = par;
    const d = store.json(KEYS.daily, { days: {}, streak: 0, last: null }, validDaily);
    if (d.days[date] && !d.days[date].par) { d.days[date].par = par; store.put(KEYS.daily, d); }
    if (G.scene === 'game' && G.s && G.s.daily && G.s.daily.date === date) renderTurnline();
    if (G.scene === 'over' && (!s || G.s === s) && G.s && G.s.daily && G.s.daily.date === date) patchOverPar(par);
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
const dailyDone = new WeakMap();
function recordDaily(s = G.s) {
  if (!s || !s.daily) return { score: 0, official: 0, streak: 0, isReplay: false };
  if (dailyDone.has(s)) return dailyDone.get(s);
  const d = store.json(KEYS.daily, { days: {}, streak: 0, last: null }, validDaily);
  const date = s.daily.date, score = s.players[0].score;
  const prev = d.days[date];
  const isReplay = !!prev;
  let official = score;
  if (!prev) {
    // W1-P-N02: official Daily score locks strictly to the first completed run (`first` and `score`).
    d.days[date] = { score, first: score, plays: 1 };
    if (G.parCache[date]) d.days[date].par = G.parCache[date];
    if (!d.last || dayNumber(date) > dayNumber(d.last)) {
      const n = nextStreak(d, date);
      d.streak = n.streak; d.rest = n.rest; d.last = date;
    }
  } else {
    // Post-completion replays are Practice replays: keep official score untouched and track `replayBest` separately.
    official = prev.first != null ? prev.first : prev.score;
    // a record from before that lock holds the best of every try as its score: what it has over the first run is the best replay so far
    const prevReplay = prev.replayBest != null ? prev.replayBest : prev.first != null && prev.score > prev.first ? prev.score : 0;
    d.days[date] = {
      ...prev,
      score: official,
      first: official,
      plays: (prev.plays || 1) + 1,
      replayBest: Math.max(prevReplay, score),
    };
    if (!d.days[date].par && G.parCache[date]) d.days[date].par = G.parCache[date];
  }
  d.days = pruneDays(d.days, undefined, date);
  store.put(KEYS.daily, d);
  const res = { score, official, streak: d.streak || 1, isReplay };
  dailyDone.set(s, res);
  return res;
}
// The player's records: read field by field (a damaged number never costs the others), written when a game ends.
const plainObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const stats = () => cleanStats(store.json(KEYS.stats, null, plainObj));
const statsDone = new WeakSet();
function recordStats(s) {
  if (statsDone.has(s)) return;
  statsDone.add(s);
  const dr = s.mode === 'daily' ? dailyDone.get(s) : null;
  const r = s.mode === 'daily'
    ? { stats: applyDaily(stats(), dr ? dr.official : s.players[0].score, dr ? dr.streak : (G.dailyStreak || 0), { replay: !!(dr && dr.isReplay) }), pb: null }
    : applyGame(stats(), s);
  if ((s.mode === 'daily' && !(dr && dr.isReplay)) || r.pb) store.put(KEYS.stats, r.stats);
  G.pb = { s, pb: r.pb };
}
function persistEndgame(s) {
  if (!s || !s.over) return;
  if (s.mode === 'daily') {
    try { G.dailyStreak = recordDaily(s).streak; } catch (e) { /* daily record is a keepsake: a failed write never stops the game */ }
  }
  try { recordStats(s); } catch (e) { /* the records are a keepsake: a failed write never stops the game */ }
}

// ---------- music and the bed ----------
// the lobby tune on the title and setup, the table tune in play, the results tune after the last move (a slower one after
// a loss to the computer); a sheet opened from another screen keeps that screen's tune. The table tune follows the bag, or
// the turns of a Daily Soak (tableIntensity), and the steam air of the bed thickens as the board fills.
const SHEETS = ['help', 'settings', 'about', 'register', 'records'];
const tuneFor = (name) => (SHEETS.includes(name) ? tuneFor(G.back) : name === 'game' ? 'table' : name === 'over' ? (G.s && G.s.result && UI.outcome(G.s) === 'loss' ? 'dusk' : 'finale') : 'lobby');
// 0.5 wakes the brush of SCORES.table, over 0.8 the octave lift
function tableIntensity(s) {
  if (s.daily) { const t = s.daily.turns; return t <= 1 ? 0.9 : t <= 3 ? 0.55 : t <= 5 ? 0.3 : 0; }   // turn 10, 8-9, 6-7
  const b = s.bag.length;
  return b === 0 ? 0.9 : b < RACK ? 0.6 : b <= 14 ? 0.55 : b <= 45 ? 0.25 : 0;
}
function moodUpdate() {
  setTune(tuneFor(G.scene));
  const k = audio.kit, s = G.s;
  if (!k) return;
  const live = s && !s.over && G.scene === 'game';
  k.music.intensity(s && !s.over && tuneFor(G.scene) === 'table' ? tableIntensity(s) : 0);   // also on a sheet opened over the table
  k.amb.set('steam', live ? Math.min(1, s.board.filter(Boolean).length / 90) : 0.3, 2);
}
const colPan = (i) => ((i % N) - 7) / 7 * 0.7;

// ---------- scenes ----------
function sheetFocusSel(scr) {
  const ae = document.activeElement;
  if (!ae || !scr.contains(ae)) return null;
  for (const [a, b] of [['data-persona', 'data-val'], ['data-kind', 'data-k'], ['data-set', 'data-val'], ['data-level'], ['data-tab'], ['data-remove'], ['data-add'], ['data-name'], ['data-hints'], ['data-hints-unl'], ['data-challenge'], ['data-tips'], ['data-go']]) {
    if (ae.hasAttribute(a)) return b && ae.hasAttribute(b) ? `[${a}="${ae.getAttribute(a)}"][${b}="${ae.getAttribute(b)}"]` : `[${a}="${ae.getAttribute(a)}"]`;
  }
  return null;
}

function showScene(name, arg) {
  const prev = G.scene;
  const app = $('#app'), scr = $('#screen');
  const sameSheet = prev === name && (name === 'setup' || name === 'settings' || name === 'help' || name === 'title');
  const keyFocus = scr.querySelector(':focus-visible');   // only for someone on the keyboard: focusing the board also shows its cursor
  const savedScroll = sameSheet ? scr.scrollTop : 0;
  const focusSel = sameSheet ? ((arg && arg.focus) || sheetFocusSel(scr)) : null;
  if (name !== prev && !SHEETS.includes(name)) G.back = name;
  if (SHEETS.includes(name) && !SHEETS.includes(prev)) G.back = prev;
  G.scene = name;
  moodUpdate();
  cancelDrag(); endReturn(); endFlip(); cancelScoreRoll(); G.pinch = null; G.pointers.clear();
  closeDialog(true);
  if (name !== 'game') {
    releaseAudio('pause');
    if (SHEETS.includes(name)) {
      if (G.aiFire) { clearTimeout(G.aiTimer); G.aiTimer = 0; G.aiHeld = G.aiFire; G.aiFire = null; }
      if (G.turnWait) { const run = G.turnWait.run; clearTimeout(G.turnWait.id); G.turnWait = null; if (!G.aiHeld && run) G.aiHeld = run; G.anim.clear(); G.animUntil = 0; G.busyUntil = 0; G.lastPulse = null; }
      if (G.overTimer) G.aiHeld = G.overRun;
      G.badPulse = null; G.pendingVfx = null;
      cancelTurnTimers();
    } else {
      clearTimeout(G.aiTimer); G.aiTimer = 0;
      G.aiHeld = null; G.aiFire = null; G.aiBusy = false; G.aiSkip = false; G.aiToken++;
      G.anim.clear(); G.animUntil = 0; G.busyUntil = 0; G.lastPulse = null; G.badPulse = null; G.pendingVfx = null;
      cancelTurnTimers();
    }
    G.toastQ = []; hideToastNow(); G.springsOpen = false; G.privacy = false; const priv = $('#privacy'); if (priv) { priv.hidden = true; priv.innerHTML = ''; }
  }
  syncInert();
  const game = name === 'game';
  app.hidden = !game; scr.hidden = game;
  document.body.dataset.scene = name;
  if (game) { renderGame(); layout(); if (keyFocus && !G.privacy) $('#board').focus({ preventScroll: true }); if (G.aiHeld && !G.dialog && !document.hidden) releaseAi(); return; }
  scr.innerHTML = screenHtml(name, arg);
  if (name === 'over' && prev === 'game' && animOn()) scr.querySelector('.over')?.classList.add('arrive');
  wireScreen(name);
  scr.scrollTop = savedScroll;
  if (sameSheet) {
    const f = focusSel && scr.querySelector(focusSel);
    if (f) f.focus({ preventScroll: true });
  } else {
    // back on the title: the button that opened the sheet, or Continue / New game (it takes no focus when the game starts up)
    const opener = name === 'title' && scr.querySelector(`[data-go="${prev}"]`);
    const f = opener || scr.querySelector('.primary, h1[tabindex], button'); if (f) f.focus({ preventScroll: true });
  }
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
      return UI.titleHtml({ records: rec.games ? `${UI.plural(rec.games, 'game')} · ${UI.plural(rec.wins, 'win')}` : 'Your wins and bests', noSave: G.noSave, newerSave: G.newerSave, canContinue: !!sv, continueLine: sv ? (sv.mode === 'daily' ? (sv.daily && di.days[sv.daily.date] ? 'Daily Soak practice replay in progress' : 'Daily Soak in progress') : `${sv.players.map((p) => p.name).join(' vs ')} · move ${sv.move + 1}${sv.challenge ? ' · Challenge' : ''}`) : '', dailyLine: UI.dailyLine(di), dailyDone: !!di.today, found, total: lex.data.words.length, loading: !G.ready });
    }
    case 'setup': return UI.setupHtml(G.setup, { houseOpen: !!G.houseOpen });
    case 'help': {
      const challengeOn = challengeLive();
      return UI.helpHtml(G.helpTab, lex, challengeOn ? [] : twoLetterWords(), { challengeOn });
    }
    case 'settings': return UI.settingsHtml(G.settings, typeof navigator.vibrate === 'function');
    case 'register': return UI.registerHtml(lex, register(), G.noSave, G.newerSave);
    case 'records': return UI.recordsHtml(stats(), { found: lex.data.words.filter((e) => e.forms.some((f) => register()[f])).length, total: lex.data.words.length, daily: dailyInfo(), today: today() });
    case 'about': return UI.aboutHtml(META);
    case 'over': {
      if (G.s.mode !== 'daily') return UI.overHtml(G.s, lex, null, { pb: pbLines(), review: reviewSeat(G.s) != null, dailyPlayed: !!dailyInfo().today, barks: G.s.players.map((p, k) => (p.kind === 'ai' ? endBark(G.s, k) : null)) });
      const d = store.json(KEYS.daily, { days: {}, streak: 0 }, validDaily), date = G.s.daily.date, day = d.days[date];
      const dr = dailyDone.get(G.s);
      const official = day ? (day.first != null ? day.first : day.score) : G.s.players[0].score;
      const isReplay = dr ? dr.isReplay : !!(day && day.plays > 1);
      const label = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      return UI.overHtml(G.s, lex, { label, best: official, official, isReplay, replayBest: day && day.replayBest != null ? day.replayBest : null, streak: d.streak || 1, rested: d.rest === date, first: day ? (day.first != null ? day.first : day.score) : null, plays: day ? day.plays : 1, par: (day && day.par) || cachedPar(date) || null }, { review: reviewSeat(G.s) != null });
    }
  }
  return '';
}

function defaultSetup() {
  const last = G.settings.lastSetup;
  if (last) return JSON.parse(JSON.stringify(last));
  const newcomer = stats().games === 0;
  return { seats: [{ kind: 'human', name: '' }, { kind: 'ai', persona: newcomer ? 'opal' : 'hollis' }], hints: true };
}

function wireScreen(name) {
  const scr = $('#screen');
  scr.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
  scr.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', back));
  // tabs and radio groups are one Tab stop each: the arrow keys, Home and End move inside and choose (Up and Down only in radio groups, so they still scroll Help)
  scr.querySelectorAll('[role="tablist"], [role="radiogroup"]').forEach((g) => g.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const items = [...g.querySelectorAll('[role="tab"], [role="radio"]')], at = items.indexOf(e.target.closest('button')), n = items.length;
    const radio = g.getAttribute('role') === 'radiogroup';
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: radio && 1, ArrowUp: radio && -1 }[e.key];
    const to = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : step ? (at + step + n) % n : -1;
    if (at < 0 || to < 0) return;
    e.preventDefault();
    if (to !== at) { items[to].click(); document.activeElement.scrollIntoView({ block: 'nearest' }); }   // the sheet may have been scrolled away from it
  }));
  if (name === 'setup') {
    const st = G.setup;
    scr.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => {
      const k = +b.dataset.k; const seat = st.seats[k];
      if (b.dataset.kind === 'human') { seat.kind = 'human'; seat.name = seat.name || ''; }
      else { if (seat.kind !== 'ai') delete seat.level; seat.kind = 'ai'; seat.persona = seat.persona || PERSONAS[(k + 1) % PERSONAS.length].id; }
      showScene('setup', { focus: `[data-kind="${b.dataset.kind}"][data-k="${k}"]` });
    }));
    scr.querySelectorAll('[data-name]').forEach((inp) => inp.addEventListener('input', () => { st.seats[+inp.dataset.name].name = inp.value; }));
    scr.querySelectorAll('[data-persona]').forEach((b) => b.addEventListener('click', () => {
      const seat = st.seats[+b.dataset.persona];
      seat.persona = b.dataset.val;
      delete seat.level;
      showScene('setup', { focus: `[data-persona="${b.dataset.persona}"][data-val="${b.dataset.val}"]` });
    }));
    scr.querySelectorAll('[data-level]').forEach((sel) => sel.addEventListener('change', () => { st.seats[+sel.dataset.level].level = sel.value; G.houseOpen = true; showScene('setup', { focus: `[data-level="${sel.dataset.level}"]` }); }));
    scr.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => {
      const k = +b.dataset.remove;
      st.seats.splice(k, 1);
      showScene('setup', { focus: st.seats.length > 2 ? `[data-remove="${Math.min(k, st.seats.length - 1)}"]` : '[data-add]' });
    }));
    const add = scr.querySelector('[data-add]');
    if (add) add.addEventListener('click', () => {
      const used = new Set(st.seats.map((x) => x.persona));
      st.seats.push({ kind: 'ai', persona: (PERSONAS.find((p) => !used.has(p.id)) || PERSONAS[0]).id });
      showScene('setup', { focus: st.seats.length < 4 ? '[data-add]' : `[data-remove="${st.seats.length - 1}"]` });
    });
    const hr = scr.querySelector('.house-rules');
    const syncHouseSummary = () => {
      const sum = scr.querySelector('.house-rules summary small');
      if (!sum) return;
      const bits = [];
      if (st.challenge) bits.push('Challenge on');
      if (st.hintsUnl && !st.challenge) bits.push('Unlimited hints');
      if (st.seats.some((x) => x.kind === 'ai' && x.level && x.level !== persona(x.persona).level)) bits.push('Custom difficulty');
      sum.textContent = bits.length ? bits.join(' · ') : 'Difficulty, hints & Challenge';
    };
    if (hr) hr.addEventListener('toggle', () => { G.houseOpen = hr.open; });
    let savedHints = null;
    scr.querySelector('[data-hints]').addEventListener('change', (e) => { st.hints = e.target.checked; scr.querySelector('[data-hints-unl]').disabled = !e.target.checked; });
    scr.querySelector('[data-hints-unl]').addEventListener('change', (e) => { st.hintsUnl = e.target.value === 'unl'; syncHouseSummary(); });
    scr.querySelector('[data-challenge]').addEventListener('change', (e) => {
      st.challenge = e.target.checked;
      const hi = scr.querySelector('[data-hints]'), unl = scr.querySelector('[data-hints-unl]');
      if (st.challenge) {
        if (savedHints == null) savedHints = !!st.hints;
        st.hints = false;
        hi.checked = false; hi.disabled = true; unl.disabled = true;
      } else {
        if (savedHints != null) { st.hints = savedHints; savedHints = null; }
        hi.disabled = false; hi.checked = !!st.hints; unl.disabled = !st.hints;
      }
      const note = scr.querySelector('[data-hints-note]');
      if (note) note.textContent = st.challenge ? 'Spring Guide hints are off while Challenge mode is on.' : 'Personal bests are for unaided games: taking any hint, or turning Unlimited hints on, sets no personal best.';
      syncHouseSummary();
    });
    scr.querySelector('[data-start]').addEventListener('click', () => {
      G.settings.lastSetup = st; saveSettings();
      replaceSave(() => newGame({ mode: 'play', hintsUnl: !!st.hintsUnl && !st.challenge, challenge: !!st.challenge, seats: st.seats.map((x, k) => (x.kind === 'human' ? { kind: 'human', name: (x.name || '').trim() || (st.seats.filter((y) => y.kind === 'human').length > 1 ? `Player ${k + 1}` : 'You') } : { kind: 'ai', persona: x.persona, level: seatLevel(x), name: persona(x.persona).name })), hints: st.hints && !st.challenge }));
    });
  }
  if (name === 'help') {
    const wc = scr.querySelector('[data-wordcheck]');
    if (wc) wc.addEventListener('submit', (e) => { e.preventDefault(); wc.querySelector('.wc-out').textContent = wordCheck(wc.querySelector('input').value); });
  }
  if (name === 'help') scr.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { G.helpTab = b.dataset.tab; showScene('help', { focus: `[data-tab="${G.helpTab}"]` }); }));
  if (name === 'settings') {
    scr.querySelectorAll('[data-set]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.set, raw = b.dataset.val;
      G.settings[k] = raw === 'true' ? true : raw === 'false' ? false : isNaN(+raw) ? raw : +raw;
      saveSettings(); showScene('settings', { focus: `[data-set="${k}"][data-val="${raw}"]` });
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
      r.addEventListener('input', (e) => { unlock(); G.settings[key] = +e.target.value; saveSettings(); });
      if (key !== 'musicVol') r.addEventListener('change', () => { unlock(); sfx('place'); });
    }
  }
  if (name === 'register') {
    scr.querySelectorAll('[data-reg]').forEach((b) => b.addEventListener('click', () => openFact(b.dataset.reg)));
    const nudge = scr.querySelector('.reg-nudge');
    scr.querySelectorAll('[data-reg-locked]').forEach((b) => b.addEventListener('click', () => {
      const cat = G.lex.categories[b.dataset.cat];
      const msg = `Not found yet: ${b.dataset.len}-letter ${cat ? cat.name : ''} word (+${b.dataset.tier} Hot Springs bonus). Form it on the board to unlock its history card.`;
      scr.querySelectorAll('.reg-lock.active').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      if (nudge) { nudge.textContent = msg; nudge.hidden = false; }
      liveSay(msg);
    }));
  }
  if (name === 'over') {
    scr.querySelectorAll('[data-fact]').forEach((b) => b.addEventListener('click', () => openFact(b.dataset.fact, b.dataset.form)));
    scr.querySelector('[data-review]')?.addEventListener('click', openReview);
    const again = scr.querySelector('[data-again]');
    if (again) again.addEventListener('click', () => newGame({ mode: 'play', seats: G.s.players.map((p) => ({ kind: p.kind, name: p.name, persona: p.persona, level: p.level })), hints: G.s.players.some((p) => p.hints != null), hintsUnl: G.s.players.some((p) => p.unl), challenge: !!G.s.challenge }));
    const nextOpp = scr.querySelector('[data-next-opp]');
    if (nextOpp) nextOpp.addEventListener('click', () => {
      const per = persona(nextOpp.dataset.nextOpp);
      if (!per) return;
      const human = G.s.players.find((p) => p.kind === 'human');
      newGame({
        mode: 'play',
        seats: [
          { kind: 'human', name: human ? human.name : 'You' },
          { kind: 'ai', persona: per.id, level: per.level, name: per.name },
        ],
        hints: G.s.players.some((p) => p.hints != null),
        hintsUnl: G.s.players.some((p) => p.unl),
        challenge: !!G.s.challenge,
      });
    });
  }
}

function go(where) {
  unlock();
  if (where === 'continue') { const record = gameSaves.read(); if (record.game) resumeGame(record); return; }
  if (where === 'setup') { G.setup = defaultSetup(); G.houseOpen = false; showScene('setup'); return; }
  if (where === 'daily') {
    const launch = () => {
      const di = dailyInfo();
      if (di.today) {
        const official = di.today.first != null ? di.today.first : di.today.score;
        confirmDialog(
          'Practice replay?',
          `Today's official Daily Soak score (${official} points) is already recorded. Replaying uses the same tiles for practice and will not change your official score or Records.`,
          'Practice replay',
          () => startDaily(),
        );
        return;
      }
      startDaily();
    };
    replaceSave(launch);
    return;
  }
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
    if (opts.hints === false || s.challenge) for (const p of s.players) { p.hints = null; delete p.unl; delete p.taken; }
    for (const p of s.players) if (p.kind !== 'human') p.hints = null;
    if (opts.hints !== false && opts.hintsUnl && !s.challenge) for (const p of s.players) if (p.kind === 'human') { p.unl = true; p.taken = 0; }
    beginGame(s, intent);
  });
}
function startDaily(date) {
  const intent = gameSaves.newIntent();
  whenReady(() => {
    const s = E.createGame({ mode: 'daily', date: date || today(), seats: [{ kind: 'human', name: 'You' }] }, G.lex);
    s.players[0].hints = null;
    beginGame(s, intent);
  });
}
function resumeGame(record) { whenReady(() => beginGame(record.game, record)); }
function beginGame(s, intent) {
  clearTimeout(G.aiTimer); G.aiTimer = 0;
  G.aiHeld = null; G.aiFire = null; G.aiBusy = false; G.aiSkip = false; G.aiToken++;
  G.animUntil = 0; G.busyUntil = 0; G.lastPulse = null; G.badPulse = null; G.pendingVfx = null;
  cancelTurnTimers();
  clearTimeout(errFlashTimer); G.errFlash = false;
  clearTimeout(scoreHiTimer); G.scoreHi = null; cancelScoreRoll(); endFlip(); endReturn();
  clearTimeout(G.plaqueTimer); G.plaqueHi.clear(); G.plaqueSnap = null; clearPlaqueFx(); G.springsOpen = false;
  clearFx(); steam.arcLog.length = 0;
  document.querySelectorAll('#boardwrap .pop').forEach((el) => el.remove());
  if (!G.settings.tipsSeen) store.put(KEYS.settings, G.settings); // the newcomer flag is written before the first save, so a tab closed mid-tips still counts as a newcomer
  G.bark = null; if (!s.log.length) G.lastLine = '';   // a new game does not open on the last one's line
  const handle = gameSaves.open(s, intent);
  gameHandles.set(s, handle);
  G.s = s;
  G.bagLen = s.bag.length;
  G.staged = []; G.selected = null; G.hint = null; G.hintAlts = null; G.preview = null; G.anim.clear(); G.last = new Set(lastTiles(s));
  G.revealed = -1; G.lastHuman = -1; G.privacy = false;
  resetOrder();
  if (!turnPrivacy()) restoreHint(s);
  R.view.zoom = 1; R.view.cx = R.U / 2; R.view.cy = R.U / 2;
  showScene('game');
  saveNotice(s, gameSaves.status(handle));
  if (s.mode === 'daily') findPar(s.daily.date, s);
  startTurn();
  if (UI.dailyOpening(s)) { const tip = $('#coach p'); liveSay(`${UI.todaysSprings(s, G.lex, false, s.daily.date === today()).say}${tip ? ` Tip: ${tip.textContent}` : ''}`); }
}
// A hint taken this turn comes back after a reload, put on the board as it was (only if it still fits: the rack, the board and the turn).
function restoreHint(s) {
  const h = s.hintStaged;
  if (!h || s.challenge || h.move !== s.move || s.over || cur().kind !== 'human' || G.staged.length || !Array.isArray(h.tiles) || h.tiles.length > RACK) return;
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
  const live = () => token === G.aiToken && G.s === s && s.move === move && s.cur === seat && !s.over && G.scene === 'game';
  const act = (action) => {
    G.aiBusy = false;
    const res = E.apply(s, action, ctx());
    if (!res.ok) { console.warn('AI move refused', res.error); E.apply(s, { type: 'pass' }, ctx()); }
    afterAction(res.ok ? res.entry : s.log[s.log.length - 1], true);
  };
  const dropped = () => { if (token === G.aiToken) G.aiBusy = false; };   // the game it was for is gone: nobody is thinking any more, unless a newer turn is
  aiMove(s, cur().level, cur().persona).then((r) => {
    if (token !== G.aiToken || G.s !== s || s.over) { dropped(); return; }
    const wait = G.aiSkip ? 0 : Math.max(0, delay - (performance.now() - t0));
    const fire = () => {
      G.aiFire = null;
      if (!live()) { dropped(); return; }
      s.rng.ai = r.rngAi;
      act(r.action);
    };
    // a hidden tab, open menu/ledger, or in-session sheet holds the reply (and its cue) until the player is back in 'game'
    G.aiFire = fire;
    G.aiTimer = setTimeout(() => {
      G.aiTimer = 0;
      if (token !== G.aiToken || G.s !== s || s.over) { G.aiFire = null; dropped(); return; }
      if (document.hidden || G.dialog || G.scene !== 'game') { G.aiFire = null; G.aiHeld = fire; }
      else fire();
    }, wait);
  }).catch((err) => {
    console.warn('AI failed, passing', err);
    const passFire = () => { if (live()) act({ type: 'pass' }); };
    if (token === G.aiToken && G.s === s && !s.over && G.scene !== 'game') G.aiHeld = passFire;
    else passFire();
  });
}

// A tap on the board, or Space or Enter, while the computer is taking its turn lets its move land at once (the same path as the
// Instant speed, for this move only): the wait for its reply, then the tiles flying in and the hand-over beat. Also skips
// the post-final-move Game Over delay straight to 'over'. Never during a menu.
function skipComputerWait() {
  if (G.scene !== 'game' || G.dialog || !G.s || G.privacy) return false;
  if (G.s.over) {
    if (G.overTimer) { G.pendingVfx = null; cancelTurnTimers(); showScene('over'); return true; }
    if (G.turnWait) {
      G.pendingVfx = null;
      cancelTurnTimers();
      G.anim.clear(); G.animUntil = 0; G.busyUntil = 0; G.lastPulse = null;
      finishGame();
      if (G.overTimer) { cancelTurnTimers(); showScene('over'); }
      return true;
    }
    return false;
  }
  if (G.aiBusy) {
    G.aiSkip = true;   // the reply is still being worked out: it lands the moment it is ready
    if (G.aiFire) { clearTimeout(G.aiTimer); G.aiTimer = 0; const f = G.aiFire; G.aiFire = null; f(); }
    return true;
  }
  if (G.turnWait && G.turnWait.fromAi && performance.now() < G.busyUntil) {
    const snapVfx = G.pendingVfx; G.pendingVfx = null;
    cancelTurnTimers();
    G.anim.clear(); G.animUntil = 0; G.busyUntil = 0; G.lastPulse = null;
    if (snapVfx) snapVfx();
    startTurn();
    return true;
  }
  return false;
}

// lets a held reply land once the tab is back, no dialog is open, and the player is in the game scene
function releaseAi() {
  if (!G.aiHeld || document.hidden || G.dialog || G.scene !== 'game') return;
  const f = G.aiHeld; G.aiHeld = null; f();
}

const ctx = () => ({ dict: G.dict, lex: G.lex });

// Unified turn-phase timer registry (W4-S2-01): tracks later() celebration/yourturn cues, AI tile clacks,
// G.turnWait, closeDialog()'s releaseAi timer, and finishGame()'s 900 ms transition so skipping or leaving cancels all.
function addTurnTimer(fn, ms) {
  const id = setTimeout(() => { G.turnTimers.delete(id); fn(); }, ms);
  G.turnTimers.add(id);
  return id;
}
function cancelTurnTimers() {
  if (G.turnWait) { clearTimeout(G.turnWait.id); G.turnWait = null; }
  for (const id of G.turnTimers) clearTimeout(id);
  G.turnTimers.clear();
  clearTimeout(G.releaseAiTimer); G.releaseAiTimer = 0;
  clearTimeout(G.overTimer); G.overTimer = 0;
}
// run `fn` in `ms` milliseconds, as a sound that waits for the tiles to land; it is dropped if another game has begun, scene left, or the turn is cancelled
const later = (g, ms, fn) => { if (ms <= 0) { if (G.s === g && G.scene === 'game') fn(); } else addTurnTimer(() => { if (G.s === g && G.scene === 'game') fn(); }, ms); };

// W4-P-N02, W4-S1-01 & W4-S1-02: scale per-persona AI drop choreography and hand-over beat with Settings -> Computer speed.
// Contact occurs deterministically at k2 = CONTACT_K (0.72, ~230 ms at Normal) inside frame(), removing detached setTimeout clacks (CD-WF4-04).
const AI_PACE = {
  normal:  { scale: 1,    drop: 320, beat: 250, pulse: 900 },
  fast:    { scale: 0.45, drop: 160, beat: 100, pulse: 550 },
  instant: { scale: 0,    drop: 0,   beat: 0,   pulse: 0 },
};
function aiTileSchedule(tiles, personaId, scale) {
  const pm = personaMotion(personaId);
  const step = Math.round(pm.stagger * scale);
  const cresc = pm.crescendo > 0 && tiles.length >= 5 ? Math.round((tiles.length >= 7 ? pm.crescendo + 30 : pm.crescendo) * scale) : 0;
  return tiles.map((t, k) => ({
    offset: k * step + (cresc && k === tiles.length - 1 ? cresc : 0),
    lift: pm.lift,
    roll: pm.roll && SQUARES[t.i] && SQUARES[t.i] !== '.' ? (k % 2 === 0 ? pm.roll : -pm.roll) : 0,
  }));
}

function afterAction(entry, fromAi) {
  const s = G.s;
  if (G.pendingVfx && G.pendingVfx.say && G.pendingVfx.s === s) G.pendingVfx.say();   // a play made while the last one's tiles were in the air: its banners still show
  G.pendingVfx = null;
  cancelTurnTimers();
  const prevPlaqueSnap = G.plaqueSnap && G.plaqueSnap.s === s ? G.plaqueSnap.list : null;
  const fogRevealed = !!(prevPlaqueSnap && s.featured.some((f, k) => f.by == null && prevPlaqueSnap[k] && f.shown.length > prevPlaqueSnap[k].shown));
  const bagJustEmptied = s.mode !== 'daily' && !s.over && G.bagLen > 0 && s.bag.length === 0;
  G.bagLen = s.bag.length;
  cancelDrag(); endReturn(); endFlip();
  G.flash = null; G.badPulse = null; G.hoverInfo = null; G.hoverBath = null; clearTimeout(hoverTapTimer);
  const said = s.players[entry.p].kind === 'ai' ? barkFor(s, entry) : null;
  G.bark = said ? { ...said, persona: s.players[entry.p].persona } : null;
  if (entry.kind === 'play' && s.players[entry.p].kind === 'human') coachPlayed();
  // the next player's rack is ready at once (the move is applied), even while the tiles are still landing
  resetOrder(); G.preview = null; G.hint = null; G.breakdown = false; delete s.hintStaged;
  G.deal = !fromAi && entry.kind !== 'pass' && humans() === 1;
  if (!s.over && cur().kind === 'human') G.privacy = turnPrivacy();
  const aiPace = fromAi ? (AI_PACE[G.settings.ai] || AI_PACE.normal) : null;
  const aiInstant = !!(fromAi && (G.fast || G.settings.ai === 'instant'));
  const aiAnim = !!(fromAi && !aiInstant && animOn());
  const perId = fromAi ? s.players[entry.p].persona : null;
  const aiSched = aiAnim && entry.kind === 'play' ? aiTileSchedule(entry.tiles, perId, aiPace.scale) : null;
  const lastOff = aiSched && aiSched.length ? aiSched[aiSched.length - 1].offset : 0;
  const contactMs = aiPace ? Math.round(aiPace.drop * R.CONTACT_K) : 0;
  // seconds until the computer's tiles make marble contact (nothing to wait for on instant, pass/swap, or with animation off)
  const landed = aiAnim && entry.kind === 'play' ? (lastOff + contactMs) / 1000 : 0;
  if (entry.kind === 'play') {
    G.last = new Set(entry.tiles.map((t) => t.i)); G.lastPulse = null;
    const avgPan = colPan(Math.round(entry.tiles.reduce((a, t) => a + (t.i % N), 0) / entry.tiles.length));
    if (aiAnim) {
      const t0 = performance.now();
      entry.tiles.forEach((t, k) => {
        const sch = aiSched[k];
        G.anim.set(t.i, { t0: t0 + sch.offset, dur: aiPace.drop, kind: 'ai', lift: sch.lift, roll: sch.roll, persona: perId, pan: colPan(t.i), step: k, sq: SQUARES[t.i], clacked: false });
      });
      G.animUntil = t0 + lastOff + aiPace.drop + 20;
      G.lastPulse = { t0: G.animUntil - 20, dur: aiPace.pulse };
      tick();
    } else if (aiInstant) {
      G.anim.clear(); G.animUntil = 0;
      sfx('place', { pan: avgPan });
    } else {
      sfx('play', { pan: avgPan, tiles: entry.tiles.length });
      if (!fromAi && animOn()) {
        // W4-S1-01 / CD-WF4-04: zero-hit-stop, non-blocking <= 150 ms human Play commit press finishing cleanly before STING_LAG (280 ms).
        const t0 = performance.now(), L = entry.tiles.length;
        const step = L > 1 ? Math.min(20, Math.floor(60 / (L - 1))) : 0, dur = 90;
        G.anim.clear();
        entry.tiles.forEach((t, k) => G.anim.set(t.i, { t0: t0 + k * step, dur, kind: 'commit' }));
        const end = t0 + (L - 1) * step + dur;
        G.animUntil = end + 10;
        G.lastPulse = { t0: end, dur: 480 };
        tick();
      }
    }
    celebrate(entry, G.bark, landed, prevPlaqueSnap, { fogRevealed, bagJustEmptied });
    try { recordRegister(entry); } catch (e) { /* the register is a keepsake: a failed write never stops the game */ }
  } else {
    if (!entry.challenge) sfx(entry.kind === 'swap' ? 'swap' : 'turn');
    if (fogRevealed) later(s, 80, () => sfx('reveal'));
  }
  if (fromAi && !s.over && cur().kind === 'human') later(s, landed * 1000 + (aiInstant ? 120 : 300), () => { if (!s.over && cur().kind === 'human') sfx('yourturn'); });   // the hand-over, once the computer's move has landed
  const cats = new Set((entry.words || []).map((w) => w.themed && G.lex.byId.get(w.themed)?.cat));
  announce(entry, fogRevealed && s.featured.some((f, k) => f.by == null && cats.has(f.cat) && prevPlaqueSnap[k] && f.shown.length > prevPlaqueSnap[k].shown));
  moodUpdate();
  if (cur().kind === 'human' && !fromAi) G.lastHuman = s.cur;
  if (s.over) persistEndgame(s);
  save(s);
  const wait = G.fast || aiInstant ? 0 : (aiAnim ? Math.max(0, G.animUntil - performance.now()) + aiPace.beat : (fromAi && G.settings.ai === 'fast' ? 100 : 150));
  G.busyUntil = performance.now() + wait;
  const runTurn = () => {
    G.turnWait = null;
    if (G.s !== s) return;
    if (G.scene !== 'game') { G.aiHeld = runTurn; return; }
    startTurn();
  };
  G.turnWait = { fromAi, run: runTurn, id: setTimeout(runTurn, wait) };
  const prevScore = entry && entry.kind === 'play' && s.players[entry.p] ? Math.max(0, s.players[entry.p].score - (entry.score || 0)) : 0;
  renderGame();
  rollScores(entry, prevScore);
}

// A game is finished once. More than one start-of-turn timer can still be pending when the last move lands (a move
// played while the tiles of the one before were in the air); without this each of them replayed the fanfare, counted a
// Daily Soak again and brought the results screen back after the player had left it.
const finishedGames = new WeakSet();
function finishGame() {
  const s = G.s;
  if (!s || finishedGames.has(s)) return;
  finishedGames.add(s);
  persistEndgame(s);
  save(s);
  if (G.scene !== 'game') return;
  if (s.mode === 'daily') findPar(s.daily.date, s);
  const oc = UI.outcome(s);
  sfx(s.mode === 'daily' || oc === 'win' || oc === 'tie' ? 'fanfare' : oc === 'loss' ? 'defeat' : 'turn');
  clearTimeout(G.overTimer);
  // the menu, a card or a sheet opened meanwhile holds the results until it is closed, as it does a computer's reply
  G.overRun = () => {
    G.overTimer = 0;
    if (G.s !== s || G.scene !== 'game') return;
    if (G.dialog) G.aiHeld = G.overRun; else showScene('over');
  };
  G.overTimer = setTimeout(G.overRun, G.fast ? 0 : 900);
}

// What the finished game set, for the results screen ("new personal best").
function pbLines() {
  const r = G.pb && G.pb.s === G.s ? G.pb.pb : null;
  if (!r) return [];
  const st = stats(), out = [];
  if (r.first) out.push('First game on your record.');
  if (r.held) out.push(r.heldBy === 'unlimited' ? 'Unlimited hints were on, so this game sets no personal best.' : 'You took a hint, so this game sets no personal best.');
  if (r.score) out.push(`New personal best: ${st.bestScore} points.`);
  if (r.play) out.push(`New best turn: ${st.bestPlay.score} points for ${st.bestPlay.word}.`);
  if (r.word) out.push(`New best word: ${st.bestWord.word}, ${st.bestWord.score} points.`);
  return out;
}

const STING_LAG = 0.28;   // seconds: the score sting follows the clacks of the tiles instead of landing on them
// Resolve exact board cell indices of scored words from the post-play board without altering saved log entries.
function scoredWordCells(board, tiles, words) {
  if (!tiles || !tiles.length || !words || !words.length) return [];
  const prev = board.slice();
  for (const t of tiles) prev[t.i] = null;
  const found = findWords(prev, tiles);
  if (!found || !found.words) return tiles.map((t) => t.i);
  const want = new Set(words.map((w) => w.w));
  const out = [], seen = new Set();
  for (const fw of found.words) {
    if (!want.has(fw.w)) continue;
    for (const ci of fw.cells) if (!seen.has(ci)) { seen.add(ci); out.push(ci); }
  }
  return out;
}
// Toasts and effects for a play: Full Soak, Hot Springs words, a Featured Spring.
// `wait` is the seconds the computer's tiles take to land: audio cues, board VFX, the score pop and the banners hold back until touchdown (W4-S5-13, W5-S3-16).
function celebrate(e, bark, wait = 0, prevPlaqueSnap = null, extra = {}) {
  const held = [], tell = (t) => { if (wait > 0) held.push(t); else toast(t); }, say = () => { for (const t of held.splice(0)) toast(t); };
  if (wait > 0) later(G.s, wait * 1000, () => landClacks(Infinity));   // first in line, so a late frame cannot put the last tile's clack after its own sting
  const s = G.s, cue = (name, opts) => later(s, wait * 1000, () => sfx(name, opts));
  const p = G.s.players[e.p];
  const themed = e.words.filter((w) => w.themed);
  const themedCells = scoredWordCells(s.board, e.tiles, themed);
  let found = false;
  if (p.kind === 'human' && (e.full || e.featured)) buzz('big');
  const who = bark ? { p, k: e.p } : null, quote = (ev) => (bark && bark.event === ev ? `“${bark.text}”` : null);
  const claimedFeats = Array.isArray(e.featuredAll) && e.featuredAll.length ? e.featuredAll : (e.featured ? [e.featured] : []);
  if (claimedFeats.length) {
    for (const fw of claimedFeats) tell({ kind: 'featured', who, title: `Featured Spring: ${fw}`, sub: `${quote('themed') || `${p.name} found it`} · +${FEATURED_BONUS}`, fact: G.lex.entry(fw)?.id, form: fw });
    cue('featured');
  }
  for (const w of themed) {
    const entry = G.lex.byId.get(w.themed);
    const fresh = p.kind === 'human' && !register()[w.w];   // celebrate runs before recordRegister: this is the first time the word is signed in
    if (fresh) found = true;
    tell({ kind: 'themed', title: `${w.w} +${w.bonus}${w.bath ? ` · Row +${ROW_BONUS}` : ''}`, sub: fresh ? 'New in your Register' : G.lex.categories[entry.cat].name, fact: entry.id, form: w.w });
  }
  const fireVfx = () => {
    if (G.s !== s || G.scene !== 'game') return;
    const tileCells = e.tiles.map((t) => t.i);
    const wordSprings = e.tiles.filter((t) => SQUARES[t.i] === 's' || SQUARES[t.i] === 'b').map((t) => t.i);
    const rowCells = e.tiles.filter((t) => SQUARES[t.i] === 'B').map((t) => t.i);
    const rimCells = [...new Set([...wordSprings, ...rowCells])];
    const boilBlank = e.tiles.filter((t) => SQUARES[t.i] === 'b' || t.blank).map((t) => t.i);
    steam.lastTier = 1; steam.lastEvent = 'quiet';
    if (e.full > 0) {
      // Tier 3 Climax: Full Soak (+40) 7-tile staggered 4-point brass-star perimeter cascade, never suppressed by themed.length; supersedes dense steamBurst clouds.
      steam.lastTier = 3; steam.lastEvent = claimedFeats.length ? 'full-soak+featured' : 'full-soak';
      sparkBurst(tileCells, { full: true });
      if (themedCells.length) goldSweep(themedCells);
    } else if (claimedFeats.length) {
      // Tier 3 Climax: Featured Spring (+30) claim with rising sightline arc + board origin star flash.
      steam.lastTier = 3; steam.lastEvent = 'featured';
      if (themedCells.length) goldSweep(themedCells);   // the claim outranks the steam, as a Full Soak does; its cue already replaces the steam's
      fxFlash([tileCells[Math.floor(tileCells.length / 2)]], FX_SHAPES.score, { dur: 220, color: '#FFE06E' });
    } else if (themedCells.length) {
      // Tier 2: Hot Springs themed word (bevel goldSweep + restrained <=0.22 perimeter steam + optional 160ms 2W/3W/Row glint).
      steam.lastTier = 2; steam.lastEvent = rowCells.length ? 'themed+row' : 'themed';
      steamBurst(themedCells);
      goldSweep(themedCells);
      if (rimCells.length) fxFlash(rimCells, FX_SHAPES.row, { dur: 160, color: '#FFE06E' });
    } else {
      // Tier 2 Standard: routine 2L/3L stay quiet on #fx (CD-WF4-03); a big play throws its sparks and nothing else; otherwise 2W/3W & Bathhouse Row get a single 160ms octagonal rim glint, and Boiling/blank a restrained puff.
      if (e.score >= UI.SCORE_BIG) { steam.lastTier = 2; steam.lastEvent = 'big'; sparkBurst(tileCells, { full: false }); }
      else {
        if (rimCells.length) { steam.lastTier = 2; steam.lastEvent = rowCells.length ? 'row' : 'word-spring'; fxFlash(rimCells, FX_SHAPES.word, { dur: 160, color: '#FFE06E' }); }
        if (boilBlank.length) {
          if (steam.lastTier < 2) { steam.lastTier = 2; steam.lastEvent = 'boil-blank'; }
          steamBurst(boilBlank, { localized: true });
        }
      }
    }
    emitPlaqueArcs(s, e, prevPlaqueSnap);
    scorePop(e, themed.length > 0);
  };
  if (wait > 0) {
    const land = () => { fireVfx(); say(); };
    land.s = s; land.say = say;
    G.pendingVfx = land;
    later(s, wait * 1000, () => {
      if (G.pendingVfx === land) G.pendingVfx = null;
      land();
    });
  } else {
    fireVfx();
  }
  if (themed.length && !e.featured) cue('steam');
  if (extra.fogRevealed) cue('reveal', { delay: 0.14 });
  if (extra.bagJustEmptied) cue('bagempty', { delay: 0.22 });
  if (e.full) { tell({ kind: 'soak', who, title: `Full Soak! +${FULL_SOAK}`, sub: quote('soak') || `${p.name} used all seven tiles.` }); cue('chime', { delay: STING_LAG }); }   // the chime follows the play (and a Featured Spring's bell) by a beat, so they do not stack at full volume
  // one sting a play: a Featured Spring or a Full Soak has its own, then a word new to the Register, then the size of the score
  const done = p.kind === 'human' ? UI.categoriesCompleted(G.lex, register(), e.words) : [];
  for (const ck of done) tell({ kind: 'themed', title: `${G.lex.categories[ck].name}: complete`, sub: 'All its words are in your Register.', keep: true });
  const st = done.length && !e.featured && !e.full ? 'fanfare' : UI.stingFor(e, found); if (st) cue(st, { delay: STING_LAG });
  if (!e.full && bark && bark.event === 'big') tell({ kind: 'bark', who, title: `${p.name}: ${e.words[0].w} +${e.score}`, sub: quote('big') });
}

function announce(e, catReveal = false) {
  const p = G.s.players[e.p];
  let t;
  if (e.kind === 'play') t = `${p.name} played ${e.words.map((w) => w.w).join(' and ')} for ${e.score}${e.themed ? `, including a Hot Springs bonus of ${e.themed}` : ''}${e.full ? ', with a Full Soak' : ''}${e.rowReveal || catReveal ? ', clearing a Featured Spring letter' : ''}.`;
  else if (e.challenge) t = `${p.name} played ${e.challenge}, which is not in the dictionary, and lost the turn.`;
  else t = e.kind === 'swap' ? `${p.name} swapped ${UI.plural(e.count, 'tile')}.` : `${p.name} passed.`;
  liveSay(t);
  G.lastLine = t;
}

// ---------- staging ----------
const stagedTiles = () => G.staged.map((t) => ({ i: t.i, l: t.l, blank: t.blank }));
function updatePreview() {
  if (G.flash) { G.flash = null; clearTimeout(flashTimer); }
  if (G.errFlash) { G.errFlash = false; clearTimeout(errFlashTimer); }
  if (!G.s || !G.staged.length) { G.preview = null; return; }
  // a Challenge game does not say whether the words are in the dictionary until they are played
  G.preview = E.evaluate(G.s, stagedTiles(), G.s.challenge ? { ...ctx(), skipDict: true } : ctx());
}
function flushSettle() {
  if (!G.settle.size) return;
  G.settle.clear(); G.settleUntil = 0; draw();
}
function stage(k, i, letter) {
  const s = G.s;
  if (!s || s.over || cur().kind !== 'human') return false;
  const l = cur().rack[k];
  if (l == null || i < 0 || s.board[i] || G.staged.some((t) => t.i === i || t.k === k)) return false;
  if (l === '?' && !letter) { askBlank((ch) => stage(k, i, ch)); return true; }
  endReturn(); endFlip(); flushSettle();
  G.breakdown = false;   // it covers the bottom rows of a phone's board: it closes when the tiles change
  G.staged.push({ k, i, l: l === '?' ? letter : l, blank: l === '?' });
  G.order = G.order.filter((x) => x !== k);
  G.selected = null; G.hint = null; G.badPulse = null;
  forgetHint(s);
  clearToasts();
  if (animOn()) { const now = performance.now(); G.settle.set(i, now); G.settleUntil = Math.max(G.settleUntil, now + R.SETTLE_MS + 10); }
  const sq = SQUARES[i];
  sfx('place', { pan: colPan(i), step: G.staged.length - 1, ...(sq && sq !== '.' && sq !== '*' ? { sq } : {}) }); buzz('stage');
  updatePreview(); renderStaging();
  return true;
}
function cellScreenBox(i, lift = R.STAGED_LIFT) {
  const b = $('#board');
  if (!b) return null;
  const br = b.getBoundingClientRect(), [cx, cy] = R.cellCenter(i, lift), sz = Math.round(pxPerCell());
  return { left: br.left + cx - sz / 2, top: br.top + cy - sz / 2, width: sz, height: sz };
}
function unstage(i, toPos) {
  const t = G.staged.find((x) => x.i === i);
  if (!t) return;
  endReturn(); endFlip(); flushSettle();
  const fromBox = animOn() && !G.drag && toPos == null && G.scene === 'game' ? cellScreenBox(i, R.STAGED_LIFT) : null;
  const flyTile = fromBox ? { l: t.blank ? '' : t.l, blank: t.blank } : null;
  G.staged = G.staged.filter((x) => x !== t);
  G.breakdown = false; G.badPulse = null;
  forgetHint(G.s);
  clearToasts();
  if (toPos != null) G.order.splice(toPos, 0, t.k); else G.order.push(t.k);
  sfx('recall');
  updatePreview(); renderStaging();
  if (fromBox && flyTile) {
    const destEl = document.querySelector(`#rack .rtile[data-k="${t.k}"]`);
    if (destEl) flyGhost(flyTile, fromBox, destEl.getBoundingClientRect(), 130, t.k);
  }
}
// a paid hint comes back after a reload only while its tiles are untouched: taking them back, or staging another tile, ends it
function forgetHint(s) { if (s && s.hintStaged) { delete s.hintStaged; save(s); } }
function recallAll() { G.breakdown = false; if (!G.staged.length) return; endReturn(); endFlip(); flushSettle(); for (const t of [...G.staged]) G.order.push(t.k); G.staged = []; G.badPulse = null; G.hoverInfo = null; G.hoverBath = null; clearTimeout(hoverTapTimer); forgetHint(G.s); sfx('recall'); updatePreview(); renderStaging(); }
function endFlip() {
  clearTimeout(G.flipTimer); G.flipTimer = 0;
  document.querySelectorAll('#rack .rtile').forEach((el) => {
    if (el.dataset.flip) { delete el.dataset.flip; const c = el.firstChild; c.style.transition = 'none'; c.style.transform = ''; }   // 'none' stops a slide under way; '' would let it run on
  });
}
function shuffleRack() {
  if (!(humanCanAct() || waiting())) return;   // not behind the pass-and-play curtain, on a finished game or while only computers play
  endReturn();
  const o = G.order;
  // Only the drawn face (the button's canvas) slides: each button is in its new place, to press or drag, from the first frame.
  // A shuffle in the middle of a shuffle goes on from where the faces are.
  const before = animOn() ? new Map([...document.querySelectorAll('#rack .rtile')].map((el) => [el.dataset.k, el.firstChild.getBoundingClientRect().left])) : null;
  endFlip();
  const snap = o.slice();
  for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
  if (o.length > 1 && o.every((v, idx) => v === snap[idx])) [o[0], o[1]] = [o[1], o[0]];
  sfx('shuffle'); renderRack();
  if (before && before.size) {
    const rk = $('#rack');
    const moved = [];
    document.querySelectorAll('#rack .rtile').forEach((el) => {
      const prevL = before.get(el.dataset.k);
      if (prevL == null) return;
      const c = el.firstChild, dx = prevL - c.getBoundingClientRect().left;
      if (Math.abs(dx) < 0.5) return;
      el.dataset.flip = '1';
      c.style.transition = 'none';
      c.style.transform = `translateX(${dx.toFixed(1)}px)`;
      moved.push(c);
    });
    if (moved.length && rk) {
      void rk.offsetWidth;
      for (const c of moved) { c.style.transition = 'transform 160ms cubic-bezier(0.22, 1, 0.36, 1)'; c.style.transform = ''; }
      G.flipTimer = setTimeout(endFlip, 175);
    }
  }
}

function humanCanAct() { return G.s && !G.s.over && cur().kind === 'human' && !G.aiBusy && !G.hintBusy && !G.privacy && G.scene === 'game' && !G.dialog; }

const BAD_PULSE_MS = 220;
function pulseBad(cells) {
  if (!animOn() || !cells || !cells.length || G.scene !== 'game') return;
  G.badPulse = { cells: [...new Set(cells)], t0: performance.now(), dur: BAD_PULSE_MS };
  draw();
}
function refusedCells(r) {
  const bw = r && r.words && r.badWord ? r.words.filter((w) => w.w === r.badWord).flatMap((w) => w.cells) : [];
  return bw.length ? [...new Set(bw)] : G.staged.map((t) => t.i);
}
function doPlay() {
  if (!humanCanAct()) return;
  cancelDrag(); endReturn(); endFlip(); flushSettle();   // a staged tile still in the air goes back to its square and counts
  if (!G.staged.length) { flash('Place tiles on the board first.'); oops(); return; }
  const r = E.apply(G.s, { type: 'play', tiles: stagedTiles() }, ctx());
  if (!r.ok && r.badWord && G.s.challenge) { loseTurn(r.badWord, refusedCells(r)); return; }
  if (!r.ok) { flash(r.error); oops(); shake(); pulseBad(refusedCells(r)); return; }
  buzz('play');
  afterAction(r.entry, false);
}
// Challenge: the word was not in the dictionary, so the play is not made and the turn is lost, as if the player had passed
function loseTurn(word, cells) {
  const r = E.apply(G.s, { type: 'pass' }, ctx());
  if (!r.ok) return;
  r.entry.challenge = word;
  oops(); shake();
  afterAction(r.entry, false);
  pulseBad(cells);
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
  if (!humanCanAct() || G.s.challenge) return;
  const p = cur();
  if (p.hints == null || (p.hints <= 0 && !p.unl)) return;
  cancelDrag(); endReturn(); endFlip();
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
const HINT_CLACK_S = 0.06, HINT_CLACK_GAIN = 0.5;   // seconds between the tiles of a hint as they are staged; how loud each clack is
// A Spring Guide play becomes a staged play the player can accept with Play, move, or recall.
function putHint(m) {
  const s = G.s;
  recallAll();
  for (const t of m.tiles) {
    const k = cur().rack.findIndex((l, j) => (t.blank ? l === '?' : l === t.l) && !G.staged.some((x) => x.k === j));
    if (k >= 0) { G.staged.push({ k, i: t.i, l: t.l, blank: t.blank }); G.order = G.order.filter((x) => x !== k); }
  }
  G.hint = null; G.breakdown = false; clearToasts();
  G.staged.forEach((t, k) => sfx('place', { pan: colPan(t.i), step: k, delay: k * HINT_CLACK_S, gain: HINT_CLACK_GAIN }));   // the tiles of a hint are set down one after another, softly
  if (animOn()) {
    // W4-S1-03: stagger visual G.settle entrance by k * 60 ms matching HINT_CLACK_S (flushable on any input).
    const now = performance.now(), stepMs = Math.round(HINT_CLACK_S * 1000);
    G.settle.clear();
    G.staged.forEach((t, k) => G.settle.set(t.i, now + k * stepMs));
    G.settleUntil = now + Math.max(0, G.staged.length - 1) * stepMs + R.SETTLE_MS + 10;
  }
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
  syncToastStaging();
  coachRender();
  draw();
  startSteam();
}
function clearPlaqueFx() {
  clearTimeout(G.plaqueFxTimer); G.plaqueFxTimer = 0; G.plaqueFx = null;
  document.querySelectorAll('.fog-clear').forEach((el) => el.classList.remove('fog-clear'));
  document.querySelectorAll('.just-claimed').forEach((el) => el.classList.remove('just-claimed'));
}
function syncPlaqueSnap(s) {
  const next = s.featured.map((f) => ({ by: f.by, shown: f.shown.length, indices: f.shown.slice() }));
  const prev = G.plaqueSnap && G.plaqueSnap.s === s ? G.plaqueSnap.list : null;
  G.plaqueSnap = { s, list: next };
  if (!prev || G.fast) return;
  if (reduced()) {
    const changed = [];
    for (let k = 0; k < next.length; k++) {
      if (prev[k] && (next[k].by !== prev[k].by || next[k].shown > prev[k].shown)) changed.push(k);
    }
    if (!changed.length) return;
    for (const k of changed) G.plaqueHi.add(k);
    clearTimeout(G.plaqueTimer);
    G.plaqueTimer = setTimeout(() => {
      G.plaqueHi.clear();
      document.querySelectorAll('.plaque-updated').forEach((el) => el.classList.remove('plaque-updated'));
    }, 750);
    return;
  }
  if (!animOn()) return;
  const cleared = new Map(), claimed = new Set();
  for (let k = 0; k < next.length; k++) {
    const p = prev[k];
    if (!p) continue;
    if (next[k].by != null && p.by == null) claimed.add(k);
    else if (next[k].by == null && p.by == null) {
      const oldSet = new Set(p.indices || []);
      const fresh = next[k].indices.filter((j) => !oldSet.has(j));
      if (fresh.length) cleared.set(k, fresh);
    }
  }
  if (!cleared.size && !claimed.size) return;
  clearTimeout(G.plaqueFxTimer);
  G.plaqueFx = { cleared, claimed, t0: performance.now() };
  G.plaqueFxTimer = setTimeout(clearPlaqueFx, 260);
}
function syncSpringsDrawer(open) {
  G.springsOpen = !!open;
  const host = $('#springs');
  if (!host) return;
  const btn = host.querySelector('[data-springs-toggle]');
  const tray = host.querySelector('#springs-tray');
  host.classList.toggle('open', G.springsOpen && !!tray);
  if (btn) {
    btn.setAttribute('aria-expanded', String(G.springsOpen));
    const claimed = G.s ? G.s.featured.filter((f) => f.by != null).length : 0;
    const total = G.s ? G.s.featured.length : 0;
    btn.setAttribute('aria-label', `Featured Springs, ${claimed} of ${total} found, +${FEATURED_BONUS} each. ${G.springsOpen ? 'Hide plaques.' : 'Show all three plaques.'}`);
  }
  if (tray) tray.hidden = !G.springsOpen;
}
function renderGame() {
  if (G.scene !== 'game' || !G.s) return;
  const s = G.s;
  const mobile = G.narrow = isNarrow();
  if (!mobile) G.springsOpen = false;
  syncPlaqueSnap(s);
  const scoresEl = $('#scores');
  scoresEl.classList.toggle('many', !mobile && s.players.length >= 3);
  scoresEl.innerHTML = mobile ? '' : UI.scoresHtml(s, false);
  const springs = $('#springs');
  springs.innerHTML = UI.springsHtml(s, G.lex, mobile, G.springsOpen);
  springs.classList.toggle('open', mobile && G.springsOpen);
  const fxAge = G.plaqueFx ? Math.round(performance.now() - G.plaqueFx.t0) : 0;
  const fxOn = (el, cls) => { el.classList.add(cls); if (fxAge > 0) el.style.animationDelay = `-${fxAge}ms`; };   // redrawn in mid-reveal: it goes on from there
  const toggle = springs.querySelector('[data-springs-toggle]');
  if (toggle) {
    if (G.plaqueHi.size) toggle.classList.add('plaque-updated');
    if (G.plaqueFx && G.plaqueFx.claimed.size) fxOn(toggle, 'just-claimed');
    toggle.addEventListener('click', () => {
      if (G.coach && coachBeat(G.coach) === 'plaques') coachDismiss('plaques');
      syncSpringsDrawer(!G.springsOpen);
    });
  }
  springs.querySelectorAll('[data-plaque]').forEach((b) => {
    const pk = +b.dataset.plaque;
    if (G.plaqueHi.has(pk)) b.classList.add('plaque-updated');
    if (G.plaqueFx) {
      if (G.plaqueFx.claimed.has(pk)) fxOn(b, 'just-claimed');
      const cols = G.plaqueFx.cleared.get(pk);
      if (cols && cols.length) {
        const letters = b.querySelectorAll('.pword b');
        for (const j of cols) if (letters[j]) fxOn(letters[j], 'fog-clear');
      }
    }
    b.addEventListener('click', () => {
      const f = s.featured[pk];
      if (G.coach && coachBeat(G.coach) === 'plaques') coachDismiss('plaques');
      if (f.by != null) { syncSpringsDrawer(false); openFact(G.lex.entry(f.word).id, f.word); }
      else flash(`Featured Spring: ${f.word.length} letters, ${G.lex.categories[f.cat].name}. Form any form of it to claim +${FEATURED_BONUS}.`);
    });
  });
  $('#log').innerHTML = UI.logHtml(s, G.lex) || '<li class="empty">Every play is written here: the words, the points, and any Hot Springs bonus.</li>';
  renderTurnline();
  resumeRolls();
  if (G.scoreHi != null) {
    scoreEls(G.scoreHi).forEach((el) => el.classList.add('score-updated'));
  }
  renderActions(); renderRack(); renderPreview(); renderPrivacy();
  coachRender();
  draw();
  startSteam();
}
function renderTurnline() {
  const tl = $('#turnline');
  if (!tl || !G.s) return;
  const s = G.s, mobile = isNarrow(), canTrack = !s.over && trackerSeat() >= 0;
  if (s.daily) {
    const turn = Math.min(E.DAILY_TURNS, E.DAILY_TURNS - s.daily.turns + 1);
    const par = cachedPar(s.daily.date);
    const score = s.players[0].score;
    const d = store.json(KEYS.daily, { days: {}, streak: 0, last: null }, validDaily);
    const prev = d.days[s.daily.date];
    const prior = prev ? (prev.first != null ? prev.first : prev.score) : null;
    let parsHtml = '';
    if (par) {
      const lo = Math.min(par.m, par.h), hi = Math.max(par.m, par.h);
      const stars = UI.dailyStars(score, par);
      parsHtml = `<span class="daily-pars" aria-label="Star targets: 1 star over ${lo}, 2 stars over ${hi}${stars ? `, ${UI.plural(stars, 'star')} reached` : ''}"><span class="par-pip${score > lo ? ' met' : ''}" title="1 star: beat ${lo}">★ ${lo}</span><span class="par-pip${score > hi ? ' met' : ''}" title="2 stars: beat ${hi}">★★ ${hi}</span></span>`;
    }
    const turnBadge = s.over ? '<span class="daily-turn">Daily complete</span>' : `<span class="daily-turn">Turn ${turn} / ${E.DAILY_TURNS}</span>`;
    const priorHtml = prior != null ? `<span class="daily-prior" title="Practice replay — official score already recorded">${mobile ? `Practice · ${prior}` : `Practice replay · ${prior}`}</span>` : '';
    const bagTxt = `${UI.plural(s.bag.length, 'tile')} in the bag`;
    const bagBtn = canTrack
      ? `<button type="button" class="bag-link" data-open-tracker aria-label="${esc(bagTxt)} — open Unseen tiles" title="Unseen tiles (Shift+U)">${bagTxt}</button>`
      : bagTxt;
    if (mobile) {
      const mobBag = canTrack
        ? `<button type="button" class="daily-bag bag-link" data-open-tracker aria-label="${esc(bagTxt)} — open Unseen tiles" title="Unseen tiles (Shift+U)">${s.bag.length} bag</button>`
        : `<span class="daily-bag">${s.bag.length} bag</span>`;
      tl.innerHTML = `<span class="chips daily-row">${turnBadge}${UI.scoresHtml(s, true)}</span><span class="daily-sub">${mobBag}${parsHtml}${priorHtml}</span>`;
    } else {
      tl.innerHTML = `<span class="who daily-head">${turnBadge}${priorHtml}</span><span class="bag daily-sub">${parsHtml}${parsHtml ? ' · ' : ''}${bagBtn}</span>`;
    }
    return;
  }
  const left = s.bag.length;
  const phaseCls = !s.over && left === 0 ? ' phase-empty' : !s.over && left < RACK ? ' phase-final' : '';
  const bagLine = left === 0
    ? 'Bag empty · go out to collect remaining tiles'
    : left < RACK
      ? `${UI.plural(left, 'tile')} ${mobile ? 'left' : 'in the bag'} · Final stretch · swaps closed`
      : `${UI.plural(left, 'tile')} in the bag`;
  const chalBadge = s.challenge ? '<span class="mode-badge" title="Challenge mode: invalid words cost your turn">Challenge</span>' : '';
  // phones: whose turn and the bag as two short tokens; only a long name may give way
  const short = !s.over && left >= RACK;
  const whose = cur().kind === 'ai' ? (SHORT[cur().persona] || cur().name) : humans() === 1 ? 'Your turn' : cur().name;
  const mobileBag = s.over ? 'Game over' : short ? `<span class="bag-who">${esc(whose)}</span><span class="bag-n"> · ${left} bag</span>` : bagLine;
  const bagEl = (txt, label = txt) => (canTrack
    ? `<button type="button" class="bag bag-btn${phaseCls}" data-open-tracker aria-label="${esc(label)} — open Unseen tiles" title="Unseen tiles (Shift+U)">${txt}</button>`
    : `<span class="bag${phaseCls}">${txt}</span>`);
  tl.innerHTML = mobile
    ? `<span class="chips">${UI.scoresHtml(s, true)}${chalBadge}</span>${bagEl(mobileBag, short ? `${cur().name}${cur().kind === 'ai' ? '' : ' to play'} · ${bagLine}` : mobileBag)}`
    : s.over ? `<span class="who turn-head"><span>Game over</span>${chalBadge}</span>` : `<span class="who turn-head"><span class="who-name">${esc(cur().name)}${cur().kind === 'ai' ? '' : ' to play'}</span>${chalBadge}</span>${bagEl(bagLine)}`;
}

function renderActions() {
  const s = G.s, p = cur(), human = p.kind === 'human' && !G.privacy;
  const el = $('#actions'), keyFocus = el.querySelector(':focus-visible');
  const hp = p.kind === 'human' ? p : s.players.slice(s.cur + 1).concat(s.players).find((x) => x.kind === 'human');   // Hint keeps its slot (disabled) while a computer plays, so nothing shifts
  el.innerHTML = UI.actionsHtml({ mobile: isNarrow(), staged: G.staged.length > 0, canSwap: s.bag.length >= RACK, canPlay: G.staged.length > 0 && G.preview && G.preview.ok, playScore: G.staged.length > 0 && G.preview && G.preview.ok ? G.preview.score : null, hints: !s.challenge && hp && hp.hints != null ? hp.hints : null, unlimited: !s.challenge && !!(hp && hp.unl) });
  el.classList.toggle('waiting', !human || s.over);
  el.querySelectorAll('[data-act]').forEach((b) => {
    if ((!human || s.over) && !(b.dataset.act === 'shuffle' && waitSeat())) b.disabled = true;
    b.addEventListener('click', () => { unlock(); ({ play: doPlay, pass: doPass, swap: doSwap, hint: doHint, recall: recallAll, shuffle: shuffleRack })[b.dataset.act](); });
  });
  if (keyFocus) $('#board').focus({ preventScroll: true });   // its button is gone (a Swap or Pass just confirmed, a tile staged): the board, not the top of the page
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
  const th = dark() ? 'dark' : 'light';
  const old = new Map([...el.querySelectorAll('.rtile')].map((b) => [b.dataset.key, b]));
  const button = (k) => {
    const l = rack[k], key = `${k}|${l}|${px}|${dim ? (wait ? 2 : 1) : 0}|${th}|${art.version}`;
    let b = old.get(key);
    if (b) { old.delete(key); return b; }
    b = document.createElement('button');
    b.className = 'rtile'; b.dataset.key = key; b.dataset.k = k;
    if (G.deal && animOn()) { b.classList.add('deal'); b.style.setProperty('--i', String(dealt++)); b.addEventListener('animationend', () => b.classList.remove('deal')); }
    b.setAttribute('aria-label', l === '?' ? 'Blank tile' : `${l}, ${E.tileValue(l)} points`);
    if (dim) { b.tabIndex = -1; b.disabled = !wait; }
    const c = document.createElement('canvas'); c.width = c.height = px;
    c.getContext('2d').drawImage(R.tileSprite(l === '?' ? '' : l, l === '?', px, 'rack', th), 0, 0);
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
  renderRackCue(show);
}
function renderRackCue(show) {
  const bar = $('#rackbar');
  if (!bar) return;
  let cue = $('#rack-cue');
  const active = !!show && !!G.settings.townCue && !!G.s && !G.s.over && !G.s.challenge && townWordsInRack(cur().rack, G.lex).length > 0;
  if (!active) {
    if (cue) { cue.hidden = true; cue.setAttribute('aria-hidden', 'true'); }
    return;
  }
  if (!cue) {
    cue = document.createElement('span');
    cue.id = 'rack-cue';
    cue.className = 'rack-cue';
    cue.setAttribute('role', 'note');
    bar.append(cue);
  }
  cue.innerHTML = `${UI.ICON.steam}<span>Hot Springs word in rack</span>`;
  cue.title = 'Your tiles can spell a Hot Springs bonus word';
  cue.setAttribute('aria-label', 'Your tiles can spell a Hot Springs bonus word');
  cue.removeAttribute('aria-hidden');
  cue.hidden = false;
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
      const onRow = G.staged.some((t) => SQUARES[t.i] === 'B'), rowPlain = onRow && !p.words.some((w) => w.bath);   // a plain word over the Row: say what a Hot Springs word would earn there
      const rowCanReveal = onRow && G.s.featured.some((f) => f.by == null && f.shown.length < E.featuredRevealCap(G.s, f));
      const cats = new Set(p.words.map((w) => w.themed && G.lex.byId.get(w.themed).cat)), won = p.featuredAll || [];
      const catReveal = rowCanReveal ? null : G.s.featured.find((f) => f.by == null && cats.has(f.cat) && !won.includes(f.word) && f.shown.length < E.featuredRevealCap(G.s, f));   // a Hot Springs word of a plaque's own kind
      html = `<span class="pv"><span class="words">${p.words.map((w) => `<b class="${w.themed ? 'themed' : ''}">${w.themed ? UI.ICON.steam : ''}${w.w}</b>`).join(' ')}</span><span class="pts">${p.score}<small> pts</small></span>${p.themed ? `<span class="extra">${UI.ICON.steam} +${p.themed}</span>` : ''}${p.full ? `<span class="extra">Full Soak +${FULL_SOAK}</span>` : ''}${p.featured ? `<span class="extra">Featured +${p.featuredBonus || FEATURED_BONUS}</span>` : ''}${rowCanReveal || rowPlain ? (rowCanReveal ? ['Row · clears 1 plaque letter', ...(rowPlain && !isNarrow() ? [`+${ROW_BONUS} with a Hot Springs word`] : [])] : [`Row · +${ROW_BONUS} with a Hot Springs word`]).map((x) => `<span class="extra row-reveal">${x}</span>`).join('') : catReveal ? `<span class="extra row-reveal">${UI.CAT_SHORT[catReveal.cat]} · clears 1 plaque letter</span>` : ''}${G.s.challenge ? '<span class="extra">words checked when you play</span>' : ''}${hintLive() ? `<span class="extra">keeps ${G.hintAlts[G.hintIx].keep.length ? G.hintAlts[G.hintIx].keep.map((l) => (l === '?' ? 'blank' : l)).join('') : 'nothing'}</span>` : ''}</span>`;
      if (hintLive()) html += `<button type="button" class="bdbtn" data-hintnext aria-label="Show another Spring Guide play, ${G.hintIx + 1} of ${G.hintAlts.length} shown">Other plays ${G.hintIx + 1}/${G.hintAlts.length}</button>`;
      html += `<button type="button" class="bdbtn" aria-expanded="${G.breakdown}">${G.breakdown ? 'Hide' : 'How it scores'}</button>`;
      if (G.breakdown) html += UI.breakdownHtml(p, G.s.board, G.staged, rowCanReveal);
      cls = hintLive() ? 'ok hintlive' : 'ok';
    } else { html = esc(p.error); cls = 'bad'; }
    if (G.hoverInfo) html += `<span class="said sq-tip">${G.hoverBath ? `<span class="sq sq-B preview-bath" aria-hidden="true">${UI.bathMedallionHtml(G.hoverBath, false)}</span>` : ''}<span>${esc(G.hoverInfo)}</span></span>`;
  } else if (G.hoverInfo) html = G.hoverBath ? `<span class="sq sq-B preview-bath" aria-hidden="true">${UI.bathMedallionHtml(G.hoverBath, false)}</span><span>${esc(G.hoverInfo)}</span>` : esc(G.hoverInfo);
  else {
    const said = G.lastLine || (cur().kind !== 'human' ? '' : G.s.move === 0 ? (isNarrow() ? 'Start on the centre square.' : 'Start on the Display Spring in the centre.') : (isNarrow() ? 'Drag tiles to the board.' : 'Drag tiles to the board to make a word.'));
    const hello = G.lastLine ? null : greeting(G.s), b = G.lastLine ? G.bark : hello;   // the table greets a person's opening play
    cls = hello ? 'idle greet' : 'idle';
    if (UI.dailyOpening(G.s)) { html = UI.todaysSprings(G.s, G.lex, isNarrow(), G.s.daily.date === today()).html; cls = 'idle greet'; }
    else html = b ? `<span class="bark"><b>${esc(SHORT[b.persona] || '')}:</b> “${esc(b.text)}”</span><span class="said">${esc(said)}</span>` : esc(said);
  }
  const stall = !G.s.over && !G.aiBusy && !G.hintBusy && !G.flash && !G.preview && !G.hoverInfo && cur().kind === 'human' ? UI.stallNote(G.s) : '';
  if (stall) { cls = ''; html += `<span class="said stall">${esc(stall)}</span>`; }
  const refocus = el.contains(document.activeElement)
    ? (document.activeElement.hasAttribute('data-hintnext') ? '[data-hintnext]' : '.bdbtn:not([data-hintnext])')
    : null;
  el.className = cls + (G.errFlash ? ' err-flash' : ''); el.innerHTML = html;
  if (refocus) el.querySelector(refocus)?.focus({ preventScroll: true });
}

function syncInert() {
  const modalOpen = !$('#modal').hidden;
  const privOpen = !$('#privacy').hidden;
  $('#app').inert = modalOpen || privOpen;
  $('#screen').inert = modalOpen || privOpen;
  $('#privacy').inert = modalOpen;
}
function focusablesIn(el) {
  if (!el || el.hidden) return [];
  return [...el.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter((n) => n.getClientRects().length > 0 && !n.closest('[hidden]'));
}
function trapTab(e, container) {
  const list = focusablesIn(container);
  e.preventDefault();
  if (!list.length) return;
  const ix = list.indexOf(document.activeElement);
  const next = e.shiftKey ? (ix <= 0 ? list.length - 1 : ix - 1) : (ix < 0 || ix >= list.length - 1 ? 0 : ix + 1);
  list[next].focus({ preventScroll: true });
}
function renderPrivacy() {
  const el = $('#privacy');
  const wasHidden = el.hidden;
  el.hidden = !G.privacy;
  if (!G.privacy) { el.innerHTML = ''; syncInert(); return; }
  el.innerHTML = UI.privacyHtml(cur(), G.s.cur);
  syncInert();
  el.querySelector('[data-reveal]').addEventListener('click', () => {
    unlock(); G.revealed = G.s.cur; G.privacy = false; restoreHint(G.s); updatePreview(); sfx('turn'); G.deal = animOn(); renderGame();
    const b = $('#board'); if (b) b.focus({ preventScroll: true });
  });
  if ((wasHidden || !el.contains(document.activeElement)) && !G.dialog) el.querySelector('[data-reveal]')?.focus({ preventScroll: true });
}

let flashTimer = 0, errFlashTimer = 0, scoreHiTimer = 0, hoverTapTimer = 0;
function flash(text, ms = 2600) { G.flash = text; clearTimeout(flashTimer); renderPreview(); liveSay(text); flashTimer = setTimeout(() => { G.flash = null; renderPreview(); }, ms); }
function shake() {
  const el = $('#preview');
  if (!el) return;
  el.classList.remove('shake', 'err-flash');
  void el.offsetWidth;
  if (animOn()) { el.classList.add('shake'); return; }
  if (G.fast || !reduced()) return;
  G.errFlash = true;
  el.classList.add('err-flash');
  clearTimeout(errFlashTimer);
  errFlashTimer = setTimeout(() => { G.errFlash = false; $('#preview')?.classList.remove('err-flash'); }, 450);
}

const SCORE_ROLL_MS = 280, SCORE_BUMP_MS = 500;
// Scores counting up, by player. The turn's hand-over redraws the cards 150 ms after a person's play, in the middle of the
// count: the roll is kept here, not on the nodes, and picked up where it was (resumeRolls).
const rollVal = (r, now) => { const u = Math.min(1, Math.max(0, (now - r.t0) / SCORE_ROLL_MS)); return u >= 1 ? r.to : Math.round(r.from + (r.to - r.from) * (1 - Math.pow(1 - u, 3))); };
const scoreEls = (p) => document.querySelectorAll(`[data-score="${p}"]`);
function cancelScoreRoll() {
  if (G.scoreRollRaf) { cancelAnimationFrame(G.scoreRollRaf); G.scoreRollRaf = 0; }
  for (const [p, r] of scoreRolls) for (const el of scoreEls(p)) el.textContent = String(r.to);
  scoreRolls.clear();
}
const scoreRolls = new Map();
function stepRolls(now) {
  G.scoreRollRaf = 0;
  let more = false;
  for (const [p, r] of scoreRolls) {
    const v = String(rollVal(r, now));
    for (const el of scoreEls(p)) if (el.textContent !== v) el.textContent = v;
    if (now < r.t0 + SCORE_BUMP_MS) more = true; else scoreRolls.delete(p);
  }
  if (more) G.scoreRollRaf = requestAnimationFrame(stepRolls);
}
function bumpScore(el, ms = 0) {
  el.classList.add('bump');
  el.style.animationDelay = ms ? `-${Math.round(ms)}ms` : '';
  el.addEventListener('animationend', () => { el.classList.remove('bump'); el.style.animationDelay = ''; }, { once: true });
}
function resumeRolls() {
  if (!scoreRolls.size) return;
  const now = performance.now();
  for (const [p, r] of scoreRolls) {
    const pl = G.s && G.s.players[p];
    if (!pl || pl.score !== r.to || now >= r.t0 + SCORE_BUMP_MS) { scoreRolls.delete(p); continue; }
    for (const el of scoreEls(p)) { el.textContent = String(rollVal(r, now)); bumpScore(el, now - r.t0); }
  }
}
function rollScores(entry, prevScore) {
  if (G.fast || !entry || entry.kind !== 'play' || !entry.score || !G.s.players[entry.p]) return;
  const els = scoreEls(entry.p);
  if (!els.length) return;
  if (animOn()) {
    const to = G.s.players[entry.p].score, t0 = performance.now();
    for (const el of els) { el.classList.remove('bump'); void el.offsetWidth; bumpScore(el); }
    if (to === prevScore) return;
    scoreRolls.set(entry.p, { from: prevScore, to, t0 });
    for (const el of els) el.textContent = String(prevScore);
    if (!G.scoreRollRaf) G.scoreRollRaf = requestAnimationFrame(stepRolls);
    return;
  }
  if (!reduced()) return;
  G.scoreHi = entry.p;
  els.forEach((el) => el.classList.add('score-updated'));
  clearTimeout(scoreHiTimer);
  scoreHiTimer = setTimeout(() => {
    G.scoreHi = null;
    document.querySelectorAll('.score-updated').forEach((el) => el.classList.remove('score-updated'));
  }, 650);
}
const POP_MS = 1300, POP_THEMED_MS = 1600, POP_STATIC_MS = 950;   // how long a score pop lives; a Hot Springs word's stays 0.3 s longer; reduced motion uses a 0 px fade
// A bigger play has a bigger and longer pop: the plain size up to POP_FROM points, growing to POP_SCALE times that size and
// POP_LONGER (30%) more time at POP_TOP points. A play worth SCORE_BIG or more that is not a Hot Springs word also throws brass sparks.
const POP_SWELL = 1.12, POP_LIFT = 0.6, POP_RISE = 120;
const POP_FROM = 14, POP_TOP = 60, POP_SCALE = 1.6, POP_LONGER = 0.3, POP_REM = 1.6;
const popWeight = (score) => Math.min(1, Math.max(0, (score - POP_FROM) / (POP_TOP - POP_FROM)));
function scorePop(e, themed) {
  if (G.fast || !e.tiles.length) return;
  const red = reduced(), box = $('#boardwrap');
  // Clear any prior live .pop so rapid consecutive plays never collide into '+2214' (W4-S3-02).
  box.querySelectorAll('.pop').forEach((n) => n.remove());
  const i = e.tiles[e.tiles.length - 1].i;
  const [x, y] = R.cellCenter(i, R.TILE_LIFT);
  const y0 = y - (red ? 0 : pxPerCell() * 0.35);
  const w = red ? 0 : popWeight(e.score), ms = red ? POP_STATIC_MS : Math.round((themed ? POP_THEMED_MS : POP_MS) * (1 + POP_LONGER * w));
  const el = document.createElement('div');
  el.className = red ? 'pop static' : (themed ? 'pop themed' : 'pop'); el.textContent = `+${e.score}`;
  el.style.left = x + 'px'; el.style.top = y0 + 'px';
  if (!red) el.style.fontSize = (POP_REM * (1 + (POP_SCALE - 1) * w)).toFixed(2) + 'rem';
  el.style.animationDuration = ms + 'ms';
  box.append(el);
  const swell = red ? 1 : POP_SWELL, lift = red ? 0.5 : POP_LIFT;
  const pw = Math.ceil(el.offsetWidth * swell / 2) + 2, ph = el.offsetHeight;
  const top = Math.ceil(ph * (lift + (swell - 1) / 2)) + 2, bot = Math.ceil(ph * (1 - lift + (swell - 1) / 2)) + 2;
  const px = Math.min(Math.max(x, pw), Math.max(pw, box.clientWidth - pw));
  const py = Math.min(Math.max(y0, top), Math.max(top, box.clientHeight - bot));
  el.style.left = px + 'px'; el.style.top = py + 'px';
  el.style.setProperty('--rise', red ? '0%' : Math.max(0, Math.floor(Math.min(POP_RISE, (py - top) / ph * 100))) + '%');
  setTimeout(() => el.remove(), ms + 100);
}

// Toasts: one at a time, newest on top of the queue; every toast is click/tap-dismissible (fact toasts open the card or dismiss via ×).
function toast(t) {
  G.toastQ.push(t);
  if (G.toastQ.length > 4) G.toastQ.shift();
  showToast();
}
let toastTimer = 0, toastNextTimer = 0;
function syncToastStaging() {
  const el = $('#toast'), app = $('#app');
  if (!el || !app) return;
  const on = el.classList.contains('on');
  const chip = on && (G.staged.length > 0 || (!!(G.toastNow && G.toastNow.keep) && (!!(G.drag && G.drag.active) || !!G.hoverInfo)));
  el.classList.toggle('keep-chip', chip);
  app.classList.toggle('toasting', on && !chip);
}
function showToast() {
  const el = $('#toast');
  if (el.dataset.busy === '1') return;
  clearTimeout(toastNextTimer); toastNextTimer = 0;
  if (!G.toastQ.length) { G.toastNow = null; el.className = ''; el.innerHTML = ''; el.setAttribute('aria-hidden', 'true'); $('#app')?.classList.remove('toasting'); return; }
  const t = G.toastNow = G.toastQ.shift();
  el.dataset.busy = '1';
  el.className = `on ${t.kind}`;
  el.setAttribute('aria-hidden', 'false');
  const icon = t.who ? UI.badge(t.who.p, t.who.k, 34) : t.kind === 'soak' ? UI.ICON.play : UI.ICON.steam;
  if (t.fact) {
    el.innerHTML = `<button type="button" class="toast-main" data-fact="${t.fact}" data-form="${t.form || ''}"><span class="ti">${icon}</span><span class="tt"><b>${esc(t.title)}</b><small>${esc(t.sub || '')}</small></span><em>Read the card ›</em></button><button type="button" class="toast-x" data-toast-dismiss aria-label="Dismiss notice">${UI.ICON.close}</button>`;
  } else {
    el.innerHTML = `<button type="button" class="toast-main" data-toast-dismiss aria-label="Dismiss: ${esc(t.title)}${t.sub ? '. ' + esc(t.sub) : ''}"><span class="ti">${icon}</span><span class="tt"><b>${esc(t.title)}</b><small>${esc(t.sub || '')}</small></span><span class="tx" aria-hidden="true">${UI.ICON.close}</span></button>`;
  }
  const b = el.querySelector('[data-fact]');
  if (b) b.addEventListener('click', () => { openFact(b.dataset.fact, b.dataset.form); hideToast(); });
  const x = el.querySelector('[data-toast-dismiss]');
  if (x) x.addEventListener('click', () => hideToast());
  syncToastStaging();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, t.kind === 'themed' ? 5200 : 3200);
}
// the player has gone back to planning: a banner still over the preview strip would hide the score and the errors, so it goes (the ledger keeps the word)
// A toast marked `keep` (a finished Register category) survives it, but lifts into a slim non-blocking chip above #preview while staging/dragging/inspecting.
function clearToasts() {
  G.toastQ = G.toastQ.filter((t) => t.keep);
  if ($('#toast').classList.contains('on') && !(G.toastNow && G.toastNow.keep)) { hideToastNow(); showToast(); }
  syncToastStaging();
}
function blurToastFocus(el) {
  if (!el.contains(document.activeElement)) return;
  if (!G.dialog && G.scene === 'game') { const b = $('#board'); if (b) { b.focus({ preventScroll: true }); return; } }
  document.activeElement.blur();
}
function hideToastNow() { const el = $('#toast'); clearTimeout(toastTimer); clearTimeout(toastNextTimer); toastNextTimer = 0; blurToastFocus(el); G.toastNow = null; el.dataset.busy = '0'; el.className = ''; el.innerHTML = ''; el.setAttribute('aria-hidden', 'true'); $('#app').classList.remove('toasting'); }
function hideToast() { const el = $('#toast'); clearTimeout(toastTimer); clearTimeout(toastNextTimer); blurToastFocus(el); G.toastNow = null; el.dataset.busy = '0'; el.className = ''; el.innerHTML = ''; el.setAttribute('aria-hidden', 'true'); $('#app').classList.remove('toasting'); toastNextTimer = setTimeout(showToast, 200); }

// The strip under the board (or Shift+B) opens how the staged play adds up; the words are read out for a screen reader.
function toggleBreakdown() {
  if (!G.preview || !G.preview.ok || !G.staged.length || G.aiBusy || G.flash) return;
  G.breakdown = !G.breakdown; renderPreview();
  if (G.breakdown) { const bd = $('#preview .bd'); if (bd && animOn()) bd.classList.add('unfold'); if (bd) liveSay(bd.textContent.replace(/\s+/g, ' ').trim()); }
}

function closeBreakdown() {
  if (!G.breakdown) return false;
  G.breakdown = false; renderPreview();
  return true;
}

// ---------- first-run tips ----------
// A newcomer's first game gets a concise, trigger-gated 4-beat sequence that never auto-expires unseen:
// (1) Turn 1 center Display Spring + Play, (2) Turn 2 multiplier discs, (3) Turn 3 Hot Springs words & Bathhouse Row,
// (4) Turn 4 Featured Springs plaques. Each advances on completing the turn or tapping Got it; Skip tips ends them all.
// After Turn 1, beat 3 comes early, the discs waiting a turn, when the player first lays a Hot Springs word or a word on or beside an open Row
// square (W1-S4-07).
const COACH_BEATS = ['start', 'discs', 'town', 'plaques'];
const coachBeat = (c) => (c.town && c.left.includes('town') ? 'town' : c.left[0]);
const nearRow = (i) => [0, i % 15 ? -1 : 0, i % 15 < 14 ? 1 : 0, -15, 15].some((d) => SQUARES[i + d] === 'B' && !G.s.board[i + d]);
function coachTown(words, tiles) {   // what there is to say about the town in this play, if anything
  const w = words.find((x) => x.themed);
  return w ? { w: w.w, move: G.s.move } : tiles.some((t) => SQUARES[t.i] === 'B' || nearRow(t.i)) ? { row: true } : null;
}
const townWord = (c) => (c.town && c.town.move === G.s.move ? c.town.w : '');   // named only on the turn it was laid: the rest is the next player's business too
let liveTimer = 0;
const liveSay = (t) => { const live = $('#live'); clearTimeout(liveTimer); live.textContent = ''; liveTimer = setTimeout(() => { live.textContent = t; }, 30); };
function coachTip() {
  const c = G.coach;
  if (!c || G.scene !== 'game' || !G.s || G.s.over || cur().kind !== 'human' || G.privacy || G.dialog) return null;
  const input = G.input || (matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse');
  const beat = coachBeat(c);
  if (beat === 'start') {
    if (G.staged.length) return { id: 'play', target: '#actions .play', text: ({ touch: 'Happy with it? Tap Play.', mouse: 'Happy with it? Click Play.', key: 'Happy with it? Press Enter.' })[input] };
    return { id: 'start', target: '#boardwrap', text: input === 'key' ? 'Score the most. Type letters to spell across the centre.' : 'Score the most. Drag tiles to the centre square.' };
  }
  if (beat === 'discs') return { id: 'discs', target: '#boardwrap', text: 'Cream 2L/3L discs boost a letter. Dark 2W/3W discs boost the word.' };
  if (beat === 'town' && townWord(c)) return { id: 'town', target: '#boardwrap', text: townWord(c) + ': a Hot Springs word! Bonus and card; Row +20.' };
  if (beat === 'town' && c.town && c.town.row) return { id: 'town', target: '#boardwrap', text: 'Bathhouse Row square: +20 for a Hot Springs word like SPA.' };
  if (beat === 'town') return { id: 'town', target: '#boardwrap', text: 'Hot Springs words (SPA, STEAM, TUB) pay bonuses & cards; Row +20.' };
  if (beat === 'plaques') return { id: 'plaques', target: '#springs', text: `Plaques hide secret words. Form one for +${FEATURED_BONUS}.` };
  return null;
}
function coachRender() {
  if (!G.settings.tipsSeen && G.s && (!G.coach || G.coach.s !== G.s)) {
    const plays = G.s.log.filter((e) => e.kind === 'play' && G.s.players[e.p].kind === 'human');
    let k = Math.min(plays.length, COACH_BEATS.length - 1);
    if (k === 2 && coachTown(plays[1].words, plays[1].tiles)) k = 1;   // resumed: the town may have come first, so the discs are not missed
    G.coach = { s: G.s, left: COACH_BEATS.slice(k), town: null, seen: false, gone: new Set(), shown: null };
  }
  if (G.coach && G.coach.left[0] !== 'start' && G.staged.length && G.preview && G.preview.ok) G.coach.town = coachTown(G.preview.words, G.staged) || G.coach.town;
  const tip = coachTip(), el = $('#coach');
  document.querySelectorAll('.coach-target').forEach((x) => x.classList.remove('coach-target'));
  if (!tip || G.coach.gone.has(tip.id)) {
    el.innerHTML = ''; $('#app').classList.remove('coaching');
    if (!tip && G.coach) G.coach.shown = null;
    return;
  }
  $('#app').classList.add('coaching');
  const target = $(tip.target); if (target) target.classList.add('coach-target');
  if (G.coach.shown !== tip.id) {
    G.coach.shown = tip.id;
    const h = tip.id === 'town' && G.staged.length && el.firstElementChild ? el.firstElementChild.getBoundingClientRect().height : 0;   // an early town tip keeps the room the discs had: no board or rack moves under the hand
    el.innerHTML = `<div class="coach-card" role="note"><span class="coach-ic" aria-hidden="true">${UI.ICON.hint}</span><p>${esc(tip.text)}</p><div class="coach-btns"><button class="btn quiet" data-coach="got">Got it</button><button class="btn quiet" data-coach="skip">Skip tips</button></div></div>`;
    if (h) el.firstElementChild.style.minHeight = `${h}px`;
    el.querySelector('[data-coach="got"]').addEventListener('click', () => coachDismiss(tip.id));
    el.querySelector('[data-coach="skip"]').addEventListener('click', coachEnd);
    liveSay(`Tip: ${tip.text}`);
  } else {
    const p = el.querySelector('p'); if (p && p.textContent !== tip.text) p.textContent = tip.text;
  }
  if (tip.id === 'town' && (!G.staged.length || getComputedStyle(el).visibility === 'visible')) G.coach.seen = true;
}
function coachDismiss(id) {
  const c = G.coach; if (!c) return;
  if (id === 'start' || id === 'play') c.gone.add(id); else coachNext(c, id);
  if (G.coach) renderStaging();
}
function coachEnd() {
  G.coach = null; G.settings.tipsSeen = true; saveSettings();
  $('#coach').innerHTML = ''; $('#app').classList.remove('coaching');
  document.querySelectorAll('.coach-target').forEach((x) => x.classList.remove('coach-target'));
}
// each completed human turn advances the 4-beat onboarding sequence
function coachPlayed() {
  const c = G.coach; if (!c) return;
  coachNext(c, c.seen ? coachBeat(c) : c.left[0]);   // an early town beat that never had room to show (short phones, a word placed) waits for the next turn
}
function coachNext(c, done) {
  c.left = c.left.filter((b) => b !== done);
  if (!c.left.length) { coachEnd(); return; }
  c.shown = null; c.gone.clear();
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
  const prev = G.dialog;
  if (!prev) {
    const ae = document.activeElement;
    G.returnFocus = ae instanceof HTMLElement && !m.contains(ae) ? ae : null;
  }
  cancelDrag(); endReturn(); endFlip();
  clearTimeout(G.releaseAiTimer); G.releaseAiTimer = 0;
  G.boardTap = null;
  if (G.springsOpen) syncSpringsDrawer(false);
  G.dialog = name;
  let html = '';
  if (name === 'swap') html = UI.swapHtml(cur().rack, G.s);
  else if (name === 'blank') html = UI.blankHtml();
  else if (name === 'pause') html = UI.pauseHtml({ mobile: isNarrow(), tracker: trackerSeat() >= 0 });
  else if (name === 'tracker') html = UI.trackerHtml(G.s, trackerSeat());
  else if (name === 'boardtext') html = UI.boardTextHtml(G.s, G.staged);
  else if (name === 'ledger') html = UI.ledgerHtml(G.s, G.lex);
  else if (name === 'fact') html = `<div class="dialog-wrap" role="dialog" aria-modal="true" aria-label="Hot Springs word card">${UI.factHtml(arg.entry, G.lex, arg.form, '<div class="dlg-btns"><button class="btn primary" data-close>Close</button></div>')}</div>`;
  else if (name === 'review') html = UI.reviewHtml(arg ? arg.review : null);
  else if (name === 'confirm') html = `<div class="card dialog" role="dialog" aria-modal="true" aria-labelledby="cf-h"><h2 id="cf-h">${esc(arg.title)}</h2><p>${esc(arg.text)}</p><div class="dlg-btns"><button class="btn quiet" data-close>Cancel</button><button class="btn primary" data-ok>${esc(arg.ok)}</button></div></div>`;
  if (prev === 'pause' && name !== 'pause') releaseAudio('pause');
  if (name === 'pause') holdAudio('pause');
  m.innerHTML = html; m.hidden = false; m.dataset.name = name; G.dialogAt = performance.now();
  syncInert();
  if (name !== 'blank' && !(name === 'review' && prev === 'review')) sfx('open');
  m.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => closeDialog()));
  m.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => {
    const ret = G.returnFocus;
    closeDialog(true); go(b.dataset.go);
    if (G.dialog) G.returnFocus = ret;   // it asked first (Leave without saving?): Cancel still goes back to what opened the menu
  }));
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
  if (name === 'ledger') {
    m.querySelectorAll('[data-fact]').forEach((b) => b.addEventListener('click', () => openFact(b.dataset.fact, b.dataset.form)));
  }
  if (name === 'blank') m.querySelectorAll('[data-letter]').forEach((b) => b.addEventListener('click', () => { const f = G.blankCb; closeDialog(); if (f) f(b.dataset.letter); }));
  if (name === 'confirm') m.querySelector('[data-ok]').addEventListener('click', () => { closeDialog(); arg.onOk(); });
  const f = m.querySelector('.primary, [data-letter], button'); if (f) f.focus({ preventScroll: true });
  if (G.scene === 'game') renderPreview();
}
function closeDialog(silent) {
  const m = $('#modal');
  if (!G.dialog && m.hidden) return;
  if (G.dialog === 'pause') releaseAudio('pause');
  G.dialog = null; G.blankCb = null; G.boardTap = null; m.hidden = true; m.innerHTML = '';
  syncInert();
  const ret = G.returnFocus; G.returnFocus = null;
  if (!silent) {
    if (G.scene === 'game' && G.privacy) $('#privacy [data-reveal]')?.focus({ preventScroll: true });
    else if (ret && ret.isConnected && !ret.disabled && ret.getClientRects().length > 0 && !ret.closest('[hidden]')) ret.focus({ preventScroll: true });
    else if (G.scene === 'game') $('#board')?.focus({ preventScroll: true });
  }
  clearTimeout(G.releaseAiTimer); G.releaseAiTimer = 0;
  // a reply held while the dialog was open lands a moment after it closes (only if still in 'game' with no dialog)
  if (G.aiHeld && !silent && G.scene === 'game' && !G.dialog && !document.hidden) {
    G.releaseAiTimer = setTimeout(() => { G.releaseAiTimer = 0; releaseAi(); }, 300);
  }
}
function askBlank(cb) { G.blankCb = cb; openDialog('blank'); }
function confirmDialog(title, text, ok, onOk) { openDialog('confirm', { title, text, ok, onOk }); }
function openFact(id, form) {
  const entry = G.lex.byId.get(id);
  if (!entry) return;
  openDialog('fact', { entry, form });
}

// What you missed: the finished game looked back over in the worker, one turn at a time.
let reviewing = 0;
async function openReview() {
  const s = G.s, seat = s && reviewSeat(s);
  if (seat == null) return;
  const mine = ++reviewing;
  openDialog('review', { review: null });
  const steps = [];
  for (const turn of reviewTurns(s, seat)) {
    steps.push(turn.skipped ? turn : await aiReview(turn));
    if (mine !== reviewing || G.dialog !== 'review' || G.s !== s) return;   // closed, or another game, meanwhile
  }
  openDialog('review', { review: summarize(steps) });
}

// ---------- layout and drawing ----------
const dpr = () => Math.min(3, window.devicePixelRatio || 1);
const isNarrow = () => matchMedia('(max-width: 860px), (max-aspect-ratio: 1/1), (max-height: 520px)').matches;
// From the width of the grid column the rack sits in, not the rackbar's own width: the rackbar is as wide as the
// tiles, so measuring it fed the size back into itself and phones crept down to the minimum.
function rackTileSize() {
  const app = $('#app'), bar = $('#rackbar'), rk = $('#rack');
  let w = 360;
  if (app && bar && app.clientWidth) {
    const cs = getComputedStyle(app), tracks = cs.gridTemplateColumns.split(' ').map(parseFloat).filter((v) => v > 0);
    const x = bar.getBoundingClientRect().left - app.getBoundingClientRect().left - parseFloat(cs.paddingLeft);
    if (tracks.length) w = tracks.length > 1 && x >= tracks[0] ? tracks[1] : tracks[0];
  }
  const bs = bar ? getComputedStyle(bar) : null, pad = bs ? parseFloat(bs.paddingLeft) + parseFloat(bs.paddingRight) : 16;
  const rs = rk ? getComputedStyle(rk) : null, gap = rs ? (parseFloat(rs.columnGap) || parseFloat(rs.gap) || 6) : 6;
  return Math.max(36, Math.min(isNarrow() ? 52 : 60, Math.floor((w - pad - 6 * gap) / 7)));
}
function layout() {
  if (G.scene !== 'game') return;
  G.layoutCount = (G.layoutCount || 0) + 1;
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
      const hooks = {
        onContextLost: () => fallback2D('context-lost', { fromContextLoss: true }),
        onContextRestored: () => {
          if (cv !== $('#gl') || G.settings.board3d === 'off' || /[?&]gl=0\b/.test(location.search)) return;
          B3.B3.tried = false; B3.B3.reason = '';
          layout();
        },
      };
      if (!B3.init(cv, dark() ? 'dark' : 'light', hooks)) { cv.hidden = true; }
    }
  } else if (!want && b.on) {
    B3.destroy(); $('#gl').hidden = true;
  }
}
function fallback2D(why, opts) { B3.destroy(opts); B3.B3.reason = why; B3.B3.tried = true; $('#gl').hidden = true; layout(); }

let raf = 0;
function draw() {
  if (raf) return;
  raf = requestAnimationFrame(frame);
}
function minimapViewport() {
  if (B3.B3.on) {
    const W = R.view.W, H = R.view.H;
    const pts = [[0, 0], [W, 0], [W, H], [0, H]].map(([sx, sy]) => B3.boardAt(sx, sy));
    if (pts.every(Boolean)) return { kind: 'poly', pts };
  }
  const wCells = R.U / R.view.zoom * (R.view.W / Math.min(R.view.W, R.view.H));
  const hCells = R.U / R.view.zoom * (R.view.H / Math.min(R.view.W, R.view.H));
  return { kind: 'rect', rect: [R.view.cx - wCells / 2, R.view.cy - hCells / 2, wCells, hCells] };
}
function landClacks(now) {
  for (const [, a] of G.anim) {
    if (a.kind === 'ai' && !a.clacked && (now - a.t0) / a.dur >= R.CONTACT_K) {
      a.clacked = true;
      const sq = a.sq;
      sfx('place', { pan: a.pan, step: a.step, ...(sq && sq !== '.' && sq !== '*' ? { sq } : {}) });
    }
  }
}
function frame(now) {
  raf = 0;
  // the time since the last frame of a running animation is a real frame interval; frames drawn for any other reason are not
  const interval = G.chainAt && now > G.chainAt && now - G.chainAt < 250 ? now - G.chainAt : 0;
  G.chainAt = 0;
  if (G.scene !== 'game' || !G.s) return;
  // W4-S1-01 / CD-WF4-04: trigger each AI tile's place clack deterministically on the exact frame k2 >= CONTACT_K (0.72).
  if (G.anim.size) landClacks(now);
  const cv = $('#board'), c2 = cv.getContext('2d');
  const d = drawData(now);
  if (B3.B3.on) {
    B3.render(d); d.flatOnly = true; d.hideTiles = true; d.mode3d = true; d.cellPx = B3.cellPx();
    if (interval) B3.noteInterval(interval);
    if (G.settings.board3d === 'auto' && B3.slowFrames()) { fallback2D('slow'); return; }
  }
  R.drawFrame(c2, d);
  if (R.view.zoom > R.MINIMAP_ZOOM) {
    const vp = minimapViewport();
    G.minimapView = vp;
    c2.setTransform(R.view.dpr, 0, 0, R.view.dpr, 0, 0);
    R.drawMinimap(c2, G.s.board, G.staged, vp);
  } else G.minimapView = null;
  if (G.anim.size && now < G.animUntil + 50) { G.chainAt = now; draw(); }
  else if (G.anim.size) G.anim.clear();
  if (G.lastPulse) { if (now < G.lastPulse.t0 + G.lastPulse.dur) { G.chainAt = now; draw(); } else G.lastPulse = null; }
  if (G.badPulse) { if (now < G.badPulse.t0 + G.badPulse.dur) { G.chainAt = now; draw(); } else G.badPulse = null; }
  if (G.settle.size) { if (now < G.settleUntil) { G.chainAt = now; draw(); } else G.settle.clear(); }
  if (G.viewAnim) stepViewAnim(now);
  edgePan(now);
}
function drawData(now) {
  const p = G.staged.length ? G.preview : null;
  const badWordCells = p && !p.ok && p.words && p.badWord ? p.words.filter((w) => w.w === p.badWord).flatMap((w) => w.cells) : [];
  const badCells = p && !p.ok ? (badWordCells.length ? [...new Set(badWordCells)] : G.staged.map((t) => t.i)) : null;
  return {
    board: G.s.board, staged: G.staged, last: G.last, lastPulse: G.lastPulse, hint: G.hint, theme: dark() ? 'dark' : 'light',
    cursor: G.cursor.on && humanCanAct() ? G.cursor : null,
    goodCells: p && p.ok && !G.s.challenge ? [...new Set(p.words.flatMap((w) => w.cells))] : null,
    badCells, badPulse: G.badPulse,
    target: G.drag && G.drag.active ? G.drag.target : null, dragFrom: G.drag && G.drag.from === 'board' && G.drag.active ? G.drag.i : null,
    dragTile: G.drag && G.drag.active ? G.drag.tile : null, blocked: G.drag && G.drag.active ? G.drag.blocked : null,
    anim: G.anim, settle: G.settle, now,
  };
}
function tick() { draw(); }

// On a phone, where the squares are small, the button in the top bar zooms in and, once zoomed, shows the whole board again (the one in the board's corner does the same, but only when zoomed).
const ZOOM_IN = 1.7, ZOOM_MAX = 2.4, ZOOM_STEP = 0.35;   // how far Zoom in goes: the squares grow from about 23 px to about 39 px on a 360 px phone
function zoomByKey(k) {
  if (k === '0') { animateView(1, R.U / 2, R.U / 2); liveSay('Whole board shown.'); return; }
  if (k === '+' || k === '=') {
    const nextZ = R.view.zoom < 1.05 ? ZOOM_IN : Math.min(ZOOM_MAX, +(R.view.zoom + ZOOM_STEP).toFixed(2));
    let cx = R.view.cx, cy = R.view.cy;
    if (R.view.zoom <= 1.01) {
      const i = G.cursor.on ? G.cursor.i : (G.staged.length ? G.staged[G.staged.length - 1].i : CENTER);
      cx = R.FRAME + (i % N) + 0.5; cy = R.FRAME + Math.floor(i / N) + 0.5;
    }
    animateView(nextZ, cx, cy);
    liveSay(`Board zoomed to ${Math.round(nextZ * 100)} percent.`);
    return;
  }
  if (k === '-') {
    const nextZ = R.view.zoom <= ZOOM_IN + 0.05 ? 1 : Math.max(1, +(R.view.zoom - ZOOM_STEP).toFixed(2));
    animateView(nextZ, nextZ <= 1.01 ? R.U / 2 : R.view.cx, nextZ <= 1.01 ? R.U / 2 : R.view.cy);
    liveSay(nextZ <= 1.01 ? 'Whole board shown.' : `Board zoomed to ${Math.round(nextZ * 100)} percent.`);
  }
}
function syncZoomBtn() {
  const out = R.view.zoom > 1.01, b = $('#b-zoomin');
  $('#b-zoom').hidden = !out || isNarrow();
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

// ---------- VFX overlay (#fx: 3-Read grammar, pre-baked stamps, swap-remove pool; not part of isIdle) ----------
const MAX_PARTICLES = 48, MAX_AMBIENT = 6, SWEEP_MS = 650, ARC_MS = 680, FLASH_PEAK_MS = 95;
const FX_SHAPES = Object.freeze({ steam: 'ribbon', score: 'star', letter: 'ring', word: 'oct', row: 'oct' });
const steam = { parts: [], sweeps: [], flashes: [], arcs: [], arcLog: [], last: 0, on: false, emit: 0, wakeTimer: 0, lastTier: 1, lastEvent: 'quiet' };
const ambientSteam = () => animOn() && G.scene === 'game' && !!G.s;
const covered = (i) => !!(G.s && G.s.board[i]) || G.staged.some((t) => t.i === i);
const BATH_CELLS = Object.keys(BATHS).map(Number);
const hasOpenWispCell = () => !!G.s && (!covered(CENTER) || BATH_CELLS.some((i) => !covered(i)));
function clearFx() {
  clearTimeout(steam.wakeTimer); steam.wakeTimer = 0;
  steam.parts.length = 0; steam.sweeps.length = 0; steam.flashes.length = 0; steam.arcs.length = 0; steam.on = false;
}
let _fxStamps = null;
function fxStamps() {
  if (_fxStamps) return _fxStamps;
  const mk = (fn) => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; fn(cv.getContext('2d'), 32); return cv; };
  const wisp = mk((g, c) => {
    g.lineCap = 'round';
    for (const [w, col, dx] of [[16, 'rgba(127,200,184,0.52)', 0], [9, 'rgba(195,238,228,0.68)', -1.5], [4, 'rgba(248,255,253,0.86)', -2]]) {
      g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(c - 10 + dx, c + 19); g.bezierCurveTo(c - 20 + dx, c + 5, c + 18 + dx, c - 4, c + 5 + dx, c - 19); g.stroke();
    }
    const core = g.createRadialGradient(c - 2, c + 2, 1, c, c, 24);
    core.addColorStop(0, 'rgba(240,253,250,0.44)'); core.addColorStop(0.55, 'rgba(127,200,184,0.28)'); core.addColorStop(1, 'rgba(127,200,184,0)');
    g.fillStyle = core; g.beginPath(); g.arc(c, c, 24, 0, Math.PI * 2); g.fill();
  });
  const star = mk((g, c) => {
    const h = g.createRadialGradient(c, c, 1, c, c, 26);
    h.addColorStop(0, 'rgba(255,248,210,0.92)'); h.addColorStop(0.35, 'rgba(255,224,110,0.48)'); h.addColorStop(1, 'rgba(217,162,58,0)');
    g.fillStyle = h; g.beginPath(); g.arc(c, c, 26, 0, Math.PI * 2); g.fill();
    for (const [o, n, col] of [[28, 5.5, '#FFE06E'], [18, 4.2, '#FFF8DC']]) {
      g.fillStyle = col; g.beginPath();
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, r = k & 1 ? n : o; k ? g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r) : g.moveTo(c + Math.cos(a) * r, c + Math.sin(a) * r); }
      g.closePath(); g.fill();
    }
  });
  const glint = mk((g, c) => {
    const gl = g.createRadialGradient(c, c, 1, c, c, 28);
    gl.addColorStop(0, 'rgba(255,248,220,1)'); gl.addColorStop(0.35, 'rgba(255,224,110,0.82)'); gl.addColorStop(0.75, 'rgba(255,214,90,0.22)'); gl.addColorStop(1, 'rgba(255,214,90,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(c, c, 28, 0, Math.PI * 2); g.fill();
  });
  return (_fxStamps = { wisp, star, glint });
}
function pushPart(p) {
  if (steam.parts.length >= MAX_PARTICLES) {
    if (p.kind === 'wisp') return;
    let ev = 0;
    for (let k = 0; k < steam.parts.length; k++) if (steam.parts[k].kind === 'wisp') { ev = k; break; }
    steam.parts[ev] = steam.parts[steam.parts.length - 1]; steam.parts.pop();
  }
  steam.parts.push(p);
}
function compactInPlace(a, keep) { let w = 0; for (let r = 0; r < a.length; r++) if (keep(a[r])) a[w++] = a[r]; a.length = w; }
function fxFlash(cells, shape = 'star', opts = {}) {
  if (!animOn() || !cells || !cells.length) return;
  const now = performance.now(), dur = opts.dur || 190, stg = opts.stagger || 0, color = opts.color || '#FFE06E';
  cells.forEach((i, k) => steam.flashes.push({ i, shape, color, t0: now + k * stg, dur }));
  startSteam();
}
function plaqueArc(fromCell, plaqueIdx, reason = 'clear') {
  if (!animOn() || fromCell == null || fromCell < 0 || plaqueIdx == null || plaqueIdx < 0) return;
  steam.arcs.push({ from: fromCell, plaque: plaqueIdx, reason, t0: performance.now() });
  steam.arcLog.push({ from: fromCell, plaque: plaqueIdx, reason });
  if (steam.arcLog.length > 12) steam.arcLog.shift();
  startSteam();
}
function emitPlaqueArcs(s, entry, prevSnap) {
  if (!s || !entry || entry.kind !== 'play' || !entry.tiles.length || !s.featured.length) return;
  const bathCells = entry.tiles.filter((t) => SQUARES[t.i] === 'B').map((t) => t.i);
  const themedWords = (entry.words || []).filter((w) => w.themed);
  const themedCats = new Set(themedWords.map((w) => G.lex.byId.get(w.themed)?.cat).filter(Boolean));
  const midCell = entry.tiles[Math.floor(entry.tiles.length / 2)].i;
  const originFor = (preferRow) => (preferRow && bathCells.length ? bathCells[0] : midCell);
  const fired = new Set();
  if (prevSnap) {
    s.featured.forEach((f, k) => {
      const p = prevSnap[k]; if (!p) return;
      if (f.by != null && p.by == null) { fired.add(k); plaqueArc(originFor(false), k, 'claim'); }
      else if (f.shown.length > p.shown) { fired.add(k); plaqueArc(originFor(bathCells.length > 0), k, bathCells.length ? 'row' : themedCats.has(f.cat) ? 'themed' : 'clear'); }
    });
  }
  if (!fired.size && bathCells.length) { const k = s.featured.findIndex((f) => f.by == null); if (k >= 0) { fired.add(k); plaqueArc(bathCells[0], k, 'row'); } }
  if (!fired.size && themedCats.size) s.featured.forEach((f, k) => { if (f.by == null && themedCats.has(f.cat) && !fired.has(k)) { fired.add(k); plaqueArc(midCell, k, 'themed'); } });
}
function plaqueTargetPoint(plaqueIdx) {
  const fx = $('#fx'); if (!fx) return [R.view.W - 14, 24];
  const fr = fx.getBoundingClientRect(), el = $(`#springs [data-plaque="${plaqueIdx}"]`) || $('#springs [data-springs-toggle]') || $('#springs');
  if (!el || !fr.width || !fr.height) return [R.view.W - 14, 24];
  const er = el.getBoundingClientRect();
  return [clamp((er.left + er.width / 2) - fr.left, 12, R.view.W - 12), clamp((er.top + er.height / 2) - fr.top, 12, R.view.H - 12)];
}
function wispAt() {
  if (!covered(CENTER)) return CENTER;
  const open = BATH_CELLS.filter((i) => !covered(i));
  return open.length ? open[Math.floor(Math.random() * open.length)] : -1;
}
const WISP_EVERY = 0.7, ROW_WISP_EVERY = 1.6;
function emitAmbientWisp() {
  let amb = 0; for (let k = 0; k < steam.parts.length; k++) if (steam.parts[k].kind === 'wisp') amb++;
  const at = wispAt(); steam.emit = at === CENTER ? WISP_EVERY : ROW_WISP_EVERY;
  if (at >= 0 && amb < MAX_AMBIENT) {
    pushPart({ kind: 'wisp', i: at, x: (Math.random() - 0.5) * 0.28, y: 0, vx: (Math.random() - 0.5) * 0.14, vy: 0.36 + Math.random() * 0.22, life: 0, max: 2.3 + Math.random() * 0.5, r: 0.28, a: at === CENTER ? 0.34 : 0.26, rot: (Math.random() - 0.5) * 0.5, vrot: (Math.random() - 0.5) * 0.35, phase: Math.random() * 6.28 });
    startSteam();
  }
}
function steamBurst(cells, opts = {}) {
  if (!animOn() || !cells.length) return;
  const loc = !!opts.localized;
  if (!loc) fxFlash(cells, FX_SHAPES.steam, { dur: 190, color: '#7FC8B8' });
  const perTile = loc ? 2 : Math.max(2, Math.min(3, Math.floor(21 / Math.max(1, cells.length))));
  for (const i of cells) {
    // off the tile's open sides, not its foot: steam rises, and from the foot it would cross the letter
    const free = (dx, dy) => { const c = i % N + dx, r = Math.floor(i / N) - dy; return c >= 0 && c < N && r >= 0 && r < N && !covered(r * N + c); };
    const open = [[0, 1], [-1, 0], [1, 0]].filter((v) => free(v[0], v[1])), sides = open.length ? open : [[0, 1]];
    for (let k = 0; k < perTile; k++) {
      const [dx, dy] = sides[k % sides.length], slip = (Math.random() - 0.5) * 0.6;
      pushPart({ kind: 'steam', i, x: dx * 0.58 + dy * slip, y: dy * 0.58 + dx * slip, vx: dx * 0.28 + (Math.random() - 0.5) * 0.14, vy: 0.45 + Math.random() * 0.42, life: 0, max: (loc ? 0.75 : 0.95) + Math.random() * 0.4, r: (loc ? 0.17 : 0.20) + Math.random() * 0.09, a: loc ? 0.17 : 0.22, rot: (Math.random() - 0.5) * 0.9, vrot: (Math.random() - 0.5) * 0.65, phase: Math.random() * 6.28 });
    }
  }
  startSteam();
}
function sparkBurst(cells, opts = {}) {
  if (!animOn() || !cells.length) return;
  const full = !!opts.full;
  fxFlash(cells, FX_SHAPES.score, { dur: 220, stagger: full ? 35 : 0, color: '#FFE06E' });
  const total = full ? Math.min(MAX_PARTICLES, cells.length * 5) : Math.min(18, Math.max(12, cells.length * 3));
  for (let n = 0; n < total; n++) {
    const idx = n % cells.length, i = cells[idx];
    const ang = ((Math.floor(n / cells.length) + Math.random() * 0.65) / Math.max(1, Math.ceil(total / cells.length))) * Math.PI * 2;
    const spd = (full ? 1.55 : 1.3) + Math.random() * 1.1, sx = Math.cos(ang) * 0.36, sy = Math.sin(ang) * 0.36;
    pushPart({ kind: 'spark', i, x: sx, y: sy, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd + 0.85, delay: full ? idx * 0.035 : 0, life: 0, max: 0.52 + Math.random() * 0.28, r: 0.18 + Math.random() * 0.09, a: 0.96, rgb: '255,214,110', rot: Math.random() * Math.PI, vrot: (Math.random() - 0.5) * 3.5 });
  }
  startSteam();
}
function goldSweep(cells) { if (!animOn() || !cells.length) return; steam.sweeps.push({ cells: [...cells].sort((a, b) => a - b), t0: performance.now() }); startSteam(); }
function startSteam() {
  clearTimeout(steam.wakeTimer); steam.wakeTimer = 0;
  if (!steam.on && (steam.parts.length || steam.sweeps.length || steam.flashes.length || steam.arcs.length || (ambientSteam() && hasOpenWispCell()))) {
    steam.on = true; steam.last = 0; steam.raf = requestAnimationFrame(steamLoop);
  }
}
// Steam thins to almost nothing over the face of a placed or staged tile and is whole just off its edge, so it curls round letters and never across them.
function offLetters(p) {
  const c0 = p.i % N + Math.round(p.x), r0 = Math.floor(p.i / N) - Math.round(p.y);
  let a = 1;
  for (let r = r0 - 1; r <= r0 + 1; r++) for (let c = c0 - 1; c <= c0 + 1; c++) {
    if (c < 0 || c >= N || r < 0 || r >= N || !covered(r * N + c)) continue;
    const off = Math.max(Math.abs(p.i % N + p.x - c), Math.abs(Math.floor(p.i / N) - p.y - r));
    a = Math.min(a, clamp((off - 0.36) / 0.2, 0.1, 1));
  }
  return a;
}
function drawOctagon(c, cx, cy, r) {
  const k = r * 0.414;
  c.beginPath(); c.moveTo(cx - k, cy - r); c.lineTo(cx + k, cy - r); c.lineTo(cx + r, cy - k); c.lineTo(cx + r, cy + k);
  c.lineTo(cx + k, cy + r); c.lineTo(cx - k, cy + r); c.lineTo(cx - r, cy + k); c.lineTo(cx - r, cy - k); c.closePath();
}
function strokeQuad(c, q) { c.beginPath(); c.moveTo(q[0][0], q[0][1]); c.lineTo(q[1][0], q[1][1]); c.lineTo(q[2][0], q[2][1]); c.lineTo(q[3][0], q[3][1]); c.closePath(); c.stroke(); }
function steamLoop(now) {
  const fx = $('#fx');
  if (!fx || G.scene !== 'game' || (document.hidden && G.fxFrozen == null)) { steam.on = false; return; }
  const c = fx.getContext('2d'), d = R.view.dpr;
  if (G.fxFrozen != null) now = G.fxFrozen;
  c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, R.view.W, R.view.H);
  const dt = G.fxFrozen != null ? 0 : Math.min(0.05, (now - (steam.last || now)) / 1000); steam.last = now;
  const cell = pxPerCell(), st = fxStamps();
  if (ambientSteam() && G.fxFrozen == null && hasOpenWispCell()) { steam.emit -= dt; if (steam.emit <= 0) emitAmbientWisp(); }
  compactInPlace(steam.flashes, (f) => now < f.t0 + f.dur);
  for (let k = 0; k < steam.flashes.length; k++) {
    const f = steam.flashes[k]; if (now < f.t0) continue;
    const u = Math.min(1, (now - f.t0) / f.dur), pf = Math.min(0.55, FLASH_PEAK_MS / f.dur);
    const env = u < pf ? (1 - Math.pow(1 - u / pf, 3)) : Math.pow(1 - (u - pf) / (1 - pf), 1.8);
    if (env <= 0.01) continue;
    const lift = G.s && G.s.board[f.i] ? R.TILE_LIFT : 0, [cx, cy] = R.cellCenter(f.i, lift), e3 = 1 - Math.pow(1 - u, 3);
    c.save(); c.globalAlpha = env * 0.92; c.strokeStyle = f.color; c.lineJoin = 'round';
    if (f.shape === 'oct') {
      const r1 = cell * (0.46 + 0.14 * e3); c.lineWidth = Math.max(1.8, cell * 0.085); drawOctagon(c, cx, cy, r1); c.stroke();
      c.globalAlpha = env * 0.55; c.lineWidth = Math.max(1.1, cell * 0.04); drawOctagon(c, cx, cy, r1 * 0.84); c.stroke();
    } else if (f.shape === 'ring') {
      c.lineWidth = Math.max(1.5, cell * 0.07); c.beginPath(); c.arc(cx, cy, cell * (0.36 + 0.22 * e3), 0, Math.PI * 2); c.stroke();
    } else if (f.shape === 'ribbon') {
      c.lineWidth = Math.max(1.5, cell * 0.07); strokeQuad(c, R.cellQuad(f.i, 0.02 - 0.04 * e3, lift));
    } else {
      c.lineWidth = Math.max(1.8, cell * 0.08); strokeQuad(c, R.cellQuad(f.i, 0.02, lift));
      const sz = cell * (0.42 + 0.34 * env); c.drawImage(st.star, cx - sz / 2, cy - sz / 2, sz, sz);
    }
    c.restore();
  }
  const sDrag = Math.exp(-3.4 * dt), vxDrag = Math.exp(-1.1 * dt), vyDrag = Math.exp(-0.7 * dt);
  for (let k = steam.parts.length - 1; k >= 0; k--) {
    const p = steam.parts[k];
    if (p.delay && p.delay > 0) { p.delay -= dt; continue; }
    if ((p.life += dt) >= p.max) { steam.parts[k] = steam.parts[steam.parts.length - 1]; steam.parts.pop(); continue; }
    const t = p.life / p.max, [cx, cy] = R.cellCenter(p.i, G.s && G.s.board[p.i] ? R.TILE_LIFT : 0);
    if (p.kind === 'spark') {
      p.vx *= sDrag; p.vy = p.vy * sDrag - 2.6 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vrot * dt;
      const sx = cx + p.x * cell, sy = cy - p.y * cell, a = (t < 0.12 ? t / 0.12 : Math.pow(1 - (t - 0.12) / 0.88, 1.5)) * p.a, sz = cell * p.r * 2.1 * Math.pow(1 - t, 0.55);
      c.save(); c.strokeStyle = `rgba(255,224,110,${(a * 0.72).toFixed(3)})`; c.lineWidth = Math.max(1.2, cell * 0.055 * (1 - t)); c.lineCap = 'round';
      c.beginPath(); c.moveTo(cx + (p.x - p.vx * 0.055) * cell, cy - (p.y - p.vy * 0.055) * cell); c.lineTo(sx, sy); c.stroke();
      c.globalAlpha = a; c.translate(sx, sy); c.rotate(p.rot); c.drawImage(st.star, -sz / 2, -sz / 2, sz, sz); c.restore();
    } else {
      p.vx *= vxDrag; p.vy *= vyDrag; p.x += (p.vx + Math.sin(p.life * 3.4 + (p.phase || 0)) * 0.14) * dt; p.y += p.vy * dt; p.rot = (p.rot || 0) + (p.vrot || 0) * dt;
      const scale = 1 + 0.45 * (1 - Math.pow(1 - t, 3));
      let a = (t < 0.14 ? t / 0.14 : Math.pow(1 - (t - 0.14) / 0.86, 1.35)) * (p.a || 0.20) * offLetters(p);
      const px = cx + p.x * cell, py = cy - p.y * cell, sz = p.r * cell * 2 * scale;
      if (p.kind === 'steam' && G.drag && G.drag.active && G.drag.bx != null) {
        const dist = Math.hypot(px - G.drag.bx, py - G.drag.by);
        if (dist < 2 * cell) a *= Math.max(0.06, (dist / (2 * cell)) * 0.65);
      }
      c.save(); c.globalAlpha = a; c.translate(px, py); c.rotate(p.rot); c.drawImage(st.wisp, -sz / 2, -sz / 2, sz, sz); c.restore();
    }
  }
  compactInPlace(steam.sweeps, (w) => now - w.t0 < SWEEP_MS);
  for (let sIx = 0; sIx < steam.sweeps.length; sIx++) {
    const w = steam.sweeps[sIx], n = w.cells.length, u = Math.min(1, Math.max(0, (now - w.t0) / SWEEP_MS));
    const eased = u < 0.78 ? (1 - Math.pow(1 - u / 0.78, 1.8)) * 0.92 : 0.92 + 0.08 * ((u - 0.78) / 0.22);
    const head = eased * (n + 0.6), tailFade = u > 0.86 ? (1 - u) / 0.14 : 1;
    for (let j = 0; j < n; j++) {
      const a = Math.max(0, 1 - Math.abs(head - j - 0.5) / 2.2) * tailFade; if (a <= 0.02) continue;
      const q = R.cellQuad(w.cells[j], 0.02, R.TILE_LIFT), qi = R.cellQuad(w.cells[j], 0.09, R.TILE_LIFT);
      const starSz = cell * (0.34 + 0.16 * a);
      c.save(); c.lineJoin = 'round';
      c.strokeStyle = `rgba(255,224,110,${(0.95 * a).toFixed(3)})`; c.lineWidth = Math.max(2.6, cell * 0.13); strokeQuad(c, q);
      c.strokeStyle = `rgba(255,244,180,${(0.68 * a).toFixed(3)})`; c.lineWidth = Math.max(1.2, cell * 0.055); strokeQuad(c, qi);
      c.globalAlpha = 0.92 * a;
      c.drawImage(st.star, q[0][0] - starSz / 2, q[0][1] - starSz / 2, starSz, starSz);
      c.drawImage(st.star, q[2][0] - starSz / 2, q[2][1] - starSz / 2, starSz, starSz);
      c.restore();
    }
  }
  compactInPlace(steam.arcs, (a) => now - a.t0 < ARC_MS);
  for (let aIx = 0; aIx < steam.arcs.length; aIx++) {
    const a = steam.arcs[aIx], u = Math.min(1, Math.max(0, (now - a.t0) / ARC_MS)), e = 1 - Math.pow(1 - u, 2.1);
    const [sx, sy] = R.cellCenter(a.from, G.s && G.s.board[a.from] ? R.TILE_LIFT : 0), [tx, ty] = plaqueTargetPoint(a.plaque);
    const mx = (sx + tx) / 2, my = Math.min(sy, ty) - Math.max(26, cell * 1.35);
    const pt = (t) => { const m = 1 - t; return [m * m * sx + 2 * m * t * mx + t * t * tx, m * m * sy + 2 * m * t * my + t * t * ty]; };
    const tailStart = Math.max(0, e - (a.reason === 'claim' ? 0.44 : 0.28)), fade = u < 0.8 ? 1 : (1 - u) / 0.2, claim = a.reason === 'claim';
    c.save(); c.lineCap = 'round';
    for (let seg = 0; seg < 8; seg++) {
      const [x0, y0] = pt(tailStart + ((e - tailStart) * seg) / 8), [x1, y1] = pt(tailStart + ((e - tailStart) * (seg + 1)) / 8), frac = (seg + 1) / 8;
      c.strokeStyle = claim
        ? (frac > 0.48 ? `rgba(255,224,110,${(0.92 * frac * fade).toFixed(3)})` : `rgba(127,211,196,${(0.76 * frac * fade).toFixed(3)})`)
        : `rgba(127,211,196,${(0.58 * frac * fade).toFixed(3)})`;
      c.lineWidth = Math.max(1.4, cell * (claim ? 0.16 : 0.10) * frac); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    }
    const [hx, hy] = pt(e), hsz = Math.max(claim ? 14 : 9, cell * (claim ? 0.72 : 0.42));
    c.globalAlpha = fade * (claim ? 1 : 0.8); c.drawImage(claim ? st.star : st.wisp, hx - hsz / 2, hy - hsz / 2, hsz, hsz); c.restore();
  }
  const active = steam.parts.length || steam.sweeps.length || steam.flashes.length || steam.arcs.length;
  if (active || G.fxFrozen != null) steam.raf = requestAnimationFrame(steamLoop);
  else {
    steam.on = false; c.clearRect(0, 0, R.view.W, R.view.H);
    if (ambientSteam() && hasOpenWispCell() && !document.hidden) {
      steam.wakeTimer = setTimeout(() => { steam.wakeTimer = 0; if (ambientSteam() && !document.hidden) emitAmbientWisp(); }, Math.max(120, Math.round(Math.max(0.15, steam.emit) * 1000)));
    }
  }
}

// ---------- pointer input ----------
function boardPoint(e) { const r = $('#board').getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
function pick(x, y) { return B3.B3.on ? B3.cellAt(x, y) : R.cellAt(x, y); }

// A pointer coming down while another drag or pinch is on: a second finger (not primary) is ignored, but a primary
// pointer means the old one ended without us hearing (a lost pointerup), so that drag is cancelled first.
function claimPointer(e) {
  if (!G.drag && !G.pinch && !G.pointers.size) return true;
  if (!e.isPrimary) return false;
  cancelDrag(); endReturn(); endFlip(); G.pinch = null; G.pointers.clear();
  return true;
}
function capture(el, id) { try { el.setPointerCapture(id); } catch (err) { /* synthetic or already gone */ } }

function rackDown(e, k) {
  if (!(humanCanAct() || waiting()) || e.button > 0) return;
  endReturn(); endFlip(); flushSettle();
  if (!claimPointer(e)) return;
  unlock();
  clearToasts(); closeBreakdown();
  e.preventDefault();
  G.drag = { from: 'rack', k, move: G.s.move, x0: e.clientX, y0: e.clientY, id: e.pointerId, touch: e.pointerType === 'touch', active: false, tile: tileOf(k) };
  // #app outlasts every re-render, so the rest of the drag reaches us even if the tile's button goes
  capture($('#app'), e.pointerId);
  sfx('pick');
}
const tileOf = (k) => { const l = (waitSeat() || cur()).rack[k]; return { l: l === '?' ? '' : l, blank: l === '?' }; };

function minimapPanTo(x, y) {
  const m = R.minimapBox();
  const u = clamp((x - m.x0) / m.S, 0, 1);
  const v = clamp((y - m.y0) / m.S, 0, 1);
  G.viewAnim = null;
  R.view.cx = R.FRAME + u * N;
  R.view.cy = R.FRAME + v * N;
  R.clampView();
  draw();
}
function boardDown(e) {
  if (G.scene !== 'game') return;
  endReturn(); flushSettle();
  if (e.isPrimary) claimPointer(e);
  else if (G.pinch || (G.drag && G.drag.from !== 'pan')) return;   // a tile is in hand, or a pinch is on: ignore more fingers
  unlock();
  const [x, y] = boardPoint(e);
  if (G.pointers.size === 0 && R.minimapHit(x, y)) {
    G.drag = { from: 'minimap', move: G.s && G.s.move, x0: e.clientX, y0: e.clientY, id: e.pointerId, touch: e.pointerType === 'touch', active: true };
    capture($('#board'), e.pointerId);
    minimapPanTo(x, y);
    return;
  }
  G.pointers.set(e.pointerId, { x, y });
  if (G.pointers.size === 2) {
    // pinch zoom (W4-S2-04): clamp d0 >= 10 and record anchor + initial view so zoom/pan stays pinned under the fingers
    const [a, b] = [...G.pointers.values()];
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    G.viewAnim = null;
    G.pinch = {
      d0: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)),
      z0: R.view.zoom,
      cx0: R.view.cx, cy0: R.view.cy,
      mx0: mx, my0: my,
      s0: pxPerCell(),
      mid: (B3.B3.on && B3.boardAt(mx, my)) || R.toBoard(mx, my),
    };
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
  if (k === 'B') return `${BATHS[i]} Bathhouse, on Bathhouse Row: clears 1 Featured Spring letter; a Hot Springs word adds +${ROW_BONUS}`;
  return SQUARE_INFO[k] || null;
}
const SQUARE_INFO = { w: 'Warm spring: doubles the letter on it', h: 'Hot spring: triples the letter on it', s: 'Steam: doubles the whole word', b: 'Boiling Spring: triples the whole word', '*': 'The Display Spring: the first word covers it' };
// the square under the keyboard cursor, spoken through the live region: "H8, empty, Steam: doubles the whole word"
function sayCursor(i) {
  const empty = !G.s.board[i] && !G.staged.some((t) => t.i === i);
  liveSay(`${UI.squareName(i)}, ${UI.tileSpeech(G.s, G.staged, i)}${empty && squareInfo(i) ? `, ${squareInfo(i)}` : ''}`);
}
function themedWordAt(s, lex, i) {
  if (!s || !lex || i < 0 || !s.board[i]) return null;
  const scan = (step) => {
    const same = (a, b) => (step === 1 ? Math.floor(a / N) === Math.floor(b / N) : true);
    let start = i;
    while (start - step >= 0 && same(start - step, i) && s.board[start - step]) start -= step;
    let w = '';
    for (let k = start; k < N * N && same(k, i) && s.board[k]; k += step) w += s.board[k].l;
    if (w.length < 2) return null;
    const entry = lex.entry(w);
    return entry ? { id: entry.id, form: w, tier: entry.tier } : null;
  };
  const hits = [scan(1), scan(N)].filter(Boolean);
  if (!hits.length) return null;
  hits.sort((a, b) => b.tier - a.tier || b.form.length - a.form.length);
  return { id: hits[0].id, form: hits[0].form };
}
function hoverSquare(e) {
  if (G.drag || e.pointerType !== 'mouse' || G.scene !== 'game' || !G.s) return;
  const b = $('#board'), r = b.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  const onBoard = e.target === b && mx >= 0 && my >= 0 && mx <= r.width && my <= r.height;
  if (onBoard && R.minimapHit(mx, my)) {
    b.style.cursor = 'pointer';
    if (G.hoverInfo !== null || G.hoverBath !== null) { G.hoverInfo = null; G.hoverBath = null; renderPreview(); }
    return;
  }
  const i = onBoard ? pick(mx, my) : -1;
  let info = null, bath = null, pointer = false;
  if (i >= 0) {
    if (!G.s.board[i] && !G.staged.some((t) => t.i === i)) {
      info = squareInfo(i);
      if (SQUARES[i] === 'B') bath = BATHS[i];
    } else if (!G.staged.length && G.s.board[i] && !G.aiBusy && !G.hintBusy && !G.dialog) {
      const hit = themedWordAt(G.s, G.lex, i);
      if (hit) { info = `${hit.form}: Hot Springs word — click to read its history card`; pointer = true; }
    }
  }
  b.style.cursor = pointer ? 'pointer' : '';
  if (info !== G.hoverInfo || bath !== G.hoverBath) { G.hoverInfo = info; G.hoverBath = bath; clearTimeout(hoverTapTimer); if (info) clearToasts(); else syncToastStaging(); renderPreview(); }
}

// Dragging works like the block puzzle's: on touch the tile floats well clear of the finger at about the size of a
// board square, it lands on the square under the tile's centre (not under the finger), and that square shows a
// snapped ghost. The board never zooms by itself.
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function dragGeom(d) {
  const cell = pxPerCell();
  const size = Math.round(clamp(cell * 1.05, 22, 60));
  return { size, lift: d.touch ? Math.round(clamp(cell * 1.6, 56, 84)) : 0 };
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
  d.bx = x; d.by = y; d.px = e.clientX; d.py = e.clientY;
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
}
function placeGhost(d, x, y) {
  const gh = $('#ghost');
  const onCell = d.target != null || d.blocked != null;
  const hoverOff = onCell ? Math.round(d.size * 0.32) : 0;
  gh.classList.toggle('over-target', d.target != null);
  gh.classList.toggle('over-blocked', d.blocked != null);
  gh.style.transform = `translate(${x - d.size / 2}px, ${y - d.lift - d.size / 2 - hoverOff}px)`;
}
// W4-S1-03: Frame-1-interruptible <= 140 ms ghost flight for tap-to-place and single unstage().
function flyGhost(tile, fromBox, toBox, ms = 130, hideRackK = null) {
  endReturn();
  if (!animOn() || !fromBox || !toBox) return;
  const gh = $('#ghost');
  const sz = Math.max(22, Math.round(Math.max(fromBox.width, toBox.width)));
  gh.classList.remove('over-target', 'over-blocked');
  gh.width = gh.height = Math.round(sz * dpr());
  gh.style.width = gh.style.height = sz + 'px';
  gh.getContext('2d').drawImage(R.tileSprite(tile.l, tile.blank, gh.width, 'staged', dark() ? 'dark' : 'light'), 0, 0);
  const fx = fromBox.left + fromBox.width / 2 - sz / 2, fy = fromBox.top + fromBox.height / 2 - sz / 2;
  const tx = toBox.left + toBox.width / 2 - sz / 2, ty = toBox.top + toBox.height / 2 - sz / 2;
  gh.style.transition = 'none';
  gh.style.transform = `translate(${fx.toFixed(1)}px, ${fy.toFixed(1)}px)`;
  gh.style.scale = String((fromBox.width / sz).toFixed(3));
  gh.hidden = false;
  if (hideRackK != null) {
    G.returning = hideRackK;
    const dest = document.querySelector(`#rack .rtile[data-k="${hideRackK}"]`);
    if (dest) dest.style.visibility = 'hidden';
  }
  void gh.offsetWidth;
  gh.style.transition = `transform ${ms}ms cubic-bezier(0.22, 1, 0.36, 1), scale ${ms}ms cubic-bezier(0.22, 1, 0.36, 1)`;
  gh.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px)`;
  gh.style.scale = String((toBox.width / sz).toFixed(3));
  G.returnTimer = setTimeout(endReturn, ms + 15);
}
// a tile that missed the board flies back to its place on the rack
function returnToRack(d) {
  G.order.splice(d.from === 'rack' ? slot(d) : G.order.length, 0, d.k);
  const gh = $('#ghost');
  gh.classList.remove('over-target', 'over-blocked');
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
  clearTimeout(G.returnTimer); G.returnTimer = 0;
  const gh = $('#ghost');
  gh.classList.remove('over-target', 'over-blocked');
  gh.hidden = true;
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
  if (!d.active || d.from === 'pan' || d.from === 'minimap') return;
  if (d.from === 'board' && G.s && !G.s.board[d.i] && !G.staged.some((t) => t.i === d.i || t.k === d.k)) G.staged.push({ k: d.k, i: d.i, l: d.tile.l, blank: d.tile.blank });
  else if (!G.order.includes(d.k) && !G.staged.some((t) => t.k === d.k)) G.order.splice(slot(d), 0, d.k);
  const gh = $('#ghost');
  gh.classList.remove('over-target', 'over-blocked');
  gh.hidden = true;
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
    if (!a || !b) return;
    const p = G.pinch;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const z = clamp(p.z0 * Math.hypot(a.x - b.x, a.y - b.y) / p.d0, 1, ZOOM_MAX);
    const ratio = p.z0 / z;
    const s = B3.B3.on ? p.s0 * (z / p.z0) : R.fit() * z;
    R.view.zoom = z;
    R.view.cx = p.mid[0] - (p.mid[0] - p.cx0) * ratio - (mx - p.mx0) / s;
    R.view.cy = p.mid[1] - (p.mid[1] - p.cy0) * ratio - (my - p.my0) / s;
    R.clampView(); syncZoomBtn(); draw();
    return;
  }
  if (!d || e.pointerId !== d.id) return;
  // a mouse moving with no button held: the button came up where we could not see it (outside the window)
  if (e.pointerType === 'mouse' && !e.buttons) { const pan = (d.from === 'pan' || d.from === 'minimap') && d.active; cancelDrag(); if (pan) layout(); draw(); return; }
  if (d.from === 'minimap') {
    const [x, y] = boardPoint(e);
    minimapPanTo(x, y);
    return;
  }
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
    clearToasts(); G.breakdown = false;
    if (G.springsOpen) syncSpringsDrawer(false);
    if (d.from === 'board') G.staged = G.staged.filter((t) => t.i !== d.i);
    else { d.pos0 = G.order.indexOf(d.k); G.order = G.order.filter((x) => x !== d.k); }
    endReturn();
    Object.assign(d, dragGeom(d), { hover: -1, target: null, blocked: null });
    const gh = $('#ghost');
    gh.classList.remove('over-target', 'over-blocked');
    gh.width = gh.height = Math.round(d.size * dpr());
    gh.style.width = gh.style.height = d.size + 'px';
    gh.getContext('2d').drawImage(R.tileSprite(d.tile.l, d.tile.blank, gh.width, 'staged', dark() ? 'dark' : 'light'), 0, 0);
    // it grows from the size it was picked up at (a rack tile or a board square) to its drag size
    const from = d.from === 'rack' ? rackTileSize() : pxPerCell();
    gh.style.transition = 'none'; gh.style.scale = String(from / d.size);
    updateDragTarget(d, e);
    placeGhost(d, e.clientX, e.clientY);
    gh.hidden = false;
    void gh.offsetWidth;
    gh.style.transition = animOn() ? 'scale 0.12s ease-out, opacity 0.08s ease-out' : 'none'; gh.style.scale = '1';
    updatePreview(); renderStaging();
  }
  if (!d.active) return;
  updateDragTarget(d, e);
  placeGhost(d, e.clientX, e.clientY);
  draw();
}
// A tile held near the edge of a zoomed board glides the view on, whether or not the pointer moves: run by every frame, at a
// steady speed on screen whatever the frame rate. It starts after a moment, so a tile carried across the edge does not move the board.
const EDGE_PX = 36, EDGE_SPEED = 360, EDGE_WAIT = 150;   // px from the edge, px a second, ms
function edgePan(now) {
  const d = G.drag, v = R.view;
  if (!d || !d.active || (d.from !== 'rack' && d.from !== 'board')) return;
  if (d.gliding) {   // the camera moved under the tile since it was last looked at: find its square again, as the board is drawn now
    d.gliding = false;
    updateDragTarget(d, { clientX: d.px, clientY: d.py });
    placeGhost(d, d.px, d.py);
    draw();
  }
  const on = d.hover >= 0 && v.zoom > 1.01 && !G.viewAnim;
  // over the last row or column there is no more board that way, and gliding on would carry the tile's square out from under it
  const col = d.hover % N, row = Math.floor(d.hover / N);
  const ux = !on ? 0 : d.bx < EDGE_PX && col > 0 ? -1 : d.bx > v.W - EDGE_PX && col < N - 1 ? 1 : 0;
  const uy = !on ? 0 : d.by < EDGE_PX && row > 0 ? -1 : d.by > v.H - EDGE_PX && row < N - 1 ? 1 : 0;
  if (!ux && !uy) { d.edgeAt = 0; return; }
  if (!d.edgeAt) d.edgeAt = d.edgeT = now;
  const dt = Math.min(50, Math.max(0, now - d.edgeT)), cx = v.cx, cy = v.cy;
  d.edgeT = now;
  if (now - d.edgeAt >= EDGE_WAIT) {
    const step = EDGE_SPEED * dt / 1000 / pxPerCell();
    v.cx += ux * step; v.cy += uy * step; R.clampView();
    if (dt && v.cx === cx && v.cy === cy) return;   // the board's own edge: nothing more to show
    d.gliding = true;
  }
  G.chainAt = now; draw();
}

function onUp(e) {
  if (G.pointers.has(e.pointerId)) G.pointers.delete(e.pointerId);
  if (G.pinch) { if (G.pointers.size < 2) { G.pinch = null; G.drag = null; layout(); } return; }
  const d = G.drag;
  if (!d || e.pointerId !== d.id) return;
  G.drag = null;
  if (d.from === 'minimap') { layout(); return; }
  if (d.active && d.from !== 'pan') {
    // drop on exactly the square the ghost showed
    if (d.target != null) {
      // a blank waits on the rack while its letter is chosen, so Cancel leaves it there
      const wait = d.from === 'rack' && d.tile.blank;
      if (wait) G.order.splice(slot(d), 0, d.k);
      if (stage(d.k, d.target, d.tile.blank ? d.tile.l || null : null)) { const gh = $('#ghost'); gh.classList.remove('over-target', 'over-blocked'); gh.hidden = true; if (wait) renderStaging(); draw(); return; }
      if (wait) G.order = G.order.filter((x) => x !== d.k);
    }
    // back to the rack, at the drop position when dropped on the rack
    const pos = rackPosAt(e.clientX, e.clientY);
    if (d.from === 'board' || d.blocked != null) sfx(d.blocked != null ? 'error' : 'recall');
    if (pos != null) { const gh = $('#ghost'); gh.classList.remove('over-target', 'over-blocked'); gh.hidden = true; G.order.splice(pos, 0, d.k); if (d.from === 'rack') sfx('pick'); updatePreview(); renderStaging(); }   // a tile set down in a new place on the rack
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
  if (G.selected != null && humanCanAct() && i >= 0) {
    const selK = G.selected, fromEl = document.querySelector(`#rack .rtile[data-k="${selK}"]`);
    const fromBox = animOn() && fromEl ? fromEl.getBoundingClientRect() : null;
    const rawL = cur().rack[selK];
    if (stage(selK, i) && fromBox && rawL !== '?') {
      const toBox = cellScreenBox(i, R.STAGED_LIFT);
      if (toBox) flyGhost({ l: rawL, blank: false }, fromBox, toBox, 120, null);
    }
    return;
  }
  // W2-S4-13: tapping an already-placed Hot Springs word on the board (when no rack tile is selected or staged) opens its history card.
  if (i >= 0 && G.s && G.s.board[i] && G.selected == null && !G.staged.length && !G.aiBusy && !G.hintBusy && !(G.turnWait && G.turnWait.fromAi) && !G.dialog && !G.privacy) {
    const hit = themedWordAt(G.s, G.lex, i);
    if (hit) { openFact(hit.id, hit.form); return; }
  }
  // a finger has no hover: a tap on an empty square says what it is (as a quiet sub-line beneath #preview when staging)
  if (d.touch && i >= 0 && !G.s.board[i] && !G.staged.some((t) => t.i === i) && !G.aiBusy && !G.hintBusy && !G.dialog) {
    const info = squareInfo(i);
    if (info) {
      clearToasts();
      if (G.staged.length) {
        G.hoverInfo = info; G.hoverBath = SQUARES[i] === 'B' ? BATHS[i] : null;
        renderPreview();
        clearTimeout(hoverTapTimer);
        hoverTapTimer = setTimeout(() => { if (G.hoverInfo === info) { G.hoverInfo = null; G.hoverBath = null; syncToastStaging(); renderPreview(); } }, 3600);
      } else flash(info, 3600);
    }
  }
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
    if (e.key === 'Tab') { trapTab(e, $('#modal')); return; }
    if (e.key === 'Escape') { e.preventDefault(); closeDialog(); }
    if (G.dialog === 'blank' && /^[a-z]$/i.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); const f = G.blankCb; closeDialog(); f && f(e.key.toUpperCase()); }
    return;
  }
  const field = !!e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName);
  if (G.scene !== 'game') {
    if (e.key === 'Escape' && G.scene !== 'title') {
      // in a text box or a drop-down, Escape only leaves that control (and shuts its list); the next one closes the sheet
      if (field && !/^(checkbox|radio|range)$/.test(e.target.type)) { e.target.blur(); return; }
      e.preventDefault(); back();
    }
    return;
  }
  if (G.privacy && e.key === 'Tab') { trapTab(e, $('#privacy')); return; }
  if (field) return;
  const tileBtn = e.target && e.target.closest && e.target.closest('#rack .rtile');
  if (tileBtn && e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    e.preventDefault();
    if (!(humanCanAct() || waiting())) return;
    const tileK = +tileBtn.dataset.k, pos = G.order.indexOf(tileK), next = pos + (e.key === 'ArrowLeft' ? -1 : 1);
    if (pos >= 0 && next >= 0 && next < G.order.length) {
      [G.order[pos], G.order[next]] = [G.order[next], G.order[pos]];
      sfx('pick'); renderRack();
      const moved = document.querySelector(`#rack .rtile[data-k="${tileK}"]`);
      if (moved) moved.focus();
      const l = (waitSeat() || cur()).rack[tileK];
      liveSay(`${l === '?' ? 'Blank tile' : l} moved to position ${next + 1} of ${G.order.length}.`);
    }
    return;
  }
  // in the rack and the action bar (toolbars) Left, Right, Home and End step between the buttons; Up and Down still go to the board
  const bar = e.target && e.target.closest && e.target.closest('#rack, #actions');
  if (bar && /^(ArrowLeft|ArrowRight|Home|End)$/.test(e.key) && !e.altKey && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    const bs = [...bar.querySelectorAll('button:not([disabled]):not(.lifted)')], at = bs.indexOf(e.target.closest('button')), n = bs.length;
    const to = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (at + (e.key === 'ArrowLeft' ? n - 1 : 1)) % n;
    bs[to]?.focus();
    return;
  }
  // Enter and Space on a focused button or link press it (Swap, Pass, Hint, Menu...); on the board or the page they play and turn the cursor
  if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.closest && e.target.closest('button, a')) return;
  if ((e.key === 'Enter' || e.key === ' ') && !e.repeat && !G.staged.length && skipComputerWait()) { e.preventDefault(); return; }
  if (G.privacy && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); $('#privacy [data-reveal]')?.click(); return; }
  const k = e.key;
  if (k === '?' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); go('help'); return; }
  if (!e.ctrlKey && !e.metaKey && !e.altKey && !G.privacy && (k === '+' || k === '=' || k === '-' || k === '0')) {
    e.preventDefault();
    zoomByKey(k);
    return;
  }
  if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && /^[RSPHBU]$/.test(k.toUpperCase()) && k.length === 1) {
    e.preventDefault();
    ({ R: shuffleRack, S: doSwap, P: doPass, H: doHint, B: toggleBreakdown, U: () => { if (trackerSeat() >= 0) openDialog('tracker'); } })[k.toUpperCase()]?.();
    return;
  }
  if (G.springsOpen && k === 'Escape') { e.preventDefault(); syncSpringsDrawer(false); $('#springs [data-springs-toggle]')?.focus(); return; }
  // Escape shuts a banner; with no placed tiles to look after, the same press goes on to the menu
  if (k === 'Escape' && $('#toast')?.classList.contains('on')) { e.preventDefault(); hideToast(); if (!G.staged.length) openDialog('pause'); return; }
  if (!humanCanAct()) { if (k === 'Escape') { e.preventDefault(); openDialog('pause'); } return; }
  const c = G.cursor;
  const move = (dr, dc) => { const r = Math.floor(c.i / N) + dr, col = (c.i % N) + dc; if (r >= 0 && r < N && col >= 0 && col < N) c.i = r * N + col; c.on = true; $('#board').focus({ preventScroll: true }); ensureVisible(c.i); draw(); sayCursor(c.i); };   // the focus goes with the cursor, so Enter plays instead of pressing a button left focused
  if (k === 'ArrowLeft' && !e.altKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); move(0, -1); }
  else if (k === 'ArrowRight' && !e.altKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); move(0, 1); }
  else if (k === 'ArrowUp' && !e.altKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); move(-1, 0); }
  else if (k === 'ArrowDown' && !e.altKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); move(1, 0); }
  else if (k === ' ') { e.preventDefault(); c.dir = c.dir === 1 ? N : 1; c.on = true; draw(); liveSay(`Direction: ${c.dir === 1 ? 'across' : 'down'}.`); }
  else if (k === 'Enter') {
    e.preventDefault();
    if (G.selected != null && G.order.includes(G.selected)) {
      c.on = true;
      const sel = G.selected, cell = c.i, isBlank = cur().rack[sel] === '?';
      if (stage(sel, cell)) {
        if (!isBlank) { const nx = nextCell(cell, c.dir); if (nx >= 0) c.i = nx; ensureVisible(c.i); draw(); }
      } else { flash('That square already has a tile.'); oops(); }
    } else doPlay();
  }
  else if (k === 'Escape') { e.preventDefault(); if (closeBreakdown()) return; if (G.staged.length) recallAll(); else openDialog('pause'); }
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
        flash(`No ${L} on your rack. Press ${L} again to use your blank.`, BLANK_ARM_MS); sfx('prompt'); return;
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
  $('#turnline').addEventListener('click', (e) => {
    if (!e.target.closest('[data-open-tracker]') || trackerSeat() < 0) return;
    unlock();
    openDialog('tracker');
  });
  $('#b-sound').addEventListener('click', () => { unlock(); G.settings.sound = !G.settings.sound; saveSettings(); if (G.settings.sound) sfx('place'); });
  // the strip under the board opens the breakdown of the staged play (its button is the keyboard's way in); a tap or a scroll inside the breakdown leaves it open
  $('#preview').addEventListener('click', (e) => { if (e.target.closest('.bd')) return; if (e.target.closest('[data-hintnext]')) hintNext(); else toggleBreakdown(); });
  // W2-S4-13: clickable Hot Springs word chips inside the inline Steam ledger open their sourced history card on demand.
  $('#b-ledger').addEventListener('click', () => { unlock(); openDialog('ledger'); });
  $('#log').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-fact]');
    if (!chip) return;
    unlock();
    openFact(chip.dataset.fact, chip.dataset.form);
  });
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
    if (document.hidden) { away(); pauseAudio(); clearTimeout(steam.wakeTimer); steam.wakeTimer = 0; return; }
    resumeAudio();
    releaseAi();
    if (G.scene === 'game' && G.s) startSteam();
  });
  window.addEventListener('pageshow', () => {
    if (document.hidden) return;
    resumeAudio();
    releaseAi();
    if (G.scene === 'game' && G.s) startSteam();
  });
  // iOS: no rubber-band scroll or page zoom while a tile or the board is held (they would cancel the touch)
  document.addEventListener('touchmove', (e) => { if (G.scene === 'game' && (G.drag || G.pinch)) e.preventDefault(); }, { passive: false });
  b.addEventListener('focus', () => { if (humanCanAct()) { G.cursor.on = true; draw(); } });
  b.addEventListener('blur', () => { G.cursor.on = false; draw(); });
  document.addEventListener('keydown', onKey);
  window.addEventListener('pointerdown', (e) => { G.input = e.pointerType === 'touch' ? 'touch' : 'mouse'; if (G.springsOpen && (!e.target || !e.target.closest || !e.target.closest('#springs'))) syncSpringsDrawer(false); }, true);
  window.addEventListener('pointerdown', (e) => {
    const onMini = e.target === $('#board') && R.minimapHit(...boardPoint(e));
    G.boardTap = !onMini && !G.dialog && !G.privacy && e.isPrimary && e.target && e.target.closest && e.target.closest('#boardwrap')
      ? { id: e.pointerId, x: e.clientX, y: e.clientY }
      : null;
  }, true);
  window.addEventListener('pointerup', (e) => {
    const t = G.boardTap; G.boardTap = null;
    if (t && t.id === e.pointerId && !G.dialog && !G.privacy && Math.hypot(e.clientX - t.x, e.clientY - t.y) < 10) skipComputerWait();
  }, true);
  window.addEventListener('keydown', (e) => { if (!['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) G.input = 'key'; }, true);
  // at most one relayout a frame, drawn in that frame; the HUD is rebuilt only where the window crosses into or out of the narrow layout
  let resizeRaf = 0;
  const resized = (now) => {
    resizeRaf = 0;
    if (G.drag) G.drag.boxes = null;
    if (G.scene === 'game' && G.s && isNarrow() !== G.narrow) renderGame();
    layout();
    if (raf) { cancelAnimationFrame(raf); frame(now); }
    if (steam.on) { cancelAnimationFrame(steam.raf); steamLoop(now); }
  };
  window.addEventListener('resize', () => { if (!resizeRaf) resizeRaf = requestAnimationFrame(resized); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applySettings);
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', applySettings);
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
      view: { zoom: R.view.zoom, cx: R.view.cx, cy: R.view.cy, W: R.view.W, H: R.view.H, mode3d: B3.B3.on, reason3d: B3.B3.reason }, aiThinking: G.aiBusy, aiHeld: !!G.aiHeld, pulse: !!G.lastPulse, badPulse: G.badPulse ? { cells: G.badPulse.cells.slice(), dur: G.badPulse.dur } : null, aiWait: { reply: !!G.aiFire, turn: !!(G.turnWait && G.turnWait.fromAi) }, ready: G.ready, privacy: G.privacy,
      drag: G.drag && G.drag.active ? { from: G.drag.from, target: G.drag.target, blocked: G.drag.blocked, lift: G.drag.lift, size: G.drag.size } : null,
      ai: aiClient.mode, dictMs: G.dictMs, toast: $('#toast').textContent, sweeps: steam.sweeps.length, sweepCells: steam.sweeps.length ? steam.sweeps[0].cells.slice() : [], flashes: steam.flashes.length, fx: { on: steam.on, parts: steam.parts.length, maxParts: MAX_PARTICLES, stamps: !!_fxStamps, shapes: FX_SHAPES, flashShapes: steam.flashes.map((f) => f.shape), flashDurs: steam.flashes.map((f) => f.dur), lastTier: steam.lastTier, lastEvent: steam.lastEvent, sparkKinds: steam.parts.filter((p) => p.kind === 'spark').length, steamKinds: steam.parts.filter((p) => p.kind === 'steam').length, wispKinds: steam.parts.filter((p) => p.kind === 'wisp').length }, arcs: steam.arcs.length, arcLog: steam.arcLog.slice(-6), wisps: steam.parts.filter((p) => p.kind !== 'spark').map((p) => p.i), sparks: steam.parts.filter((p) => p.kind === 'spark').length, sweepAt: steam.sweeps.length ? steam.sweeps[0].t0 : null, lastLine: G.lastLine || null, sfx: audio.played.slice(-10) }));
  },
  setState(o) {
    if (o.game) {
      const before = G.s, replacement = JSON.parse(JSON.stringify(o.game)), handle = gameHandles.get(before);
      if (handle && gameSaves.replaceFixture(handle, before, replacement)) gameHandles.set(replacement, handle);
      G.s = replacement; G.bagLen = G.s.bag.length; G.last = new Set(lastTiles(G.s)); resetOrder(); G.revealed = G.s.cur; G.privacy = false;
    }
    if (o.scene) showScene(o.scene); else { moodUpdate(); renderGame(); }
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
  audioRender(name, seconds = 30, wantWav = false, opts) { return audioRender(name, seconds, !!wantWav, opts); },
  audioState() {
    const k = audio.kit, i = k && k.music.info();
    return { ctx: audio.ctx ? audio.ctx.state : null, held: k ? k.held : null, ticking: k ? k.ticking : false, holds: [...audio.holds], tune: tuneName(), intensity: k ? k.music.inten : 0, bed: !!(k && k.amb.scene), notes: i ? i.notes : 0, bars: i ? i.bars : 0, want: audio.want, on: audio.on, fx: audio.fx, music: audio.music, amb: audio.amb, played: audio.played.slice(), total: audio.total, cues: audio.cues.slice(), fxGain: audio.bus ? audio.bus.sfx.gain.value : null, musGain: audio.bus ? audio.bus.mus.gain.value : null };
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
      case 'cell': return R.cellCenter(a[0], a[1] || 0).map((v) => Math.round(v * 10) / 10);
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
      case 'minimap': return { on: R.view.zoom > R.MINIMAP_ZOOM, box: R.minimapBox(), view: G.minimapView || null };
      case 'reveal': G.revealed = G.s.cur; G.privacy = false; renderGame(); return true;
      case 'hint': await doHint(); return G.staged.length;
      case 'daily': startDaily(a[0]); return true;
      case 'toast': toast(a[0]); return true;
      case 'has': return has(G.dict, a[0]);
      case 'b3': return B3.debug ? B3.debug() : null;
      case 'b3feed': if (a[2]) B3.B3.intervals.length = 0; for (let k = 0; k < a[1]; k++) B3.noteInterval(a[0]); return B3.slowFrames();   // n frame intervals of `ms` (after clearing the old ones if a[2]), as if animated frames had taken that long
      case 'sfx': sfx(a[0], a[1] || {}); return true;   // a cue on the live audio, for the tests
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

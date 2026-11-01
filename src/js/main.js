// Controller: scenes, turn flow, staging and input, AI pacing, toasts and fact cards, saves and window.__game.
import { loadDict, has } from './dict.js';
import { makeLexicon } from './lexicon.js';
import * as E from './engine.js';
import { N, CENTER, RACK, FULL_SOAK, FEATURED_BONUS, SQUARE as SQUARES, BATHHOUSES as BATHS } from './score.js';
import { seedState } from './rng.js';
import * as R from './render2d.js';
import { audio, unlock, sfx } from './audio.js';
import { art, loadArt } from './art.js';
import { store, KEYS } from './storage.js';
import { startAi, aiMove, aiHint, aiClient } from './aiclient.js';
import { PERSONAS, persona } from './personas.js';
import * as B3 from './board3d.js';
import * as UI from './ui.js';
import { generateMoves } from './movegen.js';

const { qs: $, esc } = UI;
const META = { words: 168295 };

const G = {
  s: null, scene: 'title', back: 'title', dict: null, lex: makeLexicon(LEXICON), ready: false,
  settings: { sound: true, vol: 0.35, theme: 'auto', motion: 'system', text: 1, board3d: 'auto', ai: 'normal', hints: true },
  setup: null, nextSeed: null,
  staged: [], order: [], selected: null, cursor: { i: CENTER, dir: 1, on: false },
  preview: null, hint: null, last: new Set(), anim: new Map(), animUntil: 0,
  aiBusy: false, aiTimer: 0, privacy: false, revealed: -1, dialog: null, toastQ: [], helpTab: 'rules',
  drag: null, returning: null, returnTimer: 0, pointers: new Map(), pinch: null, fxFrozen: null, busyUntil: 0, lastHuman: -1,
};
window.__G = G;

// ---------- settings ----------
const reduced = () => G.settings.motion === 'reduce' || (G.settings.motion === 'system' && matchMedia('(prefers-reduced-motion: reduce)').matches);
const animOn = () => !reduced() && !G.fast;
const dark = () => G.settings.theme === 'dark' || (G.settings.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
function loadSettings() { Object.assign(G.settings, store.json(KEYS.settings, {})); applySettings(); }
function saveSettings() { store.put(KEYS.settings, G.settings); applySettings(); }
function applySettings() {
  const st = G.settings;
  audio.on = !!st.sound; audio.vol = st.vol;
  document.documentElement.style.setProperty('--ts', st.text);
  document.body.classList.toggle('theme-dark', dark());
  document.body.classList.toggle('reduce', reduced());
  const sb = $('#b-sound'); if (sb) { sb.innerHTML = UI.ICON.sound(st.sound); sb.setAttribute('aria-label', st.sound ? 'Sound on (click to mute)' : 'Sound off (click to unmute)'); }
  R.invalidateBoardTexture();
  if (B3.B3.on) B3.setTheme(dark() ? 'dark' : 'light');
  layout();
}

// ---------- boot ----------
async function boot() {
  loadSettings();
  if (window.__TEST__) G.settings.ai = G.settings.ai || 'normal';
  loadArt(() => { R.invalidateBoardTexture(); draw(); if (G.scene === 'title' && !G.dialog) showScene('title'); if (G.scene === 'game') renderGame(); });
  showScene('title');
  const t0 = performance.now();
  G.dict = await loadDict(DICT_B64);
  G.dictMs = Math.round(performance.now() - t0);
  startAi(DICT_B64, LEXICON, { dict: G.dict, lex: G.lex });
  G.ready = true;
  if (G.scene === 'title' && !G.dialog) showScene('title');
  if (G.afterReady) { const f = G.afterReady; G.afterReady = null; f(); }
}

// ---------- saves, register, daily ----------
const save = () => { if (G.s && !G.s.over) store.put(KEYS.save, G.s); else store.del(KEYS.save); };
const loadSave = () => { const s = store.json(KEYS.save, null); return s && s.v === 1 && !s.over ? s : null; };
const register = () => store.json(KEYS.register, {});
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function dailyInfo() {
  const d = store.json(KEYS.daily, { days: {}, streak: 0, last: null });
  return { ...d, today: d.days[G.dailyDate || today()] || null };
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
  const d = store.json(KEYS.daily, { days: {}, streak: 0, last: null });
  const date = s.daily.date, score = s.players[0].score;
  const prev = d.days[date];
  d.days[date] = { score: prev ? Math.max(prev.score, score) : score, plays: (prev ? prev.plays : 0) + 1 };
  if (d.last !== date) {
    const y = new Date(date + 'T12:00:00'); y.setDate(y.getDate() - 1);
    const yd = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
    d.streak = d.last === yd ? d.streak + 1 : 1;
    d.last = date;
  }
  store.put(KEYS.daily, d);
}

// ---------- scenes ----------
function showScene(name, arg) {
  const prev = G.scene;
  if (name !== prev && !['help', 'settings', 'about', 'register'].includes(name)) G.back = name;
  if (['help', 'settings', 'about', 'register'].includes(name) && !['help', 'settings', 'about', 'register'].includes(prev)) G.back = prev;
  G.scene = name;
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
      return UI.titleHtml({ canContinue: !!sv, continueLine: sv ? (sv.mode === 'daily' ? 'Daily Soak in progress' : `${sv.players.map((p) => p.name).join(' vs ')} · move ${sv.move + 1}`) : '', dailyLine: UI.dailyLine(di), found, total: lex.data.words.length, loading: !G.ready });
    }
    case 'setup': return UI.setupHtml(G.setup);
    case 'help': return UI.helpHtml(G.helpTab, lex);
    case 'settings': return UI.settingsHtml(G.settings);
    case 'register': return UI.registerHtml(lex, register());
    case 'about': return UI.aboutHtml(META);
    case 'over': {
      if (G.s.mode !== 'daily') return UI.overHtml(G.s, lex);
      const d = store.json(KEYS.daily, { days: {}, streak: 0 }), date = G.s.daily.date, day = d.days[date];
      const label = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      return UI.overHtml(G.s, lex, { label, best: day ? day.score : G.s.players[0].score, streak: d.streak || 1 });
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
    scr.querySelectorAll('[data-persona]').forEach((sel) => sel.addEventListener('change', () => { st.seats[+sel.dataset.persona].persona = sel.value; showScene('setup'); }));
    scr.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => { st.seats.splice(+b.dataset.remove, 1); showScene('setup'); }));
    const add = scr.querySelector('[data-add]');
    if (add) add.addEventListener('click', () => { const used = new Set(st.seats.map((x) => x.persona)); st.seats.push({ kind: 'ai', persona: (PERSONAS.find((p) => !used.has(p.id)) || PERSONAS[0]).id }); showScene('setup'); });
    scr.querySelector('[data-hints]').addEventListener('change', (e) => { st.hints = e.target.checked; });
    scr.querySelector('[data-start]').addEventListener('click', () => {
      G.settings.lastSetup = st; saveSettings();
      newGame({ mode: 'play', seats: st.seats.map((x, k) => (x.kind === 'human' ? { kind: 'human', name: (x.name || '').trim() || (st.seats.filter((y) => y.kind === 'human').length > 1 ? `Player ${k + 1}` : 'You') } : { kind: 'ai', persona: x.persona, level: persona(x.persona).level, name: persona(x.persona).name })), hints: st.hints });
    });
  }
  if (name === 'help') scr.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { G.helpTab = b.dataset.tab; showScene('help'); scr.querySelector(`[data-tab="${G.helpTab}"]`).focus(); }));
  if (name === 'settings') {
    scr.querySelectorAll('[data-set]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.set, raw = b.dataset.val;
      G.settings[k] = raw === 'true' ? true : raw === 'false' ? false : isNaN(+raw) ? raw : +raw;
      saveSettings(); showScene('settings'); scr.querySelector(`[data-set="${k}"][data-val="${raw}"]`).focus();
      if (k === 'sound' && G.settings.sound) { unlock(); sfx('place'); }
      if (k === 'board3d') B3.want(G.settings.board3d);
    }));
    scr.querySelector('[data-vol]').addEventListener('input', (e) => { G.settings.vol = +e.target.value; saveSettings(); });
    scr.querySelector('[data-vol]').addEventListener('change', () => sfx('place'));
  }
  if (name === 'register') scr.querySelectorAll('[data-reg]').forEach((b) => b.addEventListener('click', () => openFact(b.dataset.reg)));
  if (name === 'over') {
    scr.querySelectorAll('[data-fact]').forEach((b) => b.addEventListener('click', () => openFact(b.dataset.fact, b.dataset.form)));
    const again = scr.querySelector('[data-again]');
    if (again) again.addEventListener('click', () => newGame({ mode: 'play', seats: G.s.players.map((p) => ({ kind: p.kind, name: p.name, persona: p.persona, level: p.level })), hints: G.s.players.some((p) => p.hints != null) }));
  }
}

function go(where) {
  unlock();
  if (where === 'continue') { const sv = loadSave(); if (sv) resumeGame(sv); return; }
  if (where === 'setup') { G.setup = defaultSetup(); showScene('setup'); return; }
  if (where === 'daily') { startDaily(); return; }
  if (where === 'title' && G.scene === 'game') save();
  showScene(where);
}
function back() { showScene(G.back && G.back !== G.scene ? G.back : 'title'); }

// ---------- starting games ----------
function whenReady(f) { if (G.ready) f(); else { G.afterReady = f; showScene('title'); } }
function newGame(opts) {
  whenReady(() => {
    const seed = G.nextSeed != null ? G.nextSeed : (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    G.nextSeed = null;
    const s = E.createGame({ ...opts, seed }, G.lex);
    if (opts.hints === false) for (const p of s.players) p.hints = null;
    for (const p of s.players) if (p.kind !== 'human') p.hints = null;
    beginGame(s);
  });
}
function startDaily(date) {
  whenReady(() => {
    G.dailyDate = date || today();
    const s = E.createGame({ mode: 'daily', date: G.dailyDate, seats: [{ kind: 'human', name: 'You' }] }, G.lex);
    s.players[0].hints = null;
    beginGame(s);
  });
}
function resumeGame(sv) { whenReady(() => beginGame(sv)); }
function beginGame(s) {
  G.s = s;
  G.staged = []; G.selected = null; G.hint = null; G.preview = null; G.anim.clear(); G.last = new Set(lastTiles(s));
  G.revealed = -1; G.lastHuman = -1; G.privacy = false;
  resetOrder();
  R.view.zoom = 1; R.view.cx = R.U / 2; R.view.cy = R.U / 2;
  save();
  showScene('game');
  startTurn();
}
const lastTiles = (s) => { const e = [...s.log].reverse().find((x) => x.kind === 'play'); return e ? e.tiles.map((t) => t.i) : []; };
const cur = () => G.s.players[G.s.cur];
const humans = () => G.s.players.filter((p) => p.kind === 'human').length;
function resetOrder() { G.order = G.s ? cur().rack.map((_, k) => k) : []; G.staged = []; G.selected = null; }

// ---------- turn flow ----------
function startTurn() {
  const s = G.s;
  clearTimeout(G.aiTimer);
  if (s.over) { finishGame(); return; }
  resetOrder();
  G.hint = null;
  updatePreview();
  if (cur().kind === 'ai') { G.privacy = false; renderGame(); scheduleAi(); return; }
  // pass and play: hide the rack until the next person is ready
  G.privacy = humans() >= 2 && G.revealed !== s.cur;
  renderGame();
}

function scheduleAi() {
  const s = G.s;
  G.aiBusy = true;
  renderPreview();
  const delay = G.fast ? 0 : ({ normal: 700, fast: 250, instant: 0 })[G.settings.ai] ?? 700;
  const t0 = performance.now();
  const seat = s.cur, move = s.move;
  aiMove(s, cur().level).then((r) => {
    const wait = Math.max(0, delay - (performance.now() - t0));
    G.aiTimer = setTimeout(() => {
      if (G.s !== s || s.move !== move || s.cur !== seat || s.over) { G.aiBusy = false; return; }
      s.rng.ai = r.rngAi;
      const res = E.apply(s, r.action, ctx());
      G.aiBusy = false;
      if (!res.ok) { console.warn('AI move refused', res.error); E.apply(s, { type: 'pass' }, ctx()); }
      afterAction(res.ok ? res.entry : s.log[s.log.length - 1], true);
    }, wait);
  });
}

const ctx = () => ({ dict: G.dict, lex: G.lex });

function afterAction(entry, fromAi) {
  const s = G.s;
  G.flash = null;
  G.staged = []; G.selected = null; G.hint = null;
  if (entry.kind === 'play') {
    G.last = new Set(entry.tiles.map((t) => t.i));
    if (fromAi && animOn()) {
      const t0 = performance.now();
      entry.tiles.forEach((t, k) => G.anim.set(t.i, { t0: t0 + k * 90, dur: 320 }));
      G.animUntil = t0 + entry.tiles.length * 90 + 340;
      entry.tiles.forEach((_, k) => setTimeout(() => sfx('place'), k * 90 + 200));
      tick();
    } else sfx('play');
    celebrate(entry);
    recordRegister(entry);
  } else {
    sfx(entry.kind === 'swap' ? 'swap' : 'turn');
  }
  announce(entry);
  if (cur().kind === 'human' && !fromAi) G.lastHuman = s.cur;
  save();
  rollScores();
  const wait = G.fast ? 0 : (fromAi && animOn() ? Math.max(0, G.animUntil - performance.now()) + 250 : 150);
  G.busyUntil = performance.now() + wait;
  setTimeout(() => { if (G.s === s) startTurn(); }, wait);
  renderGame();
}

function finishGame() {
  const s = G.s;
  save();
  if (s.mode === 'daily') recordDaily();
  const humanWon = s.result.winners.some((k) => s.players[k].kind === 'human');
  sfx(humanWon || s.mode === 'daily' ? 'fanfare' : 'turn');
  setTimeout(() => { if (G.s === s) showScene('over'); }, G.fast ? 0 : 900);
}

// Toasts and effects for a play: Full Soak, Hot Springs words, a Featured Spring.
function celebrate(e) {
  const p = G.s.players[e.p];
  const themed = e.words.filter((w) => w.themed);
  if (e.featured) { toast({ kind: 'featured', title: `Featured Spring: ${e.featured}`, sub: `${p.name} found it · +${FEATURED_BONUS}`, fact: G.lex.entry(e.featured)?.id, form: e.featured }); sfx('featured'); }
  for (const w of themed) {
    const entry = G.lex.byId.get(w.themed);
    toast({ kind: 'themed', title: `${w.w} +${w.bonus}${w.bath ? ' · Row ×2' : ''}`, sub: G.lex.categories[entry.cat].name, fact: entry.id, form: w.w });
    steamBurst(e.tiles.map((t) => t.i));
  }
  if (themed.length && !e.featured) sfx('steam');
  if (e.full) { toast({ kind: 'soak', title: `Full Soak! +${FULL_SOAK}`, sub: `${p.name} used all seven tiles.` }); sfx('chime'); }
  scorePop(e);
}

function announce(e) {
  const p = G.s.players[e.p];
  let t;
  if (e.kind === 'play') t = `${p.name} played ${e.words.map((w) => w.w).join(' and ')} for ${e.score}${e.themed ? `, including a Hot Springs bonus of ${e.themed}` : ''}${e.full ? ', with a Full Soak' : ''}.`;
  else t = e.kind === 'swap' ? `${p.name} swapped ${UI.plural(e.count, 'tile')}.` : `${p.name} passed.`;
  const live = $('#live'); live.textContent = ''; setTimeout(() => { live.textContent = t; }, 30);
  G.lastLine = t;
}

// ---------- staging ----------
const stagedTiles = () => G.staged.map((t) => ({ i: t.i, l: t.l, blank: t.blank }));
function updatePreview() {
  if (G.flash) { G.flash = null; clearTimeout(flashTimer); }
  if (!G.s || !G.staged.length) { G.preview = null; return; }
  G.preview = E.evaluate(G.s, stagedTiles(), ctx());
}
function stage(k, i, letter) {
  const s = G.s, l = cur().rack[k];
  if (i < 0 || s.board[i] || G.staged.some((t) => t.i === i)) return false;
  if (l === '?' && !letter) { askBlank((ch) => stage(k, i, ch)); return true; }
  G.staged.push({ k, i, l: l === '?' ? letter : l, blank: l === '?' });
  G.order = G.order.filter((x) => x !== k);
  G.selected = null; G.hint = null;
  sfx('place');
  updatePreview(); renderGame();
  return true;
}
function unstage(i, toPos) {
  const t = G.staged.find((x) => x.i === i);
  if (!t) return;
  G.staged = G.staged.filter((x) => x !== t);
  if (toPos != null) G.order.splice(toPos, 0, t.k); else G.order.push(t.k);
  sfx('recall');
  updatePreview(); renderGame();
}
function recallAll() { if (!G.staged.length) return; for (const t of [...G.staged]) G.order.push(t.k); G.staged = []; sfx('recall'); updatePreview(); renderGame(); }
function shuffleRack() {
  const o = G.order;
  for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
  sfx('shuffle'); renderRack();
}

function humanCanAct() { return G.s && !G.s.over && cur().kind === 'human' && !G.aiBusy && !G.privacy && G.scene === 'game' && !G.dialog; }

function doPlay() {
  if (!humanCanAct()) return;
  if (!G.staged.length) { flash('Place tiles on the board first.'); sfx('error'); return; }
  const r = E.apply(G.s, { type: 'play', tiles: stagedTiles() }, ctx());
  if (!r.ok) { flash(r.error); sfx('error'); shake(); return; }
  afterAction(r.entry, false);
}
function doPass() {
  if (!humanCanAct()) return;
  if (G.staged.length) recallAll();
  confirmDialog('Pass this turn?', 'You keep your tiles and score nothing.', 'Pass', () => { const r = E.apply(G.s, { type: 'pass' }, ctx()); if (r.ok) afterAction(r.entry, false); });
}
function doSwap() {
  if (!humanCanAct()) return;
  if (G.s.bag.length < RACK) { flash('You can swap only while the bag holds at least seven tiles.'); sfx('error'); return; }
  recallAll();
  openDialog('swap');
}
async function doHint() {
  if (!humanCanAct()) return;
  const p = cur();
  if (p.hints == null || p.hints <= 0) return;
  recallAll();
  G.hintBusy = true; renderPreview();
  const m = await aiHint(G.s);
  G.hintBusy = false;
  if (!m) { flash('No play found. Try a swap.'); renderPreview(); return; }
  p.hints--;
  // a hint becomes a staged play the player can accept with Play, move, or recall
  for (const t of m.tiles) {
    const k = cur().rack.findIndex((l, j) => (t.blank ? l === '?' : l === t.l) && !G.staged.some((x) => x.k === j));
    if (k >= 0) { G.staged.push({ k, i: t.i, l: t.l, blank: t.blank }); G.order = G.order.filter((x) => x !== k); }
  }
  G.hint = null;
  updatePreview(); save(); renderGame();
  flash(`Spring Guide: ${m.words[0]} for ${m.score}. Play it, move the tiles, or take them back.`, 4000);
}

// ---------- rendering ----------
function renderGame() {
  if (G.scene !== 'game' || !G.s) return;
  const s = G.s;
  const mobile = isNarrow();
  $('#scores').innerHTML = mobile ? '' : UI.scoresHtml(s, false);
  $('#springs').innerHTML = UI.springsHtml(s, G.lex, mobile);
  $('#springs').querySelectorAll('[data-plaque]').forEach((b) => b.addEventListener('click', () => {
    const f = s.featured[+b.dataset.plaque];
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
  el.innerHTML = UI.actionsHtml({ staged: G.staged.length > 0, canSwap: s.bag.length >= RACK, canPlay: G.staged.length > 0 && G.preview && G.preview.ok, hints: p.hints != null && p.kind === 'human' ? p.hints : null });
  el.classList.toggle('waiting', !human || s.over);
  el.querySelectorAll('[data-act]').forEach((b) => {
    if (!human || s.over) b.disabled = true;
    b.addEventListener('click', () => { unlock(); ({ play: doPlay, pass: doPass, swap: doSwap, hint: doHint, recall: recallAll, shuffle: shuffleRack })[b.dataset.act](); });
  });
}

function renderRack() {
  const el = $('#rack');
  if (!G.s) return;
  const p = cur();
  const show = p.kind === 'human' && !G.privacy;
  // whose rack shows: the current human's; during AI turns, the last human's tiles stay visible but dimmed
  let rack = p.rack, order = G.order, dim = false;
  if (!show) {
    const hk = G.s.players.findIndex((x) => x.kind === 'human');
    if (hk >= 0 && humans() === 1) { rack = G.s.players[hk].rack; order = rack.map((_, k) => k); dim = true; } else { rack = []; order = []; }
  }
  const size = rackTileSize();
  el.style.setProperty('--tile', size + 'px');
  el.classList.toggle('dim', dim);
  el.innerHTML = order.map((k, pos) => `<button class="rtile ${G.selected === k ? 'sel' : ''}"${G.returning === k ? ' style="visibility:hidden"' : ''} data-k="${k}" data-pos="${pos}" aria-label="${rack[k] === '?' ? 'Blank tile' : `${rack[k]}, ${E.tileValue(rack[k])} points`}" aria-pressed="${G.selected === k}" ${dim ? 'tabindex="-1" disabled' : ''}><canvas width="${Math.round(size * dpr())}" height="${Math.round(size * dpr())}"></canvas></button>`).join('')
    + Array.from({ length: Math.max(0, RACK - order.length) }, () => '<span class="rslot" aria-hidden="true"></span>').join('');
  el.querySelectorAll('.rtile').forEach((b) => {
    const l = rack[+b.dataset.k];
    const c = b.querySelector('canvas');
    c.getContext('2d').drawImage(R.tileSprite(l === '?' ? '' : l, l === '?', size * dpr(), 'rack'), 0, 0);
    if (!dim) b.addEventListener('pointerdown', (e) => rackDown(e, +b.dataset.k));
    b.addEventListener('click', (e) => { if (e.detail === 0 && !dim) { G.selected = G.selected === +b.dataset.k ? null : +b.dataset.k; renderRack(); } }); // keyboard activation
  });
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
      html = `<span class="words">${p.words.map((w) => `<b class="${w.themed ? 'themed' : ''}">${w.w}</b>`).join(' ')}</span><span class="pts">${p.score}<small> pts</small></span>${p.themed ? `<span class="extra">${UI.ICON.steam} +${p.themed}</span>` : ''}${p.full ? `<span class="extra">Full Soak +${FULL_SOAK}</span>` : ''}${p.featured ? `<span class="extra">Featured +${FEATURED_BONUS}</span>` : ''}`;
      cls = 'ok';
    } else { html = esc(p.error); cls = 'bad'; }
  } else if (G.hoverInfo) html = G.hoverInfo;
  else if (G.lastLine) html = esc(G.lastLine);
  else html = cur().kind === 'human' ? (G.s.move === 0 ? (isNarrow() ? 'Start on the centre square.' : 'Start on the Display Spring in the centre.') : (isNarrow() ? 'Drag tiles to the board.' : 'Drag tiles to the board to make a word.')) : '';
  el.className = cls; el.innerHTML = html;
}

function renderPrivacy() {
  const el = $('#privacy');
  el.hidden = !G.privacy;
  if (!G.privacy) return;
  el.innerHTML = UI.privacyHtml(cur(), G.s.cur);
  el.querySelector('[data-reveal]').addEventListener('click', () => { unlock(); G.revealed = G.s.cur; G.privacy = false; sfx('turn'); renderGame(); });
}

let flashTimer = 0;
function flash(text, ms = 2600) { G.flash = text; clearTimeout(flashTimer); renderPreview(); flashTimer = setTimeout(() => { G.flash = null; renderPreview(); }, ms); }
function shake() { const el = $('#preview'); el.classList.remove('shake'); void el.offsetWidth; if (animOn()) el.classList.add('shake'); }

function rollScores() {
  if (!animOn()) return;
  document.querySelectorAll('[data-score]').forEach((el) => el.classList.add('bump'));
}
function scorePop(e) {
  if (!animOn() || !e.tiles.length) return;
  const i = e.tiles[e.tiles.length - 1].i;
  const [x, y] = R.cellCenter(i);
  const el = document.createElement('div');
  el.className = 'pop'; el.textContent = `+${e.score}`;
  el.style.left = x + 'px'; el.style.top = y + 'px';
  $('#boardwrap').append(el);
  setTimeout(() => el.remove(), 1400);
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
  const t = G.toastQ.shift();
  el.dataset.busy = '1';
  el.className = `on ${t.kind}`;
  $('#app').classList.add('toasting');
  el.innerHTML = `<button ${t.fact ? `data-fact="${t.fact}" data-form="${t.form || ''}"` : 'tabindex="-1"'}><span class="ti">${t.kind === 'soak' ? UI.ICON.play : UI.ICON.steam}</span><span class="tt"><b>${esc(t.title)}</b><small>${esc(t.sub || '')}</small></span>${t.fact ? '<em>Read the card ›</em>' : ''}</button>`;
  const b = el.querySelector('[data-fact]');
  if (b) b.addEventListener('click', () => { openFact(b.dataset.fact, b.dataset.form); hideToast(); });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, t.kind === 'themed' ? 5200 : 3200);
}
function hideToastNow() { const el = $('#toast'); clearTimeout(toastTimer); el.dataset.busy = '0'; el.className = ''; el.innerHTML = ''; $('#app').classList.remove('toasting'); }
function hideToast() { const el = $('#toast'); el.dataset.busy = '0'; el.className = ''; $('#app').classList.remove('toasting'); setTimeout(showToast, 200); }

// ---------- dialogs ----------
function openDialog(name, arg) {
  const m = $('#modal');
  G.dialog = name;
  let html = '';
  if (name === 'swap') html = UI.swapHtml(cur().rack);
  else if (name === 'blank') html = UI.blankHtml();
  else if (name === 'pause') html = UI.pauseHtml({ mobile: isNarrow() });
  else if (name === 'ledger') html = UI.ledgerHtml(G.s, G.lex);
  else if (name === 'fact') html = `<div class="dialog-wrap" role="dialog" aria-modal="true" aria-label="Hot Springs word card">${UI.factHtml(arg.entry, G.lex, arg.form, '<div class="dlg-btns"><button class="btn primary" data-close>Close</button></div>')}</div>`;
  else if (name === 'confirm') html = `<div class="card dialog" role="dialog" aria-modal="true" aria-labelledby="cf-h"><h2 id="cf-h">${esc(arg.title)}</h2><p>${esc(arg.text)}</p><div class="dlg-btns"><button class="btn quiet" data-close>Cancel</button><button class="btn primary" data-ok>${esc(arg.ok)}</button></div></div>`;
  m.innerHTML = html; m.hidden = false; m.dataset.name = name; G.dialogAt = performance.now();
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
  G.dialog = null; G.blankCb = null; m.hidden = true; m.innerHTML = '';
  if (!silent) { const b = $('#board'); if (G.scene === 'game' && b) b.focus({ preventScroll: true }); }
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
    m.hidden = false; m.dataset.name = 'fact'; G.dialogAt = performance.now();
    m.querySelector('[data-close]').addEventListener('click', () => closeDialog());
    m.querySelector('[data-close]').focus();
  }
}

// ---------- layout and drawing ----------
const dpr = () => Math.min(3, window.devicePixelRatio || 1);
const isNarrow = () => matchMedia('(max-width: 860px), (max-aspect-ratio: 1/1)').matches;
function rackTileSize() {
  const w = $('#rackbar') ? $('#rackbar').clientWidth : 360;
  return Math.max(40, Math.min(isNarrow() ? 52 : 60, Math.floor((w - 16) / 7) - 6));
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
  $('#b-zoom').hidden = R.view.zoom <= 1.01;
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
  if (G.scene !== 'game' || !G.s) return;
  const cv = $('#board'), c2 = cv.getContext('2d');
  const d = drawData(now);
  if (B3.B3.on) {
    B3.render(d); d.flatOnly = true; d.hideTiles = true; d.mode3d = true; d.cellPx = B3.cellPx();
    if (G.settings.board3d === 'auto' && B3.slowFrames()) { fallback2D('slow'); return; }
  }
  R.drawFrame(c2, d);
  if (R.view.zoom > 1.2) {
    // the visible area in board cells (the 3D camera frames the same centre and zoom)
    const wCells = R.U / R.view.zoom * (R.view.W / Math.min(R.view.W, R.view.H)), hCells = R.U / R.view.zoom * (R.view.H / Math.min(R.view.W, R.view.H));
    c2.setTransform(R.view.dpr, 0, 0, R.view.dpr, 0, 0);
    R.drawMinimap(c2, G.s.board, G.staged, [R.view.cx - wCells / 2, R.view.cy - hCells / 2, wCells, hCells]);
  }
  if (G.anim.size && now < G.animUntil + 50) draw();
  else if (G.anim.size) G.anim.clear();
  if (G.viewAnim) stepViewAnim(now);
}
function drawData(now) {
  const p = G.preview;
  return {
    board: G.s.board, staged: G.staged, last: G.last, hint: G.hint, theme: dark() ? 'dark' : 'light',
    cursor: G.cursor.on && humanCanAct() ? G.cursor : null,
    goodCells: p && p.ok ? [...new Set(p.words.flatMap((w) => w.cells))] : null,
    badCells: p && !p.ok && p.words ? p.words.filter((w) => w.w === p.badWord).flatMap((w) => w.cells) : null,
    target: G.drag && G.drag.active ? G.drag.target : null, dragFrom: G.drag && G.drag.from === 'board' && G.drag.active ? G.drag.i : null,
    dragTile: G.drag && G.drag.active ? G.drag.tile : null, blocked: G.drag && G.drag.active ? G.drag.blocked : null,
    anim: G.anim, now,
  };
}
function tick() { draw(); }

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
  if (k >= 1) { G.viewAnim = null; layout(); } else draw();
}
const pxPerCell = () => (B3.B3.on ? B3.cellPx() : R.scale());

// ---------- steam effects (ambient; not part of isIdle) ----------
const steam = { parts: [], last: 0, on: false, emit: 0 };
const ambientSteam = () => animOn() && G.scene === 'game' && G.s && !G.s.board[CENTER] && !G.staged.some((t) => t.i === CENTER);
function steamBurst(cells) {
  if (!animOn()) return;
  for (const i of cells) for (let k = 0; k < 6; k++) steam.parts.push({ i, x: Math.random() - 0.5, y: 0, vx: (Math.random() - 0.5) * 0.3, vy: 0.6 + Math.random() * 0.6, life: 0, max: 1.2 + Math.random() * 0.8, r: 0.25 + Math.random() * 0.25, a: 0.45 });
  startSteam();
}
function startSteam() { if (!steam.on && (steam.parts.length || ambientSteam())) { steam.on = true; steam.last = 0; requestAnimationFrame(steamLoop); } }
function steamLoop(now) {
  const fx = $('#fx');
  if (!fx || G.scene !== 'game') { steam.on = false; return; }
  const c = fx.getContext('2d'), d = R.view.dpr;
  if (G.fxFrozen != null) now = G.fxFrozen;
  c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, R.view.W, R.view.H);
  const dt = G.fxFrozen != null ? 0 : Math.min(0.05, (now - (steam.last || now)) / 1000); steam.last = now;
  const cell = pxPerCell();
  // a slow wisp from the Display Spring every ~0.7 s while it is uncovered
  if (ambientSteam() && G.fxFrozen == null) {
    steam.emit -= dt;
    if (steam.emit <= 0) { steam.emit = 0.7; steam.parts.push({ i: CENTER, x: (Math.random() - 0.5) * 0.3, y: 0, vx: (Math.random() - 0.5) * 0.12, vy: 0.35 + Math.random() * 0.2, life: 0, max: 2.6, r: 0.22, a: 0.32 }); }
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
  if (steam.parts.length || ambientSteam()) requestAnimationFrame(steamLoop); else { steam.on = false; c.clearRect(0, 0, R.view.W, R.view.H); }
}

// ---------- pointer input ----------
function boardPoint(e) { const r = $('#board').getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
function pick(x, y) { return B3.B3.on ? B3.cellAt(x, y) : R.cellAt(x, y); }

function rackDown(e, k) {
  if (!humanCanAct() || e.button > 0) return;
  unlock();
  e.preventDefault();
  G.drag = { from: 'rack', k, x0: e.clientX, y0: e.clientY, id: e.pointerId, touch: e.pointerType === 'touch', active: false, tile: tileOf(k) };
  sfx('pick');
}
const tileOf = (k) => { const l = cur().rack[k]; return { l: l === '?' ? '' : l, blank: l === '?' }; };

function boardDown(e) {
  if (G.scene !== 'game') return;
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
  G.drag = { from: st && humanCanAct() ? 'board' : 'pan', i, x0: e.clientX, y0: e.clientY, bx0: x, by0: y, cx0: R.view.cx, cy0: R.view.cy, id: e.pointerId, touch: e.pointerType === 'touch', active: false, tile: st ? { l: st.l, blank: st.blank } : null, k: st ? st.k : null };
  $('#board').setPointerCapture?.(e.pointerId);
}

const SQUARE_INFO = { w: 'Warm spring: doubles the letter on it', h: 'Hot spring: triples the letter on it', s: 'Steam: doubles the whole word', b: 'Boiling Spring: triples the whole word', '*': 'The Display Spring: the first word covers it' };
function hoverSquare(e) {
  if (G.drag || e.pointerType !== 'mouse' || G.scene !== 'game' || !G.s) return;
  const r = $('#board').getBoundingClientRect();
  const i = pick(e.clientX - r.left, e.clientY - r.top);
  let info = null;
  if (i >= 0 && !G.s.board[i] && !G.staged.length) {
    const k = SQUARES[i];
    if (k === 'B') info = `<b>${esc(BATHS[i])} Bathhouse</b> · Bathhouse Row: a Hot Springs word over it earns its bonus twice`;
    else if (SQUARE_INFO[k]) info = SQUARE_INFO[k];
  }
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
function squareNear(x, y) {
  if (x < 0 || y < 0 || x > R.view.W || y > R.view.H) return -1;
  const b = B3.B3.on ? B3.boardAt(x, y) : R.toBoard(x, y);
  if (!b) return -1;
  const c = b[0] - R.FRAME, r = b[1] - R.FRAME;
  if (c < -0.5 || r < -0.5 || c > N + 0.5 || r > N + 0.5) return -1;
  return clamp(Math.floor(r), 0, N - 1) * N + clamp(Math.floor(c), 0, N - 1);
}
function inRackbar(e) { const r = $('#rackbar').getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; }
function updateDragTarget(d, e) {
  const r = $('#board').getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - d.lift - r.top;   // the tile's centre on the board canvas
  let i = inRackbar(e) ? -1 : squareNear(x, y);
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
  G.order.push(d.k);
  const gh = $('#ghost');
  if (!animOn()) { gh.hidden = true; updatePreview(); renderGame(); return; }
  G.returning = d.k;
  updatePreview(); renderGame();
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
  const dist = Math.hypot(e.clientX - d.x0, e.clientY - d.y0);
  if (d.from === 'pan') {
    if (R.view.zoom > 1.01 && (d.active || dist > 6)) {
      d.active = true;
      const s = pxPerCell();
      R.view.cx = d.cx0 - (e.clientX - d.x0) / s; R.view.cy = d.cy0 - (e.clientY - d.y0) / s; R.clampView(); draw();
    }
    return;
  }
  if (!d.active && dist > 6) {
    d.active = true;
    endReturn();
    if (d.from === 'board') G.staged = G.staged.filter((t) => t.i !== d.i);
    else G.order = G.order.filter((x) => x !== d.k);
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
    renderRack(); updatePreview(); renderPreview();
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
    if (d.target != null && stage(d.k, d.target, d.tile.blank ? d.tile.l : null)) { $('#ghost').hidden = true; draw(); return; }
    // back to the rack, at the drop position when dropped on the rack
    const pos = rackPosAt(e.clientX, e.clientY);
    if (d.from === 'board' || d.blocked != null) sfx(d.blocked != null ? 'error' : 'recall');
    if (pos != null) { $('#ghost').hidden = true; G.order.splice(pos, 0, d.k); updatePreview(); renderGame(); }
    else returnToRack(d);
    draw();
    return;
  }
  if (d.active) { layout(); return; } // pan ended
  // a tap
  if (d.from === 'rack') { G.selected = G.selected === d.k ? null : d.k; renderRack(); return; }
  if (d.from === 'board') { unstage(d.i); return; }
  const [x, y] = boardPoint(e);
  const i = pick(x, y);
  if (G.selected != null && humanCanAct() && i >= 0) { stage(G.selected, i); return; }
  if (i >= 0 && humanCanAct()) {
    if (G.cursor.on && G.cursor.i === i) G.cursor.dir = G.cursor.dir === 1 ? N : 1;
    G.cursor.i = i; G.cursor.on = !d.touch; draw();
  }
}
function rackPosAt(x, y) {
  const r = $('#rack').getBoundingClientRect();
  if (y < r.top - 20 || y > r.bottom + 20 || x < r.left - 20 || x > r.right + 20) return null;
  const tiles = [...document.querySelectorAll('#rack .rtile')];
  let pos = tiles.length;
  tiles.forEach((t, k) => { const b = t.getBoundingClientRect(); if (pos === tiles.length && x < b.left + b.width / 2) pos = k; });
  return pos;
}

// ---------- keyboard ----------
function onKey(e) {
  if (G.dialog) {
    if (e.key === 'Escape') { e.preventDefault(); closeDialog(); }
    if (G.dialog === 'blank' && /^[a-z]$/i.test(e.key)) { e.preventDefault(); const f = G.blankCb; closeDialog(); f && f(e.key.toUpperCase()); }
    return;
  }
  if (G.scene !== 'game') { if (e.key === 'Escape' && G.scene !== 'title') { e.preventDefault(); back(); } return; }
  if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  if (G.privacy && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); $('#privacy [data-reveal]')?.click(); return; }
  const k = e.key;
  if (k === '?') { e.preventDefault(); go('help'); return; }
  if (e.shiftKey && /^[RSPH]$/.test(k.toUpperCase()) && k.length === 1) {
    e.preventDefault();
    ({ R: () => (G.staged.length ? null : shuffleRack()), S: doSwap, P: doPass, H: doHint })[k.toUpperCase()]?.();
    return;
  }
  if (!humanCanAct()) { if (k === 'Escape') { e.preventDefault(); openDialog('pause'); } return; }
  const c = G.cursor;
  const move = (dr, dc) => { const r = Math.floor(c.i / N) + dr, col = (c.i % N) + dc; if (r >= 0 && r < N && col >= 0 && col < N) c.i = r * N + col; c.on = true; ensureVisible(c.i); draw(); };
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
    if (idx == null) { idx = G.order.find((j) => rack[j] === '?'); blankLetter = L; }
    if (idx == null) { flash(`No ${L} on your rack.`); sfx('error'); return; }
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
  $('#b-zoom').addEventListener('click', () => animateView(1, R.U / 2, R.U / 2));
  const b = $('#board');
  b.addEventListener('pointerdown', boardDown);
  window.addEventListener('pointermove', onMove, { passive: false });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', (e) => { G.pointers.delete(e.pointerId); if (G.drag && G.drag.id === e.pointerId) { const d = G.drag; G.drag = null; if (d.active && d.from !== 'pan') returnToRack(d); draw(); } G.pinch = null; });
  b.addEventListener('focus', () => { if (humanCanAct()) { G.cursor.on = true; draw(); } });
  b.addEventListener('blur', () => { G.cursor.on = false; draw(); });
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', () => { layout(); if (G.scene === 'game') renderGame(); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applySettings);
  // no text selection, callouts or context menus on the game screen (phones)
  for (const ev of ['contextmenu', 'selectstart', 'dragstart']) $('#app').addEventListener(ev, (e) => { if (!/INPUT|TEXTAREA/.test(e.target.tagName)) e.preventDefault(); });
  $('#modal').addEventListener('click', (e) => { if (e.target === $('#modal') && G.dialog !== 'blank') closeDialog(); });
}

// ---------- test hooks ----------
const idle = () => G.ready && !art.loading && performance.now() - (G.dialogAt || 0) > 260 && !G.aiBusy && !G.hintBusy && !G.viewAnim && G.anim.size === 0 && performance.now() >= G.busyUntil && !(G.s && !G.s.over && G.scene === 'game' && cur().kind === 'ai' && !G.s.over);
window.__game = {
  seed(n) { G.nextSeed = n >>> 0; return true; },
  getState() {
    return JSON.parse(JSON.stringify({ scene: G.scene, dialog: G.dialog, game: G.s, staged: G.staged, order: G.order, preview: G.preview, settings: G.settings,
      view: { zoom: R.view.zoom, cx: R.view.cx, cy: R.view.cy, W: R.view.W, H: R.view.H, mode3d: B3.B3.on, reason3d: B3.B3.reason }, aiThinking: G.aiBusy, ready: G.ready, privacy: G.privacy,
      drag: G.drag && G.drag.active ? { from: G.drag.from, target: G.drag.target, blocked: G.drag.blocked, lift: G.drag.lift, size: G.drag.size } : null,
      ai: aiClient.mode, dictMs: G.dictMs, toast: $('#toast').textContent, lastLine: G.lastLine || null, sfx: audio.played.slice(-10) }));
  },
  setState(o) {
    if (o.game) { G.s = JSON.parse(JSON.stringify(o.game)); G.last = new Set(lastTiles(G.s)); resetOrder(); G.revealed = G.s.cur; G.privacy = false; }
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
    newGame({ mode: 'play', seats, hints: opts.hints !== false });
    return true;
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
      case 'zoom': R.view.zoom = a[0]; if (a[1] != null) { R.view.cx = a[1]; R.view.cy = a[2]; } R.clampView(); layout(); return true;
      case 'reveal': G.revealed = G.s.cur; G.privacy = false; renderGame(); return true;
      case 'hint': await doHint(); return G.staged.length;
      case 'daily': startDaily(a[0]); return true;
      case 'toast': toast(a[0]); return true;
      case 'has': return has(G.dict, a[0]);
      case 'b3': return B3.debug ? B3.debug() : null;
      case 'renderSfx': {
        // render one sound offline and measure it (nobody can listen in a test run)
        const prev = { ctx: audio.ctx, on: audio.on, vol: audio.vol };
        const off = new OfflineAudioContext(1, 44100 * 2, 44100);
        audio.ctx = off; audio.on = true; audio.vol = a[1] ?? 0.35;
        sfx(a[0]);
        const buf = await off.startRendering();
        Object.assign(audio, prev);
        const d = buf.getChannelData(0);
        let peak = 0, sum = 0, last = 0;
        for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; sum += d[i] * d[i]; if (v > 0.001) last = i; }
        return { peak: +peak.toFixed(3), rms: +Math.sqrt(sum / d.length).toFixed(4), ms: Math.round(last / 44.1) };
      }
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

wireStatic();
boot();

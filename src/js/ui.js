// HTML for screens, dialogs and panels. Pure string templates; main.js wires the events.
import { PERSONAS, persona, LEVEL_NAME, LEVEL_BLURB, seatLevel, HUMAN_COLORS } from './personas.js';
import { SHORT } from './voices.js';
import { TILES, BLANKS } from './tiles.js';
import { N, FULL_SOAK, FEATURED_BONUS, ROW_BONUS, explainWord } from './score.js';
import { DAILY_TURNS, unseen } from './engine.js';
import { art } from './art.js';
import { hintsUsed } from './stats.js';

export function qs(s, el = document) { return el.querySelector(s); }
const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function esc(t) { return String(t).replace(/[&<>"']/g, (c) => ENTITIES[c]); }
export function plural(n, w, ws) { return `${n} ${n === 1 ? w : ws || w + 's'}`; }

export const ICON = {
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  sound: (on) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>${on ? '<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>' : '<path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'}</svg>`,
  shuffle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h4l10 10h4M3 17h4l3-3m4-4 3-3h4M18 4l3 3-3 3M18 14l3 3-3 3" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  recall: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  swap: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v14m0 0-3-3m3 3 3-3M17 20V6m0 0-3 3m3-3 3 3" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  pass: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h12m-4-5 5 5-5 5" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  hint: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3zM9.5 19h5M10.5 21.5h3" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  zoomOut: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M7.5 10.5h6M15.5 15.5 20 20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  steam: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 20c-2-3 2-5 0-8s2-5 0-8M12 20c-2-3 2-5 0-8s2-5 0-8M16 20c-2-3 2-5 0-8s2-5 0-8" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
  cat: {
    drop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c3 4.5 6 7.6 6 11a6 6 0 0 1-12 0c0-3.4 3-6.5 6-11z" fill="currentColor"/></svg>',
    arch: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M11.4 2.5h1.2v2.6a4.6 4.6 0 0 1 4.2 4.3H7.2a4.6 4.6 0 0 1 4.2-4.3zM2.6 10.4h18.8v1.4h-1v9.4H3.6v-9.4h-1zM9.6 21.2v-4.6a2.4 2.4 0 0 1 4.8 0v4.6z"/></svg>',
    leaf: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15m0-1 8-8" fill="currentColor" stroke="currentColor" stroke-width="1"/></svg>',
    horseshoe: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V11a6 6 0 0 1 12 0v10h-3V11a3 3 0 0 0-6 0v10z" fill="currentColor"/></svg>',
    dice: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="3.5" fill="currentColor"/><g fill="#fff"><circle cx="8.5" cy="8.5" r="1.6"/><circle cx="15.5" cy="15.5" r="1.6"/><circle cx="12" cy="12" r="1.6"/></g></svg>',
    bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a6 6 0 0 0-6 6v5l-2 3h16l-2-3V9a6 6 0 0 0-6-6zm-2 16a2 2 0 0 0 4 0z" fill="currentColor"/></svg>',
  },
};

// A round monogram badge for a seat: persona colour or seat colour, initials, seat number.
export function badge(p, k, size = 40) {
  const per = p.persona ? persona(p.persona) : null;
  const color = per ? per.color : HUMAN_COLORS[k % HUMAN_COLORS.length];
  const face = per && art.has('face-' + per.id) ? `<img src="${art.src('face-' + per.id)}" alt="" width="${size}" height="${size}">` : '';
  const pm = !per && /^Player\s+(\d+)$/i.exec((p.name || '').trim());
  const initials = pm ? `P${pm[1]}` : (p.name.replace(/["“”]/g, '').match(/\b[A-Z]/g) || ['?']).slice(0, 2).join('');
  return `<span class="badge${face ? ' has-face' : ''}" style="--c:${color};--s:${size}px" aria-hidden="true">${face || `<b>${esc(initials)}</b>`}<i>${k + 1}</i></span>`;
}

// shown where progress would be kept, when the browser will not store anything (a private window, blocked site data)
export const NO_SAVE = 'Saving is blocked in this browser, so your progress will not be kept.';
export const NEWER_SAVE = 'This visit is not being saved: your saved game comes from a newer version of Bathhouse Letters, and it is left as it is.';

// the painted band at the head of a sheet, the same picture as the results screen's, so every screen opens like the title
const band = () => (art.has('title') ? `<div class="sheet-art" style="background-image:url(${art.src('title')})" aria-hidden="true"></div>` : '');
// a character's round portrait (the painted face, or the monogram when the painting is not there)
function portrait(per, size) {
  const face = art.has('face-' + per.id) ? `<img src="${art.src('face-' + per.id)}" alt="" width="${size}" height="${size}">` : `<b>${esc((per.name.replace(/["“”]/g, '').match(/[A-Z]/g) || ['?']).slice(0, 2).join(''))}</b>`;
  return `<span class="badge" style="--c:${per.color};--s:${size}px" aria-hidden="true">${face}</span>`;
}

// ---------- title ----------
export function titleHtml(o) {
  const hasArt = art.has('title');
  return `<div class="title ${hasArt ? 'painted' : ''}">
    <div class="title-card">
      ${hasArt ? `<img class="title-art" src="${art.src('title')}" alt="Bathhouse Row at sunset: bronze eagles on the gate piers and the tiled dome beyond">` : '<div class="title-art vector" aria-hidden="true"></div>'}
      <div class="title-words">
        <p class="kicker">A Hot Springs word game</p>
        <h1>Bathhouse<br><span>Letters</span></h1>
        <p class="tag">Build words. Find the springs.</p>
      </div>
    </div>
    ${o.noSave ? `<p class="storage-note" role="status">${NO_SAVE}</p>` : o.newerSave ? `<p class="storage-note" role="status">${NEWER_SAVE}</p>` : ''}
    <nav class="menu" aria-label="Main menu">
      ${o.canContinue ? `<button class="btn primary" data-go="continue">Continue <small>${esc(o.continueLine)}</small></button>` : ''}
      <button class="btn ${o.canContinue ? '' : 'primary'}" data-go="setup">New game</button>
      <button class="btn" data-go="daily">Daily Soak <small>${esc(o.dailyLine)}</small></button>
      <button class="btn" data-go="register">Bathhouse Register <small>${o.found} of ${o.total} words found</small></button>
      <button class="btn" data-go="records">Records <small>${esc(o.records)}</small></button>
      <div class="row2"><button class="btn quiet" data-go="help">How to play</button><button class="btn quiet" data-go="settings">Settings</button></div>
      <button class="btn link" data-go="about">About &amp; sources</button>
    </nav>
    ${o.loading ? '<p class="loading" role="status">Warming the springs…</p>' : ''}
  </div>`;
}

// ---------- setup ----------
export function setupHtml(setup) {
  const seat = (st, k) => {
    const human = st.kind === 'human';
    return `<li class="seat" data-k="${k}">
      ${badge(human ? { name: st.name || `Player ${k + 1}` } : { name: persona(st.persona).name, persona: st.persona }, k, 44)}
      <div class="seat-main">
        <div class="seg" role="radiogroup" aria-label="Seat ${k + 1} player">
          <button role="radio" aria-checked="${human}" data-kind="human" data-k="${k}">Person</button>
          <button role="radio" aria-checked="${!human}" data-kind="ai" data-k="${k}">Computer</button>
        </div>
        ${human
          ? `<label class="field"><span>Name</span><input data-name="${k}" value="${esc(st.name || '')}" maxlength="16" placeholder="Player ${k + 1}" autocomplete="off"></label>`
          : `<div class="field"><span id="opp-${k}">Opponent <em>(fictional character)</em></span><div class="opps" role="radiogroup" aria-labelledby="opp-${k}">${PERSONAS.map((p) => `<button type="button" class="opp" role="radio" aria-checked="${p.id === st.persona}" tabindex="${p.id === st.persona ? 0 : -1}" data-persona="${k}" data-val="${p.id}">${portrait(p, 44)}<b>${esc(p.name)}</b><small>${esc(p.role)}</small><em>Usually ${LEVEL_NAME[p.level]}</em></button>`).join('')}</div></div>
             <p class="seat-note">${esc(persona(st.persona).role)}. ${esc(persona(st.persona).line)}</p>
             <label class="field"><span>Difficulty</span><select data-level="${k}">${Object.keys(LEVEL_NAME).map((l) => `<option value="${l}" ${l === seatLevel(st) ? 'selected' : ''}>${LEVEL_NAME[l]}</option>`).join('')}</select></label>
             <p class="seat-note" data-level-note="${k}">${esc(LEVEL_BLURB[seatLevel(st)])}</p>`}
      </div>
      ${setup.seats.length > 2 ? `<button class="iconbtn small" data-remove="${k}" aria-label="Remove seat ${k + 1}">${ICON.close}</button>` : ''}
    </li>`;
  };
  const humans = setup.seats.filter((s) => s.kind === 'human').length;
  return `<div class="sheet setup">
    ${band()}
    <header class="sheet-head"><h1 tabindex="-1">New game</h1><button class="iconbtn" data-go="title" aria-label="Back to the title screen">${ICON.close}</button></header>
    <ol class="seats">${setup.seats.map(seat).join('')}</ol>
    ${setup.seats.length < 4 ? '<button class="btn quiet add" data-add>Add a player</button>' : ''}
    <label class="check"><input type="checkbox" data-hints ${setup.hints ? 'checked' : ''}> Spring Guide hints</label>
    <label class="field hint-allow"><span>Hints for each player</span><select data-hints-unl ${setup.hints ? '' : 'disabled'}><option value="3" ${setup.hintsUnl ? '' : 'selected'}>Three</option><option value="unl" ${setup.hintsUnl ? 'selected' : ''}>Unlimited (a game with hints sets no personal best)</option></select></label>
    <label class="check"><input type="checkbox" data-challenge ${setup.challenge ? 'checked' : ''}> Challenge mode: invalid words cost your turn</label>
    <p class="seat-note">Off by default. When it is on, the board stops saying whether a word is in the dictionary: play one that is not and you lose the turn, like a pass.</p>
    <p class="goal"><b>The goal:</b> score more than the others by building words.</p>
    <p class="note">${humans >= 2 ? 'Pass and play: each person\'s tiles stay hidden until they tap to take their turn.' : humans === 1 ? 'You against the computer.' : 'Computers only: sit back and watch.'}</p>
    <button class="btn primary big" data-start>Start</button>
    <button class="btn link" data-go="help">How to play</button>
  </div>`;
}

// ---------- game panels ----------
// How a staged play adds up, word by word (the preview strip opens it): letters with the multiplier they earned,
// the word multiplier, then the Hot Springs, Featured and Full Soak extras. `board` is the board without the staged tiles.
export function breakdownHtml(p, board, staged) {
  const add = new Map(staged.map((t) => [t.i, { l: t.l, blank: t.blank }]));
  const rows = p.words.map((w) => {
    const x = explainWord(board, add, w);
    const sum = x.parts.map((q) => `${q.l} ${q.v}${q.lm > 1 ? `×${q.lm}` : ''}`).join(' + ');
    return `<li><b>${esc(w.w)}</b> <span>${sum} = ${x.sum}${x.wm > 1 ? `, word ×${x.wm} = ${x.total}` : ''}</span></li>`;
  });
  for (const w of p.words) if (w.bonus) rows.push(`<li><b>Hot Springs</b> <span>${esc(w.w)} +${w.bonus}${w.bath ? ` (${w.bonus - ROW_BONUS} for the word, ${ROW_BONUS} for a Bathhouse Row square)` : ''}</span></li>`);
  if (p.featured) rows.push(`<li><b>Featured Spring</b> <span>${esc(p.featured)} +${FEATURED_BONUS}</span></li>`);
  if (p.full) rows.push(`<li><b>Full Soak</b> <span>all seven tiles +${FULL_SOAK}</span></li>`);
  return `<div class="bd" role="region" aria-label="How this play scores"><ul>${rows.join('')}<li class="tot"><b>Total</b> <span>${p.score} points</span></li></ul></div>`;
}

export function scoresHtml(s, compact) {
  const showTiles = s.mode !== 'daily' && s.bag.length === 0;
  return s.players.map((p, k) => {
    const per = p.persona ? persona(p.persona) : null;
    const active = !s.over && k === s.cur;
    const sub = per ? `${LEVEL_NAME[p.level || per.level]} · fictional` : (p.kind === 'human' ? 'Person' : '');
    const n = showTiles && Array.isArray(p.rack) ? p.rack.length : null;
    const tileLabel = n != null ? plural(n, 'tile') : '';
    const lowCls = n === 1 ? ' low' : '';
    return compact
      ? `<div class="chip ${active ? 'on' : ''}" aria-current="${active}" aria-label="${esc(p.name)}: ${p.score} points${n != null ? `, ${tileLabel} left` : ''}${active ? ', current turn' : ''}">${badge(p, k, 26)}<span class="sr-only">${esc(p.name)} </span><b class="score" data-score="${k}">${p.score}</b>${n != null ? `<span class="ctiles${lowCls}" data-tiles="${k}" aria-hidden="true">${tileLabel}</span>` : ''}</div>`
      : `<div class="pcard ${active ? 'on' : ''}" aria-current="${active}">${badge(p, k, 44)}<div class="pmeta"><b>${esc(p.name)}</b><small>${esc(sub)}</small>${n != null ? `<span class="ptiles${lowCls}" data-tiles="${k}">${tileLabel}</span>` : ''}</div><b class="score" data-score="${k}">${p.score}</b></div>`;
  }).join('');
}

const CAT_SHORT = { baths: 'Row', springs: 'Springs', park: 'Park', track: 'Track', club: 'Club', town: 'Town' };
const ownerShort = (p) => (p && p.persona && SHORT[p.persona]) || (p ? p.name.split(' ')[0] : '');

export function springsHtml(s, lex, compact, open = false) {
  const renderPlaque = (f, k) => {
    const cat = lex.categories[f.cat];
    const shortCat = CAT_SHORT[f.cat] || cat.name;
    const claimed = f.by != null;
    const letters = [...f.word].map((ch, j) => (claimed || f.shown.includes(j) ? `<b>${ch}</b>` : '<b class="fog" aria-hidden="true"></b>')).join('');
    const label = claimed ? `${f.word}, found by ${s.players[f.by].name}` : `${f.word.length} letters, ${cat.name}: ${[...f.word].map((ch, j) => (f.shown.includes(j) ? ch : 'blank')).join(' ')}`;
    return `<button type="button" class="plaque ${claimed ? 'claimed' : ''}" data-plaque="${k}" aria-label="Featured Spring ${k + 1}: ${esc(label)}" title="${esc(cat.name)}">
      <span class="pcat">${ICON.cat[cat.icon]}<span class="pcat-name">${esc(shortCat)}</span></span><span class="pword">${letters}</span>${claimed ? `<span class="pby">${esc(ownerShort(s.players[f.by]))}</span>` : ''}</button>`;
  };
  const list = s.featured.map(renderPlaque).join('');
  if (!compact) {
    return `<h2 class="springs-title"><span>Featured Springs</span> <small>+${FEATURED_BONUS} each · a letter clears every round</small></h2><div class="plaques">${list}</div>`;
  }
  const claimedCount = s.featured.filter((f) => f.by != null).length;
  const active = s.featured.filter((f) => f.by == null);
  const lead = (active.length ? active.slice().sort((a, b) => (b.shown.length / b.word.length) - (a.shown.length / a.word.length))[0] : s.featured[0]) || null;
  let preview = '';
  if (lead) {
    const cat = lex.categories[lead.cat];
    const shortCat = CAT_SHORT[lead.cat] || cat.name;
    const claimed = lead.by != null;
    const letters = [...lead.word].map((ch, j) => (claimed || lead.shown.includes(j) ? `<b>${ch}</b>` : '<b class="fog" aria-hidden="true"></b>')).join('');
    preview = active.length
      ? `<span class="sbar-preview" aria-hidden="true"><span class="pcat">${ICON.cat[cat.icon]}<span class="pcat-name">${esc(shortCat)}</span></span><span class="pword">${letters}</span></span>`
      : '<span class="sbar-preview sbar-done" aria-hidden="true">All 3 found</span>';
  }
  const summary = `Featured Springs, ${claimedCount} of ${s.featured.length} found, +${FEATURED_BONUS} each. ${open ? 'Hide plaques.' : 'Show all three plaques.'}`;
  return `<button type="button" class="springs-bar" data-springs-toggle aria-expanded="${!!open}" aria-controls="springs-tray" aria-label="${esc(summary)}">
    <span class="sbar-meta"><b>Featured</b><small>${claimedCount}/${s.featured.length} · +${FEATURED_BONUS}</small></span>${preview}<span class="sbar-chev" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
  </button><div id="springs-tray" class="plaques springs-drawer"${open ? '' : ' hidden'}><p class="springs-title"><span>Featured Springs</span> <small>+${FEATURED_BONUS} each · a letter clears every round</small></p>${list}</div>`;
}

export function actionsHtml(o) {
  const b = (id, icon, text, key, extra = '') => `<button class="abtn ${id}" data-act="${id}" ${extra}>${icon}<span>${text}</span>${key ? `<kbd>${key}</kbd>` : ''}</button>`;
  const slot1 = o.mobile
    ? (o.staged ? b('recall', ICON.recall, 'Recall', 'Esc') : b('shuffle', ICON.shuffle, 'Shuffle', '⇧R'))
    : b('shuffle', ICON.shuffle, 'Shuffle', '⇧R');
  const slot2 = o.mobile ? '' : b('recall', ICON.recall, 'Recall', 'Esc', o.staged ? '' : 'disabled');
  const playText = o.canPlay && o.playScore != null ? `Play <em class="play-pts">+${o.playScore}</em>` : 'Play';
  return [
    slot1,
    slot2,
    b('swap', ICON.swap, 'Swap', '⇧S', o.canSwap ? '' : 'disabled'),
    b('pass', ICON.pass, 'Pass', '⇧P'),
    o.hints != null ? b('hint', ICON.hint, `Hint <em>${o.unlimited ? '∞' : o.hints}</em>`, '⇧H', o.hints > 0 || o.unlimited ? '' : 'disabled') : '',
    b('play', ICON.play, playText, 'Enter', o.canPlay ? '' : 'aria-disabled="true"'),
  ].join('');
}

export function logHtml(s, lex) {
  return s.log.slice().reverse().filter((e) => e.kind !== 'end').slice(0, 40).map((e) => {
    const p = s.players[e.p];
    if (e.kind === 'play') {
      const ws = e.words.map((w) => (w.themed
        ? `<button type="button" class="themed-link" data-fact="${esc(w.themed)}" data-form="${esc(w.w)}" aria-label="${esc(w.w)}, Hot Springs word: read its history card">${ICON.steam}<span>${esc(w.w)}</span></button>`
        : `<span>${esc(w.w)}</span>`)).join(', ');
      const extras = [e.full ? `Full Soak +${FULL_SOAK}` : '', e.themed ? `Hot Springs +${e.themed}` : '', e.featured ? `Featured +${FEATURED_BONUS}` : ''].filter(Boolean).join(' · ');
      return `<li><b class="who">${esc(p.name)}</b> ${ws} <em>${e.score}</em>${extras ? `<small>${extras}</small>` : ''}</li>`;
    }
    return `<li><b class="who">${esc(p.name)}</b> ${e.kind === 'swap' ? `swapped ${plural(e.count, 'tile')}` : 'passed'}${e.challenge ? ` <small>(${esc(e.challenge)} is not a word)</small>` : ''}</li>`;
  }).join('');
}

// ---------- dialogs ----------
export function factHtml(entry, lex, form, extra = '') {
  const cat = lex.categories[entry.cat];
  const tier = lex.data.tiers[entry.tier];
  const pic = [VIGNETTE[entry.id], 'card-' + entry.id, 'card-' + entry.cat].find((n) => n && art.has(n));
  const vig = pic ? `<img class="vig" src="${art.src(pic)}" alt="">` : `<div class="vig vector cat-${entry.cat}" aria-hidden="true">${ICON.cat[cat.icon]}</div>`;
  const src = entry.fact.url ? `<a href="${esc(entry.fact.url)}" target="_blank" rel="noopener noreferrer">${esc(entry.fact.src)}</a>` : esc(entry.fact.src);
  return `<div class="card fact" role="document">
    ${vig}
    <div class="fact-body">
      <p class="fact-cat">${ICON.cat[cat.icon]} <span>${esc(cat.name)}</span><b class="fact-pts">+${tier}</b></p>
      <h2>${esc(form || entry.forms[0])}</h2>
      <p class="fact-text">${esc(entry.fact.text)}</p>
      <p class="fact-src">Source: ${src}</p>
      ${extra}
    </div>
  </div>`;
}
// Landmark vignettes (painted for Bathhouse Barons, same collection, MIT) that suit a word's fact.
export const VIGNETTE = {
  bathhouse: 'vig-freebath', skylight: 'vig-fordyce', fountain: 'vig-fordyce', statue: 'vig-fordyce', museum: 'vig-fordyce',
  massage: 'vig-buckstaff', tub: 'vig-buckstaff', soak: 'vig-hale', travertine: 'vig-hale', hotel: 'vig-eastman', alligator: 'vig-gators',
  gator: 'vig-gators', farm: 'vig-gators', ostrich: 'vig-ostrich', zoo: 'vig-iqzoo', chicken: 'vig-iqzoo', ballpark: 'vig-whittington',
  homer: 'vig-whittington', baseball: 'vig-fogel', railroad: 'vig-railroad', train: 'vig-railroad', tower: 'vig-tower', mountain: 'vig-tower',
  casino: 'vig-southern', glass: 'vig-southern', poker: 'vig-southern', club: 'vig-ohio', craps: 'vig-vapors', gangster: 'vig-arlington',
  radio: 'vig-arlington', water: 'vig-watertax', fire: 'vig-waterco', spring: 'vig-fordyce',
};

export function swapHtml(rack) {
  return `<div class="card dialog swap" role="dialog" aria-modal="true" aria-labelledby="swap-h">
    <h2 id="swap-h">Swap tiles</h2>
    <p>Choose the tiles to put back. You draw the same number, and your turn ends.</p>
    <div class="swap-tiles" role="group" aria-label="Your tiles">${rack.map((l, k) => `<button class="stile" data-sw="${k}" aria-pressed="false" aria-label="${l === '?' ? 'Blank' : l}">${l === '?' ? '' : l}</button>`).join('')}</div>
    <div class="dlg-btns"><button class="btn quiet" data-close>Cancel</button><button class="btn primary" data-swap-go disabled>Swap</button></div>
  </div>`;
}

export function blankHtml() {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return `<div class="card dialog blank" role="dialog" aria-modal="true" aria-labelledby="blank-h">
    <h2 id="blank-h">Steam tile</h2><p>Which letter should the blank tile be? It scores no points.</p>
    <div class="letters">${[...A].map((l) => `<button class="stile" data-letter="${l}">${l}</button>`).join('')}</div>
    <div class="dlg-btns"><button class="btn quiet" data-close>Cancel</button></div>
  </div>`;
}

export function pauseHtml(o) {
  return `<div class="card dialog pause" role="dialog" aria-modal="true" aria-labelledby="pause-h">
    ${band()}
    <h2 id="pause-h">Paused</h2>
    <nav class="menu">
      <button class="btn primary" data-close>Resume</button>
      <button class="btn" data-open="ledger">Steam ledger</button>
      <button class="btn" data-open="boardtext">Read the board</button>
      ${o.tracker ? '<button class="btn" data-open="tracker">Unseen tiles</button>' : ''}
      <button class="btn" data-go="help">How to play</button>
      <button class="btn" data-go="settings">Settings</button>
      <button class="btn quiet" data-go="title">Save and quit to title</button>
    </nav>
  </div>`;
}

export function ledgerHtml(s, lex) {
  return `<div class="card dialog ledger-dlg" role="dialog" aria-modal="true" aria-labelledby="ledger-h"><h2 id="ledger-h">Steam ledger</h2><ol class="log">${logHtml(s, lex) || '<li>No plays yet.</li>'}</ol><div class="dlg-btns"><button class="btn primary" data-close>Close</button></div></div>`;
}

// The board as words (S2-08), for a screen reader: a square is its column letter and row number (H8 is the centre), and a tile
// is read as the letter on it. `staged` are the player's tiles not yet played.
export const squareName = (i) => `${'ABCDEFGHIJKLMNO'[i % N]}${Math.floor(i / N) + 1}`;
export function tileSpeech(s, staged, i) {
  const t = s.board[i], st = staged.find((x) => x.i === i);
  if (t) return `tile ${t.l}${t.blank ? ', a blank' : ''}`;
  return st ? `your tile ${st.l}${st.blank ? ', a blank' : ''}, not played yet` : 'empty';
}
export function boardTextHtml(s, staged) {
  const rows = [];
  for (let r = 0; r < N; r++) {
    const bits = [];
    for (let c = 0; c < N; c++) { const i = r * N + c, t = s.board[i] || staged.find((x) => x.i === i); if (t) bits.push(`${squareName(i)} ${t.l}${s.board[i] ? '' : ' (not played yet)'}`); }
    rows.push(`<li><b>Row ${r + 1}:</b> ${bits.length ? bits.join(', ') : 'empty'}</li>`);
  }
  return `<div class="card dialog boardtext" role="dialog" aria-modal="true" aria-labelledby="bt-h"><h2 id="bt-h">The board, as text</h2>
    <p>Columns run A to O and rows 1 to 15, so H8 is the centre square. Only squares with a tile are listed.</p>
    <ul class="log">${rows.join('')}</ul>
    <div class="dlg-btns"><button class="btn quiet" data-open="pause">Back</button><button class="btn primary" data-close>Close</button></div></div>`;
}

// The tile tracker: every letter the player cannot see, from the engine's own count (the bag and the other racks).
export function trackerHtml(s, seat) {
  const left = unseen(s, seat), total = Object.values(left).reduce((a, n) => a + n, 0);
  const chip = (l, label, value) => { const n = left[l] || 0; return `<span class="tchip tk${n ? '' : ' out'}" aria-label="${label}: ${n} unseen"><b>${l === '?' ? '' : l}</b>${l === '?' ? '<i>blank</i>' : `<i>${value}</i>`}<small>×${n}</small></span>`; };
  return `<div class="card dialog tracker" role="dialog" aria-modal="true" aria-labelledby="tk-h"><h2 id="tk-h">Unseen tiles</h2>
    <p>${plural(total, 'tile')} you cannot see: the bag and ${s.players.length > 1 ? 'the other racks' : 'nothing else'}. The small figure is each letter's points.</p>
    <div class="tchips">${Object.keys(TILES).map((l) => chip(l, l, TILES[l].value)).join('')}${chip('?', 'Blank', 0)}</div>
    <div class="dlg-btns"><button class="btn quiet" data-open="pause">Back</button><button class="btn primary" data-close>Close</button></div></div>`;
}

export function privacyHtml(p, k) {
  return `<div class="privacy-card">${badge(p, k, 64)}<h2 id="priv-h">${esc(p.name)}'s turn</h2><p>Pass the device to ${esc(p.name)}. Tiles stay hidden until you tap.</p><button class="btn primary big" data-reveal>Show my tiles</button></div>`;
}

// ---------- help ----------
// A play drawn on a strip of the board: FIND across a Warm square (the I counts double) and a Steam square (the word counts double).
function workedExample() {
  const cells = [['F', ''], ['I', 'w'], ['N', ''], ['D', 's']];
  const parts = cells.map(([l, q]) => TILES[l].value * (q === 'w' ? 2 : 1));
  const sum = parts.reduce((a, b) => a + b, 0), total = sum * 2;
  const label = `FIND laid across four squares: the I on a Warm square, the D on a Steam square. ${cells.map(([l, q]) => `${l} ${TILES[l].value}${q === 'w' ? ' doubled' : ''}`).join(', ')}, then the word doubled: ${total} points.`;
  return `<div class="example"><div class="eg" role="img" aria-label="${label}">${cells.map(([l, q]) => `<span class="eg-cell"><span class="tchip"><b>${l}</b><i>${TILES[l].value}</i></span>${q ? `<span class="sq sq-${q}${q === 's' ? ' word' : ''}" aria-hidden="true"><i>×2</i></span>` : '<span class="sq-none" aria-hidden="true"></span>'}</span>`).join('')}</div>
    <p><b>A worked play.</b> FIND scores ${parts.join(' + ')} = ${sum}. The Steam square then doubles the whole word: <b>${total} points</b>.</p></div>`;
}

// Bathhouse Row octagonal painted medallion swatch matching the board's dark-espresso/gold bezel + '+20' pip (W2-S5-08 / CD-WF2-01).
export function bathMedallionHtml(name = 'Fordyce', pip = true) {
  const key = 'bath-' + String(name).toLowerCase();
  const inner = art.has(key)
    ? `<img class="row-med" src="${art.src(key)}" alt="">`
    : `<span class="row-fallback">${ICON.cat.arch}</span>`;
  return `<span class="row-bez"><span class="row-dark"><span class="row-rim"><span class="row-win">${inner}</span></span></span></span>${pip ? `<b class="row-pip">+${ROW_BONUS}</b>` : ''}`;
}

export function helpHtml(tab, lex, twos = []) {
  const tierList = Object.values(lex.data.tiers).join(' / ');
  const tabs = [['rules', 'How to play'], ['squares', 'Squares and scoring'], ['words', 'Hot Springs words'], ['keys', 'Controls']];
  const tileRow = Object.entries(TILES).map(([l, t]) => `<span class="tchip"><b>${l}</b><i>${t.value}</i><small>×${t.count}</small></span>`).join('');
  const body = {
    rules: `<p class="goal"><b>The goal:</b> finish with more points than the others by building words on the board, and find the town's words for bonuses.</p>
      <h2>Your turn</h2>
      <p>Each player holds seven tiles. On your turn, either <b>play</b> tiles to make words, <b>swap</b> tiles with the bag, or <b>pass</b>.</p>
      <ol class="steps">
        <li>Lay one or more tiles in a single row or a single column, with no empty squares between them.</li>
        <li>The first word of the game must cover the <b>Display Spring</b> at the centre and use at least two tiles.</li>
        <li>After that, every play must touch tiles already on the board.</li>
        <li>Every run of two or more tiles your play creates, across and down, must be a word. You score all of them.</li>
        <li>Draw back up to seven tiles from the bag.</li>
      </ol>
      ${workedExample()}
      <p>Words come from the public-domain ENABLE list (168,000 words; no proper nouns) with a few additions: the two-letter words below and some everyday ones such as EMAIL, APP and BLOG. A play with a word that isn't on the list is handed back and you keep your turn (unless you chose Challenge mode in the setup: then the strip does not say whether a word is valid, and a word that isn't on the list costs you the turn). While you place tiles, the strip under the board shows the words, the score and any bonus.</p>
      <p>Stuck? The <b>Spring Guide</b> (Hint) sets a strong play on the board for you to keep, move or take back. <b>Other plays</b> under the board shows its next two choices, and the tiles each one keeps, for no extra charge. Three hints per player in a game against the computer or pass-and-play (or unlimited, if you choose that in the setup; such a game sets no personal best), none in the Daily Soak.</p>
      ${twos.length ? `<h2>Two-letter words</h2>
      <p>All ${twos.length} of these are playable. QI and ZA help when you are holding a lone Q or Z.</p>
      <p class="twos">${twos.join(' ')}</p>` : ''}
      <h2>Check a word</h2>
      <form class="wordcheck" data-wordcheck novalidate>
        <label for="wc-in">Is it playable? Type a word to check it against the dictionary.</label>
        <div class="wc-row"><input id="wc-in" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="15" aria-describedby="wc-out"><button class="btn" type="submit">Check</button></div>
        <p class="wc-out" id="wc-out" role="status" aria-live="polite"></p>
      </form>
      <h2>The end</h2>
      <p>The game ends when a player uses their last tile and the bag is empty, or when everyone has passed or swapped twice in a row. Tiles left on a rack count against their owner; whoever went out collects their value.</p>
      <p class="fine">Bathhouse Letters is an original game. Its board, tiles, bonuses and rules are game logic made for this town; the facts on its cards are history, with sources.</p>`,
    squares: `<h2>The springs</h2>
      <p>The board has one square for each of the valley's 47 hot springs, as Wikipedia counts them: the <b>Display Spring</b> in the centre and 46 premium squares that swirl out from it. A premium counts only on the turn a tile first covers it. A <b>cream disc</b> multiplies a letter; a <b>dark disc</b> multiplies the whole word.</p>
      <ul class="legend">
        <li><span class="sq sq-w"><i>×2</i></span><span><b>Warm</b> doubles the letter on it.</span></li>
        <li><span class="sq sq-h"><i>×3</i></span><span><b>Hot</b> triples the letter on it.</span></li>
        <li><span class="sq sq-s word"><i>×2</i></span><span><b>Steam</b> doubles the whole word.</span></li>
        <li><span class="sq sq-b word"><i>×3</i></span><span><b>Boiling Spring</b> triples the whole word.</span></li>
        <li><span class="sq sq-B" aria-hidden="true">${bathMedallionHtml('Fordyce', true)}</span><span><b>Bathhouse Row</b>: eight squares named for the eight historic bathhouses. A Hot Springs word that covers one earns ${ROW_BONUS} more.</span></li>
      </ul>
      <h2>Bonuses</h2>
      <ul class="legend plain">
        <li><b>Full Soak +${FULL_SOAK}</b>: use all seven tiles in one turn.</li>
        <li><b>Hot Springs word +${tierList}</b>: any word you form that belongs to the town (see the next tab).</li>
        <li><b>Featured Spring +${FEATURED_BONUS}</b>: three secret words per game, hidden in steam on the plaques. A letter clears every round. The first to form one claims it.</li>
      </ul>
      <h2>The tiles</h2>
      <p>${TILES ? Object.values(TILES).reduce((a, t) => a + t.count, 0) : 0} lettered tiles and ${BLANKS} blank <b>Steam tiles</b>, which stand for any letter and score nothing. Counts and points were worked out from how often each letter appears in playable words.</p>
      <div class="tchips">${tileRow}</div>`,
    words: `<h2>Hot Springs words</h2>
      ${art.has('card-baths') ? `<img class="help-vig" src="${art.src('card-baths')}" alt="A bathhouse hall with a marble fountain, steam and a stained-glass dome">` : ''}
      <p>${lex.data.words.length} groups of everyday words belong to the town: <b>spring</b>, <b>steam</b>, <b>bathhouse</b>, <b>tufa</b>, <b>novaculite</b>, <b>derby</b>, <b>magnolia</b> and more. Form one, across or down, and it pays a bonus (+${tierList}) and opens a card from the town's history, with its source.</p>
      <p class="note">Browse the six themes below to see which word families earn bonuses. Plurals and common forms count too; each word's history card stays unspoiled until you play it.</p>
      <div class="word-ref">${Object.entries(lex.categories).map(([k, c]) => {
        const entries = lex.data.words.filter((w) => w.cat === k);
        const byTier = [1, 2, 3].map((tr) => {
          const list = entries.filter((e) => e.tier === tr).map((e) => e.forms[0]).sort();
          return list.length ? `<div class="tier-row"><span class="tier-pts">+${lex.data.tiers[tr]}</span><span class="tier-words">${list.map((w) => esc(w)).join(' · ')}</span></div>` : '';
        }).join('');
        return `<details class="cat-ref" data-cat-ref="${esc(k)}"><summary><span class="cat-ic">${ICON.cat[c.icon]}</span><b>${esc(c.name)}</b><small>${entries.length} word families</small></summary><div class="cat-ref-body">${byTier}</div></details>`;
      }).join('')}</div>
      <p>Every word you find goes into your <b>Bathhouse Register</b>, from the title screen. You can toggle the subtle rack cue in <b>Settings</b>.</p>`,
    keys: `<h2>Mouse and touch</h2>
      <ul class="legend plain"><li>Drag a tile from your rack to the board, or tap a tile and then tap a square.</li><li>Tap a tile you've placed to take it back, or drag it somewhere else.</li><li>On a phone the tile floats above your finger, and the square it will land on lights up. Pinch to zoom if you like.</li></ul>
      <h2>Keyboard</h2>
      <ul class="keys"><li><kbd>←↑→↓</kbd> move the cursor</li><li><kbd>A</kbd>–<kbd>Z</kbd> place that letter from your rack (with none left, press it twice to use your blank)</li><li><kbd>Space</kbd> switch between across and down</li><li><kbd>Backspace</kbd> take back the last tile</li><li><kbd>Enter</kbd> place a selected rack tile at the cursor, or play (with a button focused, <kbd>Enter</kbd> or <kbd>Space</kbd> presses that button instead)</li><li><kbd>Alt</kbd>+<kbd>←→</kbd> on a focused rack tile: move it left or right on your rack</li><li><kbd>+</kbd> / <kbd>-</kbd> / <kbd>0</kbd> zoom in, zoom out, or show the whole board</li><li><kbd>Esc</kbd> take back all tiles</li><li><kbd>Shift</kbd>+<kbd>R</kbd> shuffle the tiles still on your rack</li><li><kbd>Shift</kbd>+<kbd>S</kbd> swap · <kbd>Shift</kbd>+<kbd>P</kbd> pass · <kbd>Shift</kbd>+<kbd>H</kbd> hint</li><li><kbd>Shift</kbd>+<kbd>B</kbd> how the placed tiles score (or tap the strip under the board)</li><li><kbd>Space</kbd> or <kbd>Enter</kbd>, or a tap on the board, while the computer is playing: let its move land at once</li><li><kbd>?</kbd> help · <kbd>Esc</kbd> menu (when nothing is placed)</li></ul>`,
  }[tab];
  return `<div class="sheet help">
    ${band()}
    <header class="sheet-head"><h1 tabindex="-1">How to play</h1><button class="iconbtn" data-back aria-label="Close">${ICON.close}</button></header>
    <div class="tabs" role="tablist">${tabs.map(([k, t]) => `<button role="tab" aria-selected="${k === tab}" data-tab="${k}">${t}</button>`).join('')}</div>
    <div class="help-body" role="tabpanel">${body}</div>
  </div>`;
}

// ---------- settings ----------
export function settingsHtml(st, canVibrate = false) {
  const seg = (key, opts, label) => `<div class="setrow"><span>${label}</span><div class="seg" role="radiogroup" aria-label="${label}">${opts.map(([v, t]) => `<button role="radio" aria-checked="${st[key] === v}" data-set="${key}" data-val="${v}">${t}</button>`).join('')}</div></div>`;
  return `<div class="sheet settings">
    ${band()}
    <header class="sheet-head"><h1 tabindex="-1">Settings</h1><button class="iconbtn" data-back aria-label="Close">${ICON.close}</button></header>
    ${seg('sound', [[true, 'On'], [false, 'Off']], 'Sound')}
    ${seg('fx', [[true, 'On'], [false, 'Off']], 'Sound effects')}
    ${seg('music', [[true, 'On'], [false, 'Off']], 'Music')}
    ${seg('amb', [[true, 'On'], [false, 'Off']], 'Ambience')}
    <div class="setrow"><span>Volume</span><input type="range" min="0" max="1" step="0.05" value="${st.vol}" data-vol aria-label="Volume"></div>
    <div class="setrow"><span>Effects level</span><input type="range" min="0" max="1" step="0.05" value="${st.fxVol}" data-fxvol aria-label="Effects level, under the Volume"></div>
    <div class="setrow"><span>Music level</span><input type="range" min="0" max="1" step="0.05" value="${st.musicVol}" data-musicvol aria-label="Music and ambience level, under the Volume"></div>
    ${seg('theme', [['auto', 'Auto'], ['light', 'Day'], ['dark', 'Night']], 'Theme')}
    ${seg('motion', [['system', 'Auto'], ['full', 'Full'], ['reduce', 'Reduced']], 'Motion')}
    ${canVibrate ? seg('vibrate', [[true, 'On'], [false, 'Off']], 'Vibration') : ''}
    ${seg('text', [[1, '100%'], [1.15, '115%'], [1.3, '130%']], 'Text size')}
    ${seg('board3d', [['auto', 'Auto'], ['on', '3D'], ['off', 'Flat']], 'Board')}
    ${seg('ai', [['normal', 'Normal'], ['fast', 'Fast'], ['instant', 'Instant']], 'Computer speed')}
    ${seg('townCue', [[true, 'On'], [false, 'Off']], 'Hot Springs rack cue')}
    <div class="setrow"><span>Tips</span><button class="btn quiet" data-tips>${st.tipsSeen ? 'Show tips again' : 'Tips will show in a game'}</button></div>
  </div>`;
}

// ---------- register ----------
export function registerHtml(lex, reg, noSave, newerSave) {
  const groups = Object.entries(lex.categories).map(([ck, c]) => {
    const entries = lex.data.words.filter((w) => w.cat === ck);
    const found = entries.filter((e) => e.forms.some((f) => reg[f]));
    const pct = entries.length ? Math.round((100 * found.length) / entries.length) : 0;
    const banner = art.has('card-' + ck)
      ? `<div class="reg-banner" style="background-image:url(${art.src('card-' + ck)})" aria-hidden="true"></div>`
      : `<div class="reg-banner vector cat-${esc(ck)}" aria-hidden="true"></div>`;
    return `<section class="reg-cat" data-reg-cat="${esc(ck)}">
      <div class="reg-head">
        ${banner}
        <div class="reg-head-bar">
          <h2>${ICON.cat[c.icon]} ${esc(c.name)} <small>${found.length} / ${entries.length}${found.length === entries.length ? ' · complete' : ''}</small></h2>
          <div class="reg-progress" role="progressbar" aria-valuenow="${found.length}" aria-valuemin="0" aria-valuemax="${entries.length}" aria-label="${esc(c.name)}: ${found.length} of ${entries.length} words found"><span style="width:${pct}%"></span></div>
        </div>
      </div>
      <ul class="reg-list">${entries.map((e) => {
      const forms = e.forms.filter((f) => reg[f]);
      const tier = lex.data.tiers[e.tier];
      if (!forms.length) {
        const len = e.forms[0].length;
        return `<li class="reg-item locked"><button type="button" class="reg-lock" data-reg-locked="${esc(e.id)}" data-cat="${esc(ck)}" data-len="${len}" data-tier="${tier}" aria-label="Not found yet: ${len}-letter ${esc(c.name)} word, +${tier} points"><b aria-hidden="true">${'<i></i>'.repeat(len)}</b><span class="reg-meta"><span class="reg-len">${len} letters</span><span class="reg-tier">+${tier}</span></span></button></li>`;
      }
      const best = Math.max(...forms.map((f) => reg[f].best));
      return `<li class="reg-item"><button type="button" data-reg="${e.id}"><span class="stamp" aria-hidden="true">${ICON.steam}</span><b>${forms.join(' · ')}</b><small>best ${best} · ${esc(reg[forms[0]].first)}</small></button></li>`;
    }).join('')}</ul></section>`;
  }).join('');
  return `<div class="sheet register">
    ${band()}
    <header class="sheet-head"><h1 tabindex="-1">Bathhouse Register</h1><button class="iconbtn" data-back aria-label="Close">${ICON.close}</button></header>
    ${noSave ? `<p class="note warn" role="status">${NO_SAVE}</p>` : newerSave ? `<p class="note warn" role="status">${NEWER_SAVE}</p>` : ''}
    <p class="note">Every Hot Springs word you play is signed in here. Tap a word to read its card, or tap a blank slot to see its category, length and bonus.</p>
    <p class="reg-nudge" role="status" aria-live="polite" hidden></p>
    ${groups}
  </div>`;
}

// ---------- records ----------
export function recordsHtml(st, o) {
  const stat = (n, label) => `<div class="stat"><b>${esc(n)}</b><small>${esc(label)}</small></div>`;
  const rate = st.games ? `${Math.round(100 * st.wins / st.games)}%` : '-';
  const avg = st.games ? Math.round(st.totalScore / st.games) : '-';
  const day = o.daily, days = Object.values(day.days || {});
  const order = (k) => PERSONAS.findIndex((p) => p.id === k.split(':')[0]) * 3 + ['easy', 'medium', 'hard'].indexOf(k.split(':')[1]);
  const rows = Object.entries(st.opp).filter(([k]) => persona(k.split(':')[0]) && LEVEL_NAME[k.split(':')[1]]).sort((a, b) => order(a[0]) - order(b[0]));
  return `<div class="sheet records">
    ${band()}
    <header class="sheet-head"><h1 tabindex="-1">Records</h1><button class="iconbtn" data-back aria-label="Close">${ICON.close}</button></header>
    ${st.games ? '' : '<p class="note">No games on the record yet. Finish a game against the computer and your score, wins and best plays are written here.</p>'}
    <h2>Games against the town</h2>
    <div class="stats">${stat(st.games, 'games')}${stat(st.wins, 'wins')}${stat(rate, 'win rate')}${stat(st.bestScore || '-', 'best score')}${stat(avg, 'average score')}${stat(`${st.streak} / ${st.bestStreak}`, 'win streak / best')}</div>
    <ul class="bests">
      <li><span>Best word</span><b>${st.bestWord ? `${esc(st.bestWord.word)} <small>${st.bestWord.score} points</small>` : '-'}</b></li>
      <li><span>Best turn</span><b>${st.bestPlay ? `${st.bestPlay.score} points <small>${esc(st.bestPlay.word)}</small>` : '-'}</b></li>
      <li><span>Full Soaks</span><b>${st.fullSoaks}</b></li>
      <li><span>Hot Springs words</span><b>${st.themed}</b></li>
      <li><span>Featured Springs found</span><b>${st.featured}</b></li>
      <li><span>Hints used</span><b>${st.hints}</b></li>
    </ul>
    <h2>By opponent</h2>
    ${rows.length ? `<table class="opp-table"><thead><tr><th scope="col">Opponent</th><th scope="col">Games</th><th scope="col">Won</th><th scope="col">Best</th></tr></thead><tbody>${rows.map(([k, r]) => {
      const [pid, lv] = k.split(':');
      return `<tr><th scope="row">${esc(persona(pid).name)} <small>${LEVEL_NAME[lv]}</small></th><td>${r.games}</td><td>${r.wins}</td><td>${r.best}</td></tr>`;
    }).join('')}</tbody></table><p class="note">A win counts when your score beats that opponent's.</p>` : '<p class="note">Each opponent and difficulty you play gets a line here.</p>'}
    <h2>Daily Soak</h2>
    <div class="stats cols4">${stat(days.length, 'days played')}${stat(days.length ? Math.max(...days.map((d) => (d.first != null ? d.first : d.score))) : '-', 'best day')}${stat(day.streak || 0, 'day streak')}${stat(Math.max(day.streak || 0, st.daily.bestStreak), 'best streak')}</div>
    ${dailyStrip(day.days || {}, o.today)}
    <p class="note">Miss a single day and a rest day keeps your streak going, once in any seven days.</p>
    <h2>Bathhouse Register</h2>
    <p>${o.found} of ${o.total} Hot Springs words found.</p>
  </div>`;
}

// ---------- about ----------
export function aboutHtml(meta) {
  return `<div class="sheet about">
    ${band()}
    <header class="sheet-head"><h1 tabindex="-1">About</h1><button class="iconbtn" data-back aria-label="Close">${ICON.close}</button></header>
    <p><b>Bathhouse Letters</b> is part of Hot Springs Games, an open-source (MIT) collection of browser games set in Hot Springs, Arkansas. It's an original crossword word-tile game: the board, tiles, bonuses and rules were made for it, and nothing here is endorsed by any park, business or bathhouse.</p>
    <h2>Words</h2>
    <p>The dictionary is the ENABLE word list (public domain), ${meta.words.toLocaleString('en-US')} words of 2–15 letters, minus slurs and crude words${meta.added ? `, plus ${meta.added} added by the game: the two-letter words QI, ZA, OK, EW, KI, FE, GI and OI, and everyday words such as EMAIL, ONLINE, APP, BLOG and EMOJI` : ''}. Common words for the computer opponents are marked using SCOWL by Kevin Atkinson (© 2000–2018, used under its permissive licence).</p>
    <h2>History</h2>
    <p>Each Hot Springs word card cites its source: the National Park Service, the Encyclopedia of Arkansas, Wikipedia, and other sources checked for the collection's trivia game. The opponents are fictional characters.</p>
    <h2>Type and art</h2>
    <p>Limelight, Fraunces and Josefin Sans (SIL Open Font License). Board and tiles are drawn in code.</p>
    <p>Art: painted with AI image tools for this game.</p>
    <p class="fine">Hot Springs Games · hsargames.com</p>
  </div>`;
}

// ---------- game over and daily results ----------
// The one sting a play earns on top of its tile sounds (S3-19). A Featured Spring and a Full Soak have their own cues; then a
// word new to the Register; then the size of the score: this many points earns a rising pair of notes, and this many a run up
// with a low thump.
export const SCORE_GOOD = 25, SCORE_BIG = 45;
export function stingFor(e, newWord) {
  if (e.featured || e.full) return null;
  if (newWord) return 'discover';
  return e.score >= SCORE_BIG ? 'big' : e.score >= SCORE_GOOD ? 'good' : null;
}
// The Register categories a play finishes (S3-04): `reg` is the Register before the play, `words` the play's scored words. A
// category is finished when every one of its words has been signed in under at least one of its forms.
export function categoriesCompleted(lex, reg, words) {
  const after = { ...reg };
  for (const w of words) if (w.themed) after[w.w] = after[w.w] || { count: 1 };
  const done = (ck) => lex.data.words.filter((e) => e.cat === ck).every((e) => e.forms.some((f) => after[f]));
  const touched = new Set(words.filter((w) => w.themed && !reg[w.w]).map((w) => lex.byId.get(w.themed).cat));
  return [...touched].filter((ck) => done(ck) && !lex.data.words.filter((e) => e.cat === ck).every((e) => e.forms.some((f) => reg[f])));
}
// How near a stalled game is to its end. The game ends when every seat has passed or swapped twice in a row (engine.js), so within
// one round of that the player is told: `passing` words it for the Pass confirmation (this pass is one of the turns), else for the strip.
export function stallNote(s, passing) {
  if (!s || s.over || s.mode === 'daily' || !s.players) return '';
  const n = s.players.length, left = 2 * n - (s.scoreless || 0);
  if (left > n) return '';
  if (passing) return left <= 1 ? 'Passing now ends the game.' : `After this, ${left - 1} more ${left - 1 === 1 ? 'turn' : 'turns'} without a score would end the game.`;
  return left <= 1 ? 'A turn with no score now ends the game.' : `${left} more turns without a score end the game.`;
}

// win, loss, tie or none (computers only) from the point of view of the people at the table
export function outcome(s) {
  const w = s.result && s.result.winners || [];
  if (!s.players.some((p) => p.kind === 'human')) return 'none';
  if (w.length > 1) return 'tie';
  return w.some((k) => s.players[k].kind === 'human') ? 'win' : 'loss';
}
const KICKER = { win: 'Lamps lit', loss: 'Dusk on the Row', tie: 'All square', none: 'The Steam Ledger' };

// One line on what decided a game: the biggest gap, in points, between the winner and the runner-up among Hot Springs bonuses,
// Full Soaks, Featured Springs, the best single turn and the finish (going out, tiles left). Empty for a Daily or a tie.
export function decisiveLine(s) {
  if (s.mode === 'daily' || s.players.length < 2 || !s.result) return '';
  const order = s.players.map((p, k) => ({ p, k })).sort((a, b) => b.p.score - a.p.score);
  const [a, b] = order, margin = a.p.score - b.p.score;
  if (margin <= 0) return 'The scores finished level.';
  const tally = (k) => {
    const t = { themed: 0, full: 0, feat: 0, best: 0 };
    for (const e of s.log) if (e.kind === 'play' && e.p === k) { t.themed += e.themed || 0; t.full += e.full ? 1 : 0; t.feat += e.featured ? 1 : 0; t.best = Math.max(t.best, e.score); }
    return t;
  };
  const x = tally(a.k), y = tally(b.k), adj = (s.result.adjust[a.k] || 0) - (s.result.adjust[b.k] || 0);
  const cands = [
    [x.themed - y.themed, (d) => `${d} more points from Hot Springs words`],
    [(x.full - y.full) * FULL_SOAK, () => `${plural(x.full - y.full, 'more Full Soak')}`],
    [(x.feat - y.feat) * FEATURED_BONUS, () => `${plural(x.feat - y.feat, 'more Featured Spring')}`],
    [x.best - y.best, () => `a bigger best turn, ${x.best} against ${y.best}`],
    [adj, () => 'a better finish, with going out and the tiles left over'],
  ].sort((p, q) => q[0] - p[0]);
  const [d, say] = cands[0];
  const who = a.p.name;
  return d >= Math.max(10, margin * 0.4) ? `${esc(who)} won by ${margin}: ${say(d)}.` : `${esc(who)} won by ${margin}, with no one play deciding it.`;
}

export function overHtml(s, lex, dinfo, extra = {}) {
  const order = s.players.map((p, k) => ({ p, k })).sort((a, b) => b.p.score - a.p.score);
  const win = s.result.winners;
  const themed = [];
  for (const e of s.log) if (e.kind === 'play') for (const w of e.words) if (w.themed) themed.push({ w: w.w, id: w.themed, who: e.p, pts: w.bonus });
  const why = { out: `${s.players[s.result.out]?.name} went out.`, stalled: 'Everyone passed or swapped twice in a row.', daily: 'Ten turns are up.' }[s.result.why] || '';
  const daily = s.mode === 'daily';
  const top = order[0];
  const aid = (p) => (daily || p.kind !== 'human' ? '' : p.unl ? `<span>Unlimited hints, ${hintsUsed(p)} used</span>` : hintsUsed(p) ? `<span>${plural(hintsUsed(p), 'hint')} used</span>` : '<span>Unaided</span>');
  const line = (p, k) => `<span>${p.best ? `Best word ${esc(p.best.word)} (${p.best.score})` : 'No words played'}</span>${aid(p)}${s.result.adjust[k] > 0 ? `<span>Went out: +${s.result.adjust[k]}</span>` : s.result.adjust[k] < 0 ? `<span>Tiles left: −${-s.result.adjust[k]}</span>` : ''}`;
  const say = (k) => (extra.barks && extra.barks[k] ? `<small class="bark"><b>${esc(SHORT[s.players[k].persona] || '')}:</b> “${esc(extra.barks[k].text)}”</small>` : '');
  const pbs = extra.pb && extra.pb.length ? `<ul class="pbs" aria-label="Personal bests">${extra.pb.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '';
  const oc = outcome(s), why2 = daily ? '' : decisiveLine(s);
  const dOfficial = dinfo ? (dinfo.official != null ? dinfo.official : (dinfo.first != null ? dinfo.first : dinfo.best)) : 0;
  const dReplay = !!(dinfo && dinfo.isReplay);
  return `<div class="sheet over over-${oc}">
    ${art.has('title') ? `<div class="over-art" style="background-image:url(${art.src('title')})" aria-hidden="true"></div>` : ''}
    <header class="masthead"><p class="mast-kicker">${daily ? (dReplay ? 'Practice replay' : 'The Steam Ledger') : KICKER[oc]}</p><h1 tabindex="-1">${daily ? 'Daily Soak' : 'Final Soak'}</h1><p class="mast-sub">${esc(why)}</p>${why2 ? `<p class="decisive">${why2}</p>` : ''}</header>
    ${dinfo ? `<div class="daily-box"><p class="daily-date">${esc(dinfo.label)}${dReplay ? ' · <strong>Practice replay</strong>' : ''}</p><div class="daily-stats"><div><b>${s.players[0].score}</b><small>${dReplay ? 'practice replay' : 'this soak'}</small></div><div><b>${dOfficial}</b><small>official today</small></div><div><b>${dinfo.streak}</b><small>day streak</small></div></div><p class="note">${dReplay ? "Today's official score is already locked to your first run. Practice replays do not change Records." : 'Everyone gets the same tiles today. Come back tomorrow for a new soak.'}</p>${dinfo.par ? `<p class="par" data-par-line="1">${esc(persona('hollis').name)} scored ${dinfo.par.m} and ${esc(persona('julian').name)} ${dinfo.par.h} on these tiles.</p>` : ''}${dinfo.plays > 1 && dinfo.first != null ? `<p class="par">Your first try today: ${dinfo.first}.</p>` : ''}${dReplay && dinfo.replayBest != null ? `<p class="par">Best practice replay today: ${dinfo.replayBest}.</p>` : ''}${dinfo.rested ? '<p class="note rest-note">You missed a day, and a rest day kept your streak going. You get one in any seven days.</p>' : ''}</div>` : ''}
    ${daily ? '' : `<div class="winner">${badge(top.p, top.k, 92)}<div class="wmeta"><span class="ribbon">${win.length > 1 ? 'Tied for first' : 'Winner'}</span><b>${win.map((k) => esc(s.players[k].name)).join(' &amp; ')}</b><small class="wlines">${line(top.p, top.k)}</small>${say(top.k)}</div><b class="wscore">${top.p.score}</b></div>`}
    ${pbs}
    <ol class="final">${order.slice(daily ? 0 : 1).map(({ p, k }) => `<li>${badge(p, k, 40)}<div><b>${esc(p.name)}</b><small class="wlines">${line(p, k)}</small>${say(k)}</div><b class="fscore">${p.score}</b></li>`).join('')}</ol>
    <div class="over-cols">
      <section><h2>Hot Springs words</h2>${themed.length ? `<div class="wchips">${themed.map((t) => `<button class="wchip" data-fact="${t.id}" data-form="${t.w}">${t.w} <small>+${t.pts}</small></button>`).join('')}</div>` : '<p class="note">None this game. A word like SPA, STEAM or ROCK pays a bonus and opens a card of local history.</p>'}</section>
      ${s.featured.length ? `<section><h2>Featured Springs</h2><ul class="feat-list">${s.featured.map((f) => { const id = lex.entry(f.word)?.id, inner = `<b>${f.word}</b><small>${f.by != null ? `found by ${esc(s.players[f.by].name)}` : 'stayed hidden'}${id ? ' · read the card' : ''}</small>`; return `<li class="${f.by != null ? 'got' : ''}">${id ? `<button type="button" class="fchip" data-fact="${id}" data-form="${f.word}">${inner}</button>` : inner}</li>`; }).join('')}</ul></section>` : ''}
    </div>
    <div class="dlg-btns">${daily ? '' : '<button class="btn primary" data-again>Play again</button>'}${extra.review ? '<button class="btn" data-review>What you missed</button>' : ''}<button class="btn ${daily ? 'primary' : ''}" data-go="title">Title screen</button></div>
  </div>`;
}

// The look back over a finished game (review.js): how often the best-scoring play was found, and the biggest misses. r is null while it is worked out.
export function reviewHtml(r) {
  const body = !r ? '<p role="status">Looking back over your turns…</p>'
    : !r.total ? '<p>There is nothing to look back over.</p>'
    : `<p class="rv-rate"><b>${r.found} of ${r.total}</b> ${r.total === 1 ? 'turn' : 'turns'}: you made the highest-scoring play your tiles allowed.</p>
      ${r.misses.length ? `<ol class="rv-list">${r.misses.map((m) => `<li><b>Turn ${m.turn}</b> ${m.kind === 'play' ? `You played <em>${esc(m.word)}</em> for ${m.score}.` : m.kind === 'swap' ? 'You swapped tiles.' : 'You passed.'} <em>${esc(m.best.word)}</em> would have scored ${m.best.score}.</li>`).join('')}</ol>` : '<p>No play left more than a few points behind the best one on offer.</p>'}
      <p class="note">This counts points only. A smaller play that keeps good tiles can be the better one.${r.skipped ? ` ${plural(r.skipped, 'turn')} from before this was kept could not be looked at.` : ''}</p>`;
  return `<div class="card dialog review" role="dialog" aria-modal="true" aria-labelledby="rv-h"><h2 id="rv-h">What you missed</h2>${body}<div class="dlg-btns"><button class="btn primary" data-close>Close</button></div></div>`;
}

// Stars for a Daily score: one for beating the lower of the two pars, two for beating both. Hollis Crane (Medium) usually scores
// less than Maestro Fitch (Hard), but on some dates she scores more, and a score never earns the second star without the first.
export const dailyStars = (ref, par) => (ref > Math.min(par.m, par.h) ? 1 : 0) + (ref > Math.max(par.m, par.h) ? 1 : 0);

// The last fourteen days of the Daily Soak, oldest first: the score of the first try (or the day's score where the first try
// was not kept) and its stars.
export function dailyStrip(days, today) {
  const t = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(today || '');
  if (!t) return '';
  const cells = [];
  let flipped = false;   // a day in view where Hollis Crane's par is above Maestro Fitch's
  for (let k = 13; k >= 0; k--) {
    const d = new Date(Date.UTC(+t[1], +t[2] - 1, +t[3] - k, 12)), key = d.toISOString().slice(0, 10), e = days[key];
    const ref = e ? (e.first != null ? e.first : e.score) : null;
    const stars = e && e.par ? dailyStars(ref, e.par) : 0;
    if (e && e.par && e.par.m > e.par.h) flipped = true;
    const said = e ? `${ref} points${e.par ? `, ${stars ? plural(stars, 'star') : 'no stars'}` : ''}` : 'not played';
    cells.push(`<li class="dday${e ? ' on' : ''}" aria-label="${key}: ${said}"><small>${d.getUTCDate()}</small><b>${e ? ref : '·'}</b><i aria-hidden="true">${'★'.repeat(stars) || '&nbsp;'}</i></li>`);
  }
  return `<h3 class="dhead">Last 14 days</h3><ol class="dstrip">${cells.join('')}</ol><p class="note">Your first try each day. ${flipped ? `One star beats the lower of ${esc(persona('hollis').name)}'s and ${esc(persona('julian').name)}'s scores on that day's tiles, two beat both.` : `One star beats ${esc(persona('hollis').name)} on that day's tiles, two beat ${esc(persona('julian').name)}.`}</p>`;
}

export function dailyLine(d) {
  if (d.today) {
    const official = d.today.first != null ? d.today.first : d.today.score;
    return `Today: ${official} pts · streak ${d.streak}`;
  }
  return d.streak ? `${DAILY_TURNS} turns · streak ${d.streak}` : `${DAILY_TURNS} turns, the same tiles for everyone`;
}

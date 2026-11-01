// HTML for screens, dialogs and panels. Pure string templates; main.js wires the events.
import { PERSONAS, persona, LEVEL_NAME, HUMAN_COLORS } from './personas.js';
import { TILES, BLANKS } from './tiles.js';
import { FULL_SOAK, FEATURED_BONUS } from './score.js';
import { DAILY_TURNS } from './engine.js';
import { art } from './art.js';

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
  const initials = (p.name.replace(/["“”]/g, '').match(/\b[A-Z]/g) || ['?']).slice(0, 2).join('');
  return `<span class="badge" style="--c:${color};--s:${size}px" aria-hidden="true">${face || `<b>${esc(initials)}</b>`}<i>${k + 1}</i></span>`;
}

// ---------- title ----------
export function titleHtml(o) {
  const hasArt = art.has('title');
  return `<div class="title ${hasArt ? 'painted' : ''}">
    <div class="title-card">
      ${hasArt ? `<img class="title-art" src="${art.src('title')}" alt="Bathhouse Row at dusk, steam rising from the hillside behind it">` : '<div class="title-art vector" aria-hidden="true"></div>'}
      <div class="title-words">
        <p class="kicker">A Hot Springs word game</p>
        <h1>Bathhouse<br><span>Letters</span></h1>
        <p class="tag">Build words. Find the springs.</p>
      </div>
    </div>
    <nav class="menu" aria-label="Main menu">
      ${o.canContinue ? `<button class="btn primary" data-go="continue">Continue <small>${esc(o.continueLine)}</small></button>` : ''}
      <button class="btn ${o.canContinue ? '' : 'primary'}" data-go="setup">New game</button>
      <button class="btn" data-go="daily">Daily Soak <small>${esc(o.dailyLine)}</small></button>
      <button class="btn" data-go="register">Bathhouse Register <small>${o.found} of ${o.total} words found</small></button>
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
          : `<label class="field"><span>Opponent <em>(fictional character)</em></span><select data-persona="${k}">${PERSONAS.map((p) => `<option value="${p.id}" ${p.id === st.persona ? 'selected' : ''}>${esc(p.name)} · ${LEVEL_NAME[p.level]}</option>`).join('')}</select></label>
             <p class="seat-note">${esc(persona(st.persona).role)}. ${esc(persona(st.persona).line)}</p>`}
      </div>
      ${setup.seats.length > 2 ? `<button class="iconbtn small" data-remove="${k}" aria-label="Remove seat ${k + 1}">${ICON.close}</button>` : ''}
    </li>`;
  };
  const humans = setup.seats.filter((s) => s.kind === 'human').length;
  return `<div class="sheet setup">
    <header class="sheet-head"><h1>New game</h1><button class="iconbtn" data-go="title" aria-label="Back to the title screen">${ICON.close}</button></header>
    <ol class="seats">${setup.seats.map(seat).join('')}</ol>
    ${setup.seats.length < 4 ? '<button class="btn quiet add" data-add>Add a player</button>' : ''}
    <label class="check"><input type="checkbox" data-hints ${setup.hints ? 'checked' : ''}> Spring Guide hints (3 per player)</label>
    <p class="note">${humans >= 2 ? 'Pass and play: each person\'s tiles stay hidden until they tap to take their turn.' : humans === 1 ? 'You against the computer.' : 'Computers only: sit back and watch.'}</p>
    <button class="btn primary big" data-start>Start</button>
  </div>`;
}

// ---------- game panels ----------
export function scoresHtml(s, compact) {
  return s.players.map((p, k) => {
    const per = p.persona ? persona(p.persona) : null;
    const active = !s.over && k === s.cur;
    const sub = per ? `${LEVEL_NAME[per.level]} · fictional` : (p.kind === 'human' ? 'Person' : '');
    return compact
      ? `<div class="chip ${active ? 'on' : ''}" aria-current="${active}">${badge(p, k, 26)}<b class="score" data-score="${k}">${p.score}</b></div>`
      : `<div class="pcard ${active ? 'on' : ''}" aria-current="${active}">${badge(p, k, 44)}<div class="pmeta"><b>${esc(p.name)}</b><small>${esc(sub)}</small></div><b class="score" data-score="${k}">${p.score}</b></div>`;
  }).join('');
}

export function springsHtml(s, lex, compact) {
  return `<h2 class="springs-title"><span>Featured Springs</span> <small>+${FEATURED_BONUS} each · a letter clears every round</small></h2><div class="plaques">${s.featured.map((f, k) => {
    const cat = lex.categories[f.cat];
    const claimed = f.by != null;
    const letters = [...f.word].map((ch, j) => (claimed || f.shown.includes(j) ? `<b>${ch}</b>` : '<b class="fog" aria-hidden="true"></b>')).join('');
    const label = claimed ? `${f.word}, found by ${s.players[f.by].name}` : `${f.word.length} letters, ${cat.name}: ${[...f.word].map((ch, j) => (f.shown.includes(j) ? ch : 'blank')).join(' ')}`;
    return `<button class="plaque ${claimed ? 'claimed' : ''}" data-plaque="${k}" aria-label="Featured Spring ${k + 1}: ${esc(label)}" title="${esc(cat.name)}">
      <span class="pcat">${ICON.cat[cat.icon]}</span><span class="pword">${letters}</span>${claimed ? `<span class="pby">${esc(s.players[f.by].name.split(' ')[0])}</span>` : ''}</button>`;
  }).join('')}</div>`;
}

export function actionsHtml(o) {
  const b = (id, icon, text, key, extra = '') => `<button class="abtn ${id}" data-act="${id}" ${extra}>${icon}<span>${text}</span>${key ? `<kbd>${key}</kbd>` : ''}</button>`;
  return [
    o.staged ? b('recall', ICON.recall, 'Recall', 'Esc') : b('shuffle', ICON.shuffle, 'Shuffle', '⇧R'),
    b('swap', ICON.swap, 'Swap', '⇧S', o.canSwap ? '' : 'disabled'),
    b('pass', ICON.pass, 'Pass', '⇧P'),
    o.hints != null ? b('hint', ICON.hint, `Hint <em>${o.hints}</em>`, '⇧H', o.hints > 0 ? '' : 'disabled') : '',
    b('play', ICON.play, 'Play', 'Enter', o.canPlay ? '' : 'aria-disabled="true"'),
  ].join('');
}

export function logHtml(s, lex) {
  return s.log.slice().reverse().filter((e) => e.kind !== 'end').slice(0, 40).map((e) => {
    const p = s.players[e.p];
    if (e.kind === 'play') {
      const ws = e.words.map((w) => `<span class="${w.themed ? 'themed' : ''}">${w.w}</span>`).join(', ');
      const extras = [e.full ? `Full Soak +${FULL_SOAK}` : '', e.themed ? `Hot Springs +${e.themed}` : '', e.featured ? `Featured +${FEATURED_BONUS}` : ''].filter(Boolean).join(' · ');
      return `<li><b class="who">${esc(p.name)}</b> ${ws} <em>${e.score}</em>${extras ? `<small>${extras}</small>` : ''}</li>`;
    }
    return `<li><b class="who">${esc(p.name)}</b> ${e.kind === 'swap' ? `swapped ${plural(e.count, 'tile')}` : 'passed'}</li>`;
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
  massage: 'vig-buckstaff', tub: 'vig-buckstaff', soak: 'vig-hale', mineral: 'vig-hale', hotel: 'vig-eastman', alligator: 'vig-gators',
  gator: 'vig-gators', farm: 'vig-gators', ostrich: 'vig-ostrich', zoo: 'vig-iqzoo', chicken: 'vig-iqzoo', ballpark: 'vig-whittington',
  homer: 'vig-whittington', baseball: 'vig-fogel', railroad: 'vig-railroad', train: 'vig-railroad', tower: 'vig-tower', mountain: 'vig-tower',
  casino: 'vig-southern', glass: 'vig-southern', poker: 'vig-southern', club: 'vig-ohio', craps: 'vig-vapors', gangster: 'vig-arlington',
  radio: 'vig-arlington', water: 'vig-waterco', fire: 'vig-watertax',
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
    <h2 id="pause-h">Paused</h2>
    <nav class="menu">
      <button class="btn primary" data-close>Resume</button>
      <button class="btn" data-open="ledger">Steam ledger</button>
      <button class="btn" data-go="help">How to play</button>
      <button class="btn" data-go="settings">Settings</button>
      <button class="btn quiet" data-go="title">Save and quit to title</button>
    </nav>
  </div>`;
}

export function ledgerHtml(s, lex) {
  return `<div class="card dialog ledger-dlg" role="dialog" aria-modal="true" aria-labelledby="ledger-h"><h2 id="ledger-h">Steam ledger</h2><ol class="log">${logHtml(s, lex) || '<li>No plays yet.</li>'}</ol><div class="dlg-btns"><button class="btn primary" data-close>Close</button></div></div>`;
}

export function privacyHtml(p, k) {
  return `<div class="privacy-card">${badge(p, k, 64)}<h2>${esc(p.name)}'s turn</h2><p>Pass the device to ${esc(p.name)}. Tiles stay hidden until you tap.</p><button class="btn primary big" data-reveal>Show my tiles</button></div>`;
}

// ---------- help ----------
export function helpHtml(tab, lex) {
  const tabs = [['rules', 'How to play'], ['squares', 'Squares and scoring'], ['words', 'Hot Springs words'], ['keys', 'Controls']];
  const tileRow = Object.entries(TILES).map(([l, t]) => `<span class="tchip"><b>${l}</b><i>${t.value}</i><small>×${t.count}</small></span>`).join('');
  const body = {
    rules: `<h2>Your turn</h2>
      <p>Each player holds seven tiles. On your turn, either <b>play</b> tiles to make words, <b>swap</b> tiles with the bag, or <b>pass</b>.</p>
      <ol class="steps">
        <li>Lay one or more tiles in a single row or a single column, with no empty squares between them.</li>
        <li>The first word of the game must cover the <b>Display Spring</b> at the centre and use at least two tiles.</li>
        <li>After that, every play must touch tiles already on the board.</li>
        <li>Every run of two or more tiles your play creates, across and down, must be a word. You score all of them.</li>
        <li>Draw back up to seven tiles from the bag.</li>
      </ol>
      <p>Words come from the public-domain ENABLE list (168,000 words; no proper nouns). A play with a word that isn't on the list is handed back and you keep your turn. While you place tiles, the strip under the board shows the words, the score and any bonus.</p>
      <p>Stuck? The <b>Spring Guide</b> (Hint) sets a strong play on the board for you to keep, move or take back: three per player in a game against the computer or pass-and-play, none in the Daily Soak.</p>
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
        <li><span class="sq sq-B"><i class="row">${ICON.cat.arch}</i></span><span><b>Bathhouse Row</b>: eight squares named for the eight historic bathhouses. A Hot Springs word that covers one earns its bonus twice.</span></li>
      </ul>
      <h2>Bonuses</h2>
      <ul class="legend plain">
        <li><b>Full Soak +${FULL_SOAK}</b>: use all seven tiles in one turn.</li>
        <li><b>Hot Springs word +10 / +15 / +25</b>: any word you form that belongs to the town (see the next tab).</li>
        <li><b>Featured Spring +${FEATURED_BONUS}</b>: three secret words per game, hidden in steam on the plaques. A letter clears every round. The first to form one claims it.</li>
      </ul>
      <h2>The tiles</h2>
      <p>${TILES ? Object.values(TILES).reduce((a, t) => a + t.count, 0) : 0} lettered tiles and ${BLANKS} blank <b>Steam tiles</b>, which stand for any letter and score nothing. Counts and points were worked out from how often each letter appears in playable words.</p>
      <div class="tchips">${tileRow}</div>`,
    words: `<h2>Hot Springs words</h2>
      <p>${lex.data.words.length} groups of everyday words belong to the town: <b>spring</b>, <b>steam</b>, <b>bathhouse</b>, <b>tufa</b>, <b>novaculite</b>, <b>derby</b>, <b>magnolia</b> and more. Form one, across or down, and it pays a bonus and opens a card from the town's history, with its source.</p>
      <ul class="legend plain">${Object.entries(lex.categories).map(([k, c]) => `<li><span class="cat-ic">${ICON.cat[c.icon]}</span><b>${esc(c.name)}</b></li>`).join('')}</ul>
      <p>Every word you find goes into your <b>Bathhouse Register</b>, from the title screen.</p>`,
    keys: `<h2>Mouse and touch</h2>
      <ul class="legend plain"><li>Drag a tile from your rack to the board, or tap a tile and then tap a square.</li><li>Tap a tile you've placed to take it back, or drag it somewhere else.</li><li>On a phone, tap the board to zoom in. Pinch to zoom, drag to look around. A loupe shows the square under your finger.</li></ul>
      <h2>Keyboard</h2>
      <ul class="keys"><li><kbd>←↑→↓</kbd> move the cursor</li><li><kbd>A</kbd>–<kbd>Z</kbd> place that letter from your rack</li><li><kbd>Space</kbd> switch between across and down</li><li><kbd>Backspace</kbd> take back the last tile</li><li><kbd>Enter</kbd> play</li><li><kbd>Esc</kbd> take back all tiles</li><li><kbd>Shift</kbd>+<kbd>R</kbd> shuffle the rack (when nothing is placed)</li><li><kbd>Shift</kbd>+<kbd>S</kbd> swap · <kbd>Shift</kbd>+<kbd>P</kbd> pass · <kbd>Shift</kbd>+<kbd>H</kbd> hint</li><li><kbd>?</kbd> help · <kbd>Esc</kbd> menu (when nothing is placed)</li></ul>`,
  }[tab];
  return `<div class="sheet help">
    <header class="sheet-head"><h1>How to play</h1><button class="iconbtn" data-back aria-label="Close">${ICON.close}</button></header>
    <div class="tabs" role="tablist">${tabs.map(([k, t]) => `<button role="tab" aria-selected="${k === tab}" data-tab="${k}">${t}</button>`).join('')}</div>
    <div class="help-body" role="tabpanel">${body}</div>
  </div>`;
}

// ---------- settings ----------
export function settingsHtml(st) {
  const seg = (key, opts, label) => `<div class="setrow"><span>${label}</span><div class="seg" role="radiogroup" aria-label="${label}">${opts.map(([v, t]) => `<button role="radio" aria-checked="${st[key] === v}" data-set="${key}" data-val="${v}">${t}</button>`).join('')}</div></div>`;
  return `<div class="sheet settings">
    <header class="sheet-head"><h1>Settings</h1><button class="iconbtn" data-back aria-label="Close">${ICON.close}</button></header>
    ${seg('sound', [[true, 'On'], [false, 'Off']], 'Sound')}
    <div class="setrow"><span>Volume</span><input type="range" min="0" max="1" step="0.05" value="${st.vol}" data-vol aria-label="Volume"></div>
    ${seg('theme', [['auto', 'Auto'], ['light', 'Day'], ['dark', 'Night']], 'Theme')}
    ${seg('motion', [['system', 'Auto'], ['full', 'Full'], ['reduce', 'Reduced']], 'Motion')}
    ${seg('text', [[1, '100%'], [1.15, '115%'], [1.3, '130%']], 'Text size')}
    ${seg('board3d', [['auto', 'Auto'], ['on', '3D'], ['off', 'Flat']], 'Board')}
    ${seg('ai', [['normal', 'Normal'], ['fast', 'Fast'], ['instant', 'Instant']], 'Computer speed')}
  </div>`;
}

// ---------- register ----------
export function registerHtml(lex, reg) {
  const groups = Object.entries(lex.categories).map(([ck, c]) => {
    const entries = lex.data.words.filter((w) => w.cat === ck);
    const found = entries.filter((e) => e.forms.some((f) => reg[f]));
    return `<section class="reg-cat"><h2>${ICON.cat[c.icon]} ${esc(c.name)} <small>${found.length} / ${entries.length}</small></h2><ul class="reg-list">${entries.map((e) => {
      const forms = e.forms.filter((f) => reg[f]);
      if (!forms.length) return `<li class="reg-item locked" aria-label="Not found yet: ${e.forms[0].length} letters"><b aria-hidden="true">${'<i></i>'.repeat(e.forms[0].length)}</b></li>`;
      const best = Math.max(...forms.map((f) => reg[f].best));
      return `<li class="reg-item"><button data-reg="${e.id}"><span class="stamp" aria-hidden="true">${ICON.steam}</span><b>${forms.join(' · ')}</b><small>best ${best} · ${esc(reg[forms[0]].first)}</small></button></li>`;
    }).join('')}</ul></section>`;
  }).join('');
  return `<div class="sheet register">
    <header class="sheet-head"><h1>Bathhouse Register</h1><button class="iconbtn" data-back aria-label="Close">${ICON.close}</button></header>
    <p class="note">Every Hot Springs word you play is signed in here. Tap a word to read its card.</p>
    ${groups}
  </div>`;
}

// ---------- about ----------
export function aboutHtml(meta) {
  return `<div class="sheet about">
    <header class="sheet-head"><h1>About</h1><button class="iconbtn" data-back aria-label="Close">${ICON.close}</button></header>
    <p><b>Bathhouse Letters</b> is part of Hot Springs Games, an open-source (MIT) collection of browser games set in Hot Springs, Arkansas. It's an original crossword word-tile game: the board, tiles, bonuses and rules were made for it, and nothing here is endorsed by any park, business or bathhouse.</p>
    <h2>Words</h2>
    <p>The dictionary is the ENABLE word list (public domain), ${meta.words.toLocaleString('en-US')} words of 2–15 letters, minus slurs and crude words. Common words for the computer opponents are marked using SCOWL by Kevin Atkinson (© 2000–2018, used under its permissive licence).</p>
    <h2>History</h2>
    <p>Each Hot Springs word card cites its source: the National Park Service, the Encyclopedia of Arkansas, Wikipedia, and other sources checked for the collection's trivia game. The opponents are fictional characters.</p>
    <h2>Type and art</h2>
    <p>Limelight, Fraunces and Josefin Sans (SIL Open Font License). Board and tiles are drawn in code; paintings were made for the collection.</p>
    <p class="fine">Hot Springs Games · hsargames.com</p>
  </div>`;
}

// ---------- game over and daily results ----------
export function overHtml(s, lex, dinfo) {
  const order = s.players.map((p, k) => ({ p, k })).sort((a, b) => b.p.score - a.p.score);
  const win = s.result.winners;
  const themed = [];
  for (const e of s.log) if (e.kind === 'play') for (const w of e.words) if (w.themed) themed.push({ w: w.w, id: w.themed, who: e.p, pts: w.bonus });
  const why = { out: `${s.players[s.result.out]?.name} went out.`, stalled: 'Everyone passed or swapped twice in a row.', daily: 'Ten turns are up.' }[s.result.why] || '';
  const daily = s.mode === 'daily';
  const top = order[0];
  const line = (p, k) => `<span>${p.best ? `Best word ${esc(p.best.word)} (${p.best.score})` : 'No words played'}</span>${s.result.adjust[k] > 0 ? `<span>Went out: +${s.result.adjust[k]}</span>` : s.result.adjust[k] < 0 ? `<span>Tiles left: −${-s.result.adjust[k]}</span>` : ''}`;
  return `<div class="sheet over">
    ${art.has('title') ? `<div class="over-art" style="background-image:url(${art.src('title')})" aria-hidden="true"></div>` : ''}
    <header class="masthead"><p class="mast-kicker">The Steam Ledger</p><h1>${daily ? 'Daily Soak' : 'Final Soak'}</h1><p class="mast-sub">${esc(why)}</p></header>
    ${dinfo ? `<div class="daily-box"><p class="daily-date">${esc(dinfo.label)}</p><div class="daily-stats"><div><b>${s.players[0].score}</b><small>this soak</small></div><div><b>${dinfo.best}</b><small>best today</small></div><div><b>${dinfo.streak}</b><small>day streak</small></div></div><p class="note">Everyone gets the same tiles today. Come back tomorrow for a new soak.</p></div>` : ''}
    ${daily ? '' : `<div class="winner">${badge(top.p, top.k, 92)}<div class="wmeta"><span class="ribbon">${win.length > 1 ? 'Tied for first' : 'Winner'}</span><b>${win.map((k) => esc(s.players[k].name)).join(' &amp; ')}</b><small class="wlines">${line(top.p, top.k)}</small></div><b class="wscore">${top.p.score}</b></div>`}
    <ol class="final">${order.slice(daily ? 0 : 1).map(({ p, k }) => `<li>${badge(p, k, 40)}<div><b>${esc(p.name)}</b><small class="wlines">${line(p, k)}</small></div><b class="fscore">${p.score}</b></li>`).join('')}</ol>
    <div class="over-cols">
      <section><h2>Hot Springs words</h2>${themed.length ? `<div class="wchips">${themed.map((t) => `<button class="wchip" data-fact="${t.id}" data-form="${t.w}">${t.w} <small>+${t.pts}</small></button>`).join('')}</div>` : '<p class="note">None this game. They hide in everyday words like SPA, STEAM and ROCK.</p>'}</section>
      ${s.featured.length ? `<section><h2>Featured Springs</h2><ul class="feat-list">${s.featured.map((f) => `<li class="${f.by != null ? 'got' : ''}"><b>${f.word}</b><small>${f.by != null ? `found by ${esc(s.players[f.by].name)}` : 'stayed hidden'}</small></li>`).join('')}</ul></section>` : ''}
    </div>
    <div class="dlg-btns">${daily ? '' : '<button class="btn primary" data-again>Play again</button>'}<button class="btn ${daily ? 'primary' : ''}" data-go="title">Title screen</button></div>
  </div>`;
}

export function dailyLine(d) {
  if (d.today) return `Today: ${d.today.score} pts · streak ${d.streak}`;
  return d.streak ? `${DAILY_TURNS} turns · streak ${d.streak}` : `${DAILY_TURNS} turns, the same tiles for everyone`;
}

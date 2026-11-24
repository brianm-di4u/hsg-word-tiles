// Hot Springs bonus words: lookup tables built once from data/thermal-words.json. No DOM.

const NOT_FEATURED = new Set(['bleacher']);

export function makeLexicon(data) {
  const byForm = new Map(), byId = new Map();
  for (const e of data.words) {
    byId.set(e.id, e);
    for (const f of e.forms) byForm.set(f, e);
  }
  const bonusOf = (e) => data.tiers[e.tier];
  // Featured Spring candidates: tier ≥ 2 forms of 4–8 letters. Entries added after the Daily began are bonus words but never
  // a Featured Spring: the pool's size decides which three a given seed deals, so it must stay what it was for every
  // dated and numbered game (NOT_FEATURED: bleacher, added with the lake, track and film words of wave 4).
  const featurable = [];
  for (const e of data.words) if (e.tier >= 2 && !NOT_FEATURED.has(e.id)) for (const f of e.forms) if (f.length >= 4 && f.length <= 8) featurable.push({ id: e.id, word: f, cat: e.cat });
  return { data, byForm, byId, bonusOf, featurable, categories: data.categories, entry: (w) => byForm.get(w) || null };
}

// Which Hot Springs bonus forms can be spelled strictly from the tiles on `rack` (blanks '?' match any letter).
// Fast (< 0.05 ms over 290 forms) and reveals only that a town word is formable without spoiling fact cards.
export function townWordsInRack(rack, lex) {
  if (!rack || !rack.length || !lex) return [];
  const counts = new Int8Array(27);
  for (const l of rack) {
    if (l === '?') counts[26]++;
    else {
      const k = l.charCodeAt(0) - 65;
      if (k >= 0 && k < 26) counts[k]++;
    }
  }
  const maxLen = rack.length;
  const need = new Int8Array(26);
  const out = [];
  for (const [w, entry] of lex.byForm) {
    if (w.length > maxLen) continue;
    need.fill(0);
    let blanks = counts[26], ok = true;
    for (let j = 0; j < w.length; j++) {
      const k = w.charCodeAt(j) - 65;
      if (k < 0 || k >= 26) { ok = false; break; }
      if (++need[k] > counts[k]) {
        if (--blanks < 0) { ok = false; break; }
      }
    }
    if (ok) out.push({ word: w, entry });
  }
  return out;
}

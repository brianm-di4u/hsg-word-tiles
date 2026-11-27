// Hot Springs content: the lexicon and fact-card checkers pass, featured picks are sound, and player-facing UI copy uses US English.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ctx, root } from './lib.mjs';
import { createGame } from '../src/js/engine.js';
import { connectError } from '../src/js/score.js';
import { PERSONAS } from '../src/js/personas.js';
import { BARKS } from '../src/js/voices.js';
import { art } from '../src/js/art.js';
import { todaysSprings, boardTextHtml, helpHtml, aboutHtml, reviewHtml } from '../src/js/ui.js';

const stripComments = (code) => {
  let out = '';
  for (let i = 0; i < code.length; ) {
    const c = code[i], n = code[i + 1];
    if (c === "'" || c === '"' || c === '`') {
      const q = c;
      out += code[i++];
      while (i < code.length) {
        const ch = code[i];
        out += code[i++];
        if (ch === '\\' && i < code.length) out += code[i++];
        else if (ch === q) break;
      }
    } else if (c === '/' && n === '/') {
      while (i < code.length && code[i] !== '\n') i++;
    } else if (c === '/' && n === '*') {
      i += 2;
      while (i + 1 < code.length && !(code[i] === '*' && code[i + 1] === '/')) {
        if (code[i] === '\n') out += '\n';
        i++;
      }
      i += 2;
    } else if (c === '<' && code.startsWith('<!--', i)) {
      const end = code.indexOf('-->', i + 4);
      i = end < 0 ? code.length : end + 3;
    } else {
      out += code[i++];
    }
  }
  return out;
};

const UK_UI_RE = /\b(centr(?:e|es|ed|ing)|favour(?:s|ed|ing|ite|ites)?|practis(?:e|ed|es|ing)|licenc(?:e|es|ed|ing)|colour(?:s|ed|ing)?|flavour(?:s|ed|ing)?|honour(?:s|ed|ing)?|parlour(?:s)?|neighbour(?:s|ing)?|harbour(?:s)?|labour(?:s|ed|ing)?|humour(?:s|ed|ing)?|defence|offence|behaviour(?:s)?|labelled|labelling|cancelled|cancelling|catalogue(?:s)?|dialogue(?:s)?|programme(?:s)?|theatre(?:s)?)\b/gi;

const run = (tool) => {
  try { return { ok: true, out: execFileSync(process.execPath, [path.join(root, 'tools', tool)], { cwd: root, encoding: 'utf8' }) }; }
  catch (e) { return { ok: false, out: (e.stdout || '') + (e.stderr || '') }; }
};

export const tests = [
  {
    name: 'lexicon check passes', node: true,
    run(t) { const r = run('check-lexicon.mjs'); t.expect(r.ok, r.out); t.log(r.out.trim().split('\n')[0]); },
  },
  {
    name: 'every fact card verifies', node: true,
    run(t) { const r = run('check-facts.mjs'); t.expect(r.ok, r.out); t.log(r.out.trim().split('\n').pop()); },
  },
  {
    name: 'featured springs over 500 seeds', node: true,
    async run(t) {
      const { lex } = await ctx();
      const seen = new Set();
      for (let seed = 1; seed <= 500; seed++) {
        const s = createGame({ mode: 'play', seats: [{ kind: 'human' }, { kind: 'ai', level: 'easy' }], seed }, lex);
        if (s.featured.length !== 3) t.fail(`seed ${seed}: ${s.featured.length} featured`);
        if (new Set(s.featured.map((f) => f.cat)).size !== 3) t.fail(`seed ${seed}: categories repeat`);
        for (const f of s.featured) {
          seen.add(f.word);
          const e = lex.entry(f.word);
          if (!e || e.tier < 2 || f.word.length < 4 || f.word.length > 8) t.fail(`seed ${seed}: bad featured ${f.word}`);
        }
      }
      t.log(`${seen.size} different featured words over 500 games`);
      t.expect(seen.size > 40, 'variety');
    },
  },
  {
    name: 'W6-S1-01 player-facing UI and voice copy uses American English (excluding thermal-words.json and ENABLE)', node: true,
    async run(t) {
      // Static check across player-facing UI & voice modules (comments stripped; data/thermal-words.json & ENABLE excluded)
      const uiFiles = ['src/js/score.js', 'src/js/main.js', 'src/js/ui.js', 'src/js/personas.js', 'src/js/voices.js', 'src/index.html'];
      const hits = [];
      for (const rel of uiFiles) {
        const lines = stripComments(fs.readFileSync(path.join(root, rel), 'utf8')).split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          const matches = lines[i].match(UK_UI_RE);
          if (matches) hits.push(`${rel}:${i + 1} (${matches.join(', ')})`);
        }
      }
      t.equal(hits.length, 0, `no British English in UI/voice copy: ${hits.join('; ')}`);

      // Runtime check on exported strings & rendered templates for the 12 standardized lines
      const { lex } = await ctx();
      const s = createGame({ mode: 'daily', date: '2026-11-26', seats: [{ kind: 'human', name: 'You' }], seed: 1 }, lex);
      const err = connectError(Array(225).fill(null), [{ i: 0, l: 'A' }, { i: 1, l: 'T' }]);
      t.expect(err && /center\./.test(err) && !/centre/i.test(err), `connectError uses center (${err})`);
      const hollis = PERSONAS.find((p) => p.id === 'hollis');
      t.expect(hollis && /favors park words/.test(hollis.line), `Hollis bio uses favors (${hollis?.line})`);
      t.expect(BARKS.lucky.themed.some((l) => /local favorite\./.test(l)), 'Lucky bark uses favorite');
      t.expect(BARKS.julian.lose.some((l) => /I'll practice\./.test(l)), 'Julian bark uses practice');
      t.expect(/Display Spring in the center\./.test(todaysSprings(s, lex, false, true).html), 'todaysSprings wide uses center');
      t.expect(/center square\./.test(todaysSprings(s, lex, true, true).html), 'todaysSprings compact uses center');
      t.expect(/H8 is the center square\./.test(boardTextHtml(s, [])), 'boardTextHtml uses center');
      const prevArt = art.on;
      art.on = false;
      try {
        t.expect(/at the center/.test(helpHtml('rules', lex)), 'helpHtml rules uses center');
        t.expect(/in the center/.test(helpHtml('squares', lex)), 'helpHtml squares uses center');
        t.expect(/permissive license\)/.test(aboutHtml({ words: 168271, added: 28 })), 'aboutHtml uses license');
      } finally { art.on = prevArt; }
      const rev = reviewHtml({ total: 1, found: 0, misses: [{ turn: 1, kind: 'pass', best: { word: 'SPA', score: 12, at: 112, dir: 'across' } }], skipped: 0, cut: 0, casual: true });
      t.expect(/H8 is the center square\./.test(rev), 'reviewHtml uses center');
    },
  },
];

// Hot Springs content: the lexicon and fact-card checkers pass, and featured picks are sound.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { ctx, root } from './lib.mjs';
import { createGame } from '../src/js/engine.js';

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
];

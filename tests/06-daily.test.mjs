// The Daily Soak deals the same tiles for a date on any device: 400 dates are hashed and compared with the
// golden file (tests/golden-daily.json, written once with --write-golden), in three time zones.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { root } from './lib.mjs';

const GOLDEN = path.join(root, 'tests', 'golden-daily.json');
// The hashing runs in a child process so each run can set its own TZ.
const SCRIPT = `
import fs from 'node:fs';
import crypto from 'node:crypto';
import { makeLexicon } from '../src/js/lexicon.js';
import { createGame } from '../src/js/engine.js';
const lex = makeLexicon(JSON.parse(fs.readFileSync('data/thermal-words.json', 'utf8')));
const out = {};
const d = new Date(Date.UTC(2026, 0, 1, 12));
for (let k = 0; k < 400; k++) {
  const date = new Date(d.getTime() + k * 86400000).toISOString().slice(0, 10);
  const s = createGame({ mode: 'daily', date }, lex);
  out[date] = crypto.createHash('sha1').update(s.bag.join('') + '|' + s.players[0].rack.join('') + '|' + s.featured.map((f) => f.word + f.shown.join('.')).join(',')).digest('hex').slice(0, 12);
}
process.stdout.write(JSON.stringify(out));
`;
function hashes(tz) {
  const f = path.join(root, 'tests', '.daily-hash.mjs');
  fs.writeFileSync(f, SCRIPT);
  try { return JSON.parse(execFileSync(process.execPath, [f], { cwd: root, env: { ...process.env, TZ: tz }, encoding: 'utf8' })); }
  finally { fs.rmSync(f, { force: true }); }
}

export const tests = [
  {
    name: 'daily deals match the golden hashes in three time zones', node: true,
    run(t) {
      const ref = hashes('America/Chicago');
      if (process.argv.includes('--write-golden') || !fs.existsSync(GOLDEN)) { fs.writeFileSync(GOLDEN, JSON.stringify(ref, null, 0) + '\n'); t.log('golden file written'); }
      const golden = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
      for (const tz of ['America/Chicago', 'Pacific/Honolulu', 'Asia/Tokyo']) {
        const h = tz === 'America/Chicago' ? ref : hashes(tz);
        const bad = Object.keys(golden).filter((d) => golden[d] !== h[d]);
        t.equal(bad.length, 0, `${tz}: ${bad.length} dates differ`);
      }
      t.equal(new Set(Object.values(golden)).size, 400, '400 different deals');
      t.log(`sha of golden: ${crypto.createHash('sha1').update(JSON.stringify(golden)).digest('hex').slice(0, 10)}`);
    },
  },
];

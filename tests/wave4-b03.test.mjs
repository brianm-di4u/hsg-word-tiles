// Wave 4, batch W4-B03 (WF-1 core loop rules): W1-S1-06, W1-S2-03 and W1-S4-08, what the earlier waves left of them. W1-S2-02 (the Swap dialog's
// stall warning) was already built by 458a235 (tests: wave3-b06), the 2L/3L/2W/3W discs by 29fded3 and the preview note on a plain play over
// the Row by 27353a3 (tests: wave4-b01).
import fs from 'node:fs';
import path from 'node:path';
import { root } from './lib.mjs';
import { SUPPLEMENT } from '../src/js/supplement.js';

const doc = (f) => fs.readFileSync(path.join(root, f), 'utf8').replace(/\s+/g, ' ');

export const tests = [
  // ---------- W1-S1-06 ----------
  {
    name: 'W1-S1-06 the rules documents say what the game does: the Row adds a flat +20, Challenge mode is in it, and QI and ZA are playable (Node)',
    node: true,
    run(t) {
      for (const f of ['MECHANICS.md', 'PRD.md', 'README.md', 'REPORT.md', 'TEST-CAMPAIGN.md', 'src/js/layout.js', 'tools/build-layout.mjs']) t.expect(!/Row (squares? )?doubl|doubles? (the|its) (tier )?bonus|double the bonus/i.test(doc(f)), `${f}: no doubling on the Row`);
      t.expect(/adds a flat \+20 to a Hot Springs word/.test(doc('src/js/layout.js')) && /adds a flat \+20 to a Hot Springs word/.test(doc('tools/build-layout.mjs')), 'layout.js and its generator');
      t.expect(/add a flat \+20 to a Hot Springs word/.test(doc('REPORT.md')), 'REPORT.md');
      const out = doc('PRD.md').split('## 12. Out of scope')[1];
      t.expect(!!out && /word definitions/.test(out), 'PRD.md still lists what is out of scope');
      t.expect(/data-challenge/.test(doc('src/js/ui.js')) && !/challenge/i.test(out), 'Setup offers Challenge mode, so it is not out of scope');
      const gaps = doc('REPORT.md').split('## Known gaps')[1].split('## ')[0];
      t.expect(SUPPLEMENT.includes('QI') && SUPPLEMENT.includes('ZA') && gaps.includes(`the ${SUPPLEMENT.length}-word supplement (\`src/js/supplement.js\`) adds them`), 'REPORT.md says the supplement adds QI and ZA');
    },
  },
];

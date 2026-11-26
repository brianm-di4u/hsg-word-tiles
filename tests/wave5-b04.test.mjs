// Wave 5, batch W5-B04: W6-S6-05 (sync REPORT.md, README.md, PRD.md with Wave-4/5 metrics and drop unused MirroredRepeatWrapping).
import fs from 'node:fs';
import path from 'node:path';
import { root } from './lib.mjs';

const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

export const tests = [
  {
    name: 'W6-S6-05 tools/build-three.mjs and rebuilt src/js/three-lib.js drop unused MirroredRepeatWrapping while keeping active exports (Node)',
    node: true,
    async run(t) {
      const buildThree = read('tools/build-three.mjs');
      t.equal(/['"]MirroredRepeatWrapping['"]/.test(buildThree), false, 'tools/build-three.mjs removes unused MirroredRepeatWrapping');
      t.equal(/['"]RepeatWrapping['"]/.test(buildThree), true, 'tools/build-three.mjs retains RepeatWrapping');
      const { THREE } = await import(new URL('../src/js/three-lib.js', import.meta.url).href);
      t.equal(THREE.MirroredRepeatWrapping, undefined, 'src/js/three-lib.js drops unused THREE.MirroredRepeatWrapping');
      for (const name of ['RepeatWrapping', 'InstancedMesh', 'SpotLight', 'MeshPhysicalMaterial', 'MeshStandardMaterial']) {
        t.expect(THREE[name] !== undefined, `src/js/three-lib.js keeps THREE.${name}`);
      }
    },
  },
  {
    name: 'W6-S6-05 REPORT.md, README.md, and PRD.md reflect Wave-4/5 metrics, art provenance, HSG_WORKSPACE opt-in, and X4122 note (Node)',
    node: true,
    run(t) {
      const report = read('REPORT.md');
      const readme = read('README.md');
      const prd = read('PRD.md');

      // REPORT.md: 95 bank + 12 corpus = 107/107 cards, 805+ wave tests, music approval, visual status, X4122 note
      t.expect(report.includes('95 from the audited trivia bank, 12 quoting the research corpus'), 'REPORT.md cites 95 bank + 12 corpus (107/107) cards');
      t.equal(report.includes('59 from the audited trivia bank'), false, 'REPORT.md drops stale 59+11 card count');
      t.expect(/805\/805/.test(report), 'REPORT.md cites Wave-4 805/805 test count');
      t.equal(report.includes('visual gate was not met'), false, 'REPORT.md drops stale visual-gate-not-met note');
      t.equal(report.includes('Nobody has listened to the sound'), false, 'REPORT.md drops stale nobody-listened note');
      t.expect(report.includes('OQ-WF7-W3-06'), 'REPORT.md cites owner music approval OQ-WF7-W3-06');
      t.expect(report.includes('X4122'), 'REPORT.md retains CD-WF6-01 Windows ANGLE X4122 note');
      // W5-B05-hotfix follow-up 4 (OQ-WF7-W5-03): REPORT.md keeps measured facts; pipeline audit scores stay in the run folder
      t.equal(/WF-6[^\n]*audit|`PASS` on Vision|Agency \(`?\d/.test(report), false, 'REPORT.md quotes no WF-6 audit scores or verdicts');

      // PRD.md: honed travertine / twilight Night marble and 18 vignettes
      t.expect(/honed warm travertine marble/i.test(prd) && /twilight/i.test(prd), 'PRD.md describes honed travertine and twilight Night marble');
      t.equal(/polished white marble/i.test(prd), false, 'PRD.md drops stale polished white marble');
      t.expect(/18 landmark vignettes/.test(prd), 'PRD.md cites 18 landmark vignettes');
      t.equal(/31 landmark vignettes/.test(prd), false, 'PRD.md drops stale 31 landmark vignettes');

      // README.md: consistent HSG_WORKSPACE opt-in + OpenAI and Gemini art provenance
      t.equal(readme.includes("when it is unset, the workspace is this repo's grandparent"), false, 'README.md removes contradictory HSG_WORKSPACE grandparent fallback');
      t.expect(readme.includes('strictly repo-local'), 'README.md states repo-local default when HSG_WORKSPACE is unset');
      t.expect(/OpenAI and Gemini image generation/.test(readme), 'README.md credits OpenAI and Gemini image generation');
    },
  },
];

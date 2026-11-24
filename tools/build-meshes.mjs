#!/usr/bin/env node
// Exports the 3D pieces from art-src/blender/pieces.py to src/js/pieces-mesh.js via headless Blender.
// Resolves BLENDER_BIN from the environment, falling back to `blender` on PATH.
//   npm run build:meshes
//   BLENDER_BIN="/path/to/blender" npm run build:meshes
//   node tools/build-meshes.mjs render art-src/blender/renders
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = (process.env.BLENDER_BIN || '').trim() || 'blender';
const extra = process.argv.slice(2);
const scriptArgs = extra.length ? extra : ['export', 'src/js/pieces-mesh.js'];
const blenderArgs = ['-b', '--factory-startup', '--python', path.join('art-src', 'blender', 'pieces.py'), '--', ...scriptArgs];

try {
  execFileSync(bin, blenderArgs, { cwd: root, stdio: 'inherit' });
} catch (err) {
  if (err && err.code === 'ENOENT') {
    console.error(`build:meshes: Blender executable "${bin}" not found. Install Blender on PATH or set BLENDER_BIN.`);
    process.exit(1);
  }
  process.exit(typeof err?.status === 'number' ? err.status : 1);
}

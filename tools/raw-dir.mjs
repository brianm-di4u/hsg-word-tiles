// Where the raw word lists live (git-ignored, refetched by tools/fetch-wordlists.mjs): repo-local data/raw/
// by default (dictionary tests skip cleanly when absent), or $HSG_WORKSPACE/reference/word-lists/ only when
// HSG_WORKSPACE is set explicitly (W3-S3-14).
import fs from 'node:fs';
import path from 'node:path';

export function rawDir(root, env = process.env) {
  const ws = env && typeof env.HSG_WORKSPACE === 'string' ? env.HSG_WORKSPACE.trim() : '';
  if (ws) {
    const shared = path.join(ws, 'reference');
    if (fs.existsSync(shared)) return path.join(shared, 'word-lists');
  }
  return path.join(root, 'data/raw');
}

// Where the raw word lists live (git-ignored, refetched by tools/fetch-wordlists.mjs): the Hot Springs Games
// workspace's shared reference/word-lists/ when this repo sits in it, else data/raw/ here.
import fs from 'node:fs';
import path from 'node:path';

export function rawDir(root) {
  const shared = path.resolve(root, '..', '..', 'reference');
  return fs.existsSync(shared) ? path.join(shared, 'word-lists') : path.join(root, 'data/raw');
}

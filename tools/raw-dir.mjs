// Where the raw word lists live (git-ignored, refetched by tools/fetch-wordlists.mjs): the Hot Springs Games
// workspace's shared reference/word-lists/ when there is one, else data/raw/ here. The workspace is $HSG_WORKSPACE, else this
// repo's grandparent (the workspace root when the repo sits in <workspace>/repos/).
import fs from 'node:fs';
import path from 'node:path';

export function rawDir(root) {
  const shared = path.join(process.env.HSG_WORKSPACE || path.resolve(root, '..', '..'), 'reference');
  return fs.existsSync(shared) ? path.join(shared, 'word-lists') : path.join(root, 'data/raw');
}

// Seeded randomness. mulberry32 by Tommy Ettinger, as published (public domain) in bryc/code
// jshash/PRNGs.md (commit 88c1317), by way of Bathhouse Barons' rng.js. Each stream's whole state is
// one uint32 kept in state.rng[stream], so a saved game resumes the exact same sequence.

export function seedState(n) {
  return (Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b) >>> 0) || 1;
}

// Advances state.rng[stream] and returns a float in [0, 1).
export function rand(s, stream) {
  let a = (s.rng[stream] + 0x6d2b79f5) | 0;
  s.rng[stream] = a >>> 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function shuffle(s, stream, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand(s, stream) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// FNV-1a of a string → uint32, for the Daily seed.
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

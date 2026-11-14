// Words added to the packed ENABLE list when the dictionary loads (dict.js loadDict): the standard
// two-letter tools for the single Q and the Z and a few everyday modern words, for the player's checks and
// for the computer opponents alike. A word the packed list already holds is skipped, and the blocklist
// still applies. The packed file data/dict.b64.txt is left as it is.
export const SUPPLEMENT = [
  'QI', 'QIS', 'ZA', 'ZAS', 'OK', 'EW', 'KI', 'KIS', 'FE', 'FES', 'GI', 'GIS', 'OI',
  'EMAIL', 'EMAILS', 'EMAILED', 'EMAILING', 'ONLINE', 'APP', 'APPS',
  'BLOG', 'BLOGS', 'BLOGGED', 'BLOGGING', 'BLOGGER', 'BLOGGERS', 'EMOJI', 'EMOJIS',
];

// The ones among them that count as common words (the Easy computer plays them); the two-letter tools stay rare.
export const SUPPLEMENT_COMMON = new Set([
  'EMAIL', 'EMAILS', 'EMAILED', 'EMAILING', 'ONLINE', 'APP', 'APPS',
  'BLOG', 'BLOGS', 'BLOGGED', 'BLOGGING', 'BLOGGER', 'BLOGGERS', 'EMOJI', 'EMOJIS',
]);

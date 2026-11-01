// Painted art and fonts (adapted from Bathhouse Barons). Images load with new Image() + decode() (works from
// file:// and http); the vector art in render2d.js is the fallback (?art=0, or while loading). Only names in
// assets/manifest.json (inlined as ART_LIST) are requested, so a missing file can never 404.
import { ART_LIST } from './art-list.js';

export const art = {
  on: true, imgs: {}, loading: 0, done: false, fonts: false, failed: [], want: [], version: 0,
  ready(name) { return this.on && !!this.imgs[name]; },
  img(name) { return this.on ? this.imgs[name] || null : null; },
  has(name) { return ART_LIST.includes(name); },
  src(name) { return (window.__ART_DATA && window.__ART_DATA[name]) || `assets/${name}.webp`; },
};
const FONTS = ['16px "Limelight"', '400 16px "Fraunces"', 'italic 400 16px "Fraunces"', '600 16px "Fraunces"', '800 16px "Fraunces"',
  '400 16px "Josefin Sans"', '600 16px "Josefin Sans"', '700 16px "Josefin Sans"'];

function load(name) {
  return new Promise((res) => {
    const im = new Image();
    im.src = art.src(name);
    im.decode().then(() => { art.imgs[name] = im; res(true); }, () => { art.failed.push(name); res(false); });
  });
}

// Loads the fonts and every canvas-drawn image; onReady runs once everything has settled.
export function loadArt(onReady) {
  const q = new URLSearchParams(location.search);
  if (q.get('art') === '0') art.on = false;
  // Portraits, the title painting and vignettes are plain <img> tags; only what canvases draw is preloaded.
  art.want = art.on ? ART_LIST.filter((n) => !/^(title-|face-|vig-)/.test(n)) : [];
  art.loading = 1;
  // The vendored fonts travel as data URIs inside assets/fonts.css (Chrome blocks @font-face files on file://).
  const css = new Promise((res) => {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'assets/fonts.css';
    l.onload = () => res(); l.onerror = () => res(); document.head.append(l);
  });
  const fonts = css.then(() => (document.fonts && document.fonts.load ? Promise.all(FONTS.map((f) => document.fonts.load(f))) : null))
    .then(() => { art.fonts = true; }, () => { art.fonts = true; });
  // From file://, WebGL can't take local image files (tainted canvas), so canvas art comes as data URLs instead.
  const data = location.protocol === 'file:' && ART_LIST.length ? new Promise((res) => {
    const sc = document.createElement('script'); sc.src = 'assets/art-data.js'; sc.onload = () => res(); sc.onerror = () => res(); document.head.append(sc);
  }) : Promise.resolve();
  Promise.all([fonts, data.then(() => Promise.all(art.want.map(load)))]).then(() => {
    art.loading = 0; art.done = true; art.version++; art.readyMs = Math.round(performance.now()); onReady && onReady();
  });
}

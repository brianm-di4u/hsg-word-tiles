// The 3D board (adapted from Bathhouse Barons' board3d.js): the marble board face that render2d.js paints into a
// 2048-px canvas becomes the top of a slab in a mitred walnut-and-brass frame on a bathhouse counter, under a warm
// lamp, with Blender-modelled ceramic tiles (letter faces drawn in code), a stack of bath towels and a desk bell.
// The camera follows render2d's view (zoom and pan in board cells), so input, overlays and hit-testing are shared
// with the 2D board: overlays are projected through this camera (render2d proj.fn).
// Falls back to the 2D board when there is no WebGL, on software GL (unless forced), with ?gl=0, or on slow frames.
import { THREE } from './three-lib.js';
import { MESHES } from './pieces-mesh.js';
import * as R from './render2d.js';
import { art } from './art.js';
import { N, CENTER } from './score.js';

const U = R.U, HALF = U / 2, TOP = 0.3;   // board face height in world units (1 unit = 1 square)
export const B3 = { on: false, mode: 'auto', tried: false, reason: '', renderer: null, frames: [], intervals: [], tiles: [], W: 0, H: 0, dpr: 1, dark: false, texKey: '' };
export function want(mode) { B3.mode = mode; B3.tried = false; }

// ---------- capability ----------
export function probe(force) {
  if (force === 'off' || /[?&]gl=0\b/.test(location.search)) return { ok: false, why: 'off' };
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return { ok: false, why: 'no-webgl' };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    if (/swiftshader|llvmpipe|software|basic render/i.test(name) && force !== 'on') return { ok: false, why: 'software-gl', name };
    return { ok: true, name };
  } catch (e) { return { ok: false, why: 'error' }; }
}

// ---------- meshes ----------
function b64(s, T) { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new T(u.buffer); }
// Blender (z up, cells) → three (y up): (x, y, z) → (x, z, -y)
function geometries(name) {
  const d = MESHES[name];
  return d.g.map((g) => {
    const q = b64(g.p, Int16Array), n = b64(g.n, Int8Array), idx = b64(g.i, Uint16Array);
    const pos = new Float32Array(q.length), nor = new Float32Array(q.length), uv = new Float32Array(q.length / 3 * 2);
    for (let i = 0, j = 0; i < q.length; i += 3, j += 2) {
      const bx = d.lo[0] + (q[i] + 32768) / 65535 * (d.hi[0] - d.lo[0]);
      const by = d.lo[1] + (q[i + 1] + 32768) / 65535 * (d.hi[1] - d.lo[1]);
      const bz = d.lo[2] + (q[i + 2] + 32768) / 65535 * (d.hi[2] - d.lo[2]);
      pos[i] = bx; pos[i + 1] = bz; pos[i + 2] = -by;
      nor[i] = n[i] / 127; nor[i + 1] = n[i + 2] / 127; nor[i + 2] = -n[i + 1] / 127;
      // planar UVs from the footprint (used by the tile's letter face)
      uv[j] = (bx - d.lo[0]) / (d.hi[0] - d.lo[0]); uv[j + 1] = (by - d.lo[1]) / (d.hi[1] - d.lo[1]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.computeBoundingSphere();
    return { geo, mat: g.mat };
  });
}
function stdMaterial(m) {
  const P = { color: new THREE.Color(m.c), metalness: m.m, roughness: Math.max(0.12, m.r) };
  return m.k ? new THREE.MeshPhysicalMaterial({ ...P, clearcoat: m.k, clearcoatRoughness: 0.12 }) : new THREE.MeshStandardMaterial(P);
}
function piece(name) {
  const grp = new THREE.Group();
  for (const g of geometries(name)) { const mm = new THREE.Mesh(g.geo, stdMaterial(g.mat)); mm.castShadow = true; mm.receiveShadow = true; grp.add(mm); }
  return grp;
}
function canvasTex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, B3.renderer.capabilities.getMaxAnisotropy()); return t;
}

// The tile's top face: glaze, letter and value, drawn once per letter & theme.
const faceCache = new Map();
function faceMaterial(l, blank, dark = false) {
  const key = (dark ? 'D:' : 'L:') + (blank ? '?' : '') + l;
  if (faceCache.has(key)) return faceCache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = 512;
  c.getContext('2d').drawImage(R.tileSprite(l, blank, 512, 'face', dark ? 'dark' : 'light'), 0, 0);
  // a touch of self-light keeps the glazed faces crisp ivory in Day and warm #EDE5D4 ivory in Night
  const tex = canvasTex(c);
  const m = new THREE.MeshPhysicalMaterial({ map: tex, emissiveMap: tex, emissive: dark ? 0xffe4be : 0xffffff, emissiveIntensity: dark ? 0.08 : 0.14, roughness: 0.55, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.4 });
  faceCache.set(key, m);
  return m;
}

// woven terry for the towels: muted linen base tinted per theme in setTheme() (#B5A892 day taupe / #524B61 night twilight)
function clothTexture(grp) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#F2F0EC'; g.fillRect(0, 0, 256, 256);
  let s = 1337;
  const rnd = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let k = 0; k < 2600; k++) { const x = rnd() * 256, y = rnd() * 256; const v = Math.round(165 + rnd() * 55); g.fillStyle = `rgba(${v},${v - 4},${v - 10},0.18)`; g.fillRect(x, y, 2, 2); }
  for (let y = 0; y < 256; y += 6) { g.fillStyle = 'rgba(110,102,90,0.09)'; g.fillRect(0, y, 256, 2); }
  const t = canvasTex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3);
  B3.towelCloth = []; B3.towelStripe = [];
  grp.traverse((o) => {
    if (!o.material || !o.material.color) return;
    if (o.material.color.getHex() > 0xe0e0e0) { o.material.map = t; o.material.color.set(0xb5a892); o.material.needsUpdate = true; B3.towelCloth.push(o.material); }
    else { B3.towelStripe.push(o.material); }
  });
}

function envMap() {
  const pm = new THREE.PMREMGenerator(B3.renderer), sc = new THREE.Scene();
  sc.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, color: 0x8f7a64 })));
  const panel = (c, x, y, z, s) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); sc.add(m); };
  panel(0xfff0d0, -4, 7, -3, 6); panel(0xc8d8ff, 6, 3, 6, 5); panel(0xffd9a0, 0, 2, 9, 7); panel(0x3a2414, 0, -8, 0, 16);
  const t = pm.fromScene(sc, 0.02).texture; pm.dispose();
  return t;
}

// ---------- build ----------
export function init(canvas, theme) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
  catch (e) { B3.reason = 'context'; return false; }
  B3.renderer = renderer; B3.canvas = canvas;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene(); B3.scene = scene;
  scene.environment = envMap(); scene.environmentIntensity = 0.5;
  B3.camera = new THREE.PerspectiveCamera(28, 1, 0.5, 400);
  B3.hemi = new THREE.HemisphereLight(0xfff1dc, 0x6a4a2c, 0.6); scene.add(B3.hemi);
  const key = new THREE.SpotLight(0xfff0d8, 900, 0, 0.7, 0.95, 1.6);
  key.position.set(-6, 30, -4); key.target.position.set(0, 0, 0.5);
  key.castShadow = true; const sm = Math.min(window.innerWidth, window.innerHeight) < 600 ? 1024 : 2048;
  key.shadow.mapSize.set(sm, sm); key.shadow.camera.near = 10; key.shadow.camera.far = 60; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03; key.shadow.radius = 3;
  scene.add(key); scene.add(key.target); B3.key = key;
  B3.fill = new THREE.DirectionalLight(0xcfe0ff, 0.5); B3.fill.position.set(12, 10, 16); scene.add(B3.fill);
  // counter and board slab
  B3.table = new THREE.Mesh(new THREE.PlaneGeometry(64, 42), new THREE.MeshPhysicalMaterial({ roughness: 0.42, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.25 }));
  B3.table.rotation.x = -Math.PI / 2; B3.table.receiveShadow = true; scene.add(B3.table);
  B3.boardCanvas = null;
  B3.top = new THREE.MeshPhysicalMaterial({ roughness: 0.55, metalness: 0, clearcoat: 0.18, clearcoatRoughness: 0.45 });
  const side = new THREE.MeshStandardMaterial({ color: 0x3a2414, roughness: 0.6 });
  B3.board = new THREE.Mesh(new THREE.BoxGeometry(U, TOP, U), [side, side, B3.top, side, side, side]);
  B3.board.position.y = TOP / 2; B3.board.receiveShadow = true; B3.board.castShadow = true; scene.add(B3.board);
  // W2-S5-01: Turn-1 gentle pre-dim quads on outer-ring DIMMABLE squares seated beneath 3D tiles (y = TOP + 0.002).
  // Built as one merged BufferGeometry (1 draw call, zero extra Three.js exports).
  const preCount = R.DIMMABLE.length;
  const prePos = new Float32Array(preCount * 4 * 3);
  const preIdx = new Uint16Array(preCount * 6);
  const preHalf = 0.465, preY = TOP + 0.002;
  R.DIMMABLE.forEach((cellIdx, k) => {
    const cx = R.FRAME + (cellIdx % N) + 0.5 - HALF;
    const cz = R.FRAME + Math.floor(cellIdx / N) + 0.5 - HALF;
    const v = k * 4, o = v * 3;
    prePos[o] = cx - preHalf; prePos[o + 1] = preY; prePos[o + 2] = cz - preHalf;
    prePos[o + 3] = cx + preHalf; prePos[o + 4] = preY; prePos[o + 5] = cz - preHalf;
    prePos[o + 6] = cx + preHalf; prePos[o + 7] = preY; prePos[o + 8] = cz + preHalf;
    prePos[o + 9] = cx - preHalf; prePos[o + 10] = preY; prePos[o + 11] = cz + preHalf;
    const io = k * 6;
    preIdx[io] = v; preIdx[io + 1] = v + 3; preIdx[io + 2] = v + 2;
    preIdx[io + 3] = v; preIdx[io + 4] = v + 2; preIdx[io + 5] = v + 1;
  });
  const preGeo = new THREE.BufferGeometry();
  preGeo.setAttribute('position', new THREE.BufferAttribute(prePos, 3));
  preGeo.setIndex(new THREE.BufferAttribute(preIdx, 1));
  const preMat = new THREE.MeshBasicMaterial({ color: 0x1e140a, transparent: true, opacity: R.PRE_DIM, depthWrite: false });
  B3.preDim = new THREE.Mesh(preGeo, preMat);
  B3.preDim.renderOrder = 1;
  B3.preDim.visible = false;
  scene.add(B3.preDim);
  B3.frame = piece('frame'); B3.frame.scale.set(U / 16, 1, U / 16); scene.add(B3.frame);
  // set dressing on the counter, outside the board
  // beside the board's far corners, where perspective leaves the most counter in view: towels and the desk bell
  B3.towels = piece('towels'); clothTexture(B3.towels); B3.towels.scale.setScalar(0.8); B3.towels.position.set(-HALF - 2.15, 0, -HALF + 1.7); B3.towels.rotation.y = Math.PI / 2 - 0.08; scene.add(B3.towels);
  B3.bell = piece('bell'); B3.bell.scale.setScalar(0.8); B3.bell.position.set(HALF + 1.75, 0, -HALF + 1.6); scene.add(B3.bell);
  // tile pool: body geometry shared, face material per letter
  B3.tileGeo = geometries('tile');
  B3.bodyMat = stdMaterial(B3.tileGeo.find((g) => g.mat.name === 'tilebody').mat);
  B3.stagedMat = B3.bodyMat.clone(); B3.stagedMat.emissive = new THREE.Color(0xd9a23a); B3.stagedMat.emissiveIntensity = 0.35;
  B3.lastMat = B3.bodyMat.clone(); B3.lastMat.color = new THREE.Color(0xF0D57A); B3.lastMat.emissive = new THREE.Color(0xD9A23A); B3.lastMat.emissiveIntensity = 0.3;
  B3.tiles = [];
  setTheme(theme);
  B3.on = true;
  R.proj.fn = (bx, by, lift = 0) => screenOf(bx, by, lift);
  return true;
}
function tileMesh() {
  const g = new THREE.Group();
  const body = B3.tileGeo.find((x) => x.mat.name === 'tilebody'), face = B3.tileGeo.find((x) => x.mat.name === 'tiletop');
  const mb = new THREE.Mesh(body.geo, B3.bodyMat), mf = new THREE.Mesh(face.geo, B3.bodyMat);
  for (const m of [mb, mf]) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
  g.userData = { body: mb, face: mf };
  B3.scene.add(g);
  return g;
}

export function destroy() {
  if (!B3.renderer) return;
  B3.renderer.dispose(); B3.renderer.forceContextLoss?.();
  B3.on = false; B3.renderer = null; R.proj.fn = null; faceCache.clear(); B3.intervals.length = 0;
}

export function setTheme(theme) {
  if (!B3.renderer) return;
  const dark = theme === 'dark';
  B3.dark = dark;
  // the counter: the painted walnut when it has loaded, else a plain finish
  const hasCounter = art.ready('counter');
  B3.counterArt = hasCounter;
  const c = document.createElement('canvas'); c.width = 2048; c.height = 1365;
  const g = c.getContext('2d');
  if (hasCounter) g.drawImage(art.img('counter'), 0, 0, c.width, c.height);
  else { const gr = g.createLinearGradient(0, 0, 2048, 1365); gr.addColorStop(0, '#5A3A22'); gr.addColorStop(1, '#3A2414'); g.fillStyle = gr; g.fillRect(0, 0, 2048, 1365); }
  if (dark) { g.fillStyle = 'rgba(10,8,22,0.55)'; g.fillRect(0, 0, c.width, c.height); }
  B3.table.material.map?.dispose(); B3.table.material.map = canvasTex(c);
  
  B3.table.material.map.wrapS = B3.table.material.map.wrapT = THREE.MirroredRepeatWrapping; B3.table.material.map.repeat.set(2, 2);
  B3.table.material.needsUpdate = true;
  // W2-S2-06: tone Tier-3 counter towels down to muted warm taupe linen (day) / shadowed twilight linen (night)
  const towelHex = dark ? 0x524b61 : 0xb5a892;
  const stripeHex = dark ? 0x26444a : 0x3b7870;
  for (const m of B3.towelCloth || []) { m.color.set(towelHex); m.needsUpdate = true; }
  for (const m of B3.towelStripe || []) { m.color.set(stripeHex); m.needsUpdate = true; }
  // W2-S1-04: Night lighting uses a warm brass-lamp key (0xffe1b0, ~500) over cool twilight fill (0x5c72b8)
  B3.key.intensity = dark ? 500 : 900; B3.key.color.set(dark ? 0xffe1b0 : 0xfff0d8);
  B3.hemi.color.set(dark ? 0x8697c8 : 0xfff1dc); B3.hemi.groundColor.set(dark ? 0x1d182c : 0x6a4a2c); B3.hemi.intensity = dark ? 0.28 : 0.6;
  B3.fill.intensity = dark ? 0.4 : 0.5; B3.fill.color.set(dark ? 0x5c72b8 : 0xcfe0ff);
  B3.scene.environmentIntensity = dark ? 0.28 : 0.5;
  if (B3.bodyMat) { B3.bodyMat.color.set(dark ? 0xd8cdb6 : 0xeadfc4); B3.bodyMat.needsUpdate = true; }
  B3.texKey = '';
}

// ---------- camera ----------
let TILT = 0.5, MARGIN = 0.02;
// Portrait (phone) camera: solved directly at the rendered tilt (0.09 rad, within 0.08-0.10 rad) including the
// full walnut frame bezel (FRAME_EXTENT), so Row 1-15 and all four walnut rails stay unobstructed inside #boardwrap.
const PORTRAIT_TILT = 0.09, PORTRAIT_SHIFT = 0;
const FRAME_EXTENT = 8.92 * (U / 16);
export function resize(w, h) {
  if (!B3.renderer) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  B3.W = w; B3.H = h; B3.dpr = dpr;
  B3.renderer.setPixelRatio(dpr); B3.renderer.setSize(w, h, false);
  B3.camera.aspect = w / h; B3.camera.updateProjectionMatrix();
  const tall = h > w * 0.98;
  TILT = tall ? PORTRAIT_TILT : 0.3; MARGIN = tall ? 0.008 : 0.025;
  // on phones the board fills the width and the props would only show as slivers
  B3.tall = tall; B3.towels.visible = B3.bell.visible = !tall;
  B3.top.clearcoat = tall ? 0.08 : 0.18;
  B3.fit = fitDistance();
}
function applyPose(tx, tz, dist) {
  const c = B3.camera;
  c.position.set(tx, Math.cos(TILT) * dist, tz + Math.sin(TILT) * dist);
  c.lookAt(tx, 0, tz); c.updateMatrixWorld();
}
// the distance at which the board (with its frame) just fits the view
function fitDistance() {
  const v = new THREE.Vector3();
  const E = B3.tall ? FRAME_EXTENT : HALF * 16 / U * 1.12;
  const tz = B3.tall ? PORTRAIT_SHIFT : 0.2;
  const pts = B3.tall
    ? [[-E, 0.56, -E], [E, 0.56, -E], [-E, 0, -E], [E, 0, -E], [-E, 0.56, E], [E, 0.56, E], [-E, 0, E], [E, 0, E]]
    : [[-E, 0.6, -E], [E, 0.6, -E], [-E, 0, E], [E, 0, E]];
  const fits = (dist) => {
    applyPose(0, tz, dist);
    for (const [x, y, z] of pts) { v.set(x, y, z).project(B3.camera); if (Math.abs(v.x) > 1 - MARGIN || Math.abs(v.y) > 1 - MARGIN) return false; }
    return true;
  };
  let lo = 5, hi = 200;
  for (let k = 0; k < 32; k++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
  return hi;
}
function bezelBounds() {
  if (!B3.on || !B3.camera) return null;
  const p = pose();
  applyPose(p.tx, p.tz, p.dist);
  const v = new THREE.Vector3(), E = FRAME_EXTENT;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y, z] of [[-E, 0.56, -E], [E, 0.56, -E], [-E, 0, -E], [E, 0, -E], [-E, 0.56, E], [E, 0.56, E], [-E, 0, E], [E, 0, E]]) {
    v.set(x, y, z).project(B3.camera);
    const sx = (v.x + 1) / 2 * B3.W, sy = (1 - v.y) / 2 * B3.H;
    if (sx < minX) minX = sx; if (sx > maxX) maxX = sx;
    if (sy < minY) minY = sy; if (sy > maxY) maxY = sy;
  }
  return { minX, maxX, minY, maxY, W: B3.W, H: B3.H };
}
function pose() {
  const v = R.view;
  return { tx: v.cx - HALF, tz: v.cy - HALF + (v.zoom > 1.01 ? 0 : B3.tall ? PORTRAIT_SHIFT : 0.2), dist: B3.fit / v.zoom };
}

// ---------- per frame ----------
export function render(d) {
  if (!B3.on) return;
  const t0 = performance.now();
  // board face: the same texture the 2D board uses
  const tex = R.boardTexture(d.theme);
  if (tex !== B3.boardCanvas) { B3.top.map?.dispose(); B3.top.map = canvasTex(tex); B3.top.map.minFilter = THREE.LinearMipmapLinearFilter; B3.top.needsUpdate = true; B3.boardCanvas = tex; }
  if (B3.preDim) B3.preDim.visible = !d.board[CENTER] && !(d.staged && d.staged.some((t) => t.i === CENTER));
  // tiles: placed, then staged; the dragged staged tile is hidden
  const want = [];
  for (let i = 0; i < N * N; i++) if (d.board[i]) want.push({ i, t: d.board[i], kind: d.last && d.last.has(i) ? 'last' : 'board' });
  for (const t of d.staged || []) if (d.dragFrom !== t.i) want.push({ i: t.i, t, kind: 'staged' });
  while (B3.tiles.length < want.length) B3.tiles.push(tileMesh());
  B3.tiles.forEach((g, k) => {
    const w = want[k];
    g.visible = !!w;
    if (!w) return;
    const x = R.FRAME + (w.i % N) + 0.5 - HALF, z = R.FRAME + Math.floor(w.i / N) + 0.5 - HALF;
    let lift = w.kind === 'staged' ? 0.06 : 0, sc = 1;
    const a = d.anim && d.anim.get(w.i);
    if (a && w.kind !== 'staged') {
      const k2 = Math.min(1, Math.max(0, (d.now - a.t0) / a.dur));
      if (k2 <= 0) { g.visible = false; return; }
      const e = 1 - Math.pow(1 - k2, 3); lift = (1 - e) * 2.2; sc = 1 + (1 - e) * 0.15;
    }
    const t0 = w.kind === 'staged' && d.settle ? d.settle.get(w.i) : null;
    if (t0 != null) sc = 1 + 0.12 * Math.pow(1 - Math.min(1, Math.max(0, (d.now - t0) / 120)), 3);   // a tile just placed settles into its square
    g.position.set(x, TOP + lift, z); g.scale.setScalar(sc);
    g.userData.face.material = faceMaterial(w.t.l, w.t.blank, B3.dark);
    g.userData.body.material = w.kind === 'staged' ? B3.stagedMat : w.kind === 'last' ? B3.lastMat : B3.bodyMat;
  });
  const p = pose();
  applyPose(p.tx, p.tz, p.dist);
  B3.renderer.render(B3.scene, B3.camera);
  const dt = performance.now() - t0; B3.frames.push(dt); if (B3.frames.length > 90) B3.frames.shift();
}
// The flat board takes over when the 3D one is too slow. Two measures, each a median over the last 60 or more frames:
// the time render() takes to hand the frame to the GPU (software GL is slow there), and the real time between frames
// while an animation runs (a GPU-bound phone hands frames over quickly and then shows them late; only this one sees it).
const SUBMIT_MS = 34;     // submit median above this falls back (unchanged)
const FRAME_MS = 28;      // frame-interval median above this, about 35 frames a second, falls back (new in wave 3)
const median = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
export function noteInterval(ms) { B3.intervals.push(ms); if (B3.intervals.length > 90) B3.intervals.shift(); }
export function slowFrames() {
  if (B3.frames.length >= 60 && median(B3.frames) > SUBMIT_MS) return true;
  return B3.intervals.length >= 60 && median(B3.intervals) > FRAME_MS;
}

// board cells → screen px (for overlays), and screen px → square index (for input)
const tmp = new THREE.Vector3();
export function screenOf(bx, by, lift = 0) {
  tmp.set(bx - HALF, TOP + lift, by - HALF).project(B3.camera);
  return [(tmp.x + 1) / 2 * B3.W, (1 - tmp.y) / 2 * B3.H];
}
export const cellScreen = (i) => screenOf(R.FRAME + (i % N) + 0.5, R.FRAME + Math.floor(i / N) + 0.5);
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP), hit = new THREE.Vector3();
export function boardAt(x, y) {
  ray.setFromCamera(new THREE.Vector2((x / B3.W) * 2 - 1, -(y / B3.H) * 2 + 1), B3.camera);
  if (!ray.ray.intersectPlane(plane, hit)) return null;
  return [hit.x + HALF, hit.z + HALF];
}
export function cellAt(x, y) {
  const b = boardAt(x, y); if (!b) return -1;
  const c = Math.floor(b[0] - R.FRAME), r = Math.floor(b[1] - R.FRAME);
  return r >= 0 && r < N && c >= 0 && c < N ? r * N + c : -1;
}
// approximate on-screen size of one square near the centre (for line widths)
export function cellPx() { const [x0, y0] = screenOf(HALF - 0.5, HALF); const [x1, y1] = screenOf(HALF + 0.5, HALF); return Math.hypot(x1 - x0, y1 - y0); }
export function debug() {
  return {
    on: B3.on, reason: B3.reason, dark: !!B3.dark, counterArt: !!B3.counterArt,
    towelColor: B3.towelCloth && B3.towelCloth[0] ? B3.towelCloth[0].color.getHexString() : null,
    keyColor: B3.key ? B3.key.color.getHexString() : null, keyIntensity: B3.key ? B3.key.intensity : 0,
    fillColor: B3.fill ? B3.fill.color.getHexString() : null, fillIntensity: B3.fill ? B3.fill.intensity : 0,
    tiles: B3.tiles.filter((t) => t.visible).length, fit: B3.fit, tilt: TILT, tall: !!B3.tall,
    preDim: !!(B3.preDim && B3.preDim.visible), bezel: B3.on ? bezelBounds() : null,
    frames: B3.frames.length, intervals: B3.intervals.slice(),
  };
}

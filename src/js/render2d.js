// The board in 2D: the static board texture (also the face of the 3D slab), tile sprites, and the per-frame
// composite of tiles and overlays under a zoom/pan view. Everything is drawn in code; painted textures
// from assets/ are layered in when they have loaded (art.js), with this vector art as the fallback.
import { N, SQUARE, BATHHOUSES, CENTER, VALUE } from './score.js';
import { art } from './art.js';

export const FRAME = 0.38;           // board border, in cells
export const U = N + 2 * FRAME;      // board width in cells
const FONT_TILE = '"Fraunces", Georgia, "Times New Roman", serif';
const FONT_UI = '"Josefin Sans", "Century Gothic", Futura, "Trebuchet MS", sans-serif';
const FONT_DECO = '"Limelight", "Fraunces", Georgia, serif';

// Seeded random for repeatable textures.
function prng(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };

export const PREMIUM = {
  w: { name: 'WARM', mult: '2L', unit: 'LETTER', glass: ['#7FC8B8', '#2A9D8F', '#1F6F6B'], lead: 6, rings: 0 },
  h: { name: 'HOT', mult: '3L', unit: 'LETTER', glass: ['#8FB0E8', '#3D63B8', '#22397A'], lead: 8, rings: 1 },
  s: { name: 'STEAM', mult: '2W', unit: 'WORD', glass: ['#F6DE97', '#D9A23A', '#9C6A18'], lead: 0, rings: 0, curls: true },
  b: { name: 'BOILING', mult: '3W', unit: 'WORD', glass: ['#F0A27A', '#C4532F', '#7E2F1F'], lead: 0, rings: 3 },
};

function marble(ctx, x, y, w, h, rnd, theme = 'light') {
  const dark = theme === 'dark';
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  if (dark) { g.addColorStop(0, '#3B384D'); g.addColorStop(0.55, '#353244'); g.addColorStop(1, '#2D2A3B'); }
  else { g.addColorStop(0, '#DDD3C1'); g.addColorStop(0.55, '#D8CEBC'); g.addColorStop(1, '#CFC4B0'); }
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  // veins: a few soft wandering strokes
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.lineCap = 'round';
  for (let v = 0; v < 2; v++) {
    let px = x + rnd() * w, py = y - h * 0.1;
    ctx.beginPath(); ctx.moveTo(px, py);
    const steps = 6;
    for (let k = 0; k < steps; k++) {
      const nx = px + (rnd() - 0.4) * w * 0.5, ny = py + h * (0.15 + rnd() * 0.25);
      ctx.quadraticCurveTo(px + (rnd() - 0.5) * w * 0.4, (py + ny) / 2, nx, ny);
      px = nx; py = ny;
    }
    ctx.strokeStyle = dark ? `rgba(120,116,148,${0.07 + rnd() * 0.06})` : `rgba(130,118,100,${0.06 + rnd() * 0.07})`;
    ctx.lineWidth = Math.max(1, w * (0.008 + rnd() * 0.018)); ctx.stroke();
    ctx.strokeStyle = dark ? 'rgba(18,16,28,0.12)' : 'rgba(110,98,82,0.06)';
    ctx.lineWidth = Math.max(0.6, w * 0.004); ctx.stroke();
  }
  ctx.restore();
}

function leadedGlass(ctx, cx, cy, r, p, rnd) {
  // glass disc with radial gradient
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
  g.addColorStop(0, p.glass[0]); g.addColorStop(0.55, p.glass[1]); g.addColorStop(1, p.glass[2]);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  // mottled panes: small lighter patches
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  for (let k = 0; k < 9; k++) {
    const a = rnd() * Math.PI * 2, d = rnd() * r * 0.8;
    ctx.fillStyle = `rgba(255,255,255,${0.05 + rnd() * 0.08})`;
    ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * (0.15 + rnd() * 0.25), 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  const lead = 'rgba(38,36,34,0.85)';
  ctx.strokeStyle = lead; ctx.lineWidth = Math.max(1, r * 0.06);
  if (p.lead) {
    for (let k = 0; k < p.lead; k++) {
      const a = (k / p.lead) * Math.PI * 2 + Math.PI / p.lead;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 0.45, cy + Math.sin(a) * r * 0.45); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2); ctx.stroke();
  }
  for (let k = 1; k <= p.rings; k++) { ctx.beginPath(); ctx.arc(cx, cy, r * (0.45 + 0.17 * k), 0, Math.PI * 2); ctx.stroke(); }
  if (p.curls) {
    ctx.lineWidth = Math.max(1, r * 0.055);
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      const x0 = cx + k * r * 0.42;
      for (let t = 0; t <= 1.0001; t += 0.05) { const y = cy + r * 0.85 - t * r * 1.7, x = x0 + Math.sin(t * Math.PI * 2.2 + k) * r * 0.13; if (t === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke();
    }
  }
  // brass rim
  ctx.lineWidth = Math.max(1.2, r * 0.09); ctx.strokeStyle = '#B8902F'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = Math.max(0.6, r * 0.03); ctx.strokeStyle = 'rgba(255,240,190,0.7)'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.96, Math.PI * 1.05, Math.PI * 1.7); ctx.stroke();
}

// The scoring badge in the centre of each spring's leaded stained glass (W2-S2-02 / CD-WF2-04).
// Letter premiums (2L / 3L): circular cream badge with dark ink.
// Word premiums (2W / 3W): chamfered-octagonal dark-ink badge with gold figures and a double brass octagonal rim.
function label(ctx, cx, cy, cell, p) {
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const word = p.unit === 'WORD', r = cell * (word ? 0.36 : 0.34);
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.1, cx, cy, r);
  if (word) { g.addColorStop(0, '#3A3326'); g.addColorStop(1, '#1A1712'); } else { g.addColorStop(0, '#FFFDF6'); g.addColorStop(1, '#EDE2C6'); }
  ctx.fillStyle = g;
  if (word) {
    octagonPath(ctx, cx - r, cy - r, r * 2, 0.28);
    ctx.fill();
    ctx.strokeStyle = '#E9C766'; ctx.lineWidth = Math.max(1.2, cell * 0.026); ctx.stroke();
    const ir = r * 0.83;
    octagonPath(ctx, cx - ir, cy - ir, ir * 2, 0.28);
    ctx.lineWidth = Math.max(0.8, cell * 0.013); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(110,80,25,0.9)'; ctx.lineWidth = Math.max(1, cell * 0.022); ctx.stroke();
  }
  ctx.fillStyle = word ? '#F3DD8B' : '#1F2A24';
  const basePx = cell * (word ? 0.295 : 0.31);
  ctx.font = `800 ${basePx}px ${FONT_TILE}`;
  const fit = Math.min(1, (r * 1.42) / ctx.measureText(p.mult).width);
  if (fit < 1) ctx.font = `800 ${basePx * fit}px ${FONT_TILE}`;
  ctx.fillText(p.mult, cx, cy + cell * 0.015);
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function octagonPath(ctx, x, y, w, cut = 0.26) {
  const k = w * cut;
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.lineTo(x + w - k, y);
  ctx.lineTo(x + w, y + k);
  ctx.lineTo(x + w, y + w - k);
  ctx.lineTo(x + w - k, y + w);
  ctx.lineTo(x + k, y + w);
  ctx.lineTo(x, y + w - k);
  ctx.lineTo(x, y + k);
  ctx.closePath();
}

// The Bathhouse Row emblem: a domed bathhouse front with an arched door, bold enough to read at 30 px.
function rowEmblem(ctx, cx, cy, r) {
  ctx.save(); ctx.translate(cx, cy);
  ctx.fillStyle = '#F0D57A'; ctx.strokeStyle = '#F0D57A'; ctx.lineJoin = 'round';
  // dome and finial
  ctx.beginPath(); ctx.arc(0, -r * 0.12, r * 0.38, Math.PI, 0); ctx.closePath(); ctx.fill();
  ctx.fillRect(-r * 0.05, -r * 0.68, r * 0.1, r * 0.2);
  // body with an arched door cut out
  ctx.beginPath(); ctx.rect(-r * 0.78, -r * 0.12, r * 1.56, r * 0.82);
  ctx.moveTo(r * 0.2, r * 0.7); ctx.lineTo(r * 0.2, r * 0.22); ctx.arc(0, r * 0.22, r * 0.2, 0, Math.PI, true); ctx.lineTo(-r * 0.2, r * 0.7); ctx.closePath();
  ctx.fill('evenodd');
  // a ledge across the top of the body
  ctx.fillRect(-r * 0.9, -r * 0.2, r * 1.8, r * 0.1);
  ctx.restore();
}

// The static board face, size × size px. theme: 'light' | 'dark'.
export function paintBoard(size, theme = 'light') {
  const cv = mk(size, size), ctx = cv.getContext('2d');
  const cell = size / U, f = FRAME * cell, rnd = prng(47);
  // frame: walnut edge, brass rails, terrazzo band
  const wood = ctx.createLinearGradient(0, 0, size, size);
  wood.addColorStop(0, '#5A3A22'); wood.addColorStop(1, '#3A2414');
  ctx.fillStyle = wood; ctx.fillRect(0, 0, size, size);
  const band = f * 0.78;
  ctx.fillStyle = '#E9E0CC'; ctx.fillRect(band * 0.18, band * 0.18, size - band * 0.36, size - band * 0.36);
  if (art.ready('terrazzo')) {
    ctx.save(); ctx.globalAlpha = 0.9; ctx.drawImage(art.img('terrazzo'), band * 0.18, band * 0.18, size - band * 0.36, size - band * 0.36); ctx.restore();
  } else {
    for (let k = 0; k < size * 3; k++) {
      const x = rnd() * size, y = rnd() * size;
      if (x > f && x < size - f && y > f && y < size - f) continue;
      const cols = ['#A9432C', '#4E7D5B', '#2B4C9B', '#9A968C', '#6E4B2F', '#D9A23A', '#FFFFFF'];
      ctx.fillStyle = cols[Math.floor(rnd() * cols.length)];
      ctx.globalAlpha = 0.35 + rnd() * 0.4;
      const r = cell * (0.012 + rnd() * 0.03);
      ctx.beginPath(); ctx.ellipse(x, y, r, r * (0.6 + rnd() * 0.5), rnd() * 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  const rail = (inset, w) => {
    const g = ctx.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, '#F0D57A'); g.addColorStop(0.5, '#B8902F'); g.addColorStop(1, '#8C6A1E');
    ctx.strokeStyle = g; ctx.lineWidth = w; ctx.strokeRect(inset, inset, size - inset * 2, size - inset * 2);
  };
  rail(band * 0.18, Math.max(2, cell * 0.06));
  rail(f - cell * 0.06, Math.max(2, cell * 0.08));
  // W2-S1-16: inlaid brass Bathhouse Row promenade markers strictly along the outer terrazzo border
  // aligned directly outside each of the 8 Bathhouse Row squares (zero lines on interior neutral marble per CD-WF2-03).
  {
    const outerR = band * 0.18, innerR = f - cell * 0.06;
    const mid = (outerR + innerR) / 2, halfB = (innerR - outerR) * 0.36;
    const edges = { top: [], bottom: [], left: [], right: [] };
    for (const key of Object.keys(BATHHOUSES)) {
      const idx = Number(key), r = Math.floor(idx / N), c = idx % N;
      if (r <= 1) edges.top.push(f + (c + 0.5) * cell);
      else if (r >= N - 2) edges.bottom.push(f + (c + 0.5) * cell);
      else if (c <= 1) edges.left.push(f + (r + 0.5) * cell);
      else edges.right.push(f + (r + 0.5) * cell);
    }
    ctx.save();
    const promGrad = ctx.createLinearGradient(0, 0, size, size);
    promGrad.addColorStop(0, '#F0D57A'); promGrad.addColorStop(0.5, '#C49A34'); promGrad.addColorStop(1, '#8C6A1E');
    ctx.strokeStyle = promGrad; ctx.fillStyle = '#DFBC5B';
    const drawMarker = (x, y, horiz, dir) => {
      // Flanking Art Deco brass promenade ticks
      ctx.lineWidth = Math.max(1.2, cell * 0.032);
      for (const sgn of [-1, 1]) {
        const off = sgn * cell * 0.28;
        ctx.beginPath();
        if (horiz) { ctx.moveTo(x + off, y - halfB * 0.85); ctx.lineTo(x + off, y + halfB * 0.85); }
        else { ctx.moveTo(x - halfB * 0.85, y + off); ctx.lineTo(x + halfB * 0.85, y + off); }
        ctx.stroke();
      }
      // Inward-pointing brass promenade chevron/diamond aligned to the Bathhouse Row landmark
      const d = halfB * 1.05;
      ctx.beginPath();
      if (horiz) {
        ctx.moveTo(x, y + dir * d);
        ctx.lineTo(x + d * 0.9, y);
        ctx.lineTo(x, y - dir * d * 0.72);
        ctx.lineTo(x - d * 0.9, y);
      } else {
        ctx.moveTo(x + dir * d, y);
        ctx.lineTo(x, y + d * 0.9);
        ctx.lineTo(x - dir * d * 0.72, y);
        ctx.lineTo(x, y - d * 0.9);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#5A3E12'; ctx.lineWidth = Math.max(0.9, cell * 0.018); ctx.stroke();
      ctx.strokeStyle = promGrad;
    };
    const drawEdge = (pts, fixed, horiz, dir) => {
      if (pts.length >= 2) {
        pts.sort((a, b) => a - b);
        ctx.lineWidth = Math.max(1.4, cell * 0.035);
        ctx.beginPath();
        if (horiz) { ctx.moveTo(pts[0], fixed); ctx.lineTo(pts[pts.length - 1], fixed); }
        else { ctx.moveTo(fixed, pts[0]); ctx.lineTo(fixed, pts[pts.length - 1]); }
        ctx.stroke();
      }
      for (const p of pts) drawMarker(horiz ? p : fixed, horiz ? fixed : p, horiz, dir);
    };
    drawEdge(edges.top, mid, true, 1);
    drawEdge(edges.bottom, size - mid, true, -1);
    drawEdge(edges.left, mid, false, 1);
    drawEdge(edges.right, size - mid, false, -1);
    ctx.restore();
  }
  // deco corner fans
  for (const [sx, sy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    ctx.save(); ctx.translate(sx ? size - f * 0.5 : f * 0.5, sy ? size - f * 0.5 : f * 0.5); ctx.rotate((sx ? (sy ? 2 : 1) : (sy ? 3 : 0)) * Math.PI / 2);
    ctx.fillStyle = '#B8902F'; ctx.strokeStyle = '#6E4B1E'; ctx.lineWidth = Math.max(1, cell * 0.015);
    ctx.beginPath(); ctx.arc(0, 0, f * 0.36, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    for (let k = 0; k < 5; k++) { const a = (k / 4) * Math.PI / 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * f * 0.32, Math.sin(a) * f * 0.32); ctx.stroke(); }
    ctx.restore();
  }
  // grout under the cells
  const dark = theme === 'dark';
  ctx.fillStyle = dark ? '#221E30' : '#7A6340'; ctx.fillRect(f, f, cell * N, cell * N);
  const gap = Math.max(1, cell * 0.035);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const i = r * N + c, k = SQUARE[i];
    const x = f + c * cell + gap / 2, y = f + r * cell + gap / 2, w = cell - gap;
    if (art.ready('marble')) {
      // W2-S1-01: calm honed travertine (#D8CEBC day / #353244 night) ground with a single soft marble.webp pass
      // (0.27 alpha, no double-multiply) so bright ivory ceramic tiles hold Rank 1 figure-ground contrast (CD-WF2-03).
      const m = art.img('marble'), sw = m.width * (0.14 + rnd() * 0.16);
      const base = ctx.createLinearGradient(x, y, x + w, y + w);
      if (dark) { base.addColorStop(0, '#383548'); base.addColorStop(1, '#312E40'); }
      else { base.addColorStop(0, '#D6CCB8'); base.addColorStop(1, '#CEC3AD'); }
      ctx.fillStyle = base; ctx.fillRect(x, y, w, w);
      ctx.save(); ctx.translate(x + w / 2, y + w / 2); ctx.rotate(Math.floor(rnd() * 4) * Math.PI / 2); if (rnd() < 0.5) ctx.scale(-1, 1);
      const sx = rnd() * (m.width - sw), sy = rnd() * (m.height - sw);
      if (dark) ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha = 0.27;
      ctx.drawImage(m, sx, sy, sw, sw, -w / 2, -w / 2, w, w);
      ctx.restore();
    } else marble(ctx, x, y, w, w, rnd, theme);
    // bevel: subtle light top-left, shade bottom-right (calibrated for calm Day travertine & Night twilight stone)
    ctx.strokeStyle = dark ? 'rgba(200,205,235,0.12)' : 'rgba(255,250,238,0.36)'; ctx.lineWidth = Math.max(0.8, cell * 0.02);
    ctx.beginPath(); ctx.moveTo(x + 1, y + w - 1); ctx.lineTo(x + 1, y + 1); ctx.lineTo(x + w - 1, y + 1); ctx.stroke();
    ctx.strokeStyle = dark ? 'rgba(8,6,16,0.44)' : 'rgba(88,70,46,0.28)';
    ctx.beginPath(); ctx.moveTo(x + w - 1, y + 1); ctx.lineTo(x + w - 1, y + w - 1); ctx.lineTo(x + 1, y + w - 1); ctx.stroke();
    const cx = x + w / 2, cy = y + w / 2;
    if (PREMIUM[k]) {
      if (art.ready('glass-' + k)) {
        ctx.drawImage(art.img('glass-' + k), x + w * 0.035, y + w * 0.035, w * 0.93, w * 0.93);
        ctx.strokeStyle = '#B8902F'; ctx.lineWidth = Math.max(1, w * 0.03); ctx.strokeRect(x + w * 0.035, y + w * 0.035, w * 0.93, w * 0.93);
      } else leadedGlass(ctx, cx, cy, w * 0.44, PREMIUM[k], rnd);
      label(ctx, cx, cy, cell, PREMIUM[k]);
    } else if (k === '*') {
      if (art.ready('glass-c')) {
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, w * 0.47, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(art.img('glass-c'), x + w * 0.02, y + w * 0.02, w * 0.96, w * 0.96); ctx.restore();
        ctx.strokeStyle = '#B8902F'; ctx.lineWidth = Math.max(1.2, w * 0.035); ctx.beginPath(); ctx.arc(cx, cy, w * 0.47, 0, Math.PI * 2); ctx.stroke();
      } else {
        // the Display Spring: a pool with tufa rims and steam
        const g = ctx.createRadialGradient(cx, cy, w * 0.05, cx, cy, w * 0.44);
        g.addColorStop(0, '#7FC8B8'); g.addColorStop(0.55, '#2A9D8F'); g.addColorStop(1, '#1F5F6B');
        ctx.fillStyle = '#C8C3B6'; ctx.beginPath(); ctx.arc(cx, cy, w * 0.47, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#9A968C'; ctx.beginPath(); ctx.arc(cx, cy, w * 0.43, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, w * 0.38, 0, Math.PI * 2); ctx.fill();
      }
      // Compact curved lower-rim brass START ribbon exposing the luminous turquoise Display Spring pool (W2-S5-01).
      const rw = w * START_RIBBON.w, rh = w * START_RIBBON.h;
      const ry = cy + w * START_RIBBON.y, bow = w * START_RIBBON.bow;
      const x0 = cx - rw / 2, x1 = cx + rw / 2;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x0, ry - rh / 2);
      ctx.quadraticCurveTo(cx, ry - rh / 2 + bow, x1, ry - rh / 2);
      ctx.lineTo(x1, ry + rh / 2);
      ctx.quadraticCurveTo(cx, ry + rh / 2 + bow, x0, ry + rh / 2);
      ctx.closePath();
      ctx.fillStyle = 'rgba(22,19,15,0.94)';
      ctx.fill();
      ctx.strokeStyle = '#E9C766';
      ctx.lineWidth = Math.max(1, w * 0.022);
      ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#F3DD8B';
      ctx.font = `800 ${cell * START_TEXT}px ${FONT_TILE}`;
      const fit = Math.min(1, (rw * 0.84) / ctx.measureText('START').width);
      if (fit < 1) ctx.font = `800 ${cell * START_TEXT * fit}px ${FONT_TILE}`;
      ctx.fillText('START', cx, ry + bow * 0.45);
      ctx.restore();
    } else if (k === 'B') {
      const name = BATHHOUSES[i];
      // W2-S1-16 / CD-WF2-01: preserve all 8 unique painted bath-*.webp facades inside a bold dark-espresso/gold
      // octagonal bezel with a crisp brass '+20' corner pip so Bathhouse Row reads unmistakably even at 23-38 px.
      ctx.save();
      const bx = x + w * 0.04, by = y + w * 0.04, bw = w * 0.92;
      const bezGrad = ctx.createLinearGradient(bx, by, bx + bw, by + bw);
      bezGrad.addColorStop(0, '#332518'); bezGrad.addColorStop(1, '#140E08');
      octagonPath(ctx, bx, by, bw, 0.28);
      ctx.fillStyle = bezGrad; ctx.fill();
      ctx.strokeStyle = '#E9C766'; ctx.lineWidth = Math.max(1.3, w * 0.034); ctx.stroke();
      // Inner octagonal painted medallion window (keeps the full [0.2..0.8] facade center crisp and unobstructed)
      const ix = x + w * 0.11, iy = y + w * 0.11, iw = w * 0.78;
      const med = art.img('bath-' + String(name).toLowerCase());
      ctx.save();
      octagonPath(ctx, ix, iy, iw, 0.24);
      ctx.clip();
      if (med) {
        ctx.drawImage(med, ix - iw * 0.04, iy - iw * 0.04, iw * 1.08, iw * 1.08);
      } else {
        const g = ctx.createRadialGradient(cx - w * 0.12, cy - w * 0.14, w * 0.04, cx, cy, w * 0.43);
        g.addColorStop(0, '#3A3326'); g.addColorStop(1, '#16130F');
        ctx.fillStyle = g; ctx.fillRect(ix, iy, iw, iw);
        rowEmblem(ctx, cx, cy, w * 0.27);
      }
      ctx.restore();
      octagonPath(ctx, ix, iy, iw, 0.24);
      ctx.strokeStyle = '#F0D57A'; ctx.lineWidth = Math.max(0.9, w * 0.02); ctx.stroke();
      // Crisp bottom-right brass '+20' corner pip
      const pw = w * 0.48, ph = w * 0.28, px = x + w * 0.49, py = y + w * 0.69;
      roundRect(ctx, px, py, pw, ph, ph * 0.42);
      ctx.fillStyle = 'rgba(20, 14, 8, 0.96)'; ctx.fill();
      ctx.strokeStyle = '#F0D57A'; ctx.lineWidth = Math.max(1, w * 0.022); ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#F6DF86';
      ctx.font = `800 ${cell * 0.205}px ${FONT_UI}`;
      const pfit = Math.min(1, (pw * 0.84) / ctx.measureText('+20').width);
      if (pfit < 1) ctx.font = `800 ${cell * 0.205 * pfit}px ${FONT_UI}`;
      ctx.fillText('+20', px + pw / 2, py + ph * 0.53);
      ctx.restore();
    }
  }
  // lamp pool and an inner shadow under the frame
  const pool = ctx.createRadialGradient(size * 0.42, size * 0.38, size * 0.05, size * 0.5, size * 0.5, size * 0.72);
  pool.addColorStop(0, 'rgba(255,236,200,0.10)'); pool.addColorStop(0.6, 'rgba(255,236,200,0)'); pool.addColorStop(1, 'rgba(60,35,15,0.16)');
  ctx.fillStyle = pool; ctx.fillRect(f, f, cell * N, cell * N);
  const edge = cell * 0.35;
  for (const [x0, y0, x1, y1, w0, h0] of [[f, f, f, f + edge, cell * N, edge], [f, f + cell * N, f, f + cell * N - edge, cell * N, -edge], [f, f, f + edge, f, edge, cell * N], [f + cell * N, f, f + cell * N - edge, f, -edge, cell * N]]) {
    const gsh = ctx.createLinearGradient(x0, y0, x1, y1); gsh.addColorStop(0, 'rgba(50,30,12,0.28)'); gsh.addColorStop(1, 'rgba(50,30,12,0)');
    ctx.fillStyle = gsh; ctx.fillRect(Math.min(x0, x0 + w0), Math.min(y0, y0 + h0), Math.abs(w0), Math.abs(h0));
  }
  if (theme === 'dark') { ctx.fillStyle = 'rgba(20,18,31,0.1)'; ctx.fillRect(0, 0, size, size); }
  return cv;
}

// The flat top of a 3D tile: the face texture spans the tile's footprint; the flat top is about 0.08-0.92 of it.
function paintFace(ctx, l, blank, w) {
  const g = ctx.createLinearGradient(0, 0, w, w);
  g.addColorStop(0, '#FFFDF5'); g.addColorStop(0.6, '#FAF3E3'); g.addColorStop(1, '#F0E6CE');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, w);
  if (!l) return;
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `800 ${w * 0.62}px ${FONT_TILE}`; ctx.fillStyle = blank ? '#1F6F6B' : '#0B0F0C';
  const m = ctx.measureText(l), asc = m.actualBoundingBoxAscent || w * 0.38;
  ctx.fillText(l, w * 0.47, w * 0.5 + asc / 2 - w * 0.02);
  if (!blank) { ctx.font = `700 ${w * 0.3}px ${FONT_UI}`; ctx.textAlign = 'right'; ctx.fillStyle = '#14100A'; ctx.fillText(String(VALUE[l]), w * 0.89, w * 0.88); }
  ctx.restore();
}

// A tile, w px square, cached. kind: 'board' | 'staged' | 'ghost' | 'rack' | 'face' (3D top).
const tileCache = new Map();
export function tileSprite(l, blank, w, kind = 'board') {
  w = Math.round(w);
  const key = `${l}|${blank ? 1 : 0}|${w}|${kind}`;
  let cv = tileCache.get(key);
  if (cv) return cv;
  if (tileCache.size > 600) tileCache.clear();
  cv = mk(w, w);
  const ctx = cv.getContext('2d');
  if (kind === 'face') { paintFace(ctx, l, blank, w); tileCache.set(key, cv); return cv; }
  const inset = w * 0.05, s = w - inset * 2, r = s * 0.14;
  // body
  const g = ctx.createLinearGradient(inset, inset, inset + s, inset + s);
  g.addColorStop(0, '#FFFDF5'); g.addColorStop(0.6, '#F8F0DE'); g.addColorStop(1, '#EAE0C7');
  roundRect(ctx, inset, inset, s, s, r); ctx.fillStyle = g; ctx.fill();
  // edge: dark lower bevel, bright upper rim
  ctx.lineWidth = Math.max(1, w * 0.038);
  ctx.strokeStyle = 'rgba(92,70,38,0.62)'; roundRect(ctx, inset, inset, s, s, r); ctx.stroke();
  ctx.lineWidth = Math.max(0.8, w * 0.025); ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath(); ctx.moveTo(inset + r, inset + w * 0.02); ctx.lineTo(inset + s - r, inset + w * 0.02); ctx.stroke();
  // glaze highlight
  const hg = ctx.createRadialGradient(inset + s * 0.28, inset + s * 0.2, 0, inset + s * 0.28, inset + s * 0.2, s * 0.55);
  hg.addColorStop(0, 'rgba(255,255,255,0.55)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
  roundRect(ctx, inset, inset, s, s, r); ctx.fillStyle = hg; ctx.fill();
  // letter and value
  if (l) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = `800 ${w * 0.64}px ${FONT_TILE}`;
    ctx.fillStyle = blank ? '#1F6F6B' : '#1F2A24';
    const m = ctx.measureText(l);
    const asc = m.actualBoundingBoxAscent || w * 0.42;
    ctx.fillText(l, w * 0.47, w * 0.5 + asc / 2 - w * 0.02);
    if (!blank) {
      ctx.font = `700 ${Math.max(w * 0.27, Math.min(w * 0.34, 15))}px ${FONT_UI}`; ctx.textAlign = 'right'; ctx.fillStyle = '#1F1A12';   // small squares keep the value readable
      ctx.fillText(String(VALUE[l]), w - inset - w * 0.08, w - inset - w * 0.07);
    }
  }
  if (kind === 'staged') {
    ctx.lineWidth = Math.max(1.5, w * 0.05); ctx.strokeStyle = '#D9A23A'; roundRect(ctx, inset * 0.6, inset * 0.6, w - inset * 1.2, w - inset * 1.2, r * 1.1); ctx.stroke();
  }
  tileCache.set(key, cv);
  return cv;
}

// ---------------------------------------------------------------------------------------------
// View: the board in a W×H css-px canvas, scaled by zoom about a centre (cx, cy) in board cells.
export const view = { W: 0, H: 0, dpr: 1, zoom: 1, cx: U / 2, cy: U / 2, target: null };
export const fit = () => Math.min(view.W, view.H) / U;
export const scale = () => fit() * view.zoom;
export function clampView() {
  const s = scale(), halfW = view.W / 2 / s, halfH = view.H / 2 / s;
  const clamp = (v, half) => (half >= U / 2 ? U / 2 : Math.max(half, Math.min(U - half, v)));
  view.cx = clamp(view.cx, halfW); view.cy = clamp(view.cy, halfH);
}
export const toScreen = (bx, by) => { const s = scale(); return [(bx - view.cx) * s + view.W / 2, (by - view.cy) * s + view.H / 2]; };
export const toBoard = (x, y) => { const s = scale(); return [(x - view.W / 2) / s + view.cx, (y - view.H / 2) / s + view.cy]; };
// square index under a canvas point, or -1
export function cellAt(x, y) {
  const [bx, by] = toBoard(x, y);
  const c = Math.floor(bx - FRAME), r = Math.floor(by - FRAME);
  return r >= 0 && r < N && c >= 0 && c < N ? r * N + c : -1;
}
// In 3D, board3d.js sets proj.fn(bx, by, lift) → [x, y] so overlays, pops and steam follow the camera and sit flush on raised tile tops.
export const TILE_LIFT = 0.24, STAGED_LIFT = 0.30;
export const proj = { fn: null };
const project = (bx, by, lift = 0) => (proj.fn ? proj.fn(bx, by, lift) : toScreen(bx, by));
export const cellCenter = (i, lift = 0) => project(FRAME + (i % N) + 0.5, FRAME + Math.floor(i / N) + 0.5, lift);
// the four corners of square i, inset by k cells, in screen px (lifted in 3D when wrapping a raised tile face)
const quad = (i, k = 0.04, lift = 0) => { const bx = FRAME + (i % N), by = FRAME + Math.floor(i / N); return [[k, k], [1 - k, k], [1 - k, 1 - k], [k, 1 - k]].map(([u, v]) => project(bx + u, by + v, lift)); };
const poly = (ctx, pts) => { ctx.beginPath(); pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };

// W2-S5-01: compact curved lower-rim brass START ribbon exposing the luminous turquoise Display Spring pool.
const START_RIBBON = { w: 0.74, h: 0.24, y: 0.30, bow: 0.065 }, START_TEXT = 0.165;
// S2-24: as tiles cover the board the glass discs and Bathhouse Row medallions of the squares still open step back: a wash of
// DIM_STEP more per tile on the board, up to DIM_MAX, so the tiles are the loudest thing on it.
// W2-S5-01: before Move 1 (while CENTER is empty and unstaged), apply a gentle PRE_DIM wash on outer-ring DIMMABLE squares
// (beneath 3D tiles in board3d.js, and beneath tiles on the flat 2D board) so H8 commands Turn-1 focus.
export const PRE_DIM = 0.12;
const DIM_STEP = 0.012, DIM_MAX = 0.16;
export const DIMMABLE = SQUARE.map((k, i) => (PREMIUM[k] || k === 'B' ? i : -1)).filter((i) => i >= 0);

let boardTex = null, boardKey = '';
export function boardTexture(theme) {
  const size = 2048;
  const key = `${theme}|${art.version}`;
  if (!boardTex || key !== boardKey) { boardTex = paintBoard(size, theme); boardKey = key; }
  return boardTex;
}
export const invalidateBoardTexture = () => { boardKey = ''; };

// One frame: board, tiles and overlays. d = { board, staged, last, hint, cursor, badCells, goodCells, target, blocked, dragTile, anim, theme, hideTiles }
export function drawFrame(ctx, d) {
  const { W, H, dpr } = view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const s = scale();
  const [ox, oy] = toScreen(0, 0);
  if (!d.flatOnly) {
    // soft shadow under the board
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#3A2414'; ctx.fillRect(ox, oy, U * s, U * s); ctx.restore();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(boardTexture(d.theme), ox, oy, U * s, U * s);
  }
  // the squares nobody has covered, dimmed a little more with every tile down (the same wash on the flat and the 3D board)
  const openCenter = !d.board[CENTER] && !(d.staged && d.staged.some((t) => t.i === CENTER));
  const down = d.board.reduce((n, t) => n + (t ? 1 : 0), 0), dim = Math.min(DIM_MAX, DIM_STEP * down);
  const flatPreDim = !d.flatOnly && openCenter && down === 0 ? PRE_DIM : 0;
  const effDim = Math.max(dim, flatPreDim);
  if (effDim > 0) {
    ctx.fillStyle = 'rgba(30,20,10,' + effDim.toFixed(3) + ')';
    for (const i of DIMMABLE) {
      if (d.board[i] || (d.staged && d.staged.some((t) => t.i === i))) continue;
      poly(ctx, quad(i, 0.035)); ctx.fill();
    }
  }
  // W2-S5-01: focused, reduced-motion-safe concentric brass/aqua spotlight halo directly on H8 (CENTER) on Turn 1.
  // Confined strictly around H8 — zero interior marble pinwheel lines (CD-WF2-03).
  if (openCenter) {
    const [hx, hy] = cellCenter(CENTER);
    const cp = d.cellPx || s;
    ctx.save();
    const glow = ctx.createRadialGradient(hx, hy, cp * 0.47, hx, hy, cp * 1.08);
    glow.addColorStop(0, 'rgba(127, 211, 196, 0)');
    glow.addColorStop(0.18, 'rgba(127, 211, 196, 0.38)');
    glow.addColorStop(0.55, 'rgba(243, 221, 139, 0.24)');
    glow.addColorStop(1, 'rgba(243, 221, 139, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(hx, hy, cp * 1.08, 0, Math.PI * 2); ctx.fill();
    // Concentric dark-espresso + bright-brass + luminous aqua rings framing the Display Spring
    ctx.strokeStyle = 'rgba(26, 17, 8, 0.72)';
    ctx.lineWidth = Math.max(2, cp * 0.11);
    ctx.beginPath(); ctx.arc(hx, hy, cp * 0.64, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(243, 221, 139, 0.94)';
    ctx.lineWidth = Math.max(1.5, cp * 0.065);
    ctx.beginPath(); ctx.arc(hx, hy, cp * 0.64, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(127, 211, 196, 0.92)';
    ctx.lineWidth = Math.max(1.2, cp * 0.045);
    ctx.beginPath(); ctx.arc(hx, hy, cp * 0.54, 0, Math.PI * 2); ctx.stroke();
    // Four compact cardinal brass compass ticks right outside the halo
    ctx.strokeStyle = 'rgba(243, 221, 139, 0.92)';
    ctx.lineWidth = Math.max(1.5, cp * 0.055);
    ctx.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(hx + Math.cos(a) * cp * 0.71, hy + Math.sin(a) * cp * 0.71);
      ctx.lineTo(hx + Math.cos(a) * cp * 0.85, hy + Math.sin(a) * cp * 0.85);
      ctx.stroke();
    }
    ctx.restore();
  }
  const cellPx = s, tilePx = cellPx * dpr;
  const at = (i) => toScreen(FRAME + (i % N), FRAME + Math.floor(i / N));
  const drawTile = (i, t, kind, alpha = 1, lift = 0, sc = 1) => {
    const [x, y] = at(i);
    const spr = tileSprite(t.l, t.blank, tilePx * sc, kind);
    ctx.globalAlpha = alpha;
    if (kind !== 'ghost') {
      ctx.fillStyle = 'rgba(22,13,5,0.24)'; roundRect(ctx, x + cellPx * 0.07, y + cellPx * 0.14 + lift * 0.5, cellPx * 0.91, cellPx * 0.91, cellPx * 0.15); ctx.fill();
      ctx.fillStyle = 'rgba(18,10,4,0.38)'; roundRect(ctx, x + cellPx * 0.06, y + cellPx * 0.09 + lift * 0.3, cellPx * 0.9, cellPx * 0.9, cellPx * 0.14); ctx.fill();
    }
    const off = (cellPx - cellPx * sc) / 2;
    ctx.drawImage(spr, x + off, y + off - lift, cellPx * sc, cellPx * sc);
    ctx.globalAlpha = 1;
  };
  const now = d.now || 0;
  if (!d.hideTiles) {
    for (let i = 0; i < N * N; i++) {
      const t = d.board[i];
      if (!t) continue;
      const a = d.anim && d.anim.get(i);
      if (a) {
        const k = Math.min(1, Math.max(0, (now - a.t0) / a.dur));
        if (k <= 0) continue;
        const e = 1 - Math.pow(1 - k, 3);
        drawTile(i, t, 'board', Math.min(1, k * 1.6), (1 - e) * cellPx * 0.9, 1 + (1 - e) * 0.25);
      } else drawTile(i, t, 'board');
    }
  }
  const stagedSet = new Set((d.staged || []).map((t) => t.i));
  const liftOf = (i) => (stagedSet.has(i) ? STAGED_LIFT : d.board[i] ? TILE_LIFT : 0);
  // the last play: a dark brass ring with a pale line inside it and a corner pip, so it shows on cream marble and is not only a
  // colour; a brief glow when the computer's tiles have just landed (projected at TILE_LIFT so rings wrap raised 3D tile faces)
  if (d.last && d.last.size) {
    const k = d.lastPulse ? Math.min(1, Math.max(0, (now - d.lastPulse.t0) / d.lastPulse.dur)) : 1;
    const w = Math.max(1.5, (d.cellPx || cellPx) * 0.07), brass = 'rgba(122,75,7,0.97)';
    ctx.lineJoin = 'round';
    for (const i of d.last) {
      if (!d.board[i]) continue;
      const a = d.anim && d.anim.get(i);
      if (a && now < a.t0 + a.dur) continue;   // still flying in
      const q = quad(i, 0.04, TILE_LIFT), q2 = quad(i, 0.1, TILE_LIFT), pip = (a, b) => [a[0] + (b[0] - a[0]) * 0.3, a[1] + (b[1] - a[1]) * 0.3];
      if (k < 1) { ctx.fillStyle = 'rgba(240,213,122,' + (0.55 * (1 - k)).toFixed(3) + ')'; poly(ctx, q); ctx.fill(); }
      ctx.strokeStyle = brass; ctx.lineWidth = w; poly(ctx, q); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,243,196,0.9)'; ctx.lineWidth = Math.max(1, w * 0.3); poly(ctx, q2); ctx.stroke();
      ctx.fillStyle = brass; poly(ctx, [q[0], pip(q[0], q[1]), pip(q[0], q[3])]); ctx.fill();
    }
    ctx.lineJoin = 'miter';
  }
  if (d.hint) for (const t of d.hint) drawTile(t.i, t, 'ghost', 0.6);
  // a tile just placed settles into its square: a little larger, easing down to its size in 120 ms
  const settle = (i) => { const t0 = d.settle && d.settle.get(i); return t0 == null ? 1 : 1 + 0.12 * Math.pow(1 - Math.min(1, Math.max(0, (now - t0) / 120)), 3); };
  if (!d.mode3d) for (const t of d.staged || []) drawTile(t.i, t, 'staged', d.dragFrom === t.i ? 0.35 : 1, cellPx * 0.04, settle(t.i));
  // word outlines for the live preview (projected at tile-top lift so rings wrap raised 3D ceramic faces)
  const lw = (k) => Math.max(1.5, (d.cellPx || cellPx) * k);
  const outline = (cells, color, width) => { for (const i of cells) { ctx.strokeStyle = color; ctx.lineWidth = width; poly(ctx, quad(i, 0.03, liftOf(i))); ctx.stroke(); } };
  if (d.goodCells) outline(d.goodCells, 'rgba(42,157,143,0.95)', lw(0.06));
  if (d.badCells && d.badCells.length) {
    const bw = lw(0.075), dash = [lw(0.18), lw(0.1)];
    const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    ctx.save();
    ctx.strokeStyle = 'rgba(178,40,28,0.98)';
    ctx.lineWidth = bw;
    ctx.lineCap = 'round';
    for (const i of d.badCells) {
      const q = quad(i, 0.03, liftOf(i));
      ctx.setLineDash(dash);
      poly(ctx, q); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      const tl1 = lerp(q[0], q[1], 0.28), tl2 = lerp(q[0], q[3], 0.28);
      const br1 = lerp(q[2], q[3], 0.28), br2 = lerp(q[2], q[1], 0.28);
      ctx.moveTo(tl1[0], tl1[1]); ctx.lineTo(tl2[0], tl2[1]);
      ctx.moveTo(br1[0], br1[1]); ctx.lineTo(br2[0], br2[1]);
      ctx.stroke();
    }
    ctx.restore();
  }
  // while dragging: crisp snapped landing-cell preview with high-contrast gold halo (or lifted crimson dashed outline over taken tiles)
  if (d.target != null && d.target >= 0) {
    const q = quad(d.target, 0.02), qi = quad(d.target, 0.06);
    const xs = qi.map((p) => p[0]), ys = qi.map((p) => p[1]);
    const x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0, h = Math.max(...ys) - y0;
    ctx.save();
    ctx.fillStyle = 'rgba(217,162,58,0.24)'; poly(ctx, q); ctx.fill();
    if (d.dragTile) { ctx.globalAlpha = 0.92; ctx.drawImage(tileSprite(d.dragTile.l, d.dragTile.blank, Math.round(Math.max(w, h) * view.dpr), 'staged'), x0, y0, w, h); ctx.globalAlpha = 1; }
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(26,17,8,0.85)'; ctx.lineWidth = lw(0.14); poly(ctx, q); ctx.stroke();
    ctx.strokeStyle = '#F3DD8B'; ctx.lineWidth = lw(0.08); poly(ctx, q); ctx.stroke();
    ctx.restore();
  }
  if (d.blocked != null && d.blocked >= 0) {
    const q = quad(d.blocked, 0.03, liftOf(d.blocked));
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.setLineDash([lw(0.18), lw(0.1)]);
    ctx.strokeStyle = 'rgba(26,17,8,0.85)'; ctx.lineWidth = lw(0.14); poly(ctx, q); ctx.stroke();
    ctx.strokeStyle = 'rgba(210,36,24,0.98)'; ctx.lineWidth = lw(0.085); poly(ctx, q); ctx.stroke();
    ctx.restore();
  }
  if (d.cursor) {
    const clift = stagedSet.has(d.cursor.i) ? STAGED_LIFT : d.board[d.cursor.i] ? TILE_LIFT + 0.01 : 0;
    const q = quad(d.cursor.i, 0.04, clift);
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1A1108'; ctx.lineWidth = lw(0.16);
    poly(ctx, q); ctx.stroke();
    ctx.strokeStyle = '#F6DF86'; ctx.lineWidth = lw(0.075);
    poly(ctx, q); ctx.stroke();
    // direction arrow with matching dark-espresso halo and bright-gold fill
    const bx = FRAME + (d.cursor.i % N), by = FRAME + Math.floor(d.cursor.i / N);
    const pts = (d.cursor.dir === 1 ? [[0.98, 0.5], [0.8, 0.36], [0.8, 0.64]] : [[0.5, 0.98], [0.36, 0.8], [0.64, 0.8]]).map(([u, v]) => project(bx + u, by + v, clift));
    ctx.strokeStyle = '#1A1108'; ctx.lineWidth = lw(0.08);
    poly(ctx, pts); ctx.stroke();
    ctx.fillStyle = '#F6DF86'; ctx.fill();
    ctx.restore();
  }
}

// When zoomed in: a small map of the whole board in the corner, with the part on screen outlined.
export const MINIMAP_ZOOM = 1.2;
export function minimapBox() {
  const S = 74, x0 = 10, y0 = view.H - S - 10, pad = 6;
  return { x0, y0, S, pad, left: x0 - pad, top: y0 - pad, right: x0 + S + pad, bottom: y0 + S + pad };
}
export function minimapHit(x, y) {
  if (view.zoom <= MINIMAP_ZOOM) return false;
  const m = minimapBox();
  return x >= m.left && x <= m.right && y >= m.top && y <= m.bottom;
}
export function drawMinimap(ctx, board, staged, vp) {
  const { x0, y0, S, pad } = minimapBox(), c = S / N;
  ctx.save();
  ctx.fillStyle = '#1E140A'; roundRect(ctx, x0 - pad, y0 - pad, S + pad * 2, S + pad * 2, 9); ctx.fill();
  ctx.fillStyle = '#EFE8D8'; ctx.fillRect(x0, y0, S, S);
  ctx.beginPath(); ctx.rect(x0, y0, S, S); ctx.clip();
  for (let i = 0; i < N * N; i++) {
    const k = SQUARE[i], x = x0 + (i % N) * c, y = y0 + Math.floor(i / N) * c;
    if (board[i]) { ctx.fillStyle = '#8C6A1E'; ctx.fillRect(x + 0.4, y + 0.4, c - 0.8, c - 0.8); }
    else if (PREMIUM[k]) { ctx.fillStyle = PREMIUM[k].glass[1]; ctx.globalAlpha = 0.55; ctx.fillRect(x + 1, y + 1, c - 2, c - 2); ctx.globalAlpha = 1; }
  }
  ctx.fillStyle = '#D9A23A';
  for (const t of staged || []) ctx.fillRect(x0 + (t.i % N) * c, y0 + Math.floor(t.i / N) * c, c, c);
  // vp: either { kind: 'poly', pts: [[bx, by], ...] } from 3D B3.boardAt() frustum corners,
  // or { kind: 'rect', rect: [x, y, w, h] } / [x, y, w, h] in 2D board units (FRAME included).
  const k = S / N;
  if (vp && vp.kind === 'poly' && vp.pts && vp.pts.length >= 3) {
    const pts = vp.pts.map(([bx, by]) => [x0 + (bx - FRAME) * k, y0 + (by - FRAME) * k]);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(20,14,8,0.85)'; ctx.lineWidth = 4; poly(ctx, pts); ctx.stroke();
    ctx.strokeStyle = '#F0D57A'; ctx.lineWidth = 2.2; poly(ctx, pts); ctx.stroke();
  } else {
    const rect = Array.isArray(vp) ? vp : vp && vp.rect;
    if (rect) {
      const rx = x0 + (rect[0] - FRAME) * k, ry = y0 + (rect[1] - FRAME) * k;
      ctx.strokeStyle = '#F0D57A'; ctx.lineWidth = 2.5; ctx.strokeRect(rx, ry, rect[2] * k, rect[3] * k);
      ctx.strokeStyle = 'rgba(20,14,8,0.8)'; ctx.lineWidth = 1; ctx.strokeRect(rx - 1.5, ry - 1.5, rect[2] * k + 3, rect[3] * k + 3);
    }
  }
  ctx.restore();
}

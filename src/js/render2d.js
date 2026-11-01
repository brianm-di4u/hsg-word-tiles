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
  w: { name: 'WARM', mult: '×2', unit: 'LETTER', glass: ['#7FC8B8', '#2A9D8F', '#1F6F6B'], lead: 6, rings: 0 },
  h: { name: 'HOT', mult: '×3', unit: 'LETTER', glass: ['#8FB0E8', '#3D63B8', '#22397A'], lead: 8, rings: 1 },
  s: { name: 'STEAM', mult: '×2', unit: 'WORD', glass: ['#F6DE97', '#D9A23A', '#9C6A18'], lead: 0, rings: 0, curls: true },
  b: { name: 'BOILING', mult: '×3', unit: 'WORD', glass: ['#F0A27A', '#C4532F', '#7E2F1F'], lead: 0, rings: 3 },
};

function marble(ctx, x, y, w, h, rnd, light = true) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  if (light) { g.addColorStop(0, '#FBF9F4'); g.addColorStop(0.55, '#F1EDE4'); g.addColorStop(1, '#E7E1D4'); }
  else { g.addColorStop(0, '#EDE7DA'); g.addColorStop(1, '#DCD3C1'); }
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
    ctx.strokeStyle = `rgba(150,140,125,${0.10 + rnd() * 0.12})`; ctx.lineWidth = Math.max(1, w * (0.008 + rnd() * 0.02)); ctx.stroke();
    ctx.strokeStyle = 'rgba(120,112,100,0.10)'; ctx.lineWidth = Math.max(0.6, w * 0.004); ctx.stroke();
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

// The scoring disc in the plain centre of the glass. Letter premiums: a cream disc with dark ink. Word premiums:
// an ink disc with gold figures and a double brass ring, so the two read apart at any size and in greyscale.
function label(ctx, cx, cy, cell, p) {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const word = p.unit === 'WORD', r = cell * 0.34;
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.1, cx, cy, r);
  if (word) { g.addColorStop(0, '#3A3326'); g.addColorStop(1, '#1A1712'); } else { g.addColorStop(0, '#FFFDF6'); g.addColorStop(1, '#EDE2C6'); }
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = word ? '#E9C766' : 'rgba(110,80,25,0.9)'; ctx.lineWidth = Math.max(1, cell * 0.022); ctx.stroke();
  if (word) { ctx.lineWidth = Math.max(0.8, cell * 0.012); ctx.beginPath(); ctx.arc(cx, cy, r * 0.84, 0, Math.PI * 2); ctx.stroke(); }
  ctx.fillStyle = word ? '#F3DD8B' : '#1F2A24';
  ctx.font = `800 ${cell * 0.33}px ${FONT_TILE}`;
  ctx.fillText(p.mult, cx, cy + cell * 0.015);
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
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

// Small building glyphs for the Bathhouse Row squares (shapes from research/town-content.md §2).
const BATH_COLORS = { Superior: '#4E7D5B', Hale: '#A9432C', Maurice: '#2A9D8F', Fordyce: '#6E4B2F', Quapaw: '#C8963E', Ozark: '#A9432C', Buckstaff: '#C9A23F', Lamar: '#7E2F1F' };
function bathGlyph(ctx, name, cx, cy, s, gold) {
  const col = gold ? '#E9C766' : BATH_COLORS[name] || '#6E4B2F';
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
  const BODY = gold ? '#1E1A14' : '#F3EFE6', INK = gold ? '#F0D57A' : '#3A2E22';
  ctx.fillStyle = BODY; ctx.strokeStyle = INK; ctx.lineWidth = gold ? 0.045 : 0.035; ctx.lineJoin = 'round';
  const body = (x, y, w, h) => { ctx.beginPath(); ctx.rect(x, y, w, h); ctx.fill(); ctx.stroke(); };
  const roof = (x, y, w, h) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w / 2, y - h); ctx.lineTo(x + w, y); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = BODY; };
  const windows = (n, y) => { ctx.fillStyle = INK; for (let k = 0; k < n; k++) ctx.fillRect(-0.4 + (k + 0.5) * (0.8 / n) - 0.03, y, 0.06, 0.1); ctx.fillStyle = BODY; };
  switch (name) {
    case 'Quapaw':
      body(-0.45, -0.05, 0.9, 0.38);
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, -0.05, 0.26, Math.PI, 0); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#6E4B2F'; ctx.lineWidth = 0.025;
      for (let k = 0; k < 3; k++) { ctx.beginPath(); for (let x = -0.22; x <= 0.22; x += 0.055) ctx.lineTo(x, -0.12 - k * 0.06 + (Math.round(x / 0.055) % 2 ? 0.03 : 0)); ctx.stroke(); }
      ctx.fillStyle = gold ? INK : '#B87333'; ctx.fillRect(-0.03, -0.38, 0.06, 0.08); windows(4, 0.08); break;
    case 'Ozark':
      body(-0.3, 0, 0.6, 0.33);
      for (const x of [-0.42, 0.24]) { body(x, -0.2, 0.18, 0.53); body(x + 0.02, -0.3, 0.14, 0.1); roof(x + 0.02, -0.3, 0.14, 0.12); }
      windows(3, 0.1); break;
    case 'Hale':
      body(-0.45, -0.05, 0.9, 0.38); roof(-0.5, -0.05, 1.0, 0.24);
      ctx.beginPath(); ctx.moveTo(-0.12, 0.1); ctx.bezierCurveTo(-0.12, -0.02, -0.04, -0.06, 0, -0.1); ctx.bezierCurveTo(0.04, -0.06, 0.12, -0.02, 0.12, 0.1); ctx.fill(); ctx.stroke(); windows(4, 0.15); break;
    case 'Superior':
      body(-0.45, -0.15, 0.9, 0.48);
      ctx.fillStyle = col; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(-0.3 + k * 0.2, -0.05, 0.05, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = BODY; windows(4, 0.1); break;
    case 'Maurice':
      body(-0.45, -0.1, 0.9, 0.43); ctx.fillStyle = col; ctx.fillRect(-0.47, -0.16, 0.94, 0.07);
      for (let k = 0; k < 3; k++) { ctx.fillStyle = gold ? '#3A3326' : '#7FC8B8'; ctx.beginPath(); ctx.arc(-0.24 + k * 0.24, 0.12, 0.07, Math.PI, 0); ctx.lineTo(-0.17 + k * 0.24, 0.22); ctx.lineTo(-0.31 + k * 0.24, 0.22); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      break;
    case 'Fordyce':
      body(-0.45, -0.12, 0.9, 0.45); roof(-0.47, -0.12, 0.3, 0.14); roof(0.17, -0.12, 0.3, 0.14);
      ctx.fillStyle = col; for (let k = 0; k < 4; k++) { ctx.beginPath(); const x = -0.3 + k * 0.2, y = 0.0; ctx.moveTo(x, y - 0.06); ctx.lineTo(x + 0.05, y); ctx.lineTo(x, y + 0.06); ctx.lineTo(x - 0.05, y); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = BODY; windows(4, 0.18); break;
    case 'Buckstaff':
      body(-0.45, -0.1, 0.9, 0.43); ctx.fillStyle = col; ctx.fillRect(-0.45, -0.14, 0.9, 0.06);
      ctx.strokeStyle = INK; for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(-0.37 + k * 0.148, -0.05); ctx.lineTo(-0.37 + k * 0.148, 0.3); ctx.stroke(); }
      break;
    default: // Lamar
      body(-0.42, -0.1, 0.84, 0.43); ctx.fillStyle = col; ctx.fillRect(-0.44, -0.15, 0.88, 0.06);
      ctx.fillStyle = gold ? INK : '#9FC9C9'; ctx.fillRect(-0.12, -0.22, 0.24, 0.07); ctx.strokeRect(-0.12, -0.22, 0.24, 0.07); windows(3, 0.08);
  }
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
  // deco corner fans
  for (const [sx, sy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    ctx.save(); ctx.translate(sx ? size - f * 0.5 : f * 0.5, sy ? size - f * 0.5 : f * 0.5); ctx.rotate((sx ? (sy ? 2 : 1) : (sy ? 3 : 0)) * Math.PI / 2);
    ctx.fillStyle = '#B8902F'; ctx.strokeStyle = '#6E4B1E'; ctx.lineWidth = Math.max(1, cell * 0.015);
    ctx.beginPath(); ctx.arc(0, 0, f * 0.36, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    for (let k = 0; k < 5; k++) { const a = (k / 4) * Math.PI / 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * f * 0.32, Math.sin(a) * f * 0.32); ctx.stroke(); }
    ctx.restore();
  }
  // grout under the cells
  ctx.fillStyle = '#7A6340'; ctx.fillRect(f, f, cell * N, cell * N);
  const gap = Math.max(1, cell * 0.035);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const i = r * N + c, k = SQUARE[i];
    const x = f + c * cell + gap / 2, y = f + r * cell + gap / 2, w = cell - gap;
    if (art.ready('marble')) {
      // each square is its own slab cut from a different part of the marble
      const m = art.img('marble'), sw = m.width * (0.14 + rnd() * 0.16);
      ctx.save(); ctx.translate(x + w / 2, y + w / 2); ctx.rotate(Math.floor(rnd() * 4) * Math.PI / 2); if (rnd() < 0.5) ctx.scale(-1, 1);
      const sx = rnd() * (m.width - sw), sy = rnd() * (m.height - sw);
      ctx.drawImage(m, sx, sy, sw, sw, -w / 2, -w / 2, w, w);
      ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.45; ctx.drawImage(m, sx, sy, sw, sw, -w / 2, -w / 2, w, w);
      ctx.restore();
    } else marble(ctx, x, y, w, w, rnd);
    // bevel: light top-left, shade bottom-right
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = Math.max(0.8, cell * 0.02);
    ctx.beginPath(); ctx.moveTo(x + 1, y + w - 1); ctx.lineTo(x + 1, y + 1); ctx.lineTo(x + w - 1, y + 1); ctx.stroke();
    ctx.strokeStyle = 'rgba(80,60,40,0.28)';
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
      // START on an ink banner across the pool, like the scoring discs
      const bw = w * 0.84, bh = w * 0.3;
      ctx.fillStyle = 'rgba(22,19,15,0.92)'; roundRect(ctx, cx - bw / 2, cy - bh / 2, bw, bh, bh * 0.3); ctx.fill();
      ctx.strokeStyle = '#E9C766'; ctx.lineWidth = Math.max(1, w * 0.02); ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#F3DD8B';
      ctx.font = `800 ${cell * 0.19}px ${FONT_TILE}`;
      ctx.fillText('START', cx, cy + w * 0.012);
    } else if (k === 'B') {
      const name = BATHHOUSES[i];
      ctx.fillStyle = 'rgba(232,222,198,0.97)'; ctx.fillRect(x + w * 0.03, y + w * 0.03, w * 0.94, w * 0.94);
      const g = ctx.createRadialGradient(cx - w * 0.12, cy - w * 0.14, w * 0.04, cx, cy, w * 0.43);
      g.addColorStop(0, '#3A3326'); g.addColorStop(1, '#16130F');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, w * 0.43, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#E9C766'; ctx.lineWidth = Math.max(1, w * 0.03); ctx.stroke();
      rowEmblem(ctx, cx, cy, w * 0.3);
      ctx.strokeStyle = '#B8902F'; ctx.lineWidth = Math.max(1, w * 0.03); ctx.strokeRect(x + w * 0.035, y + w * 0.035, w * 0.93, w * 0.93);
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
  g.addColorStop(0, '#FFFBF1'); g.addColorStop(0.6, '#F5EDDB'); g.addColorStop(1, '#EADFC6');
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
  g.addColorStop(0, '#FFFBF1'); g.addColorStop(0.6, '#F3EAD6'); g.addColorStop(1, '#E2D5B8');
  roundRect(ctx, inset, inset, s, s, r); ctx.fillStyle = g; ctx.fill();
  if (art.ready('tile-glaze') && !blank) { ctx.save(); roundRect(ctx, inset, inset, s, s, r); ctx.clip(); ctx.globalAlpha = 0.5; ctx.drawImage(art.img('tile-glaze'), inset, inset, s, s); ctx.restore(); }
  // edge: dark lower bevel, bright upper rim
  ctx.lineWidth = Math.max(1, w * 0.035);
  ctx.strokeStyle = 'rgba(120,95,55,0.55)'; roundRect(ctx, inset, inset, s, s, r); ctx.stroke();
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
      ctx.font = `700 ${w * 0.27}px ${FONT_UI}`; ctx.textAlign = 'right'; ctx.fillStyle = '#1F1A12';
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
// In 3D, board3d.js sets proj.fn(bx, by) → [x, y] so overlays, pops and steam follow the camera.
export const proj = { fn: null };
const project = (bx, by) => (proj.fn ? proj.fn(bx, by) : toScreen(bx, by));
export const cellCenter = (i) => project(FRAME + (i % N) + 0.5, FRAME + Math.floor(i / N) + 0.5);
// the four corners of square i, inset by k cells, in screen px
const quad = (i, k = 0.04) => { const bx = FRAME + (i % N), by = FRAME + Math.floor(i / N); return [[k, k], [1 - k, k], [1 - k, 1 - k], [k, 1 - k]].map(([u, v]) => project(bx + u, by + v)); };
const poly = (ctx, pts) => { ctx.beginPath(); pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };

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
  const cellPx = s, tilePx = cellPx * dpr;
  const at = (i) => toScreen(FRAME + (i % N), FRAME + Math.floor(i / N));
  const drawTile = (i, t, kind, alpha = 1, lift = 0, sc = 1) => {
    const [x, y] = at(i);
    const spr = tileSprite(t.l, t.blank, tilePx * sc, kind);
    ctx.globalAlpha = alpha;
    if (kind !== 'ghost') { ctx.fillStyle = 'rgba(40,25,10,0.28)'; roundRect(ctx, x + cellPx * 0.08, y + cellPx * 0.12 + lift * 0.5, cellPx * 0.9, cellPx * 0.9, cellPx * 0.14); ctx.fill(); }
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
      if (d.last && d.last.has(i)) {
        const [x, y] = at(i);
        ctx.strokeStyle = 'rgba(217,162,58,0.95)'; ctx.lineWidth = Math.max(1.5, cellPx * 0.06);
        roundRect(ctx, x + cellPx * 0.06, y + cellPx * 0.06, cellPx * 0.88, cellPx * 0.88, cellPx * 0.14); ctx.stroke();
      }
    }
  }
  if (d.hint) for (const t of d.hint) drawTile(t.i, t, 'ghost', 0.6);
  // word outlines for the live preview (projected quads, so they also sit on the 3D board)
  const lw = (k) => Math.max(1.5, (d.cellPx || cellPx) * k);
  const outline = (cells, color, width) => { for (const i of cells) { ctx.strokeStyle = color; ctx.lineWidth = width; poly(ctx, quad(i, 0.03)); ctx.stroke(); } };
  if (d.goodCells) outline(d.goodCells, 'rgba(42,157,143,0.95)', lw(0.06));
  if (d.badCells) outline(d.badCells, 'rgba(178,40,28,0.95)', lw(0.07));
  if (!d.mode3d) for (const t of d.staged || []) drawTile(t.i, t, 'staged', d.dragFrom === t.i ? 0.35 : 1, cellPx * 0.04);
  // while dragging: the tile seated, translucent, in the square it will land on (projected, so it also sits on the
  // 3D board), or a red dashed outline when that square is taken
  if (d.target != null && d.target >= 0) {
    const q = quad(d.target, 0.04), xs = q.map((p) => p[0]), ys = q.map((p) => p[1]);
    const x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0, h = Math.max(...ys) - y0;
    ctx.save();
    ctx.fillStyle = 'rgba(217,162,58,0.22)'; poly(ctx, q); ctx.fill();
    if (d.dragTile) { ctx.globalAlpha = 0.6; ctx.drawImage(tileSprite(d.dragTile.l, d.dragTile.blank, Math.round(Math.max(w, h) * view.dpr), 'staged'), x0, y0, w, h); ctx.globalAlpha = 1; }
    ctx.strokeStyle = '#F0D57A'; ctx.lineWidth = lw(0.09); poly(ctx, q); ctx.stroke();
    ctx.restore();
  }
  if (d.blocked != null && d.blocked >= 0) {
    ctx.save(); ctx.setLineDash([lw(0.18), lw(0.1)]); ctx.strokeStyle = 'rgba(178,40,28,0.95)'; ctx.lineWidth = lw(0.09);
    poly(ctx, quad(d.blocked, 0.05)); ctx.stroke(); ctx.restore();
  }
  if (d.cursor) {
    ctx.strokeStyle = '#2B4C9B'; ctx.lineWidth = lw(0.09);
    poly(ctx, quad(d.cursor.i, 0.05)); ctx.stroke();
    // direction arrow
    const bx = FRAME + (d.cursor.i % N), by = FRAME + Math.floor(d.cursor.i / N);
    const pts = d.cursor.dir === 1 ? [[0.98, 0.5], [0.8, 0.36], [0.8, 0.64]] : [[0.5, 0.98], [0.36, 0.8], [0.64, 0.8]];
    ctx.fillStyle = '#2B4C9B'; poly(ctx, pts.map(([u, v]) => project(bx + u, by + v))); ctx.fill();
  }
}

// When zoomed in: a small map of the whole board in the corner, with the part on screen outlined.
export function drawMinimap(ctx, board, staged, rect) {
  const S = 74, x0 = 10, y0 = view.H - S - 10, c = S / N;
  ctx.save();
  ctx.fillStyle = '#1E140A'; roundRect(ctx, x0 - 6, y0 - 6, S + 12, S + 12, 9); ctx.fill();
  ctx.fillStyle = '#EFE8D8'; ctx.fillRect(x0, y0, S, S);
  ctx.beginPath(); ctx.rect(x0, y0, S, S); ctx.clip();
  for (let i = 0; i < N * N; i++) {
    const k = SQUARE[i], x = x0 + (i % N) * c, y = y0 + Math.floor(i / N) * c;
    if (board[i]) { ctx.fillStyle = '#8C6A1E'; ctx.fillRect(x + 0.4, y + 0.4, c - 0.8, c - 0.8); }
    else if (PREMIUM[k]) { ctx.fillStyle = PREMIUM[k].glass[1]; ctx.globalAlpha = 0.55; ctx.fillRect(x + 1, y + 1, c - 2, c - 2); ctx.globalAlpha = 1; }
  }
  ctx.fillStyle = '#D9A23A';
  for (const t of staged || []) ctx.fillRect(x0 + (t.i % N) * c, y0 + Math.floor(t.i / N) * c, c, c);
  // rect: the visible board area in cells [x, y, w, h] (board units, FRAME included)
  const k = S / N, rx = x0 + (rect[0] - FRAME) * k, ry = y0 + (rect[1] - FRAME) * k;
  ctx.strokeStyle = '#F0D57A'; ctx.lineWidth = 2.5; ctx.strokeRect(rx, ry, rect[2] * k, rect[3] * k);
  ctx.strokeStyle = 'rgba(20,14,8,0.8)'; ctx.lineWidth = 1; ctx.strokeRect(rx - 1.5, ry - 1.5, rect[2] * k + 3, rect[3] * k + 3);
  ctx.restore();
}

// The board in 2D: the static board texture (also the face of the 3D slab), tile sprites, and the per-frame
// composite of tiles and overlays under a zoom/pan view. Everything is drawn in code; painted textures
// from assets/ are layered in when they have loaded (art.js), with this vector art as the fallback.
import { N, SQUARE, BATHHOUSES, CENTER, VALUE } from './score.js';
import { art } from './art.js';

export const FRAME = 0.38;           // board border, in cells
export const U = N + 2 * FRAME;      // board width in cells
const FONT_TILE = '"Fraunces", Georgia, "Times New Roman", serif';
const FONT_UI = '"Josefin Sans", "Century Gothic", Futura, "Trebuchet MS", sans-serif';

// Seeded random for repeatable textures.
function prng(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };

export const PREMIUM = {
  w: { name: 'WARM', mult: '2L', unit: 'LETTER', glass: ['#7FC8B8', '#2A9D8F', '#1F6F6B'], lead: 6, rings: 0 },
  h: { name: 'HOT', mult: '3L', unit: 'LETTER', glass: ['#8FB0E8', '#3D63B8', '#22397A'], lead: 8, rings: 1 },
  s: { name: 'STEAM', mult: '2W', unit: 'WORD', glass: ['#F6DE97', '#D9A23A', '#9C6A18'], lead: 0, rings: 0, curls: true },
  b: { name: 'BOILING', mult: '3W', unit: 'WORD', glass: ['#F0A27A', '#C4532F', '#7E2F1F'], lead: 0, rings: 3 },
};

// Shared declarative Day / Night look config (W3-S1-15, completing W3-S2-01 a2e6530): single source of truth
// for 3D spotlight/fill/PMREM environment, tile clearcoat/emissive, towel albedo, and 2D/3D marble & board tints.
export const LOOK = {
  day: {
    key: { color: 0xfff0d8, intensity: 600, angle: 0.7, penumbra: 0.95, decay: 1.6, pos: [-6, 30, -4], target: [0, 0, 0.5] },
    hemi: { sky: 0xfff1dc, ground: 0x6a4a2c, intensity: 0.6 },
    fill: { color: 0xcfe0ff, intensity: 0.5, pos: [12, 10, 16] },
    envIntensity: 0.5,
    env: {
      sphere: 0x8f7a64,
      panels: [
        [0xfff0d0, -4, 7, -3, 6],
        [0xc8d8ff, 6, 3, 6, 5],
        [0xffd9a0, 0, 2, 9, 7],
        [0x3a2414, 0, -8, 0, 16],
      ],
    },
    tile: {
      emissive: 0xffffff, emissiveIntensity: 0.14,
      bodyColor: 0xeadfc4, blankBodyColor: 0xcfe6e2, blankRoughness: 0.62,
      faceRoughness: 0.55, specularIntensity: 0.25, clearcoat: 0.25, clearcoatRoughness: 0.4,
      atlasFill: '#FAF3E3',
      faceGrad: ['#FFFDF5', '#FAF3E3', '#F0E6CE'],
      kilnEdge: ['rgba(218,166,86,0)', 'rgba(214,160,80,0.06)', 'rgba(202,146,66,0.20)', 'rgba(188,130,52,0.30)'],
      kilnRim: 'rgba(206,152,72,0.24)',
      spriteGrad: ['#FFFDF5', '#F8F0DE', '#EAE0C7'],
      bevelDark: 'rgba(92,70,38,0.62)', bevelLight: 'rgba(255,255,255,0.85)',
      stagedEmissive: 0xd9a23a, stagedEmissiveIntensity: 0.35,
      lastColor: 0xf0d57a, lastEmissive: 0xd9a23a, lastEmissiveIntensity: 0.3,
    },
    towel: { cloth: 0xb5a892, stripe: 0x3b7870 },
    top: { emissive: 0x000000, emissiveIntensity: 0, roughness: 1.0 },
    table: { roughness: 0.48, darkTint: null, vignette: ['rgba(18,10,4,0)', 'rgba(16,9,4,0.14)', 'rgba(12,7,3,0.44)'] },
    marble: {
      base: ['#D0C5AF', '#C8BCA5'], fallback: ['#D4C9B4', '#CEC3AD', '#C6B9A2'], alpha: 0.27,
      grout: '#7A6340', bevelLight: 'rgba(255,250,238,0.36)', bevelDark: 'rgba(88,70,46,0.28)',
      boardTint: null, dimRgb: '30,20,10',
    },
    preDimColor: 0x1e140a,
  },
  night: {
    key: { color: 0xffe1b0, intensity: 500, angle: 0.7, penumbra: 0.95, decay: 1.6, pos: [-6, 30, -4], target: [0, 0, 0.5] },
    hemi: { sky: 0x8697c8, ground: 0x1d182c, intensity: 0.28 },
    fill: { color: 0x5c72b8, intensity: 0.35, pos: [12, 10, 16] },
    envIntensity: 0.32,
    env: {
      sphere: 0x24223a,
      panels: [
        [0xffe1b0, -4, 7, -3, 5.5],
        [0x5c72b8, 6, 3, 6, 6],
        [0x3b4878, 0, 2, 9, 7],
        [0x141222, 0, -8, 0, 16],
      ],
    },
    tile: {
      emissive: 0xffe4be, emissiveIntensity: 0.11,
      bodyColor: 0xd8cdb6, blankBodyColor: 0xc3d8d4, blankRoughness: 0.62,
      faceRoughness: 0.55, specularIntensity: 0.25, clearcoat: 0.25, clearcoatRoughness: 0.4,
      atlasFill: '#EDE5D4',
      faceGrad: ['#F2EADB', '#EDE5D4', '#DFD5BE'],
      kilnEdge: ['rgba(202,150,74,0)', 'rgba(196,144,68,0.05)', 'rgba(184,130,56,0.18)', 'rgba(170,116,44,0.27)'],
      kilnRim: 'rgba(190,138,64,0.22)',
      spriteGrad: ['#F2EADB', '#EDE5D4', '#DDD2B9'],
      bevelDark: 'rgba(42,32,20,0.72)', bevelLight: 'rgba(255,248,232,0.55)',
      stagedEmissive: 0xd9a23a, stagedEmissiveIntensity: 0.35,
      lastColor: 0xf0d57a, lastEmissive: 0xd9a23a, lastEmissiveIntensity: 0.3,
    },
    towel: { cloth: 0x524b61, stripe: 0x26444a },
    top: { emissive: 0xcabfd2, emissiveIntensity: 0.9, roughness: 1.0 },
    table: { roughness: 0.48, darkTint: 'rgba(10,8,22,0.55)', vignette: ['rgba(6,5,16,0)', 'rgba(6,5,16,0.18)', 'rgba(6,5,16,0.52)'] },
    marble: {
      base: ['#383548', '#312E40'], fallback: ['#3B384D', '#353244', '#2D2A3B'], alpha: 0.27,
      grout: '#221E30', bevelLight: 'rgba(200,205,235,0.12)', bevelDark: 'rgba(8,6,16,0.44)',
      boardTint: 'rgba(20,18,31,0.22)', dimRgb: '20,18,31',
    },
    preDimColor: 0x14121f,
  },
};
export const lookFor = (theme) => LOOK[theme === 'dark' ? 'night' : 'day'];

function marble(ctx, x, y, w, h, rnd, theme = 'light') {
  const dark = theme === 'dark';
  const fb = lookFor(theme).marble.fallback;
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, fb[0]); g.addColorStop(0.55, fb[1]); g.addColorStop(1, fb[2]);
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

// Art Deco stepped-fan L-bracket path in local corner coordinates ((0,0) = board corner, +x/+y inward along rails).
// Stays strictly on the outer terrazzo border (<= innerR + 0.02*cell < f) so zero pixels enter the 15x15 marble grid (CD-WF2-03).
function cornerBracketPath(ctx, outerR, innerR, f, cell) {
  const bw = innerR - outerR;
  const o = outerR - cell * 0.015, inR = innerR + cell * 0.02;
  const L1 = f + cell * 0.16, L2 = f + cell * 0.42, L3 = f + cell * 0.66;
  const y2a = o + bw * 0.18, y2b = inR - bw * 0.16;
  const y3a = o + bw * 0.34, y3b = inR - bw * 0.32;
  ctx.beginPath();
  ctx.moveTo(o, o);
  ctx.lineTo(L1, o); ctx.lineTo(L1, y2a);
  ctx.lineTo(L2, y2a); ctx.lineTo(L2, y3a);
  ctx.lineTo(L3, y3a); ctx.lineTo(L3, y3b);
  ctx.lineTo(L2, y3b); ctx.lineTo(L2, y2b);
  ctx.lineTo(L1, y2b); ctx.lineTo(L1, inR);
  ctx.lineTo(inR, inR);
  ctx.lineTo(inR, L1); ctx.lineTo(y2b, L1);
  ctx.lineTo(y2b, L2); ctx.lineTo(y3b, L2);
  ctx.lineTo(y3b, L3); ctx.lineTo(y3a, L3);
  ctx.lineTo(y3a, L2); ctx.lineTo(y2a, L2);
  ctx.lineTo(y2a, L1); ctx.lineTo(o, L1);
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

// The static board face, size Ã— size px. theme: 'light' | 'dark'. mode3d: omit baked 2D lamp pool & frame shadows (W3-S2-04).
export function paintBoard(size, theme = 'light', mode3d = false) {
  const cv = mk(size, size), ctx = cv.getContext('2d');
  const cell = size / U, f = FRAME * cell, rnd = prng(47);
  // frame: walnut edge, brass rails, terrazzo band
  const wood = ctx.createLinearGradient(0, 0, size, size);
  wood.addColorStop(0, '#5A3A22'); wood.addColorStop(1, '#3A2414');
  ctx.fillStyle = wood; ctx.fillRect(0, 0, size, size);
  const band = f * 0.78;
  const tOut = band * 0.18, tSpan = size - tOut * 2, tStrip = Math.max(1, f - tOut), tMid = Math.max(0, size - f * 2);
  const fillBorderStrips = () => {
    ctx.fillRect(tOut, tOut, tSpan, tStrip);
    ctx.fillRect(tOut, size - f, tSpan, tStrip);
    ctx.fillRect(tOut, f, tStrip, tMid);
    ctx.fillRect(size - f, f, tStrip, tMid);
  };
  ctx.fillStyle = '#E9E0CC';
  fillBorderStrips();
  if (art.ready('terrazzo')) {
    // W3-S4-03: tile the seamless 256x256 terrazzo swatch strictly along the 4 perimeter border strips (zero interior overpaint).
    const pat = ctx.createPattern(art.img('terrazzo'), 'repeat');
    if (pat) {
      if (size !== 2048 && typeof DOMMatrix === 'function' && pat.setTransform) {
        pat.setTransform(new DOMMatrix().scale(size / 2048));
      }
      ctx.save(); ctx.globalAlpha = 0.9; ctx.fillStyle = pat; fillBorderStrips(); ctx.restore();
    }
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
  // W2-S5-09: crisp Art Deco stepped-fan brass corner brackets strictly on the outer terrazzo border (CD-WF2-03).
  {
    const outerR = band * 0.18, innerR = f - cell * 0.06, bw = innerR - outerR;
    const o = outerR - cell * 0.015, inR = innerR + cell * 0.02;
    const L1 = f + cell * 0.16, L2 = f + cell * 0.42, L3 = f + cell * 0.66;
    const midY = (o + inR) / 2, fx = o + bw * 0.08, fy = o + bw * 0.08, fanR = bw * 0.90;
    for (const [sx, sy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      ctx.save();
      ctx.translate(sx ? size : 0, sy ? size : 0);
      ctx.scale(sx ? -1 : 1, sy ? -1 : 1);
      // 1) Stepped 3-tier brass L-bracket plinth
      const bg = ctx.createLinearGradient(o, o, L2, L2);
      bg.addColorStop(0, '#F5DE8C'); bg.addColorStop(0.45, '#CCA03A'); bg.addColorStop(1, '#8F6A1D');
      cornerBracketPath(ctx, outerR, innerR, f, cell);
      ctx.fillStyle = bg; ctx.fill();
      ctx.strokeStyle = '#4F3412'; ctx.lineWidth = Math.max(1.2, cell * 0.022); ctx.lineJoin = 'miter'; ctx.stroke();
      // 2) Stepped Art Deco flutes along both bracket arms
      ctx.lineCap = 'butt';
      ctx.strokeStyle = '#FFF2BC'; ctx.lineWidth = Math.max(0.9, cell * 0.016);
      ctx.beginPath();
      ctx.moveTo(inR + bw * 0.10, midY); ctx.lineTo(L3 - cell * 0.05, midY);
      ctx.moveTo(midY, inR + bw * 0.10); ctx.lineTo(midY, L3 - cell * 0.05);
      ctx.stroke();
      ctx.strokeStyle = '#5A3C10'; ctx.lineWidth = Math.max(0.8, cell * 0.012);
      for (const sgn of [-1, 1]) {
        const off = sgn * bw * 0.17;
        ctx.beginPath();
        ctx.moveTo(inR + bw * 0.06, midY + off); ctx.lineTo(L2 - cell * 0.04, midY + off);
        ctx.moveTo(midY + off, inR + bw * 0.06); ctx.lineTo(midY + off, L2 - cell * 0.04);
        ctx.stroke();
      }
      // Step-divider bars separating tiers 1 -> 2 -> 3
      ctx.beginPath();
      ctx.moveTo(L1, o + bw * 0.18); ctx.lineTo(L1, inR - bw * 0.16);
      ctx.moveTo(L2, o + bw * 0.34); ctx.lineTo(L2, inR - bw * 0.32);
      ctx.moveTo(o + bw * 0.18, L1); ctx.lineTo(inR - bw * 0.16, L1);
      ctx.moveTo(o + bw * 0.34, L2); ctx.lineTo(inR - bw * 0.32, L2);
      ctx.stroke();
      // 3) Inset dark-bronze stepped quarter-fan medallion with 5 radiating gold sunburst flutes
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.arc(fx, fy, fanR, 0, Math.PI / 2); ctx.closePath();
      ctx.fillStyle = '#3E280D'; ctx.fill();
      for (let k = 0; k < 5; k++) {
        const a0 = (k / 5) * (Math.PI / 2) + 0.045, a1 = ((k + 1) / 5) * (Math.PI / 2) - 0.045;
        const rRay = k % 2 === 0 ? fanR * 0.90 : fanR * 0.78;
        ctx.beginPath(); ctx.moveTo(fx, fy); ctx.arc(fx, fy, rRay, a0, a1); ctx.closePath();
        ctx.fillStyle = k % 2 === 0 ? '#F6E18F' : '#CFA33C';
        ctx.fill();
      }
      // Concentric Art Deco stepped-fan arcs and corner keystone stud
      ctx.strokeStyle = '#3E280D'; ctx.lineWidth = Math.max(0.9, cell * 0.015);
      ctx.beginPath(); ctx.arc(fx, fy, fanR * 0.60, 0, Math.PI / 2); ctx.stroke();
      ctx.strokeStyle = '#F5DE8C'; ctx.lineWidth = Math.max(0.9, cell * 0.014);
      ctx.beginPath(); ctx.arc(fx, fy, fanR, 0, Math.PI / 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(fx, fy, fanR * 0.32, 0, Math.PI / 2);
      ctx.lineTo(fx, fy); ctx.closePath();
      ctx.fillStyle = '#FFF2BC'; ctx.fill();
      ctx.strokeStyle = '#4F3412'; ctx.lineWidth = Math.max(0.8, cell * 0.013); ctx.stroke();
      ctx.restore();
    }
  }
  // grout under the cells
  const dark = theme === 'dark', mLook = lookFor(theme).marble;
  ctx.fillStyle = mLook.grout; ctx.fillRect(f, f, cell * N, cell * N);
  const gap = Math.max(1, cell * 0.035);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const i = r * N + c, k = SQUARE[i];
    const x = f + c * cell + gap / 2, y = f + r * cell + gap / 2, w = cell - gap;
    if (art.ready('marble')) {
      // W2-S1-01: calm honed travertine (#D8CEBC day / #353244 night) ground with a single soft marble.webp pass
      // (0.27 alpha, no double-multiply) so bright ivory ceramic tiles hold Rank 1 figure-ground contrast (CD-WF2-03).
      const m = art.img('marble'), sw = m.width * (0.14 + rnd() * 0.16);
      const base = ctx.createLinearGradient(x, y, x + w, y + w);
      base.addColorStop(0, mLook.base[0]); base.addColorStop(1, mLook.base[1]);
      ctx.fillStyle = base; ctx.fillRect(x, y, w, w);
      ctx.save(); ctx.translate(x + w / 2, y + w / 2); ctx.rotate(Math.floor(rnd() * 4) * Math.PI / 2); if (rnd() < 0.5) ctx.scale(-1, 1);
      const sx = rnd() * (m.width - sw), sy = rnd() * (m.height - sw);
      if (dark) ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha = mLook.alpha;
      ctx.drawImage(m, sx, sy, sw, sw, -w / 2, -w / 2, w, w);
      ctx.restore();
    } else marble(ctx, x, y, w, w, rnd, theme);
    // bevel: subtle light top-left, shade bottom-right (calibrated for calm Day travertine & Night twilight stone)
    ctx.strokeStyle = mLook.bevelLight; ctx.lineWidth = Math.max(0.8, cell * 0.02);
    ctx.beginPath(); ctx.moveTo(x + 1, y + w - 1); ctx.lineTo(x + 1, y + 1); ctx.lineTo(x + w - 1, y + 1); ctx.stroke();
    ctx.strokeStyle = mLook.bevelDark;
    ctx.beginPath(); ctx.moveTo(x + w - 1, y + 1); ctx.lineTo(x + w - 1, y + w - 1); ctx.lineTo(x + 1, y + w - 1); ctx.stroke();
    const cx = x + w / 2, cy = y + w / 2;
    if (PREMIUM[k]) {
      if (art.ready('glass-' + k)) {
        // W3-S4-04: deterministic Smart Transforms per stained-glass spring (4x 90-degree rotations + horizontal mirror on radial w/h/b;
        // horizontal mirror + vertical flip + subtle vertical shift on wavy glass-s so rising steam stays vertical) before upright label().
        const gx = x + w * 0.035, gy = y + w * 0.035, gw = w * 0.93;
        ctx.save();
        ctx.beginPath(); ctx.rect(gx, gy, gw, gw); ctx.clip();
        ctx.translate(cx, cy);
        if (k === 's') {
          const sx = rnd() < 0.5 ? -1 : 1, sy = rnd() < 0.5 ? -1 : 1;
          const dy = (rnd() - 0.5) * gw * 0.06, pad = gw * 0.035;
          ctx.scale(sx, sy);
          ctx.drawImage(art.img('glass-' + k), -gw / 2 - pad, -gw / 2 - pad + dy, gw + pad * 2, gw + pad * 2);
        } else {
          ctx.rotate(Math.floor(rnd() * 4) * Math.PI / 2);
          if (rnd() < 0.5) ctx.scale(-1, 1);
          ctx.drawImage(art.img('glass-' + k), -gw / 2, -gw / 2, gw, gw);
        }
        ctx.restore();
        ctx.strokeStyle = '#B8902F'; ctx.lineWidth = Math.max(1, w * 0.03); ctx.strokeRect(gx, gy, gw, gw);
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
  // W3-S2-04: gate baked 2D radial lamp pool and 0.35-cell inner frame drop shadows on !mode3d so 2D fallback
  // retains warm depth while 3D relies cleanly on real-time SpotLight + PCF shadows (no double-shaded outer ring).
  if (!mode3d) {
    const pool = ctx.createRadialGradient(size * 0.42, size * 0.38, size * 0.05, size * 0.5, size * 0.5, size * 0.72);
    pool.addColorStop(0, 'rgba(255,236,200,0.10)'); pool.addColorStop(0.6, 'rgba(255,236,200,0)'); pool.addColorStop(1, 'rgba(60,35,15,0.16)');
    ctx.fillStyle = pool; ctx.fillRect(f, f, cell * N, cell * N);
    const edge = cell * 0.35;
    for (const [x0, y0, x1, y1, w0, h0] of [[f, f, f, f + edge, cell * N, edge], [f, f + cell * N, f, f + cell * N - edge, cell * N, -edge], [f, f, f + edge, f, edge, cell * N], [f + cell * N, f, f + cell * N - edge, f, -edge, cell * N]]) {
      const gsh = ctx.createLinearGradient(x0, y0, x1, y1); gsh.addColorStop(0, 'rgba(50,30,12,0.28)'); gsh.addColorStop(1, 'rgba(50,30,12,0)');
      ctx.fillStyle = gsh; ctx.fillRect(Math.min(x0, x0 + w0), Math.min(y0, y0 + h0), Math.abs(w0), Math.abs(h0));
    }
  }
  if (mLook.boardTint) { ctx.fillStyle = mLook.boardTint; ctx.fillRect(0, 0, size, size); }
  return cv;
}

// Matching 512x512 linear roughnessMap for 3D B3.top (W3-S2-02):
// matte 0.85 grout and spring labels, honed 0.62 travertine marble, 0.58 terrazzo border, satin 0.55 stained glass, pool & medallions,
// glossy 0.22 brass rails. Glass at 0.22 mirrored the lamp: in 3D up to nine of the 46 labels washed out, the worst to 1.01:1 (W6-S4-02).
const GLASS_ROUGH = 0.55, LABEL_ROUGH = 0.85;
export function paintBoardRoughness(size = 512) {
  const cv = mk(size, size), ctx = cv.getContext('2d');
  const cell = size / U, f = FRAME * cell, band = f * 0.78, rnd = prng(147);
  const gray = (r) => { const v = Math.max(0, Math.min(255, Math.round(r * 255))); return `rgb(${v},${v},${v})`; };
  // outer walnut edge & terrazzo border
  ctx.fillStyle = gray(0.46); ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = gray(0.58); ctx.fillRect(band * 0.18, band * 0.18, size - band * 0.36, size - band * 0.36);
  // glossy brass rails (0.22)
  ctx.strokeStyle = gray(0.22);
  ctx.lineWidth = Math.max(1.5, cell * 0.06);
  ctx.strokeRect(band * 0.18, band * 0.18, size - band * 0.36, size - band * 0.36);
  ctx.lineWidth = Math.max(1.5, cell * 0.08);
  ctx.strokeRect(f - cell * 0.06, f - cell * 0.06, size - (f - cell * 0.06) * 2, size - (f - cell * 0.06) * 2);
  // glossy Art Deco stepped-fan corner brackets (0.22)
  ctx.fillStyle = gray(0.22);
  for (const [sx, sy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    ctx.save();
    ctx.translate(sx ? size : 0, sy ? size : 0);
    ctx.scale(sx ? -1 : 1, sy ? -1 : 1);
    cornerBracketPath(ctx, band * 0.18, f - cell * 0.06, f, cell);
    ctx.fill();
    ctx.restore();
  }
  // matte grout bed under all 15x15 cells (0.85)
  ctx.fillStyle = gray(0.85); ctx.fillRect(f, f, cell * N, cell * N);
  const gap = Math.max(1.2, cell * 0.045);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const i = r * N + c, k = SQUARE[i];
    const x = f + c * cell + gap / 2, y = f + r * cell + gap / 2, w = cell - gap;
    // honed travertine neutral cell (0.62 +/- 0.02 subtle stone variation)
    ctx.fillStyle = gray(0.62 + (rnd() - 0.5) * 0.04);
    ctx.fillRect(x, y, w, w);
    const cx = x + w / 2, cy = y + w / 2;
    if (PREMIUM[k]) {
      // satin stained glass, with its enamel label matte
      ctx.fillStyle = gray(GLASS_ROUGH);
      ctx.fillRect(x + w * 0.035, y + w * 0.035, w * 0.93, w * 0.93);
      ctx.fillStyle = gray(LABEL_ROUGH);
      ctx.beginPath(); ctx.arc(cx, cy, cell * 0.37, 0, Math.PI * 2); ctx.fill();
    } else if (k === '*') {
      // satin Display Spring pool
      ctx.fillStyle = gray(GLASS_ROUGH);
      ctx.beginPath(); ctx.arc(cx, cy, w * 0.47, 0, Math.PI * 2); ctx.fill();
    } else if (k === 'B') {
      // satin glazed Bathhouse Row medallion
      ctx.fillStyle = gray(GLASS_ROUGH);
      octagonPath(ctx, x + w * 0.04, y + w * 0.04, w * 0.92, 0.28);
      ctx.fill();
    }
  }
  return cv;
}

let boardRoughTex = null;
export function boardRoughnessTexture() {
  if (!boardRoughTex) boardRoughTex = paintBoardRoughness(512);
  return boardRoughTex;
}

// Draw a tile's corner point value with tight tracking on two-digit numerals (e.g. Q's '10') so they stay compact and clear of Q's tail (W3-S1-01).
function drawTileValue(ctx, val, x, y, px, twoDigit) {
  ctx.font = `700 ${px}px ${FONT_UI}`;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#14100A';
  const s = String(val);
  if (!twoDigit || s.length < 2) { ctx.fillText(s, x, y); return; }
  let rx = x;
  const tighten = px * 0.04;
  for (let k = s.length - 1; k >= 0; k--) {
    ctx.fillText(s[k], rx, y);
    rx -= ctx.measureText(s[k]).width - tighten;
  }
}

// A blank Steam tile (W1-S5-04): a frosted sea-glass glaze, a fine inner chamfer and three engraved steam curls, crisp while it has no
// letter (rack, drag) and faint behind one. Marks, not colour alone: the curls and the missing value also tell it from a lettered tile.
const STEAM_INK = '#144B48', STEAM_CURLS = 'M8 20c-2-3 2-5 0-8s2-5 0-8M12 20c-2-3 2-5 0-8s2-5 0-8M16 20c-2-3 2-5 0-8s2-5 0-8';
const STEAM_GLAZE = { light: ['#E6F3F0', '#DCEEEA', '#CFE6E2'], dark: ['#DDEAE6', '#D3E3DF', '#C3D8D4'] };
function steamGlaze(ctx, x, y, s, r, l) {
  const line = (d, color) => { const g = s * d; roundRect(ctx, x + g, y + g, s - g * 2, s - g * 2, r); ctx.strokeStyle = color; ctx.lineWidth = Math.max(0.8, s * 0.018); ctx.stroke(); };
  ctx.save();
  line(0.07, 'rgba(20,75,72,0.30)'); line(0.093, 'rgba(255,255,255,0.75)');
  const k = s * 0.66 / 24, path = new Path2D(STEAM_CURLS);
  ctx.translate(x + s * 0.5 - 12 * k, y + s * 0.5 - 12 * k); ctx.scale(k, k);
  ctx.lineCap = 'round'; ctx.lineWidth = 2;
  if (!l) { ctx.translate(0.5, 0.6); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.stroke(path); ctx.translate(-0.5, -0.6); }   // the lit lip of the engraving
  ctx.strokeStyle = l ? 'rgba(20,75,72,0.10)' : 'rgba(20,75,72,0.72)'; ctx.stroke(path);
  ctx.restore();
}

// Subtle kiln-fired ceramic glaze warmth pooling toward the crown rim and corners (W3-S3-02):
// keeps the central ivory crown bright for figure-ground & glyph contrast while avoiding clinical flat fills.
function paintKilnWarmth(ctx, w, theme = 'light') {
  const tLook = lookFor(theme).tile;
  const cx = w * 0.5, cy = w * 0.5;
  const rg = ctx.createRadialGradient(cx, cy, w * 0.48, cx, cy, w * 0.72);
  rg.addColorStop(0, tLook.kilnEdge[0]);
  rg.addColorStop(0.42, tLook.kilnEdge[1]);
  rg.addColorStop(0.80, tLook.kilnEdge[2]);
  rg.addColorStop(1, tLook.kilnEdge[3]);
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, w, w);
  ctx.save();
  const lw = Math.max(1.5, w * 0.036);
  ctx.strokeStyle = tLook.kilnRim;
  ctx.lineWidth = lw;
  ctx.strokeRect(lw * 0.5, lw * 0.5, w - lw, w - lw);
  ctx.restore();
}

// The flat top of a 3D tile: board3d.js maps the flat ceramic crown [-0.38..+0.38] to [0..1] UVs (W3-S1-01),
// so 100% of face texels sit cleanly inside the bevel. Exported so board3d.js paints directly into its 2048x1024 atlas (W3-S4-01).
export function paintFace(ctx, l, blank, w, theme = 'light') {
  const g = ctx.createLinearGradient(0, 0, w, w);
  if (blank) STEAM_GLAZE[theme === 'dark' ? 'dark' : 'light'].forEach((c, k) => g.addColorStop([0, 0.6, 1][k], c));
  else lookFor(theme).tile.faceGrad.forEach((c, k) => g.addColorStop([0, 0.6, 1][k], c));
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, w);
  if (blank) steamGlaze(ctx, 0, 0, w, w * 0.1, l);
  else paintKilnWarmth(ctx, w, theme);
  if (!l) return;
  const isQ = l === 'Q', val = VALUE[l], twoDigit = !blank && val >= 10;
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `800 ${w * (isQ ? 0.56 : 0.62)}px ${FONT_TILE}`;
  ctx.fillStyle = blank ? STEAM_INK : '#0F1713';
  const m = ctx.measureText(l), asc = m.actualBoundingBoxAscent || w * 0.38;
  ctx.fillText(l, w * (isQ ? 0.42 : 0.47), w * (isQ ? 0.47 : 0.50) + asc / 2 - (isQ ? w * 0.05 : w * 0.02));
  if (!blank) {
    drawTileValue(ctx, val, w * 0.86, w * 0.86, w * (twoDigit ? 0.22 : 0.27), twoDigit);
  }
  ctx.restore();
}

// A tile, w px square, cached. kind: 'board' | 'staged' | 'ghost' | 'rack' | 'face' (3D top).
// kind === 'face' skips tileCache so 512px 3D tile faces are never double-buffered in CPU RAM (W3-P-N01).
const tileCache = new Map();
export function invalidateTileCache() { tileCache.clear(); }
export function tileCacheSize() { return tileCache.size; }
// W6-S6-05: a tile drawn on the board takes its sprite from a fixed set of widths (device px) and drawImage scales it, so a
// pinch or a zoom paints each letter once a bucket instead of once a frame. Finer under 64: a value's digits keep their size.
const SPRITE_W = [24, 32, 40, 48, 56, 64, 96, 128, 192, 256, 384, 512];
export const spriteWidth = (w) => SPRITE_W.find((b) => b >= w) || 512;
export function tileSprite(l, blank, w, kind = 'board', theme = 'light') {
  w = Math.round(w);
  if (kind === 'face') {
    const cv = mk(w, w);
    paintFace(cv.getContext('2d'), l, blank, w, theme);
    return cv;
  }
  const key = `${l}|${blank ? 1 : 0}|${w}|${kind}|${theme}|${art.version}`;
  let cv = tileCache.get(key);
  if (cv) return cv;
  if (tileCache.size > 600) tileCache.clear();
  cv = mk(w, w);
  const ctx = cv.getContext('2d');
  const inset = w * 0.05, s = w - inset * 2, r = s * 0.14;
  // body
  const tLook = lookFor(theme).tile;
  const g = ctx.createLinearGradient(inset, inset, inset + s, inset + s);
  if (blank) STEAM_GLAZE[theme === 'dark' ? 'dark' : 'light'].forEach((c, k) => g.addColorStop([0, 0.6, 1][k], c));
  else tLook.spriteGrad.forEach((c, k) => g.addColorStop([0, 0.6, 1][k], c));
  roundRect(ctx, inset, inset, s, s, r); ctx.fillStyle = g; ctx.fill();
  // edge: dark lower bevel, bright upper rim
  ctx.lineWidth = Math.max(1, w * 0.038);
  ctx.strokeStyle = tLook.bevelDark; roundRect(ctx, inset, inset, s, s, r); ctx.stroke();
  ctx.lineWidth = Math.max(0.8, w * 0.025); ctx.strokeStyle = tLook.bevelLight;
  ctx.beginPath(); ctx.moveTo(inset + r, inset + w * 0.02); ctx.lineTo(inset + s - r, inset + w * 0.02); ctx.stroke();
  // glaze highlight
  const hg = ctx.createRadialGradient(inset + s * 0.28, inset + s * 0.2, 0, inset + s * 0.28, inset + s * 0.2, s * 0.55);
  hg.addColorStop(0, 'rgba(255,255,255,0.55)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
  roundRect(ctx, inset, inset, s, s, r); ctx.fillStyle = hg; ctx.fill();
  if (blank) steamGlaze(ctx, inset, inset, s, r * 0.8, l);
  // letter and value (W3-S1-01: unified upper-left anchor, lifted/scaled Q, compact tight-tracked two-digit '10')
  if (l) {
    const isQ = l === 'Q', val = VALUE[l], twoDigit = !blank && val >= 10;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = `800 ${w * (isQ ? 0.56 : 0.62)}px ${FONT_TILE}`;
    ctx.fillStyle = blank ? STEAM_INK : '#0F1713';
    const m = ctx.measureText(l);
    const asc = m.actualBoundingBoxAscent || w * 0.40;
    ctx.fillText(l, w * (isQ ? 0.42 : 0.47), w * (isQ ? 0.47 : 0.50) + asc / 2 - (isQ ? w * 0.05 : w * 0.02));
    if (!blank) {
      const valPx = twoDigit ? Math.max(w * 0.22, Math.min(w * 0.25, 12.5)) : Math.max(w * 0.26, Math.min(w * 0.32, 14.5));
      drawTileValue(ctx, val, w * 0.86, w * 0.86, valPx, twoDigit);
    }
  }
  if (kind === 'staged') {
    ctx.lineWidth = Math.max(1.5, w * 0.05); ctx.strokeStyle = '#D9A23A'; roundRect(ctx, inset * 0.6, inset * 0.6, w - inset * 1.2, w - inset * 1.2, r * 1.1); ctx.stroke();
  }
  tileCache.set(key, cv);
  return cv;
}

// ---------------------------------------------------------------------------------------------
// View: the board in a WÃ—H css-px canvas, scaled by zoom about a centre (cx, cy) in board cells.
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
// Unified ceramic tile motion grammar shared by board3d.js, render2d.js, and main.js (W4-S1-01 / CD-WF4-04):
// AI drops accelerate via easeInQuad to marble contact at k2 = 0.72, clamping roll to 0 above TOP + 0.28, then run
// an anisotropic ceramic settle (scaleY 0.90 -> 1.02 -> 1.0, scaleXZ <= 1.04). Human Play runs a <= 150 ms commit press
// (TOP + 0.08 -> TOP + 0) and human stage() runs a crisp 110 ms vertical touch-down + micro-settle.
export const CONTACT_K = 0.72, SETTLE_MS = 110;
function settleCurve(s, minY, maxXZ) {
  if (s <= 0.45) {
    const t = s / 0.45, e = t * t * (3 - 2 * t);
    return [maxXZ + (0.99 - maxXZ) * e, minY + (1.02 - minY) * e];
  }
  const t = (s - 0.45) / 0.55, e = t * t * (3 - 2 * t);
  return [0.99 + 0.01 * e, 1.02 - 0.02 * e];
}
export function tileAnimPose(a, now) {
  const k2 = Math.min(1, Math.max(0, (now - a.t0) / a.dur));
  if (a.kind === 'commit') {
    if (now < a.t0) return { vis: true, lift: 0.08, sx: 1, sy: 1, roll: 0, alpha: 1 };
    if (k2 < 0.55) {
      const u = k2 / 0.55;
      return { vis: true, lift: 0.08 * (1 - u * u), sx: 1, sy: 1, roll: 0, alpha: 1 };
    }
    const [sx, sy] = settleCurve((k2 - 0.55) / 0.45, 0.94, 1.02);
    return { vis: true, lift: 0, sx, sy, roll: 0, alpha: 1 };
  }
  const liftMax = a.lift != null ? a.lift : 2.0;
  if (k2 <= 0) return { vis: false, lift: liftMax, sx: 1, sy: 1, roll: 0, alpha: 0 };
  if (k2 < CONTACT_K) {
    const u = k2 / CONTACT_K;
    const lift = liftMax * (1 - u * u);
    const roll = a.roll && lift > 0.28 ? a.roll * Math.min(1, (lift - 0.28) / Math.max(0.4, liftMax - 0.28)) : 0;
    const sc = 1 + (1 - u * u) * 0.08;
    return { vis: true, lift, sx: sc, sy: sc, roll, alpha: Math.min(1, u * 3) };
  }
  const [sx, sy] = settleCurve((k2 - CONTACT_K) / (1 - CONTACT_K), 0.90, 1.04);
  return { vis: true, lift: 0, sx, sy, roll: 0, alpha: 1 };
}
export function stageSettlePose(t0, now) {
  if (t0 == null) return { vis: true, lift: 0.06, sx: 1, sy: 1 };
  if (now < t0) return { vis: false, lift: 0.22, sx: 1, sy: 1 };
  const u = Math.min(1, (now - t0) / SETTLE_MS);
  if (u < 0.55) {
    const v = u / 0.55;
    return { vis: true, lift: 0.06 + 0.16 * (1 - v * v), sx: 1, sy: 1 };
  }
  const [sx, sy] = settleCurve((u - 0.55) / 0.45, 0.93, 1.03);
  return { vis: true, lift: 0.06, sx, sy };
}
export const proj = { fn: null };
const project = (bx, by, lift = 0) => (proj.fn ? proj.fn(bx, by, lift) : toScreen(bx, by));
export const cellCenter = (i, lift = 0) => project(FRAME + (i % N) + 0.5, FRAME + Math.floor(i / N) + 0.5, lift);
// the four corners of square i, inset by k cells, in screen px (lifted in 3D when wrapping a raised tile face)
const quad = (i, k = 0.04, lift = 0) => { const bx = FRAME + (i % N), by = FRAME + Math.floor(i / N); return [[k, k], [1 - k, k], [1 - k, 1 - k], [k, 1 - k]].map(([u, v]) => project(bx + u, by + v, lift)); };
export const cellQuad = (i, k = 0.04, lift = 0) => quad(i, k, lift);
const poly = (ctx, pts) => { ctx.beginPath(); pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };

// W2-S5-01: compact curved lower-rim brass START ribbon exposing the luminous turquoise Display Spring pool.
const START_RIBBON = { w: 0.74, h: 0.24, y: 0.30, bow: 0.065 }, START_TEXT = 0.165;
// S2-24 / W2-S1-02: as tiles cover the board the glass discs and Bathhouse Row medallions of the squares still open step back:
// a wash of DIM_STEP more per tile on the board, up to DIM_MAX, drawn underneath 3D tiles in board3d.js (y = TOP + 0.002)
// and beneath 2D tiles on the flat board so placed ivory tiles stay Rank 1 without washing out stained-glass hues (CD-WF2-04).
// W2-S5-01: before Move 1 (while CENTER is empty and unstaged), apply a gentle PRE_DIM wash on outer-ring DIMMABLE squares.
export const PRE_DIM = 0.12;
export const DIM_STEP = 0.018, DIM_MAX = 0.30;
export const DIMMABLE = SQUARE.map((k, i) => (PREMIUM[k] || k === 'B' ? i : -1)).filter((i) => i >= 0);

let boardTex = null, boardKey = '';
export function boardTexture(theme, mode3d = false) {
  const size = 2048;
  const key = `${theme}|${art.version}|${mode3d ? 1 : 0}`;
  if (!boardTex || key !== boardKey) { boardTex = paintBoard(size, theme, mode3d); boardKey = key; }
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
  // W2-S1-02 / W2-P-N03: on the 3D board, open-square dimming is rendered inside board3d.js at y = TOP + 0.002
  // (depth-tested underneath raised 3D ceramic tiles) so it never smudges tile tops; on the flat 2D board it draws here beneath 2D tiles.
  const openCenter = !d.board[CENTER] && !(d.staged && d.staged.some((t) => t.i === CENTER));
  if (!d.flatOnly) {
    const down = d.board.reduce((n, t) => n + (t ? 1 : 0), 0), dim = Math.min(DIM_MAX, DIM_STEP * down);
    const flatPreDim = openCenter && down === 0 ? PRE_DIM : 0;
    const effDim = Math.max(dim, flatPreDim);
    if (effDim > 0) {
      ctx.fillStyle = `rgba(${lookFor(d.theme).marble.dimRgb},${effDim.toFixed(3)})`;
      for (const i of DIMMABLE) {
        if (d.board[i] || (d.staged && d.staged.some((t) => t.i === i))) continue;
        poly(ctx, quad(i, 0.035)); ctx.fill();
      }
    }
  }
  // W2-S5-01: focused, reduced-motion-safe concentric brass/aqua spotlight halo directly on H8 (CENTER) on Turn 1.
  // Confined strictly around H8 â€” zero interior marble pinwheel lines (CD-WF2-03).
  if (openCenter) {
    const [hx, hy] = cellCenter(CENTER);
    const cp = d.cellPx || s;
    ctx.save();
    // over the 3D board this canvas is in front of the tiles, so the halo is cut out around any staged beside the open spring
    if (d.flatOnly && d.staged && d.staged.length) {
      ctx.beginPath(); ctx.rect(0, 0, W, H);
      for (const t of d.staged) { quad(t.i, 0.05, STAGED_LIFT).forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); }
      ctx.clip('evenodd');
    }
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
  const cellPx = s, sprW = spriteWidth(cellPx * dpr);
  const at = (i) => toScreen(FRAME + (i % N), FRAME + Math.floor(i / N));
  const drawTile = (i, t, kind, alpha = 1, lift = 0, sx = 1, sy = sx, rot = 0) => {
    const [x, y] = at(i);
    // WF-4 §1.1: request the cached bucket sprite and apply zoom and transient animation scaling via drawImage (zero per-frame canvas allocation).
    const spr = tileSprite(t.l, t.blank, sprW, kind, d.theme || 'light');
    ctx.globalAlpha = alpha;
    if (kind !== 'ghost') {
      ctx.fillStyle = 'rgba(22,13,5,0.24)'; roundRect(ctx, x + cellPx * 0.07, y + cellPx * 0.14 + lift * 0.5, cellPx * 0.91, cellPx * 0.91, cellPx * 0.15); ctx.fill();
      ctx.fillStyle = 'rgba(18,10,4,0.38)'; roundRect(ctx, x + cellPx * 0.06, y + cellPx * 0.09 + lift * 0.3, cellPx * 0.9, cellPx * 0.9, cellPx * 0.14); ctx.fill();
    }
    const w = cellPx * sx, h = cellPx * sy;
    if (rot) {
      ctx.save();
      ctx.translate(x + cellPx / 2, y + cellPx / 2 - lift);
      ctx.rotate(rot);
      ctx.drawImage(spr, -w / 2, -h / 2, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(spr, x + (cellPx - w) / 2, y + (cellPx - h) / 2 - lift, w, h);
    }
    ctx.globalAlpha = 1;
  };
  const now = d.now || 0;
  if (!d.hideTiles) {
    for (let i = 0; i < N * N; i++) {
      const t = d.board[i];
      if (!t) continue;
      const a = d.anim && d.anim.get(i);
      if (a) {
        const pose = tileAnimPose(a, now);
        if (!pose.vis) continue;
        drawTile(i, t, 'board', pose.alpha, pose.lift * cellPx * 0.42, pose.sx, pose.sy, pose.roll);
      } else drawTile(i, t, 'board');
    }
  }
  const stagedSet = new Set((d.staged || []).map((t) => t.i));
  const liftOf = (i) => (stagedSet.has(i) ? STAGED_LIFT : d.board[i] ? TILE_LIFT : 0);
  // the last play: a dark brass ring with a pale line inside it and a corner pip, so it shows on cream marble and is not only a
  // colour; a brief glow when the computer's tiles have just landed (projected at TILE_LIFT so rings wrap raised 3D tile faces)
  if (d.last && d.last.size) {
    const pulsing = !!(d.lastPulse && now >= d.lastPulse.t0 && now < d.lastPulse.t0 + d.lastPulse.dur);
    const k = pulsing ? Math.min(1, Math.max(0, (now - d.lastPulse.t0) / d.lastPulse.dur)) : 1;
    const w = Math.max(1.5, (d.cellPx || cellPx) * 0.07), brass = 'rgba(122,75,7,0.97)';
    ctx.lineJoin = 'round';
    for (const i of d.last) {
      if (!d.board[i]) continue;
      const a = d.anim && d.anim.get(i);
      if (a && a.kind !== 'commit' && now < a.t0 + a.dur) continue;   // still flying in (a person's own tiles are down already while they press home)
      const q = quad(i, 0.04, TILE_LIFT), q2 = quad(i, 0.1, TILE_LIFT), pip = (a, b) => [a[0] + (b[0] - a[0]) * 0.3, a[1] + (b[1] - a[1]) * 0.3];
      if (pulsing) {
        const glowA = 0.72 * Math.pow(1 - k, 1.7);
        ctx.strokeStyle = 'rgba(240,213,122,' + glowA.toFixed(3) + ')';
        ctx.lineWidth = w * 1.9;
        poly(ctx, q); ctx.stroke();
      }
      ctx.strokeStyle = brass; ctx.lineWidth = w; poly(ctx, q); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,243,196,0.9)'; ctx.lineWidth = Math.max(1, w * 0.3); poly(ctx, q2); ctx.stroke();
      ctx.fillStyle = brass; poly(ctx, [q[0], pip(q[0], q[1]), pip(q[0], q[3])]); ctx.fill();
    }
    ctx.lineJoin = 'miter';
  }
  if (d.hint) for (const t of d.hint) drawTile(t.i, t, 'ghost', 0.6);
  // a tile just staged runs a crisp 110 ms vertical touch-down with anisotropic micro-settle (W4-S1-01)
  if (!d.mode3d) for (const t of d.staged || []) {
    const sp = stageSettlePose(d.settle ? d.settle.get(t.i) : null, now);
    if (!sp.vis) continue;
    drawTile(t.i, t, 'staged', d.dragFrom === t.i ? 0.35 : 1, sp.lift * cellPx * 0.67, sp.sx, sp.sy);
  }
  // W2-S1-03: a staged 3D tile's crown has the 2D staged tile's warm gold at its four corners (its top face is the placed one's),
  // so it stays apart from placed tiles when Challenge hides the teal outline; the last play keeps its brass ring and one pip (CD-WF2-04)
  else for (const t of d.staged || []) {
    const sp = stageSettlePose(d.settle ? d.settle.get(t.i) : null, now);
    if (!sp.vis || d.dragFrom === t.i) continue;
    const q = quad(t.i, 0.07, TILE_LIFT + sp.lift), at = (a, b) => [a[0] + (b[0] - a[0]) * 0.24, a[1] + (b[1] - a[1]) * 0.24];
    ctx.save(); ctx.strokeStyle = '#D9A23A'; ctx.lineWidth = Math.max(1.5, (d.cellPx || cellPx) * 0.05); ctx.lineCap = ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let k = 0; k < 4; k++) { const c = q[k], a = at(c, q[(k + 3) % 4]), b = at(c, q[(k + 1) % 4]); ctx.moveTo(a[0], a[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(b[0], b[1]); }
    ctx.stroke(); ctx.restore();
  }
  // word outlines for the live preview (projected at tile-top lift so rings wrap raised 3D ceramic faces)
  const lw = (k) => Math.max(1.5, (d.cellPx || cellPx) * k);
  const outline = (cells, color, width) => { for (const i of cells) { ctx.strokeStyle = color; ctx.lineWidth = width; poly(ctx, quad(i, 0.03, liftOf(i))); ctx.stroke(); } };
  if (d.goodCells) outline(d.goodCells, 'rgba(42,157,143,0.95)', lw(0.06));
  const badPulseOn = !!(d.badPulse && d.badPulse.cells && d.badPulse.cells.length && now >= d.badPulse.t0 && now < d.badPulse.t0 + d.badPulse.dur);
  if ((d.badCells && d.badCells.length) || badPulseOn) {
    const bw = lw(0.075), dash = [lw(0.18), lw(0.1)];
    const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const drawBadCell = (i, alpha) => {
      const q = quad(i, 0.03, liftOf(i));
      ctx.strokeStyle = `rgba(178,40,28,${alpha.toFixed(3)})`;
      ctx.lineWidth = bw;
      ctx.setLineDash(dash);
      poly(ctx, q); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      const tl1 = lerp(q[0], q[1], 0.28), tl2 = lerp(q[0], q[3], 0.28);
      const br1 = lerp(q[2], q[3], 0.28), br2 = lerp(q[2], q[1], 0.28);
      ctx.moveTo(tl1[0], tl1[1]); ctx.lineTo(tl2[0], tl2[1]);
      ctx.moveTo(br1[0], br1[1]); ctx.lineTo(br2[0], br2[1]);
      ctx.stroke();
    };
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const badSet = d.badCells && d.badCells.length ? new Set(d.badCells) : null;
    if (badPulseOn) {
      const k = Math.min(1, Math.max(0, (now - d.badPulse.t0) / d.badPulse.dur));
      const env = Math.pow(1 - k, 1.6);
      for (const i of d.badPulse.cells) {
        const qOut = quad(i, -0.01 - 0.045 * (1 - env), liftOf(i));
        ctx.strokeStyle = `rgba(218,46,32,${(0.78 * env).toFixed(3)})`;
        ctx.lineWidth = lw(0.11);
        ctx.setLineDash(dash);
        poly(ctx, qOut); ctx.stroke();
        if (!badSet || !badSet.has(i)) drawBadCell(i, 0.98 * env);
      }
    }
    if (d.badCells && d.badCells.length) {
      for (const i of d.badCells) drawBadCell(i, 0.98);
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
    if (d.dragTile) { ctx.globalAlpha = 0.92; ctx.drawImage(tileSprite(d.dragTile.l, d.dragTile.blank, spriteWidth(Math.max(w, h) * view.dpr), 'staged', d.theme || 'light'), x0, y0, w, h); ctx.globalAlpha = 1; }
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
  // W2-S1-18: the empty special square whose rule the strip shows wears a thin brass ring on the board face (round, so it is
  // neither the keyboard cursor's gold box nor a drag target's square halo)
  if (d.inspect != null && d.inspect >= 0) {
    const bx = FRAME + (d.inspect % N) + 0.5, by = FRAME + Math.floor(d.inspect / N) + 0.5;
    const ring = Array.from({ length: 32 }, (_, k) => project(bx + 0.43 * Math.cos(k * Math.PI / 16), by + 0.43 * Math.sin(k * Math.PI / 16), 0));
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(26,17,8,0.6)'; ctx.lineWidth = lw(0.1); poly(ctx, ring); ctx.stroke();
    ctx.strokeStyle = '#D4AB4E'; ctx.lineWidth = lw(0.05); poly(ctx, ring); ctx.stroke();
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
  // W2-S3-14: the open Bathhouse Row squares as brass studs and the open Display Spring as a teal beacon, so the board's landmarks
  // stay in sight when zoomed in (a covered one shows as its tile)
  const open = (i) => !board[i] && !(staged || []).some((t) => t.i === i);
  for (const i of Object.keys(BATHHOUSES).map(Number)) {
    if (!open(i)) continue;
    const x = x0 + (i % N + 0.5) * c, y = y0 + (Math.floor(i / N) + 0.5) * c;
    ctx.fillStyle = '#4A2E10'; ctx.beginPath(); ctx.arc(x, y, c * 0.52, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#E2B85A'; ctx.beginPath(); ctx.arc(x, y, c * 0.3, 0, Math.PI * 2); ctx.fill();
  }
  if (open(CENTER)) {
    const x = x0 + (CENTER % N + 0.5) * c, y = y0 + (Math.floor(CENTER / N) + 0.5) * c;
    ctx.fillStyle = 'rgba(42,157,143,0.35)'; ctx.beginPath(); ctx.arc(x, y, c * 1.05, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#16655E'; ctx.beginPath(); ctx.arc(x, y, c * 0.58, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7FD3C4'; ctx.beginPath(); ctx.arc(x, y, c * 0.3, 0, Math.PI * 2); ctx.fill();
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

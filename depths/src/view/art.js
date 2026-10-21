/**
 * Art for the camera's hidden layer and for wall signage. Hidden-layer art
 * is drawn as bright silver strokes on a transparent background: in a
 * developed photograph it reads with sharper contrast and a silver stain at
 * its edges. Every piece has a plain-text transcript in the level data.
 */
import { drawTexture } from './textures.js';

const SILVER = 'rgba(235,238,242,0.95)';

function sym(ctx, kind, x, y, r) {
  ctx.beginPath();
  if (kind === 'circle') ctx.arc(x, y, r, 0, Math.PI * 2);
  else if (kind === 'triangle') { ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.95, y + r * 0.75); ctx.lineTo(x - r * 0.95, y + r * 0.75); ctx.closePath(); }
  else if (kind === 'square') ctx.rect(x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6);
  ctx.stroke();
}

export const ART = {
  cables3: (ctx, w, h) => {
    ctx.strokeStyle = SILVER; ctx.lineWidth = 7; ctx.lineCap = 'round';
    const xs = [w * 0.2, w * 0.5, w * 0.8];
    const syms = ['circle', 'triangle', 'square'];
    xs.forEach((x, i) => {
      ctx.beginPath(); ctx.moveTo(x, 0);
      for (let y = 0; y < h * 0.72; y += 8) ctx.lineTo(x + Math.sin(y * 0.03 + i) * 10, y);
      ctx.stroke();
      ctx.lineWidth = 9; sym(ctx, syms[i], x, h * 0.84, 34); ctx.lineWidth = 7;
    });
  },
  footprint: (ctx, w, h) => {
    ctx.fillStyle = SILVER;
    ctx.beginPath(); ctx.ellipse(w * 0.5, h * 0.36, w * 0.17, h * 0.26, 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w * 0.52, h * 0.78, w * 0.13, h * 0.14, 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    for (let i = 0; i < 6; i++) ctx.fillRect(w * 0.36, h * (0.18 + i * 0.07), w * 0.3, h * 0.02);
  },
  listenerWall: (ctx, w, h) => {
    ctx.strokeStyle = SILVER; ctx.lineWidth = 6; ctx.lineCap = 'round';
    const cx = w * 0.5;
    // ribbed head of bundled cable
    for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.ellipse(cx, h * 0.1 + i * 9, 26 - i * 1.5, 7, 0, 0, Math.PI * 2); ctx.stroke(); }
    const line = (pts) => { ctx.beginPath(); ctx.moveTo(pts[0][0] * w, pts[0][1] * h); for (const p of pts.slice(1)) ctx.lineTo(p[0] * w, p[1] * h); ctx.stroke(); };
    line([[0.5, 0.2], [0.5, 0.55]]);
    line([[0.5, 0.26], [0.3, 0.4], [0.24, 0.62], [0.27, 0.75]]);
    line([[0.5, 0.26], [0.7, 0.38], [0.78, 0.58], [0.74, 0.72]]);
    line([[0.5, 0.55], [0.4, 0.75], [0.42, 0.98]]);
    line([[0.5, 0.55], [0.6, 0.77], [0.58, 0.98]]);
  },
  directorySecret: (ctx, w, h) => {
    ctx.fillStyle = SILVER; ctx.textAlign = 'left';
    ctx.font = '600 34px Arial'; ctx.fillText('SIGN-IN', 30, 50);
    ctx.font = '26px Arial';
    const rows = ['ORTIZ L.    MAINT   10/14/18', 'WARD E.     MAINT   10/14/18', '...', 'WARD E.     MAINT   TOMORROW'];
    rows.forEach((r, i) => ctx.fillText(r, 30, 110 + i * 44));
    ctx.strokeStyle = SILVER; ctx.lineWidth = 4; ctx.strokeRect(22, 250, w - 44, 50);
  },
  reflectionPath: (ctx, w, h) => {
    ctx.strokeStyle = SILVER; ctx.lineWidth = 3;
    for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(40 + i * (w - 80) / 4, 40); ctx.lineTo(40 + i * (w - 80) / 4, h - 40); ctx.stroke(); ctx.beginPath(); ctx.moveTo(40, 40 + i * (h - 80) / 4); ctx.lineTo(w - 40, 40 + i * (h - 80) / 4); ctx.stroke(); }
    ctx.fillStyle = SILVER; ctx.font = '700 26px Arial'; ctx.textAlign = 'center';
    // seen from below: columns A-D left to right from the entrance, rows 1-4 away from it
    for (let i = 0; i < 4; i++) { ctx.fillText('ABCD'[i], 40 + (i + 0.5) * (w - 80) / 4, 32); ctx.fillText(String(i + 1), 22, h - 40 - (i + 0.5) * (h - 80) / 4 + 9); }
    const cell = (c) => [40 + ('ABCD'.indexOf(c[0]) + 0.5) * (w - 80) / 4, h - 40 - (+c[1] - 0.5) * (h - 80) / 4];
    const path = ['B1', 'B2', 'C2', 'C3', 'B3', 'B4', 'C4'].map(cell);
    ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(path[0][0], h - 10); for (const pt of path) ctx.lineTo(pt[0], pt[1]); ctx.lineTo(path[path.length - 1][0], 10); ctx.stroke();
  },
  stairsBelow: (ctx, w, h) => {
    ctx.strokeStyle = SILVER; ctx.lineWidth = 5;
    for (let i = 0; i < 9; i++) { const y = 40 + i * (h - 80) / 9, inset = i * 14; ctx.strokeRect(40 + inset, y, w - 80 - inset * 2, (h - 80) / 9); }
  },
  ceilingCaretaker: (ctx, w, h) => {
    // a tall wrapped figure walking upside down: feet at the top edge, tools hanging toward the floor
    ctx.strokeStyle = SILVER; ctx.fillStyle = SILVER; ctx.lineWidth = 9; ctx.lineCap = 'round';
    const cx = w * 0.5;
    const line = (pts) => { ctx.beginPath(); ctx.moveTo(pts[0][0] * w, pts[0][1] * h); for (const p of pts.slice(1)) ctx.lineTo(p[0] * w, p[1] * h); ctx.stroke(); };
    line([[0.42, 0.03], [0.44, 0.2], [0.47, 0.36]]); line([[0.6, 0.06], [0.56, 0.22], [0.53, 0.36]]);
    ctx.beginPath(); ctx.ellipse(cx, h * 0.5, w * 0.13, h * 0.16, 0, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(cx - w * 0.13, h * (0.42 + i * 0.05)); ctx.lineTo(cx + w * 0.13, h * (0.42 + i * 0.05)); ctx.stroke(); }
    line([[0.38, 0.4], [0.3, 0.55], [0.28, 0.7]]); line([[0.62, 0.4], [0.7, 0.56], [0.74, 0.68]]);
    ctx.strokeRect(cx - w * 0.12, h * 0.67, w * 0.24, h * 0.1);
    ctx.lineWidth = 5;
    for (let i = 0; i < 5; i++) { const x = cx - w * 0.1 + i * w * 0.05; line([[x / w, 0.77], [x / w, 0.84 + (i % 2) * 0.05]]); }
  },
  dryPrints: (ctx, w, h) => {
    // a column of boot prints walking the grating from one deck to the other
    ctx.fillStyle = SILVER;
    for (let i = 0; i < 14; i++) {
      const x = w * (i % 2 ? 0.62 : 0.38), y = h * (0.04 + i * 0.068);
      ctx.beginPath(); ctx.ellipse(x, y, w * 0.11, h * 0.022, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x, y + h * 0.032, w * 0.08, h * 0.01, 0, 0, Math.PI * 2); ctx.fill();
    }
  },
  exteriorDoorway: (ctx, w, h) => {
    // a doorway seen from outside, at dawn: frame, empty interior, a long shadow, no one in it
    ctx.strokeStyle = SILVER; ctx.lineWidth = 8;
    ctx.strokeRect(w * 0.25, h * 0.15, w * 0.5, h * 0.78);
    ctx.fillStyle = 'rgba(235,238,242,0.18)'; ctx.fillRect(w * 0.25, h * 0.15, w * 0.5, h * 0.78);
    ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, h * 0.93); ctx.lineTo(w, h * 0.93); ctx.stroke();
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(w * 0.08, h * (0.08 + i * 0.03)); ctx.lineTo(w * 0.2, h * (0.08 + i * 0.03)); ctx.stroke(); }
    ctx.fillStyle = SILVER; ctx.font = '600 26px Arial'; ctx.textAlign = 'center'; ctx.fillText('EXIT', w * 0.5, h * 0.11);
  },
  // generic text/diagram art used by later chapters
  text: (lines) => (ctx, w, h) => {
    ctx.fillStyle = SILVER; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const L = [].concat(lines);
    const size = Math.min(70, Math.floor(h / (L.length * 1.5)));
    ctx.font = `700 ${size}px Arial`;
    L.forEach((t, i) => ctx.fillText(t, w / 2, h / 2 + (i - (L.length - 1) / 2) * size * 1.35));
  },
};

const cache = new Map();
export function artTexture(name, w = 512, h = 512) {
  const key = `${name}:${w}x${h}`;
  if (cache.has(key)) return cache.get(key);
  let fn = ART[name];
  if (!fn && name.startsWith('text:')) fn = ART.text(name.slice(5).split('|'));
  if (!fn) fn = ART.text(['?']);
  const t = drawTexture(w, h, fn);
  cache.set(key, t);
  return t;
}

/** Symbol sign for the cubicle landmarks (visible layer). */
export function symbolSign(kind, color) {
  return drawTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#efe9d6'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = color || '#222'; ctx.lineWidth = 22; sym(ctx, kind, w / 2, h / 2 + (kind === 'triangle' ? 10 : 0), 80);
    ctx.strokeStyle = '#333'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, w - 6, h - 6);
  });
}

/** A wall clock face. */
export function clockFace() {
  return drawTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#f2efe4'; ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#222'; ctx.lineWidth = 8; ctx.stroke();
    for (let i = 0; i < 60; i++) {
      const a = i / 60 * Math.PI * 2, r1 = w / 2 - 14, r0 = i % 5 === 0 ? r1 - 18 : r1 - 7;
      ctx.lineWidth = i % 5 === 0 ? 5 : 2;
      ctx.beginPath(); ctx.moveTo(w / 2 + Math.sin(a) * r0, h / 2 - Math.cos(a) * r0); ctx.lineTo(w / 2 + Math.sin(a) * r1, h / 2 - Math.cos(a) * r1); ctx.stroke();
    }
    ctx.fillStyle = '#333'; ctx.font = '600 16px Arial'; ctx.textAlign = 'center'; ctx.fillText('HAZELBANK', w / 2, h * 0.68);
  });
}

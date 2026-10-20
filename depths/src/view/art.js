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

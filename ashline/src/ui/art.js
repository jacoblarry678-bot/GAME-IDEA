/**
 * Procedural 2D art for calling cards, emblems and banners (canvas → data URL,
 * cached). Used by the inventory, store, battle pass, profile and scoreboard.
 */
import { COSMETICS } from '../data/cosmetics.js';
import { finishSwatch } from '../world/finishes.js';

const cache = new Map();

function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function seeded(n) { let s = n >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export function cardArt(id, w = 384, h = 96) {
  const key = `card|${id}|${w}`;
  if (cache.has(key)) return cache.get(key);
  const it = COSMETICS[id];
  const a = it?.art || { kind: 'stripes', a: '#222', b: '#444', fg: '#eee' };
  const [c, x] = mk(w, h);
  const r = seeded(id.length * 31 + w);
  const g = x.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, a.a); g.addColorStop(1, shade(a.a, 1.4));
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.save();
  switch (a.kind) {
    case 'stripes': x.fillStyle = a.b; for (let i = -h; i < w; i += 22) { x.beginPath(); x.moveTo(i, h); x.lineTo(i + 10, h); x.lineTo(i + 10 + h, 0); x.lineTo(i + h, 0); x.fill(); } break;
    case 'sunrise': {
      const sg = x.createRadialGradient(w * 0.75, h * 1.1, 4, w * 0.75, h * 1.1, h * 1.4);
      sg.addColorStop(0, a.b); sg.addColorStop(0.5, shade(a.b, 0.6) + '88'); sg.addColorStop(1, 'transparent');
      x.fillStyle = sg; x.fillRect(0, 0, w, h);
      x.fillStyle = '#0008'; for (let i = 0; i < 8; i++) x.fillRect(w * 0.1 + i * 34, h * (0.55 + r() * 0.2), 22 + r() * 18, h);
      break;
    }
    case 'rails': {
      x.strokeStyle = a.b; x.lineWidth = 3;
      for (const s of [-1, 1]) { x.beginPath(); x.moveTo(w * 0.5 + s * 6, h * 0.1); x.lineTo(w * 0.5 + s * w * 0.4, h); x.stroke(); }
      x.lineWidth = 2; for (let i = 1; i < 9; i++) { const t = (i / 9) ** 1.6; const y = h * 0.1 + t * h * 0.9; const hw = 6 + t * w * 0.42; x.beginPath(); x.moveTo(w / 2 - hw, y); x.lineTo(w / 2 + hw, y); x.stroke(); }
      break;
    }
    case 'lights': for (let i = 0; i < 6; i++) { const lx = w * (0.15 + i * 0.15); const lg = x.createRadialGradient(lx, h * 0.3, 1, lx, h * 0.3, 40); lg.addColorStop(0, '#ffffffcc'); lg.addColorStop(1, 'transparent'); x.fillStyle = lg; x.fillRect(0, 0, w, h); x.fillStyle = a.b; x.fillRect(lx - 1, h * 0.3, 2, h); } break;
    case 'reticle': x.strokeStyle = a.b; x.lineWidth = 2; x.beginPath(); x.arc(w * 0.72, h / 2, h * 0.36, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.moveTo(w * 0.72 - h * 0.45, h / 2); x.lineTo(w * 0.72 + h * 0.45, h / 2); x.moveTo(w * 0.72, 0); x.lineTo(w * 0.72, h); x.stroke(); break;
    case 'plate': x.fillStyle = a.b; for (let yy = 8; yy < h; yy += 22) for (let xx = 10; xx < w; xx += 28) { x.beginPath(); x.arc(xx, yy, 3, 0, 7); x.fill(); } break;
    case 'slash': x.fillStyle = a.b; x.beginPath(); x.moveTo(w * 0.55, h); x.lineTo(w * 0.62, h); x.lineTo(w * 0.92, 0); x.lineTo(w * 0.85, 0); x.fill(); x.globalAlpha = 0.5; x.beginPath(); x.moveTo(w * 0.66, h); x.lineTo(w * 0.69, h); x.lineTo(w * 0.99, 0); x.lineTo(w * 0.96, 0); x.fill(); break;
    case 'embers': for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(255,${100 + r() * 100 | 0},30,${0.3 + r() * 0.7})`; x.beginPath(); x.arc(r() * w, h - r() * r() * h, 1 + r() * 2.5, 0, 7); x.fill(); } break;
    case 'static': for (let i = 0; i < 900; i++) { x.fillStyle = r() > 0.5 ? a.b + '55' : '#ffffff22'; x.fillRect(r() * w, r() * h, 2 + r() * 6, 1); } break;
    case 'grid': x.strokeStyle = a.b + '44'; x.lineWidth = 1; for (let i = 0; i < w; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); } for (let i = 0; i < h; i += 16) { x.beginPath(); x.moveTo(0, i); x.lineTo(w, i); x.stroke(); } x.strokeStyle = a.b; x.lineWidth = 2; x.beginPath(); x.moveTo(w * 0.55, h * 0.75); x.lineTo(w * 0.7, h * 0.3); x.lineTo(w * 0.85, h * 0.6); x.stroke(); break;
    case 'chevrons': x.fillStyle = a.b; for (let i = 0; i < 3; i++) { const cx = w * 0.78, cy = h * 0.25 + i * 20; x.beginPath(); x.moveTo(cx - 30, cy); x.lineTo(cx, cy + 14); x.lineTo(cx + 30, cy); x.lineTo(cx + 30, cy + 8); x.lineTo(cx, cy + 22); x.lineTo(cx - 30, cy + 8); x.fill(); } break;
    default: break;
  }
  x.restore();
  x.fillStyle = '#0006'; x.fillRect(0, h - 26, w, 26);
  x.fillStyle = a.fg || '#fff';
  x.font = `bold ${Math.round(h * 0.2)}px Arial, sans-serif`;
  x.textBaseline = 'middle';
  x.fillText((it?.name || '').toUpperCase(), 10, h - 13);
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}

export function emblemArt(id, size = 64) {
  const key = `emb|${id}|${size}`;
  if (cache.has(key)) return cache.get(key);
  const it = COSMETICS[id];
  const e = it?.emblem || { shape: 'chevron', color: '#ddd' };
  const [c, x] = mk(size, size);
  const s = size, m = s / 2;
  x.fillStyle = e.color; x.strokeStyle = e.color; x.lineWidth = s * 0.07; x.lineJoin = 'round';
  x.shadowColor = '#000a'; x.shadowBlur = s * 0.06;
  const poly = (pts) => { x.beginPath(); pts.forEach(([px, py], i) => (i ? x.lineTo(px * s, py * s) : x.moveTo(px * s, py * s))); x.closePath(); x.fill(); };
  switch (e.shape) {
    case 'chevron': poly([[0.15, 0.35], [0.5, 0.6], [0.85, 0.35], [0.85, 0.5], [0.5, 0.75], [0.15, 0.5]]); break;
    case 'star': { x.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? s * 0.18 : s * 0.42, a = (i / 10) * Math.PI * 2 - Math.PI / 2; const px = m + Math.cos(a) * r, py = m + Math.sin(a) * r; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath(); x.fill(); break; }
    case 'shield': poly([[0.2, 0.15], [0.8, 0.15], [0.8, 0.5], [0.5, 0.88], [0.2, 0.5]]); x.fillStyle = '#0006'; poly([[0.5, 0.2], [0.75, 0.2], [0.75, 0.5], [0.5, 0.8]]); break;
    case 'crosshair': x.beginPath(); x.arc(m, m, s * 0.3, 0, 7); x.stroke(); x.beginPath(); x.moveTo(m, s * 0.08); x.lineTo(m, s * 0.36); x.moveTo(m, s * 0.64); x.lineTo(m, s * 0.92); x.moveTo(s * 0.08, m); x.lineTo(s * 0.36, m); x.moveTo(s * 0.64, m); x.lineTo(s * 0.92, m); x.stroke(); break;
    case 'flame': x.beginPath(); x.moveTo(m, s * 0.08); x.bezierCurveTo(s * 0.85, s * 0.45, s * 0.8, s * 0.9, m, s * 0.92); x.bezierCurveTo(s * 0.2, s * 0.9, s * 0.15, s * 0.5, s * 0.38, s * 0.35); x.bezierCurveTo(s * 0.4, s * 0.5, s * 0.5, s * 0.55, s * 0.52, s * 0.42); x.closePath(); x.fill(); break;
    case 'hex': { x.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const px = m + Math.cos(a) * s * 0.4, py = m + Math.sin(a) * s * 0.4; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath(); x.fill(); x.fillStyle = '#0009'; x.beginPath(); x.arc(m, m, s * 0.15, 0, 7); x.fill(); break; }
    case 'bolt': poly([[0.55, 0.06], [0.22, 0.55], [0.47, 0.55], [0.38, 0.94], [0.78, 0.4], [0.52, 0.4]]); break;
    case 'wings': for (const d of [-1, 1]) { x.beginPath(); x.moveTo(m, m); for (let i = 0; i < 4; i++) { x.lineTo(m + d * s * (0.15 + i * 0.1), m - s * (0.25 - i * 0.05)); x.lineTo(m + d * s * (0.1 + i * 0.1), m + s * 0.02); } x.closePath(); x.fill(); } x.beginPath(); x.arc(m, m, s * 0.09, 0, 7); x.fill(); break;
    case 'rails': x.save(); x.translate(m, m); for (const a of [0.7, -0.7]) { x.save(); x.rotate(a); x.fillRect(-s * 0.04, -s * 0.42, s * 0.08, s * 0.84); for (let i = -3; i <= 3; i++) x.fillRect(-s * 0.13, i * s * 0.11 - 2, s * 0.26, 4); x.restore(); } x.restore(); break;
    case 'helm': x.beginPath(); x.arc(m, s * 0.55, s * 0.32, Math.PI, 0); x.lineTo(s * 0.82, s * 0.7); x.lineTo(s * 0.18, s * 0.7); x.closePath(); x.fill(); x.fillStyle = '#000b'; x.fillRect(s * 0.3, s * 0.48, s * 0.4, s * 0.07); break;
    case 'crown': poly([[0.15, 0.72], [0.15, 0.3], [0.33, 0.5], [0.5, 0.22], [0.67, 0.5], [0.85, 0.3], [0.85, 0.72]]); break;
    case 'eye': x.beginPath(); x.moveTo(s * 0.08, m); x.quadraticCurveTo(m, s * 0.12, s * 0.92, m); x.quadraticCurveTo(m, s * 0.88, s * 0.08, m); x.fill(); x.fillStyle = '#000'; x.beginPath(); x.arc(m, m, s * 0.14, 0, 7); x.fill(); break;
    default: x.beginPath(); x.arc(m, m, s * 0.35, 0, 7); x.fill();
  }
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}

export function bannerArt(id, w = 480, h = 120) {
  const key = `ban|${id}|${w}`;
  if (cache.has(key)) return cache.get(key);
  const it = COSMETICS[id];
  const a = it?.art || { kind: 'brushed', a: '#333', b: '#555' };
  const [c, x] = mk(w, h);
  const r = seeded(id.length * 17);
  if (a.kind === 'gradient') { const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, a.a); g.addColorStop(1, a.b); x.fillStyle = g; x.fillRect(0, 0, w, h); }
  else { x.fillStyle = a.a; x.fillRect(0, 0, w, h); }
  if (a.kind === 'brushed') for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(255,255,255,${r() * 0.05})`; x.fillRect(0, r() * h, w, 1); }
  if (a.kind === 'hazard') { x.fillStyle = a.b; for (let i = -h; i < w; i += 36) { x.beginPath(); x.moveTo(i, h); x.lineTo(i + 18, h); x.lineTo(i + 18 + h, 0); x.lineTo(i + h, 0); x.fill(); } }
  if (a.kind === 'camo') for (let i = 0; i < 40; i++) { x.fillStyle = r() > 0.5 ? a.b : shade(a.a, 0.7); x.beginPath(); x.ellipse(r() * w, r() * h, 10 + r() * 40, 6 + r() * 20, r() * 3, 0, 7); x.fill(); }
  if (a.kind === 'embers') for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(255,${80 + r() * 120 | 0},20,${0.3 + r() * 0.7})`; x.beginPath(); x.arc(r() * w, h - r() * r() * h, 1 + r() * 2.5, 0, 7); x.fill(); }
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}

/** Thumbnail for any cosmetic (2D icon or swatch); 3D items get a colored glyph. */
export function itemThumb(it) {
  switch (it.type) {
    case 'card': return `<img class="thumb-card" src="${cardArt(it.id, 192, 48)}" alt="">`;
    case 'emblem': return `<img class="thumb-sq" src="${emblemArt(it.id, 64)}" alt="">`;
    case 'banner': return `<img class="thumb-card" src="${bannerArt(it.id, 192, 48)}" alt="">`;
    case 'finish': { const u = finishSwatch(it.id); return u ? `<img class="thumb-sq" src="${u}" alt="">` : '<div class="thumb-sq thumb-factory"></div>'; }
    case 'outfit': { const p = it.outfit.palette; return `<div class="thumb-sq" style="background:conic-gradient(rgb(${p[0]}) 0 25%,rgb(${p[1]}) 0 50%,rgb(${p[2]}) 0 75%,rgb(${p[3]}) 0)"></div>`; }
    case 'operator': return `<div class="thumb-sq thumb-op">${it.name[0]}</div>`;
    case 'charm': return `<div class="thumb-sq thumb-charm" style="--c:#${(it.charm.color || 0x444444).toString(16).padStart(6, '0')}"></div>`;
    default: return '<div class="thumb-sq"></div>';
  }
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1, 7), 16);
  const r = Math.min(255, ((n >> 16) & 255) * k) | 0, g = Math.min(255, ((n >> 8) & 255) * k) | 0, b = Math.min(255, (n & 255) * k) | 0;
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

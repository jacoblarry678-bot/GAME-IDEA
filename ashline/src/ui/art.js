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
    case 'hollow': hollowNight(x, w, h, r, a, false); break;
    case 'patch': { hollowNight(x, w, h, r, a, true); break; }
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
    case 'pumpkin': {
      x.beginPath(); x.ellipse(m, s * 0.56, s * 0.4, s * 0.34, 0, 0, 7); x.fill();
      x.fillStyle = '#3e6a24'; x.fillRect(m - s * 0.04, s * 0.12, s * 0.08, s * 0.14);
      x.shadowBlur = 0; x.fillStyle = '#2a1204';
      poly([[0.28, 0.5], [0.36, 0.38], [0.44, 0.5]]); poly([[0.56, 0.5], [0.64, 0.38], [0.72, 0.5]]);
      poly([[0.26, 0.64], [0.36, 0.7], [0.42, 0.64], [0.5, 0.72], [0.58, 0.64], [0.64, 0.7], [0.74, 0.64], [0.64, 0.8], [0.36, 0.8]]);
      break;
    }
    case 'skull': {
      x.beginPath(); x.arc(m, s * 0.44, s * 0.32, 0, 7); x.fill();
      x.fillRect(s * 0.32, s * 0.6, s * 0.36, s * 0.22);
      x.shadowBlur = 0; x.fillStyle = '#120e0a';
      x.beginPath(); x.ellipse(s * 0.38, s * 0.46, s * 0.08, s * 0.1, 0, 0, 7); x.fill();
      x.beginPath(); x.ellipse(s * 0.62, s * 0.46, s * 0.08, s * 0.1, 0, 0, 7); x.fill();
      poly([[0.5, 0.56], [0.46, 0.64], [0.54, 0.64]]);
      for (let i = 0; i < 4; i++) x.fillRect(s * (0.36 + i * 0.08), s * 0.72, s * 0.025, s * 0.1);
      break;
    }
    case 'bat': {
      x.beginPath(); x.moveTo(m, s * 0.4);
      x.quadraticCurveTo(s * 0.7, s * 0.2, s * 0.95, s * 0.32); x.quadraticCurveTo(s * 0.85, s * 0.45, s * 0.88, s * 0.58);
      x.quadraticCurveTo(s * 0.76, s * 0.5, s * 0.7, s * 0.6); x.quadraticCurveTo(s * 0.6, s * 0.52, m, s * 0.68);
      x.quadraticCurveTo(s * 0.4, s * 0.52, s * 0.3, s * 0.6); x.quadraticCurveTo(s * 0.24, s * 0.5, s * 0.12, s * 0.58);
      x.quadraticCurveTo(s * 0.15, s * 0.45, s * 0.05, s * 0.32); x.quadraticCurveTo(s * 0.3, s * 0.2, m, s * 0.4); x.fill();
      poly([[0.44, 0.42], [0.46, 0.3], [0.49, 0.4], [0.51, 0.4], [0.54, 0.3], [0.56, 0.42]]);
      break;
    }
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
  if (a.kind === 'waspinator') waspBanner(x, w, h, r);
  if (a.kind === 'hollow') hollowNight(x, w, h, r, a, true);
  if (a.kind === 'cobweb') cobweb(x, w, h, a);
  if (a.kind === 'tallwoods') tallWoods(x, w, h, r, a);
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}

/** Collab banner: sunset haze, wasp stripes, wings and a stylised robot-wasp head (original art). */
function waspBanner(x, w, h, r) {
  const g = x.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#2a1230'); g.addColorStop(0.45, '#8a2a5a'); g.addColorStop(0.8, '#e0743a'); g.addColorStop(1, '#f2b84a');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  const glow = x.createRadialGradient(w * 0.2, h * 0.5, 2, w * 0.2, h * 0.5, h * 1.1);
  glow.addColorStop(0, 'rgba(255,240,255,0.55)'); glow.addColorStop(0.4, 'rgba(200,120,255,0.18)'); glow.addColorStop(1, 'transparent');
  x.fillStyle = glow; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(${r() > 0.5 ? '255,220,180' : '40,10,30'},${r() * 0.12})`; x.fillRect(r() * w, r() * h, 1 + r() * 30, 1); } // grunge
  // stripe band
  x.save();
  x.beginPath(); x.rect(0, h * 0.78, w, h * 0.22); x.clip();
  x.fillStyle = '#f2c51e'; x.fillRect(0, h * 0.78, w, h * 0.22);
  x.fillStyle = '#141414'; for (let i = -h; i < w; i += 28) { x.beginPath(); x.moveTo(i, h); x.lineTo(i + 14, h); x.lineTo(i + 14 + h * 0.22, h * 0.78); x.lineTo(i + h * 0.22, h * 0.78); x.fill(); }
  x.restore();
  // wings
  const cx = w * 0.2, cy = h * 0.46, s = h / 120;
  x.save();
  x.globalAlpha = 0.6;
  for (const [dx, rot, len] of [[-1, -0.5, 62], [1, 0.5, 62], [-1, -0.15, 44], [1, 0.15, 44]]) {
    const wg = x.createLinearGradient(cx, cy, cx + dx * len * s, cy - 30 * s);
    wg.addColorStop(0, '#f4f0ff'); wg.addColorStop(1, '#9a8cf0');
    x.fillStyle = wg;
    x.beginPath(); x.ellipse(cx + dx * len * 0.55 * s, cy - 6 * s, len * 0.55 * s, 11 * s, rot, 0, 7); x.fill();
  }
  x.restore();
  // head
  x.save();
  x.translate(cx, cy);
  x.scale(s, s);
  x.fillStyle = '#2f8f34'; x.strokeStyle = '#0d2a10'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(-26, -26); x.lineTo(26, -26); x.lineTo(32, 4); x.lineTo(14, 30); x.lineTo(-14, 30); x.lineTo(-32, 4); x.closePath(); x.fill(); x.stroke();
  x.fillStyle = '#5fd35a'; x.beginPath(); x.moveTo(-20, -22); x.lineTo(20, -22); x.lineTo(16, -12); x.lineTo(-16, -12); x.closePath(); x.fill();
  const vg = x.createLinearGradient(0, -8, 0, 6); vg.addColorStop(0, '#d8ecff'); vg.addColorStop(1, '#3f7dff');
  x.fillStyle = vg; x.shadowColor = '#7fb6ff'; x.shadowBlur = 12;
  x.beginPath(); x.moveTo(-24, -6); x.lineTo(-4, 4); x.lineTo(-4, 9); x.lineTo(-26, 0); x.closePath(); x.fill();
  x.beginPath(); x.moveTo(24, -6); x.lineTo(4, 4); x.lineTo(4, 9); x.lineTo(26, 0); x.closePath(); x.fill();
  x.shadowBlur = 0;
  x.fillStyle = '#d8a72e'; for (const sx of [-1, 1]) { x.beginPath(); x.moveTo(sx * 6, 16); x.lineTo(sx * 13, 34); x.lineTo(sx * 2, 24); x.closePath(); x.fill(); }
  x.strokeStyle = '#141414'; x.lineWidth = 2.5; for (const sx of [-1, 1]) { x.beginPath(); x.moveTo(sx * 10, -26); x.quadraticCurveTo(sx * 18, -46, sx * 30, -50); x.stroke(); }
  x.restore();
  // title
  x.save();
  x.font = `900 ${Math.round(h * 0.34)}px Rajdhani, Arial Black, sans-serif`;
  x.textBaseline = 'middle';
  x.lineJoin = 'round'; x.lineWidth = Math.max(3, h * 0.05); x.strokeStyle = '#0d1a0d';
  x.strokeText('WASPINATOR', w * 0.38, h * 0.42);
  const tg = x.createLinearGradient(0, h * 0.25, 0, h * 0.6); tg.addColorStop(0, '#9aef6a'); tg.addColorStop(1, '#2f8f34');
  x.fillStyle = tg; x.fillText('WASPINATOR', w * 0.38, h * 0.42);
  x.font = `700 ${Math.round(h * 0.11)}px Rajdhani, Arial, sans-serif`;
  x.fillStyle = '#fff5e0'; x.fillText('COLLAB', w * 0.385, h * 0.66);
  x.restore();
}

/** Night scene: violet sky, moon, bare trees, graves; `lanterns` adds a row of jack-o'-lanterns. */
function hollowNight(x, w, h, r, a, lanterns) {
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, a.a); g.addColorStop(0.7, '#3a1f5a'); g.addColorStop(1, '#1a0e24');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  const mx = w * 0.78, my = h * 0.32, mr = h * 0.24;
  const mg = x.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 2.6);
  mg.addColorStop(0, 'rgba(220,200,255,0.45)'); mg.addColorStop(1, 'transparent');
  x.fillStyle = mg; x.fillRect(0, 0, w, h);
  x.fillStyle = '#efe6ff'; x.beginPath(); x.arc(mx, my, mr, 0, 7); x.fill();
  x.fillStyle = 'rgba(160,140,200,0.35)'; for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(mx - mr * 0.3 + r() * mr * 0.7, my - mr * 0.3 + r() * mr * 0.6, mr * (0.08 + r() * 0.12), 0, 7); x.fill(); }
  for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.6})`; x.fillRect(r() * w, r() * h * 0.5, 1, 1); }
  // ground, trees and graves in silhouette
  x.fillStyle = '#07040c';
  x.beginPath(); x.moveTo(0, h); x.lineTo(0, h * 0.8); for (let i = 0; i <= 12; i++) x.lineTo((i / 12) * w, h * (0.78 + Math.sin(i * 1.7) * 0.03)); x.lineTo(w, h); x.fill();
  const tree = (tx, th) => {
    x.strokeStyle = '#07040c'; x.lineCap = 'round';
    const branch = (bx, by, len, ang, depth) => { const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len; x.lineWidth = Math.max(1, depth * 1.6); x.beginPath(); x.moveTo(bx, by); x.lineTo(ex, ey); x.stroke(); if (depth > 0) { branch(ex, ey, len * 0.7, ang - 0.5 - r() * 0.2, depth - 1); branch(ex, ey, len * 0.66, ang + 0.45 + r() * 0.2, depth - 1); } };
    branch(tx, h * 0.82, th, -Math.PI / 2 + (r() - 0.5) * 0.2, 4);
  };
  tree(w * 0.08, h * 0.28); tree(w * 0.55, h * 0.22);
  for (const gx of [0.22, 0.3, 0.42]) { x.fillStyle = '#07040c'; x.beginPath(); x.arc(w * gx, h * 0.76, h * 0.05, Math.PI, 0); x.lineTo(w * gx + h * 0.05, h * 0.84); x.lineTo(w * gx - h * 0.05, h * 0.84); x.fill(); }
  if (lanterns) {
    for (const [lx, ls] of [[0.18, 1], [0.36, 0.8], [0.64, 1.15], [0.9, 0.9]]) {
      const px = w * lx, py = h * 0.86, pr = h * 0.09 * ls;
      const lg = x.createRadialGradient(px, py, 1, px, py, pr * 3); lg.addColorStop(0, 'rgba(255,150,40,0.5)'); lg.addColorStop(1, 'transparent');
      x.fillStyle = lg; x.fillRect(px - pr * 3, py - pr * 3, pr * 6, pr * 6);
      x.fillStyle = a.b || '#ff8a1a'; x.beginPath(); x.ellipse(px, py, pr * 1.2, pr, 0, 0, 7); x.fill();
      x.fillStyle = '#ffe08a';
      for (const sx of [-1, 1]) { x.beginPath(); x.moveTo(px + sx * pr * 0.55, py - pr * 0.1); x.lineTo(px + sx * pr * 0.3, py - pr * 0.45); x.lineTo(px + sx * pr * 0.15, py - pr * 0.1); x.fill(); }
      x.beginPath(); x.moveTo(px - pr * 0.6, py + pr * 0.2); x.lineTo(px, py + pr * 0.45); x.lineTo(px + pr * 0.6, py + pr * 0.2); x.lineTo(px, py + pr * 0.65); x.fill();
    }
  }
}

/** Corner cobwebs with a dangling spider. */
function cobweb(x, w, h, a) {
  x.strokeStyle = a.b; x.globalAlpha = 0.55; x.lineWidth = 1;
  for (const [cx, dir] of [[0, 1], [w, -1]]) {
    const spokes = 7, R = h * 1.4;
    for (let i = 0; i <= spokes; i++) { const ang = (i / spokes) * Math.PI / 2; x.beginPath(); x.moveTo(cx, 0); x.lineTo(cx + dir * Math.cos(ang) * R, Math.sin(ang) * R); x.stroke(); }
    for (let k = 1; k < 7; k++) { x.beginPath(); for (let i = 0; i <= spokes; i++) { const ang = (i / spokes) * Math.PI / 2, rr = k * R / 7 * (0.92 + 0.08 * (i % 2)); const px = cx + dir * Math.cos(ang) * rr, py = Math.sin(ang) * rr; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); }
  }
  x.globalAlpha = 1;
  x.beginPath(); x.moveTo(w * 0.6, 0); x.lineTo(w * 0.6, h * 0.5); x.stroke();
  x.fillStyle = '#0a080c'; x.beginPath(); x.ellipse(w * 0.6, h * 0.58, h * 0.07, h * 0.09, 0, 0, 7); x.fill();
  x.strokeStyle = '#0a080c'; x.lineWidth = 2;
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(w * 0.6, h * (0.54 + i * 0.03)); x.quadraticCurveTo(w * 0.6 + s * h * 0.14, h * (0.46 + i * 0.05), w * 0.6 + s * h * 0.18, h * (0.6 + i * 0.07)); x.stroke(); }
  x.fillStyle = '#ff3b30'; x.fillRect(w * 0.6 - 3, h * 0.55, 2, 2); x.fillRect(w * 0.6 + 1, h * 0.55, 2, 2);
}

/** Foggy night woods with a very tall, faceless figure between the trees (title from item data). */
function tallWoods(x, w, h, r, a) {
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, a.a || '#0a0a10'); g.addColorStop(1, a.b || '#2a2a34');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  for (let layer = 0; layer < 3; layer++) {
    const shadeA = 0.25 + layer * 0.3;
    x.fillStyle = `rgba(6,6,10,${shadeA})`;
    for (let i = 0; i < 14; i++) { const tx = r() * w, tw = 3 + r() * (4 + layer * 5); x.fillRect(tx, 0, tw, h); }
    const fg = x.createLinearGradient(0, h * 0.5, 0, h); fg.addColorStop(0, 'rgba(180,180,200,0)'); fg.addColorStop(1, `rgba(180,180,200,${0.12 - layer * 0.03})`);
    x.fillStyle = fg; x.fillRect(0, 0, w, h);
  }
  // the figure: pale smooth head, black suit, white shirt, tie, long arms
  const fx = w * 0.7, top = h * 0.12, H = h * 0.84;
  x.fillStyle = '#e6e0d4'; x.beginPath(); x.ellipse(fx, top + H * 0.07, H * 0.045, H * 0.075, 0, 0, 7); x.fill();
  x.fillStyle = '#0b0b0e'; x.beginPath(); x.moveTo(fx - H * 0.07, top + H * 0.17); x.lineTo(fx + H * 0.07, top + H * 0.17); x.lineTo(fx + H * 0.055, top + H * 0.52); x.lineTo(fx - H * 0.055, top + H * 0.52); x.fill();
  x.fillRect(fx - H * 0.05, top + H * 0.5, H * 0.04, H * 0.5); x.fillRect(fx + H * 0.01, top + H * 0.5, H * 0.04, H * 0.5);
  x.fillStyle = '#f2f0ea'; x.beginPath(); x.moveTo(fx - H * 0.025, top + H * 0.17); x.lineTo(fx + H * 0.025, top + H * 0.17); x.lineTo(fx, top + H * 0.3); x.fill();
  x.fillStyle = '#000'; x.fillRect(fx - H * 0.006, top + H * 0.18, H * 0.012, H * 0.16);
  x.strokeStyle = '#0b0b0e'; x.lineWidth = H * 0.028; x.lineCap = 'round';
  for (const s of [-1, 1]) { x.beginPath(); x.moveTo(fx + s * H * 0.065, top + H * 0.19); x.lineTo(fx + s * H * 0.09, top + H * 0.58); x.stroke(); x.strokeStyle = '#e6e0d4'; x.lineWidth = H * 0.008; for (let k = -1; k <= 1; k++) { x.beginPath(); x.moveTo(fx + s * H * 0.09, top + H * 0.58); x.lineTo(fx + s * H * (0.09 + k * 0.01), top + H * 0.66); x.stroke(); } x.strokeStyle = '#0b0b0e'; x.lineWidth = H * 0.028; }
  if (a.title) {
    x.font = `900 ${Math.round(h * 0.26)}px Rajdhani, Arial Black, sans-serif`; x.textBaseline = 'middle';
    x.fillStyle = '#e6e0d4'; x.shadowColor = '#000'; x.shadowBlur = 8;
    x.fillText(a.title, w * 0.05, h * 0.45);
    if (a.sub) { x.font = `700 ${Math.round(h * 0.11)}px Rajdhani, Arial, sans-serif`; x.fillStyle = '#a8a4b4'; x.fillText(a.sub, w * 0.055, h * 0.7); }
    x.shadowBlur = 0;
  }
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

/**
 * Procedural meshes for every prop kind. Builders work in prop-local space
 * (origin at the footprint centre on the floor, width along x, depth along
 * z, "front" facing +z) and are placed by the batcher with the prop's
 * position and 90-degree rotation. Unrotated sizes come from PROP_KINDS or
 * the prop's own `s` override.
 */
import * as THREE from 'three';
import { PROP_KINDS } from '../data/props.js';

const TINT_FABRIC = { red: 'fabricRed', blue: 'fabricBlue', green: 'fabricGreen' };

export const BUILD = {
  desk(b, w, d, h) {
    b.box(0, h - 0.03, 0, w, 0.03, d, 'laminate');
    b.box(-w / 2 + 0.03, 0, 0, 0.03, h - 0.03, d - 0.04, 'plastic');
    b.box(w / 2 - 0.03, 0, 0, 0.03, h - 0.03, d - 0.04, 'plastic');
    b.box(0, 0.25, -d / 2 + 0.05, w - 0.1, 0.45, 0.02, 'plastic');
    b.box(-0.25, h, -0.12, 0.5, 0.36, 0.05, 'black');
    b.box(-0.25, h, -0.05, 0.12, 0.02, 0.12, 'darkMetal');
    b.box(0.1, h, 0.15, 0.42, 0.02, 0.14, 'plastic');
  },
  chair(b) {
    b.box(0, 0.42, 0, 0.46, 0.06, 0.46, 'fabric');
    b.box(0, 0.48, -0.21, 0.44, 0.45, 0.05, 'fabric');
    b.cyl(0, 0.1, 0, 0.025, 0.32, 'darkMetal', 6);
    b.box(0, 0.06, 0, 0.5, 0.03, 0.06, 'darkMetal'); b.box(0, 0.06, 0, 0.06, 0.03, 0.5, 'darkMetal');
  },
  partition(b, w, d, h, p) {
    const f = TINT_FABRIC[p.tint] || 'fabric';
    b.box(0, 0.05, 0, w - 0.06, h - 0.08, d, f);
    b.box(0, h - 0.04, 0, w, 0.04, d + 0.02, 'chrome');
    b.box(-w / 2 + 0.02, 0, 0, 0.04, h, d + 0.02, 'chrome'); b.box(w / 2 - 0.02, 0, 0, 0.04, h, d + 0.02, 'chrome');
    b.box(0, 0, 0, w, 0.06, d + 0.01, 'trimDark');
  },
  partitionTall(b, w, d, h, p) { BUILD.partition(b, w, d, h, p); },
  cabinet(b, w, d, h) {
    b.box(0, 0, 0, w, h, d, 'doorMetal');
    const n = Math.max(2, Math.round(h / 0.33));
    for (let i = 0; i < n; i++) { b.box(0, (i + 0.5) * h / n - 0.01, d / 2, w - 0.08, 0.02, 0.01, 'darkMetal'); b.box(0, (i + 0.5) * h / n + 0.04, d / 2 + 0.01, 0.12, 0.025, 0.02, 'chrome'); }
  },
  cabinetTall(b, w, d, h) {
    b.box(0, 0, 0, w, h, d, 'doorMetal');
    b.box(0, 0.02, d / 2, 0.01, h - 0.04, 0.012, 'darkMetal');
    b.box(-0.06, h * 0.5, d / 2 + 0.01, 0.02, 0.18, 0.02, 'chrome'); b.box(0.06, h * 0.5, d / 2 + 0.01, 0.02, 0.18, 0.02, 'chrome');
  },
  cabinetFallen(b, w, d, h) {
    b.box(0, 0, 0, w, h, d, 'doorMetal');
    for (let i = 0; i < 4; i++) b.box(-w / 2 + (i + 0.5) * w / 4, h, 0, 0.02, 0.01, d - 0.08, 'darkMetal');
    b.box(w * 0.3, 0, d / 2 + 0.25, 0.4, 0.04, 0.3, 'paper');
  },
  shelf(b, w, d, h) {
    b.box(-w / 2 + 0.03, 0, 0, 0.04, h, d, 'darkMetal'); b.box(w / 2 - 0.03, 0, 0, 0.04, h, d, 'darkMetal');
    const n = 5;
    for (let i = 0; i < n; i++) {
      const y = 0.08 + i * (h - 0.12) / (n - 1);
      b.box(0, y, 0, w, 0.025, d, 'doorMetal');
      if (i < n - 1) for (let k = 0; k < 6; k++) {
        const bw = 0.06 + ((i * 7 + k * 3) % 5) * 0.025;
        b.box(-w / 2 + 0.15 + k * (w - 0.3) / 6, y + 0.025, 0, bw, 0.26 + ((i + k) % 3) * 0.03, d * 0.75, k % 3 === 0 ? 'cardboard' : k % 3 === 1 ? 'bluePaint' : 'paper');
      }
    }
  },
  copier(b, w, d, h) {
    b.box(0, 0, 0, w, h - 0.12, d, 'plastic');
    b.box(0, h - 0.12, -0.05, w * 0.9, 0.1, d * 0.8, 'darkMetal');
    b.box(w / 2 + 0.12, h * 0.55, 0, 0.25, 0.03, d * 0.6, 'plastic');
    b.box(-w / 2 + 0.2, h - 0.04, d / 2 - 0.1, 0.2, 0.05, 0.12, 'screenGreen');
  },
  counter(b, w, d, h) {
    b.box(0, 0, 0, w, h - 0.05, d, 'veneer');
    b.box(0, h - 0.05, 0, w + 0.08, 0.05, d + 0.12, 'laminate');
    b.box(0, 0, d / 2 + 0.01, w - 0.1, 0.12, 0.02, 'trimDark');
  },
  table(b, w, d, h) {
    b.box(0, h - 0.04, 0, w, 0.04, d, 'laminate');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(sx * (w / 2 - 0.05), 0, sz * (d / 2 - 0.05), 0.04, h - 0.04, 0.04, 'darkMetal');
  },
  plant(b, w, d, h) {
    b.cyl(0, 0, 0, w * 0.32, 0.35, 'trimDark', 10, w * 0.4);
    for (let i = 0; i < 6; i++) { const a = i * 1.05; b.box(Math.cos(a) * 0.08, 0.3 + i * 0.12, Math.sin(a) * 0.08, 0.32, 0.5, 0.1, 'plant'); }
  },
  crate(b, w, d, h) { b.box(0, 0, 0, w, h, d, 'cardboard'); b.box(0, h - 0.01, 0, w * 0.15, 0.012, d + 0.005, 'paper'); },
  boxes(b, w, d, h) { b.box(-0.1, 0, 0, w * 0.6, h * 0.55, d * 0.9, 'cardboard'); b.box(0.15, 0, 0.05, w * 0.5, h * 0.5, d * 0.7, 'cardboard'); b.box(0, h * 0.55, 0, w * 0.5, h * 0.45, d * 0.6, 'cardboard'); },
  locker(b, w, d, h) {
    b.box(0, 0, 0, w, h, d, 'doorMetal');
    for (let i = 0; i < 4; i++) b.box(0, h - 0.25 - i * 0.05, d / 2 + 0.005, w * 0.6, 0.015, 0.01, 'black');
    b.box(w * 0.3, h * 0.5, d / 2 + 0.01, 0.03, 0.12, 0.03, 'chrome');
  },
  lockerBank(b, w, d, h) { const n = Math.round(w / 0.6); for (let i = 0; i < n; i++) { const x = -w / 2 + (i + 0.5) * w / n; b.box(x, 0, 0, w / n - 0.01, h, d, 'doorMetal'); b.box(x, h - 0.3, d / 2 + 0.005, w / n * 0.6, 0.12, 0.01, 'black'); } },
  sofa(b, w, d, h) { b.box(0, 0, 0, w, h * 0.5, d, 'fabricRed'); b.box(0, h * 0.5, -d / 2 + 0.12, w, h * 0.5, 0.24, 'fabricRed'); b.box(-w / 2 + 0.1, h * 0.5, 0, 0.2, h * 0.25, d, 'fabricRed'); b.box(w / 2 - 0.1, h * 0.5, 0, 0.2, h * 0.25, d, 'fabricRed'); },
  bed(b, w, d, h) { b.box(0, 0, 0, w, h * 0.6, d, 'veneer'); b.box(0, h * 0.6, 0, w - 0.05, h * 0.4, d - 0.05, 'white'); b.box(0, h, -d / 2 + 0.25, w * 0.7, 0.12, 0.35, 'white'); },
  wardrobe(b, w, d, h) { b.box(0, 0, 0, w, h, d, 'veneer'); b.box(0, 0.05, d / 2, 0.01, h - 0.1, 0.01, 'trimDark'); },
  tv(b, w, d, h) { b.box(0, 0, 0, w, h * 0.5, d, 'veneer'); b.box(0, h * 0.5, 0, w * 0.8, h * 0.5, d * 0.8, 'black'); b.box(0, h * 0.55, d * 0.4, w * 0.65, h * 0.38, 0.01, 'darkMetal'); },
  mesh(b, w, d, h) {
    b.box(0, 0, 0, w, 0.05, 0.06, 'darkMetal'); b.box(0, h - 0.05, 0, w, 0.05, 0.06, 'darkMetal');
    const n = Math.max(2, Math.round(w / 1.5));
    for (let i = 0; i <= n; i++) b.box(-w / 2 + i * w / n, 0, 0, 0.05, h, 0.06, 'darkMetal');
    b.box(0, 0.05, 0, w, h - 0.1, 0.01, 'meshWire');
  },
  glass(b, w, d, h) { b.box(0, 0, 0, w, 0.06, 0.08, 'darkMetal'); b.box(0, h - 0.06, 0, w, 0.06, 0.08, 'darkMetal'); b.box(0, 0.06, 0, w, h - 0.12, 0.02, 'glass'); },
  pillar(b, w, d, h) { b.box(0, 0, 0, w, h, d, 'concrete'); },
  railing(b, w, d, h) { const n = Math.max(2, Math.round(w / 1.2)); for (let i = 0; i <= n; i++) b.box(-w / 2 + i * w / n, 0, 0, 0.04, h, 0.04, 'darkMetal'); b.box(0, h - 0.04, 0, w, 0.04, 0.05, 'darkMetal'); b.box(0, h * 0.5, 0, w, 0.03, 0.03, 'darkMetal'); },
  barrier(b, w, d, h) { BUILD.railing(b, w, d, h); b.box(0, h * 0.25, 0, w, 0.15, 0.02, 'hazard'); },
  display(b, w, d, h) { b.box(0, 0, 0, w, h, d, 'white'); b.box(0, h, 0, w - 0.1, 0.02, d - 0.1, 'glass'); },
  rack(b, w, d, h) { b.box(-w / 2 + 0.02, 0, 0, 0.03, h, 0.03, 'chrome'); b.box(w / 2 - 0.02, 0, 0, 0.03, h, 0.03, 'chrome'); b.box(0, h - 0.03, 0, w, 0.03, 0.03, 'chrome'); for (let i = 0; i < 6; i++) b.box(-w / 2 + 0.2 + i * (w - 0.4) / 5, h * 0.3, 0, 0.05, h * 0.62, d * 0.8, i % 2 ? 'fabricBlue' : 'fabricRed'); },
  fountain(b, w, d, h) { b.cyl(0, 0, 0, w / 2, h, 'terrazzo', 24); b.cyl(0, h - 0.05, 0, w / 2 - 0.25, 0.06, 'concrete', 24); b.cyl(0, h, 0, 0.3, 1.2, 'terrazzo', 12); b.cyl(0, h + 1.2, 0, 0.9, 0.12, 'terrazzo', 16); },
  bench(b, w, d, h) { b.box(0, h - 0.06, 0, w, 0.06, d, 'veneer'); b.box(-w / 2 + 0.1, 0, 0, 0.06, h - 0.06, d - 0.05, 'chrome'); b.box(w / 2 - 0.1, 0, 0, 0.06, h - 0.06, d - 0.05, 'chrome'); },
  kiosk(b, w, d, h) { b.box(0, 0, 0, w, h * 0.45, d, 'pastelBlue'); b.box(0, h * 0.85, 0, w + 0.2, h * 0.15, d + 0.2, 'pastelBlue'); b.box(-w / 2 + 0.05, h * 0.45, -d / 2 + 0.05, 0.08, h * 0.4, 0.08, 'chrome'); b.box(w / 2 - 0.05, h * 0.45, -d / 2 + 0.05, 0.08, h * 0.4, 0.08, 'chrome'); b.box(-w / 2 + 0.05, h * 0.45, d / 2 - 0.05, 0.08, h * 0.4, 0.08, 'chrome'); b.box(w / 2 - 0.05, h * 0.45, d / 2 - 0.05, 0.08, h * 0.4, 0.08, 'chrome'); },
  directory(b, w, d, h) { b.box(0, 0, 0, w, h, d, 'trimDark'); b.box(0, 0.6, d / 2 + 0.005, w - 0.12, h - 0.75, 0.01, 'black'); },
  pump(b, w, d, h) { b.box(0, 0, 0, w, h * 0.6, d, 'bluePaint'); b.cylX(0, h * 0.75, 0, d * 0.3, w * 0.9, 'darkMetal', 12); b.cyl(w * 0.3, h * 0.6, 0, 0.12, h * 0.4, 'darkMetal'); },
  tank(b, w, d, h) { b.cyl(0, 0, 0, Math.min(w, d) / 2, h, 'metal', 16); },
  mailboxes(b, w, d, h) { b.box(0, 0, 0, w, h, d, 'veneer'); for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) b.box(-w / 2 + 0.2 + c * (w - 0.4) / 5, 0.5 + r * 0.3, d / 2 + 0.005, 0.3, 0.22, 0.01, 'chrome'); },
  washer(b, w, d, h) { b.box(0, 0, 0, w, h, d, 'white'); b.cylZ(0, h * 0.5, d / 2, w * 0.3, 0.02, 'glass', 16); },
  cart(b, w, d, h) { b.box(0, 0.2, 0, w, 0.05, d, 'chrome'); b.box(0, h - 0.05, 0, w, 0.05, d, 'chrome'); for (const sx of [-1, 1]) for (const sz of [-1, 1]) { b.box(sx * (w / 2 - 0.03), 0.08, sz * (d / 2 - 0.03), 0.03, h - 0.08, 0.03, 'chrome'); b.cyl(sx * (w / 2 - 0.05), 0, sz * (d / 2 - 0.05), 0.04, 0.08, 'rubber', 8); } },
  machine(b, w, d, h) { b.box(0, 0, 0, w, h * 0.85, d, 'orangePaint'); b.box(0, h * 0.85, 0, w * 0.6, h * 0.15, d * 0.6, 'darkMetal'); b.cylX(0, h * 0.4, d / 2 + 0.1, 0.25, w * 0.7, 'darkMetal'); },
  press(b, w, d, h) { b.box(0, 0, 0, w, 0.5, d, 'darkMetal'); b.box(-w / 2 + 0.2, 0.5, 0, 0.3, h - 0.5, d * 0.8, 'orangePaint'); b.box(w / 2 - 0.2, 0.5, 0, 0.3, h - 0.5, d * 0.8, 'orangePaint'); b.box(0, h - 0.6, 0, w, 0.6, d, 'orangePaint'); b.box(0, 1.4, 0, w - 0.7, 0.5, d * 0.7, 'rust'); },
  turbine(b, w, d, h) { b.cyl(0, 0, 0, Math.min(w, d) / 2, h * 0.75, 'rust', 16); b.box(0, h * 0.75, 0, w * 0.5, h * 0.25, d * 0.5, 'darkMetal'); },
  workbench(b, w, d, h) { b.box(0, h - 0.06, 0, w, 0.06, d, 'veneer'); for (const sx of [-1, 1]) b.box(sx * (w / 2 - 0.05), 0, 0, 0.06, h - 0.06, d - 0.05, 'darkMetal'); b.box(0, 0.15, 0, w - 0.1, 0.03, d - 0.1, 'darkMetal'); b.box(-0.4, h, 0, 0.3, 0.12, 0.2, 'redPaint'); },
  drum(b, w, d, h) { b.cyl(0, 0, 0, w / 2, h, 'bluePaint', 14); b.cyl(0, h * 0.33, 0, w / 2 + 0.01, 0.03, 'darkMetal', 14); b.cyl(0, h * 0.66, 0, w / 2 + 0.01, 0.03, 'darkMetal', 14); },
  console(b, w, d, h) { b.box(0, 0, 0, w, h * 0.8, d, 'darkMetal'); b.box(0, h * 0.8, 0.05, w, 0.05, d - 0.1, 'darkMetal'); b.box(0, h * 0.85, -d / 2 + 0.08, w * 0.9, h * 0.35, 0.06, 'screenGreen'); },
  relay(b, w, d, h) {
    b.box(0, 0, 0, w, h, d, 'darkMetal');
    for (let i = 0; i < 6; i++) b.box(-w / 2 + 0.25 + i * (w - 0.5) / 5, h * 0.7, d / 2 + 0.005, 0.12, 0.05, 0.01, i % 3 === 0 ? 'ledRed' : 'ledGreen');
    for (let i = 0; i < 3; i++) b.box(0, h * 0.2 + i * 0.25, d / 2 + 0.005, w * 0.8, 0.012, 0.01, 'black');
  },
  pipeRun(b, w, d, h) { b.cylX(0, h / 2, 0, Math.min(d, h) / 2, w, 'metal', 10); },
  cableTray(b, w, d, h) { b.box(0, 0, 0, w, 0.04, d, 'darkMetal'); for (let i = 0; i < 3; i++) b.cylZ(-0.12 + i * 0.12, 0.08, 0, 0.03, d, 'rubber', 6); },
  vent(b, w, d, h) { b.box(0, 0, 0, w, h, 0.02, 'darkMetal'); for (let i = 0; i < 5; i++) b.box(0, 0.05 + i * h / 5.5, 0.012, w - 0.06, 0.025, 0.01, 'black'); },
  liftPanel(b, w, d, h) { b.box(0, 0, 0, w, h, 0.03, 'chrome'); for (let i = 0; i < 6; i++) b.cylZ(0, 0.12 + i * 0.09, 0.02, 0.025, 0.02, 'lampWarm', 10); },
  seam(b, w) { b.box(0, 0.002, 0, w, 0.004, 0.04, 'hazard'); },
  sign() { /* drawn by the view with a canvas texture */ },
  grating(b, w, d) { b.box(0, 0, 0, w, 0.04, d, 'grating'); },
  lane(b, w, d) { b.box(0, 0.25, 0, w, 0.06, 0.06, 'redPaint'); },
  storefront(b, w, d, h) {
    b.box(0, 0, -0.02, w, h, 0.04, 'black');
    b.box(-w / 2 + 0.06, 0, 0.04, 0.12, h, 0.12, 'chrome'); b.box(w / 2 - 0.06, 0, 0.04, 0.12, h, 0.12, 'chrome');
    b.box(0, h - 0.55, 0.06, w, 0.55, 0.14, 'pastel');
    b.box(0, 0, 0.05, w - 0.24, 0.3, 0.1, 'chrome');
    b.box(0, 0.3, 0.07, w - 0.24, h - 0.85, 0.02, 'glass');
    b.box(0, 0.3 + (h - 0.85) * 0.55, 0.0, w - 0.24, (h - 0.85) * 0.45, 0.05, 'metal');
  },
  moon(b, w) {
    b.sphere(0, 0, 0, w / 2, 'plaster', 18);
    for (let i = 0; i < 3; i++) b.cyl(Math.cos(i * 2.1) * w * 0.3, w * 0.3, Math.sin(i * 2.1) * w * 0.3, 0.012, 4.5, 'darkMetal', 4);
  },
  toyShelf(b, w, d, h, p) {
    b.box(0, 0, -d / 2 + 0.02, w, h, 0.04, 'veneer');
    for (let i = 0; i < 3; i++) b.box(0, 0.05 + i * (h - 0.1) / 2.6, 0, w, 0.03, d, 'veneer');
    b.box(-w / 2 + 0.02, 0, 0, 0.04, h, d, 'veneer'); b.box(w / 2 - 0.02, 0, 0, 0.04, h, d, 'veneer');
    if (p.toys) {
      p.toys.forEach(([, sz], i) => { const x = -w / 2 + 0.45 + i * (w - 0.9) / 2; b.box(x, 0.65, 0, sz * 0.8, sz, sz * 0.7, ['redPaint', 'bluePaint', 'greenPaint'][i % 3]); });
    } else {
      for (let r = 0; r < 3; r++) for (let k = 0; k < 6; k++) {
        const x = -w / 2 + 0.25 + k * (w - 0.5) / 5, y = 0.08 + r * (h - 0.1) / 2.6;
        const m = ['redPaint', 'bluePaint', 'greenPaint', 'white', 'cardboard'][(r * 3 + k) % 5];
        if ((r + k) % 2) b.box(x, y, 0, 0.18, 0.22, 0.16, m); else b.sphere(x, y + 0.1, 0, 0.1, m, 8);
      }
    }
  },
  labelPlate() {},
  escalator(b, w, d, h) {
    const n = Math.round(d / 0.4);
    for (let i = 0; i < n; i++) b.box(0, -i * 0.3, -d / 2 + i * 0.4 + 0.2, w - 0.2, 0.06, 0.4, 'darkMetal');
    b.box(-w / 2 + 0.05, -n * 0.3, 0, 0.1, n * 0.3 + 1.0, d, 'chrome');
    b.box(w / 2 - 0.05, -n * 0.3, 0, 0.1, n * 0.3 + 1.0, d, 'chrome');
    b.box(0, 0, -d / 2 - 0.6, w + 0.4, 0.02, 1.2, 'diamondPlate');
  },
  foodTable(b) { b.cyl(0, 0, 0, 0.06, 0.72, 'chrome', 8); b.cyl(0, 0.72, 0, 0.6, 0.04, 'white', 18); for (let i = 0; i < 3; i++) { const a = i * 2.1; b.box(Math.cos(a) * 0.95, 0.42, Math.sin(a) * 0.95, 0.4, 0.04, 0.4, 'pastelMint'); b.cyl(Math.cos(a) * 0.95, 0, Math.sin(a) * 0.95, 0.03, 0.42, 'chrome', 6); } },
  silhouette() {},
  mannequin(b) { b.cyl(0, 0, 0, 0.18, 0.04, 'chrome', 12); b.cyl(0, 0.04, 0, 0.02, 0.8, 'chrome', 6); b.box(0, 0.85, 0, 0.36, 0.55, 0.2, 'white'); b.sphere(0, 1.55, 0, 0.11, 'white', 10); b.box(0, 1.38, 0, 0.08, 0.1, 0.08, 'white'); b.box(-0.22, 0.95, 0, 0.07, 0.48, 0.08, 'white'); b.box(0.22, 0.95, 0, 0.07, 0.48, 0.08, 'white'); },
  mirror(b, w, d, h) { b.box(0, 0, 0, w, h, d, 'trimDark'); b.box(0, 0.06, d / 2, w - 0.12, h - 0.12, 0.01, 'chrome'); },
  shutterPanel(b, w, d, h) { const n = Math.round(h / 0.12); for (let i = 0; i < n; i++) b.box(0, i * 0.12, 0, w, 0.11, d, 'metal'); b.box(0, h, 0, w + 0.1, 0.18, d + 0.1, 'darkMetal'); },
  lever(b) { b.box(0, -0.15, 0, 0.22, 0.3, 0.06, 'darkMetal'); b.box(0, 0, 0.08, 0.04, 0.32, 0.04, 'redPaint'); },
  speaker(b, w, d, h) { b.box(0, 0, 0, w, h, d, 'black'); b.box(0, 0.05, d / 2, w - 0.06, h - 0.1, 0.01, 'meshWire'); },
  lifeguardChair(b, w, d, h) { for (const sx of [-1, 1]) { b.box(sx * w * 0.4, 0, -d * 0.3, 0.06, h, 0.06, 'white'); b.box(sx * w * 0.4, 0, d * 0.3, 0.06, h * 0.7, 0.06, 'white'); } b.box(0, h * 0.7, 0, w, 0.06, d * 0.5, 'white'); b.box(0, h * 0.7, -d * 0.25, w, 0.6, 0.05, 'white'); for (let i = 1; i < 5; i++) b.box(0, i * h * 0.14, d * 0.3, w * 0.8, 0.04, 0.06, 'white'); },
  floatCup(b) { b.cyl(0, 0, 0, 0.045, 0.09, 'redPaint', 10, 0.055); },
  windowArch(b, w, d, h) {
    b.box(0, 0, 0, w + 0.4, 0.2, 0.3, 'white'); b.box(-w / 2 - 0.1, 0, 0, 0.2, h, 0.3, 'white'); b.box(w / 2 + 0.1, 0, 0, 0.2, h, 0.3, 'white');
    b.box(0, 0.2, -0.05, w, h - 0.2, 0.04, 'daylight');
    for (let i = 1; i < 5; i++) b.box(-w / 2 + i * w / 5, 0.2, 0, 0.08, h - 0.2, 0.08, 'white');
    for (let j = 1; j < 3; j++) b.box(0, j * h / 3, 0, w, 0.08, 0.08, 'white');
  },
  divider(b, w, d, h) { b.box(0, 0, 0, w, h, d, 'whiteTile'); b.box(0, h, 0, w + 0.04, 0.04, d + 0.04, 'chrome'); },
  post(b, w, d, h) { b.cyl(0, 0, 0, w / 2, h, 'chrome', 8); },
  tileGrid(b, w) { const s = w / 4; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) b.box(-w / 2 + (i + 0.5) * s, 0.02, -w / 2 + (j + 0.5) * s, s - 0.08, 0.03, s - 0.08, 'glassTile'); },
  bridge(b, w, d, h, p) {
    const s = w / 4;
    for (const c of p.path || []) { const i = 'ABCD'.indexOf(c[0]), j = +c[1] - 1; b.box(-w / 2 + (i + 0.5) * s, 0.06, -w / 2 + (j + 0.5) * s, s * 0.5, 0.04, s * 0.5, 'hazard'); }
  },
  waveScreen(b, w, d, h) { b.box(0, 0, 0, w, h, d, 'black'); b.box(0, 0.05, -d / 2 - 0.005, w - 0.1, h - 0.1, 0.01, 'screenGreen'); },
  stairsDown(b, w, d) { const n = 16; for (let i = 0; i < n; i++) b.box(0, -i * 0.25, -d / 2 + (i + 0.5) * d / n, w, 0.25, d / n, 'whiteTile'); b.box(-w / 2, -4, 0, 0.1, 5, d, 'whiteTile'); b.box(w / 2, -4, 0, 0.1, 5, d, 'whiteTile'); },
  aptWindow(b, w, d, h, p) {
    b.box(0, 0, 0, w + 0.16, 0.08, 0.14, 'veneer'); b.box(0, h, 0, w + 0.16, 0.08, 0.14, 'veneer');
    b.box(-w / 2 - 0.04, 0, 0, 0.08, h + 0.08, 0.14, 'veneer'); b.box(w / 2 + 0.04, 0, 0, 0.08, h + 0.08, 0.14, 'veneer');
    b.box(0, 0.08, -0.02, w, h - 0.08, 0.02, p.lit ? 'lampWarmDim' : 'black');
    b.box(-w * 0.28, 0.08, 0.03, w * 0.4, h - 0.1, 0.01, 'curtain'); b.box(w * 0.28, 0.08, 0.03, w * 0.4, h - 0.1, 0.01, 'curtain');
    if (p.marked) { b.box(0, -0.12, 0.08, w + 0.3, 0.06, 0.01, 'hazard'); b.box(0, h + 0.12, 0.08, w + 0.3, 0.06, 0.01, 'hazard'); }
  },
  laundryLine(b, w, d, h) {
    b.box(0, h, 0, w, 0.015, 0.015, 'darkMetal');
    for (let i = 0; i < 9; i++) { const x = -w / 2 + 1.5 + i * (w - 3) / 8; b.box(x, h - 0.65, 0, 0.6 + (i % 3) * 0.15, 0.65, 0.01, ['white', 'curtain', 'fabricBlue', 'fabricRed'][i % 4]); }
  },
  aptDoor(b, w, d, h) { b.box(0, 0, 0, w + 0.14, h + 0.08, 0.06, 'veneer'); b.box(0, 0.02, 0.04, w - 0.06, h - 0.04, 0.04, 'doorWood'); b.box(w * 0.36, h * 0.48, 0.08, 0.1, 0.03, 0.06, 'chrome'); b.box(0, h * 0.8, 0.07, 0.24, 0.12, 0.01, 'chrome'); },
  frameMount(b, w, d, h) { b.box(0, h * 0.5, 0, 0.04, 0.04, 0.05, 'chrome'); b.box(0, 0, 0, w, 0.02, 0.01, 'trimDark'); },
  radioBank(b, w, d, h) { b.box(0, 0, 0, w, h, d, 'veneer'); for (let i = 0; i < 6; i++) { b.box(-w / 2 + 0.35 + i * (w - 0.7) / 5, h * 0.55, d / 2, 0.5, 0.35, 0.02, 'fabric'); b.cylZ(-w / 2 + 0.35 + i * (w - 0.7) / 5, h * 0.35, d / 2 + 0.02, 0.05, 0.03, 'chrome', 10); } },
  hatch(b, w, d) { b.box(0, 0, 0, w, 0.04, d, 'diamondPlate'); b.box(0, 0.04, -d / 2 + 0.08, w * 0.3, 0.03, 0.05, 'darkMetal'); b.box(0, 0.005, 0, w + 0.08, 0.03, d + 0.08, 'hazard'); },
  slab(b, w, d, h) { b.box(0, 0, 0, w, h, d, 'concrete'); },
  platform(b, w, d, h) {
    b.box(0, 0, 0, w, h * 0.5, d, 'grating');
    for (const sx of [-1, 1]) b.box(sx * (w / 2 - 0.06), -0.25, 0, 0.12, 0.3, d, 'orangePaint');
    for (const sz of [-1, 0, 1]) b.box(0, -0.25, sz * (d / 2 - 0.1), w, 0.2, 0.12, 'orangePaint');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(sx * (w / 2 - 0.15), -6, sz * (d / 2 - 0.2), 0.05, 6, 'darkMetal', 6);
  },
  counterweight(b, w, d, h) {
    b.box(0, 0, 0, w, h, d, 'darkMetal'); b.box(0, h * 0.35, d / 2 + 0.005, w * 0.8, h * 0.3, 0.01, 'hazard');
    b.box(0, h, 0, 0.06, 4, 0.06, 'chrome'); b.box(0, -0.6, 0, 0.12, 0.6, 0.12, 'darkMetal');
  },
  testLamp(b, w, d, h, p) { b.box(0, 0, 0, w, 0.06, d, 'darkMetal'); b.sphere(0, -0.06, 0, w * 0.35, p.lit ? 'lampWarm' : 'lampOff', 10); },
  wheelValve(b, w) {
    b.cylZ(0, 0, 0, 0.05, 0.25, 'darkMetal', 8);
    const r = w / 2;
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; b.box(Math.cos(a) * r, Math.sin(a) * r, 0.13, 0.12, 0.12, 0.05, 'redPaint'); }
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI; const g = new THREE.BoxGeometry(w, 0.04, 0.03); g.rotateZ(a); g.translate(0, 0, 0.13); b.geo(g, 'redPaint'); }
  },
  doorFrame(b, w, d, h) {
    for (const sx of [-1, 1]) b.box(sx * (w / 2 - 0.15), 0, 0, 0.3, h, d, 'doorMetal');
    b.box(0, h - 0.3, 0, w, 0.3, d, 'doorMetal'); b.box(-w / 2 + 0.25, 0, d / 2 + 0.05, 0.5, h - 0.3, 0.06, 'hazard');
  },
  duct(b, w, d, h) {
    b.box(0, h, 0, w, 0.08, d + 0.4, 'metal');
    for (const sz of [-1, 1]) b.box(0, 0, sz * (d / 2 + 0.1), w, h + 0.08, 0.2, 'metal');
    b.box(w / 2 + 0.1, 0, 0, 0.2, h + 0.08, d + 0.4, 'metal');
    b.box(-w / 2, h - 0.1, 0, 0.06, 0.18, d + 0.4, 'hazard');
  },
  beacon(b, w, d, h) { b.box(0, 0, 0, w, h, d * 0.5, 'darkMetal'); b.box(0, h * 0.2, d * 0.25, w * 0.6, h * 0.6, d * 0.5, 'beaconRed'); },
  shaftCable(b, w, d, h) { b.cyl(0, -h, 0, w / 2, h * 2, 'rubber', 6); },
  decal() {},
  block() {},
};

export function propDims(p) {
  const K = PROP_KINDS[p.k] || PROP_KINDS.block;
  return p.s || [K.w, K.d, K.h];
}

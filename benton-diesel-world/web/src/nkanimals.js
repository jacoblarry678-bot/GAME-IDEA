// Natural Kingdom's animals: blocky, stylized figures built from parts -
// the savanna's giraffes, elephants, zebras, lions, rhinos, hippos,
// flamingos, ostriches and wildebeest, the rainforest's crocodiles,
// gorillas, tigers and monkeys, and Primeval Valley's dinosaurs. Each is
// placed at (x, y, z) facing `yaw` (their noses toward -z at yaw 0), at a
// scale. With `out` they're built as parts of a moving model (a ride's
// extra) instead of the static world.
import { helpers } from './wolverine.js';

const mul = (a, b) => { const o = new Array(9).fill(0); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) o[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j]; return o; };
const RX = (a) => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
const RY = (a) => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
const RZ = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export function animalKit(data) {
  const { add, mi } = helpers(data);
  // a body part: local position and size (scaled), turned with the animal
  const make = (x, y, z, yaw, s, out) => (lp, size, color, mat = 'SmoothPlastic', { shape = 0, rot = I3 } = {}) => {
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    const [lx, ly, lz] = lp.map((v) => v * s);
    const R = mul(RY(yaw), rot);
    const sz = size.map((v) => v * s);
    if (out) { out.push([shape, ...sz, lx * c + lz * sn, ly, -lx * sn + lz * c, ...mul(RY(yaw), rot), color, mi(mat), 0, 0]); return; }
    add(sz, [x + lx * c + lz * sn, y + ly, z - lx * sn + lz * c], color, mat, { collide: 0, shape, rot: R });
  };
  const legs = (P, w, h, dx, dz, color, y0 = 0) => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) P([sx * dx, y0 + h / 2, sz * dz], [w, h, w], color); };

  const A = {
    giraffe(x, y, z, yaw = 0, s = 1, out) {
      const P = make(x, y, z, yaw, s, out), Y = 0xe8b040, B = 0x8a5020;
      legs(P, 0.5, 5.4, 0.7, 1.6, Y);
      P([0, 6.3, 0], [2.2, 2, 4.4], Y);
      P([0, 9.4, -2.4], [1, 6.4, 1], Y, 'SmoothPlastic', { rot: RX(-0.38) });
      P([0, 12.6, -3.8], [1, 1, 2.2], Y);
      for (const sx of [-0.3, 0.3]) P([sx, 13.4, -3.4], [0.2, 0.7, 0.2], B);
      for (const [px, py, pz] of [[0.9, 6.6, 1], [-1, 6.2, -0.8], [0.8, 5.8, -1.4], [-0.9, 6.9, 1.3], [0.4, 8.6, -2], [-0.4, 10.4, -2.9]]) P([px * 1.15, py, pz], [0.2, 0.7, 0.8], B);
      P([0, 6.4, 2.4], [0.2, 1.8, 0.2], B, 'SmoothPlastic', { rot: RX(-0.3) });
    },
    elephant(x, y, z, yaw = 0, s = 1, out, trunk = true) {
      const P = make(x, y, z, yaw, s, out), Gr = 0x8a8a88, D = 0x6a6a68;
      legs(P, 1.6, 4, 1.3, 2.2, Gr);
      P([0, 5.6, 0], [4.2, 4, 6.6], Gr);
      P([0, 6.6, -3.8], [2.8, 3, 2.4], Gr);
      for (const sx of [-1, 1]) P([sx * 1.9, 6.6, -3.4], [0.3, 3.2, 2.8], D, 'SmoothPlastic', { rot: RY(sx * 0.4) });
      if (trunk) { P([0, 4.6, -5.1], [0.8, 3, 0.8], D, 'SmoothPlastic', { rot: RX(0.25) }); P([0, 2.7, -5.6], [0.6, 1.6, 0.6], D); }
      for (const sx of [-0.7, 0.7]) P([sx, 5, -5], [0.3, 0.3, 1.6], 0xf4f0e0, 'SmoothPlastic', { rot: RX(0.5) });
      P([0, 6.5, 3.4], [0.25, 2, 0.25], D, 'SmoothPlastic', { rot: RX(-0.3) });
    },
    zebra(x, y, z, yaw = 0, s = 1, out) {
      const P = make(x, y, z, yaw, s, out), W = 0xf4f4f0, K = 0x1a1a1a;
      legs(P, 0.4, 2.6, 0.5, 1.2, W);
      P([0, 3.2, 0], [1.3, 1.4, 3.2], W);
      P([0, 4.2, -1.8], [0.6, 1.8, 0.7], W, 'SmoothPlastic', { rot: RX(-0.5) });
      P([0, 4.6, -2.5], [0.6, 0.6, 1.4], W);
      for (let k = -3; k <= 3; k++) P([0, 3.2, k * 0.45], [1.34, 1.44, 0.16], K);
      P([0, 5, -2.1], [0.18, 0.6, 0.9], K);
      P([0, 3.3, 1.7], [0.15, 1.2, 0.15], K, 'SmoothPlastic', { rot: RX(-0.3) });
    },
    lion(x, y, z, yaw = 0, s = 1, out, lying = false) {
      const P = make(x, y, z, yaw, s, out), Gd = 0xd8a040, M = 0x8a5020;
      const h = lying ? 0 : 1.6;
      if (!lying) legs(P, 0.5, 1.8, 0.5, 1.2, Gd);
      P([0, 1.2 + h * 0.6, 0], [1.5, 1.3, 3.4], Gd);
      P([0, 1.9 + h * 0.6, -1.9], [2.2, 2.2, 1.4], M, 'SmoothPlastic', { shape: 3 });
      P([0, 1.9 + h * 0.6, -2.5], [1, 1, 1.1], Gd);
      if (lying) for (const sx of [-0.5, 0.5]) P([sx, 0.3, -2.4], [0.4, 0.4, 1.4], Gd);
      P([0, 1.4 + h * 0.6, 2.4], [0.2, 0.2, 2], Gd, 'SmoothPlastic', { rot: RX(-0.4) });
    },
    lioness(x, y, z, yaw = 0, s = 1, out) {
      const P = make(x, y, z, yaw, s, out), Gd = 0xd8a858;
      legs(P, 0.45, 1.8, 0.45, 1.1, Gd);
      P([0, 2.3, 0], [1.3, 1.1, 3], Gd);
      P([0, 2.7, -1.9], [0.8, 0.8, 1.1], Gd);
      P([0, 2.1, 2], [0.18, 0.18, 1.8], Gd, 'SmoothPlastic', { rot: RX(-0.5) });
    },
    rhino(x, y, z, yaw = 0, s = 1, out) {
      const P = make(x, y, z, yaw, s, out), Gr = 0x7a7470;
      legs(P, 1.1, 2.2, 0.9, 1.6, Gr);
      P([0, 3.3, 0], [2.6, 2.4, 4.6], Gr);
      P([0, 3.1, -2.8], [1.6, 1.6, 1.8], Gr);
      P([0, 3.9, -3.6], [0.4, 1.4, 0.4], 0xd8d0c0, 'SmoothPlastic', { rot: RX(-0.3) });
      P([0, 4.2, -2.9], [0.3, 0.7, 0.3], 0xd8d0c0);
      for (const sx of [-0.5, 0.5]) P([sx, 4, -2.3], [0.2, 0.6, 0.3], Gr);
    },
    hippo(x, y, z, yaw = 0, s = 1, out) {
      const P = make(x, y, z, yaw, s, out), H = 0x8a6a7a;
      P([0, 1.2, 0], [3, 2.4, 4.6], H);
      P([0, 1.6, -2.8], [2.6, 1.8, 1.6], H);
      for (const sx of [-0.7, 0.7]) { P([sx, 2.7, -2.4], [0.5, 0.5, 0.5], H, 'SmoothPlastic', { shape: 3 }); P([sx, 2.6, -2.6], [0.3, 0.3, 0.2], 0x1a1a1a, 'SmoothPlastic', { shape: 3 }); }
    },
    flamingo(x, y, z, yaw = 0, s = 1, out) {
      const P = make(x, y, z, yaw, s, out), Pk = 0xf08aa0;
      P([0, 1.1, 0], [0.12, 2.2, 0.12], Pk);
      P([0, 2.6, 0], [0.9, 0.8, 1.4], Pk, 'SmoothPlastic', { shape: 3 });
      P([0, 3.5, -0.5], [0.15, 1.6, 0.15], Pk, 'SmoothPlastic', { rot: RX(-0.25) });
      P([0, 4.2, -0.8], [0.3, 0.3, 0.6], Pk);
      P([0, 4.1, -1.1], [0.15, 0.15, 0.3], 0x1a1a1a);
    },
    ostrich(x, y, z, yaw = 0, s = 1, out) {
      const P = make(x, y, z, yaw, s, out);
      for (const sx of [-0.3, 0.3]) P([sx, 1.4, 0], [0.2, 2.8, 0.2], 0xd8a080);
      P([0, 3.4, 0], [1.6, 1.4, 2.2], 0x1a1a1a, 'SmoothPlastic', { shape: 3 });
      P([0, 3.9, 0.9], [1, 0.6, 0.8], 0xf4f4f0, 'SmoothPlastic', { shape: 3 });
      P([0, 5, -0.8], [0.25, 2.6, 0.25], 0xd8a080);
      P([0, 6.3, -1], [0.4, 0.4, 0.7], 0xd8a080);
    },
    wildebeest(x, y, z, yaw = 0, s = 1, out) {
      const P = make(x, y, z, yaw, s, out), Bw = 0x4a4038;
      legs(P, 0.45, 2.4, 0.55, 1.3, Bw);
      P([0, 3.2, 0], [1.4, 1.6, 3.2], Bw);
      P([0, 3.4, -1.9], [0.8, 1.2, 1.2], Bw, 'SmoothPlastic', { rot: RX(-0.4) });
      for (const sx of [-1, 1]) P([sx * 0.55, 4.1, -2.1], [0.9, 0.18, 0.18], 0xd8d0c0, 'SmoothPlastic', { rot: RZ(sx * 0.4) });
      P([0, 3.6, -1.1], [0.2, 1, 1.2], 0x1a1a1a);
    },
    crocodile(x, y, z, yaw = 0, s = 1, out) {
      const P = make(x, y, z, yaw, s, out), Cg = 0x4a5a2a;
      P([0, 0.45, 0], [1.6, 0.8, 4], Cg);
      P([0, 0.35, -2.9], [1, 0.55, 2.2], Cg);
      P([0, 0.3, 3.4], [0.9, 0.5, 3.4], Cg, 'SmoothPlastic', { rot: RY(0.2) });
      for (const sx of [-0.35, 0.35]) P([sx, 0.75, -2.1], [0.25, 0.25, 0.25], 0xd8c020, 'SmoothPlastic', { shape: 3 });
      for (const sx of [-1, 1]) for (const sz of [-1.2, 1.3]) P([sx * 0.95, 0.2, sz], [0.5, 0.3, 0.7], Cg);
      for (let k = -3; k <= 6; k++) P([0, 0.9, k * 0.5], [0.2, 0.2, 0.25], 0x3a4a20);
    },
    gorilla(x, y, z, yaw = 0, s = 1, out) {
      const P = make(x, y, z, yaw, s, out), K = 0x2a2a2c, Gs = 0x5a5a5c;
      for (const sx of [-0.6, 0.6]) P([sx, 0.9, 0.4], [0.7, 1.8, 0.8], K);
      P([0, 2.8, 0], [2.2, 2.4, 1.6], K);
      P([0, 2.9, 0.75], [1.8, 1.2, 0.2], Gs);
      P([0, 4.4, -0.3], [1.1, 1.1, 1.1], K);
      P([0, 4.2, -0.9], [0.7, 0.6, 0.3], 0x3a3a3c);
      for (const sx of [-1.3, 1.3]) P([sx, 2.1, -0.4], [0.6, 2.8, 0.6], K, 'SmoothPlastic', { rot: RX(0.3) });
    },
    tiger(x, y, z, yaw = 0, s = 1, out) {
      const P = make(x, y, z, yaw, s, out), O = 0xe8802a, K = 0x1a1a1a;
      legs(P, 0.5, 1.6, 0.5, 1.2, O);
      P([0, 2.2, 0], [1.4, 1.2, 3.4], O);
      P([0, 2.6, -2], [1, 1, 1.1], O);
      for (let k = -3; k <= 3; k++) P([0, 2.2, k * 0.45], [1.44, 1.24, 0.14], K);
      P([0, 2.4, 2.4], [0.2, 0.2, 2], O, 'SmoothPlastic', { rot: RX(-0.5) });
    },
    monkey(x, y, z, yaw = 0, s = 1, out) {
      const P = make(x, y, z, yaw, s, out), Bm = 0x6a4a2a;
      P([0, 0.6, 0], [0.7, 1, 0.6], Bm);
      P([0, 1.4, -0.1], [0.6, 0.6, 0.6], Bm, 'SmoothPlastic', { shape: 3 });
      P([0, 1.35, -0.4], [0.4, 0.3, 0.1], 0xd8b080);
      for (const sx of [-0.5, 0.5]) P([sx, 0.9, -0.2], [0.2, 1, 0.2], Bm, 'SmoothPlastic', { rot: RZ(sx * 1.6) });
      P([0, 0.3, 0.6], [0.15, 0.15, 1.4], Bm, 'SmoothPlastic', { rot: RX(0.6) });
    },
    // ---- Primeval Valley
    raptor(x, y, z, yaw = 0, s = 1, out) {
      const P = make(x, y, z, yaw, s, out), Gn = 0x4a8a3a, St = 0x2a5a2a;
      for (const sx of [-0.4, 0.4]) P([sx, 1.2, 0.3], [0.4, 2.4, 0.5], Gn, 'SmoothPlastic', { rot: RX(-0.25) });
      P([0, 2.8, 0], [1, 1.1, 2.4], Gn, 'SmoothPlastic', { rot: RX(0.25) });
      P([0, 3.6, -1.3], [0.5, 1.2, 0.5], Gn, 'SmoothPlastic', { rot: RX(-0.5) });
      P([0, 4.2, -1.9], [0.6, 0.6, 1.5], Gn);
      P([0, 3.9, -2.4], [0.5, 0.2, 0.9], 0xf4f0e0);
      P([0, 2.7, 2.4], [0.35, 0.35, 3], Gn, 'SmoothPlastic', { rot: RX(-0.15) });
      for (const sx of [-0.4, 0.4]) P([sx, 2.9, -1], [0.15, 0.15, 0.8], St, 'SmoothPlastic', { rot: RX(0.8) });
      for (let k = -2; k <= 2; k++) P([0, 3.35, k * 0.45], [0.1, 0.25, 0.25], St);
    },
    longneck(x, y, z, yaw = 0, s = 1, out) {
      const P = make(x, y, z, yaw, s, out), Gr = 0x7a8a6a;
      legs(P, 1.8, 6, 1.6, 3, Gr);
      P([0, 8, 0], [4.4, 4.6, 9], Gr);
      P([0, 14, -7.5], [1.5, 13, 1.6], Gr, 'SmoothPlastic', { rot: RX(-0.6) });
      P([0, 19.4, -11.4], [1.6, 1.4, 2.6], Gr);
      P([0, 6.5, 8.5], [1.2, 1.2, 9], Gr, 'SmoothPlastic', { rot: RX(-0.28) });
    },
    tyrant(x, y, z, yaw = 0, s = 1, out) {
      const P = make(x, y, z, yaw, s, out), Bt = 0x6a5a3a, D = 0x4a3a2a;
      for (const sx of [-1.2, 1.2]) { P([sx, 3, 0.8], [1.4, 6, 1.8], Bt, 'SmoothPlastic', { rot: RX(-0.2) }); P([sx, 0.4, -0.2], [1.6, 0.8, 2.6], D); }
      P([0, 8.6, 0], [3.4, 4, 6.4], Bt, 'SmoothPlastic', { rot: RX(0.3) });
      P([0, 11.4, -3.8], [2, 2.6, 2], Bt, 'SmoothPlastic', { rot: RX(-0.5) });
      P([0, 12.8, -5.6], [2.4, 2.2, 4], Bt);
      P([0, 11.6, -6], [2.2, 0.8, 3.4], D);
      for (let k = 0; k < 5; k++) P([(k - 2) * 0.4, 12, -7.4], [0.18, 0.5, 0.18], 0xf4f0e0);
      for (const sx of [-0.7, 0.7]) P([sx, 13.6, -5.2], [0.35, 0.35, 0.3], 0xf0c020, 'SmoothPlastic', { shape: 3 });
      for (const sx of [-1.6, 1.6]) P([sx, 8, -3.4], [0.4, 0.4, 1.6], Bt, 'SmoothPlastic', { rot: RX(0.9) });
      P([0, 7, 6.4], [1.6, 1.6, 8], Bt, 'SmoothPlastic', { rot: RX(-0.25) });
    },
    triceratops(x, y, z, yaw = 0, s = 1, out) {
      const P = make(x, y, z, yaw, s, out), Tc = 0x8a6a4a, Fr = 0xa85a3a;
      legs(P, 1.2, 2.6, 1.2, 2, Tc);
      P([0, 3.8, 0], [3, 2.8, 6], Tc);
      P([0, 3.8, -3.8], [2.2, 2, 2.2], Tc);
      P([0, 5.2, -3.3], [4, 3.2, 0.4], Fr, 'SmoothPlastic', { rot: RX(0.3) });
      for (const sx of [-0.7, 0.7]) P([sx, 5, -5], [0.3, 0.3, 2.2], 0xf0e8d0, 'SmoothPlastic', { rot: RX(0.3) });
      P([0, 3.6, -5.2], [0.3, 0.3, 1.2], 0xf0e8d0, 'SmoothPlastic', { rot: RX(0.6) });
      P([0, 3.4, 3.6], [0.9, 0.9, 3], Tc, 'SmoothPlastic', { rot: RX(-0.2) });
    },
  };
  return A;
}

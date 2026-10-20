/** Helpers for authoring chapter layouts. */

/** A 2x2 cubicle cluster centred on (cx, cz): spine, cross divider, back walls, desks, chairs. */
export function cubicleCluster(cx, cz, opts = {}) {
  const h = opts.tall ? 'partitionTall' : 'partition';
  const out = [
    { k: h, x: cx, z: cz, s: [5, 0.08, 1.5], tint: opts.tint },
    { k: h, x: cx, z: cz, rot: 90, s: [4, 0.08, 1.5], tint: opts.tint },
    { k: h, x: cx, z: cz - 2, s: [5, 0.08, 1.5], tint: opts.tint },
    { k: h, x: cx, z: cz + 2, s: [5, 0.08, 1.5], tint: opts.tint },
  ];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    out.push({ k: 'desk', x: cx + sx * 1.25, z: cz + sz * 1.55 });
    out.push({ k: 'chair', x: cx + sx * 1.25, z: cz + sz * 0.85 });
  }
  if (opts.sign) out.push({ k: 'sign', x: cx, z: cz, y: 2.25, sym: opts.sign, tint: opts.tint, solid: false });
  return out;
}

/** Row of props of one kind from (x0,z0) stepping (dx,dz). */
export function row(k, n, x0, z0, dx, dz, extra = {}) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ k, x: x0 + dx * i, z: z0 + dz * i, ...extra });
  return out;
}

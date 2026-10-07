// The four live shows, ported from the Roblox ShowPlayer: Big Dreams Live!,
// the Diesel Stunt Spectacular, the Big Rig Parade and Benton Nights.
import * as THREE from 'three';
import { buildModel } from './geom.js';

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
const A = (rx, ry, rz) => new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'XYZ'));
const mul = (...ms) => ms.slice(1).reduce((r, m) => r.multiply(m), ms[0].clone());
const smooth = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const rgb = (r, g, b) => (r << 16) | (g << 8) | b;

function lookAt(p, target) {
  const m = new THREE.Matrix4().lookAt(p, target, UP);
  m.setPosition(p);
  return m;
}

function place(obj, m) {
  obj.matrixAutoUpdate = false;
  obj.matrix.copy(m);
  obj.matrixWorldNeedsUpdate = true;
}

// Builds part records in the exporter's format for show props.
class Kit {
  constructor(materials) {
    this.materials = materials;
    this.parts = [];
  }
  add(shape, size, m, color, mat = 'SmoothPlastic') {
    const e = m.elements;
    this.parts.push([shape, size[0], size[1], size[2], e[12], e[13], e[14], e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10], color, Math.max(0, this.materials.indexOf(mat)), 0, 0]);
  }
  build() {
    return buildModel(this.parts, this.materials, { detail: true });
  }
}

function captions(lines) {
  return (t) => {
    let text = '';
    for (const [at, s] of lines) if (t >= at) text = s;
    return text;
  };
}

// ---------------------------------------------------------- Big Dreams Live!
function bigDreams(ctx) {
  const center = new THREE.Vector3(225, 4.4, 186);
  const group = new THREE.Group();
  const dancers = [];
  for (let i = 1; i <= 7; i++) {
    const g = ctx.guests.make(9000 + i * 17, i === 4 ? 'cheer' : 'stand');
    g.matrixAutoUpdate = false;
    group.add(g);
    dancers.push(g);
  }
  const kit = new Kit(ctx.materials);
  kit.add(5, [0.3, 5, 0.3], T(center.x, center.y + 2.5, center.z + 4), rgb(40, 40, 44), 'Metal');
  group.add(kit.build());
  ctx.scene.add(group);
  let confettiFired = false;
  return {
    caption: captions([
      [0, 'BIG DREAMS LIVE!'],
      [4, '♪ Wheels keep turning, engines hum... ♪'],
      [14, '♪ Every dreamer, here we come! ♪'],
      [24, '♪ Big dreams, big rigs, brighter days ♪'],
      [34, '♪ Benton lights the lakeside haze ♪'],
      [44, '♪ Hand in hand and gear to gear... ♪'],
      [54, '♪ BIG DREAMS START RIGHT HERE! ♪'],
      [64, 'Thank you, Benton Diesel World!'],
    ]),
    update(t) {
      const phase = Math.floor(t / 15) % 4;
      const blend = smooth((t % 15) / 2);
      dancers.forEach((g, idx) => {
        const i = idx + 1;
        const k = i - 4;
        const line = new THREE.Vector3(k * 5, 0, 2);
        const vee = new THREE.Vector3(k * 4.5, 0, 6 - Math.abs(k) * 2.4);
        const a = TAU * i / dancers.length + t * 0.8;
        const circle = new THREE.Vector3(Math.cos(a) * 11, 0, 4 + Math.sin(a) * 5);
        const shapes = [line, vee, circle, line];
        let p = shapes[(phase + 3) % 4].clone().lerp(shapes[phase], blend);
        if (i === 4) p = new THREE.Vector3(0, 0, 4.2);
        const bounce = Math.abs(Math.sin(t * 4 + i)) * 1.4;
        const yaw = Math.sin(t * 2 + i) * 0.5;
        place(g, mul(T(center.x + p.x, center.y + p.y + 2.9 + bounce, center.z + p.z), A(0, Math.PI + yaw, 0)));
      });
      ctx.fx.setStageLights(true, t);
      ctx.fx.setFountains(t > 8 && t < 66, t);
      if (t > 56 && !confettiFired) {
        confettiFired = true;
        ctx.fx.confetti(new THREE.Vector3(center.x, center.y + 22, center.z + 4), new THREE.Vector3(44, 1, 14), 400);
      }
    },
    cleanup() {
      ctx.fx.setStageLights(false, 0);
      ctx.fx.setFountains(false, 0);
      ctx.scene.remove(group);
    },
  };
}

// -------------------------------------------------- Diesel Stunt Spectacular
function stuntTruck(materials, color) {
  const kit = new Kit(materials);
  kit.add(0, [6, 2.4, 9], T(0, 4.2, 0), color);
  kit.add(0, [5.4, 2.4, 4], T(0, 6.6, 0.8), color);
  kit.add(0, [5, 1.6, 0.2], T(0, 6.8, -1.25), rgb(150, 200, 230), 'Glass');
  for (const sx of [-1, 1]) for (const sz of [-3.2, 3.2]) kit.add(2, [2.2, 4.4, 4.4], T(sx * 3.6, 2.2, sz), rgb(25, 25, 25), 'Rubber');
  kit.add(0, [6.2, 0.6, 1], T(0, 3.4, -4.6), rgb(200, 200, 205), 'Metal');
  const g = kit.build();
  g.matrixAutoUpdate = false;
  return g;
}

function jumpPose(t, t0, z, roll) {
  const d = t - t0;
  if (d < 0 || d > 4) return null;
  const x = 30 + d * 20;
  let y = 0;
  if (x >= 47 && x < 60) y = (x - 47) / 13 * 6.4;
  else if (x >= 60 && x < 80) { const u = (x - 60) / 20; y = 6.4 + u * -0.6 + 30 * u * (1 - u); }
  else if (x >= 80 && x < 93) y = 5.8 * (1 - (x - 80) / 13);
  let pitch = 0;
  if (x >= 47 && x < 60) pitch = 0.45;
  else if (x >= 60 && x < 80) pitch = 0.45 - (x - 60) / 20 * 0.9;
  else if (x >= 80 && x < 93) pitch = -0.4;
  const spin = roll && x >= 60 && x < 80 ? (x - 60) / 20 * TAU : 0;
  return mul(T(x, 0.5 + y, z), A(0, -Math.PI / 2, 0), A(pitch, 0, 0), A(0, 0, spin));
}

function stunts(ctx) {
  const group = new THREE.Group();
  const trucks = [rgb(196, 40, 40), rgb(30, 110, 230), rgb(255, 140, 26)].map((c) => {
    const m = stuntTruck(ctx.materials, c);
    group.add(m);
    return m;
  });
  ctx.scene.add(group);
  const center = new THREE.Vector3(70, 0.5, -246);
  const booms = new Set();
  const boom = (key, x, y, z) => {
    if (booms.has(key)) return;
    booms.add(key);
    ctx.fx.explosion(new THREE.Vector3(x, y, z), 1.2);
    ctx.shake?.(0.5);
  };
  const circle = (t, i, radius) => {
    const a = t * 0.9 + i * TAU / 3;
    const p = new THREE.Vector3(center.x + Math.cos(a) * radius, center.y, center.z + Math.sin(a) * radius * 0.8);
    const tangent = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a) * 0.8);
    return lookAt(p, p.clone().add(tangent));
  };
  const parked = [
    mul(T(44, 0.5, -270), A(0, 30 * Math.PI / 180, 0)),
    mul(T(96, 0.5, -270), A(0, -30 * Math.PI / 180, 0)),
    T(70, 0.5, -275),
  ];
  const pots = (ctx.tags.StuntFirePot || []).map((c) => [new THREE.Vector3(c[0], c[1] + 1.6, c[2]), 1.6]);
  const wall = [];
  for (let z = -276; z <= -236; z += 8) wall.push([new THREE.Vector3(70, 1, z), 1.2]);
  return {
    caption: captions([
      [0, 'LADIES AND GENTLEMEN... START YOUR ENGINES!'],
      [12, 'The Benton Stunt Team!'],
      [16, 'First up: the RED RIG ramp jump!'],
      [28, 'Double trouble - BLUE and ORANGE!'],
      [40, 'Through the WALL OF FIRE!'],
      [54, 'And now... the BARREL ROLL!'],
      [66, 'Give it up for the Benton Stunt Team!'],
    ]),
    update(t) {
      trucks.forEach((truck, idx) => {
        const i = idx + 1;
        let cf;
        if (t < 14) cf = circle(t, i, 22);
        else if (i === 1 && t >= 16 && t < 20) cf = jumpPose(t, 16, -250, false);
        else if (i === 2 && t >= 28 && t < 32) cf = jumpPose(t, 28, -252, false);
        else if (i === 3 && t >= 30 && t < 34) cf = jumpPose(t, 30, -248, false);
        else if (i === 1 && t >= 42 && t < 50) cf = mul(T(36 + (t - 42) / 8 * 68, 0.5, -256), A(0, -Math.PI / 2, 0));
        else if (i === 3 && t >= 56 && t < 60) cf = jumpPose(t, 56, -250, true);
        else if (t >= 64) cf = mul(T(54 + i * 8, 0.5, -232), A(0, Math.PI + Math.sin(t * 6 + i) * 0.1, 0));
        else cf = parked[idx];
        place(truck, cf);
      });
      if (t > 19) boom('a', 96, 4, -250);
      if (t > 33) { boom('b', 96, 4, -252); boom('c', 60, 6, -276); }
      if (t > 59.5) { boom('d', 100, 4, -250); boom('e', 40, 6, -276); }
      const fireOn = t > 38 && t < 52;
      ctx.fx.fireAt('stuntPots', pots, fireOn);
      ctx.fx.fireAt('stuntWall', wall, fireOn);
    },
    cleanup() {
      ctx.fx.fireAt('stuntPots', [], false);
      ctx.fx.fireAt('stuntWall', [], false);
      ctx.scene.remove(group);
    },
  };
}

// ------------------------------------------------------------ Big Rig Parade
const ROUTE = [
  [-120, -60], [-62, -60], [-50, -28], [-30, -10], [0, 0], [0, 120], [0, 225], [-30, 248], [-90, 240], [-150, 232],
].map(([x, z]) => new THREE.Vector3(x, 0.5, z));
const routeCum = [0];
for (let i = 1; i < ROUTE.length; i++) routeCum[i] = routeCum[i - 1] + ROUTE[i].distanceTo(ROUTE[i - 1]);
const routeLen = routeCum[routeCum.length - 1];

function routeAt(s) {
  s = Math.min(Math.max(s, 0), routeLen - 0.01);
  for (let i = 1; i < ROUTE.length; i++) {
    if (s <= routeCum[i]) {
      const a = ROUTE[i - 1], b = ROUTE[i];
      const u = (s - routeCum[i - 1]) / (routeCum[i] - routeCum[i - 1]);
      return lookAt(a.clone().lerp(b, u), b);
    }
  }
  return T(ROUTE[ROUTE.length - 1].x, 0.5, ROUTE[ROUTE.length - 1].z);
}

function float(ctx, theme) {
  const kit = new Kit(ctx.materials);
  const c = [rgb(196, 40, 40), rgb(30, 110, 230), rgb(120, 84, 52), rgb(70, 170, 120)][theme - 1];
  kit.add(0, [8, 7, 7], T(0, 4.5, -10), c);
  kit.add(0, [7, 2.4, 0.3], T(0, 6.5, -13.6), rgb(150, 200, 230), 'Glass');
  kit.add(0, [7.6, 3, 4], T(0, 3, -15), c);
  kit.add(0, [9, 1.4, 20], T(0, 2.6, 4), rgb(240, 240, 236));
  kit.add(0, [9.4, 1, 20.4], T(0, 1.8, 4), rgb(240, 196, 64));
  for (const sx of [-1, 1]) for (const sz of [-11, 0, 10]) kit.add(2, [1.4, 3, 3], T(sx * 4.2, 1.5, sz), rgb(25, 25, 25), 'Rubber');
  if (theme === 1) {
    kit.add(3, [10, 10, 10], T(0, 9, 5), rgb(40, 110, 210));
    for (let k = 0; k < 12; k++) kit.add(0, [2.2, 1.2, 1.2], mul(T(0, 9, 5), A(0, 0, k * TAU / 12), T(0, 7, 0)), rgb(240, 196, 64), 'Metal');
  } else if (theme === 2) {
    kit.add(0, [5, 1.6, 11], T(0, 4.2, 4), rgb(30, 110, 230));
    kit.add(0, [2.4, 1.4, 3], T(0, 5.4, 4.5), rgb(20, 20, 26), 'Glass');
    kit.add(0, [0.3, 8, 6], T(0, 8, 12), 0xffffff, 'Fabric');
  } else if (theme === 3) {
    for (let k = 0; k < 3; k++) {
      kit.add(2, [4 - k, 3, 4 - k], T(-2.5, 5 + k * 2.4, 9), rgb(40, 100, 56), 'Grass');
      kit.add(2, [4 - k, 3, 4 - k], T(2.5, 5 + k * 2.4, 0), rgb(40, 100, 56), 'Grass');
    }
    kit.add(0, [4, 3, 6], T(0, 4.8, 4), rgb(200, 120, 40), 'CorrodedMetal');
  } else {
    for (let k = 0; k < 3; k++) kit.add(2, [1, 9 - k * 2.6, 9 - k * 2.6], mul(T(0, 4 + k * 1.2, 4), A(0, 0, Math.PI / 2)), k % 2 === 0 ? rgb(196, 40, 40) : rgb(250, 243, 224), 'Fabric');
    kit.add(0, [0.6, 9, 0.6], T(0, 8, 4), rgb(240, 196, 64), 'Metal');
  }
  const model = kit.build();
  model.matrixAutoUpdate = false;
  const riders = [1, 2, 3].map((k) => {
    const g = ctx.guests.make(7000 + theme * 10 + k, 'cheer');
    g.matrixAutoUpdate = false;
    return g;
  });
  return { model, riders };
}

function parade(ctx) {
  const group = new THREE.Group();
  const floats = [1, 2, 3, 4].map((th) => {
    const f = float(ctx, th);
    group.add(f.model);
    f.riders.forEach((g) => group.add(g));
    return f;
  });
  const walkers = [];
  for (let k = 1; k <= 8; k++) {
    const g = ctx.guests.make(8100 + k * 3, k % 2 === 0 ? 'cheer' : 'stand');
    g.matrixAutoUpdate = false;
    group.add(g);
    walkers.push(g);
  }
  ctx.scene.add(group);
  const speed = 5, gap = 34;
  return {
    caption: captions([
      [0, 'The BIG RIG PARADE is rolling down Main Street!'],
      [25, 'Wave to the Benton Globe float!'],
      [50, 'Here comes Velocity City and Old Rusty!'],
      [80, 'And the Big Dreams carousel float!'],
    ]),
    update(t) {
      floats.forEach((f, idx) => {
        const s = t * speed - idx * gap;
        const visible = s > 0 && s < routeLen - 1;
        f.model.visible = visible;
        f.riders.forEach((g) => { g.visible = visible; });
        if (!visible) return;
        const cf = routeAt(s);
        place(f.model, cf);
        f.riders.forEach((g, ki) => {
          const k = ki + 1;
          const bounce = Math.abs(Math.sin(t * 3 + k + idx + 1)) * 0.8;
          place(g, mul(cf, T((k - 2) * 2.8, 6.2 + bounce, 6 + k), A(0, Math.sin(t + k) * 0.6, 0)));
        });
      });
      walkers.forEach((g, ki) => {
        const k = ki + 1;
        const s = t * speed - (k - 1) * 9 + 12;
        const visible = s > 0 && s < routeLen - 1;
        g.visible = visible;
        if (!visible) return;
        const side = k % 2 === 0 ? 7 : -7;
        const bounce = Math.abs(Math.sin(t * 5 + k)) * 0.9;
        place(g, mul(routeAt(s), T(side, 3.4 + bounce, 0), A(0, Math.sin(t * 2 + k) * 0.8, 0)));
      });
    },
    cleanup() {
      ctx.scene.remove(group);
    },
  };
}

// -------------------------------------------------------- Benton Nights
function fireworks(ctx) {
  let seed = 2024;
  const rnd = (a = 0, b = 1) => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return a + (seed / 4294967296) * (b - a);
  };
  const sites = [[-60, -230], [0, -250], [60, -230], [-30, -300], [30, -300]].map(([x, z]) => new THREE.Vector3(x, 2, z));
  const schedule = [];
  let t = 2;
  while (t < 92) {
    const finale = t > 76;
    const site = sites[Math.floor(rnd(0, sites.length))];
    schedule.push({
      at: t,
      from: site,
      to: site.clone().add(new THREE.Vector3(rnd(-40, 40), rnd(130, 220), rnd(-30, 60))),
      color: new THREE.Color().setHSL(rnd(), rnd(0.75, 1), 0.6),
      size: rnd(0.8, 1.4),
      fired: false,
      burst: false,
    });
    t += finale ? rnd(0.12, 0.3) : rnd(0.5, 1.4);
  }
  const trail = new THREE.Color(1, 0.8, 0.5);
  const p = new THREE.Vector3();
  return {
    caption: captions([[0, 'BENTON NIGHTS'], [10, ''], [76, 'GOODNIGHT FROM BENTON DIESEL WORLD!']]),
    update(time) {
      for (const item of schedule) {
        if (item.burst || time < item.at) continue;
        const u = (time - item.at) / 1.1;
        if (u >= 1) {
          item.burst = true;
          ctx.fx.firework(item.to, item.color, item.size);
        } else {
          p.copy(item.from).lerp(item.to, 1 - (1 - u) ** 2);
          ctx.fx.glow.spawn(p.x, p.y, p.z, (Math.random() - 0.5) * 2, -4, (Math.random() - 0.5) * 2, trail, 1.6, 0.5, 0, 0, 0.3);
        }
      }
    },
    cleanup() {},
  };
}

const IMPLS = { BigDreams: bigDreams, StuntSpectacular: stunts, BigRigParade: parade, BentonNights: fireworks };

export class ShowRunner {
  constructor(ctx) {
    this.ctx = ctx; // { scene, materials, guests, fx, tags }
    this.active = new Map();
  }

  // shows: sim.shows; returns caption of the nearest running show (if near)
  update(shows, now, playerPos) {
    let caption = null;
    let best = Infinity;
    for (const show of shows) {
      const t = now - show.start;
      let a = this.active.get(show.id);
      if (show.running && t >= 0 && t <= show.duration) {
        if (!a) {
          a = IMPLS[show.id](this.ctx);
          this.active.set(show.id, a);
        }
        a.update(t);
        const d = Math.hypot(playerPos.x - show.viewing[0], playerPos.z - show.viewing[2]);
        if (d < show.viewRadius * 1.6 && d < best) {
          const text = a.caption(t);
          if (text) {
            best = d;
            caption = { show: show.name, text };
          }
        }
      } else if (a) {
        a.cleanup();
        this.active.delete(show.id);
      }
    }
    return caption;
  }
}

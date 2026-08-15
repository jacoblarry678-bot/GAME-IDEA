/**
 * THE LABYRINTH — world builder.
 *
 * Turns the shared grid map into renderable geometry. Three techniques keep
 * the draw call count low enough for a laptop while still looking dense:
 *
 *  1. Walls, floors and ceilings are emitted as raw vertex buffers and merged
 *     into one mesh per material — roughly a dozen draw calls for 3,500 cells.
 *  2. Every repeated prop kind becomes a single InstancedMesh.
 *  3. Real dynamic lights are a small pool that follows the camera; every
 *     other light anchor is emissive geometry, so a hundred candles cost one
 *     draw call and zero shadow maps.
 */

import * as THREE from 'three';
import {
  CELL, GRID_W, GRID_H, FLOOR_Y, NUM_FLOORS,
  gridToWorldX, gridToWorldZ, worldToGridX, worldToGridZ,
  ZONE_BY_ID, ZONES, isSolid,
} from '../../../shared/mapdata.js';
import { PROPS, buildDoor, buildVault, chainStrand } from './props.js';
import { Rand } from '../../../shared/rng.js';

/** Grid cells per spatial chunk. 8 cells = 32m, roughly one room. */
const CHUNK = 8;

/** Accumulates quads into flat arrays, then bakes one BufferGeometry. */
class QuadBuilder {
  constructor() {
    this.pos = [];
    this.norm = [];
    this.uv = [];
    this.idx = [];
    this.count = 0;
  }
  /** a,b,c,d counter-clockwise; uvScale in world metres per texture tile. */
  quad(a, b, c, d, n, uvScale = 0.25, uvOffset = [0, 0]) {
    const base = this.count;
    const pts = [a, b, c, d];
    // project UVs onto the dominant plane so textures never stretch
    const ax = Math.abs(n[0]);
    const ay = Math.abs(n[1]);
    const az = Math.abs(n[2]);
    for (const p of pts) {
      this.pos.push(p[0], p[1], p[2]);
      this.norm.push(n[0], n[1], n[2]);
      let u;
      let v;
      if (ay > ax && ay > az) {
        u = p[0]; v = p[2];
      } else if (ax > az) {
        u = p[2]; v = p[1];
      } else {
        u = p[0]; v = p[1];
      }
      this.uv.push(u * uvScale + uvOffset[0], v * uvScale + uvOffset[1]);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    this.count += 4;
  }
  bake() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.norm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
  get empty() {
    return this.count === 0;
  }
}

/** Which texture generator each zone's walls / floors / ceilings use. */
const SURFACES = {
  stone: { wall: 'stone', floor: 'concrete', ceil: 'stone' },
  wood: { wall: 'wallpaper', floor: 'wood', ceil: 'wood' },
  rust: { wall: 'rust', floor: 'concrete', ceil: 'rust' },
  tile: { wall: 'tile', floor: 'tile', ceil: 'concrete' },
  obsidian: { wall: 'obsidian', floor: 'obsidian', ceil: 'obsidian' },
  bone: { wall: 'bone', floor: 'concrete', ceil: 'stone' },
};

/** Colour + intensity per light anchor kind. */
// Intensities are in candela (three r155+ physical units), so these numbers
// are much larger than the pre-r155 "legacy lights" scale.
const LIGHT_KINDS = {
  candle: { color: 0xffb457, intensity: 26, distance: 14, height: 1.9, flicker: 0.35, size: 0.055 },
  brazier: { color: 0xff7a2a, intensity: 90, distance: 26, height: 1.5, flicker: 0.22, size: 0.18 },
  emergency: { color: 0xff2418, intensity: 55, distance: 20, height: 3.1, flicker: 0.08, size: 0.1 },
  occult: { color: 0x8a4cff, intensity: 62, distance: 22, height: 2.4, flicker: 0.14, size: 0.12 },
};

/** Fog + ambient mood per zone. */
// `ai` is ambient intensity. These look large because three applies the
// Lambert 1/PI factor to ambient irradiance, so an intensity of ~12 lands at a
// dim-but-readable base. The brief was explicit that the game must never be
// pitch black, so there is always a floor of light in every zone.
const MOODS = {
  dark: { fog: 0x1a2029, density: 0.014, ambient: 0x4c5260, ai: 20 },
  cold: { fog: 0x1e2833, density: 0.011, ambient: 0x5a6272, ai: 22 },
  candle: { fog: 0x2a1e10, density: 0.013, ambient: 0x6a4a22, ai: 24 },
  red: { fog: 0x2a0d10, density: 0.015, ambient: 0x6e2226, ai: 20 },
  pulse: { fog: 0x300f14, density: 0.02, ambient: 0x701a20, ai: 18 },
  occult: { fog: 0x1d1430, density: 0.013, ambient: 0x4a2b78, ai: 21 },
  gate: { fog: 0x201a3a, density: 0.011, ambient: 0x50409a, ai: 26 },
  steam: { fog: 0x2a2626, density: 0.024, ambient: 0x554a42, ai: 19 },
  wet: { fog: 0x14231f, density: 0.019, ambient: 0x2f4f4c, ai: 18 },
};

export class Labyrinth {
  /**
   * @param {import('../core/engine.js').Engine} engine
   * @param {import('../core/textures.js').TextureLibrary} textures
   * @param {object} map result of buildMap()
   */
  constructor(engine, textures, map) {
    this.engine = engine;
    this.tex = textures;
    this.map = map;
    this.quality = engine.quality;
    this.root = new THREE.Group();
    this.root.name = 'labyrinth';
    engine.scene.add(this.root);

    this.rand = new Rand(map.seed + ':render');
    this.time = 0;
    this.timeUniform = { value: 0 };
    this.lightsOut = 0;
    this.doorMeshes = new Map();
    this.interactives = [];
    this.sealMeshes = new Map();
    this.questMeshes = new Map();
    this.hideMeshes = new Map();
    this.containerMeshes = new Map();
    this.currentFloor = 0;

    this.buildStructure();
    this.buildProps();
    this.buildInteractives();
    this.buildLights();
    this.buildAtmosphere();

    engine.scene.fog = new THREE.FogExp2(MOODS.dark.fog, MOODS.dark.density);
    this.ambient = new THREE.AmbientLight(MOODS.dark.ambient, MOODS.dark.ai);
    engine.scene.add(this.ambient);

    // A very dim overhead hemisphere so nothing is ever pure black — the brief
    // was explicit that players still have to be able to see.
    this.hemi = new THREE.HemisphereLight(0x7d8496, 0x3a2c22, 14.0);
    engine.scene.add(this.hemi);
  }

  // ------------------------------------------------------------- structure

  buildStructure() {
    // One builder per (surface kind, role, spatial chunk). Chunking matters:
    // a single merged mesh spanning the whole 288m map can never be frustum
    // culled, so every wall in the Labyrinth would be submitted every frame.
    const builders = new Map();
    let curChunk = '0_0_0';
    const b = (kind, role) => {
      const key = kind + '|' + role + '|' + curChunk;
      if (!builders.has(key)) builders.set(key, new QuadBuilder());
      return builders.get(key);
    };
    const trims = new Map();
    const trimFor = () => {
      if (!trims.has(curChunk)) trims.set(curChunk, new QuadBuilder());
      return trims.get(curChunk);
    };
    const trim = { quad: (...a) => trimFor().quad(...a) };

    for (let f = 0; f < NUM_FLOORS; f++) {
      const fl = this.map.floors[f];
      const y0 = FLOOR_Y[f];
      for (let gz = 0; gz < GRID_H; gz++) {
        for (let gx = 0; gx < GRID_W; gx++) {
          const i = gz * GRID_W + gx;
          if (fl.solid[i]) continue;
          curChunk = `${f}_${(gx / CHUNK) | 0}_${(gz / CHUNK) | 0}`;
          const zone = ZONE_BY_ID[fl.zone[i]] || ZONES.corridor;
          const surf = SURFACES[zone.mat] || SURFACES.stone;
          const ceilH = zone.ceil;
          const cx = gridToWorldX(gx);
          const cz = gridToWorldZ(gz);
          const h = CELL / 2;
          const x0 = cx - h;
          const x1 = cx + h;
          const z0 = cz - h;
          const z1 = cz + h;

          // floor
          b(surf.floor, 'floor').quad(
            [x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0], [0, 1, 0], 0.22
          );
          // ceiling
          b(surf.ceil, 'ceil').quad(
            [x0, y0 + ceilH, z0], [x1, y0 + ceilH, z0], [x1, y0 + ceilH, z1], [x0, y0 + ceilH, z1], [0, -1, 0], 0.18
          );

          // walls facing each solid neighbour
          const wb = b(surf.wall, 'wall');
          if (isSolid(this.map, f, gx + 1, gz)) {
            wb.quad([x1, y0, z0], [x1, y0, z1], [x1, y0 + ceilH, z1], [x1, y0 + ceilH, z0], [-1, 0, 0], 0.2);
            this.addTrim(trim, x1, y0, z0, z1, 'x', -1);
          }
          if (isSolid(this.map, f, gx - 1, gz)) {
            wb.quad([x0, y0, z1], [x0, y0, z0], [x0, y0 + ceilH, z0], [x0, y0 + ceilH, z1], [1, 0, 0], 0.2);
            this.addTrim(trim, x0, y0, z0, z1, 'x', 1);
          }
          if (isSolid(this.map, f, gx, gz + 1)) {
            wb.quad([x1, y0, z1], [x0, y0, z1], [x0, y0 + ceilH, z1], [x1, y0 + ceilH, z1], [0, 0, -1], 0.2);
            this.addTrim(trim, z1, y0, x0, x1, 'z', -1);
          }
          if (isSolid(this.map, f, gx, gz - 1)) {
            wb.quad([x0, y0, z0], [x1, y0, z0], [x1, y0 + ceilH, z0], [x0, y0 + ceilH, z0], [0, 0, 1], 0.2);
            this.addTrim(trim, z0, y0, x0, x1, 'z', 1);
          }

          // where a tall zone meets a short one, cap the height difference
          for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = gx + dx;
            const nz = gz + dz;
            if (isSolid(this.map, f, nx, nz)) continue;
            const nzone = ZONE_BY_ID[fl.zone[nz * GRID_W + nx]] || ZONES.corridor;
            if (nzone.ceil >= ceilH - 0.01) continue;
            const yA = y0 + nzone.ceil;
            const yB = y0 + ceilH;
            const ex = dx ? (dx > 0 ? x1 : x0) : null;
            const ez = dz ? (dz > 0 ? z1 : z0) : null;
            const cb = b(surf.wall, 'wall');
            if (ex !== null) {
              cb.quad([ex, yA, z0], [ex, yA, z1], [ex, yB, z1], [ex, yB, z0], [-dx, 0, 0], 0.2);
            } else {
              cb.quad([x1, yA, ez], [x0, yA, ez], [x0, yB, ez], [x1, yB, ez], [0, 0, -dz], 0.2);
            }
          }
        }
      }
    }

    // bake
    this.structureMeshes = [];
    for (const [key, qb] of builders) {
      if (qb.empty) continue;
      const [kind, role] = key.split('|');
      const mat = this.tex.material(kind, {
        repeat: 1,
        normalScale: role === 'wall' ? 1.4 : 1.0,
        metalness: kind === 'rust' ? 0.55 : 0.05,
        color: role === 'ceil' ? 0x8a8a8a : 0xffffff,
      });
      const mesh = new THREE.Mesh(qb.bake(), mat);
      mesh.name = `struct_${key}`;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      this.root.add(mesh);
      this.structureMeshes.push(mesh);
    }
    const trimMat = this.tex.material('rust', { repeat: 1, metalness: 0.7, color: 0x6b6259 });
    for (const [, qb] of trims) {
      if (qb.empty) continue;
      const tm = new THREE.Mesh(qb.bake(), trimMat);
      tm.matrixAutoUpdate = false;
      tm.receiveShadow = true;
      this.root.add(tm);
      this.structureMeshes.push(tm);
    }
  }

  /** Skirting board + a picture rail, so walls aren't flat planes. */
  addTrim(qb, along, y0, a0, a1, axis, dir) {
    const t = 0.09 * -dir;
    for (const [yy, hh] of [[y0 + 0.02, 0.34], [y0 + 2.55, 0.13]]) {
      if (axis === 'x') {
        qb.quad(
          [along + t, yy, a0], [along + t, yy, a1], [along + t, yy + hh, a1], [along + t, yy + hh, a0],
          [dir, 0, 0], 0.5
        );
        qb.quad(
          [along, yy + hh, a0], [along, yy + hh, a1], [along + t, yy + hh, a1], [along + t, yy + hh, a0],
          [0, 1, 0], 0.5
        );
      } else {
        qb.quad(
          [a1, yy, along + t], [a0, yy, along + t], [a0, yy + hh, along + t], [a1, yy + hh, along + t],
          [0, 0, dir], 0.5
        );
        qb.quad(
          [a1, yy + hh, along], [a0, yy + hh, along], [a0, yy + hh, along + t], [a1, yy + hh, along + t],
          [0, 1, 0], 0.5
        );
      }
    }
  }

  // ----------------------------------------------------------------- props

  propMaterial(kind) {
    switch (kind) {
      case 'wood': return this.tex.material('wood', { repeat: 0.9, normalScale: 1.2 });
      case 'iron': return this.tex.material('rust', { repeat: 0.7, metalness: 0.8, normalScale: 1.5 });
      case 'chain': return this.tex.material('rust', { repeat: 2.5, metalness: 0.9, color: 0x9a9088, normalScale: 1.1 });
      case 'stone': return this.tex.material('stone', { repeat: 0.5 });
      case 'obsidian': return this.tex.material('obsidian', { repeat: 0.7, metalness: 0.35 });
      case 'bone': return this.tex.material('bone', { repeat: 1.1 });
      default: return this.tex.material('stone', { repeat: 0.6 });
    }
  }

  buildProps() {
    const byKind = new Map();
    const chainScale = this.quality.chains;
    for (const p of this.map.props) {
      // thin out chain-heavy decoration on low presets
      if ((p.kind === 'chain_cluster' || p.kind === 'hook') && this.rand.next() > chainScale) continue;
      if (!PROPS[p.kind]) continue;
      // chunk key so each InstancedMesh has a tight bounding sphere and can
      // actually be frustum culled
      const key = `${p.kind}|${p.floor}_${(p.gx / CHUNK) | 0}_${(p.gz / CHUNK) | 0}`;
      if (!byKind.has(key)) byKind.set(key, []);
      byKind.get(key).push(p);
    }

    this.propMeshes = [];
    const dummy = new THREE.Object3D();
    const geoCache = new Map();
    for (const [key, list] of byKind) {
      const kind = key.split('|')[0];
      if (!geoCache.has(kind)) geoCache.set(kind, PROPS[kind]());
      const built = geoCache.get(kind);
      const mat = this.propMaterial(built.mat);
      const inst = new THREE.InstancedMesh(built.geo, mat, list.length);
      inst.castShadow = this.quality.shadows;
      inst.receiveShadow = true;
      inst.frustumCulled = true;
      if (built.hang) this.applySway(mat);

      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        const zone = ZONE_BY_ID[this.map.floors[p.floor].zone[p.gz * GRID_W + p.gx]] || ZONES.corridor;
        dummy.position.set(
          p.x + (this.rand.next() - 0.5) * 1.4,
          p.y + (built.hang ? zone.ceil - 0.15 : 0),
          p.z + (this.rand.next() - 0.5) * 1.4
        );
        dummy.rotation.set(0, p.yaw, 0);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
      inst.computeBoundingSphere();
      this.root.add(inst);
      this.propMeshes.push(inst);
    }

    this.buildHangingChains();
    this.buildDoors();
    this.buildVaults();
  }

  /** Long chains from the Chain Hall ceiling — the room's whole identity. */
  buildHangingChains() {
    const count = Math.floor(150 * this.quality.chains);
    if (count <= 0) return;
    const geo = chainStrand(15, 0.3, 0.085, 0.024);
    const mat = this.tex.material('rust', { repeat: 3, metalness: 0.9, color: 0x8e857c });
    this.applySway(mat, 1.6);
    const dummy = new THREE.Object3D();
    const chainZones = new Set([ZONES.chain_hall.id, ZONES.torture_gallery.id, ZONES.blood_corridor.id, ZONES.gallery.id, ZONES.inner_labyrinth.id]);
    // gather placements first, then emit one InstancedMesh per chunk
    const chunks = new Map();
    let placed = 0;
    let guard = 0;
    while (placed < count && guard++ < count * 40) {
      const f = this.rand.next() < 0.78 ? 0 : 1;
      const gx = this.rand.int(1, GRID_W - 2);
      const gz = this.rand.int(1, GRID_H - 2);
      const idx = gz * GRID_W + gx;
      const fl = this.map.floors[f];
      if (fl.solid[idx]) continue;
      if (!chainZones.has(fl.zone[idx])) continue;
      const zone = ZONE_BY_ID[fl.zone[idx]];
      dummy.position.set(
        gridToWorldX(gx) + (this.rand.next() - 0.5) * 3.2,
        FLOOR_Y[f] + zone.ceil - 0.05,
        gridToWorldZ(gz) + (this.rand.next() - 0.5) * 3.2
      );
      dummy.rotation.set(0, this.rand.float(0, 6.28), 0);
      dummy.scale.setScalar(this.rand.float(0.7, 1.5));
      dummy.updateMatrix();
      const key = `${f}_${(gx / CHUNK) | 0}_${(gz / CHUNK) | 0}`;
      if (!chunks.has(key)) chunks.set(key, []);
      chunks.get(key).push(dummy.matrix.clone());
      placed++;
    }
    this.chainMeshes = [];
    for (const [, mats] of chunks) {
      const inst = new THREE.InstancedMesh(geo, mat, mats.length);
      inst.castShadow = this.quality.shadows;
      mats.forEach((m, i) => inst.setMatrixAt(i, m));
      inst.instanceMatrix.needsUpdate = true;
      inst.computeBoundingSphere();
      this.root.add(inst);
      this.chainMeshes.push(inst);
    }
  }

  /** Vertex-shader sway so hundreds of chains move without CPU work. */
  applySway(mat, amount = 1) {
    if (mat.userData.sway) return;
    mat.userData.sway = true;
    const t = this.timeUniform;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = t;
      shader.uniforms.uSway = { value: amount };
      shader.vertexShader =
        'uniform float uTime;\nuniform float uSway;\n' +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           #ifdef USE_INSTANCING
             float ph = instanceMatrix[3][0] * 0.61 + instanceMatrix[3][2] * 0.43;
           #else
             float ph = 0.0;
           #endif
           float depth = max(0.0, -transformed.y) * 0.09 * uSway;
           transformed.x += sin(uTime * 0.75 + ph) * depth;
           transformed.z += cos(uTime * 0.62 + ph * 1.31) * depth * 0.8;`
        );
    };
    mat.needsUpdate = true;
  }

  buildDoors() {
    const woodGeo = buildDoor('wood');
    const ironGeo = buildDoor('iron');
    const woodMat = this.tex.material('wood', { repeat: 0.8, normalScale: 1.3 });
    const ironMat = this.tex.material('rust', { repeat: 0.8, metalness: 0.85 });
    const gateMat = this.tex.material('obsidian', { repeat: 0.8, metalness: 0.4, emissive: 0x2a0f3a, emissiveIntensity: 0.5 });

    for (const d of this.map.doors) {
      const wood = d.kind === 'wood';
      const mesh = new THREE.Mesh(wood ? woodGeo : ironGeo, d.kind === 'gate' ? gateMat : wood ? woodMat : ironMat);
      mesh.castShadow = this.quality.shadows;
      mesh.receiveShadow = true;
      const pivot = new THREE.Group();
      // hinge sits on the cell edge the door blocks
      const off = CELL / 2 - 0.1;
      if (d.dir === 'z') {
        pivot.position.set(d.x - CELL / 2 + 0.15, d.y, d.z);
        mesh.rotation.y = 0;
      } else {
        pivot.position.set(d.x, d.y, d.z - CELL / 2 + 0.15);
        pivot.rotation.y = Math.PI / 2;
      }
      pivot.add(mesh);
      pivot.userData = { id: d.id, open: false, target: 0, current: 0, dir: d.dir, kind: d.kind, floor: d.f };
      this.root.add(pivot);
      this.doorMeshes.set(d.id, pivot);
      // frame
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(d.dir === 'z' ? CELL + 0.3 : 0.4, 3.9, d.dir === 'z' ? 0.4 : CELL + 0.3),
        this.tex.material('stone', { repeat: 0.5, color: 0x8f8f8f })
      );
      frame.position.set(d.x, d.y + 1.95, d.z);
      frame.receiveShadow = true;
      this.root.add(frame);
      void off;
    }
  }

  buildVaults() {
    const geo = buildVault();
    const mat = this.tex.material('wood', { repeat: 0.8, color: 0xb0a596 });
    if (!this.map.vaults.length) return;
    const inst = new THREE.InstancedMesh(geo, mat, this.map.vaults.length);
    inst.castShadow = this.quality.shadows;
    inst.receiveShadow = true;
    const dummy = new THREE.Object3D();
    this.map.vaults.forEach((v, i) => {
      dummy.position.set(v.x, v.y, v.z);
      dummy.rotation.set(0, v.dir === 'x' ? Math.PI / 2 : 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    });
    inst.instanceMatrix.needsUpdate = true;
    this.root.add(inst);
  }

  // ---------------------------------------------------------- interactives

  buildInteractives() {
    const mk = (built, matKind, pos, yaw = 0, scale = 1) => {
      const mesh = new THREE.Mesh(built.geo || built, this.propMaterial(matKind));
      mesh.position.set(pos.x, pos.y, pos.z);
      mesh.rotation.y = yaw;
      mesh.scale.setScalar(scale);
      mesh.castShadow = this.quality.shadows;
      mesh.receiveShadow = true;
      this.root.add(mesh);
      return mesh;
    };

    // --- ritual seals (glowing rings on the wall) ---
    const sealBuilt = PROPS.seal();
    for (const s of this.map.seals) {
      const yaw = this.wallFacingYaw(s.floor, s.gx, s.gz);
      const mesh = mk(sealBuilt, 'obsidian', { x: s.x, y: s.y, z: s.z }, yaw);
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0xff2a1a, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false,
      });
      const glow = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.95, 28), glowMat);
      glow.position.set(0, 1.5, 0.3);
      mesh.add(glow);
      mesh.userData = { id: s.id, kind: 'seal', glow: glowMat, glowMesh: glow };
      this.sealMeshes.set(s.id, mesh);
      this.interactives.push({ id: s.id, kind: 'seal', x: s.x, y: s.y + 1.5, z: s.z, floor: s.floor, radius: 3.2, mesh });
    }

    // --- altar ---
    const altar = mk(PROPS.altar(), 'obsidian', { x: this.map.altar.x, y: this.map.altar.y, z: this.map.altar.z });
    this.altarMesh = altar;
    const altarGlow = new THREE.PointLight(0x8b2fd6, 0, 22);
    altarGlow.position.set(this.map.altar.x, this.map.altar.y + 2.4, this.map.altar.z);
    this.engine.scene.add(altarGlow);
    this.altarLight = altarGlow;
    this.interactives.push({
      id: 'altar', kind: 'altar', x: this.map.altar.x, y: this.map.altar.y + 1.4,
      z: this.map.altar.z, floor: this.map.altar.floor, radius: 4.0, mesh: altar,
    });

    // --- the gate ---
    const gate = mk(PROPS.gate_frame(), 'obsidian', { x: this.map.gate.x, y: this.map.gate.y, z: this.map.gate.z });
    this.gateMesh = gate;
    const portalMat = new THREE.MeshBasicMaterial({ color: 0x120620, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
    const portal = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 7.6), portalMat);
    portal.position.set(0, 4.0, 0);
    gate.add(portal);
    this.gatePortal = portal;
    this.gatePortalMat = portalMat;
    const gateLight = new THREE.PointLight(0x6a3cff, 3, 30);
    gateLight.position.set(this.map.gate.x, this.map.gate.y + 4, this.map.gate.z);
    this.engine.scene.add(gateLight);
    this.gateLight = gateLight;
    this.interactives.push({
      id: 'gate', kind: 'gate', x: this.map.gate.x, y: this.map.gate.y + 1.5,
      z: this.map.gate.z, floor: this.map.gate.floor, radius: 5.0, mesh: gate,
    });

    // --- containers ---
    const contGeos = {
      chest: PROPS.container_chest(), cabinet: PROPS.container_cabinet(),
      crate: PROPS.container_crate(), desk: PROPS.container_desk(),
    };
    for (const c of this.map.containers) {
      const built = contGeos[c.kind] || contGeos.crate;
      const yaw = this.wallFacingYaw(c.floor, c.gx, c.gz);
      const mesh = mk(built, built.mat, { x: c.x, y: c.y, z: c.z }, yaw);
      mesh.userData = { id: c.id, kind: 'container', searched: false };
      this.containerMeshes.set(c.id, mesh);
      this.interactives.push({ id: c.id, kind: 'container', x: c.x, y: c.y + 0.8, z: c.z, floor: c.floor, radius: 2.6, mesh });
    }

    // --- hiding spots ---
    const hideGeos = { locker: PROPS.locker(), wardrobe: PROPS.wardrobe(), iron_maiden: PROPS.iron_maiden() };
    for (const h of this.map.hidingSpots) {
      const built = hideGeos[h.kind] || hideGeos.locker;
      const yaw = this.wallFacingYaw(h.floor, h.gx, h.gz);
      const mesh = mk(built, built.mat, { x: h.x, y: h.y, z: h.z }, yaw);
      mesh.userData = { id: h.id, kind: 'hide' };
      this.hideMeshes.set(h.id, mesh);
      this.interactives.push({ id: h.id, kind: 'hide', x: h.x, y: h.y + 1.0, z: h.z, floor: h.floor, radius: 2.4, mesh });
    }

    // --- hazards ---
    const hazGeos = { blades: PROPS.hazard_blades(), spikes: PROPS.hazard_spikes(), steam: PROPS.hazard_steam() };
    for (const hz of this.map.hazards) {
      const built = hazGeos[hz.kind] || hazGeos.spikes;
      mk(built, 'iron', { x: hz.x, y: hz.y, z: hz.z }, this.rand.float(0, 6.28));
    }

    // --- quest pickups (relics / box fragments) get their own glow ---
    this.questGroup = new THREE.Group();
    this.root.add(this.questGroup);
  }

  /** Yaw so a wall-hugging prop faces into the room. */
  wallFacingYaw(floor, gx, gz) {
    if (isSolid(this.map, floor, gx, gz - 1)) return 0;
    if (isSolid(this.map, floor, gx, gz + 1)) return Math.PI;
    if (isSolid(this.map, floor, gx - 1, gz)) return Math.PI / 2;
    if (isSolid(this.map, floor, gx + 1, gz)) return -Math.PI / 2;
    return 0;
  }

  /** Show/refresh the floating pickups for relics and box fragments. */
  syncQuestItems(objectives) {
    if (!objectives) return;
    const wanted = new Map();
    for (const s of objectives.relics.sites) if (!s.taken && !s.delivered) wanted.set(s.id, { ...s, kind: 'relic' });
    for (const s of objectives.pieces.sites) if (!s.taken && !s.delivered) wanted.set(s.id, { ...s, kind: 'piece' });

    for (const [id, mesh] of this.questMeshes) {
      if (!wanted.has(id)) {
        this.questGroup.remove(mesh);
        this.questMeshes.delete(id);
        this.interactives = this.interactives.filter((i) => i.id !== id);
      }
    }
    for (const [id, s] of wanted) {
      if (this.questMeshes.has(id)) continue;
      const g = new THREE.Group();
      const isRelic = s.kind === 'relic';
      const core = new THREE.Mesh(
        isRelic ? new THREE.OctahedronGeometry(0.24, 0) : new THREE.BoxGeometry(0.3, 0.3, 0.3),
        new THREE.MeshStandardMaterial({
          color: isRelic ? 0xd8b25a : 0xc0402f,
          emissive: isRelic ? 0x8a5c12 : 0x6d1208,
          emissiveIntensity: 1.6,
          metalness: 0.8,
          roughness: 0.3,
        })
      );
      core.castShadow = false;
      g.add(core);
      const light = new THREE.PointLight(isRelic ? 0xffc766 : 0xff5533, 3.2, 8);
      g.add(light);
      g.position.set(s.x, (FLOOR_Y[s.floor] || 0) + 1.05, s.z);
      g.userData = { id, kind: s.kind, spin: Math.random() * 6.28 };
      this.questGroup.add(g);
      this.questMeshes.set(id, g);
      this.interactives.push({
        id, kind: s.kind === 'relic' ? 'relic' : 'piece',
        x: s.x, y: (FLOOR_Y[s.floor] || 0) + 1.05, z: s.z, floor: s.floor, radius: 2.6, mesh: g,
      });
    }
  }

  // ---------------------------------------------------------------- lights

  buildLights() {
    // pooled real lights
    this.lightPool = [];
    const poolSize = this.quality.maxDynamicLights;
    for (let i = 0; i < poolSize; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 12, 1.6);
      l.castShadow = false;
      this.engine.scene.add(l);
      this.lightPool.push({ light: l, anchor: null, phase: Math.random() * 100 });
    }
    // one shadow-casting light follows the strongest nearby source
    if (this.quality.shadows) {
      this.keyLight = new THREE.PointLight(0xffa860, 0, 26, 1.7);
      this.keyLight.castShadow = true;
      this.keyLight.shadow.mapSize.set(this.quality.shadowMapSize, this.quality.shadowMapSize);
      this.keyLight.shadow.bias = -0.004;
      this.keyLight.shadow.camera.near = 0.4;
      this.keyLight.shadow.camera.far = 26;
      this.engine.scene.add(this.keyLight);
    }

    // emissive stand-ins for every anchor, one draw call per kind
    this.flameMeshes = new Map();
    const byKind = new Map();
    for (const l of this.map.lights) {
      if (!byKind.has(l.kind)) byKind.set(l.kind, []);
      byKind.get(l.kind).push(l);
    }
    const dummy = new THREE.Object3D();
    for (const [kind, list] of byKind) {
      const def = LIGHT_KINDS[kind] || LIGHT_KINDS.candle;
      const geo = new THREE.IcosahedronGeometry(def.size, 1);
      const mat = new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.95 });
      const inst = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((l, i) => {
        dummy.position.set(l.x, l.y + def.height, l.z);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      });
      inst.instanceMatrix.needsUpdate = true;
      inst.frustumCulled = false;
      this.root.add(inst);
      this.flameMeshes.set(kind, { inst, list, def, mat });

      // physical fixture under each flame
      const fixture =
        kind === 'brazier' ? PROPS.brazier_stand() : kind === 'candle' ? PROPS.candelabra() : null;
      if (fixture) {
        const fInst = new THREE.InstancedMesh(fixture.geo, this.propMaterial(fixture.mat), list.length);
        fInst.castShadow = false;
        fInst.receiveShadow = true;
        list.forEach((l, i) => {
          dummy.position.set(l.x, l.y, l.z);
          dummy.rotation.set(0, this.rand.float(0, 6.28), 0);
          dummy.scale.setScalar(kind === 'brazier' ? 1 : 0.9);
          dummy.updateMatrix();
          fInst.setMatrixAt(i, dummy.matrix);
        });
        fInst.instanceMatrix.needsUpdate = true;
        this.root.add(fInst);
      }
    }
  }

  // ------------------------------------------------------------ atmosphere

  buildAtmosphere() {
    // floating dust / ash, follows the camera in a big box
    const count = Math.floor(2600 * this.quality.particles);
    if (count <= 0) {
      this.dust = null;
      return;
    }
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const seedArr = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 46;
      pos[i * 3 + 1] = Math.random() * 12;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 46;
      seedArr[i] = Math.random() * 100;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seedArr, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: this.timeUniform,
        uColor: { value: new THREE.Color(0xbfae94) },
        uOpacity: { value: 0.34 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uTime;
        attribute float aSeed;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          p.y = mod(p.y + uTime * (0.10 + fract(aSeed) * 0.16), 12.0);
          p.x += sin(uTime * 0.32 + aSeed) * 0.7;
          p.z += cos(uTime * 0.27 + aSeed * 1.7) * 0.7;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (14.0 + fract(aSeed * 3.1) * 22.0) / max(1.0, -mv.z);
          vAlpha = smoothstep(44.0, 4.0, -mv.z);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying float vAlpha;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float a = smoothstep(0.5, 0.0, length(d));
          gl_FragColor = vec4(uColor, a * vAlpha * uOpacity);
        }
      `,
    });
    this.dust = new THREE.Points(geo, mat);
    this.dust.frustumCulled = false;
    this.engine.scene.add(this.dust);
  }

  // ---------------------------------------------------------------- update

  /**
   * @param {number} dt
   * @param {THREE.Vector3} camPos
   * @param {number} floor  which floor the local player is on
   */
  update(dt, camPos, floor = 0) {
    this.time += dt;
    this.timeUniform.value = this.time;
    this.currentFloor = floor;

    if (this.dust) {
      this.dust.position.set(camPos.x, FLOOR_Y[floor] || 0, camPos.z);
    }

    // --- zone-driven fog and ambience ---
    const gx = worldToGridX(camPos.x);
    const gz = worldToGridZ(camPos.z);
    let zone = ZONES.corridor;
    if (gx >= 0 && gz >= 0 && gx < GRID_W && gz < GRID_H) {
      zone = ZONE_BY_ID[this.map.floors[floor].zone[gz * GRID_W + gx]] || ZONES.corridor;
    }
    const mood = MOODS[zone.mood] || MOODS.dark;
    const blend = Math.min(1, dt * 1.4);
    const fog = this.engine.scene.fog;
    if (fog) {
      fog.color.lerp(new THREE.Color(mood.fog), blend);
      const targetDensity = mood.density * (this.lightsOut > 0 ? 1.9 : 1) * this.fogScale();
      fog.density += (targetDensity - fog.density) * blend;
    }
    this.ambient.color.lerp(new THREE.Color(mood.ambient), blend);
    const ai = mood.ai * (this.lightsOut > 0 ? 0.22 : 1);
    this.ambient.intensity += (ai - this.ambient.intensity) * blend;
    this.currentZone = zone;

    if (this.lightsOut > 0) this.lightsOut = Math.max(0, this.lightsOut - dt);

    this.updateLights(dt, camPos, floor);
    this.updateDoors(dt);
    this.updateInteractiveFx(dt);
  }

  fogScale() {
    switch (this.quality.fogQuality) {
      case 'low': return 0.7;
      case 'medium': return 0.85;
      case 'ultra': return 1.15;
      default: return 1;
    }
  }

  updateLights(dt, camPos, floor) {
    // pick the nearest anchors on this floor and hand them to the pool
    const anchors = [];
    for (const l of this.map.lights) {
      if (l.floor !== floor) continue;
      const dx = l.x - camPos.x;
      const dz = l.z - camPos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > 2100) continue;
      anchors.push({ l, d2 });
    }
    anchors.sort((a, b) => a.d2 - b.d2);

    const out = this.lightsOut > 0;
    for (let i = 0; i < this.lightPool.length; i++) {
      const slot = this.lightPool[i];
      const a = anchors[i];
      if (!a) {
        slot.light.intensity += (0 - slot.light.intensity) * Math.min(1, dt * 8);
        continue;
      }
      const def = LIGHT_KINDS[a.l.kind] || LIGHT_KINDS.candle;
      slot.light.position.set(a.l.x, a.l.y + def.height, a.l.z);
      slot.light.color.setHex(def.color);
      slot.light.distance = def.distance;
      const flick =
        1 +
        Math.sin(this.time * 11.3 + slot.phase) * def.flicker * 0.5 +
        Math.sin(this.time * 27.7 + slot.phase * 2.1) * def.flicker * 0.3 +
        (Math.random() - 0.5) * def.flicker * 0.35;
      // emergency lights pulse instead of guttering
      const pulse = a.l.kind === 'emergency' ? 0.55 + 0.45 * Math.sin(this.time * 2.4 + slot.phase) : 1;
      const target = out ? (a.l.kind === 'emergency' ? def.intensity * 0.25 * pulse : 0) : def.intensity * flick * pulse;
      slot.light.intensity += (target - slot.light.intensity) * Math.min(1, dt * 14);
    }

    if (this.keyLight) {
      const nearest = anchors[0];
      if (nearest) {
        const def = LIGHT_KINDS[nearest.l.kind] || LIGHT_KINDS.candle;
        this.keyLight.position.set(nearest.l.x, nearest.l.y + def.height, nearest.l.z);
        this.keyLight.color.setHex(def.color);
        const target = out ? 0 : def.intensity * 0.85;
        this.keyLight.intensity += (target - this.keyLight.intensity) * Math.min(1, dt * 10);
      } else {
        this.keyLight.intensity *= 0.9;
      }
    }

    // flame billboards flicker in scale
    for (const [, fm] of this.flameMeshes) {
      fm.mat.opacity = out && fm.def !== LIGHT_KINDS.emergency ? 0.05 : 0.95;
    }
  }

  updateDoors(dt) {
    for (const [, pivot] of this.doorMeshes) {
      const ud = pivot.userData;
      const target = ud.open ? -Math.PI * 0.62 : 0;
      const base = ud.dir === 'z' ? 0 : Math.PI / 2;
      ud.current += (target - ud.current) * Math.min(1, dt * 7);
      pivot.rotation.y = base + ud.current;
    }
  }

  updateInteractiveFx(dt) {
    // quest pickups bob and spin
    for (const [, g] of this.questMeshes) {
      g.userData.spin += dt * 1.4;
      g.rotation.y = g.userData.spin;
      g.position.y += Math.sin(this.time * 2 + g.userData.spin) * dt * 0.22;
    }
    // seal glow pulses while unbroken
    for (const [, mesh] of this.sealMeshes) {
      const ud = mesh.userData;
      if (!ud.glow) continue;
      if (ud.broken) {
        ud.glow.opacity = Math.max(0, ud.glow.opacity - dt * 0.8);
      } else {
        ud.glow.opacity = 0.55 + Math.sin(this.time * 2.2) * 0.25;
        ud.glowMesh.scale.setScalar(1 + Math.sin(this.time * 1.7) * 0.05);
      }
    }
    if (this.gatePortalMat) {
      // The Gate has three states and all three need to read on screen:
      // sealed (near black), unbound but uncharged (a dim, breathing violet),
      // and open (a lit doorway). Previously anything short of fully charged
      // looked identical to sealed, which made the climax a black wall.
      const open = this.gateOpen ? 1 : 0;
      const charge = this.gateCharge || 0;
      const t = open ? 1 : this.gateUnlocked ? 0.25 + charge * 0.7 : 0;
      const col = new THREE.Color(0x120620).lerp(new THREE.Color(0x7d46ff), t);
      this.gatePortalMat.color.lerp(col, Math.min(1, dt * 2));
      const breathe = 1 + Math.sin(this.time * 1.5) * 0.12 * (1 - open);
      const target = (open ? 90 : this.gateUnlocked ? 12 + charge * 55 : 3) * breathe;
      this.gateLight.intensity += (target - this.gateLight.intensity) * Math.min(1, dt * 2);
    }
    if (this.altarLight) {
      const t = this.altarHeat || 0;
      this.altarLight.intensity += (t * 26 - this.altarLight.intensity) * Math.min(1, dt * 3);
    }
  }

  // --------------------------------------------------------------- API

  setDoor(id, open) {
    const d = this.doorMeshes.get(id);
    if (d) d.userData.open = open;
  }

  setSealBroken(id) {
    const m = this.sealMeshes.get(id);
    if (m) m.userData.broken = true;
  }

  setContainerSearched(id) {
    const m = this.containerMeshes.get(id);
    if (m) m.userData.searched = true;
  }

  setGateOpen(open) {
    this.gateOpen = open;
  }

  /** @param {{unlocked:boolean, charge:number, open:boolean}} gate */
  setGateState(gate) {
    if (!gate) return;
    this.gateUnlocked = !!gate.unlocked;
    this.gateCharge = gate.charge || 0;
    this.gateOpen = !!gate.open;
  }

  setAltarHeat(v) {
    this.altarHeat = v;
  }

  triggerLightsOut(duration = 9) {
    this.lightsOut = duration;
  }

  /** Nearest interactable in front of the player, for the HUD prompt. */
  findInteractable(pos, floor, dir, maxDist = 3.2) {
    let best = null;
    let bestScore = Infinity;
    for (const it of this.interactives) {
      if (it.floor !== floor) continue;
      const dx = it.x - pos.x;
      const dz = it.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d > Math.min(maxDist, it.radius)) continue;
      const dy = Math.abs(it.y - pos.y);
      if (dy > 3.5) continue;
      const facing = d < 0.5 ? 1 : (dx / d) * dir.x + (dz / d) * dir.z;
      if (facing < 0.1) continue;
      const score = d - facing * 1.2;
      if (score < bestScore) {
        bestScore = score;
        best = it;
      }
    }
    return best;
  }

  /** Nearest vault obstacle the player could hop, or null. */
  findVault(pos, floor, dir) {
    for (const v of this.map.vaults) {
      if (v.f !== floor) continue;
      const dx = v.x - pos.x;
      const dz = v.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 2.6) continue;
      const facing = (dx / (d || 1)) * dir.x + (dz / (d || 1)) * dir.z;
      if (facing < 0.35) continue;
      return v;
    }
    return null;
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    this.engine.scene.remove(this.root);
    if (this.dust) this.engine.scene.remove(this.dust);
    for (const s of this.lightPool) this.engine.scene.remove(s.light);
    if (this.keyLight) this.engine.scene.remove(this.keyLight);
    if (this.altarLight) this.engine.scene.remove(this.altarLight);
    if (this.gateLight) this.engine.scene.remove(this.gateLight);
    this.engine.scene.remove(this.ambient);
    this.engine.scene.remove(this.hemi);
  }
}

export { MOODS, LIGHT_KINDS };

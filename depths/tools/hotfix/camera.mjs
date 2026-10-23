/**
 * Hotfix 1.0.1 regression tests: camera, inventory and refuge items (no
 * browser). Run: node tools/hotfix/camera.mjs
 * Covers one exposure per camera input, photographs across checkpoints,
 * Survey Stations with a full pouch, door wedges, targeting small items on
 * cluttered desks, refuge clocks at long frames, pursuit music inside a
 * refuge, the Drowned wake's culling bounds and journal thumbnails.
 */
import * as THREE from 'three';
import { Game } from '../../src/sim/game.js';
import { addToPouch } from '../../src/sim/equipment.js';
import { findTarget, available } from '../../src/sim/interact.js';
import { closeCycle, openCycle } from '../../src/sim/shutters.js';
import { Settings } from '../../src/core/settings.js';
import { Controller } from '../../src/game/controller.js';
import { LevelView } from '../../src/view/levelView.js';
import { CreatureView } from '../../src/view/creatures.js';
import { PhotoRenderer } from '../../src/view/photoView.js';
import { App } from '../../src/app.js';

let pass = 0, fail = 0;
const failures = [];
function test(name, fn) {
  try { fn(); pass++; } catch (e) { fail++; failures.push(`${name}: ${e.message}`); }
}
function ok(c, msg = 'expected true') { if (!c) throw new Error(msg); }
function eq(a, b, msg = '') { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

/** A game positioned in a chapter (replay entry), with one player. */
function game(ch, opts = {}) {
  const g = new Game({ seed: 11, ...opts });
  g.addPlayer('p1', 'evan', 'Evan');
  g.loadChapter(ch, { entry: 'replay' });
  return g;
}
const P = (g) => g.players.get('p1');
const run = (g, sec) => { for (let i = 0; i < Math.round(sec / 0.05); i++) g.tick(0.05); };
/** Stand at (x, z) on floor height fy and look straight at a point. */
function aimAt(p, x, z, pt, fy = 0) {
  p.x = x; p.z = z; p.y = fy; p.crouched = false; p.eyeH = 1.62;
  const e = p.eye();
  p.yaw = Math.atan2(-(pt.x - e.x), -(pt.z - e.z));
  p.pitch = Math.atan2((pt.y ?? 1) - e.y, Math.hypot(pt.x - e.x, pt.z - e.z));
}

// ------------------------------------------------------------------ 1. camera input
test('camera: two shutter requests in one tick use one exposure', () => {
  const g = game(1), p = P(g);
  g.equip('p1', 'camera');
  const film = p.film;
  ok(g.takePhoto('p1', { force: true }).ok, 'first exposure');
  ok(!g.takePhoto('p1', { force: true }).ok, 'second request refused while developing');
  run(g, 0.05);
  ok(!g.takePhoto('p1', { force: true }).ok, 'still refused on the next tick');
  eq(film - p.film, 1, 'exposures used');
  eq(g.photos.length, 1, 'photographs');
});
test('camera: one press held across frames through the controller takes one photo', () => {
  const settings = new Settings();
  const B = (a) => settings.data.controls.bindings[a] || [];
  const down = new Set();
  let pressed = new Set();
  const input = {
    mouseDX: 0, mouseDY: 0, padAxes: [0, 0, 0, 0], pad: null, down,
    binding: B, isDown: (a) => B(a).some((c) => c && down.has(c)), pressed: (a) => B(a).some((c) => c && pressed.has(c)),
    released: () => false, padPressed: () => false, keyPressed: (c) => pressed.has(c),
  };
  let shutters = 0;
  const app = { input, settings, hud: { showRadial() {} }, fp: { shutter() { shutters++; } }, overlays: {}, onInteractResult() {}, requestHint() {} };
  const ctl = new Controller(app);
  const g = game(1), p = P(g);
  g.equip('p1', 'camera');
  const film = p.film;
  const use = B('use')[0];
  down.add(use); pressed.add(use);
  for (let k = 0; k < 12; k++) { ctl.update(1 / 60, g, 'p1', false); g.tick(1 / 60); pressed = new Set(); }
  eq(film - p.film, 1, 'exposures used');
  eq(shutters, 1, 'shutter animations');
  // holding past the development time does not fire again without a new press
  for (let k = 0; k < 300; k++) { ctl.update(1 / 60, g, 'p1', false); g.tick(1 / 60); }
  eq(film - p.film, 1, 'held button after development');
});

// ------------------------------------------------------------------ 2. photographs across checkpoints
test('photo: a photograph still developing at a checkpoint survives the reload', () => {
  const g = game(1), p = P(g);
  g.equip('p1', 'camera');
  const ph = g.takePhoto('p1', { force: true }).photo;
  run(g, 1);
  ok(g.time < p.developUntil, 'still developing');
  g.makeCheckpoint('test');
  const snap = JSON.parse(JSON.stringify(g.checkpoint));
  ok(snap.photos.some((x) => x.id === ph.id), 'the developing photograph is in the snapshot');
  ok(snap.timers.some((t) => t.key === 'photoDev' && t.data.id === ph.id), 'its development timer is in the snapshot');
  for (const h of [g, new Game({ seed: 3 })]) {
    if (h !== g) h.addPlayer('p1', 'evan', 'Evan');
    h.restore(snap);
    const r = h.photos.find((x) => x.id === ph.id);
    ok(r && JSON.stringify(r.targets) === JSON.stringify(ph.targets) && JSON.stringify(r.text) === JSON.stringify(ph.text), 'record restored unchanged');
    const dev = []; for (let i = 0; i < 80; i++) { h.tick(0.05); dev.push(...h.drainEvents().filter((e) => e.e === 'photoDeveloped').map((e) => e.id)); }
    eq(dev, [ph.id], 'it finishes developing after the reload');
    const next = h.takePhoto('p1', { force: true });
    ok(next.ok && next.photo.id !== ph.id, 'a new photograph never reuses a restored id');
  }
});
test('photo: an exposure taken in the frame a checkpoint is made is reported first', () => {
  const g = game(1);
  g.equip('p1', 'camera');
  g.drainEvents();
  g.requestCheckpoint('test');
  g.takePhoto('p1', { force: true }); // the controller runs before the tick
  g.tick(0.05);
  const evs = g.drainEvents().map((e) => e.e);
  ok(evs.includes('checkpoint'), 'checkpoint made');
  ok(evs.indexOf('photoTaken') < evs.indexOf('checkpoint'), 'photoTaken comes first, so the image exists when the save exports thumbnails');
  ok(g.checkpoint.photos.length === 1, 'checkpoint lists the photograph');
});
test('photo: thumbnails exported with a save load back for the same ids', () => {
  const src = { thumbs: new Map([['ph1', 'data:a'], ['ph2', 'data:b']]), images: new Map([['ph2', 'data:B']]) };
  const saved = PhotoRenderer.prototype.exportThumbs.call(src, ['ph1', 'ph2']);
  eq(saved, { ph1: 'data:a', ph2: 'data:b' });
  const dst = { thumbs: new Map(), images: new Map() };
  PhotoRenderer.prototype.load.call(dst, JSON.parse(JSON.stringify(saved)));
  eq(PhotoRenderer.prototype.thumb.call(dst, 'ph1'), 'data:a');
  eq(PhotoRenderer.prototype.get.call(dst, 'ph2'), 'data:b', 'the journal detail falls back to the thumbnail');
});

// ------------------------------------------------------------------ 3. survey stations
test('station: a required Survey Station image enters the journal with a full pouch and no film', () => {
  const g = game(1), p = P(g);
  for (const it of ['bandage', 'battery', 'tea', 'decoy', 'firstaid']) addToPouch(p, it, 3);
  ok(p.pouch.every(Boolean) && addToPouch(p, 'chalk', 1) === 1, 'pouch is full');
  p.film = 0;
  const st = g.level.stations.find((s) => s.id === 'S1');
  ok(st.target === 'h1cables', 'S1 is the required P1 station');
  p.x = st.panel.x + 0.8; p.z = st.panel.z; p.y = 0;
  ok(g.beginInteract('p1', 'station:S1').ok, 'station starts');
  run(g, 12.5);
  const c = g.story.clues['clue.P1'];
  ok(c && c.source === 'station', 'clue recorded as a survey image');
  ok(g.photos.some((x) => x.source === 'station' && x.targets.includes('h1cables')), 'survey image stored with the photographs');
  eq(p.film, 0, 'no film used');
  ok(p.pouch.every(Boolean), 'pouch untouched');
});

// ------------------------------------------------------------------ 4. door wedges
test('wedge: using a wedge removes it from the pouch', () => {
  const g = game(1), p = P(g);
  addToPouch(p, 'wedge', 2);
  const d = g.level.door('d105');
  const aim = () => aimAt(p, d.x - 1, d.z, { x: d.x, y: 1.1, z: d.z });
  aim();
  eq(findTarget(g, p) && findTarget(g, p).id, 'door:d105', 'looking at the door');
  const slot = p.pouch.findIndex((s) => s && s.item === 'wedge');
  ok(g.pouchAction('p1', slot, 'use').ok, 'wedge use starts');
  run(g, 1.5);
  ok(d.wedge, 'door wedged');
  eq(p.pouchCount('wedge'), 1, 'one wedge left');
  ok(!g.pouchAction('p1', slot, 'use').ok, 'an already wedged door is refused');
  run(g, 1.5);
  eq(p.pouchCount('wedge'), 1, 'a refused use keeps the wedge');
  // the last wedge empties its slot
  d.wedge = false;
  aim();
  ok(g.pouchAction('p1', slot, 'use').ok, 'last wedge use starts');
  run(g, 1.5);
  ok(d.wedge, 'door wedged again');
  eq(p.pouch[slot], null, 'slot emptied');
});

// ------------------------------------------------------------------ 5. targeting on cluttered desks
/** The scoring before the hotfix, as a reference for everything outside the snap radius. */
function oldTarget(g, p) {
  const e = p.eye(), f = p.forward();
  let best = null, bs = Infinity;
  for (const it of g.level.interactables) {
    if ((it.kind === 'clock' && !it.pressable) || it.noTarget || !available(g, it)) continue;
    const dx = it.x - e.x, dy = (it.y ?? 1) - e.y, dz = it.z - e.z, d = Math.hypot(dx, dy, dz);
    const reach = it.reach || 1.8;
    if (d > reach + 0.35 || Math.hypot(dx, dz) > reach) continue;
    const cos = (dx * f.x + dy * f.y + dz * f.z) / (d || 1);
    if (cos < (d < 0.8 ? 0.4 : Math.cos(28 * Math.PI / 180))) continue;
    const hit = g.level.world.raycast(e.x, e.y, e.z, dx / d, dy / d, dz / d, d, 'sight');
    if (hit && hit.t < d - 0.45 && !(hit.box.door && it.kind === 'door' && hit.box.door.id === it.door)) continue;
    const s = (1 - cos) * 4 + d * 0.15;
    if (s < bs) { bs = s; best = it; }
  }
  return best;
}
test('targeting: a battery under the crosshair beats the nearer mug beside it', () => {
  const g = game(4), p = P(g);
  const bat = g.level.interById.get('o4bat1'), mug = g.level.interById.get('mug');
  aimAt(p, 12.15, 37.3, bat);
  eq(findTarget(g, p).id, 'o4bat1', 'battery');
  aimAt(p, 12.15, 37.3, mug);
  eq(findTarget(g, p).id, 'mug', 'aiming at the mug still picks the mug');
});
test('targeting: a record just off the crosshair beats the panel or table it sits beside', () => {
  const g2 = game(2), p2 = P(g2);
  p2.x = -13.447; p2.z = 59.683; p2.y = 0; p2.yaw = -2.0333; p2.pitch = -0.335;
  eq(oldTarget(g2, p2).id, 'panel:P4', 'the old scoring picked the panel');
  eq(findTarget(g2, p2).id, 'rec:11', 'record');
  const g1 = game(1), p1 = P(g1);
  p1.x = -8.9; p1.z = 23.75; p1.y = 0; p1.yaw = -1.6202; p1.pitch = -0.5952;
  eq(oldTarget(g1, p1).id, 'deck_1.03', 'the old scoring picked the deck table');
  eq(findTarget(g1, p1).id, 'rec:02', 'record');
});
test('targeting: every small item is picked when aimed at; elsewhere targeting is unchanged', () => {
  const SMALL = new Set(['pickup', 'dropped', 'record', 'note', 'offered']);
  let aimed = 0, same = 0, compared = 0;
  for (const ch of [1, 2, 3, 4, 5, 6]) {
    const g = game(ch), p = P(g), W = g.level.world;
    for (const it of g.level.interactables) {
      if (!available(g, it) || it.noTarget || (it.kind === 'clock' && !it.pressable)) continue;
      const room = g.level.roomAt(it.x, it.z), fy = room ? room.floorY || 0 : 0;
      for (let k = 0; k < 12; k++) {
        const a = k / 12 * Math.PI * 2, x = it.x + Math.sin(a) * 1.05, z = it.z + Math.cos(a) * 1.05;
        if (!g.level.roomAt(x, z) || W.overlaps(x - 0.35, fy + 0.05, z - 0.35, x + 0.35, fy + 1.8, z + 0.35, 1)) continue;
        aimAt(p, x, z, it, fy);
        const e = p.eye(), dx = it.x - e.x, dy = (it.y ?? 1) - e.y, dz = it.z - e.z, d = Math.hypot(dx, dy, dz);
        const hit = W.raycast(e.x, e.y, e.z, dx / d, dy / d, dz / d, d, 'sight');
        if (hit && hit.t < d - 0.45) continue;
        for (const off of [0, 0.07, -0.07]) {
          p.yaw += off;
          const t = findTarget(g, p);
          if (!off && SMALL.has(it.kind)) { aimed++; eq(t && t.id, it.id, `chapter ${ch}`); }
          // with no small item within the snap radius of the aim ray, the old scoring decides
          const f = p.forward();
          const snapped = g.level.interactables.some((q) => {
            if (!SMALL.has(q.kind) || !available(g, q)) return false;
            const qx = q.x - e.x, qy = (q.y ?? 1) - e.y, qz = q.z - e.z, qd = Math.hypot(qx, qy, qz), c = (qx * f.x + qy * f.y + qz * f.z) / qd;
            return c > 0 && qd * Math.sqrt(Math.max(0, 1 - c * c)) < 0.12;
          });
          if (!snapped) { compared++; const o = oldTarget(g, p); if ((o && o.id) === (t && t.id)) same++; }
          p.yaw -= off;
        }
      }
    }
  }
  ok(aimed > 500, `small items surveyed (${aimed})`);
  ok(compared > 2000, `other aims surveyed (${compared})`);
  eq(same, compared, 'unchanged outside the snap radius');
});

// ------------------------------------------------------------------ 6. refuge clocks
test('clocks: the second hand follows game time at long frames; an imitation stays stopped', () => {
  const g = game(1);
  const hand = () => ({ rotation: { z: 0 } });
  const clocks = [{ sh: hand(), mh: hand(), hh: hand(), genuine: true, frozen: 0.4 }, { sh: hand(), mh: hand(), hh: hand(), genuine: false, frozen: 0.4 }];
  const view = { game: g, doors: [], items: new Map(), clocks, panels: [], swaps: [], wallDoors: [], hidden: [], flickers: [], dyn: new Map(), waterMeshes: [], _updateSil() {} };
  let moves = 0, last = null;
  const frozen = clocks[1].sh.rotation;
  g.time = 10.2;
  for (const dt of [0.5, 1.0, 0.7, 1.0, 0.5, 0.9, 1.0, 0.6]) {
    g.time += dt;
    LevelView.prototype.update.call(view, dt);
    const want = -((Math.floor(g.time) % 60) / 60) * Math.PI * 2;
    ok(Math.abs(clocks[0].sh.rotation.z - want) < 1e-9, `second hand at t=${g.time.toFixed(1)}`);
    if (last !== null && clocks[0].sh.rotation.z !== last) moves++;
    last = clocks[0].sh.rotation.z;
    ok(Math.abs(frozen.z + 0.4 * Math.PI * 2) < 1e-9, 'imitation hand stopped');
  }
  ok(moves >= 5, `the hand moved on long frames (${moves})`);
});

// ------------------------------------------------------------------ 7. pursuit music in a refuge
test('pursuit: music stops once everyone is inside a genuine refuge and does not restart there', () => {
  const g = game(2), p = P(g);
  const settings = new Settings();
  const cues = [];
  const app = {
    pid: 'p1', settings, engine: { fxState: { damage: 0, flash: 0, desat: 0, extraGrain: 0, lowHealth: 0 } }, fadeEl: { style: {} },
    audio: { heartbeat() {}, loop() {}, play() {}, music(c) { cues.push(c); } },
  };
  const frame = () => { run(g, 0.25); App.prototype._effects.call(app, 0.25, g, p); };
  const C = g.enemyById('Cgal');
  p.x = -5; p.z = 51; p.y = 0; p.yaw = Math.PI / 2; p.pitch = 0; // in the gallery, facing away from the figure
  closeCycle(g, 'gallery', 6);
  for (let i = 0; i < 16; i++) frame();
  eq(C.state, 'pursue', 'the Cutout hunts during the closed cycle');
  eq(cues[cues.length - 1], 'pursuit', 'pursuit music');
  p.x = -12; p.z = 50.5; // into Refuge R2, not yet verified or secured
  for (let i = 0; i < 4; i++) frame();
  ok(g.inRefugeVolume(p), 'inside the refuge');
  eq(cues[cues.length - 1], null, 'music stops');
  // the cycle reopens and closes again while the player waits inside
  openCycle(g, 'gallery');
  for (let i = 0; i < 24; i++) frame();
  closeCycle(g, 'gallery', 30);
  for (let i = 0; i < 24; i++) frame();
  eq(C.state, 'pursue', 'figures active again');
  eq(cues.filter((c) => c === 'pursuit').length, 1, 'no new pursuit cue while inside the refuge');
  p.x = -5; p.z = 51; // stepping back out is a pursuit again
  for (let i = 0; i < 2; i++) frame();
  eq(cues[cues.length - 1], 'pursuit', 'pursuit resumes outside');
});

// ------------------------------------------------------------------ 8. water wake
test('wake: the droplet trail keeps a culling sphere that covers every droplet', () => {
  const g = game(3);
  const view = new CreatureView({ scene: new THREE.Scene() });
  const c = { id: 'Dt', type: 'drowned', x: 4, z: 5, y: 0, yaw: Math.PI / 2, state: 'patrol', moving: false, inDrain: null, game: g };
  g.enemies = [c];
  view.sync(g, 0.05);
  const drops = view.models.get('Dt').obj.userData.drops;
  const geo = drops.geometry;
  if (!geo.boundingSphere) geo.computeBoundingSphere(); // what the renderer does on the first draw
  c.state = 'pursue'; c.moving = true;
  for (let i = 0; i < 20; i++) { c.x += 3.4 * 0.05; view.sync(g, 0.05); }
  view.root.updateMatrixWorld(true);
  if (!geo.boundingSphere) geo.computeBoundingSphere();
  const s = geo.boundingSphere.clone().applyMatrix4(drops.matrixWorld);
  const v = new THREE.Vector3();
  let far = 0;
  for (let i = 0; i < geo.attributes.position.count; i++) {
    v.fromBufferAttribute(geo.attributes.position, i).applyMatrix4(drops.matrixWorld);
    const d = v.distanceTo(s.center);
    far = Math.max(far, d);
    ok(d <= s.radius + 1e-6, `droplet ${i} outside the culling sphere (${d.toFixed(2)} > ${s.radius.toFixed(2)})`);
  }
  ok(far > 1, 'the trail spreads behind the creature');
});

// ------------------------------------------------------------------ 9. journal
test('journal: the photo grid uses the stored thumbnail, not the full image', () => {
  const r = { thumbs: new Map([['ph1', 'data:thumb']]), images: new Map([['ph1', 'data:full']]) };
  eq(PhotoRenderer.prototype.thumb.call(r, 'ph1'), 'data:thumb');
  eq(PhotoRenderer.prototype.get.call(r, 'ph1'), 'data:full', 'the detail view still gets the full image');
});

console.log(`${pass} passed, ${fail} failed`);
for (const f of failures) console.log(`  FAIL ${f}`);
process.exit(fail ? 1 : 0);

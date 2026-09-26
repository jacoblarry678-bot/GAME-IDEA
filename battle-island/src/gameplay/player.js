/**
 * Player controller: turns keyboard/mouse into ActorInput and actions
 * (fire, build, harvest, loot), and drives the third-person camera with
 * collision, ADS zoom, sniper scope, recoil, skydive and spectator views.
 */

import * as THREE from 'three';
import { newInput } from '../entities/actor.js';
import { PIECES } from './building.js';
import { save } from '../core/save.js';
import { sfx } from '../core/audio.js';
import { itemName, RARITIES } from './items.js';

const MATS = ['wood', 'brick', 'metal'];
const _dir = new THREE.Vector3();

export class PlayerController {
  constructor(game) {
    this.game = game;
    this.inp = newInput();
    this.reset();
  }

  reset() {
    this.yaw = 0;
    this.pitch = -0.1;
    this.dist = 4;
    this.crouchToggle = false;
    this.building = false;
    this.piece = 'wall';
    this.material = 'wood';
    this.rot = 0;
    this.lastKey = '';
    this.placeCd = 0;
    this.spec = null;
    this.spectating = false;
    this.zoom = 1;
    this.aimPoint = new THREE.Vector3();
    this.prompt = null;
    this.shake = 0;
    this.exitEdit();
    this.aimPiece = null;
    this.buildInfo = null;
  }

  /** Leaves edit mode without applying changes. */
  exitEdit() {
    if (this.editing) {
      this.game.scene.remove(this.editing.overlay);
      for (const m of this.editing.overlay.children) m.material.dispose();
    }
    this.editing = null;
  }

  startEdit(piece) {
    const tiles = this.game.building.tileBoxes(piece);
    const overlay = new THREE.Group();
    for (const b of tiles) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(b.maxX - b.minX + 0.08, b.maxY - b.minY + 0.08, b.maxZ - b.minZ + 0.08), new THREE.MeshBasicMaterial({ color: '#4fc3ff', transparent: true, opacity: 0.3, depthWrite: false }));
      m.position.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2);
      m.scale.setScalar(0.94);
      m.renderOrder = 6;
      overlay.add(m);
    }
    this.game.scene.add(overlay);
    this.editing = { piece, tiles: piece.tiles ? [...piece.tiles] : tiles.map(() => true), boxes: tiles, overlay, hover: -1, paint: undefined };
    this.building = false;
    sfx.play('ui');
  }

  get player() {
    return this.game.player;
  }

  spectate(target) {
    this.spectating = true;
    this.spec = target;
    this.building = false;
    this.game.building.hideGhost();
  }

  nextSpectate() {
    const alive = this.game.alive();
    if (!alive.length) return;
    const i = alive.indexOf(this.spec);
    this.spec = alive[(i + 1) % alive.length];
  }

  focus() {
    const a = this.spectating && this.spec ? this.spec : this.player;
    if (!a) return new THREE.Vector3();
    return a.state === 'bus' ? this.game.bus.position.clone() : a.pos.clone();
  }

  camDir() {
    const cp = Math.cos(this.pitch);
    return _dir.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp).normalize();
  }

  update(dt) {
    const g = this.game;
    const input = g.input;
    const p = this.player;
    const inp = this.inp;
    // look
    const ads = p.ads && p.weapon;
    const lk = input.look(dt, ads ? save.data.settings.adsSensitivity / Math.max(1, this.zoom * 0.5) : 1);
    this.yaw -= lk.x;
    this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch - lk.y));
    if (this.spectating) {
      if (!this.spec || !this.spec.alive) this.nextSpectate();
      if (input.pressed('Space')) this.nextSpectate();
      if (this.spec) {
        // follow the spectated player's view
        let d = this.spec.aimYaw - this.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.yaw += d * Math.min(1, dt * 6);
        this.pitch += (this.spec.aimPitch * 0.6 - this.pitch) * Math.min(1, dt * 6);
      }
      return;
    }
    if (!p.alive) return;
    const pressed = (c) => input.pressed(c);
    const down = (c) => input.down(c);

    if (p.state === 'bus') {
      if (pressed('Space')) g.actions.jumpBus();
      return;
    }

    // movement relative to camera yaw
    let fx = 0, fz = 0;
    const f = { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
    const r = { x: Math.cos(this.yaw), z: -Math.sin(this.yaw) };
    if (down('KeyW')) { fx += f.x; fz += f.z; }
    if (down('KeyS')) { fx -= f.x; fz -= f.z; }
    if (down('KeyD')) { fx += r.x; fz += r.z; }
    if (down('KeyA')) { fx -= r.x; fz -= r.z; }
    const an = input.analog;
    let stickSprint = false;
    if (an && (an.x || an.y)) {
      // touch joystick: analog speed, push to the rim to sprint
      fx += r.x * an.x - f.x * an.y;
      fz += r.z * an.x - f.z * an.y;
      stickSprint = Math.hypot(an.x, an.y) > 0.95;
    }
    const l = Math.hypot(fx, fz);
    const norm = l > 1 ? l : 1;
    inp.mx = l > 0 ? fx / norm : 0;
    inp.mz = l > 0 ? fz / norm : 0;
    inp.sprint = down('ShiftLeft') || down('ShiftRight') || stickSprint;
    inp.jump = pressed('Space');
    inp.glide = pressed('Space');
    inp.dive = down('KeyW') || (an && an.y < -0.6) ? 1 : 0;
    inp.slide = false;
    if (pressed('KeyC') || pressed('ControlLeft')) {
      if (p.sprinting && p.grounded) inp.slide = true;
      else this.crouchToggle = !this.crouchToggle;
    }
    if (p.sprinting) this.crouchToggle = false;
    inp.crouch = this.crouchToggle;
    if (l > 0 || inp.jump) p.emote = false;

    // facing: toward the camera when armed/aiming, else toward movement
    p.aimYaw = this.yaw;
    p.aimPitch = this.pitch;
    const armed = (p.item && p.item.kind !== 'consumable') || this.building || p.ads;
    if (p.state === 'skydive' || p.state === 'glide' || armed || p.state === 'swim') p.yaw = this.yaw;
    else if (l > 0) p.yaw = Math.atan2(-inp.mx, -inp.mz);

    const canAct = p.canAct();
    // slots, pickaxe, build toggle
    for (let i = 0; i < 5; i++) {
      if (!pressed('Digit' + (i + 1))) continue;
      if (this.building) this.piece = PIECES[Math.min(3, i)];
      else {
        this.exitEdit();
        g.actions.select(i);
      }
    }
    if (pressed('KeyF')) { this.building = false; this.exitEdit(); g.actions.select(-1); }
    if ((pressed('KeyB') || pressed('KeyQ')) && g.mode !== 'zerobuild') {
      if (this.editing) this.exitEdit();
      else this.building = !this.building;
      p.cancelActions();
      p.ads = false;
      if (this.building) sfx.play('ui');
    } else if ((pressed('KeyB') || pressed('KeyQ')) && g.mode === 'zerobuild') g.hud.toast('Zero Build mode: building is off. Your overshield regenerates instead.', '#39f0ff');
    if (input.mouse.wheel && !this.building) {
      const order = [-1, 0, 1, 2, 3, 4].filter((i) => i === -1 || p.slots[i]);
      const cur = order.indexOf(p.sel);
      g.actions.select(order[(cur + (input.mouse.wheel > 0 ? 1 : -1) + order.length) % order.length]);
    } else if (input.mouse.wheel && this.building) {
      this.piece = PIECES[(PIECES.indexOf(this.piece) + (input.mouse.wheel > 0 ? 1 : 3)) % 4];
    }
    p.building = this.building;
    if (pressed('KeyN') && canAct && p.grounded) {
      p.emote = !p.emote;
      this.building = false;
    }
    if (pressed('KeyM')) g.hud.toggleMap();

    // aim point from the camera through the crosshair
    const cam = g.camera.position;
    const cd = this.camDir().clone();
    const skip = cam.distanceTo(p.eye);
    const o = cam.clone().addScaledVector(cd, skip);
    const hit = g.combat.trace(o, cd, 500, p);
    this.aimPoint.copy(o).addScaledVector(cd, hit ? hit.t : 500);
    const shotDir = this.aimPoint.clone().sub(p.eye).normalize();

    // the build piece under the crosshair (edit / repair / upgrade target)
    const hc = hit && hit.world && hit.world.c;
    this.aimPiece = hc && hc.piece && hc.piece.alive && hit.t < 8 ? hc.piece : null;
    this.buildInfo = this.aimPiece && canAct && !this.editing ? g.building.repairInfo(p, this.aimPiece) : null;
    if (pressed('KeyV') && canAct) {
      if (this.editing) {
        if (!g.actions.edit(this.editing.piece, this.editing.tiles)) g.hud.toast('Keep at least one tile!', '#ff8a8a', 1.5);
        this.exitEdit();
      } else if (this.aimPiece && g.mode !== 'zerobuild') {
        const pc = this.aimPiece;
        if (pc.team !== p.team) g.hud.toast("You can only edit your team's builds.", '#ff8a8a', 1.5);
        else if (!g.building.editable(pc)) g.hud.toast('Only walls and floors can be edited (for now).', '#ffffff', 1.5);
        else this.startEdit(pc);
      }
    }
    if (pressed('KeyU') && canAct && this.aimPiece && !this.editing) {
      const msg = g.actions.repair(this.aimPiece);
      if (msg) g.hud.toast(msg, '#ffe9b0', 1.5);
    }
    if ((pressed('KeyZ') || pressed('Mouse1')) && p.alive) g.actions.ping(this.aimPoint);

    // ADS
    p.ads = !this.building && !!p.weapon && down('Mouse2') && canAct;

    if (this.editing) {
      const e = this.editing;
      const b = e.piece.box;
      const far = Math.hypot((b.minX + b.maxX) / 2 - p.pos.x, (b.minZ + b.maxZ) / 2 - p.pos.z) > 9;
      if (!e.piece.alive || far || !canAct) this.exitEdit();
      else {
        e.hover = -1;
        let bt = Infinity;
        e.boxes.forEach((bx, i) => {
          const t = rayBox(o, cd, bx);
          if (t !== null && t < bt) { bt = t; e.hover = i; }
        });
        if (pressed('Mouse0') && e.hover >= 0) e.paint = !e.tiles[e.hover];
        if (down('Mouse0') && e.hover >= 0 && e.paint !== undefined) e.tiles[e.hover] = e.paint;
        if (!down('Mouse0')) e.paint = undefined;
        if (pressed('KeyR')) e.tiles.fill(true);
        e.overlay.children.forEach((m, i) => {
          m.material.color.set(e.tiles[i] ? (i === e.hover ? '#ffe066' : '#4fc3ff') : i === e.hover ? '#ff9a9a' : '#ff4f4f');
          m.material.opacity = e.tiles[i] ? 0.3 : 0.12;
        });
      }
      g.building.hideGhost();
    } else if (this.building && canAct) {
      if (pressed('KeyR')) this.rot = (this.rot + 1) % 4;
      if (pressed('KeyT')) this.material = MATS[(MATS.indexOf(this.material) + 1) % 3];
      const s = g.building.spot(p, this.piece, this.yaw, this.pitch);
      if (this.piece === 'ramp') s.dir = (s.dir + this.rot) % 4;
      const ok = g.building.canPlace(p, s, this.material);
      g.building.showGhost(s, ok);
      this.placeCd -= dt;
      const place = pressed('Mouse0') || (down('Mouse0') && s.key !== this.lastKey && this.placeCd <= 0);
      if (place) {
        if (g.actions.build(s, this.material, { piece: this.piece, yaw: this.yaw, pitch: this.pitch, rot: this.rot })) {
          this.lastKey = s.key;
          this.placeCd = 0.08;
        } else if (pressed('Mouse0') && p.mats[this.material] < 10) {
          g.hud.toast(`Not enough ${this.material}! Harvest with the pickaxe (F).`, '#ff8a8a', 1.5);
          sfx.play('empty');
        }
      }
      if (!down('Mouse0')) this.lastKey = '';
    } else {
      g.building.hideGhost();
      if (canAct && !p.emote) {
        const it = p.item;
        if (!it) {
          if (down('Mouse0')) g.actions.swing(shotDir);
        } else if (it.kind === 'weapon') {
          const trig = p.weapon.auto ? down('Mouse0') : pressed('Mouse0');
          if (trig) {
            const rec = g.actions.fire(shotDir);
            if (rec) {
              this.pitch += rec * (p.ads ? 0.55 : 0.8);
              this.yaw += (Math.random() - 0.5) * rec * 0.4;
              this.shake = Math.min(0.5, this.shake + rec * 2);
            }
          }
          if (pressed('KeyR')) g.actions.reload();
        } else if (it.kind === 'throwable') {
          if (pressed('Mouse0')) g.actions.throwItem(shotDir);
        } else if (it.kind === 'consumable') {
          if (pressed('Mouse0')) {
            if (!g.actions.use()) g.hud.toast("You don't need that right now.", '#ffffff', 1.2);
          }
        }
      }
    }
    if (pressed('KeyG') && canAct && p.item) g.actions.drop();

    // interact
    this.prompt = null;
    let hold = false;
    const mate = canAct && g.actors.find((a) => a !== p && a.alive && a.downed && a.team === p.team && a.pos.distanceTo(p.pos) < 2.2);
    const van = canAct && p.cards.length ? g.teams.nearestVan(p.pos, 3.2) : null;
    if (mate) {
      this.prompt = { key: 'Hold E', text: `Revive ${mate.name}`, color: '#7ed957' };
      if (down('KeyE')) { p.reviveTarget = mate; hold = true; }
    } else if (van) {
      const n = p.cards.length;
      if (!g.teams.vansOnline()) this.prompt = { key: '—', text: 'Reboot vans are offline for the endgame', color: '#ff8a8a' };
      else if (van.cd > 0) this.prompt = { key: '—', text: `Reboot van recharging (${Math.ceil(van.cd)}s)`, color: '#ffe9b0' };
      else {
        this.prompt = { key: 'Hold E', text: `Reboot ${n} teammate${n > 1 ? 's' : ''}`, color: '#39f0ff' };
        if (down('KeyE')) { p.rebootVan = van; hold = true; }
      }
    } else if (canAct) {
      const ch = g.loot.nearestChest(p);
      const pk = g.loot.nearest(p, 2.4, (k) => k.it.kind !== 'ammo' && k.it.kind !== 'mat' && k.it.kind !== 'card');
      if (ch && (!pk || ch.pos.distanceTo(p.pos) < pk.pos.distanceTo(p.pos))) {
        this.prompt = { key: 'E', text: ch.supply ? 'Open Supply Drop' : 'Open Chest' };
        if (pressed('KeyE')) g.actions.openChest(ch);
      } else if (pk) {
        const it = pk.it;
        const full = !p.hasRoomFor(it);
        const rar = it.kind === 'weapon' ? RARITIES[it.rarity] : null;
        this.prompt = { key: 'E', text: `${full ? (p.sel >= 0 ? 'Swap for' : 'Inventory full —') : 'Pick up'} ${rar ? rar.name + ' ' : ''}${itemName(it)}${it.count > 1 ? ' x' + it.count : ''}`, color: rar ? rar.color : '#fff' };
        if (pressed('KeyE')) {
          const r2 = g.actions.take(pk);
          if (r2 === 'full') g.hud.toast('Inventory full: select a slot (1-5) to swap it out.', '#ff8a8a', 2);
        }
      }
    }
    p.reviveHold = hold;
    if (!hold) {
      p.reviveTarget = null;
      p.rebootVan = null;
    } else {
      inp.mx = inp.mz = 0; // stay put while reviving / rebooting
    }
    p.move(dt, inp);
  }

  updateCamera(dt) {
    const g = this.game;
    const cam = g.camera;
    const a = this.spectating && this.spec ? this.spec : this.player;
    if (!a) return;
    let pivot, dist, side = 0.65, fov = save.data.settings.fov;
    this.zoom = 1;
    if (a.state === 'bus' || (!a.alive && this.spectating && !this.spec)) {
      pivot = g.bus.visible ? g.bus.position.clone() : a.pos.clone().add(new THREE.Vector3(0, 2, 0));
      dist = 24;
      side = 0;
    } else if (a.state === 'skydive' || a.state === 'glide') {
      pivot = a.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
      dist = 7.5;
      side = 0;
    } else {
      pivot = a.pos.clone().add(new THREE.Vector3(0, (a.state === 'swim' ? 1.2 : a.height) - 0.15, 0));
      dist = 3.6;
      if (a === this.player && a.ads && a.weapon) {
        this.zoom = a.weapon.zoom;
        dist = a.weapon.scope ? 0.01 : 2.0;
        fov = fov / this.zoom;
        side = a.weapon.scope ? 0 : 0.7;
      }
      if (a.emote && a === this.player) { dist = 4.5; side = 0; }
    }
    if (a !== this.player && this.spectating) {
      // spectator mirrors the target's aim with the viewer's own orbit
      side = 0.4;
    }
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov += (fov - cam.fov) * Math.min(1, dt * 14 || 1);
      cam.updateProjectionMatrix();
    }
    const d = this.camDir().clone().negate();
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const base = pivot.clone().addScaledVector(right, side);
    // camera collision: pull in when something is between pivot and camera
    const h = g.world.physics.raycast(base.x, base.y, base.z, d.x, d.y, d.z, dist + 0.3);
    let want = dist;
    if (h) want = Math.max(0.3, h.t - 0.3);
    this.dist = want < this.dist ? want : this.dist + (want - this.dist) * Math.min(1, dt * 6 || 1);
    cam.position.copy(base).addScaledVector(d, this.dist);
    // never under the ground or water line
    const gy = g.world.height(cam.position.x, cam.position.z);
    if (cam.position.y < gy + 0.3) cam.position.y = gy + 0.3;
    this.shake = Math.max(0, this.shake - dt * 3);
    const sh = this.shake + g.effects.shake * 0.4;
    cam.lookAt(cam.position.clone().add(this.camDir()));
    if (sh > 0.001) {
      cam.rotation.x += (Math.random() - 0.5) * sh * 0.05;
      cam.rotation.y += (Math.random() - 0.5) * sh * 0.05;
    }
    // hide own model when scoped or camera is inside the head
    if (a === this.player) a.model.root.visible = a.alive && a.state !== 'bus' && this.dist > 0.8;
  }
}

function rayBox(o, d, b) {
  let t0 = 0, t1 = Infinity;
  for (const [oa, da, mn, mx] of [[o.x, d.x, b.minX, b.maxX], [o.y, d.y, b.minY, b.maxY], [o.z, d.z, b.minZ, b.maxZ]]) {
    if (Math.abs(da) < 1e-9) {
      if (oa < mn - 0.05 || oa > mx + 0.05) return null;
      continue;
    }
    let a = (mn - 0.05 - oa) / da, c = (mx + 0.05 - oa) / da;
    if (a > c) [a, c] = [c, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, c);
    if (t0 > t1) return null;
  }
  return t0;
}

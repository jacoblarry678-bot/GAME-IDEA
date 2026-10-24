/**
 * Local player controller: turns keyboard, mouse and controller input into
 * simulation requests. Sprint and crouch honour hold/toggle settings
 * (controller sprint is always a toggle). With "holds become single
 * presses", an interaction starts on one press and a second press cancels.
 * Touch: the stick and look drag add to movement and look; the Run and
 * Crouch buttons always toggle.
 */
import { PAD } from '../core/input.js';
import { CALLOUTS } from '../data/characters.js';

const TOOLS = ['flashlight', 'camera', 'radio', 'supply'];

export class Controller {
  constructor(app) {
    this.app = app;
    this.sprintLatch = false;
    this.crouchLatch = false;
    this.interactHeld = false;
    this.radial = null; // { kind, v: {x,y}, sel }
    this.inspect = false;
  }

  reset() { this.sprintLatch = false; this.crouchLatch = false; this.interactHeld = false; this.radial = null; this.inspect = false; }

  /** Gather inputs and send them to the game. `blocked` = a UI overlay owns input. */
  update(dt, game, pid, blocked) {
    const app = this.app, I = app.input, S = app.settings.data;
    const p = game.players.get(pid);
    if (!p) return;
    if (blocked || p.spectating && false) {
      game.setInput(pid, { mx: 0, mz: 0, sprint: false, lean: 0 });
      if (this.interactHeld) { game.endInteract(pid); this.interactHeld = false; }
      this.inspect = false;
      app.hud.showRadial(null);
      this.radial = null;
      return;
    }
    // ---- look
    const C = S.controls;
    let yaw = p.yaw, pitch = p.pitch;
    if (!this.radial) {
      const k = C.sensitivity * 0.0011;
      yaw -= I.mouseDX * k;
      pitch -= I.mouseDY * k * (C.invertY ? -1 : 1);
      yaw -= I.padAxes[2] * C.padLookX * dt;
      pitch -= I.padAxes[3] * C.padLookY * dt * (C.padInvertY ? -1 : 1);
      yaw -= I.touchLook.x;
      pitch -= I.touchLook.y * (C.invertY ? -1 : 1);
    }
    pitch = Math.max(-1.45, Math.min(1.45, pitch));
    // ---- move
    let mx = 0, mz = 0;
    if (I.isDown('forward')) mz += 1;
    if (I.isDown('back')) mz -= 1;
    if (I.isDown('left')) mx -= 1;
    if (I.isDown('right')) mx += 1;
    if (I.pad) {
      if (C.oneHand) yaw -= I.padAxes[0] * C.padLookX * dt; // one-hand layout: the left stick turns instead of strafing
      else mx += I.padAxes[0];
      mz -= I.padAxes[1];
    }
    mx += I.touchMove.x; mz += I.touchMove.y;
    // sprint
    if (C.sprintMode === 'toggle') { if (I.pressed('sprint')) this.sprintLatch = !this.sprintLatch; }
    else if (I.padPressed(PAD.L3) || I.touchPressed.has('sprint')) this.sprintLatch = !this.sprintLatch;
    const kbSprint = I.binding('sprint').some((c) => c && I.down.has(c));
    let sprint = C.sprintMode === 'toggle' ? this.sprintLatch : (kbSprint || this.sprintLatch);
    if (Math.hypot(mx, mz) < 0.2) this.sprintLatch = false;
    // crouch
    if (C.crouchMode === 'toggle') { if (I.pressed('crouch')) this.crouchLatch = !this.crouchLatch; }
    else if (I.touchPressed.has('crouch')) this.crouchLatch = !this.crouchLatch;
    const crouch = C.crouchMode === 'toggle' ? this.crouchLatch : (I.isDown('crouch') || this.crouchLatch);
    if (crouch) sprint = false;
    let lean = 0;
    if (I.isDown('leanLeft')) lean -= 1;
    if (I.isDown('leanRight')) lean += 1;
    game.setInput(pid, { mx, mz, yaw, pitch, sprint, crouch, lean });

    // ---- radials (tools on Q / LB, callouts on T / D-pad down)
    for (const [action, kind] of [['radial', 'tools'], ['callout', 'callouts']]) {
      if (I.pressed(action) && !this.radial) { this.radial = { kind, x: 0, y: 0, sel: -1 }; }
      if (this.radial && this.radial.kind === kind) {
        const n = kind === 'tools' ? 4 : CALLOUTS.length;
        this.radial.x += I.mouseDX + I.padAxes[2] * 40; this.radial.y += I.mouseDY + I.padAxes[3] * 40;
        const m = Math.hypot(this.radial.x, this.radial.y);
        if (m > 160) { this.radial.x *= 160 / m; this.radial.y *= 160 / m; }
        if (m > 30) {
          const a = Math.atan2(this.radial.y, this.radial.x) + Math.PI / 2;
          this.radial.sel = ((Math.round(a / (Math.PI * 2 / n)) % n) + n) % n;
        }
        app.hud.showRadial(kind, this.radial.sel);
        if (I.released(action)) {
          const sel = this.radial.sel;
          this.radial = null;
          app.hud.showRadial(null);
          if (sel >= 0) { if (kind === 'tools') game.equip(pid, TOOLS[sel]); else game.callout(pid, CALLOUTS[sel].id); }
        }
      }
    }
    if (this.radial) return;

    // ---- interact
    const A = S.accessibility;
    if (I.pressed('interact')) {
      if (A.holdToToggle && p.action) { game.cancelAction(pid); }
      else {
        const r = game.beginInteract(pid, null, { fast: sprint, toggle: A.holdToToggle });
        if (r) app.onInteractResult(r);
        else if (!game.findTarget(pid)) {
          // A also mantles at a marked obstacle; in cover it steadies breathing
          if ((I.padPressed(PAD.A) || I.touchPressed.has('interact')) && !game.mantle(pid) && p.crouched) game.breathe(pid);
        }
        this.interactHeld = true;
      }
    }
    if (I.released('interact') && this.interactHeld) {
      this.interactHeld = false;
      if (!A.holdToToggle) game.endInteract(pid);
    }
    if (I.pressed('mantle') && !(I.padPressed(PAD.A))) game.mantle(pid);
    // ---- tools
    this.inspect = I.isDown('inspect');
    if (I.pressed('use')) {
      const r = game.useTool(pid);
      if (p.tool === 'camera' && r && r.ok) app.fp.shutter();
    }
    if (I.pressed('reload')) game.reload(pid);
    if (I.pressed('flashlight')) game.toggleFlashlight(pid);
    if (I.pressed('cameraFlash')) game.toggleCameraFlash(pid);
    TOOLS.forEach((t, i) => { if (I.pressed(`tool${i + 1}`)) game.equip(pid, t); });
    if (I.pressed('toolNext') || I.pressed('toolPrev') || I.keyPressed('WheelDown') || I.keyPressed('WheelUp')) {
      const dir = I.pressed('toolPrev') || I.keyPressed('WheelUp') ? -1 : 1;
      const avail = TOOLS.filter((t) => (t !== 'flashlight' || p.hasFlashlight) && (t !== 'camera' || p.hasCamera) && (t !== 'supply' || p.pouch.some(Boolean)));
      const i = avail.indexOf(p.tool);
      game.equip(pid, avail[(i + dir + avail.length) % avail.length]);
    }
    if (I.pressed('breathe')) game.breathe(pid);
    if (I.pressed('hint')) app.requestHint();
    if (I.pressed('ping')) {
      const e = p.eye(), f = p.forward();
      const hit = game.level.world.raycast(e.x, e.y, e.z, f.x, f.y, f.z, 30, 'sight');
      const d = hit ? hit.t - 0.1 : 10;
      const pos = { x: e.x + f.x * d, y: e.y + f.y * d, z: e.z + f.z * d };
      const t = game.findTarget(pid);
      game.ping(pid, pos, t ? (game.describe(pid, t) || {}).name : 'Here');
    }
    if (I.pressed('inventory')) app.overlays.inventory();
    if (I.pressed('journal')) app.overlays.journal();
    if (I.pressed('chat') && app.coop) app.overlays.chat();
  }
}

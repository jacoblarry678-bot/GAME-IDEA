/**
 * The storm: a purple wall that waits, then shrinks toward a new safe circle
 * picked inside the current one. Damage per second rises each phase.
 */

import * as THREE from 'three';

export const PHASES = [
  { wait: 60, shrink: 40, r: 150, dmg: 1 },
  { wait: 45, shrink: 35, r: 95, dmg: 2 },
  { wait: 40, shrink: 30, r: 58, dmg: 4 },
  { wait: 35, shrink: 25, r: 30, dmg: 7 },
  { wait: 30, shrink: 20, r: 14, dmg: 9 },
  { wait: 25, shrink: 30, r: 0, dmg: 12 },
];
const START_R = 240;

const vert = /* glsl */ `
  varying vec2 vUv; varying vec3 vW;
  void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
`;
const frag = /* glsl */ `
  uniform float uTime; varying vec2 vUv; varying vec3 vW;
  void main(){
    float s = sin(vUv.x * 180.0 + uTime * 1.5 + vW.y * 0.15) * 0.5 + 0.5;
    float s2 = sin(vUv.x * 60.0 - uTime * 0.8 + vW.y * 0.05) * 0.5 + 0.5;
    vec3 col = mix(vec3(0.38,0.12,0.7), vec3(0.85,0.35,1.0), s * s2);
    float a = 0.26 + 0.16 * s;
    a *= smoothstep(0.0, 0.05, vUv.y) * (1.0 - smoothstep(0.85, 1.0, vUv.y));
    gl_FragColor = vec4(col, a);
  }
`;

export class Storm {
  constructor(game, rng) {
    this.game = game;
    this.phase = -1;
    this.stage = 'wait';
    this.timer = 0;
    this.center = new THREE.Vector2(0, 0);
    this.radius = START_R;
    this.from = { c: this.center.clone(), r: START_R };
    this.next = { c: new THREE.Vector2(), r: START_R };
    this.rng = rng;
    this.dmg = 1;
    const g = new THREE.CylinderGeometry(1, 1, 260, 96, 1, true);
    this.mat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms: { uTime: { value: 0 } }, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.position.y = 60;
    this.mesh.renderOrder = 3;
    game.scene.add(this.mesh);
    this._advance();
  }

  _advance() {
    this.phase++;
    const P = PHASES[this.phase];
    if (!P) {
      this.stage = 'done';
      return;
    }
    this.stage = 'wait';
    this.timer = P.wait;
    this.dmg = P.dmg;
    this.from = { c: this.center.clone(), r: this.radius };
    // new centre fully inside the current circle and on land
    let c = null;
    for (let i = 0; i < 40 && !c; i++) {
      const a = this.rng() * Math.PI * 2;
      const maxOff = Math.max(0, this.radius - P.r) * (this.phase === 0 ? 0.35 : 0.8);
      const d = Math.sqrt(this.rng()) * maxOff;
      const cand = new THREE.Vector2(this.center.x + Math.cos(a) * d, this.center.y + Math.sin(a) * d);
      if (this.game.world.isLand(cand.x, cand.y) || i === 39) c = cand;
    }
    this.next = { c, r: P.r };
    if (this.phase > 0) this.game.hud?.toast(`Storm phase ${this.phase + 1}: the safe zone has been marked`, '#c79bff');
  }

  get label() {
    if (this.stage === 'done') return 'Final storm';
    return this.stage === 'wait' ? 'Storm shrinks in' : 'Storm shrinking';
  }

  /** Is the point outside the current safe circle? */
  outside(x, z) {
    return Math.hypot(x - this.center.x, z - this.center.y) > this.radius;
  }

  update(dt, t) {
    this.mat.uniforms.uTime.value = t;
    if (this.stage === 'wait') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.stage = 'shrink';
        this.timer = PHASES[this.phase].shrink;
        this.game.hud?.toast('The storm is closing in!', '#c79bff');
        this.game.onStormShrink?.(this.phase);
      }
    } else if (this.stage === 'shrink') {
      this.timer -= dt;
      const P = PHASES[this.phase];
      const k = 1 - Math.max(0, this.timer) / P.shrink;
      this.center.lerpVectors(this.from.c, this.next.c, k);
      this.radius = this.from.r + (this.next.r - this.from.r) * k;
      if (this.timer <= 0) this._advance();
    }
    this.mesh.position.x = this.center.x;
    this.mesh.position.z = this.center.y;
    const r = Math.max(0.5, this.radius);
    this.mesh.scale.set(r, 1, r);
    // storm damage ticks once per second
    for (const a of this.game.actors) {
      if (!a.alive || a.state === 'bus') continue;
      if (this.outside(a.pos.x, a.pos.z)) {
        a.stormTick += dt;
        if (a.stormTick >= 1) {
          a.stormTick -= 1;
          this.game.applyDamage(a, this.dmg, null, { storm: true });
        }
      } else a.stormTick = 0;
    }
  }

  dispose() {
    this.game.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}

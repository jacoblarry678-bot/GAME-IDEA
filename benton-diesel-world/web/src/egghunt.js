// The Great Benton Egg Hunt: a new kind of Easter attraction, one you walk
// yourself. Twelve big decorated eggs are hidden around the backstage yard
// (by the gate, behind the generator, by the trailers, near the Easter Bar,
// out by the soundstages...). Walk up to one to collect it: it pops in a
// burst of pastel confetti and the count goes up. Find all twelve for a
// prize. The eggs bob and turn slowly so you can spot them from a way off.
import * as THREE from 'three';

// where the eggs are hidden (x, z), all in the open backstage yard
export const EGG_SPOTS = [
  [-56, -418], [-108, -452], [-226, -452], [-150, -441], [58, -432], [20, -495],
  [150, -480], [250, -520], [-200, -495], [300, -460], [-40, -462], [120, -590],
];
const COLORS = [[0xff9ac8, 0xf8e070], [0x7ad8a8, 0xb08aff], [0xf8e070, 0x8ad0ff], [0xb08aff, 0xff9ac8], [0x8ad0ff, 0x7ad8a8]];
const REWARD = 150;

export class EggHunt {
  constructor({ scene, fx, sim, hooks }) {
    this.fx = fx;
    this.sim = sim;
    this.hooks = hooks; // { toast, sound }
    this.found = 0;
    this.t = 0;
    this.told = false;
    this.group = new THREE.Group();
    this.group.name = 'egg hunt';
    scene.add(this.group);
    const shell = new THREE.SphereGeometry(0.7, 20, 14);
    shell.scale(1, 1.32, 1);
    const band = new THREE.CylinderGeometry(0.72, 0.72, 0.16, 20);
    this.eggs = EGG_SPOTS.map(([x, z], k) => {
      const [a, b] = COLORS[k % COLORS.length];
      const egg = new THREE.Group();
      egg.add(new THREE.Mesh(shell, new THREE.MeshStandardMaterial({ color: 0xfaf6f0, roughness: 0.45, emissive: a, emissiveIntensity: 0.12 })));
      for (const [y, c] of [[-0.3, a], [0, b], [0.3, a]]) {
        const m = new THREE.Mesh(band, new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, emissive: c, emissiveIntensity: 0.35 }));
        m.position.y = y;
        m.scale.setScalar(1 - Math.abs(y) * 0.5);
        egg.add(m);
      }
      egg.position.set(x, 1.2, z);
      this.group.add(egg);
      return { mesh: egg, x, z, got: false, phase: k * 0.7 };
    });
  }

  update(dt, pos, started) {
    this.t += dt;
    for (const e of this.eggs) {
      if (e.got) continue;
      e.mesh.position.y = 1.2 + Math.sin(this.t * 2 + e.phase) * 0.25;
      e.mesh.rotation.y += dt * 0.8;
    }
    if (!started) return;
    // the first time you're in the yard, say what's going on
    if (!this.told && pos.z < -410 && pos.z > -700 && pos.x > -250 && pos.x < 350) {
      this.told = true;
      this.hooks.toast(`The Great Benton Egg Hunt: ${EGG_SPOTS.length} eggs are hidden around the backstage yard. Walk up to one to collect it - find them all for a prize!`, 'info');
    }
    for (const e of this.eggs) {
      if (e.got || Math.hypot(pos.x - e.x, pos.z - e.z) > 2.6) continue;
      e.got = true;
      this.group.remove(e.mesh);
      this.found++;
      this.fx.confetti(new THREE.Vector3(e.x, 2, e.z), new THREE.Vector3(1.5, 1, 1.5), 160, [0xff9ac8, 0x7ad8a8, 0xf8e070, 0xb08aff, 0x8ad0ff]);
      this.hooks.sound?.('reward');
      if (this.found < this.eggs.length) this.hooks.toast(`You found an egg! ${this.found} of ${this.eggs.length}${this.found === this.eggs.length - 1 ? ' - just one more!' : ''}`, 'info');
      else this.sim.addBucks(REWARD, `You found all ${this.eggs.length} eggs! Happy Easter - here's your prize.`);
    }
  }
}

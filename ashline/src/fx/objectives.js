/**
 * World visuals for objectives: Domination flags (pole, cloth, capture ring)
 * and the active Hardpoint (glowing outline with corner beacons). Colours
 * follow the viewer's team palette (friendly / enemy / neutral / contested).
 */
import * as THREE from 'three';

const NEUTRAL = new THREE.Color(0xd8d8d0), CONTESTED = new THREE.Color(0xff3b30);

export class ObjectiveView {
  constructor(scene, match, playerTeam, colors) {
    this.scene = scene;
    this.match = match;
    this.playerTeam = playerTeam;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.setColors(colors);
    this.flags = [];
    for (const f of match.flags || []) {
      const g = new THREE.Group();
      g.position.set(f.x, 0, f.z);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 3.2, 8), new THREE.MeshStandardMaterial({ color: 0x9aa0a4, metalness: 0.8, roughness: 0.3 }));
      pole.position.y = 1.6; pole.castShadow = true;
      g.add(pole);
      const clothMat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.8, emissive: 0x000000 });
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7, 8, 2), clothMat);
      cloth.position.set(0.58, 2.75, 0);
      g.add(cloth);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
      const ring = new THREE.Mesh(new THREE.RingGeometry(f.r - 0.12, f.r, 48), ringMat);
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04;
      ring.userData.noAO = true;
      g.add(ring);
      const fillMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
      const fill = new THREE.Mesh(new THREE.CircleGeometry(f.r - 0.12, 48, 0, 0.01), fillMat);
      fill.rotation.x = -Math.PI / 2; fill.position.y = 0.035;
      fill.userData.noAO = true;
      g.add(fill);
      this.group.add(g);
      this.flags.push({ f, g, cloth, clothMat, ringMat, fill, fillMat, base: cloth.geometry.attributes.position.array.slice() });
    }
    this.zones = [];
    for (const z of match.zones || []) {
      const g = new THREE.Group();
      g.position.set(z.x, 0, z.z);
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, toneMapped: false, depthWrite: false });
      const t = 0.12, h = 0.06;
      for (const [x, zz, w, d] of [[0, -z.d / 2, z.w, t], [0, z.d / 2, z.w, t], [-z.w / 2, 0, t, z.d], [z.w / 2, 0, t, z.d]]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set(x, 0.04, zz);
        m.userData.noAO = true;
        g.add(m);
      }
      for (const [x, zz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6), mat);
        b.position.set((x * z.w) / 2, 1.1, (zz * z.d) / 2);
        b.userData.noAO = true;
        g.add(b);
      }
      g.visible = false;
      this.group.add(g);
      this.zones.push({ z, g, mat });
    }
    this.t = 0;
  }

  setColors([friendly, enemy]) {
    this.friendly = new THREE.Color(friendly);
    this.enemy = new THREE.Color(enemy);
  }

  teamColor(team) {
    if (team < 0) return NEUTRAL;
    return team === this.playerTeam ? this.friendly : this.enemy;
  }

  update(dt) {
    this.t += dt;
    for (const v of this.flags) {
      const f = v.f;
      const col = f.contested ? CONTESTED : this.teamColor(f.owner);
      v.clothMat.color.copy(col);
      v.clothMat.emissive.copy(col).multiplyScalar(0.25);
      v.ringMat.color.copy(f.capturing >= 0 && !f.contested ? this.teamColor(f.capturing) : col);
      v.ringMat.opacity = f.contested ? 0.5 + 0.4 * Math.abs(Math.sin(this.t * 6)) : 0.55;
      // capture progress pie
      const p = Math.abs(f.progress);
      const lead = f.progress > 0 ? 0 : 1;
      if (Math.abs(p - (v.lastP ?? -1)) > 0.005) {
        v.lastP = p;
        v.fill.geometry.dispose();
        v.fill.geometry = new THREE.CircleGeometry(f.r - 0.12, 48, 0, Math.max(0.01, p * Math.PI * 2));
      }
      v.fillMat.color.copy(this.teamColor(p > 0.01 ? lead : -1));
      // cloth wave
      const pos = v.cloth.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = v.base[i * 3];
        pos.setZ(i, Math.sin(this.t * 4 + x * 4) * 0.08 * (x + 0.55));
      }
      pos.needsUpdate = true;
    }
    const hp = this.match.hp;
    this.zones.forEach((v, i) => {
      v.g.visible = !!hp && i === hp.idx && this.match.state !== 'ended';
      if (!v.g.visible) return;
      const col = hp.contested ? CONTESTED : this.teamColor(hp.owner);
      v.mat.color.copy(col);
      v.mat.opacity = 0.55 + 0.3 * Math.abs(Math.sin(this.t * (hp.contested ? 6 : 2)));
    });
  }

  dispose() { this.scene.remove(this.group); }
}

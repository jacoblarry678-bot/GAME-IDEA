// "Guide me" navigation: a glowing trail of chevrons from the player toward
// a destination and a tall beacon on the spot.
import * as THREE from 'three';

export class Guide {
  constructor(scene) {
    this.scene = scene;
    this.target = null;
    this.name = '';
    const beamGeo = new THREE.CylinderGeometry(2.2, 2.2, 160, 16, 1, true);
    beamGeo.translate(0, 80, 0);
    this.beacon = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0x5ad2ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.ring = new THREE.Mesh(new THREE.RingGeometry(4, 5.2, 32), new THREE.MeshBasicMaterial({ color: 0x5ad2ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.ring.rotation.x = -Math.PI / 2;
    const shape = new THREE.Shape();
    shape.moveTo(0, 1.6); shape.lineTo(1.6, -0.4); shape.lineTo(0.8, -0.4); shape.lineTo(0, 0.6); shape.lineTo(-0.8, -0.4); shape.lineTo(-1.6, -0.4); shape.closePath();
    const chevGeo = new THREE.ShapeGeometry(shape);
    chevGeo.rotateX(-Math.PI / 2);
    chevGeo.rotateY(Math.PI);
    this.chevrons = new THREE.InstancedMesh(chevGeo, new THREE.MeshBasicMaterial({ color: 0x7fe0ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), 24);
    this.chevrons.frustumCulled = false;
    this.group = new THREE.Group();
    this.group.add(this.beacon, this.ring, this.chevrons);
    this.group.visible = false;
    scene.add(this.group);
    this.m = new THREE.Matrix4();
  }

  set(pos, name) {
    this.target = new THREE.Vector3(pos[0] ?? pos.x, 0, pos[2] ?? pos.z);
    this.name = name;
    this.group.visible = true;
    this.beacon.position.copy(this.target);
    this.ring.position.set(this.target.x, 0.6, this.target.z);
  }

  clear() {
    this.target = null;
    this.group.visible = false;
  }

  // returns distance, or -1 when there is no target; calls onArrive
  update(playerPos, time, onArrive) {
    if (!this.target) return -1;
    const dx = this.target.x - playerPos.x, dz = this.target.z - playerPos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 16) {
      const name = this.name;
      this.clear();
      onArrive?.(name);
      return -1;
    }
    const yaw = Math.atan2(dx, dz);
    const span = Math.min(dist - 6, 90);
    const n = this.chevrons.count;
    const offset = (time * 6) % 4;
    let shown = 0;
    for (let i = 0; i < n; i++) {
      const d = 5 + i * 4 + offset;
      if (d > span) break;
      const x = playerPos.x + dx / dist * d, z = playerPos.z + dz / dist * d;
      this.m.makeRotationY(yaw);
      this.m.setPosition(x, playerPos.y + 0.45, z);
      this.chevrons.setMatrixAt(i, this.m);
      shown++;
    }
    this.chevrons.count = n;
    for (let i = shown; i < n; i++) {
      this.m.makeScale(0, 0, 0);
      this.chevrons.setMatrixAt(i, this.m);
    }
    this.chevrons.instanceMatrix.needsUpdate = true;
    this.ring.scale.setScalar(1 + 0.15 * Math.sin(time * 4));
    return dist;
  }
}

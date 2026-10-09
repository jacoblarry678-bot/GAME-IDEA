// Small rendered pictures of shop items for the venue windows.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildModel } from './geom.js';

export class Thumbs {
  constructor(data) {
    this.data = data;
    this.cache = new Map();
    this.renderer = null;
  }

  setup() {
    const size = 160;
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch (e) {
      this.renderer = false;
      return;
    }
    this.renderer.setSize(size, size, false);
    this.renderer.setPixelRatio(1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene = new THREE.Scene();
    // a soft studio light for reflections on metal and plastic
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8090a0, 0.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(3, 5, 4);
    this.scene.add(sun);
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  }

  get(id) {
    if (this.cache.has(id)) return this.cache.get(id);
    if (this.renderer === null) this.setup();
    if (!this.renderer) return '';
    const item = this.data.items.find((i) => i.id === id);
    if (!item || !item.preview?.length) return '';
    const model = buildModel(item.preview, this.data.materials, { detail: true });
    model.rotation.y = -0.6;
    this.scene.add(model);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const radius = box.getSize(new THREE.Vector3()).length() / 2 || 1;
    const dist = radius / Math.sin((this.camera.fov * Math.PI) / 360) * 1.05;
    this.camera.position.set(center.x + dist * 0.35, center.y + dist * 0.3, center.z + dist * 0.89);
    this.camera.lookAt(center);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL('image/png');
    this.scene.remove(model);
    model.traverse((o) => o.geometry?.dispose());
    this.cache.set(id, url);
    return url;
  }
}

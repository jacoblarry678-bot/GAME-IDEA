/**
 * HELLRAISER: THE GAME — client entry point.
 */

import './ui/styles.css';
import * as THREE from 'three';
import { Engine } from './core/engine.js';
import { Input } from './core/input.js';
import { settings } from './core/settings.js';
import { TextureLibrary } from './core/textures.js';
import { Labyrinth } from './world/labyrinth.js';
import { Character, Animator } from './entities/character.js';
import { CharacterController } from './entities/controller.js';
import { buildMap, FLOOR_Y } from '../../shared/mapdata.js';
import { SURVIVORS, CENOBITES } from '../../shared/characters.js';

const canvas = document.getElementById('scene');
const boot = document.getElementById('boot');

const TEX_SIZE = { low: 256, medium: 512, high: 1024 };

async function main() {
  const quality = settings.get('graphics.preset', 'high');
  const engine = new Engine(canvas, quality);
  window.__engine = engine;
  window.__THREE = THREE;

  const textures = new TextureLibrary(
    TEX_SIZE[settings.get('graphics.textureQuality', 'high')] || 512,
    engine.quality.anisotropy
  );

  boot.querySelector('.boot-sub').textContent = 'carving the labyrinth…';
  await frame();

  const map = buildMap('PREVIEW');
  const world = new Labyrinth(engine, textures, map);
  window.__world = world;

  boot.querySelector('.boot-sub').textContent = 'summoning…';
  await frame();

  // local free-roam character so the world is walkable before the netcode lands
  const def = SURVIVORS[0];
  const character = new Character({ build: def.build, role: 'survivor', name: def.name, quality: engine.quality });
  engine.scene.add(character.group);
  const animator = new Animator(character);
  character.attachFlashlight();
  character.setFlashlight(true, 45);

  // preview spawns in the Chain Hall — the map's signature space
  const spawn = { x: 2, z: -50, floor: 0 };
  const controller = new CharacterController(map, character, {});
  controller.spawn(spawn.x, FLOOR_Y[spawn.floor], spawn.z, spawn.floor, 0);

  const input = new Input(canvas);
  input.enabled = true;
  window.__game = { engine, world, controller, character, animator, input, map };

  const doorStates = new Map();
  for (const d of map.doors) doorStates.set(d.id, { open: false, locked: !!d.locked });

  engine.add((dt) => {
    input.sprintHeldSync?.();
    controller.sprintHeld = input.down('sprint');
    if (input.pressed('crouch')) controller.crouching = !controller.crouching;
    if (input.pressed('interact')) {
      const dir = new THREE.Vector3(-Math.sin(controller.yaw), 0, -Math.cos(controller.yaw));
      const it = world.findInteractable(controller.pos, controller.floor, dir);
      if (it && it.kind === 'container') world.setContainerSearched(it.id);
      // open the nearest door
      for (const d of map.doors) {
        if (d.f !== controller.floor) continue;
        if (Math.hypot(d.x - controller.pos.x, d.z - controller.pos.z) < 3) {
          const st = doorStates.get(d.id);
          st.open = !st.open;
          world.setDoor(d.id, st.open);
        }
      }
    }
    controller.update(dt, input.move(), input.look(), { doors: doorStates });
    controller.updateCamera(engine.camera, dt);
    animator.update(dt, {
      state: controller.animState,
      speedFrac: controller.speedFrac,
      crouch: controller.crouching,
      injured: 0,
      lookPitch: controller.pitch,
      fear: 0,
    });
    world.update(dt, controller.pos, controller.floor);
    input.endFrame();
  });

  engine.start();
  boot.classList.add('gone');
  setTimeout(() => boot.remove(), 900);
  console.log('[hellraiser] world ready', engine.info);
  document.dispatchEvent(new CustomEvent('hellraiser:ready'));
}

const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

main().catch((err) => {
  console.error(err);
  boot.innerHTML = `<div class="boot-mark">ERROR</div><div class="boot-sub">${err.message}</div>`;
});

// Benton Diesel World - browser edition. Loads the park exported from the
// Roblox build (park.json) and runs the whole day at the park: rides with
// live queues, shows, shops, restaurants and the Benton Park App.
import * as THREE from 'three';
import * as Clock from './clock.js';
import { World } from './world.js';
import { geomOptions } from './geom.js';
import { Input } from './input.js';
import { Collision, Player } from './player.js';
import { RideVisuals } from './rides.js';
import { Sim } from './sim.js';
import { Effects } from './fx.js';
import { GuestFactory, Crowd } from './guests.js';
import { QueueCrowd } from './queue.js';
import { CrowdRenderer } from './people/crowd.js';
import { GameAudio } from './audio/director.js';
import { ShowRunner } from './shows.js';
import { Guide } from './guide.js';
import { Thumbs } from './thumbs.js';
import { UI } from './ui.js';
import { configureMaterials } from './render/materials.js';
import { Post } from './render/post.js';
import { waterTime } from './render/water.js';

const QUALITY_KEY = 'bentonDieselWorld.quality';
const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// graphics presets: shadows, post-processing (bloom, ambient occlusion),
// resolution and texture detail
const PRESETS = {
  low: { name: 'low', shadows: false, shadowSize: 1024, shadowRange: 90, post: false, ao: false, samples: 0, pixelRatio: 1.25, crowd: 30, grass: 0 },
  high: { name: 'high', shadows: true, shadowSize: 2048, shadowRange: 110, post: true, ao: false, samples: 4, pixelRatio: 1.5, crowd: 54, grass: 60000 },
  ultra: { name: 'ultra', shadows: true, shadowSize: 4096, shadowRange: 140, post: true, ao: true, samples: 4, pixelRatio: 2, crowd: 72, grass: 120000 },
};

function loadQuality() {
  try {
    const q = localStorage.getItem(QUALITY_KEY);
    if (PRESETS[q]) return q;
  } catch (e) { /* ignore */ }
  return touch ? 'low' : 'high';
}

function setLoading(text) {
  const el = document.querySelector('#loading .msg');
  if (el) el.textContent = text;
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

async function main() {
  setLoading('Loading the park...');
  const res = await fetch('park.json');
  if (!res.ok) throw new Error(`park.json: ${res.status}`);
  const data = await res.json();
  const cfg = data.config;
  setLoading('Building Benton Diesel World...');
  // sign text is drawn into textures, so wait (briefly) for the sign font
  try {
    await Promise.race([
      Promise.all([700, 800].map((w) => document.fonts.load(`${w} 40px "Barlow Semi Condensed"`))),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch (e) { /* fall back to Arial Narrow */ }
  await nextFrame();

  Clock.configure(cfg.Clock);
  Clock.start(540);

  const canvas = document.getElementById('view');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(65, 1, 0.3, 3200);

  let qualityName = loadQuality();
  configureMaterials({ size: qualityName === 'low' ? 256 : 512, aniso: Math.min(8, renderer.capabilities.getMaxAnisotropy()) });
  geomOptions.bevel = qualityName !== 'low';
  geomOptions.maxLod = qualityName === 'low' ? 1 : 2;
  const world = new World(scene, data, PRESETS[qualityName], renderer);
  const post = new Post(renderer, scene, camera);
  const collision = new Collision(data.static, world.terrain);
  const guests = new GuestFactory();
  const rideVis = new RideVisuals(scene, data, (seed, pose) => guests.make(seed, pose));
  rideVis.frame = 0;
  const fx = new Effects(scene, data);
  const audio = new GameAudio(data);
  // explosions and fireworks are heard as well as seen
  const explode = fx.explosion.bind(fx);
  fx.explosion = (at, scale) => { explode(at, scale); audio.explosion(at, scale); };
  const burst = fx.firework.bind(fx);
  fx.firework = (at, color, size) => { burst(at, color, size); audio.firework(at, size); };
  const shows = new ShowRunner({ scene, materials: data.materials, guests, fx, tags: data.tags, audio });
  const guide = new Guide(scene);
  const thumbs = new Thumbs(data);
  const input = new Input(canvas, document.getElementById('hud'));
  input.enabled = false;

  const rideCfg = new Map(cfg.Rides.map((r) => [r.id, r]));
  const signRides = cfg.Rides.map((r) => {
    const land = cfg.Lands.find((l) => l.id === r.land);
    return { ...r, landInfo: { name: land.name, colorCss: `#${land.color.toString(16).padStart(6, '0')}` } };
  });

  const game = { data, input, guide, thumbs, qualityName, audio };
  const sim = new Sim(data, {
    toast: (text, kind, amount) => game.ui?.toast(text, kind, amount),
    sound: (kind) => audio.ui(kind),
    startRide: (id, car, seat) => {
      player.riding = { id, car, seat, matrix: rideVis.seatMatrix(id, car, seat) || new THREE.Matrix4() };
      const name = rideCfg.get(id).name;
      const lines = [
        `Welcome aboard ${name}! Please keep your hands, arms, feet and legs inside the vehicle, and enjoy the ride!`,
        `Please remain seated with your restraint secured. ${name} is ready to roll!`,
        `Hold on tight! ${name} is now departing the station.`,
      ];
      audio.voice.say(lines[Math.floor(Math.random() * lines.length)], { interrupt: true });
    },
    endRide: (id) => {
      const r = rideCfg.get(id);
      // step off a few studs past the exit sign, facing away from the ride
      let dx = r.exit[0] - r.origin[0], dz = r.exit[2] - r.origin[2];
      const len = Math.hypot(dx, dz) || 1;
      dx /= len; dz /= len;
      player.stopRiding({ pos: new THREE.Vector3(r.exit[0] + dx * 6, 3, r.exit[2] + dz * 6), yaw: Math.atan2(-dx, -dz) });
      player.snapCamera();
    },
    onProfile: () => {
      if (!game.ui) return;
      if (game.ui.tab === 'Bag' || game.ui.tab === 'Passport') game.ui.refresh();
      else if (game.ui.venueOpen && game.ui.venueOpen !== 'settings') game.ui.renderVenueModal();
    },
  });
  game.sim = sim;
  const player = new Player(scene, data, collision, sim.profile.look);
  game.player = player;
  const people = new CrowdRenderer(scene, { shadows: PRESETS[qualityName].shadows });
  const queueCrowd = new QueueCrowd(people, data, sim.paths);
  let queueSnap = true; // place guests already in line without walking them in
  let crowd = new Crowd(people, PRESETS[qualityName].crowd);

  game.applyWear = () => {
    const eq = sim.profile.equipped;
    player.setWear('hat', eq.hat, data.items);
    player.setWear('face', eq.face, data.items);
    player.setWear('held', eq.held, data.items);
    player.setBalloon(eq.balloon, data.items);
  };
  game.applyLook = () => {
    player.setLook(sim.profile.look);
    game.applyWear();
  };
  game.teleportHome = () => {
    if (player.riding) return;
    player.pos.set(cfg.Spawn[0], 3, cfg.Spawn[2]);
    player.vel.set(0, 0, 0);
    player.yaw = 0;
    player.camYaw = 0;
    player.snapCamera();
  };
  game.resetProgress = () => {
    try { localStorage.removeItem('bentonDieselWorld.v1'); } catch (e) { /* ignore */ }
    location.reload();
  };
  game.clockNow = Clock.now;
  game.skipTo = (show) => {
    const s = sim.showStatus(show);
    if (s.now || sim.ridingRide) return;
    Clock.skip(Math.max(0, s.seconds - 3));
    game.ui.toast(`Time flies! ${show.name} starts in a few minutes.`, 'show');
  };

  const applyQuality = () => {
    const preset = PRESETS[qualityName];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.pixelRatio));
    renderer.shadowMap.enabled = preset.shadows;
    world.sky.setShadowQuality(preset);
    world.setQuality(preset);
    scene.traverse((o) => {
      if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true;
    });
    resize();
    post.configure(preset);
    resize();
  };
  game.setQuality = (q) => {
    qualityName = q;
    game.qualityName = q;
    try { localStorage.setItem(QUALITY_KEY, q); } catch (e) { /* ignore */ }
    crowd = new Crowd(people, PRESETS[q].crowd);
    people.setShadows(PRESETS[q].shadows);
    applyQuality();
  };

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 75 : 65;
    camera.updateProjectionMatrix();
    fx.setViewport(h * renderer.getPixelRatio(), camera.fov);
    post.setSize(w, h);
  }
  window.addEventListener('resize', resize);
  applyQuality();

  const ui = new UI(game);
  game.ui = ui;
  game.rideVis = rideVis;
  game.world = world;
  window.bentonDieselWorld = game; // handy for debugging from the console
  game.applyWear();

  // ---------------------------------------------------------------- loop
  let started = false;
  let wasOnGround = true;
  let fallSpeed = 0;
  let last = performance.now();
  let signTimer = 0;
  let time = 0;
  const firedCues = new Set();
  const tmp = new THREE.Vector3();
  const camPos = new THREE.Vector3();

  function frame() {
    const nowMs = performance.now();
    const dt = Math.min(0.05, (nowMs - last) / 1000);
    last = nowMs;
    time += dt;
    const now = Clock.now();

    if (started) {
      sim.update(player.pos);
      const mv = sim.movement();
      player.speed = mv.speed;
      player.jumpBoost = mv.jump;
      ui.handleKeys(input);
    }

    // rides
    rideVis.frame++;
    camPos.copy(camera.position);
    for (const st of sim.order) {
      const r = st.cfg;
      const t = sim.rideTime(st.id, now);
      const busy = st.status === 'Boarding' || st.status === 'Running' || st.status === 'Unloading';
      rideVis.setRiders(st.id, busy ? st.riders : []);
      const mine = sim.ridingRide === st.id;
      const far = !mine && Math.hypot(r.origin[0] - camPos.x, r.origin[2] - camPos.z) > 500;
      const pose = rideVis.pose(st.id, t, far);
      if (r.cues && t > 0 && pose) {
        r.cues.forEach((cue, i) => {
          const at = cue[0] * st.duration;
          const key = `${st.id}:${st.cycleId}:${i}`;
          if (t >= at && t < at + 1 && !firedCues.has(key)) {
            firedCues.add(key);
            tmp.set(cue[2][0], cue[2][1], cue[2][2]).applyMatrix4(pose.cars[0]);
            fx.tramCue(cue[1], tmp);
          }
        });
      }
    }
    if (player.riding) {
      const m = rideVis.seatMatrix(player.riding.id, player.riding.car, player.riding.seat);
      if (m) player.riding.matrix = m;
    }

    people.begin(camera.position);
    queueCrowd.update(dt, time, sim.order, camera.position, queueSnap);
    queueSnap = false;

    if (started) {
      // in a queue line: shuffle forward with the line when not steering
      const slot = player.riding ? null : sim.playerSlot();
      player.autopilot = slot ? sim.lineTarget(player.pos) : null;
      player.faceDir = slot ? slot.path.pointAt(slot.s) : null;
      player.update(dt, input, camera);
    } else {
      // attract mode: slow orbit over the park
      const a = time * 0.05;
      camera.position.set(Math.sin(a) * 330, 170, -40 + Math.cos(a) * 330);
      camera.lookAt(0, 20, -40);
      player.holder.position.copy(player.pos);
    }

    world.spinGlobe(time);
    world.spinSpinners(time, camera.position);
    const lamp = world.spinners.find((sp) => sp.name === 'LighthouseLamp');
    if (lamp) fx.lighthouseAngle = lamp.angle;
    waterTime.value = time;
    world.updateGrass(time, camera.position);
    const daylight = world.updateLighting(started ? player.pos : new THREE.Vector3(0, 0, -40), time);
    signTimer -= dt;
    if (signTimer <= 0) {
      signTimer = 1;
      world.updateSigns(signRides, (id) => sim.rideState(id));
    }
    crowd.update(dt, time);
    people.end();
    const caption = shows.update(sim.shows, now, player.pos);
    fx.update(dt, daylight);
    if (started) {
      camera.updateMatrixWorld();
      const flat = Math.hypot(player.vel.x, player.vel.z);
      if (!player.riding && player.onGround && !wasOnGround && fallSpeed < -40) audio.ui('land');
      if (!player.riding && !player.onGround && wasOnGround && player.vel.y > 20) audio.ui('jump');
      fallSpeed = player.vel.y;
      wasOnGround = player.onGround;
      const land = ui.landAt(player.pos);
      audio.update({
        dt, camera, now, daylight, caption, sim,
        land: land ? land.id : (audio.land || 'Plaza'),
        crowd: Clock.crowd(Clock.minutes()),
        inPark: true,
        riding: sim.ridingRide,
        showPos: shows.audioPos,
        walking: !player.riding && player.onGround && flat > 3,
        stepRate: player.figure.stepRate,
      });
    }
    const guideDist = guide.update(player.pos, time, (name) => ui.toast(`You've arrived at ${name}!`, 'info'));

    if (started) ui.update(dt, { pos: player.pos, caption, guideDist, movement: sim.movement() });
    input.endFrame();
    post.render(1 - daylight);
    requestAnimationFrame(frame);
  }

  document.getElementById('loading').hidden = true;
  requestAnimationFrame(frame);
  ui.showStart(() => {
    started = true;
    input.enabled = true;
    // sound has to start from this click
    audio.start(rideVis);
    setTimeout(() => audio.voice.say('Welcome to Benton Diesel World, where speed fuels people together!'), 900);
    player.snapCamera();
    document.getElementById('hud').hidden = false;
    document.body.classList.toggle('touch', touch);
    sim.dailyBonus();
    const land = ui.landAt(player.pos);
    if (land) {
      ui.currentLand = land.id;
      ui.banner(cfg.ParkName, 'Speed fuels people together', land.color);
    }
    setTimeout(() => ui.toast('Welcome to Benton Diesel World! Open Wait Times to plan your day.', 'info'), 600);
  });
}

main().catch((err) => {
  console.error(err);
  setLoading(`Sorry - the park failed to load (${err.message}). Try reloading the page.`);
});

/**
 * Representative screenshots: node tools/shot.mjs [outDir]
 * Uses higher graphics than the tests (slow on the CPU renderer, but only a few frames).
 */
import { launch } from './harness.mjs';
const out = process.argv[2] || 'shots';
const { browser, page, logs, sun } = await launch(undefined, { lowGfx: false, query: '' });
await page.evaluate(() => { const s = window.__sun.settings; s.applyPreset('high'); s.set('graphics', 'renderScale', 0.75); });
await sun.advance(2, 0);
await sun.shot(`${out}/01-title.png`);
await page.click('text=New Game');
await sun.advance(0.5, 0);
const g = (fn, a) => sun.eval(fn, a);
await g(() => { const G = window.__sun.game; G.cameraRig.yaw = Math.PI / 2 + 0.5; G.cameraRig.pitch = -0.1; });
await sun.advance(3, 60);
await sun.shot(`${out}/02-spawn.png`);
// put the player in the muscle car on Ocean Blvd
await g(() => {
  const G = window.__sun.game, v = G.vehicles.find((x) => x.persistentId === 'start-muscle');
  v.pos.set(146, 0, 30); v.yaw = Math.PI; v.vel.set(0, -18);
  G.seatCharacter(v, 0, G.player);
  G.cameraRig.yaw = Math.PI; G.cameraRig.pitch = -0.18;
});
await sun.setInput({ steer: { throttle: 0.6, brake: 0, steer: 0 } });
await sun.advance(3, 30);
await sun.shot(`${out}/03-drive-ocean-blvd.png`);
await sun.clearInput();
// store interior
await g(() => {
  const G = window.__sun.game, s = G.store.place;
  G.respawnPlayer(s.door.x, s.door.z + 3, Math.PI * 0.85);
  G.cameraRig.yaw = Math.PI * 0.75; G.cameraRig.pitch = -0.05;
  G.player.controller.inventory.current = 'pistol';
});
await sun.advance(1.5, 30);
await sun.shot(`${out}/04-store.png`);
// sunset over the beach and night neon
await g(() => { const G = window.__sun.game; G.respawnPlayer(178, -10, Math.PI * 1.5); G.cameraRig.yaw = Math.PI * 1.25; G.cameraRig.pitch = 0.05; G.engine.time.hour = 18.6; });
await sun.advance(1.5, 30);
await sun.shot(`${out}/05-sunset-promenade.png`);
await g(() => { const G = window.__sun.game; G.respawnPlayer(146, 40, Math.PI); G.cameraRig.yaw = Math.PI * 0.9; G.cameraRig.pitch = 0.08; G.engine.time.hour = 21.5; });
await sun.advance(1.5, 30);
await sun.shot(`${out}/06-night-neon.png`);
// Milestone 3: Cal and Sol together, the twin-span, Cayo Lento, a drive-by from the passenger seat
await g(() => {
  const G = window.__sun.game; G.engine.time.hour = 16.8;
  G.respawnPlayer(-2, -24, Math.PI / 2); G.crew.regroupAt(-2, -24, Math.PI / 2, true);
  G.cameraRig.yaw = -Math.PI / 2 + 0.3; G.cameraRig.pitch = -0.12;
});
await sun.advance(2, 30);
await sun.shot(`${out}/07-cal-and-sol.png`);
await g(() => {
  const G = window.__sun.game, v = G.vehicles.find((x) => x.persistentId === 'start-sedan');
  G.respawnPlayer(0, -20, 0);
  v.pos.set(145.75, 7.5, 420); v.yaw = 0; v.vel.set(0, 18);
  G.seatCharacter(v, 1, G.player); G.seatCharacter(v, 0, G.partner);
  G.cameraRig.yaw = 0.35; G.cameraRig.pitch = -0.16;
});
await sun.advance(2, 30);
await sun.shot(`${out}/08-twin-span.png`);
await g(() => {
  const G = window.__sun.game, V = G.engine.camera.position.constructor;
  G.cameraRig.override = { pos: new V(205, 26, 580), target: new V(170, 2, 660) };
});
await sun.advance(0.6, 30);
await sun.shot(`${out}/09-cayo-lento.png`);
await g(() => {
  const G = window.__sun.game; G.cameraRig.override = null;
  G.player.controller.inventory.current = 'pistol';
  window.__sun.input.virtual.actions.add('aim');
  G.cameraRig.yaw = G.player.vehicle.yaw - Math.PI / 2; G.cameraRig.pitch = -0.05;
});
await sun.advance(1, 30);
await sun.shot(`${out}/10-passenger-aim.png`);
await sun.clearInput();
// the living city: Bayshore Park, Sunshine Gas, Coral Auto Body, Velvet Palms at night
const place = async (file, hour, fn) => {
  await g(([h, src]) => {
    const G = window.__sun.game, P = G.places.PLACES, V = G.engine.camera.position.constructor;
    G.engine.time.hour = h;
    const [pos, target, stand] = new Function('P', 'return ' + src)(P);
    G.respawnPlayer(stand[0], stand[1], stand[2] || 0);
    G.cameraRig.override = { pos: new V(...pos), target: new V(...target) };
  }, [hour, fn.toString().replace(/^\(P\) => /, '')]);
  await sun.advance(1.5, 30);
  await sun.shot(`${out}/${file}`);
};
await g(() => { const G = window.__sun.game; if (G.player.vehicle) G.unseatCharacter(G.player.vehicle, G.player, null); });
await place('12-bayshore-park.png', 16.5, (P) => [[P.park.bounds.x1 + 6, 14, P.park.bounds.z0 - 6], [P.park.x - 4, 0, P.park.z + 6], [P.park.x + 2, P.park.z - 4]]);
await place('13-sunshine-gas.png', 17.2, (P) => [[P.gas.door.x + 34, 6, P.gas.door.z + 16], [P.gas.door.x + 4, 2, P.gas.door.z], [P.gas.door.x + 3, P.gas.door.z]]);
await place('14-coral-auto-body.png', 15.5, (P) => [[P.autoshop.door.x + 16, 5, P.autoshop.door.z - 10], [P.autoshop.door.x - 6, 2.5, P.autoshop.door.z + 1], [P.autoshop.door.x + 3, P.autoshop.door.z + 7]]);
await place('15-velvet-palms-night.png', 22.3, (P) => [[P.club.layout.door.x - 15, 2.2, P.club.layout.door.z - 9], [P.club.layout.door.x, 3.5, P.club.layout.door.z + 1], [P.club.layout.door.x - 4, P.club.layout.door.z + 5, -Math.PI / 2]]);
// inside Velvet Palms, from just inside the door
await g(() => {
  const G = window.__sun.game, L = G.club.L, V = G.engine.camera.position.constructor;
  G.engine.time.hour = 22.5; G.club.admit();
  G.respawnPlayer(L.runway.x0 - 3, L.door.z + 3, Math.PI / 2);
  G.cameraRig.override = { pos: new V(L.inner.x0 + 0.8, 2.6, L.door.z - 3.5), target: new V(L.stage.x1, 1.6, L.door.z + 1) };
});
await sun.advance(2, 30);
await sun.shot(`${out}/16-velvet-palms-inside.png`);
await g(() => { window.__sun.game.cameraRig.override = null; });
await g(() => { window.__sun.app.settings.set('gameplay', 'weather', 'rain'); window.__sun.app.weather.set('rain', true); const G = window.__sun.game; G.respawnPlayer(92, -100, Math.PI); G.cameraRig.yaw = Math.PI; G.cameraRig.pitch = -0.05; G.engine.time.hour = 17.5; });
await sun.advance(2, 30);
await sun.shot(`${out}/11-rain.png`);
await g(() => { window.__sun.app.settings.set('gameplay', 'weather', 'dynamic'); });
console.log(logs.slice(0, 30).join('\n'));
await browser.close();

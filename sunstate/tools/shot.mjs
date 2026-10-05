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
console.log(logs.slice(0, 30).join('\n'));
await browser.close();

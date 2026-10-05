import { launch } from './harness.mjs';
const { browser, logs, sun } = await launch(undefined, { query: '?autostart' });
const st = () => sun.eval(() => { const g = window.__sun.game, p = g.player, v = p.vehicle; return { p: [p.pos.x, p.pos.y, p.pos.z].map((n) => +n.toFixed(2)), inV: !!v, vp: v ? [v.pos.x, v.pos.y, v.pos.z].map((n) => +n.toFixed(2)) : null, hp: v ? Math.round(v.health) : null, speed: v ? +v.speed.toFixed(2) : 0, yaw: v ? +v.yaw.toFixed(2) : +p.yaw.toFixed(2), prompt: p.controller.prompt, nveh: g.vehicles.length, peds: g.peds.length, cops: g.cops.length, traffic: g.traffic.cars.size, fps: window.__sun.engine.fps.toFixed(1) }; });
await sun.advance(0.5, 30);
console.log('spawn', JSON.stringify(await st()));
await sun.shot('shots/d0.png');
// walk east toward the cars
await sun.eval(() => { const c = window.__sun.game.cameraRig; c.yaw = Math.PI / 2; });
await sun.setInput({ move: { x: 0, y: 1 } });
await sun.advance(1.0, 30);
await sun.clearInput();
console.log('walked', JSON.stringify(await st()));
await sun.setInput({ press: ['enterVehicle'] });
await sun.advance(3, 30);
console.log('entered?', JSON.stringify(await st()));
await sun.shot('shots/d1.png');
// reverse out, then drive
await sun.setInput({ steer: { throttle: 0, brake: 1, steer: 0 } });
await sun.advance(2, 30);
console.log('reverse', JSON.stringify(await st()));
await sun.setInput({ steer: { throttle: 1, brake: 0, steer: 0.0 } });
await sun.advance(4, 30);
console.log('drive', JSON.stringify(await st()));
await sun.shot('shots/d2.png');
console.log(logs.slice(0, 20).join('\n'));
await browser.close();

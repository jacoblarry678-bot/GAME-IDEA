/**
 * Entry point: boots the engine, world and game, runs the fixed-step loop
 * and exposes a small debug/test API on window.__sun.
 */
import { Settings } from './core/settings.js';
import { Engine } from './core/engine.js';
import { Input } from './core/input.js';
import { World } from './world/world.js';
import { App } from './app.js';
import { DriverAI } from './ai/driver.js';
import * as Layout from './world/layout.js';

const STEP = 1 / 60;

async function boot() {
  const settings = new Settings();
  const canvas = document.getElementById('game');
  const engine = new Engine(canvas, settings);
  const input = new Input(canvas, settings);
  const world = new World(engine);
  const app = new App({ engine, world, input, settings, canvas });
  await app.init();

  let last = performance.now(), acc = 0, lastRender = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (app.externalClock) return; // tests drive the loop via advance()
    const cap = settings.g.frameCap;
    if (cap > 0 && now - lastRender < 1000 / cap - 1) return;
    lastRender = now;
    let dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    input.pollGamepad();
    if (app.simulating) {
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < 6) { app.step(STEP); acc -= STEP; n++; }
      if (n === 6) acc = 0;
    } else acc = 0;
    app.frame(dt);
  }
  requestAnimationFrame(frame);

  window.__sun = {
    app, engine, world, settings, input,
    get game() { return app.game; },
    get state() { return app.state; },
    /** Run `seconds` of simulation synchronously, rendering every `renderEvery` steps. */
    advance(seconds, renderEvery = 0) {
      app.externalClock = true;
      const n = Math.round(seconds / STEP);
      for (let i = 0; i < n; i++) {
        if (app.simulating) app.step(STEP);
        if (renderEvery && i % renderEvery === 0) app.frame(STEP * renderEvery);
      }
      app.frame(STEP);
      return n;
    },
    release() { app.externalClock = false; },
    debug: debugTools(app),
  };
}

/** Test helpers: drive the player's own car with the traffic AI (same physics). */
function debugTools(app) {
  let ai = null, target = null, arrived = false;
  return {
    autopilot(x, z, { arrive = 18, cruise = false } = {}) {
      const g = app.game, v = g.player.vehicle;
      if (!v) return false;
      const L = Layout;
      // nearest road point the car can actually see (not one behind a building)
      let rp = null;
      for (const e of L.ROAD_GRAPH.edges) {
        const A = L.ROAD_GRAPH.nodes[e.a], B = L.ROAD_GRAPH.nodes[e.b];
        const dx = B.x - A.x, dz = B.z - A.z;
        const t = Math.max(0.05, Math.min(0.95, ((v.pos.x - A.x) * dx + (v.pos.z - A.z) * dz) / (dx * dx + dz * dz)));
        const px = A.x + dx * t, pz = A.z + dz * t;
        const dist = Math.hypot(px - v.pos.x, pz - v.pos.z);
        if (rp && dist >= rp.dist) continue;
        const hit = g.world.collision.raycast(v.pos.x, v.pos.y + 0.8, v.pos.z, px - v.pos.x, 0, pz - v.pos.z, 1, (c) => c.tag !== 'prop');
        if (hit && hit.t < 0.98) continue;
        rp = { edge: e, t, x: px, z: pz, dist };
      }
      if (!rp) rp = L.nearestRoadPoint(v.pos.x, v.pos.z);
      const e = rp.edge, a = L.ROAD_GRAPH.nodes[e.a], b = L.ROAD_GRAPH.nodes[e.b];
      const [fx, fz] = v.forward;
      const from = ((b.x - a.x) * fx + (b.z - a.z) * fz) >= 0 ? e.a : e.b;
      const to = from === e.a ? e.b : e.a;
      const t = Math.max(0.05, Math.min(0.95, from === e.a ? rp.t : 1 - rp.t));
      ai = new DriverAI(v, g, { edge: e.id, from, lane: 0, t: Math.min(0.95, t + 0.15) });
      ai.mode = cruise ? 'cruise' : 'route';
      if (!cruise) ai.route = L.findRoute(to, L.nearestNode(x, z).id);
      ai.speedScale = 1.1;
      target = cruise ? null : { x, z, arrive };
      arrived = false;
      g.debugHook = (dt) => {
        if (!ai || g.player.vehicle !== v) { g.debugHook = null; return; }
        if (target && Math.hypot(v.pos.x - target.x, v.pos.z - target.z) < target.arrive) {
          // arrived: brake to a full stop, then hand control back
          arrived = true; ai = null;
          g.debugHook = () => { v.input.throttle = 0; v.input.brake = v.vLong > 0.3 ? 1 : 0; v.input.handbrake = v.speed < 0.3; v.input.steer = 0; if (v.speed < 0.2 || g.player.vehicle !== v) g.debugHook = null; };
          return;
        }
        ai.step(dt);
      };
      return true;
    },
    stop() { ai = null; if (app.game) app.game.debugHook = null; },
    get arrived() { return arrived; },
  };
}

boot().catch((e) => {
  console.error(e);
  const el = document.getElementById('ui');
  if (el) el.innerHTML = `<div style="position:fixed;inset:0;display:grid;place-items:center;background:#111;color:#f88;font:16px monospace;padding:24px;white-space:pre-wrap">Failed to start: ${String(e && e.stack || e)}</div>`;
  window.__sun = { fatal: String(e) };
});

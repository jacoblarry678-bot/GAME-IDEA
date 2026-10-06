/**
 * Milestone 3 weather checks in headless Chromium:
 *   npm run build && npm run preview &   then   node tools/e2e-weather.mjs
 * Settings → Weather pins rain on and off; checks the sky/fog/streaks, wet
 * road materials, tyre grip, headlights and the HUD label, and saves two
 * screenshots (shots/rain-street.png, shots/rain-bridge.png) for review.
 */
import { mkdirSync } from 'node:fs';
import { launch, checker } from './harness.mjs';

mkdirSync('shots', { recursive: true });
const { check, summary } = checker();
const t0 = Date.now();
const { browser, page, logs, sun } = await launch(undefined, { query: '?autostart' });
await page.waitForFunction(() => window.__sun?.app?.state === 'playing', null, { timeout: 180000 });
const T = (fn, arg) => page.evaluate(fn, arg);

const dry = await T(() => { const S = window.__sun; S.advance(2); const m = S.world.mats.asphalt; return { rough: m.roughness, fog: S.engine.scene.fog.far, grip: S.app.weather.grip }; });
await T(() => { const S = window.__sun; S.app.settings.set('gameplay', 'weather', 'rain'); S.advance(40, 20); });
const wet = await T(() => {
  const S = window.__sun, g = S.game, w = S.app.weather, m = S.world.mats.asphalt;
  const ai = g.vehicles.filter((v) => v.ai && v.driver);
  return {
    state: w.state, rain: +w.rain.toFixed(2), wet: +w.wet.toFixed(2), grip: +w.grip.toFixed(2),
    streaks: S.app.weatherFX.rain.visible, rough: +m.roughness.toFixed(2), fog: Math.round(S.engine.scene.fog.far),
    label: document.querySelector('.street')?.textContent || '', aiLights: ai.length ? ai.filter((v) => v.headlightsVisible).length / ai.length : 1,
  };
});
check('Weather → Always rain brings the rain in', wet.state === 'rain' && wet.rain > 0.9 && wet.streaks, JSON.stringify(wet));
check('roads get wet: glossier asphalt', wet.wet > 0.8 && wet.rough < dry.rough - 0.4, `roughness ${dry.rough} → ${wet.rough}`);
check('tyre grip drops on wet roads', wet.grip < 0.75 && dry.grip === 1, `grip ${dry.grip} → ${wet.grip}`);
check('visibility closes in (fog)', wet.fog < dry.fog * 0.6, `${Math.round(dry.fog)} m → ${wet.fog} m`);
check('traffic drives with headlights on in the rain', wet.aiLights > 0.9, `${Math.round(wet.aiLights * 100)}% of AI cars`);
check('the HUD names the weather', /Rain/.test(wet.label), wet.label);

// screenshots: a street in Ocean Mile and the twin-span
const shot = async (file, [x, y, z, tx, ty, tz]) => {
  await T(([x, y, z, tx, ty, tz]) => {
    const S = window.__sun, g = S.game, V = S.engine.camera.position.constructor;
    g.player.pos.set(tx, g.world.ground(tx, tz, 20), tz);
    S.advance(2, 0);
    g.cameraRig.override = { pos: new V(x, y, z), target: new V(tx, ty, tz) };
    S.advance(0.3, 1);
  }, [x, y, z, tx, ty, tz]);
  await page.waitForTimeout(400);
  await sun.shot(file);
};
await T(() => { window.__sun.engine.time.hour = 15; });
await shot('shots/rain-street.png', [92, 4, -60, 88, 1.5, -110]);
await shot('shots/rain-bridge.png', [140, 12, 300, 150, 4, 380]);
await T(() => { window.__sun.game.cameraRig.override = null; });

await T(() => { const S = window.__sun; S.app.settings.set('gameplay', 'weather', 'clear'); S.advance(45, 20); });
const after = await T(() => { const S = window.__sun, w = S.app.weather; return { state: w.state, rain: +w.rain.toFixed(2), wet: +w.wet.toFixed(2), streaks: S.app.weatherFX.rain.visible }; });
check('Weather → Always clear stops the rain; the roads dry more slowly', after.state === 'clear' && after.rain < 0.05 && !after.streaks && after.wet > 0.2, JSON.stringify(after));
await T(() => { window.__sun.app.settings.set('gameplay', 'weather', 'dynamic'); });

const errs = logs.filter((l) => l.includes('PAGEERROR'));
check('no page errors', errs.length === 0, errs.slice(0, 3).join('\n'));
console.log(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
await browser.close();
process.exit(summary() ? 0 : 1);

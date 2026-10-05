/**
 * Shared headless-Chromium harness for the test tools. The container renders
 * with SwiftShader (CPU), so tests drive the simulation with window.__sun.advance()
 * instead of real time, and render only occasionally.
 */
import { chromium } from 'playwright';

export async function launch(url = process.env.URL || 'http://localhost:4190/', { width = 1280, height = 720, lowGfx = true, query = '' } = {}) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width, height } });
  const logs = [];
  page.on('console', (m) => { const t = m.text(); if (!t.includes('Failed to load resource')) logs.push(`[${m.type()}] ${t}`); });
  page.on('pageerror', (e) => logs.push('[PAGEERROR] ' + e.message + '\n' + e.stack));
  if (lowGfx) await page.addInitScript(() => {
    try {
      const s = JSON.parse(localStorage.getItem('sunstate.settings.v1') || '{}');
      s.graphics = { ...(s.graphics || {}), preset: 'custom', renderScale: 0.5, shadows: 'low', bloom: false, drawDistance: 'medium', antialias: false };
      localStorage.setItem('sunstate.settings.v1', JSON.stringify(s));
    } catch {}
  });
  await page.goto(url + query, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__sun && (window.__sun.app || window.__sun.fatal), null, { timeout: 120000 });
  const fatal = await page.evaluate(() => window.__sun.fatal);
  if (fatal) throw new Error('boot failed: ' + fatal);
  const sun = {
    eval: (fn, arg) => page.evaluate(fn, arg),
    advance: (s, renderEvery = 0) => page.evaluate(([s, r]) => window.__sun.advance(s, r), [s, renderEvery]),
    shot: (path) => page.screenshot({ path }),
    setInput: (v) => page.evaluate((v) => {
      const vi = window.__sun.input.virtual;
      vi.move = v.move ?? vi.move; vi.steer = v.steer ?? vi.steer; vi.look = v.look ?? vi.look;
      if (v.down) { vi.actions.clear(); for (const a of v.down) vi.actions.add(a); }
      if (v.press) for (const a of v.press) vi.edges.add(a);
    }, v),
    clearInput: () => page.evaluate(() => { const vi = window.__sun.input.virtual; vi.move = null; vi.steer = null; vi.look = null; vi.actions.clear(); vi.edges.clear(); }),
  };
  return { browser, page, logs, sun };
}

export function checker() {
  const results = [];
  const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  const summary = () => { const f = results.filter((r) => !r.ok); console.log(`\n${results.length - f.length}/${results.length} passed`); return f.length === 0; };
  return { check, summary, results };
}

/**
 * Plays a match with scripted input and reports what actually happened.
 *
 *   node tools/match.mjs cenobite 300     # hunt 4 survivor bots as the Hell Priest
 *   node tools/match.mjs survivor 300     # run the ritual with 3 bots, vs a Cenobite bot
 *
 * Movement and abilities go through real key/mouse events; aim is set the way a
 * mouse would set it. Everything else is the game and the bots.
 */

import { chromium } from 'playwright';

const SP = '/tmp/claude-0/-home-user-GAME-IDEA/ade7305e-0704-5862-9fd8-0bb8c5326d23/scratchpad';
const ROLE = process.argv[2] || 'cenobite';
const SECONDS = Number(process.argv[3] || 240);
const TAG = process.argv[4] || ROLE;

const log = [];
const shots = [];
const say = (t) => {
  const line = `[${String(Math.round(performance.now() / 1000)).padStart(3)}s] ${t}`;
  log.push(line);
  console.log(line);
};

const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await b.newPage({ viewport: { width: 960, height: 540 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

await page.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 90000 });
await page.waitForTimeout(14000);

// ---------------------------------------------------------------- lobby
await page.click('text=HOST GAME');
await page.waitForTimeout(400);
await page.fill('#screen-host input[type=text]', 'Jacob');
await page.click('text=OPEN THE LOBBY');
await page.waitForTimeout(1500);
const code = (await page.textContent('.lobby-code')).trim();

if (ROLE === 'survivor') {
  await page.click('text=PLAY AS SURVIVOR');
  await page.waitForTimeout(500);
  await page.click('text=+ CENOBITE BOT');
  await page.waitForTimeout(400);
  for (let i = 0; i < 3; i++) {
    await page.click('text=+ SURVIVOR BOT');
    await page.waitForTimeout(300);
  }
} else {
  for (let i = 0; i < 4; i++) {
    await page.click('text=+ SURVIVOR BOT');
    await page.waitForTimeout(300);
  }
}
await page.waitForTimeout(600);
const roster = await page.$$eval('.slot .who', (ns) => ns.map((n) => n.textContent.trim()).filter(Boolean));
say(`lobby ${code} — ${roster.join(', ')}`);

// collect every server event for the report
await page.evaluate(() => {
  window.__log = [];
  const g = window.__game;
  const orig = g.onEvent.bind(g);
  g.onEvent = (e) => {
    window.__log.push({ t: Math.round(performance.now() / 1000), ...e });
    orig(e);
  };
  window.__end = null;
  g.net.on('matchEnd', (d) => { window.__end = d; });
});

await page.click('text=BEGIN THE RITE');
await page.waitForTimeout(9000);
say(`match started — playing ${ROLE}`);

const shot = async (name, note) => {
  try {
    await page.screenshot({ path: `${SP}/m_${TAG}_${name}.png`, timeout: 45000 });
    shots.push({ name, note });
    say(`  📷 ${name} — ${note}`);
  } catch {
    say(`  (screenshot ${name} timed out)`);
  }
};

// focus the canvas so key events reach the game
await page.click('#scene', { position: { x: 480, y: 270 } });
await page.waitForTimeout(500);

const state = () =>
  page.evaluate(() => {
    const g = window.__game;
    if (!g || !g.running) return null;
    const h = g.hudState();
    const me = g.controller.pos;
    const others = [];
    for (const [id, r] of g.remotes) {
      const s = g.serverState ? g.net.indexPlayers(g.serverState).get(id) : null;
      others.push({
        id, name: r.name, ceno: r.isCenobite, floor: r.floor,
        x: r.character.group.position.x, z: r.character.group.position.z,
        d: Math.hypot(r.character.group.position.x - me.x, r.character.group.position.z - me.z),
        hs: s ? s.hs : '?', hidden: s ? !!s.hd : false,
      });
    }
    return {
      me: { x: me.x, z: me.z, floor: g.controller.floor, hp: h.health, hs: h.healthState, fear: h.fear, power: h.power, stam: h.stamina },
      zone: h.zone, clock: h.clock, obj: h.objective, others,
      cds: h.abilities.map((a) => ({ n: a.name, r: a.ready && !a.locked })),
      sites: (g.markers ? [...g.markers.values()] : []).map((m) => ({
        x: m.position.x, z: m.position.z,
        d: Math.hypot(m.position.x - me.x, m.position.z - me.z),
      })).sort((a, c) => a.d - c.d),
      newEvents: (() => { const l = window.__log; window.__log = []; return l; })(),
      ended: window.__end,
    };
  });

const held = new Set();
const hold = async (k) => { if (!held.has(k)) { await page.keyboard.down(k); held.add(k); } };
const release = async (k) => { if (held.has(k)) { await page.keyboard.up(k); held.delete(k); } };
const releaseAll = async () => { for (const k of [...held]) await release(k); };

// ---------------------------------------------------------------- play
const deadline = Date.now() + SECONDS * 1000;
let lastPhase = '';
let tick = 0;
const seen = new Set();
const counts = {};
let firstChase = false;
let firstDown = false;
let firstExec = false;

while (Date.now() < deadline) {
  tick++;
  const s = await state();
  if (!s) break;
  if (s.ended) {
    say(`MATCH END: ${s.ended.winner} — ${s.ended.message}`);
    break;
  }

  for (const e of s.newEvents) {
    counts[e.type] = (counts[e.type] || 0) + 1;
    const key = e.type + (e.id || e.by || '');
    if (['damage', 'downed', 'death', 'seal_broken', 'box_solved', 'gate_open', 'escaped', 'execution_start', 'relic_delivered', 'piece_delivered', 'box_assembled', 'horror', 'trap_triggered', 'chain_hit'].includes(e.type)) {
      if (e.type === 'horror' && seen.has('horror' + e.subtype)) continue;
      say(`  · ${e.type}${e.amount ? ` (${e.amount})` : ''}${e.total ? ` [${e.total}]` : ''}`);
      seen.add(key);
    }
  }

  if (s.obj.title !== lastPhase) {
    lastPhase = s.obj.title;
    say(`PHASE → ${lastPhase} (${s.obj.progress})`);
  }

  if (ROLE === 'cenobite') {
    // pick the nearest survivor who isn't hidden or dead
    const targets = s.others.filter((o) => !o.ceno && o.hs !== 'dead' && o.hs !== 'escaped' && !o.hidden && o.floor === s.me.floor);
    targets.sort((a, c) => a.d - c.d);
    const t = targets[0];

    if (t) {
      // aim at them the way a mouse would
      await page.evaluate((tt) => {
        const c = window.__game.controller;
        c.yaw = Math.atan2(-(tt.x - c.pos.x), -(tt.z - c.pos.z));
      }, t);

      const downed = targets.find((o) => o.hs === 'downed' && o.d < 2.3);
      if (downed) {
        await releaseAll();
        await page.keyboard.press('KeyF');
        if (!firstExec) { firstExec = true; await shot('execution', `executing ${downed.name}`); }
        await page.waitForTimeout(1500);
        continue;
      }

      if (t.d < 2.4) {
        await page.mouse.click(480, 270);
        await hold('KeyW');
      } else if (t.d < 26) {
        if (!firstChase && t.d < 14) { firstChase = true; await shot('chase', `closing on ${t.name} at ${t.d.toFixed(0)}m`); }
        if (t.d > 7 && s.cds[0] && s.cds[0].r) await page.keyboard.press('Digit1'); // chain summon
        if (t.d < 6 && s.cds[1] && s.cds[1].r && tick % 20 === 0) await page.keyboard.press('Digit2'); // trap
        await hold('KeyW');
        await hold('ShiftLeft');
      } else {
        await hold('KeyW');
        await hold('ShiftLeft');
      }
    } else {
      // nobody visible: head for the nearest objective pillar, the same cue a
      // human Cenobite now sees, and sweep with Pain Sense on the way
      if (s.cds[3] && s.cds[3].r && tick % 30 === 0) await page.keyboard.press('Digit4');
      const site = s.sites[0];
      if (site && site.d > 5) {
        await page.evaluate((v) => {
          const c = window.__game.controller;
          c.yaw = Math.atan2(-(v.x - c.pos.x), -(v.z - c.pos.z));
        }, site);
      } else if (tick % 6 === 0) {
        await page.evaluate(() => { window.__game.controller.yaw += 1.1; });
      }
      await hold('KeyW');
      await hold('ShiftLeft');
    }
  } else {
    // survivor: stay near a teammate, run from the Cenobite, otherwise follow bots
    const ceno = s.others.find((o) => o.ceno && o.floor === s.me.floor);
    if (ceno && ceno.d < 18) {
      if (!firstChase) { firstChase = true; await shot('chased', `Cenobite ${ceno.d.toFixed(0)}m away, fear ${Math.round(s.me.fear)}`); }
      await page.evaluate((c) => {
        const cc = window.__game.controller;
        cc.yaw = Math.atan2(cc.pos.x - c.x, cc.pos.z - c.z);
      }, ceno);
      await hold('KeyW');
      await hold('ShiftLeft');
    } else {
      const mate = s.others.filter((o) => !o.ceno && o.hs !== 'dead').sort((a, c) => a.d - c.d)[0];
      if (mate && mate.d > 6) {
        await page.evaluate((m) => {
          const cc = window.__game.controller;
          cc.yaw = Math.atan2(-(m.x - cc.pos.x), -(m.z - cc.pos.z));
        }, mate);
        await hold('KeyW');
        await release('ShiftLeft');
      } else {
        await releaseAll();
      }
    }
    if (s.me.hs === 'downed' && !firstDown) { firstDown = true; await shot('downed', 'on the floor, bleeding out'); }
  }

  if (tick === 12) await shot('early', `${s.zone}, ${s.obj.progress}`);
  if (tick % 90 === 0) {
    say(`  ${Math.floor(s.clock / 60)}:${String(s.clock % 60).padStart(2, '0')} left · ${s.zone} · ${s.obj.progress} · hp ${Math.round(s.me.hp)} fear ${Math.round(s.me.fear)}` +
      ` · alive ${s.others.filter((o) => !o.ceno && o.hs !== 'dead' && o.hs !== 'escaped').length + (ROLE === 'survivor' && s.me.hs !== 'dead' ? 1 : 0)}`);
  }
  await page.waitForTimeout(220);
}

await releaseAll();
const final = await state();
await shot('final', 'end of run');

console.log('\n──────── RESULT ────────');
if (final) {
  console.log(`clock left     : ${Math.floor(final.clock / 60)}:${String(final.clock % 60).padStart(2, '0')}`);
  console.log(`phase          : ${final.obj.title} — ${final.obj.progress}`);
  console.log(`me             : hp ${Math.round(final.me.hp)} ${final.me.hs} fear ${Math.round(final.me.fear)}` + (ROLE === 'cenobite' ? ` power ${Math.round(final.me.power)}` : ''));
  for (const o of final.others) console.log(`  ${o.name.padEnd(22)} ${o.hs.padEnd(9)} ${o.d.toFixed(0)}m away${o.hidden ? ' (hidden)' : ''}`);
  if (final.ended) console.log(`OUTCOME        : ${final.ended.winner} — ${final.ended.message}`);
}
console.log('\nevents:', Object.entries(counts).sort((a, c) => c[1] - a[1]).map(([k, v]) => `${k}×${v}`).join('  '));
if (pageErrors.length) console.log('\nPAGE ERRORS:', [...new Set(pageErrors)].slice(0, 5).join(' | '));
else console.log('\nno page errors');
console.log('shots:', shots.map((s) => s.name).join(', '));

await b.close();

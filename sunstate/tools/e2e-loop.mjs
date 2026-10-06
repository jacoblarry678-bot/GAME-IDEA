/**
 * Your own LOOP accounts in headless Chromium:
 *   npm run build && npm run preview &   then   node tools/e2e-loop.mjs
 * Posting selfies, photos and clips from the open feed; likes turning into
 * followers; what makes a post do well; audience fatigue; brand deals;
 * posting while wanted; Cal and Sol's separate accounts; milestones; a
 * Claude-written caption; and the accounts surviving a save.
 *
 * Mocked: `window.claude` (the claude.ai artifact runtime) is a stub that
 * returns a fixed caption, so no one's Claude usage is spent. The real call
 * was not run.
 */
import { mkdirSync } from 'node:fs';
import { launch, checker } from './harness.mjs';

mkdirSync('shots', { recursive: true });
const { check, summary } = checker();
const t0 = Date.now();
const { browser, page, logs, sun } = await launch();
await page.addInitScript(() => {
  window.claude = { use: async (name) => (name === 'sample' ? Object.assign(async () => ({ text: '' }), { json: async (prompt) => { window.__capPrompt = prompt; return { caption: 'stub caption from the beach' }; } }) : null) };
});
await page.evaluate(() => { localStorage.removeItem('sunstate.save'); });
await page.goto(page.url().split('?')[0] + '?autostart', { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => window.__sun?.app?.state === 'playing', null, { timeout: 180000 });
const T = (fn, arg) => page.evaluate(fn, arg);
await T(() => {
  const S = window.__sun;
  window.__t = {
    press(a) { S.input.virtual.edges.add(a); S.advance(1 / 30, 1); },
    me() { return S.game.social.me; },
  };
  S.game.economy.money = 1000;
});

// ---- open the feed, post a selfie ----
const first = await T(() => {
  const S = window.__sun, g = S.game, t = window.__t, me = t.me();
  g.engine.time.hour = 12;
  t.press('phone');
  const f0 = me.me.followers;
  const panel = document.querySelector('.loopfeed')?.textContent || '';
  t.press('loop1');
  S.advance(0.5, 1);
  const p = g.social.posts.find((x) => x.mine);
  return { panel: /Cal Reyes/.test(panel) && /@cal\.reyes/.test(panel) && /Selfie/.test(panel), f0, handle: p?.handle, kind: p?.kind, frames: p?.reel?.frames.length || 0, w: p?.reel?.frames[0]?.width, text: p?.text };
});
check('LOOP shows your account (Cal) and the posting keys', first.panel, JSON.stringify(first));
check('1 posts a selfie from your phone (a 135×240 shot)', first.handle === 'cal.reyes' && first.kind === 'selfie' && first.frames === 1 && first.w === 135, JSON.stringify(first));
const grown = await T(() => {
  const S = window.__sun, g = S.game, me = window.__t.me();
  const p = g.social.posts.find((x) => x.mine);
  S.advance(150);
  return { likes: Math.round(p.likes), followers: me.me.followers, posts: me.me.posts, total: Math.round(me.me.likes) };
});
check('likes roll in and turn into followers', grown.likes > 0 && grown.followers > first.f0 && grown.posts === 1 && grown.total === grown.likes, JSON.stringify({ ...grown, f0: first.f0 }));
const spam = await T(() => { const S = window.__sun, t = window.__t, me = t.me(); t.press('loop2'); const a = me.status; t.press('loop2'); return { a, b: me.status, posts: me.me.posts }; });
check('posting again right away: "Give it a minute"', spam.a === 'Posted!' && spam.b === 'Give it a minute.' && spam.posts === 2, JSON.stringify(spam));

// ---- what makes a post do well ----
const scores = await T(() => {
  const S = window.__sun, g = S.game, me = window.__t.me();
  me.recent = [];
  const at = (x, z, h) => { g.engine.time.hour = h; g.respawnPlayer(x, z, 0); S.advance(0.2); return me.context(); };
  const street = me.score(at(60, -40, 12), 'photo');
  const beach = at(200, 0, 18.2);
  g.partner.pos.set(201, beach.pos.y, 1);
  const golden = me.score(me.context(), 'selfie');
  const caption = me.caption(me.context());
  me.recent = [{ t: g.time, place: 'goldenBeach' }, { t: g.time, place: 'goldenBeach' }, { t: g.time, place: 'goldenBeach' }];
  const tired = me.score(me.context(), 'selfie');
  return { street, golden, tired, place: beach.place, caption };
});
check('a golden-hour beach selfie together beats a midday street photo; spamming wears people out', scores.place === 'goldenBeach' && scores.golden > scores.street * 3 && scores.tired < scores.golden * 0.5, JSON.stringify(scores));

// ---- a clip from inside Velvet Palms; a brand deal ----
const deal = await T(() => {
  const S = window.__sun, g = S.game, t = window.__t, me = t.me();
  me.recent = []; me.lastPostT = -1e9;
  me.me.followers = 400;
  g.engine.time.hour = 22.3;
  S.advance(0.2);
  const d = me.offer('palms');
  const offered = { brand: d?.def.brand, pay: d?.pay, gps: g.hud.waypoint?.label };
  g.club.admit();
  const L = g.club.L; g.respawnPlayer(L.runway.x0 - 3, L.door.z + 3, Math.PI / 2); S.advance(1.5);
  const money0 = g.economy.money;
  t.press('loop3');
  S.advance(3, 1);
  const p = g.social.posts.find((x) => x.mine);
  return { offered, inside: g.club.playerInside, paid: g.economy.money - money0, cleared: !me.deal, kind: p.kind, frames: p.reel.frames.length, ad: /#ad/.test(p.text), gpsCleared: !g.hud.waypoint };
});
check('a brand DMs you a deal (and points the GPS there)', deal.offered.brand === 'Velvet Palms' && deal.offered.pay >= 400 && deal.offered.gps === 'Velvet Palms', JSON.stringify(deal));
check('a clip from inside Velvet Palms fulfils it: paid, tagged #ad, 10 frames', deal.inside && deal.paid === deal.offered.pay && deal.cleared && deal.kind === 'clip' && deal.frames === 10 && deal.ad && deal.gpsCleared, JSON.stringify(deal));

// ---- posting while wanted gives you away ----
const wanted = await T(() => {
  const S = window.__sun, g = S.game, t = window.__t, me = t.me();
  g.engine.time.hour = 13; me.lastPostT = -1e9;
  g.respawnPlayer(60, -100, 0); S.advance(0.3);
  g.wanted.report('assault', 0, -20, 'witness');
  g.police.clearAll();
  const before = { ...g.wanted.lastKnown };
  t.press('loop1');
  const p = g.social.posts.find((x) => x.mine);
  const after = { ...g.wanted.lastKnown }, level = g.wanted.level;
  // (clear the police before waiting for the replies: at 1 star they'd come and arrest Cal)
  g.wanted.clear(true); g.police.clearAll();
  S.advance(40);
  return { before, after, level, risky: p.replies.some((r) => /chase|police|delete|evidence|undefeated/i.test(r.text)), caption: p.text };
});
check('posting while wanted tells the police where you are (and the replies roast you)', Math.abs(wanted.after.x - 60) < 2 && Math.abs(wanted.after.z + 100) < 2 && wanted.before.z === -20 && wanted.risky, JSON.stringify(wanted));
await T(() => { const g = window.__sun.game; g.wanted.clear(true); g.police.clearAll(); });

// ---- Sol has her own account; milestones ----
const sol = await T(() => {
  const S = window.__sun, g = S.game, t = window.__t, me = t.me();
  const cal = me.me.followers;
  let why = g.crew.switchBlocked();
  for (let i = 0; i < 10 && why; i++) { S.advance(1); why = g.crew.switchBlocked(); }
  g.crew.switchCharacter(); S.advance(1.5, 1);
  const panel = document.querySelector('.loopfeed')?.textContent || '';
  const solF = me.me.followers;
  // a post that takes her past 10,000 followers
  me.me.followers = 9990;
  me.follow('sol', 20);
  const vip = g.memory.state.people.club?.sol?.vip === true;
  me.me.followers = 49990; me.follow('sol', 20);
  return { who: me.id, why, panel: /Sol Vega/.test(panel), cal, solF, vip, verified: me.me.verified, milestones: me.me.milestones };
});
check('Tab: Sol posts from her own account (separate followers)', sol.who === 'sol' && sol.panel && sol.solF === 212 && sol.cal > 37, JSON.stringify(sol));
check('follower milestones: 10k puts you on the Velvet Palms VIP list, 50k verifies you', sol.vip && sol.verified && sol.milestones.includes(10000) && sol.milestones.includes(50000), JSON.stringify(sol));

// ---- a caption written by Claude (stubbed) ----
const cap = await T(async () => {
  const S = window.__sun, g = S.game, t = window.__t, me = t.me();
  me.lastPostT = -1e9;
  const avail = g.social.ai.available;
  t.press('loop4');
  for (let i = 0; i < 20 && me.busy; i++) await new Promise((r) => setTimeout(r, 50));
  S.advance(0.3, 1);
  const p = g.social.posts.find((x) => x.mine);
  return { avail, text: p.text, ai: p.ai, handle: p.handle, prompt: /Sol Vega/.test(window.__capPrompt || '') };
});
check('4: a selfie captioned by Claude (stubbed), marked ✨', cap.avail && cap.text === 'stub caption from the beach' && cap.ai && cap.handle === 'sol.vega' && cap.prompt, JSON.stringify(cap));
await sun.shot('shots/loop-me.png');

// ---- accounts are saved ----
const saved = await T(() => { const g = window.__sun.game; g.saveGame('test'); const s = JSON.parse(localStorage.getItem('sunstate.save')); return { cal: s.loop.cal.followers, sol: s.loop.sol.followers, solVerified: s.loop.sol.verified, posts: s.loop.cal.posts }; });
check('your followers, posts and badges are saved', saved.sol >= 50000 && saved.solVerified && saved.cal > 37 && saved.posts >= 4, JSON.stringify(saved));

const errs = logs.filter((l) => l.includes('PAGEERROR'));
check('no page errors', errs.length === 0, errs.slice(0, 3).join('\n'));
console.log(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
await browser.close();
process.exit(summary() ? 0 : 1);

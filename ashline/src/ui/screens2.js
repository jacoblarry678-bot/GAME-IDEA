/**
 * Milestone 3 screens: Armory (inventory), Battle Pass, Challenges, Store,
 * plus shared widgets (profile card, currency chip, reward tiles).
 * All prices and balances are TEST credits; nothing here charges money.
 */
import { esc } from './dom.js';
import { COSMETICS, COSMETIC_LIST, RARITY, TYPES } from '../data/cosmetics.js';
import { WEAPONS } from '../data/weapons.js';
import { SEASON, PASS_TIERS, CURRENCY, seasonDaysLeft } from '../data/season.js';
import { nextReset } from '../data/challenges.js';
import { BUNDLES, SHOP_CONFIG, currentRotation, itemPrice, bundlePrice } from '../data/shop.js';
import { xpToNext, MAX_LEVEL, weaponXpToNext } from '../core/profile.js';
import { cardArt, emblemArt, bannerArt, itemThumb } from './art.js';

const WEAPON_ORDER = ['ar_kv7', 'smg_vesper', 'sg_brakk', 'sr_longreach', 'pistol_warden'];
const fmt = (n) => Number(n).toLocaleString('en-US');

export function creditsChip(app) {
  return `<span class="credits" title="${esc(CURRENCY.name)}: test currency for this demo. No real money.">${fmt(app.profile.data.credits)} <b>AC</b> <span class="test-tag">TEST</span></span>`;
}

export function profileCard(app) {
  const d = app.profile.data, look = app.profile.look;
  const need = xpToNext(d.level);
  const pct = d.level >= MAX_LEVEL ? 100 : Math.round((d.xp / need) * 100);
  return `<div class="pcard" style="background-image:url(${bannerArt(look.banner.id, 480, 120)})">
    <img class="pcard-em" src="${emblemArt(look.emblem.id, 64)}" alt="">
    <div class="pcard-body">
      <div class="pcard-name">${esc(d.name)}</div>
      <div class="pcard-lv">LEVEL ${d.level}${d.level >= MAX_LEVEL ? ' · MAX' : ''} · ${esc(look.operator.name)}</div>
      <div class="xpbar"><i style="width:${pct}%"></i></div>
      <div class="pcard-xp">${d.level >= MAX_LEVEL ? 'Max level' : `${fmt(d.xp)} / ${fmt(need)} XP`}</div>
    </div>
    <img class="pcard-card" src="${cardArt(look.card.id, 192, 48)}" alt="">
  </div>`;
}

function rarityTag(it) { const r = RARITY[it.rarity]; return `<span class="rar" style="color:${r.color}">${r.name}</span>`; }

function rewardTile(slot, state) {
  if (!slot) return '<div class="rt empty"></div>';
  if (slot.credits) return `<div class="rt ${state}"><div class="rt-credits">${fmt(slot.credits)}<small>AC</small></div><div class="rt-name">Test credits</div></div>`;
  const it = COSMETICS[slot.item];
  return `<div class="rt ${state}" data-item="${it.id}" style="--rc:${RARITY[it.rarity].color}">${itemThumb(it)}<div class="rt-name">${esc(it.name)}</div><div class="rt-type">${TYPES[it.type].single}</div></div>`;
}

/** Shared detail panel: preview + description + actions for one cosmetic. */
function detailHtml(app, it, ctx = {}) {
  const prof = app.profile;
  const owned = prof.owns(it.id);
  const r = RARITY[it.rarity];
  let art = '';
  if (it.type === 'card') art = `<img class="detail-card" src="${cardArt(it.id)}" alt="">`;
  if (it.type === 'emblem') art = `<img class="detail-em" src="${emblemArt(it.id, 128)}" alt="">`;
  if (it.type === 'banner') art = `<img class="detail-card" src="${bannerArt(it.id)}" alt="">`;
  return `<div class="kicker" style="color:${r.color}">${r.name} ${TYPES[it.type].single}</div>
    <h2 class="title">${esc(it.name)}</h2>
    ${art}
    <div class="muted small" style="margin:6px 0 10px">${esc(it.desc)}</div>
    <div class="small">${owned ? '<span class="pill on">Owned</span>' : `<span class="pill">Locked</span> <span class="muted">${esc(prof.unlockText(it))}</span>`}</div>
    ${ctx.actions || ''}`;
}

function showPreview(app, it, weaponId) {
  const pv = app.preview;
  if (it.type === 'operator') pv.showOperator(it, COSMETICS[app.profile.data.equipped.outfits[it.id]] || COSMETICS[it.op.outfit]);
  else if (it.type === 'outfit') pv.showOperator(COSMETICS[it.operator], it);
  else if (it.type === 'finish') pv.show(weaponId, { finish: it.id, charm: app.profile.data.equipped.weapons[weaponId].charm });
  else if (it.type === 'charm') pv.show(weaponId, { finish: app.profile.data.equipped.weapons[weaponId].finish, charm: it.id });
  else pv.hide();
}

function weaponChips(sel) {
  return `<div class="choice wchips">${WEAPON_ORDER.map((w) => `<button data-w="${w}" class="${w === sel ? 'sel' : ''}">${esc(WEAPONS[w].name)}</button>`).join('')}</div>`;
}

export const SCREENS2 = {
  // ------------------------------------------------------------------ ARMORY
  armory(app, node, p, entry) {
    node.classList.add('shade');
    app.setMenuCamera('closeup');
    const prof = app.profile;
    let tab = p.tab || 'operator';
    let weaponId = p.weapon || prof.loadout.primary;
    let sel = p.item || null;
    const render = () => {
      const list = COSMETIC_LIST.filter((i) => i.type === tab);
      const ownedN = list.filter((i) => prof.owns(i.id)).length;
      if (!sel || COSMETICS[sel]?.type !== tab) sel = list.find((i) => prof.isEquipped(i.id, weaponId))?.id || list[0].id;
      const it = COSMETICS[sel];
      const isWeaponItem = tab === 'finish' || tab === 'charm';
      let actions = '';
      if (prof.owns(it.id)) {
        const eq = prof.isEquipped(it.id, isWeaponItem ? weaponId : undefined);
        actions = `<div class="row" style="margin-top:12px;flex-wrap:wrap">
          <button class="btn primary" data-a="equip" ${eq ? 'disabled' : ''}>${eq ? 'Equipped' : isWeaponItem ? `Equip on ${esc(WEAPONS[weaponId].name)}` : 'Equip'}</button>
          ${tab === 'finish' ? '<button class="btn" data-a="equipAll">Equip on all weapons</button>' : ''}
          ${tab === 'outfit' && prof.data.equipped.operator !== it.operator ? `<button class="btn" data-a="equipOp">Also play as ${esc(COSMETICS[it.operator].name)}</button>` : ''}
        </div>`;
      } else if (it.unlock.type === 'shop') actions = '<div class="row" style="margin-top:12px"><button class="btn primary" data-a="store">View in Store</button></div>';
      else if (it.unlock.type === 'pass') actions = '<div class="row" style="margin-top:12px"><button class="btn" data-a="pass">View in Battle Pass</button></div>';
      node.innerHTML = `<div class="page">
        <div class="page-head"><div><div class="kicker">Inventory</div><h1 class="title">Armory</h1></div><div class="spacer"></div>${creditsChip(app)}</div>
        <div class="tabs">${Object.entries(TYPES).map(([k, t]) => { const n = COSMETIC_LIST.filter((i) => i.type === k && prof.owns(i.id) && !prof.data.owned[i.id].seen).length; return `<button class="tab ${k === tab ? 'sel' : ''}" data-t="${k}">${t.name}${n ? ` <span class="newdot">${n}</span>` : ''}</button>`; }).join('')}</div>
        <div class="page-body" style="gap:16px">
          <div class="col" style="flex:1;min-width:0;gap:8px;max-width:min(820px,58vw)">
            <div class="row small muted"><span>${ownedN} / ${list.length} owned</span><div class="spacer"></div>${isWeaponItem ? weaponChips(weaponId) : ''}</div>
            <div class="inv-grid scroll">${list.map((i) => {
              const own = prof.owns(i.id), eq = prof.isEquipped(i.id, isWeaponItem ? weaponId : undefined);
              const isNew = own && !prof.data.owned[i.id].seen;
              return `<button class="inv ${i.id === sel ? 'sel' : ''} ${own ? '' : 'locked'}" data-i="${i.id}" style="--rc:${RARITY[i.rarity].color}">
                ${itemThumb(i)}<div class="inv-name">${esc(i.name)}</div>${tab === 'outfit' ? `<div class="inv-sub">${esc(COSMETICS[i.operator].name)}</div>` : ''}
                ${eq ? '<span class="inv-eq">EQUIPPED</span>' : ''}${isNew ? '<span class="inv-new">NEW</span>' : ''}${own ? '' : '<span class="inv-lock">🔒</span>'}
              </button>`;
            }).join('')}</div>
          </div>
        </div>
        <div class="panel wpn-info detail">${detailHtml(app, it, { actions })}</div>
        <div class="page-foot"><button class="btn" data-a="back">Back</button><div class="spacer"></div><span class="muted small">Cosmetics change appearance only. Team colour bands always stay visible.</span></div>
      </div>`;
      if (prof.owns(it.id) && !prof.data.owned[it.id].seen) { prof.markSeen(it.id); prof.save(); }
      showPreview(app, it, weaponId);
      node.querySelectorAll('.tab').forEach((b) => { b.onclick = () => { tab = b.dataset.t; sel = null; render(); }; });
      node.querySelectorAll('.inv').forEach((b) => { b.onclick = () => { sel = b.dataset.i; render(); }; });
      node.querySelectorAll('.wchips button').forEach((b) => { b.onclick = () => { weaponId = b.dataset.w; render(); }; });
      const A = (k, f) => { const b = node.querySelector(`[data-a=${k}]`); if (b) b.onclick = f; };
      A('back', () => app.screens.back());
      A('equip', () => { prof.equip(it.id, weaponId); app.screens.toast(`${it.name} equipped`); render(); });
      A('equipAll', () => { for (const w of WEAPON_ORDER) prof.equip(it.id, w); app.screens.toast(`${it.name} equipped on all weapons`); render(); });
      A('equipOp', () => { prof.equip(it.operator); prof.equip(it.id); app.screens.toast(`Playing as ${COSMETICS[it.operator].name}`); render(); });
      A('store', () => app.screens.push('store', { focus: it.id }));
      A('pass', () => app.screens.push('pass'));
    };
    render();
    entry.cleanup = () => app.preview.hide();
    entry.onBack = () => { app.screens.pop(); app.screens.refreshTop(); };
    entry.refresh = render;
  },

  // ------------------------------------------------------------------ BATTLE PASS
  pass(app, node, p, entry) {
    node.classList.add('shade-full');
    app.preview.hide();
    const prof = app.profile;
    let focus = null;
    const render = () => {
      const d = prof.data.pass, tier = prof.passTier;
      const inTier = d.xp - tier * SEASON.xpPerTier;
      const pct = tier >= SEASON.tiers ? 100 : Math.round((inTier / SEASON.xpPerTier) * 100);
      const claimable = PASS_TIERS.filter((t) => prof.canClaim(t.tier, 'free') || prof.canClaim(t.tier, 'premium')).length;
      const cols = PASS_TIERS.map((t) => {
        const st = (track) => {
          if (!t[track]) return 'empty';
          if (d.claimed[track][t.tier]) return 'claimed';
          if (t.tier > tier) return 'locked';
          if (track === 'premium' && !d.premium) return 'locked premium-locked';
          return 'claimable';
        };
        return `<div class="ptier ${t.tier <= tier ? 'reached' : ''}" data-tier="${t.tier}">
          <div class="ptier-n">${t.tier}</div>
          <div class="ptrack free" data-track="free" data-tier="${t.tier}">${rewardTile(t.free, st('free'))}</div>
          <div class="ptrack prem" data-track="premium" data-tier="${t.tier}">${rewardTile(t.premium, st('premium'))}</div>
        </div>`;
      }).join('');
      const fItem = focus && COSMETICS[focus];
      node.innerHTML = `<div class="page">
        <div class="page-head"><div><div class="kicker">Season ${SEASON.number} · ${seasonDaysLeft()} days left · demonstration pass</div><h1 class="title">Battle Pass: ${esc(SEASON.name)}</h1></div><div class="spacer"></div>${creditsChip(app)}</div>
        <div class="row" style="gap:18px;flex-wrap:wrap">
          <div style="min-width:260px;flex:1">
            <div class="row"><b class="title" style="font-size:28px">TIER ${tier}</b><span class="muted">/ ${SEASON.tiers}</span><div class="spacer"></div><span class="muted small">${tier >= SEASON.tiers ? 'Pass complete' : `${fmt(inTier)} / ${fmt(SEASON.xpPerTier)} XP to tier ${tier + 1}`}</span></div>
            <div class="xpbar big"><i style="width:${pct}%"></i></div>
            <div class="muted small" style="margin-top:6px">Earn pass XP by finishing matches and completing challenges. Every match XP point also counts here.</div>
          </div>
          <div class="row" style="gap:8px">
            ${d.premium ? '<span class="pill on">Premium active</span>' : `<button class="btn primary" data-a="premium">Unlock Premium · ${fmt(SEASON.premiumPrice)} AC <span class="test-tag">TEST</span></button>`}
            <button class="btn" data-a="claimAll" ${claimable ? '' : 'disabled'}>Claim all (${claimable})</button>
          </div>
        </div>
        <div class="small muted">Top row: <b style="color:var(--text)">Free</b> track · bottom row: <b style="color:var(--accent-2)">Premium</b> track. Click a reward to preview it; click a highlighted one to claim it.</div>
        <div class="pass-scroll scroll-x">${cols}</div>
        <div class="row" style="gap:16px;align-items:flex-start;min-height:120px">
          <div class="panel" style="flex:1">${fItem ? detailHtml(app, fItem) : '<div class="muted">Select a reward to preview it. Claimed items go straight to your Armory; a duplicate turns into test credits.</div>'}</div>
          <div class="panel small muted" style="width:360px;line-height:1.6">Season ends ${new Date(SEASON.end).toUTCString().slice(5, 16)}. When a season ends, pass tiers reset. Items you've claimed stay yours. Premium uses <b>test credits</b> only; no real payments are possible in this build.</div>
        </div>
        <div class="page-foot"><button class="btn" data-a="back">Back</button></div>
      </div>`;
      node.querySelectorAll('.ptrack').forEach((el) => {
        el.onclick = () => {
          const t = Number(el.dataset.tier), track = el.dataset.track;
          const slot = PASS_TIERS[t - 1][track];
          if (prof.canClaim(t, track)) {
            const r = prof.claim(t, track);
            if (r?.duplicate) app.screens.toast(`${r.item.name} already owned. Converted to ${r.credits} test credits.`);
            else if (r?.item) app.screens.toast(`${r.item.name} added to your Armory`);
            else if (r?.credits) app.screens.toast(`+${r.credits} test credits`);
            app.audio.ui('click');
          }
          if (slot?.item) { focus = slot.item; const it = COSMETICS[focus]; showPreview(app, it, prof.loadout.primary); }
          render();
        };
      });
      const sc = node.querySelector('.pass-scroll');
      const target = node.querySelector(`.ptier[data-tier="${Math.max(1, tier)}"]`);
      if (sc && target) sc.scrollLeft = Math.max(0, target.offsetLeft - 120);
      const A = (k, f) => { const b = node.querySelector(`[data-a=${k}]`); if (b) b.onclick = f; };
      A('back', () => app.screens.back());
      A('claimAll', () => { const rs = prof.claimAll(); const dup = rs.filter((r) => r.duplicate).length; app.screens.toast(`Claimed ${rs.length} reward${rs.length === 1 ? '' : 's'}${dup ? ` (${dup} duplicate${dup === 1 ? '' : 's'} converted to credits)` : ''}`); render(); });
      A('premium', () => {
        if (prof.data.credits < SEASON.premiumPrice) { app.screens.toast(`Not enough test credits: you need ${fmt(SEASON.premiumPrice - prof.data.credits)} more. Add test credits in the Store.`, 3200); return; }
        app.screens.confirm('Unlock Premium (test)?', `Spend ${fmt(SEASON.premiumPrice)} test credits to unlock the premium track for Season ${SEASON.number}. Balance after: ${fmt(prof.data.credits - SEASON.premiumPrice)} AC. No real money is involved.`, 'Unlock Premium', () => {
          const r = prof.buyPremium();
          app.screens.toast(r.ok ? 'Premium track unlocked. Claim your rewards.' : 'Could not unlock premium.');
          render();
        });
      });
    };
    render();
    entry.cleanup = () => app.preview.hide();
    entry.onBack = () => { app.screens.pop(); app.screens.refreshTop(); };
  },

  // ------------------------------------------------------------------ CHALLENGES
  challenges(app, node) {
    node.classList.add('shade-full');
    app.preview.hide();
    const prof = app.profile;
    prof.ensureChallenges();
    const defs = prof.challengeDefs();
    const nr = nextReset();
    const left = (t) => { const s = Math.max(0, Math.round((t - Date.now()) / 1000)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${m}m`; };
    const row = (c) => `<div class="chal ${c.done ? 'done' : ''}">
      <div class="chal-main"><div class="chal-t">${esc(c.text)}</div><div class="xpbar"><i style="width:${Math.round((c.progress / c.goal) * 100)}%"></i></div></div>
      <div class="chal-p">${fmt(c.progress)} / ${fmt(c.goal)}</div><div class="chal-x">${c.done ? '✓ ' : ''}+${fmt(c.xp)} XP</div></div>`;
    node.innerHTML = `<div class="page">${'<div class="page-head"><div><div class="kicker">Earn XP and battle pass progress</div><h1 class="title">Challenges</h1></div></div>'}
      <div class="page-body scroll" style="flex-direction:column;gap:18px">
        <div><h3 class="title">Daily <span class="muted small" style="letter-spacing:0.05em">· resets in ${left(nr.daily)} (00:00 UTC)</span></h3>${defs.daily.map(row).join('')}</div>
        <div><h3 class="title">Weekly <span class="muted small" style="letter-spacing:0.05em">· resets in ${left(nr.weekly)} (Monday 00:00 UTC)</span></h3>${defs.weekly.map(row).join('')}</div>
        <div class="muted small">Progress counts in completed Team Deathmatch matches (not the firing range). XP is paid automatically when a challenge completes and also advances the battle pass.</div>
      </div>
      <div class="page-foot"><button class="btn" data-a="back">Back</button></div></div>`;
    node.querySelector('[data-a=back]').onclick = () => app.screens.back();
  },

  // ------------------------------------------------------------------ STORE
  store(app, node, p, entry) {
    node.classList.add('shade');
    app.setMenuCamera('closeup');
    const prof = app.profile;
    let view = 'featured';
    let sel = p.focus ? { kind: 'item', id: p.focus } : null;
    const rot = currentRotation();
    const render = () => {
      const owned = prof.data.owned;
      const featured = [...new Set([...(p.focus && COSMETICS[p.focus]?.unlock.type === 'shop' ? [p.focus] : []), ...rot.featured])];
      if (!sel) sel = { kind: 'item', id: featured[0] };
      const card = (id) => {
        const it = COSMETICS[id], own = prof.owns(id);
        return `<button class="shop-it ${sel.kind === 'item' && sel.id === id ? 'sel' : ''}" data-item="${id}" style="--rc:${RARITY[it.rarity].color}">${itemThumb(it)}<div class="inv-name">${esc(it.name)}</div><div class="inv-sub">${rarityTag(it)} · ${TYPES[it.type].single}</div><div class="price">${own ? 'OWNED' : `${fmt(itemPrice(id))} AC`}</div></button>`;
      };
      const bcard = (b) => {
        const bp = bundlePrice(b, owned), all = bp.ownedCount === b.items.length;
        return `<button class="shop-it bundle ${sel.kind === 'bundle' && sel.id === b.id ? 'sel' : ''}" data-bundle="${b.id}"><div class="row" style="gap:4px">${b.items.map((i) => itemThumb(COSMETICS[i])).join('')}</div><div class="inv-name">${esc(b.name)}</div><div class="inv-sub">${b.items.length} items · ${Math.round(b.discount * 100)}% off${bp.ownedCount && !all ? ` · ${bp.ownedCount} owned (price reduced)` : ''}</div><div class="price">${all ? 'OWNED' : `<s>${fmt(b.items.reduce((s, i) => s + itemPrice(i), 0))}</s> ${fmt(bp.price)} AC`}</div></button>`;
      };
      let detail = '';
      if (sel.kind === 'item') {
        const it = COSMETICS[sel.id];
        const price = itemPrice(it.id), own = prof.owns(it.id), short = price - prof.data.credits;
        const acts = own
          ? `<div class="row" style="margin-top:12px"><span class="pill on">Owned</span><button class="btn" data-a="armory">Equip in Armory</button></div>`
          : `<div class="row" style="margin-top:12px;flex-wrap:wrap"><button class="btn primary" data-a="buy" ${short > 0 ? 'disabled' : ''}>Buy · ${fmt(price)} AC <span class="test-tag">TEST</span></button>${short > 0 ? `<span class="warn small">Not enough test credits (need ${fmt(short)} more)</span>` : ''}</div>`;
        detail = detailHtml(app, it, { actions: acts });
        showPreview(app, it, prof.loadout.primary);
      } else {
        const b = BUNDLES.find((x) => x.id === sel.id);
        const bp = bundlePrice(b, owned), all = bp.ownedCount === b.items.length, short = bp.price - prof.data.credits;
        detail = `<div class="kicker">Bundle · ${Math.round(b.discount * 100)}% off</div><h2 class="title">${esc(b.name)}</h2><div class="muted small" style="margin-bottom:8px">${esc(b.desc)}</div>
          ${b.items.map((i) => `<div class="row small" style="gap:8px;margin:4px 0">${itemThumb(COSMETICS[i])}<span>${esc(COSMETICS[i].name)}</span>${rarityTag(COSMETICS[i])}${prof.owns(i) ? '<span class="pill on">Owned</span>' : ''}</div>`).join('')}
          <div class="row" style="margin-top:12px;flex-wrap:wrap">${all ? '<span class="pill on">All items owned</span>' : `<button class="btn primary" data-a="buyb" ${short > 0 ? 'disabled' : ''}>Buy bundle · ${fmt(bp.price)} AC <span class="test-tag">TEST</span></button>${short > 0 ? `<span class="warn small">Not enough test credits (need ${fmt(short)} more)</span>` : ''}`}</div>`;
        showPreview(app, COSMETICS[b.items[0]], prof.loadout.primary);
      }
      const history = prof.data.purchases.slice().reverse();
      node.innerHTML = `<div class="page">
        <div class="page-head"><div><div class="kicker">Cosmetics only · test currency</div><h1 class="title">Store</h1></div><div class="spacer"></div>${creditsChip(app)}<button class="btn" data-a="topup" title="Demo only">+1,000 test credits</button></div>
        <div class="tabs"><button class="tab ${view === 'featured' ? 'sel' : ''}" data-v="featured">Featured</button><button class="tab ${view === 'history' ? 'sel' : ''}" data-v="history">Purchase History</button></div>
        <div class="page-body scroll" style="flex-direction:column;gap:14px;max-width:min(760px,56vw)">
          ${view === 'featured' ? `
            <div class="muted small">${esc(SHOP_CONFIG.demoLabel)} Featured items change daily, bundles weekly.</div>
            <h3 class="title">Featured today</h3><div class="shop-grid">${featured.map(card).join('')}</div>
            <h3 class="title">Bundles this week</h3><div class="shop-grid">${rot.bundles.map(bcard).join('')}</div>`
          : `<table class="sb"><thead><tr><th>When</th><th>Purchase</th><th class="num">Price</th><th class="num">Balance after</th></tr></thead><tbody>
              ${history.length ? history.map((h) => `<tr><td>${new Date(h.t).toLocaleString()}</td><td>${esc(h.name)}</td><td class="num">${h.price < 0 ? '+' + fmt(-h.price) : '−' + fmt(h.price)}</td><td class="num">${fmt(h.balance)}</td></tr>`).join('') : '<tr><td colspan="4" class="muted">No purchases yet.</td></tr>'}
            </tbody></table>`}
        </div>
        <div class="panel wpn-info detail">${detail}</div>
        <div class="page-foot"><button class="btn" data-a="back">Back</button><div class="spacer"></div><span class="muted small">Demo store: test credits only, simulated transactions, saved locally (not a secure economy). Purchases never affect gameplay.</span></div>
      </div>`;
      node.querySelectorAll('.tab').forEach((b) => { b.onclick = () => { view = b.dataset.v; render(); }; });
      node.querySelectorAll('[data-item]').forEach((b) => { b.onclick = () => { sel = { kind: 'item', id: b.dataset.item }; render(); }; });
      node.querySelectorAll('[data-bundle]').forEach((b) => { b.onclick = () => { sel = { kind: 'bundle', id: b.dataset.bundle }; render(); }; });
      const A = (k, f) => { const b = node.querySelector(`[data-a=${k}]`); if (b) b.onclick = f; };
      A('back', () => app.screens.back());
      A('topup', () => { prof.addTestCredits(1000); app.screens.toast('Added 1,000 TEST credits (demo only)'); render(); });
      A('armory', () => { const it = COSMETICS[sel.id]; app.screens.push('armory', { tab: it.type, item: it.id }); });
      A('buy', () => {
        const it = COSMETICS[sel.id], price = itemPrice(it.id);
        app.screens.confirm(`Buy ${it.name}?`, `${TYPES[it.type].single} · ${RARITY[it.rarity].name}. Price ${fmt(price)} test credits. Balance after: ${fmt(prof.data.credits - price)} AC.`, 'Confirm purchase', () => {
          const r = prof.buyItem(it.id);
          if (r.ok) purchased(app, [it], render);
          else app.screens.toast(r.reason === 'funds' ? 'Not enough test credits.' : r.reason === 'owned' ? 'You already own this item.' : 'Item unavailable.');
          render();
        });
      });
      A('buyb', () => {
        const b = BUNDLES.find((x) => x.id === sel.id), bp = bundlePrice(b, prof.data.owned);
        app.screens.confirm(`Buy ${b.name}?`, `${b.items.length - bp.ownedCount} new item(s) for ${fmt(bp.price)} test credits. Items you already own are excluded from the price. Balance after: ${fmt(prof.data.credits - bp.price)} AC.`, 'Confirm purchase', () => {
          const r = prof.buyBundle(b.id);
          if (r.ok) purchased(app, r.granted.map((g) => g.item), render);
          else app.screens.toast(r.reason === 'funds' ? 'Not enough test credits.' : 'You already own everything in this bundle.');
          render();
        });
      });
    };
    render();
    entry.cleanup = () => app.preview.hide();
    entry.onBack = () => { app.screens.pop(); app.screens.refreshTop(); };
  },
};

function purchased(app, items, rerender) {
  const m = document.createElement('div');
  m.className = 'modal';
  const first = items[0];
  m.innerHTML = `<div class="panel col" style="gap:12px"><div class="kicker">Purchase complete</div><h2 class="title">Added to your Armory</h2>
    <div>${items.map((i) => `<div class="row small" style="gap:8px;margin:4px 0">${itemThumb(i)}<b>${esc(i.name)}</b>${rarityTag(i)}</div>`).join('')}</div>
    <div class="row" style="justify-content:flex-end"><button class="btn" data-k="close">Keep shopping</button><button class="btn primary" data-k="equip">Equip ${esc(first.name)}</button></div></div>`;
  m.querySelector('[data-k=close]').onclick = () => m.remove();
  m.querySelector('[data-k=equip]').onclick = () => {
    m.remove();
    const prof = app.profile;
    if (first.type === 'finish' || first.type === 'charm') prof.equip(first.id, prof.loadout.primary);
    else if (first.type === 'outfit') { prof.equip(first.operator); prof.equip(first.id); }
    else prof.equip(first.id);
    app.screens.toast(`${first.name} equipped${first.type === 'finish' || first.type === 'charm' ? ` on ${WEAPONS[prof.loadout.primary].name}` : ''}`);
    rerender();
  };
  document.getElementById('ui').appendChild(m);
}

export { weaponXpToNext };

// Lobby: play setup, loadout, cosmetics, store, archives, settings, results. Includes a 3D preview.
import * as THREE from 'three';
import {
  SURVIVORS, KILLERS, SURVIVOR_PERKS, KILLER_PERKS, ITEMS, ITEM_ADDONS, KILLER_ADDONS, OFFERINGS, MAPS, RARITIES,
  SURVIVOR_BY_ID, KILLER_BY_ID, PERK_BY_ID, ITEM_BY_ID, ADDON_BY_ID, OFFERING_BY_ID, SURVIVOR_CATEGORIES, KILLER_CATEGORIES, VERSION, PTB_NOTE, outfitOf,
} from '../data.js';
import { buildWoodsman } from '../models/woodsman.js';
import { profile, saveProfile, ownsPerk, ownsOutfit, countOf, buy, resetProfile } from '../core/profile.js';
import { buildSurvivor, buildSpecter, buildExe, poseSurvivor, poseKiller, drawExeFace } from '../models/characters.js';
import { glowSpriteTexture, groundTexture } from '../world/textures.js';
import { icon } from './icons.js';
import { audio } from '../audio/audio.js';

const TABS = [['play', 'Play'], ['loadout', 'Loadout'], ['wardrobe', 'Wardrobe'], ['store', 'Reliquary'], ['archives', 'Archives'], ['settings', 'Settings']];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rarityStyle = (r) => `style="--rar:${RARITIES[r].color}"`;

export class Lobby {
  constructor(root, ctx) {
    this.root = root;
    this.ctx = ctx;
    this.tab = 'play';
    this.storeTab = 'perks';
    this.slot = null;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0d12);
    this.scene.fog = new THREE.FogExp2(0x0b0d12, 0.09);
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    this.camera.position.set(0, 1.4, 6.2);
    this.camera.lookAt(0, 1.05, 0);
    const hemi = new THREE.HemisphereLight(0x4a5878, 0x120c08, 0.7);
    this.lamp = new THREE.SpotLight(0xffb060, 30, 14, 0.6, 0.6, 1.4);
    this.lamp.position.set(1.6, 4.2, 1.8);
    this.lamp.target.position.set(0, 0.8, 0);
    this.lamp.castShadow = true;
    this.lamp.shadow.mapSize.set(1024, 1024);
    const rim = new THREE.DirectionalLight(0x7a9ad8, 1.6);
    rim.position.set(-3, 3, -4);
    this.scene.add(hemi, this.lamp, this.lamp.target, rim);
    const g = groundTexture('farm');
    const ground = new THREE.Mesh(new THREE.CircleGeometry(9, 40), new THREE.MeshStandardMaterial({ map: g.map, normalMap: g.normalMap, roughness: 1 }));
    g.map.repeat.set(3, 3); g.normalMap.repeat.set(3, 3);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    // lamp post
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 4.4, 8), new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.6, metalness: 0.5 }));
    post.position.set(2.2, 2.2, 1.0);
    this.scene.add(post);
    const bulb = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSpriteTexture(), color: 0xffb060, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    bulb.scale.set(1.6, 1.6, 1);
    bulb.position.set(1.8, 4.3, 1.4);
    this.bulb = bulb;
    this.scene.add(bulb);
    // drifting fog motes
    const n = 220, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 10; pos[i * 3 + 1] = Math.random() * 4; pos[i * 3 + 2] = (Math.random() - 0.5) * 8; }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.motes = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0x9aa6c0, size: 0.03, transparent: true, opacity: 0.6 }));
    this.scene.add(this.motes);
    this.model = null;
    this.modelKey = '';
    this.rotY = 0.4;
    this.t = 0;
    this.results = null;
    root.addEventListener('pointerdown', (e) => { if (e.target.closest('.lb-stage')) { this.drag = e.clientX; } });
    window.addEventListener('pointermove', (e) => { if (this.drag !== undefined && this.drag !== null) { this.rotY += (e.clientX - this.drag) * 0.01; this.drag = e.clientX; } });
    window.addEventListener('pointerup', () => { this.drag = null; });
  }

  /* ---------------- 3D preview ---------------- */

  charId() { return profile.role === 'killer' ? profile.killer : profile.survivor; }
  charDef() { return profile.role === 'killer' ? KILLER_BY_ID[profile.killer] : SURVIVOR_BY_ID[profile.survivor]; }

  refreshModel(previewOutfit = null) {
    const def = this.charDef();
    const outfitId = previewOutfit || profile.equipped[def.id];
    const key = def.id + outfitId;
    if (key === this.modelKey) return;
    this.modelKey = key;
    if (this.model) { this.scene.remove(this.model.root); }
    const outfit = outfitOf(def, outfitId);
    this.model = profile.role === 'killer' ? (def.id === 'specter' ? buildSpecter(outfit) : def.id === 'woodsman' ? buildWoodsman(outfit) : buildExe(outfit)) : buildSurvivor(def, outfit);
    this.scene.add(this.model.root);
    this.camera.position.set(0, profile.role === 'killer' ? 1.5 : 1.3, profile.role === 'killer' ? 6.8 : 5.6);
    this.camera.lookAt(0, profile.role === 'killer' ? 1.15 : 0.98, 0);
  }

  render(renderer, dt) {
    this.t += dt;
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    const wide = w > 900;
    this.camera.aspect = w / h;
    this.camera.setViewOffset(w, h, wide ? -w * 0.17 : 0, wide ? 0 : h * 0.12, w, h);
    this.camera.updateProjectionMatrix();
    if (this.model) {
      this.model.root.rotation.y = this.rotY + Math.sin(this.t * 0.3) * 0.15;
      if (this.model.kind === 'survivor') poseSurvivor(this.model, { mode: 'stand', speed: 0, dt });
      else {
        poseKiller(this.model, { mode: 'move', speed: 0, dt });
        if (this.model.kind === 'exe') {
          this.model.mat.userData.uniforms.uTime.value = this.t;
          this.model.mat.userData.uniforms.uGlitch.value = Math.random() < 0.02 ? 1 : 0.1;
          if (Math.floor(this.t * 12) !== this.ff) { this.ff = Math.floor(this.t * 12); drawExeFace(this.model, this.t); }
        }
      }
    }
    const fl = 0.85 + Math.sin(this.t * 17) * 0.05 + (Math.random() < 0.03 ? -0.5 : 0);
    this.lamp.intensity = 30 * fl;
    this.bulb.material.opacity = fl;
    const p = this.motes.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { p.setX(i, p.getX(i) + dt * 0.08); if (p.getX(i) > 5) p.setX(i, -5); }
    p.needsUpdate = true;
    renderer.render(this.scene, this.camera);
  }

  /* ---------------- DOM ---------------- */

  show() {
    this.root.hidden = false;
    this.draw();
  }

  hide() { this.root.hidden = true; }

  draw() {
    this.refreshModel();
    const tabs = TABS.map(([id, label]) => `<button class="lb-tab ${this.tab === id ? 'on' : ''}" data-tab="${id}">${label}</button>`).join('');
    this.root.innerHTML = `
      <header class="lb-top">
        <div class="lb-brand"><span class="lb-title">Colton's Horrors</span><span class="lb-ver">v${VERSION} · PTB</span></div>
        <div class="lb-role" role="group" aria-label="Side">
          <button class="${profile.role === 'survivor' ? 'on' : ''}" data-role="survivor">Survivor</button>
          <button class="${profile.role === 'killer' ? 'on' : ''}" data-role="killer">Killer</button>
        </div>
        <div class="lb-marrow" title="Marrow: earned in matches, spent in the Reliquary">${icon('drop')}<b>${profile.marrow.toLocaleString()}</b><span>Marrow</span></div>
      </header>
      <nav class="lb-tabs">${tabs}</nav>
      <main class="lb-panel">${this.results ? this.resultsHtml() : this.panel()}</main>
      <div class="lb-stage" aria-hidden="true"></div>
      ${this.results ? '' : `<button class="lb-go" data-go>Enter the night<span>${profile.role === 'killer' ? 'as ' + KILLER_BY_ID[profile.killer].name : 'as ' + SURVIVOR_BY_ID[profile.survivor].name}</span></button>`}
    `;
    this.bind();
  }

  panel() {
    switch (this.tab) {
      case 'play': return this.playHtml();
      case 'loadout': return this.loadoutHtml();
      case 'wardrobe': return this.wardrobeHtml();
      case 'store': return this.storeHtml();
      case 'archives': return this.archivesHtml();
      default: return this.settingsHtml();
    }
  }

  playHtml() {
    const role = profile.role;
    const list = role === 'killer' ? KILLERS : SURVIVORS;
    const cur = this.charId();
    const def = this.charDef();
    const cards = list.map((c) => `<button class="lb-char ${c.id === cur ? 'on' : ''}" data-char="${c.id}"><b>${esc(c.name)}${c.ptb ? ' <i class="ptb">PTB</i>' : ''}</b><span>${esc(c.role || c.realName)}</span></button>`).join('');
    const opp = role === 'survivor' ? `
      <label class="lb-field"><span>Killer to face</span>
        <select id="opp">${[['random', 'Random'], ...KILLERS.map((k) => [k.id, k.name])].map(([v, l]) => `<option value="${v}" ${profile.opponent === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>` : '';
    const lo = profile.loadout[role];
    const perkChips = lo.perks.map((p) => (p ? `<span class="chip">${icon(PERK_BY_ID[p].icon)}${esc(PERK_BY_ID[p].name)}</span>` : '<span class="chip empty">Empty perk slot</span>')).join('');
    const extra = role === 'survivor'
      ? (lo.item ? `<span class="chip">${icon(ITEM_BY_ID[lo.item].icon)}${esc(ITEM_BY_ID[lo.item].name)} ×${countOf(lo.item)}</span>` : '<span class="chip empty">No item</span>')
      : (profile.loadout.killer.addons[profile.killer] || []).filter(Boolean).map((a) => `<span class="chip">${icon('addon')}${esc(ADDON_BY_ID[a].name)}</span>`).join('');
    const off = lo.offering ? `<span class="chip">${icon(OFFERING_BY_ID[lo.offering].icon)}${esc(OFFERING_BY_ID[lo.offering].name)}</span>` : '';
    return `
      <section class="lb-sec">
        <h2>${role === 'killer' ? 'Choose your killer' : 'Choose your survivor'}</h2>
        <div class="lb-chars">${cards}</div>
        <article class="lb-bio">
          <h3>${esc(def.name)}${def.realName ? ` <small>${esc(def.realName)}</small>` : def.age ? ` <small>${def.age} · ${esc(def.role)}</small>` : ''}</h3>
          <p class="lore">${esc(def.bio)}</p>
          ${def.ptb ? `<p class="ptb-note"><i class="ptb">PTB</i> ${esc(PTB_NOTE)}</p>` : ''}
          ${role === 'killer' ? `<p class="power">${icon(def.power.glyph)}<b>${esc(def.power.name)}.</b> ${esc(def.power.desc)}</p><p class="meta">Weapon: ${esc(def.weapon)} · Speed ${def.speed} m/s · Terror radius ${def.terror} m</p>` : `<p class="meta">Signature perk: <b>${esc(PERK_BY_ID[def.signature].name)}</b></p>`}
        </article>
      </section>
      <section class="lb-sec">
        <h2>Match</h2>
        <div class="lb-row">${opp}
          <label class="lb-field"><span>Bot difficulty</span>
            <select id="diff">${['easy', 'normal', 'hard'].map((d) => `<option ${profile.settings.difficulty === d ? 'selected' : ''} value="${d}">${d[0].toUpperCase() + d.slice(1)}</option>`).join('')}</select></label>
        </div>
        ${role === 'killer' ? '<p class="meta"><b>Moris:</b> burn an Ashen Rite to execute downed survivors who have been hooked once (press R next to them). Without it you can still finish off the <b>last survivor standing</b> with a mini mori.</p>' : ''}
        <p class="meta">The map is chosen at random unless you burn a map offering. Four maps: ${MAPS.map((mp) => esc(mp.name)).join(', ')}.</p>
        <div class="lb-chips">${perkChips}${extra}${off}</div>
        <button class="btn-ghost" data-tab="loadout">Edit loadout</button>
      </section>`;
  }

  loadoutHtml() {
    const role = profile.role;
    const lo = profile.loadout[role];
    const perkList = role === 'killer' ? KILLER_PERKS : SURVIVOR_PERKS;
    const slots = lo.perks.map((p, i) => `<button class="lb-slot ${this.slot === 'perk' + i ? 'on' : ''}" data-slot="perk${i}">${p ? `${icon(PERK_BY_ID[p].icon)}<b>${esc(PERK_BY_ID[p].name)}</b>` : '<b class="dim">Empty</b>'}<span>Perk ${i + 1}</span></button>`).join('');
    let gear = '';
    if (role === 'survivor') {
      gear = `<button class="lb-slot ${this.slot === 'item' ? 'on' : ''}" data-slot="item">${lo.item ? `${icon(ITEM_BY_ID[lo.item].icon)}<b>${esc(ITEM_BY_ID[lo.item].name)}</b>` : '<b class="dim">No item</b>'}<span>Item</span></button>` +
        lo.addons.map((a, i) => `<button class="lb-slot ${this.slot === 'addon' + i ? 'on' : ''}" data-slot="addon${i}" ${lo.item ? '' : 'disabled'}>${a ? `${icon('addon')}<b>${esc(ADDON_BY_ID[a].name)}</b>` : '<b class="dim">Empty</b>'}<span>Add-on ${i + 1}</span></button>`).join('');
    } else {
      const ad = profile.loadout.killer.addons[profile.killer];
      gear = ad.map((a, i) => `<button class="lb-slot ${this.slot === 'addon' + i ? 'on' : ''}" data-slot="addon${i}">${a ? `${icon('addon')}<b>${esc(ADDON_BY_ID[a].name)}</b>` : '<b class="dim">Empty</b>'}<span>Power add-on ${i + 1}</span></button>`).join('');
    }
    gear += `<button class="lb-slot ${this.slot === 'offering' ? 'on' : ''}" data-slot="offering">${lo.offering ? `${icon(OFFERING_BY_ID[lo.offering].icon)}<b>${esc(OFFERING_BY_ID[lo.offering].name)}</b>` : '<b class="dim">None</b>'}<span>Offering</span></button>`;
    let picker = '<p class="meta">Pick a slot to change it. Items, add-ons and offerings are used up when the match starts. Buy more in the Reliquary.</p>';
    const s = this.slot;
    if (s && s.startsWith('perk')) {
      const i = +s[4];
      picker = `<div class="lb-list">${perkList.map((p) => {
        const owned = ownsPerk(p.id);
        const used = lo.perks.includes(p.id) && lo.perks[i] !== p.id;
        return `<button class="lb-opt ${lo.perks[i] === p.id ? 'on' : ''}" data-pick="${p.id}" ${!owned || used ? 'disabled' : ''}>${icon(p.icon)}<div><b>${esc(p.name)}</b><span>${esc(p.desc)}</span>${!owned ? `<em>${icon('lock')}Locked · ${p.price.toLocaleString()} Marrow</em>` : ''}</div></button>`;
      }).join('')}<button class="lb-opt" data-pick="">${icon('addon')}<div><b>Leave empty</b></div></button></div>`;
    } else if (s === 'item') {
      picker = `<div class="lb-list">${ITEMS.map((it) => `<button class="lb-opt ${lo.item === it.id ? 'on' : ''}" ${rarityStyle(it.rarity)} data-pick="${it.id}" ${countOf(it.id) ? '' : 'disabled'}>${icon(it.icon)}<div><b>${esc(it.name)} <small>×${countOf(it.id)}</small></b><span>${esc(it.desc)}</span></div></button>`).join('')}<button class="lb-opt" data-pick="">${icon('addon')}<div><b>No item</b></div></button></div>`;
    } else if (s && s.startsWith('addon')) {
      const i = +s[5];
      const list = role === 'survivor' ? ITEM_ADDONS.filter((a) => a.item === lo.item) : KILLER_ADDONS.filter((a) => a.killer === profile.killer);
      const cur = role === 'survivor' ? lo.addons : profile.loadout.killer.addons[profile.killer];
      picker = `<div class="lb-list">${list.map((a) => `<button class="lb-opt ${cur[i] === a.id ? 'on' : ''}" ${rarityStyle(a.rarity)} data-pick="${a.id}" ${countOf(a.id) && !(cur.includes(a.id) && cur[i] !== a.id) ? '' : 'disabled'}>${icon('addon')}<div><b>${esc(a.name)} <small>×${countOf(a.id)} · ${RARITIES[a.rarity].name}</small></b><span>${esc(a.desc)}</span></div></button>`).join('')}<button class="lb-opt" data-pick="">${icon('addon')}<div><b>Leave empty</b></div></button></div>`;
    } else if (s === 'offering') {
      const list = OFFERINGS.filter((o) => o.side === 'any' || o.side === role);
      picker = `<div class="lb-list">${list.map((o) => `<button class="lb-opt ${lo.offering === o.id ? 'on' : ''}" ${rarityStyle(o.rarity)} data-pick="${o.id}" ${countOf(o.id) ? '' : 'disabled'}>${icon(o.icon)}<div><b>${esc(o.name)} <small>×${countOf(o.id)}</small></b><span>${esc(o.desc)}</span></div></button>`).join('')}<button class="lb-opt" data-pick="">${icon('addon')}<div><b>No offering</b></div></button></div>`;
    }
    return `<section class="lb-sec"><h2>Perks</h2><div class="lb-slots">${slots}</div><h2>${role === 'survivor' ? 'Item and offering' : 'Add-ons and offering'}</h2><div class="lb-slots">${gear}</div></section><section class="lb-sec">${picker}</section>`;
  }

  wardrobeHtml() {
    const def = this.charDef();
    const eq = profile.equipped[def.id];
    const list = def.outfits.map((o) => {
      const owned = ownsOutfit(o.id);
      return `<button class="lb-outfit ${eq === o.id ? 'on' : ''}" ${rarityStyle(o.rarity)} data-outfit="${o.id}">
        <div class="sw">${['topColor', 'accent', 'legsColor', 'dress', 'dress2', 'body', 'glow', 'glow2', 'plaid', 'plaid2', 'mask'].filter((k) => o[k]).slice(0, 3).map((k) => `<i style="background:${o[k]}"></i>`).join('')}</div>
        <b>${esc(o.name)}</b><span>${RARITIES[o.rarity].name}</span>
        <em>${eq === o.id ? 'Equipped' : owned ? 'Equip' : `${icon('lock')}${o.price.toLocaleString()}`}</em></button>`;
    }).join('');
    return `<section class="lb-sec"><h2>${esc(def.name)}: outfits</h2><p class="meta">Click an outfit to preview it. Equip ones you own, or buy new ones with Marrow.</p><div class="lb-outfits">${list}</div></section>`;
  }

  storeHtml() {
    const role = profile.role;
    const tabs = [['perks', 'Perks'], ['items', role === 'survivor' ? 'Items' : 'Power add-ons'], ['addons', role === 'survivor' ? 'Item add-ons' : 'Other killer'], ['offerings', 'Offerings']];
    let list = [];
    const t = this.storeTab;
    if (t === 'perks') list = (role === 'killer' ? KILLER_PERKS : SURVIVOR_PERKS).map((p) => ({ kind: 'perk', def: p, ic: p.icon, owned: ownsPerk(p.id) }));
    else if (t === 'items') list = role === 'survivor' ? ITEMS.map((i) => ({ kind: 'item', def: i, ic: i.icon })) : KILLER_ADDONS.filter((a) => a.killer === profile.killer).map((a) => ({ kind: 'addon', def: a, ic: 'addon' }));
    else if (t === 'addons') list = role === 'survivor' ? ITEM_ADDONS.map((a) => ({ kind: 'addon', def: a, ic: 'addon', sub: ITEM_BY_ID[a.item].name })) : KILLER_ADDONS.filter((a) => a.killer !== profile.killer).map((a) => ({ kind: 'addon', def: a, ic: 'addon', sub: KILLER_BY_ID[a.killer].name }));
    else list = OFFERINGS.filter((o) => o.side === 'any' || o.side === role).map((o) => ({ kind: 'offering', def: o, ic: o.icon }));
    const rows = list.map((x) => {
      const d = x.def;
      const can = profile.marrow >= d.price;
      return `<div class="lb-buy" ${d.rarity ? rarityStyle(d.rarity) : ''}>${icon(x.ic)}<div><b>${esc(d.name)}</b>${x.sub ? `<small>${esc(x.sub)}</small>` : ''}<span>${esc(d.desc)}</span></div>
        <div class="lb-buy-act">${x.kind === 'perk' ? '' : `<small>Owned ×${countOf(d.id)}</small>`}
        ${x.owned ? '<em>Unlocked</em>' : `<button class="btn" data-buy="${x.kind}:${d.id}" ${can ? '' : 'disabled'}>${d.price.toLocaleString()}</button>`}</div></div>`;
    }).join('');
    return `<section class="lb-sec"><h2>The Reliquary</h2><div class="lb-subtabs">${tabs.map(([id, l]) => `<button class="${t === id ? 'on' : ''}" data-store="${id}">${l}</button>`).join('')}</div><div class="lb-shop">${rows}</div></section>`;
  }

  archivesHtml() {
    return `<section class="lb-sec lb-arch">
      <h2>Patch notes: 1.1.0 (PTB)</h2>
      <ul>
        <li><b>New killer on the PTB: The Woodsman.</b> A logger in a carved birch mask with a felling axe. His power, <b>Heavy Chop</b>, charges a long lunging chop that smashes dropped pallets. Comes with 2 perks (Timber!, Splinter), 6 add-ons and 4 outfits.</li>
        <li><b>Moris.</b> The new <b>Ashen Rite</b> offering lets the killer execute any downed survivor who has been hooked at least once. Every killer has their own execution.</li>
        <li><b>Mini moris.</b> With no offering at all, the killer can finish off the last survivor standing once they are down. Press <b>R</b> (or the Mori button on touch).</li>
        <li>Bot killers sometimes burn an Ashen Rite. You will see a warning at the start of the match.</li>
      </ul>
      <h2>How a night works</h2>
      <p>Four survivors start together. They need to repair <b>5 of the 7 generators</b>, then hold an <b>exit gate</b> switch open and run. The killer hunts them: two hits put a survivor down, and a downed survivor can be carried to a <b>hook</b>. A third hook (or a long enough wait) means they are sacrificed. When one survivor is left, a <b>hatch</b> opens somewhere on the map. Once a gate opens, the dark closes in for two minutes.</p>
      <h3>Survivor controls</h3>
      <ul><li><b>WASD</b> move, <b>Shift</b> run, <b>C</b> crouch</li><li>Hold <b>Left mouse</b> or <b>E</b>: repair, heal, unhook, open gates, search chests, unplug screens</li><li><b>Space</b>: vault windows and pallets, drop a pallet on the killer, hit skill checks</li><li>Hold <b>Right mouse</b> or <b>F</b>: use your item</li><li>When carried, tap <b>A</b> and <b>D</b> to wiggle free. On the hook's second stage, keep pressing <b>Space</b>.</li></ul>
      <h3>Killer controls</h3>
      <ul><li><b>WASD</b> move, <b>Left mouse</b> attack (hold to lunge), <b>R</b> mori</li><li><b>Space</b> or <b>E</b>: pick up, hook, break pallets, damage generators, vault, close the hatch</li><li>Hold <b>Right mouse</b> or <b>Q</b>: your power</li></ul>
      <p class="meta">On a phone or tablet the game shows a stick and buttons. Running, running into pallets and missed skill checks all make noise, and running leaves scratch marks that only the killer can see.</p>
      <h2>The killers</h2>
      ${KILLERS.map((k) => `<h3>${esc(k.name)} <small>${esc(k.realName)}</small></h3><p class="lore">${esc(k.bio)}</p>`).join('')}
      <h2>The survivors</h2>
      ${SURVIVORS.map((s) => `<h3>${esc(s.name)} <small>${s.age} · ${esc(s.role)}</small></h3><p class="lore">${esc(s.bio)}</p>`).join('')}
      <h2>The maps</h2>
      ${MAPS.map((mp) => `<h3>${esc(mp.name)} <small>${esc(mp.region)}</small></h3><p class="lore">${esc(mp.desc)}</p>`).join('')}
      <h2>Your record</h2>
      <p class="meta">Matches ${profile.stats.matches} · Escapes ${profile.stats.escapes} · Times sacrificed ${profile.stats.sacrifices} · Generators repaired ${profile.stats.gens} · Survivors hooked ${profile.stats.hooks} · Kills ${profile.stats.kills}</p>
    </section>`;
  }

  settingsHtml() {
    const s = profile.settings;
    const sel = (id, opts, cur) => `<select id="${id}">${opts.map(([v, l]) => `<option value="${v}" ${String(cur) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    return `<section class="lb-sec"><h2>Settings</h2>
      <div class="lb-form">
        <label class="lb-field"><span>Graphics quality</span>${sel('set-quality', [['auto', 'Auto'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High (bloom, sharper shadows)']], s.quality)}</label>
        <label class="lb-field"><span>Mouse sensitivity: <b id="sens-v">${s.sensitivity.toFixed(2)}</b></span><input id="set-sens" type="range" min="0.2" max="3" step="0.05" value="${s.sensitivity}"></label>
        <label class="lb-field"><span>Field of view: <b id="fov-v">${s.fov}</b></span><input id="set-fov" type="range" min="65" max="100" step="1" value="${s.fov}"></label>
        <label class="lb-field"><span>Master volume</span><input id="set-vol" type="range" min="0" max="1" step="0.05" value="${s.volume}"></label>
        <label class="lb-field"><span>Music and heartbeat</span><input id="set-music" type="range" min="0" max="1" step="0.05" value="${s.music}"></label>
        <label class="lb-check"><input id="set-invert" type="checkbox" ${s.invertY ? 'checked' : ''}> Invert mouse Y</label>
        <label class="lb-check"><input id="set-hints" type="checkbox" ${s.hints ? 'checked' : ''}> Show nearby generator markers (survivor)</label>
        <label class="lb-check"><input id="set-fps" type="checkbox" ${s.showFps ? 'checked' : ''}> Show frame rate</label>
      </div>
      <h2>Progress</h2>
      <p class="meta">Your Marrow, unlocks and inventory are saved in this browser only.</p>
      <div class="lb-row"><button class="btn-ghost" id="reset1">Reset all progress</button><button class="btn danger" id="reset2" hidden>Yes, erase everything</button></div>
    </section>`;
  }

  resultsHtml() {
    const r = this.results;
    const cats = r.role === 'killer' ? KILLER_CATEGORIES : SURVIVOR_CATEGORIES;
    const headline = r.role === 'killer'
      ? (r.kills >= 3 ? 'A good night\'s hunt' : r.kills ? 'Some got away' : 'They all slipped away')
      : (r.playerOutcome && r.playerOutcome.startsWith('escaped') ? 'You made it out' : r.playerOutcome === 'executed' ? 'You were executed' : r.playerOutcome === 'finished off' ? 'You were finished off' : r.playerOutcome === 'sacrificed' ? 'You were sacrificed' : r.playerOutcome === 'bled out' ? 'You bled out' : r.playerOutcome === 'taken' ? 'The dark took you' : 'You left the match');
    return `<section class="lb-sec lb-results">
      <h2 class="res-h">${headline}</h2>
      <p class="meta">${esc(r.map)} · against ${esc(r.killer)} · ${r.gens} generators repaired</p>
      <div class="res-fates">${r.survivors.map((s) => `<div class="res-fate ${s.outcome.startsWith('escaped') ? 'ok' : s.outcome === 'left behind' || s.outcome === 'left early' ? '' : 'bad'}"><b>${esc(s.name)}${s.isPlayer ? ' (you)' : ''}</b><span>${esc(s.outcome)}</span></div>`).join('')}</div>
      <div class="res-cats">${cats.map((c) => `<div class="res-cat"><span>${c.name}</span><div class="h-meter"><i style="width:${Math.min(100, (r.score[c.id] / 8000) * 100)}%"></i></div><b>${r.score[c.id].toLocaleString()}</b></div>`).join('')}</div>
      <p class="res-total">${icon('drop')} +${r.total.toLocaleString()} Marrow</p>
      <button class="btn" data-continue>Back to the lobby</button>
    </section>`;
  }

  bind() {
    const R = this.root;
    const click = (sel, fn) => R.querySelectorAll(sel).forEach((b) => b.addEventListener('click', (e) => { audio.play('click'); fn(b, e); }));
    click('[data-tab]', (b) => { this.tab = b.dataset.tab; this.slot = null; this.results = null; this.draw(); });
    click('[data-role]', (b) => { profile.role = b.dataset.role; this.slot = null; saveProfile(); this.draw(); });
    click('[data-char]', (b) => { if (profile.role === 'killer') profile.killer = b.dataset.char; else profile.survivor = b.dataset.char; saveProfile(); this.draw(); });
    click('[data-go]', () => this.onPlay && this.onPlay());
    click('[data-continue]', () => { this.results = null; this.tab = 'play'; this.draw(); });
    click('[data-slot]', (b) => { this.slot = this.slot === b.dataset.slot ? null : b.dataset.slot; this.draw(); });
    click('[data-pick]', (b) => this.pick(b.dataset.pick || null));
    click('[data-store]', (b) => { this.storeTab = b.dataset.store; this.draw(); });
    click('[data-buy]', (b) => {
      const [kind, id] = b.dataset.buy.split(':');
      const def = kind === 'perk' ? PERK_BY_ID[id] : kind === 'item' ? ITEM_BY_ID[id] : kind === 'addon' ? ADDON_BY_ID[id] : OFFERING_BY_ID[id];
      if (buy(kind, def)) audio.play('buy');
      this.draw();
    });
    click('[data-outfit]', (b) => {
      const id = b.dataset.outfit;
      const def = this.charDef();
      if (ownsOutfit(id)) { profile.equipped[def.id] = id; saveProfile(); this.draw(); return; }
      if (this.previewing === id) {
        const o = def.outfits.find((x) => x.id === id);
        if (buy('outfit', o)) { audio.play('buy'); profile.equipped[def.id] = id; saveProfile(); }
        this.previewing = null;
        this.draw();
        return;
      }
      this.previewing = id;
      this.refreshModel(id);
      R.querySelectorAll('.lb-outfit').forEach((x) => x.classList.toggle('preview', x.dataset.outfit === id));
      const em = b.querySelector('em');
      const o = def.outfits.find((x) => x.id === id);
      em.textContent = profile.marrow >= o.price ? `Click again to buy: ${o.price.toLocaleString()}` : `Need ${o.price.toLocaleString()} Marrow`;
    });
    const on = (id, ev, fn) => { const el = R.querySelector('#' + id); if (el) el.addEventListener(ev, () => fn(el)); };
    on('opp', 'change', (el) => { profile.opponent = el.value; saveProfile(); });
    on('diff', 'change', (el) => { profile.settings.difficulty = el.value; saveProfile(); });
    on('set-quality', 'change', (el) => { profile.settings.quality = el.value; saveProfile(); this.ctx.applyQuality(); });
    on('set-sens', 'input', (el) => { profile.settings.sensitivity = +el.value; R.querySelector('#sens-v').textContent = (+el.value).toFixed(2); saveProfile(); });
    on('set-fov', 'input', (el) => { profile.settings.fov = +el.value; R.querySelector('#fov-v').textContent = el.value; saveProfile(); });
    on('set-vol', 'input', (el) => { profile.settings.volume = +el.value; audio.setVolume(profile.settings.volume, profile.settings.music); saveProfile(); });
    on('set-music', 'input', (el) => { profile.settings.music = +el.value; audio.setVolume(profile.settings.volume, profile.settings.music); saveProfile(); });
    on('set-invert', 'change', (el) => { profile.settings.invertY = el.checked; saveProfile(); });
    on('set-hints', 'change', (el) => { profile.settings.hints = el.checked; saveProfile(); });
    on('set-fps', 'change', (el) => { profile.settings.showFps = el.checked; saveProfile(); });
    on('reset1', 'click', () => { R.querySelector('#reset2').hidden = false; });
    on('reset2', 'click', () => { resetProfile(); this.ctx.applyQuality(); this.draw(); });
  }

  pick(id) {
    const role = profile.role;
    const lo = profile.loadout[role];
    const s = this.slot;
    if (s.startsWith('perk')) lo.perks[+s[4]] = id;
    else if (s === 'item') { if (lo.item !== id) lo.addons = [null, null]; lo.item = id; }
    else if (s.startsWith('addon')) { if (role === 'survivor') lo.addons[+s[5]] = id; else profile.loadout.killer.addons[profile.killer][+s[5]] = id; }
    else if (s === 'offering') lo.offering = id;
    this.slot = null;
    saveProfile();
    this.draw();
  }
}

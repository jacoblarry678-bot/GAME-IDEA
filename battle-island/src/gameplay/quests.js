/**
 * Story NPCs and their in-match quests. Three islanders wait by the quiet
 * houses; press E to take their quest, do the steps, then come back for the
 * reward (Benton Bucks and a weapon at their feet, plus quest XP after the
 * match). Quests run on the host (solo counts as host); clients see their
 * own progress through the private state (`pv.qs`).
 */

import * as THREE from 'three';
import { WATER_Y } from '../world/physics.js';
import { makeWeapon } from './items.js';
import { textTexture } from '../world/island.js';
import { sfx } from '../core/audio.js';

export const QUEST_XP = 750;

/** stat(a): the running total a step counts from (progress = now - value at step start). */
const STATS = {
  harvest: (a) => a.stats.harvest || 0,
  built: (a) => a.stats.built || 0,
  kills: (a) => a.kills,
};

export const NPCS = [
  {
    id: 'gus', name: 'Grandpa Gus', near: 'Farm House', color: '#8a5a33', shirt: '#4f7a3a', hat: '#d9b36a',
    title: 'Fix Up the Farm',
    hello: 'The storm knocked my fences flat! Can you help me patch things up?',
    thanks: 'Good as new! Take this for your trouble.',
    steps: [
      { text: 'Harvest 60 materials', stat: 'harvest', n: 60 },
      { text: 'Build 6 pieces', stat: 'built', n: 6 },
      { text: 'Return to Grandpa Gus', talk: true },
    ],
    reward: { bucks: 150, weapon: 'shotgun', rarity: 3 },
  },
  {
    id: 'kay', name: 'Captain Kay', near: 'Fishing Shack', color: '#e2b48c', shirt: '#2f6fb0', hat: '#f4f4f4',
    title: 'Lost Tackle',
    hello: 'A big wave scattered my tackle boxes all over the island. Find three?',
    thanks: "My lucky lures! Here's something from the boat.",
    steps: [
      { text: 'Find 3 lost tackle boxes', gather: 3 },
      { text: 'Return to Captain Kay', talk: true },
    ],
    reward: { bucks: 200, weapon: 'ar', rarity: 3 },
  },
  {
    id: 'rae', name: 'Ranger Rae', near: 'Lookout Cabin', color: '#b07a52', shirt: '#6b7f3a', hat: '#3f5a2a',
    title: 'Scout Report',
    hello: 'I need eyes on the island. Check out three places, then show me you can handle trouble.',
    thanks: 'Great scouting! Take my spare scope rifle.',
    steps: [
      { text: 'Visit 3 named places', visit: 3 },
      { text: 'Eliminate an opponent', stat: 'kills', n: 1 },
      { text: 'Return to Ranger Rae', talk: true },
    ],
    reward: { bucks: 150, weapon: 'sniper', rarity: 3 },
  },
];

export class Quests {
  constructor(game) {
    this.game = game;
    const W = game.world;
    this.root = new THREE.Group();
    this.npcs = NPCS.map((def, i) => this._npc(def, i));
    // Captain Kay's tackle boxes: fixed spots spread over the island's floor-loot spots
    const spots = W.lootSpots.filter((s) => W.height(s.x, s.z) > WATER_Y + 0.5 && s.y - W.height(s.x, s.z) < 1.5);
    this.tackle = [];
    for (let i = 0; i < 6; i++) {
      const s = spots[Math.floor(((i + 0.5) / 6) * spots.length)];
      const pos = new THREE.Vector3(s.x, s.y - 0.1, s.z);
      const mesh = tackleModel();
      mesh.position.copy(pos);
      mesh.visible = false;
      this.root.add(mesh);
      this.tackle.push({ i, pos, mesh });
    }
    this.places = [...W.pois.map((p) => ({ name: p.name, x: p.x, z: p.z, r: p.r })), ...W.minor.map((p) => ({ name: p.name, x: p.x, z: p.z, r: 18 }))];
    this.tick = 0;
    this.view = null; // client: our own quest rows from the host
    game.scene.add(this.root);
  }

  // ------------------------------------------------------------ world
  _npc(def, i) {
    const W = this.game.world;
    const home = W.minor.find((m) => m.name === def.near);
    const pos = this._spot(home.x, home.z);
    const g = new THREE.Group();
    const m = (c) => new THREE.MeshLambertMaterial({ color: c });
    const part = (geo, c, x, y, z) => {
      const mesh = new THREE.Mesh(geo, m(c));
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      g.add(mesh);
      return mesh;
    };
    part(new THREE.BoxGeometry(0.22, 0.8, 0.26), '#3a3f4a', -0.14, 0.4, 0);
    part(new THREE.BoxGeometry(0.22, 0.8, 0.26), '#3a3f4a', 0.14, 0.4, 0);
    part(new THREE.BoxGeometry(0.62, 0.7, 0.34), def.shirt, 0, 1.15, 0);
    part(new THREE.BoxGeometry(0.16, 0.62, 0.18), def.shirt, -0.4, 1.12, 0);
    part(new THREE.BoxGeometry(0.16, 0.62, 0.18), def.shirt, 0.4, 1.12, 0);
    part(new THREE.SphereGeometry(0.27, 14, 10), def.color, 0, 1.78, 0);
    part(new THREE.CylinderGeometry(0.34, 0.34, 0.06, 14), def.hat, 0, 2.0, 0);
    part(new THREE.CylinderGeometry(0.22, 0.25, 0.22, 14), def.hat, 0, 2.12, 0);
    part(new THREE.BoxGeometry(0.06, 0.06, 0.02), '#1d1d1d', -0.09, 1.82, -0.26);
    part(new THREE.BoxGeometry(0.06, 0.06, 0.02), '#1d1d1d', 0.09, 1.82, -0.26);
    // name tag and the quest marker above their head
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture(def.name, '#ffffff', '#1d2a3a', 256), depthTest: false }));
    tag.scale.set(2.2, 0.55, 1);
    tag.position.y = 2.75;
    g.add(tag);
    const mark = new THREE.Sprite(new THREE.SpriteMaterial({ map: markTexture('!'), depthTest: false }));
    mark.scale.set(0.9, 0.9, 1);
    mark.position.y = 3.5;
    g.add(mark);
    g.position.copy(pos);
    g.rotation.y = Math.atan2(pos.x, pos.z); // faces the middle of the island (model front is -Z)
    this.root.add(g);
    return { def, i, pos, mesh: g, mark, markSym: '!' };
  }

  /** Open, dry, flat ground near a house, on its inland side (where players come from). */
  _spot(x, z) {
    const W = this.game.world;
    for (let r = 8; r < 20; r += 1.5) {
      let best = null;
      for (let k = 0; k < 16; k++) {
        const ang = (k / 16) * Math.PI * 2;
        const px = x + Math.cos(ang) * r, pz = z + Math.sin(ang) * r;
        const h = W.height(px, pz);
        if (h < WATER_Y + 0.6) continue;
        if (Math.abs(W.height(px + 1.5, pz) - h) > 0.8 || Math.abs(W.height(px, pz + 1.5) - h) > 0.8) continue;
        const blocked = W.physics.query(px - 1.2, pz - 1.2, px + 1.2, pz + 1.2).some((c) => c.alive && c.maxY > h + 0.3 && c.minY < h + 2);
        if (!blocked && (!best || Math.hypot(px, pz) < Math.hypot(best.x, best.z))) best = new THREE.Vector3(px, h, pz);
      }
      if (best) return best;
    }
    return new THREE.Vector3(x + 8, W.height(x + 8, z), z);
  }

  /** The NPC an actor can talk to (within reach), or null. */
  near(a, reach = 2.8) {
    return this.npcs.find((n) => Math.hypot(n.pos.x - a.pos.x, n.pos.z - a.pos.z) < reach && Math.abs(n.pos.y - a.pos.y) < 2.5) || null;
  }

  // ------------------------------------------------------------ host: state
  _q(a) {
    return a.quests || (a.quests = {});
  }

  _begin(a, q, def) {
    const st = def.steps[q.step];
    q.base = st && st.stat ? STATS[st.stat](a) : 0;
    if (!q.got || (st && st.gather)) q.got = [];
    if (!q.seen || (st && st.visit)) q.seen = [];
  }

  /** Talking to NPC i: take the quest, get a reminder, or hand it in. */
  talk(a, i) {
    const n = this.npcs[i];
    if (!n || !a.alive || a.downed || a.isBot) return;
    if (Math.hypot(n.pos.x - a.pos.x, n.pos.z - a.pos.z) > 4) return;
    const g = this.game;
    const def = n.def;
    const Q = this._q(a);
    let q = Q[def.id];
    if (!q) {
      q = Q[def.id] = { step: 0, done: false };
      this._begin(a, q, def);
      g.notify(a, `${def.name}: "${def.hello}"`, '#ffe9b0', 4.5);
      g.notify(a, `New quest: ${def.title} · ${def.steps[0].text}`, '#ffd23f', 3);
      sfx.play('ui', n.pos);
      return;
    }
    if (q.done) {
      g.notify(a, `${def.name}: "Thanks again, friend!"`, '#ffe9b0', 2);
      return;
    }
    const st = def.steps[q.step];
    if (!st.talk) {
      g.notify(a, `${def.name}: "Still need you to: ${st.text.toLowerCase()}."`, '#ffe9b0', 2.5);
      return;
    }
    // hand in
    q.done = true;
    q.step = def.steps.length;
    a.bucks = (a.bucks || 0) + def.reward.bucks;
    a.stats.quests = (a.stats.quests || 0) + 1;
    // the reward lands between the NPC and whoever handed the quest in
    const to = new THREE.Vector3(a.pos.x - n.pos.x, 0, a.pos.z - n.pos.z);
    if (to.lengthSq() < 0.01) to.set(0, 0, 1);
    const at = n.pos.clone().addScaledVector(to.normalize(), 1.6).add(new THREE.Vector3(0, 0.6, 0));
    g.loot.drop(makeWeapon(def.reward.weapon, def.reward.rarity), at, null, true);
    g.notify(a, `${def.name}: "${def.thanks}"`, '#ffe9b0', 3.5);
    g.notify(a, `Quest complete: ${def.title}! +${def.reward.bucks} Benton Bucks, +${QUEST_XP} XP after the match`, '#7ed957', 3.5);
    sfx.play('chest', n.pos);
  }

  /** Host/solo: progress everyone's quests (a few times a second). */
  update(dt) {
    if ((this.tick -= dt) > 0) return;
    this.tick = 0.2;
    const g = this.game;
    for (const a of g.actors) {
      if (!a.quests || !a.alive) continue;
      for (const n of this.npcs) {
        const def = n.def;
        const q = a.quests[def.id];
        if (!q || q.done) continue;
        const st = def.steps[q.step];
        if (st.gather) {
          for (const t of this.tackle) {
            if (q.got.includes(t.i) || a.pos.distanceTo(t.pos) > 2.4) continue;
            q.got.push(t.i);
            g.notify(a, `Tackle box ${q.got.length}/${st.gather}`, '#39f0ff', 1.5);
            sfx.play('pickup', t.pos);
          }
        }
        if (st.visit) {
          for (const p of this.places) {
            if (q.seen.includes(p.name) || Math.hypot(a.pos.x - p.x, a.pos.z - p.z) > p.r) continue;
            q.seen.push(p.name);
            g.notify(a, `Scouted ${p.name} (${q.seen.length}/${st.visit})`, '#39f0ff', 1.5);
          }
        }
        if (this._prog(a, q, st) >= this._goal(st)) {
          q.step++;
          const next = def.steps[q.step];
          this._begin(a, q, def);
          g.notify(a, `${def.title}: ${next.text}`, '#ffd23f', 2.5);
          sfx.play('ui');
        }
      }
    }
  }

  _goal(st) {
    return st.n || st.gather || st.visit || 1;
  }

  _prog(a, q, st) {
    if (st.stat) return Math.max(0, Math.floor(STATS[st.stat](a) - q.base));
    if (st.gather) return q.got.length;
    if (st.visit) return q.seen.length;
    return 0;
  }

  /** Compact rows for the owner: [step, progress, done, tackle bits] per NPC (0 = not taken). */
  rows(a) {
    if (a !== this.game.player || this.game.role !== 'client') {
      const Q = a.quests || {};
      return this.npcs.map((n) => {
        const q = Q[n.def.id];
        if (!q) return 0;
        const st = n.def.steps[q.step];
        return [q.step, st ? this._prog(a, q, st) : 0, q.done ? 1 : 0, (q.got || []).reduce((m, i) => m | (1 << i), 0)];
      });
    }
    return this.view || this.npcs.map(() => 0);
  }

  /** Quest tracker lines for the HUD: { name, title, text, prog, goal, ready, done }. */
  tracker(a) {
    return this.rows(a).map((r, i) => {
      if (!r) return null;
      const def = this.npcs[i].def;
      const st = def.steps[r[0]];
      if (r[2]) return { name: def.name, title: def.title, text: 'Complete!', done: true };
      return { name: def.name, title: def.title, text: st.text, prog: r[1], goal: st.talk ? 0 : this._goal(st), ready: !!st.talk };
    }).filter(Boolean);
  }

  // ------------------------------------------------------------ visuals
  present(dt, t) {
    const g = this.game;
    const rows = this.rows(g.player);
    this.npcs.forEach((n, i) => {
      const r = rows[i];
      const sym = !r ? '!' : r[2] ? '✓' : n.def.steps[r[0]].talk ? '?' : '…';
      if (sym !== n.markSym) {
        n.markSym = sym;
        n.mark.material.map.dispose();
        n.mark.material.map = markTexture(sym);
      }
      n.mark.position.y = 3.5 + Math.sin(t * 2.5 + i) * 0.12;
      n.mesh.children[4].rotation.z = Math.sin(t * 1.7 + i) * 0.25; // waving arm
    });
    // tackle boxes: only while we're looking for them, and not ones we already found
    const k = rows[1];
    const hunting = k && !k[2] && NPCS[1].steps[k[0]].gather;
    for (const b of this.tackle) {
      b.mesh.visible = !!hunting && !(k[3] & (1 << b.i));
      if (b.mesh.visible) {
        b.mesh.rotation.y = t * 1.5 + b.i;
        b.mesh.position.y = b.pos.y + 0.35 + Math.sin(t * 3 + b.i) * 0.12;
      }
    }
  }

  /** Map icons: NPCs (with their marker) and tackle boxes we still need. */
  mapIcons(g, tm, k) {
    const rows = this.rows(this.game.player);
    this.npcs.forEach((n, i) => {
      const [x, y] = tm(n.pos.x, n.pos.z);
      g.fillStyle = rows[i] && rows[i][2] ? '#7ed957' : '#ffd23f';
      g.strokeStyle = '#000';
      g.beginPath(); g.arc(x, y, 6 * k, 0, 7); g.fill(); g.stroke();
      g.fillStyle = '#1d2a3a';
      g.fillText(n.markSym, x, y + 0.5);
    });
    for (const b of this.tackle) {
      if (!b.mesh.visible) continue;
      const [x, y] = tm(b.pos.x, b.pos.z);
      g.fillStyle = '#39f0ff'; g.strokeStyle = '#000';
      g.fillRect(x - 3.5 * k, y - 3.5 * k, 7 * k, 7 * k); g.strokeRect(x - 3.5 * k, y - 3.5 * k, 7 * k, 7 * k);
    }
  }

  dispose() {
    this.game.scene.remove(this.root);
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (o.material.map) o.material.map.dispose();
        o.material.dispose();
      }
    });
  }
}

function markTexture(sym) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = sym === '✓' ? '#7ed957' : '#ffd23f';
  x.strokeStyle = '#1d2a3a';
  x.lineWidth = 5;
  x.beginPath(); x.arc(32, 32, 27, 0, 7); x.fill(); x.stroke();
  x.fillStyle = '#1d2a3a';
  x.font = '900 38px "Baloo 2", "Trebuchet MS", sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(sym, 32, 35);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function tackleModel() {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.4), new THREE.MeshLambertMaterial({ color: '#2f9e6b', emissive: '#0d3a26' }));
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.08, 0.42), new THREE.MeshLambertMaterial({ color: '#39f0ff', emissive: '#105a66' }));
  lid.position.y = 0.21;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 6, 12, Math.PI), new THREE.MeshLambertMaterial({ color: '#dddddd' }));
  handle.position.y = 0.25;
  g.add(box, lid, handle);
  return g;
}

/**
 * Material library. Kits pick wall/floor/ceiling/trim materials; textures
 * are one metre per repeat unless TEX_SCALE says otherwise.
 */
import * as THREE from 'three';
import { tex } from './textures.js';

export const TEX_SCALE = { ceilingTile: 1.2, carpet: 2.0, concrete: 2.0, rust: 2.0, orangePaint: 2.0, plaster: 2.0, terrazzo: 2.0 };

const MATS = new Map();

/** Get (or create) a named material. */
export function mat(name) {
  if (MATS.has(name)) return MATS.get(name);
  const def = DEFS[name];
  if (!def) throw new Error(`no material ${name}`);
  const m = def();
  m.name = name;
  MATS.set(name, m);
  return m;
}
export function texScale(matName) { const d = META[matName]; return d ? (TEX_SCALE[d] || 1) : 1; }

const META = {};
function std(texName, opts = {}) {
  return () => {
    const t = texName ? tex(texName) : null;
    const m = new THREE.MeshStandardMaterial({
      map: t ? t.map : null, normalMap: t && opts.normal !== false ? t.normalMap : null,
      roughness: opts.rough ?? 0.85, metalness: opts.metal ?? 0, color: opts.color ?? 0xffffff,
      transparent: !!opts.transparent, alphaTest: opts.alphaTest || 0, side: opts.side || THREE.FrontSide,
      emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.ei ?? 1,
    });
    if (m.normalMap) m.normalScale.set(opts.ns ?? 0.6, opts.ns ?? 0.6);
    return m;
  };
}
function reg(name, texName, opts) { DEFS[name] = std(texName, opts); META[name] = texName; }
const DEFS = {};

// surfaces
reg('wallpaper', 'wallpaper', { rough: 0.9 });
reg('carpet', 'carpet', { rough: 0.98, ns: 0.45 });
reg('ceilingTile', 'ceilingTile', { rough: 0.95 });
reg('concrete', 'concrete', { rough: 0.95 });
reg('paintBlock', 'paintBlock', { rough: 0.85 });
reg('metal', 'metal', { rough: 0.45, metal: 0.6 });
reg('diamondPlate', 'diamondPlate', { rough: 0.5, metal: 0.6, ns: 1 });
reg('fabric', 'fabric', { rough: 1.0, color: 0x9aa4ac });
reg('fabricRed', 'fabric', { rough: 1.0, color: 0xb05a4c });
reg('fabricBlue', 'fabric', { rough: 1.0, color: 0x5a7aa8 });
reg('fabricGreen', 'fabric', { rough: 1.0, color: 0x6a9a62 });
reg('laminate', 'laminate', { rough: 0.6 });
reg('plastic', 'plastic', { rough: 0.55 });
reg('terrazzo', 'terrazzo', { rough: 0.35 });
reg('pastel', 'pastel', { rough: 0.85 });
reg('pastelBlue', 'pastel', { rough: 0.85, color: 0xb8c8e8 });
reg('pastelMint', 'pastel', { rough: 0.85, color: 0xc0e8d0 });
reg('shopTile', 'shopTile', { rough: 0.4 });
reg('poolTile', 'poolTile', { rough: 0.3 });
reg('whiteTile', 'whiteTile', { rough: 0.35 });
reg('veneer', 'veneer', { rough: 0.6 });
reg('plaster', 'plaster', { rough: 0.9 });
reg('floral', 'floral', { rough: 0.9 });
reg('woodFloor', 'woodFloor', { rough: 0.6 });
reg('rust', 'rust', { rough: 0.8, metal: 0.4 });
reg('orangePaint', 'orangePaint', { rough: 0.75, metal: 0.2 });
reg('grating', 'grating', { rough: 0.6, metal: 0.6, alphaTest: 0.5, side: THREE.DoubleSide });
reg('hazard', 'hazard', { rough: 0.7 });
// plain
DEFS.trim = () => new THREE.MeshStandardMaterial({ color: 0x8d7e52, roughness: 0.7 });
DEFS.trimDark = () => new THREE.MeshStandardMaterial({ color: 0x3c3a34, roughness: 0.7 });
DEFS.doorWood = std('laminate', { rough: 0.65, color: 0xc8b090 });
DEFS.doorRefuge = () => new THREE.MeshStandardMaterial({ color: 0x3f6a5a, roughness: 0.6 });
DEFS.doorFire = () => new THREE.MeshStandardMaterial({ color: 0x8a3a2a, roughness: 0.6 });
DEFS.doorMetal = std('metal', { rough: 0.5, metal: 0.5, color: 0x9aa0a6 });
DEFS.black = () => new THREE.MeshStandardMaterial({ color: 0x0e0e10, roughness: 0.9 });
DEFS.darkMetal = () => new THREE.MeshStandardMaterial({ color: 0x2e3236, roughness: 0.55, metalness: 0.6 });
DEFS.chrome = () => new THREE.MeshStandardMaterial({ color: 0xcfd4da, roughness: 0.18, metalness: 0.95 });
DEFS.glass = () => new THREE.MeshStandardMaterial({ color: 0x9ab8c0, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false });
DEFS.meshWire = () => new THREE.MeshStandardMaterial({ color: 0x777b7e, roughness: 0.5, metalness: 0.7, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
DEFS.lamp = () => new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2c8, emissiveIntensity: 2.2, roughness: 0.4 });
DEFS.lampDim = () => new THREE.MeshStandardMaterial({ color: 0xbbbbbb, emissive: 0xfff2c8, emissiveIntensity: 0.5, roughness: 0.4 });
DEFS.lampOff = () => new THREE.MeshStandardMaterial({ color: 0x8a8a84, roughness: 0.5 });
DEFS.lampWarm = () => new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffc890, emissiveIntensity: 2.0, roughness: 0.4 });
DEFS.lampCool = () => new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xd8f0ff, emissiveIntensity: 2.0, roughness: 0.4 });
DEFS.screenGreen = () => new THREE.MeshStandardMaterial({ color: 0x0a1a10, emissive: 0x2aff8a, emissiveIntensity: 0.6, roughness: 0.3 });
DEFS.ledRed = () => new THREE.MeshStandardMaterial({ color: 0x400808, emissive: 0xff3020, emissiveIntensity: 1.2 });
DEFS.ledGreen = () => new THREE.MeshStandardMaterial({ color: 0x083008, emissive: 0x40ff60, emissiveIntensity: 1.2 });
DEFS.ledOff = () => new THREE.MeshStandardMaterial({ color: 0x202020, roughness: 0.5 });
DEFS.paper = std('paper', { rough: 0.9, normal: false });
DEFS.cardboard = () => new THREE.MeshStandardMaterial({ color: 0x9a7a52, roughness: 0.95 });
DEFS.rubber = () => new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.95 });
DEFS.redPaint = () => new THREE.MeshStandardMaterial({ color: 0xa83228, roughness: 0.6 });
DEFS.bluePaint = () => new THREE.MeshStandardMaterial({ color: 0x2a4e88, roughness: 0.6 });
DEFS.greenPaint = () => new THREE.MeshStandardMaterial({ color: 0x3a7a42, roughness: 0.6 });
DEFS.white = () => new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.6 });
DEFS.water = () => new THREE.MeshStandardMaterial({ color: 0x4a8a8c, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.55, depthWrite: false });
DEFS.plant = () => new THREE.MeshStandardMaterial({ color: 0x4a6a3a, roughness: 0.9 });
DEFS.daylight = () => new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe8f2f4, emissiveIntensity: 1.6, roughness: 0.4 });
DEFS.glassTile = () => new THREE.MeshStandardMaterial({ color: 0xbfe0e8, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.55 });
DEFS.lampWarmDim = () => new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffb070, emissiveIntensity: 0.9, roughness: 0.4 });
DEFS.curtain = () => new THREE.MeshStandardMaterial({ color: 0xc8a878, roughness: 0.95, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
DEFS.creature = () => new THREE.MeshStandardMaterial({ color: 0x14130f, roughness: 0.85 });

/** Material set for a kit. */
export const KITS = {
  annex: { wall: 'paintBlock', ceiling: 'concrete', trim: 'trimDark', lamp: 'lampCool', fixture: 'tube', light: 0xe8f4ff, fog: 0x30383a },
  office: { wall: 'wallpaper', ceiling: 'ceilingTile', trim: 'trim', lamp: 'lamp', fixture: 'troffer', light: 0xfff0c0, fog: 0x8a7a3a },
  lift: { wall: 'metal', ceiling: 'metal', trim: 'darkMetal', lamp: 'lampCool', fixture: 'panel', light: 0xeef4ff, fog: 0x404448 },
  mall: { wall: 'pastel', ceiling: 'ceilingTile', trim: 'chrome', lamp: 'lampWarm', fixture: 'pendant', light: 0xffe4c8, fog: 0x5a4a56 },
  pool: { wall: 'whiteTile', ceiling: 'whiteTile', trim: 'white', lamp: 'lampCool', fixture: 'panel', light: 0xe0f4ff, fog: 0x6a8a90 },
  apartments: { wall: 'floral', ceiling: 'plaster', trim: 'veneer', lamp: 'lampWarm', fixture: 'bulb', light: 0xffc890, fog: 0x3a2a1a },
  industrial: { wall: 'orangePaint', ceiling: 'rust', trim: 'darkMetal', lamp: 'lampCool', fixture: 'cage', light: 0xfff0d8, fog: 0x2a2620 },
  relay: { wall: 'concrete', ceiling: 'concrete', trim: 'darkMetal', lamp: 'lampCool', fixture: 'tube', light: 0xe0f0ff, fog: 0x30383a },
};

export const SURFACE_FLOOR = { carpet: 'carpet', concrete: 'concrete', metal: 'diamondPlate', grate: 'grating', tile: 'shopTile', pooltile: 'poolTile', whitetile: 'whiteTile', wood: 'woodFloor', terrazzo: 'terrazzo', water: 'poolTile' };

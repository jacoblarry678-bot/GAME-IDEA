/**
 * Content vault: unreleased content ships inside the build as AES-256-GCM
 * ciphertext (src/data/vault.js) and stays unreadable until its release key
 * is supplied. The key is derived with PBKDF2-SHA256 (210k iterations) from a
 * high-entropy release code, so the blob can't be guessed or datamined.
 *
 * A key can arrive four ways: typed as a code in the Store, sent by a
 * self-hosted server (--release), baked into a public build
 * (src/data/releases.js), or remembered from an earlier unlock.
 *
 * Opening a vault registers its cosmetics (and Store bundle) at runtime.
 * GCM authentication guarantees the content came from whoever holds the key.
 *
 * Honest limits: once a key is distributed, anyone with the build and the key
 * can read the content. Before that, the ciphertext reveals only its size.
 */
import { VAULT } from '../data/vault.js';
import { RELEASE_KEYS } from '../data/releases.js';
import { registerCosmetic, COSMETICS } from '../data/cosmetics.js';
import { BUNDLES, COLLABS } from '../data/shop.js';

const STORE_KEY = 'ashline.vault';
const opened = new Map(); // vault id → decoded content
const enc = new TextEncoder(), dec = new TextDecoder();

export function normalizeCode(code) { return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }

export function b64(bytes) { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); }
export function unb64(str) { const s = atob(str); const out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; }

export async function deriveKey(code, salt, iter) {
  const base = await crypto.subtle.importKey('raw', enc.encode(normalizeCode(code)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** Encrypt a JSON payload (used by tools/vault.mjs). */
export async function seal(id, payload, code, iter = 210000) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(code, salt, iter);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(id) }, key, enc.encode(JSON.stringify(payload))));
  return { id, iter, salt: b64(salt), iv: b64(iv), data: b64(ct) };
}

/** Try `code` against one sealed entry; returns the payload or null. */
export async function unseal(entry, code) {
  try {
    const key = await deriveKey(code, unb64(entry.salt), entry.iter);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(entry.iv), additionalData: enc.encode(entry.id) }, key, unb64(entry.data));
    return JSON.parse(dec.decode(pt));
  } catch { return null; }
}

const ID_RE = /^[a-z0-9_]{3,40}$/;
const TYPES = new Set(['operator', 'outfit', 'finish', 'charm', 'card', 'emblem', 'banner']);

/** Check decrypted content before it touches the catalog. */
function validContent(p) {
  if (!p || p.format !== 1 || !Array.isArray(p.cosmetics)) return false;
  for (const it of p.cosmetics) {
    if (!ID_RE.test(it.id) || !TYPES.has(it.type) || typeof it.name !== 'string' || !it.unlock || typeof it.rarity !== 'string') return false;
    if (it.type === 'operator' && !it.op) return false;
    if (it.type === 'outfit' && (!it.outfit || !it.operator)) return false;
  }
  if (p.bundle && (!ID_RE.test(p.bundle.id) || !Array.isArray(p.bundle.items))) return false;
  return true;
}

function apply(entry, p) {
  if (opened.has(entry.id)) return opened.get(entry.id);
  for (const it of p.cosmetics) if (!COSMETICS[it.id]) registerCosmetic({ ...it, vault: entry.id });
  if (p.bundle && !BUNDLES.some((b) => b.id === p.bundle.id)) BUNDLES.push({ discount: 0, ...p.bundle, vault: entry.id });
  if (p.collab) {
    const c = COLLABS.find((x) => x.id === p.collab);
    if (c) for (const it of p.cosmetics) if (it.unlock.type === 'shop' && !c.items.includes(it.id)) c.items.push(it.id);
  }
  opened.set(entry.id, p);
  return p;
}

function remembered() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]').filter((s) => typeof s === 'string'); } catch { return []; } }
function remember(code) {
  try {
    const list = remembered();
    const n = normalizeCode(code);
    if (!list.includes(n)) { list.push(n); localStorage.setItem(STORE_KEY, JSON.stringify(list)); }
  } catch { /* storage unavailable: the unlock lasts this session */ }
}

/**
 * Try a release code against every sealed entry. Returns the list of newly
 * opened payloads (empty when the code matches nothing).
 */
export async function redeem(code, { persist = true } = {}) {
  const n = normalizeCode(code);
  if (n.length < 12) return [];
  const out = [];
  for (const entry of VAULT) {
    if (opened.has(entry.id)) continue;
    const p = await unseal(entry, n);
    if (p && validContent(p)) { apply(entry, p); out.push(p); }
  }
  if (out.length && persist) remember(n);
  return out;
}

/** At boot: open everything released in this build or unlocked before. */
export async function openKnown() {
  const codes = [...new Set([...RELEASE_KEYS.map(normalizeCode), ...remembered()])];
  for (const c of codes) await redeem(c, { persist: false });
  return [...opened.values()];
}

export const vaultStatus = () => ({ sealed: VAULT.length, opened: [...opened.keys()] });
export const isOpened = (id) => opened.has(id);

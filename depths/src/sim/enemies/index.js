import { Listener } from './listener.js';

const TYPES = { listener: Listener };
export function registerCreature(type, cls) { TYPES[type] = cls; }
export function createCreature(game, type, opts = {}) {
  const C = TYPES[type];
  if (!C) throw new Error(`unknown creature ${type}`);
  return new C(game, opts);
}

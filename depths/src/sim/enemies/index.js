import { Listener } from './listener.js';
import { Cutout } from './cutout.js';
import { Drowned } from './drowned.js';
import { Tenant } from './tenant.js';
import { Caretaker } from './caretaker.js';
import { Unseen } from './unseen.js';

const TYPES = { listener: Listener, cutout: Cutout, drowned: Drowned, tenant: Tenant, caretaker: Caretaker, unseen: Unseen };
export function registerCreature(type, cls) { TYPES[type] = cls; }
export function createCreature(game, type, opts = {}) {
  const C = TYPES[type];
  if (!C) throw new Error(`unknown creature ${type}`);
  return new C(game, opts);
}

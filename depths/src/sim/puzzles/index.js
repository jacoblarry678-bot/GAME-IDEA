import { SequencePuzzle } from './base.js';

const TYPES = { sequence: SequencePuzzle };

export function registerPuzzleType(name, cls) { TYPES[name] = cls; }

export function createPuzzle(game, def) {
  const C = TYPES[def.type || 'sequence'];
  if (!C) throw new Error(`unknown puzzle type ${def.type}`);
  return new C(game, def);
}

import { SequencePuzzle } from './base.js';
import { RoutingPuzzle } from './routing.js';
import { ValvePuzzle, LatchPuzzle, TilePuzzle } from './pool.js';
import { MailPuzzle, FramesPuzzle } from './residents.js';
import { WeightsPuzzle, TelemetryPuzzle } from './service.js';

const TYPES = { weights: WeightsPuzzle, telemetry: TelemetryPuzzle, sequence: SequencePuzzle, routing: RoutingPuzzle, valves: ValvePuzzle, latch: LatchPuzzle, tiles: TilePuzzle, mail: MailPuzzle, frames: FramesPuzzle };

export function registerPuzzleType(name, cls) { TYPES[name] = cls; }

export function createPuzzle(game, def) {
  const C = TYPES[def.type || 'sequence'];
  if (!C) throw new Error(`unknown puzzle type ${def.type}`);
  return new C(game, def);
}

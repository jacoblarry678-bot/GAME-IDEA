import { SequencePuzzle } from './base.js';
import { RoutingPuzzle } from './routing.js';
import { ValvePuzzle, LatchPuzzle, TilePuzzle } from './pool.js';
import { MailPuzzle, FramesPuzzle } from './residents.js';
import { WeightsPuzzle, TelemetryPuzzle } from './service.js';
import { NexusPanel, PatchPuzzle, PurposePuzzle, BypassPuzzle, EmergencyPuzzle } from './core.js';
import { ValveStatePuzzle, ZoneRoutingPuzzle } from './expedition.js';

const TYPES = { valvestate: ValveStatePuzzle, zonerouting: ZoneRoutingPuzzle, weights: WeightsPuzzle, telemetry: TelemetryPuzzle, nexus: NexusPanel, patch: PatchPuzzle, purpose: PurposePuzzle, bypass: BypassPuzzle, emergency: EmergencyPuzzle, sequence: SequencePuzzle, routing: RoutingPuzzle, valves: ValvePuzzle, latch: LatchPuzzle, tiles: TilePuzzle, mail: MailPuzzle, frames: FramesPuzzle };

export function registerPuzzleType(name, cls) { TYPES[name] = cls; }

export function createPuzzle(game, def) {
  const C = TYPES[def.type || 'sequence'];
  if (!C) throw new Error(`unknown puzzle type ${def.type}`);
  return new C(game, def);
}

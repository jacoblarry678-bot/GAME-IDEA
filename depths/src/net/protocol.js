/**
 * Co-op wire protocol. The relay server only routes envelopes between the
 * host and its guests; it never interprets game data. The host's browser
 * runs the authoritative simulation.
 *
 * Client → server   { t: 'host', name, version }              create a session, receive { t: 'hosted', code }
 *                   { t: 'join', code, name, slot, ident, version }
 *                                                              join with an invite code, receive { t: 'joined', id, host };
 *                                                              a game version that differs from the host's is refused
 *                   { t: 'to', id, d }                         host → one guest (or guest → 'host')
 *                   { t: 'all', d }                            host → every guest
 * Server → client   { t: 'from', id, d }                       routed payload
 *                   { t: 'peer', id, name, slot, ident, version }  host: a guest connected
 *                   { t: 'left', id }                          host: a guest disconnected
 *                   { t: 'hostLeft' }                          guest: the session ended
 *                   { t: 'error', msg }
 *
 * Payloads d.k: host → guest   welcome | chapter | snap | ev | correct | denied
 *               guest → host   input | act | vote
 */
export const PROTOCOL = 1;
export const DEFAULT_PORT = 4194;
export const SNAP_HZ = 12;
export const INPUT_HZ = 15;
export const MAX_GUESTS = 3;
export const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function makeCode(rand = Math.random) {
  let s = '';
  for (let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(rand() * CODE_CHARS.length)];
  return s;
}
/** Saves and clients from before versions were sent count as 1.0.0. */
export function normVersion(v) { return String(v || '1.0.0').slice(0, 16); }
export function versionMismatch(host, guest) {
  return `This session runs game version ${normVersion(host)}, and your game is version ${normVersion(guest)}. Every player must install the same version before joining.`;
}
export function normCode(c) { return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); }

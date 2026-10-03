/**
 * Game mode definitions. Each mode supplies defaults and rule hooks used by
 * Match. Only modes with working rules are listed as playable.
 */
export const TEAMS = [
  { id: 0, name: 'WARDEN', full: 'Warden Security Directorate' },
  { id: 1, name: 'SABLE', full: 'Sable Front' },
];

export const MODES = {
  tdm: {
    id: 'tdm',
    name: 'Team Deathmatch',
    short: 'TDM',
    blurb: 'Two teams. First to the score limit, or the highest score when time runs out, wins.',
    teams: true,
    defaults: { scoreLimit: 75, timeLimit: 10, botsPerTeam: 4 },
    limits: { scoreLimit: [10, 200], timeLimit: [3, 30] },
    respawnDelay: 3.2,
    playable: true,
    onKill(match, killer, victim) {
      if (!killer || killer === victim || killer.team === victim.team) return;
      match.teamScores[killer.team] += 1;
      if (match.teamScores[killer.team] >= match.settings.scoreLimit) match.end(killer.team, 'score');
    },
    onTimeUp(match) {
      const [a, b] = match.teamScores;
      match.end(a === b ? -1 : a > b ? 0 : 1, 'time');
    },
  },
  range: {
    id: 'range',
    name: 'Firing Range',
    short: 'RANGE',
    blurb: 'Training targets at marked distances. No score, no time limit.',
    teams: true,
    range: true,
    defaults: { scoreLimit: 9999, timeLimit: 999, botsPerTeam: 0 },
    respawnDelay: 1.2,
    playable: false,
    onKill() {},
    onTimeUp() {},
  },
};

/** Modes on the roadmap (shown as unavailable, never as playable). */
export const ROADMAP_MODES = [
  { id: 'ffa', name: 'Free-for-All' },
  { id: 'dom', name: 'Domination' },
  { id: 'hp', name: 'Hardpoint' },
  { id: 'elim', name: 'Elimination' },
  { id: 'gun', name: 'Gun Game' },
];

export const DIFFICULTIES = {
  recruit: { id: 'recruit', name: 'Recruit', hold: [3, 8], reaction: 0.85, turn: 3.0, aimErr: 8.0, aimErrMin: 3.4, settle: 1.6, fovDeg: 100, hs: 0.04, nade: 0.06, strafe: 0.4, burst: 0.5, fireAngle: 2.6 },
  regular: { id: 'regular', name: 'Regular', hold: [2.5, 7], reaction: 0.55, turn: 4.6, aimErr: 5.6, aimErrMin: 2.3, settle: 1.1, fovDeg: 110, hs: 0.1, nade: 0.12, strafe: 0.65, burst: 0.7, fireAngle: 2.0 },
  hardened: { id: 'hardened', name: 'Hardened', hold: [2, 6], reaction: 0.36, turn: 6.5, aimErr: 4.0, aimErrMin: 1.4, settle: 0.8, fovDeg: 120, hs: 0.18, nade: 0.2, strafe: 0.85, burst: 0.85, fireAngle: 1.6 },
  veteran: { id: 'veteran', name: 'Veteran', hold: [1.5, 5], reaction: 0.22, turn: 9.0, aimErr: 2.8, aimErrMin: 0.8, settle: 0.55, fovDeg: 130, hs: 0.28, nade: 0.3, strafe: 1.0, burst: 1.0, fireAngle: 1.3 },
};

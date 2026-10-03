# Status

This file is updated at each milestone handoff. It records what works, what is
incomplete or still a known issue, and what comes next.

## Milestone 1: Playable match (complete)

**Works and has been tested**
- Boot → main menu (live 3D flyover) → Play setup → Loadouts → match → results → Play Again / Main Menu.
- Cinder Yard is a finished layout: three lanes, flank routes, elevation (dock, flatcar, crates), and sealed boundaries.
- Team Deathmatch has 1–5 enemy bots and 0–4 allied bots. Score limit, time limit, friendly fire, tie handling (draw) and a 3-second countdown all work.
- Bots navigate with a nav grid and A*, and use line of sight, field of view and reaction delays. They pick targets, strafe, burst-fire, reload, swap to the pistol, take cover when hurt, flee live frags, throw frags and smoke, and avoid shooting teammates. Four difficulty levels change reaction time, turn speed, aim error, tactics and how often they use grenades.
- Weapons: AR, SMG, pump shotgun (tube reload you can interrupt), bolt sniper (scope overlay) and pistol. Each has damage falloff, hit zones, recoil with recovery, spread and bloom, ADS that lines up the sights, swap timing, melee, and frag and smoke grenades.
- Movement: walk, sprint, crouch, slide, jump, mantle and vault, step-up and stairs.
- HUD: health, ammo, equipment, score bar and timer, kill feed, rotating or fixed minimap, hit markers (including kill and headshot), damage direction, grenade warnings, medals and score popups, the scoreboard (Tab), the death screen with respawn, and the spawn-protection notice.
- Settings: graphics, controls with full rebinding, audio buses, interface and accessibility. They apply immediately, persist, and can be reset per tab or all at once. Options that need a reload, or that the platform doesn't support, say so.
- Pause (offline) freezes the simulation. The match pauses if you release the mouse or switch tabs.
- Local profile: 5 loadout presets, match setup, and career stats recorded exactly once per match.

**Verification run**
- `npm test`: 49/49 rules tests pass.
- `tools/sim.mjs`: 5v5 bot matches at every difficulty finish with no stuck bots. The kill rate is ~0.35–0.5 per second across all 10 players.
- `tools/e2e.mjs` in headless Chromium runs the whole flow above with the player under AI control. Checks cover pause, settings, rebinding, persistence, results, play again, loadout changes, the scope and number-key swaps, and the console stays free of errors.

**Known issues / limits**
- Performance on real GPUs hasn't been measured: the container renders on the CPU (SwiftShader, 1–3 FPS). Use the in-game FPS counter.
- The announcer uses browser speech synthesis. Some browsers have no voices, so the line shows only as a caption.
- Embedded previews may block pointer lock. The game falls back to unlocked mouse look, which still works while the cursor stays in the window.
- Third-person animation is procedural and simple: no IK, and only a basic death fall.
- The texture-quality setting applies after a reload.

## Next: Milestone 2 (visual & gameplay polish)
- Post-processing (bloom, ambient occlusion) as real settings, plus better lighting inside interiors.
- Better viewmodel arms and hands, and better weapon models and animation.
- A shooting range with targets, damage readouts and a DPS/TTK display.
- Weapon tuning from range data; better AI cover and flanking.
- More audio variety and environmental reverb.

## Later milestones
- M3: progression, inventory, cosmetics, a battle pass, and a demo shop. Test currency only.
- M4: more weapons and attachments, maps (Old Quarter, Signal Station), modes (FFA, Domination, Hardpoint, Elimination, Gun Game), support abilities.
- M5: real online play needs a server-authoritative game server, accounts and a backend. Until then, online features stay labelled unavailable.

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

## Milestone 2: Visual and gameplay polish (complete)

**Added**
- **Firing Range** (from the main menu, or **Test in Firing Range** in Loadouts): 13 training targets at 5–90 m. Some stand, some crouch and some strafe, and there is cover to peek from. A live panel shows damage per shot, shots to kill and TTK at 10/25/50 m, plus your last hit (damage, zone, distance), your last elimination (shots and milliseconds) and accuracy. Hotkeys: T next weapon, Y infinite ammo, H moving targets, U reset.
- **Post-processing**: bloom and GTAO ambient occlusion are real toggles. Bloom is on by default from Medium up; AO is on in Ultra. The composer runs only when one of them is enabled, and keeps 4× MSAA.
- **Dynamic resolution** (optional) holds the frame rate by lowering the render scale to as little as 50%. The FPS overlay now also shows render scale and draw calls.
- **Audio**: convolution reverb crossfades between outdoor and indoor, based on whether there is a roof overhead and walls nearby. Distant gunfire and explosions echo off the yard, and occluded shots are muffled.
- **First-person hands**: capsule sleeves and gloves with fingers wrapped on the grip and foregrip. The reflex sight is now an open frame, and the weapon preview on the loadout screen has moved.
- **Third-person**: rounded capsule limbs. The hips turn toward strafes and the legs run backwards when backpedalling. Soldiers flinch when hit, and at range they drop their shadows and weapon detail (LOD).
- **World**: backdrop buildings now have window facades, and the dock stairs no longer have a support post in the middle.
- **AI**: bots share spotted enemies with teammates within 32 m, pre-aim likely approaches while holding a position, and take flank lanes into the enemy half. Update order now rotates each tick, which removes a measurable West-team advantage (12-match aggregate: 445 vs 462).

**Verification run**
- `npm test`: 49/49. `npm run e2e`: 31/31. That covers the M1 flow plus the runtime bloom/AO toggle, the firing range (targets, eliminations, stats panel) and returning to Cinder Yard afterwards.
- Ultra-preset screenshots (bloom + GTAO + 4K shadows) render with no errors.

**Known issues**
- GPU performance is still unmeasured, for the reason given under M1. On Ultra, GTAO adds a full extra geometry pass (~400 draw calls in the yard).
- Weapon attachments are not in yet (planned for M4). The range currently tests base weapons.

## Next: Milestone 3 (progression & cosmetics)
- Persistent profile with player level and XP from matches. Weapon levels unlock camos.
- Inventory, with cosmetic equip and a live preview on the operator or weapon.
- A 50-tier battle pass (free and premium tracks) with daily and weekly challenges.
- A demonstration item shop using clearly labelled test currency.

## Later milestones
- M4: more weapons and attachments, maps (Old Quarter, Signal Station), modes (FFA, Domination, Hardpoint, Elimination, Gun Game), support abilities.
- M5: real online play needs a server-authoritative game server, accounts and a backend. Until then, online features stay labelled unavailable.

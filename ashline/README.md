# OPERATION ASHLINE

An original 3D military first-person shooter that runs in the browser. Fast
movement and gunplay against bots across three maps and six modes. Everything in
it is made for this project: the maps, weapons, characters, sounds and music are
generated in code when the game loads.

> Offline build. Every other player in a match is a bot, and the game labels
> them `[BOT]`. Online play does not exist yet. See [STATUS.md](STATUS.md).

## Run it

Requires Node 18+ and a desktop browser with WebGL 2 (Chrome, Edge, Firefox or Safari).

```bash
cd ashline
npm install
npm run dev        # http://localhost:5180
```

Production build:

```bash
npm run build && npm run preview     # http://localhost:4180
npm run build:single                 # build/ashline.html — one self-contained file
```

Click into the game to capture the mouse. `Esc` releases the mouse and pauses the match.

## Controls (defaults; all rebindable in Settings → Controls)

| Action | Keyboard / mouse | Controller |
| --- | --- | --- |
| Move | W A S D | Left stick |
| Look | Mouse | Right stick |
| Fire / Aim | LMB / RMB | RT / LT |
| Sprint | L-Shift (hold or toggle) | L3 |
| Crouch, slide while sprinting | C or L-Ctrl (toggle or hold) | B |
| Jump, mantle, vault | Space | A |
| Reload | R | X |
| Switch weapon | Mouse wheel · 1 / 2 | Y |
| Melee | V or E | R3 |
| Lethal (frag) / Tactical (smoke, flash or Bulwark) | G / Q | RB / LB |
| Support: Recon Scan / Supply Drop / Area Strike | 3 / 4 / 5 | D-pad ← / ↑ / → |
| Scoreboard | Tab | View |
| Pause | Esc | Menu |

## What you can play now (Milestones 1–4)

- **Cinder Yard**: an industrial rail depot with a close-quarters warehouse, a rail yard with boxcars and a control booth, a container maze, a maintenance building, a long south road and two staging areas.
- **Team Deathmatch** against up to 9 bots (5v5 with you), at four difficulty levels. You can set score and time limits and turn friendly fire on or off.
- **Five weapons**: the KV-7 Rampart assault rifle, Vesper-9 SMG, Brakk-12 pump shotgun, LR-338 Longreach bolt-action sniper and HX-9 Warden pistol. You also have a knife melee, M-7 frag grenades and SMK-4 smoke.
- **Movement**: walk, sprint, crouch, slide, jump, mantle onto ledges and vault low walls.
- **Gunplay**: ADS with sights lined up, recoil you can control, spread and bloom, damage falloff, a headshot multiplier, hit markers, damage indicators and a kill feed. There is also a minimap that shows enemies when they fire.
- **The full loop**: main menu → setup → loadout → match → results → play again. Five loadout presets and your local career stats are saved in the browser.
- **Firing Range**: training targets at 5–90 m, with a live readout of damage, shots to kill and TTK, and observed time-to-kill (Milestone 2).
- **Progression & cosmetics (Milestone 3)**: player and weapon levels, an 80-item cosmetic catalog with an Armory, a 50-tier battle pass (free + premium), daily and weekly challenges, and a demo Store. Every price uses clearly labelled **test credits**; there are no real payments.
- **Milestone 4 content**:
  - **Maps**: Old Quarter (town streets, a walled clock courtyard, enterable chapel, bakery, gendarmerie and hotel) and Signal Station (a fenced comms compound with tight interiors, open approaches, a dish field and a ridge road). Pick the map in Play setup; a map builds the first time you use it.
  - **Modes**: Free-for-All, Domination (3 flags), Hardpoint (6 rotating zones), Elimination (rounds, no respawns, spectate) and Gun Game (16-step ladder ending on the axe), alongside Team Deathmatch. Private match settings cover map, mode, length, score limit, bot counts, difficulty and friendly fire.
  - **16 weapons**: 4 assault rifles (including a bullpup, a battle rifle and a 3-round-burst carbine), 3 SMGs (one integrally suppressed), 2 shotguns, a bolt-action sniper and a DMR, 2 LMGs, 2 pistols (including a revolver) and a breaching axe. New weapons unlock by player level.
  - **Gunsmith**: 16 attachments across optic, muzzle, barrel, magazine, stock and underbarrel, up to 5 per weapon. Each one lists its upside and its drawback, and they unlock by weapon level (never sold).
  - **Perks**: 9 in 3 slots, unlocked by player level.
  - **Equipment**: an FL-2 flash grenade (blinds by distance and facing; the reduced-flash accessibility setting caps it) and the Bulwark deployable cover (blocks bullets until destroyed).
  - **Support abilities**: earned through consecutive eliminations: Recon Scan (4), Supply Drop (6) and Area Strike (8). Hardline lowers each by one. Bots use them too.
- **Graphics options**: bloom, GTAO ambient occlusion, 1K–4K shadows, dynamic resolution, render scale, FOV, frame cap and quality presets.

## Architecture

```
src/
  core/      engine (renderer, viewmodel overlay, IBL, shadows), input (KB/M + gamepad, rebinding),
             settings (schema-driven), profile + storage (versioned, validated localStorage)
  data/      weapons, attachments, perks, support abilities, equipment, cosmetics, season/pass,
             challenges, store catalog ← editable data with stable ids
  world/     collision (AABB + spatial hash + DDA raycast + kinematic mover), nav grid (A*),
             procedural textures/materials, map builder, sky, maps/ (kit + Cinder Yard, Old Quarter, Signal Station)
  entities/  combatant (shared player/bot simulation), bot AI, soldier model (rigid-skinned)
  combat/    weapon state machine, grenades/smoke/flash, deployables (shields, supply drops, strikes, recon)
  game/      match (rules, damage, scoring, spawning), modes, spawns, game (presentation + player control)
  fx/        viewmodel (procedural animation), weapon models, effects (instanced particles, tracers, decals)
  audio/     synthesized SFX + music, spatial playback, announcer
  ui/        menus/screens, HUD, controller menu navigation, styles
tools/       sim.mjs (headless bot match), test.mjs (rules tests), mapcheck.mjs (map validation),
             e2e.mjs, modes.mjs, m3.mjs, m4.mjs, maps.mjs, vm.mjs, beauty.mjs (browser checks)
```

Players and bots run through the same `Combatant` simulation, driven by the
same command structure. Bots get no special movement, aim or visibility rules.
Bots see only along real lines of sight: geometry and smoke both block them.
They also have a field of view and a reaction delay.

The match simulation does not depend on rendering. `tools/sim.mjs` and
`tools/test.mjs` run it in Node.

## Testing

```bash
npm test                         # 172 headless tests (movement, weapons, damage, equipment, modes, economy, attachments, maps)
npm run sim -- 3 regular 5 dom old_quarter   # bots-only match: minutes, difficulty, bots per team, mode, map
npm run maps                     # validates spawns, nav connectivity and objectives on every map
npm run build && npm run preview &
npm run e2e                      # full browser flow in headless Chromium (needs Playwright)
node tools/modes.mjs             # every mode in the browser
node tools/m3.mjs                # progression/cosmetics/store/pass browser flow
node tools/m4.mjs                # unlocks, gunsmith, perks, support abilities, shield, flash
node tools/maps.mjs              # map picker + screenshots of the new maps
node tools/range.mjs             # firing range check
node tools/beauty.mjs high       # review screenshots from fixed viewpoints
```

## Performance notes

On High at 1280×720, a frame costs about 270 draw calls and 200k triangles. Map
geometry is merged per material, soldiers are rigid-skinned (about 13 draw calls
each) and particles are GPU-instanced. The target is 60 FPS at 1080p on a
mid-range discrete GPU. **That target has not been measured yet**: the
development container has no GPU and renders on the CPU with SwiftShader, at 1–3
FPS, so those numbers say nothing about real hardware. Turn on Settings → Graphics
→ Show FPS to measure on your machine. If you need more frames, lower Render
Resolution, Shadows or the quality preset.

## Assets & licenses

See [ASSETS.md](ASSETS.md). The only third-party code is three.js (MIT).

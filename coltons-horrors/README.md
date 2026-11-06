# Colton's Horrors

An original 1v4 asymmetric horror game for the browser. Play as one of four survivors trying to repair
generators and escape, or as the killer hunting them. Everyone else is a bot. Every character, map, model,
texture and sound is made in code for this project.

## Run it

Requires Node 18+ and a browser with WebGL 2 (desktop, or a phone/tablet with touch controls).

```bash
cd coltons-horrors
npm install
npm run dev          # http://localhost:5190
```

Other commands:

```bash
npm run build:single   # build/coltons-horrors.html, one self-contained file you can open anywhere
npm test               # headless smoke test: lobby + a bot-driven match on each side
node tools/sim.mjs survivor exe ashgrove   # simulate a whole match quickly (role, killer, map)
```

Useful URL options: `?role=killer`, `?killer=exe`, `?map=stivo`, `?q=low|medium|high`, `?autoplay` (bots play for you).

## What's in it

- **Killers** (original): **The Specter**, a drowned bride whose *Veil Walk* makes her invisible and fast but blind to survivors except for footstep ripples; **The EXE**, a corrupted program with a cracked CRT monitor for a head whose *Signal Jump* teleports between static-filled screens and glitches nearby survivors.
- **Survivors**: Colton Hale, Maya Okafor, Ruth Lindqvist, Dev Malhotra, Jess Navarro, Theo Brandt.
- **Maps**: Ashgrove Farmstead (corn, barn, silo), Hollow Pines Campground (pines, cabins, lake), St. Ivo's Sanatorium (ruined wards, constant rain and lightning), Gravelpit Salvage (car stacks, containers, oil-drum fires). Layouts are generated per match.
- **Perks**: 14 survivor, 14 killer. **Items**: flashlight, med kit, toolbox, survey map, with 12 add-ons. **Killer add-ons**: 8 per killer. **Offerings**: 12 (map choice, fog, storm, blood moon, bonus Marrow, extra chests, hatch, Hangman's Rope).
- **Cosmetics**: 4 to 5 outfits per character, bought with Marrow (earned in matches) in the Reliquary.
- **Rules**: 5 of 7 generators with skill checks, pallets and windows, hooks with stages and struggle, carrying and wiggling, flashlight saves, exit gates, the hatch, a 2-minute endgame collapse, scratch marks and blood for the killer, terror-radius heartbeat and chase music.

## Controls

| | Survivor | Killer |
| --- | --- | --- |
| Move | WASD, Shift run, C crouch | WASD |
| Use | hold LMB / E: repair, heal, unhook, gates, chests, unplug screens | Space / E: pick up, hook, break pallet, damage generator, vault, close hatch |
| Space | vault, drop pallet, skill checks, struggle | (action) |
| RMB / F / Q | item | power |
| Carried | tap A and D to wiggle free | |

## Code layout

`src/data.js` (all content) · `src/game/match.js` (rules) · `src/game/ai.js` (bots) · `src/world/builder.js` (maps) ·
`src/models/characters.js` (rigs and animation) · `src/ui/` (lobby, HUD) · `src/audio/audio.js` (synthesized sound).

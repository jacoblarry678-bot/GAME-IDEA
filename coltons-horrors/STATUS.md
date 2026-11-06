# Colton's Horrors: build status

An original 1v4 asymmetric horror game for the browser (three.js + Vite). You play as a survivor or a killer against bots.

## Done so far
- `src/data.js`: all content. 6 original survivors (Colton Hale, Maya Okafor, Ruth Lindqvist, Dev Malhotra, Jess Navarro, Theo Brandt), 2 original killers (The Specter with Veil Walk, The EXE with Signal Jump), 14 survivor perks, 14 killer perks, 4 items with 12 add-ons, 16 killer add-ons, 12 offerings, 4 maps, 34 cosmetic outfits.
- `src/core/profile.js`: save data, Marrow currency, store purchases, loadouts, settings.
- `src/core/util.js`: seeded RNG and math helpers.
- `src/world/textures.js`: procedural tileable textures (ground, wood, brick, concrete, rust, hay, bark, rock, vegetation cards, static).
- `src/models/characters.js`: survivor rig with outfits, The Specter, The EXE, aura outlines, procedural animation, first-person killer viewmodels.
- `src/world/batch.js`, `src/world/nav.js`: static mesh batching, A* navigation grid, line of sight.
- `src/world/props.js`: generator, hook, pallet, exit gate, chest, hatch and CRT screen meshes.

## Still to build
1. `src/world/builder.js`: map layout for the 4 maps (loops, main buildings, perimeter, vegetation, lighting, weather).
2. Match rules (generators, skill checks, hooks, chases, pallets, vaults, gates, hatch, endgame, scoring).
3. Bot AI for survivors and killers.
4. Input (keyboard, mouse, touch), HUD, lobby menus (loadout, cosmetics, store), audio.
5. `index.html`, styles, single-file build, tests.

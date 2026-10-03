# Asset sources & licenses

| Asset | Source | License |
| --- | --- | --- |
| Rendering engine | [three.js](https://threejs.org) r169 (npm `three`) | MIT |
| Rounded box / geometry merge helpers | three.js `examples/jsm` addons | MIT |
| All surface textures (asphalt, gravel, concrete, brick, corrugated metal, containers, wood, hazard paint, camo, fabrics, gun finishes) | Procedurally generated at load time in `src/world/textures.js` | Original (this project) |
| Normal & roughness maps | Derived at load time from the procedural height fields | Original |
| Signs, container branding (Kestrel Lines, Orba Freight, Nordvast, Tallis & Rowe, Meridian Box) | Canvas-drawn text in `src/world/textures.js` (fictional companies) | Original |
| Map (Cinder Yard) | Built in code: `src/world/maps/cinderYard.js` | Original |
| Weapon models (KV-7 Rampart, Vesper-9, Brakk-12, LR-338 Longreach, HX-9 Warden), grenades | Built in code: `src/fx/weaponModels.js` (fictional designs) | Original |
| Operator models | Built in code: `src/entities/soldierModel.js` | Original |
| Gunshots, foley, footsteps, impacts, explosions, UI sounds | Synthesized at load time: `src/audio/audio.js` | Original |
| Menu music & ambience | Synthesized at load time: `src/audio/audio.js` | Original |
| Announcer voice | The player's browser speech synthesis (Web Speech API), when available | Browser-provided at runtime |
| Cosmetics: weapon finishes, outfits, charms, calling cards, emblems, banners | Generated in code: `src/world/finishes.js`, `src/fx/weaponModels.js`, `src/entities/soldierModel.js`, `src/ui/art.js` | Original |
| UI fonts | Rajdhani, Inter via Google Fonts (falls back to system fonts offline) | SIL Open Font License 1.1 |

No images, models or audio files are downloaded or bundled. There are no names,
logos, maps or assets from existing games.

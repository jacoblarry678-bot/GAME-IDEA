# Asset sources & licenses

| Asset | Source | License |
| --- | --- | --- |
| Rendering engine | [three.js](https://threejs.org) r169 (npm `three`) | MIT |
| WebSocket server library (dedicated server only) | [ws](https://github.com/websockets/ws) 8 (npm `ws`) | MIT |
| Rounded box / geometry merge helpers | three.js `examples/jsm` addons | MIT |
| All surface textures (asphalt, gravel, concrete, brick, corrugated metal, containers, wood, hazard paint, camo, fabrics, gun finishes) | Procedurally generated at load time in `src/world/textures.js` | Original (this project) |
| Normal & roughness maps | Derived at load time from the procedural height fields | Original |
| Signs, container branding (Kestrel Lines, Orba Freight, Nordvast, Tallis & Rowe, Meridian Box) | Canvas-drawn text in `src/world/textures.js` (fictional companies) | Original |
| Maps (Cinder Yard, Old Quarter, Signal Station) | Built in code: `src/world/maps/*.js` with the shared kit `src/world/maps/kit.js` | Original |
| Cobblestone, plaster, cut stone, dirt, rock, hedge, awnings, chain-link | Procedural in `src/world/textures.js` | Original |
| Place and business names on signs (e.g. Place du Tram, Café Lumière, Signal Station 14) | Canvas text, fictional | Original |
| Weapon models (16 fictional designs incl. KV-7 Rampart, Tarn-556, Meridian-B, Bastion .30, Vesper-9, Wasp MP, Hollow-X, Brakk-12, Rook Auto-12, LR-338 Longreach, Sentinel DMR, Drover LSW, Anvil-60, HX-9 Warden, Grizzly .50, breaching axe), attachments, grenades, flash, Bulwark | Built in code: `src/fx/weaponModels.js`, `src/fx/deployablesView.js` | Original |
| Operator models | Built in code: `src/entities/soldierModel.js` | Original |
| Gunshots, foley, footsteps, impacts, explosions, UI sounds | Synthesized at load time: `src/audio/audio.js` | Original |
| Menu music & ambience | Synthesized at load time: `src/audio/audio.js` | Original |
| Announcer voice | The player's browser speech synthesis (Web Speech API), when available | Browser-provided at runtime |
| Cosmetics: weapon finishes, outfits, charms, calling cards, emblems, banners | Generated in code: `src/world/finishes.js`, `src/fx/weaponModels.js`, `src/entities/soldierModel.js`, `src/ui/art.js` | Original |
| **Waspinator collab** (Waspinator Keychain charm, Waspinator banner) | Character name used for a collaboration the project owner states is licensed (Oct 2026). The 3D keychain (`buildCharm` 'waspinator' in `src/fx/weaponModels.js`) and banner art (`waspBanner` in `src/ui/art.js`) are original procedural work in the character's colour scheme; no third-party artwork is included. | **Licensed collab — keep the license agreement on file and confirm its scope (name, likeness, platforms, territories, dates) before any public release.** |
| UI fonts | Rajdhani, Inter via Google Fonts (falls back to system fonts offline) | SIL Open Font License 1.1 |

No images, models or audio files are downloaded or bundled. The browser client uses the built-in WebSocket API; `ws` runs only in the Node server. There are no names,
logos, maps or assets from existing games.

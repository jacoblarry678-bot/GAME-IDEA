# Asset provenance

Every asset is made in code when the game starts. There are no image, model, audio or font files in the build, and no third-party art or sound.

| Asset | Origin | License | Where |
|---|---|---|---|
| Ground PBR materials (asphalt, concrete slabs, cast concrete, sand, grass, pavers, boardwalk, roof, terrazzo): colour, normal, roughness and AO maps | Procedural GLSL, baked on the GPU at startup | Original (same license as this repo) | `src/world/pbr.js` |
| Building facades and storefronts (colour, ORM, height → normal, night emissive layers; reflective glass), palm frond atlas and palm bark, shelving, water normal map, signs and plates | Procedural canvas drawing | Original | `src/world/textures.js` |
| Palms (coconut and royal): lofted trunks, frond strips, coconuts | Generated geometry | Original | `src/world/palms.js` |
| Ambient life: speedboats, yacht, jet ski, sailboats, cruise ship (fictional line), banner plane and banners, gulls, foam wakes | Generated geometry, canvas textures | Original | `src/world/ambient.js` |
| Buildings, roads, bridges (causeway and Seven Mile Bridge), beach terrain, the Marathon key (stilt houses, fuel canopy, RV trailers, marina pier, water tower, mangroves, the old bridge), shallow flats, props | Generated geometry from the district plan | Original | `src/world/build.js`, `src/world/props.js`, `src/world/district.js` |
| Cars (sedan, hatchback, SUV, muscle car, pickup, police cruiser) | Bodies and greenhouses lofted from cross-sections; alloy wheels, lamps, seams, interior | Original designs and names | `src/entities/vehicleModel.js`, `src/data/vehicles.js` |
| People | Rigidly skinned primitive bodies on an 18-bone skeleton, with procedural animation | Original | `src/entities/humanModel.js` |
| Places: Flamingo Park (lawns, fountain, court), Deco Auto Body garage and bay, Bayfront Arms, Threads on Lincoln, Sunray Gas canopy and pumps | Generated geometry and canvas signs | Original | `src/world/build.js`, `src/world/props.js`, `src/world/district.js` |
| Velvet Palms: a deco front with a neon palm, canopy and rope line; inside, velvet walls, a stage and runway with poles, a mirror wall, a bar with a lit back bar, a DJ booth, booths and tables | Generated geometry, canvas signs | Original | `src/world/build.js` (`buildClub`) |
| Velvet Palms show: mirror ball, light beams and spots, flying bills | three.js meshes animated at run time | Original | `src/game/club.js` |
| Club dance, pole spin, cheering, bartending and DJ animations | Procedural bone animation | Original | `src/entities/humanModel.js` |
| Club music (house set, plus the dembow and synth styles) | Generative sequencer, low-passed outside | Original | `src/audio/audio.js` |
| LOOP reels | Rendered live from the game at 90×160 into canvases | Original | `src/game/social.js` |
| Your LOOP posts (selfies, photos, clips) | Rendered live from the game at 135×240 by an in-game phone camera | Original | `src/game/creator.js`, `src/game/social.js` |
| LOOP posts | Written for this project; on request, generated at play time by Claude in the viewer's own claude.ai session (not stored in the repo) | Original / generated per session | `src/game/social.js` |
| Sky (Preetham atmospheric scattering, clouds, overcast, stars, moon), water (environment reflections, swell, sun glitter, foam), rain streaks, colour grade | GLSL shaders (the sky model follows the published Preetham et al. 1999 formulation, as in three.js's MIT-licensed Sky example) | Original / MIT | `src/core/engine.js`, `src/world/build.js`, `src/core/weather.js` |
| Engine, tyre, siren, horn, gunshot, impact, footstep, ambience, rain and thunder sounds | Web Audio synthesis | Original | `src/audio/audio.js` |
| Radio music (two stations) | Generative sequencer (original chord progressions and rhythms) | Original | `src/audio/audio.js` |
| UI fonts | Google Fonts: *Archivo Black*, *Inter* (falls back to system fonts offline) | SIL Open Font License 1.1 | `index.html` |
| Rendering library and post-processing passes (GTAO, bloom, output) | three.js 0.169 | MIT | `package.json` |

| Real Miami map: road geometry and names, building footprints and heights, land use, water, places of interest | Overture Maps Foundation release 2026-10-21.0 (themes: transportation, buildings, places, base). This includes OpenStreetMap data | ODbL 1.0 (OpenStreetMap-derived parts) and CDLA Permissive 2.0 (other Overture data). Attribution: "Map data © OpenStreetMap contributors (ODbL) and the Overture Maps Foundation", shown on the title screen and the map | `tools/mapdata/`, packed into `public/map/` at build time |

Business names in the map data are not used. Each business gets an invented name from its kind (`src/realmap/realshops.js`). Street and neighbourhood names are kept as public geography.

Nothing was extracted from Rockstar games or trailers: no models, textures, voices, music or animations.

**Real vs invented.**
- **Real public geography is used by name:**
  - Miami Beach, South Beach, the street names (Alton Rd, Washington Ave, Collins Ave, Ocean Dr, 17th St, Lincoln Rd, Española Way, 5th St, 3rd St, 1st St, South Pointe Dr)
  - Lummus Park, Muscle Beach, Flamingo Park, Biscayne Bay, the MacArthur Causeway, downtown Miami
  - the Seven Mile Bridge and the old bridge, Marathon, Boot Key Harbor, Sombrero Beach Rd, Virginia Key
  - The layout is compressed and not to scale.
- **Everything else is invented for this prototype:**
  - Businesses: Bayside Motel, Sunny Stop, Tidewater Diner, Bayfront Arms, Threads on Lincoln, Sunray Gas, Deco Auto Body, Velvet Palms, Slow Tide Bait & Fuel, The Salt Hook, Palm Hammock RV Park, the hotels and shops, the cruise line and the banner ads.
  - The police ("Precinct 3"; no real agency) and the hospital.
  - Characters: Cal, Sol, Teo, Rudy, the Caldera brothers, and the staff (Dee, Ines, Raj, Hector, Big Tomas; inside Velvet Palms: Jules, DJ Marea, Celeste, and the dancers Lux, Nova and Rio).
  - The LOOP app, its personas and posts, the accounts @cal.reyes and @sol.vega, the brand deals, and all dialogue.

## Placeholder → upgrade list (most visible first)

1. **People.** Primitive-capsule bodies with blocky hands and faces, procedural animation without IK. Replace with skinned, motion-captured characters (licensed packs or original scans) and foot IK.
2. **Cars.** Lofted bodies now, but doors don't open, there is no deformation, and the details are boxes. Upgrade to modelled cars with opening doors, full interiors and damage states.
3. **Building variety.** Box massing with PBR facade tiles. Add rounded deco corners, real balconies, awnings with depth, rooftop variety and props in shop windows.
4. **Vegetation.** The palms are real geometry now. Add LOD, bushes, hedges, sea grapes and dune grass.
5. **Sound.** Synthesised engine and gunshots are recognisable but thin. Replace with licensed or recorded engine loops and impacts. Add voiced dialogue.
6. **Water.** It reflects the sky (environment map) but not the city, and the waves are in the shader, not the geometry. Add screen-space or planar reflections and displaced swell near the camera.

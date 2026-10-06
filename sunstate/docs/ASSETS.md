# Asset provenance

Every asset is made in code when the game starts. There are no image, model, audio or font files in the build, and no third-party art or sound.

| Asset | Origin | License | Where |
|---|---|---|---|
| Road, concrete, pavers, sand, grass, wood and tile textures | Procedural canvas drawing | Original (same license as this repo) | `src/world/textures.js` |
| Building facades (4×4-bay tiles with night-lit windows), storefronts, shelving, palm fronds, water normal map, signs and plates | Procedural canvas drawing | Original | `src/world/textures.js` |
| Buildings, roads, bridges (causeway and twin-span), beach terrain, the Cayo Lento key (stilt houses, fuel canopy, RV trailers, marina pier, water tower, mangroves, the old bridge), shallow flats, props | Generated geometry from the district plan | Original | `src/world/build.js`, `src/world/props.js`, `src/world/district.js` |
| Cars (sedan, muscle car, pickup, police cruiser) | Extruded side profiles + primitives | Original designs and names | `src/entities/vehicleModel.js`, `src/data/vehicles.js` |
| People | Rigidly skinned primitive bodies on an 18-bone skeleton, with procedural animation | Original | `src/entities/humanModel.js` |
| Sky (with overcast), water, rain streaks | GLSL shaders | Original | `src/core/engine.js`, `src/world/build.js`, `src/core/weather.js` |
| Engine, tyre, siren, horn, gunshot, impact, footstep, ambience, rain and thunder sounds | Web Audio synthesis | Original | `src/audio/audio.js` |
| Radio music (two stations) | Generative sequencer (original chord progressions and rhythms) | Original | `src/audio/audio.js` |
| UI fonts | Google Fonts: *Archivo Black*, *Inter* (falls back to system fonts offline) | SIL Open Font License 1.1 | `index.html` |
| Rendering library | three.js 0.169 | MIT | `package.json` |

Nothing was extracted from Rockstar games or trailers: no models, textures, voices, music or animations. Place names (Costa Vela, Ocean Mile, Vela Bay, Cayo Lento, the Vela Keys), businesses (Lento Bait & Fuel, The Salt Hook, Palm Hammock RV Park, Cayo Lento Marina), characters (Cal, Sol, Teo, Rudy, the Caldera brothers) and dialogue are invented for this prototype.

## Placeholder → upgrade list (most visible first)

1. **People.** Primitive-capsule bodies with blocky hands and faces, procedural animation without IK. Replace with skinned, motion-captured characters (licensed packs or original scans) and foot IK.
2. **Cars.** Extruded silhouettes with no doors that open and no interiors beyond seats. Upgrade to modelled cars with opening doors, interiors, and deformation and damage states.
3. **Building variety.** Box massing plus texture tiles. Add rounded deco corners, balconies, awnings with depth, rooftop variety and interior props in shop windows.
4. **Palms and vegetation.** Instanced cards. Add LOD trees, bushes, hedges, and grass on the beach dunes.
5. **Sound.** Synthesised engine and gunshots are recognisable but thin. Replace with licensed or recorded engine loops and impacts. Add voiced dialogue.
6. **Water.** No reflections of the city and no waves in the geometry. Add planar or screen-space reflections and a swell.

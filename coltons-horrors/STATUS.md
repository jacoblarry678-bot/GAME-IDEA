# Status: v1.3.0

1.3.0: Woodsman rework (throwable axe with pickup and a 15 s spare), survivor and killer buffs, Pirate's Feast
cosmetics (9 outfits with new tricorn, bandana, eyepatch and sash pieces), Ship's Feast offering.
Verified: `tools/throw.mjs` (12 m throw injures, axe lands, pickup and spare work), `tools/normals.mjs` clean,
full `tools/sim.mjs` match against The Woodsman with no errors.

## 1.2.0

1.2.0: The Woodsman is live (out of PTB). New map Crane Ridge Sawmill (snow). Long Winter cosmetics (9 outfits).
Fixed black flicker: zero-length normals on character limbs (three.js capsule poles) and roof gables produced NaN
lighting (black pixels, and black blocks with bloom). All meshes are now repaired at load (`repairNormals`), a NaN
guard runs before bloom, the camera no longer passes through roofs or window frames, CSS blend modes and backdrop
filters over the canvas were removed, and lost WebGL contexts are recovered.
Verified: `tools/normals.mjs` clean on all 5 maps, `npm test`, `tools/mori.mjs`, full `tools/sim.mjs` match on
Crane Ridge Sawmill.

## 1.1.0 (PTB)

1.1.0 adds The Woodsman (PTB killer with Heavy Chop), moris (Ashen Rite offering) and mini moris (last survivor).
Verified with `npm test`, `node tools/mori.mjs` (full and mini mori for every killer) and a full
`tools/sim.mjs` match against The Woodsman.

## 1.0.0

Done: everything listed in README.md. Verified with `npm test` (lobby, survivor match, killer match: no errors)
and `tools/sim.mjs` full bot matches on several maps (generators, gates, escapes, hooks, sacrifices, hatch and
endgame all reached).

Known limits: bots only (no online play); character models are stylized low-poly built from primitives; the bot
killer is strong on Hard.

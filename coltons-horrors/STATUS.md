# Status: v1.1.0 (PTB)

1.1.0 adds The Woodsman (PTB killer with Heavy Chop), moris (Ashen Rite offering) and mini moris (last survivor).
Verified with `npm test`, `node tools/mori.mjs` (full and mini mori for every killer) and a full
`tools/sim.mjs` match against The Woodsman.

## 1.0.0

Done: everything listed in README.md. Verified with `npm test` (lobby, survivor match, killer match: no errors)
and `tools/sim.mjs` full bot matches on several maps (generators, gates, escapes, hooks, sacrifices, hatch and
endgame all reached).

Known limits: bots only (no online play); character models are stylized low-poly built from primitives; the bot
killer is strong on Hard.

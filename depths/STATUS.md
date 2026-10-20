# Status

## Milestone 1: chapter one vertical slice (in progress)

- Chapter one, The Yellow Silence: the Annex prologue corridor and all twelve
  rooms (1.01 to 1.12), refuges R1 and R2 with working clocks, the Survey
  Station, P1 (circuit order) and P2 (tone authentication), records 01 to 06,
  the decoy demonstration, the Listener hall chase and the service lift.
- Systems: movement (walk, crouch, sprint, lean, mantle), stamina, health,
  composure, flashlight charge, camera exposures with flash and development,
  hidden-layer photographs, pouch with eight supply types, doors (quiet hold
  or fast press), lockers, refuge verification and securing, checkpoints,
  death and retry, three campaign save slots with backup and checksums.
- Interface: main menu, new campaign (difficulty, assists, content note),
  settings (presets, subtitles, visual comfort, startle and assists, audio,
  controls with rebinding, graphics, interface), HUD, journal (five tabs),
  inventory, puzzle panels, pause, death screen.

Verification so far: `tools/ch1run.mjs` plays chapter one headlessly through
the public game API; `tools/e2e.mjs` drives the built game in headless
Chromium (28 checks).

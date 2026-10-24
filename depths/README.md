# DEPTHS OF THE UNSEEN

A first-person Backrooms survival horror game for one to four players that runs
in the browser. It is built from the *Depths of the Unseen* complete design
document (version 1.0). An overnight maintenance crew follows a distress call
from a coworker who went missing eleven years ago into an impossible service
corridor. An instant camera shows what hides beneath ordinary rooms.

Everything in it is generated in code when the game loads: rooms, textures,
creatures, voices, sounds and music. There are no downloaded assets.

> The full campaign (six chapters and three endings), Expedition mode and
> online co-op are playable. Co-op runs on a server you host yourself
> (`npm run server`): no accounts, no matchmaking, no public servers. See
> [STATUS.md](STATUS.md) for what was verified and the known limits.

## Run it

Requires Node 18+ and a desktop browser with WebGL 2.

```bash
cd depths
npm install
npm run dev        # http://localhost:5190
```

Production build:

```bash
npm run build && npm run preview     # http://localhost:4195
```

Click into the game to capture the mouse. `Esc` releases it and opens the pause
menu. Solo play pauses the world; online play keeps running.

On a phone or tablet, touch controls appear once you touch the screen: a stick
on the left moves (it appears where your thumb lands), dragging anywhere else
looks, and buttons cover the other actions. Hold **Act** to open doors quietly.
**Full** goes full screen where the browser allows it. Settings → Controls can
show the touch controls always or turn them off.

## Online co-op (self-hosted)

One person hosts and up to three people join. The host's browser runs the game;
the server only passes messages between players and serves the files.

```bash
cd depths
npm install
npm run build        # the server serves these files
npm run server       # prints http://localhost:4194/ and your network address
```

- **Host:** open the printed address, choose **New Campaign → Host online**. The
  invite code appears on screen and in the pause menu. A solo campaign can also
  be opened to guests later from the pause menu (**Open to guests**).
- **Guests:** open the same address, choose **Join Game**, type the six-character
  code and pick a character.

Guests join as spectators and spawn at the next genuine refuge or chapter entry.
The host keeps the save and has final campaign control. If a guest disconnects,
their supplies are left in a labeled bag at the next refuge, and they get them
back when they rejoin. Players on other networks need TCP 4194 forwarded, or a
VPN. Options: `--port <n>`, `--quiet`. `GET /api/status` returns relay status as
JSON.

## Controls (defaults; everything can be rebound)

| Action | Keyboard / mouse | Controller |
| --- | --- | --- |
| Move · sprint · crouch | WASD · Shift · Ctrl | Left stick · L3 · B |
| Interact (hold for quiet doors) | E | A |
| Use tool · inspect or aim | Left click · right click | RT · LT |
| Ping | Middle click | RB |
| Flashlight · camera flash | F · X | D-pad up · R3 |
| Tool radial · tools 1–4 | Q · 1–4 | LB · D-pad left/right |
| Reload · inventory · journal | R · I · Tab | X · Y · View |
| Mantle · lean | Space · Z/C | A · LT + D-pad |
| Callouts · steady breathing · hint | T · B · H | D-pad down (callouts) |
| Text chat (co-op) | Enter | |

Settings include accessibility presets (Standard, Reduced Motion, Low Vision,
Deaf and Hard of Hearing, Simplified Interaction), subtitles and environmental
captions, a sound-direction ring, flash, flicker, grain and motion controls,
Reduced Startle, hold-to-toggle, navigation assistance, text size, high
contrast and a one-hand controller layout. The No Damage and Timer assists are
chosen when a campaign starts.

## What is in it

- **Campaign:** six chapters (The Yellow Silence, After Closing, Stillwater,
  The Residents, Service Below, The Unseen Depth) with twelve puzzles, four
  pieces of optional evidence, six creatures, thirty-six records, six secret
  photographs, June's rescue, return trips to recover missed proof, and three
  endings: A Familiar Voice, The Door We Open, and Cut the Line. After an
  ending, **Continue** resumes just before the final choice.
- **Expedition:** unlocked by any ending. A seeded run through twelve connected
  rooms built from one environment and its creature. There are three objectives
  from six puzzle families, a relay control, two refuges and an extraction lift.
  Share the six-character seed to play the same run.
- **Chapter Select, Collection** (records, photographs, achievements, endings,
  camera finishes) and eighteen achievements.

## Checks

```bash
npm test                  # rules and unit tests (puzzles, creatures, saves, parking, Expedition, relay)
npm run levels            # level validation for every chapter and return trip
npm run playthrough -- --chapters 1-6 --ending door      # a bot plays the campaign headlessly
npm run expedition        # a bot completes twelve generated Expedition runs
npm run coop              # co-op over real sockets: relay, host and guest
npm run build && npm run e2e        # the built game in headless Chromium
npm run build && npm run coop:e2e   # host and guest browsers through the real server
npm run build && npm run touch:e2e  # a phone-sized touch screen: stick, look drag and buttons
```

The playthrough bot uses only the public game API: inputs, interactions and
puzzle actions, never teleports. Options: `--ending familiar|door|cut`,
`--june` / `--no-june`, `--evidence all|none|late` (`late` recovers the proof on
return trips from the chapter six freight nexus), `--seed`, `--difficulty`.

## Layout

```
src/sim/       authoritative simulation (no DOM): level, collision, nav grid, sound graph,
               player, creatures, puzzles, story, director, refuges, machines, Expedition
src/data/      chapters, creatures, records, dialogue, items, props, achievements
src/view/      three.js rendering: level batching, props, creatures, lights, first person, photos
src/ui/        menus, HUD, overlays (journal, panels, reader, ending), styles
src/net/       co-op protocol, host and guest sessions, transport
src/audio/     synthesized sound effects, ambience, voices and music cues
server/        self-hosted relay and static server
tools/         bot, playthrough, level check, tests, browser checks, screenshot helpers
```

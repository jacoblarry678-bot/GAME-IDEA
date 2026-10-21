# Status

This file records what works, how it was verified, and the known limits at
each milestone handoff.

## Milestone 1: Engine and chapter one (complete)

- An authoritative simulation with no DOM dependency (level, collision, nav
  grid, room-portal sound graph, player, creatures, puzzles, story, director,
  checkpoints). The same code runs solo, the co-op host and the headless tools.
- Chapter one, The Yellow Silence: the Annex prologue and rooms 1.01 to 1.12,
  refuges with working clocks, the Survey Station, P1 and P2, records 01 to 06,
  and the Listener.
- Systems: walk, crouch, sprint, lean, mantle, stamina, health, composure,
  flashlight charge, the instant camera with flash, development and a hidden
  photo layer, a four-slot pouch, doors (quiet hold or fast press), lockers,
  refuge verification and securing, three save slots with backup and checksums.
- Interface: main menu, campaign setup with difficulty, assists and a content
  note, full settings with rebinding, HUD, a five-tab journal, inventory,
  puzzle panels, pause and the death screen.

## Milestone 2: The campaign (complete)

- Chapters two to six with their creatures: the Cutouts and shutter cycles,
  the Drowned Shape, the Tenant and imitation refuges, the Caretaker and
  machine cover (machines run and rest; a running one masks footsteps; it
  ignores steady sources), and the Unseen (it sees movement within ten metres
  and ignores a crouched, still player beside cover).
- All twelve puzzles (P1 to P12) and the four proofs (E1 to E4), June's
  rescue, the memory scene, and Lena seen alive behind glass.
- Chapter six: a freight nexus with return trips to the four evidence
  landings. The chapter is saved before each trip and resumes exactly as it
  was left. Then three fragment rooms that keep their creatures' rules, the
  first live Unseen, P11, the ending-requirements board, and P12 with a
  three-second commit.
- Three committed routes and endings: the voice gates and a hall where the
  Unseen keeps pace behind glass (A Familiar Voice), the maintenance bypass
  with Lena's protected lane and release levers (The Door We Open), and the
  guarded purge with a 90-second evacuation (Cut the Line). Endings have June
  variants, a last developed photograph, credits and a post-credits screen.
  **Continue** reloads the checkpoint just before the final choice.

## Milestone 3: Replay and Expedition (complete)

- Expedition: a seeded run through twelve rooms. A Hamiltonian room path,
  role assignment, and a loop around every threat room. Six puzzle families
  (symbol sequence, address matching, safe path, counterweights with a
  uniqueness check, valve state, sound routing), each with a clue that costs
  no consumables. Every generated run passes the shared level validation
  before it loads. A quit leaves a suspend snapshot that is used up when
  resumed; it stores the generated layout, not just the seed. There is a
  results screen and personal records.
- Achievements wired: A01 to A18, including A14 (a Listener pursuit ended
  without damage) and A16 (two active players from chapter entry to exit).
- Collection, Chapter Select (separate replay instances), camera finishes on
  the in-hand camera, and a one-hand controller layout.

## Milestone 4: Online co-op (complete)

- `npm run server` serves the game and a WebSocket relay with six-character
  invite codes. The relay only routes messages.
- The host's browser is authoritative. Guests:
  - join as spectators and spawn at a genuine refuge or a chapter entry, with
    the once-per-chapter joining allowance;
  - predict their own movement (the host corrects impossible moves);
  - send intended actions, which run through the same Game API the host uses.
- Snapshots carry players, creatures, doors, NPCs, puzzles, pickups and
  machine and shutter state. Story events and full chapter snapshots keep
  each guest's copy of the game in step.
- Disconnects: a leaving guest's supplies go into a labeled bag at the next
  refuge and come back when the same player rejoins. A stalled guest becomes
  noninteractive after 3 s and is dropped after 10 s. When the host leaves,
  the session ends.
- Also: a shared pause by unanimous vote with a three-second resume
  countdown, a guest request that holds P12 for thirty seconds, text chat,
  teammate bodies and markers.

## Milestone 5: Verification and docs (complete)

**Verification run (all passing)**
- `npm test`: 30/30 tests. They cover every puzzle (correct, incorrect and
  repeated input), creature perception (Caretaker masking and habituation, the
  catwalk chase, Unseen sight and cover, Cutout observation), saves that
  survive a failed write, checkpoint round-trips with monotonic evidence,
  side-trip parking, the return lifts, endings, the relay, Expedition
  determinism and validity, and restoring a suspended run.
- `npm run levels`: all six chapters and their return trips are valid.
- `npm run playthrough -- --chapters 1-6`: a bot plays the whole campaign from
  chapter one with no teleports. All six ending and June combinations pass, as
  do recovering every proof late through the nexus, Nightmare, and Guided.
- `npm run expedition`: the bot completes twelve generated runs. This check
  uses the No Damage assist; with damage on, the bot (which does not sneak) is
  sometimes caught by a Listener, which is the intended danger.
- `npm run coop`: 24 checks over real sockets. They cover the invite code,
  admission and spawn, movement validation, guest actions, pickups, the
  disconnect bag and rejoin, chapter changes, chat, the pause vote, the P12
  hold, and the host leaving.
- `npm run e2e`: 28 checks in headless Chromium against the built game, with
  the console free of errors.
- `npm run coop:e2e`: 11 checks with a host browser and a guest browser
  through the real server, with the console free of errors.
- `tools/endingshot.mjs` and `tools/xshot.mjs` drive the ending, credits and
  post-credits screens and the Expedition menu, run, suspend and resume, and
  results in the browser.

**Known issues and limits**
- Real-GPU performance has not been measured. This container renders on the
  CPU (SwiftShader, well under 1 FPS), so the browser checks run slowly and
  some scenes were judged from software-rendered screenshots, which are
  darker than on a GPU. Use `?lowgfx` or the graphics presets if a machine
  struggles.
- Voices are synthesized murmurs with subtitles. Browser speech synthesis is
  optional and depends on the voices the browser has installed.
- Co-op has no voice chat. Text chat, character callouts and pings are
  available. The Friends, Invite Only and Open choices all work through the
  invite code; there is no friends list or server browser. Host migration is
  outside the design's launch scope. Guests on other networks need the port
  forwarded or a VPN.
- A guest whose browser stops sending input for three seconds (a background
  tab, or very low frame rates) becomes noninteractive by design until it
  sends input again.
- Animation is procedural and simple: no inverse kinematics, and basic seated
  and downed poses.
- Motion blur is listed as a comfort toggle in the design, but the renderer
  has no motion blur, so there is nothing to turn off.

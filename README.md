# HELLRAISER: THE GAME

A browser-based, asymmetrical multiplayer horror prototype. Four survivors are
trapped in **The Labyrinth** performing a rite that will open the Gate. One
player is **The Hell Priest**, and is trying to make sure nobody finishes it.

> **Non-commercial fan prototype.** Not affiliated with, endorsed by, or
> licensed from the rights holders of the Hellraiser films or Clive Barker's
> *The Hellbound Heart*. Every asset in this build is generated procedurally in
> code — see [Assets](#assets).

---

## Running it

```bash
npm install
npm run dev
```

Then open **http://localhost:5173**.

That is the whole process. `npm run dev` starts both the game server (port
3000) and the client (port 5173) in one command, and prints a banner with the
LAN address other devices should use.

### Playing with people on the same WiFi

1. **You** open the page, click **HOST GAME**, enter a name, click **OPEN THE
   LOBBY**. The game shows a six-character code, e.g. `H3LL66`.
2. **Everyone else** opens the LAN address the server printed
   (e.g. `http://192.168.1.42:5173`) on their own laptop, tablet or phone,
   clicks **JOIN GAME**, types `H3LL66`, and they are in your lobby.
3. Fill any empty seats with bots, pick characters, and click **BEGIN THE RITE**.

Nobody ever types an IP address *into the game* — the code is the only thing
you read out. The one URL is unavoidable (a browser has to be pointed at
something), so the server prints it in a banner and the main menu displays it
too.

For a single-machine build served on one port:

```bash
npm start          # builds the client and serves everything from :3000
```

---

## Why this stack

| Choice | Reason |
| --- | --- |
| **three.js (vanilla)** | Full control of the render loop, post-processing chain and per-frame skeletal maths. React Three Fiber would put a reconciler between me and a 60 fps game loop for no benefit here. |
| **Vite** | Instant dev server, ES modules, and a `shared/` directory that both the browser and Node import without a build step. |
| **Node + Express + Socket.IO** | One process serves the client *and* the websocket, so LAN players hit a single origin — no CORS, no second port to explain, no separate signalling server. Socket.IO gives rooms (perfect for lobby codes), automatic reconnection and a websocket→polling fallback for awkward networks. |
| **WebRTC / peer-to-peer** | *Rejected.* Browser P2P still needs a signalling server, so it does not remove the backend — it just adds NAT traversal, per-peer state reconciliation and a much harder debugging story, in exchange for latency that is irrelevant on a LAN. |
| **Procedural assets** | No downloads, no licensing risk, tiny repo, and every generator is a single swappable function when real art arrives. |

### Authority model

The server is authoritative over everything that decides a match: health,
damage, objectives, doors, item ownership, ability legality, cooldowns, the
clock and the win condition.

Movement is **client-simulated and server-validated**. Each client runs its own
character controller so input is instant on any network, reports its position
30×/second, and the server rejects anything that moved faster than the role's
maximum speed or ended inside solid geometry — snapping the client back with a
correction. This is the same trade-off *Dead by Daylight*-likes make: a chase
stays responsive over consumer WiFi while the cheats that actually matter
(infinite health, free objectives, walking through walls) remain impossible.

Remote players are rendered 100 ms in the past and interpolated between the two
snapshots that bracket that time, which is what makes other players move
smoothly rather than teleporting 20×/second.

---

## The rite (survivor objectives)

Not generators. Five stages, in order:

1. **Break the seals** — channel 4 of 6 ritual seals bound into the walls.
2. **The offering** — carry 3 ritual relics to the altar. One at a time, so it
   is a real decision about routing and exposure.
3. **The configuration** — recover 3 fragments of the Lament Configuration and
   set them on the altar.
4. **Solve the box** — somebody has to open it. See below.
5. **The Gate** — solving the box unbinds the Gate. Charge it together (faster
   with more people) and get out.

### The Lament Configuration

The box is a real interactive object, not a key. Four independently rotating
segments, each with six etched symbols; the server owns the target combination
and validates every turn. Solving it is deliberately dangerous:

- every turn **heats** the box, and heat is what the Cenobite feels
- while the box is being solved the Cenobite's **Lament Teleport** unlocks —
  it can step out of the puzzle beside whoever dared to open it
- a wrong commit **damages** the solver, spawns chains, and can reshape the map
- solving it spikes every survivor's fear and cuts the lights

It also physically sits on the altar in the world, turning, glowing hotter as
it is worked.

---

## The Hell Priest

| Key | Ability | Effect |
| --- | --- | --- |
| LMB | Melee | Close-range, arc + line-of-sight checked. |
| 1 | **Chain Summon** | Launches a hooked chain. On hit: damage, root, and drags the survivor toward you. |
| 2 | **Chain Trap** | Buried snare. Arms after 2s, holds and marks whoever crosses it. |
| 3 | **Gateway** | Tears a corridor to a point you can see. Survivors hear it. |
| 4 | **Pain Sense** | Reveals every survivor who is injured, bleeding or badly frightened. |
| 5 | **Lament Teleport** | Only while the box is being solved. |
| F | **Execution** | Finishes a downed survivor. You are locked in place and visible for the whole rite. |

The Priest's top speed is **slower than a sprinting survivor**. It wins with
position, information and patience, not a footrace. Abilities cost Power, which
regenerates and is fed by hits, downs and survivor progress.

Counterplay: hide, vault to break line of sight, Gideon's **Ward** blocks
ability casts inside it, Wren's **Jam the Works** seals a door, and the
Cenobite is fully committed and visible during an execution.

---

## Systems

- **Fear** — rises near Cenobites, in darkness, alone, when chased, injured, or
  when watching a teammate die. High fear means camera shake, lens warp,
  desaturation, a faster heartbeat, heavier breathing, and slower hands on
  delicate work. Falls near teammates, in light, and with certain perks.
- **Horror director** — paces supernatural events against measured tension
  rather than firing randomly: lights out, chains stirring, doors slamming,
  distant screams, apparitions, blood running down walls, whispers, corridor
  shifts. It goes *quieter* when players are already terrified.
- **Health states** — healthy → injured (bleeding, limping) → downed (crawling,
  60s bleed-out) → dead. Teammates can pick you up or patch you up.
- **Bots** — server-side A* over the same grid the player walks. Survivor bots
  pick objectives by phase, loot, flee on sight, revive teammates and fumble
  the box like a human. The Cenobite bot patrols objectives, chases, chains,
  traps and executes.

---

## Project layout

```
/shared         constants, protocol, deterministic map + RNG (imported by BOTH sides)
/server         Express + Socket.IO, lobby manager, authoritative match sim, A* bots
/client/src
  /core         engine (renderer, post-processing), input, settings, texture library
  /world        Labyrinth builder, procedural props
  /entities     procedural rigged characters + animator, character controller
  /gameplay     match runtime, effects, the Lament Configuration
  /net          Socket.IO client, snapshot interpolation
  /ui           menu, lobby, HUD, settings, debug menu, menu backdrop, styles
  /audio        Web Audio synthesis engine
/tools          headless Playwright harnesses used to test and screenshot the build
/public/assets  empty directories ready for real models/textures/audio/animations
```

### The Labyrinth

Generated deterministically from the lobby code, so the server and every client
produce byte-identical geometry — the same grid is used for rendering,
collision and pathfinding.

Two floors, ~3,500 walkable cells (288 m across): **The Entrance**, **The Chain
Hall**, **The Archives**, **The Torture Gallery**, **The Blood Corridor**, **The
Puzzle Chamber**, **The Inner Labyrinth** (two seeded maze wings, braided so
they have loops and shortcuts rather than one solution), **The Gate**, plus an
upper gallery, a desecrated chapel, an overlook, sealed stacks, and three hidden
rooms (boiler, ossuary, cistern). Connected by stairwells and an elevator shaft,
with doors, vault obstacles, environmental hazards, 26 searchable containers and
22 hiding places. Connectivity is verified at generation time — every objective
site is guaranteed reachable.

---

## Assets

Everything is generated in code at runtime:

- **Textures** — stone, rust, wood, tile, obsidian, bone, wallpaper, concrete
  and leather are painted to a canvas with fBm noise, with roughness maps and
  Sobel-derived normal maps. Regenerated at a different resolution when you
  change texture quality.
- **Characters** — a real bone hierarchy with capsule limb meshes, posed
  analytically. No animation files: walk, run, crouch, crawl, vault, attack,
  execute, interact and injury are computed from maths, so they blend smoothly
  and react continuously to speed, injury, fear and look pitch.
- **Audio** — pure Web Audio synthesis. Footsteps are filtered noise bursts,
  chains are metallic resonator banks, screams are formant synthesis, and the
  chase track is a generative drone with a heartbeat that follows your fear.
  Positional sounds go through `PannerNode` for real 3D audio.

**Replacing them with professional art:** every generator sits behind one
function. `TextureLibrary.get()` for surfaces, `PROPS[kind]` for furniture,
`Character.buildBody()` for characters (map a GLTF's bones onto the same
`this.bones` names and the existing animator drives them unchanged), and
`AudioEngine.play(name, opts)` for sound. `/public/assets` has directories
waiting.

The Cenobite model is an original placeholder built from primitives and is
labelled as such in-game, so no likeness is copied from the films.

---

## Performance

Targets 60 fps on desktop and 30–60 fps on capable laptops.

- Walls, floors and ceilings are emitted as raw vertex buffers and merged per
  material **per 32 m chunk**, so frustum culling actually works — this cut the
  in-match triangle count from 1.64 M to ~250 k.
- Every repeated prop kind becomes one `InstancedMesh` per chunk.
- Hundreds of chains sway in a vertex shader, costing no CPU time.
- Dynamic lights are a small pool that follows the camera; the other ~100 light
  anchors are emissive geometry, so a hundred candles cost one draw call and
  zero shadow maps.
- Effects (chains, traps, gateways, blood, apparitions) are pooled — nothing
  allocates geometry mid-match.
- Four quality presets (Low/Medium/High/Ultra) plus individual toggles for
  shadows, AA, bloom, grain, fog, texture quality and resolution scale.

---

## Controls

**Survivor** — WASD move · Shift sprint · Ctrl crouch · **E** hold to interact ·
Space vault · F flashlight · Q active perk · 1 use medkit · G drop · Enter chat ·
Esc release mouse · **F3** debug menu

**Hell Priest** — LMB melee · 1–5 abilities · F execute · R step through your
gateway

Gamepads are supported (left stick move, right stick look, face buttons for
interact/vault/crouch/flashlight). Every keyboard binding is remappable in
Settings, which also has accessibility options: reduced shake, reduced
flashing, larger text, high-contrast prompts, a fear-visuals slider and a
toggle for the heartbeat cue.

---

## Debug menu (F3)

FPS, draw calls, triangles, ping, connection status, snapshot buffer, player
count, position, floor, current room, role, health, fear, stamina, power, match
phase, and noclip state. The host additionally gets buttons to heal, spawn
items, teleport to the altar or Gate, skip objectives, solve the box, trigger
horror events, set fear, toggle the AI and end the match. Debug commands are
host-only so a guest cannot end everyone's match.

---

## Testing

```bash
node server/smoketest.js 60     # headless: host, join by code, anti-cheat, bots playing a match
node tools/e2e.mjs              # two real browsers: host → code → join → start → move
node tools/play.mjs             # solo match with bots, perf numbers, screenshot
```

The smoke test drives the whole server without a renderer — it was how the
gameplay loop was validated before there was anything to look at. It asserts
that a lobby code round-trips, that an invalid code is rejected, that a 560 m
teleport is corrected, and that bots actually progress the ritual.

---

## Known gaps

- Only the Hell Priest is playable. The Chatterer, Butterball and the Deep
  Throat are in the roster as **COMING SOON** with their planned kits described.
- One map (The Labyrinth).
- The elevator shaft is walkable but the platform does not animate yet.
- Voice chat, progression and matchmaking beyond LAN codes are out of scope.

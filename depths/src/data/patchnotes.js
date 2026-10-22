/**
 * Patch notes, newest first. They ship inside the game bundle, so they stay
 * readable offline. Each entry has optional sections: added (new features),
 * fixes (grouped, with optional subgroups), changes (gameplay changes),
 * known (known issues) and notes (save compatibility and similar).
 */
export const PATCH_NOTES = [
  {
    version: '1.0.1',
    title: 'Hotfix 1.0.1',
    tagline: 'Bug fixes, stability improvements, and an in-game patch notes menu.',
    intro: [
      'Wanderers,',
      'Hotfix 1.0.1 addresses progression issues, inconsistent entity behavior, and several co-op bugs. We’ve also added a place to read patch notes directly inside the game.',
      'Thank you for reporting problems—and for checking the clocks.',
    ],
    added: [
      {
        title: 'New: in-game patch notes',
        items: [
          'Added Patch Notes to the main menu and pause menu.',
          'Notes are organized by version, with the newest update displayed first.',
          'New entries receive an Unread indicator that clears after opening them.',
          'Added sections for fixes, gameplay changes, and known issues.',
          'Installed game version now appears in the main menu’s lower-right corner.',
          'Opening patch notes pauses solo gameplay. Online sessions continue running, with a notice displayed before opening.',
          'Downloaded notes remain readable offline.',
        ],
      },
    ],
    fixes: [
      {
        title: 'Progression & puzzle fixes',
        items: [
          'Fixed the Yellow Silence maintenance lift occasionally remaining locked after both required puzzles were completed.',
          'Fixed mall shutter switches becoming unresponsive when two players interacted with the same control simultaneously.',
          'Fixed Stillwater drain valves visually resetting after loading a checkpoint despite retaining their completed puzzle state.',
          'Fixed apartment mail clues occasionally appearing beneath an inaccessible prop.',
          'Fixed June stopping at the refuge doorway during her optional rescue.',
          'Fixed the Service Below counterweight puzzle failing to recognize a correctly seated weight after a rapid interaction.',
          'Fixed the freight return route occasionally disappearing from the journal after revisiting an earlier chapter.',
          'Fixed collected ending evidence failing to register when its collector disconnected before reaching the next refuge.',
        ],
      },
      {
        title: 'Entity fixes',
        groups: [
          { title: 'The Listener', items: [
            'Fixed the Listener reacting to player voice-chat audio. Only intended in-game sounds attract it.',
            'Fixed an extra footstep cue sometimes playing inside a verified refuge.',
          ] },
          { title: 'The Cutouts', items: [
            'Fixed Cutouts occasionally moving while clearly observed by another connected player.',
            'Fixed one mall display spawning inside a closed shutter.',
            'Fixed the flash-stun effect ending early for players joining an existing session.',
          ] },
          { title: 'The Drowned Shape', items: [
            'Fixed the creature crossing onto dry grating near the filtration walkway.',
            'Fixed water-wake effects disappearing at certain viewing angles.',
          ] },
          { title: 'The Tenant', items: [
            'Fixed gaze buildup continuing while the player inspected a photograph.',
            'Fixed the warning cue failing to reset after the required period of broken eye contact.',
          ] },
          { title: 'The Caretaker', items: [
            'Fixed machinery failing to mask movement sounds during one pressure-cycle sequence.',
            'Fixed the Caretaker becoming stuck against an inspection crawlway entrance.',
          ] },
          { title: 'The Unseen', items: [
            'Fixed warning footprints occasionally appearing after its attack had already begun.',
            'Fixed photographs displaying its current position instead of its position when the shutter fired.',
          ] },
        ],
      },
      {
        title: 'Camera & inventory',
        items: [
          'Fixed a rare issue that consumed two exposures from one camera input.',
          'Fixed developing photographs becoming permanently blank after a checkpoint reload.',
          'Fixed required Survey Station images failing to enter the journal when the consumable pouch was full.',
          'Fixed duplicated film packs caused by simultaneous co-op pickups.',
          'Fixed door wedges remaining in inventory after use.',
          'Improved interaction targeting for small items on cluttered desks.',
        ],
      },
      {
        title: 'Refuges & checkpoints',
        items: [
          'Fixed installed refuge clocks occasionally appearing frozen at low frame rates.',
          'Fixed entity pursuit audio continuing after all players entered a genuine refuge.',
          'Fixed one checkpoint placing a returning player outside the refuge door.',
          'Fixed resting failing to save newly collected lore records.',
          'Added clearer feedback when a checkpoint save finishes.',
        ],
      },
      {
        title: 'Co-op & stability',
        items: [
          'Fixed a crash when a player disconnected during an elevator transition.',
          'Fixed revived players occasionally being unable to interact with doors.',
          'Fixed overlapping revive attempts consuming supplies incorrectly.',
          'Fixed journal objectives displaying different completion states between the host and other players.',
          'Improved synchronization of shutters, pressure doors, and puzzle switches.',
          'Reduced a performance hitch when opening the photograph journal for the first time.',
        ],
      },
      {
        title: 'Interface & accessibility',
        items: [
          'Fixed subtitles disappearing when radio dialogue overlapped an environmental warning.',
          'Fixed subtitle-size settings resetting after restarting the game.',
          'Improved controller focus in the inventory and journal.',
          'Fixed reduced-flash settings failing to apply to one scripted camera sequence.',
          'Added text descriptions to several sound-based puzzle cues.',
          'Corrected missing speaker labels and several journal typos.',
        ],
      },
    ],
    changes: [
      { title: 'Balance', text: 'No intentional changes to enemy damage, resource quantities, puzzle solutions, or ending requirements are included in this hotfix.' },
    ],
    known: [
      'Some photographed reflections may display at a lower resolution than intended.',
      'June may briefly repeat her last subtitle when a player reconnects near her.',
      'Host migration remains unsupported. If the host leaves, the online session ends; progress resumes from the latest saved checkpoint.',
    ],
    notes: [
      {
        title: 'Save compatibility',
        text: [
          'Existing saves remain compatible. Previously collected evidence will be checked again when loading. If you encountered a blocked puzzle, reload your latest checkpoint after installing the update.',
          'All players must install 1.0.1 before joining the same online session.',
        ],
      },
    ],
    signoff: ['If the photograph shows an empty hallway, remember when you took it.', '— The Depths of the Unseen Team'],
  },
  {
    version: '1.0.0',
    title: 'Launch',
    tagline: 'The first release.',
    added: [
      {
        title: 'In this release',
        items: [
          'The campaign: six chapters, twelve puzzles, four pieces of optional evidence, thirty-six records, six secret photographs and three endings.',
          'Expedition: seeded twelve-room runs, unlocked by any campaign ending.',
          'Online co-op for up to four players through a self-hosted server, with invite codes, text chat, callouts and pings.',
          'Chapter Select, the Collection and eighteen achievements.',
          'Accessibility presets, subtitles and environmental captions, Reduced Startle, full rebinding and a one-hand controller layout.',
        ],
      },
    ],
    known: [
      'Co-op has no voice chat.',
      'Host migration is unsupported. If the host leaves, the online session ends.',
      'Guests on other networks need the host’s port forwarded, or a VPN.',
    ],
  },
];

export const LATEST_NOTES = PATCH_NOTES[0].version;

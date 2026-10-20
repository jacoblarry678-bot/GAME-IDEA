/**
 * Dialogue. Restrained and conversational: the Operator speaks with the
 * timing of a tired dispatcher, Lena is alert and impatient with machinery,
 * Evan's panic shows in pauses and unfinished sentences.
 *
 * Each scene is a list of beats: { sp, src, text } lines, { sfx } cues and
 * { wait } pauses. `if` restricts a beat to a party condition. Mandatory
 * scenes play once per campaign state.
 *
 * Sources: radio (through the radio), local (spoken aloud nearby), memory
 * (private, internal), recording (Rook), speaker (Operator through building
 * speakers), replay (Operator replaying a copied line), intercom.
 */
export const SPEAKERS = {
  evan: 'Evan', mara: 'Mara', luis: 'Luis', jo: 'Jo', lena: 'Lena', june: 'June', rook: 'Dr. Rook', operator: 'Operator',
};
export const SOURCES = { radio: 'Radio', local: '', memory: 'Memory', recording: 'Recording', speaker: 'Speaker', replay: 'Replay', intercom: 'Intercom' };

export const SCENES = {
  // ---------------------------------------------------------------- chapter one
  prologue: [
    { sp: 'evan', src: 'local', text: 'Annex final shutdown. Lower service corridor. Twenty-three forty.' },
  ],
  opening: [
    { sp: 'lena', src: 'radio', text: 'Evan. The gate is still shut.' },
    { wait: 0.8 },
    { sp: 'evan', src: 'local', text: 'Lena? Who is this?' },
    { sfx: 'relayClick' },
    { sp: 'lena', src: 'radio', text: 'Please don\'t close it again.' },
  ],
  coopCrew: [
    { if: 'party>=2', sp: 'mara', src: 'local', text: 'That came through the emergency channel. That channel has been dead since they sealed the plant.' },
    { if: 'party>=3', sp: 'luis', src: 'local', text: 'So either it\'s a prank or it\'s a very committed prank.' },
    { if: 'party>=4', sp: 'jo', src: 'local', text: 'We follow the signal. Slowly. Nobody goes ahead alone.' },
  ],
  arrival: [
    { sp: 'evan', src: 'local', text: 'That was a door. That was... there was a door there.' },
  ],
  firstOperator: [
    { sp: 'operator', src: 'radio', text: 'Maintenance crew, remain where you are.' },
    { sp: 'evan', src: 'local', text: 'Tell me where that is.' },
    { sp: 'operator', src: 'radio', text: 'I can do that once you restore local power.' },
  ],
  cameraFound: [
    { sp: 'evan', src: 'local', text: 'Inspection camera. Somebody left it charged.' },
  ],
  firstReveal: [
    { sp: 'evan', src: 'local', text: 'That chair was empty. It was empty when I took it.' },
  ],
  clockLesson: [
    { sp: 'evan', src: 'local', text: 'Second hand\'s moving. Okay. Okay.' },
  ],
  operatorObjective1: [
    { sp: 'operator', src: 'radio', text: 'The breaker room is ahead of you. Restore the panel and the hall will open.' },
  ],
  p1Done: [
    { sp: 'operator', src: 'radio', text: 'Power restored to the listening hall. Proceed.' },
  ],
  listenerFirst: [
    { sp: 'evan', src: 'local', text: 'Something is in the wall. Something is walking in the wall.' },
  ],
  listenerHall: [
    { sp: 'evan', src: 'local', text: 'Don\'t run. Don\'t... okay. Run.' },
  ],
  p2Mic: [
    { sp: 'operator', src: 'radio', text: 'Speak your full name into the microphone.' },
  ],
  p2MicUsed: [
    { sp: 'evan', src: 'local', text: 'Maintenance.' },
    { sfx: 'authFail' },
  ],
  t1Done: [
    { sp: 'operator', src: 'radio', text: 'Relay one is responding. The service lift is yours.' },
  ],
  liftRide1: [
    { wait: 2.5 },
    { sp: 'operator', src: 'radio', text: 'Good. I can hear you more clearly now.' },
    { sp: 'evan', src: 'local', text: 'Could you hear me before?' },
    { sfx: 'channelClose' },
  ],
  // ---------------------------------------------------------------- chapter two
  mallArrival: [
    { sp: 'evan', src: 'local', text: 'Every clock says closing time. Every single one.' },
  ],
  shutterDemo: [
    { sp: 'evan', src: 'local', text: 'It moved when the shutter came down. It stopped when I looked.' },
  ],
  badgeFound: [
    { sp: 'evan', src: 'local', text: 'This is hers. Same stupid sunflower.' },
    { if: 'mara', sp: 'mara', src: 'local', text: 'Could someone have planted it?' },
    { if: 'mara', sp: 'evan', src: 'local', text: 'Yes. That\'s why we\'re checking.' },
  ],
  p3Done: [
    { sp: 'operator', src: 'radio', text: 'Delivery access open. The announcement booth controls the service exit.' },
  ],
  t2Done: [
    { sp: 'operator', src: 'radio', text: 'Thank you. Before you go down, read me the test card. Slowly. All of it.' },
    { sp: 'evan', src: 'local', text: 'No. The tones work fine.' },
    { sp: 'operator', src: 'radio', text: 'They do. For now.' },
  ],
  foodCourt: [
    { sfx: 'radioClick' },
  ],
  // ---------------------------------------------------------------- chapter three
  poolArrival: [
    { sp: 'evan', src: 'local', text: 'Daylight. That isn\'t daylight. There\'s nothing behind the glass.' },
  ],
  pumpFirst: [
    { sp: 'evan', src: 'local', text: 'The water\'s moving against the current. Stay on the grating.' },
  ],
  rookKey: [
    { sp: 'evan', src: 'local', text: 'Rook. Imani Rook. She signed off the original test.' },
  ],
  t3Done: [
    { sp: 'operator', src: 'radio', text: 'An old microphone profile. Ignore it.' },
    { sp: 'evan', src: 'local', text: 'Microphones don\'t have a pulse.' },
    { sp: 'operator', src: 'radio', text: 'The label is obsolete.' },
  ],
  // ---------------------------------------------------------------- chapter four
  residentsArrival: [
    { sp: 'evan', src: 'local', text: 'Somebody\'s cooking. Somewhere. That smell is from my grandmother\'s building.' },
  ],
  juneCall: [
    { sp: 'june', src: 'intercom', text: 'Check the clock before you put anything down.' },
  ],
  juneDoor: [
    { sp: 'june', src: 'local', text: '{breathing}' },
    { sp: 'june', src: 'local', text: 'That doesn\'t tell me how many of you are people. Check the clock.' },
  ],
  juneDeclined: [
    { sp: 'june', src: 'local', text: 'Then I\'ll keep the door shut. I\'m good at that.' },
  ],
  juneReady: [
    { sp: 'june', src: 'local', text: 'All right. Twenty meters. I can do twenty meters.' },
  ],
  juneSafe: [
    { sp: 'june', src: 'local', text: 'The clock\'s honest. Thank you. I\'ll find my own way down; the freight lines still run.' },
  ],
  memoryScene: [
    { sp: 'lena', src: 'memory', text: 'Blue mug?' },
    { sp: 'evan', src: 'memory', text: 'Yellow. The handle was already missing.' },
    { sp: 'lena', src: 'memory', text: 'You kept trying to glue it back on.' },
  ],
  memoryAfter: [
    { sp: 'evan', src: 'local', text: 'I thought I broke it. That night. I thought that was the last thing...' },
  ],
  t4Done: [
    { sp: 'operator', src: 'speaker', text: 'She will forgive you when you stop asking questions.' },
  ],
  // ---------------------------------------------------------------- chapter five
  serviceArrival: [
    { sp: 'evan', src: 'local', text: 'Machinery. Somebody\'s still running the lower plant.' },
  ],
  caretakerDemo: [
    { sp: 'evan', src: 'local', text: 'It can\'t see. It\'s listening to the pipes.' },
  ],
  lenaSeen: [
    { sp: 'evan', src: 'local', text: 'She\'s alive.' },
    { sp: 'operator', src: 'speaker', text: 'Because I kept her alive.' },
    { sp: 'evan', src: 'local', text: 'Then tell me how to get her out.' },
    { sp: 'operator', src: 'speaker', text: 'Get yourself out first.' },
  ],
  operatorArgues: [
    { sp: 'operator', src: 'speaker', text: 'Disconnect her and you disconnect both of us. She stops. I stop. Is that what you came back to do?' },
  ],
  rookFinal: [
    { sp: 'rook', src: 'recording', text: 'The network needs a reference. A living person does not have to be its prisoner. Isolate life support. Cut identity transmission. Open the maintenance gate. In that order.' },
  ],
  // ---------------------------------------------------------------- chapter six
  coreArrival: [
    { sp: 'evan', src: 'local', text: 'All of it. Every place we came through. Stitched together wrong.' },
  ],
  unseenFirst: [
    { sp: 'evan', src: 'local', text: 'Footprints. Those are my boots. Those are my...' },
  ],
  p11Done: [
    { sp: 'operator', src: 'speaker', text: 'Return circuit live. Come to the broadcast room. I\'ll explain everything there.' },
  ],
  rescueCommit: [
    { sp: 'operator', src: 'speaker', text: 'You closed one door on her already.' },
    { sp: 'evan', src: 'local', text: 'Then I\'ll open this one myself.' },
  ],
  destructionCommit: [
    { sp: 'operator', src: 'speaker', text: 'There are people attached to those lines.' },
    { sp: 'evan', src: 'local', text: 'I know.' },
  ],
  obedientCommit: [
    { sp: 'operator', src: 'speaker', text: 'Thank you. It\'s easier when you trust me.' },
  ],
  voiceGateA: [{ sp: 'evan', src: 'replay', text: 'Maintenance.' }],
  voiceGateB: [{ sp: 'evan', src: 'replay', text: 'Tell me where that is.' }],
  voiceGateC: [{ sp: 'evan', src: 'replay', text: 'Then tell me how to get her out.' }],
  obedientThreshold: [
    { sp: 'operator', src: 'speaker', text: 'Say your name so I know you arrived.' },
    { sp: 'evan', src: 'local', text: 'Evan Ward. I\'m here.' },
  ],
  bypassHandset: [
    { sp: 'lena', src: 'local', text: 'Evan? This line\'s quiet. This one\'s real. Ask me something it couldn\'t know.' },
  ],
  bypassAnswer: [
    { sp: 'lena', src: 'local', text: 'Blue mug?' },
  ],
  bypassCorrect: [
    { sp: 'evan', src: 'local', text: 'Yellow. The handle was already missing.' },
    { sp: 'lena', src: 'local', text: 'You kept trying to glue it back on.' },
  ],
  bypassWrong: [
    { sp: 'evan', src: 'local', text: 'No. Wait. That\'s not... let me say it right.' },
  ],
  lenaFree: [
    { sp: 'lena', src: 'local', text: 'Stay level with me. Don\'t stop where it can see you.' },
  ],
  purgeReplay: [
    { sp: 'operator', src: 'replay', text: 'The breaker room is ahead of you. Restore the panel and the hall will open.' },
  ],
  purgeReplay2: [
    { sp: 'operator', src: 'replay', text: 'Delivery access open. Proceed.' },
  ],
  lenaPurge: [
    { sp: 'lena', src: 'speaker', text: 'Make sure it stays shut.' },
  ],
  // ---------------------------------------------------------------- endings
  endingFamiliar: [
    { sfx: 'voicemail' },
    { sp: 'jo', src: 'radio', text: 'Evan, it\'s six in the morning. Why are you clocked in? Call me back.' },
    { wait: 2.0 },
    { sp: 'operator', src: 'replay', text: 'Evan Ward. I\'m here.' },
  ],
  endingFamiliarJune: [
    { sp: 'june', src: 'local', text: 'Evan. Who is that standing under the light?' },
  ],
  endingFamiliarNoJune: [
    { sfx: 'knock3' },
  ],
  endingDoor: [
    { sp: 'lena', src: 'local', text: 'Still on there. The sunflower.' },
    { sp: 'evan', src: 'local', text: 'It\'s been eleven years.' },
    { sp: 'lena', src: 'local', text: 'Then you can buy the coffee.' },
    { sp: 'evan', src: 'local', text: 'Lena, I closed the gate. I was told to and I... I closed it, and I\'ve been...' },
    { sp: 'lena', src: 'local', text: 'You came back. That doesn\'t fix everything. It means we can start.' },
  ],
  endingCut: [
    { sp: 'lena', src: 'speaker', text: 'Make sure it stays shut.' },
  ],
};

/** Ambient Operator lines the director may use as harmless radio interference. */
export const RADIO_MURMURS = [
  'Maintenance crew, report your position.',
  'All units, the lower plant is closed.',
  'Please hold. Your call is important.',
  'Repeat. Remain where you are.',
];

export function lineDuration(text) {
  const words = String(text).split(/\s+/).length;
  return Math.min(9, 1.2 + words * 0.34);
}

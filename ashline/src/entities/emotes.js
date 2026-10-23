/**
 * Emote animations for the third-person soldier rig. Each animation sets bone
 * rotations for time t (seconds) on a pose that SoldierModel has reset to
 * neutral. Bones: hips (position.y, rotation), spine, neck, head, arms[0]
 * (left) / arms[1] (right) with { sh, elbow }, legs[0/1] with { thigh, shin }.
 * Conventions: arm rotation.x > 0 swings forward/up, rotation.z = side × angle
 * lifts it out to the side; thigh.x > 0 swings the leg forward, shin.x < 0
 * bends the knee. Purely visual.
 */
const ease = (x) => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));
const inOut = (t, dur, k = 0.25) => Math.min(ease(t / k), ease((dur - t) / k)); // blend in/out

export const EMOTE_ANIMS = {
  wave(m, t, dur) {
    const b = inOut(t, dur);
    const [L, R] = m.arms;
    R.sh.rotation.set(0.2 * b, 0, 2.55 * b);
    R.elbow.rotation.set(0, 0, (0.15 + 0.55 * Math.sin(t * 11)) * b);
    L.sh.rotation.set(0, 0, -0.12);
    m.neck.rotation.z = 0.12 * b;
  },
  salute(m, t, dur) {
    const b = inOut(t, dur, 0.3);
    const [L, R] = m.arms;
    R.sh.rotation.set(1.55 * b, 0, 1.15 * b);
    R.elbow.rotation.set(2.35 * b, 0, 0);
    L.sh.rotation.set(0, 0, -0.08);
    m.spine.rotation.x = -0.06 * b;
    m.neck.rotation.x = -0.05 * b;
  },
  thumbs(m, t, dur) {
    const b = inOut(t, dur);
    const [L, R] = m.arms;
    R.sh.rotation.set(1.25 * b, 0, 0.25 * b);
    R.elbow.rotation.set((0.9 + 0.1 * Math.sin(t * 6)) * b, 0, 0);
    L.sh.rotation.set(0, 0, -0.1);
    m.neck.rotation.z = -0.12 * b;
  },
  cheer(m, t, dur) {
    const b = inOut(t, dur, 0.2);
    for (const a of m.arms) { a.sh.rotation.set(0.25 * b, 0, a.side * (2.75 + 0.15 * Math.sin(t * 9 + a.side)) * b); a.elbow.rotation.set(0, 0, a.side * 0.2 * b); }
    const hop = Math.abs(Math.sin(t * 6)) * b;
    m.hips.position.y = 0.95 + hop * 0.12;
    for (const l of m.legs) { l.thigh.rotation.x = 0.25 * hop; l.shin.rotation.x = -0.5 * hop; }
    m.neck.rotation.x = -0.25 * b;
  },
  flex(m, t, dur) {
    const b = inOut(t, dur, 0.3);
    const pulse = 1 + 0.08 * Math.sin(t * 7);
    for (const a of m.arms) { a.sh.rotation.set(0, 0, a.side * 1.5 * b); a.elbow.rotation.set(0, 0, a.side * 1.9 * b * pulse); }
    m.spine.rotation.x = 0.08 * b;
    m.hips.position.y = 0.93;
    for (const l of m.legs) { l.thigh.rotation.z = l.side * -0.12 * b; }
  },
  laugh(m, t, dur) {
    const b = inOut(t, dur);
    const shake = Math.abs(Math.sin(t * 13));
    m.spine.rotation.x = (0.15 + 0.2 * shake) * b;
    m.neck.rotation.x = -0.35 * b;
    for (const a of m.arms) { a.sh.rotation.set(0.45 * b, 0, a.side * 0.25 * b); a.elbow.rotation.set(1.55 * b, 0, 0); }
  },
  facepalm(m, t, dur) {
    const b = inOut(t, dur, 0.3);
    const [L, R] = m.arms;
    R.sh.rotation.set(1.95 * b, 0, 0.45 * b);
    R.elbow.rotation.set(2.35 * b, 0, 0);
    L.sh.rotation.set(0.3 * b, 0, -0.1);
    L.elbow.rotation.set(1.2 * b, 0, 0);
    m.neck.rotation.x = 0.4 * b;
    m.neck.rotation.y = 0.18 * Math.sin(t * 4) * b;
    m.spine.rotation.x = 0.12 * b;
  },
  shuffle(m, t, dur) {
    const b = inOut(t, dur, 0.3);
    const beat = t * 8;
    m.hips.position.y = 0.92 + Math.abs(Math.sin(beat)) * 0.05 * b;
    m.hips.rotation.y = 0.4 * Math.sin(t * 4) * b;
    m.spine.rotation.z = 0.14 * Math.sin(t * 4) * b;
    m.legs.forEach((l, i) => { const s = Math.max(0, Math.sin(beat + i * Math.PI)); l.thigh.rotation.x = 0.55 * s * b; l.shin.rotation.x = -0.8 * s * b; });
    m.arms.forEach((a, i) => { a.sh.rotation.set(0.8 * Math.sin(beat + i * Math.PI) * b, 0, a.side * 0.35 * b); a.elbow.rotation.set(1.3 * b, 0, 0); });
    m.neck.rotation.z = 0.15 * Math.sin(beat) * b;
  },
  spin(m, t, dur) {
    const k = ease(Math.min(1, t / (dur * 0.7)));
    const b = inOut(t, dur, 0.2);
    m.hips.rotation.y = k * Math.PI * 2;
    const [L, R] = m.arms;
    L.sh.rotation.set(0, 0, -1.45 * b);
    R.sh.rotation.set(0, 0, (1.45 + (t > dur * 0.7 ? 1.2 * ease((t - dur * 0.7) / 0.3) : 0)) * b);
    m.hips.position.y = 0.95 + Math.sin(k * Math.PI) * 0.1;
    m.neck.rotation.x = -0.15 * b;
  },
  scare(m, t, dur) {
    const b = inOut(t, dur, 0.15);
    const lunge = t < 0.5 ? ease(t / 0.25) : 1;
    for (const a of m.arms) { a.sh.rotation.set(2.1 * lunge * b, 0, a.side * 0.35 * b); a.elbow.rotation.set(0.5 * b, 0, 0); }
    m.spine.rotation.x = 0.3 * lunge * b;
    m.neck.rotation.x = -0.3 * b;
    m.legs[0].thigh.rotation.x = 0.5 * lunge * b; m.legs[0].shin.rotation.x = -0.4 * lunge * b;
    m.hips.position.y = 0.9;
  },
};

export const EMOTE_KEYS = Object.keys(EMOTE_ANIMS);

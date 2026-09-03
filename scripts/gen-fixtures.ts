// Generates synthetic landmark fixtures into fixtures/*.json.
// Run: npm run gen:fixtures
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}
type Pt = { x: number; y: number };

const FPS = 30;
const OUT_DIR = join(process.cwd(), "fixtures");

const LM = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
};

function blankPose(): Landmark[] {
  return Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.9,
  }));
}

function set(lm: Landmark[], idx: number, p: Pt, visibility = 0.9) {
  lm[idx] = { x: p.x, y: p.y, z: 0, visibility };
}

const round = (v: number) => Math.round(v * 1e4) / 1e4;

function save(name: string, frames: Landmark[][]) {
  const fixture = {
    fps: FPS,
    frames: frames.map((landmarks, i) => ({
      t: round((i / FPS) * 1000),
      landmarks: landmarks.map((p) => ({
        x: round(p.x),
        y: round(p.y),
        z: 0,
        visibility: p.visibility,
      })),
    })),
  };
  writeFileSync(join(OUT_DIR, `${name}.json`), JSON.stringify(fixture));
  console.log(`${name}.json: ${frames.length} frames (${frames.length / FPS}s)`);
}

const deg = Math.PI / 180;

/** Knee angle over one squat cycle: 160° → 90° → 160°. */
const squatKneeAngle = (t: number, period: number) =>
  160 - (70 * (1 - Math.cos((2 * Math.PI * t) / period))) / 2;

/** Places a 2-segment leg chain in the image plane so that the 2D angle at
 *  the knee equals `theta`. `s` is the outward direction (+1 left leg, -1 right). */
function legChain(hip: Pt, theta: number, s: number, L = 0.25) {
  const phi = ((180 - theta) / 2) * deg;
  const knee = { x: hip.x + s * L * Math.sin(phi), y: hip.y + L * Math.cos(phi) };
  const ankle = { x: hip.x, y: knee.y + L * Math.cos(phi) };
  return { knee, ankle };
}

// ---------- squat, side view, 10 clean reps ----------
function squatSide() {
  const period = 3;
  const frames: Landmark[][] = [];
  const total = 10 * period; // seconds
  for (let i = 0; i < total * FPS; i++) {
    const t = i / FPS;
    const theta = squatKneeAngle(t, period);
    const lm = blankPose();
    const hip = { x: 0.5, y: 0.45 };
    const { knee, ankle } = legChain(hip, theta, 1);
    set(lm, LM.NOSE, { x: 0.5, y: 0.12 });
    set(lm, LM.LEFT_SHOULDER, { x: 0.52, y: 0.18 });
    set(lm, LM.RIGHT_SHOULDER, { x: 0.49, y: 0.18 }, 0.6); // side: shoulders overlap
    set(lm, LM.LEFT_WRIST, { x: 0.52, y: 0.5 });
    set(lm, LM.RIGHT_WRIST, { x: 0.49, y: 0.5 }, 0.6);
    set(lm, LM.LEFT_HIP, hip);
    set(lm, LM.LEFT_KNEE, knee);
    set(lm, LM.LEFT_ANKLE, ankle);
    set(lm, LM.RIGHT_HIP, hip, 0.6);
    set(lm, LM.RIGHT_KNEE, knee, 0.6);
    set(lm, LM.RIGHT_ANKLE, ankle, 0.6);
    frames.push(lm);
  }
  save("squat_10reps_side", frames);
}

// ---------- squat, front view, 5 reps, valgus on reps 1/3/5 ----------
function squatFrontValgus() {
  const period = 3;
  const reps = 5;
  const valgusReps = new Set([0, 2, 4]);
  const frames: Landmark[][] = [];
  for (let i = 0; i < reps * period * FPS; i++) {
    const t = i / FPS;
    const rep = Math.floor(t / period);
    const theta = squatKneeAngle(t, period);
    const bend = (160 - theta) / 70; // 0 standing → 1 bottom
    const lm = blankPose();
    set(lm, LM.NOSE, { x: 0.5, y: 0.1 });
    set(lm, LM.LEFT_SHOULDER, { x: 0.72, y: 0.2 });
    set(lm, LM.RIGHT_SHOULDER, { x: 0.28, y: 0.2 });
    set(lm, LM.LEFT_WRIST, { x: 0.74, y: 0.45 });
    set(lm, LM.RIGHT_WRIST, { x: 0.26, y: 0.45 });
    const mid = 0.5;
    for (const s of [1, -1]) {
      const hip = { x: mid + s * 0.08, y: 0.45 };
      const phi = ((180 - theta) / 2) * deg;
      const L = 0.25;
      // Clean reps bend the knee outward; valgus reps sweep it across to the
      // inside as depth increases. |x offset| stays L·sin(phi) at the bottom,
      // so the 2D knee angle still reaches ~90° and the rep counts.
      const dir = valgusReps.has(rep) ? 1 - 2 * bend : 1;
      const knee = {
        x: hip.x + s * L * Math.sin(phi) * dir,
        y: hip.y + L * Math.cos(phi),
      };
      const ankle = { x: hip.x, y: knee.y + L * Math.cos(phi) };
      const hipIdx = s === 1 ? LM.LEFT_HIP : LM.RIGHT_HIP;
      const kneeIdx = s === 1 ? LM.LEFT_KNEE : LM.RIGHT_KNEE;
      const ankleIdx = s === 1 ? LM.LEFT_ANKLE : LM.RIGHT_ANKLE;
      set(lm, hipIdx, hip);
      set(lm, kneeIdx, knee);
      set(lm, ankleIdx, ankle);
    }
    frames.push(lm);
  }
  save("squat_3valgus_front", frames);
}

// ---------- pushup, side view, 5 clean reps ----------
function pushupSide() {
  const period = 3;
  const frames: Landmark[][] = [];
  for (let i = 0; i < 5 * period * FPS; i++) {
    const t = i / FPS;
    const theta = 165 - (85 * (1 - Math.cos((2 * Math.PI * t) / period))) / 2; // 165 → 80
    const lm = blankPose();
    const shoulder = { x: 0.35, y: 0.6 };
    const phi = ((180 - theta) / 2) * deg;
    const A = 0.15;
    const elbow = { x: shoulder.x + A * Math.sin(phi), y: shoulder.y + A * Math.cos(phi) };
    const wrist = { x: shoulder.x, y: elbow.y + A * Math.cos(phi) };
    set(lm, LM.NOSE, { x: 0.28, y: 0.58 });
    set(lm, LM.LEFT_SHOULDER, shoulder);
    set(lm, LM.RIGHT_SHOULDER, { x: 0.34, y: 0.61 }, 0.6);
    set(lm, LM.LEFT_ELBOW, elbow);
    set(lm, LM.RIGHT_ELBOW, elbow, 0.6);
    set(lm, LM.LEFT_WRIST, wrist);
    set(lm, LM.RIGHT_WRIST, wrist, 0.6);
    // torso stays rigid and straight: no hip_sag (shoulder-hip-ankle ≈ 177°)
    set(lm, LM.LEFT_HIP, { x: 0.6, y: 0.61 });
    set(lm, LM.RIGHT_HIP, { x: 0.6, y: 0.61 }, 0.6);
    set(lm, LM.LEFT_KNEE, { x: 0.725, y: 0.62 });
    set(lm, LM.RIGHT_KNEE, { x: 0.725, y: 0.62 }, 0.6);
    set(lm, LM.LEFT_ANKLE, { x: 0.85, y: 0.63 });
    set(lm, LM.RIGHT_ANKLE, { x: 0.85, y: 0.63 }, 0.6);
    frames.push(lm);
  }
  save("pushup_5reps_side", frames);
}

// ---------- gestures: 1s neutral, 1.5s condition, 1s neutral ----------
function standingPose(): Landmark[] {
  const lm = blankPose();
  set(lm, LM.NOSE, { x: 0.5, y: 0.15 });
  set(lm, LM.LEFT_SHOULDER, { x: 0.58, y: 0.25 });
  set(lm, LM.RIGHT_SHOULDER, { x: 0.42, y: 0.25 });
  set(lm, LM.LEFT_ELBOW, { x: 0.61, y: 0.4 });
  set(lm, LM.RIGHT_ELBOW, { x: 0.39, y: 0.4 });
  set(lm, LM.LEFT_WRIST, { x: 0.6, y: 0.55 });
  set(lm, LM.RIGHT_WRIST, { x: 0.4, y: 0.55 });
  set(lm, LM.LEFT_HIP, { x: 0.55, y: 0.5 });
  set(lm, LM.RIGHT_HIP, { x: 0.45, y: 0.5 });
  set(lm, LM.LEFT_KNEE, { x: 0.55, y: 0.7 });
  set(lm, LM.RIGHT_KNEE, { x: 0.45, y: 0.7 });
  set(lm, LM.LEFT_ANKLE, { x: 0.55, y: 0.9 });
  set(lm, LM.RIGHT_ANKLE, { x: 0.45, y: 0.9 });
  return lm;
}

function gestureFixture(name: string, applyCondition: (lm: Landmark[]) => void) {
  const frames: Landmark[][] = [];
  const push = (seconds: number, condition: boolean) => {
    for (let i = 0; i < seconds * FPS; i++) {
      const lm = standingPose();
      if (condition) applyCondition(lm);
      frames.push(lm);
    }
  };
  push(1, false);
  push(1.5, true);
  push(1, false);
  save(name, frames);
}

mkdirSync(OUT_DIR, { recursive: true });
squatSide();
squatFrontValgus();
pushupSide();
gestureFixture("gesture_hands_up", (lm) => {
  set(lm, LM.LEFT_WRIST, { x: 0.6, y: 0.1 });
  set(lm, LM.RIGHT_WRIST, { x: 0.4, y: 0.1 });
  set(lm, LM.LEFT_ELBOW, { x: 0.62, y: 0.18 });
  set(lm, LM.RIGHT_ELBOW, { x: 0.38, y: 0.18 });
});
gestureFixture("gesture_arms_crossed", (lm) => {
  // Wrist order inverted relative to shoulders, at chest height.
  set(lm, LM.LEFT_WRIST, { x: 0.42, y: 0.4 });
  set(lm, LM.RIGHT_WRIST, { x: 0.58, y: 0.4 });
  set(lm, LM.LEFT_ELBOW, { x: 0.52, y: 0.42 });
  set(lm, LM.RIGHT_ELBOW, { x: 0.48, y: 0.42 });
});
gestureFixture("gesture_one_hand", (lm) => {
  set(lm, LM.LEFT_WRIST, { x: 0.6, y: 0.1 });
  set(lm, LM.LEFT_ELBOW, { x: 0.62, y: 0.18 });
});

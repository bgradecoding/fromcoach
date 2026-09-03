// Pose engine: frame hub + per-exercise tracking (side selection, angle
// smoothing, rep FSM, form rules) + gesture routing. The session layer
// drives it via configureExercise/setRepCounting/setGestureMode and
// subscribes to rep/gesture events; it never sees a video frame.
import { angle3, createEma } from "./angles";
import { createGestureDetector, type GestureEvent } from "./gestures";
import { createRepCounter } from "./repCounter";
import { frameViolations, sideIdx, type BodySide, type ExerciseFamily } from "./rules";
import { ReplayPoseSource } from "./sources/replay";
import { createViewClassifier } from "./view";
import type { Frame, Landmark, RepRecord, ViewKind } from "./types";

// ---------- frame hub ----------

type FrameListener = (f: Frame) => void;
const frameListeners = new Set<FrameListener>();

export function onFrame(fn: FrameListener): () => void {
  frameListeners.add(fn);
  return () => frameListeners.delete(fn);
}

export function pushFrame(f: Frame): void {
  for (const fn of frameListeners) fn(f);
}

/** Shared replay source; the debug bridge and DebugPanel play fixtures through it. */
export const replaySource = new ReplayPoseSource();
void replaySource.start(pushFrame);

// ---------- exercise definitions ----------

export interface DetectorConfig {
  family: ExerciseFamily;
  joints: ["shoulder" | "hip", "elbow" | "knee", "wrist" | "ankle"];
  down: number;
  up: number;
}

const SQUAT: DetectorConfig = { family: "squat", joints: ["hip", "knee", "ankle"], down: 100, up: 160 };
const PUSHUP: DetectorConfig = { family: "pushup", joints: ["shoulder", "elbow", "wrist"], down: 90, up: 160 };

const EXERCISES: Record<string, DetectorConfig> = {
  squat: SQUAT,
  goblet_squat: SQUAT,
  box_squat: SQUAT,
  pushup: PUSHUP,
  knee_pushup: { ...PUSHUP, down: 100 },
};

export const EXERCISE_NAMES = Object.keys(EXERCISES);

export function detectorFor(exercise: string): DetectorConfig {
  return EXERCISES[exercise] ?? SQUAT;
}

// ---------- per-exercise tracker (pure, unit-testable) ----------

export interface TrackResult {
  rep: RepRecord | null;
  personDetected: boolean;
  view: ViewKind;
  angle: number | null;
}

export class ExerciseTracker {
  private cfg: DetectorConfig;
  private viewClassifier = createViewClassifier();
  private ema = createEma(0.5);
  private counter;
  private flags = new Set<string>();
  private side: BodySide = "left";
  private lastT = Number.NEGATIVE_INFINITY;

  constructor(exercise: string) {
    this.cfg = detectorFor(exercise);
    this.counter = createRepCounter({ down: this.cfg.down, up: this.cfg.up, hysteresis: 10 });
  }

  private jointVisibility(lm: Landmark[], side: BodySide): number {
    const idx = sideIdx(side);
    return (
      this.cfg.joints.reduce((sum, j) => sum + (lm[idx[j]]?.visibility ?? 0), 0) /
      this.cfg.joints.length
    );
  }

  /** Feed one frame. `count` gates the rep FSM (angle/view/person always update). */
  feed(f: Frame, count: boolean): TrackResult {
    if (f.t < this.lastT) this.resetTiming(); // source switch: clock went backwards
    this.lastT = f.t;

    const lm = f.landmarks;
    if (!lm) {
      return { rep: null, personDetected: false, view: this.viewClassifier.current, angle: this.ema.current };
    }

    const visL = this.jointVisibility(lm, "left");
    const visR = this.jointVisibility(lm, "right");
    if (Math.max(visL, visR) < 0.5) {
      return { rep: null, personDetected: false, view: this.viewClassifier.current, angle: this.ema.current };
    }
    // Sticky side choice: switch only on a clear visibility win.
    const other: BodySide = this.side === "left" ? "right" : "left";
    const visCurrent = this.side === "left" ? visL : visR;
    const visOther = this.side === "left" ? visR : visL;
    if (visOther - visCurrent >= 0.1) this.side = other;

    const view = this.viewClassifier.feed(lm);
    const idx = sideIdx(this.side);
    const [a, b, c] = this.cfg.joints;
    const raw = angle3(lm[idx[a]], lm[idx[b]], lm[idx[c]]);
    const angle = this.ema.push(raw);

    let rep: RepRecord | null = null;
    if (count) {
      rep = this.counter.feed(angle, f.t, this.flags);
      if (this.counter.state === "down") {
        for (const flag of frameViolations({ lm, view, side: this.side, family: this.cfg.family })) {
          this.flags.add(flag);
        }
      }
      if (rep) this.flags.clear();
    }

    return { rep, personDetected: true, view, angle };
  }

  resetTiming() {
    this.counter.reset();
    this.ema.reset();
    this.flags.clear();
  }

  get exerciseFamily(): ExerciseFamily {
    return this.cfg.family;
  }

  /** Landmark index of the angle vertex (knee/elbow) on the tracked side. */
  get vertexIndex(): number {
    return sideIdx(this.side)[this.cfg.joints[1]];
  }
}

// ---------- engine singleton ----------

export type GestureMode = "off" | "confirm" | "rest";

export interface EngineSnapshot {
  cameraOk: boolean;
  personDetected: boolean;
  view: ViewKind;
  currentAngle: number | null;
  exercise: string | null;
  /** Landmark index to label with the current angle on the canvas. */
  vertexIndex: number | null;
}

const state = {
  tracker: null as ExerciseTracker | null,
  exercise: null as string | null,
  repCounting: false,
  gestureMode: "off" as GestureMode,
  personDetected: false,
  view: "unknown" as ViewKind,
  currentAngle: null as number | null,
  lastFrameWall: 0,
  lastFrameT: Number.NEGATIVE_INFINITY,
};

const gestureDetector = createGestureDetector(1000);
const repListeners = new Set<(r: RepRecord) => void>();
const gestureListeners = new Set<(g: GestureEvent) => void>();

export function onRep(fn: (r: RepRecord) => void): () => void {
  repListeners.add(fn);
  return () => repListeners.delete(fn);
}

export function onGesture(fn: (g: GestureEvent) => void): () => void {
  gestureListeners.add(fn);
  return () => gestureListeners.delete(fn);
}

export function configureExercise(exercise: string | null): void {
  state.exercise = exercise;
  state.tracker = exercise ? new ExerciseTracker(exercise) : null;
}

export function setRepCounting(active: boolean): void {
  state.repCounting = active;
}

export function setGestureMode(mode: GestureMode): void {
  if (mode !== state.gestureMode) gestureDetector.reset();
  state.gestureMode = mode;
}

const MODE_GESTURES: Record<GestureMode, GestureEvent["type"][]> = {
  off: [],
  confirm: ["hands_up", "arms_crossed"],
  rest: ["one_hand_up"],
};

onFrame((f) => {
  state.lastFrameWall = Date.now();
  if (f.t < state.lastFrameT) gestureDetector.reset(); // clock went backwards (source switch)
  state.lastFrameT = f.t;

  // No exercise configured yet: still track presence/view for the UI.
  if (!state.tracker && f.landmarks) {
    state.tracker = new ExerciseTracker(state.exercise ?? "squat");
  }

  if (state.tracker) {
    // While a gesture decision is pending, rep counting is paused so the
    // raised arms don't get counted as reps.
    const counting = state.repCounting && state.gestureMode === "off";
    const result = state.tracker.feed(f, counting);
    state.personDetected = result.personDetected;
    state.view = result.view;
    state.currentAngle = result.angle;
    if (result.rep) for (const fn of repListeners) fn(result.rep);
  }

  if (state.gestureMode !== "off" && f.landmarks) {
    const ev = gestureDetector.feed(f.landmarks, f.t);
    if (ev && MODE_GESTURES[state.gestureMode].includes(ev.type)) {
      for (const fn of gestureListeners) fn(ev);
    }
  }
});

export function getEngineSnapshot(): EngineSnapshot {
  return {
    cameraOk: Date.now() - state.lastFrameWall < 2000,
    personDetected: state.personDetected,
    view: state.view,
    currentAngle: state.currentAngle,
    exercise: state.exercise,
    vertexIndex: state.tracker ? state.tracker.vertexIndex : null,
  };
}

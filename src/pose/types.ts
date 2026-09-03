// Core pose types shared by sources, engine, and tools.

export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export type TrackingMode = "pose" | "palm";
export type HandTrackingStatus = "loading" | "ready" | "unavailable";

export interface HandObservation {
  landmarks: Landmark[]; // 21 normalized hand landmarks; no body landmarks required
  gesture: string;
  score: number;
}

/** One pose sample. `t` is milliseconds on the source's own clock
 *  (camera: performance.now(), replay: fixture time). Engine logic
 *  must only rely on deltas within one source run. */
export interface Frame {
  t: number;
  landmarks: Landmark[] | null; // 33 normalized landmarks, or null when no person
  hands?: HandObservation[];
  handTracking?: HandTrackingStatus;
}

export interface PoseSource {
  start(onFrame: (f: Frame) => void): Promise<void>;
  stop(): void;
}

export interface Fixture {
  fps: number;
  frames: Frame[];
}

export interface RepRecord {
  minAngle: number;
  tempoDownMs: number;
  tempoUpMs: number;
  flags: string[];
}

export type ViewKind = "front" | "side" | "unknown";

export type Phase =
  | "idle"
  | "countdown"
  | "set"
  | "rest"
  | "awaiting_confirmation"
  | "done";

/** Exactly what the `getLiveMetrics` tool returns. */
export interface LiveMetrics {
  phase: Phase;
  cameraOk: boolean;
  personDetected: boolean;
  trackingMode: TrackingMode;
  handTracking: HandTrackingStatus | "inactive";
  handDetected: boolean;
  palmDetected: boolean;
  palmHoldProgress: number; // 0–1; continuous open-palm hold to skip rest
  view: ViewKind;
  exercise: string | null;
  setIndex: number | null;
  reps: number;
  targetReps: number | null;
  currentAngle: number | null;
  lastRep: RepRecord | null;
  flagCounts: Record<string, number>;
  restRemainingSec: number | null;
  updatedAt: string; // ISO
}

// MediaPipe Pose landmark indices we use.
export const LM = {
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
} as const;

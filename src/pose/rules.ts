import { angle3, verticalAngle } from "./angles";
import { LM, type Landmark, type ViewKind } from "./types";

export type ExerciseFamily = "squat" | "pushup";
export type BodySide = "left" | "right";

const SIDE_IDX = {
  left: {
    shoulder: LM.LEFT_SHOULDER,
    elbow: LM.LEFT_ELBOW,
    wrist: LM.LEFT_WRIST,
    hip: LM.LEFT_HIP,
    knee: LM.LEFT_KNEE,
    ankle: LM.LEFT_ANKLE,
  },
  right: {
    shoulder: LM.RIGHT_SHOULDER,
    elbow: LM.RIGHT_ELBOW,
    wrist: LM.RIGHT_WRIST,
    hip: LM.RIGHT_HIP,
    knee: LM.RIGHT_KNEE,
    ankle: LM.RIGHT_ANKLE,
  },
} as const;

export function sideIdx(side: BodySide) {
  return SIDE_IDX[side];
}

export interface RuleInput {
  lm: Landmark[];
  view: ViewKind;
  side: BodySide;
  family: ExerciseFamily;
}

/** Form violations visible in this single frame. Only called during the
 *  down phase of a rep; the engine accumulates results per rep. */
export function frameViolations({ lm, view, side, family }: RuleInput): string[] {
  const flags: string[] = [];
  const idx = SIDE_IDX[side];

  if (family === "squat") {
    if (view === "front") {
      // Knee collapsing toward the body midline: the knee sits medial to the
      // ankle by 0.03+ (signed, so it also catches a knee crossing midline;
      // invariant under mirrored coordinates).
      const mid = (lm[LM.LEFT_HIP].x + lm[LM.RIGHT_HIP].x) / 2;
      const outwardSign = Math.sign(lm[idx.hip].x - mid) || 1;
      const inward = (lm[idx.ankle].x - lm[idx.knee].x) * outwardSign;
      if (inward >= 0.03) flags.push("knee_valgus");
    }
    if (view === "side") {
      if (verticalAngle(lm[idx.shoulder], lm[idx.hip]) > 45) flags.push("torso_lean");
    }
  }

  if (family === "pushup") {
    const bodyLine = angle3(lm[idx.shoulder], lm[idx.hip], lm[idx.ankle]);
    if (bodyLine < 160) flags.push("hip_sag");
    if (view === "front") {
      if (Math.abs(lm[idx.elbow].x - lm[idx.shoulder].x) > 0.12) flags.push("elbow_flare");
    }
  }

  return flags;
}

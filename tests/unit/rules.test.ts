import { describe, expect, it } from "vitest";
import { frameViolations } from "../../src/pose/rules";
import { LM } from "../../src/pose/types";
import { blankPose } from "./helpers";

describe("form rules", () => {
  it("flags knee_valgus in front view when the knee is inside the ankle", () => {
    const lm = blankPose();
    lm[LM.LEFT_HIP] = { x: 0.58, y: 0.45, z: 0, visibility: 0.9 };
    lm[LM.RIGHT_HIP] = { x: 0.42, y: 0.45, z: 0, visibility: 0.9 };
    lm[LM.LEFT_KNEE] = { x: 0.52, y: 0.65, z: 0, visibility: 0.9 };
    lm[LM.LEFT_ANKLE] = { x: 0.58, y: 0.85, z: 0, visibility: 0.9 };
    expect(frameViolations({ lm, view: "front", side: "left", family: "squat" })).toContain(
      "knee_valgus",
    );
    // knee stacked over the ankle: no flag
    lm[LM.LEFT_KNEE] = { x: 0.6, y: 0.65, z: 0, visibility: 0.9 };
    expect(frameViolations({ lm, view: "front", side: "left", family: "squat" })).toEqual([]);
  });

  it("flags torso_lean in side view past 45 degrees", () => {
    const lm = blankPose();
    lm[LM.LEFT_SHOULDER] = { x: 0.3, y: 0.3, z: 0, visibility: 0.9 };
    lm[LM.LEFT_HIP] = { x: 0.55, y: 0.5, z: 0, visibility: 0.9 };
    expect(frameViolations({ lm, view: "side", side: "left", family: "squat" })).toContain(
      "torso_lean",
    );
    lm[LM.LEFT_SHOULDER] = { x: 0.53, y: 0.2, z: 0, visibility: 0.9 };
    expect(frameViolations({ lm, view: "side", side: "left", family: "squat" })).toEqual([]);
  });

  it("flags hip_sag when the body line breaks", () => {
    const lm = blankPose();
    lm[LM.LEFT_SHOULDER] = { x: 0.35, y: 0.6, z: 0, visibility: 0.9 };
    lm[LM.LEFT_HIP] = { x: 0.6, y: 0.75, z: 0, visibility: 0.9 };
    lm[LM.LEFT_ANKLE] = { x: 0.85, y: 0.63, z: 0, visibility: 0.9 };
    expect(frameViolations({ lm, view: "side", side: "left", family: "pushup" })).toContain(
      "hip_sag",
    );
    lm[LM.LEFT_HIP] = { x: 0.6, y: 0.615, z: 0, visibility: 0.9 };
    expect(frameViolations({ lm, view: "side", side: "left", family: "pushup" })).toEqual([]);
  });

  it("flags elbow_flare only in front view", () => {
    const lm = blankPose();
    lm[LM.LEFT_SHOULDER] = { x: 0.6, y: 0.3, z: 0, visibility: 0.9 };
    lm[LM.LEFT_ELBOW] = { x: 0.75, y: 0.35, z: 0, visibility: 0.9 };
    lm[LM.LEFT_HIP] = { x: 0.58, y: 0.5, z: 0, visibility: 0.9 };
    lm[LM.LEFT_ANKLE] = { x: 0.58, y: 0.9, z: 0, visibility: 0.9 };
    expect(frameViolations({ lm, view: "front", side: "left", family: "pushup" })).toContain(
      "elbow_flare",
    );
    expect(frameViolations({ lm, view: "side", side: "left", family: "pushup" })).not.toContain(
      "elbow_flare",
    );
  });
});

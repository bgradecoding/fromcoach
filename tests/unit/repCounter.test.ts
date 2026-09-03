import { describe, expect, it } from "vitest";
import { ExerciseTracker } from "../../src/pose/engine";
import type { RepRecord } from "../../src/pose/types";
import { loadFixture } from "./helpers";

function runFixture(exercise: string, fixtureName: string): RepRecord[] {
  const fx = loadFixture(fixtureName);
  const tracker = new ExerciseTracker(exercise);
  const reps: RepRecord[] = [];
  for (const f of fx.frames) {
    const { rep } = tracker.feed(f, true);
    if (rep) reps.push(rep);
  }
  return reps;
}

describe("rep counting on fixtures", () => {
  it("counts 10 squat reps in the side-view fixture", () => {
    const reps = runFixture("squat", "squat_10reps_side");
    expect(reps).toHaveLength(10);
    for (const rep of reps) {
      expect(rep.minAngle).toBeLessThan(100);
      expect(rep.flags).toEqual([]);
      expect(rep.tempoDownMs).toBeGreaterThan(0);
      expect(rep.tempoUpMs).toBeGreaterThan(0);
    }
  });

  it("flags knee valgus on exactly 3 of 5 front-view squat reps", () => {
    const reps = runFixture("squat", "squat_3valgus_front");
    expect(reps).toHaveLength(5);
    const valgus = reps.filter((r) => r.flags.includes("knee_valgus"));
    expect(valgus).toHaveLength(3);
  });

  it("counts 5 clean pushup reps in the side-view fixture", () => {
    const reps = runFixture("pushup", "pushup_5reps_side");
    expect(reps).toHaveLength(5);
    for (const rep of reps) expect(rep.flags).toEqual([]);
  });

  it("counts goblet_squat with the squat detector", () => {
    const reps = runFixture("goblet_squat", "squat_10reps_side");
    expect(reps).toHaveLength(10);
  });

  it("counts nothing when counting is off", () => {
    const fx = loadFixture("squat_10reps_side");
    const tracker = new ExerciseTracker("squat");
    for (const f of fx.frames) {
      expect(tracker.feed(f, false).rep).toBeNull();
    }
  });
});

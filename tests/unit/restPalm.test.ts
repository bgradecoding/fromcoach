import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "./helpers";

describe("rest uses hand-only recognition", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("ignores body hand-raises, then skips rest once after an open palm without a body", async () => {
    const { store } = await import("../../src/session/store");
    const { pushFrame, getTrackingMode } = await import("../../src/pose/engine");
    store.createPlan({
      blocks: [{ exercise: "squat", sets: 3, reps: 10, restSec: 90 }],
      createdBy: "user",
      userNote: "",
    });
    store.startSet();
    vi.advanceTimersByTime(3000);
    for (const frame of loadFixture("squat_10reps_side").frames) pushFrame(frame);

    expect(store.get().phase).toBe("rest");
    expect(store.getSetHistory()).toHaveLength(1);
    expect(getTrackingMode()).toBe("palm");
    expect(store.getLiveMetrics()).toMatchObject({
      phase: "rest", trackingMode: "palm", personDetected: false,
      currentAngle: null, view: "unknown", palmHoldProgress: 0,
    });

    for (const frame of loadFixture("gesture_one_hand").frames) pushFrame(frame);
    expect(store.get().phase).toBe("rest");
    expect(store.getLiveMetrics().handDetected).toBe(false);

    const palmFrames = loadFixture("gesture_open_palm").frames;
    expect(palmFrames.every((frame) => frame.landmarks === null)).toBe(true);
    let sawHoldProgress = false;
    for (const frame of palmFrames) {
      pushFrame(frame);
      const metrics = store.getLiveMetrics();
      if (metrics.phase === "rest" && metrics.palmHoldProgress > 0) {
        sawHoldProgress = true;
        expect(metrics).toMatchObject({ personDetected: false, handDetected: true, palmDetected: true });
      }
    }
    expect(sawHoldProgress).toBe(true);
    expect(store.get().phase).toBe("countdown");
    expect(store.get().setIndex).toBe(2);
    expect(getTrackingMode()).toBe("pose");
    expect(store.getLiveMetrics()).toMatchObject({ handTracking: "inactive", palmHoldProgress: 0 });

    vi.advanceTimersByTime(3000);
    for (const frame of palmFrames) pushFrame(frame);
    expect(store.get().phase).toBe("set");
    expect(store.get().reps).toBe(0);
    store.endSession();
  });

  it("rest timer and manual skip still work while hand detection is unavailable", async () => {
    const { store } = await import("../../src/session/store");
    const { pushFrame } = await import("../../src/pose/engine");
    store.createPlan({
      blocks: [{ exercise: "squat", sets: 2, reps: 10, restSec: 90 }],
      createdBy: "user", userNote: "",
    });
    store.startSet();
    vi.advanceTimersByTime(3000);
    for (const frame of loadFixture("squat_10reps_side").frames) pushFrame(frame);
    pushFrame({ t: 40_000, landmarks: null, hands: [], handTracking: "unavailable" });
    expect(store.getLiveMetrics()).toMatchObject({
      phase: "rest", handTracking: "unavailable", palmDetected: false, palmHoldProgress: 0,
    });
    const remaining = store.get().restRemainingSec!;
    vi.advanceTimersByTime(1000);
    expect(store.get().restRemainingSec).toBe(remaining - 1);
    store.skipRest();
    expect(store.get().phase).toBe("countdown");
    store.endSession();
  });
});

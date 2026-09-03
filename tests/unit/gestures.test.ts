import { describe, expect, it } from "vitest";
import { createGestureDetector, type GestureEvent } from "../../src/pose/gestures";
import { loadFixture } from "./helpers";

function runGestureFixture(name: string, frameLimit?: number): GestureEvent[] {
  const fx = loadFixture(name);
  const detector = createGestureDetector(1000);
  const events: GestureEvent[] = [];
  const frames = frameLimit ? fx.frames.slice(0, frameLimit) : fx.frames;
  for (const f of frames) {
    const ev = detector.feed(f.landmarks!, f.t);
    if (ev) events.push(ev);
  }
  return events;
}

describe("gesture detection on fixtures", () => {
  it("fires hands_up exactly once", () => {
    const events = runGestureFixture("gesture_hands_up");
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("hands_up");
  });

  it("fires arms_crossed exactly once", () => {
    const events = runGestureFixture("gesture_arms_crossed");
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("arms_crossed");
  });

  it("fires one_hand_up exactly once", () => {
    const events = runGestureFixture("gesture_one_hand");
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("one_hand_up");
  });

  it("fires nothing during the neutral lead-in", () => {
    // first second of every gesture fixture is a neutral stance
    for (const name of ["gesture_hands_up", "gesture_arms_crossed", "gesture_one_hand"]) {
      expect(runGestureFixture(name, 30)).toHaveLength(0);
    }
  });

  it("requires the dwell time before firing", () => {
    // 1s neutral + 0.5s of condition: not held long enough
    expect(runGestureFixture("gesture_hands_up", 45)).toHaveLength(0);
  });
});

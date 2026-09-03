import { describe, expect, it } from "vitest";
import { createPalmDetector } from "../../src/pose/palm";
import type { HandObservation } from "../../src/pose/types";
import { loadFixture } from "./helpers";

function openPalm(offsetX = 0, mirrored = false): HandObservation {
  const fixture = loadFixture("gesture_open_palm");
  const hand = fixture.frames.find((frame) => frame.hands?.length)?.hands![0];
  if (!hand) throw new Error("Palm fixture requires a hand sample");
  return {
    ...hand,
    landmarks: hand.landmarks.map((point) => ({
      ...point,
      x: (mirrored ? 1 - point.x : point.x) + offsetX,
    })),
  };
}

function hold(
  detector: ReturnType<typeof createPalmDetector>,
  hand: HandObservation,
  start: number,
  end: number,
) {
  const samples = [];
  for (let t = start; t <= end; t += 100) samples.push(detector.feed([hand], t));
  return samples;
}

describe("open-palm rest control", () => {
  it("detects a sustained hand without any body landmarks exactly once", () => {
    const fixture = loadFixture("gesture_open_palm");
    const detector = createPalmDetector();
    expect(fixture.frames.every((frame) => frame.landmarks === null)).toBe(true);
    const events = fixture.frames.map((frame) => detector.feed(frame.hands ?? [], frame.t));
    expect(events.filter((event) => event.triggered)).toHaveLength(1);
    expect(events.slice(0, 30).every((event) => !event.handDetected)).toBe(true);
  });

  it("requires a full second and reports hold progress", () => {
    const detector = createPalmDetector();
    const samples = hold(detector, openPalm(), 0, 900);
    expect(samples.every((sample) => !sample.triggered)).toBe(true);
    expect(samples[5].progress).toBe(0.5);
    expect(detector.feed([openPalm()], 1000)).toMatchObject({
      handDetected: true, palmDetected: true, progress: 1, triggered: true,
    });
  });

  it("fires once per hold and rearms after release", () => {
    const detector = createPalmDetector();
    const hand = openPalm();
    expect(hold(detector, hand, 0, 1800).filter((sample) => sample.triggered)).toHaveLength(1);
    expect(detector.feed([], 1900)).toMatchObject({ progress: 0, triggered: false });
    expect(hold(detector, hand, 2000, 3000).filter((sample) => sample.triggered)).toHaveLength(1);
  });

  it("discards progress on an explicit reset", () => {
    const detector = createPalmDetector();
    const hand = openPalm();
    hold(detector, hand, 0, 900);
    detector.reset();
    expect(detector.feed([hand], 1000).progress).toBe(0);
    expect(hold(detector, hand, 1100, 2000).at(-1)?.triggered).toBe(true);
  });

  it.each(["Closed_Fist", "Pointing_Up", "None"])("does not accept %s", (gesture) => {
    const detector = createPalmDetector();
    const hand = { ...openPalm(), gesture };
    expect(hold(detector, hand, 0, 1500).every((sample) =>
      sample.handDetected && !sample.palmDetected && sample.progress === 0 && !sample.triggered,
    )).toBe(true);
  });

  it("requires finite confidence at or above the threshold", () => {
    for (const score of [0.749, Number.NaN, Number.POSITIVE_INFINITY]) {
      const detector = createPalmDetector();
      expect(hold(detector, { ...openPalm(), score }, 0, 1500)
        .every((sample) => !sample.palmDetected && !sample.triggered)).toBe(true);
    }
    const detector = createPalmDetector();
    expect(hold(detector, { ...openPalm(), score: 0.75 }, 0, 1000).at(-1)?.triggered).toBe(true);
  });

  it("does not treat incomplete or nonfinite hand landmarks as a detected hand", () => {
    const complete = openPalm();
    const invalidHands = [
      { ...complete, landmarks: complete.landmarks.slice(0, 20) },
      { ...complete, landmarks: complete.landmarks.map((point, i) =>
        i === 8 ? { ...point, x: Number.NaN } : point) },
    ];
    for (const hand of invalidHands) {
      const detector = createPalmDetector();
      expect(hold(detector, hand, 0, 1500).every((sample) =>
        !sample.handDetected && !sample.palmDetected && !sample.triggered,
      )).toBe(true);
    }
  });

  it("restarts the hold when a hand disappears or confidence drops", () => {
    for (const interruption of [[], [{ ...openPalm(), score: 0.1 }]]) {
      const detector = createPalmDetector();
      hold(detector, openPalm(), 0, 800);
      detector.feed(interruption, 900);
      expect(hold(detector, openPalm(), 1000, 1900).some((sample) => sample.triggered)).toBe(false);
      expect(detector.feed([openPalm()], 2000).triggered).toBe(true);
    }
  });

  it("restarts the hold after a frame gap greater than 250 ms", () => {
    const detector = createPalmDetector();
    const hand = openPalm();
    hold(detector, hand, 0, 900);
    expect(detector.feed([hand], 1200)).toMatchObject({ progress: 0, triggered: false });
    expect(hold(detector, hand, 1300, 2200).at(-1)?.triggered).toBe(true);
  });

  it("does not accumulate dwell across repeated stale frame gaps", () => {
    const detector = createPalmDetector();
    const hand = openPalm();
    for (let t = 0; t <= 3000; t += 300) {
      expect(detector.feed([hand], t)).toMatchObject({ progress: 0, triggered: false });
    }
  });

  it.each([-100, Number.NaN, Number.POSITIVE_INFINITY])("restarts on invalid clock sample %s", (t) => {
    const detector = createPalmDetector();
    const hand = openPalm();
    hold(detector, hand, 0, 900);
    expect(detector.feed([hand], t)).toMatchObject({ progress: 0, triggered: false });
    expect(hold(detector, hand, 1000, 1900).some((sample) => sample.triggered)).toBe(false);
    expect(detector.feed([hand], 2000).triggered).toBe(true);
  });

  it("does not combine holds from alternating hands", () => {
    for (const secondHand of [openPalm(0.35), openPalm(0, true)]) {
      const detector = createPalmDetector();
      const hands = [openPalm(), secondHand];
      for (let t = 0; t <= 3000; t += 100) {
        expect(detector.feed([hands[(t / 100) % 2]], t).triggered).toBe(false);
      }
    }
  });

  it("keeps the same palm when the recognizer changes hand order", () => {
    const detector = createPalmDetector();
    const left = openPalm(-0.2);
    const right = openPalm(0.2, true);
    detector.feed([left, right], 0);
    let triggers = 0;
    for (let t = 100; t <= 1500; t += 100) {
      const hands = (t / 100) % 2 === 0 ? [left, right] : [right, left];
      if (detector.feed(hands, t).triggered) triggers++;
    }
    expect(triggers).toBe(1);
  });
});

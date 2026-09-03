import { describe, expect, it } from "vitest";
import { angle3, createEma, verticalAngle } from "../../src/pose/angles";

describe("angle3", () => {
  it("measures a right angle", () => {
    expect(angle3({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(90);
  });

  it("measures a straight line as 180", () => {
    expect(angle3({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 0, y: -1 })).toBeCloseTo(180);
  });

  it("measures 45 degrees", () => {
    expect(angle3({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 1 })).toBeCloseTo(45);
  });

  it("is safe on degenerate points", () => {
    expect(angle3({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(180);
  });
});

describe("verticalAngle", () => {
  it("is 0 for a vertical segment", () => {
    expect(verticalAngle({ x: 0.5, y: 0.2 }, { x: 0.5, y: 0.8 })).toBeCloseTo(0);
  });

  it("is 45 for a diagonal segment", () => {
    expect(verticalAngle({ x: 0, y: 0 }, { x: 0.3, y: 0.3 })).toBeCloseTo(45);
  });
});

describe("createEma", () => {
  it("starts at the first sample and averages after", () => {
    const ema = createEma(0.5);
    expect(ema.push(0)).toBe(0);
    expect(ema.push(10)).toBe(5);
    ema.reset();
    expect(ema.current).toBeNull();
  });
});

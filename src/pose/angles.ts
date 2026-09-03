export interface Pt {
  x: number;
  y: number;
}

/** Angle in degrees at vertex `b` of triangle a-b-c, using 2D coordinates. */
export function angle3(a: Pt, b: Pt, c: Pt): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const dot = v1x * v2x + v1y * v2y;
  const m1 = Math.hypot(v1x, v1y);
  const m2 = Math.hypot(v2x, v2y);
  if (m1 === 0 || m2 === 0) return 180;
  const cos = Math.min(1, Math.max(-1, dot / (m1 * m2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Deviation of the segment top→bottom from vertical, in degrees (0 = perfectly vertical). */
export function verticalAngle(top: Pt, bottom: Pt): number {
  const dx = bottom.x - top.x;
  const dy = bottom.y - top.y;
  if (dx === 0 && dy === 0) return 0;
  return (Math.atan2(Math.abs(dx), Math.abs(dy)) * 180) / Math.PI;
}

/** Exponential moving average; alpha is the weight of the newest sample. */
export function createEma(alpha = 0.5) {
  let value: number | null = null;
  return {
    push(x: number): number {
      value = value === null ? x : alpha * x + (1 - alpha) * value;
      return value;
    },
    reset() {
      value = null;
    },
    get current(): number | null {
      return value;
    },
  };
}

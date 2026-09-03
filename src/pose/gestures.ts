import { LM, type Landmark } from "./types";

export type GestureType = "hands_up" | "arms_crossed" | "one_hand_up";

export interface GestureEvent {
  type: GestureType | "open_palm";
  t: number;
}

/** Body-gesture detector with a dwell timer: a condition must hold
 *  continuously for `dwellMs` (of frame time) to fire, and fires once
 *  until the condition is released. */
export function createGestureDetector(dwellMs = 1000) {
  const since: Record<GestureType, number | null> = {
    hands_up: null,
    arms_crossed: null,
    one_hand_up: null,
  };

  function conditions(lm: Landmark[]): Record<GestureType, boolean> {
    const nose = lm[LM.NOSE];
    const ls = lm[LM.LEFT_SHOULDER];
    const rs = lm[LM.RIGHT_SHOULDER];
    const lw = lm[LM.LEFT_WRIST];
    const rw = lm[LM.RIGHT_WRIST];
    const lh = lm[LM.LEFT_HIP];
    const rh = lm[LM.RIGHT_HIP];
    const visible = [nose, ls, rs, lw, rw, lh, rh].every(
      (p) => p && p.visibility >= 0.5,
    );
    if (!visible) return { hands_up: false, arms_crossed: false, one_hand_up: false };

    const lUp = lw.y < nose.y;
    const rUp = rw.y < nose.y;
    const bandTop = Math.min(ls.y, rs.y);
    const bandBottom = Math.max(lh.y, rh.y);
    const inBand = (p: Landmark) => p.y > bandTop && p.y < bandBottom;
    // Crossed = wrist left/right order inverted relative to the shoulders.
    // (Robust to mirrored vs unmirrored coordinates, unlike a raw lw.x > rw.x.)
    const crossed = (lw.x - rw.x) * (ls.x - rs.x) < -0.0001;

    return {
      hands_up: lUp && rUp,
      arms_crossed: !lUp && !rUp && inBand(lw) && inBand(rw) && crossed,
      one_hand_up: lUp !== rUp,
    };
  }

  return {
    feed(lm: Landmark[], t: number): GestureEvent | null {
      const now = conditions(lm);
      for (const k of Object.keys(now) as GestureType[]) {
        if (!now[k]) {
          since[k] = null;
          continue;
        }
        if (since[k] === null) {
          since[k] = t;
        } else if (t - since[k]! >= dwellMs) {
          since[k] = Number.POSITIVE_INFINITY; // fire once per hold
          return { type: k, t };
        }
      }
      return null;
    },
    reset() {
      since.hands_up = null;
      since.arms_crossed = null;
      since.one_hand_up = null;
    },
  };
}

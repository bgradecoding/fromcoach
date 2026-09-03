import { LM, type Landmark, type ViewKind } from "./types";

/** Classifies camera view from normalized shoulder width, with a dead band
 *  (0.12–0.22) that keeps the previous answer to avoid flicker. */
export function createViewClassifier() {
  let view: ViewKind = "unknown";
  return {
    feed(lm: Landmark[]): ViewKind {
      const ls = lm[LM.LEFT_SHOULDER];
      const rs = lm[LM.RIGHT_SHOULDER];
      if (!ls || !rs || Math.min(ls.visibility, rs.visibility) < 0.5) return view;
      const width = Math.abs(ls.x - rs.x);
      if (width > 0.22) view = "front";
      else if (width < 0.12) view = "side";
      return view;
    },
    reset() {
      view = "unknown";
    },
    get current(): ViewKind {
      return view;
    },
  };
}

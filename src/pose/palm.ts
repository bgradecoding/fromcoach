import type { HandObservation, Landmark } from "./types";

export interface PalmDetection {
  handDetected: boolean;
  palmDetected: boolean;
  progress: number;
  triggered: boolean;
}

type Palm = { x: number; y: number; size: number; orientation: number };

function validLandmarks(landmarks: Landmark[]): boolean {
  return Array.isArray(landmarks) && landmarks.length === 21 && Array.from(landmarks).every(
    (point) => point && Number.isFinite(point.x) && Number.isFinite(point.y),
  );
}

function locatePalm(landmarks: Landmark[]): Palm {
  const wrist = landmarks[0];
  const index = landmarks[5];
  const middle = landmarks[9];
  const pinky = landmarks[17];
  const base = [wrist, index, middle, landmarks[13], pinky];
  return {
    x: base.reduce((sum, point) => sum + point.x, 0) / base.length,
    y: base.reduce((sum, point) => sum + point.y, 0) / base.length,
    size: Math.max(
      Math.hypot(index.x - pinky.x, index.y - pinky.y),
      Math.hypot(wrist.x - middle.x, wrist.y - middle.y),
    ),
    // Mirrored palms have opposite orientation, even at the same position.
    orientation: Math.sign(
      (index.x - wrist.x) * (pinky.y - wrist.y)
      - (index.y - wrist.y) * (pinky.x - wrist.x),
    ),
  };
}

/** A continuous open-palm hold, independent of body landmarks. Missing or
 * stale samples release the hold so an interrupted stream cannot skip rest. */
export function createPalmDetector(dwellMs = 1000, minScore = 0.75) {
  let since: number | null = null;
  let previousTime: number | null = null;
  let tracked: Palm | null = null;
  let fired = false;

  function release() {
    since = null;
    tracked = null;
    fired = false;
  }

  return {
    feed(hands: HandObservation[], t: number): PalmDetection {
      const visible = hands.filter((hand) => validLandmarks(hand.landmarks));
      const palms = visible
        .filter((hand) => hand.gesture === "Open_Palm"
          && Number.isFinite(hand.score) && hand.score >= minScore)
        .map((hand) => locatePalm(hand.landmarks));
      const result: PalmDetection = {
        handDetected: visible.length > 0,
        palmDetected: palms.length > 0,
        progress: 0,
        triggered: false,
      };

      if (!Number.isFinite(t)) {
        release();
        previousTime = null;
        return result;
      }
      if (previousTime !== null && (t < previousTime || t - previousTime > 250)) {
        release();
      }
      previousTime = t;
      if (palms.length === 0) {
        release();
        return result;
      }

      // Keep following the same palm if recognizer result order changes. A
      // different hand starts its own hold instead of inheriting progress.
      const previousPalm = tracked;
      const match = previousPalm && palms
        .filter((palm) => palm.orientation === previousPalm.orientation
          && Math.hypot(palm.x - previousPalm.x, palm.y - previousPalm.y)
            <= Math.max(0.03, Math.min(0.1, previousPalm.size * 0.5)))
        .sort((a, b) => Math.hypot(a.x - previousPalm.x, a.y - previousPalm.y)
          - Math.hypot(b.x - previousPalm.x, b.y - previousPalm.y))[0];
      if (!match) {
        release();
        since = t;
      }
      tracked = match || palms[0];
      result.progress = Math.min(1, Math.max(0, (t - since!) / dwellMs));
      if (!fired && result.progress >= 1) {
        fired = true;
        result.triggered = true;
      }
      return result;
    },
    reset() {
      release();
      previousTime = null;
    },
  };
}

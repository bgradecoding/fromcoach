import type { RepRecord } from "./types";

export interface RepCounterConfig {
  down: number; // enter the down state below this angle
  up: number; // nominal top-of-rep angle
  hysteresis?: number; // rep completes above up - hysteresis
}

/** Hysteresis FSM over a smoothed joint angle. Emits one RepRecord per
 *  down→up cycle; form flags observed during the down phase are attached
 *  when the rep completes. */
export function createRepCounter(cfg: RepCounterConfig) {
  const upThreshold = cfg.up - (cfg.hysteresis ?? 10);
  let state: "up" | "down" = "up";
  let minAngle = Number.POSITIVE_INFINITY;
  let downAt = 0;
  let bottomAt = 0;

  return {
    feed(angle: number, t: number, flagsSoFar: Set<string>): RepRecord | null {
      if (state === "up" && angle < cfg.down) {
        state = "down";
        downAt = t;
        bottomAt = t;
        minAngle = angle;
        return null;
      }
      if (state === "down") {
        if (angle < minAngle) {
          minAngle = angle;
          bottomAt = t;
        }
        if (angle > upThreshold) {
          state = "up";
          const flags = [...flagsSoFar];
          if (minAngle > cfg.down + 15) flags.push("shallow");
          return {
            minAngle,
            tempoDownMs: bottomAt - downAt,
            tempoUpMs: t - bottomAt,
            flags,
          };
        }
      }
      return null;
    },
    reset() {
      state = "up";
      minAngle = Number.POSITIVE_INFINITY;
    },
    get state(): "up" | "down" {
      return state;
    },
  };
}

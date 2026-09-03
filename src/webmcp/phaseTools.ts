// Registers/unregisters write tools as the workout phase changes (PLAN §5.3).
// The three read tools are registered once and never abort, so agents can
// poll them without flicker. The declarative createPlan form is mounted and
// unmounted in the DOM by the UI (idle/done), not registered here.
import type { Phase } from "../pose/types";
import { store } from "../session/store";
import { registerTool } from "./adapter";
import { TOOLS } from "./tools";

const READ_TOOLS = ["getWorkoutPlan", "getLiveMetrics", "getSetHistory"];

export const PHASE_TOOLS: Record<Phase, string[]> = {
  idle: ["startSet"],
  countdown: ["endSession"],
  set: ["adjustProgram", "setRest", "endSession"],
  rest: ["startSet", "setRest", "adjustProgram", "endSession"],
  awaiting_confirmation: ["endSession"],
  done: [],
};

let controller: AbortController | null = null;
let activeKey: string | null = null;

export function syncToolsToPhase(phase: Phase): void {
  const names = PHASE_TOOLS[phase];
  const key = names.join(",");
  if (key === activeKey) return; // same tool set: don't churn registrations
  activeKey = key;
  controller?.abort();
  controller = new AbortController();
  for (const name of names) {
    registerTool(TOOLS[name], { signal: controller.signal });
  }
}

/** Call once at boot, after initWebMCP(). */
export function initPhaseTools(): void {
  const forever = new AbortController();
  for (const name of READ_TOOLS) {
    registerTool(TOOLS[name], { signal: forever.signal });
  }
  syncToolsToPhase(store.get().phase);
  store.subscribe(() => syncToolsToPhase(store.get().phase));
}

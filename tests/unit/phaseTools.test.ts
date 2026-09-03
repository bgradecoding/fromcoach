import { describe, expect, it } from "vitest";
import { listToolDefs } from "../../src/webmcp/adapter";
import { initPhaseTools, syncToolsToPhase } from "../../src/webmcp/phaseTools";
import type { Phase } from "../../src/pose/types";

const READ = ["getLiveMetrics", "getSetHistory", "getWorkoutPlan"];
const names = () => listToolDefs().map((t) => t.name).sort();

describe("phase-based tool registration (PLAN §5.3)", () => {
  it("registers read tools plus plan creation and startSet in idle", () => {
    initPhaseTools(); // store starts in idle
    expect(names()).toEqual([...READ, "createWorkoutPlan", "startSet"].sort());
  });

  it("matches the table for every phase", () => {
    const expected: Record<Phase, string[]> = {
      idle: ["createWorkoutPlan", "startSet"],
      countdown: ["endSession"],
      set: ["adjustProgram", "setRest", "endSession"],
      rest: ["startSet", "setRest", "adjustProgram", "endSession"],
      awaiting_confirmation: ["endSession"],
      done: ["createWorkoutPlan"],
    };
    for (const phase of Object.keys(expected) as Phase[]) {
      syncToolsToPhase(phase);
      expect(names(), `phase ${phase}`).toEqual([...READ, ...expected[phase]].sort());
    }
  });

  it("read-only annotations follow the spec", () => {
    syncToolsToPhase("rest");
    const readOnly = listToolDefs()
      .filter((t) => t.annotations?.readOnlyHint)
      .map((t) => t.name)
      .sort();
    expect(readOnly).toEqual(READ.sort());
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "./helpers";

let tools: typeof import("../../src/webmcp/tools").TOOLS;
let store: typeof import("../../src/session/store").store;

const validPlan = { exercise: "squat", sets: 3, reps: 10, restSec: 90 };

beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  tools = (await import("../../src/webmcp/tools")).TOOLS;
  store = (await import("../../src/session/store")).store;
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("createWorkoutPlan", () => {
  it("creates a plan in idle, attributes it to the agent, and returns the stored plan", async () => {
    const result = await tools.createWorkoutPlan.execute({ ...validPlan, userNote: "  sensitive knee  " });
    expect(result).toEqual({ status: "created", plan: store.get().plan });
    expect(store.get().plan).toEqual({
      blocks: [{ exercise: "squat", sets: 3, reps: 10, restSec: 90 }],
      createdBy: "agent",
      userNote: "sensitive knee",
      createdAt: expect.any(String),
    });
    expect(store.get().phase).toBe("idle");
  });

  it.each([
    { exercise: "squat", sets: 1, reps: 1, restSec: 10 },
    { exercise: "pushup", sets: 10, reps: 50, restSec: 600, userNote: "n".repeat(500) },
  ])("accepts boundary values: $exercise, $sets sets, $reps reps, $restSec seconds", async (input) => {
    expect(await tools.createWorkoutPlan.execute(input)).toMatchObject({ status: "created" });
    expect(store.get().plan?.userNote).toBe(input.userNote ?? "");
  });

  it.each([
    ["unsupported exercise", { exercise: "goblet_squat" }],
    ["missing exercise", { exercise: undefined }],
    ["missing sets", { sets: undefined }],
    ["missing reps", { reps: undefined }],
    ["missing rest", { restSec: undefined }],
    ["too few sets", { sets: 0 }],
    ["too many sets", { sets: 11 }],
    ["fractional sets", { sets: 2.5 }],
    ["string sets", { sets: "3" }],
    ["too few reps", { reps: 0 }],
    ["too many reps", { reps: 51 }],
    ["fractional reps", { reps: 9.5 }],
    ["string reps", { reps: "10" }],
    ["too short rest", { restSec: 9 }],
    ["too long rest", { restSec: 601 }],
    ["fractional rest", { restSec: 89.5 }],
    ["string rest", { restSec: "90" }],
    ["nonfinite rest", { restSec: Infinity }],
    ["non-string note", { userNote: 123 }],
    ["oversized note", { userNote: "n".repeat(501) }],
  ])("rejects %s without changing an existing plan", async (_label, invalidFields) => {
    await tools.createWorkoutPlan.execute(validPlan);
    const before = store.get();
    expect(await tools.createWorkoutPlan.execute({ ...validPlan, ...invalidFields }))
      .toMatchObject({ status: "error", reason: expect.any(String) });
    expect(store.get()).toBe(before);
  });

  it("rejects creation in every active phase without changing the session", async () => {
    await tools.createWorkoutPlan.execute(validPlan);
    const rejectCreation = async (phase: string) => {
      const before = store.get();
      expect(before.phase).toBe(phase);
      expect(await tools.createWorkoutPlan.execute({ ...validPlan, exercise: "pushup" }))
        .toMatchObject({ status: "error", reason: expect.stringContaining(phase) });
      expect(store.get()).toBe(before);
    };

    store.startSet();
    await rejectCreation("countdown");
    vi.advanceTimersByTime(3000);
    await rejectCreation("set");

    const proposal = tools.adjustProgram.execute({ action: "add_set", reason: "test" });
    await rejectCreation("awaiting_confirmation");
    store.resolveProposal("rejected");
    await proposal;

    const { pushFrame } = await import("../../src/pose/engine");
    for (const frame of loadFixture("squat_10reps_side").frames) pushFrame(frame);
    await rejectCreation("rest");
    store.endSession();
  });

  it("creates a fresh idle session after the previous session ends", async () => {
    await tools.createWorkoutPlan.execute(validPlan);
    store.startSet();
    vi.advanceTimersByTime(3000);
    const { pushFrame } = await import("../../src/pose/engine");
    for (const frame of loadFixture("squat_10reps_side").frames) pushFrame(frame);
    store.endSession();
    expect(store.get().phase).toBe("done");
    expect(store.getSetHistory()).toHaveLength(1);

    expect(await tools.createWorkoutPlan.execute({ exercise: "pushup", sets: 2, reps: 8, restSec: 60 }))
      .toMatchObject({ status: "created", plan: { createdBy: "agent", userNote: "" } });
    expect(store.get()).toMatchObject({ phase: "idle", records: [], summary: null, reps: 0 });
    expect(store.get().plan?.blocks).toEqual([{ exercise: "pushup", sets: 2, reps: 8, restSec: 60 }]);
  });
});

describe("numeric tool arguments", () => {
  it.each([0.4, "0"])("rejects non-integer blockIndex %s without starting a set", async (blockIndex) => {
    await tools.createWorkoutPlan.execute(validPlan);
    const before = store.get();
    expect(await tools.startSet.execute({ blockIndex })).toMatchObject({ status: "error" });
    expect(store.get()).toBe(before);
  });

  it.each([45.5, "45"])("rejects non-integer rest seconds %s without changing the plan", async (seconds) => {
    await tools.createWorkoutPlan.execute(validPlan);
    store.startSet();
    vi.advanceTimersByTime(3000);
    const before = store.get();
    expect(await tools.setRest.execute({ seconds })).toMatchObject({ status: "error" });
    expect(store.get()).toBe(before);
    store.endSession();
  });
});

describe("reduce_reps contract", () => {
  it.each([10, 11, 8.5, "8"])("rejects reps %s without opening a proposal", async (reps) => {
    await tools.createWorkoutPlan.execute(validPlan);
    store.startSet();
    vi.advanceTimersByTime(3000);
    const before = store.get();
    expect(await tools.adjustProgram.execute({ action: "reduce_reps", reps, reason: "test" }))
      .toMatchObject({ status: "error" });
    expect(store.get()).toBe(before);
    store.endSession();
  });

  it("applies an accepted lower target to the next set, preserving the current target", async () => {
    await tools.createWorkoutPlan.execute(validPlan);
    store.startSet();
    vi.advanceTimersByTime(3000);
    const proposal = tools.adjustProgram.execute({ action: "reduce_reps", reps: 8, reason: "test" });
    expect(store.get().phase).toBe("awaiting_confirmation");
    store.resolveProposal("applied");
    expect(await proposal).toMatchObject({ status: "applied" });
    expect(store.get().plan?.blocks[0].reps).toBe(8);
    expect(store.getLiveMetrics().targetReps).toBe(10);

    const { pushFrame } = await import("../../src/pose/engine");
    for (const frame of loadFixture("squat_10reps_side").frames) pushFrame(frame);
    expect(store.getSetHistory()[0]).toMatchObject({ reps: 10, target: 10 });
    store.startSet();
    expect(store.getLiveMetrics().targetReps).toBe(8);
    store.endSession();
  });
});

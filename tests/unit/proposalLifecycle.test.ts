import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Phase } from "../../src/pose/types";
import type { ProposalOutcome } from "../../src/session/types";
import { loadFixture } from "./helpers";

describe("proposal lifecycle when a session ends", () => {
  let store: typeof import("../../src/session/store")["store"];
  let pushFrame: typeof import("../../src/pose/engine")["pushFrame"];

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-04T00:00:00Z"));
    vi.resetModules();
    ({ store } = await import("../../src/session/store"));
    ({ pushFrame } = await import("../../src/pose/engine"));
  });

  afterEach(() => {
    store.endSession();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function replay(name: string) {
    for (const frame of loadFixture(name).frames) pushFrame(frame);
  }

  function startSession(phase: "set" | "rest" = "set") {
    store.createPlan({
      blocks: [{ exercise: "squat", sets: 2, reps: 10, restSec: 90 }],
      createdBy: "user",
      userNote: "",
    });
    expect(store.startSet().status).toBe("started");
    vi.advanceTimersByTime(3000);
    if (phase === "rest") replay("squat_10reps_side");
    expect(store.get().phase).toBe(phase);
  }

  it.each(["set", "rest"] as const)("cancels a proposal over %s directly into done and ignores later resolutions", async (phase) => {
    startSession(phase);
    const originalPlan = store.get().plan;
    const proposalId = `cancel-${phase}`;
    const pending = store.propose({ proposalId, action: "add_set", reason: "One more set" });
    const settled = vi.fn();
    void pending.then(settled);
    expect(store.get().phase).toBe("awaiting_confirmation");
    const transitions: Phase[] = [];
    const unsubscribe = store.subscribe(() => transitions.push(store.get().phase));

    const summary = store.endSession();
    expect(summary).toMatchObject({ totalReps: phase === "rest" ? 10 : 0 });
    await expect(pending).resolves.toEqual({
      status: "cancelled",
      reason: "session ended",
      proposalId,
    });
    expect(transitions).toEqual(["done"]);
    expect(store.get()).toMatchObject({ phase: "done", proposal: null, overlayReturn: null });
    expect(store.get().plan).toBe(originalPlan);
    expect(vi.getTimerCount()).toBe(0);

    replay("gesture_hands_up");
    replay("gesture_arms_crossed");
    store.resolveProposal("applied");
    store.resolveProposal("rejected");
    vi.advanceTimersByTime(30_000);
    store.endSession();
    await Promise.resolve();
    expect(settled).toHaveBeenCalledOnce();
    expect(transitions).toEqual(["done"]);
    expect(store.get().plan).toBe(originalPlan);
    expect(store.get().summary).toBe(summary);
    unsubscribe();
  });

  it("allows a new session and proposal without an old confirmation timer settling the new call", async () => {
    startSession();
    const old = store.propose({ proposalId: "old", action: "add_set", reason: "Old request" });
    vi.advanceTimersByTime(5000);
    store.endSession();
    await expect(old).resolves.toMatchObject({ status: "cancelled", proposalId: "old" });

    startSession();
    store.setConfirmTimeoutMs(30_000);
    const next = store.propose({
      proposalId: "next",
      action: "reduce_reps",
      reps: 7,
      reason: "New request",
    });
    const settled = vi.fn();
    void next.then(settled);
    // This passes the cancelled proposal's original 20-second deadline.
    vi.advanceTimersByTime(12_000);
    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();
    expect(store.get()).toMatchObject({ phase: "awaiting_confirmation", proposal: { proposalId: "next" } });
    expect(store.get().plan!.blocks[0].reps).toBe(10);

    store.resolveProposal("applied");
    await expect(next).resolves.toMatchObject({
      status: "applied",
      proposalId: "next",
      plan: { blocks: [{ reps: 7, sets: 2 }] },
    });
    expect(settled).toHaveBeenCalledOnce();
    expect(store.get().phase).toBe("set");
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["applied", "rejected", "timeout"] as ProposalOutcome[])("preserves normal %s settlement", async (outcome) => {
    const phase = outcome === "timeout" ? "rest" : "set";
    startSession(phase);
    const originalPlan = store.get().plan;
    const pending = store.propose({ proposalId: outcome, action: "add_set", reason: "One more set" });

    if (outcome === "timeout") vi.advanceTimersByTime(store.getConfirmTimeoutMs());
    else replay(outcome === "applied" ? "gesture_hands_up" : "gesture_arms_crossed");

    const result = await pending;
    expect(result).toMatchObject({ status: outcome, proposalId: outcome });
    expect(store.get()).toMatchObject({ phase, proposal: null, overlayReturn: null });
    if (outcome === "applied") {
      expect(result.plan).toBe(store.get().plan);
      expect(store.get().plan!.blocks[0].sets).toBe(3);
    } else {
      expect(result).not.toHaveProperty("plan");
      expect(store.get().plan).toBe(originalPlan);
    }
    if (phase === "rest") {
      const remaining = store.get().restRemainingSec!;
      vi.advanceTimersByTime(1000);
      expect(store.get().restRemainingSec).toBe(remaining - 1);
    }
  });
});

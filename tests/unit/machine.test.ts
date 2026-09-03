import { describe, expect, it } from "vitest";
import { initialState, reduce } from "../../src/session/machine";
import type { Plan, SessionState } from "../../src/session/types";
import type { RepRecord } from "../../src/pose/types";

const T0 = 1_000_000;

function makePlan(overrides: Partial<Plan["blocks"][0]> = {}): Plan {
  return {
    blocks: [{ exercise: "squat", sets: 2, reps: 3, restSec: 30, ...overrides }],
    createdBy: "user",
    userNote: "",
    createdAt: new Date(T0).toISOString(),
  };
}

const rep = (flags: string[] = []): RepRecord => ({
  minAngle: 92,
  tempoDownMs: 800,
  tempoUpMs: 700,
  flags,
});

function startedSet(plan: Plan | null = makePlan()): SessionState {
  let s = initialState(plan);
  s = reduce(s, { type: "START_SET", at: T0 });
  return reduce(s, { type: "COUNTDOWN_DONE", at: T0 + 3000 });
}

describe("session machine", () => {
  it("starts a set: idle → countdown → set", () => {
    let s = initialState(makePlan());
    s = reduce(s, { type: "START_SET", at: T0 });
    expect(s.phase).toBe("countdown");
    expect(s.activeExercise).toBe("squat");
    expect(s.targetReps).toBe(3);
    expect(s.sessionStartedAt).toBe(T0);
    s = reduce(s, { type: "COUNTDOWN_DONE", at: T0 + 3000 });
    expect(s.phase).toBe("set");
  });

  it("creates a default 3x12 squat plan when startSet is called without one", () => {
    const s = reduce(initialState(null), { type: "START_SET", at: T0 });
    expect(s.phase).toBe("countdown");
    expect(s.plan!.blocks[0]).toMatchObject({ exercise: "squat", sets: 3, reps: 12, restSec: 90 });
  });

  it("ignores startSet outside idle/rest", () => {
    const s = startedSet();
    expect(reduce(s, { type: "START_SET", at: T0 })).toBe(s);
  });

  it("counts reps and moves to rest when the target is reached", () => {
    let s = startedSet();
    s = reduce(s, { type: "REP", rep: rep(), at: T0 + 5000 });
    expect(s.phase).toBe("set");
    expect(s.reps).toBe(1);
    s = reduce(s, { type: "REP", rep: rep(["knee_valgus"]), at: T0 + 8000 });
    s = reduce(s, { type: "REP", rep: rep(), at: T0 + 11_000 });
    expect(s.phase).toBe("rest");
    expect(s.restRemainingSec).toBe(30);
    expect(s.records).toHaveLength(1);
    expect(s.records[0]).toMatchObject({
      exercise: "squat",
      setIndex: 1,
      reps: 3,
      target: 3,
      flagCounts: { knee_valgus: 1 },
    });
    expect(s.records[0].avgTempoMs).toEqual({ down: 800, up: 700 });
    expect(s.setIndex).toBe(2); // next set queued
  });

  it("goes straight to done after the last set, with a summary", () => {
    let s = startedSet(makePlan({ sets: 1, reps: 2 }));
    s = reduce(s, { type: "REP", rep: rep(), at: T0 + 5000 });
    s = reduce(s, { type: "REP", rep: rep(), at: T0 + 8000 });
    expect(s.phase).toBe("done");
    expect(s.summary).not.toBeNull();
    expect(s.summary!.totalReps).toBe(2);
    expect(s.summary!.sets).toBe(1);
  });

  it("rest ticks down and auto-starts the next countdown at zero", () => {
    let s = startedSet(makePlan({ reps: 1, restSec: 2 }));
    s = reduce(s, { type: "REP", rep: rep(), at: T0 + 5000 });
    expect(s.phase).toBe("rest");
    expect(s.restRemainingSec).toBe(2);
    s = reduce(s, { type: "REST_TICK", at: T0 + 6000 });
    expect(s.restRemainingSec).toBe(1);
    s = reduce(s, { type: "REST_TICK", at: T0 + 7000 });
    expect(s.phase).toBe("countdown");
    expect(s.setIndex).toBe(2);
    expect(s.reps).toBe(0);
  });

  it("skips rest on SKIP_REST", () => {
    let s = startedSet(makePlan({ reps: 1 }));
    s = reduce(s, { type: "REP", rep: rep(), at: T0 + 5000 });
    s = reduce(s, { type: "SKIP_REST", at: T0 + 6000 });
    expect(s.phase).toBe("countdown");
  });

  it("SET_REST resets the running rest timer, or the block during a set", () => {
    let s = startedSet(makePlan({ reps: 1 }));
    const during = reduce(s, { type: "SET_REST", seconds: 45 });
    expect(during.plan!.blocks[0].restSec).toBe(45);
    expect(during.phase).toBe("set");
    s = reduce(s, { type: "REP", rep: rep(), at: T0 + 5000 });
    s = reduce(s, { type: "SET_REST", seconds: 45 });
    expect(s.restRemainingSec).toBe(45);
    expect(s.plan!.blocks[0].restSec).toBe(45);
  });

  it("overlays awaiting_confirmation on set and returns on reject", () => {
    let s = startedSet();
    s = reduce(s, {
      type: "PROPOSE",
      proposal: { proposalId: "p1", action: "add_set", reason: "r" },
    });
    expect(s.phase).toBe("awaiting_confirmation");
    expect(s.overlayReturn).toBe("set");
    s = reduce(s, { type: "RESOLVE_PROPOSAL", outcome: "rejected", at: T0 + 9000 });
    expect(s.phase).toBe("set");
    expect(s.plan!.blocks[0].sets).toBe(2); // unchanged
    expect(s.proposal).toBeNull();
  });

  it("applies swap_exercise to the current block on accept", () => {
    let s = startedSet();
    s = reduce(s, {
      type: "PROPOSE",
      proposal: { proposalId: "p2", action: "swap_exercise", exercise: "goblet_squat", reason: "r" },
    });
    s = reduce(s, { type: "RESOLVE_PROPOSAL", outcome: "applied", at: T0 + 9000 });
    expect(s.phase).toBe("set");
    expect(s.plan!.blocks[0].exercise).toBe("goblet_squat");
    expect(s.activeExercise).toBe("squat"); // current set keeps its exercise
  });

  it("applies extend_rest to the running rest timer", () => {
    let s = startedSet(makePlan({ reps: 1 }));
    s = reduce(s, { type: "REP", rep: rep(), at: T0 + 5000 });
    s = reduce(s, {
      type: "PROPOSE",
      proposal: { proposalId: "p3", action: "extend_rest", seconds: 15, reason: "r" },
    });
    expect(s.overlayReturn).toBe("rest");
    s = reduce(s, { type: "RESOLVE_PROPOSAL", outcome: "applied", at: T0 + 9000 });
    expect(s.phase).toBe("rest");
    expect(s.restRemainingSec).toBe(30 + 15);
  });

  it("applies reduce_reps and add_set to the block", () => {
    let s = startedSet();
    s = reduce(s, {
      type: "PROPOSE",
      proposal: { proposalId: "p4", action: "reduce_reps", reps: 2, reason: "r" },
    });
    s = reduce(s, { type: "RESOLVE_PROPOSAL", outcome: "applied", at: T0 + 9000 });
    expect(s.plan!.blocks[0].reps).toBe(2);
    s = reduce(s, {
      type: "PROPOSE",
      proposal: { proposalId: "p5", action: "add_set", reason: "r" },
    });
    s = reduce(s, { type: "RESOLVE_PROPOSAL", outcome: "applied", at: T0 + 10_000 });
    expect(s.plan!.blocks[0].sets).toBe(3);
  });

  it("timeout leaves the plan untouched", () => {
    let s = startedSet();
    s = reduce(s, {
      type: "PROPOSE",
      proposal: { proposalId: "p6", action: "add_set", reason: "r" },
    });
    s = reduce(s, { type: "RESOLVE_PROPOSAL", outcome: "timeout", at: T0 + 30_000 });
    expect(s.phase).toBe("set");
    expect(s.plan!.blocks[0].sets).toBe(2);
  });

  it("endSession works from set, rest, countdown, and awaiting_confirmation", () => {
    // from set, mid-set reps count toward the summary
    let s = startedSet();
    s = reduce(s, { type: "REP", rep: rep(["torso_lean"]), at: T0 + 5000 });
    s = reduce(s, { type: "END_SESSION", at: T0 + 6000 });
    expect(s.phase).toBe("done");
    expect(s.summary!.totalReps).toBe(1);
    expect(s.summary!.flagCounts.torso_lean).toBe(1);
    expect(s.summary!.durationSec).toBe(6);

    // from countdown
    let c = reduce(initialState(makePlan()), { type: "START_SET", at: T0 });
    c = reduce(c, { type: "END_SESSION", at: T0 + 1000 });
    expect(c.phase).toBe("done");

    // from awaiting_confirmation
    let a = startedSet();
    a = reduce(a, {
      type: "PROPOSE",
      proposal: { proposalId: "p7", action: "add_set", reason: "r" },
    });
    a = reduce(a, { type: "END_SESSION", at: T0 + 9000 });
    expect(a.phase).toBe("done");

    // idle and done are no-ops
    const idle = initialState(makePlan());
    expect(reduce(idle, { type: "END_SESSION", at: T0 })).toBe(idle);
    expect(reduce(s, { type: "END_SESSION", at: T0 + 7000 })).toBe(s);
  });

  it("CREATE_PLAN replaces the plan and resets the session (idle/done only)", () => {
    const plan = makePlan({ exercise: "pushup" });
    let s = reduce(initialState(null), { type: "CREATE_PLAN", plan });
    expect(s.plan).toBe(plan);
    expect(s.phase).toBe("idle");
    const mid = startedSet();
    expect(reduce(mid, { type: "CREATE_PLAN", plan })).toBe(mid);
  });

  it("advances through multiple blocks", () => {
    const plan: Plan = {
      blocks: [
        { exercise: "squat", sets: 1, reps: 1, restSec: 10 },
        { exercise: "pushup", sets: 1, reps: 1, restSec: 10 },
      ],
      createdBy: "user",
      userNote: "",
      createdAt: new Date(T0).toISOString(),
    };
    let s = startedSet(plan);
    s = reduce(s, { type: "REP", rep: rep(), at: T0 + 5000 });
    expect(s.phase).toBe("rest"); // second block remains
    expect(s.blockIndex).toBe(1);
    expect(s.setIndex).toBe(1);
    s = reduce(s, { type: "SKIP_REST", at: T0 + 6000 });
    expect(s.activeExercise).toBe("pushup");
    s = reduce(s, { type: "COUNTDOWN_DONE", at: T0 + 9000 });
    s = reduce(s, { type: "REP", rep: rep(), at: T0 + 12_000 });
    expect(s.phase).toBe("done");
    expect(s.summary!.totalReps).toBe(2);
  });
});

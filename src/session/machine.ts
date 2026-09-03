// Pure session state machine (see PLAN §2.4). No timers, no engine calls —
// the store dispatches events and schedules side effects from phase changes.
import { computeSummary } from "./summary";
import {
  DEFAULT_PLAN_BLOCK,
  type Plan,
  type SessionEvent,
  type SessionState,
  type SetRecord,
} from "./types";

export function initialState(plan: Plan | null = null): SessionState {
  return {
    phase: "idle",
    overlayReturn: null,
    plan,
    blockIndex: 0,
    setIndex: 1,
    activeExercise: null,
    targetReps: null,
    reps: 0,
    flagCounts: {},
    lastRep: null,
    tempoDownSumMs: 0,
    tempoUpSumMs: 0,
    restRemainingSec: null,
    proposal: null,
    records: [],
    summary: null,
    sessionStartedAt: null,
    setStartedAt: null,
  };
}

function defaultPlan(at: number): Plan {
  return {
    blocks: [{ ...DEFAULT_PLAN_BLOCK }],
    createdBy: "user",
    userNote: "",
    createdAt: new Date(at).toISOString(),
  };
}

function currentBlock(s: SessionState) {
  return s.plan!.blocks[s.blockIndex];
}

/** Enter the countdown for the set identified by blockIndex/setIndex. */
function enterCountdown(s: SessionState, at: number): SessionState {
  const block = currentBlock(s);
  return {
    ...s,
    phase: "countdown",
    overlayReturn: null,
    activeExercise: block.exercise,
    targetReps: block.reps,
    reps: 0,
    flagCounts: {},
    lastRep: null,
    tempoDownSumMs: 0,
    tempoUpSumMs: 0,
    restRemainingSec: null,
    sessionStartedAt: s.sessionStartedAt ?? at,
  };
}

function finishSet(s: SessionState, at: number): SessionState {
  const block = currentBlock(s);
  const record: SetRecord = {
    exercise: s.activeExercise ?? block.exercise,
    setIndex: s.setIndex,
    reps: s.reps,
    target: s.targetReps ?? block.reps,
    flagCounts: s.flagCounts,
    avgTempoMs:
      s.reps > 0
        ? {
            down: Math.round(s.tempoDownSumMs / s.reps),
            up: Math.round(s.tempoUpSumMs / s.reps),
          }
        : null,
    startedAt: new Date(s.setStartedAt ?? at).toISOString(),
    endedAt: new Date(at).toISOString(),
  };
  const records = [...s.records, record];

  const hasNextSet = s.setIndex < block.sets;
  const hasNextBlock = s.blockIndex + 1 < s.plan!.blocks.length;
  if (!hasNextSet && !hasNextBlock) {
    const done: SessionState = { ...s, records, phase: "done", overlayReturn: null, proposal: null };
    return { ...done, summary: computeSummary(done, at) };
  }
  return {
    ...s,
    records,
    phase: "rest",
    overlayReturn: null,
    blockIndex: hasNextSet ? s.blockIndex : s.blockIndex + 1,
    setIndex: hasNextSet ? s.setIndex + 1 : 1,
    restRemainingSec: block.restSec,
  };
}

function applyProposal(s: SessionState): SessionState {
  const p = s.proposal!;
  const plan = s.plan!;
  const blocks = plan.blocks.map((b) => ({ ...b }));
  const block = blocks[s.blockIndex];
  let restRemainingSec = s.restRemainingSec;
  switch (p.action) {
    case "swap_exercise":
      block.exercise = p.exercise!; // takes effect from the next set
      break;
    case "reduce_reps":
      block.reps = Math.max(1, p.reps!);
      break;
    case "add_set":
      block.sets += 1;
      break;
    case "extend_rest":
      if (s.overlayReturn === "rest" && restRemainingSec !== null) {
        restRemainingSec = restRemainingSec + p.seconds!;
      } else {
        block.restSec += p.seconds!;
      }
      break;
  }
  return { ...s, plan: { ...plan, blocks }, restRemainingSec };
}

export function reduce(s: SessionState, ev: SessionEvent): SessionState {
  switch (ev.type) {
    case "CREATE_PLAN": {
      if (s.phase !== "idle" && s.phase !== "done") return s;
      // A new plan starts a fresh session.
      return { ...initialState(ev.plan) };
    }

    case "START_SET": {
      if (s.phase !== "idle" && s.phase !== "rest") return s;
      let next = s;
      if (!next.plan) next = { ...next, plan: defaultPlan(ev.at) };
      if (ev.blockIndex !== undefined) {
        if (!next.plan!.blocks[ev.blockIndex]) return s; // invalid index: ignore
        next = { ...next, blockIndex: ev.blockIndex, setIndex: 1 };
      }
      return enterCountdown(next, ev.at);
    }

    case "COUNTDOWN_DONE": {
      if (s.phase !== "countdown") return s;
      return { ...s, phase: "set", setStartedAt: ev.at };
    }

    case "REP": {
      if (s.phase !== "set") return s;
      const flagCounts = { ...s.flagCounts };
      for (const flag of ev.rep.flags) flagCounts[flag] = (flagCounts[flag] ?? 0) + 1;
      const next: SessionState = {
        ...s,
        reps: s.reps + 1,
        flagCounts,
        lastRep: ev.rep,
        tempoDownSumMs: s.tempoDownSumMs + ev.rep.tempoDownMs,
        tempoUpSumMs: s.tempoUpSumMs + ev.rep.tempoUpMs,
      };
      if (next.targetReps !== null && next.reps >= next.targetReps) {
        return finishSet(next, ev.at);
      }
      return next;
    }

    case "REST_TICK": {
      if (s.phase !== "rest" || s.restRemainingSec === null) return s;
      const remaining = s.restRemainingSec - 1;
      if (remaining > 0) return { ...s, restRemainingSec: remaining };
      return enterCountdown(s, ev.at); // rest over: next set starts automatically
    }

    case "SKIP_REST": {
      if (s.phase !== "rest") return s;
      return enterCountdown(s, ev.at);
    }

    case "SET_REST": {
      if (s.phase !== "rest" && s.phase !== "set") return s;
      const blocks = s.plan!.blocks.map((b) => ({ ...b }));
      blocks[s.blockIndex].restSec = ev.seconds;
      const next = { ...s, plan: { ...s.plan!, blocks } };
      if (s.phase === "rest") next.restRemainingSec = ev.seconds;
      return next;
    }

    case "PROPOSE": {
      if (s.phase !== "set" && s.phase !== "rest") return s;
      return {
        ...s,
        phase: "awaiting_confirmation",
        overlayReturn: s.phase,
        proposal: ev.proposal,
      };
    }

    case "RESOLVE_PROPOSAL": {
      if (s.phase !== "awaiting_confirmation") return s;
      let next = s;
      if (ev.outcome === "applied") next = applyProposal(s);
      return {
        ...next,
        phase: next.overlayReturn ?? "set",
        overlayReturn: null,
        proposal: null,
      };
    }

    case "END_SESSION": {
      if (s.phase === "idle" || s.phase === "done") return s;
      // A set in flight still counts toward the summary via computeSummary.
      const done: SessionState = {
        ...s,
        phase: "done",
        overlayReturn: s.overlayReturn ?? (s.phase === "set" ? "set" : null),
        proposal: null,
        restRemainingSec: null,
      };
      const summary = computeSummary(done, ev.at);
      return { ...done, overlayReturn: null, summary };
    }

    default:
      return s;
  }
}

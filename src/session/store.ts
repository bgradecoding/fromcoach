// Session store: wraps the pure machine with timers, engine control,
// proposal promises, TTS, and localStorage. React reads it through
// useSyncExternalStore; WebMCP tools call its actions.
import { useSyncExternalStore } from "react";
import * as engine from "../pose/engine";
import type { LiveMetrics } from "../pose/types";
import { initialState, reduce } from "./machine";
import {
  COUNTDOWN_SEC,
  type Plan,
  type Proposal,
  type ProposalOutcome,
  type SessionEvent,
  type SessionState,
  type SetRecord,
  type Summary,
} from "./types";

const PLAN_KEY = "formcoach.plan.v1";

function loadPlan(): Plan | null {
  try {
    const raw = localStorage.getItem(PLAN_KEY);
    return raw ? (JSON.parse(raw) as Plan) : null;
  } catch {
    return null;
  }
}

function persistPlan(plan: Plan) {
  try {
    localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
  } catch {
    /* private mode etc. — plan just won't survive a reload */
  }
}

export function speak(text: string) {
  try {
    const synth = (globalThis as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
    if (!synth) return;
    synth.cancel();
    synth.speak(new SpeechSynthesisUtterance(text));
  } catch {
    /* TTS is best-effort */
  }
}

let state: SessionState = initialState(loadPlan());
let confirmTimeoutMs = 20_000;
const listeners = new Set<() => void>();

let countdownTimer: ReturnType<typeof setTimeout> | null = null;
let restTimer: ReturnType<typeof setInterval> | null = null;
let confirmTimer: ReturnType<typeof setTimeout> | null = null;

interface ProposalResult {
  status: ProposalOutcome | "error";
  proposalId?: string;
  plan?: Plan;
  reason?: string;
}
let pendingProposal: { proposalId: string; resolve: (r: ProposalResult) => void } | null = null;

function clearTimers() {
  if (countdownTimer) clearTimeout(countdownTimer);
  if (restTimer) clearInterval(restTimer);
  if (confirmTimer) clearTimeout(confirmTimer);
  countdownTimer = restTimer = confirmTimer = null;
}

function describeProposal(p: Proposal): string {
  switch (p.action) {
    case "swap_exercise":
      return `switch to ${String(p.exercise).replace(/_/g, " ")} from the next set`;
    case "reduce_reps":
      return `reduce the target to ${p.reps} reps`;
    case "add_set":
      return "add one more set";
    case "extend_rest":
      return `extend the rest by ${p.seconds} seconds`;
  }
}

function onPhaseEntered(prev: SessionState) {
  clearTimers();
  switch (state.phase) {
    case "countdown":
      engine.configureExercise(state.activeExercise);
      engine.setRepCounting(false);
      engine.setGestureMode("off");
      countdownTimer = setTimeout(
        () => dispatch({ type: "COUNTDOWN_DONE", at: Date.now() }),
        COUNTDOWN_SEC * 1000,
      );
      break;
    case "set":
      engine.setRepCounting(true);
      engine.setGestureMode("off");
      break;
    case "rest":
      engine.setRepCounting(false);
      engine.setGestureMode("rest");
      restTimer = setInterval(() => dispatch({ type: "REST_TICK", at: Date.now() }), 1000);
      if (prev.phase === "set" || prev.overlayReturn === "set") {
        speak(`Set complete. Rest for ${state.restRemainingSec} seconds.`);
      }
      break;
    case "awaiting_confirmation":
      engine.setRepCounting(false);
      engine.setGestureMode("confirm");
      confirmTimer = setTimeout(() => resolveProposal("timeout"), confirmTimeoutMs);
      if (state.proposal) {
        speak(
          `The agent suggests: ${describeProposal(state.proposal)}. Raise both hands to accept, cross your arms to decline.`,
        );
      }
      break;
    case "done":
      engine.setRepCounting(false);
      engine.setGestureMode("off");
      if (prev.phase !== "idle") speak("Session complete. Nice work.");
      break;
    case "idle":
      engine.setRepCounting(false);
      engine.setGestureMode("off");
      break;
  }
}

function dispatch(ev: SessionEvent) {
  const prev = state;
  state = reduce(state, ev);
  if (state === prev) return;
  if (state.phase !== prev.phase) onPhaseEntered(prev);
  if (state.plan && state.plan !== prev.plan) persistPlan(state.plan);
  for (const fn of listeners) fn();
}

function resolveProposal(outcome: ProposalOutcome) {
  if (!pendingProposal) return;
  const { proposalId, resolve } = pendingProposal;
  pendingProposal = null;
  if (confirmTimer) clearTimeout(confirmTimer);
  dispatch({ type: "RESOLVE_PROPOSAL", outcome, at: Date.now() });
  resolve({
    status: outcome,
    proposalId,
    ...(outcome === "applied" ? { plan: state.plan ?? undefined } : {}),
  });
}

// ---------- engine wiring ----------

engine.onRep((rep) => {
  if (state.phase === "set") dispatch({ type: "REP", rep, at: Date.now() });
});

engine.onGesture((g) => {
  if (state.phase === "awaiting_confirmation") {
    if (g.type === "hands_up") resolveProposal("applied");
    else if (g.type === "arms_crossed") resolveProposal("rejected");
  } else if (state.phase === "rest" && g.type === "one_hand_up") {
    dispatch({ type: "SKIP_REST", at: Date.now() });
  }
});

// ---------- public API ----------

export const store = {
  get: () => state,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  createPlan(fields: Omit<Plan, "createdAt">) {
    const plan: Plan = { ...fields, createdAt: new Date().toISOString() };
    dispatch({ type: "CREATE_PLAN", plan });
    return plan;
  },

  startSet(blockIndex?: number) {
    const before = state;
    dispatch({ type: "START_SET", blockIndex, at: Date.now() });
    if (state.phase !== "countdown" || before.phase === "countdown") {
      return {
        status: "error" as const,
        reason: `cannot start a set in phase ${before.phase}` +
          (blockIndex !== undefined ? ` (or block ${blockIndex} does not exist)` : ""),
      };
    }
    return {
      status: "started" as const,
      exercise: state.activeExercise!,
      setIndex: state.setIndex,
      targetReps: state.targetReps!,
      countdownSec: COUNTDOWN_SEC,
    };
  },

  setRest(seconds: number) {
    const before = state;
    dispatch({ type: "SET_REST", seconds });
    if (state === before) {
      return { status: "error" as const, reason: `setRest is not available in phase ${before.phase}` };
    }
    return { status: "applied" as const, restSec: seconds };
  },

  skipRest() {
    dispatch({ type: "SKIP_REST", at: Date.now() });
  },

  propose(proposal: Proposal): Promise<ProposalResult> {
    if (state.phase !== "set" && state.phase !== "rest") {
      return Promise.resolve({
        status: "error",
        reason: `adjustProgram is only available during a set or rest (current phase: ${state.phase})`,
      });
    }
    if (pendingProposal) {
      return Promise.resolve({ status: "error", reason: "another proposal is already pending" });
    }
    return new Promise<ProposalResult>((resolve) => {
      pendingProposal = { proposalId: proposal.proposalId, resolve };
      dispatch({ type: "PROPOSE", proposal });
    });
  },

  /** Accept/decline from UI buttons or gestures. */
  resolveProposal(outcome: Exclude<ProposalOutcome, "timeout">) {
    resolveProposal(outcome);
  },

  endSession(): Summary | { status: "error"; reason: string } {
    dispatch({ type: "END_SESSION", at: Date.now() });
    if (state.phase !== "done" || !state.summary) {
      return { status: "error", reason: "no session in progress" };
    }
    return state.summary;
  },

  getSetHistory(): SetRecord[] {
    return state.records;
  },

  getLiveMetrics(): LiveMetrics {
    const snap = engine.getEngineSnapshot();
    const active = state.phase !== "idle" && state.phase !== "done";
    return {
      phase: state.phase,
      cameraOk: snap.cameraOk,
      personDetected: snap.personDetected,
      view: snap.view,
      exercise: state.activeExercise,
      setIndex: active ? state.setIndex : null,
      reps: state.reps,
      targetReps: state.targetReps,
      currentAngle: snap.currentAngle !== null ? Math.round(snap.currentAngle) : null,
      lastRep: state.lastRep,
      flagCounts: state.flagCounts,
      restRemainingSec: state.restRemainingSec,
      updatedAt: new Date().toISOString(),
    };
  },

  setConfirmTimeoutMs(ms: number) {
    confirmTimeoutMs = ms;
  },
};

export function useSessionState(): SessionState {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

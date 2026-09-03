import type { Phase, RepRecord } from "../pose/types";

export interface Block {
  exercise: string;
  sets: number;
  reps: number;
  restSec: number;
}

export interface Plan {
  blocks: Block[];
  createdBy: "user" | "agent";
  userNote: string;
  createdAt: string; // ISO
}

export interface SetRecord {
  exercise: string;
  setIndex: number; // 1-based within its block
  reps: number;
  target: number;
  flagCounts: Record<string, number>;
  avgTempoMs: { down: number; up: number } | null;
  startedAt: string;
  endedAt: string;
}

export type ProposalAction = "swap_exercise" | "reduce_reps" | "add_set" | "extend_rest";

export interface Proposal {
  proposalId: string;
  action: ProposalAction;
  exercise?: string;
  reps?: number;
  seconds?: number;
  reason: string;
}

export type ProposalOutcome = "applied" | "rejected" | "timeout";

export interface Summary {
  totalReps: number;
  sets: number;
  setRecords: SetRecord[];
  flagCounts: Record<string, number>;
  durationSec: number;
  recommendations: string[];
}

export interface SessionState {
  phase: Phase;
  /** Phase to return to when an awaiting_confirmation overlay resolves. */
  overlayReturn: "set" | "rest" | null;
  plan: Plan | null;
  blockIndex: number;
  setIndex: number; // 1-based; the set currently running or up next
  activeExercise: string | null;
  targetReps: number | null;
  reps: number;
  flagCounts: Record<string, number>;
  lastRep: RepRecord | null;
  tempoDownSumMs: number;
  tempoUpSumMs: number;
  restRemainingSec: number | null;
  proposal: Proposal | null;
  records: SetRecord[];
  summary: Summary | null;
  sessionStartedAt: number | null; // ms epoch of first countdown
  setStartedAt: number | null;
}

export type SessionEvent =
  | { type: "CREATE_PLAN"; plan: Plan }
  | { type: "START_SET"; blockIndex?: number; at: number }
  | { type: "COUNTDOWN_DONE"; at: number }
  | { type: "REP"; rep: RepRecord; at: number }
  | { type: "REST_TICK"; at: number }
  | { type: "SKIP_REST"; at: number }
  | { type: "SET_REST"; seconds: number }
  | { type: "PROPOSE"; proposal: Proposal }
  | { type: "RESOLVE_PROPOSAL"; outcome: ProposalOutcome; at: number }
  | { type: "END_SESSION"; at: number };

export const DEFAULT_PLAN_BLOCK: Block = {
  exercise: "squat",
  sets: 3,
  reps: 12,
  restSec: 90,
};

export const COUNTDOWN_SEC = 3;

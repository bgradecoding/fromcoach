// The imperative WebMCP tools. Descriptions tell the agent when to
// call each tool, not just what it does. Executes never throw: they return
// { status: "error", reason } instead.
import { EXERCISE_NAMES } from "../pose/engine";
import { store } from "../session/store";
import type { Proposal, ProposalAction } from "../session/types";
import type { ToolDef } from "./adapter";

let proposalCounter = 0;
const newProposalId = () => `p_${Date.now().toString(36)}_${++proposalCounter}`;

const err = (reason: string) => ({ status: "error" as const, reason });

function asRecord(input: unknown): Record<string, unknown> {
  return typeof input === "object" && input !== null
    ? (input as Record<string, unknown>)
    : {};
}

function intInRange(v: unknown, min: number, max: number): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null;
}

export const TOOLS: Record<string, ToolDef> = {
  createWorkoutPlan: {
    name: "createWorkoutPlan",
    title: "Create a workout plan",
    description:
      "Creates a workout plan with one exercise, sets, reps, rest seconds, and an optional note about injuries or limits. Available before a session starts or after it ends. Replaces the previous plan and starts a fresh idle session. Call when the user asks you to create their workout plan.",
    inputSchema: {
      type: "object",
      properties: {
        exercise: { type: "string", enum: ["squat", "pushup"], description: "Exercise to train." },
        sets: { type: "integer", minimum: 1, maximum: 10, description: "Number of sets." },
        reps: { type: "integer", minimum: 1, maximum: 50, description: "Target reps per set." },
        restSec: { type: "integer", minimum: 10, maximum: 600, description: "Rest between sets in seconds." },
        userNote: { type: "string", maxLength: 500, description: "Optional injuries, sensitivities, or limits the coach should know." },
      },
      required: ["exercise", "sets", "reps", "restSec"],
    },
    execute: async (input) => {
      const phase = store.get().phase;
      if (phase !== "idle" && phase !== "done") {
        return err(`createWorkoutPlan is only available before or after a session (current phase: ${phase})`);
      }
      const rec = asRecord(input);
      if (rec.exercise !== "squat" && rec.exercise !== "pushup") {
        return err("exercise must be squat or pushup");
      }
      const sets = intInRange(rec.sets, 1, 10);
      if (sets === null) return err("sets must be an integer between 1 and 10");
      const reps = intInRange(rec.reps, 1, 50);
      if (reps === null) return err("reps must be an integer between 1 and 50");
      const restSec = intInRange(rec.restSec, 10, 600);
      if (restSec === null) return err("restSec must be an integer between 10 and 600");
      if (rec.userNote !== undefined && (typeof rec.userNote !== "string" || rec.userNote.length > 500)) {
        return err("userNote must be a string of at most 500 characters");
      }
      const plan = store.createPlan({
        blocks: [{ exercise: rec.exercise, sets, reps, restSec }],
        createdBy: "agent",
        userNote: typeof rec.userNote === "string" ? rec.userNote.trim() : "",
      });
      return { status: "created", plan };
    },
  },

  getWorkoutPlan: {
    name: "getWorkoutPlan",
    title: "Get workout plan",
    description:
      "Returns today's workout plan: blocks of exercise/sets/reps/rest, who created it (user or agent), and the user's note about injuries or limits. Call this before suggesting changes or starting sets. Read-only.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute: async () => {
      const plan = store.get().plan;
      return plan ?? { status: "error", reason: "no plan yet — use createWorkoutPlan or the createPlan form" };
    },
  },

  getLiveMetrics: {
    name: "getLiveMetrics",
    title: "Get live metrics",
    description:
      "Returns the live rep count, joint angle, camera view, form flags, and rest timer measured by the webcam in this tab. During rest, trackingMode is palm: handDetected, palmDetected, palmHoldProgress (0-1), and handTracking report open-palm recognition for skipping rest; body pose is not tracked. Call this whenever the user asks how they are doing, or before deciding to adjust the program. Contains numbers and status fields only — no images. Read-only, safe to poll.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute: async () => store.getLiveMetrics(),
  },

  getSetHistory: {
    name: "getSetHistory",
    title: "Get set history",
    description:
      "Returns the completed sets of this session: exercise, reps vs target, form-flag counts, and average tempo per set. Call this to review progress or summarize mid-session. Read-only.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute: async () => store.getSetHistory(),
  },

  startSet: {
    name: "startSet",
    title: "Start a set",
    description:
      "Starts the next set (or the set of a specific plan block) after a 3-second on-screen countdown. Available when the session is idle or resting. Call when the user says they are ready.",
    inputSchema: {
      type: "object",
      properties: {
        blockIndex: {
          type: "integer",
          description: "Optional 0-based plan block to jump to. Omit to continue the plan in order.",
        },
      },
    },
    execute: async (input) => {
      const { blockIndex } = asRecord(input);
      if (blockIndex !== undefined) {
        const i = intInRange(blockIndex, 0, 99);
        if (i === null) return err("blockIndex must be a non-negative integer");
        return store.startSet(i);
      }
      return store.startSet();
    },
  },

  setRest: {
    name: "setRest",
    title: "Set rest duration",
    description:
      "Sets the rest duration in seconds (10-600). During a rest it resets the running timer; during a set it applies to the upcoming rest. Call when the user asks for shorter or longer breaks.",
    inputSchema: {
      type: "object",
      properties: {
        seconds: { type: "integer", minimum: 10, maximum: 600, description: "Rest duration in seconds." },
      },
      required: ["seconds"],
    },
    execute: async (input) => {
      const seconds = intInRange(asRecord(input).seconds, 10, 600);
      if (seconds === null) return err("seconds must be an integer between 10 and 600");
      return store.setRest(seconds);
    },
  },

  adjustProgram: {
    name: "adjustProgram",
    title: "Propose a program change",
    description:
      "Proposes a program change: swap_exercise or reduce_reps from the next set, add_set, or extend_rest. reduce_reps must lower the current plan block's target; it does not change the set already in progress. The user confirms with a body gesture (raising both hands to accept, crossing arms to decline) or the on-screen buttons. The call resolves after their response, a 20-second timeout, or cancellation when the session ends. If status is 'rejected', 'timeout', or 'cancelled', do not retry the same proposal. Always include a short reason the user will see.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["swap_exercise", "reduce_reps", "add_set", "extend_rest"],
          description: "What to change.",
        },
        exercise: {
          type: "string",
          enum: EXERCISE_NAMES,
          description: "Required for swap_exercise: the exercise to switch to from the next set.",
        },
        reps: { type: "integer", minimum: 1, maximum: 50, description: "Required for reduce_reps: a target below the current plan block's reps, applied from the next set." },
        seconds: { type: "integer", minimum: 1, maximum: 600, description: "Required for extend_rest: seconds to add." },
        reason: { type: "string", description: "Why you are proposing this. Shown to the user on the confirmation card." },
      },
      required: ["action", "reason"],
    },
    execute: async (input) => {
      const rec = asRecord(input);
      const action = rec.action as ProposalAction;
      if (!["swap_exercise", "reduce_reps", "add_set", "extend_rest"].includes(action)) {
        return err("action must be one of swap_exercise | reduce_reps | add_set | extend_rest");
      }
      if (typeof rec.reason !== "string" || rec.reason.trim() === "") {
        return err("reason is required — the user sees it on the confirmation card");
      }
      const proposal: Proposal = {
        proposalId: newProposalId(),
        action,
        reason: rec.reason,
      };
      if (action === "swap_exercise") {
        if (!EXERCISE_NAMES.includes(rec.exercise as string)) {
          return err(`exercise must be one of ${EXERCISE_NAMES.join(" | ")}`);
        }
        proposal.exercise = rec.exercise as string;
      }
      if (action === "reduce_reps") {
        const reps = intInRange(rec.reps, 1, 50);
        if (reps === null) return err("reps (1-50) is required for reduce_reps");
        const state = store.get();
        const block = state.plan?.blocks[state.blockIndex];
        if (!block) return err("no plan block is available to reduce reps");
        if (reps >= block.reps) return err("reps must be lower than the current plan block's target");
        proposal.reps = reps;
      }
      if (action === "extend_rest") {
        const seconds = intInRange(rec.seconds, 1, 600);
        if (seconds === null) return err("seconds (1-600) is required for extend_rest");
        proposal.seconds = seconds;
      }
      return store.propose(proposal);
    },
  },

  endSession: {
    name: "endSession",
    title: "End the session",
    description:
      "Ends the workout session from any active phase and returns the summary: total reps, sets, form-flag counts, duration, and recommendations. Call when the user asks to stop or wrap up.",
    inputSchema: { type: "object", properties: {} },
    execute: async () => store.endSession(),
  },
};

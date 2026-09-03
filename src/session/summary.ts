import type { SessionState, Summary } from "./types";

function mergeFlagCounts(state: SessionState): Record<string, number> {
  const total: Record<string, number> = {};
  for (const record of state.records) {
    for (const [flag, n] of Object.entries(record.flagCounts)) {
      total[flag] = (total[flag] ?? 0) + n;
    }
  }
  // include flags from a set that was cut short by endSession
  for (const [flag, n] of Object.entries(state.flagCounts)) {
    if (state.phase === "set" || state.overlayReturn === "set") {
      total[flag] = (total[flag] ?? 0) + n;
    }
  }
  return total;
}

export function computeSummary(state: SessionState, at: number): Summary {
  const flagCounts = mergeFlagCounts(state);
  const totalReps =
    state.records.reduce((sum, r) => sum + r.reps, 0) +
    (state.phase === "set" || state.overlayReturn === "set" ? state.reps : 0);
  const durationSec = state.sessionStartedAt
    ? Math.max(0, Math.round((at - state.sessionStartedAt) / 1000))
    : 0;

  const recommendations: string[] = [];
  const valgus = flagCounts.knee_valgus ?? 0;
  const lean = flagCounts.torso_lean ?? 0;
  const sag = flagCounts.hip_sag ?? 0;
  const shallow = flagCounts.shallow ?? 0;
  if (valgus >= 3) {
    recommendations.push(
      "Knees caved inward on several reps. Try a wider stance, push the knees out, or switch to goblet squats.",
    );
  } else if (valgus > 0) {
    recommendations.push("Watch the knees: keep them tracking over the toes.");
  }
  if (lean > 0) {
    recommendations.push(
      "Torso leaned forward past 45°. Keep the chest up; box squats can help groove the pattern.",
    );
  }
  if (sag > 0) {
    recommendations.push(
      "Hips sagged during pushups. Brace the core; drop to knee pushups if needed.",
    );
  }
  if (shallow > 0) {
    recommendations.push("Some reps were shallow. Slow down and hit full depth.");
  }
  if (recommendations.length === 0 && totalReps > 0) {
    recommendations.push("Clean session — no form flags. Consider adding reps or a set next time.");
  }
  if (totalReps === 0) {
    recommendations.push("No reps recorded this session.");
  }

  return {
    totalReps,
    sets: state.records.length,
    setRecords: state.records,
    flagCounts,
    durationSec,
    recommendations,
  };
}

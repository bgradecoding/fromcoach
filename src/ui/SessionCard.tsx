import { store, useSessionState } from "../session/store";
import type { Phase } from "../pose/types";

const PHASE_LABEL: Record<Phase, string> = {
  idle: "Idle",
  countdown: "Get ready",
  set: "Set in progress",
  rest: "Resting",
  awaiting_confirmation: "Awaiting your gesture",
  done: "Done",
};

const prettyExercise = (name: string | null) =>
  name ? name.replace(/_/g, " ") : "—";

export default function SessionCard() {
  const s = useSessionState();
  const block = s.plan?.blocks[s.blockIndex] ?? null;
  const active = s.phase !== "idle" && s.phase !== "done";
  const flags = Object.entries(s.flagCounts);

  return (
    <section className="card session-card">
      <header className="card-header">
        <h2>Session</h2>
        <span className={`phase-badge phase-${s.phase}`}>{PHASE_LABEL[s.phase]}</span>
      </header>

      {s.phase === "done" && s.summary ? (
        <SummaryView />
      ) : (
        <>
          <div className="session-main">
            <div className="session-exercise">
              <span className="session-exercise-name">{prettyExercise(s.activeExercise ?? block?.exercise ?? null)}</span>
              {active && block && (
                <span className="session-set-count">
                  Set {s.setIndex} / {block.sets}
                </span>
              )}
            </div>
            {s.phase === "rest" ? (
              <div className="rep-display rest-display">
                <span className="rep-big">{s.restRemainingSec ?? 0}</span>
                <span className="rep-target">s rest</span>
              </div>
            ) : (
              <div className="rep-display">
                <span className="rep-big">{s.reps}</span>
                <span className="rep-target">/ {s.targetReps ?? "—"}</span>
              </div>
            )}
          </div>

          {flags.length > 0 && (
            <div className="flag-chips">
              {flags.map(([flag, n]) => (
                <span key={flag} className="flag-chip">
                  {flag.replace(/_/g, " ")} ×{n}
                </span>
              ))}
            </div>
          )}

          <div className="session-actions">
            {(s.phase === "idle" || s.phase === "rest") && (
              <button className="primary" onClick={() => store.startSet()}>
                Start set
              </button>
            )}
            {s.phase === "rest" && (
              <button onClick={() => store.skipRest()}>Skip rest ✋</button>
            )}
            {active && (
              <button className="ghost" onClick={() => store.endSession()}>
                End session
              </button>
            )}
          </div>
          {s.phase === "rest" && (
            <p className="hint-line">Raise one hand to skip the rest.</p>
          )}
        </>
      )}
    </section>
  );
}

function SummaryView() {
  const s = useSessionState();
  const summary = s.summary!;
  return (
    <div className="summary-view">
      <div className="summary-stats">
        <div className="stat">
          <span className="stat-value">{summary.totalReps}</span>
          <span className="stat-label">reps</span>
        </div>
        <div className="stat">
          <span className="stat-value">{summary.sets}</span>
          <span className="stat-label">sets</span>
        </div>
        <div className="stat">
          <span className="stat-value">
            {Math.floor(summary.durationSec / 60)}:{String(summary.durationSec % 60).padStart(2, "0")}
          </span>
          <span className="stat-label">duration</span>
        </div>
        <div className="stat">
          <span className="stat-value">
            {Object.values(summary.flagCounts).reduce((a, b) => a + b, 0)}
          </span>
          <span className="stat-label">form flags</span>
        </div>
      </div>
      <ul className="recommendations">
        {summary.recommendations.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </div>
  );
}

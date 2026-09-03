import { useSessionState } from "../session/store";
import PlanForm from "./PlanForm";

const prettyExercise = (name: string) => name.replace(/_/g, " ");

export default function PlanCard() {
  const s = useSessionState();
  const showForm = s.phase === "idle" || s.phase === "done";

  return (
    <section className="card plan-card">
      <header className="card-header">
        <h2>Plan</h2>
        {s.plan?.createdBy === "agent" && (
          <span className="agent-badge">Created by agent</span>
        )}
      </header>

      {s.plan ? (
        <ul className="plan-blocks">
          {s.plan.blocks.map((b, i) => (
            <li
              key={i}
              className={`plan-block${i === s.blockIndex && s.phase !== "idle" && s.phase !== "done" ? " current" : ""}`}
            >
              <span className="plan-block-exercise">{prettyExercise(b.exercise)}</span>
              <span className="plan-block-scheme">
                {b.sets} × {b.reps} · rest {b.restSec}s
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint-line">No plan yet — fill the form below, or ask your agent.</p>
      )}
      {s.plan?.userNote && <p className="plan-note">“{s.plan.userNote}”</p>}

      {showForm && <PlanForm />}
    </section>
  );
}

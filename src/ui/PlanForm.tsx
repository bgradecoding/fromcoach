import { useState } from "react";
import { store } from "../session/store";

// Declarative WebMCP tool: the form element itself is the tool. Browsers
// expose it as "createPlan"; the submit handler reads SubmitEvent.agentInvoked
// to attribute the plan to the agent or the human.
export default function PlanForm() {
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const exercise = String(fd.get("exercise") ?? "squat");
    const sets = Number(fd.get("sets"));
    const reps = Number(fd.get("reps"));
    const restSec = Number(fd.get("restSec"));
    const userNote = String(fd.get("userNote") ?? "").trim();

    if (!["squat", "pushup"].includes(exercise)) return setError("Pick squat or pushup.");
    if (!Number.isInteger(sets) || sets < 1 || sets > 10) return setError("Sets must be 1-10.");
    if (!Number.isInteger(reps) || reps < 1 || reps > 50) return setError("Reps must be 1-50.");
    if (!Number.isInteger(restSec) || restSec < 10 || restSec > 600) {
      return setError("Rest must be 10-600 seconds.");
    }
    setError(null);

    const agentInvoked = Boolean(
      (e.nativeEvent as SubmitEvent | undefined)?.agentInvoked,
    );
    store.createPlan({
      blocks: [{ exercise, sets, reps, restSec }],
      createdBy: agentInvoked ? "agent" : "user",
      userNote,
    });
  };

  return (
    <form
      toolname="createPlan"
      tooldescription="Create today's workout plan: exercise, sets, reps, rest seconds, and a note about injuries or limits."
      className="plan-form"
      onSubmit={onSubmit}
    >
      <div className="plan-form-grid">
        <label>
          Exercise
          <select
            name="exercise"
            defaultValue="squat"
            toolparamdescription="Which exercise to train today."
          >
            <option value="squat">Squat</option>
            <option value="pushup">Pushup</option>
          </select>
        </label>
        <label>
          Sets
          <input
            name="sets"
            type="number"
            min={1}
            max={10}
            defaultValue={3}
            toolparamdescription="Number of sets (1-10)."
          />
        </label>
        <label>
          Reps
          <input
            name="reps"
            type="number"
            min={1}
            max={50}
            defaultValue={12}
            toolparamdescription="Target reps per set (1-50)."
          />
        </label>
        <label>
          Rest (s)
          <input
            name="restSec"
            type="number"
            min={10}
            max={600}
            defaultValue={90}
            toolparamdescription="Rest between sets in seconds (10-600)."
          />
        </label>
      </div>
      <label className="plan-form-note">
        Note
        <input
          name="userNote"
          placeholder="e.g. left knee is sensitive"
          toolparamdescription="Anything the coach should know: injuries, sensitivities, limits."
        />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="primary">
        Create plan
      </button>
    </form>
  );
}

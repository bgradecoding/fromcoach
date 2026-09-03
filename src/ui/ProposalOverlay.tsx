import { store, useSessionState } from "../session/store";
import type { Proposal } from "../session/types";

function describe(p: Proposal): string {
  switch (p.action) {
    case "swap_exercise":
      return `Switch to ${String(p.exercise).replace(/_/g, " ")} from the next set`;
    case "reduce_reps":
      return `Reduce the target to ${p.reps} reps`;
    case "add_set":
      return "Add one more set";
    case "extend_rest":
      return `Extend the rest by ${p.seconds} seconds`;
  }
}

export default function ProposalOverlay() {
  const s = useSessionState();
  if (s.phase !== "awaiting_confirmation" || !s.proposal) return null;
  const p = s.proposal;

  return (
    <div className="proposal-backdrop">
      <div className="proposal-card" key={p.proposalId}>
        <span className="proposal-kicker">Agent suggests</span>
        <h3 className="proposal-title">{describe(p)}</h3>
        <p className="proposal-reason">“{p.reason}”</p>
        <div className="proposal-gestures">
          <span>🙌 Raise both hands to accept</span>
          <span>🙅 Cross your arms to decline</span>
        </div>
        <div
          className="proposal-progress"
          style={{ animationDuration: `${store.getConfirmTimeoutMs()}ms` }}
        />
        <div className="proposal-buttons">
          <button className="primary" onClick={() => store.resolveProposal("applied")}>
            Accept
          </button>
          <button onClick={() => store.resolveProposal("rejected")}>Decline</button>
        </div>
      </div>
    </div>
  );
}

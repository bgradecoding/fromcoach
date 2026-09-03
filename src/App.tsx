import { useEffect } from "react";
import { replaySource } from "./pose/engine";
import { DEBUG, REPLAY_PARAM, REPLAY_SPEED, USE_CAMERA } from "./params";
import AgentLog from "./ui/AgentLog";
import CameraView from "./ui/CameraView";
import DebugPanel from "./ui/DebugPanel";
import PlanCard from "./ui/PlanCard";
import ProposalOverlay from "./ui/ProposalOverlay";
import SessionCard from "./ui/SessionCard";

export default function App() {
  useEffect(() => {
    if (REPLAY_PARAM && REPLAY_PARAM !== "none") {
      void replaySource.play(REPLAY_PARAM, REPLAY_SPEED);
    }
  }, []);

  return (
    <div className="app-shell">
      <header className="topbar">
        <span className="brand">FormCoach</span>
        <span className="tagline">Your agent coaches from numbers — the camera never leaves this tab.</span>
      </header>
      <main className="layout">
        <section className="stage-col">
          <CameraView useCamera={USE_CAMERA} />
          {DEBUG && <DebugPanel />}
        </section>
        <aside className="side-col">
          <SessionCard />
          <PlanCard />
          <AgentLog />
        </aside>
      </main>
      <ProposalOverlay />
    </div>
  );
}

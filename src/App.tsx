import { useEffect } from "react";
import CameraView from "./ui/CameraView";
import { replaySource } from "./pose/engine";
import { REPLAY_PARAM, REPLAY_SPEED, USE_CAMERA } from "./params";

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
        <span className="tagline">Your agent coaches. Your camera stays in the tab.</span>
      </header>
      <main className="layout">
        <section className="stage-col">
          <CameraView useCamera={USE_CAMERA} />
        </section>
        <aside className="side-col">
          {/* SessionCard / PlanCard / AgentLog land in the UI task */}
        </aside>
      </main>
    </div>
  );
}

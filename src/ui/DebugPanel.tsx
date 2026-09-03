import { useEffect, useState } from "react";
import { getEngineSnapshot, replaySource } from "../pose/engine";
import { fixtureNames } from "../pose/sources/replay";
import { store } from "../session/store";
import { callTool, listToolDefs, onRegistryChange, type ToolDef } from "../webmcp/adapter";

export default function DebugPanel() {
  const [tools, setTools] = useState<ToolDef[]>(listToolDefs());
  const [selectedTool, setSelectedTool] = useState("getLiveMetrics");
  const [inputJson, setInputJson] = useState("{}");
  const [result, setResult] = useState<string>("");
  const [fixture, setFixture] = useState("squat_10reps_side");
  const [speed, setSpeed] = useState(4);
  const [timeoutMs, setTimeoutMs] = useState(store.getConfirmTimeoutMs());
  const [snap, setSnap] = useState(getEngineSnapshot());

  useEffect(() => onRegistryChange(() => setTools(listToolDefs())), []);
  useEffect(() => {
    const timer = setInterval(() => setSnap(getEngineSnapshot()), 250);
    return () => clearInterval(timer);
  }, []);

  const runTool = async () => {
    let input: unknown;
    try {
      input = inputJson.trim() ? JSON.parse(inputJson) : {};
    } catch (e) {
      setResult(`input is not valid JSON: ${String(e)}`);
      return;
    }
    setResult("…");
    const out = await callTool(selectedTool, input, "debug-bridge");
    setResult(JSON.stringify(out, null, 2));
  };

  return (
    <section className="card debug-panel">
      <header className="card-header">
        <h2>Debug</h2>
        <span className="debug-live">
          angle {snap.currentAngle !== null ? `${Math.round(snap.currentAngle)}°` : "—"} · view{" "}
          {snap.view} · person {snap.personDetected ? "yes" : "no"} · phase {store.get().phase}
        </span>
      </header>

      <div className="debug-grid">
        <div className="debug-col">
          <h3>Registered tools</h3>
          <ul className="debug-tools">
            {tools.map((t) => (
              <li key={t.name} title={t.description}>
                <code>{t.name}</code>
                {t.annotations?.readOnlyHint && <span className="readonly-tag">read-only</span>}
              </li>
            ))}
          </ul>
        </div>

        <div className="debug-col">
          <h3>Call a tool</h3>
          <div className="debug-row">
            <select value={selectedTool} onChange={(e) => setSelectedTool(e.target.value)}>
              {tools.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
            <button className="primary" onClick={() => void runTool()}>
              Call
            </button>
          </div>
          <textarea
            rows={3}
            value={inputJson}
            onChange={(e) => setInputJson(e.target.value)}
            spellCheck={false}
          />
          {result && <pre className="debug-result">{result}</pre>}
        </div>

        <div className="debug-col">
          <h3>Replay fixture</h3>
          <div className="debug-row">
            <select value={fixture} onChange={(e) => setFixture(e.target.value)}>
              {fixtureNames().map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              max={16}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value) || 1)}
              title="speed"
              style={{ width: 56 }}
            />
            <button onClick={() => void replaySource.play(fixture, speed)}>Play</button>
            <button onClick={() => replaySource.cancel()}>Stop</button>
          </div>
          <h3>Confirm timeout</h3>
          <div className="debug-row">
            <input
              type="number"
              min={1000}
              step={1000}
              value={timeoutMs}
              onChange={(e) => setTimeoutMs(Number(e.target.value) || 20000)}
            />
            <button
              onClick={() => {
                store.setConfirmTimeoutMs(timeoutMs);
              }}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

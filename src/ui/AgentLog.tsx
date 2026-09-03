import { useAgentLog, type LogEntry } from "../webmcp/log";

function timeOf(iso: string): string {
  return iso.slice(11, 19);
}

function StatusPill({ entry }: { entry: LogEntry }) {
  return <span className={`log-status log-status-${entry.status}`}>{entry.status}</span>;
}

export default function AgentLog() {
  const entries = useAgentLog();

  return (
    <section className="card agent-log">
      <header className="card-header">
        <h2>Agent log</h2>
        <span className="log-count">{entries.length}</span>
      </header>
      {entries.length === 0 ? (
        <p className="hint-line">Tool calls will show up here.</p>
      ) : (
        <ul className="log-entries">
          {entries.map((e) => (
            <li key={e.id} className="log-entry">
              <span className="log-time">{timeOf(e.at)}</span>
              <span className="log-tool">{e.tool}</span>
              {e.input && <span className="log-input">{e.input}</span>}
              <span className="log-right">
                {e.durationMs !== undefined && (
                  <span className="log-duration">{e.durationMs} ms</span>
                )}
                {e.source !== "system" && (
                  <span className={`log-source log-source-${e.source}`}>
                    {e.source === "browser-api" ? "agent" : "bridge"}
                  </span>
                )}
                <StatusPill entry={e} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

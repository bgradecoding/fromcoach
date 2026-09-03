// Agent log: every tool call (and the WebMCP detection result) is recorded
// here and rendered by AgentLog.tsx. Newest first, capped at 50 entries.
import { useSyncExternalStore } from "react";

export type LogStatus =
  | "ok"
  | "error"
  | "pending"
  | "created"
  | "started"
  | "applied"
  | "rejected"
  | "cancelled"
  | "timeout";

export type LogSource = "browser-api" | "debug-bridge" | "system" | "ui";

export interface LogEntry {
  id: number;
  at: string; // ISO
  tool: string;
  input: string; // summarized, <= 80 chars
  status: LogStatus;
  durationMs?: number;
  source: LogSource;
}

const MAX_ENTRIES = 50;
let entries: LogEntry[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) fn();
}

export function summarizeInput(input: unknown): string {
  if (input === undefined || input === null) return "";
  let text: string;
  try {
    text = typeof input === "string" ? input : JSON.stringify(input);
  } catch {
    text = String(input);
  }
  if (text === "{}") return "";
  return text.length > 80 ? `${text.slice(0, 77)}…` : text;
}

export const agentLog = {
  add(entry: { tool: string; input?: unknown; status: LogStatus; source: LogSource }): number {
    const id = nextId++;
    entries = [
      {
        id,
        at: new Date().toISOString(),
        tool: entry.tool,
        input: summarizeInput(entry.input),
        status: entry.status,
        source: entry.source,
      },
      ...entries,
    ].slice(0, MAX_ENTRIES);
    notify();
    return id;
  },

  update(id: number, patch: Partial<Pick<LogEntry, "status" | "durationMs">>) {
    entries = entries.map((e) => (e.id === id ? { ...e, ...patch } : e));
    notify();
  },

  list(): LogEntry[] {
    return entries;
  },

  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export function useAgentLog(): LogEntry[] {
  return useSyncExternalStore(agentLog.subscribe, agentLog.list, agentLog.list);
}

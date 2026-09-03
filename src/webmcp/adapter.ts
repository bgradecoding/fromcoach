// The ONLY file that touches the browser WebMCP API surface
// (document.modelContext / navigator.modelContext). Everything else goes
// through the internal registry, which always mirrors what the browser
// sees; the debug bridge calls the same executes, so tests exercise the
// exact code paths a real agent would.
//
// API surface notes: docs/WEBMCP_API_NOTES.md.
import { replaySource } from "../pose/engine";
import { store } from "../session/store";
import { agentLog } from "./log";

export type JSONSchema = Record<string, unknown>;

export interface ToolDef {
  name: string;
  title?: string;
  description: string;
  inputSchema: JSONSchema;
  annotations?: { readOnlyHint?: boolean };
  execute: (input: unknown, client?: unknown) => Promise<unknown>;
}

interface BrowserModelContext {
  registerTool: (def: unknown, opts?: { signal?: AbortSignal }) => unknown;
  unregisterTool?: (name: string) => void;
}

const registry = new Map<string, ToolDef>();
const registryListeners = new Set<() => void>();
let api: BrowserModelContext | null = null;
let apiName: "document.modelContext" | "navigator.modelContext" | null = null;

function notifyRegistry() {
  for (const fn of registryListeners) fn();
}

/** Subscribe to registry changes (DebugPanel tool list). */
export function onRegistryChange(fn: () => void): () => void {
  registryListeners.add(fn);
  return () => registryListeners.delete(fn);
}

export function getApiName(): string | null {
  return apiName;
}

export function listToolDefs(): ToolDef[] {
  return [...registry.values()];
}

const wrap = (obj: unknown) => ({
  content: [{ type: "text", text: JSON.stringify(obj) }],
});

export async function callTool(
  name: string,
  input: unknown,
  source: "browser-api" | "debug-bridge",
  client?: unknown,
): Promise<unknown> {
  const def = registry.get(name);
  if (!def) {
    const reason = `tool "${name}" is not available in phase "${store.get().phase}"`;
    agentLog.add({ tool: name, input, status: "error", source });
    return { status: "error", reason };
  }
  const t0 = performance.now();
  const entryId = agentLog.add({ tool: name, input, status: "pending", source });
  try {
    const out = await def.execute(input ?? {}, client);
    const status = (out as { status?: string })?.status;
    agentLog.update(entryId, {
      status: (status as never) ?? "ok",
      durationMs: Math.round(performance.now() - t0),
    });
    return out;
  } catch (e) {
    // Tools are written to never throw; this is the safety net.
    agentLog.update(entryId, { status: "error", durationMs: Math.round(performance.now() - t0) });
    return { status: "error", reason: e instanceof Error ? e.message : String(e) };
  }
}

/** Registers in the internal registry and, when present, the browser API.
 *  Both are released through the same AbortSignal so they never diverge. */
export function registerTool(def: ToolDef, opts: { signal: AbortSignal }): void {
  if (opts.signal.aborted) return;
  registry.set(def.name, def);

  type ToolHandle = { unregister?: () => void; dispose?: () => void } | null;
  let handle: ToolHandle = null;
  if (api) {
    const browserDef = {
      name: def.name,
      ...(def.title ? { title: def.title } : {}),
      description: def.description,
      inputSchema: def.inputSchema,
      ...(def.annotations ? { annotations: def.annotations } : {}),
      execute: async (input: unknown, client: unknown) =>
        wrap(await callTool(def.name, input, "browser-api", client)),
    };
    try {
      handle = api.registerTool(browserDef, { signal: opts.signal }) as ToolHandle;
    } catch {
      try {
        handle = api.registerTool(browserDef) as ToolHandle;
      } catch (e) {
        agentLog.add({
          tool: "system",
          input: `registerTool(${def.name}) failed: ${String(e)}`,
          status: "error",
          source: "system",
        });
      }
    }
  }

  opts.signal.addEventListener("abort", () => {
    registry.delete(def.name);
    try {
      handle?.unregister?.();
      handle?.dispose?.();
      api?.unregisterTool?.(def.name);
    } catch {
      /* best effort */
    }
    notifyRegistry();
  });
  notifyRegistry();
}

export interface FormCoachBridge {
  listTools(): { name: string; description: string; readOnly: boolean }[];
  callTool(name: string, input?: unknown): Promise<unknown>;
  phase(): string;
  replay(fixtureName: string, speed?: number): Promise<void>;
  setConfirmTimeoutMs(ms: number): void;
}

/** Detects the browser API and installs the debug bridge. Call once at boot,
 *  before any registerTool. */
export function initWebMCP(): void {
  const d = typeof document !== "undefined" ? (document as never as Record<string, unknown>) : {};
  const n = typeof navigator !== "undefined" ? (navigator as never as Record<string, unknown>) : {};
  if (d.modelContext) {
    api = d.modelContext as BrowserModelContext;
    apiName = "document.modelContext";
  } else if (n.modelContext) {
    api = n.modelContext as BrowserModelContext;
    apiName = "navigator.modelContext";
  }

  agentLog.add({
    tool: "system",
    input: api
      ? `WebMCP: ${apiName} detected — tools will be visible to browser agents`
      : "WebMCP: API not found — tools available via debug bridge only",
    status: api ? "ok" : "error",
    source: "system",
  });

  const bridge: FormCoachBridge = {
    listTools: () =>
      [...registry.values()].map((t) => ({
        name: t.name,
        description: t.description,
        readOnly: !!t.annotations?.readOnlyHint,
      })),
    callTool: (name, input = {}) => callTool(name, input, "debug-bridge"),
    phase: () => store.get().phase,
    replay: (fixtureName, speed = 1) => replaySource.play(fixtureName, speed),
    setConfirmTimeoutMs: (ms) => store.setConfirmTimeoutMs(ms),
  };
  if (typeof window !== "undefined") {
    (window as never as { __formcoach: FormCoachBridge }).__formcoach = bridge;
  }
}

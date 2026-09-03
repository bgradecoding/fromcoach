// Frame hub: sources push frames in, subscribers (canvas, metrics) listen.
// T2 extends this with rep counting, rules, gestures, and LiveMetrics.
import type { Frame } from "./types";
import { ReplayPoseSource } from "./sources/replay";

type FrameListener = (f: Frame) => void;
const frameListeners = new Set<FrameListener>();

export function onFrame(fn: FrameListener): () => void {
  frameListeners.add(fn);
  return () => frameListeners.delete(fn);
}

export function pushFrame(f: Frame): void {
  for (const fn of frameListeners) fn(f);
}

/** Shared replay source; the debug bridge and DebugPanel play fixtures through it. */
export const replaySource = new ReplayPoseSource();
void replaySource.start(pushFrame);

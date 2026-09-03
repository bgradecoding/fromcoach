import type { Fixture, Frame, PoseSource } from "../types";

// Ship fixtures as static assets and fetch them on demand; keys look like
// "../../../fixtures/squat_10reps_side.json".
const fixtureUrls = import.meta.glob<string>("../../../fixtures/*.json", {
  query: "?url",
  import: "default",
  eager: true,
});

export function fixtureNames(): string[] {
  return Object.keys(fixtureUrls)
    .map((k) => k.split("/").pop()!.replace(/\.json$/, ""))
    .sort();
}

async function loadFixture(name: string): Promise<Fixture> {
  const key = Object.keys(fixtureUrls).find((k) => k.endsWith(`/${name}.json`));
  if (!key) throw new Error(`fixture not found: ${name}`);
  const res = await fetch(fixtureUrls[key]);
  if (!res.ok) throw new Error(`failed to load fixture ${name}: ${res.status}`);
  return (await res.json()) as Fixture;
}

/** Replays fixture landmark sequences into an onFrame callback.
 *  Frame.t is fixture time (ms), independent of playback speed, so
 *  dwell/tempo logic sees the recorded timing even at speed 4. */
export class ReplayPoseSource implements PoseSource {
  private onFrame: ((f: Frame) => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private playing = false;

  async start(onFrame: (f: Frame) => void): Promise<void> {
    this.onFrame = onFrame;
  }

  stop(): void {
    this.cancel();
    this.onFrame = null;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  cancel(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.playing = false;
  }

  /** Plays one fixture to completion (or until cancel/stop). Resolves when
   *  done. Frames are paced by elapsed wall time with catch-up, so throttled
   *  timers (hidden tabs) emit a burst instead of stretching the playback —
   *  frame `t` stays fixture time either way. */
  play(name: string, speed = 1): Promise<void> {
    this.cancel();
    return new Promise((resolve, reject) => {
      loadFixture(name).then((fx) => {
        const stepMs = 1000 / fx.fps / speed;
        const startedAt = performance.now();
        let i = 0;
        this.playing = true;
        const tick = () => {
          if (!this.playing || !this.onFrame) return resolve();
          const due = Math.min(
            fx.frames.length,
            Math.floor((performance.now() - startedAt) / stepMs) + 1,
          );
          while (i < due) {
            this.onFrame(fx.frames[i]);
            i += 1;
          }
          if (i >= fx.frames.length) {
            this.playing = false;
            this.timer = null;
            return resolve();
          }
          this.timer = setTimeout(tick, stepMs);
        };
        tick();
      }, reject);
    });
  }
}

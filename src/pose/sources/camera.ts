import { FilesetResolver, GestureRecognizer, PoseLandmarker } from "@mediapipe/tasks-vision";
import type { Frame, HandTrackingStatus, PoseSource, TrackingMode } from "../types";

// Keep in sync with the @mediapipe/tasks-vision version in package.json.
const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const GESTURE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task";

function closeTask(task: { close(): void } | null): void {
  try {
    task?.close();
  } catch {
    // Even a failed native task must not prevent the camera stream from closing.
  }
}

/** One camera stream, with body tracking during exercise and hand tracking at rest.
 * Models stay local; only normalized landmarks and gesture scores are emitted. */
export class CameraPoseSource implements PoseSource {
  private video: HTMLVideoElement;
  private getTrackingMode: () => TrackingMode;
  private landmarker: PoseLandmarker | null = null;
  private gestureRecognizer: GestureRecognizer | null = null;
  private fileset: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>> | null = null;
  private handTracking: HandTrackingStatus = "loading";
  private loadingHands = false;
  private stream: MediaStream | null = null;
  private raf = 0;
  private running = false;
  private generation = 0;

  constructor(video: HTMLVideoElement, getTrackingMode: () => TrackingMode = () => "pose") {
    this.video = video;
    this.getTrackingMode = getTrackingMode;
  }

  async start(onFrame: (f: Frame) => void): Promise<void> {
    this.stop();
    const generation = this.generation;
    this.running = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" },
        audio: false,
      });
      if (!this.isCurrent(generation)) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      this.video.srcObject = stream;
      await this.video.play();
      if (!this.isCurrent(generation)) return;

      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
      if (!this.isCurrent(generation)) return;
      this.fileset = fileset;
      const options = {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" as const },
        runningMode: "VIDEO" as const,
        numPoses: 1,
      };
      let landmarker: PoseLandmarker;
      try {
        landmarker = await PoseLandmarker.createFromOptions(fileset, options);
      } catch {
        if (!this.isCurrent(generation)) return;
        landmarker = await PoseLandmarker.createFromOptions(fileset, {
          ...options,
          baseOptions: { ...options.baseOptions, delegate: "CPU" },
        });
      }
      if (!this.isCurrent(generation)) {
        closeTask(landmarker);
        return;
      }
      this.landmarker = landmarker;
    } catch (error) {
      if (!this.isCurrent(generation)) return;
      this.stop();
      throw error;
    }

    let lastVideoTime = -1;
    const loop = () => {
      if (!this.isCurrent(generation)) return;
      const t = performance.now();
      if (this.video.currentTime !== lastVideoTime && this.video.readyState >= 2) {
        lastVideoTime = this.video.currentTime;
        onFrame(this.getTrackingMode() === "palm"
          ? this.handFrame(t, generation)
          : this.poseFrame(t));
      }
      // A frame consumer can stop the source while handling a gesture.
      if (this.isCurrent(generation)) this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private isCurrent(generation: number): boolean {
    return this.running && this.generation === generation;
  }

  private poseFrame(t: number): Frame {
    try {
      const result = this.landmarker!.detectForVideo(this.video, t);
      const lm = result.landmarks?.[0];
      return {
        t,
        landmarks: lm
          ? lm.map((p, i) => ({
              x: p.x,
              y: p.y,
              z: p.z,
              visibility: p.visibility ?? result.worldLandmarks?.[0]?.[i]?.visibility ?? 1,
            }))
          : null,
      };
    } catch {
      // A dropped/invalid video frame must not stop the animation loop.
      return { t, landmarks: null };
    }
  }

  private handFrame(t: number, generation: number): Frame {
    if (!this.gestureRecognizer && !this.loadingHands && this.handTracking !== "unavailable") {
      // The first rest frame reports loading immediately; camera delivery keeps running.
      void this.loadHands(generation);
    }
    if (this.gestureRecognizer) {
      try {
        const result = this.gestureRecognizer.recognizeForVideo(this.video, t);
        return {
          t,
          landmarks: null,
          handTracking: "ready",
          hands: result.landmarks.map((landmarks, i) => ({
            landmarks: landmarks.map((p) => ({
              x: p.x,
              y: p.y,
              z: p.z,
              visibility: p.visibility ?? 1,
            })),
            gesture: result.gestures[i]?.[0]?.categoryName ?? "None",
            score: result.gestures[i]?.[0]?.score ?? 0,
          })),
        };
      } catch {
        closeTask(this.gestureRecognizer);
        this.gestureRecognizer = null;
        this.handTracking = "unavailable";
      }
    }
    return { t, landmarks: null, hands: [], handTracking: this.handTracking };
  }

  private async loadHands(generation: number): Promise<void> {
    this.loadingHands = true;
    this.handTracking = "loading";
    const fileset = this.fileset!;
    const options = {
      baseOptions: { modelAssetPath: GESTURE_MODEL_URL, delegate: "GPU" as const },
      runningMode: "VIDEO" as const,
      numHands: 2,
    };
    try {
      let recognizer: GestureRecognizer;
      try {
        recognizer = await GestureRecognizer.createFromOptions(fileset, options);
      } catch {
        if (!this.isCurrent(generation)) return;
        recognizer = await GestureRecognizer.createFromOptions(fileset, {
          ...options,
          baseOptions: { ...options.baseOptions, delegate: "CPU" },
        });
      }
      if (!this.isCurrent(generation)) {
        closeTask(recognizer);
        return;
      }
      this.gestureRecognizer = recognizer;
      this.handTracking = "ready";
    } catch {
      if (this.isCurrent(generation)) this.handTracking = "unavailable";
    } finally {
      if (this.isCurrent(generation)) this.loadingHands = false;
    }
  }

  stop(): void {
    this.running = false;
    this.generation += 1;
    cancelAnimationFrame(this.raf);
    closeTask(this.landmarker);
    closeTask(this.gestureRecognizer);
    this.landmarker = null;
    this.gestureRecognizer = null;
    this.fileset = null;
    this.loadingHands = false;
    this.handTracking = "loading";
    this.stream?.getTracks().forEach((t) => t.stop());
    if (this.video.srcObject === this.stream) this.video.srcObject = null;
    this.stream = null;
  }
}

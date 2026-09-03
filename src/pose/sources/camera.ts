import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import type { Frame, PoseSource } from "../types";

// Keep in sync with the @mediapipe/tasks-vision version in package.json.
const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

/** Webcam + MediaPipe Pose Landmarker. Video frames never leave this class;
 *  only normalized landmarks are emitted. */
export class CameraPoseSource implements PoseSource {
  private video: HTMLVideoElement;
  private landmarker: PoseLandmarker | null = null;
  private stream: MediaStream | null = null;
  private raf = 0;
  private running = false;

  constructor(video: HTMLVideoElement) {
    this.video = video;
  }

  async start(onFrame: (f: Frame) => void): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720, facingMode: "user" },
      audio: false,
    });
    this.video.srcObject = this.stream;
    await this.video.play();

    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
    const options = {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" as const },
      runningMode: "VIDEO" as const,
      numPoses: 1,
    };
    try {
      this.landmarker = await PoseLandmarker.createFromOptions(fileset, options);
    } catch {
      this.landmarker = await PoseLandmarker.createFromOptions(fileset, {
        ...options,
        baseOptions: { ...options.baseOptions, delegate: "CPU" },
      });
    }

    this.running = true;
    let lastVideoTime = -1;
    const loop = () => {
      if (!this.running) return;
      const t = performance.now();
      if (this.video.currentTime !== lastVideoTime && this.video.readyState >= 2) {
        lastVideoTime = this.video.currentTime;
        const result = this.landmarker!.detectForVideo(this.video, t);
        const lm = result.landmarks?.[0];
        onFrame({
          t,
          landmarks: lm
            ? lm.map((p, i) => ({
                x: p.x,
                y: p.y,
                z: p.z,
                visibility: p.visibility ?? result.worldLandmarks?.[0]?.[i]?.visibility ?? 1,
              }))
            : null,
        });
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.landmarker?.close();
    this.landmarker = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}

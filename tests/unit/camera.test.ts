import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CameraPoseSource } from "../../src/pose/sources/camera";
import type { Frame, TrackingMode } from "../../src/pose/types";

const mediaPipe = vi.hoisted(() => ({
  fileset: vi.fn(),
  createPose: vi.fn(),
  createGesture: vi.fn(),
  detect: vi.fn(),
  recognize: vi.fn(),
  closePose: vi.fn(),
  closeGesture: vi.fn(),
}));

vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: { forVisionTasks: mediaPipe.fileset },
  PoseLandmarker: { createFromOptions: mediaPipe.createPose },
  GestureRecognizer: { createFromOptions: mediaPipe.createGesture },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

// Allow both asynchronous model creation and its CPU fallback to settle.
const flushModelLoad = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("camera tracking modes", () => {
  const poseTask = { detectForVideo: mediaPipe.detect, close: mediaPipe.closePose };
  const gestureTask = { recognizeForVideo: mediaPipe.recognize, close: mediaPipe.closeGesture };
  const poseLandmarks = [{ x: 0.2, y: 0.3, z: 0, visibility: 0.9 }];
  const handLandmarks = Array.from({ length: 21 }, (_, i) => ({ x: i / 21, y: 0.4, z: 0 }));
  let video: HTMLVideoElement;
  let stream: MediaStream;
  let stopTrack: ReturnType<typeof vi.fn>;
  let getUserMedia: ReturnType<typeof vi.fn>;
  let mode: TrackingMode;
  let source: CameraPoseSource;
  let frames: Frame[];
  let callbacks: Map<number, FrameRequestCallback>;

  function nextVideoFrame() {
    const entry = callbacks.entries().next().value;
    expect(entry, "camera animation loop is scheduled").toBeDefined();
    const [id, callback] = entry!;
    callbacks.delete(id);
    video.currentTime += 1 / 30;
    callback(performance.now());
  }

  beforeEach(() => {
    vi.resetAllMocks();
    mediaPipe.fileset.mockResolvedValue({});
    mediaPipe.createPose.mockResolvedValue(poseTask);
    mediaPipe.createGesture.mockResolvedValue(gestureTask);
    mediaPipe.detect.mockReturnValue({ landmarks: [poseLandmarks], worldLandmarks: [] });
    mediaPipe.recognize.mockReturnValue({
      landmarks: [handLandmarks],
      gestures: [[{ categoryName: "Open_Palm", score: 0.94 }]],
    });
    stopTrack = vi.fn();
    stream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;
    getUserMedia = vi.fn().mockResolvedValue(stream);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    video = {
      currentTime: 0,
      readyState: 2,
      srcObject: null,
      play: vi.fn().mockResolvedValue(undefined),
    } as unknown as HTMLVideoElement;
    callbacks = new Map();
    let nextId = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callbacks.set(++nextId, callback);
      return nextId;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => callbacks.delete(id));
    mode = "pose";
    frames = [];
    source = new CameraPoseSource(video, () => mode);
  });

  afterEach(() => {
    source.stop();
    vi.unstubAllGlobals();
  });

  it("switches to hands without body inference and resumes pose on the same camera", async () => {
    await source.start((frame) => frames.push(frame));
    nextVideoFrame();
    expect(frames.at(-1)?.landmarks).toEqual(poseLandmarks);
    expect(mediaPipe.createGesture).not.toHaveBeenCalled();

    mode = "palm";
    nextVideoFrame();
    expect(frames.at(-1)).toMatchObject({ landmarks: null, hands: [], handTracking: "loading" });
    expect(mediaPipe.detect).toHaveBeenCalledTimes(1);
    await flushModelLoad();
    nextVideoFrame();
    expect(frames.at(-1)).toMatchObject({
      landmarks: null,
      handTracking: "ready",
      hands: [{
        gesture: "Open_Palm",
        score: 0.94,
        landmarks: handLandmarks.map((point) => ({ ...point, visibility: 1 })),
      }],
    });
    expect(mediaPipe.detect).toHaveBeenCalledTimes(1);
    expect(mediaPipe.recognize).toHaveBeenCalledTimes(1);

    mode = "pose";
    nextVideoFrame();
    expect(frames.at(-1)?.landmarks).toEqual(poseLandmarks);
    expect(frames.at(-1)?.hands).toBeUndefined();
    expect(mediaPipe.detect).toHaveBeenCalledTimes(2);
    expect(mediaPipe.recognize).toHaveBeenCalledTimes(1);

    mode = "palm";
    nextVideoFrame();
    expect(frames.at(-1)?.handTracking).toBe("ready");
    expect(mediaPipe.createGesture).toHaveBeenCalledTimes(1);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(stopTrack).not.toHaveBeenCalled();
  });

  it("keeps rest frames flowing while the hand model loads, then falls back to CPU", async () => {
    const gpuLoad = deferred<typeof gestureTask>();
    mediaPipe.createGesture.mockImplementationOnce(() => gpuLoad.promise.then(() => {
      throw new Error("GPU unavailable");
    }));
    mode = "palm";
    await source.start((frame) => frames.push(frame));
    nextVideoFrame();
    nextVideoFrame();
    nextVideoFrame();
    expect(frames).toHaveLength(3);
    expect(frames.every((frame) => frame.handTracking === "loading" && frame.landmarks === null)).toBe(true);
    expect(mediaPipe.createGesture).toHaveBeenCalledTimes(1);
    expect(mediaPipe.detect).not.toHaveBeenCalled();

    gpuLoad.resolve(gestureTask);
    await flushModelLoad();
    nextVideoFrame();
    expect(mediaPipe.createGesture.mock.calls.map(([, options]) => options.baseOptions.delegate)).toEqual(["GPU", "CPU"]);
    expect(frames.at(-1)?.handTracking).toBe("ready");
  });

  it("reports unavailable after both hand delegates fail without breaking pose tracking", async () => {
    mediaPipe.createGesture.mockRejectedValue(new Error("model download failed"));
    mode = "palm";
    await source.start((frame) => frames.push(frame));
    nextVideoFrame();
    await flushModelLoad();
    nextVideoFrame();
    nextVideoFrame();
    expect(frames.at(-1)).toMatchObject({ landmarks: null, hands: [], handTracking: "unavailable" });
    expect(mediaPipe.createGesture).toHaveBeenCalledTimes(2);
    expect(mediaPipe.detect).not.toHaveBeenCalled();

    mode = "pose";
    nextVideoFrame();
    expect(frames.at(-1)?.landmarks).toEqual(poseLandmarks);
    expect(stopTrack).not.toHaveBeenCalled();
  });

  it("contains a hand inference failure, closes the failed task, and preserves the camera", async () => {
    mode = "palm";
    await source.start((frame) => frames.push(frame));
    nextVideoFrame();
    await flushModelLoad();
    mediaPipe.recognize.mockImplementation(() => { throw new Error("lost GPU context"); });
    mediaPipe.closeGesture.mockImplementation(() => { throw new Error("failed native cleanup"); });
    expect(nextVideoFrame).not.toThrow();
    expect(frames.at(-1)).toMatchObject({ landmarks: null, hands: [], handTracking: "unavailable" });
    expect(mediaPipe.closeGesture).toHaveBeenCalledOnce();
    mode = "pose";
    nextVideoFrame();
    expect(frames.at(-1)?.landmarks).toEqual(poseLandmarks);
    source.stop();
    expect(stopTrack).toHaveBeenCalledOnce();
  });

  it.each(["pose", "palm"] as const)("disposes a %s task that finishes loading after stop", async (loadingMode) => {
    const pendingTask = deferred<typeof poseTask | typeof gestureTask>();
    if (loadingMode === "pose") mediaPipe.createPose.mockReturnValueOnce(pendingTask.promise);
    else mediaPipe.createGesture.mockReturnValueOnce(pendingTask.promise);
    const startup = source.start((frame) => frames.push(frame));
    await flushModelLoad();
    if (loadingMode === "palm") {
      await startup;
      mode = "palm";
      nextVideoFrame();
    }

    source.stop();
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(video.srcObject).toBeNull();
    expect(callbacks.size).toBe(0);
    const frameCount = frames.length;
    pendingTask.resolve(loadingMode === "pose" ? poseTask : gestureTask);
    await startup;
    await flushModelLoad();
    expect(loadingMode === "pose" ? mediaPipe.closePose : mediaPipe.closeGesture).toHaveBeenCalledOnce();
    expect(callbacks.size).toBe(0);
    expect(frames).toHaveLength(frameCount);
  });

  it("stops a camera stream received after startup was cancelled", async () => {
    const pendingStream = deferred<MediaStream>();
    getUserMedia.mockReturnValueOnce(pendingStream.promise);
    const startup = source.start((frame) => frames.push(frame));
    source.stop();
    pendingStream.resolve(stream);
    await startup;
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(video.play).not.toHaveBeenCalled();
    expect(video.srcObject).toBeNull();
    expect(mediaPipe.createPose).not.toHaveBeenCalled();
    expect(callbacks.size).toBe(0);
  });

  it("releases the stream when pose model startup fails", async () => {
    mediaPipe.createPose.mockRejectedValue(new Error("pose model unavailable"));
    await expect(source.start((frame) => frames.push(frame))).rejects.toThrow("pose model unavailable");
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(video.srcObject).toBeNull();
    expect(callbacks.size).toBe(0);
  });
});

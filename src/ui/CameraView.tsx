import { useEffect, useRef, useState } from "react";
import { onFrame, pushFrame, replaySource } from "../pose/engine";
import { CameraPoseSource } from "../pose/sources/camera";
import { fixtureNames } from "../pose/sources/replay";
import { LM, type Landmark } from "../pose/types";

const W = 960;
const H = 540;

const BONES: [number, number][] = [
  [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],
  [LM.LEFT_SHOULDER, LM.LEFT_ELBOW],
  [LM.LEFT_ELBOW, LM.LEFT_WRIST],
  [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW],
  [LM.RIGHT_ELBOW, LM.RIGHT_WRIST],
  [LM.LEFT_SHOULDER, LM.LEFT_HIP],
  [LM.RIGHT_SHOULDER, LM.RIGHT_HIP],
  [LM.LEFT_HIP, LM.RIGHT_HIP],
  [LM.LEFT_HIP, LM.LEFT_KNEE],
  [LM.LEFT_KNEE, LM.LEFT_ANKLE],
  [LM.RIGHT_HIP, LM.RIGHT_KNEE],
  [LM.RIGHT_KNEE, LM.RIGHT_ANKLE],
];

const DOTS = [
  LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_ELBOW, LM.RIGHT_ELBOW,
  LM.LEFT_WRIST, LM.RIGHT_WRIST, LM.LEFT_HIP, LM.RIGHT_HIP,
  LM.LEFT_KNEE, LM.RIGHT_KNEE, LM.LEFT_ANKLE, LM.RIGHT_ANKLE,
];

function drawSkeleton(ctx: CanvasRenderingContext2D, landmarks: Landmark[] | null) {
  ctx.clearRect(0, 0, W, H);
  if (!landmarks) return;
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#4ade80";
  ctx.globalAlpha = 0.85;
  for (const [a, b] of BONES) {
    const pa = landmarks[a];
    const pb = landmarks[b];
    if (!pa || !pb || pa.visibility < 0.4 || pb.visibility < 0.4) continue;
    ctx.beginPath();
    ctx.moveTo(pa.x * W, pa.y * H);
    ctx.lineTo(pb.x * W, pb.y * H);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#ffffff";
  for (const i of DOTS) {
    const p = landmarks[i];
    if (!p || p.visibility < 0.4) continue;
    ctx.beginPath();
    ctx.arc(p.x * W, p.y * H, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

interface Props {
  useCamera: boolean;
}

export default function CameraView({ useCamera }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraState, setCameraState] = useState<"starting" | "on" | "off">(
    useCamera ? "starting" : "off",
  );
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [selectedFixture, setSelectedFixture] = useState("squat_10reps_side");
  const [liveInput, setLiveInput] = useState(false);

  useEffect(() => {
    if (!useCamera || !videoRef.current) return;
    const source = new CameraPoseSource(videoRef.current);
    let cancelled = false;
    source
      .start(pushFrame)
      .then(() => !cancelled && setCameraState("on"))
      .catch((e) => {
        if (cancelled) return;
        setCameraState("off");
        setCameraError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
      source.stop();
    };
  }, [useCamera]);

  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const off = onFrame((f) => {
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) drawSkeleton(ctx, f.landmarks);
      setLiveInput(true);
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => setLiveInput(false), 800);
    });
    return () => {
      off();
      if (idleTimer) clearTimeout(idleTimer);
    };
  }, []);

  const mirrored = cameraState === "on";
  const showFallback = cameraState !== "on" && !liveInput;

  return (
    <div className="camera-view">
      <div className={`camera-stage${mirrored ? " mirrored" : ""}`}>
        <video ref={videoRef} autoPlay playsInline muted width={W} height={H} />
        <canvas ref={canvasRef} width={W} height={H} />
        {showFallback && (
          <div className="camera-fallback">
            {cameraState === "starting" ? (
              <p>Starting camera…</p>
            ) : (
              <>
                <p className="fallback-title">Camera unavailable — replay mode</p>
                {cameraError && <p className="fallback-detail">{cameraError}</p>}
                <div className="fallback-controls">
                  <select
                    value={selectedFixture}
                    onChange={(e) => setSelectedFixture(e.target.value)}
                  >
                    {fixtureNames().map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => void replaySource.play(selectedFixture, 1)}>
                    Play fixture
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

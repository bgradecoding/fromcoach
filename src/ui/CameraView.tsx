import { useEffect, useRef, useState } from "react";
import { getEngineSnapshot, getTrackingMode, onFrame, pushFrame, replaySource } from "../pose/engine";
import { CameraPoseSource } from "../pose/sources/camera";
import { fixtureNames } from "../pose/sources/replay";
import { LM, type HandObservation, type Landmark } from "../pose/types";
import { store, useSessionState } from "../session/store";

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

const CUE_TEXT: Record<string, string> = {
  knee_valgus: "Knees out!",
  torso_lean: "Chest up!",
  hip_sag: "Hips up — brace your core",
  elbow_flare: "Tuck the elbows",
  shallow: "Go deeper",
};

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

const HAND_CHAINS = [[0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [5, 9, 10, 11, 12],
  [9, 13, 14, 15, 16], [13, 17, 18, 19, 20], [0, 17]];

function drawHands(ctx: CanvasRenderingContext2D, hands: HandObservation[]) {
  ctx.clearRect(0, 0, W, H);
  ctx.lineWidth = 3;
  for (const hand of hands) {
    ctx.strokeStyle = hand.gesture === "Open_Palm" && hand.score >= 0.75 ? "#4ade80" : "#9aa5b1";
    for (const chain of HAND_CHAINS) {
      ctx.beginPath();
      for (const [i, index] of chain.entries()) {
        const point = hand.landmarks[index];
        if (!point) continue;
        if (i === 0) ctx.moveTo(point.x * W, point.y * H);
        else ctx.lineTo(point.x * W, point.y * H);
      }
      ctx.stroke();
    }
    ctx.fillStyle = "#ffffff";
    for (const point of hand.landmarks) {
      ctx.beginPath();
      ctx.arc(point.x * W, point.y * H, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

interface Props {
  useCamera: boolean;
}

export default function CameraView({ useCamera }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const angleLabelRef = useRef<HTMLDivElement>(null);
  const [cameraState, setCameraState] = useState<"starting" | "on" | "off">(
    useCamera ? "starting" : "off",
  );
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [selectedFixture, setSelectedFixture] = useState("squat_10reps_side");
  const [liveInput, setLiveInput] = useState(false);
  const [guidance, setGuidance] = useState<string | null>(null);
  const [cue, setCue] = useState<string | null>(null);
  const session = useSessionState();
  const resting = session.phase === "rest";
  const mirrored = cameraState === "on";
  const mirroredRef = useRef(false);

  useEffect(() => {
    mirroredRef.current = mirrored;
  }, [mirrored]);

  useEffect(() => {
    if (!useCamera || !videoRef.current) return;
    const source = new CameraPoseSource(videoRef.current, getTrackingMode);
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
      const snap = getEngineSnapshot();
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) {
        if (snap.trackingMode === "palm") drawHands(ctx, f.hands ?? []);
        else drawSkeleton(ctx, f.landmarks);
      }

      // angle badge follows the tracked joint (HTML, so it never mirrors)
      const label = angleLabelRef.current;
      if (label) {
        const vertex =
          snap.vertexIndex !== null && f.landmarks
            ? f.landmarks[snap.vertexIndex]
            : null;
        if (vertex && snap.currentAngle !== null && vertex.visibility >= 0.4) {
          const x = mirroredRef.current ? 1 - vertex.x : vertex.x;
          label.hidden = false;
          label.style.left = `${x * 100}%`;
          label.style.top = `${vertex.y * 100}%`;
          label.textContent = `${Math.round(snap.currentAngle)}°`;
        } else {
          label.hidden = true;
        }
        setGuidance(
          snap.trackingMode === "palm"
            ? null
            : !snap.personDetected
            ? "Stand back so your whole body is visible"
            : snap.view === "front"
              ? "Front view — knee tracking active"
              : snap.view === "side"
                ? "Side view — depth tracking active"
                : null,
        );
      }

      setLiveInput(true);
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => setLiveInput(false), 800);
    });
    return () => {
      off();
      if (idleTimer) clearTimeout(idleTimer);
    };
  }, []);

  useEffect(() => {
    if (!resting) return;
    canvasRef.current?.getContext("2d")?.clearRect(0, 0, W, H);
    if (angleLabelRef.current) angleLabelRef.current.hidden = true;
  }, [resting]);

  // form cue: shown for 1.5s when a rep closes with flags
  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    let prevRep = store.get().lastRep;
    const off = store.subscribe(() => {
      const rep = store.get().lastRep;
      if (rep && rep !== prevRep && rep.flags.length > 0) {
        setCue(rep.flags.map((f) => CUE_TEXT[f] ?? f).join(" · "));
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(() => setCue(null), 1500);
      }
      prevRep = rep;
    });
    return () => {
      off();
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, []);

  const showFallback = cameraState !== "on" && !liveInput;

  return (
    <div className="camera-view">
      <div className={`camera-stage${mirrored ? " mirrored" : ""}${resting ? " is-resting" : ""}`}>
        <video ref={videoRef} autoPlay playsInline muted width={W} height={H} />
        <canvas ref={canvasRef} width={W} height={H} />
        <div ref={angleLabelRef} className="angle-label" hidden />
        {!resting && guidance && !showFallback && <div className="view-guidance">{guidance}</div>}
        {!resting && cue && <div className="form-cue">{cue}</div>}
        {session.phase === "countdown" && <CountdownBig />}
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
        {resting && <RestPalmHint />}
      </div>
    </div>
  );
}

function RestPalmHint() {
  const [snap, setSnap] = useState(getEngineSnapshot);
  useEffect(() => {
    const timer = setInterval(() => setSnap(getEngineSnapshot()), 100);
    return () => clearInterval(timer);
  }, []);

  const loading = snap.handTracking === "loading" || snap.handTracking === "inactive";
  const unavailable = snap.handTracking === "unavailable";
  const title = loading ? "Preparing hand detection…"
    : unavailable ? "Hand detection unavailable"
      : snap.palmDetected ? "Hold your palm steady"
        : snap.handDetected ? "Open your hand toward the camera"
          : "Show your open palm";

  return (
    <section className="rest-palm-hint" aria-label="Skip rest with an open palm">
      <span className="rest-palm-icon" aria-hidden="true">✋</span>
      <div className="rest-palm-copy">
        <p className="rest-palm-title" role="status">{title}</p>
        <p className="rest-palm-detail">
          {unavailable ? "Use the Skip rest button to continue."
            : loading ? "You can also use the Skip rest button."
              : "Hold for 1 second to skip rest. Only your hand needs to be in view."}
        </p>
        {!loading && !unavailable && (
          <progress aria-label="Open palm hold" max={100} value={Math.round(snap.palmHoldProgress * 100)} />
        )}
      </div>
    </section>
  );
}

function CountdownBig() {
  // remounts on each countdown phase, so starting at 3 is always correct
  const [n, setN] = useState(3);
  useEffect(() => {
    const timer = setInterval(() => setN((v) => Math.max(1, v - 1)), 1000);
    return () => clearInterval(timer);
  }, []);
  return <div className="countdown-big">{n}</div>;
}

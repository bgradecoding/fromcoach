import { useEffect, useRef, useState } from "react";

// T0 hello world: prove the camera pipeline and deploy target work.
// Replaced by the full app in later tasks.
export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      ?.getUserMedia({ video: { width: 1280, height: 720 }, audio: false })
      .then((s) => {
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch((e) => setCameraError(String(e)));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  return (
    <div className="app-shell">
      <header className="topbar">
        <span className="brand">FormCoach</span>
        <span className="tagline">Your agent coaches. Your camera stays in the tab.</span>
      </header>
      <main style={{ padding: 24 }}>
        {cameraError ? (
          <p>Camera unavailable: {cameraError}</p>
        ) : (
          <video ref={videoRef} autoPlay playsInline muted style={{ maxWidth: "100%", borderRadius: 12 }} />
        )}
      </main>
    </div>
  );
}

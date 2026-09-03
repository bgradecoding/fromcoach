# FormCoach

Work out in front of your webcam. The page measures reps and form with MediaPipe Pose — entirely inside the browser tab — and exposes the measurements and workout controls as **WebMCP tools**, so any WebMCP-aware browser agent can coach you from numbers, never from video.

> Full README lands with the docs task. Quick start:

```bash
npm install
npm run dev        # http://localhost:5173
npm run test       # Vitest unit tests
npm run e2e        # Playwright (chromium)
npm run gen:fixtures
```

Debug/replay mode (no camera needed): `http://localhost:5173/?debug=1&replay=squat_10reps_side&speed=4`

License: MIT

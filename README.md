# FormCoach

**Work out in front of your webcam. The page measures reps and form inside the browser tab and exposes structured measurements and workout controls to a WebMCP-capable browser agent. These tools return data, not camera images.**

- **Live app:** _added on deploy_ (Vercel)
- **Demo video:** _added on submission_
- Built for the [WebMCP Challenge](https://webmcp.devpost.com/)

![FormCoach mid-set: front view, rep counter, knee-valgus flag](docs/screenshots/set-live.png)

## Why WebMCP

WebMCP connects the agent directly to the workout running in the user's tab. MediaPipe runs locally, and the page publishes joint angles, rep counts, tempo, form flags, and phase-specific controls. The agent can read current state and propose an action without scraping the interface or receiving camera images through these tools.

Mid-workout your hands are busy, so proposed program changes can be confirmed with **body gestures**: raise both hands to accept or cross your arms to decline. During rest, a separate hand detector lets you resume with an open palm, even when your body is outside the frame.

## What the agent can do

Eight imperative tools plus a declarative form where the browser supports it. Read tools have `readOnlyHint`; program adjustments require an explicit gesture or button response. Starting, ending, creating a plan, and setting rest do not use that extra confirmation overlay.

| Tool | What it does | Read-only |
|---|---|---|
| `getWorkoutPlan` | Today's plan: blocks, creator (user/agent), injury note | ✓ |
| `getLiveMetrics` | Live phase, reps, joint angle, view, form flags, rest timer, palm detection and hold progress | ✓ |
| `getSetHistory` | Completed sets: reps vs target, flag counts, avg tempo | ✓ |
| `createWorkoutPlan` | Creates a validated squat/pushup plan in idle/done; credits the agent | |
| `startSet` | Starts the next set after a 3s countdown | |
| `setRest` | Sets rest duration (10–600s), live timer included | |
| `adjustProgram` | Proposes swap_exercise / reduce_reps / add_set / extend_rest; returns applied, rejected, timeout, or cancelled if the session ends | |
| `endSession` | Ends the session, returns summary + recommendations | |
| `createPlan` (declarative `<form toolname>`) | Creates the plan; the handler reads `SubmitEvent.agentInvoked` to credit the agent | |

**The tool set follows the workout phase** — registrations are scoped to `AbortController`s and swapped on every transition:

| Phase | Active tools (besides the three read tools) |
|---|---|
| idle | createWorkoutPlan, startSet, createPlan form |
| countdown | endSession |
| set | adjustProgram, setRest, endSession |
| rest | startSet, setRest, adjustProgram, endSession |
| awaiting confirmation | endSession |
| done | createWorkoutPlan, createPlan form |

## Try it

**Path A — ChatGPT in-app browser (site tools):** open the live URL, allow the camera, and talk to the agent.

**Path B — Chrome:** enable `chrome://flags/#enable-webmcp-testing` (or `#enable-experimental-web-platform-features`), install a Model Context Tool Inspector extension, and open the live URL.

Short demo prompts (full shot list and narration: [Demo video script](docs/DEMO_VIDEO_SCRIPT.md)):

1. "Create a squat plan with 2 sets, 3 reps per set, and 60 seconds rest. Note: Short demonstration."
2. "Start the first set."
3. *(complete the first set)* "Read my metrics and set history. Summarize only the recorded measurements."
4. "For a shorter demo, reduce the target to 2 reps from the next set. Ask for confirmation."
5. *(raise both hands to accept, then hold an open palm for one second during rest)*
6. *(complete the next set)* "Summarize my completed sets and recorded form flags."

For an early finish, ask "End the session and summarize it" while a session is active. At `done`, the summary already exists and `endSession` is no longer exposed. The agent should use the read tools.

No camera? Append `?debug=1&replay=none` for the debug panel and replay **synthetic landmark fixtures**. Label footage of this mode as replay data.

## The human–agent experience

- **Gesture confirmation:** `adjustProgram` waits for hands-up acceptance, arms-crossed rejection, a button response, or a 20s timeout. Ending the session cancels the pending call without applying the proposal. A lower rep target applies from the next set.
- **Skip rest with a palm:** while resting, show an open palm to the camera and hold it for 1 second. Only your hand needs to be visible. The camera switches to MediaPipe Gesture Recognizer during rest and resumes body-pose tracking for the next set. A progress bar shows the hold; briefly showing a hand, making a fist, or losing tracking does not skip rest. The Skip rest button remains available while the hand model loads or if detection is unavailable.
- **Agent log:** every tool call is rendered in the UI with source (browser agent vs debug bridge), status, and latency — you always see what the agent did.
- **Agent attribution:** `createWorkoutPlan` and agent-submitted declarative forms get a "Created by agent" badge. The imperative tool works even when the browser does not expose the form tool.
- **Voice:** the page speaks fixed proposal and completion messages via `speechSynthesis`. Agent reasoning comes from the external browser agent; this app has no embedded LLM, voice-command input, or autonomous coaching loop.

## How it works

```
webcam ──▶ MediaPipe Pose (in-tab, on-device)
              │  33 landmarks / frame
              ▼
        pose engine ─ rep FSM · form rules · gesture dwell
              │  numbers only
              ▼
       session machine (idle→countdown→set→rest→done)
              │
              ▼
   WebMCP tools (document.modelContext) ◀──▶ browser agent
```

Privacy: the app processes camera frames locally with MediaPipe and does not implement camera uploads. WebMCP responses contain structured data without images. Models and runtime assets are downloaded when needed. The plan is kept in `localStorage`, set history in memory. This describes the app's data flow, not other permissions or capabilities of the surrounding browser agent.

During rest, `getLiveMetrics` reports `trackingMode: "palm"`, `handTracking` (`loading`, `ready`, or `unavailable`), `handDetected`, `palmDetected`, and `palmHoldProgress` (0–1). Body fields report `personDetected: false`, `view: "unknown"`, and `currentAngle: null` because rest does not require a full-body view. Outside rest, `trackingMode` returns to `pose` and `handTracking` is `inactive`. Program-change confirmation continues to use the existing body gestures.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
```

- `npm run test` — Vitest unit tests (rep counter, rules, gestures, state machine, tool registration)
- `npm run e2e` — Playwright end-to-end session (`npx playwright install chromium` first)
- `npm run gen:fixtures` — regenerate the synthetic landmark fixtures in `fixtures/`

### Debug bridge

Everything is testable without a camera. `window.__formcoach` exposes:

```js
__formcoach.listTools()                  // internal registry (mirrors the browser API)
__formcoach.callTool(name, input)        // same execute path a real agent hits
__formcoach.phase()                      // current session phase
__formcoach.replay("squat_10reps_side", 4) // feed a fixture through the engine
__formcoach.replay("gesture_open_palm", 1) // while resting: hand-only frames skip rest
__formcoach.setConfirmTimeoutMs(3000)    // shrink the gesture timeout for tests
```

URL params: `?debug=1` (debug panel) · `?replay=<fixture|none>` (skip camera) · `&speed=4`.

## Roadmap

- Move the "eyes" into a browser extension so any workout or rehab site can publish its own exercise spec and be coached by the same agent.
- Cross-site sessions: a tracker site and a coach agent sharing one WebMCP contract.
- Rehab verticals: physiotherapy ranges-of-motion as first-class tool schemas.

## License & credits

MIT. Built with [MediaPipe Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js), [MediaPipe Gesture Recognizer](https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer/web_js), React, TypeScript, Vite, Vitest, Playwright.

# Devpost submission text (paste-ready)

**Inspiration** — Home workouts get people hurt because nobody is watching their form, and existing AI coaches want your video.

**What it does** — FormCoach measures reps, joint angles, tempo, and form faults with MediaPipe Pose entirely inside the browser tab, then exposes those measurements and the workout controls as WebMCP tools. Any WebMCP-aware agent becomes a coach that sees numbers, never frames.

**How WebMCP is used** — Seven imperative tools plus a declarative plan form; read-only tools annotated so agents can poll freely; write tools gated by a body-gesture confirmation because the user's hands are busy; the tool set changes with the workout phase (idle → set → rest → done); the form handler distinguishes agent submissions from human ones via `SubmitEvent.agentInvoked`.

**Why it needs WebMCP** — The camera stream exists only in the tab. A server-side MCP would have to receive video; here the agent gets a live `getLiveMetrics` contract instead.

**Built with** — MediaPipe Tasks Vision, React, TypeScript, Vite, Vitest, Playwright, Vercel.

**What's next** — Moving the "eyes" into a browser extension so any workout or rehab site can publish its own exercise spec and be coached by the same agent.

---

Submission checklist (03:30 KST):
- [ ] Live URL: human completes one full camera session
- [ ] Repo public, LICENSE, README, PROGRESS.md tidy, `v1.0` tag
- [ ] Video ≤ 3:00 uploaded (YouTube unlisted OK)
- [ ] Devpost form: description above, live URL, repo URL, video URL, 3 screenshots (docs/screenshots/), Built with
- [ ] All teammates registered on the Devpost team

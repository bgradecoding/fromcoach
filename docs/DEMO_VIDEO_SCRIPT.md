# FormCoach — demo video script

**Target edit: 2 minutes 45 seconds. Language: English narration and captions.**

The story: a browser agent creates a workout, reads locally measured results, proposes a change that the person approves with a gesture, and summarizes the session. An open palm resumes the workout during rest without needing a full-body view.

This script uses implemented features. Record the real app and actual browser-agent tool calls. The narration is voice-over; FormCoach itself speaks fixed proposal and completion messages, not this script or LLM-generated coaching.

## Before recording

1. Run `npm run dev` for rehearsal, or open the deployed build for the final take. Use a browser with working WebMCP and an external agent that can call the page's tools. Keep the app and agent conversation visible together.
2. Start from `idle` or `done`. Refresh if needed; this resets the in-memory session. A saved plan may remain, but the first prompt replaces it. Do not use replay URL parameters for the live-camera take.
3. Allow the camera and let the models load. Frame the whole body from the side for squat counting. For approval, face the camera with your head, shoulders, wrists, and hips visible; hold both wrists above your nose for about one second. Then rehearse showing only an open palm during rest. Wait for hand tracking to be ready before the palm shot.
4. Check that `createWorkoutPlan` is available in the browser's site tools. Invoke it through the agent and check that the Agent log source is **agent**, not **bridge**. A WebMCP detection badge alone is not enough to establish this.
5. Record at 1920×1080 or higher, with readable text. Keep the camera view, phase/rep counter, and Agent log in the crop. Record clean voice-over separately; lower app speech while the narrator is speaking.
6. Record the full interaction first, then cut pauses to the timeline below. Keep the proposal → gesture → applied result and palm hold → countdown transitions continuous so the cause is visible. Do not speed up those gesture shots.

## Shot list and spoken script

Times are positions in the final edit, not deadlines for typing or waiting for the agent. Send each prompt only after the previous step's expected state is visible.

| Time | Screen and action | English narration | On-screen caption |
|---|---|---|---|
| 00:00–00:12 | Show the live camera and workout interface. Briefly show the person stepping into position. | “When you're working out, reaching for a keyboard breaks your rhythm. FormCoach connects an AI browser agent to your workout, while you stay in control through gestures.” | **FormCoach · Your workout, connected to an agent** |
| 00:12–00:32 | Send prompt 1 below. Show `createWorkoutPlan`, its `created` result, the 2×3 plan, and the **Created by agent** badge. | “I ask for a short squat session. Through WebMCP, the agent creates a structured plan directly in this tab. The plan and agent activity are visible on the page.” | **Natural language → WebMCP → workout plan** |
| 00:32–00:57 | Send prompt 2. Show the three-second countdown and three controlled squats. Capture actual counter changes and the transition to `rest`. | “The browser processes the camera locally with MediaPipe. It counts repetitions and measures movement. WebMCP exposes those measurements as structured data, so the agent can read the workout state.” | **Camera processing in the browser · Structured tool results** |
| 00:57–01:15 | While resting, send prompt 3. Show `getLiveMetrics`, `getSetHistory`, and the agent's short answer. Crop into actual returned fields; do not insert invented metrics. | “Now the agent reads the completed set and current session. It can summarize recorded reps and form flags, using the same state that drives the interface.” | **Read the live session and completed sets** |
| 01:15–01:44 | Send prompt 4. When the overlay appears, immediately face the camera and raise both hands until accepted. Show `pending` becoming `applied`, then the updated plan. | “For a shorter demo, I ask to reduce the next set to two reps. The agent proposes the change and waits. I raise both hands to accept. The new target applies from the next set. Crossing my arms would decline.” | **Agent proposes → Person approves → Plan updates** |
| 01:44–02:02 | Once back in `rest`, bring only an open hand into view. Hold for one second. Show the progress indicator filling, then the next countdown. | “During rest, I only need my hand in frame. Holding an open palm for one second skips the remaining rest and starts the next countdown.” | **Hand-only rest control · Hold an open palm for 1 second** |
| 02:02–02:21 | Return to the side view during the countdown. Complete the two-rep set. Show the target is now two and the session reaches `done`. | “Body tracking resumes for the next set, with the updated target. When the final set is complete, FormCoach brings up the session results.” | **Updated target · Completed session** |
| 02:21–02:36 | Send prompt 5. Show the set records, summary, and actual agent answer. | “The agent summarizes the recorded sets. The activity log shows which tools it called and their outcomes, so I can follow what happened.” | **Measured results · Visible agent actions** |
| 02:36–02:45 | Hold on the finished app and an end card with the real live URL and repository link. | “FormCoach connects local movement sensing, browser-agent reasoning, and physical consent through WebMCP. The agent helps; the person decides.” | **FormCoach · Built with WebMCP** |

## Copy-and-paste agent prompts

Use these in the external browser-agent conversation attached to the FormCoach tab. They are typed instructions, not voice commands recognized by the app.

### 1. Create the plan

```text
Use this page's WebMCP tools. Call createWorkoutPlan to create a squat plan with 2 sets, 3 reps per set, and 60 seconds rest. Use the note "Short demonstration". Then read the plan back. Keep your answer to one sentence.
```

Expected calls:

```text
createWorkoutPlan({"exercise":"squat","sets":2,"reps":3,"restSec":60,"userNote":"Short demonstration"})
getWorkoutPlan({})
```

Check: `status: "created"`, `createdBy: "agent"`, phase remains `idle`. The native imperative tool is deliberately named `createWorkoutPlan`; `createPlan` is the separate declarative form, which some browsers may not expose.

### 2. Start

```text
Start the first set using the page's WebMCP tool. Keep your answer brief.
```

Expected call: `startSet({})`. Wait for the three-second countdown to finish before moving. Complete three repetitions, then wait for `rest`.

### 3. Read the results

```text
Read getLiveMetrics and getSetHistory. In one sentence, summarize the recorded reps and form flags from the completed set. Use only returned data; do not infer missing measurements or claim improvement.
```

Expected calls: `getLiveMetrics({})`, `getSetHistory({})`. The history should contain the first completed set. While resting, body fields deliberately report no body measurement because the camera is tracking the hand.

### 4. Propose a smaller next set

```text
For a shorter demo, use adjustProgram to reduce the target to 2 reps from the next set, with the reason "Shorter demo requested by the user". Wait for my gesture confirmation and report the actual outcome. Do not approve it for me.
```

Expected call:

```text
adjustProgram({"action":"reduce_reps","reps":2,"reason":"Shorter demo requested by the user"})
```

The overlay lasts up to 20 seconds. Raise both hands as soon as it appears; do not wait for a final chat answer, since the tool is still waiting for you. Only after `applied` and the return to `rest` should you show the open palm. Approval uses body tracking; skipping rest uses hand tracking. They are separate interactions.

### 5. Summarize

```text
Read my completed set history and current metrics. Summarize total recorded reps, completed sets, and observed form flags in two short sentences. Use the returned values only. Do not claim that my form improved unless the data supports it.
```

Expected calls: `getSetHistory({})`, `getLiveMetrics({})`. A clean run of this script records two sets and five reps. Use the actual recorded totals in captions if the take differs. The final set automatically ends the session, so `endSession` is not exposed at `done`.

## Rehearsal and alternate takes

| Situation | What to do |
|---|---|
| Agent response takes too long | Cut waiting time in the edit. While in `rest`, the agent can call `setRest({"seconds":60})` to reset the remaining timer before the next shot. Show any relevant call in the activity log. |
| Proposal times out | The plan stays unchanged. Submit prompt 4 again while in `rest` and capture a fresh proposal and its real acceptance. |
| Body approval is not detected | Face the camera with your head, shoulders, wrists, and hips in frame. Hold both wrists above your nose for about one second. The visible **Accept** button is a working fallback; if used, narrate button approval instead of claiming gesture approval. |
| Hand model is loading or unavailable | Wait until ready or use **Skip rest**. To make the hand-only claim in the main film, capture a successful real palm hold. |
| Counting does not match the intended reps | Adjust the camera view and rehearse again. The edit and narration must agree with the displayed measurements. |
| Session finishes before the final prompt | Use the read tools. Do not ask for `endSession` at `done`. |
| Need to end early | During an active session, ask “End the session and summarize the result.” `endSession({})` returns the summary, including a partial set where applicable. |

### Camera-free rehearsal

Open `http://localhost:5173/?debug=1&replay=none` and use the debug panel's existing fixture controls. Keep a visible caption **“Replay mode — synthetic landmark data”** throughout any footage used from this mode. A replay exercises the measurement and session code; it does not demonstrate live camera recognition.

Use the same real browser-agent prompts above. In `set`, play `squat_10reps_side` at 4× and allow it to finish before the next fixture. In `rest`, play `gesture_open_palm` at 1×. Wait for the next countdown to finish, then play the squat fixture again for the second set. Gesture fixtures must run at 1× so their hold durations are observable.

The confirmation overlay covers the debug panel. For a gesture rehearsal while in `awaiting_confirmation`, feed the fixture from the browser's developer console instead:

```js
await window.__formcoach.replay("gesture_hands_up", 1)
```

This command supplies synthetic sensor frames only. Continue to invoke workout tools through the actual browser agent. Alternatively, use the overlay's Accept button and describe that take as button approval.

The debug bridge and a mocked browser API are useful for automated tests, but are not proof that a live browser agent discovered and invoked WebMCP. Keep real site-tool calls in the filmed WebMCP demonstration.

## Export and submission

Export the edit at approximately 2:45, leaving margin below the strict three-minute limit. Include English voice-over and readable English captions. Replace the end-card placeholders with the actual live URL and [repository URL](https://github.com/bgradecoding/fromcoach); do not submit localhost as the live app. Upload with public visibility on YouTube and review the exported file from beginning to end.

The [official rules](https://webmcp.devpost.com/rules) require a functioning demonstration with audio explaining the product and its WebMCP use, a video under three minutes publicly visible on YouTube, and English materials or translations. See [DEVPOST.md](DEVPOST.md) for the submission checklist.

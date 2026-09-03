# Devpost submission text

## Inspiration

During a home workout, checking a screen and operating controls can interrupt the exercise. We wanted a browser agent that can understand a workout's measured state and help change the plan while the person stays in control through gestures.

## What it does

FormCoach measures repetitions, joint angles, tempo, and rule-based form flags using MediaPipe inside the browser. A WebMCP-capable agent can create a squat or pushup plan, read live metrics and completed sets, control the session, and propose changes. The person accepts or declines those changes with body gestures or buttons. During rest, holding an open palm for one second starts the next set; only the hand needs to be visible.

## How we used WebMCP

Eight imperative tools expose structured workout state and actions. Three read tools use `readOnlyHint`. The page registers only the write tools relevant to the current workout phase and removes them with AbortSignals when that phase changes. `createWorkoutPlan` validates inputs and marks the plan as agent-created; a declarative `createPlan` form also supports browsers with that API.

`adjustProgram` remains pending while the user decides. It returns an applied, rejected, timeout, or cancelled result; ending a session cancels the pending proposal without changing the plan. The visible agent log records each call's source, outcome, and duration.

## Why this fits WebMCP

The agent acts on the user's current browser session through typed tools. It can read measured state, request a concrete adjustment, and receive the person's gesture response. Local camera processing supplies the measurements; WebMCP tool results contain no camera images. This connects a language-based agent to physical interaction without requiring the agent to infer workout state from the screen.

## Built with

WebMCP, MediaPipe Tasks Vision, React, TypeScript, Vite, Vitest, and Playwright.

## What we learned

Reliable tool availability matters as much as tool descriptions. We added an imperative plan-creation path for browsers that did not expose the declarative form, validated inputs at execution time, and made pending requests settle when the session ends. Rest also needs a different camera interaction: recognizing a nearby palm is more practical than requiring a full-body pose.

## What's next

Agent-authored spoken feedback, better measurement-quality guidance, and comparisons between completed sets. These are future work. The current app speaks fixed proposal and completion messages and relies on an external browser agent for reasoning.

## Submission preparation

The [official rules](https://webmcp.devpost.com/rules) specify a deadline of September 3, 2026 at 1:00 p.m. Pacific Time, equivalent to **September 4 at 05:00 KST**. The video must be **under three minutes**, include audio explaining the app and WebMCP use, and be publicly visible on YouTube. Submission materials must be in English or include an English translation.

- [ ] Publish a working live URL and test access from a WebMCP-capable browser. Localhost is for rehearsal only.
- [ ] Ensure the [source repository](https://github.com/bgradecoding/fromcoach) is public, contains the working source and MIT license, and matches the filmed build.
- [ ] Record the [2:45 demo script](DEMO_VIDEO_SCRIPT.md), showing actual agent tool calls and gesture outcomes.
- [ ] Upload the video to YouTube with public visibility; check the final duration is below 3:00.
- [ ] Replace the live-app and video placeholders in README.md.
- [ ] Submit the description, live URL, repository URL, video URL, and representative screenshots on Devpost.
- [ ] Check the team and submission status in Devpost.

The public URL, recording, upload, and Devpost submission remain separate release steps; this document does not assert that they have been completed.

# FormCoach — Claude Code instructions

Read `PLAN.md` first and execute it top to bottom. It contains the full spec, task order, time boxes, and cut rules. `PROGRESS.md` is the running status log for the human team lead.

## Non-negotiables
- One commit per task, then append a line to `PROGRESS.md` (task id, time, open issues).
- Deploy a hello world within the first hour; every later commit must keep the build green.
- Browser WebMCP calls (`document.modelContext` / `navigator.modelContext`) live only in `src/webmcp/adapter.ts`. Everything else uses the adapter and the internal registry.
- Tools never throw. Return `{ status: "error", reason }`.
- Tests run without a camera: fixtures in `fixtures/` + `ReplayPoseSource` + `window.__formcoach` debug bridge.
- UI text, README, and comments in English. Only `PLAN.md` is in Korean.
- No new dependencies beyond the list in `PLAN.md` §3.1 without a note in `PROGRESS.md`.
- Out of scope (do not build): browser extension, second site, accounts/backend, any LLM/VLM call, more than two exercises.

## Commands
- `npm run dev` / `npm run build` / `npm run test` (Vitest) / `npm run e2e` (Playwright, chromium) / `npm run gen:fixtures`
- Debug: `http://localhost:5173/?debug=1&replay=squat_10reps_side&speed=4`

## When stuck
Do not spend more than 5 minutes on a blocker. Apply the task's cut rule from `PLAN.md` §9, note it in `PROGRESS.md`, and continue.

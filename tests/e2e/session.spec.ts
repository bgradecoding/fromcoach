import { expect, test } from "@playwright/test";

/* eslint-disable @typescript-eslint/no-explicit-any */

test("full session via debug bridge (PLAN §7.1)", async ({ page }) => {
  await page.goto("/?debug=1&replay=none");
  await page.waitForFunction(() => !!(window as any).__formcoach);
  await page.evaluate(() => localStorage.removeItem("formcoach.plan.v1"));
  await page.reload();
  await page.waitForFunction(() => !!(window as any).__formcoach);

  // 1. idle exposes exactly the read tools + plan creation + startSet
  const idleTools = await page.evaluate(() =>
    (window as any).__formcoach.listTools().map((t: any) => t.name).sort(),
  );
  expect(idleTools).toEqual(["createWorkoutPlan", "getLiveMetrics", "getSetHistory", "getWorkoutPlan", "startSet"]);

  // 2. the declarative form creates a plan attributed to the human
  await page.fill('input[name="reps"]', "10");
  await page.fill('input[name="userNote"]', "left knee is sensitive");
  await page.click('form[toolname="createPlan"] button[type="submit"]');
  const plan = await page.evaluate(() => (window as any).__formcoach.callTool("getWorkoutPlan"));
  expect(plan.createdBy).toBe("user");
  expect(plan.blocks[0]).toMatchObject({ exercise: "squat", reps: 10 });
  expect(plan.userNote).toBe("left knee is sensitive");

  // 3. startSet → countdown → set; tools change with the phase
  const started = await page.evaluate(() => (window as any).__formcoach.callTool("startSet"));
  expect(started).toMatchObject({ status: "started", exercise: "squat", targetReps: 10 });
  await page.waitForFunction(() => (window as any).__formcoach.phase() === "set", undefined, {
    timeout: 6000,
  });
  const setTools = await page.evaluate(() =>
    (window as any).__formcoach.listTools().map((t: any) => t.name).sort(),
  );
  expect(setTools).toContain("adjustProgram");
  expect(setTools).toContain("setRest");
  expect(setTools).toContain("endSession");
  expect(setTools).not.toContain("startSet");
  expect(setTools).not.toContain("createWorkoutPlan");

  // replaying 10 squat reps completes the 10-rep set → rest
  await page.evaluate(() => (window as any).__formcoach.replay("squat_10reps_side", 8));
  await page.waitForFunction(() => (window as any).__formcoach.phase() === "rest", undefined, {
    timeout: 15000,
  });
  const history = await page.evaluate(() => (window as any).__formcoach.callTool("getSetHistory"));
  expect(history).toHaveLength(1);
  expect(history[0]).toMatchObject({ reps: 10, target: 10, exercise: "squat" });

  // 4. adjustProgram resolves only after the hands-up gesture
  await page.evaluate(() => (window as any).__formcoach.setConfirmTimeoutMs(8000));
  const appliedPromise = page.evaluate(() =>
    (window as any).__formcoach.callTool("adjustProgram", {
      action: "swap_exercise",
      exercise: "goblet_squat",
      reason: "test",
    }),
  );
  await page.waitForFunction(() => (window as any).__formcoach.phase() === "awaiting_confirmation");
  await page.evaluate(() => (window as any).__formcoach.replay("gesture_hands_up", 1));
  expect(await appliedPromise).toMatchObject({ status: "applied" });
  const planAfter = await page.evaluate(() => (window as any).__formcoach.callTool("getWorkoutPlan"));
  expect(planAfter.blocks[0].exercise).toBe("goblet_squat");

  // 5a. crossing arms rejects
  const rejectedPromise = page.evaluate(() =>
    (window as any).__formcoach.callTool("adjustProgram", { action: "add_set", reason: "test" }),
  );
  await page.waitForFunction(() => (window as any).__formcoach.phase() === "awaiting_confirmation");
  await page.evaluate(() => (window as any).__formcoach.replay("gesture_arms_crossed", 1));
  expect(await rejectedPromise).toMatchObject({ status: "rejected" });

  // 5b. no gesture times out
  await page.evaluate(() => (window as any).__formcoach.setConfirmTimeoutMs(2000));
  const timedOut = await page.evaluate(() =>
    (window as any).__formcoach.callTool("adjustProgram", { action: "reduce_reps", reps: 8, reason: "test" }),
  );
  expect(timedOut).toMatchObject({ status: "timeout" });

  // 6. endSession returns the summary and lands in the log UI
  const summary = await page.evaluate(() => (window as any).__formcoach.callTool("endSession"));
  expect(summary.totalReps).toBe(10);
  expect(summary.sets).toBe(1);
  await expect(page.locator(".agent-log")).toContainText("endSession");

  // done: read tools and plan creation remain; unavailable tools error instead of throwing
  const doneTools = await page.evaluate(() =>
    (window as any).__formcoach.listTools().map((t: any) => t.name).sort(),
  );
  expect(doneTools).toEqual(["createWorkoutPlan", "getLiveMetrics", "getSetHistory", "getWorkoutPlan"]);
  const unavailable = await page.evaluate(() => (window as any).__formcoach.callTool("startSet"));
  expect(unavailable).toMatchObject({ status: "error" });
});

test("demo sequence: agent plan, gesture approval, palm rest skip, final results", async ({ page }) => {
  await page.goto("/?debug=1&replay=none");
  await page.waitForFunction(() => !!(window as any).__formcoach);
  // Synthetic frames verify the filmed sequence's state transitions, not camera recognition.
  await page.evaluate(() => (window as any).__formcoach.callTool("createWorkoutPlan", {
    exercise: "pushup", sets: 2, reps: 3, restSec: 60, userNote: "Short demonstration",
  }));
  await expect(page.locator(".agent-badge")).toHaveText("Created by agent");
  await page.evaluate(() => (window as any).__formcoach.callTool("startSet"));
  await page.waitForFunction(() => (window as any).__formcoach.phase() === "set");
  await page.evaluate(() => (window as any).__formcoach.replay("pushup_5reps_side", 4));
  expect(await page.evaluate(() => (window as any).__formcoach.callTool("getLiveMetrics")))
    .toMatchObject({ phase: "rest", trackingMode: "palm", personDetected: false });

  const proposal = page.evaluate(() => (window as any).__formcoach.callTool("adjustProgram", {
    action: "reduce_reps", reps: 2, reason: "Shorter demo requested by the user",
  }));
  await expect(page.locator(".proposal-title")).toHaveText("Reduce the target to 2 reps from the next set");
  await page.evaluate(() => (window as any).__formcoach.replay("gesture_hands_up", 1));
  expect(await proposal).toMatchObject({ status: "applied" });
  await expect(page.locator(".proposal-backdrop")).toHaveCount(0);

  await page.evaluate(() => (window as any).__formcoach.replay("gesture_open_palm", 1));
  expect(await page.evaluate(() => (window as any).__formcoach.phase())).toBe("countdown");
  await page.waitForFunction(() => (window as any).__formcoach.phase() === "set");
  expect(await page.evaluate(() => (window as any).__formcoach.callTool("getLiveMetrics")))
    .toMatchObject({ targetReps: 2, trackingMode: "pose" });
  await page.evaluate(() => (window as any).__formcoach.replay("pushup_5reps_side", 4));
  expect(await page.evaluate(() => (window as any).__formcoach.phase())).toBe("done");
  const history = await page.evaluate(() => (window as any).__formcoach.callTool("getSetHistory"));
  expect(history).toMatchObject([{ reps: 3, target: 3 }, { reps: 2, target: 2 }]);
  expect(history.reduce((total: number, set: any) => total + set.reps, 0)).toBe(5);
});

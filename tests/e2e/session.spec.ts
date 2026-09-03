import { expect, test } from "@playwright/test";

/* eslint-disable @typescript-eslint/no-explicit-any */

test("full session via debug bridge (PLAN §7.1)", async ({ page }) => {
  await page.goto("/?debug=1&replay=none");
  await page.waitForFunction(() => !!(window as any).__formcoach);
  await page.evaluate(() => localStorage.removeItem("formcoach.plan.v1"));
  await page.reload();
  await page.waitForFunction(() => !!(window as any).__formcoach);

  // 1. idle exposes exactly the read tools + startSet
  const idleTools = await page.evaluate(() =>
    (window as any).__formcoach.listTools().map((t: any) => t.name).sort(),
  );
  expect(idleTools).toEqual(["getLiveMetrics", "getSetHistory", "getWorkoutPlan", "startSet"]);

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

  // done: only read tools remain; unavailable tools error instead of throwing
  const doneTools = await page.evaluate(() =>
    (window as any).__formcoach.listTools().map((t: any) => t.name).sort(),
  );
  expect(doneTools).toEqual(["getLiveMetrics", "getSetHistory", "getWorkoutPlan"]);
  const unavailable = await page.evaluate(() => (window as any).__formcoach.callTool("startSet"));
  expect(unavailable).toMatchObject({ status: "error" });
});

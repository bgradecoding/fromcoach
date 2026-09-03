import { expect, test } from "@playwright/test";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Verifies the document.modelContext integration path with a mock API:
// registration mirrors the internal registry, results are wrapped MCP-style,
// and AbortSignal unregistration tracks phase changes.
test("browser API path via mocked document.modelContext", async ({ page }) => {
  await page.addInitScript(() => {
    const tools = new Map<string, any>();
    (document as any).modelContext = {
      registerTool(def: any, opts: { signal?: AbortSignal } | undefined) {
        tools.set(def.name, def);
        opts?.signal?.addEventListener("abort", () => tools.delete(def.name));
      },
    };
    (window as any).__mockMC = {
      list: () => [...tools.keys()].sort(),
      call: (name: string, input: unknown) => tools.get(name).execute(input, {}),
      annotations: (name: string) => tools.get(name).annotations ?? null,
    };
  });

  await page.goto("/?debug=1&replay=none");
  await page.waitForFunction(() => !!(window as any).__formcoach);
  await page.evaluate(() => localStorage.removeItem("formcoach.plan.v1"));
  await page.reload();
  await page.waitForFunction(() => !!(window as any).__formcoach);

  // the adapter announces the detected API in the agent log UI
  await expect(page.locator(".agent-log")).toContainText("document.modelContext detected");

  // browser API sees exactly what the internal registry sees
  const both = await page.evaluate(() => ({
    mock: (window as any).__mockMC.list(),
    internal: (window as any).__formcoach.listTools().map((t: any) => t.name).sort(),
  }));
  expect(both.mock).toEqual(both.internal);
  expect(both.mock).toEqual(["createWorkoutPlan", "getLiveMetrics", "getSetHistory", "getWorkoutPlan", "startSet"]);

  // annotations reach the browser API
  const annotations = await page.evaluate(() => (window as any).__mockMC.annotations("getLiveMetrics"));
  expect(annotations).toMatchObject({ readOnlyHint: true });

  // execute through the browser API returns MCP-style content
  const metricsResult = await page.evaluate(() => (window as any).__mockMC.call("getLiveMetrics", {}));
  expect(metricsResult.content[0].type).toBe("text");
  const metrics = JSON.parse(metricsResult.content[0].text);
  expect(metrics.phase).toBe("idle");

  // Plan creation works through the registered API without declarative form support.
  const createdResult = await page.evaluate(() => (window as any).__mockMC.call("createWorkoutPlan", {
    exercise: "squat", sets: 3, reps: 10, restSec: 90, userNote: "left knee is sensitive",
  }));
  const created = JSON.parse(createdResult.content[0].text);
  expect(created).toMatchObject({
    status: "created",
    plan: {
      createdBy: "agent",
      userNote: "left knee is sensitive",
      blocks: [{ exercise: "squat", sets: 3, reps: 10, restSec: 90 }],
    },
  });
  const planResult = await page.evaluate(() => (window as any).__mockMC.call("getWorkoutPlan", {}));
  expect(JSON.parse(planResult.content[0].text)).toEqual(created.plan);
  await expect(page.locator(".agent-badge")).toHaveText("Created by agent");

  // a write tool through the browser API drives the session, and the
  // AbortSignal-based unregistration swaps the tool set on phase change
  const startResult = await page.evaluate(() => (window as any).__mockMC.call("startSet", {}));
  expect(JSON.parse(startResult.content[0].text)).toMatchObject({ status: "started", targetReps: 10 });
  await page.waitForFunction(() => (window as any).__formcoach.phase() === "set", undefined, {
    timeout: 6000,
  });
  const setViewOfMock = await page.evaluate(() => (window as any).__mockMC.list());
  expect(setViewOfMock).toContain("adjustProgram");
  expect(setViewOfMock).not.toContain("startSet");
  expect(setViewOfMock).not.toContain("createWorkoutPlan");

  // Ending the session makes native plan creation available for a fresh session.
  await page.evaluate(() => (window as any).__mockMC.call("endSession", {}));
  expect(await page.evaluate(() => (window as any).__mockMC.list()))
    .toEqual(["createWorkoutPlan", "getLiveMetrics", "getSetHistory", "getWorkoutPlan"]);
  const nextPlanResult = await page.evaluate(() => (window as any).__mockMC.call("createWorkoutPlan", {
    exercise: "pushup", sets: 2, reps: 8, restSec: 60,
  }));
  expect(JSON.parse(nextPlanResult.content[0].text)).toMatchObject({ status: "created", plan: { createdBy: "agent" } });
  const nextMetricsResult = await page.evaluate(() => (window as any).__mockMC.call("getLiveMetrics", {}));
  expect(JSON.parse(nextMetricsResult.content[0].text).phase).toBe("idle");

  // the call shows up in the agent log attributed to the browser agent
  await expect(page.locator(".agent-log")).toContainText("agent");
});

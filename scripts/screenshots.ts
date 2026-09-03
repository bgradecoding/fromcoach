// Captures README/Devpost screenshots from a running dev server (port 5173).
// Run: npx tsx scripts/screenshots.ts
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:5173";
const OUT = "docs/screenshots";

/* eslint-disable @typescript-eslint/no-explicit-any */
async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
  await page.goto(`${BASE}/?replay=none`);
  await page.waitForFunction(() => !!(window as any).__formcoach);
  await page.evaluate(() => localStorage.removeItem("formcoach.plan.v1"));
  await page.reload();
  await page.waitForFunction(() => !!(window as any).__formcoach);

  page.on("framenavigated", (f) => console.log("navigated:", f.url()));

  // plan via the declarative form
  await page.fill('input[name="userNote"]', "left knee is sensitive");
  await page.click('form[toolname="createPlan"] button[type="submit"]');
  await page.waitForSelector(".plan-block"); // plan created

  // start a set and play the valgus fixture; catch it mid-set
  await page.evaluate(async () => await (window as any).__formcoach.callTool("startSet"));
  await page.waitForFunction(() => (window as any).__formcoach.phase() === "set", undefined, {
    timeout: 6000,
  });
  await page.evaluate(() => {
    void (window as any).__formcoach.replay("squat_3valgus_front", 1);
  });
  await page.waitForTimeout(5200); // ~1.7 reps in, first valgus flagged
  await page.screenshot({ path: `${OUT}/set-live.png` });

  // proposal overlay
  await page.evaluate(() => (window as any).__formcoach.setConfirmTimeoutMs(20000));
  await page.evaluate(() => {
    void (window as any).__formcoach.callTool("adjustProgram", {
      action: "swap_exercise",
      exercise: "goblet_squat",
      reason: "Your knees keep caving in — goblet squats will keep you safer.",
    });
  });
  await page.waitForFunction(
    () => (window as any).__formcoach.phase() === "awaiting_confirmation",
  );
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/proposal.png` });

  // accept, finish, summary
  await page.evaluate(async () => await (window as any).__formcoach.replay("gesture_hands_up", 2));
  await page.evaluate(async () => await (window as any).__formcoach.callTool("endSession"));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/summary.png` });

  await browser.close();
  console.log(`wrote ${OUT}/set-live.png, proposal.png, summary.png`);
}

void main();

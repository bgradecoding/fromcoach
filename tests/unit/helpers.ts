import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Fixture, Landmark } from "../../src/pose/types";

export function loadFixture(name: string): Fixture {
  return JSON.parse(
    readFileSync(join(process.cwd(), "fixtures", `${name}.json`), "utf8"),
  ) as Fixture;
}

export function blankPose(): Landmark[] {
  return Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.9,
  }));
}

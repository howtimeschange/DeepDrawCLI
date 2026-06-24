import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ExecutionPlan } from "./approval.js";

function planFilename(planId: string): string {
  return path.win32.basename(path.posix.basename(`${planId}.json`));
}

export function writeExecutionPlan(dir: string, plan: ExecutionPlan): string {
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, planFilename(plan.id));
  writeFileSync(file, `${JSON.stringify(plan, null, 2)}\n`);
  return file;
}

type JsonRecord = Record<string, unknown>;

export type BalabalaWorkflowMode = "test" | "production";

export interface BalabalaTestTarget {
  sourceSpu: string;
  targetSpu: string;
}

export interface BalabalaRemoteTarget extends BalabalaTestTarget {
  mode: BalabalaWorkflowMode;
  userSpecifiedTargetSpu: string;
}

export const DEFAULT_BALABALA_TEST_TARGETS: readonly BalabalaTestTarget[] = Object.freeze([
  Object.freeze({ sourceSpu: "204426140121", targetSpu: "204426140121-test" }),
]);

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string {
  return value === undefined || value === null ? "" : typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function isFormalSpu(value: string): boolean {
  return /^\d{12,}$/.test(value);
}

function isTestSpu(value: string): boolean {
  return /^\d{12,}-test$/.test(value);
}

/**
 * Parses only a small, non-secret local policy document.  Example:
 * { "targets": [{ "sourceSpu": "202426107128", "targetSpu": "202426107128-test" }] }
 */
export function parseBalabalaTestTargets(input: unknown): BalabalaTestTarget[] {
  const root = isRecord(input) ? input : {};
  const items = Array.isArray(input) ? input : Array.isArray(root.targets) ? root.targets : undefined;
  if (!items) throw new Error("Balabala test config requires a targets array");
  const targets = items.map((item, index) => {
    if (!isRecord(item)) throw new Error(`Balabala test config target ${index + 1} must be an object`);
    const sourceSpu = text(item.sourceSpu ?? item.source_spu);
    const targetSpu = text(item.targetSpu ?? item.target_spu);
    if (!isFormalSpu(sourceSpu)) throw new Error(`Balabala test config target ${index + 1} sourceSpu must be an explicit formal numeric SPU`);
    if (!isTestSpu(targetSpu)) throw new Error(`Balabala test config target ${index + 1} targetSpu must be an explicit numeric -test SPU`);
    return { sourceSpu, targetSpu };
  });
  if (new Set(targets.map((target) => target.targetSpu)).size !== targets.length) throw new Error("Balabala test config has duplicate targetSpu entries");
  return targets;
}

export function resolveBalabalaRemoteTarget(input: {
  mode: BalabalaWorkflowMode;
  userSpecifiedTargetSpu: string;
  testTargets?: readonly BalabalaTestTarget[];
}): BalabalaRemoteTarget {
  const targetSpu = input.userSpecifiedTargetSpu.trim();
  if (input.mode === "production") {
    if (!isFormalSpu(targetSpu)) throw new Error("balabala production mode requires --spu to be one explicit formal numeric SPU (without -test)");
    return { mode: "production", sourceSpu: targetSpu, targetSpu, userSpecifiedTargetSpu: targetSpu };
  }

  const target = (input.testTargets ?? DEFAULT_BALABALA_TEST_TARGETS).find((item) => item.targetSpu === targetSpu);
  if (!target) throw new Error(`balabala test mode only permits configured exact targetSpu ${targetSpu || "(missing)"}`);
  return { mode: "test", ...target, userSpecifiedTargetSpu: targetSpu };
}

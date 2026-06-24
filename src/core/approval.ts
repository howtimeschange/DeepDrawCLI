import { findApiDefinition } from "./api-registry.js";
import { redactSensitive } from "./redact.js";
import type { ApiRiskLevel } from "./types.js";

export interface ApprovalDecision {
  allowed: boolean;
  reason: string | null;
}

export interface ExecutionPlan {
  id: string;
  api: string;
  tenant: string;
  riskLevel: ApiRiskLevel;
  requiresApproval: boolean;
  summary: string;
  sanitizedParams: unknown;
  createdAt: string;
}

export function enforceApproval(input: {
  apiName: string;
  argv: string[];
  interactive: boolean;
}): ApprovalDecision {
  const api = findApiDefinition(input.apiName);
  if (!api) return { allowed: false, reason: `Unknown DeepDraw API: ${input.apiName}` };
  if (!api.approvalRequired) return { allowed: true, reason: null };
  if (input.argv.includes("--plan")) return { allowed: false, reason: "plan_requested" };
  if (input.argv.includes("--yes")) return { allowed: true, reason: null };
  return { allowed: false, reason: "approval_required" };
}

export function createExecutionPlan(input: {
  apiName: string;
  tenant: string;
  params: Record<string, unknown>;
}): ExecutionPlan {
  const api = findApiDefinition(input.apiName);
  if (!api) {
    throw new Error(`Unknown DeepDraw API: ${input.apiName}`);
  }

  return {
    id: `${Date.now()}-${api.apiName.replaceAll(".", "-")}`,
    api: api.apiName,
    tenant: input.tenant,
    riskLevel: api.riskLevel,
    requiresApproval: api.approvalRequired,
    summary: `${api.title} (${api.apiName})`,
    sanitizedParams: redactSensitive(input.params),
    createdAt: new Date().toISOString(),
  };
}

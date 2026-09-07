import type { WorkflowField } from "../workflow/types.js";

export interface BrandPlugin {
  id: string;
  importSources(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  selectTrade(context: Record<string, unknown>, trades: unknown[]): Record<string, unknown>;
  buildFields(context: Record<string, unknown>, template: Record<string, unknown>): WorkflowField[];
  buildSizeTables(context: Record<string, unknown>, template: Record<string, unknown>): WorkflowField[];
  buildAiPlan(context: Record<string, unknown>, fields: WorkflowField[]): Record<string, unknown>;
  buildPayload(context: Record<string, unknown>, stage: "create" | "update" | "incremental"): Record<string, unknown>;
  prepareExistingUpdate(context: Record<string, unknown>, resource: Record<string, unknown>): Record<string, unknown>;
  compareReadback(context: Record<string, unknown>, resource: Record<string, unknown>, expected: Record<string, unknown>): Record<string, unknown>;
}

import { auditAiResponses } from "./ai-audit.js";
import { buildBalabalaFields } from "./fields.js";
import { importBalabalaSources } from "./importers.js";
import { compareBalabalaReadback, prepareBalabalaExistingUpdate } from "./readback.js";
import { buildBalabalaSizeTables } from "./size-charts.js";
import { selectBalabalaTrade } from "./trade-selection.js";
import type { BrandPlugin } from "../types.js";

/**
 * Brand-only policy. The workflow engine owns files, templates, approvals and
 * DeepDraw calls so another brand can replace this object without inheriting
 * Balabala source aliases or size rules.
 */
export const balabalaPlugin: BrandPlugin = {
  id: "balabala",
  importSources: async (input) => importBalabalaSources(input as unknown as Parameters<typeof importBalabalaSources>[0]),
  selectTrade: (context, trades) => selectBalabalaTrade(context, trades) as unknown as Record<string, unknown>,
  buildFields: (context, template) => buildBalabalaFields(context, template),
  buildSizeTables: (context, template) => buildBalabalaSizeTables(context, template),
  buildAiPlan: (_context, fields) => ({
    fields: fields.filter((field) => field.active !== false && field.validationStatus !== "valid").map((field) => ({ fieldId: field.fieldId, fieldName: field.fieldName, fieldType: field.fieldType, sourceType: field.sourceType })),
    policy: "AI only proposes current-template enum values; it cannot fill SKU, price, compliance, barcode, or size-chart facts.",
  }),
  buildPayload: (context, stage) => ({ ...context, stage }),
  prepareExistingUpdate: (context, resource) => prepareBalabalaExistingUpdate(context, resource),
  compareReadback: (context, resource, expected) => compareBalabalaReadback(expected, resource) as unknown as Record<string, unknown>,
};

export { auditAiResponses };

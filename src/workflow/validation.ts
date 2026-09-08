import type { WorkflowSnapshot } from "./types.js";
import { balabalaListPrice } from "../brands/balabala/prices.js";

type JsonRecord = Record<string, unknown>;
const record = (value: unknown): JsonRecord => value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
const text = (value: unknown): string => value == null ? "" : String(value).trim();
const key = (value: unknown): string => text(value).replace(/[\s()（）:：]/g, "").toLowerCase();
const yes = (value: unknown): boolean => value === true || value === 1 || value === "true" || value === "1";
const present = (value: unknown): boolean => value !== undefined && value !== null && (typeof value === "object" ? Object.keys(value).length > 0 : text(value) !== "");

/** Run before credentials, planning or any pre-read; repeat after merging a form snapshot. */
export function assertWorkflowPublishable(snapshot: WorkflowSnapshot, stage: "create" | "full-update" | "incremental"): void {
  const errors = [...snapshot.blocking, ...snapshot.manual].map((item) => item.message);
  if (["imported", "review_required", "failed", "transport_unknown"].includes(snapshot.state)) errors.push(`workflow state ${snapshot.state} is not publishable`);
  const templates = (Array.isArray(snapshot.template.fields) ? snapshot.template.fields : Array.isArray(snapshot.draft.templateFields) ? snapshot.draft.templateFields : []).map(record);
  if (stage !== "incremental" && templates.length === 0) errors.push("current trade template required before create/full-update");
  const raw = snapshot.draft.fields;
  const fields = Array.isArray(raw) ? Object.fromEntries(raw.map(record).map((field) => [key(field.field_name ?? field.fieldName ?? field.name), field.value_json ?? field.valueJson ?? field.value_text ?? field.valueText ?? field.value])) : Object.fromEntries(Object.entries(record(raw)).map(([name, value]) => [key(name), value]));
  const audit = (Array.isArray(snapshot.audit.fields) ? snapshot.audit.fields : []).map(record);
  for (const template of templates) {
    const name = key(template.fieldName ?? template.field_name ?? template.name);
    const attributes = record(template.attributes);
    const decision = audit.find((field) => key(field.fieldName) === name);
    if (decision?.active === false && decision.validationStatus === "skipped") continue;
    const required = yes(template.required ?? template.is_required ?? attributes.isRequired);
    const sale = yes(template.saleProp ?? template.isSaleProp ?? template.sale_prop ?? attributes.isSaleProp);
    if ((required || (stage !== "incremental" && sale)) && !present(fields[name])) errors.push(`required/sale field missing: ${name}`);
  }
  if (stage !== "incremental" && Array.isArray(snapshot.normalized.skus) && snapshot.normalized.skus.length > 0) {
    if (!balabalaListPrice(snapshot.normalized)) errors.push("MDM 导入表挂牌单价缺失或同款不一致，不能用计划价替代");
    const sourceSkus = snapshot.normalized.skus.map(record);
    const draftSkus = Array.isArray(snapshot.draft.skus) ? snapshot.draft.skus.map(record) : [];
    if (draftSkus.length !== sourceSkus.length) errors.push("draft SKU count differs from imported MDM SKU set");
  }
  if (errors.length) throw new Error(`balabala publish blocked: ${[...new Set(errors)].join("; ")}`);
}

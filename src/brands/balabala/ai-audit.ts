type JsonRecord = Record<string, unknown>;

export interface AuditResult {
  accepted: JsonRecord[];
  rejected: Array<JsonRecord & { reason: string }>;
}

const FACT_FIELD = /执行(?:标准|规范)|安全(?:等级|类别)|^(?:产品|商品)?(?:名称|品名|货号|款号|型号|编码|条码)$|生产|制造|产地|原产|上市日期|生产日期|价格|重量|容量|尺寸|规格|尺码表|充绒量|商家sku/i;

function record(value: unknown): JsonRecord { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {}; }
function text(value: unknown): string { return value === undefined || value === null ? "" : typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value).trim() : ""; }
function compact(value: unknown): string { return text(value).replace(/[\s()（）:：]/g, "").toLowerCase(); }
function options(field: JsonRecord): string[] { const raw = field.options ?? field.options_json ?? field.optionsJson; return Array.isArray(raw) ? raw.map((value) => { const item = record(value); return text(typeof value === "object" ? item.name ?? item.value ?? item.label ?? item.text : value); }).filter(Boolean) : []; }

/** Audits provider output only. This module deliberately does not call an AI/OCR network service. */
export function auditAiResponses(planInput: Record<string, unknown>, responses: unknown[]): AuditResult {
  const plan = record(planInput);
  const fields = Array.isArray(plan.fields) ? plan.fields.map(record) : [];
  const accepted: JsonRecord[] = [];
  const rejected: Array<JsonRecord & { reason: string }> = [];
  for (const raw of responses) {
    const response = record(raw);
    const id = text(response.fieldId ?? response.field_id);
    const name = text(response.fieldName ?? response.field_name ?? response.name);
    const field = fields.find((item) => (id && text(item.fieldId ?? item.field_id ?? item.id) === id) || (!id && compact(item.fieldName ?? item.field_name ?? item.name) === compact(name)));
    const reject = (reason: string) => rejected.push({ ...response, reason });
    if (!field) { reject("field_not_in_current_template"); continue; }
    const fieldName = text(field.fieldName ?? field.field_name ?? field.name);
    if (field.active === false) { reject("inactive_child_field"); continue; }
    if (field.manualOverride === true || field.manual_override === true) { reject("manual_override"); continue; }
    if (FACT_FIELD.test(fieldName)) { reject("fact_field_not_ai_fillable"); continue; }
    const permitted = options(field);
    if (permitted.length === 0) { reject("template_enum_required"); continue; }
    const confidence = Number(response.confidence);
    if (!Number.isFinite(confidence) || confidence < 0.7) { reject("confidence_below_0_7"); continue; }
    const evidence = Array.isArray(response.evidence) ? response.evidence.map(text).filter(Boolean) : [];
    if (evidence.length === 0) { reject("evidence_required"); continue; }
    const value = text(response.value ?? response.valueText ?? response.value_text);
    const values = value.split(/[;；]/).filter(Boolean);
    if (values.length === 0 || !values.every((item) => permitted.some((option) => compact(option) === compact(item)))) { reject("value_not_in_current_template_enum"); continue; }
    accepted.push({ fieldId: text(field.fieldId ?? field.field_id ?? field.id), fieldName, value, confidence, evidence, sourceType: "ai" });
  }
  return { accepted, rejected };
}

export function auditOcrFacts(images: Array<Record<string, unknown>>, facts: unknown[]): AuditResult {
  const accepted: JsonRecord[] = [];
  const rejected: Array<JsonRecord & { reason: string }> = [];
  const known = new Set(images.map((image) => text(image.sha256)).filter(Boolean));
  for (const raw of facts) {
    const fact = record(raw);
    const imageSha256 = text(fact.imageSha256 ?? fact.image_sha256);
    if (!known.has(imageSha256)) { rejected.push({ ...fact, reason: "image_evidence_not_in_manifest" }); continue; }
    const confidence = Number(fact.confidence);
    if (!Number.isFinite(confidence) || confidence < 0.7) { rejected.push({ ...fact, reason: "confidence_below_0_7" }); continue; }
    if (!text(fact.text ?? fact.ocrText ?? fact.ocr_text)) { rejected.push({ ...fact, reason: "ocr_text_evidence_required" }); continue; }
    if (!text(fact.fieldName ?? fact.field_name) || !text(fact.value)) { rejected.push({ ...fact, reason: "field_and_value_required" }); continue; }
    accepted.push({ ...fact, sourceType: "ocr" });
  }
  return { accepted, rejected };
}

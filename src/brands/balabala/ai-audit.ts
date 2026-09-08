type JsonRecord = Record<string, unknown>;

export interface AuditResult {
  accepted: JsonRecord[];
  rejected: Array<JsonRecord & { reason: string }>;
}

const FACT_FIELD = /执行(?:标准|规范)|安全(?:等级|类别)|^(?:产品|商品)?(?:名称|品名|货号|款号|型号|编码|条码)$|生产|制造|产地|原产|上市日期|生产日期|价格|重量|容量|尺寸|规格|尺码表|充绒量|填充|含绒|绒子|商家sku/i;
const IMAGE_ROLE_ORDER: Record<string, number> = { flat_image: 0, main_image: 1, model_image: 2, reference: 3, hangtag: 4, washlabel: 5 };

function record(value: unknown): JsonRecord { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {}; }
function text(value: unknown): string { return value === undefined || value === null ? "" : typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value).trim() : ""; }
function compact(value: unknown): string { return text(value).replace(/[\s()（）:：]/g, "").toLowerCase(); }
function options(field: JsonRecord): string[] { const raw = field.options ?? field.options_json ?? field.optionsJson; return Array.isArray(raw) ? raw.map((value) => { const item = record(value); return text(typeof value === "object" ? item.name ?? item.value ?? item.label ?? item.text : value); }).filter(Boolean) : []; }

/**
 * Produces an auditable local request for a multimodal reviewer.  It is not an
 * inference engine or provider call: the caller supplies the reviewed JSON to
 * `auditAiResponses`, which checks the same current template again.  This
 * keeps image-derived suggestions from becoming product facts by accident.
 */
export function buildLocalVisionReviewPlan(imagesInput: unknown, fieldsInput: unknown): JsonRecord {
  const images = Array.isArray(imagesInput) ? imagesInput.map(record) : [];
  const imagesForModel = images
    .filter((image) => /^image\/(?:jpeg|png|webp)$/i.test(text(image.mimeType ?? image.mime_type)) && Number(image.bytes) <= 4 * 1024 * 1024)
    .sort((left, right) => (IMAGE_ROLE_ORDER[text(left.role)] ?? 99) - (IMAGE_ROLE_ORDER[text(right.role)] ?? 99) || text(left.path).localeCompare(text(right.path)))
    .slice(0, 4)
    .map((image) => ({ path: text(image.path), sha256: text(image.sha256), role: text(image.role), mimeType: text(image.mimeType ?? image.mime_type), bytes: Number(image.bytes) }));
  const candidates = (Array.isArray(fieldsInput) ? fieldsInput : []).map(record)
    .filter((field) => field.active !== false && field.manualOverride !== true && field.manual_override !== true)
    .filter((field) => !FACT_FIELD.test(text(field.fieldName ?? field.field_name ?? field.name)))
    .map((field) => ({ fieldId: text(field.fieldId ?? field.field_id ?? field.id), fieldName: text(field.fieldName ?? field.field_name ?? field.name), options: options(field), validationStatus: text(field.validationStatus) }))
    .filter((field) => field.fieldName && field.options.length > 0 && field.validationStatus !== "valid");
  return {
    images: imagesForModel,
    candidates,
    policy: "Use only visible evidence. Return current-template enum values with confidence >= 0.7 and imageSha256. Do not infer or fill SKU, color, sales size, size table, barcode, price, production, origin, compliance, or filling facts.",
  };
}

/** Audits provider output only. This module deliberately does not call an AI/OCR network service. */
export function auditAiResponses(planInput: Record<string, unknown>, responses: unknown[]): AuditResult {
  const plan = record(planInput);
  const fields = Array.isArray(plan.fields) ? plan.fields.map(record) : [];
  const allowedImages = new Set((Array.isArray(plan.images) ? plan.images : []).map(record).map((image) => text(image.sha256)).filter(Boolean));
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
    const imageSha256 = text(response.imageSha256 ?? response.image_sha256);
    if (allowedImages.size > 0 && (!imageSha256 || !allowedImages.has(imageSha256))) { reject("image_evidence_not_in_vision_plan"); continue; }
    const value = text(response.value ?? response.valueText ?? response.value_text);
    const values = value.split(/[;；]/).filter(Boolean);
    if (values.length === 0 || !values.every((item) => permitted.some((option) => compact(option) === compact(item)))) { reject("value_not_in_current_template_enum"); continue; }
    accepted.push({ fieldId: text(field.fieldId ?? field.field_id ?? field.id), fieldName, value, confidence, evidence, ...(imageSha256 ? { imageSha256 } : {}), sourceType: "ai" });
  }
  return { accepted, rejected };
}

export function auditOcrFacts(images: Array<Record<string, unknown>>, facts: unknown[], templateFields?: unknown[]): AuditResult {
  const accepted: JsonRecord[] = [];
  const rejected: Array<JsonRecord & { reason: string }> = [];
  const known = new Set(images.map((image) => text(image.sha256)).filter(Boolean));
  const currentFields = (templateFields ?? []).map(record);
  for (const raw of facts) {
    const fact = record(raw);
    const imageSha256 = text(fact.imageSha256 ?? fact.image_sha256);
    if (!known.has(imageSha256)) { rejected.push({ ...fact, reason: "image_evidence_not_in_manifest" }); continue; }
    const confidence = Number(fact.confidence);
    if (!Number.isFinite(confidence) || confidence < 0.7) { rejected.push({ ...fact, reason: "confidence_below_0_7" }); continue; }
    const ocrText = text(fact.text ?? fact.ocrText ?? fact.ocr_text);
    if (!ocrText) { rejected.push({ ...fact, reason: "ocr_text_evidence_required" }); continue; }
    const fieldName = text(fact.fieldName ?? fact.field_name);
    const fieldId = text(fact.fieldId ?? fact.field_id);
    if (!fieldName || !text(fact.value)) { rejected.push({ ...fact, reason: "field_and_value_required" }); continue; }
    if (/颜色|尺码|商家sku|条码|价格|尺码表/i.test(fieldName)) { rejected.push({ ...fact, reason: "sale_or_sku_fact_not_ocr_fillable" }); continue; }
    if (currentFields.length > 0 && !currentFields.some((field) => (fieldId && text(field.fieldId ?? field.field_id ?? field.id) === fieldId) || compact(field.fieldName ?? field.field_name ?? field.name) === compact(fieldName))) {
      rejected.push({ ...fact, reason: "field_not_in_current_template" });
      continue;
    }
    const template = currentFields.find((field) => (fieldId && text(field.fieldId ?? field.field_id ?? field.id) === fieldId) || compact(field.fieldName ?? field.field_name ?? field.name) === compact(fieldName));
    const permitted = options(template ?? {});
    if (permitted.length > 0 && !permitted.some((option) => compact(option) === compact(fact.value))) { rejected.push({ ...fact, reason: "value_not_in_current_template_enum" }); continue; }
    if (!ocrText.replace(/\s+/g, "").includes(text(fact.value).replace(/\s+/g, ""))) { rejected.push({ ...fact, reason: "ocr_text_does_not_contain_value" }); continue; }
    accepted.push({ ...fact, fieldName, ...(fieldId ? { fieldId } : {}), sourceType: "ocr" });
  }
  return { accepted, rejected };
}

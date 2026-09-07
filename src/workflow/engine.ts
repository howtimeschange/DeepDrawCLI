import { auditAiResponses, auditOcrFacts } from "../brands/balabala/ai-audit.js";
import { balabalaPlugin } from "../brands/balabala/index.js";
import type { BrandPlugin } from "../brands/types.js";
import { hydrateBalabalaRemoteDraft, type ReadbackComparison } from "../brands/balabala/readback.js";
import type { TradeDecision } from "../brands/balabala/trade-selection.js";
import { createWorkflowSnapshot, fingerprint, WorkflowStore } from "./store.js";
import type { RemoteOperationContext, SourceReference, WorkflowField, WorkflowSnapshot } from "./types.js";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {}; }
function text(value: unknown): string { return value === undefined || value === null ? "" : typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value).trim() : ""; }
function compact(value: unknown): string { return text(value).replace(/[\s()（）:：]/g, "").toLowerCase(); }
function templateFields(raw: unknown[]): JsonRecord[] { return raw.map(record).map((field) => ({
  ...field,
  fieldId: text(field.fieldId ?? field.field_id ?? field.id),
  fieldName: text(field.fieldName ?? field.field_name ?? field.name),
  fieldType: text(field.fieldType ?? field.field_type ?? field.type),
  options: field.options ?? field.options_json ?? field.optionsJson ?? [],
  required: field.required ?? record(field.attributes).isRequired ?? record(field.attributes).is_required ?? false,
  saleProp: field.saleProp ?? field.sale_prop ?? field.isSaleProp ?? field.is_sale_prop ?? false,
})).filter((field) => text(field.fieldName)); }
function workflowFieldInput(field: WorkflowField): JsonRecord { return {
  field_id: field.fieldId,
  field_name: field.fieldName,
  field_type: field.fieldType,
  ...(field.valueJson && Object.keys(field.valueJson).length ? { value_json: field.valueJson } : { value_text: field.valueText ?? "" }),
  source_type: field.sourceType,
  manual_override: field.manualOverride ?? false,
}; }
function currentFields(draft: JsonRecord): JsonRecord { const raw = draft.fields; if (Array.isArray(raw)) return Object.fromEntries(raw.map(record).map((field) => [text(field.field_name ?? field.fieldName ?? field.name), field.value_json ?? field.valueJson ?? field.value_text ?? field.valueText ?? field.value])); return record(raw); }
function isStructuredField(name: string): boolean { const key = compact(name); return key.includes("尺码表") || key === "多平台尺码" || key === "商家sku"; }
function productType(normalized: JsonRecord): string { const plan = record(normalized.launchPlan); return /鞋|靴/.test(`${text(plan.productLine)} ${text(plan.category)} ${text(plan.subcategory)}`) ? "shoe" : /服|衣|裤|裙/.test(`${text(plan.productLine)} ${text(plan.category)} ${text(plan.subcategory)}`) ? "apparel" : "generic"; }

export class BalabalaWorkflowEngine {
  constructor(private readonly store: WorkflowStore, private readonly plugin: BrandPlugin = balabalaPlugin) {}

  async snapshot(): Promise<WorkflowSnapshot> {
    return await this.store.read() ?? (() => { throw new Error(`workflow ${this.store.spu} is not imported`); })();
  }

  async replace(snapshot: WorkflowSnapshot): Promise<WorkflowSnapshot> { return this.store.write(snapshot); }

  async importNormalized(normalized: JsonRecord, sources: SourceReference[]): Promise<WorkflowSnapshot> {
    if (text(normalized.spu) !== this.store.spu) throw new Error("imported source SPU does not match workflow SPU");
    const current = await this.store.read();
    const next: WorkflowSnapshot = {
      ...(current ?? { version: 1, brand: this.store.brand, spu: this.store.spu, updatedAt: "", template: {}, draft: {}, audit: {}, plans: [], readbacks: [], executions: [], blocking: [], manual: [] }),
      state: "imported",
      sources,
      normalized,
      template: {},
      draft: {},
      audit: { importedAt: new Date().toISOString(), imageManifest: normalized.images ?? [] },
      blocking: [],
      manual: [],
    };
    return this.store.write(next);
  }

  async syncTemplate(trades: unknown[], rawFields: unknown[]): Promise<WorkflowSnapshot> {
    const current = await this.snapshot();
    const decision = this.plugin.selectTrade(current.normalized, trades) as unknown as TradeDecision;
    const fields = templateFields(rawFields);
    const template = { tradeDecision: decision, tradeId: decision.selected?.tradeId ?? "", fields, hash: fingerprint(JSON.stringify(fields)), syncedAt: new Date().toISOString() };
    if (decision.manualSelectionRequired || fields.length === 0) {
      return this.store.write({ ...current, state: "review_required", template, blocking: [
        ...(decision.manualSelectionRequired ? [{ code: "manual_trade_selection_required", message: decision.reasons.join("；") || "类目需要人工选择" }] : []),
        ...(fields.length === 0 ? [{ code: "trade_template_empty", message: "dp.trade.fields 未返回可用字段" }] : []),
      ] });
    }
    return this.assemble({ ...current, template });
  }

  async assemble(seed?: WorkflowSnapshot): Promise<WorkflowSnapshot> {
    const current = seed ?? await this.snapshot();
    const template = record(current.template);
    const decision = record(template.tradeDecision);
    const selected = record(decision.selected);
    const fields = [
      ...this.plugin.buildFields(current.normalized, template),
      ...this.plugin.buildSizeTables(current.normalized, template),
    ];
    const deduped = [...new Map(fields.map((field) => [compact(field.fieldName), field])).values()];
    const missing = deduped.filter((field) => field.active !== false && (field.validationStatus === "missing" || field.validationStatus === "invalid"));
    // A template field which has no safe automatic representation is not merely
    // informational.  Leaving it out of the SDK payload would silently drop a
    // current DeepDraw field, so it must block the workflow until a human
    // supplies the platform-specific format.
    const manual = deduped.filter((field) => field.active !== false && field.staleReason?.includes("manual_required"));
    const blockers = [...missing, ...manual.filter((field) => !missing.includes(field))];
    const plan = record(current.normalized.launchPlan);
    const copyRows = record(current.normalized.copywriting).rows;
    const copy = Array.isArray(copyRows) ? record(copyRows[0]) : {};
    const draft: JsonRecord = {
      code: this.store.spu,
      title: text(copy.title) || text(record(current.normalized.mdm).title),
      tradeId: text(template.tradeId ?? selected.tradeId),
      productId: text(current.normalized.productId),
      productType: productType(current.normalized),
      retailPrice: text(plan.retailPrice),
      date: text(plan.launchDate),
      skus: current.normalized.skus ?? [],
      sizeChart: current.normalized.sizeChart ?? current.normalized.plmSizeChart,
      templateFields: template.fields ?? [],
      fields: deduped.filter((field) => field.active !== false && field.validationStatus === "valid").map(workflowFieldInput),
    };
    const audit = {
      ...current.audit,
      fields: deduped,
      aiPlan: { ...this.plugin.buildAiPlan(current.normalized, deduped), fields: (template.fields as JsonRecord[]).map(record).map((field) => ({ fieldId: field.fieldId, fieldName: field.fieldName, active: true, options: field.options })) },
      assembledAt: new Date().toISOString(),
    };
    return this.store.write({ ...current, template, draft, audit, state: blockers.length ? "review_required" : "ready", blocking: blockers.map((field) => ({ code: field.staleReason ?? "required_field_missing", message: `字段 ${field.fieldName} ${field.validationStatus === "invalid" ? "与当前模板不匹配" : "需要补充或人工确认"}` })), manual: manual.map((field) => ({ code: field.staleReason ?? "manual_required", message: `字段 ${field.fieldName} 需要人工确认` })) });
  }

  async auditAi(responses: unknown[]): Promise<WorkflowSnapshot> {
    const current = await this.snapshot();
    const result = auditAiResponses(record(current.audit.aiPlan), responses);
    const auditedValues = record(current.normalized.auditedValues);
    for (const item of result.accepted) auditedValues[text(item.fieldName)] = { valueText: text(item.value), sourceType: "ai", confidence: item.confidence, evidence: item.evidence };
    return this.assemble({ ...current, normalized: { ...current.normalized, auditedValues }, audit: { ...current.audit, ai: result } });
  }

  async auditOcr(facts: unknown[]): Promise<WorkflowSnapshot> {
    const current = await this.snapshot();
    const images = Array.isArray(current.normalized.images) ? current.normalized.images.map(record) : [];
    const templateFields = Array.isArray(current.template.fields) ? current.template.fields : [];
    const result = auditOcrFacts(images, facts, templateFields);
    const auditedValues = record(current.normalized.auditedValues);
    for (const item of result.accepted) {
      const evidence = images.find((image) => text(image.sha256) === text(item.imageSha256 ?? item.image_sha256));
      auditedValues[text(item.fieldName)] = {
        valueText: text(item.value), sourceType: "ocr", confidence: item.confidence, evidence: [item.imageSha256, item.text],
        ...(evidence ? { sourceRef: { path: text(evidence.path), sha256: text(evidence.sha256), role: text(evidence.role) } } : {}),
      };
    }
    return this.assemble({ ...current, normalized: { ...current.normalized, auditedValues }, audit: { ...current.audit, ocr: result } });
  }

  async syncRemote(remote: JsonRecord, operation?: RemoteOperationContext): Promise<WorkflowSnapshot> {
    const current = await this.store.read() ?? createWorkflowSnapshot(this.store.brand, this.store.spu);
    const draft = hydrateBalabalaRemoteDraft(remote);
    if (text(draft.code) && text(draft.code) !== this.store.spu) throw new Error(`resource=form returned ${text(draft.code)}, not requested workflow ${this.store.spu}`);
    if (!text(draft.productId)) throw new Error("resource=form did not return productId");
    const now = new Date().toISOString();
    return this.store.write({
      ...current,
      state: "ready",
      normalized: { ...current.normalized, productId: draft.productId, resourceId: draft.resourceId, remoteSyncAt: now },
      draft,
      audit: { ...current.audit, remoteSyncAt: now, remoteFieldCount: Array.isArray(draft.fields) ? draft.fields.length : 0, ...(operation ? { remoteOperation: operation } : {}) },
      readbacks: [...current.readbacks, { at: now, kind: "remote_sync", ...(operation ? { operation } : {}), resource: remote }],
      blocking: [],
      manual: [],
    });
  }

  async overrideDraftField(fieldName: string, value: string): Promise<WorkflowSnapshot> {
    const current = await this.snapshot();
    if (isStructuredField(fieldName) || ["颜色", "尺码"].includes(compact(fieldName))) throw new Error(`本地覆盖不允许修改 ${fieldName}；颜色、尺码和结构化字段必须走受控更新流程。`);
    const rawFields = Array.isArray(current.draft.fields) ? current.draft.fields.map(record) : [];
    const index = rawFields.findIndex((field) => compact(field.field_name ?? field.fieldName ?? field.name) === compact(fieldName));
    if (index < 0) throw new Error(`字段 ${fieldName} 不在已同步的深绘档案中`);
    const before = text(rawFields[index].value_text ?? rawFields[index].valueText ?? rawFields[index].value);
    rawFields[index] = { ...rawFields[index], value_text: value, valueText: value };
    const exactName = text(rawFields[index].field_name ?? rawFields[index].fieldName ?? rawFields[index].name);
    const overrides = record(current.normalized.manualOverrides);
    const now = new Date().toISOString();
    overrides[exactName] = { valueText: value, source: "local_override", updatedAt: now };
    return this.store.write({
      ...current,
      state: "ready",
      normalized: { ...current.normalized, manualOverrides: overrides },
      draft: { ...current.draft, fields: rawFields },
      audit: { ...current.audit, manualOverrides: [...(Array.isArray(current.audit.manualOverrides) ? current.audit.manualOverrides : []), { fieldName: exactName, before, value, at: now }] },
      blocking: [],
    });
  }

  async prepareExistingUpdate(remote: JsonRecord): Promise<{ payload: JsonRecord; blocking: Array<{ code: string; message: string }> }> {
    const current = await this.snapshot();
    const result = this.plugin.prepareExistingUpdate(current.draft, remote) as { payload: JsonRecord; blocking: Array<{ code: string; message: string }> };
    await this.store.write({ ...current, draft: result.payload, blocking: result.blocking, state: result.blocking.length ? "review_required" : "ready" });
    return result;
  }

  async buildIncremental(requestedFields: string[]): Promise<{ fields: JsonRecord }> {
    const current = await this.snapshot();
    const existing = currentFields(current.draft);
    const actual = new Map(Object.keys(existing).map((name) => [compact(name), name]));
    const names: string[] = [];
    for (const requested of requestedFields) {
      const name = actual.get(compact(requested));
      if (!name) throw new Error(`增量字段 ${requested} 不在当前草稿或模板中`);
      if (isStructuredField(name) || compact(name) === "颜色" || compact(name) === "尺码") throw new Error(`巴拉上新流程不允许通过普通增量更新写入 ${name}；请使用全量更新或颜色/SKU 专用接口。`);
      names.push(name);
    }
    const color = actual.get("颜色");
    const size = actual.get("尺码");
    if (!color || !size || !text(existing[color]) || !text(existing[size])) throw new Error("巴拉上新流程的普通增量更新必须携带有效的颜色和尺码字段。");
    return { fields: Object.fromEntries([...new Set([...names, color, size])].map((name) => [name, existing[name]])) };
  }

  async compareReadback(remote: JsonRecord, operation?: RemoteOperationContext): Promise<WorkflowSnapshot> {
    const current = await this.snapshot();
    const comparison = this.plugin.compareReadback(current.draft, remote, current.draft) as unknown as ReadbackComparison;
    const state = comparison.status;
    const readback = { at: new Date().toISOString(), comparison, ...(operation ? { operation } : {}), resource: remote };
    return this.store.write({ ...current, state, readbacks: [...current.readbacks, readback], blocking: comparison.mismatches.map((mismatch) => ({ code: "readback_mismatch", message: `回读字段 ${mismatch.field} 与发送值不一致` })), manual: comparison.uiVerification.map((field) => ({ code: "needs_ui_verification", message: `资源回读未完整返回 ${field}，需要 UI 复核` })) });
  }
}

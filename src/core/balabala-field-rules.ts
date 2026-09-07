type JsonRecord = Record<string, unknown>;

export type BalabalaProductKind = "shoe" | "apparel" | "generic";

export interface BalabalaFieldDecision {
  fieldName: string;
  fieldId?: string;
  fieldType: string;
  options: string[];
  required: boolean;
  saleProp: boolean;
  active: boolean;
  manualOverride: boolean;
  valueText: string;
  valueJson: JsonRecord;
  sourceType: string;
  validationStatus: "valid" | "missing" | "invalid" | "skipped";
  validationMessage?: string;
  aiCandidate?: {
    priority: "P0" | "P1" | "P2";
    strategy: string;
    evidence: string[];
  };
}

export interface BalabalaFieldReview {
  ok: boolean;
  kind: BalabalaProductKind;
  fields: BalabalaFieldDecision[];
  submissionFields: JsonRecord[];
  activeTemplateFieldNames: string[];
  aiCandidates: Array<NonNullable<BalabalaFieldDecision["aiCandidate"]> & { fieldName: string; options: string[] }>;
  aiContext: {
    referenceImages: Array<{ role: string; mimeType: string; bytes: number }>;
    rejectedImages: Array<{ role: string; reason: string }>;
  };
  inputContract: {
    requiredEvidence: {
      templateFields: string[];
      mdm: string[];
      launchPlan: string[];
      copywriting: string[];
      ocrEvidence: string[];
      sizeChart: string[];
    };
    ai: {
      minimumConfidence: number;
      maximumReferenceImages: number;
      acceptedImageTypes: string[];
      allowed: string;
      forbidden: string;
    };
  };
  diagnostics: { errors: string[]; warnings: string[] };
}

const AI_MIN_CONFIDENCE = 0.7;
const AI_REFERENCE_IMAGE_LIMIT = 4;
const AI_REFERENCE_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const UNSUPPORTED_SPECIAL_FIELDS = new Set([
  "淘宝sku参数",
  "天猫sku参数",
  "天猫导购标题",
  "京东规格子属性",
  "京东自营子属性",
  "淘宝导购标题",
  "颜色备注",
]);
const FACT_BOUND_AI_PATTERNS = [
  /执行(?:标准|规范)/,
  /安全(?:等级|类别|技术|技术要求)/,
  /(?:产品|质量)等级/,
  /^(?:产品|商品)?(?:名称|品名|货号|款号|型号|编码|条码)$/,
  /(?:生产|制造)(?:企业|厂家|厂商|地址|日期)/,
  /产地|原产地|原产国|上市日期|生产日期|保质期|有效期/,
  /价(?:格|钱|位|区间)/,
  /(?:包装|包裹).*(?:重量|容量|长度|宽度|高度|尺寸|规格)/,
  /^(?:净)?(?:重量|容量|长度|宽度|高度|尺寸|规格)$/,
];

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value).trim();
  return "";
}

function compact(value: unknown): string {
  return text(value).replace(/\s+/g, "").replace(/[()（）]/g, "").replace(/[：:]/g, "").toLowerCase();
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(text).filter(Boolean))];
}

function nonEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return true;
}

function valueText(field: JsonRecord): string {
  return text(field.value_text ?? field.valueText ?? (typeof field.value === "string" || typeof field.value === "number" ? field.value : undefined));
}

function valueJson(field: JsonRecord): JsonRecord {
  const value = field.value_json ?? field.valueJson ?? (typeof field.value === "object" && !Array.isArray(field.value) ? field.value : undefined);
  return record(value);
}

function fieldName(field: JsonRecord): string {
  return text(field.field_name ?? field.fieldName ?? field.name);
}

function fieldType(field: JsonRecord): string {
  return text(field.field_type ?? field.fieldType ?? field.type).toUpperCase();
}

function fieldOptions(value: unknown): string[] {
  return unique(array(value).map((option) => {
    if (typeof option === "string" || typeof option === "number") return text(option);
    const item = record(option);
    return text(item.name ?? item.value ?? item.label ?? item.text ?? item.optionName);
  }));
}

function templateOptions(field: JsonRecord): string[] {
  return fieldOptions(field.options_json ?? field.optionsJson ?? field.options);
}

function bool(value: unknown): boolean {
  return value === true || text(value).toLowerCase() === "true" || value === 1 || text(value) === "1";
}

function templateRequired(field: JsonRecord): boolean {
  return bool(field.required ?? field.is_required ?? field.blocking ?? field.isRequired);
}

function templateSaleProp(field: JsonRecord): boolean {
  return bool(field.sale_prop ?? field.saleProp ?? field.isSaleProp ?? field.is_sale_prop);
}

function childRequirement(field: JsonRecord): { parents: string[]; value: string } | null {
  const raw = record(field.raw_payload_json ?? field.rawPayload);
  const attributes = record(field.attributes ?? raw.attributes);
  if (!bool(attributes.isChildAttr ?? attributes.is_child_attr)) return null;
  const parents = unique(array(attributes.parentAttr ?? attributes.parent_attr)
    .flatMap((entry) => text(entry).split(/[;；,，]/)));
  const value = text(attributes.parentAttrValue ?? attributes.parent_attr_value);
  return parents.length > 0 && value ? { parents, value } : null;
}

function fieldValues(value: string): string[] {
  return unique(value.split(/[;；]/));
}

function inputRoot(input: unknown): JsonRecord {
  const root = record(input);
  const payload = record(root.payload);
  const product = record(root.product);
  const draft = record(root.draft);
  const selected = Object.keys(payload).length > 0
    ? payload
    : Object.keys(product).length > 0
      ? product
      : root;
  return { ...root, ...draft, ...product, ...selected };
}

function productKind(input: JsonRecord): BalabalaProductKind {
  const mdm = record(input.mdm ?? input.spu);
  const context = [
    input.productType,
    input.product_type,
    input.kind,
    input.tradePath,
    input.trade_path,
    mdm.product_line_name,
    mdm.product_type_name,
    mdm.middle_class_name,
    mdm.subclass_name,
  ].map(text).join(" ");
  if (/shoe|鞋/i.test(context)) return "shoe";
  if (/apparel|服|衣|裤|裙/i.test(context)) return "apparel";
  return "generic";
}

function isStructuredSizeField(name: string): boolean {
  const key = compact(name);
  return key === "多平台尺码" || key.includes("尺码表");
}

function isMainSizeTable(name: string): boolean {
  const key = compact(name);
  return key.includes("尺码表")
    && key !== "多平台尺码"
    && !/(唯品会|抖音|天猫|淘宝|京东|拼多多|小红书|快手|微信视频|平台)/.test(key);
}

function canonicalNumericSize(value: unknown): string {
  return text(value).match(/\d+(?:\.\d+)?/)?.[0] ?? "";
}

function isSpecialShoeEnum(name: string): boolean {
  const key = compact(name);
  return key === "25鞋子尺码表" || key === "22q4童鞋尺码表" || key === "25鞋子模板类型";
}

function isUnsupportedAiField(name: string): boolean {
  const key = compact(name);
  if (isSpecialShoeEnum(name)) return false;
  return key === "充绒量"
    || key === "充绒量文本"
    || key === "多平台尺码"
    || key.includes("尺码表")
    || key === "尺码"
    || key.includes("商家sku");
}

function isFactBoundAiField(name: string): boolean {
  return FACT_BOUND_AI_PATTERNS.some((pattern) => pattern.test(compact(name)));
}

function aiStrategy(name: string): NonNullable<BalabalaFieldDecision["aiCandidate"]> {
  const key = compact(name);
  if (/款式|类别|图案|流行元素|袖长|衣长|领型|门襟|裤长|腰型|版型|带帽|腰带|毛领|多件套|穿着方式|内胆类型|闭合方式|鞋子模板类型|靴筒高度/.test(key)) {
    return { priority: "P0", strategy: "商品结构与品类", evidence: ["reference_images", "product_title", "trade_path", "source_rows"] };
  }
  if (/年龄|人群|季节|性别|风格/.test(key)) {
    return { priority: "P1", strategy: "年龄人群与季节风格", evidence: ["mdm", "sku_sizes", "launch_plan", "product_title", "reference_images"] };
  }
  if (/面料|材质|成分|里料|填充物|厚薄|弹力|柔软|功能|鞋垫/.test(key)) {
    return { priority: "P1", strategy: "材质成分与手感功能", evidence: ["copywriting", "ocr_hangtag", "ocr_washlabel", "source_rows", "reference_images"] };
  }
  if (/详情页ai标注|模特实拍/.test(key)) {
    return { priority: "P2", strategy: "图片内容与运营标记", evidence: ["reference_images", "source_rows"] };
  }
  return { priority: "P2", strategy: "模板枚举复核", evidence: ["reference_images", "mdm", "copywriting", "source_rows"] };
}

function valueMatchesOptions(value: string, options: string[], type: string): boolean {
  if (!value) return true;
  const permitted = new Set(options.map(compact));
  if (permitted.size === 0) return true;
  const values = type === "MULTI_CHOICE" ? fieldValues(value) : [value];
  return values.length > 0 && values.every((entry) => permitted.has(compact(entry)));
}

function validReferenceImages(input: JsonRecord): BalabalaFieldReview["aiContext"] {
  const images = array(input.referenceImages ?? input.reference_images).map(record);
  const ranks: Record<string, number> = { flat_image: 0, main_image: 1, model_image: 2, reference: 3, hangtag: 4, washlabel: 5 };
  const usable: Array<{ role: string; mimeType: string; bytes: number }> = [];
  const rejectedImages: Array<{ role: string; reason: string }> = [];
  for (const image of images) {
    const role = text(image.role ?? image.asset_kind ?? image.assetKind) || "reference";
    const mimeType = text(image.mimeType ?? image.mime_type).toLowerCase();
    const bytes = Number(image.bytes ?? image.size ?? image.sizeBytes);
    if (!ACCEPTED_IMAGE_TYPES.includes(mimeType)) {
      rejectedImages.push({ role, reason: "仅接受 jpeg/png/webp 图片" });
      continue;
    }
    if (!Number.isFinite(bytes) || bytes <= 0 || bytes > AI_REFERENCE_IMAGE_MAX_BYTES) {
      rejectedImages.push({ role, reason: "单张参考图必须大于 0 且不超过 4MB" });
      continue;
    }
    usable.push({ role, mimeType, bytes });
  }
  usable.sort((left, right) => (ranks[left.role] ?? 3) - (ranks[right.role] ?? 3));
  return { referenceImages: usable.slice(0, AI_REFERENCE_IMAGE_LIMIT), rejectedImages };
}

function sizeChartErrors(input: JsonRecord, kind: BalabalaProductKind, hasSizeData: boolean): string[] {
  if (kind === "generic" || !hasSizeData) return [];
  const chart = record(input.sizeChart ?? input.size_chart);
  const source = compact(chart.source ?? chart.source_type);
  const expected = kind === "shoe" ? "shoe_size_chart" : "plm_size_chart";
  const sourceIsAllowed = kind === "shoe"
    ? source === "shoe_size_chart"
    : source === "plm_size_chart" || source === "plm";
  if (!sourceIsAllowed) {
    return [kind === "shoe"
      ? "鞋品尺码表只能来自匹配的鞋品尺码数据（sizeChart.source=shoe_size_chart），不能由 AI 或图片生成"
      : "服饰尺码表只能来自 PLM 量点数据（sizeChart.source=plm_size_chart），不能由 AI 或图片生成"];
  }
  const rows = array(chart.rows).map(record);
  if (rows.length === 0) return [`${expected} 必须包含至少一行尺码数据`];
  const skuSizes = array(input.skus ?? input.skuList ?? input.sku_list)
    .map(record)
    .map((sku) => text(sku.size ?? sku.size_name ?? sku.sizeName))
    .filter(Boolean);
  const rowSizes = new Set(rows.map((row) => text(row.size ?? row.size_name ?? row.sizeName).match(/\d+(?:\.\d+)?/)?.[0] ?? "").filter(Boolean));
  const missing = unique(skuSizes.map((size) => size.match(/\d+(?:\.\d+)?/)?.[0] ?? size).filter((size) => size && !rowSizes.has(size)));
  return missing.length > 0 ? [`尺码数据缺少 SKU 尺码：${missing.join(", ")}`] : [];
}

function inputContract(kind: BalabalaProductKind): BalabalaFieldReview["inputContract"] {
  return {
    requiredEvidence: {
      templateFields: ["当前 dp.trade.fields 的完整返回；不可使用历史类目模板"],
      mdm: ["款号、产品线/类目、SKU 颜色和销售尺码"],
      launchPlan: ["上市日期、零售价和平台价格等业务事实"],
      copywriting: ["标题、材质文案、款式和功能描述"],
      ocrEvidence: ["吊牌/洗唛 OCR 的成分、执行标准等可追溯文本"],
      sizeChart: kind === "shoe" ? ["shoe_size_chart"] : kind === "apparel" ? ["plm_size_chart"] : [],
    },
    ai: {
      minimumConfidence: AI_MIN_CONFIDENCE,
      maximumReferenceImages: AI_REFERENCE_IMAGE_LIMIT,
      acceptedImageTypes: [...ACCEPTED_IMAGE_TYPES],
      allowed: "仅可补充当前模板中的有枚举字段，且必须有图片/文案/主数据等支持证据。",
      forbidden: "不得猜测价格、产地、条码、生产/合规事实、SKU 或真实尺码表；AI 结果不会覆盖人工字段。",
    },
  };
}

export function reviewBalabalaFields(input: unknown): BalabalaFieldReview {
  const root = inputRoot(input);
  const kind = productKind(root);
  const errors: string[] = [];
  const warnings: string[] = [];
  const templates = array(root.templateFields ?? root.template_fields).map(record).filter((field) => fieldName(field));
  const supplied = array(root.fields).map(record);
  const imageContext = validReferenceImages(root);
  const contract = inputContract(kind);

  if (templates.length === 0) errors.push("巴拉上新流程需要 templateFields：请先用当前 merchantId + tradeId 调用 dp.trade.fields，不可复用历史模板。");

  const templateByKey = new Map<string, JsonRecord>();
  for (const template of templates) {
    const key = compact(fieldName(template));
    if (!templateByKey.has(key)) templateByKey.set(key, template);
  }
  const suppliedByKey = new Map<string, JsonRecord>();
  for (const field of supplied) {
    const key = compact(fieldName(field));
    if (!key) continue;
    if (!templateByKey.has(key) && (nonEmpty(valueText(field)) || nonEmpty(valueJson(field)))) {
      warnings.push(`字段 ${fieldName(field)} 不属于当前深绘类目模板，已从上新 payload 排除。`);
    }
    if (!suppliedByKey.has(key)) suppliedByKey.set(key, field);
  }

  const hasSkuData = array(root.skus ?? root.skuList ?? root.sku_list).length > 0;
  const hasStructuredSizeField = templates.some((template) => isStructuredSizeField(fieldName(template)));
  errors.push(...sizeChartErrors(root, kind, hasSkuData || hasStructuredSizeField));

  const decisions: Array<BalabalaFieldDecision & { template: JsonRecord }> = templates.map((template) => {
    const suppliedField = suppliedByKey.get(compact(fieldName(template))) ?? {};
    const initialText = valueText(suppliedField);
    const initialJson = valueJson(suppliedField);
    const required = templateRequired(template) || ((hasSkuData || hasStructuredSizeField) && templateSaleProp(template));
    return {
      fieldName: fieldName(template),
      fieldId: text(template.field_id ?? template.fieldId ?? template.id) || undefined,
      fieldType: fieldType(template) || fieldType(suppliedField),
      options: templateOptions(template),
      required,
      saleProp: templateSaleProp(template),
      active: true,
      manualOverride: bool(suppliedField.manual_override ?? suppliedField.manualOverride),
      valueText: initialText,
      valueJson: initialJson,
      sourceType: text(suppliedField.source_type ?? suppliedField.sourceType) || (initialText || nonEmpty(initialJson) ? "manual" : "skip"),
      validationStatus: "valid",
      validationMessage: undefined,
      template,
    };
  });

  for (let attempt = 0; attempt < decisions.length; attempt += 1) {
    let changed = false;
    for (const decision of decisions) {
      const requirement = childRequirement(decision.template);
      if (!requirement) continue;
      const active = requirement.parents.some((parent) => {
        const parentField = decisions.find((candidate) => compact(candidate.fieldName) === compact(parent));
        return Boolean(parentField?.active && fieldValues(parentField.valueText).some((value) => compact(value) === compact(requirement.value)));
      });
      if (active !== decision.active) {
        decision.active = active;
        changed = true;
      }
    }
    if (!changed) break;
  }

  const responses = array(root.aiResponses ?? root.ai_responses).map(record);
  for (const response of responses) {
    const name = text(response.fieldName ?? response.field_name ?? response.name);
    const decision = decisions.find((field) => compact(field.fieldName) === compact(name));
    if (!decision) {
      warnings.push(`AI 返回字段 ${name || "(空)"} 不在当前模板中，已忽略。`);
      continue;
    }
    if (!decision.active) {
      warnings.push(`AI 返回字段 ${decision.fieldName} 当前子字段条件未激活，已忽略。`);
      continue;
    }
    if (decision.manualOverride) {
      warnings.push(`字段 ${decision.fieldName} 有人工覆盖，AI 结果已忽略。`);
      continue;
    }
    if (isUnsupportedAiField(decision.fieldName) || isFactBoundAiField(decision.fieldName)) {
      warnings.push(`字段 ${decision.fieldName} 属于事实或尺码/SKU结构边界，AI 不可填充。`);
      continue;
    }
    if (decision.options.length === 0) {
      warnings.push(`字段 ${decision.fieldName} 没有当前模板枚举，AI 不可填充。`);
      continue;
    }
    const confidence = Number(response.confidence);
    if (!Number.isFinite(confidence) || confidence < AI_MIN_CONFIDENCE) {
      warnings.push(`字段 ${decision.fieldName} 的 AI 置信度低于 ${AI_MIN_CONFIDENCE}，已忽略。`);
      continue;
    }
    const evidence = unique(array(response.evidence).map(text));
    if (evidence.length === 0) {
      warnings.push(`字段 ${decision.fieldName} 的 AI 返回没有可审计证据，已忽略。`);
      continue;
    }
    if (nonEmpty(decision.valueText) || nonEmpty(decision.valueJson)) {
      warnings.push(`字段 ${decision.fieldName} 已有可信来源值，AI 不会覆盖。`);
      continue;
    }
    const responseValue = text(response.value ?? response.value_text ?? response.valueText);
    if (!valueMatchesOptions(responseValue, decision.options, decision.fieldType)) {
      warnings.push(`字段 ${decision.fieldName} 的 AI 值不在当前模板枚举中，已忽略。`);
      continue;
    }
    decision.valueText = responseValue;
    decision.sourceType = "ai";
  }

  const aiCandidates: BalabalaFieldReview["aiCandidates"] = [];
  for (const decision of decisions) {
    if (!decision.active) {
      decision.required = false;
      decision.validationStatus = "skipped";
      continue;
    }
    if (UNSUPPORTED_SPECIAL_FIELDS.has(compact(decision.fieldName)) && (nonEmpty(decision.valueText) || nonEmpty(decision.valueJson))) {
      errors.push(`字段 ${decision.fieldName} 是深绘暂不支持的特殊格式，已停止自动上新，请人工确认。`);
    }
    if (isStructuredSizeField(decision.fieldName) && decision.sourceType === "ai") {
      errors.push(`字段 ${decision.fieldName} 不得由 AI 生成。`);
    }
    const empty = !nonEmpty(decision.valueText) && !nonEmpty(decision.valueJson);
    if (empty && decision.required) {
      decision.validationStatus = "missing";
      const message = decision.saleProp ? `销售属性 ${decision.fieldName} 缺失` : `必填字段 ${decision.fieldName} 缺失`;
      decision.validationMessage = message;
      errors.push(message);
    } else if (decision.options.length > 0 && !valueMatchesOptions(decision.valueText, decision.options, decision.fieldType)) {
      decision.validationStatus = "invalid";
      const message = `字段 ${decision.fieldName} 的值不在当前模板枚举中`;
      decision.validationMessage = message;
      errors.push(message);
    } else {
      decision.validationStatus = "valid";
      decision.validationMessage = undefined;
    }
    const safeForAi = !decision.manualOverride
      && !isUnsupportedAiField(decision.fieldName)
      && !isFactBoundAiField(decision.fieldName)
      && decision.options.length > 0
      && (!nonEmpty(decision.valueText) || decision.validationStatus === "invalid");
    if (safeForAi) {
      const candidate = aiStrategy(decision.fieldName);
      decision.aiCandidate = candidate;
      aiCandidates.push({ fieldName: decision.fieldName, options: decision.options, ...candidate });
    }
  }

  if (kind !== "generic" && hasSkuData) {
    const skuSizes = unique(array(root.skus ?? root.skuList ?? root.sku_list)
      .map(record)
      .map((sku) => canonicalNumericSize(sku.size ?? sku.size_name ?? sku.sizeName))
      .filter(Boolean));
    for (const table of decisions.filter((field) => field.active && isMainSizeTable(field.fieldName))) {
      const rowKeys = Object.keys(table.valueJson)
        .filter((key) => compact(key) !== "title")
        .map(canonicalNumericSize)
        .filter(Boolean);
      if (rowKeys.length === 0) {
        errors.push(`主尺码表 ${table.fieldName} 缺少可提交行，不能覆盖更新。`);
        continue;
      }
      const missingSkuSizes = skuSizes.filter((size) => !rowKeys.includes(size));
      if (missingSkuSizes.length > 0) {
        errors.push(`主尺码表 ${table.fieldName} 缺少 SKU 尺码：${missingSkuSizes.join(", ")}。`);
      }
    }
  }

  for (const rejected of imageContext.rejectedImages) warnings.push(`AI 参考图 ${rejected.role} 不可用：${rejected.reason}`);
  if (array(root.referenceImages ?? root.reference_images).length > AI_REFERENCE_IMAGE_LIMIT) warnings.push(`AI 最多使用 ${AI_REFERENCE_IMAGE_LIMIT} 张可用参考图；其余仅保留在审查输入中。`);

  const fields: BalabalaFieldDecision[] = decisions.map(({ template: _template, ...decision }) => decision);
  const submissionFields = decisions
    .filter((field) => field.active && (nonEmpty(field.valueText) || nonEmpty(field.valueJson)))
    .map((field) => ({
      ...(field.fieldId ? { id: field.fieldId } : {}),
      field_name: field.fieldName,
      field_type: field.fieldType,
      ...(field.valueText ? { value_text: field.valueText } : {}),
      ...(nonEmpty(field.valueJson) ? { value_json: field.valueJson } : {}),
      source_type: field.sourceType,
      manual_override: field.manualOverride,
    }));
  const activeTemplateFieldNames = decisions.filter((field) => field.active).map((field) => field.fieldName);
  return {
    ok: errors.length === 0,
    kind,
    fields,
    submissionFields,
    activeTemplateFieldNames,
    aiCandidates,
    aiContext: imageContext,
    inputContract: contract,
    diagnostics: { errors: unique(errors), warnings: unique(warnings) },
  };
}

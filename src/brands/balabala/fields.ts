import type { WorkflowField } from "../../workflow/types.js";

type JsonRecord = Record<string, unknown>;

const SPECIAL_MANUAL_FIELDS = new Set(["淘宝sku参数", "天猫sku参数", "天猫导购标题", "京东规格子属性", "京东自营子属性", "淘宝导购标题", "颜色备注"]);
const MERCHANT_SKU_COLUMNS = ["价格", "货号", "上市时间", "数量", "商家编码", "条形码", "零售价", "供货价", "唯品会货号", "唯品会条形码", "京东价", "划线价", "拼多多单买价", "拼多多团购价", "天猫特卖折扣价", "天猫特卖专柜价", "采购价", "京东自营市场价", "有赞标准价", "有赞价格", "原价", "小红书市场价", "抖音结算价格", "抖音价", "快手价", "爱库存供货价", "爱库存最低价", "好衣库结算价", "好衣库供货价", "好衣库价", "好衣库原价", "微信视频小店价格", "单品货号", "1688件重尺-重(g)", "小红书商家编码", "天猫SKU搜索标题"];

function record(value: unknown): JsonRecord { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {}; }
function text(value: unknown): string { return value === undefined || value === null ? "" : typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value).trim() : ""; }
function compact(value: unknown): string { return text(value).replace(/[\s()（）:：]/g, "").toLowerCase(); }
function nameOf(field: JsonRecord): string { return text(field.fieldName ?? field.field_name ?? field.name); }
function typeOf(field: JsonRecord): string { return text(field.fieldType ?? field.field_type ?? field.type) || "TEXT"; }
function bool(value: unknown): boolean { return value === true || value === 1 || ["true", "1"].includes(text(value).toLowerCase()); }
function required(field: JsonRecord): boolean { return bool(field.required ?? field.isRequired ?? field.is_required); }
function saleProp(field: JsonRecord): boolean { return bool(field.saleProp ?? field.sale_prop ?? field.isSaleProp ?? field.is_sale_prop); }
function optionText(value: unknown): string { const item = record(value); return text(typeof value === "object" ? item.name ?? item.value ?? item.label ?? item.text ?? item.optionName : value); }
function options(field: JsonRecord): string[] { const source = field.options ?? field.options_json ?? field.optionsJson; return Array.isArray(source) ? source.map(optionText).filter(Boolean) : []; }
function sourceRefs(...values: unknown[]): WorkflowField["sourceRefs"] { return values.map(record).map((value) => record(value.sourceRef)).filter((value) => text(value.path) && text(value.sha256)) as WorkflowField["sourceRefs"]; }

function decimal(value: unknown, adjustment = 0): string {
  const number = Number(text(value));
  return Number.isFinite(number) ? String(Number((number + adjustment).toFixed(2))) : "";
}

function optionMatch(value: string, permitted: string[], multi = false): string {
  if (!value) return "";
  if (permitted.length === 0) return value;
  const desired = multi ? value.split(/[;；]/).map((item) => item.trim()).filter(Boolean) : [value];
  const matched = desired.map((item) => permitted.find((option) => compact(option) === compact(item)) ?? "");
  return matched.every(Boolean) ? matched.join(";") : "";
}

function standardColor(raw: string, permitted: string[]): string {
  const rawKey = compact(raw);
  const exact = permitted.find((option) => compact(option).endsWith(rawKey));
  if (exact) return exact;
  const family = /白绿|绿色/.test(raw) ? "绿色" : /蓝/.test(raw) ? "蓝色" : /粉/.test(raw) ? "粉红" : /卡其/.test(raw) ? "卡其" : /浅灰|中灰|深灰|灰/.test(raw) ? "灰色" : /黑/.test(raw) ? "黑色" : /红/.test(raw) ? "红色" : /黄/.test(raw) ? "黄色" : /紫/.test(raw) ? "紫色" : /棕|咖/.test(raw) ? "棕色" : /白/.test(raw) ? "白色" : "";
  if (!family) return "";
  const familyOption = permitted.find((option) => compact(option) === compact(family) || compact(option).startsWith(`${compact(family)},`));
  if (permitted.length > 0 && !familyOption) return "";
  return permitted.length > 0 && familyOption?.includes(",") ? `${familyOption.split(",")[0]},${raw}` : `${family},${raw}`;
}

function templateFields(template: JsonRecord): JsonRecord[] { return Array.isArray(template.fields) ? template.fields.map(record).filter((field) => nameOf(field)) : []; }
function childRequirement(template: JsonRecord): { parents: string[]; value: string } | undefined {
  const raw = record(template.rawPayload ?? template.raw_payload_json);
  const attributes = record(template.attributes ?? raw.attributes);
  if (!bool(attributes.isChildAttr ?? attributes.is_child_attr)) return undefined;
  const parentsRaw = attributes.parentAttr ?? attributes.parent_attr;
  const parents = (Array.isArray(parentsRaw) ? parentsRaw : [parentsRaw]).flatMap((value) => text(value).split(/[;,，；]/)).filter(Boolean);
  const value = text(attributes.parentAttrValue ?? attributes.parent_attr_value);
  return parents.length && value ? { parents, value } : undefined;
}

function titleValues(context: JsonRecord): JsonRecord {
  const copy = record(context.copywriting);
  const first = Array.isArray(copy.rows) ? record(copy.rows[0]) : {};
  return { title: text(first.title) || text(record(context.mdm).title), vipTitle: text(first.vipTitle), guideTitle: text(first.guideTitle), sellingPoint: text(first.sellingPoint), detail: text(first.detail) };
}

function scalarFor(name: string, context: JsonRecord): { value: string; source: WorkflowField["sourceType"]; refs: WorkflowField["sourceRefs"] } {
  const key = compact(name);
  const plan = record(context.launchPlan);
  const copyRows = record(context.copywriting).rows;
  const copy = Array.isArray(copyRows) ? record(copyRows[0]) : {};
  const titles = titleValues(context);
  const price = decimal(plan.retailPrice);
  const source = (value: unknown, sourceType: WorkflowField["sourceType"], ref: unknown) => ({ value: text(value), source: sourceType, refs: sourceRefs(ref) });
  if (/商品展示标题|搜索标题|商品标题|^标题$/.test(key)) return source(titles.title, "copywriting", copy);
  if (/唯品.*标题/.test(key)) return source(titles.vipTitle || titles.title, "copywriting", copy);
  if (/抖音|小红书|视频号|快手/.test(key) && /标题/.test(key)) return source(titles.guideTitle || titles.title, "copywriting", copy);
  if (/推荐理由|卖点|详情/.test(key)) return source(titles.sellingPoint || titles.detail, "copywriting", copy);
  if (/吊牌价|零售价|市场价|京东价|划线价|^价格$/.test(key)) return source(price, "launch_plan", plan);
  if (/拼多多.*单买价/.test(key)) return source(decimal(price, -1), "derived", plan);
  if (/拼多多.*团购价/.test(key)) return source(decimal(price, -2), "derived", plan);
  if (/1688.*价格区间|价格区间.*1688/.test(key)) return source(price ? `1*${price}` : "", "derived", plan);
  if (/款号|型号|货号/.test(key)) return source(context.spu, "mdm", record(context.mdm));
  if (key === "品牌" || key.includes("品牌名称")) return source("巴拉巴拉", "derived", plan);
  if (/性别|适用人群/.test(key)) return source(plan.gender, "launch_plan", plan);
  if (/上市.*时间|上市日期|产品季/.test(key)) return source(plan.launchDate, "launch_plan", plan);
  if (/材质|面料|帮面/.test(key)) return source(plan.upperMaterial || copy.upperMaterial, "launch_plan", plan);
  if (/里料/.test(key)) return source(plan.lining || copy.lining, "launch_plan", plan);
  if (/填充/.test(key)) return source(plan.filling || copy.filling, "launch_plan", plan);
  if (/鞋底/.test(key)) return source(copy.sole, "copywriting", copy);
  return { value: "", source: "skip", refs: [] };
}

function buildMerchantSku(context: JsonRecord, template: JsonRecord, colorMap: Map<string, string>): WorkflowField {
  const plan = record(context.launchPlan);
  const price = decimal(plan.retailPrice);
  const allColumns = options(template).filter((column) => MERCHANT_SKU_COLUMNS.some((allowed) => compact(allowed) === compact(column)));
  const columns = allColumns.length ? allColumns : MERCHANT_SKU_COLUMNS;
  const rows = (Array.isArray(context.skus) ? context.skus : []).map(record);
  const valueJson: Record<string, string> = { title: columns.join(",") };
  for (const sku of rows) {
    const color = colorMap.get(text(sku.color));
    const size = text(sku.size).match(/\d+(?:\.5)?/)?.[0] ?? "";
    if (!color || !size) continue;
    valueJson[`${color},${size}码`] = columns.map((column) => {
      const key = compact(column);
      if (key === compact("价格") || key === compact("零售价") || key === compact("京东价") || key === compact("划线价")) return decimal(sku.price) || price;
      if (key === compact("货号") || key === compact("单品货号") || key === compact("唯品会货号")) return text(sku.skuCode);
      if (key === compact("商家编码") || key === compact("小红书商家编码")) return text(sku.sellerCode);
      if (key === compact("条形码") || key === compact("唯品会条形码")) return text(sku.barcode);
      if (key === compact("拼多多单买价")) return decimal(sku.price || price, -1);
      if (key === compact("拼多多团购价")) return decimal(sku.price || price, -2);
      if (key === compact("上市时间")) return text(plan.launchDate);
      if (key === compact("数量")) return text(sku.quantity);
      if (/价$/.test(column)) return decimal(sku.price) || price;
      return "";
    }).join(",");
  }
  return { fieldId: text(template.fieldId ?? template.field_id ?? template.id) || undefined, fieldName: nameOf(template), fieldType: typeOf(template), valueJson, sourceType: "derived", sourceRefs: sourceRefs(plan, ...rows), active: true, validationStatus: Object.keys(valueJson).length > 1 ? "valid" : "missing" };
}

export function buildBalabalaFields(contextInput: Record<string, unknown>, templateInput: Record<string, unknown>): WorkflowField[] {
  const context = record(contextInput);
  const templates = templateFields(record(templateInput));
  const manualOverrides = record(context.manualOverrides ?? context.manual_overrides);
  const auditedValues = record(context.auditedValues ?? context.audited_values);
  const skus = (Array.isArray(context.skus) ? context.skus : []).map(record);
  const colors = [...new Set(skus.map((sku) => text(sku.color)).filter(Boolean))];
  const colorTemplate = templates.find((template) => compact(nameOf(template)) === "颜色");
  const colorOptions = colorTemplate ? options(colorTemplate) : [];
  const colorMap = new Map(colors.map((color) => [color, standardColor(color, colorOptions)]));
  const output: WorkflowField[] = [];

  for (const template of templates) {
    const name = nameOf(template);
    const key = compact(name);
    const override = record(manualOverrides[name] ?? manualOverrides[key]);
    const audited = record(auditedValues[name] ?? auditedValues[key]);
    const base: WorkflowField = { fieldId: text(template.fieldId ?? template.field_id ?? template.id) || undefined, fieldName: name, fieldType: typeOf(template), sourceType: "skip", sourceRefs: [], active: true, manualOverride: Boolean(Object.keys(override).length), validationStatus: "valid" };
    if (SPECIAL_MANUAL_FIELDS.has(key)) {
      output.push({ ...base, validationStatus: required(template) ? "missing" : "skipped", staleReason: "manual_required_special_format" });
      continue;
    }
    if (Object.keys(override).length) {
      output.push({ ...base, valueText: text(override.valueText ?? override.value_text ?? override.value), valueJson: record(override.valueJson ?? override.value_json), sourceType: "manual", sourceRefs: [] });
      continue;
    }
    if (Object.keys(audited).length && key !== "颜色" && key !== "尺码" && key !== "商家sku") {
      const value = optionMatch(text(audited.valueText ?? audited.value_text ?? audited.value), options(template), /MULTI_CHOICE|MULTI_SELECT/.test(typeOf(template)));
      output.push({ ...base, valueText: value, sourceType: text(audited.sourceType ?? audited.source_type) === "ocr" ? "ocr" : "ai", sourceRefs: [], validationStatus: value ? "valid" : "invalid", ...(value ? {} : { staleReason: "audited_value_not_in_current_template_options" }) });
      continue;
    }
    if (key === "颜色") {
      const values = colors.map((color) => colorMap.get(color) ?? "");
      output.push({ ...base, valueText: values.filter(Boolean).join(";"), sourceType: "derived", sourceRefs: sourceRefs(...skus), validationStatus: values.every(Boolean) ? "valid" : "missing", ...(values.every(Boolean) ? {} : { staleReason: "manual_required_color_enum" }) });
      continue;
    }
    if (key === "尺码") {
      const sizes = [...new Set(skus.map((sku) => text(sku.size).match(/\d+(?:\.5)?/)?.[0] ?? "").filter(Boolean))];
      const values = sizes.map((size) => `${size}码`);
      const permitted = options(template);
      const supported = permitted.length === 0 || values.every((value, index) => permitted.some((option) => compact(option) === compact(value) || compact(option) === compact(sizes[index])));
      output.push({ ...base, valueText: supported ? values.join(";") : "", sourceType: "mdm", sourceRefs: sourceRefs(...skus), validationStatus: supported && values.length ? "valid" : "missing", ...(supported ? {} : { staleReason: "sale_size_not_in_template" }) });
      continue;
    }
    if (key === "商家sku" || key === "商家sku") {
      output.push(buildMerchantSku(context, template, colorMap));
      continue;
    }
    const scalar = scalarFor(name, context);
    const value = optionMatch(scalar.value, options(template), /MULTI_CHOICE|MULTI_SELECT/.test(typeOf(template)));
    output.push({ ...base, valueText: value, sourceType: scalar.source, sourceRefs: scalar.refs, validationStatus: scalar.value && !value ? "invalid" : required(template) && !value ? "missing" : "valid", ...(scalar.value && !value ? { staleReason: "value_not_in_current_template_options" } : {}) });
  }

  for (const candidate of output) {
    const template = templates.find((item) => nameOf(item) === candidate.fieldName);
    const requirement = template ? childRequirement(template) : undefined;
    if (!requirement) continue;
    candidate.active = requirement.parents.some((parent) => output.some((field) => compact(field.fieldName) === compact(parent) && field.active !== false && text(field.valueText).split(/[;；]/).some((value) => compact(value) === compact(requirement.value))));
    if (!candidate.active) {
      candidate.validationStatus = "skipped";
      candidate.valueText = "";
      candidate.valueJson = {};
      candidate.staleReason = "inactive_child_field";
    }
  }
  return output;
}

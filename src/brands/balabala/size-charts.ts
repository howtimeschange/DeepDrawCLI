import type { WorkflowField } from "../../workflow/types.js";

type JsonRecord = Record<string, unknown>;

const APPAREL_WEIGHT_KG: Record<string, string> = {
  "52": "3", "59": "5", "66": "7.5", "73": "8", "80": "9.5", "90": "10.5", "100": "13.5", "110": "17", "120": "20.5", "130": "25", "140": "31", "150": "37", "160": "45", "165": "52.5", "170": "57.5", "175": "62.5", "180": "67.5",
};

function record(value: unknown): JsonRecord { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {}; }
function text(value: unknown): string { return value === undefined || value === null ? "" : typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value).trim() : ""; }
function compact(value: unknown): string { return text(value).replace(/[\s()（）:：]/g, "").toLowerCase(); }
function fieldName(field: JsonRecord): string { return text(field.fieldName ?? field.field_name ?? field.name); }
function fieldType(field: JsonRecord): string { return text(field.fieldType ?? field.field_type ?? field.type) || "MULTI_TEXT"; }
function optionText(value: unknown): string { const item = record(value); return text(typeof value === "object" ? item.name ?? item.value ?? item.label ?? item.text : value); }
function options(field: JsonRecord): string[] { const raw = field.options ?? field.options_json ?? field.optionsJson; return Array.isArray(raw) ? raw.map(optionText).filter(Boolean) : []; }
function field(template: JsonRecord, name: string): JsonRecord | undefined { return (Array.isArray(template.fields) ? template.fields : []).map(record).find((item) => compact(fieldName(item)) === compact(name)); }
function sizeNumber(value: unknown): string { return text(value).match(/\d+(?:\.5)?/)?.[0] ?? ""; }
function isShoe(context: JsonRecord): boolean { const plan = record(context.launchPlan); return /鞋|靴/.test(`${text(plan.productLine)} ${text(plan.category)} ${text(plan.subcategory)}`); }
function sourceRows(context: JsonRecord): JsonRecord[] { const chart = record(context.sizeChart); return Array.isArray(chart.rows) ? chart.rows.map(record) : []; }
function usableColumns(template: JsonRecord, requested: string[]): string[] { const supplied = options(template); return supplied.length ? requested.filter((name) => supplied.some((option) => compact(option) === compact(name))) : requested; }
function table(template: JsonRecord | undefined, name: string, columns: string[], rows: Array<{ key: string; cells: string[] }>, sourceType: WorkflowField["sourceType"], warning?: string): WorkflowField[] {
  if (!template || columns.length === 0 || rows.length === 0) return [];
  return [{ fieldId: text(template.fieldId ?? template.field_id ?? template.id) || undefined, fieldName: name, fieldType: fieldType(template), valueJson: { title: columns.join(","), ...Object.fromEntries(rows.map((row) => [row.key, row.cells.join(",")])) }, sourceType, sourceRefs: [], active: true, validationStatus: "valid", ...(warning ? { staleReason: warning } : {}) }];
}

function shoeTables(context: JsonRecord, template: JsonRecord): WorkflowField[] {
  const plan = record(context.launchPlan);
  const categoryText = `${text(plan.category)} ${text(plan.subcategory)}`;
  const visual = text(context.sandalClassification ?? context.sandal_classification);
  if (/凉鞋/.test(categoryText) && !/前后空|中空|包头|镂空|运动公主/.test(visual)) return [{ fieldName: "凉鞋结构", fieldType: "", sourceType: "skip", sourceRefs: [], active: false, validationStatus: "missing", staleReason: "needs_visual_classification" }];
  const skuSizes = [...new Set((Array.isArray(context.skus) ? context.skus : []).map((item) => sizeNumber(record(item).size)).filter(Boolean))];
  if (skuSizes.some((size) => size.includes("."))) return [{ fieldName: "尺码", fieldType: "", sourceType: "skip", sourceRefs: [], active: false, validationStatus: "invalid", staleReason: "shoe_half_size_not_supported" }];
  const rows = sourceRows(context).filter((row) => skuSizes.includes(sizeNumber(row.size))).sort((left, right) => Number(sizeNumber(left.size)) - Number(sizeNumber(right.size)));
  if (rows.length !== skuSizes.length) return [{ fieldName: "尺码表", fieldType: "", sourceType: "skip", sourceRefs: [], active: false, validationStatus: "missing", staleReason: "shoe_size_chart_missing_sku_size" }];
  const format = (row: JsonRecord) => ({ size: sizeNumber(row.size), display: `${sizeNumber(row.size)}码`, foot: text(row.footLength), inner: text(row.sportInnerLength), remark: text(row.sportRemark) || `脚长${text(row.footLength)}/内长${text(row.sportInnerLength)}` });
  const normalized = rows.map(format);
  const output: WorkflowField[] = [];
  const main = field(template, "尺码表");
  output.push(...table(main, "尺码表", usableColumns(main ?? {}, ["尺码", "脚长", "鞋内长"]), normalized.map((row) => ({ key: row.display, cells: [row.size, row.foot, row.inner] })), "derived"));
  const vip = field(template, "唯品会尺码表");
  output.push(...table(vip, "唯品会尺码表", usableColumns(vip ?? {}, ["欧洲码", "脚长", "鞋内长"]), normalized.map((row) => ({ key: row.size, cells: [row.size, row.foot, row.inner] })), "derived"));
  const tmall = field(template, "天猫尺码表");
  output.push(...table(tmall, "天猫尺码表", usableColumns(tmall ?? {}, ["脚长", "鞋内长"]), normalized.map((row) => ({ key: row.display, cells: [row.foot, row.inner] })), "derived"));
  const douyin = field(template, "抖音尺码表");
  output.push(...table(douyin, "抖音尺码表", usableColumns(douyin ?? {}, ["脚长(cm)", "备注"]), normalized.map((row) => ({ key: row.display, cells: [row.foot, row.remark] })), "derived"));
  const taobao = field(template, "淘宝尺码表");
  output.push(...table(taobao, "淘宝尺码表", usableColumns(taobao ?? {}, ["脚长范围"]), normalized.map((row) => ({ key: row.display, cells: [row.foot] })), "derived", "shoe_taobao_table_not_sent_on_update"));
  const multi = field(template, "多平台尺码");
  const multiColumns = usableColumns(multi ?? {}, ["天猫", "京东", "拼多多", "微信视频小店", "小红书", "快手"]);
  output.push(...table(multi, "多平台尺码", multiColumns, normalized.map((row) => ({ key: row.display, cells: multiColumns.map((column) => column === "京东" ? row.size : ["拼多多", "微信视频小店", "小红书"].includes(column) ? `${row.display}（${row.remark}）` : "") })), "derived"));
  return output;
}

function apparelTables(context: JsonRecord, template: JsonRecord): WorkflowField[] {
  const plan = record(context.launchPlan);
  const category = `${text(plan.category)} ${text(plan.subcategory)}`;
  const chart = record(context.plmSizeChart ?? context.plm_size_chart);
  const rows = Array.isArray(chart.rows) ? chart.rows.map(record) : [];
  if (text(chart.source) !== "plm_size_chart" || rows.length === 0) return [{ fieldName: "尺码表", fieldType: "", sourceType: "skip", sourceRefs: [], active: false, validationStatus: "missing", staleReason: "plm_size_chart_required" }];
  const skuSizes = new Set((Array.isArray(context.skus) ? context.skus : []).map((sku) => sizeNumber(record(sku).size)).filter(Boolean));
  const included = rows.filter((row) => skuSizes.has(sizeNumber(row.size)));
  const jeans = /牛仔/.test(category);
  const top = !/裤|裙/.test(category) || /连衣|套装/.test(category);
  const requested = jeans ? ["尺码", "裤长", "腰围", "臀围", "脚口", "身高", "体重"] : top ? ["尺码", "衣长", "肩宽", "胸围", "袖长", "身高", "体重"] : ["尺码", "裤长", "腰围", "臀围", "脚口", "身高", "体重"];
  const main = field(template, "尺码表");
  const columns = usableColumns(main ?? {}, requested);
  return table(main, "尺码表", columns, included.map((row) => {
    const rawSize = sizeNumber(row.size);
    const read = (column: string) => text(row[column] ?? row[`${column}(cm)`] ?? row[`${column}（cm）`]);
    return { key: `${rawSize}cm`, cells: columns.map((column) => column === "尺码" ? rawSize : column === "身高" ? rawSize : column === "体重" ? `${APPAREL_WEIGHT_KG[rawSize] ?? ""}${APPAREL_WEIGHT_KG[rawSize] ? "kg" : ""}` : read(column)) };
  }), "derived");
}

export function buildBalabalaSizeTables(contextInput: Record<string, unknown>, templateInput: Record<string, unknown>): WorkflowField[] {
  const context = record(contextInput);
  const template = record(templateInput);
  return isShoe(context) ? shoeTables(context, template) : apparelTables(context, template);
}

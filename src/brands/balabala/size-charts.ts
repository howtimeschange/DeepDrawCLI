import type { WorkflowField } from "../../workflow/types.js";
import { buildPlmSizeChartForTemplate, isBalabalaShoeOnlySizeTableName, normalizeDeepdrawApparelSize } from "./size-chart-rules.js";

type JsonRecord = Record<string, unknown>;

const SHOE_MULTI_PLATFORM_COLUMNS = ["天猫", "京东", "拼多多", "微信视频小店", "小红书", "快手"];
const TRADE_MATCHES: Record<string, { templateType: string; legacyShoeType: string }> = {
  "16608": { templateType: "运动", legacyShoeType: "轻跑鞋" },
  "546": { templateType: "运动", legacyShoeType: "轻跑鞋" },
  "533": { templateType: "休闲", legacyShoeType: "" },
  "534": { templateType: "雪地靴", legacyShoeType: "雪地靴" },
  "538": { templateType: "婴童", legacyShoeType: "学步鞋" },
};

function record(value: unknown): JsonRecord { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {}; }
function text(value: unknown): string { return value === undefined || value === null ? "" : typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value).trim() : ""; }
function compact(value: unknown): string { return text(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ""); }
function fieldName(field: JsonRecord): string { return text(field.fieldName ?? field.field_name ?? field.name); }
function fieldType(field: JsonRecord): string { return text(field.fieldType ?? field.field_type ?? field.type) || "MULTI_TEXT"; }
function optionText(value: unknown): string { const item = record(value); return text(typeof value === "object" ? item.attrValueName ?? item.attr_value_name ?? item.name ?? item.value ?? item.label ?? item.text ?? item.optionName : value); }
function options(field: JsonRecord): string[] { const raw = field.options ?? field.options_json ?? field.optionsJson; return Array.isArray(raw) ? [...new Set(raw.map(optionText).filter(Boolean))] : []; }
function templateFields(template: JsonRecord): JsonRecord[] { return Array.isArray(template.fields) ? template.fields.map(record).filter((item) => fieldName(item)) : []; }
function sizeNumber(value: unknown): string { const match = text(value).replace(/(?:厘米|公分|cm|码)$/i, "").match(/\d+(?:\.5)?/); return match ? String(Number(match[0])) : ""; }
function numberText(value: unknown): string { const raw = text(value).replace(/[,，]/g, ""); const number = Number(raw); return raw && Number.isFinite(number) ? String(Number(number.toFixed(3))) : raw; }
function sortSizes(values: string[]): string[] { return [...values].sort((left, right) => Number(left) - Number(right) || left.localeCompare(right, "zh-Hans-CN")); }
function plan(context: JsonRecord): JsonRecord { return record(context.launchPlan); }
function shoeContext(context: JsonRecord): string { const launch = plan(context); return `${text(context.tradeId ?? context.trade_id)} ${text(context.tradePath ?? context.trade_path)} ${text(launch.productLine)} ${text(launch.category)} ${text(launch.subcategory)}`; }
function isShoe(context: JsonRecord): boolean { return /鞋|靴/.test(shoeContext(context)) || Boolean(TRADE_MATCHES[text(context.tradeId ?? context.trade_id ?? plan(context).tradeId)]); }
function field(template: JsonRecord, name: string): JsonRecord | undefined { return templateFields(template).find((item) => compact(fieldName(item)) === compact(name)); }
function sourceRefRows(context: JsonRecord): WorkflowField["sourceRefs"] { return (Array.isArray(context.skus) ? context.skus : []).map(record).map((item) => record(item.sourceRef)).filter((item) => text(item.path) && text(item.sha256)) as WorkflowField["sourceRefs"]; }
function supportedColumns(template: JsonRecord | undefined, desired: string[], aliases: Record<string, string[]> = {}): string[] {
  if (!template) return [];
  const supported = options(template);
  if (supported.length === 0) return desired;
  return desired.map((name) => supported.find((option) => compact(option) === compact(name)) ?? (aliases[name] ?? []).find((alternative) => supported.some((option) => compact(option) === compact(alternative))) ?? "").filter(Boolean);
}
function workflowField(template: JsonRecord, valueJson: JsonRecord, sourceType: WorkflowField["sourceType"] = "derived", staleReason?: string): WorkflowField {
  return { fieldId: text(template.fieldId ?? template.field_id ?? template.id) || undefined, fieldName: fieldName(template), fieldType: fieldType(template), valueJson, sourceType, sourceRefs: [], active: true, validationStatus: "valid", ...(staleReason ? { staleReason } : {}) };
}
function scalarField(template: JsonRecord, value: string): WorkflowField | undefined {
  if (!value) return undefined;
  const supported = options(template);
  const matched = supported.length ? supported.find((option) => compact(option) === compact(value)) ?? "" : value;
  return matched ? { fieldId: text(template.fieldId ?? template.field_id ?? template.id) || undefined, fieldName: fieldName(template), fieldType: fieldType(template), valueText: matched, sourceType: "derived", sourceRefs: [], active: true, validationStatus: "valid" } : undefined;
}
function table(template: JsonRecord | undefined, columns: string[], rows: Array<{ key: string; cells: string[] }>, staleReason?: string): WorkflowField[] {
  if (!template || columns.length === 0 || rows.length === 0) return [];
  return [workflowField(template, { title: columns.join(","), ...Object.fromEntries(rows.map((row) => [row.key, row.cells.join(",")])) }, "derived", staleReason)];
}

interface ShoeRow { size: string; footRange: string; foot: string; inner: string; remark: string; platformRemark: string; }

function innerForChart(row: JsonRecord, chartCode: string): string {
  if (chartCode === "open_sandal") return text(row.openSandalInnerLength ?? row.open_sandal_inner_length ?? row.inner_length_mm ?? row.innerLength);
  if (chartCode === "closed_sandal") return text(row.closedSandalInnerLength ?? row.closed_sandal_inner_length ?? row.inner_length_mm ?? row.innerLength);
  return text(row.sportInnerLength ?? row.sport_inner_length ?? row.inner_length_mm ?? row.innerLength);
}
function normalizeFootRange(value: unknown): string { return text(value).replace(/[～~]/g, "-"); }
function normalizeShoeRows(context: JsonRecord, chartCode: string, skuSizes: string[]): ShoeRow[] {
  const chart = record(context.sizeChart ?? context.size_chart);
  const rawRows = Array.isArray(chart.rows) ? chart.rows.map(record) : [];
  return rawRows.map((row) => {
    const size = sizeNumber(row.size ?? row.size_value);
    const rawFoot = text(row.footLength ?? row.foot_length ?? row.foot_length_mm);
    const footRange = normalizeFootRange(rawFoot);
    const foot = row.foot_length_mm !== undefined ? numberText(Number(rawFoot) / 10) : footRange;
    const rawInner = innerForChart(row, chartCode);
    const inner = row.inner_length_mm !== undefined ? numberText(Number(rawInner) / 10) : numberText(rawInner);
    const remark = text(row.general_mapping_text ?? row.sportRemark ?? row.douyin_mapping_text) || `脚长${footRange}/内长${inner}`;
    const display = size ? `${size}码` : "";
    const platformRemark = text(row.video_pdd_vip_mapping_text ?? row.sportMulti ?? row.sportVip ?? row.sportPdd).match(/[（(].*[）)]/)?.[0] ?? `${display}（${remark}）`;
    return { size, footRange, foot, inner, remark, platformRemark };
  }).filter((row) => skuSizes.includes(row.size)).sort((left, right) => Number(left.size) - Number(right.size));
}
function sandalMatch(classification: unknown): { chartCode: string; templateType: string; shoeSizeTableType: string; legacyShoeType: string } | undefined {
  const value = compact(classification);
  if (!value) return undefined;
  if (value.includes(compact("运动公主鞋"))) return { chartCode: "sport_leisure", templateType: "休闲", shoeSizeTableType: "运动公主鞋", legacyShoeType: "公主鞋" };
  if (value.includes(compact("中空凉鞋")) || value.includes(compact("前后包鞋面")) || value.includes(compact("镂空凉鞋")) || value.includes(compact("包头凉鞋"))) return { chartCode: "closed_sandal", templateType: "休闲", shoeSizeTableType: value.includes(compact("包头凉鞋")) ? "包头凉鞋" : "镂空凉鞋", legacyShoeType: "凉鞋" };
  if (value.includes(compact("前后空凉鞋")) || value === compact("凉鞋")) return { chartCode: "open_sandal", templateType: "休闲", shoeSizeTableType: "凉鞋", legacyShoeType: "凉鞋" };
  return undefined;
}
function shoeMatch(context: JsonRecord): { status: "matched" | "needs_visual_classification"; chartCode: string; templateType: string; shoeSizeTableType: string; legacyShoeType: string } {
  const launch = plan(context);
  const tradeId = text(context.tradeId ?? context.trade_id ?? launch.tradeId ?? launch.trade_id);
  const exact = TRADE_MATCHES[tradeId];
  if (exact) return { status: "matched", chartCode: "sport_leisure", shoeSizeTableType: "", ...exact };
  const source = shoeContext(context);
  if (/凉鞋/.test(source)) return sandalMatch(context.sandalClassification ?? context.sandal_classification) ? { status: "matched", ...sandalMatch(context.sandalClassification ?? context.sandal_classification)! } : { status: "needs_visual_classification", chartCode: "", templateType: "休闲", shoeSizeTableType: "", legacyShoeType: "凉鞋" };
  if (/雪地靴/.test(source)) return { status: "matched", chartCode: "sport_leisure", templateType: "雪地靴", shoeSizeTableType: "", legacyShoeType: "雪地靴" };
  if (/学步鞋|步前鞋|婴童|宝宝鞋/.test(source)) return { status: "matched", chartCode: "sport_leisure", templateType: "婴童", shoeSizeTableType: "", legacyShoeType: /步前鞋/.test(source) ? "婴儿步前鞋" : "学步鞋" };
  if (/运动鞋|户外鞋|跑鞋|足球鞋|篮球鞋/.test(source)) return { status: "matched", chartCode: "sport_leisure", templateType: "运动", shoeSizeTableType: "", legacyShoeType: /足球/.test(source) ? "足球鞋" : /篮球/.test(source) ? "篮球鞋" : "轻跑鞋" };
  return { status: "matched", chartCode: "sport_leisure", templateType: "休闲", shoeSizeTableType: "", legacyShoeType: "" };
}
function shoeSizeSegment(rows: ShoeRow[], template: JsonRecord): string {
  const supported = options(template);
  if (rows.length === 0 || supported.length === 0) return "";
  const maximum = Math.max(...rows.map((row) => Number(row.size)).filter(Number.isFinite));
  const usesFootRange = supported.some((option) => compact(option) === compact("14-16cm"));
  const value = usesFootRange ? "" : maximum <= 26 ? "26码以下" : maximum <= 28 ? "26-28码" : maximum <= 30 ? "29-30码" : maximum <= 32 ? "31-32码" : maximum <= 34 ? "33-34码" : "34码以上";
  return supported.find((option) => compact(option) === compact(value)) ?? "";
}
function shoeTables(context: JsonRecord, template: JsonRecord): WorkflowField[] {
  const skuSizes = [...new Set((Array.isArray(context.skus) ? context.skus : []).map(record).map((sku) => sizeNumber(sku.size ?? sku.sizeName ?? sku.size_name)).filter(Boolean))];
  if (skuSizes.some((size) => size.includes("."))) return [{ fieldName: "尺码", fieldType: "", sourceType: "skip", sourceRefs: [], active: false, validationStatus: "invalid", staleReason: "shoe_half_size_not_supported" }];
  const match = shoeMatch(context);
  if (match.status === "needs_visual_classification") return [{ fieldName: "凉鞋结构", fieldType: "", sourceType: "skip", sourceRefs: [], active: false, validationStatus: "missing", staleReason: "needs_visual_classification" }];
  const rows = normalizeShoeRows(context, match.chartCode, skuSizes);
  if (rows.length !== skuSizes.length) return [{ fieldName: "尺码表", fieldType: "", sourceType: "skip", sourceRefs: [], active: false, validationStatus: "missing", staleReason: "shoe_size_chart_missing_sku_size" }];
  const output: WorkflowField[] = [];
  const display = (row: ShoeRow) => `${row.size}码`;
  const main = field(template, "尺码表");
  const mainColumns = supportedColumns(main, ["尺码", "脚长", "鞋内长"], { 鞋内长: ["内长", "鞋长"] });
  output.push(...table(main, mainColumns, rows.map((row) => ({ key: display(row), cells: mainColumns.map((column) => compact(column) === compact("尺码") ? row.size : compact(column) === compact("脚长") ? row.foot : row.inner) }))));
  const vip = field(template, "唯品会尺码表");
  const vipColumns = supportedColumns(vip, ["欧洲码", "脚长", "鞋内长"], { 鞋内长: ["鞋长"] });
  output.push(...table(vip, vipColumns, rows.map((row) => ({ key: display(row), cells: vipColumns.map((column) => compact(column) === compact("欧洲码") ? row.size : compact(column) === compact("脚长") ? row.foot : row.inner) }))));
  const tmall = field(template, "天猫尺码表");
  const tmallColumns = supportedColumns(tmall, ["脚长", "鞋内长"]);
  output.push(...table(tmall, tmallColumns, rows.map((row) => ({ key: display(row), cells: tmallColumns.map((column) => compact(column) === compact("脚长") ? row.foot : row.inner) }))));
  const douyin = field(template, "抖音尺码表");
  const douyinColumns = supportedColumns(douyin, ["脚长(cm)", "备注"]);
  output.push(...table(douyin, douyinColumns, rows.map((row) => ({ key: display(row), cells: douyinColumns.map((column) => compact(column) === compact("脚长(cm)") ? row.foot : row.remark) }))));
  const taobao = field(template, "淘宝尺码表");
  const taobaoColumns = supportedColumns(taobao, ["脚长"], { 脚长: ["脚长范围"] });
  output.push(...table(taobao, taobaoColumns, rows.map((row) => ({ key: display(row), cells: taobaoColumns.map(() => row.footRange) })), "shoe_taobao_table_not_sent_on_update"));
  const multi = field(template, "多平台尺码");
  const multiColumns = supportedColumns(multi, SHOE_MULTI_PLATFORM_COLUMNS, { 微信视频小店: ["微信视频", "微信视频号"] });
  output.push(...table(multi, multiColumns, rows.map((row) => ({ key: display(row), cells: multiColumns.map((column) => compact(column) === compact("京东") ? row.size : ["拼多多", "微信视频小店", "微信视频", "微信视频号", "小红书"].some((name) => compact(name) === compact(column)) ? row.platformRemark : "") }))));
  for (const [name, value] of [["尺码.", shoeSizeSegment(rows, field(template, "尺码.") ?? {})], ["尺码类型", "欧码（童鞋）"], ["25鞋子模板类型", match.templateType], ["25鞋子尺码表", match.shoeSizeTableType], ["22Q4-童鞋尺码表", match.legacyShoeType]] as const) {
    const item = field(template, name);
    if (item) { const scalar = scalarField(item, value); if (scalar) output.push(scalar); }
  }
  return output;
}

function apparelRows(context: JsonRecord): JsonRecord[] {
  const chart = record(context.plmSizeChart ?? context.plm_size_chart ?? context.sizeChart ?? context.size_chart);
  const rows = Array.isArray(chart.rows) ? chart.rows : [];
  const spu = text(context.spu);
  const normal = rows.map(record);
  const alreadyLong = normal.some((row) => text(row.测量点 ?? row.measurementPoint ?? row.measurement_point));
  if (alreadyLong) return normal;
  return normal.flatMap((row) => {
    const size = text(row.size ?? row.尺码);
    return Object.entries(row).filter(([name, value]) => !["size", "尺码", "款号", "spuCode"].includes(name) && text(value)).map(([measurementPoint, sizeValue]) => ({ 款号: spu || text(row.款号 ?? row.spuCode) || "__local__", 测量点: measurementPoint, 尺码: size, 尺码值: sizeValue }));
  });
}

function apparelMainSizeTable(name: string): boolean {
  const key = compact(name);
  return key.includes(compact("尺码表"))
    && key !== compact("多平台尺码")
    && !isBalabalaShoeOnlySizeTableName(name)
    && !/(?:唯品会|抖音|天猫|淘宝|京东|拼多多|小红书|快手|微信视频|好衣库|爱库存|1688|平台)/.test(key);
}

function missingPlmMainTable(template: JsonRecord): WorkflowField {
  return {
    fieldId: text(template.fieldId ?? template.field_id ?? template.id) || undefined,
    fieldName: fieldName(template),
    fieldType: fieldType(template),
    sourceType: "skip",
    sourceRefs: [],
    active: true,
    validationStatus: "missing",
    staleReason: "plm_size_chart_required",
  };
}

function apparelTables(context: JsonRecord, template: JsonRecord): WorkflowField[] {
  const chart = record(context.plmSizeChart ?? context.plm_size_chart ?? context.sizeChart ?? context.size_chart);
  const rows = apparelRows(context);
  const hasPlmMeasurements = text(chart.source) === "plm_size_chart" && rows.length > 0;
  const launch = plan(context);
  const allowedSizes = [...new Set((Array.isArray(context.skus) ? context.skus : []).map(record).map((sku) => normalizeDeepdrawApparelSize(sku.size ?? sku.sizeName ?? sku.size_name)).filter(Boolean))];
  const referenceRows = Array.isArray(record(context.apparelSizeReference ?? context.apparel_size_reference).rows)
    ? record(context.apparelSizeReference ?? context.apparel_size_reference).rows as unknown[]
    : [];
  const output: WorkflowField[] = [];
  for (const item of templateFields(template)) {
    const name = fieldName(item);
    const key = compact(name);
    if (!(key === compact("多平台尺码") || key.includes(compact("尺码表")))) continue;
    // Some apparel templates contain legacy shoe-only enum slots. Listingify
    // keeps them inactive outside shoe drafts; never turn them into a PLM
    // requirement or a synthetic apparel size table.
    if (isBalabalaShoeOnlySizeTableName(name)) continue;
    if (apparelMainSizeTable(name) && !hasPlmMeasurements) {
      output.push(missingPlmMainTable(item));
      continue;
    }
    const mappings = context.sizeChartMappings ?? context.size_chart_mappings;
    const result = buildPlmSizeChartForTemplate({ rows: hasPlmMeasurements ? rows : [], spuCode: context.spu, template: item, mappings: Array.isArray(mappings) ? mappings : [], allowedSizes, gender: launch.gender, garmentType: `${text(launch.subcategory)} ${text(launch.category)}`, apparelProduct: true, apparelSizeReferenceRows: referenceRows });
    if (Object.keys(result.valueJson).length > 1) output.push(workflowField(item, result.valueJson));
  }
  return output.length ? output : [{ fieldName: "尺码表", fieldType: "", sourceType: "skip", sourceRefs: [], active: false, validationStatus: "missing", staleReason: "plm_size_chart_mapping_required" }];
}

export function buildBalabalaSizeTables(contextInput: Record<string, unknown>, templateInput: Record<string, unknown>): WorkflowField[] {
  const context = record(contextInput);
  const template = record(templateInput);
  return isShoe(context) ? shoeTables(context, template) : apparelTables(context, template);
}

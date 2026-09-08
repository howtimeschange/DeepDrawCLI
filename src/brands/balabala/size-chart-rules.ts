import { BUILTIN_APPAREL_ROWS } from "./size-reference-data.js";
/**
 * Local TypeScript port of Listingify's product_archive_size_chart.mjs.
 * It is deliberately data-only: PLM rows and optional reviewed mappings are
 * supplied by the local workflow, never read from Listingify or a database.
 */

export type JsonRecord = Record<string, unknown>;

export interface NormalizedPlmSizeRow {
  spuCode: string;
  skcCode?: string;
  measurementPoint: string;
  size: string;
  sizeValue: string;
  rowJson: JsonRecord;
}

export interface SizeChartMapping {
  targetField: string;
  sourcePoint: string;
  confidence: "high" | "medium" | "low" | "manual" | "unmatched";
  source: "rule" | "ai" | "rule_fallback" | "manual";
  reason: string;
}

const SPU_KEYS = ["spuCode", "spu_code", "款号", "大货款号", "货号", "商品品种编号"];
const MEASUREMENT_KEYS = ["measurementPoint", "measurement_point", "测量点", "量点", "部位", "项目"];
const SIZE_KEYS = ["size", "size_name", "尺码", "规格", "码段"];
const SIZE_VALUE_KEYS = ["sizeValue", "size_value", "尺码值", "测量值", "数值", "值"];
const SKC_KEYS = ["skcCode", "skc_code", "款色", "款色号", "款色编码"];
export const MULTI_PLATFORM_SIZE_COLUMNS = ["天猫", "京东", "拼多多", "微信视频小店", "小红书", "快手"] as const;

export const BALABALA_APPAREL_SIZE_REFERENCE = BUILTIN_APPAREL_ROWS;

interface ApparelSizeReferenceRow {
  size: string;
  weightKg: string;
  age: string;
  douyinWeightJin: string;
  maleTop: string;
  maleBottom: string;
  femaleTop: string;
  femaleBottom: string;
  neutralTop: string;
  neutralBottom: string;
}

function text(value: unknown): string {
  return value === undefined || value === null ? "" : typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value).trim() : "";
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

export function compactSizeChartKey(value: unknown): string {
  return text(value).replace(/\s+/g, "").replace(/[()（）]/g, "").replace(/[：:]/g, ":").replace(/(?:cm|厘米|kg|公斤|斤|g|克)$/i, "").toLowerCase();
}

function firstValue(row: JsonRecord, keys: string[]): string {
  for (const key of keys) {
    const direct = text(row[key]);
    if (direct) return direct;
    const match = Object.entries(row).find(([name]) => compactSizeChartKey(name) === compactSizeChartKey(key));
    if (match && text(match[1])) return text(match[1]);
  }
  return "";
}

function numberText(value: unknown): string {
  const raw = text(value).replace(/[,，]/g, "");
  if (!raw) return "";
  const number = Number(raw);
  return Number.isFinite(number) ? String(Number(number.toFixed(3))) : raw;
}

function isZero(value: unknown): boolean { return /^0(?:\.0+)?$/.test(text(value)); }

export function normalizeDeepdrawApparelSize(value: unknown): string {
  const raw = text(value).replace(/\/+$/, "");
  const match = raw.match(/^0*(\d{2,3})(?:\s*(?:cm|厘米|公分|码))?$/i);
  return match ? `${Number(match[1])}cm` : raw;
}

function sizeNumber(value: unknown): string {
  return normalizeDeepdrawApparelSize(value).match(/^(\d{2,3})cm$/)?.[1] ?? text(value).match(/\d{2,3}/)?.[0] ?? "";
}

function sizeKeys(value: unknown): string[] {
  const normalized = normalizeDeepdrawApparelSize(value);
  const number = sizeNumber(value);
  return [...new Set([text(value), normalized, number, number ? number.padStart(3, "0") : ""].map((item) => item.replace(/\s+/g, "").toLowerCase()).filter(Boolean))];
}

function sourceRows(rows: unknown[]): JsonRecord[] { return rows.map(record).filter((row) => Object.keys(row).length > 0); }

/** Normalizes both PLM long rows and wide measurement tables. */
export function normalizePlmSizeChartRows(rows: unknown[], options: { sheetName?: string; rowOffset?: number } = {}): NormalizedPlmSizeRow[] {
  const output: NormalizedPlmSizeRow[] = [];
  sourceRows(rows).forEach((row, index) => {
    const spuCode = firstValue(row, SPU_KEYS);
    const measurementPoint = firstValue(row, MEASUREMENT_KEYS).replace(/\s+/g, "");
    const skcCode = firstValue(row, SKC_KEYS);
    if (!spuCode || !measurementPoint) return;
    const make = (size: unknown, value: unknown): void => {
      const normalizedSize = normalizeDeepdrawApparelSize(size);
      const normalizedValue = numberText(value);
      if (!normalizedSize || !normalizedValue || isZero(normalizedValue)) return;
      const rowJson: JsonRecord = { ...row, 款号: spuCode, 测量点: measurementPoint, 尺码: normalizedSize, 尺码值: normalizedValue };
      if (options.sheetName) rowJson.sheetName = options.sheetName;
      if (options.rowOffset !== undefined) rowJson.rowNumber = options.rowOffset + index + 1;
      output.push({ spuCode, ...(skcCode ? { skcCode } : {}), measurementPoint, size: normalizedSize, sizeValue: normalizedValue, rowJson });
    };
    const longSize = firstValue(row, SIZE_KEYS);
    const longValue = firstValue(row, SIZE_VALUE_KEYS);
    if (longSize && longValue) {
      make(longSize, longValue);
      return;
    }
    for (const [column, value] of Object.entries(row)) if (/^0?\d{2,3}(?:cm|\/)?$/i.test(column.replace(/\s+/g, ""))) make(column, value);
  });
  const seen = new Set<string>();
  return output.filter((row) => {
    const key = `${row.spuCode}\u0000${row.measurementPoint}\u0000${row.size}\u0000${row.sizeValue}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function genderKey(value: unknown): "male" | "female" | "neutral" | "" {
  const key = text(value).replace(/\s+/g, "");
  if (key.includes("中性") || key.includes("男女") || (key.includes("男") && key.includes("女"))) return "neutral";
  if (key.includes("女")) return "female";
  if (key.includes("男")) return "male";
  return "";
}

export function apparelGarmentKey(value: unknown): "top" | "bottom" | "" {
  const key = text(value).replace(/\s+/g, "");
  if (/下装|裤|裙/.test(key)) return "bottom";
  if (/上装|衣|衫|外套|卫衣|夹克|大衣|马甲|背心|羽绒服|棉服|冲锋衣|防晒服|功能中间层/.test(key)) return "top";
  return "";
}

function builtinReferenceRows(): ApparelSizeReferenceRow[] {
  return BALABALA_APPAREL_SIZE_REFERENCE.map((row) => ({
    size: String(row[0]), weightKg: String(row[1]), age: row[2], douyinWeightJin: String(row[3]),
    maleTop: row[4], maleBottom: row[5], femaleTop: row[6], femaleBottom: row[7], neutralTop: row[8], neutralBottom: row[9],
  }));
}

function importedReferenceRows(value: unknown[] | undefined): ApparelSizeReferenceRow[] {
  return (value ?? []).map(record).map((row) => ({
    size: sizeNumber(row.size ?? row.尺码), weightKg: text(row.weightKg ?? row.weight_kg ?? row.体重), age: text(row.age ?? row.年龄), douyinWeightJin: text(row.douyinWeightJin ?? row.douyin_weight_jin ?? row.抖音重量),
    maleTop: text(row.maleTop ?? row.male_top ?? row.男上装), maleBottom: text(row.maleBottom ?? row.male_bottom ?? row.男下装),
    femaleTop: text(row.femaleTop ?? row.female_top ?? row.女上装), femaleBottom: text(row.femaleBottom ?? row.female_bottom ?? row.女下装),
    neutralTop: text(row.neutralTop ?? row.neutral_top ?? row.中性上装), neutralBottom: text(row.neutralBottom ?? row.neutral_bottom ?? row.中性下装),
  })).filter((row) => row.size && row.weightKg && row.age && row.douyinWeightJin && row.maleTop && row.maleBottom && row.femaleTop && row.femaleBottom && row.neutralTop && row.neutralBottom);
}

function reference(size: unknown, referenceRows?: unknown[]): ApparelSizeReferenceRow | undefined {
  const imported = importedReferenceRows(referenceRows);
  const rows = imported.length > 0 ? imported : builtinReferenceRows();
  return rows.find((row) => row.size === sizeNumber(size));
}

/**
 * Listingify's apparel-age derivation.  It converts an MDM/launch-plan size
 * range into the age range covered by the Balabala reference rows, instead of
 * guessing from the numeric centimetre range.  Imported reference rows take
 * precedence when a workflow supplies its reviewed local size-reference file.
 */
export function balabalaApparelAgeTextForSizeRange(value: unknown, referenceRows?: unknown[]): string {
  const sizes = Array.from(text(value).matchAll(/\d{2,3}/g)).map((match) => Number(match[0]));
  if (sizes.length === 0) return "";
  const start = Math.min(...sizes);
  const end = Math.max(...sizes);
  const imported = importedReferenceRows(referenceRows);
  const rows = (imported.length > 0 ? imported : builtinReferenceRows())
    .filter((row) => Number(row.size) >= start && Number(row.size) <= end);
  const ranges = rows.map((row) => {
    const match = row.age.match(/(\d{1,2})\s*[-~～至—－]\s*(\d{1,2})\s*岁/);
    return match ? { start: Number(match[1]), end: Number(match[2]) } : undefined;
  }).filter((range): range is { start: number; end: number } => Boolean(range));
  return ranges.length ? `${Math.min(...ranges.map((range) => range.start))}-${Math.max(...ranges.map((range) => range.end))}岁` : "";
}

export function balabalaRecommendedSize(size: unknown, gender: unknown, garmentType: unknown, referenceRows?: unknown[]): string {
  const row = reference(size, referenceRows);
  const genderValue = genderKey(gender);
  const garment = apparelGarmentKey(garmentType);
  if (!row || !genderValue || !garment) return "";
  const keys: Record<"male" | "female" | "neutral", { top: keyof ApparelSizeReferenceRow; bottom: keyof ApparelSizeReferenceRow }> = {
    male: { top: "maleTop", bottom: "maleBottom" }, female: { top: "femaleTop", bottom: "femaleBottom" }, neutral: { top: "neutralTop", bottom: "neutralBottom" },
  };
  return row[keys[genderValue][garment]];
}

function builtinMapping(targetField: string, gender: unknown, garmentType: unknown): string {
  const key = compactSizeChartKey(targetField);
  if (/适合年龄|推荐年龄/.test(key)) return "balabala:age";
  if (/斤|抖音重量/.test(text(targetField))) return "balabala:douyin_weight";
  if (/kg|公斤/i.test(text(targetField)) || key === compactSizeChartKey("体重")) return "balabala:weight";
  if (/上装号型|上衣号型/.test(key) && genderKey(gender)) return "balabala:recommended_top_size";
  if (/下装号型|裤装号型/.test(key) && genderKey(gender)) return "balabala:recommended_bottom_size";
  if (/号型|推荐尺码|标准尺码/.test(key) && genderKey(gender) && apparelGarmentKey(garmentType)) return "balabala:recommended_size";
  return "";
}

const HIGH: Array<[string, string[]]> = [
  ["领口", ["领口", "领围", "领宽"]], ["衣长", ["衣长", "后中长"]], ["裙长", ["裙长"]], ["肩宽", ["肩宽"]],
  ["胸围", ["胸围", "全胸围（夹下1CM", "全胸围（夹下1CM）", "1/2胸围（平量）", "1/2胸围"]], ["裤长", ["裤长"]],
  ["腰围", ["全腰围（平量）", "腰围", "1/2腰围（平量）", "1/2腰围"]], ["臀围", ["臀围", "臀围（平量）", "1/2臀围（平量）", "1/2臀围"]],
  ["脚口", ["1/2脚口（平量）"]], ["裤口围", ["1/2脚口（平量）"]], ["下摆围", ["下摆围（平量）", "下摆围（弧量）", "裙摆围"]], ["下摆", ["下摆围（平量）", "下摆围（弧量）", "裙摆围"]], ["体重", ["体重", "建议体重", "适合体重", "体重(斤)"]],
];
const MEDIUM: Array<[string, string[]]> = [
  ["袖长", ["袖长（三点量）插肩/落肩", "袖长（三点量）", "袖长（肩至袖口", "袖长", "袖长肩点量", "内袖长", "里：袖长"]],
  ["前浪", ["前浪（弯量）"]], ["前档", ["前浪（弯量）"]], ["前裆", ["前浪（弯量）"]], ["后浪", ["后浪（弯量）"]], ["后裆", ["后浪（弯量）"]], ["大腿围", ["1/2脾围"]], ["袖笼围", ["1/2夹圈（弯量）", "1/2夹圈弯量", "1/2夹直（边至边量）背心"]],
];

function optionText(value: unknown): string {
  const item = record(value);
  return typeof value === "object" ? text(item.value ?? item.optionValue ?? item.option_value ?? item.code ?? item.key ?? item.name ?? item.label ?? item.text ?? item.optionName ?? item.option_name ?? item.title ?? item.id) : text(value);
}

function options(template: JsonRecord): string[] { return [...new Set((Array.isArray(template.options) ? template.options : []).map(optionText).filter(Boolean))]; }
export function isBalabalaShoeOnlySizeTableName(name: unknown): boolean {
  return /^(?:22q4|25)鞋子尺码表$/.test(compactSizeChartKey(name).replace(/-/g, ""));
}
function isMain(name: string): boolean { const key = compactSizeChartKey(name); return key.includes("尺码表") && key !== "多平台尺码" && !isBalabalaShoeOnlySizeTableName(name) && !/(?:唯品会|抖音|天猫|淘宝|京东|拼多多|小红书|快手|微信视频|好衣库|爱库存|1688|平台)/.test(key); }
function isVip(name: string): boolean { return compactSizeChartKey(name) === compactSizeChartKey("唯品会尺码表"); }
function isDouyin(name: string): boolean { return compactSizeChartKey(name) === compactSizeChartKey("抖音尺码表"); }
function genericSize(name: string): boolean { return ["尺码", "尺寸"].some((item) => compactSizeChartKey(item) === compactSizeChartKey(name)); }

function mainColumns(raw: string[], garmentType: unknown, apparel: boolean): string[] {
  const garment = apparelGarmentKey(garmentType);
  const category = text(garmentType).replace(/\s+/g, "");
  if (/牛仔(?:裤|长裤|短裤|中裤)/.test(category)) return ["尺码", "裤长", "腰围", "臀围", "脚口", "身高", "体重"];
  if (garment === "top") return ["尺码", "衣长", "肩宽", "胸围", "袖长", "身高", "体重"];
  if (garment === "bottom" || apparel) return ["尺码", ...raw.filter((item) => !genericSize(item))];
  return raw;
}

function vipColumns(raw: string[], garmentType: unknown): string[] {
  const garment = apparelGarmentKey(garmentType);
  if (!garment) return raw;
  const genericModel = raw.some((item) => compactSizeChartKey(item) === compactSizeChartKey("号型"));
  return raw.filter((item) => {
    const key = compactSizeChartKey(item);
    if (genericModel && (key === compactSizeChartKey("上装号型") || key === compactSizeChartKey("下装号型"))) return false;
    return !(garment === "bottom" && ["前浪", "前档", "前裆", "后浪", "后裆", "大腿围"].some((excluded) => key === compactSizeChartKey(excluded)));
  });
}

function requiredRows(template: JsonRecord, garmentType: unknown, apparel: boolean): string[] {
  const name = text(template.fieldName ?? template.field_name ?? template.name);
  const raw = options(template);
  if (compactSizeChartKey(name) === compactSizeChartKey("多平台尺码")) return MULTI_PLATFORM_SIZE_COLUMNS.filter((column) => raw.length === 0 || raw.some((item) => compactSizeChartKey(item) === compactSizeChartKey(column)));
  const business = isMain(name) ? mainColumns(raw, garmentType, apparel) : isVip(name) ? vipColumns(raw, garmentType) : raw;
  const wantsSize = isMain(name) ? !business.some(genericSize) : isVip(name) ? !business.some((item) => genericSize(item) || compactSizeChartKey(item) === compactSizeChartKey("号型") || compactSizeChartKey(item) === compactSizeChartKey("上装号型") || compactSizeChartKey(item) === compactSizeChartKey("下装号型") || compactSizeChartKey(item) === compactSizeChartKey("身高")) : false;
  return wantsSize ? ["尺码", ...business] : business;
}

function mappingFor(target: string, rows: NormalizedPlmSizeRow[], gender: unknown, garmentType: unknown, explicit: Map<string, SizeChartMapping>): SizeChartMapping {
  const provided = explicit.get(compactSizeChartKey(target));
  if (provided) return provided;
  if (genericSize(target)) return { targetField: target, sourcePoint: "尺码", confidence: "high", source: "rule", reason: "表内尺码列填裸数字" };
  if (compactSizeChartKey(target) === compactSizeChartKey("身高")) {
    const point = rows.find((row) => compactSizeChartKey(row.measurementPoint) === compactSizeChartKey("身高"))?.measurementPoint;
    return { targetField: target, sourcePoint: point ?? "尺码", confidence: "high", source: "rule", reason: point ? "PLM 直接量点" : "按尺码标签填身高" };
  }
  for (const [targetField, aliases] of [...HIGH, ...MEDIUM]) {
    if (compactSizeChartKey(target) !== compactSizeChartKey(targetField)) continue;
    const point = aliases.map((alias) => rows.find((row) => compactSizeChartKey(row.measurementPoint) === compactSizeChartKey(alias))?.measurementPoint).find(Boolean);
    if (point) return { targetField: target, sourcePoint: point, confidence: HIGH.some(([item]) => item === targetField) ? "high" : "medium", source: "rule", reason: "PLM 量点映射" };
  }
  const builtin = builtinMapping(target, gender, garmentType);
  return builtin ? { targetField: target, sourcePoint: builtin, confidence: "high", source: "rule", reason: "巴拉服饰尺码基准表" } : { targetField: target, sourcePoint: "", confidence: "unmatched", source: "rule", reason: "需要人工尺码映射" };
}

function mappedValue(mapping: SizeChartMapping, size: string, values: Map<string, string>, main: boolean, gender: unknown, garmentType: unknown, referenceRows?: unknown[]): string {
  const source = mapping.sourcePoint;
  const ref = reference(size, referenceRows);
  if (source === "balabala:age") return ref?.age ?? "";
  if (source === "balabala:weight") return ref?.weightKg ?? "";
  if (source === "balabala:douyin_weight") return ref?.douyinWeightJin ?? "";
  if (source === "balabala:recommended_size") return balabalaRecommendedSize(size, gender, garmentType, referenceRows);
  if (source === "balabala:recommended_top_size") return balabalaRecommendedSize(size, gender, "上装", referenceRows);
  if (source === "balabala:recommended_bottom_size") return balabalaRecommendedSize(size, gender, "下装", referenceRows);
  if (source === "尺码") return sizeNumber(size);
  const value = values.get(`${compactSizeChartKey(source)}\u0000${normalizeDeepdrawApparelSize(size)}`) ?? "";
  if (!value) return "";
  const double = ["胸围", "腰围", "臀围", "脚口", "裤口围"].some((item) => compactSizeChartKey(item) === compactSizeChartKey(mapping.targetField)) && /1\/2/.test(source.replace(/\s+/g, ""));
  return double && Number.isFinite(Number(value)) ? String(Number((Number(value) * 2).toFixed(3))) : value;
}

/** Build one local structured size field exactly from its current template. */
export function buildPlmSizeChartForTemplate(input: {
  rows: unknown[];
  spuCode?: unknown;
  template: JsonRecord;
  mappings?: unknown[];
  allowedSizes?: unknown[];
  gender?: unknown;
  garmentType?: unknown;
  apparelProduct?: boolean;
  apparelSizeReferenceRows?: unknown[];
}): { valueJson: JsonRecord; mappings: SizeChartMapping[]; unmatchedTargets: string[] } {
  const fieldName = text(input.template.fieldName ?? input.template.field_name ?? input.template.name);
  const allowed = new Set((input.allowedSizes ?? []).flatMap(sizeKeys));
  const rows = normalizePlmSizeChartRows(input.rows).filter((row) => (!text(input.spuCode) || row.spuCode === text(input.spuCode)) && (allowed.size === 0 || sizeKeys(row.size).some((key) => allowed.has(key))));
  const explicit = new Map<string, SizeChartMapping>();
  for (const item of input.mappings ?? []) {
    const raw = record(item);
    const targetField = text(raw.targetField ?? raw.target_field);
    const desired = text(raw.sourcePoint ?? raw.source_point);
    const sourcePoint = rows.find((row) => compactSizeChartKey(row.measurementPoint) === compactSizeChartKey(desired))?.measurementPoint;
    if (targetField && sourcePoint) explicit.set(compactSizeChartKey(targetField), { targetField, sourcePoint, confidence: "manual", source: "manual", reason: text(raw.reason) || "人工审核尺码映射" });
  }
  const targetFields = requiredRows(input.template, input.garmentType, input.apparelProduct === true);
  const multi = compactSizeChartKey(fieldName) === compactSizeChartKey("多平台尺码");
  const mappings = targetFields.map((targetField) => multi ? { targetField, sourcePoint: compactSizeChartKey(targetField) === compactSizeChartKey("京东") ? "尺码" : "", confidence: "high" as const, source: "rule" as const, reason: "多平台尺码规则" } : mappingFor(targetField, rows, input.gender, input.garmentType, explicit));
  const rowSizes = [...new Set(rows.map((row) => row.size))];
  const sizes = rowSizes.length > 0 ? rowSizes : [...new Set((input.allowedSizes ?? []).map(normalizeDeepdrawApparelSize).filter(Boolean))];
  const values = new Map(rows.map((row) => [`${compactSizeChartKey(row.measurementPoint)}\u0000${row.size}`, row.sizeValue]));
  const forceColumns = isMain(fieldName) && (/牛仔/.test(text(input.garmentType)) || apparelGarmentKey(input.garmentType) === "top");
  const activeIndexes = mappings.map((mapping, index) => ({ mapping, index })).filter(({ mapping, index }) => multi || forceColumns || sizes.every((size) => Boolean(mappedValue(mapping, size, values, isMain(fieldName), input.gender, input.garmentType, input.apparelSizeReferenceRows))));
  const nonSize = activeIndexes.filter(({ mapping }) => !genericSize(mapping.targetField));
  const valueJson: JsonRecord = {};
  if (sizes.length > 0 && activeIndexes.length > 0 && (!isMain(fieldName) || nonSize.length > 0)) {
    valueJson.title = activeIndexes.map(({ mapping }) => mapping.targetField).join(",");
    for (const size of sizes.sort((left, right) => Number(sizeNumber(left)) - Number(sizeNumber(right)))) {
      const key = normalizeDeepdrawApparelSize(size);
      valueJson[key] = activeIndexes.map(({ mapping }) => multi ? compactSizeChartKey(mapping.targetField) === compactSizeChartKey("京东") ? sizeNumber(size) : "" : mappedValue(mapping, size, values, isMain(fieldName), input.gender, input.garmentType, input.apparelSizeReferenceRows)).join(",");
    }
  }
  return { valueJson, mappings, unmatchedTargets: mappings.filter((mapping) => !mapping.sourcePoint).map((mapping) => mapping.targetField) };
}

import type { WorkflowField } from "../../workflow/types.js";
type JsonRecord = Record<string, unknown>;
const text = (value: unknown): string => value == null ? "" : String(value).trim();
const key = (value: unknown): string => text(value).replace(/[\s()（）:：]/g, "").toLowerCase();
const size = (value: unknown): string => String(Number(text(value).match(/\d{2,3}/)?.[0] ?? NaN));
const fillTitle = (value: string): boolean => /充绒|填充.*(?:g|克|量)/i.test(value);

/** Gram weights are supplied facts. Percentages and an unallocated min/max are never expanded. */
export function applyBalabalaDownFill(fieldsInput: WorkflowField[], skus: unknown[], templates: JsonRecord[]): { fields: WorkflowField[]; sizeRemarks: Record<string, string> } {
  const fields = structuredClone(fieldsInput);
  const sources = fields.filter((field) => field.active !== false && ["充绒量", "充绒量文本"].includes(key(field.fieldName)) && text(field.valueText));
  const weights = new Map<string, string>();
  const errors: string[] = [];
  let evidence: WorkflowField | undefined;
  for (const field of sources) {
    if (!["manual", "ocr", "mdm", "copywriting", "remote"].includes(field.sourceType)) {
      errors.push("充绒克重必须来自人工/OCR/MDM/文案实证"); continue;
    }
    const raw = text(field.valueText);
    const pairs = [...raw.matchAll(/(\d{2,3})\s*(?:cm|厘米|码)\s*(?:[（(]\s*充绒量\s*|[:：]?\s*)(\d+(?:\.\d+)?)\s*(?:g|克)/gi)];
    if (!pairs.length) { errors.push("充绒量需要逐尺码克重，不能以百分比或范围代替"); continue; }
    evidence ??= field;
    for (const match of pairs) {
      const identity = size(match[1]); const grams = String(Number(match[2]));
      if (Number(grams) <= 0 || !Number.isFinite(Number(grams))) errors.push(`充绒量 ${identity} 非有效正数`);
      if (weights.has(identity) && weights.get(identity) !== grams) errors.push(`充绒量 ${identity} 存在冲突`);
      weights.set(identity, grams);
    }
  }
  const allowed = new Set(skus.map((sku) => size((sku as JsonRecord).size ?? (sku as JsonRecord).size_name)).filter((item) => item !== "NaN"));
  if (sources.length) {
    for (const identity of allowed) if (!weights.has(identity)) errors.push(`充绒量缺少 ${identity} 码`);
    for (const identity of weights.keys()) if (!allowed.has(identity)) errors.push(`充绒量 ${identity} 不在 MDM SKU 中`);
  }
  if (errors.length) {
    fields.push({ fieldName: "充绒量校验", active: true, sourceType: "derived", sourceRefs: [], validationStatus: "invalid", staleReason: errors.join("；") });
    return { fields, sizeRemarks: {} };
  }
  if (!evidence || !weights.size) return { fields, sizeRemarks: {} };
  const sizeRemarks = Object.fromEntries([...weights].map(([identity, grams]) => [`${identity}cm`, `充绒量${grams}g`]));
  for (const field of fields) {
    if (field.active === false) continue;
    const name = key(field.fieldName);
    if (name === "充绒量文本") {
      const values = [...weights.values()].map(Number); const lo = Math.min(...values); const hi = Math.max(...values);
      field.valueText = lo === hi ? `${lo}g` : `${lo}-${hi}g`;
      continue;
    }
    const table = field.valueJson;
    if (!table || !text(table.title) || !(name.includes("尺码表") || name === "多平台尺码")) continue;
    const titles = text(table.title).split(",");
    const template = templates.find((item) => key(item.fieldName ?? item.field_name ?? item.name) === name) ?? {};
    const options = (Array.isArray(template.options) ? template.options : []).map((item) => typeof item === "string" ? item : text((item as JsonRecord).name ?? (item as JsonRecord).value));
    const multi = name === "多平台尺码", vip = name === "唯品会尺码表", douyin = name === "抖音尺码表";
    const main = !/(唯品会|天猫|淘宝|抖音|京东|平台)/.test(name);
    const originalFill = titles.findIndex(fillTitle);
    // Listingify preserves the fixed main header; write a gram column only when present.
    if (main && originalFill < 0) continue;
    if (vip && originalFill < 0) titles.push("充绒量");
    if (douyin) {
      const supportsRemark = options.some((option) => key(option) === "备注");
      const supportsFill = options.some(fillTitle);
      if (supportsRemark && !supportsFill && originalFill >= 0) titles.splice(originalFill, 1);
      if ((!options.length || supportsFill || !supportsRemark) && !titles.some(fillTitle)) titles.push("充绒量(g)");
      if (supportsRemark && !titles.includes("备注")) titles.push("备注");
    }
    if (!multi && !titles.some(fillTitle) && !(douyin && titles.includes("备注"))) continue;
    const output: JsonRecord = { title: titles.join(",") };
    const original = text(table.title).split(",");
    for (const [rowKey, row] of Object.entries(table)) {
      if (rowKey === "title") continue;
      const grams = weights.get(size(rowKey));
      const oldCells = text(row).split(",");
      const cells = titles.map((title) => oldCells[original.indexOf(title)] ?? "");
      if (grams) {
        titles.forEach((title, index) => {
          if (multi) cells[index] = key(title) === "京东" ? size(rowKey) : ["拼多多", "微信视频小店", "微信视频", "小红书"].includes(key(title)) ? `${size(rowKey)}cm（充绒量${grams}g）` : "";
          else if (fillTitle(title)) cells[index] = grams;
          else if (douyin && key(title) === "备注") cells[index] = `充绒量${grams}g`;
        });
      }
      output[vip && grams ? `${size(rowKey)}cm（充绒量${grams}g）` : rowKey] = cells.join(",");
    }
    field.valueJson = output;
    field.sourceRefs = [...field.sourceRefs, ...evidence.sourceRefs];
  }
  return { fields, sizeRemarks };
}

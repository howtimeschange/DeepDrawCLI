type JsonRecord = Record<string, unknown>;

export interface ReadbackComparison {
  status: "readback_verified" | "readback_mismatch" | "needs_ui_verification";
  mismatches: Array<{ field: string; expected: unknown; actual: unknown }>;
  uiVerification: string[];
}

function record(value: unknown): JsonRecord { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {}; }
function text(value: unknown): string { return value === undefined || value === null ? "" : typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value).trim() : ""; }
function compact(value: unknown): string { return text(value).replace(/[\s()（）:：]/g, "").toLowerCase(); }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function productRoot(input: Record<string, unknown>): JsonRecord {
  const root = record(input);
  if (root.fields !== undefined || Object.keys(record(root.colors)).length || Object.keys(record(root.sizes)).length) return root;
  return record(root.form ?? root.product ?? root.data);
}
function optionValue(value: unknown): string {
  const item = record(value);
  return text(typeof value === "object" ? item.name ?? item.value ?? item.label ?? item.text : value);
}
function formFieldValue(field: JsonRecord): unknown {
  const meta = record(field.field);
  const type = text(meta.type ?? field.type).toUpperCase();
  const options = list(field.options).map(optionValue).filter(Boolean);
  const texts = list(field.texts).map(optionValue).filter(Boolean);
  if (type.includes("CHOICE") && options.length) return options.join(";");
  if (texts.length === 1) return texts[0];
  if (texts.length > 1) return texts.join("\n");
  return options.join(";");
}
function formFields(root: JsonRecord): JsonRecord[] {
  return list(root.fields).map(record).flatMap((item) => {
    const meta = record(item.field);
    if (Object.keys(meta).length === 0) return [];
    const name = text(meta.name ?? item.name ?? item.fieldName ?? item.field_name);
    if (!name) return [];
    const valueJson = record(item.valueJson ?? item.value_json);
    return [{
      field_name: name,
      field_id: text(meta.id ?? item.fieldId ?? item.field_id),
      field_type: text(meta.type ?? item.type ?? item.fieldType ?? item.field_type) || "TEXT",
      ...(Object.keys(valueJson).length ? { value_json: valueJson } : { value_text: formFieldValue(item) }),
    }];
  });
}
function selectionField(name: string, input: JsonRecord): JsonRecord | undefined {
  const meta = record(input.field);
  const options = list(input.options).map(optionValue).filter(Boolean);
  if (!name || options.length === 0) return undefined;
  const aliases = record(input.optionAliases);
  const value = compact(name) === "颜色"
    ? options.map((option) => `${option},${text(aliases[option]) || option}`).join(";")
    : options.join(";");
  return { field_name: name, field_id: text(meta.id), field_type: text(meta.type) || "MULTI_CHOICE", value_text: value };
}

/** Converts a resource=form AllInOneProduct into an editable local snapshot. */
export function hydrateBalabalaRemoteDraft(remoteInput: Record<string, unknown>): JsonRecord {
  const root = productRoot(remoteInput);
  const hydratedFields = formFields(root);
  const names = new Set(hydratedFields.map((field) => compact(field.field_name)));
  for (const item of [selectionField("颜色", record(root.colors)), selectionField("尺码", record(root.sizes))]) {
    if (item && !names.has(compact(item.field_name))) hydratedFields.push(item);
  }
  const title = text(root.title) || text(hydratedFields.find((field) => compact(field.field_name) === "商品展示标题")?.value_text);
  return {
    code: text(root.code),
    productId: text(root.productId ?? root.id),
    resourceId: text(root.id),
    tradeId: text(record(root.trade).id),
    title,
    retailPrice: text(root.retailPrice),
    productType: /鞋|靴/.test(text(record(root.trade).path)) ? "shoe" : "generic",
    fields: hydratedFields,
    skus: list(record(root.skus).skuItems).map(record),
    remoteComplete: root.complete,
    remoteTags: list(root.tags),
  };
}

function fields(input: Record<string, unknown>): JsonRecord {
  const root = productRoot(input);
  const raw = root.fields;
  if (Array.isArray(raw)) {
    const projected = formFields(root);
    const projectedNames = new Set(projected.map((field) => compact(field.field_name)));
    for (const item of [selectionField("颜色", record(root.colors)), selectionField("尺码", record(root.sizes))]) {
      if (item && !projectedNames.has(compact(item.field_name))) projected.push(item);
    }
    if (projected.length) return Object.fromEntries(projected.map((field) => [text(field.field_name), field.value_json ?? field.value_text]));
    return Object.fromEntries(raw.map(record).map((field) => [text(field.name ?? field.fieldName ?? field.field_name), field.value ?? field.valueJson ?? field.value_json ?? field.valueText ?? field.value_text]));
  }
  return record(raw);
}
function fieldValue(source: JsonRecord, name: string): unknown { return Object.entries(source).find(([key]) => compact(key) === compact(name))?.[1]; }
function structured(name: string): boolean { return compact(name).includes("尺码表") || compact(name) === "多平台尺码" || compact(name) === "商家sku"; }
function normalizeSkuKey(value: unknown): string[] {
  const output: string[] = [];
  for (const [color, rows] of Object.entries(record(value))) {
    if (color === "title") continue;
    const nested = record(rows);
    if (Object.keys(nested).length > 0) {
      for (const size of Object.keys(nested)) output.push(`${compact(color)}\u0000${compact(size)}`);
    } else output.push(compact(color));
  }
  return output;
}
function normalizedValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizedValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value as object).sort((left, right) => left.localeCompare(right, "zh-Hans-CN")).map((key) => [key, normalizedValue(record(value)[key])]));
  return typeof value === "string" ? value.replace(/；/g, ";") : value;
}
function equal(left: unknown, right: unknown): boolean { return JSON.stringify(normalizedValue(left)) === JSON.stringify(normalizedValue(right)); }

export function prepareBalabalaExistingUpdate(localInput: Record<string, unknown>, remoteInput: Record<string, unknown>): { payload: JsonRecord; blocking: Array<{ code: string; message: string }> } {
  const local = fields(localInput);
  const remote = fields(remoteInput);
  const localSku = normalizeSkuKey(fieldValue(local, "商家SKU"));
  const remoteSku = normalizeSkuKey(fieldValue(remote, "商家SKU"));
  const blocking: Array<{ code: string; message: string }> = [];
  if (localSku.length > 0 && remoteSku.length > 0 && !localSku.some((key) => remoteSku.includes(key))) blocking.push({ code: "sku_intersection_required", message: "现有商品商家 SKU 与本地 SKU 没有颜色和尺码交集，已阻止覆盖式全量更新。" });
  const merged = { ...remote, ...local };
  for (const [name, value] of Object.entries(remote)) if (!structured(name) && (local[name] === undefined || text(local[name]) === "")) merged[name] = value;
  return { payload: { ...localInput, fields: merged }, blocking };
}

export function compareBalabalaReadback(expectedInput: Record<string, unknown>, remoteInput: Record<string, unknown>): ReadbackComparison {
  const expected = fields(expectedInput);
  const actual = fields(remoteInput);
  const mismatches: Array<{ field: string; expected: unknown; actual: unknown }> = [];
  const uiVerification: string[] = [];
  for (const [name, expectedValue] of Object.entries(expected)) {
    const actualValue = fieldValue(actual, name);
    if (actualValue === undefined || actualValue === null || actualValue === "") {
      if (structured(name)) uiVerification.push(name);
      else mismatches.push({ field: name, expected: expectedValue, actual: actualValue });
      continue;
    }
    if (!equal(expectedValue, actualValue)) mismatches.push({ field: name, expected: expectedValue, actual: actualValue });
  }
  return { status: mismatches.length ? "readback_mismatch" : uiVerification.length ? "needs_ui_verification" : "readback_verified", mismatches, uiVerification };
}

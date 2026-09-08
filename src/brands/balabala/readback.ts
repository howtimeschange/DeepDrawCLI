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
  // Quantity-price rows are comma-separated on write and colon-separated
  // on form readback. A blank ':' row is the provider's empty header.
  if (text(meta.name) === "价格区间") {
    const rows = texts.filter(value => value !== ":");
    if (rows.length && rows.every(value => /^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/.test(value))) return rows.map(value => value.replace(":", ",")).join("*");
  }
  if (type.includes("CHOICE")) return (options.length ? options : texts).join(";");
  if (texts.length === 1) return texts[0];
  if (texts.length > 1) return texts.join("\n");
  return options.join(";");
}
function formFields(root: JsonRecord): JsonRecord[] {
  const projected = list(root.fields).map(record).flatMap((item) => {
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
  const addTable = (name: string, rows: Array<{ key: string; values: JsonRecord }>, field: JsonRecord) => {
    if (!rows.length || projected.some(item => compact(item.field_name) === compact(name))) return;
    const columns = [...new Set(rows.flatMap(row => Object.keys(row.values)))];
    projected.push({ field_name: name, field_id: text(field.id), field_type: "MULTI_TEXT", value_json: { title: columns.join(","), ...Object.fromEntries(rows.map(row => [row.key, columns.map(column => text(row.values[column])).join(",")])) } });
  };
  for (const table of list(root.sizeTables).map(record)) addTable(text(record(table.field).name), list(table.sizeTableItems).map(record).map(row => ({ key: text(row.size), values: record(row.values) })), record(table.field));
  const skuItems = list(record(root.skus).skuItems).map(record);
  if (skuItems.length && !projected.some(item => compact(item.field_name) === "商家sku")) {
    const columns = [...new Set(skuItems.flatMap(item => Object.keys(record(item.values))))];
    const aliases = record(record(root.colors).optionAliases);
    const value: JsonRecord = { title: columns.join(",") };
    for (const item of skuItems) {
      const color = text(aliases[text(item.color)]) || text(item.color);
      value[color] = { ...record(value[color]), [text(item.size)]: columns.map(column => text(record(item.values)[column])).join(",") };
    }
    projected.push({ field_name: "商家SKU", field_id: text(record(record(root.skus).field).id), field_type: "MULTI_TEXT", value_json: value });
  }
  return projected;
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
function saleColorAliases(value: unknown): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const choice of text(value).split(/[;；]/).map((item) => item.trim()).filter(Boolean)) {
    const parts = choice.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
    const canonical = parts.at(-1) ?? "";
    for (const part of parts) aliases.set(compact(part), canonical || part);
  }
  return aliases;
}
function skuSizeKey(value: unknown): string { return text(value).replace(/\s*码$/u, "").replace(/\s*cm$/iu, "").trim(); }
function normalizeSkuKey(value: unknown, saleColors: Map<string, string> = new Map()): string[] {
  const output: string[] = [];
  for (const [color, rows] of Object.entries(record(value))) {
    if (color === "title") continue;
    const colorKey = saleColors.get(compact(color)) ?? text(color);
    const nested = record(rows);
    if (Object.keys(nested).length > 0) {
      for (const size of Object.keys(nested)) output.push(`${compact(colorKey)}\u0000${compact(skuSizeKey(size))}`);
    } else {
      // Early local drafts stored merchant-SKU rows as a flattened
      // `sale-colour,size` key.  Normalize it to the same identity as the
      // nested DeepDraw form resource before deciding whether a cover update
      // has a safe intersection.
      const parts = text(color).split(/[,，]/).map((item) => item.trim()).filter(Boolean);
      const rawSize = parts.at(-1) ?? "";
      if (/^\d+(?:\.5)?(?:cm|码)?$/i.test(rawSize) && parts.length > 1) {
        const rawColor = parts.slice(0, -1).join(",");
        const canonicalColor = saleColors.get(compact(rawColor)) ?? saleColors.get(compact(parts.at(-2))) ?? rawColor;
        output.push(`${compact(canonicalColor)}\u0000${compact(skuSizeKey(rawSize))}`);
      } else output.push(compact(colorKey));
    }
  }
  return [...new Set(output)].sort();
}
function tableValue(value: unknown): unknown {
  const source = record(value);
  if (Object.keys(source).length === 0) return value;
  const columns = text(source.title).split(/[,，]/).map((item) => compact(item)).filter(Boolean);
  const sizeColumn = columns.findIndex((column) => column === compact("尺码") || column === compact("尺寸") || column === compact("欧洲码"));
  const rows = Object.entries(source)
    .filter(([key]) => key !== "title")
    .map(([size, row]) => [compact(skuSizeKey(size)), text(row).replace(/；/g, ";").split(/[,，]/).map((cell, index) => index === sizeColumn ? skuSizeKey(cell) : cell.trim()).join(",")] as const)
    .sort(([left], [right]) => left.localeCompare(right, "zh-Hans-CN"));
  return { title: columns.join(","), rows };
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
  const aliases = saleColorAliases(fieldValue(local, "颜色"));
  const localSku = normalizeSkuKey(fieldValue(local, "商家SKU"), aliases);
  const remoteSku = normalizeSkuKey(fieldValue(remote, "商家SKU"), aliases);
  const blocking: Array<{ code: string; message: string }> = [];
  if (localSku.length > 0 && remoteSku.length > 0 && !localSku.some((key) => remoteSku.includes(key))) blocking.push({ code: "sku_intersection_required", message: "现有商品商家 SKU 与本地 SKU 没有颜色和尺码交集，已阻止覆盖式全量更新。" });
  const merged = { ...remote, ...local };
  for (const [name, value] of Object.entries(remote)) if (!structured(name) && (local[name] === undefined || text(local[name]) === "")) merged[name] = value;
  return { payload: { ...localInput, fields: merged }, blocking };
}

function tableCells(value: unknown): JsonRecord {
  const source = record(value);
  const columns = text(source.title).split(",");
  return Object.fromEntries(Object.entries(source).filter(([key]) => key !== "title").map(([size, row]) => [skuSizeKey(size), Object.fromEntries(columns.map((column, index) => [column, text(row).split(",")[index] ?? ""]))]));
}

function skuCells(value: unknown, aliases: Map<string, string>): JsonRecord {
  const source = record(value);
  const columns = text(source.title).split(",");
  const output: JsonRecord = {};
  const add = (color: string, size: string, row: unknown) => {
    const key = `${aliases.get(compact(color)) ?? aliases.get(compact(color.split(",").at(-1))) ?? color}\u0000${skuSizeKey(size)}`;
    output[key] = Object.fromEntries(columns.map((column, index) => [column, text(row).split(",")[index] ?? ""]));
  };
  for (const [color, rows] of Object.entries(source)) {
    if (color === "title") continue;
    if (Object.keys(record(rows)).length) for (const [size, row] of Object.entries(record(rows))) add(color, size, row);
    else { const parts = color.split(","); const size = parts.pop() ?? ""; add(parts.join(","), size, rows); }
  }
  return output;
}

/** Compare named cells, including prices; tolerate only unrequested remote columns. */
function sameCells(expected: JsonRecord, actual: JsonRecord): boolean {
  if (!equal(Object.keys(expected).sort(), Object.keys(actual).sort())) return false;
  return Object.entries(expected).every(([key, values]) => Object.entries(record(values)).every(([column, value]) => text(record(actual[key])[column] ?? (column === "脚长" ? record(actual[key])["脚长(cm)"] : undefined)) === text(value)));
}

export function compareBalabalaReadback(expectedInput: Record<string, unknown>, remoteInput: Record<string, unknown>): ReadbackComparison {
  const expected = fields(expectedInput);
  const actual = fields(remoteInput);
  const root = productRoot(remoteInput);
  const saleColors = saleColorAliases(fieldValue(expected, "颜色"));
  const types = new Map(list(root.fields).map(record).map(item => [text(record(item.field).name), text(record(item.field).type)]));
  const mismatches: Array<{ field: string; expected: unknown; actual: unknown }> = [];
  const uiVerification: string[] = [];
  for (const [name, expectedValue] of Object.entries(expected)) {
    let actualValue = fieldValue(actual, name);
    let matches: boolean | undefined;
    const table = list(root.sizeTables).map(record).find(item => text(record(item.field).name) === name);
    if (table) {
      actualValue = Object.fromEntries(list(table.sizeTableItems).map(record).map(item => [skuSizeKey(item.size), record(item.values)]));
      matches = sameCells(tableCells(expectedValue), record(actualValue));
    } else if (compact(name) === "商家sku" && Array.isArray(record(root.skus).skuItems)) {
      actualValue = Object.fromEntries(list(record(root.skus).skuItems).map(record).map(item => [`${saleColors.get(compact(item.color)) ?? text(item.color)}\u0000${skuSizeKey(item.size)}`, record(item.values)]));
      matches = sameCells(skuCells(expectedValue, saleColors), record(actualValue));
    } else if (name === "多平台尺码" && list(record(root.sizes).texts).length) {
      const texts = list(record(root.sizes).texts).map(text);
      const ids = new Map(texts.map(item => item.split(",")).filter(parts => parts.length === 2).map(parts => [parts[0], skuSizeKey(parts[1])]));
      const cells: JsonRecord = {};
      for (const item of texts) {
        const parts = item.split(",");
        if (parts.length !== 3 || !ids.has(parts[0])) continue;
        const size = ids.get(parts[0])!;
        cells[size] = { ...record(cells[size]), [parts[2]]: parts[1] };
      }
      if (Object.keys(cells).length) { actualValue = cells; matches = sameCells(tableCells(expectedValue), cells); }
    }
    if (matches === undefined && (actualValue === undefined || actualValue === null || actualValue === "")) {
      if (expectedValue === "" || expectedValue === null || expectedValue === undefined) continue;
      if (name === "多平台尺码") uiVerification.push(name);
      else mismatches.push({ field: name, expected: expectedValue, actual: actualValue });
      continue;
    }
    if (matches === undefined) {
      if (name === "尺码" && Object.keys(record(root.sizes)).length) {
        const requested = text(expectedValue).split(";").map(value => value.split("*"));
        const remoteSizes = record(root.sizes);
        const aliases = record(remoteSizes.optionAliases);
        matches = equal(requested.map(parts => skuSizeKey(parts[0])).sort(), list(remoteSizes.options).map(skuSizeKey).sort())
          && requested.every(([alias]) => (text(aliases[skuSizeKey(alias)]) || list(remoteSizes.options).map(optionValue).find(option => skuSizeKey(option) === skuSizeKey(alias))) === alias);
        // Sales remarks are not separately exposed by form; do not infer
        // their persistence from platform-specific display remarks.
        if (matches && requested.some(parts => parts.length > 1)) uiVerification.push("销售尺码备注");
      }
      const choice = types.get(name)?.includes("CHOICE") || name === "颜色";
      const normalize = (value: unknown) => choice ? text(value).split(/[;\n]/).filter(Boolean).sort() : value;
      const left = name === "商家SKU" ? skuCells(expectedValue, saleColors) : structured(name) ? tableValue(expectedValue) : normalize(expectedValue);
      const right = name === "商家SKU" ? skuCells(actualValue, saleColors) : structured(name) ? tableValue(actualValue) : normalize(actualValue);
      if (matches === undefined) matches = equal(left, right);
      if (!matches && types.get(name) === "MULTI_TEXT" && typeof expectedValue === "string" && expectedValue.includes("*")) {
        const expectedParts = expectedValue.split("*");
        const actualParts = text(actualValue).split("\n");
        if (equal([...expectedParts].sort(), [...actualParts].sort())) { matches = true; uiVerification.push(`${name}顺序`); }
      }
    }
    if (!matches) mismatches.push({ field: name, expected: expectedValue, actual: actualValue });
  }
  for (const name of ["code", "title", "retailPrice"]) {
    if (expectedInput[name] !== undefined && text(expectedInput[name]) !== text(root[name])) mismatches.push({ field: name, expected: expectedInput[name], actual: root[name] });
  }
  return { status: mismatches.length ? "readback_mismatch" : uiVerification.length ? "needs_ui_verification" : "readback_verified", mismatches, uiVerification };
}

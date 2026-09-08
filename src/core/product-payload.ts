export type ProductPayloadStage = "create" | "update";
export type ProductKind = "shoe" | "apparel" | "generic";

type JsonRecord = Record<string, unknown>;

export interface ProductPayloadFieldInput {
  id?: string | number;
  name?: string;
  fieldName?: string;
  field_name?: string;
  fieldType?: string;
  field_type?: string;
  type?: string;
  value?: unknown;
  valueText?: unknown;
  value_text?: unknown;
  valueJson?: unknown;
  value_json?: unknown;
  options?: unknown[];
  options_json?: unknown[];
  templatePlatform?: string;
  template_platform?: string;
  [key: string]: unknown;
}

export interface ProductPayloadSkuInput {
  skuCode?: unknown;
  sku_code?: unknown;
  skcCode?: unknown;
  skc_code?: unknown;
  color?: unknown;
  colorName?: unknown;
  color_name?: unknown;
  size?: unknown;
  sizeName?: unknown;
  size_name?: unknown;
  barcode?: unknown;
  eanCode?: unknown;
  ean_code?: unknown;
  sellerCode?: unknown;
  seller_code?: unknown;
  price?: unknown;
  quantity?: unknown;
  [key: string]: unknown;
}

export interface BuildProductPayloadOptions {
  stage?: ProductPayloadStage;
  tenantName?: string;
  merchantId?: string;
  allowedFieldNames?: string[];
}

export interface ProductPayloadAuditField {
  id?: string;
  name: string;
  fieldType?: string;
  templatePlatform?: string;
  value: unknown;
  valueText?: string;
  valueJson?: unknown;
}

export interface ProductPayloadResult {
  ok: boolean;
  command: "deepdraw product payload";
  tenant: string;
  merchantId: string;
  stage: ProductPayloadStage;
  kind: ProductKind;
  query: Record<string, string>;
  product: {
    code: string;
    title: string;
    retailPrice: string;
    date: string;
    places: string[];
    fields: Record<string, unknown>;
    remark?: string;
  };
  fields: ProductPayloadAuditField[];
  legacyUpdateFields: ProductPayloadAuditField[];
  sizes: {
    options: string[];
    optionAliases: Record<string, string>;
    texts: string[];
  };
  sizeRemarks: Record<string, string>;
  skus: Array<{
    skuCode: string;
    skcCode: string;
    color: string;
    size: string;
    sizeAlias: string;
    barcode: string;
    sellerCode: string;
    price: string;
  }>;
  sdkInput: {
    config: Record<string, string>;
    query: Record<string, string>;
    product: ProductPayloadResult["product"];
  };
  diagnostics: {
    warnings: string[];
    errors: string[];
  };
}

const DEFAULT_TENANT = "电商巴拉巴拉";
const DEFAULT_MERCHANT_ID = "1162";
const SHOE_MULTI_PLATFORM_COLUMNS = ["天猫", "京东", "拼多多", "微信视频小店", "小红书", "快手"];
const REMARK_DISPLAY_PLATFORMS = new Set(["拼多多", "微信视频小店", "小红书"]);
const UNSUPPORTED_SHOE_TABLE = "淘宝尺码表";
const UNSUPPORTED_SPECIAL_FIELDS = new Set([
  "淘宝SKU参数",
  "天猫SKU参数",
  "天猫导购标题",
  "京东规格子属性",
  "京东自营子属性",
  "淘宝导购标题",
  "颜色备注",
]);

const BALABALA_APPAREL_WEIGHT_KG: Record<string, string> = {
  "52": "3",
  "59": "5",
  "66": "7.5",
  "73": "8",
  "80": "9.5",
  "90": "10.5",
  "100": "13.5",
  "110": "17",
  "120": "20.5",
  "130": "25",
  "140": "31",
  "150": "37",
  "160": "45",
  "165": "52.5",
  "170": "57.5",
  "175": "62.5",
  "180": "67.5",
};

const BALABALA_MERCHANT_SKU_COLUMNS = [
  "价格",
  "货号",
  "上市时间",
  "数量",
  "商家编码",
  "条形码",
  "零售价",
  "供货价",
  "唯品会货号",
  "唯品会条形码",
  "京东价",
  "划线价",
  "拼多多单买价",
  "拼多多团购价",
  "天猫特卖折扣价",
  "天猫特卖专柜价",
  "采购价",
  "京东自营市场价",
  "有赞标准价",
  "有赞价格",
  "原价",
  "小红书市场价",
  "抖音结算价格",
  "抖音价",
  "快手价",
  "爱库存供货价",
  "爱库存最低价",
  "好衣库结算价",
  "好衣库供货价",
  "好衣库价",
  "好衣库原价",
  "微信视频小店价格",
  "单品货号",
  "1688件重尺-重(g)",
  "小红书商家编码",
  "天猫SKU搜索标题",
];

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function hasOwn(value: JsonRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function text(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value).trim();
  return "";
}

function compactKey(value: unknown): string {
  return text(value)
    .replace(/\s+/g, "")
    .replace(/[()（）]/g, "")
    .replace(/[：:]/g, "")
    .toLowerCase();
}

function moneyText(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return text(value);
}

function nonEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return true;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(text).filter(Boolean))];
}

function splitList(value: unknown): string[] {
  return unique(text(value).split(/[;,，；、]/).map((part) => part.trim()));
}

function splitColumns(value: unknown): string[] {
  return text(value).split(/[,，]/).map((part) => part.trim());
}

function splitCells(value: unknown): string[] {
  return text(value).split(/[,，]/).map((part) => part.trim());
}

function numberText(value: unknown): string {
  const raw = text(value).replace(/[,，]/g, "");
  if (!raw) return "";
  const number = Number(raw);
  if (!Number.isFinite(number)) return raw;
  return String(Number(number.toFixed(3)));
}

function cleanRemark(value: unknown): string {
  const raw = text(value);
  if (!raw) return "";
  const unwrapped = raw.match(/^[（(]\s*(.*?)\s*[）)]$/)?.[1] ?? raw;
  return unwrapped.replace(/[;；]+/g, "/").replace(/\*/g, "").trim();
}

function stripSizeRemark(value: unknown): string {
  return text(value)
    .split("*")[0]
    .replace(/[（(]\s*充绒量[^）)]*[）)]/g, "")
    .trim();
}

function numericSize(value: unknown): { number: string; isHalf: boolean } | null {
  const raw = stripSizeRemark(value).replace(/\s+/g, "");
  const match = raw.match(/^0*(\d{2,3})(?:\.(\d+))?(?:cm|厘米|公分|码)?$/i);
  if (!match) return null;
  const fraction = match[2] ?? "";
  return {
    number: fraction ? `${Number(match[1])}.${fraction}` : String(Number(match[1])),
    isHalf: fraction.length > 0 && Number(`0.${fraction}`) !== 0,
  };
}

function canonicalSizeKey(value: unknown): string {
  const numeric = numericSize(value);
  if (numeric) return numeric.number;
  return stripSizeRemark(value).replace(/\s+/g, "");
}

function sortSizeKeys(values: string[]): string[] {
  return [...values].sort((left, right) => {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) return leftNumber - rightNumber;
    return left.localeCompare(right, "zh-Hans-CN", { numeric: true });
  });
}

function normalizeDate(value: unknown): string {
  const raw = text(value);
  if (!raw) return "";
  const direct = raw.match(/^(\d{4})[-/.](\d{1,2})(?:[-/.](\d{1,2}))?/);
  if (direct) return `${direct[1]}-${direct[2].padStart(2, "0")}-${(direct[3] ?? "01").padStart(2, "0")}`;
  const season = raw.match(/^(\d{4})年?([春夏秋冬])季?$/);
  if (season) return `${season[1]}-${({ 春: "03", 夏: "06", 秋: "09", 冬: "12" } as Record<string, string>)[season[2]]}-01`;
  const parsed = new Date(raw);
  if (Number.isFinite(parsed.getTime())) {
    return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}-${String(parsed.getUTCDate()).padStart(2, "0")}`;
  }
  return raw;
}

function monthText(value: unknown): string {
  return normalizeDate(value).match(/^\d{4}-\d{2}/)?.[0] ?? text(value);
}

function normalizeLocation(value: unknown): string {
  const raw = text(value);
  if (!raw) return raw;
  const parts = raw.split(/[;,，；]/).map((part) => part.trim()).filter(Boolean);
  if (parts.length === 2) return parts.join(",");
  if (raw === "浙江杭州") return "浙江,杭州";
  return raw;
}

function normalizePlaces(value: unknown): string[] {
  const map: Record<string, string> = {
    "1688": "ALIBABA",
    alibaba: "ALIBABA",
    天猫: "TMALL",
    tmall: "TMALL",
    淘宝: "TAOBAO",
    taobao: "TAOBAO",
    京东: "JD",
    jd: "JD",
    唯品会: "VIP",
    vip: "VIP",
    有赞: "YOUZAN",
    youzan: "YOUZAN",
    拼多多: "PDD",
    pdd: "PDD",
    小红书: "XIAOHONGSHU",
    xiaohongshu: "XIAOHONGSHU",
    抖音: "DOUYIN",
    douyin: "DOUYIN",
    快手: "KUAISHOU",
    kuaishou: "KUAISHOU",
    微信视频小店: "WEIXINXIAODIAN",
    weixinxiaodian: "WEIXINXIAODIAN",
  };
  return unique((Array.isArray(value) ? value : splitList(value)).map((site) => map[compactKey(site)] ?? text(site).toUpperCase()));
}

function unwrapInput(input: unknown): JsonRecord {
  const root = record(input);
  const payload = record(root.payload);
  const product = record(root.product);
  const draft = record(root.draft);
  const selected = Object.keys(payload).length > 0
    ? payload
    : Object.keys(product).length > 0
      ? product
      : root;
  const nestedDraft = record(selected.draft);
  const nestedProduct = record(selected.product);
  return {
    ...root,
    ...draft,
    ...nestedDraft,
    ...product,
    ...nestedProduct,
    ...selected,
  };
}

function rawFieldValue(field: JsonRecord): unknown {
  if (hasOwn(field, "value")) return field.value;
  if (hasOwn(field, "valueJson")) return field.valueJson;
  if (hasOwn(field, "value_json")) return field.value_json;
  if (hasOwn(field, "valueText")) return field.valueText;
  if (hasOwn(field, "value_text")) return field.value_text;
  return undefined;
}

function rawFieldName(field: JsonRecord): string {
  return text(field.name ?? field.fieldName ?? field.field_name ?? field.title);
}

function normalizeFieldName(value: unknown): string {
  const raw = text(value);
  return compactKey(raw) === "商家sku" ? "商家SKU" : raw;
}

function rawFields(source: JsonRecord): JsonRecord[] {
  const candidate = source.fields ?? source.productFields ?? source.product_fields;
  if (Array.isArray(candidate)) return candidate.map(record).filter((field) => rawFieldName(field));
  if (candidate && typeof candidate === "object") {
    return Object.entries(record(candidate)).map(([name, value]) => ({ name, value }));
  }
  const tables = record(source.sizeTables ?? source.size_tables);
  const output = Object.entries(tables).map(([name, value]) => ({ name, valueJson: value, fieldType: "MULTI_TEXT" }));
  const multi = source.multiPlatformSizes ?? source.multi_platform_sizes;
  if (multi !== undefined) output.push({ name: "多平台尺码", valueJson: multi, fieldType: "MULTI_TEXT" });
  return output;
}

function normalizedFields(source: JsonRecord): JsonRecord[] {
  const byName = new Map<string, JsonRecord>();
  for (const input of rawFields(source)) {
    const name = normalizeFieldName(rawFieldName(input));
    if (!name) continue;
    const normalized: JsonRecord = {
      ...input,
      name,
      value: rawFieldValue(input),
      ...(text(input.fieldType ?? input.field_type ?? input.type) ? { fieldType: text(input.fieldType ?? input.field_type ?? input.type) } : {}),
      ...(text(input.templatePlatform ?? input.template_platform) ? { templatePlatform: text(input.templatePlatform ?? input.template_platform) } : {}),
    };
    const key = compactKey(name);
    const existing = byName.get(key);
    if (!existing || (normalized.value !== undefined && !nonEmpty(existing.value))) byName.set(key, normalized);
  }
  return [...byName.values()];
}

function fieldByName(fields: JsonRecord[], names: string[]): JsonRecord | undefined {
  const wanted = new Set(names.map(compactKey));
  return fields.find((field) => wanted.has(compactKey(field.name)));
}

function fieldValue(fields: JsonRecord[], names: string[]): unknown {
  return fieldByName(fields, names)?.value;
}

function isStructuredField(name: unknown): boolean {
  const key = compactKey(name);
  return key === compactKey("多平台尺码") || key.includes("尺码表");
}

function isMainSizeTable(name: unknown): boolean {
  const key = compactKey(name);
  if (!key.includes("尺码表") || key === compactKey("多平台尺码")) return false;
  return !/(?:唯品会|抖音|天猫|淘宝|京东|拼多多|小红书|快手|微信视频|平台)/.test(key);
}

function isPlatformSizeTable(name: unknown): boolean {
  const key = compactKey(name);
  return ["唯品会尺码表", "天猫尺码表", "抖音尺码表"].some((candidate) => compactKey(candidate) === key);
}

function inferKind(source: JsonRecord, fields: JsonRecord[]): ProductKind {
  const category = [
    source.productType,
    source.product_type,
    source.kind,
    source.category,
    source.categoryName,
    source.category_name,
    source.tradePath,
    source.trade_path,
    source.garmentType,
    source.garment_type,
    source.title,
    fieldValue(fields, ["商品类目", "产品类别", "类目"]),
  ].map(text).join(" ");
  if (source.shoeSizes === true || /鞋|靴/.test(category)) return "shoe";
  if (/服装|服饰|童装|羽绒服|外套|卫衣|裤|裙|上装|下装|牛仔/.test(category)) return "apparel";
  return "generic";
}

function garmentType(source: JsonRecord, fields: JsonRecord[]): string {
  return text(source.garmentType ?? source.garment_type ?? source.subclassName ?? source.subclass_name)
    || [source.category, source.categoryName, source.category_name, source.tradePath, source.trade_path, fieldValue(fields, ["产品类别", "类目"])].map(text).join(" ");
}

interface SizeIdentity {
  canonical: string;
  alias: string;
}

function defaultSizeAlias(canonical: string, kind: ProductKind, raw: unknown): string {
  if (!/^\d+(?:\.\d+)?$/.test(canonical)) return stripSizeRemark(raw);
  if (kind === "shoe") return `${canonical}码`;
  if (kind === "apparel") return `${canonical}cm`;
  return stripSizeRemark(raw);
}

function buildSizeIdentities(source: JsonRecord, fields: JsonRecord[], skus: JsonRecord[], kind: ProductKind, warnings: string[]): SizeIdentity[] {
  const rawValues: unknown[] = [];
  const saleValue = fieldValue(fields, ["尺码", "尺寸", "规格", "size"]);
  if (typeof saleValue === "string") rawValues.push(...saleValue.split(/[;；]/).map((item) => item.split("*")[0]));
  const sourceSizes = record(source.sizes);
  rawValues.push(...arrayValue(sourceSizes.options));
  rawValues.push(...arrayValue(source.sizeOptions ?? source.size_options));
  const aliases = record(sourceSizes.optionAliases ?? sourceSizes.option_aliases ?? source.sizeOptionAliases ?? source.size_option_aliases);
  rawValues.push(...Object.keys(aliases));
  for (const table of fields.filter((field) => isStructuredField(field.name))) {
    const value = record(table.value);
    rawValues.push(...Object.keys(value).filter((key) => key !== "title"));
  }
  for (const sku of skus) rawValues.push(sku.size ?? sku.sizeName ?? sku.size_name);

  const identities = new Map<string, SizeIdentity>();
  for (const raw of rawValues) {
    const rawText = stripSizeRemark(raw);
    if (!rawText) continue;
    const numeric = numericSize(rawText);
    if (kind === "shoe" && numeric?.isHalf) {
      warnings.push(`鞋品尺码 ${rawText} 是半码，已停止生成该半码；巴拉巴拉发布只允许整数码。`);
      continue;
    }
    const canonical = canonicalSizeKey(rawText);
    if (!canonical || identities.has(canonical)) continue;
    const aliasHint = Object.entries(aliases).find(([key]) => canonicalSizeKey(key) === canonical)?.[1];
    identities.set(canonical, {
      canonical,
      alias: text(aliasHint) || defaultSizeAlias(canonical, kind, rawText),
    });
  }
  return sortSizeKeys([...identities.keys()]).map((canonical) => identities.get(canonical) as SizeIdentity);
}

function sizeLookup(identities: SizeIdentity[]): Map<string, SizeIdentity> {
  const lookup = new Map<string, SizeIdentity>();
  for (const identity of identities) {
    for (const value of [identity.canonical, identity.alias, identity.canonical + "cm", identity.canonical + "码"]) {
      const key = canonicalSizeKey(value).toLowerCase();
      if (key) lookup.set(key, identity);
    }
  }
  return lookup;
}

function deriveSizeRemarks(fields: JsonRecord[], source: JsonRecord, identities: SizeIdentity[]): Record<string, string> {
  const lookup = sizeLookup(identities);
  const remarks = new Map<string, string>();
  const add = (size: unknown, value: unknown) => {
    const identity = lookup.get(canonicalSizeKey(size).toLowerCase());
    const remark = cleanRemark(value);
    if (identity && remark && !remarks.has(identity.canonical)) remarks.set(identity.canonical, remark);
  };
  const explicit = record(source.sizeRemarks ?? source.size_remarks);
  for (const [size, remark] of Object.entries(explicit)) add(size, remark);
  const saleValue = fieldValue(fields, ["尺码", "尺寸", "规格", "size"]);
  if (typeof saleValue === "string") {
    for (const part of saleValue.split(/[;；]/)) {
      const [size, ...remarkParts] = part.split("*");
      add(size, remarkParts.join("*"));
    }
  }
  const douyin = fieldByName(fields, ["抖音尺码表"]);
  const douyinValue = record(douyin?.value);
  const douyinColumns = splitColumns(douyinValue.title);
  const remarkIndex = douyinColumns.findIndex((column) => compactKey(column) === compactKey("备注"));
  if (remarkIndex >= 0) {
    for (const [size, value] of Object.entries(douyinValue)) {
      if (size === "title") continue;
      add(size, splitCells(value)[remarkIndex]);
    }
  }
  return Object.fromEntries(identities.flatMap((identity) => {
    const remark = remarks.get(identity.canonical);
    return remark ? [[identity.alias, remark]] : [];
  }));
}

function remarkForSize(size: unknown, remarks: Record<string, string>, identities: SizeIdentity[]): string {
  const lookup = sizeLookup(identities);
  const identity = lookup.get(canonicalSizeKey(size).toLowerCase());
  if (!identity) return "";
  for (const [key, value] of Object.entries(remarks)) {
    if (canonicalSizeKey(key).toLowerCase() === identity.canonical.toLowerCase()) return cleanRemark(value);
  }
  return "";
}

function saleSizeText(identities: SizeIdentity[], kind: ProductKind, remarks: Record<string, string>): string {
  return identities.map((identity) => {
    const display = kind === "shoe" || kind === "apparel" ? identity.alias : identity.canonical;
    const remark = remarkForSize(identity.canonical, remarks, identities);
    return remark ? `${display}*${remark}` : display;
  }).join(";");
}

function canonicalColumnName(value: unknown): string {
  const key = compactKey(value);
  if (key === compactKey("适合脚长") || key === compactKey("脚长(cm)")) return "脚长";
  if (key === compactKey("内长") || key === compactKey("鞋长")) return "鞋内长";
  if (key === compactKey("1/2脚口（平量）") || key === compactKey("1/2脚口")) return "脚口";
  if (key === compactKey("1/2腰围（平量）") || key === compactKey("1/2腰围")) return "腰围";
  if (key === compactKey("1/2臀围（平量）") || key === compactKey("1/2臀围")) return "臀围";
  if (key === compactKey("1/2胸围（平量）") || key === compactKey("1/2胸围")) return "胸围";
  if (key === compactKey("下摆")) return "下摆围";
  return text(value);
}

function isZero(value: unknown): boolean {
  return /^0(?:\.0+)?$/.test(text(value));
}

function cleanMeasurement(value: unknown, options: { size?: boolean; kind?: ProductKind } = {}): string {
  const raw = text(value);
  if (!raw) return "";
  if (!options.size && isZero(raw)) return "";
  if (options.size && options.kind === "apparel") {
    const numeric = numericSize(raw);
    return numeric ? numeric.number : raw;
  }
  return raw;
}

function tableRows(value: unknown): Array<[string, unknown]> {
  return Object.entries(record(value)).filter(([key]) => key !== "title");
}

function sourceCellMap(title: string, rowValue: unknown): Map<string, { value: string; sourceColumn: string }> {
  const columns = splitColumns(title);
  const cells = splitCells(rowValue);
  const effectiveCells = columns.length === cells.length + 1 && compactKey(columns[0]).includes("尺码")
    ? ["", ...cells]
    : cells;
  const output = new Map<string, { value: string; sourceColumn: string }>();
  columns.forEach((column, index) => {
    const value = effectiveCells[index] ?? "";
    const key = compactKey(column);
    if (!output.has(key)) output.set(key, { value, sourceColumn: column });
  });
  return output;
}

function findSourceCell(
  cells: Map<string, { value: string; sourceColumn: string }>,
  target: string,
): { value: string; sourceColumn: string } {
  const aliases: Record<string, string[]> = {
    尺码: ["尺码", "尺寸", "规格", "身高"],
    脚长: ["脚长", "适合脚长", "脚长(cm)", "脚长（cm）"],
    鞋内长: ["鞋内长", "内长", "鞋长"],
    衣长: ["衣长", "后中长"],
    裤长: ["裤长"],
    裙长: ["裙长"],
    肩宽: ["肩宽"],
    胸围: ["胸围", "全胸围（夹下1CM", "全胸围（夹下1CM）", "1/2胸围（平量）", "1/2胸围"],
    袖长: ["袖长", "袖长（三点量）", "袖长（肩至袖口", "内袖长"],
    腰围: ["腰围", "全腰围（平量）", "1/2腰围（平量）", "1/2腰围"],
    臀围: ["臀围", "臀围（平量）", "1/2臀围（平量）", "1/2臀围"],
    脚口: ["脚口", "裤口围", "1/2脚口（平量）", "1/2脚口"],
    下摆围: ["下摆围", "下摆", "下摆围（平量）", "下摆围（弧量）", "裙摆围"],
    身高: ["身高"],
    体重: ["体重", "建议体重", "适合体重", "体重(斤)"],
  };
  const candidates = aliases[target] ?? [target];
  for (const candidate of candidates) {
    const match = cells.get(compactKey(candidate));
    if (match) return match;
  }
  return { value: "", sourceColumn: "" };
}

function doubleHalfMeasurement(value: string, sourceColumn: string, target: string): string {
  if (!/1\/2/.test(sourceColumn) || !["胸围", "腰围", "臀围", "脚口"].includes(target)) return value;
  const number = Number(value);
  return Number.isFinite(number) ? numberText(number * 2) : value;
}

function fixedMainColumns(kind: ProductKind, garment: string): string[] | null {
  if (kind === "shoe") return ["尺码", "脚长", "鞋内长"];
  if (kind !== "apparel") return null;
  const compactGarment = garment.replace(/\s+/g, "");
  if (/牛仔(?:裤|长裤|短裤|中裤)/.test(compactGarment)) return ["尺码", "尺码", "裤长", "腰围", "臀围", "脚口", "身高", "体重"];
  if (/上装|衣|衫|外套|卫衣|夹克|大衣|马甲|背心|羽绒服|棉服|冲锋衣|防晒服/.test(compactGarment) || !/下装|裤|裙/.test(compactGarment)) {
    return ["尺码", "尺码", "衣长", "肩宽", "胸围", "袖长", "身高", "体重"];
  }
  return null;
}

function normalizeMainTableLocal(value: unknown, identities: SizeIdentity[], kind: ProductKind, garment: string): JsonRecord {
  const source = record(value);
  const sourceTitle = text(source.title);
  const targetColumns = fixedMainColumns(kind, garment) ?? splitColumns(sourceTitle).map(canonicalColumnName).filter(Boolean);
  const columns = targetColumns.length > 0 ? targetColumns : kind === "shoe" ? ["尺码", "脚长", "鞋内长"] : ["尺码", "尺码"];
  const output: JsonRecord = { title: columns.join(",") };
  const lookup = sizeLookup(identities);
  for (const [rawSize, rawRow] of tableRows(source)) {
    const identity = lookup.get(canonicalSizeKey(rawSize).toLowerCase());
    if (!identity) continue;
    const sourceCells = sourceCellMap(sourceTitle, rawRow);
    let sizeOrdinal = 0;
    const values = columns.map((column) => {
      const targetKey = compactKey(column);
      if (targetKey === compactKey("尺码") || targetKey === compactKey("尺寸") || targetKey === compactKey("规格")) {
        const value = sizeOrdinal === 0 ? identity.alias : identity.canonical;
        sizeOrdinal += 1;
        return value;
      }
      const sourceCell = findSourceCell(sourceCells, column);
      let cell = cleanMeasurement(sourceCell.value);
      if (kind === "apparel" && targetKey === compactKey("身高") && !cell) cell = identity.canonical;
      if (kind === "apparel" && targetKey === compactKey("体重")) cell = BALABALA_APPAREL_WEIGHT_KG[identity.canonical] ?? cell;
      cell = doubleHalfMeasurement(cell, sourceCell.sourceColumn, column);
      return cleanMeasurement(cell);
    });
    output[identity.alias] = values.join(",");
  }
  return output;
}

function normalizeGenericTableLocal(value: unknown, identities: SizeIdentity[], kind: ProductKind): JsonRecord {
  const source = record(value);
  const title = splitColumns(source.title).map(canonicalColumnName).join(",");
  const output: JsonRecord = { title };
  const lookup = sizeLookup(identities);
  for (const [rawSize, rawRow] of tableRows(source)) {
    const identity = lookup.get(canonicalSizeKey(rawSize).toLowerCase());
    if (!identity) continue;
    const cells = splitCells(rawRow).map((cell) => cleanMeasurement(cell));
    const columns = splitColumns(source.title);
    const sizeIndex = columns.findIndex((column) => /尺码|尺寸|规格|欧洲码|中国码/i.test(column));
    if (sizeIndex >= 0 && sizeIndex < cells.length) cells[sizeIndex] = kind === "shoe" && /欧洲码|中国码/.test(columns[sizeIndex]) ? identity.alias : identity.alias;
    output[identity.alias] = cells.join(",");
  }
  return output;
}

function platformColumnIndex(title: string, name: string): number {
  return splitColumns(title).findIndex((column) => compactKey(column) === compactKey(name));
}

function normalizeShoePlatformCell(identity: SizeIdentity, platform: string, sourceCell: string, remark: string): string {
  if (platform === "京东") return identity.canonical;
  if (!REMARK_DISPLAY_PLATFORMS.has(platform)) return "";
  if (remark) return `${identity.alias}(${remark})`;
  return sourceCell;
}

function normalizeMultiPlatformLocal(value: unknown, identities: SizeIdentity[], kind: ProductKind, remarks: Record<string, string>): JsonRecord {
  const source = record(value);
  const sourceTitle = text(source.title);
  const output: JsonRecord = { title: SHOE_MULTI_PLATFORM_COLUMNS.join(",") };
  const lookup = sizeLookup(identities);
  const rows = tableRows(source);
  const sourceRows = rows.length > 0
    ? rows
    : identities.map((identity) => [identity.alias, ""] as [string, string]);
  const seen = new Set<string>();
  for (const [rawSize, rawRow] of sourceRows) {
    const identity = lookup.get(canonicalSizeKey(rawSize).toLowerCase());
    if (!identity) continue;
    if (seen.has(identity.canonical)) continue;
    seen.add(identity.canonical);
    const sourceCells = splitCells(rawRow);
    const remark = remarkForSize(identity.canonical, remarks, identities);
    const values = SHOE_MULTI_PLATFORM_COLUMNS.map((platform) => {
      if (kind === "apparel") return platform === "京东" ? identity.canonical : "";
      const sourceIndex = platformColumnIndex(sourceTitle, platform);
      return normalizeShoePlatformCell(identity, platform, sourceIndex >= 0 ? sourceCells[sourceIndex] ?? "" : "", remark);
    });
    output[identity.alias] = values.join(",");
  }
  return output;
}

function normalizeStructuredLocal(name: string, value: unknown, identities: SizeIdentity[], kind: ProductKind, garment: string, remarks: Record<string, string>): JsonRecord {
  if (compactKey(name) === compactKey("多平台尺码")) return normalizeMultiPlatformLocal(value, identities, kind, remarks);
  if (isMainSizeTable(name)) return normalizeMainTableLocal(value, identities, kind, garment);
  return normalizeGenericTableLocal(value, identities, kind);
}

function sdkShoeTable(value: unknown): JsonRecord {
  const source = record(value);
  const columns = splitColumns(source.title);
  const sizeIndex = columns.findIndex((column) => compactKey(column) === compactKey("尺码") || compactKey(column) === compactKey("尺寸"));
  if (sizeIndex < 0) return source;
  const targetColumns = columns.filter((_, index) => index !== sizeIndex).map(canonicalColumnName).filter(Boolean);
  const output: JsonRecord = { title: targetColumns.join(",") };
  for (const [size, row] of tableRows(source)) {
    const cells = splitCells(row).filter((_, index) => index !== sizeIndex);
    output[size] = cells.join(",");
  }
  return output;
}

function sdkShoeVipTable(value: unknown): JsonRecord {
  const source = record(value);
  const columns = splitColumns(source.title);
  const europeanIndex = columns.findIndex((column) => compactKey(column) === compactKey("欧洲码"));
  if (europeanIndex < 0) return source;
  const output: JsonRecord = { ...source };
  for (const [size, row] of tableRows(source)) {
    const cells = splitCells(row);
    if (europeanIndex < cells.length) cells[europeanIndex] = stripSizeRemark(cells[europeanIndex]);
    output[size] = cells.join(",");
  }
  return output;
}

function sdkStructuredValue(name: string, value: unknown, kind: ProductKind): unknown {
  if (kind === "shoe" && isMainSizeTable(name)) return sdkShoeTable(value);
  if (kind === "shoe" && compactKey(name) === compactKey("唯品会尺码表")) return sdkShoeVipTable(value);
  return value;
}

function parseColorParts(value: unknown): string[] {
  return text(value).split(/[;；]/).flatMap((part) => part.split(/[,，]/).map((item) => item.trim())).filter(Boolean);
}

function colorAliasVariants(value: unknown): string[] {
  const alias = text(value);
  if (!alias) return [];
  // Down-garment sale colours may append the filling while MDM SKU colours do
  // not.  Compare both representations but preserve the template value.
  const undecorated = alias.replace(/[\-－—]\s*(?:白|灰)?(?:鸭|鹅)绒\s*$/u, "").trim();
  return unique([alias, undecorated]);
}

function merchantSkuColorKey(value: unknown, saleColorValue: unknown): string {
  const sourceColor = text(value);
  if (!sourceColor || !saleColorValue) return sourceColor;
  const sourceAliases = new Set(colorAliasVariants(sourceColor));
  for (const choice of text(saleColorValue).split(/[;；]/).map((item) => item.trim()).filter(Boolean)) {
    const parts = choice.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
    const merchantKey = parts.at(-1) ?? "";
    if (merchantKey && parts.some((part) => colorAliasVariants(part).some((alias) => sourceAliases.has(alias)))) return merchantKey;
  }
  return sourceColor;
}

function baseColorName(value: string): string {
  if (/卡其|贝壳卡|卡色/.test(value)) return "卡其";
  if (value.includes("粉")) return "粉红";
  for (const color of ["黑色", "白色", "红色", "蓝色", "绿色", "黄色", "紫色", "灰色", "棕色", "橙色"]) {
    if (value.includes(color.slice(0, 1))) return color;
  }
  return value;
}

function normalizeColorField(value: unknown, skus: JsonRecord[]): string {
  const existing = text(value).replace(/，/g, ",");
  const aliases = new Set(parseColorParts(existing));
  const additions: string[] = [];
  for (const sku of skus) {
    const color = text(sku.color ?? sku.colorName ?? sku.color_name);
    if (!color || aliases.has(color)) continue;
    const base = baseColorName(color);
    additions.push(base && base !== color ? `${base},${color}` : color);
    aliases.add(base);
    aliases.add(color);
  }
  return unique([existing, ...additions]).join(";");
}

function toSkuRecord(sku: JsonRecord, identity: SizeIdentity | undefined): ProductPayloadResult["skus"][number] {
  return {
    skuCode: text(sku.skuCode ?? sku.sku_code),
    skcCode: text(sku.skcCode ?? sku.skc_code),
    color: text(sku.color ?? sku.colorName ?? sku.color_name),
    size: identity?.canonical ?? canonicalSizeKey(sku.size ?? sku.sizeName ?? sku.size_name),
    sizeAlias: identity?.alias ?? text(sku.size ?? sku.sizeName ?? sku.size_name),
    barcode: text(sku.barcode ?? sku.eanCode ?? sku.ean_code),
    sellerCode: text(sku.sellerCode ?? sku.seller_code),
    price: moneyText(sku.price),
  };
}

function normalizeSkus(source: JsonRecord, identities: SizeIdentity[], warnings: string[]): ProductPayloadResult["skus"] {
  const candidate = source.skus ?? source.skuList ?? source.sku_list;
  const rawSkus = Array.isArray(candidate)
    ? candidate.map(record)
    : [];
  const lookup = sizeLookup(identities);
  return rawSkus.map((sku) => {
    const rawSize = sku.size ?? sku.sizeName ?? sku.size_name;
    const identity = lookup.get(canonicalSizeKey(rawSize).toLowerCase());
    if (text(rawSize) && !identity) warnings.push(`SKU 尺码 ${text(rawSize)} 不在销售尺码中，已保留原值供人工检查。`);
    return toSkuRecord(sku, identity);
  });
}

function offsetMoney(value: string, offset: number): string {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  const output = number + offset;
  return Number.isInteger(output) ? String(output) : output.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function merchantSkuColumns(field: JsonRecord | undefined): string[] {
  const options = arrayValue(field?.options ?? field?.options_json)
    .map((option) => text(record(option).value ?? option))
    .filter(Boolean);
  return options.length > 0 ? unique(options) : BALABALA_MERCHANT_SKU_COLUMNS;
}

function buildMerchantSkuField(
  existing: unknown,
  source: JsonRecord,
  skus: ProductPayloadResult["skus"],
  identities: SizeIdentity[],
  kind: ProductKind,
  date: string,
  saleColorValue: unknown,
): JsonRecord {
  const existingRecord = record(existing);
  if (Object.keys(existingRecord).length > 0) {
    const title = text(existingRecord.title);
    const output: JsonRecord = { ...existingRecord, ...(title ? { title } : {}) };
    const lookup = sizeLookup(identities);
    for (const [color, rows] of Object.entries(existingRecord)) {
      if (color === "title" || !rows || typeof rows !== "object" || Array.isArray(rows)) continue;
      const colorKey = merchantSkuColorKey(color, saleColorValue);
      const nextRows: JsonRecord = {};
      for (const [size, value] of Object.entries(record(rows))) {
        const identity = lookup.get(canonicalSizeKey(size).toLowerCase());
        nextRows[identity?.alias ?? size] = normalizeMerchantSkuRow(value, title);
      }
      // Multiple historical aliases can resolve to one current sale-colour
      // enum.  Merge their size rows rather than silently dropping either.
      output[colorKey] = { ...record(output[colorKey]), ...nextRows };
    }
    return output;
  }
  const retailPrice = moneyText(source.retailPrice ?? source.retail_price ?? source.price);
  const columns = merchantSkuColumns(undefined);
  const output: JsonRecord = { title: columns.join(",") };
  const guideTitle = text(source.guideTitle ?? source.guide_title ?? source.shoppingTitle ?? source.shopping_title);
  for (const sku of skus) {
    if (!sku.color || !sku.sizeAlias) continue;
    const price = sku.price || retailPrice;
    const xhsCode = kind === "shoe" && sku.skcCode ? `${sku.skcCode}${sku.size}` : sku.skuCode;
    const valuesByColumn: Record<string, string> = {
      价格: price,
      货号: text(source.code ?? source.spuCode ?? source.spu_code),
      上市时间: monthText(date),
      数量: "0",
      商家编码: sku.sellerCode || sku.skuCode,
      条形码: kind === "shoe" || kind === "apparel" ? "" : sku.barcode,
      零售价: retailPrice || price,
      供货价: price,
      唯品会货号: sku.skcCode,
      唯品会条形码: sku.barcode,
      京东价: retailPrice || price,
      划线价: retailPrice || price,
      拼多多单买价: offsetMoney(retailPrice || price, -1),
      拼多多团购价: offsetMoney(retailPrice || price, -2),
      天猫特卖折扣价: retailPrice || price,
      天猫特卖专柜价: retailPrice || price,
      采购价: retailPrice || price,
      京东自营市场价: retailPrice || price,
      有赞标准价: retailPrice || price,
      有赞价格: retailPrice || price,
      原价: retailPrice || price,
      小红书市场价: retailPrice || price,
      抖音结算价格: retailPrice || price,
      抖音价: retailPrice || price,
      快手价: retailPrice || price,
      爱库存供货价: retailPrice || price,
      爱库存最低价: retailPrice || price,
      好衣库结算价: retailPrice || price,
      好衣库供货价: retailPrice || price,
      好衣库价: retailPrice || price,
      好衣库原价: retailPrice || price,
      微信视频小店价格: retailPrice || price,
      单品货号: sku.barcode,
      "1688件重尺-重(g)": "1000",
      小红书商家编码: xhsCode,
      天猫SKU搜索标题: guideTitle,
    };
    const row = columns.map((column) => valuesByColumn[column] ?? "").join(",");
    const colorKey = merchantSkuColorKey(sku.color, saleColorValue);
    const colorBucket = record(output[colorKey]);
    colorBucket[sku.sizeAlias] = row;
    output[colorKey] = colorBucket;
  }
  return output;
}

function normalizeMerchantSkuRow(value: unknown, title: string): string {
  const cells = splitCells(value);
  const columns = splitColumns(title);
  const dateIndex = columns.findIndex((column) => compactKey(column) === compactKey("上市时间"));
  if (dateIndex >= 0 && dateIndex < cells.length) cells[dateIndex] = monthText(cells[dateIndex]);
  return cells.join(",");
}

function auditField(field: JsonRecord): ProductPayloadAuditField {
  const value = field.value;
  return {
    ...(text(field.id) ? { id: text(field.id) } : {}),
    name: text(field.name),
    ...(text(field.fieldType) ? { fieldType: text(field.fieldType) } : {}),
    ...(text(field.templatePlatform) ? { templatePlatform: text(field.templatePlatform) } : {}),
    value,
    ...(typeof value === "string" ? { valueText: value } : {}),
    ...(value && typeof value === "object" ? { valueJson: value } : {}),
  };
}

function cloneField(field: JsonRecord, value: unknown): JsonRecord {
  return { ...field, value };
}

function upsertField(fields: JsonRecord[], name: string, value: unknown, fieldType = "MULTI_TEXT"): JsonRecord[] {
  const index = fields.findIndex((field) => compactKey(field.name) === compactKey(name));
  const next = cloneField(index >= 0 ? fields[index] : { name, fieldType }, value);
  if (index >= 0) return fields.map((field, fieldIndex) => fieldIndex === index ? next : field);
  return [...fields, next];
}

function stageFields(fields: JsonRecord[], stage: ProductPayloadStage, kind: ProductKind, warnings: string[], includeMultiPlatformOnUpdate = true): JsonRecord[] {
  return fields.filter((field) => {
    const name = text(field.name);
    if (kind === "shoe" && compactKey(name) === compactKey(UNSUPPORTED_SHOE_TABLE)) {
      warnings.push(`已从 SDK payload 省略不支持的 ${UNSUPPORTED_SHOE_TABLE}，原始字段只保留在本地输入。`);
      return false;
    }
    if (stage === "create" && isStructuredField(name) && !isMainSizeTable(name) && compactKey(name) !== compactKey("多平台尺码")) {
      return false;
    }
    // A covering update must carry the complete generated size-table set.
    // In particular, 多平台尺码 is part of the default create/full-update
    // contract; omitting it can silently clear the remote table.  Callers
    // may still explicitly opt out for a confirmed incompatible template.
    if (stage === "update" && isStructuredField(name)) {
      const key = compactKey(name);
      const stable = isMainSizeTable(name)
        || key === compactKey("唯品会尺码表")
        || key === compactKey("天猫尺码表")
        || key === compactKey("抖音尺码表");
      if (!stable && !(includeMultiPlatformOnUpdate && key === compactKey("多平台尺码"))) {
        if (key === compactKey("多平台尺码")) warnings.push("includeMultiPlatformSizeOnUpdate=false，已按显式配置从覆盖式更新省略多平台尺码。");
        return false;
      }
    }
    return true;
  });
}

function sdkFields(fields: JsonRecord[], kind: ProductKind): Record<string, unknown> {
  return Object.fromEntries(fields.map((field) => [
    text(field.name), isStructuredField(field.name) ? sdkStructuredValue(text(field.name), field.value, kind) : field.value,
  ]));
}

function sizeTexts(
  identities: SizeIdentity[],
  kind: ProductKind,
  multiPlatform: JsonRecord,
  remarks: Record<string, string>,
): string[] {
  const title = text(multiPlatform.title);
  const output: string[] = [];
  for (const identity of identities) {
    output.push(`s${identity.canonical},${identity.alias}`);
    const cells = splitCells(multiPlatform[identity.alias]);
    for (const platform of SHOE_MULTI_PLATFORM_COLUMNS) {
      const index = platformColumnIndex(title, platform);
      let value = index >= 0 ? cells[index] ?? "" : "";
      if (!value && REMARK_DISPLAY_PLATFORMS.has(platform)) {
        const remark = remarkForSize(identity.canonical, remarks, identities);
        if (remark && (kind === "shoe" || kind === "apparel")) value = `${identity.alias}（${remark}）`;
      }
      value = value.replace(/\(([^()]*)\)$/, "（$1）");
      output.push(`s${identity.canonical},${value},${platform}`);
    }
  }
  return output;
}

function normalizedSourceSkus(source: JsonRecord): JsonRecord[] {
  const candidate = source.skus ?? source.skuList ?? source.sku_list;
  return Array.isArray(candidate) ? candidate.map(record) : [];
}

function productFieldValue(fields: Record<string, unknown>, names: string[]): unknown {
  const wanted = new Set(names.map(compactKey));
  const key = Object.keys(fields).find((candidate) => wanted.has(compactKey(candidate)));
  return key === undefined ? undefined : fields[key];
}

function normalizeScalarFields(fields: JsonRecord[]): JsonRecord[] {
  return fields.map((field) => {
    const key = compactKey(field.name);
    if (key === compactKey("所在地")) return cloneField(field, normalizeLocation(field.value));
    if (key === compactKey("售后服务承诺")) return cloneField(field, text(field.value).replace(/\s+/g, ""));
    return field;
  });
}

export function buildProductPayload(input: unknown, options: BuildProductPayloadOptions = {}): ProductPayloadResult {
  const source = unwrapInput(input);
  const initialFields = normalizeScalarFields(normalizedFields(source));
  const kind = inferKind(source, initialFields);
  const garment = garmentType(source, initialFields);
  const warnings: string[] = [];
  const errors: string[] = [];
  const stage = options.stage ?? (source.stage === "update" ? "update" : "create");
  const tenant = text(options.tenantName ?? source.tenantName ?? source.tenant ?? source.brandTenant) || DEFAULT_TENANT;
  const merchantId = text(options.merchantId ?? source.merchantId ?? source.merchant_id) || DEFAULT_MERCHANT_ID;
  const rawSkus = normalizedSourceSkus(source);
  const identities = buildSizeIdentities(source, initialFields, rawSkus, kind, warnings);
  const remarks = deriveSizeRemarks(initialFields, source, identities);
  const normalizedSkus = normalizeSkus(source, identities, warnings);
  const lookup = sizeLookup(identities);

  if (stage === "create" && !text(source.tradeId ?? source.trade_id)) errors.push("create payload requires tradeId");
  if (stage === "update" && !text(source.productId ?? source.product_id ?? source.createdProductId ?? source.created_product_id)) errors.push("update payload requires productId");
  if (!text(source.code ?? source.spuCode ?? source.spu_code)) errors.push("product payload requires code");
  if (!text(source.title)) warnings.push("product title is empty; DeepDraw may reject the product.");
  if (normalizedSkus.length > 0 && identities.length === 0) errors.push("SKU payload requires at least one sale size");

  let allFields = initialFields.map((field) => {
    if (isStructuredField(field.name)) {
      if (field.value !== undefined && (typeof field.value !== "object" || Array.isArray(field.value))) {
        warnings.push(`结构化字段 ${text(field.name)} 不是对象，已不参与 SDK payload。`);
        return cloneField(field, {});
      }
      return cloneField(field, normalizeStructuredLocal(text(field.name), field.value, identities, kind, garment, remarks));
    }
    return field;
  });

  const saleSizeValue = saleSizeText(identities, kind, remarks);
  allFields = upsertField(allFields, "尺码", saleSizeValue, "MULTI_CHOICE");
  const currentColor = fieldValue(allFields, ["颜色"]);
  if (normalizedSkus.length > 0 || nonEmpty(currentColor)) {
    allFields = upsertField(allFields, "颜色", normalizeColorField(currentColor, rawSkus), "TEXT");
  }
  const existingMerchantSku = fieldValue(allFields, ["商家 SKU", "商家SKU"]);
  const date = normalizeDate(source.date ?? source.productDate ?? source.product_date ?? fieldValue(allFields, ["内容上市时间", "搜索上市时间", "上市时间"]));
  const merchantSku = buildMerchantSkuField(existingMerchantSku, {
    ...source,
    code: source.code ?? source.spuCode ?? source.spu_code,
    retailPrice: source.retailPrice ?? source.retail_price ?? source.price,
  }, normalizedSkus, identities, kind, date, fieldValue(allFields, ["颜色"]));
  if (normalizedSkus.length > 0 || nonEmpty(existingMerchantSku)) allFields = upsertField(allFields, "商家SKU", merchantSku, "MULTI_TEXT");

  const multiField = fieldByName(allFields, ["多平台尺码"]);
  const includeMulti = source.includeMultiPlatformSizeField !== false && source.include_multi_platform_size_field !== false;
  if (includeMulti && identities.length > 0) {
    const multiValue = multiField?.value && typeof multiField.value === "object" && Object.keys(record(multiField.value)).length > 1
      ? multiField.value
      : normalizeMultiPlatformLocal({}, identities, kind, remarks);
    allFields = upsertField(allFields, "多平台尺码", normalizeMultiPlatformLocal(multiValue, identities, kind, remarks), "MULTI_TEXT");
  } else if (!includeMulti) {
    allFields = allFields.filter((field) => compactKey(field.name) !== compactKey("多平台尺码"));
    warnings.push("includeMultiPlatformSizeField=false，已按显式配置省略多平台尺码。");
  }

  for (const field of allFields) {
    const key = compactKey(field.name);
    if (UNSUPPORTED_SPECIAL_FIELDS.has(key) && nonEmpty(field.value)) {
      warnings.push(`字段 ${field.name} 属于深绘特殊格式边界，CLI 保留输入值但不自动推断。`);
    }
  }

  const allowedFieldNames = new Set((options.allowedFieldNames ?? []).map(compactKey).filter(Boolean));
  const localAllFields = allFields
    .filter((field) => nonEmpty(field.value) || (isStructuredField(field.name) && field.value !== undefined))
    .filter((field) => {
      if (allowedFieldNames.size === 0 || allowedFieldNames.has(compactKey(field.name))) return true;
      warnings.push(`字段 ${text(field.name)} 不属于当前激活模板，已从 SDK payload 排除。`);
      return false;
    });
  const includeMultiPlatformOnUpdate = source.includeMultiPlatformSizeOnUpdate !== false && source.include_multi_platform_size_on_update !== false;
  const fullFields = stageFields(localAllFields, "update", kind, warnings, includeMultiPlatformOnUpdate);
  const selectedFields = stageFields(localAllFields, stage, kind, warnings, includeMultiPlatformOnUpdate);
  const auditFields = selectedFields.map(auditField);
  const legacyUpdateFields = fullFields.map(auditField);
  const sdkFieldObject = sdkFields(selectedFields, kind);
  const code = text(source.code ?? source.spuCode ?? source.spu_code);
  const title = text(source.title);
  const retailPrice = moneyText(source.retailPrice ?? source.retail_price ?? source.price);
  const places = normalizePlaces(source.places ?? source.sites ?? source.compatiblePlatforms ?? source.compatible_platforms);
  const product: ProductPayloadResult["product"] = {
    code,
    title,
    retailPrice,
    date,
    places,
    fields: sdkFieldObject,
    ...(text(source.remark) ? { remark: text(source.remark) } : {}),
  };
  const tradeId = text(source.tradeId ?? source.trade_id);
  const productId = text(source.productId ?? source.product_id ?? source.createdProductId ?? source.created_product_id);
  const query: Record<string, string> = stage === "create"
    ? { merchantId, ...(tradeId ? { tradeId } : {}) }
    : (productId ? { productId } : {});
  const multiPlatform = record(productFieldValue(sdkFieldObject, ["多平台尺码"])) || normalizeMultiPlatformLocal({}, identities, kind, remarks);
  const optionAliases = Object.fromEntries(identities.map((identity) => [identity.canonical, identity.alias]));
  const sdkConfig: Record<string, string> = stage === "create" ? { merchantId, ...(tradeId ? { tradeId } : {}) } : { merchantId };
  const sdkInput = {
    config: sdkConfig,
    query,
    product,
  };

  for (const sku of normalizedSkus) {
    if (sku.size && !lookup.has(canonicalSizeKey(sku.size).toLowerCase())) errors.push(`SKU 尺码 ${sku.size} 未与销售尺码对齐`);
  }

  return {
    ok: errors.length === 0,
    command: "deepdraw product payload",
    tenant,
    merchantId,
    stage,
    kind,
    query,
    product,
    fields: auditFields,
    legacyUpdateFields,
    sizes: {
      options: identities.map((identity) => identity.canonical),
      optionAliases,
      texts: sizeTexts(identities, kind, multiPlatform, remarks),
    },
    sizeRemarks: remarks,
    skus: normalizedSkus,
    sdkInput,
    diagnostics: { warnings: unique(warnings), errors: unique(errors) },
  };
}

export const buildBalabalaProductPayload = buildProductPayload;

import { BUILTIN_APPAREL_ROWS, BUILTIN_SHOE_ROWS, SIZE_REFERENCE_SOURCE } from "./size-reference-data.js";
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import XLSX from "xlsx";
import type { SourceReference } from "../../workflow/types.js";
import { normalizePlmSizeChartRows } from "./size-chart-rules.js";

type JsonRecord = Record<string, unknown>;
type SheetCell = { w?: unknown; v?: unknown };
export type PhysicalSheet = Record<string, SheetCell | unknown>;

export interface PhysicalRow {
  row: number;
  values: Record<string, string>;
}

export interface BalabalaImportInput {
  spu: string;
  /** The formal source style selected by an explicit test target mapping. */
  sourceSpu?: string;
  mdmPath: string;
  launchPlanPath: string;
  copywritingPath: string;
  shoeSizeChartPath?: string;
  plmSizeChartPath?: string;
  apparelSizeReferencePath?: string;
  fieldMappingsPath?: string;
  imagesPath?: string;
}

export interface ImportedBalabalaSources extends JsonRecord {
  spu: string;
  sourceSpu?: string;
  sources: SourceReference[];
  skus: JsonRecord[];
  mdm: JsonRecord;
  launchPlan: JsonRecord;
  copywriting: { rows: JsonRecord[] };
  sizeChart?: JsonRecord;
  plmSizeChart?: JsonRecord;
  apparelSizeReference?: JsonRecord;
  fieldMappings?: JsonRecord[];
  images: JsonRecord[];
}

function text(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value).trim();
  return "";
}

function normalizeHeader(value: unknown): string {
  return text(value).replace(/[\s\n\r]/g, "").replace(/[（(]/g, "(").replace(/[）)]/g, ")").toLowerCase();
}

function cellAddress(value: string): { col: number; row: number } | undefined {
  const match = value.match(/^([A-Z]+)(\d+)$/);
  if (!match) return undefined;
  let col = 0;
  for (const letter of match[1]) col = col * 26 + letter.charCodeAt(0) - 64;
  return { col, row: Number(match[2]) };
}

function columnName(index: number): string {
  let current = index;
  let output = "";
  while (current > 0) {
    const remainder = (current - 1) % 26;
    output = String.fromCharCode(65 + remainder) + output;
    current = Math.floor((current - 1) / 26);
  }
  return output;
}

function physicalCells(sheet: PhysicalSheet): Array<{ col: number; row: number; value: string }> {
  return Object.entries(sheet).flatMap(([address, cell]) => {
    const decoded = cellAddress(address);
    if (!decoded || !cell || typeof cell !== "object") return [];
    const value = text((cell as SheetCell).w ?? (cell as SheetCell).v);
    return [{ ...decoded, value }];
  }).sort((left, right) => left.row - right.row || left.col - right.col);
}

/** Reads every physical cell, intentionally ignoring the XLSX worksheet dimension. */
export function physicalSheetRows(sheet: PhysicalSheet, headerRow?: number): PhysicalRow[] {
  const cells = physicalCells(sheet);
  const actualHeaderRow = headerRow ?? cells.find((cell) => cell.value)?.row;
  if (!actualHeaderRow) return [];
  const headers = new Map(cells.filter((cell) => cell.row === actualHeaderRow && cell.value).map((cell) => [cell.col, cell.value]));
  if (headers.size === 0) return [];
  const rows = new Map<number, Record<string, string>>();
  for (const cell of cells) {
    const header = headers.get(cell.col);
    if (!header || !cell.value) continue;
    const row = rows.get(cell.row) ?? {};
    row[header] = cell.value;
    rows.set(cell.row, row);
  }
  return [...rows.entries()]
    .sort(([left], [right]) => left - right)
    .map(([row, values]) => ({ row, values }));
}

function valueFor(values: Record<string, string>, aliases: string[]): string {
  const wanted = new Set(aliases.map(normalizeHeader));
  const match = Object.entries(values).find(([key]) => wanted.has(normalizeHeader(key)));
  return match?.[1] ?? "";
}

function sourceReference(path: string, sheet?: string, row?: number, role?: string): Promise<SourceReference> {
  return readFile(path).then((contents) => ({
    path: resolve(path),
    sha256: createHash("sha256").update(contents).digest("hex"),
    ...(sheet ? { sheet } : {}),
    ...(row ? { row } : {}),
    ...(role ? { role } : {}),
  }));
}

function headerRowFor(sheet: PhysicalSheet, aliases: string[]): number | undefined {
  const wanted = new Set(aliases.map(normalizeHeader));
  const byRow = new Map<number, string[]>();
  for (const cell of physicalCells(sheet)) {
    if (cell.row > 16) break;
    const values = byRow.get(cell.row) ?? [];
    values.push(normalizeHeader(cell.value));
    byRow.set(cell.row, values);
  }
  return [...byRow.entries()]
    .map(([row, values]) => ({ row, score: values.filter((value) => wanted.has(value)).length }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.row - right.row)[0]?.row;
}

function rowsFromWorkbook(path: string, aliases: string[]): Array<{ sheet: string; rows: PhysicalRow[] }> {
  const workbook = XLSX.readFile(path, { cellText: true, cellDates: false });
  return workbook.SheetNames.flatMap((sheetName) => {
    const sheet = workbook.Sheets[sheetName] as PhysicalSheet;
    const headerRow = headerRowFor(sheet, aliases);
    return headerRow ? [{ sheet: sheetName, rows: physicalSheetRows(sheet, headerRow).filter((entry) => entry.row > headerRow) }] : [];
  });
}

export function selectBalabalaRows(rows: PhysicalRow[], spu: string, spuColumns: string[], skcColumns: string[]): PhysicalRow[] {
  const skcExpression = new RegExp(`^${spu.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\d{5}$`);
  return rows.filter(({ values }) => {
    if (spuColumns.some((column) => valueFor(values, [column]) === spu)) return true;
    return skcColumns.some((column) => skcExpression.test(valueFor(values, [column])));
  });
}

function normalizeMdmRow(values: Record<string, string>, ref: SourceReference): JsonRecord {
  return {
    raw: { ...values },
    code: valueFor(values, ["款号"]),
    title: valueFor(values, ["款名称", "商品名称"]),
    skcCode: valueFor(values, ["SKC编码", "款色", "款色号"]),
    skuCode: valueFor(values, ["SKU编码"]),
    colorCode: valueFor(values, ["颜色编码"]),
    color: valueFor(values, ["颜色名称"]),
    size: valueFor(values, ["尺码名称", "规格"]),
    sizeCode: valueFor(values, ["尺码编码"]),
    price: valueFor(values, ["挂牌单价", "吊牌价"]),
    barcode: valueFor(values, ["国际码", "供应商商品条码"]),
    sellerCode: valueFor(values, ["企业码"]),
    material: valueFor(values, ["面料"]),
    lining: valueFor(values, ["里料"]),
    composition: valueFor(values, ["成分", "洗唛成分"]),
    sourceRef: ref,
  };
}

function normalizePlanRow(values: Record<string, string>, ref: SourceReference): JsonRecord {
  const rawLaunchDate = valueFor(values, ["上市时间"]);
  const launchDate = rawLaunchDate.match(/^(\d{1,2})月(\d{1,2})日$/)
    ? `2026-${rawLaunchDate.match(/^(\d{1,2})月(\d{1,2})日$/)![1].padStart(2, "0")}-${rawLaunchDate.match(/^(\d{1,2})月(\d{1,2})日$/)![2].padStart(2, "0")}`
    : rawLaunchDate;
  return {
    raw: { ...values },
    code: valueFor(values, ["大货款号", "商品编码", "款号"]),
    skcCode: valueFor(values, ["款色号", "款色"]),
    productLine: valueFor(values, ["产品线"]),
    ageBand: valueFor(values, ["年龄段"]),
    sizeRange: valueFor(values, ["尺码段", "规格段"]),
    gender: valueFor(values, ["性别"]),
    category: valueFor(values, ["品类"]),
    subcategory: valueFor(values, ["小类", "小类描述"]),
    color: valueFor(values, ["颜色名称"]),
    retailPrice: valueFor(values, ["吊牌价", "挂牌单价"]),
    launchDate,
    rawLaunchDate,
    officialTrade: valueFor(values, ["发布类目(官方)", "发布类目（官方）"]),
    vipTrade: valueFor(values, ["发布类目(唯品)", "发布类目（唯品）"]),
    vipStyle: valueFor(values, ["主款式(唯品四级品类)", "主款式（唯品四级品类）"]),
    douyinTrade: valueFor(values, ["发布类目(抖音)", "发布类目（抖音）"]),
    upperMaterial: valueFor(values, ["大身面料", "面料"]),
    lining: valueFor(values, ["里料材质", "里料"]),
    filling: valueFor(values, ["填充物备注", "填充物"]),
    fab: valueFor(values, ["FAB"]),
    sourceRef: ref,
  };
}

function validLaunchDate(value: unknown): boolean {
  return /^20\d{2}-\d{2}-\d{2}$/.test(text(value));
}

/**
 * Launch plans are usually one row per SKC.  A cancelled colour row must not
 * become the SPU-wide operational record merely because it appears first in
 * the worksheet.  Keep all rows for category/colour evidence, while choosing
 * the first dated row for scalar defaults such as date and retail price.
 */
function preferredLaunchPlanRow(rows: JsonRecord[]): JsonRecord {
  return rows.find((row) => validLaunchDate(row.launchDate))
    ?? rows.find((row) => text(row.rawLaunchDate).toLowerCase() !== "取消")
    ?? rows[0]
    ?? {};
}

function normalizeCopyRow(values: Record<string, string>, ref: SourceReference): JsonRecord {
  return {
    raw: { ...values },
    code: valueFor(values, ["款号"]),
    skcCode: valueFor(values, ["款色"]),
    category: valueFor(values, ["品类"]),
    name: valueFor(values, ["名称"]),
    productLine: valueFor(values, ["产品线"]),
    title: valueFor(values, ["搜索标题"]),
    vipTitle: valueFor(values, ["唯品标题"]),
    guideTitle: valueFor(values, ["导购标题(品牌+品类+性别+款式+风格+季节)", "导购标题"]),
    sellingPoint: valueFor(values, ["推荐理由"]),
    fab: valueFor(values, ["FAB"]),
    detail: valueFor(values, ["细节文案"]),
    upperMaterial: valueFor(values, ["大身面料"]),
    lining: valueFor(values, ["里料材质"]),
    filling: valueFor(values, ["填充物备注", "填充物"]),
    sole: valueFor(values, ["鞋底材质"]),
    ageBand: valueFor(values, ["年龄段"]),
    sizeRange: valueFor(values, ["尺码段"]),
    gender: valueFor(values, ["性别"]),
    sourceRef: ref,
  };
}

function shoeSizeRows(path: string): JsonRecord[] {
  const workbook = XLSX.readFile(path, { cellText: true, cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames.find((name) => name.includes("数据转化")) ?? workbook.SheetNames[0]] as PhysicalSheet;
  const cells = new Map(physicalCells(sheet).map((cell) => [`${columnName(cell.col)}${cell.row}`, cell.value]));
  const rows: JsonRecord[] = [];
  for (let row = 4; row <= 120; row += 1) {
    const size = cells.get(`D${row}`) ?? "";
    if (!/^\d+$/.test(size)) continue;
    rows.push({
      size,
      footLength: cells.get(`G${row}`) ?? "",
      foot_length_mm: cells.get(`F${row}`) ?? "",
      footRange: cells.get(`H${row}`) ?? "",
      sportInnerLengthMm: cells.get(`S${row}`) ?? "",
      openSandalInnerLengthMm: cells.get(`I${row}`) ?? "",
      closedSandalInnerLengthMm: cells.get(`N${row}`) ?? "",
      openSandalRemark: cells.get(`K${row}`) ?? "",
      openSandalDouyin: cells.get(`L${row}`) ?? "",
      closedSandalRemark: cells.get(`P${row}`) ?? "",
      closedSandalDouyin: cells.get(`Q${row}`) ?? "",
      sportInnerLength: cells.get(`T${row}`) ?? "",
      sportRemark: cells.get(`U${row}`) ?? "",
      sportDouyin: cells.get(`V${row}`) ?? "",
      sportVip: cells.get(`W${row}`) ?? "",
      sportMulti: cells.get(`X${row}`) ?? "",
      sportPdd: cells.get(`Y${row}`) ?? "",
      openSandalInnerLength: cells.get(`J${row}`) ?? "",
      closedSandalInnerLength: cells.get(`O${row}`) ?? "",
    });
  }
  return rows;
}

async function plmSizeRows(path: string, spu: string): Promise<JsonRecord[]> {
  const books = rowsFromWorkbook(path, ["款号", "测量点", "尺码", "尺码值"]);
  const physicalRows = books.flatMap(({ sheet, rows }) => rows.map((entry) => ({ ...entry.values, sheetName: sheet, rowNumber: entry.row })));
  const normalized = normalizePlmSizeChartRows(physicalRows).filter((row) => row.spuCode === spu);
  if (normalized.length === 0) throw new Error(`PLM size chart has no normalized rows for ${spu}`);
  return normalized.map((row) => ({
    款号: row.spuCode,
    ...(row.skcCode ? { 款色: row.skcCode } : {}),
    测量点: row.measurementPoint,
    尺码: row.size,
    尺码值: row.sizeValue,
    ...row.rowJson,
  }));
}

/**
 * The Balabala tab in 尺码数据模板.xlsx is not a product PLM measurement
 * table.  It is the brand-wide, auditable reference for age, weight, Douyin
 * weight and GB/T-style top/bottom model values.  Keep it separate so it can
 * never be mistaken for a source of garment measurements such as 衣长.
 */
function apparelSizeReference(path: string): JsonRecord {
  const workbook = XLSX.readFile(path, { cellText: true, cellDates: false });
  const sheetName = workbook.SheetNames.find((name) => normalizeHeader(name) === "balabala");
  if (!sheetName) throw new Error("apparel size reference requires a balabala worksheet");
  const cells = physicalCells(workbook.Sheets[sheetName] as PhysicalSheet);
  const headerRow = headerRowFor(workbook.Sheets[sheetName] as PhysicalSheet, ["抖音重量", "男上装", "男下装", "女上装", "女下装"]);
  if (!headerRow) throw new Error("apparel size reference has no Balabala header row");
  const headers = cells.filter((cell) => cell.row === headerRow);
  const column = (name: string, occurrence = 0): number | undefined => headers.filter((cell) => normalizeHeader(cell.value) === normalizeHeader(name))[occurrence]?.col;
  const columns = {
    size: column("尺码", 1) ?? column("尺码", 0), weightKg: column("体重"), age: column("年龄"), douyinWeightJin: column("抖音重量"),
    maleTop: column("男上装"), maleBottom: column("男下装"), femaleTop: column("女上装"), femaleBottom: column("女下装"), neutralTop: column("中性上装"), neutralBottom: column("中性下装"),
  };
  if (!columns.size || !columns.weightKg || !columns.age || !columns.douyinWeightJin || !columns.maleTop || !columns.maleBottom || !columns.femaleTop || !columns.femaleBottom || !columns.neutralTop || !columns.neutralBottom) {
    throw new Error("apparel size reference is missing required Balabala columns");
  }
  const byAddress = new Map(cells.map((cell) => [`${columnName(cell.col)}${cell.row}`, cell.value]));
  const value = (row: number, col: number) => byAddress.get(`${columnName(col)}${row}`) ?? "";
  const rows = [...new Set(cells.map((cell) => cell.row))].filter((row) => row > headerRow).map((row) => ({
    size: text(value(row, columns.size!)), weightKg: text(value(row, columns.weightKg!)), age: text(value(row, columns.age!)), douyinWeightJin: text(value(row, columns.douyinWeightJin!)),
    maleTop: text(value(row, columns.maleTop!)), maleBottom: text(value(row, columns.maleBottom!)), femaleTop: text(value(row, columns.femaleTop!)), femaleBottom: text(value(row, columns.femaleBottom!)), neutralTop: text(value(row, columns.neutralTop!)), neutralBottom: text(value(row, columns.neutralBottom!)),
  })).filter((row) => /^\d{2,3}(?:cm)?$/i.test(row.size) && row.age && row.maleTop && row.maleBottom && row.femaleTop && row.femaleBottom && row.neutralTop && row.neutralBottom);
  if (rows.length === 0) throw new Error("apparel size reference has no usable Balabala reference rows");
  return { source: "apparel_size_reference", sheet: sheetName, headerRow, rows };
}

async function fieldMappings(path: string): Promise<JsonRecord[]> {
  let parsed: unknown;
  try { parsed = JSON.parse(await readFile(path, "utf8")) as unknown; } catch (error) { throw new Error(`Invalid field mappings JSON ${path}: ${error instanceof Error ? error.message : String(error)}`); }
  const root = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as JsonRecord : {};
  const list: unknown[] = Array.isArray(parsed) ? parsed : Array.isArray(root.mappings) ? root.mappings : [];
  const output = list.filter((item): item is JsonRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item)).map((item) => ({ ...item }));
  if (output.some((item) => !text(item.targetField ?? item.target_field ?? item.fieldName ?? item.field_name))) throw new Error("field mappings require targetField");
  return output;
}

function imageRole(path: string): string {
  const name = basename(path).toLowerCase();
  if (/洗唛|洗标|wash/.test(name)) return "washlabel";
  if (/吊牌|合格证|hangtag|certificate|tag/.test(name)) return "hangtag";
  if (/平铺|flat/.test(name) || /^\d{12,}/.test(name)) return "flat_image";
  return "reference";
}

async function imageManifest(path: string, sourceSpu: string): Promise<JsonRecord[]> {
  // OCR evidence in the real Balabala material packages is often a print-ready
  // PDF (合格证/洗标), not only a flattened image.  Store its original bytes and
  // hash in the same evidence manifest so a reviewed OCR fact is traceable to
  // the exact supplied file.  Recognition itself stays external/audited.
  const accepted = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf"]);
  const files: string[] = [];
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const item = resolve(directory, entry.name);
      if (entry.isDirectory()) await visit(item);
      else if (entry.isFile() && accepted.has(extname(entry.name).toLowerCase())) {
        const styleIds = item.match(/(?<!\d)\d{12}(?!\d)/g) ?? [];
        if (styleIds.length === 0 || styleIds.every((id) => id === sourceSpu)) files.push(item);
      }
    }
  };
  await visit(path);
  return Promise.all(files.sort().map(async (file) => ({
    path: file,
    role: imageRole(file),
    mimeType: extname(file).toLowerCase() === ".pdf" ? "application/pdf" : extname(file).toLowerCase() === ".png" ? "image/png" : extname(file).toLowerCase() === ".webp" ? "image/webp" : "image/jpeg",
    bytes: (await stat(file)).size,
    sha256: createHash("sha256").update(await readFile(file)).digest("hex"),
  })));
}

export async function importBalabalaSources(input: BalabalaImportInput): Promise<ImportedBalabalaSources> {
  const spu = input.spu.trim();
  if (!/^\d{12,}(?:-test)?$/.test(spu)) throw new Error("balabala import requires a numeric SPU or numeric -test code");
  // Test source selection is a caller-supplied, auditable policy decision.
  // Never infer it merely from a `-test` suffix: callers must obtain it from
  // their exact test target mapping before they reach this importer.
  const sourceSpu = (input.sourceSpu ?? spu).trim();
  if (!/^\d{12,}$/.test(sourceSpu)) throw new Error("balabala import sourceSpu must be an explicit formal numeric SPU");
  const mdmBooks = rowsFromWorkbook(input.mdmPath, ["款号", "SKC编码", "SKU编码", "颜色名称", "尺码名称"]);
  const mdmMatches = mdmBooks.flatMap(({ sheet, rows }) => selectBalabalaRows(rows, sourceSpu, ["款号"], ["SKC编码", "款色"]).map((row) => ({ sheet, ...row })));
  const mdmRefs = await Promise.all(mdmMatches.map(({ sheet, row }) => sourceReference(input.mdmPath, sheet, row)));
  const skus = mdmMatches.map((item, index) => normalizeMdmRow(item.values, mdmRefs[index]));
  if (skus.length === 0) throw new Error(`MDM SKU table has no rows for ${sourceSpu}`);

  const planBooks = rowsFromWorkbook(input.launchPlanPath, ["大货款号", "商品编码", "款色号", "发布类目(官方)", "吊牌价"]);
  const planMatches = planBooks.flatMap(({ sheet, rows }) => selectBalabalaRows(rows, sourceSpu, ["大货款号", "商品编码", "款号"], ["款色号", "款色"]).map((row) => ({ sheet, ...row })));
  const preferredPlan = planMatches.filter((row) => row.sheet.includes("全域"));
  const selectedPlan = preferredPlan.length > 0 ? preferredPlan : planMatches;
  if (selectedPlan.length === 0) throw new Error(`launch plan has no rows for ${sourceSpu}`);
  const planRefs = await Promise.all(selectedPlan.map(({ sheet, row }) => sourceReference(input.launchPlanPath, sheet, row)));
  const launchRows = selectedPlan.map((item, index) => normalizePlanRow(item.values, planRefs[index]));

  const copyBooks = rowsFromWorkbook(input.copywritingPath, ["款号", "款色", "搜索标题", "唯品标题"]);
  const copyMatches = copyBooks.flatMap(({ sheet, rows }) => selectBalabalaRows(rows, sourceSpu, ["款号"], ["款色"]).map((row) => ({ sheet, ...row })));
  const copyRefs = await Promise.all(copyMatches.map(({ sheet, row }) => sourceReference(input.copywritingPath, sheet, row)));
  const copywritingRows = copyMatches.map((item, index) => normalizeCopyRow(item.values, copyRefs[index]));

  const sourceFiles = [input.mdmPath, input.launchPlanPath, input.copywritingPath, ...(input.shoeSizeChartPath ? [input.shoeSizeChartPath] : []), ...(input.plmSizeChartPath ? [input.plmSizeChartPath] : []), ...(input.apparelSizeReferencePath ? [input.apparelSizeReferencePath] : []), ...(input.fieldMappingsPath ? [input.fieldMappingsPath] : [])];
  const sources = await Promise.all(sourceFiles.map((path) => sourceReference(path)));
  const sizeChart = input.shoeSizeChartPath ? {
    source: "shoe_size_chart",
    sourceRef: await sourceReference(input.shoeSizeChartPath),
    rows: shoeSizeRows(input.shoeSizeChartPath).filter((row) => skus.some((sku) => text(sku.size) === text(row.size))),
  } : /鞋|靴/.test(launchRows.map(row => `${text(row.category)} ${text(row.productLine)}`).join(" ")) ? { source: "shoe_size_chart", rows: BUILTIN_SHOE_ROWS, reference: SIZE_REFERENCE_SOURCE.shoe } : undefined;
  const plmSizeChart = input.plmSizeChartPath ? {
    source: "plm_size_chart",
    sourceRef: await sourceReference(input.plmSizeChartPath),
    rows: await plmSizeRows(input.plmSizeChartPath, sourceSpu),
  } : undefined;
  const importedApparelSizeReference = input.apparelSizeReferencePath ? { ...apparelSizeReference(input.apparelSizeReferencePath), sourceRef: await sourceReference(input.apparelSizeReferencePath) } : { source: "apparel_size_reference", reference: SIZE_REFERENCE_SOURCE.apparel, rows: BUILTIN_APPAREL_ROWS.map(([size, weightKg, age, douyinWeightJin, maleTop, maleBottom, femaleTop, femaleBottom, neutralTop, neutralBottom]) => ({ size, weightKg, age, douyinWeightJin, maleTop, maleBottom, femaleTop, femaleBottom, neutralTop, neutralBottom })) };
  const configuredMappings = input.fieldMappingsPath ? await fieldMappings(input.fieldMappingsPath) : undefined;
  const images = input.imagesPath ? await imageManifest(input.imagesPath, sourceSpu) : [];
  return {
    spu,
    ...(sourceSpu !== spu ? { sourceSpu } : {}),
    sources,
    sizeReferenceVersion: SIZE_REFERENCE_SOURCE,
    skus,
    mdm: { title: text(skus[0]?.title), colors: [...new Set(skus.map((sku) => text(sku.color)).filter(Boolean))], rows: skus.map((sku) => sku.raw && typeof sku.raw === "object" && !Array.isArray(sku.raw) ? sku.raw : {}) },
    launchPlan: { ...preferredLaunchPlanRow(launchRows), rows: launchRows },
    copywriting: { rows: copywritingRows },
    ...(sizeChart ? { sizeChart } : {}),
    ...(plmSizeChart ? { plmSizeChart } : {}),
    ...(importedApparelSizeReference ? { apparelSizeReference: importedApparelSizeReference } : {}),
    ...(configuredMappings ? { fieldMappings: configuredMappings } : {}),
    images,
  };
}

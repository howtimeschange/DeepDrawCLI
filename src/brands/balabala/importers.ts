import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import XLSX from "xlsx";
import type { SourceReference } from "../../workflow/types.js";

type JsonRecord = Record<string, unknown>;
type SheetCell = { w?: unknown; v?: unknown };
export type PhysicalSheet = Record<string, SheetCell | unknown>;

export interface PhysicalRow {
  row: number;
  values: Record<string, string>;
}

export interface BalabalaImportInput {
  spu: string;
  mdmPath: string;
  launchPlanPath: string;
  copywritingPath: string;
  shoeSizeChartPath?: string;
  imagesPath?: string;
}

export interface ImportedBalabalaSources extends JsonRecord {
  spu: string;
  sources: SourceReference[];
  skus: JsonRecord[];
  mdm: JsonRecord;
  launchPlan: JsonRecord;
  copywriting: { rows: JsonRecord[] };
  sizeChart?: JsonRecord;
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

function normalizeCopyRow(values: Record<string, string>, ref: SourceReference): JsonRecord {
  return {
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
      footLength: cells.get(`H${row}`) ?? "",
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

function imageRole(path: string): string {
  const name = basename(path).toLowerCase();
  if (/洗唛|wash/.test(name)) return "washlabel";
  if (/吊牌|hangtag|tag/.test(name)) return "hangtag";
  if (/平铺|flat/.test(name) || /^\d{12,}/.test(name)) return "flat_image";
  return "reference";
}

async function imageManifest(path: string): Promise<JsonRecord[]> {
  const accepted = new Set([".jpg", ".jpeg", ".png", ".webp"]);
  const files: string[] = [];
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const item = resolve(directory, entry.name);
      if (entry.isDirectory()) await visit(item);
      else if (entry.isFile() && accepted.has(extname(entry.name).toLowerCase())) files.push(item);
    }
  };
  await visit(path);
  return Promise.all(files.sort().map(async (file) => ({
    path: file,
    role: imageRole(file),
    mimeType: extname(file).toLowerCase() === ".png" ? "image/png" : extname(file).toLowerCase() === ".webp" ? "image/webp" : "image/jpeg",
    bytes: (await stat(file)).size,
    sha256: createHash("sha256").update(await readFile(file)).digest("hex"),
  })));
}

export async function importBalabalaSources(input: BalabalaImportInput): Promise<ImportedBalabalaSources> {
  const spu = input.spu.trim();
  if (!/^\d{12,}(?:-test)?$/.test(spu)) throw new Error("balabala import requires a numeric SPU or numeric -test code");
  const mdmBooks = rowsFromWorkbook(input.mdmPath, ["款号", "SKC编码", "SKU编码", "颜色名称", "尺码名称"]);
  const mdmMatches = mdmBooks.flatMap(({ sheet, rows }) => selectBalabalaRows(rows, spu, ["款号"], ["SKC编码", "款色"]).map((row) => ({ sheet, ...row })));
  const mdmRefs = await Promise.all(mdmMatches.map(({ sheet, row }) => sourceReference(input.mdmPath, sheet, row)));
  const skus = mdmMatches.map((item, index) => normalizeMdmRow(item.values, mdmRefs[index]));
  if (skus.length === 0) throw new Error(`MDM SKU table has no rows for ${spu}`);

  const planBooks = rowsFromWorkbook(input.launchPlanPath, ["大货款号", "商品编码", "款色号", "发布类目(官方)", "吊牌价"]);
  const planMatches = planBooks.flatMap(({ sheet, rows }) => selectBalabalaRows(rows, spu, ["大货款号", "商品编码", "款号"], ["款色号", "款色"]).map((row) => ({ sheet, ...row })));
  const preferredPlan = planMatches.filter((row) => row.sheet.includes("全域"));
  const selectedPlan = preferredPlan.length > 0 ? preferredPlan : planMatches;
  if (selectedPlan.length === 0) throw new Error(`launch plan has no rows for ${spu}`);
  const planRefs = await Promise.all(selectedPlan.map(({ sheet, row }) => sourceReference(input.launchPlanPath, sheet, row)));
  const launchRows = selectedPlan.map((item, index) => normalizePlanRow(item.values, planRefs[index]));

  const copyBooks = rowsFromWorkbook(input.copywritingPath, ["款号", "款色", "搜索标题", "唯品标题"]);
  const copyMatches = copyBooks.flatMap(({ sheet, rows }) => selectBalabalaRows(rows, spu, ["款号"], ["款色"]).map((row) => ({ sheet, ...row })));
  const copyRefs = await Promise.all(copyMatches.map(({ sheet, row }) => sourceReference(input.copywritingPath, sheet, row)));
  const copywritingRows = copyMatches.map((item, index) => normalizeCopyRow(item.values, copyRefs[index]));

  const sourceFiles = [input.mdmPath, input.launchPlanPath, input.copywritingPath, ...(input.shoeSizeChartPath ? [input.shoeSizeChartPath] : [])];
  const sources = await Promise.all(sourceFiles.map((path) => sourceReference(path)));
  const sizeChart = input.shoeSizeChartPath ? {
    source: "shoe_size_chart",
    group: "sport_leisure",
    rows: shoeSizeRows(input.shoeSizeChartPath).filter((row) => skus.some((sku) => text(sku.size) === text(row.size))),
  } : undefined;
  const images = input.imagesPath ? await imageManifest(input.imagesPath) : [];
  return {
    spu,
    sources,
    skus,
    mdm: { title: text(skus[0]?.title), colors: [...new Set(skus.map((sku) => text(sku.color)).filter(Boolean))] },
    launchPlan: { ...launchRows[0], rows: launchRows },
    copywriting: { rows: copywritingRows },
    ...(sizeChart ? { sizeChart } : {}),
    images,
  };
}

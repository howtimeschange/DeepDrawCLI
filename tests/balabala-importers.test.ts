import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import XLSX from "xlsx";
import { importBalabalaSources, physicalSheetRows, selectBalabalaRows } from "../src/brands/balabala/importers.js";

test("reads physical cells beyond a false A1 worksheet dimension", () => {
  const rows = physicalSheetRows({
    "!ref": "A1",
    A1: { w: "款号" }, B1: { w: "款色" },
    A173: { w: "204426140121" }, B173: { w: "20442614012100414" },
  });
  assert.deepEqual(rows, [
    { row: 1, values: { "款号": "款号", "款色": "款色" } },
    { row: 173, values: { "款号": "204426140121", "款色": "20442614012100414" } },
  ]);
});

test("selects a formal spu and its SKC rows without accepting a prefix collision", () => {
  const rows = [
    { row: 2, values: { "款号": "204426140121", "款色": "20442614012100414" } },
    { row: 3, values: { "款号": "2044261401219", "款色": "204426140121900414" } },
  ];
  assert.deepEqual(selectBalabalaRows(rows, "204426140121", ["款号"], ["款色"]), [rows[0]]);
});

test("imports complete source rows and an apparel PLM long table for the requested SPU", async () => {
  const directory = await mkdtemp(join(tmpdir(), "deepdraw-balabala-import-"));
  const write = (name: string, rows: Record<string, string>[]) => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "数据");
    const path = join(directory, name);
    XLSX.writeFile(workbook, path);
    return path;
  };
  try {
    const mdmPath = write("mdm.xlsx", [{ 款号: "202426107129", SKC编码: "20242610712900101", SKU编码: "sku-140", 颜色名称: "粉红调", 尺码名称: "140", 挂牌单价: "299", 自定义列: "应保留" }]);
    const planPath = write("plan.xlsx", [{ 大货款号: "202426107129", 款色号: "20242610712900101", 产品线: "童装", 品类: "卫衣", 性别: "女", 吊牌价: "299", 上市时间: "2026-09-01" }]);
    const copyPath = write("copy.xlsx", [{ 款号: "202426107129", 款色: "20242610712900101", 搜索标题: "巴拉巴拉女童卫衣" }]);
    const plmPath = write("plm.xlsx", [
      { 款号: "202426107129", 测量点: "衣长", 尺码: "140", 尺码值: "54" },
      { 款号: "202426107129", 测量点: "肩宽", 尺码: "140", 尺码值: "35" },
    ]);
    const mappingsPath = join(directory, "field-mappings.json");
    await writeFile(mappingsPath, JSON.stringify([{ targetField: "自定义渠道字段", source: "launch_plan", sourceField: "销售属性" }]), "utf8");
    const imported = await importBalabalaSources({ spu: "202426107129", mdmPath, launchPlanPath: planPath, copywritingPath: copyPath, plmSizeChartPath: plmPath, fieldMappingsPath: mappingsPath });
    assert.equal(imported.skus[0]?.raw?.自定义列, "应保留");
    assert.equal(imported.plmSizeChart?.source, "plm_size_chart");
    assert.deepEqual(imported.plmSizeChart?.rows.map((row) => [row.测量点, row.尺码, row.尺码值]), [["衣长", "140cm", "54"], ["肩宽", "140cm", "35"]]);
    assert.deepEqual(imported.fieldMappings, [{ targetField: "自定义渠道字段", source: "launch_plan", sourceField: "销售属性" }]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("keeps supplied hangtag and wash-label PDFs in the auditable OCR evidence manifest", async () => {
  const directory = await mkdtemp(join(tmpdir(), "deepdraw-balabala-import-"));
  const write = (name: string, rows: Record<string, string>[]) => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "数据");
    const path = join(directory, name);
    XLSX.writeFile(workbook, path);
    return path;
  };
  try {
    const mdmPath = write("mdm.xlsx", [{ 款号: "202426107033", SKC编码: "20242610703390001", SKU编码: "sku-140", 颜色名称: "黑色", 尺码名称: "140" }]);
    const planPath = write("plan.xlsx", [{ 大货款号: "202426107033", 款色号: "20242610703390001", 产品线: "童装", 品类: "羽绒服" }]);
    const copyPath = write("copy.xlsx", [{ 款号: "202426107033", 款色: "20242610703390001", 搜索标题: "巴拉巴拉羽绒服" }]);
    const assets = join(directory, "assets");
    await mkdir(assets);
    await writeFile(join(assets, "202426107033合格证.pdf"), "%PDF-supplied-hangtag", "utf8");
    await writeFile(join(assets, "202426107033洗标.pdf"), "%PDF-supplied-washlabel", "utf8");
    const imported = await importBalabalaSources({ spu: "202426107033", mdmPath, launchPlanPath: planPath, copywritingPath: copyPath, imagesPath: assets });
    assert.deepEqual(imported.images.map((item) => [item.role, item.mimeType]), [["hangtag", "application/pdf"], ["washlabel", "application/pdf"]]);
    assert.ok(imported.images.every((item) => typeof item.sha256 === "string" && item.sha256.length === 64));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

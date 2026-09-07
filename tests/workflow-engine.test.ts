import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { BalabalaWorkflowEngine } from "../src/workflow/engine.js";
import { WorkflowStore } from "../src/workflow/store.js";

test("template sync assembles current-template fields and retains all imported MDM colors", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "deepdraw-engine-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const engine = new BalabalaWorkflowEngine(WorkflowStore.open("balabala", "204426140121", directory));
  await engine.importNormalized({
    spu: "204426140121", mdm: { title: "儿童户外鞋" },
    launchPlan: { productLine: "鞋品", category: "运动鞋", subcategory: "户外鞋", retailPrice: "359.9", launchDate: "2026-09-04", officialTrade: "童鞋>>运动鞋" },
    copywriting: { rows: [{ title: "巴拉巴拉儿童户外鞋" }] },
    skus: [{ color: "蓝色调00388", size: "26", skuCode: "a" }, { color: "白绿色调00414", size: "26", skuCode: "b" }],
    sizeChart: { source: "shoe_size_chart", rows: [{ size: "26", footLength: "15.8-16.2", sportInnerLength: "17", sportRemark: "脚长15.8-16.2/内长17" }] },
  }, []);
  const result = await engine.syncTemplate([
    { tradeId: "546", tradePath: "童鞋>>运动鞋", sites: ["Alibaba", "PDD", "Taobao", "Kuaishou"], sizeOptions: ["26"] },
  ], [{ id: "color", name: "颜色", type: "MULTI_CHOICE", saleProp: true, options: ["蓝色,蓝色调00388", "绿色,白绿色调00414"] }, { id: "size", name: "尺码", type: "MULTI_CHOICE", saleProp: true, options: ["26"] }]);
  assert.equal(result.state, "ready");
  assert.match(String(result.draft.fields?.[0]?.value_text), /蓝色调00388/);
  assert.match(String(result.draft.fields?.[0]?.value_text), /白绿色调00414/);
});

test("template sync blocks publication when a current-template field needs manual special formatting", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "deepdraw-engine-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const engine = new BalabalaWorkflowEngine(WorkflowStore.open("balabala", "204426140121-test", directory));
  await engine.importNormalized({
    spu: "204426140121-test", launchPlan: { productLine: "鞋品", category: "运动鞋", officialTrade: "童鞋>>运动鞋" },
    copywriting: { rows: [] }, skus: [],
  }, []);
  const result = await engine.syncTemplate([
    { tradeId: "546", tradePath: "童鞋>>运动鞋", sites: [] },
  ], [{ id: "manual", name: "淘宝SKU参数", type: "TEXT", required: false }]);
  assert.equal(result.state, "review_required");
  assert.equal(result.blocking[0]?.code, "manual_required_special_format");
  assert.equal(result.manual[0]?.code, "manual_required_special_format");
});

test("full-update preparation blocks non-overlapping remote SKU and incremental excludes structured fields", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "deepdraw-engine-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const engine = new BalabalaWorkflowEngine(WorkflowStore.open("balabala", "204426140121-test", directory));
  await engine.importNormalized({ spu: "204426140121-test", skus: [], launchPlan: {}, copywriting: { rows: [] } }, []);
  const snapshot = await engine.snapshot();
  await engine.replace({ ...snapshot, draft: { fields: { 商家SKU: { title: "价格", "蓝色,蓝色调00388,26码": "359" }, 尺码表: { title: "脚长", "26码": "15.8" }, 商品展示标题: "x", 颜色: "蓝色,蓝色调00388", 尺码: "26码" } } });
  const full = await engine.prepareExistingUpdate({ fields: { 商家SKU: { title: "价格", "红色,红色调1,26码": "359" } } });
  assert.equal(full.blocking[0]?.code, "sku_intersection_required");
  const incremental = await engine.buildIncremental(["商品展示标题"]);
  assert.deepEqual(Object.keys(incremental.fields).sort(), ["商品展示标题", "尺码", "颜色"]);
});

test("remote sync hydrates an existing test archive and an override keeps colors and sizes in the incremental patch", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "deepdraw-engine-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const engine = new BalabalaWorkflowEngine(WorkflowStore.open("balabala", "204426140121-test", directory));
  await engine.syncRemote({
    productId: 6515908,
    id: "ed18698170c54da4baa88541d66e3536",
    code: "204426140121-test",
    fields: [{ field: { id: "32352", name: "商品展示标题", type: "TEXT" }, texts: ["原标题"], options: [] }],
    colors: { field: { id: "2040", type: "MULTI_CHOICE" }, optionAliases: { 蓝色: "蓝色调00388" }, options: ["蓝色"] },
    sizes: { field: { id: "2398", type: "MULTI_CHOICE" }, optionAliases: { "26": "26" }, options: ["26"] },
  });
  await engine.overrideDraftField("商品展示标题", "原标题【增量测试】");
  assert.equal((await engine.snapshot()).draft.resourceId, "ed18698170c54da4baa88541d66e3536");
  const incremental = await engine.buildIncremental(["商品展示标题"]);
  assert.deepEqual(incremental.fields, { 商品展示标题: "原标题【增量测试】", 颜色: "蓝色,蓝色调00388", 尺码: "26" });
});

test("OCR review attaches the supplied PDF evidence to a current-template fact and rejects foreign fields", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "deepdraw-engine-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const engine = new BalabalaWorkflowEngine(WorkflowStore.open("balabala", "202426107033", directory));
  await engine.importNormalized({
    spu: "202426107033", launchPlan: { productLine: "童装", category: "羽绒服", officialTrade: "童装>>羽绒服" }, copywriting: { rows: [] }, skus: [],
    images: [{ path: "/tmp/202426107033合格证.pdf", sha256: "certificate", role: "hangtag", mimeType: "application/pdf" }],
  }, []);
  await engine.syncTemplate([{ tradeId: "9680", tradePath: "童装>>羽绒服", sites: [] }], [{ id: "standard", name: "执行标准", type: "TEXT", required: true }]);
  const result = await engine.auditOcr([
    { fieldId: "standard", fieldName: "执行标准", value: "Q/BALABALA 103-2021", imageSha256: "certificate", confidence: 0.97, text: "执行标准：Q/BALABALA 103-2021" },
    { fieldName: "伪造字段", value: "x", imageSha256: "certificate", confidence: 0.97, text: "x" },
  ]);
  assert.equal(result.state, "ready");
  const field = (result.audit.fields as Array<{ fieldName: string; sourceType: string; sourceRefs: Array<{ path: string; sha256: string }> }>).find((item) => item.fieldName === "执行标准");
  assert.deepEqual(field, { fieldName: "执行标准", sourceType: "ocr", sourceRefs: [{ path: "/tmp/202426107033合格证.pdf", sha256: "certificate", role: "hangtag" }], fieldId: "standard", fieldType: "TEXT", active: true, manualOverride: false, validationStatus: "valid", valueText: "Q/BALABALA 103-2021" });
  assert.equal((result.audit.ocr as { rejected: Array<{ reason: string }> }).rejected[0]?.reason, "field_not_in_current_template");
});

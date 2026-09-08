import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildBalabalaFields } from "../src/brands/balabala/fields.js";
import { buildBalabalaSizeTables } from "../src/brands/balabala/size-charts.js";
import { applyBalabalaDownFill } from "../src/brands/balabala/down-fill.js";
import { balabalaListPrice, money } from "../src/brands/balabala/prices.js";
import { buildProductPayload } from "../src/core/product-payload.js";
import { BalabalaWorkflowEngine } from "../src/workflow/engine.js";
import { createWorkflowSnapshot, WorkflowStore } from "../src/workflow/store.js";
import { assertWorkflowPublishable } from "../src/workflow/validation.js";
import { runCli } from "../src/cli/run.js";
import type { WorkflowField } from "../src/workflow/types.js";

const spu = "204426140121";
const context = { spu, launchPlan: { category: "运动鞋", productLine: "鞋品", retailPrice: "199" }, skus: [{ color: "蓝", size: "26", price: "359" }] };
const fields = [{ name: "颜色", type: "MULTI_CHOICE", options: ["蓝"], isSaleProp: true }, { name: "尺码", type: "MULTI_CHOICE", options: ["26码"], isSaleProp: true }, { name: "尺码表", type: "MULTI_TEXT", required: true, options: ["尺码", "脚长", "鞋内长"] }];

test("offline SKU prices resolve only on complete unanimity and never use launch-plan price", () => {
  assert.equal(balabalaListPrice(context), "359");
  assert.equal(balabalaListPrice({ ...context, skus: [{ price: "359.00" }, { price: "359" }] }), "359");
  for (const skus of [[], [{ price: "" }], [{ price: "359" }, { price: "299" }], [{ price: "359" }, {}]]) assert.equal(balabalaListPrice({ ...context, skus }), "");
  for (const value of ["", null, undefined, "abc", -1, 0]) assert.equal(money(value), "");
  assert.equal(money("1", -2), "");
  const built = buildBalabalaFields(context, { fields: [{ name: "零售价" }, { name: "拼多多单买价" }] });
  assert.equal(built[0]?.valueText, "359"); assert.equal(built[1]?.valueText, "358");
  const empty = buildBalabalaFields({ ...context, skus: [{ size: "26", price: "" }] }, { fields: [{ name: "零售价" }, { name: "拼多多单买价" }, { name: "拼多多团购价" }] });
  assert.deepEqual(empty.map((field) => field.valueText), ["", "", ""]);
});

test("explicit SPU fact remains distinct from per-SKU transaction price, including blank SKU fallback", () => {
  const built = buildBalabalaFields({ ...context, mdm: { price_tag: "399" }, skus: [{ color: "蓝", size: "26", price: "" }] }, { fields: [...fields, { name: "商家SKU", options: ["价格", "零售价", "拼多多单买价"] }] });
  assert.equal((built.find((field) => field.fieldName === "商家SKU")?.valueJson?.蓝 as Record<string, string>)["26码"], "399,399,398");
});

test("shoe missing source, half sizes, sandals and additional sale properties block assembly", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "balabala-safety-")); t.after(() => rm(directory, { recursive: true, force: true }));
  for (const variant of [{ ...context, sizeChart: { source: "shoe_size_chart", rows: [] } }, { ...context, skus: [{ color: "蓝", size: "26.5", price: "359" }] }, { ...context, launchPlan: { category: "凉鞋", productLine: "鞋品" } }]) {
    const engine = new BalabalaWorkflowEngine(WorkflowStore.open("balabala", spu, directory));
    await engine.importNormalized(variant, []);
    const snapshot = await engine.assemble({ ...await engine.snapshot(), template: { tradeId: "546", fields } });
    assert.equal(snapshot.state, "review_required"); assert.ok(snapshot.blocking.length);
    assert.throws(() => assertWorkflowPublishable(snapshot, "create"), /blocked/);
  }
  const missing = buildBalabalaFields(context, { fields: [{ name: "自定义销售属性", isSaleProp: true, required: false }] });
  assert.equal(missing[0]?.validationStatus, "missing");
});

test("all plan/publish stages reject outstanding blockers before fetch or Java", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "balabala-gate-")); t.after(() => rm(directory, { recursive: true, force: true }));
  const store = WorkflowStore.open("balabala", spu, directory);
  await store.write({ ...createWorkflowSnapshot("balabala", spu), state: "planned", blocking: [{ code: "missing", message: "尺码事实缺失" }], template: { fields }, draft: { code: spu, productId: "fake", tradeId: "546" } });
  let calls = 0;
  for (const stage of ["create", "full-update", "incremental"]) for (const action of ["plan", "publish"]) {
    const args = ["balabala", action, stage, "--mode", "production", "--spu", spu, "--execute", ...(action === "plan" ? ["--plan"] : ["--yes", "--plan-hash", "a".repeat(64)]), ...(stage === "incremental" ? ["--fields", "商品展示标题"] : [])];
    const result = await runCli(args, { cwd: directory, env: {}, stdin: "", fetchImpl: async () => { calls++; throw new Error("unexpected fetch"); }, javaSpawnImpl: async () => { calls++; throw new Error("unexpected Java"); } });
    assert.equal(result.exitCode, 1); assert.match(result.stderr, /尺码事实缺失/);
  }
  assert.equal(calls, 0);
});

test("shoe VIP is millimetres through the final SDK payload; main table is centimetres", () => {
  const tables = buildBalabalaSizeTables({ ...context, sizeChart: { source: "shoe_size_chart", rows: [{ size_value: "26", foot_length_mm: "160", inner_length_mm: "170" }] } }, { fields: [...fields, { name: "唯品会尺码表", type: "MULTI_TEXT", options: ["欧洲码", "脚长", "鞋内长"] }] });
  assert.equal(tables.find((field) => field.fieldName === "尺码表")?.valueJson?.["26码"], "26,16,17");
  assert.equal(tables.find((field) => field.fieldName === "唯品会尺码表")?.valueJson?.["26码"], "26,160,170");
  const result = buildProductPayload({ code: spu, productId: "fake", productType: "shoe", skus: context.skus, fields: tables.map((field) => ({ name: field.fieldName, type: field.fieldType, value: field.valueJson })) }, { stage: "update" });
  assert.equal((result.sdkInput.product.fields as Record<string, Record<string, string>>).唯品会尺码表?.["26码"], "26,160,170");
});

const field = (fieldName: string, value: string | Record<string, string>): WorkflowField => ({ fieldName, fieldType: typeof value === "string" ? "TEXT" : "MULTI_TEXT", ...(typeof value === "string" ? { valueText: value } : { valueJson: value }), sourceType: "ocr", sourceRefs: [{ path: "fixture.pdf", sha256: "fixture" }], active: true, validationStatus: "valid" });
const downFields = () => [field("充绒量文本", "140码24g;150码30g"), field("尺码表", { title: "尺码,衣长,充绒量", "140cm": "140,55,", "150cm": "150,60," }), field("唯品会尺码表", { title: "号型", "140cm": "140/68", "150cm": "150/72" }), field("抖音尺码表", { title: "身高,备注", "140cm": "140,", "150cm": "150," }), field("多平台尺码", { title: "天猫,京东,拼多多,微信视频小店,小红书,快手", "140cm": ",140,,,,", "150cm": ",150,,,," })];
const skus = [{ size: "140", color: "蓝", price: "399" }, { size: "150", color: "蓝", price: "399" }];

test("gram evidence propagates to tables and sale remarks without changing canonical SKU keys", () => {
  const input = downFields();
  const result = applyBalabalaDownFill(input, skus, [{ name: "抖音尺码表", options: ["身高", "备注"] }]);
  assert.equal(input[0]?.valueText, "140码24g;150码30g");
  assert.equal(result.fields[0]?.valueText, "24-30g");
  assert.equal(result.fields[1]?.valueJson?.["140cm"], "140,55,24");
  assert.equal(result.fields[2]?.valueJson?.["140cm（充绒量24g）"], "140/68,24");
  assert.equal(result.fields[3]?.valueJson?.title, "身高,备注");
  assert.equal(result.fields[3]?.valueJson?.["140cm"], "140,充绒量24g");
  assert.equal(result.sizeRemarks["140cm"], "充绒量24g");
  const payload = buildProductPayload({ code: spu, productId: "fake", productType: "apparel", skus, sizeRemarks: result.sizeRemarks, fields: [field("尺码", "140cm;150cm"), ...result.fields].map((item) => ({ name: item.fieldName, type: item.fieldType, value: item.valueJson ?? item.valueText })) }, { stage: "update" });
  const sent = payload.sdkInput.product.fields as Record<string, unknown>;
  assert.match(String(sent.尺码), /140cm\*充绒量24g/);
  assert.ok((sent.唯品会尺码表 as Record<string, string>)["140cm（充绒量24g）"]);
  assert.match((sent.多平台尺码 as Record<string, string>)["140cm"]!, /140cm（充绒量24g）/);
  assert.deepEqual(payload.sizes.options, ["140", "150"]);
});

test("down fill rejects missing sizes, conflicting grams, percentages and AI facts", () => {
  for (const fields of [[field("充绒量文本", "140码24g")], [field("充绒量文本", "140码24g;140码28g;150码30g")], [field("充绒量文本", "90%")], [{ ...field("充绒量文本", "140码24g;150码30g"), sourceType: "ai" as const }]]) {
    const result = applyBalabalaDownFill(fields, skus, []);
    assert.ok(result.fields.some((item) => item.validationStatus === "invalid")); assert.deepEqual(result.sizeRemarks, {});
  }
});

test("built-in shoe reference preserves original fractional millimetres and records workbook hash", () => {
  const tables = buildBalabalaSizeTables(context, { fields: [...fields, { name: "唯品会尺码表", type: "MULTI_TEXT", options: ["欧洲码", "脚长", "鞋内长"] }] });
  const vip = tables.find((f) => f.fieldName === "唯品会尺码表")!;
  assert.equal(vip.sourceRefs[0]?.sha256, "9cef3ad2be41f9dc3773d8d211c8fb99e4ce66be7babd515e5667920a68e4354");
  assert.match(String(vip.valueJson?.["26码"]), /170\.32$/);
  const payload = buildProductPayload({ productType: "shoe", code: spu, fields: tables.map(f => ({ name: f.fieldName, value: f.valueJson, type: f.fieldType })), skus: context.skus }, { stage: "update" });
  assert.match(String((payload.sdkInput.product.fields as Record<string, Record<string,string>>).唯品会尺码表?.["26码"]), /^26,.*170\.32$/);
});

test("OCR review rebuilds down-fill remarks repeatedly from retained original facts", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "balabala-down-review-")); t.after(() => rm(directory, { recursive: true, force: true }));
  const engine = new BalabalaWorkflowEngine(WorkflowStore.open("balabala", spu, directory));
  await engine.importNormalized({ spu, skus, launchPlan: { category: "羽绒服" }, images: [{ path: "tag.pdf", sha256: "tag-hash" }] }, []);
  await engine.assemble({ ...await engine.snapshot(), template: { tradeId: "9652", fields: [{ name: "充绒量文本", type: "TEXT" }] } });
  const snapshot = await engine.auditOcr([{ fieldName: "充绒量文本", value: "140码24g;150码30g", text: "140码24g;150码30g", imageSha256: "tag-hash", confidence: 0.95 }]);
  assert.deepEqual(snapshot.draft.sizeRemarks, { "140cm": "充绒量24g", "150cm": "充绒量30g" });
  const repeated = await engine.assemble();
  assert.deepEqual(repeated.draft.sizeRemarks, snapshot.draft.sizeRemarks);
  assert.deepEqual(repeated.blocking, []);
});

test("test-target rebuild selects formal PLM identities while keeping the test envelope", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "balabala-source-target-")); t.after(() => rm(directory, { recursive: true, force: true }));
  const engine = new BalabalaWorkflowEngine(WorkflowStore.open("balabala", `${spu}-test`, directory));
  await engine.importNormalized({ spu: `${spu}-test`, sourceSpu: spu, skus: [{ size: "140", color: "蓝", price: "399" }], launchPlan: { category: "羽绒服" }, plmSizeChart: { source: "plm_size_chart", rows: [{ 款号: spu, 测量点: "衣长", 尺码: "140", 尺码值: "55" }] } }, []);
  const snapshot = await engine.assemble({ ...await engine.snapshot(), template: { tradeId: "9652", fields: [{ name: "货号", type: "TEXT" }, { name: "天猫尺码表", type: "MULTI_TEXT", options: ["衣长"] }] } });
  assert.equal(snapshot.draft.code, `${spu}-test`);
  const rebuilt = snapshot.draft.fields as Array<Record<string,unknown>>;
  assert.equal(rebuilt.find(f=>f.field_name==='货号')?.value_text, spu);
  const chart=rebuilt.find(f=>f.field_name==='天猫尺码表')?.value_json as Record<string,string>;
  assert.equal(chart?.['140cm'], '55');
});

test("conflicting PLM measurements block instead of silently selecting the last row", () => {
  const fields=buildBalabalaSizeTables({spu,launchPlan:{category:'羽绒服'},skus:[{size:'140'}],plmSizeChart:{source:'plm_size_chart',rows:[{款号:spu,测量点:'肩宽',尺码:'140',尺码值:'34'},{款号:spu,测量点:'肩宽',尺码:'140',尺码值:'34.5'}]}},{fields:[{name:'尺码表',type:'MULTI_TEXT',options:['肩宽']}]});
  assert.ok(fields.some(f=>f.active && f.validationStatus==='invalid' && f.staleReason?.startsWith('plm_measurements_conflict:')));
});

test("apparel hood and trouser length are sourced, not hard-coded", () => {
  const template={fields:[{name:'是否带帽',type:'TEXT',options:['是','否']},{name:'裤长',type:'TEXT',options:['长裤','短裤']}]};
  const context={spu,launchPlan:{category:'长裤'},copywriting:{rows:[{name:'女童圆领卫衣'}]}};
  const built=buildBalabalaFields(context,template);
  assert.equal(built.find(f=>f.fieldName==='是否带帽')?.valueText,'否');
  assert.equal(built.find(f=>f.fieldName==='裤长')?.valueText,'长裤');
  const unknown=buildBalabalaFields({spu,launchPlan:{category:'卫衣'}},template);
  assert.equal(unknown.find(f=>f.fieldName==='是否带帽')?.valueText,'');
});

test("generic incremental blocks remarked sale sizes before Java or network", async () => {
  let calls=0;
  const result=await runCli(['call','dp.product.incremental.update','--execute','--yes','--param','productId=1','--json',JSON.stringify({fields:{颜色:'蓝色',尺码:'26码*脚长16',价格区间:'1,359.9'}})],{cwd:process.cwd(),env:{DEEPDRAW_TENANT_NAME:'fake',DEEPDRAW_APP_KEY:'fake',DEEPDRAW_APP_SECRET:'fake',DEEPDRAW_DOP_KEY:'fake',DEEPDRAW_MERCHANT_ID:'1162'},javaSpawnImpl:async()=>{calls++;throw Error('must not invoke Java')}});
  assert.notEqual(result.exitCode,0);assert.equal(calls,0);assert.match(result.stderr+result.stdout,/带备注的销售尺码/);
});

test("shoe template selector is not converted into an empty measurement table",()=>{
  const p=buildProductPayload({code:'204426140121-test',productId:'1',productType:'shoe',fields:[{field_name:'25鞋子尺码表',field_type:'SINGLE_CHOICE',value_text:'运动公主鞋'}]},{stage:'update'});
  assert.equal(p.sdkInput.product.fields['25鞋子尺码表'],'运动公主鞋');
});

test("plain quantity-price field uses offline SKU price and provider column delimiter",()=>{
 const built=buildBalabalaFields(context,{fields:[{name:'价格区间',type:'MULTI_TEXT'}]});
 assert.equal(built.find(x=>x.fieldName==='价格区间')?.valueText,'1,359');
});

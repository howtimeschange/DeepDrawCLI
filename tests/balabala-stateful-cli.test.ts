import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import XLSX from "xlsx";
import { runCli } from "../src/cli/run.js";
import { FakeCredentialStore } from "../src/core/credentials.js";
import { WorkflowStore, createWorkflowSnapshot } from "../src/workflow/store.js";

test("stateful test mode permits only the exact configured target before any remote dependency can run", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "deepdraw-stateful-cli-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = WorkflowStore.open("balabala", "204426140121-test", directory);
  await store.write({ ...createWorkflowSnapshot("balabala", "204426140121-test"), state: "ready", draft: {
    code: "204426140121-test", productId: "internal-id", productType: "shoe", fields: [
      { field_name: "商品展示标题", field_type: "TEXT", value_text: "测试标题" },
      { field_name: "颜色", field_type: "TEXT", value_text: "蓝色,蓝色调00388" },
      { field_name: "尺码", field_type: "MULTI_CHOICE", value_text: "26码" },
    ],
  } });
  const planned = await runCli(["balabala", "plan", "incremental", "--spu", "204426140121-test", "--fields", "商品展示标题", "--execute", "--plan"], { cwd: directory, env: {}, stdin: "" });
  assert.equal(planned.exitCode, 1);
  const plan = JSON.parse(planned.stdout);
  assert.equal(plan.plan.api, "dp.product.incremental.update");
  assert.deepEqual(Object.keys(plan.plan.sanitizedParams.body.fields).sort(), ["商品展示标题", "尺码", "颜色"]);

  let fetchCalls = 0;
  let javaCalls = 0;
  const forbiddenRemote = {
    cwd: directory,
    env: {},
    stdin: "",
    fetchImpl: async () => { fetchCalls += 1; throw new Error("blocked target must not reach fetch"); },
    javaSpawnImpl: async () => { javaCalls += 1; throw new Error("blocked target must not reach Java"); },
  };

  const blocked = await runCli(["balabala", "publish", "incremental", "--spu", "204426140121", "--fields", "商品展示标题", "--execute", "--yes"], forbiddenRemote);
  assert.equal(blocked.exitCode, 1);
  assert.match(blocked.stderr, /configured exact targetSpu/);

  const formalSync = await runCli(["balabala", "sync", "--spu", "204426140121", "--execute"], forbiddenRemote);
  assert.equal(formalSync.exitCode, 1);
  assert.match(formalSync.stderr, /configured exact targetSpu/);

  const prefixCollision = await runCli(["balabala", "sync", "--spu", "204426140122-test", "--execute"], forbiddenRemote);
  assert.equal(prefixCollision.exitCode, 1);
  assert.match(prefixCollision.stderr, /configured exact targetSpu/);

  const unapprovedTest = await runCli(["balabala", "sync", "--spu", "202426199999-test", "--execute"], forbiddenRemote);
  assert.equal(unapprovedTest.exitCode, 1);
  assert.match(unapprovedTest.stderr, /configured exact targetSpu/);
  assert.equal(fetchCalls, 0);
  assert.equal(javaCalls, 0);

  const allowedDryRun = await runCli(["balabala", "sync", "--spu", "204426140121-test"], { cwd: directory, env: {}, stdin: "" });
  assert.equal(allowedDryRun.exitCode, 0);
  assert.equal(JSON.parse(allowedDryRun.stdout).targetSpu, "204426140121-test");
});

test("production plans exactly one explicit formal target and cannot publish without a reviewed matching hash", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "deepdraw-production-cli-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const spu = "202426107128";
  const store = WorkflowStore.open("balabala", spu, directory);
  await store.write({ ...createWorkflowSnapshot("balabala", spu), state: "ready", draft: {
    code: spu, productId: "6515999", productType: "apparel", tradeId: "9680", skus: [{ skuCode: "sku-140", color: "黑色", size: "140cm" }], fields: [
      { field_name: "商品展示标题", field_type: "TEXT", value_text: "正式款标题" },
      { field_name: "颜色", field_type: "MULTI_CHOICE", value_text: "黑色,黑色" },
      { field_name: "尺码", field_type: "MULTI_CHOICE", value_text: "140cm" },
    ],
  }, template: { fields: [{ name: "商品展示标题", type: "TEXT", required: true }], tradeId: "9680", tradeDecision: { selected: { tradeId: "9680", tradePath: "童装>>男童>>羽绒服" } } } });
  let fetchCalls = 0;
  let javaCalls = 0;
  const noRemote = {
    cwd: directory,
    env: {},
    stdin: "",
    fetchImpl: async () => { fetchCalls += 1; throw new Error("production plan must not fetch"); },
    javaSpawnImpl: async () => { javaCalls += 1; throw new Error("production plan must not invoke Java"); },
  };
  const planned = await runCli(["balabala", "plan", "incremental", "--mode", "production", "--spu", spu, "--fields", "商品展示标题", "--execute", "--plan"], noRemote);
  assert.equal(planned.exitCode, 1);
  const plannedBody = JSON.parse(planned.stdout);
  assert.equal(plannedBody.plan.targetSpu, spu);
  assert.equal(plannedBody.plan.sourceSpu, spu);
  assert.equal(plannedBody.plan.userSpecifiedTargetSpu, spu);
  assert.equal(plannedBody.plan.productId, "6515999");
  assert.match(plannedBody.plan.planHash, /^[a-f0-9]{64}$/);
  assert.equal(plannedBody.plan.targetSpu.endsWith("-test"), false);
  assert.equal(fetchCalls, 0);
  assert.equal(javaCalls, 0);

  const noYes = await runCli(["balabala", "publish", "incremental", "--mode", "production", "--spu", spu, "--fields", "商品展示标题", "--execute", "--plan-hash", plannedBody.plan.planHash], noRemote);
  assert.equal(noYes.exitCode, 1);
  assert.match(noYes.stderr, /requires --execute --yes/);

  const wrongHash = await runCli(["balabala", "publish", "incremental", "--mode", "production", "--spu", spu, "--fields", "商品展示标题", "--execute", "--yes", "--plan-hash", "0".repeat(64)], noRemote);
  assert.equal(wrongHash.exitCode, 1);
  assert.match(wrongHash.stderr, /matching reviewed plan/);
  assert.equal(fetchCalls, 0);
  assert.equal(javaCalls, 0);
});

test("test config maps formal local sources to only its explicit test archive target", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "deepdraw-test-target-import-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const formal = "202426107128";
  const target = "202426107128-test";
  const spreadsheet = (name: string, rows: Record<string, string>[]) => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "资料");
    const path = join(directory, name);
    XLSX.writeFile(workbook, path);
    return path;
  };
  const mdm = spreadsheet("mdm.xlsx", [{ 款号: formal, SKC编码: `${formal}00101`, SKU编码: "sku-140", 颜色名称: "黑色", 尺码名称: "140" }]);
  const launchPlan = spreadsheet("plan.xlsx", [{ 大货款号: formal, 款色号: `${formal}00101`, 产品线: "童装", 品类: "羽绒服" }]);
  const copywriting = spreadsheet("copy.xlsx", [{ 款号: formal, 款色: `${formal}00101`, 搜索标题: "巴拉巴拉羽绒服" }]);
  const targetConfig = join(directory, "test-targets.json");
  await writeFile(targetConfig, JSON.stringify({ targets: [{ sourceSpu: formal, targetSpu: target }] }), "utf8");
  const result = await runCli([
    "balabala", "import", "--mode", "test", "--spu", target, "--test-config", targetConfig,
    "--mdm", mdm, "--launch-plan", launchPlan, "--copywriting", copywriting,
  ], { cwd: directory, env: {}, stdin: "", fetchImpl: async () => { throw new Error("import must not fetch"); }, javaSpawnImpl: async () => { throw new Error("import must not invoke Java"); } });
  assert.equal(result.exitCode, 0, result.stderr);
  const snapshot = await WorkflowStore.open("balabala", target, directory).read();
  assert.equal(snapshot?.normalized.sourceSpu, formal);
  assert.equal(snapshot?.normalized.spu, target);
  assert.equal((snapshot?.normalized.skus as unknown[])?.length, 1);
});

test("production full-update plan records category, sales facts, size-table summary and covering risk before a write", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "deepdraw-production-full-plan-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const spu = "202426107129";
  const store = WorkflowStore.open("balabala", spu, directory);
  await store.write({ ...createWorkflowSnapshot("balabala", spu), state: "ready", template: { fields: [{ name: "商品展示标题", type: "TEXT", required: true }], tradeId: "9680", tradeDecision: { selected: { tradeId: "9680", tradePath: "童装>>女童>>卫衣" } } }, draft: {
    code: spu, productId: "6516010", tradeId: "9680", title: "女童卫衣", productType: "apparel", skus: [{ skuCode: "sku-140", color: "粉红调", size: "140cm", price: "299" }], fields: [
      { field_name: "商品展示标题", field_type: "TEXT", value_text: "女童卫衣" },
      { field_name: "颜色", field_type: "MULTI_CHOICE", value_text: "粉红色,粉红调" },
      { field_name: "尺码", field_type: "MULTI_CHOICE", value_text: "140cm" },
      { field_name: "尺码表", field_type: "MULTI_TEXT", value_json: { title: "尺码,身高,体重", "140cm": "140,31" } },
    ],
  } });
  const result = await runCli(["balabala", "plan", "full-update", "--mode", "production", "--spu", spu, "--execute", "--plan"], {
    cwd: directory,
    env: { DEEPDRAW_TENANT_NAME: "电商巴拉巴拉", DEEPDRAW_APP_KEY: "app-key", DEEPDRAW_APP_SECRET: "app-secret", DEEPDRAW_DOP_KEY: "dop-key", DEEPDRAW_MERCHANT_ID: "1162", DEEPDRAW_SDK_CLASSPATH: "/tmp/fake-sdk/*" },
    stdin: "",
    javaSpawnImpl: async (command, args) => {
      if (command === "javac") return { exitCode: 0, stdout: "", stderr: "" };
      assert.equal(args[2], "DeepdrawProductResourceCli");
      return { exitCode: 0, stdout: JSON.stringify({ status: 200, response: { code: 10200, response: "success", requestId: "read-plan", body: { id: "resource-6516010", productId: "6516010", code: spu } } }), stderr: "" };
    },
  });
  assert.equal(result.exitCode, 1);
  const plan = JSON.parse(result.stdout).plan;
  assert.equal(plan.targetSpu, spu);
  assert.equal(plan.productId, "6516010");
  assert.equal(plan.trade.path, "童装>>女童>>卫衣");
  assert.equal(plan.colors, "粉红色,粉红调");
  assert.equal(plan.saleSizes, "140cm");
  assert.equal(plan.skuCount, 1);
  assert.ok(plan.sizeTables.some((item: { field: string }) => item.field === "尺码表"));
  assert.match(plan.coveringFullUpdateRisk, /covering/);
});

test("stateful override changes only an already-synced scalar field", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "deepdraw-stateful-cli-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = WorkflowStore.open("balabala", "204426140121-test", directory);
  await store.write({ ...createWorkflowSnapshot("balabala", "204426140121-test"), state: "ready", draft: {
    code: "204426140121-test", productId: "6515908", fields: [
      { field_name: "商品展示标题", field_type: "TEXT", value_text: "原标题" },
      { field_name: "颜色", field_type: "MULTI_CHOICE", value_text: "蓝色,蓝色调00388" },
      { field_name: "尺码", field_type: "MULTI_CHOICE", value_text: "26" },
    ],
  } });
  const result = await runCli(["balabala", "override", "--spu", "204426140121-test", "--field", "商品展示标题", "--value", "原标题【增量测试】"], { cwd: directory, env: {}, stdin: "" });
  assert.equal(result.exitCode, 0);
  const saved = await store.read();
  assert.equal(saved?.draft.fields?.[0]?.value_text, "原标题【增量测试】");
  const unsafe = await runCli(["balabala", "override", "--spu", "204426140121-test", "--field", "颜色", "--value", "红色,红"], { cwd: directory, env: {}, stdin: "" });
  assert.equal(unsafe.exitCode, 1);
  assert.match(unsafe.stderr, /本地覆盖不允许修改/);
});

test("stateful template --tenant selects the requested stored tenant instead of the default", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "deepdraw-stateful-cli-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = WorkflowStore.open("balabala", "202426107128", directory);
  await store.write({ ...createWorkflowSnapshot("balabala", "202426107128"), state: "imported", normalized: {
    spu: "202426107128",
    launchPlan: { productLine: "童装", category: "羽绒服", officialTrade: "童装婴幼儿服装>>男童>>羽绒服" },
    copywriting: { rows: [] },
    skus: [{ color: "蓝色调00388", size: "140", price: "299" }],
  } });
  const configPath = join(directory, "deepdraw-config.json");
  await writeFile(configPath, JSON.stringify({
    defaultTenant: "wrong-default",
    tenants: {
      "wrong-default": { merchantId: "1162", appKeyRef: "wrong-key", appSecretRef: "wrong-secret", dopKeyRef: "wrong-dop" },
      "电商巴拉巴拉": { merchantId: "1162", appKeyRef: "balabala-key", appSecretRef: "balabala-secret", dopKeyRef: "balabala-dop" },
    },
  }), "utf8");
  const seenKeys: string[] = [];
  const seenRequests: Array<{ type: string | null; merchantId: string | null; tradeId: string | null }> = [];
  const result = await runCli([
    "balabala", "template", "--mode", "production", "--spu", "202426107128", "--tenant", "电商巴拉巴拉", "--execute",
  ], {
    cwd: directory,
    env: {},
    stdin: "",
    configPath,
    credentialStore: new FakeCredentialStore({
      "wrong-key": "wrong-app-key", "wrong-secret": "wrong-app-secret", "wrong-dop": "wrong-dop-key",
      "balabala-key": "balabala-app-key", "balabala-secret": "balabala-app-secret", "balabala-dop": "balabala-dop-key",
    }),
    fetchImpl: async (url, init) => {
      seenKeys.push(String(new Headers(init?.headers).get("x-ca-key")));
      const requestUrl = new URL(String(url));
      const type = requestUrl.searchParams.get("type");
      seenRequests.push({ type, merchantId: requestUrl.searchParams.get("merchantId"), tradeId: requestUrl.searchParams.get("tradeId") });
      const body = type === "dp.merchant.trades"
        ? [{ id: "9680", name: "羽绒服", tradePath: "童装婴幼儿服装>>男童>>羽绒服" }]
        : [{ id: "color", name: "颜色", type: "MULTI_CHOICE", isSaleProp: true, options: ["蓝色,蓝色调00388"] }, { id: "size", name: "尺码", type: "MULTI_CHOICE", isSaleProp: true, options: ["140cm"] }];
      return new Response(JSON.stringify({ status: 200, response: { code: 10200, response: "success", body } }), { status: 200 });
    },
  });
  assert.equal(result.exitCode, 0);
  assert.deepEqual(seenKeys, ["balabala-app-key", "balabala-app-key"]);
  assert.deepEqual(seenRequests, [
    { type: "dp.merchant.trades", merchantId: "1162", tradeId: null },
    { type: "dp.trade.fields", merchantId: "1162", tradeId: "9680" },
  ]);
});

test("stateful full-update sends the post-readback merged payload, including remote fields retained for a covering update", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "deepdraw-stateful-cli-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = WorkflowStore.open("balabala", "204426140121-test", directory);
  await store.write({ ...createWorkflowSnapshot("balabala", "204426140121-test"), state: "ready", draft: {
    code: "204426140121-test", productId: "6515908", productType: "shoe", retailPrice: "359.9", date: "2026-09-07",
    fields: [
      { field_id: "title", field_name: "商品展示标题", field_type: "TEXT", value_text: "本地标题" },
      { field_id: "color", field_name: "颜色", field_type: "MULTI_CHOICE", value_text: "蓝色,蓝色调00388" },
      { field_id: "size", field_name: "尺码", field_type: "MULTI_CHOICE", value_text: "26" },
      { field_id: "merchant-sku", field_name: "商家SKU", field_type: "MULTI_TEXT", value_json: { title: "价格", "蓝色调00388": { "26码": "359.9" } } },
    ],
    templateFields: [
      { field_id: "title", field_name: "商品展示标题", field_type: "TEXT" },
      { field_id: "color", field_name: "颜色", field_type: "MULTI_CHOICE", sale_prop: true, options: ["蓝色,蓝色调00388"] },
      { field_id: "size", field_name: "尺码", field_type: "MULTI_CHOICE", sale_prop: true, options: ["26"] },
      { field_id: "merchant-sku", field_name: "商家SKU", field_type: "MULTI_TEXT" },
      { field_id: "retained", field_name: "远端保留字段", field_type: "TEXT" },
    ],
    skus: [{ color: "蓝色调00388", size: "26", skuCode: "sku-26", sellerCode: "seller-26", price: "359.9" }],
  } });
  const calls: Array<{ className: string; input: Record<string, unknown> }> = [];
  const result = await runCli([
    "balabala", "publish", "full-update", "--spu", "204426140121-test", "--execute", "--yes",
  ], {
    cwd: directory,
    env: {
      DEEPDRAW_TENANT_NAME: "电商巴拉巴拉", DEEPDRAW_APP_KEY: "app-key", DEEPDRAW_APP_SECRET: "app-secret", DEEPDRAW_DOP_KEY: "dop-key", DEEPDRAW_MERCHANT_ID: "1162", DEEPDRAW_SDK_CLASSPATH: "/tmp/fake-sdk/*",
    },
    stdin: "",
    javaSpawnImpl: async (command, args, input) => {
      if (command === "javac") return { exitCode: 0, stdout: "", stderr: "" };
      const className = args[2]!;
      calls.push({ className, input: JSON.parse(input) as Record<string, unknown> });
      if (className === "DeepdrawProductResourceCli") {
        return { exitCode: 0, stdout: JSON.stringify({ status: 200, response: { code: 10200, response: "success", requestId: "read-6515908", body: {
          id: "resource-6515908", productId: "6515908", code: "204426140121-test", title: "", retailPrice: "359.9", fields: [
            { field: { id: "title", name: "商品展示标题", type: "TEXT" }, texts: ["本地标题"] },
            { field: { id: "retained", name: "远端保留字段", type: "TEXT" }, texts: ["仅远端已有值"] },
            { field: { id: "merchant-sku", name: "商家SKU", type: "MULTI_TEXT" }, value_json: { title: "价格", "蓝色调00388": { "26码": "359.9" } } },
          ],
          colors: { field: { id: "color", type: "MULTI_CHOICE" }, options: ["蓝色"], optionAliases: { 蓝色: "蓝色调00388" } },
          sizes: { field: { id: "size", type: "MULTI_CHOICE" }, options: ["26"], optionAliases: {"26":"26码"} },
        } } }), stderr: "" };
      }
      if (className === "DeepdrawProductUpdateCli") return { exitCode: 0, stdout: JSON.stringify({ status: 200, response: { code: 10200, response: "success", requestId: "write-6515908", body: { productId: "6515908" } } }), stderr: "" };
      throw new Error(`unexpected Java class ${className}`);
    },
  });
  assert.equal(result.exitCode, 0, `${result.stderr}${result.stdout}`);
  assert.deepEqual(calls.map((call) => call.className), ["DeepdrawProductResourceCli", "DeepdrawProductUpdateCli", "DeepdrawProductResourceCli"]);
  const update = calls[1]!.input as { product: { fields: Record<string, unknown> } };
  assert.equal(update.product.fields.远端保留字段, "仅远端已有值");
  assert.equal(update.product.fields.商品展示标题, "本地标题");
  const audited = await store.read();
  const updateExecution = audited?.executions.find((entry) => entry.operation === "full-update");
  assert.equal(updateExecution?.requestId, "write-6515908");
  assert.equal(updateExecution?.details?.mode, "test");
  assert.equal(updateExecution?.details?.sourceSpu, "204426140121");
  assert.equal(updateExecution?.details?.targetSpu, "204426140121-test");
  assert.match(String(updateExecution?.details?.planHash), /^[a-f0-9]{64}$/);
  const readback = audited?.readbacks.at(-1) as { comparison?: { status?: string }; operation?: { targetSpu?: string } } | undefined;
  assert.equal(readback?.operation?.targetSpu, "204426140121-test");
  assert.equal(readback?.comparison?.status, "needs_ui_verification");
  assert.ok(audited?.manual.some(item => item.message.includes("多平台尺码")));
});

test("a reviewed production create performs form merge, required full-update, and final readback", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "deepdraw-production-create-chain-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const spu = "202426121024";
  const store = WorkflowStore.open("balabala", spu, directory);
  const draft = {
    code: spu, title: "巴拉巴拉女童卫衣", tradeId: "9652", productType: "apparel", retailPrice: "299", date: "2026-09-04",
    skus: [{ skuCode: "sku-140", sellerCode: "seller-140", color: "米白10302", size: "140", price: "299" }],
    fields: [
      { field_name: "商品展示标题", field_type: "TEXT", value_text: "巴拉巴拉女童卫衣" },
      { field_name: "颜色", field_type: "MULTI_CHOICE", value_text: "白色,米白10302" },
      { field_name: "尺码", field_type: "MULTI_CHOICE", value_text: "140cm" },
    ],
  };
  await store.write({ ...createWorkflowSnapshot("balabala", spu), state: "ready", draft, template: { fields: [{ name: "商品展示标题", type: "TEXT", required: true }], tradeId: "9652", tradeDecision: { selected: { tradeId: "9652", tradePath: "童装婴幼儿服装>>中大童>>卫衣" } } } });
  const environment = { DEEPDRAW_TENANT_NAME: "电商巴拉巴拉", DEEPDRAW_APP_KEY: "app-key", DEEPDRAW_APP_SECRET: "app-secret", DEEPDRAW_DOP_KEY: "dop-key", DEEPDRAW_MERCHANT_ID: "1162", DEEPDRAW_SDK_CLASSPATH: "/tmp/fake-sdk/*" };
  const plan = await runCli(["balabala", "plan", "create", "--mode", "production", "--spu", spu, "--execute", "--plan"], { cwd: directory, env: environment, stdin: "" });
  const planBody = JSON.parse(plan.stdout);
  assert.equal(planBody.plan.postCreateFullUpdate.required, true);
  const calls: string[] = [];
  const result = await runCli(["balabala", "publish", "create", "--mode", "production", "--spu", spu, "--execute", "--yes", "--plan-hash", planBody.plan.planHash], {
    cwd: directory, env: environment, stdin: "",
    javaSpawnImpl: async (command, args) => {
      if (command === "javac") return { exitCode: 0, stdout: "", stderr: "" };
      const className = args[2]!;
      calls.push(className);
      if (className === "DeepdrawProductCreateCli") return { exitCode: 0, stdout: JSON.stringify({ status: 200, response: { code: 10200, response: "success", requestId: "create", body: { productId: "6517001" } } }), stderr: "" };
      if (className === "DeepdrawProductUpdateCli") return { exitCode: 0, stdout: JSON.stringify({ status: 200, response: { code: 10200, response: "success", requestId: "update", body: { productId: "6517001" } } }), stderr: "" };
      if (className === "DeepdrawProductResourceCli") return { exitCode: 0, stdout: JSON.stringify({ status: 200, response: { code: 10200, response: "success", requestId: `resource-${calls.length}`, body: {
        id: "resource-6517001", productId: "6517001", code: spu, title: draft.title, retailPrice: draft.retailPrice,
        fields: [
          { field: { name: "商品展示标题", type: "TEXT" }, texts: ["巴拉巴拉女童卫衣"] },
          { field: { name: "商家SKU", type: "MULTI_TEXT" }, value_json: { title: "价格", "米白10302": { "140cm": "299" } } },
        ],
        colors: { field: { type: "MULTI_CHOICE" }, options: ["白色"], optionAliases: { 白色: "米白10302" } },
        sizes: { field: { type: "MULTI_CHOICE" }, options: ["140cm"] },
      } } }), stderr: "" };
      throw new Error(`unexpected ${className}`);
    },
  });
  assert.equal(result.exitCode, 0, `${result.stderr}${result.stdout}`);
  assert.deepEqual(calls, ["DeepdrawProductCreateCli", "DeepdrawProductResourceCli", "DeepdrawProductUpdateCli", "DeepdrawProductResourceCli"]);
  const saved = await store.read();
  assert.ok(saved?.executions.some((entry) => entry.operation === "post-create-full-update"));
  assert.equal(saved?.state, "needs_ui_verification");
  assert.ok(saved?.manual.some(item => item.message.includes("多平台尺码")));
});

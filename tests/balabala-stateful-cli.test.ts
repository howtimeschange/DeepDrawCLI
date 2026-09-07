import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { runCli } from "../src/cli/run.js";
import { FakeCredentialStore } from "../src/core/credentials.js";
import { WorkflowStore, createWorkflowSnapshot } from "../src/workflow/store.js";

test("stateful plan carries colors and sizes while the write boundary rejects formal SPUs", async (t) => {
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

  const blocked = await runCli(["balabala", "publish", "incremental", "--spu", "204426140121", "--fields", "商品展示标题", "--execute", "--yes"], { cwd: directory, env: {}, stdin: "" });
  assert.equal(blocked.exitCode, 1);
  assert.match(blocked.stderr, /only permitted for configured test code/);

  const formalSync = await runCli(["balabala", "sync", "--spu", "204426140121", "--execute"], {
    cwd: directory, env: {}, stdin: "",
    fetchImpl: async () => { throw new Error("formal product sync must never reach DeepDraw"); },
    javaSpawnImpl: async () => { throw new Error("formal product sync must never reach Java"); },
  });
  assert.equal(formalSync.exitCode, 1);
  assert.match(formalSync.stderr, /sync is only permitted for configured test code/);
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
    skus: [{ color: "蓝色调00388", size: "140" }],
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
  const result = await runCli([
    "balabala", "template", "--spu", "202426107128", "--tenant", "电商巴拉巴拉", "--execute",
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
      const type = new URL(String(url)).searchParams.get("type");
      const body = type === "dp.merchant.trades"
        ? [{ id: "9680", name: "羽绒服", tradePath: "童装婴幼儿服装>>男童>>羽绒服" }]
        : [{ id: "color", name: "颜色", type: "MULTI_CHOICE", isSaleProp: true, options: ["蓝色,蓝色调00388"] }, { id: "size", name: "尺码", type: "MULTI_CHOICE", isSaleProp: true, options: ["140cm"] }];
      return new Response(JSON.stringify({ status: 200, response: { code: 10200, response: "success", body } }), { status: 200 });
    },
  });
  assert.equal(result.exitCode, 0);
  assert.deepEqual(seenKeys, ["balabala-app-key", "balabala-app-key"]);
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
        return { exitCode: 0, stdout: JSON.stringify({ status: 200, response: { code: 10200, response: "success", body: {
          id: "resource-6515908", productId: "6515908", code: "204426140121-test", fields: [
            { field: { id: "title", name: "商品展示标题", type: "TEXT" }, texts: ["本地标题"] },
            { field: { id: "retained", name: "远端保留字段", type: "TEXT" }, texts: ["仅远端已有值"] },
            { field: { id: "merchant-sku", name: "商家SKU", type: "MULTI_TEXT" }, value_json: { title: "价格", "蓝色调00388": { "26码": "359.9" } } },
          ],
          colors: { field: { id: "color", type: "MULTI_CHOICE" }, options: ["蓝色"], optionAliases: { 蓝色: "蓝色调00388" } },
          sizes: { field: { id: "size", type: "MULTI_CHOICE" }, options: ["26"] },
        } } }), stderr: "" };
      }
      if (className === "DeepdrawProductUpdateCli") return { exitCode: 0, stdout: JSON.stringify({ status: 200, response: { code: 10200, response: "success", body: { productId: "6515908" } } }), stderr: "" };
      throw new Error(`unexpected Java class ${className}`);
    },
  });
  assert.equal(result.exitCode, 0, `${result.stderr}${result.stdout}`);
  assert.deepEqual(calls.map((call) => call.className), ["DeepdrawProductResourceCli", "DeepdrawProductUpdateCli", "DeepdrawProductResourceCli"]);
  const update = calls[1]!.input as { product: { fields: Record<string, unknown> } };
  assert.equal(update.product.fields.远端保留字段, "仅远端已有值");
  assert.equal(update.product.fields.商品展示标题, "本地标题");
});

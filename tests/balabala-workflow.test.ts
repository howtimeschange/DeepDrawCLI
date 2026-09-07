import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { runCli } from "../src/cli/run.js";

const draft = {
  code: "204426140121-workflow",
  title: "巴拉巴拉儿童运动鞋",
  tradeId: "546",
  productId: "6518125",
  productType: "shoe",
  retailPrice: 359.9,
  date: "2026-09-07",
  fields: [
    { field_name: "颜色", field_type: "TEXT", value_text: "蓝色,蓝色调00388" },
    { field_name: "尺码", field_type: "MULTI_CHOICE", value_text: "26" },
    {
      field_name: "尺码表",
      field_type: "MULTI_TEXT",
      value_json: { title: "尺码,脚长,鞋内长", "26": "26,15.8,17" },
    },
    {
      field_name: "唯品会尺码表",
      field_type: "MULTI_TEXT",
      value_json: { title: "欧洲码,脚长,鞋内长", "26": "26,15.8,17" },
    },
  ],
  templateFields: [
    { field_id: "color", field_name: "颜色", field_type: "TEXT", sale_prop: true },
    { field_id: "size", field_name: "尺码", field_type: "MULTI_CHOICE", sale_prop: true, options_json: ["26"] },
    { field_id: "chart", field_name: "尺码表", field_type: "MULTI_TEXT" },
    { field_id: "vip-chart", field_name: "唯品会尺码表", field_type: "MULTI_TEXT" },
    { field_id: "tmall-chart", field_name: "天猫尺码表", field_type: "MULTI_TEXT" },
    { field_id: "douyin-chart", field_name: "抖音尺码表", field_type: "MULTI_TEXT" },
    { field_id: "multi-chart", field_name: "多平台尺码", field_type: "MULTI_TEXT" },
    { field_id: "merchant-sku", field_name: "商家SKU", field_type: "MULTI_TEXT" },
  ],
  sizeChart: {
    source: "shoe_size_chart",
    rows: [{ size: "26", footLength: "15.8", innerLength: "17" }],
  },
  skus: [
    {
      skuCode: "sku-26",
      skcCode: "skc-00388",
      color: "蓝色调00388",
      size: "26",
      sellerCode: "seller-26",
      price: 359.9,
    },
  ],
};

const credentials = {
  DEEPDRAW_TENANT_NAME: "电商巴拉巴拉",
  DEEPDRAW_BASE_URL: "http://open.deepdraw.cn",
  DEEPDRAW_APP_KEY: "app-key",
  DEEPDRAW_APP_SECRET: "app-secret",
  DEEPDRAW_DOP_KEY: "dop-key",
  DEEPDRAW_MERCHANT_ID: "9999",
  DEEPDRAW_SDK_CLASSPATH: "/tmp/fake-sdk/*",
};

async function withDraft<T>(fn: (directory: string) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "deepdraw-balabala-workflow-"));
  try {
    await writeFile(join(directory, "draft.json"), JSON.stringify(draft), "utf8");
    return await fn(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("Balabala workflow labels dry-run query with the Listingify resource-form lookup", async () => {
  const result = await runCli([
    "balabala",
    "query",
    "--product-code",
    draft.code,
  ], {
    env: {},
    stdin: "",
    fetchImpl: async () => {
      throw new Error("workflow query must stay dry-run without --execute");
    },
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: true,
    workflow: "balabala-listing",
    action: "query",
    api: "dp.product.resource",
    dryRun: true,
    query: {
      merchantId: "1162",
      productCode: draft.code,
      resource: "form",
    },
  });
});

test("Balabala review is local, requires the current template, and returns the AI-safe field decisions", async () => {
  await withDraft(async (directory) => {
    let fetched = false;
    const result = await runCli([
      "balabala",
      "review",
      "--input",
      "draft.json",
    ], {
      cwd: directory,
      env: {},
      stdin: "",
      fetchImpl: async () => {
        fetched = true;
        throw new Error("review must remain local");
      },
    });

    assert.equal(result.exitCode, 0);
    assert.equal(result.stderr, "");
    assert.equal(fetched, false);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.workflow, "balabala-listing");
    assert.equal(payload.action, "review");
    assert.equal(payload.ok, true);
    assert.deepEqual(payload.activeTemplateFieldNames, draft.templateFields.map((field) => field.field_name));
    assert.ok(payload.inputContract.ai.forbidden.includes("价格"));
  });
});

test("Balabala plans preserve review filtering when the draft is wrapped in product", async () => {
  const wrapped = {
    product: {
      ...draft,
      fields: [
        ...draft.fields,
        { field_name: "旧类目遗留字段", field_type: "TEXT", value_text: "不得提交" },
      ],
    },
  };
  const result = await runCli([
    "balabala",
    "create",
    "--json",
    JSON.stringify(wrapped),
    "--execute",
    "--plan",
  ], {
    env: {},
    stdin: "",
    fetchImpl: async () => {
      throw new Error("a planned create must not fetch");
    },
    javaSpawnImpl: async () => {
      throw new Error("a planned create must not start Java");
    },
  });

  assert.equal(result.exitCode, 1);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.error.kind, "approval_required");
  assert.equal(Object.hasOwn(payload.plan.sanitizedParams.body.fields, "旧类目遗留字段"), false);
});

test("Balabala workflow produces a full-update approval plan from the assembled payload", async () => {
  await withDraft(async (directory) => {
    const result = await runCli([
      "balabala",
      "full-update",
      "--input",
      "draft.json",
      "--execute",
      "--plan",
    ], {
      cwd: directory,
      env: {},
      stdin: "",
      fetchImpl: async () => {
        throw new Error("a planned full update must not fetch");
      },
      javaSpawnImpl: async () => {
        throw new Error("a planned full update must not start Java");
      },
    });

    assert.equal(result.exitCode, 1);
    assert.equal(result.stderr, "");
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.workflow, "balabala-listing");
    assert.equal(payload.action, "full-update");
    assert.equal(payload.error.kind, "approval_required");
    assert.equal(payload.error.reason, "plan_requested");
    assert.equal(payload.plan.api, "dp.product.update");
    assert.equal(payload.plan.tenant, "电商巴拉巴拉");
    assert.deepEqual(payload.plan.sanitizedParams.query, { productId: "6518125" });
    assert.match(JSON.stringify(payload.plan.sanitizedParams.body), /唯品会尺码表/);
  });
});

test("Balabala workflow creates through the assembled SDK entity after explicit approval", async () => {
  await withDraft(async (directory) => {
    let javaInput: unknown;
    const result = await runCli([
      "balabala",
      "create",
      "--input",
      "draft.json",
      "--execute",
      "--yes",
    ], {
      cwd: directory,
      env: credentials,
      stdin: "",
      fetchImpl: async () => {
        throw new Error("Balabala create must use the Java SDK bridge");
      },
      javaSpawnImpl: async (command, args, input) => {
        if (command === "javac") return { exitCode: 0, stdout: "", stderr: "" };
        assert.equal(command, "java");
        assert.equal(args[2], "DeepdrawProductCreateCli");
        javaInput = JSON.parse(input) as unknown;
        return {
          exitCode: 0,
          stdout: '{"status":200,"response":{"code":10200,"response":"success","body":{"productId":7788}}}',
          stderr: "",
        };
      },
    });

    assert.equal(result.exitCode, 0);
    assert.equal(result.stderr, "");
    const assembledInput = javaInput as {
      config: Record<string, unknown>;
      query: Record<string, unknown>;
      product: { code: string; fields: Record<string, unknown> };
    };
    assert.equal(assembledInput.config.merchantId, "1162");
    assert.equal(assembledInput.config.tradeId, "546");
    assert.deepEqual(assembledInput.query, { merchantId: "1162", tradeId: "546" });
    assert.equal(assembledInput.product.code, draft.code);
    assert.equal(assembledInput.product.fields["尺码"], "26码");
    assert.deepEqual(assembledInput.product.fields["尺码表"], {
      title: "脚长,鞋内长",
      "26码": "15.8,17",
    });
    assert.deepEqual(assembledInput.product.fields["多平台尺码"], {
      title: "天猫,京东,拼多多,微信视频小店,小红书,快手",
      "26码": ",26,,,,",
    });
    assert.ok(Object.hasOwn(assembledInput.product.fields, "商家SKU"));
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.workflow, "balabala-listing");
    assert.equal(payload.action, "create");
    assert.equal(payload.ok, true);
    assert.deepEqual(payload.data, { productId: 7788 });
  });
});

test("Balabala workflow sends selected scalar increment fields with colors and sizes after approval", async () => {
  await withDraft(async (directory) => {
    const plan = await runCli([
      "balabala",
      "incremental",
      "--input",
      "draft.json",
      "--fields",
      "颜色",
      "--execute",
      "--plan",
    ], {
      cwd: directory,
      env: {},
      stdin: "",
    });
    assert.equal(plan.exitCode, 1);
    const planned = JSON.parse(plan.stdout);
    assert.equal(planned.workflow, "balabala-listing");
    assert.equal(planned.action, "incremental");
    assert.equal(planned.plan.api, "dp.product.incremental.update");
    assert.deepEqual(Object.keys(planned.plan.sanitizedParams.body.fields).sort(), ["尺码", "颜色"]);

    let javaInput: unknown;
    const execute = await runCli([
      "balabala",
      "incremental",
      "--input",
      "draft.json",
      "--fields",
      "颜色",
      "--execute",
      "--yes",
    ], {
      cwd: directory,
      env: credentials,
      stdin: "",
      javaSpawnImpl: async (command, args, input) => {
        if (command === "javac") return { exitCode: 0, stdout: "", stderr: "" };
        assert.equal(command, "java");
        assert.equal(args[2], "DeepdrawProductIncrementalUpdateCli");
        javaInput = JSON.parse(input) as unknown;
        return {
          exitCode: 0,
          stdout: '{"status":200,"response":{"code":10200,"response":"success","body":{"id":"test-id","updates":["颜色","尺码"]}}}',
          stderr: "",
        };
      },
    });
    assert.equal(execute.exitCode, 0);
    assert.equal(execute.stderr, "");
    const input = javaInput as { product: { fields: Record<string, unknown> } };
    assert.deepEqual(Object.keys(input.product.fields).sort(), ["尺码", "颜色"]);
    assert.equal(input.product.fields.颜色, "蓝色,蓝色调00388");
    assert.equal(input.product.fields.尺码, "26码");
  });
});

test("Balabala incremental rejects size tables, merchant SKU, and multi-platform sizes", async () => {
  await withDraft(async (directory) => {
    const result = await runCli([
      "balabala",
      "incremental",
      "--input",
      "draft.json",
      "--fields",
      "尺码表",
      "--execute",
      "--plan",
    ], { cwd: directory, env: {}, stdin: "" });

    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /尺码表.*全量更新/);
  });
});

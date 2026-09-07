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
  fields: [
    { field_name: "颜色", field_type: "TEXT", value_text: "蓝色,蓝色调00388" },
    { field_name: "尺码", field_type: "MULTI_CHOICE", value_text: "26" },
  ],
  templateFields: [
    { field_id: "color", field_name: "颜色", field_type: "TEXT", sale_prop: true },
    { field_id: "size", field_name: "尺码", field_type: "MULTI_CHOICE", sale_prop: true, options_json: ["26"] },
  ],
  skus: [{ skuCode: "sku-26", color: "蓝色调00388", size: "26", price: 359.9 }],
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

test("legacy remote balabala commands are disabled before fetch or Java can bypass stateful target policy", async () => {
  await withDraft(async (directory) => {
    let fetchCalls = 0;
    let javaCalls = 0;
    for (const argv of [
      ["balabala", "query", "--product-code", draft.code, "--execute"],
      ["balabala", "create", "--input", "draft.json", "--execute", "--yes"],
      ["balabala", "full-update", "--input", "draft.json", "--execute", "--yes"],
      ["balabala", "incremental", "--input", "draft.json", "--fields", "颜色", "--execute", "--yes"],
    ]) {
      const result = await runCli(argv, {
        cwd: directory,
        env: {},
        stdin: "",
        fetchImpl: async () => { fetchCalls += 1; throw new Error("legacy route must not fetch"); },
        javaSpawnImpl: async () => { javaCalls += 1; throw new Error("legacy route must not invoke Java"); },
      });
      assert.equal(result.exitCode, 1);
      assert.match(result.stderr, /Remote balabala compatibility commands are disabled/);
    }
    assert.equal(fetchCalls, 0);
    assert.equal(javaCalls, 0);
  });
});

test("legacy Balabala review remains local and continues to validate source and template facts", async () => {
  await withDraft(async (directory) => {
    let fetched = false;
    const result = await runCli(["balabala", "review", "--input", "draft.json"], {
      cwd: directory,
      env: {},
      stdin: "",
      fetchImpl: async () => { fetched = true; throw new Error("review must remain local"); },
    });
    assert.equal(result.exitCode, 1);
    assert.equal(fetched, false);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.workflow, "balabala-listing");
    assert.equal(payload.action, "review");
    assert.equal(payload.ok, false);
    assert.ok(payload.inputContract.ai.forbidden.includes("价格"));
  });
});

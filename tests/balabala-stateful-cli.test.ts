import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { runCli } from "../src/cli/run.js";
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

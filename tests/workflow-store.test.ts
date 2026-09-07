import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { WorkflowStore, createWorkflowSnapshot } from "../src/workflow/store.js";

test("workflow store persists source fingerprints and redacts secret-shaped fields", async (t) => {
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const directory = await mkdtemp(join(tmpdir(), "deepdraw-workflow-store-"));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const store = WorkflowStore.open("balabala", "204426140121", directory);
  const snapshot = createWorkflowSnapshot("balabala", "204426140121");
  await store.write({
    ...snapshot,
    sources: [{ path: "/tmp/sku.xlsx", sha256: "abc", appSecret: "not-allowed" }],
    audit: { dopKey: "not-allowed", accepted: [] },
  });

  const path = join(directory, ".deepdraw-workflows", "balabala", "204426140121", "state.json");
  const raw = await readFile(path, "utf8");
  assert.equal(raw.includes("not-allowed"), false);
  assert.equal((await store.read())?.state, "imported");
  assert.equal((await store.read())?.sources[0]?.sha256, "abc");
});

test("workflow store records execution without mutating the snapshot", async (t) => {
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const directory = await mkdtemp(join(tmpdir(), "deepdraw-workflow-store-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = WorkflowStore.open("balabala", "204426140121", directory);
  await store.write(createWorkflowSnapshot("balabala", "204426140121"));
  const record = await store.recordExecution({ operation: "template-sync", status: "verified", requestId: "safe-id" });
  assert.equal(record.operation, "template-sync");
  assert.equal((await store.read())?.state, "imported");
});

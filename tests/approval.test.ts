import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createExecutionPlan, enforceApproval } from "../src/core/approval.js";
import { writeExecutionPlan } from "../src/core/plan-store.js";

test("enforceApproval allows APIs that do not require approval", () => {
  assert.deepEqual(enforceApproval({
    apiName: "dp.colors.get",
    argv: [],
    interactive: false,
  }), {
    allowed: true,
    reason: null,
  });
});

test("enforceApproval rejects unknown APIs", () => {
  assert.deepEqual(enforceApproval({
    apiName: "dp.unknown",
    argv: [],
    interactive: false,
  }), {
    allowed: false,
    reason: "Unknown DeepDraw API: dp.unknown",
  });
});

test("enforceApproval requires approval for write and paid APIs", () => {
  assert.deepEqual(enforceApproval({
    apiName: "dp.product.create",
    argv: [],
    interactive: false,
  }), {
    allowed: false,
    reason: "approval_required",
  });

  assert.deepEqual(enforceApproval({
    apiName: "dp.product.retrieve.image",
    argv: [],
    interactive: false,
  }), {
    allowed: false,
    reason: "approval_required",
  });
});

test("enforceApproval allows risky APIs with explicit yes", () => {
  assert.deepEqual(enforceApproval({
    apiName: "dp.product.search",
    argv: ["--yes"],
    interactive: false,
  }), {
    allowed: true,
    reason: null,
  });
});

test("enforceApproval returns plan_requested for explicit plan requests", () => {
  assert.deepEqual(enforceApproval({
    apiName: "dp.product.search",
    argv: ["--yes", "--plan"],
    interactive: false,
  }), {
    allowed: false,
    reason: "plan_requested",
  });
});

test("createExecutionPlan returns a sanitized stable summary", () => {
  const plan = createExecutionPlan({
    apiName: "dp.product.create",
    tenant: "demo",
    params: {
      query: { merchantId: "1162", appSecret: "secret" },
      body: { product: { name: "shirt", token: "private-token" } },
    },
  });

  assert.equal(plan.api, "dp.product.create");
  assert.equal(plan.tenant, "demo");
  assert.equal(plan.riskLevel, "write");
  assert.equal(plan.requiresApproval, true);
  assert.equal(plan.summary, "创建产品 (dp.product.create)");
  assert.match(plan.id, /^\d+-dp-product-create$/);
  assert.match(plan.createdAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(plan.sanitizedParams, {
    query: { merchantId: "1162", appSecret: "[REDACTED]" },
    body: { product: { name: "shirt", token: "[REDACTED]" } },
  });
});

test("createExecutionPlan does not leak auth keys or signature aliases", () => {
  const rawSecrets = [
    "raw-app-key",
    "raw-snake-app-key",
    "raw-api-key",
    "raw-dop-key",
    "raw-kebab-signature",
    "raw-camel-signature",
    "raw-snake-signature",
    "raw-authorization",
    "raw-nested-authorization",
  ];
  const plan = createExecutionPlan({
    apiName: "dp.product.search",
    tenant: "demo",
    params: {
      query: {
        appKey: rawSecrets[0],
        app_key: rawSecrets[1],
        apiKey: rawSecrets[2],
        dopKey: rawSecrets[3],
        "x-ca-signature": rawSecrets[4],
      },
      body: {
        xCaSignature: rawSecrets[5],
        x_ca_signature: rawSecrets[6],
        Authorization: rawSecrets[7],
        nested: {
          authorization: rawSecrets[8],
          safe: "visible",
        },
      },
    },
  });
  const serialized = JSON.stringify(plan);

  for (const rawSecret of rawSecrets) {
    assert.doesNotMatch(serialized, new RegExp(rawSecret));
  }
  assert.match(serialized, /visible/);
});

test("createExecutionPlan rejects unknown APIs", () => {
  assert.throws(() => createExecutionPlan({
    apiName: "dp.unknown",
    tenant: "demo",
    params: {},
  }), /Unknown DeepDraw API: dp\.unknown/);
});

test("writeExecutionPlan persists pretty sanitized JSON", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "deepdraw-plan-"));
  const plan = createExecutionPlan({
    apiName: "dp.product.create",
    tenant: "demo",
    params: {
      query: { merchantId: "1162" },
      body: { appSecret: "secret" },
    },
  });

  const file = writeExecutionPlan(dir, plan);
  const content = readFileSync(file, "utf8");

  assert.equal(file, path.join(dir, `${plan.id}.json`));
  assert.match(content, /\n  "api": "dp\.product\.create",\n/);
  assert.match(content, /\[REDACTED\]/);
  assert.doesNotMatch(content, /secret/);
  rmSync(dir, { recursive: true, force: true });
});

test("writeExecutionPlan keeps unsafe plan ids inside the target directory", () => {
  const parentDir = mkdtempSync(path.join(tmpdir(), "deepdraw-plan-parent-"));
  const dir = path.join(parentDir, "plans");
  const outsideFile = path.join(parentDir, "escape.json");
  const plan = {
    ...createExecutionPlan({
      apiName: "dp.product.create",
      tenant: "demo",
      params: {},
    }),
    id: "../escape",
  };

  const file = writeExecutionPlan(dir, plan);

  assert.equal(file, path.join(dir, "escape.json"));
  assert.equal(existsSync(file), true);
  assert.equal(existsSync(outsideFile), false);
  rmSync(parentDir, { recursive: true, force: true });
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { createCliError } from "../src/core/errors.js";
import { normalizeDeepdrawPayload } from "../src/core/result.js";
import { redactSensitive } from "../src/core/redact.js";

test("redactSensitive hides credential-like fields recursively", () => {
  assert.deepEqual(redactSensitive({
    appSecret: "secret",
    appKey: "app-key",
    app_key: "snake-app-key",
    apiKey: "api-key",
    dopKey: "dop",
    Authorization: "bearer-secret",
    authorization: "lower-bearer-secret",
    nested: {
      "x-ca-signature": "signature",
      xCaSignature: "camel-signature",
      x_ca_signature: "snake-signature",
      requestSignature: "request-signature",
      safe: "visible",
    },
  }), {
    appSecret: "[REDACTED]",
    appKey: "[REDACTED]",
    app_key: "[REDACTED]",
    apiKey: "[REDACTED]",
    dopKey: "[REDACTED]",
    Authorization: "[REDACTED]",
    authorization: "[REDACTED]",
    nested: {
      "x-ca-signature": "[REDACTED]",
      xCaSignature: "[REDACTED]",
      x_ca_signature: "[REDACTED]",
      requestSignature: "[REDACTED]",
      safe: "visible",
    },
  });
});

test("normalizeDeepdrawPayload extracts business status from SDK-style payload", () => {
  const result = normalizeDeepdrawPayload("dp.colors.get", "电商巴拉巴拉", 200, {
    status: 200,
    response: {
      code: 10200,
      state: "success",
      requestId: 1068,
      body: [{ name: "红色" }],
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.api, "dp.colors.get");
  assert.equal(result.tenant, "电商巴拉巴拉");
  assert.equal(result.httpStatus, 200);
  assert.equal(result.requestId, "1068");
  assert.equal(result.businessCode, 10200);
  assert.equal(result.businessState, "success");
  assert.deepEqual(result.data, [{ name: "红色" }]);
});

test("normalizeDeepdrawPayload extracts root-style failed state", () => {
  const result = normalizeDeepdrawPayload("dp.colors.get", "电商巴拉巴拉", 200, {
    status: 200,
    code: 10200,
    state: "failed",
    requestId: 123,
    body: { message: "failed" },
  });

  assert.equal(result.ok, false);
  assert.equal(result.requestId, "123");
  assert.equal(result.businessCode, 10200);
  assert.equal(result.businessState, "failed");
  assert.deepEqual(result.data, { message: "failed" });
});

test("createCliError returns stable error kind and message", () => {
  assert.deepEqual(createCliError("approval_required", "User approval is required", {
    api: "dp.product.create",
  }), {
    kind: "approval_required",
    message: "User approval is required",
    details: {
      api: "dp.product.create",
    },
  });
});

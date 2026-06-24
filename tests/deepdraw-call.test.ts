import assert from "node:assert/strict";
import { test } from "node:test";
import type { DeepdrawConfig } from "../src/core/config.js";
import { callDeepdrawApi } from "../src/core/deepdraw-client.js";
import { runCli } from "../src/cli/run.js";

const config: DeepdrawConfig = {
  tenantName: "电商巴拉巴拉",
  baseUrl: "http://open.deepdraw.cn",
  appKey: "app-key",
  appSecret: "app-secret",
  dopKey: "dop-key",
  merchantId: "1162",
  timeoutMs: 30000,
  credentialSource: "env",
};

test("callDeepdrawApi normalizes successful HTTP response", async () => {
  let requestedUrl = "";
  let requestedMethod = "";

  const result = await callDeepdrawApi({
    config,
    apiName: "dp.colors.get",
    query: {},
    body: undefined,
    fetchImpl: async (url, init) => {
      requestedUrl = String(url);
      requestedMethod = init?.method ?? "";
      return new Response(JSON.stringify({
        status: 200,
        response: {
          code: 10200,
          response: "success",
          requestId: 1068,
          body: [{ name: "红色" }],
        },
      }), { status: 200 });
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.api, "dp.colors.get");
  assert.equal(result.tenant, "电商巴拉巴拉");
  assert.equal(result.businessCode, 10200);
  assert.deepEqual(result.data, [{ name: "红色" }]);
  assert.equal(requestedMethod, "GET");
  assert.match(requestedUrl, /^http:\/\/open\.deepdraw\.cn\/rest\/v2\?/);
  assert.match(requestedUrl, /type=dp\.colors\.get/);
});

test("callDeepdrawApi sends JSON body when provided", async () => {
  let requestedBody: unknown;

  await callDeepdrawApi({
    config,
    apiName: "dp.merchant.name.search",
    query: { name: "森马" },
    body: { pageNo: 1 },
    fetchImpl: async (_url, init) => {
      requestedBody = init?.body;
      return new Response(JSON.stringify({ status: 200, response: { code: 10200, response: "success" } }), {
        status: 200,
      });
    },
  });

  assert.equal(requestedBody, JSON.stringify({ pageNo: 1 }));
});

test("callDeepdrawApi rejects GET body before fetch", async () => {
  let fetched = false;

  await assert.rejects(() => callDeepdrawApi({
    config,
    apiName: "dp.colors.get",
    query: {},
    body: {},
    fetchImpl: async () => {
      fetched = true;
      return new Response("{}", { status: 200 });
    },
  }), /API dp\.colors\.get uses GET and cannot send a request body/);
  assert.equal(fetched, false);
});

test("callDeepdrawApi preserves raw text response payload", async () => {
  const result = await callDeepdrawApi({
    config,
    apiName: "dp.colors.get",
    query: {},
    body: undefined,
    fetchImpl: async () => new Response("temporary upstream failure", { status: 502 }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.httpStatus, 502);
  assert.equal(result.raw, "temporary upstream failure");
  assert.equal(result.data, "temporary upstream failure");
});

test("callDeepdrawApi normalizes empty response payload", async () => {
  const result = await callDeepdrawApi({
    config,
    apiName: "dp.colors.get",
    query: {},
    body: undefined,
    fetchImpl: async () => new Response(null, { status: 204 }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.httpStatus, 204);
  assert.equal(result.raw, "");
  assert.equal(result.data, "");
});

test("callDeepdrawApi rejects unknown API names", async () => {
  await assert.rejects(() => callDeepdrawApi({
    config,
    apiName: "dp.unknown",
    query: {},
    body: undefined,
    fetchImpl: async () => new Response("{}", { status: 200 }),
  }), /Unknown DeepDraw API: dp\.unknown/);
});

test("callDeepdrawApi rejects non-http API transports", async () => {
  await assert.rejects(() => callDeepdrawApi({
    config,
    apiName: "dp.product.create",
    query: {},
    body: undefined,
    fetchImpl: async () => new Response("{}", { status: 200 }),
  }), /API dp\.product\.create requires transport: java-sdk/);
});

test("deepdraw call remains dry-run by default", async () => {
  const result = await runCli(["call", "dp.colors.get"], {
    env: {},
    stdin: "",
    fetchImpl: async () => {
      throw new Error("must not fetch during dry run");
    },
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: true,
    api: "dp.colors.get",
    dryRun: true,
    callSyntax: "deepdraw call dp.colors.get",
  });
});

test("deepdraw call --execute runs low-risk HTTP API with injected fetch", async () => {
  const result = await runCli(["call", "dp.colors.get", "--execute", "--param", "locale=zh-CN"], {
    env: {
      DEEPDRAW_TENANT_NAME: config.tenantName,
      DEEPDRAW_BASE_URL: config.baseUrl,
      DEEPDRAW_APP_KEY: config.appKey,
      DEEPDRAW_APP_SECRET: config.appSecret,
      DEEPDRAW_DOP_KEY: config.dopKey,
      DEEPDRAW_MERCHANT_ID: config.merchantId,
    },
    stdin: "",
    fetchImpl: async (url) => {
      assert.match(String(url), /locale=zh-CN/);
      return new Response(JSON.stringify({
        status: 200,
        response: {
          code: 10200,
          response: "success",
          body: [{ name: "红色" }],
        },
      }), { status: 200 });
    },
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.data, [{ name: "红色" }]);
});

test("deepdraw call --execute returns approval plan for approval-required APIs without fetching", async () => {
  let fetched = false;
  const result = await runCli(["call", "dp.product.search", "--execute"], {
    env: {
      DEEPDRAW_TENANT_NAME: "demo",
    },
    stdin: "",
    fetchImpl: async () => {
      fetched = true;
      return new Response("{}", { status: 200 });
    },
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stderr, "");
  assert.equal(fetched, false);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false);
  assert.deepEqual(payload.error, {
    kind: "approval_required",
    message: "User approval is required",
    reason: "approval_required",
  });
  assert.equal(payload.plan.api, "dp.product.search");
  assert.equal(payload.plan.tenant, "demo");
  assert.equal(payload.plan.riskLevel, "caution");
  assert.equal(payload.plan.requiresApproval, true);
});

test("deepdraw call --execute --yes runs approval-required HTTP API with injected fetch", async () => {
  let fetched = false;
  const result = await runCli([
    "call",
    "dp.product.search",
    "--execute",
    "--yes",
    "--param",
    "merchantId=1162",
  ], {
    env: {
      DEEPDRAW_TENANT_NAME: config.tenantName,
      DEEPDRAW_BASE_URL: config.baseUrl,
      DEEPDRAW_APP_KEY: config.appKey,
      DEEPDRAW_APP_SECRET: config.appSecret,
      DEEPDRAW_DOP_KEY: config.dopKey,
      DEEPDRAW_MERCHANT_ID: config.merchantId,
    },
    stdin: "",
    fetchImpl: async (url) => {
      fetched = true;
      assert.match(String(url), /type=dp\.product\.search/);
      assert.match(String(url), /merchantId=1162/);
      return new Response(JSON.stringify({
        status: 200,
        response: {
          code: 10200,
          response: "success",
          body: [{ productCode: "208226102001" }],
        },
      }), { status: 200 });
    },
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.equal(fetched, true);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.data, [{ productCode: "208226102001" }]);
});

test("deepdraw call approval plan redacts secret-like query and body fields", async () => {
  const result = await runCli([
    "call",
    "dp.product.search",
    "--execute",
    "--param",
    "merchantId=1162",
    "--param",
    "accessToken=private-token",
    "--json",
    "{\"appSecret\":\"secret\",\"safe\":\"visible\"}",
  ], {
    env: {},
    stdin: "",
    fetchImpl: async () => {
      throw new Error("must not fetch without approval");
    },
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stderr, "");
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.plan.tenant, "unconfigured");
  assert.deepEqual(payload.plan.sanitizedParams, {
    query: {
      merchantId: "1162",
      accessToken: "[REDACTED]",
    },
    body: {
      appSecret: "[REDACTED]",
      safe: "visible",
    },
  });
});

test("deepdraw call --execute rejects GET body before fetch", async () => {
  let fetched = false;
  const result = await runCli(["call", "dp.colors.get", "--execute", "--json", "{}"], {
    env: {
      DEEPDRAW_TENANT_NAME: config.tenantName,
      DEEPDRAW_BASE_URL: config.baseUrl,
      DEEPDRAW_APP_KEY: config.appKey,
      DEEPDRAW_APP_SECRET: config.appSecret,
      DEEPDRAW_DOP_KEY: config.dopKey,
      DEEPDRAW_MERCHANT_ID: config.merchantId,
    },
    stdin: "",
    fetchImpl: async () => {
      fetched = true;
      return new Response("{}", { status: 200 });
    },
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /API dp\.colors\.get uses GET and cannot send a request body/);
  assert.equal(fetched, false);
});

test("deepdraw call dry-run validates unknown options without fetching", async () => {
  let fetched = false;
  const result = await runCli(["call", "dp.colors.get", "--bogus"], {
    env: {},
    stdin: "",
    fetchImpl: async () => {
      fetched = true;
      return new Response("{}", { status: 200 });
    },
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /Unknown call option: --bogus/);
  assert.equal(fetched, false);
});

test("deepdraw call dry-run validates malformed params without fetching", async () => {
  let fetched = false;
  const result = await runCli(["call", "dp.colors.get", "--param", "locale"], {
    env: {},
    stdin: "",
    fetchImpl: async () => {
      fetched = true;
      return new Response("{}", { status: 200 });
    },
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /--param requires key=value/);
  assert.equal(fetched, false);
});

test("deepdraw call dry-run validates bad JSON without fetching", async () => {
  let fetched = false;
  const result = await runCli(["call", "dp.colors.get", "--json", "{"], {
    env: {},
    stdin: "",
    fetchImpl: async () => {
      fetched = true;
      return new Response("{}", { status: 200 });
    },
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /Expected property name|JSON/);
  assert.equal(fetched, false);
});

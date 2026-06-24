import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { apiRegistry, findApiDefinition } from "../src/core/api-registry.js";
import { extractReferenceApis } from "../src/core/reference-parser.js";
import { runCli } from "../src/cli/run.js";
import type { ApiDefinition } from "../src/core/types.js";

const referenceMarkdown = readFileSync("docs/reference/deepdraw-openapi.md", "utf8");

function expectApi(apiName: string): ApiDefinition {
  const api = findApiDefinition(apiName);
  assert.ok(api, `${apiName} is missing from apiRegistry`);
  return api;
}

function paramFlags(api: ApiDefinition): Map<string, boolean> {
  return new Map([...api.requiredParams, ...api.optionalParams].map((param) => [param.name, param.required]));
}

function assertParamFlags(apiName: string, expected: Record<string, boolean>) {
  const flags = paramFlags(expectApi(apiName));

  assert.deepEqual([...flags.keys()].sort(), Object.keys(expected).sort());
  for (const [name, required] of Object.entries(expected)) {
    assert.equal(flags.get(name), required, `${apiName} ${name} required flag`);
  }
}

test("registry covers every dp api in the stable reference", () => {
  const referenceApis = extractReferenceApis(referenceMarkdown);
  const registeredApis = new Set(apiRegistry.map((api) => api.apiName));

  assert.equal(referenceApis.length, 20);
  for (const apiName of referenceApis) {
    assert.equal(registeredApis.has(apiName), true, `${apiName} is missing from apiRegistry`);
  }
});

test("every registered api has a deepdraw call route and risk metadata", () => {
  for (const api of apiRegistry) {
    assert.equal(findApiDefinition(api.apiName)?.apiName, api.apiName);
    assert.match(api.callSyntax, /^deepdraw call dp\./);
    assert.ok(["read", "caution", "write", "paid", "paid_write"].includes(api.riskLevel));
    assert.ok(["http", "java-sdk"].includes(api.transport));
    assert.ok(["GET", "POST"].includes(api.method));
    assert.ok(["/rest", "/rest/v2"].includes(api.path));
  }
});

test("deepdraw call --help returns call-specific usage", async () => {
  const result = await runCli(["call", "--help"], {
    env: {},
    stdin: "",
  });

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /^Usage: deepdraw call <api-name>/);
  assert.doesNotMatch(result.stdout, /Commands:/);
  assert.equal(result.stderr, "");
});

test("deepdraw call rejects unknown api names", async () => {
  const result = await runCli(["call", "dp.nope.missing"], {
    env: {},
    stdin: "",
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "Unknown DeepDraw API: dp.nope.missing\n");
});

test("deepdraw call returns known api dry-run json", async () => {
  const result = await runCli(["call", "dp.colors.get"], {
    env: {},
    stdin: "",
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

test("merchant metadata APIs include required merchant id", () => {
  for (const apiName of ["dp.merchant.sites.get", "dp.merchant.watermarks.get"]) {
    const flags = paramFlags(expectApi(apiName));
    assert.equal(flags.get("merchantId"), true, `${apiName} merchantId should be required`);
  }
});

test("trade category metadata includes documented required merchant id", () => {
  assertParamFlags("dp.merchant.trades", {
    merchantId: true,
  });
});

test("trade fields metadata includes documented required merchant and trade ids", () => {
  assertParamFlags("dp.trade.fields", {
    merchantId: true,
    tradeId: true,
  });
});

test("product create metadata includes documented merchant, trade, and product payload", () => {
  assertParamFlags("dp.product.create", {
    merchantId: true,
    tradeId: true,
    product: true,
  });
});

test("product resource metadata matches documented optional filters", () => {
  const api = expectApi("dp.product.resource");
  const flags = paramFlags(api);

  assert.deepEqual([...flags.keys()].sort(), [
    "detailPageSite",
    "excludeDetailPageModules",
    "material",
    "merchantId",
    "productCode",
    "productId",
    "resource",
    "skc",
    "video",
    "wgId",
  ].sort());
  for (const [name, required] of flags) {
    assert.equal(required, false, `${name} should be optional for dp.product.resource`);
  }
  assert.match(api.notes, /productId/);
  assert.match(api.notes, /merchantId and productCode/);
});

test("product search metadata matches documented filters", () => {
  assertParamFlags("dp.product.search", {
    merchantId: true,
    date: false,
    pageNo: false,
    startTime: false,
    endTime: false,
    form: false,
    picture: false,
    detail: false,
    productCodes: false,
    material: false,
    video: false,
    excludeDraft: false,
    detailPageSite: false,
    excludeDetailPageModules: false,
  });
});

test("product basic search metadata matches documented filters", () => {
  assertParamFlags("dp.product.basic.search", {
    merchantId: true,
    date: false,
    pageNo: false,
    pageSize: false,
    startTime: false,
    endTime: false,
    form: false,
    picture: false,
    detail: false,
    productCodes: false,
    excludeDraft: false,
  });
});

test("feature pictures metadata matches documented lookup and image filters", () => {
  const api = expectApi("dp.feature.pictures.get");

  assertParamFlags("dp.feature.pictures.get", {
    pictureType: true,
    productId: false,
    merchantId: false,
    productCode: false,
    pictureSite: false,
    width: false,
    body_facing: false,
    body_part: false,
    body_orientation: false,
    skc: false,
  });
  assert.match(api.notes, /productId/);
  assert.match(api.notes, /merchantId and productCode/);
});

test("distribution metadata uses documented required product id", () => {
  const flags = paramFlags(expectApi("dp.product.distribution.get"));

  assert.equal(flags.get("productId"), true);
  assert.equal(flags.has("productCode"), false);
});

test("image retrieval metadata reflects merchant id plus url or img inputs", () => {
  const api = expectApi("dp.product.retrieve.image");
  const flags = paramFlags(api);

  assert.equal(flags.get("merchantId"), true);
  assert.equal(flags.get("url"), false);
  assert.equal(flags.get("img"), false);
  assert.equal(flags.get("outline"), false);
  assert.equal(flags.has("imageUrl"), false);
  assert.match(api.notes, /url and img/);
});

test("image label metadata reflects url or img inputs", () => {
  const api = expectApi("dp.product.label.image");
  const flags = paramFlags(api);

  assert.equal(flags.get("url"), false);
  assert.equal(flags.get("img"), false);
  assert.equal(flags.has("imageUrl"), false);
  assert.match(api.notes, /url and img/);
});

test("image distribution metadata uses documented required product id only", () => {
  const flags = paramFlags(expectApi("dp.product.distributions.get"));

  assert.equal(flags.get("productId"), true);
  assert.equal(flags.has("productCode"), false);
  assert.equal(flags.has("taskId"), false);
});

test("image upload and task query metadata include required merchant context", () => {
  const uploadFlags = paramFlags(expectApi("dp.product.image.upload"));
  assert.equal(uploadFlags.get("merchantId"), true);
  assert.equal(uploadFlags.get("productId"), true);
  assert.equal(uploadFlags.get("images"), true);

  const queryFlags = paramFlags(expectApi("dp.product.image.query"));
  assert.equal(queryFlags.get("merchantId"), true);
  assert.equal(queryFlags.get("taskId"), true);

  const queryApi = expectApi("dp.product.image.query");
  assert.equal(queryApi.riskLevel, "paid");
  assert.equal(queryApi.approvalRequired, true);
});

test("image update metadata reflects merchant id and product id or product code relationship", () => {
  const api = expectApi("dp.product.image.update");
  const flags = paramFlags(api);

  assert.equal(flags.get("merchantId"), true);
  assert.equal(flags.get("images"), true);
  assert.equal(flags.get("productId"), false);
  assert.equal(flags.get("productCode"), false);
  assert.equal(flags.get("pictureAddType"), false);
  assert.match(api.notes, /productId and productCode/);
});

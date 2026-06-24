import assert from "node:assert/strict";
import { test } from "node:test";
import type { DeepdrawConfig } from "../src/core/config.js";
import { buildSignedRequest } from "../src/core/signer.js";

const placeholderConfig = {
  tenantName: "电商巴拉巴拉",
  baseUrl: "http://open.deepdraw.cn",
  appKey: "app-key",
  appSecret: "app-secret",
  dopKey: "dop-key",
  merchantId: "1162",
  timeoutMs: 30000,
  credentialSource: "test",
} as const;

const config: DeepdrawConfig = {
  ...placeholderConfig,
  credentialSource: "env",
};

const canonicalStringToSign = [
  "GET",
  "application/json; charset=utf-8",
  "",
  "application/x-www-form-urlencoded; charset=utf-8",
  "Wed, 29 Apr 2026 00:00:00 GMT",
  "x-ca-key:app-key",
  "x-ca-nonce:nonce-1",
  "x-ca-signature-method:HmacSHA256",
  "x-ca-timestamp:1777420800000",
  "/rest/v2?dopKey=dop-key&merchantId=1162&productCode=208226102001&type=dp.product.resource",
].join("\n");

test("buildSignedRequest builds canonical GET v2 request", () => {
  const request = buildSignedRequest({
    config,
    apiName: "dp.product.resource",
    method: "GET",
    path: "/rest/v2",
    query: { productCode: "208226102001" },
    now: new Date("2026-04-29T00:00:00.000Z"),
    nonce: "nonce-1",
  });

  assert.equal(
    request.url,
    "http://open.deepdraw.cn/rest/v2?dopKey=dop-key&merchantId=1162&productCode=208226102001&type=dp.product.resource",
  );
  assert.equal(request.headers["x-ca-signature-headers"], "x-ca-key,x-ca-nonce,x-ca-signature-method,x-ca-timestamp");
  assert.equal(request.stringToSign, canonicalStringToSign);
  assert.equal(request.headers["x-ca-signature"], "8uVLkCwpSPdI8qWgKD+Wr8oVsDFME0MHq2mwUd6HegE=");
});

test("buildSignedRequest filters empty values and encodes sorted URL query values", () => {
  const request = buildSignedRequest({
    config,
    apiName: "dp.product.resource",
    method: "GET",
    path: "/rest/v2",
    query: {
      zeta: "最后 项",
      productCode: "208226102001",
      keyword: "中文 text",
      empty: "",
      nullish: null,
      alpha: "first value",
      missing: undefined,
    },
    now: new Date("2026-04-29T00:00:00.000Z"),
    nonce: "nonce-1",
  });

  assert.equal(
    request.url,
    "http://open.deepdraw.cn/rest/v2?alpha=first+value&dopKey=dop-key&keyword=%E4%B8%AD%E6%96%87+text&merchantId=1162&productCode=208226102001&type=dp.product.resource&zeta=%E6%9C%80%E5%90%8E+%E9%A1%B9",
  );
  assert.doesNotMatch(request.url, /empty|nullish|missing/);
  assert.match(
    request.stringToSign,
    /\/rest\/v2\?alpha=first value&dopKey=dop-key&keyword=中文 text&merchantId=1162&productCode=208226102001&type=dp\.product\.resource&zeta=最后 项$/,
  );
});

test("payload cannot override credential query parameters", () => {
  const request = buildSignedRequest({
    config,
    apiName: "dp.product.resource",
    method: "GET",
    path: "/rest/v2",
    query: {
      dopKey: "bad",
      merchantId: "bad",
      type: "dp.product.create",
      productCode: "208226102001",
    },
    now: new Date("2026-04-29T00:00:00.000Z"),
    nonce: "nonce-1",
  });

  assert.doesNotMatch(request.url, /bad|dp\.product\.create/);
  assert.match(request.url, /dopKey=dop-key/);
  assert.match(request.url, /type=dp\.product\.resource/);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSdkInput, parseSdkOutput } from "../src/sdk/java-adapter.js";

const config = {
  tenantName: "电商巴拉巴拉",
  baseUrl: "http://open.deepdraw.cn",
  appKey: "app-key",
  appSecret: "app-secret",
  dopKey: "dop-key",
  merchantId: "1162",
  timeoutMs: 30000,
  credentialSource: "test",
};

test("buildSdkInput maps product resource calls to SDK config and query", () => {
  assert.deepEqual(
    buildSdkInput({
      config,
      apiName: "dp.product.resource",
      query: { productCode: "208226102001", resource: "form" },
      body: undefined,
    }),
    {
      config: {
        appKey: "app-key",
        appSecret: "app-secret",
        dopKey: "dop-key",
        host: "http://open.deepdraw.cn",
        merchantId: "1162",
      },
      query: {
        productCode: "208226102001",
        resource: "form",
      },
    },
  );
});

test("buildSdkInput maps product create calls to SDK config, trade query, and product", () => {
  const product = {
    code: "208226102001",
    title: "测试商品",
    fields: { 颜色: "蓝色" },
  };

  assert.deepEqual(
    buildSdkInput({
      config,
      apiName: "dp.product.create",
      query: { merchantId: "1162", tradeId: "3001" },
      body: product,
    }),
    {
      config: {
        appKey: "app-key",
        appSecret: "app-secret",
        dopKey: "dop-key",
        host: "http://open.deepdraw.cn",
        merchantId: "1162",
        tradeId: "3001",
      },
      query: {
        merchantId: "1162",
        tradeId: "3001",
      },
      product,
    },
  );
});

test("buildSdkInput maps product update calls to SDK query and product", () => {
  const product = {
    code: "208226102001",
    title: "更新商品",
  };

  assert.deepEqual(
    buildSdkInput({
      config,
      apiName: "dp.product.update",
      query: { productId: "7788" },
      body: product,
    }),
    {
      config: {
        appKey: "app-key",
        appSecret: "app-secret",
        dopKey: "dop-key",
        host: "http://open.deepdraw.cn",
        merchantId: "1162",
      },
      query: {
        productId: "7788",
      },
      product,
    },
  );
});

test("buildSdkInput preserves product resource SDK query filters", () => {
  const query = {
    productId: "7788",
    merchantId: "1162",
    productCode: "208226102001",
    resource: "picture",
    wgId: "watermark-rule",
    skc: "skc01,skc02",
    material: "1",
    video: "1",
    detailPageSite: "TMALL",
    excludeDetailPageModules: "usemap,尺码表",
  };

  assert.deepEqual(
    buildSdkInput({
      config,
      apiName: "dp.product.resource",
      query,
      body: undefined,
    }),
    {
      config: {
        appKey: "app-key",
        appSecret: "app-secret",
        dopKey: "dop-key",
        host: "http://open.deepdraw.cn",
        merchantId: "1162",
      },
      query,
    },
  );
});

test("parseSdkOutput normalizes trailing JSON line", () => {
  const result = parseSdkOutput(
    "dp.product.resource",
    "电商巴拉巴拉",
    'log line\n{"status":200,"response":{"code":10200,"response":"success","requestId":9901,"body":{"productId":7788}}}\n',
  );

  assert.equal(result.ok, true);
  assert.equal(result.requestId, "9901");
  assert.deepEqual(result.data, { productId: 7788 });
});

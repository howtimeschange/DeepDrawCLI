import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { test } from "node:test";
import { buildSdkInput, callJavaSdkApi, parseSdkOutput } from "../src/sdk/java-adapter.js";

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

test("buildSdkInput maps generic incremental updates to the Product SDK payload", () => {
  const product = {
    title: "增量标题",
    fields: { 颜色: "蓝色,blue", 尺码: "26" },
  };

  assert.deepEqual(
    buildSdkInput({
      config,
      apiName: "dp.product.incremental.update",
      query: { productId: "ed18698170c54da4baa88541d66e3536" },
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
      query: { productId: "ed18698170c54da4baa88541d66e3536" },
      product,
    },
  );
});

test("buildSdkInput maps SKU color incremental updates to the Product SDK payload", () => {
  const product = {
    code: "208226102001",
    fields: {
      颜色: "红色,red",
      尺码: "M",
      "商家 SKU": {
        title: "价格",
        red: { M: "SKU001" },
      },
    },
  };

  assert.deepEqual(
    buildSdkInput({
      config,
      apiName: "dp.product.sku.color.incremental.update",
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
      query: { productId: "7788" },
      product,
    },
  );
});

test("parseSdkOutput normalizes trailing JSON line", () => {
  const result = parseSdkOutput(
    "dp.product.create",
    "电商巴拉巴拉",
    'log line\n{"status":200,"response":{"code":10200,"response":"success","requestId":9901,"body":{"productId":7788}}}\n',
  );

  assert.equal(result.ok, true);
  assert.equal(result.requestId, "9901");
  assert.deepEqual(result.data, { productId: 7788 });
});

test("callJavaSdkApi writes SDK input to Java stdin and parses normalized output", async () => {
  let stdinPayload: unknown;
  const result = await callJavaSdkApi({
    config,
    apiName: "dp.product.create",
    query: { merchantId: "1162", tradeId: "3001" },
    body: { code: "208226102001", title: "测试商品" },
    env: { DEEPDRAW_SDK_CLASSPATH: "/tmp/fake-sdk/*" },
    cwd: "/tmp/deepdraw-cli",
    spawnImpl: async (command, args, input) => {
      assert.equal(command, "java");
      assert.deepEqual(args, ["-cp", `/tmp/deepdraw-cli/.deepdraw-sdk/classes${delimiter}/tmp/fake-sdk/*`, "DeepdrawProductCreateCli"]);
      stdinPayload = JSON.parse(input) as unknown;
      return {
        exitCode: 0,
        stderr: "",
        stdout: '{"status":200,"response":{"code":10200,"response":"success","body":{"productId":7788}}}',
      };
    },
  });

  assert.deepEqual(stdinPayload, {
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
    product: { code: "208226102001", title: "测试商品" },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.data, { productId: 7788 });
});

test("callJavaSdkApi loads bundled SDK jars and dependency jars from vendor directory", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "deepdraw-sdk-vendor-"));
  await mkdir(join(cwd, "java"), { recursive: true });
  await mkdir(join(cwd, "vendor", "deepdraw-sdk", "lib"), { recursive: true });
  await writeFile(join(cwd, "java", "DeepdrawProductCreateCli.java"), "class DeepdrawProductCreateCli {}\n");

  const compileClasspaths: string[] = [];
  const runClasspaths: string[] = [];

  const result = await callJavaSdkApi({
    config,
    apiName: "dp.product.create",
    query: { merchantId: "1162", tradeId: "3001" },
    body: { code: "208226102001", title: "测试商品" },
    env: {},
    cwd,
    spawnImpl: async (command, args) => {
      if (command === "javac") {
        compileClasspaths.push(args[1]);
        return { exitCode: 0, stderr: "", stdout: "" };
      }
      assert.equal(command, "java");
      runClasspaths.push(args[1]);
      return {
        exitCode: 0,
        stderr: "",
        stdout: '{"status":200,"response":{"code":10200,"response":"success","body":{"productId":7788}}}',
      };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(compileClasspaths.length, 1);
  assert.equal(runClasspaths.length, 1);
  assert.ok(compileClasspaths[0].split(delimiter).includes(join(cwd, "vendor", "deepdraw-sdk", "*")));
  assert.ok(compileClasspaths[0].split(delimiter).includes(join(cwd, "vendor", "deepdraw-sdk", "lib", "*")));
  assert.ok(runClasspaths[0].split(delimiter).includes(join(cwd, "vendor", "deepdraw-sdk", "*")));
  assert.ok(runClasspaths[0].split(delimiter).includes(join(cwd, "vendor", "deepdraw-sdk", "lib", "*")));
});

test("callJavaSdkApi routes product resource through Java runner with full query", async () => {
  let stdinPayload: unknown;
  const result = await callJavaSdkApi({
    config,
    apiName: "dp.product.resource",
    query: {
      productCode: "208226102001",
      resource: "form",
      wgId: "watermark-1",
      skc: "skc01,skc02",
      material: "1",
      video: "1",
      detailPageSite: "TMALL",
      excludeDetailPageModules: "usemap,尺码表",
      tags: "春季,新品",
    },
    body: undefined,
    env: { DEEPDRAW_SDK_CLASSPATH: "/tmp/fake-sdk/*" },
    cwd: "/tmp/deepdraw-cli",
    spawnImpl: async (command, args, input) => {
      assert.equal(command, "java");
      assert.deepEqual(args, ["-cp", `/tmp/deepdraw-cli/.deepdraw-sdk/classes${delimiter}/tmp/fake-sdk/*`, "DeepdrawProductResourceCli"]);
      stdinPayload = JSON.parse(input) as unknown;
      return {
        exitCode: 0,
        stderr: "",
        stdout: '{"status":200,"response":{"code":10200,"response":"success","body":{"productId":7788}}}',
      };
    },
  });

  assert.deepEqual(stdinPayload, {
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
      wgId: "watermark-1",
      skc: "skc01,skc02",
      material: "1",
      video: "1",
      detailPageSite: "TMALL",
      excludeDetailPageModules: "usemap,尺码表",
      tags: "春季,新品",
    },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.data, { productId: 7788 });
});

test("callJavaSdkApi routes SKU color incremental updates through the dedicated Java bridge", async () => {
  let stdinPayload: unknown;
  const result = await callJavaSdkApi({
    config,
    apiName: "dp.product.sku.color.incremental.update",
    query: { productId: "7788" },
    body: {
      code: "208226102001",
      title: "颜色更新",
      fields: {
        颜色: "红色,red",
        尺码: "M",
        "商家 SKU": {
          title: "价格",
          red: { M: "SKU001" },
        },
      },
    },
    env: { DEEPDRAW_SDK_CLASSPATH: "/tmp/fake-sdk/*" },
    cwd: "/tmp/deepdraw-cli",
    spawnImpl: async (command, args, input) => {
      assert.equal(command, "java");
      assert.deepEqual(args, [
        "-cp",
        `/tmp/deepdraw-cli/.deepdraw-sdk/classes${delimiter}/tmp/fake-sdk/*`,
        "DeepdrawProductSkuColorIncrementalUpdateCli",
      ]);
      stdinPayload = JSON.parse(input) as unknown;
      return {
        exitCode: 0,
        stderr: "",
        stdout: '{"status":200,"response":{"code":10200,"response":"success","body":{"id":"product-1","updates":["颜色"]}}}',
      };
    },
  });

  assert.deepEqual(stdinPayload, {
    config: {
      appKey: "app-key",
      appSecret: "app-secret",
      dopKey: "dop-key",
      host: "http://open.deepdraw.cn",
      merchantId: "1162",
    },
    query: { productId: "7788" },
    product: {
      code: "208226102001",
      title: "颜色更新",
      fields: {
        颜色: "红色,red",
        尺码: "M",
        "商家 SKU": {
          title: "价格",
          red: { M: "SKU001" },
        },
      },
    },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.data, { id: "product-1", updates: ["颜色"] });
});

test("callJavaSdkApi compiles product resource bridge source when present", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "deepdraw-sdk-resource-"));
  await mkdir(join(cwd, "java"), { recursive: true });
  await mkdir(join(cwd, "vendor", "deepdraw-sdk", "lib"), { recursive: true });
  await writeFile(join(cwd, "java", "DeepdrawProductResourceCli.java"), "class DeepdrawProductResourceCli {}\n");

  const compiledSources: string[] = [];
  const result = await callJavaSdkApi({
    config,
    apiName: "dp.product.resource",
    query: { productCode: "208226102001", resource: "form" },
    body: undefined,
    env: {},
    cwd,
    spawnImpl: async (command, args) => {
      if (command === "javac") {
        compiledSources.push(...args.slice(3));
        return { exitCode: 0, stderr: "", stdout: "" };
      }
      assert.equal(command, "java");
      return {
        exitCode: 0,
        stderr: "",
        stdout: '{"status":200,"response":{"code":10200,"response":"success","body":{"productId":7788}}}',
      };
    },
  });

  assert.equal(result.ok, true);
  assert.ok(compiledSources.includes(join(cwd, "java", "DeepdrawProductResourceCli.java")));
});

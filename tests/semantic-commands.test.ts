import assert from "node:assert/strict";
import { test } from "node:test";
import { runCli } from "../src/cli/run.js";
import { apiRegistry } from "../src/core/api-registry.js";

function parseStdout(stdout: string): Record<string, unknown> {
  return JSON.parse(stdout) as Record<string, unknown>;
}

function semanticArgv(semanticCommand: string): string[] {
  assert.match(semanticCommand, /^deepdraw /);
  return semanticCommand.replace(/^deepdraw /, "").split(" ");
}

test("semantic color list maps to registered API dry-run", async () => {
  const result = await runCli(["color", "list", "--dry-run"], {
    env: {},
    stdin: "",
    fetchImpl: async () => {
      throw new Error("semantic dry-run must not fetch");
    },
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.deepEqual(parseStdout(result.stdout), {
    ok: true,
    api: "dp.colors.get",
    dryRun: true,
  });
});

test("risky semantic command returns approval_required without --yes", async () => {
  const result = await runCli(["product", "create", "--input", "product.json"], {
    env: {},
    stdin: "",
    fetchImpl: async () => {
      throw new Error("semantic approval gate must not fetch");
    },
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stderr, "");
  const payload = parseStdout(result.stdout);
  assert.equal(payload.ok, false);
  assert.deepEqual(payload.error, {
    kind: "approval_required",
    message: "User approval is required",
    reason: "approval_required",
  });
  assert.equal((payload.plan as Record<string, unknown>).api, "dp.product.create");
});

test("risky semantic --plan --yes still returns approval plan without fetching", async () => {
  let fetched = false;
  const result = await runCli(["product", "create", "--plan", "--yes"], {
    env: {},
    stdin: "",
    fetchImpl: async () => {
      fetched = true;
      return new Response("{}", { status: 200 });
    },
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stderr, "");
  assert.equal(fetched, false);
  const payload = parseStdout(result.stdout);
  assert.equal(payload.ok, false);
  assert.equal((payload.error as Record<string, unknown>).reason, "plan_requested");
  assert.equal((payload.plan as Record<string, unknown>).api, "dp.product.create");
});

test("product content command extracts summary and assets from product resource", async () => {
  let fetched = false;
  let javaInput: unknown;
  const result = await runCli([
    "product",
    "content",
    "--execute",
    "--product-code",
    "208326105214",
    "--summary",
    "--assets",
  ], {
    env: {
      DEEPDRAW_TENANT_NAME: "电商巴拉巴拉",
      DEEPDRAW_BASE_URL: "http://open.deepdraw.cn",
      DEEPDRAW_APP_KEY: "app-key",
      DEEPDRAW_APP_SECRET: "app-secret",
      DEEPDRAW_DOP_KEY: "dop-key",
      DEEPDRAW_MERCHANT_ID: "1162",
      DEEPDRAW_SDK_CLASSPATH: "/tmp/fake-sdk/*",
    },
    stdin: "",
    fetchImpl: async () => {
      fetched = true;
      return new Response("{}", { status: 200 });
    },
    javaSpawnImpl: async (command, args, input) => {
      if (command === "javac") {
        return { exitCode: 0, stderr: "", stdout: "" };
      }
      assert.equal(command, "java");
      assert.equal(args[2], "DeepdrawProductResourceCli");
      javaInput = JSON.parse(input) as unknown;
      return {
        exitCode: 0,
        stderr: "",
        stdout: JSON.stringify({
          status: 200,
          response: {
            code: 10200,
            response: "success",
            requestId: -1,
            body: {
              code: "208326105214",
              productId: 6404619,
              id: "15954d5aa2c447288be8dd0e73542046",
              title: "巴拉巴拉儿童外套",
              brandName: "Balabala/巴拉巴拉",
              trade: { id: "12390", name: "外套" },
              colors: { options: ["粉红", "蓝色"] },
              sizes: { options: ["100cm", "110cm"] },
              skus: {
                skuItems: [
                  {
                    color: "蓝色",
                    size: "100cm",
                    values: {
                      "商家编码": "6942749195651",
                      "条形码": "6942749195651",
                      "价格": "359",
                      "唯品会货号": "20832610521400388100",
                    },
                  },
                ],
              },
              pictures: {
                pictures: {
                  TMALL: {
                    place: "TMALL",
                    pictures: {
                      HOME: [
                        {
                          id: 688265488,
                          name: "home.jpg",
                          url: "//product.resources.deepdraw.biz/demo/home.jpg",
                          skc: "20832610521400388",
                          color: "蓝色调00388",
                          width: "800",
                          height: "800",
                          size: "83231",
                          sortNum: 1,
                          withWatermark: false,
                        },
                      ],
                    },
                  },
                },
              },
              detalPages: [
                {
                  templateName: "默认详情页",
                  imagePageUrl: "http://product.resources.deepdraw.biz/demo/detail.jpg",
                  screenShotSectionUrls: ["//product.resources.deepdraw.biz/demo/section-1.jpg"],
                  modules: {
                    "商品信息": ["//product.resources.deepdraw.biz/demo/module-1.jpg"],
                  },
                },
              ],
            },
          },
        }),
      };
    },
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.equal(fetched, false);
  assert.deepEqual(javaInput, {
    config: {
      appKey: "app-key",
      appSecret: "app-secret",
      dopKey: "dop-key",
      host: "http://open.deepdraw.cn",
      merchantId: "1162",
    },
    query: {
      productCode: "208326105214",
    },
  });
  const payload = parseStdout(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.api, "dp.product.resource");
  assert.deepEqual(payload.summary, {
    productCode: "208326105214",
    productId: 6404619,
    uid: "15954d5aa2c447288be8dd0e73542046",
    title: "巴拉巴拉儿童外套",
    brandName: "Balabala/巴拉巴拉",
    tradeId: "12390",
    tradeName: "外套",
    colorCount: 2,
    sizeCount: 2,
    skuCount: 1,
    pictureCount: 1,
    detailPageCount: 1,
    detailAssetCount: 3,
  });
  assert.deepEqual(payload.skus, [
    {
      color: "蓝色",
      size: "100cm",
      sellerCode: "6942749195651",
      barcode: "6942749195651",
      skuCode: "20832610521400388100",
      price: "359",
      quantity: null,
    },
  ]);
  assert.deepEqual(payload.assets, {
    pictures: [
      {
        place: "TMALL",
        pictureType: "HOME",
        url: "//product.resources.deepdraw.biz/demo/home.jpg",
        normalizedUrl: "http://product.resources.deepdraw.biz/demo/home.jpg",
        skc: "20832610521400388",
        color: "蓝色调00388",
        id: "688265488",
        name: "home.jpg",
        width: 800,
        height: 800,
        fileSize: 83231,
        sortNo: 1,
        withWatermark: false,
      },
    ],
    detailPages: [
      {
        pageIndex: 1,
        templateName: "默认详情页",
        htmlPageUrl: null,
        imagePageUrl: "http://product.resources.deepdraw.biz/demo/detail.jpg",
        mixedPageUrl: null,
        screenshotUrls: ["http://product.resources.deepdraw.biz/demo/section-1.jpg"],
      },
    ],
    detailModules: [
      {
        pageIndex: 1,
        moduleName: "商品信息",
        moduleIndex: 1,
        url: "//product.resources.deepdraw.biz/demo/module-1.jpg",
        normalizedUrl: "http://product.resources.deepdraw.biz/demo/module-1.jpg",
      },
    ],
  });
});

test("product content dry-run does not fetch", async () => {
  const result = await runCli([
    "product",
    "content",
    "--product-code",
    "208326105214",
    "--assets",
  ], {
    env: {},
    stdin: "",
    fetchImpl: async () => {
      throw new Error("product content dry-run must not fetch");
    },
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.deepEqual(parseStdout(result.stdout), {
    ok: true,
    api: "dp.product.resource",
    command: "deepdraw product content",
    dryRun: true,
    query: {
      productCode: "208326105214",
    },
    output: {
      summary: false,
      assets: true,
    },
  });
});

test("product content requires product code or product id", async () => {
  const result = await runCli(["product", "content", "--summary"], {
    env: {},
    stdin: "",
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /requires --product-code or --product-id/);
});

test("every registered semantic command routes to its API in dry-run mode", async () => {
  const semanticApis = apiRegistry.filter((api) => api.semanticCommand);

  assert.ok(semanticApis.length > 0);
  for (const api of semanticApis) {
    const argv = [...semanticArgv(api.semanticCommand ?? ""), "--dry-run"];
    if (api.approvalRequired) {
      argv.push("--yes");
    }

    const result = await runCli(argv, {
      env: {},
      stdin: "",
      fetchImpl: async () => {
        throw new Error(`${api.semanticCommand} must not fetch`);
      },
    });

    assert.equal(result.exitCode, 0, api.semanticCommand ?? api.apiName);
    assert.equal(result.stderr, "", api.semanticCommand ?? api.apiName);
    const payload = parseStdout(result.stdout);
    assert.equal(payload.ok, true, api.semanticCommand ?? api.apiName);
    assert.equal(payload.api, api.apiName, api.semanticCommand ?? api.apiName);
    assert.equal(payload.dryRun, true, api.semanticCommand ?? api.apiName);
  }
});

test("risky semantic approval plan redacts secret-like params", async () => {
  const result = await runCli([
    "product",
    "create",
    "--input",
    "product.json",
    "--param",
    "appSecret=secret-value",
  ], {
    env: { DEEPDRAW_TENANT_NAME: "demo" },
    stdin: "",
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stderr, "");
  const payload = parseStdout(result.stdout);
  const plan = payload.plan as Record<string, unknown>;
  assert.equal(plan.tenant, "demo");
  assert.deepEqual(plan.sanitizedParams, {
    command: "product create --input product.json --param appSecret=[REDACTED]",
    input: "product.json",
    params: {
      appSecret: "[REDACTED]",
    },
  });
});

test("semantic commands reject unknown options", async () => {
  const result = await runCli(["color", "list", "--bogus"], {
    env: {},
    stdin: "",
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /Unknown semantic option: --bogus/);
});

test("semantic commands reject malformed params", async () => {
  const result = await runCli(["product", "create", "--param", "merchantId"], {
    env: {},
    stdin: "",
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /--param requires key=value/);
});

test("semantic commands reject missing input path", async () => {
  const result = await runCli(["product", "create", "--input"], {
    env: {},
    stdin: "",
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /--input requires a file path/);
});

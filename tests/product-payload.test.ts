import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { runCli } from "../src/cli/run.js";
import { buildProductPayload } from "../src/core/product-payload.js";

function fieldValue(result: ReturnType<typeof buildProductPayload>, name: string): unknown {
  const field = result.fields.find((candidate) => candidate.name === name);
  assert.ok(field, `missing audit field ${name}`);
  return field.value;
}

function sdkFields(result: ReturnType<typeof buildProductPayload>): Record<string, unknown> {
  return result.sdkInput.product.fields as Record<string, unknown>;
}

const shoeDraft = {
  code: "204426140121-test8",
  title: "巴拉巴拉童鞋儿童运动鞋男童2026新款冬季趣味旋钮扣",
  tradeId: "546",
  productId: "6518125",
  productType: "shoe",
  shoeSizes: true,
  date: "2026-09-04",
  retailPrice: 359.9,
  sizeRemarks: {
    "26码": "脚长15.8-16.2/内长17",
    "27码": "脚长16.3-16.7/内长17.7",
  },
  fields: [
    { field_name: "颜色", field_type: "TEXT", value_text: "蓝色,蓝色调00388" },
    { field_name: "尺码", field_type: "MULTI_CHOICE", value_text: "26;27" },
    {
      field_name: "尺码表",
      field_type: "MULTI_TEXT",
      value_json: {
        title: "尺码,适合脚长,内长",
        "26": "15.8,17",
        "27": "16.3,17.7",
      },
    },
    {
      field_name: "唯品会尺码表",
      field_type: "MULTI_TEXT",
      value_json: {
        title: "欧洲码,脚长,鞋内长",
        "26": "26,15.8,17",
        "27": "27,16.3,17.7",
      },
    },
    {
      field_name: "天猫尺码表",
      field_type: "MULTI_TEXT",
      value_json: {
        title: "脚长,鞋内长",
        "26": "15.8,17",
        "27": "16.3,17.7",
      },
    },
    {
      field_name: "抖音尺码表",
      field_type: "MULTI_TEXT",
      value_json: {
        title: "脚长(cm),备注",
        "26": "15.8,脚长15.8-16.2/内长17",
        "27": "16.3,脚长16.3-16.7/内长17.7",
      },
    },
    {
      field_name: "多平台尺码",
      field_type: "MULTI_TEXT",
      value_json: {
        title: "京东,拼多多,微信视频小店",
        "26": "26,26,26",
        "27": "27,27,27",
      },
    },
    { name: "商品详情", value: "轻质防滑户外鞋" },
    {
      field_name: "淘宝尺码表",
      field_type: "MULTI_TEXT",
      value_json: { title: "脚长", "26": "15.8" },
    },
  ],
  skus: [
    {
      skuCode: "sku-26",
      skcCode: "skc-00388",
      color: "蓝色调00388",
      size: "26",
      barcode: "690000000026",
      sellerCode: "seller-26",
      price: 359.9,
    },
    {
      skuCode: "sku-27",
      skcCode: "skc-00388",
      color: "蓝色调00388",
      size: "27",
      barcode: "690000000027",
      sellerCode: "seller-27",
      price: 359.9,
    },
  ],
};

const apparelDraft = {
  code: "202426107129",
  title: "巴拉巴拉儿童羽绒服",
  tradeId: "107",
  productId: "6514504",
  productType: "apparel",
  garmentType: "上装",
  date: "2026-09-04",
  retailPrice: 499,
  sizeRemarks: {
    "140cm": "充绒量32g",
    "150cm": "充绒量37g",
  },
  fields: [
    { field_name: "颜色", field_type: "TEXT", value_text: "粉红,粉红调" },
    { field_name: "尺码", field_type: "MULTI_CHOICE", value_text: "140;150" },
    {
      field_name: "尺码表",
      field_type: "MULTI_TEXT",
      value_json: {
        title: "尺码,尺码,衣长,肩宽,胸围,袖长,身高,体重",
        "140": "140,140,51.5,0,88,48.5,140,0",
        "150": "150,150,55,,92,51,150,0",
      },
    },
    {
      field_name: "多平台尺码",
      field_type: "MULTI_TEXT",
      value_json: {
        title: "天猫,京东,拼多多,微信视频小店,小红书,快手",
        "140": "140,140,140,140,140,140",
        "150": "150,150,150,150,150,150",
      },
    },
    {
      field_name: "唯品会尺码表",
      field_type: "MULTI_TEXT",
      value_json: {
        title: "尺码,衣长,胸围",
        "140": "140,51.5,88",
        "150": "150,55,92",
      },
    },
  ],
  skus: [
    {
      skuCode: "apparel-140",
      skcCode: "skc-pink",
      color: "粉红调",
      size: "140",
      barcode: "69000000140",
      sellerCode: "seller-140",
      price: 499,
    },
    {
      skuCode: "apparel-150",
      skcCode: "skc-pink",
      color: "粉红调",
      size: "150",
      barcode: "69000000150",
      sellerCode: "seller-150",
      price: 499,
    },
  ],
};

test("Balabala shoe payload uses integer sale sizes, aliases, remarks, and six platform columns", () => {
  const result = buildProductPayload(shoeDraft, { stage: "create" });
  const fields = sdkFields(result);

  assert.equal(result.ok, true);
  assert.equal(result.tenant, "电商巴拉巴拉");
  assert.equal(result.merchantId, "1162");
  assert.deepEqual(result.query, { merchantId: "1162", tradeId: "546" });
  assert.equal(fields["尺码"], "26码*脚长15.8-16.2/内长17;27码*脚长16.3-16.7/内长17.7");
  assert.deepEqual(result.sizes, {
    options: ["26", "27"],
    optionAliases: { "26": "26码", "27": "27码" },
    texts: [
      "s26,26码",
      "s26,,天猫",
      "s26,26,京东",
      "s26,26码（脚长15.8-16.2/内长17）,拼多多",
      "s26,26码（脚长15.8-16.2/内长17）,微信视频小店",
      "s26,26码（脚长15.8-16.2/内长17）,小红书",
      "s26,,快手",
      "s27,27码",
      "s27,,天猫",
      "s27,27,京东",
      "s27,27码（脚长16.3-16.7/内长17.7）,拼多多",
      "s27,27码（脚长16.3-16.7/内长17.7）,微信视频小店",
      "s27,27码（脚长16.3-16.7/内长17.7）,小红书",
      "s27,,快手",
    ],
  });
  assert.deepEqual(fields["尺码表"], {
    title: "脚长,鞋内长",
    "26码": "15.8,17",
    "27码": "16.3,17.7",
  });
  assert.deepEqual(fields["多平台尺码"], {
    title: "天猫,京东,拼多多,微信视频小店,小红书,快手",
    "26码": ",26,26码(脚长15.8-16.2/内长17),26码(脚长15.8-16.2/内长17),26码(脚长15.8-16.2/内长17),",
    "27码": ",27,27码(脚长16.3-16.7/内长17.7),27码(脚长16.3-16.7/内长17.7),27码(脚长16.3-16.7/内长17.7),",
  });
  assert.deepEqual(fieldValue(result, "尺码表"), {
    title: "尺码,脚长,鞋内长",
    "26码": "26码,15.8,17",
    "27码": "27码,16.3,17.7",
  });
  assert.equal(fields["唯品会尺码表"], undefined);
  assert.equal(fields["淘宝尺码表"], undefined);
  assert.ok(result.diagnostics.warnings.some((warning) => warning.includes("淘宝尺码表")));
  assert.deepEqual(result.sdkInput.product.fields, fields);
});

test("Balabala apparel payload keeps cm display identities, bare table values, and blank missing measurements", () => {
  const result = buildProductPayload(apparelDraft, { stage: "update" });
  const fields = sdkFields(result);

  assert.equal(result.ok, true);
  assert.equal(fields["尺码"], "140cm*充绒量32g;150cm*充绒量37g");
  assert.deepEqual(result.sizes.optionAliases, { "140": "140cm", "150": "150cm" });
  assert.deepEqual(fields["尺码表"], {
    title: "尺码,尺码,衣长,肩宽,胸围,袖长,身高,体重",
    "140cm": "140cm,140,51.5,,88,48.5,140,31",
    "150cm": "150cm,150,55,,92,51,150,37",
  });
  assert.deepEqual(fields["多平台尺码"], {
    title: "天猫,京东,拼多多,微信视频小店,小红书,快手",
    "140cm": ",140,,,,",
    "150cm": ",150,,,,",
  });
  assert.match(result.sizes.texts.join("\n"), /s140,140cm（充绒量32g）,拼多多/);
  assert.match(result.sizes.texts.join("\n"), /s140,140,京东/);
  assert.doesNotMatch(JSON.stringify(fields["尺码表"]), /(?:^|,)0(?:,|$)/);
});

test("create and update expose the stable field sets without shrinking SKU or stable size tables", () => {
  const create = buildProductPayload(shoeDraft, { stage: "create" });
  const update = buildProductPayload(shoeDraft, { stage: "update" });
  const createNames = Object.keys(create.sdkInput.product.fields as Record<string, unknown>);
  const updateNames = Object.keys(update.sdkInput.product.fields as Record<string, unknown>);

  assert.ok(createNames.includes("尺码"));
  assert.ok(createNames.includes("尺码表"));
  assert.ok(createNames.includes("多平台尺码"));
  assert.ok(!createNames.includes("唯品会尺码表"));
  assert.ok(updateNames.includes("尺码表"));
  assert.ok(updateNames.includes("唯品会尺码表"));
  assert.ok(updateNames.includes("天猫尺码表"));
  assert.ok(updateNames.includes("抖音尺码表"));
  assert.ok(updateNames.includes("多平台尺码"));
  assert.ok(updateNames.includes("商家SKU"));
  assert.equal(update.skus.length, 2);
  assert.equal(update.legacyUpdateFields.length, update.fields.length);
  assert.deepEqual(update.query, { productId: "6518125" });
  assert.deepEqual(update.sdkInput.query, { productId: "6518125" });
  assert.ok(!update.diagnostics.warnings.some((warning) => warning.includes("省略多平台尺码")));
});

test("full update sends multi-platform size rows by default", () => {
  const update = buildProductPayload(shoeDraft, { stage: "update" });
  assert.ok(Object.hasOwn(sdkFields(update), "多平台尺码"));
});

test("full update can explicitly omit multi-platform size rows for a confirmed incompatible template", () => {
  const update = buildProductPayload({ ...shoeDraft, includeMultiPlatformSizeOnUpdate: false }, { stage: "update" });
  assert.equal(Object.hasOwn(sdkFields(update), "多平台尺码"), false);
  assert.ok(update.diagnostics.warnings.some((warning) => warning.includes("includeMultiPlatformSizeOnUpdate=false")));
});

test("merchant SKU tables use the sale-colour alias key, not the display enum, including historical buckets", () => {
  const result = buildProductPayload({
    ...shoeDraft,
    fields: shoeDraft.fields.map((field) => field.field_name === "商家SKU"
      ? { ...field, value_json: { title: "价格", "蓝色,蓝色调00388": { "26码": "359.9" } } }
      : field),
  }, { stage: "update" });
  const merchantSku = sdkFields(result)["商家SKU"] as Record<string, unknown>;
  assert.deepEqual(Object.keys(merchantSku).sort(), ["title", "蓝色调00388"]);
  assert.ok(!Object.hasOwn(merchantSku, "蓝色,蓝色调00388"));
});

test("explicitly disabling multi-platform sizes omits the field from the SDK payload", () => {
  const result = buildProductPayload({
    ...shoeDraft,
    includeMultiPlatformSizeField: false,
  }, { stage: "create" });

  assert.equal(result.ok, true);
  assert.equal(Object.hasOwn(sdkFields(result), "多平台尺码"), false);
  assert.equal(result.diagnostics.warnings.some((warning) => warning.includes("省略多平台尺码")), true);
});

test("stage-specific identifiers are required and shoe half sizes are rejected", () => {
  const missingTrade = buildProductPayload({ ...shoeDraft, tradeId: "" }, { stage: "create" });
  assert.equal(missingTrade.ok, false);
  assert.match(missingTrade.diagnostics.errors.join("\n"), /requires tradeId/);

  const missingProduct = buildProductPayload({ ...shoeDraft, productId: "" }, { stage: "update" });
  assert.equal(missingProduct.ok, false);
  assert.match(missingProduct.diagnostics.errors.join("\n"), /requires productId/);

  const halfSize = buildProductPayload({
    ...shoeDraft,
    fields: shoeDraft.fields.map((field) => (
      field.field_name === "尺码" ? { ...field, value_text: "26;26.5;27" } : field
    )),
    skus: shoeDraft.skus.map((sku) => (
      sku.skuCode === "sku-26" ? { ...sku, size: "26.5" } : sku
    )),
  }, { stage: "create" });
  assert.equal(halfSize.sizes.options.includes("26.5"), false);
  assert.ok(halfSize.diagnostics.warnings.some((warning) => warning.includes("半码")));
  assert.ok(halfSize.diagnostics.errors.some((error) => error.includes("26.5")));
});

test("product payload CLI reads only the local input and never config, credentials, network, or Java", async () => {
  const directory = await mkdtemp(join(tmpdir(), "deepdraw-cli-payload-"));
  try {
    const inputPath = join(directory, "draft.json");
    await writeFile(inputPath, JSON.stringify(shoeDraft), "utf8");
    let fetched = false;
    let credentialsRead = false;
    const result = await runCli(["product", "payload", "--input", "draft.json", "--stage", "create", "--pretty"], {
      cwd: directory,
      env: {},
      stdin: "",
      fetchImpl: async () => {
        fetched = true;
        return new Response("{}", { status: 200 });
      },
      credentialStore: {
        get: async () => {
          credentialsRead = true;
          throw new Error("payload build must not read credentials");
        },
        set: async () => undefined,
      },
      javaSpawnImpl: async () => {
        throw new Error("payload build must not spawn Java");
      },
    });

    assert.equal(result.exitCode, 0);
    assert.equal(result.stderr, "");
    assert.equal(fetched, false);
    assert.equal(credentialsRead, false);
    assert.match(result.stdout, /\n  "sdkInput":/);
    const payload = JSON.parse(result.stdout) as Record<string, unknown>;
    assert.equal(payload.command, "deepdraw product payload");
    assert.equal(payload.stage, "create");
    assert.deepEqual((payload as { sdkInput: { config: Record<string, unknown> } }).sdkInput.config, {
      merchantId: "1162",
      tradeId: "546",
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

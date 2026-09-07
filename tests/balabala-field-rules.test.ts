import assert from "node:assert/strict";
import { test } from "node:test";
import { reviewBalabalaFields } from "../src/core/balabala-field-rules.js";

const templateFields = [
  {
    field_id: "color",
    field_name: "颜色",
    field_type: "MULTI_CHOICE",
    required: true,
    sale_prop: true,
    options_json: ["蓝色,蓝色调00388", "粉红,粉红调"],
  },
  {
    field_id: "size",
    field_name: "尺码",
    field_type: "MULTI_CHOICE",
    sale_prop: true,
    options_json: ["26", "27"],
  },
  { field_id: "chart", field_name: "尺码表", field_type: "MULTI_TEXT" },
  { field_id: "style", field_name: "款式", field_type: "SINGLE_CHOICE", required: true, options_json: ["运动鞋", "凉鞋"] },
  {
    field_id: "closure",
    field_name: "闭合方式",
    field_type: "SINGLE_CHOICE",
    required: true,
    options_json: ["系带", "粘扣带"],
    raw_payload_json: {
      attributes: { isChildAttr: true, parentAttr: ["款式"], parentAttrValue: "运动鞋" },
    },
  },
  { field_id: "price", field_name: "价格", field_type: "TEXT", required: true },
];

const shoeSizeChart = {
  source: "shoe_size_chart",
  rows: [
    { size: "26", footLength: "15.8", innerLength: "17" },
    { size: "27", footLength: "16.3", innerLength: "17.7" },
  ],
};

function shoeInput(overrides: Record<string, unknown> = {}) {
  return {
    productType: "shoe",
    templateFields,
    sizeChart: shoeSizeChart,
    fields: [
      { field_name: "颜色", field_type: "MULTI_CHOICE", value_text: "蓝色,蓝色调00388", source_type: "mdm" },
      { field_name: "尺码", field_type: "MULTI_CHOICE", value_text: "26;27", source_type: "mdm" },
      {
        field_name: "尺码表",
        field_type: "MULTI_TEXT",
        value_json: { title: "尺码,脚长,鞋内长", "26": "26,15.8,17", "27": "27,16.3,17.7" },
        source_type: "shoe_size_chart",
      },
      { field_name: "款式", field_type: "SINGLE_CHOICE", value_text: "运动鞋", source_type: "copywriting" },
      { field_name: "闭合方式", field_type: "SINGLE_CHOICE", value_text: "系带", source_type: "reference_images" },
      { field_name: "价格", field_type: "TEXT", value_text: "359.9", source_type: "launch_plan" },
    ],
    skus: [
      { skuCode: "sku-26", color: "蓝色调00388", size: "26" },
      { skuCode: "sku-27", color: "蓝色调00388", size: "27" },
    ],
    ...overrides,
  };
}

test("review only retains active current-template fields and exposes the source contract", () => {
  const result = reviewBalabalaFields(shoeInput({
    fields: [
      ...shoeInput().fields as unknown[],
      { field_name: "旧类目遗留字段", field_type: "TEXT", value_text: "不得提交" },
    ],
  }));

  assert.equal(result.ok, true);
  assert.equal(result.kind, "shoe");
  assert.deepEqual(result.submissionFields.map((field) => field.field_name), ["颜色", "尺码", "尺码表", "款式", "闭合方式", "价格"]);
  assert.ok(result.diagnostics.warnings.some((message) => message.includes("旧类目遗留字段")));
  assert.deepEqual(result.inputContract.requiredEvidence.sizeChart, ["shoe_size_chart"]);
  assert.deepEqual(result.inputContract.ai.minimumConfidence, 0.7);
});

test("review deactivates a required child field when its parent option does not apply", () => {
  const input = shoeInput({
    fields: shoeInput().fields.map((field) => {
      if ((field as { field_name: string }).field_name === "款式") return { ...field as object, value_text: "凉鞋" };
      if ((field as { field_name: string }).field_name === "闭合方式") return { ...field as object, value_text: "" };
      return field;
    }),
  });
  const result = reviewBalabalaFields(input);

  assert.equal(result.ok, true);
  assert.equal(result.fields.find((field) => field.fieldName === "闭合方式")?.active, false);
  assert.equal(result.submissionFields.some((field) => field.field_name === "闭合方式"), false);
});

test("review blocks missing sale attributes and unverified shoe-size evidence", () => {
  const result = reviewBalabalaFields(shoeInput({
    sizeChart: { source: "ai", rows: [] },
    fields: shoeInput().fields.filter((field) => (field as { field_name: string }).field_name !== "尺码"),
  }));

  assert.equal(result.ok, false);
  assert.match(result.diagnostics.errors.join("\n"), /销售属性 尺码/);
  assert.match(result.diagnostics.errors.join("\n"), /鞋品尺码表只能来自匹配的鞋品尺码数据/);
});

test("review blocks a main size table that omits an existing SKU size", () => {
  const result = reviewBalabalaFields(shoeInput({
    fields: shoeInput().fields.map((field) => (
      (field as { field_name: string }).field_name === "尺码表"
        ? {
            ...field as object,
            value_json: { title: "尺码,脚长,鞋内长", "26": "26,15.8,17" },
          }
        : field
    )),
  }));

  assert.equal(result.ok, false);
  assert.match(result.diagnostics.errors.join("\n"), /尺码表.*SKU 尺码.*27/);
});

test("review accepts only safe high-confidence AI enum candidates and preserves manual facts", () => {
  const result = reviewBalabalaFields(shoeInput({
    fields: shoeInput().fields.map((field) => {
      if ((field as { field_name: string }).field_name === "闭合方式") return { ...field as object, value_text: "", source_type: "skip" };
      if ((field as { field_name: string }).field_name === "款式") return { ...field as object, manual_override: true };
      return field;
    }),
    aiResponses: [
      { fieldName: "闭合方式", value: "粘扣带", confidence: 0.91, evidence: ["reference_images"] },
      { fieldName: "价格", value: "199", confidence: 0.99, evidence: ["reference_images"] },
      { fieldName: "款式", value: "凉鞋", confidence: 0.99, evidence: ["reference_images"] },
    ],
  }));

  assert.equal(result.ok, true);
  assert.equal(result.fields.find((field) => field.fieldName === "闭合方式")?.valueText, "粘扣带");
  assert.equal(result.fields.find((field) => field.fieldName === "闭合方式")?.sourceType, "ai");
  assert.ok(result.diagnostics.warnings.some((message) => message.includes("价格") && message.includes("AI")));
  assert.ok(result.diagnostics.warnings.some((message) => message.includes("款式") && message.includes("人工")));
});

test("review rejects AI size charts, non-enum values, low confidence, and invalid image evidence", () => {
  const result = reviewBalabalaFields(shoeInput({
    fields: shoeInput().fields.map((field) => (
      (field as { field_name: string }).field_name === "闭合方式" ? { ...field as object, value_text: "" } : field
    )),
    aiResponses: [
      { fieldName: "尺码表", value: "编造尺码", confidence: 0.99, evidence: ["reference_images"] },
      { fieldName: "闭合方式", value: "拉链", confidence: 0.99, evidence: ["reference_images"] },
      { fieldName: "闭合方式", value: "系带", confidence: 0.69, evidence: ["reference_images"] },
    ],
    referenceImages: [
      { role: "model_image", mimeType: "image/jpeg", bytes: 100 },
      { role: "flat_image", mimeType: "image/png", bytes: 100 },
      { role: "hangtag", mimeType: "application/pdf", bytes: 100 },
      { role: "washlabel", mimeType: "image/webp", bytes: 4 * 1024 * 1024 + 1 },
    ],
  }));

  assert.equal(result.ok, false);
  assert.match(result.diagnostics.errors.join("\n"), /闭合方式/);
  assert.ok(result.diagnostics.warnings.some((message) => message.includes("尺码表") && message.includes("AI")));
  assert.ok(result.diagnostics.warnings.some((message) => message.includes("置信度")));
  assert.deepEqual(result.aiContext.referenceImages.map((image) => image.role), ["flat_image", "model_image"]);
  assert.equal(result.aiContext.rejectedImages.length, 2);
});

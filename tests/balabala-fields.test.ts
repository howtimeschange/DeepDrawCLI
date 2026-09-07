import assert from "node:assert/strict";
import { test } from "node:test";
import { buildBalabalaFields } from "../src/brands/balabala/fields.js";

const context = {
  spu: "204426140121",
  mdm: { title: "儿童户外鞋" },
  launchPlan: { retailPrice: "359.9", launchDate: "2026-09-04", gender: "男", category: "运动鞋", subcategory: "户外鞋", productLine: "鞋品" },
  copywriting: { rows: [{ title: "巴拉巴拉儿童户外运动鞋", vipTitle: "巴拉巴拉儿童户外鞋", guideTitle: "巴拉巴拉男童户外鞋" }] },
  skus: [
    { color: "白绿色调00414", size: "26", skuCode: "2044261401210041426", barcode: "a", sellerCode: "a", price: "359.9" },
    { color: "蓝色调00388", size: "26", skuCode: "2044261401210038826", barcode: "b", sellerCode: "b", price: "359.9" },
  ],
};

test("builds template-valid colors, sale sizes, merchant SKU and platform price fields", () => {
  const fields = buildBalabalaFields(context, { fields: [
    { fieldId: "color", fieldName: "颜色", fieldType: "MULTI_CHOICE", saleProp: true, options: ["绿色,白绿色调00414", "蓝色,蓝色调00388"] },
    { fieldId: "size", fieldName: "尺码", fieldType: "MULTI_CHOICE", saleProp: true, options: ["26"] },
    { fieldId: "sku", fieldName: "商家SKU", fieldType: "MULTI_TEXT", options: ["价格", "货号", "商家编码", "条形码", "拼多多单买价", "拼多多团购价"] },
    { fieldId: "title", fieldName: "商品展示标题", fieldType: "TEXT", required: true },
    { fieldId: "pdd", fieldName: "拼多多单买价", fieldType: "TEXT" },
  ] });
  assert.equal(fields.find((field) => field.fieldName === "颜色")?.valueText, "绿色,白绿色调00414;蓝色,蓝色调00388");
  assert.equal(fields.find((field) => field.fieldName === "尺码")?.valueText, "26码");
  assert.equal(fields.find((field) => field.fieldName === "拼多多单买价")?.valueText, "358.9");
  assert.deepEqual(fields.find((field) => field.fieldName === "商家SKU")?.valueJson, {
    title: "价格,货号,商家编码,条形码,拼多多单买价,拼多多团购价",
    "绿色,白绿色调00414,26码": "359.9,2044261401210041426,a,a,358.9,357.9",
    "蓝色,蓝色调00388,26码": "359.9,2044261401210038826,b,b,358.9,357.9",
  });
});

test("marks unsupported special fields manual-required instead of synthesizing them", () => {
  const fields = buildBalabalaFields(context, { fields: [{ fieldName: "淘宝SKU参数", fieldType: "TEXT", required: true }] });
  assert.equal(fields[0]?.validationStatus, "missing");
  assert.equal(fields[0]?.staleReason, "manual_required_special_format");
});

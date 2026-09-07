import assert from "node:assert/strict";
import { test } from "node:test";
import { compareBalabalaReadback, hydrateBalabalaRemoteDraft, prepareBalabalaExistingUpdate } from "../src/brands/balabala/readback.js";

const local = {
  fields: {
    商品展示标题: "新标题",
    颜色: "蓝色,蓝色调00388",
    尺码: "26码",
    商家SKU: { title: "价格", "蓝色,蓝色调00388,26码": "359.9" },
    尺码表: { title: "脚长,鞋内长", "26码": "15.8,17" },
  },
};

test("blocks a full update if no remote SKU key intersects", () => {
  const protectedPayload = prepareBalabalaExistingUpdate(local, { fields: { 商家SKU: { title: "价格", "红色,红色调001,26码": "359.9" } } });
  assert.equal(protectedPayload.blocking[0]?.code, "sku_intersection_required");
});

test("marks absent structured readback as UI verification instead of verified", () => {
  const result = compareBalabalaReadback(local, { fields: { 商品展示标题: "新标题", 颜色: "蓝色,蓝色调00388", 尺码: "26码", 商家SKU: { title: "价格", "蓝色,蓝色调00388,26码": "359.9" } } });
  assert.equal(result.status, "needs_ui_verification");
  assert.equal(result.mismatches.length, 0);
  assert.deepEqual(result.uiVerification, ["尺码表"]);
});

test("hydrates DeepDraw form fields plus sale colors and sizes without inventing values", () => {
  const draft = hydrateBalabalaRemoteDraft({
    productId: 6515908,
    id: "ed18698170c54da4baa88541d66e3536",
    code: "204426140121-test",
    title: "巴拉巴拉男中童运动鞋",
    trade: { id: "10175", path: "所有行业.母婴.童鞋/亲子鞋.男童鞋.运动鞋" },
    fields: [{ field: { id: "32352", name: "商品展示标题", type: "TEXT" }, texts: ["巴拉巴拉男中童运动鞋"], options: [] }],
    colors: { field: { id: "2040", type: "MULTI_CHOICE" }, optionAliases: { 蓝色: "蓝色调00388", 绿色: "白绿色调00414" }, options: ["蓝色", "绿色"] },
    sizes: { field: { id: "2398", type: "MULTI_CHOICE" }, optionAliases: { "26": "26", "27": "27" }, options: ["26", "27"] },
  });
  const fields = Object.fromEntries((draft.fields as Array<Record<string, unknown>>).map((field) => [field.field_name, field.value_text]));
  assert.equal(draft.productId, "6515908");
  assert.equal(draft.resourceId, "ed18698170c54da4baa88541d66e3536");
  assert.equal(fields.商品展示标题, "巴拉巴拉男中童运动鞋");
  assert.equal(fields.颜色, "蓝色,蓝色调00388;绿色,白绿色调00414");
  assert.equal(fields.尺码, "26;27");
});

test("compares readback colors and sizes from their top-level form resources", () => {
  const result = compareBalabalaReadback(
    { fields: { 商品展示标题: "原标题", 颜色: "蓝色,蓝色调00388", 尺码: "26" } },
    {
      fields: [{ field: { name: "商品展示标题", type: "TEXT" }, texts: ["原标题"] }],
      colors: { field: { type: "MULTI_CHOICE" }, optionAliases: { 蓝色: "蓝色调00388" }, options: ["蓝色"] },
      sizes: { field: { type: "MULTI_CHOICE" }, options: ["26"] },
    },
  );
  assert.equal(result.status, "readback_verified");
});

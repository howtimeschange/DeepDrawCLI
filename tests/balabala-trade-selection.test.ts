import assert from "node:assert/strict";
import { test } from "node:test";
import { selectBalabalaTrade } from "../src/brands/balabala/trade-selection.js";

const context = {
  launchPlan: {
    officialTrade: "童鞋/婴儿鞋/亲子鞋>>运动鞋",
    vipTrade: "儿童运动鞋",
    vipStyle: "运动休闲鞋",
    douyinTrade: "鞋靴箱包>鞋靴>童鞋>休闲鞋",
    category: "运动鞋",
    subcategory: "户外鞋",
    ageBand: "中童",
    sizeRange: "26-40",
  },
  skus: [{ size: "26" }, { size: "40" }],
};

test("selects an exact child-shoe sports leaf with required platforms and sizes", () => {
  const result = selectBalabalaTrade(context, [
    { tradeId: "546", tradePath: "童鞋/婴儿鞋/亲子鞋>>运动鞋", sites: ["Alibaba", "PDD", "Taobao", "Kuaishou", "VIP", "Douyin"], sizeOptions: ["26", "40"] },
    { tradeId: "900", tradePath: "童鞋/婴儿鞋/亲子鞋>>凉鞋", sites: ["Alibaba", "PDD", "Taobao", "Kuaishou", "VIP", "Douyin"], sizeOptions: ["26", "40"] },
  ]);
  assert.equal(result.selected?.tradeId, "546");
  assert.equal(result.manualSelectionRequired, false);
});

test("requires manual selection for a tied or platform-incomplete candidate", () => {
  const result = selectBalabalaTrade(context, [
    { tradeId: "1", tradePath: "童鞋/亲子鞋>>运动鞋", sites: ["Alibaba", "PDD", "Taobao", "Kuaishou"], sizeOptions: ["26", "40"] },
    { tradeId: "2", tradePath: "童鞋/亲子鞋>>运动鞋", sites: ["Alibaba", "PDD", "Taobao", "Kuaishou", "VIP", "Douyin"], sizeOptions: ["26"] },
  ]);
  assert.equal(result.selected, undefined);
  assert.equal(result.manualSelectionRequired, true);
  assert.ok(result.reasons.some((reason) => /平台|尺码/.test(reason)));
});

test("uses full tradePath ahead of a same-named leaf when trees are flattened", () => {
  const result = selectBalabalaTrade(context, [
    { id: "10175", name: "运动鞋", tradePath: "童鞋/亲子鞋>>男童鞋>>运动鞋" },
    { id: "10191", name: "运动鞋", tradePath: "童鞋/亲子鞋>>女童鞋>>运动鞋" },
    { id: "546", name: "运动鞋", tradePath: "童鞋/亲子鞋>>运动鞋" },
  ]);
  assert.equal(result.selected?.tradeId, "546");
  assert.equal(result.manualSelectionRequired, false);
});

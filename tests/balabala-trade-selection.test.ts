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

test("ports Listingify child-apparel context tie breaks for down jackets and long pants", () => {
  const candidates = [
    { id: "27", name: "羽绒服", tradePath: "女装>>羽绒服" },
    { id: "629", name: "羽绒服", tradePath: "童装婴幼儿服装>>羽绒服" },
    { id: "9652", name: "羽绒服", tradePath: "童装婴幼儿服装>>中大童>>羽绒服" },
    { id: "9680", name: "羽绒服", tradePath: "童装婴幼儿服装>>男童>>羽绒服" },
  ];
  const down = selectBalabalaTrade({
    launchPlan: { officialTrade: "童装/婴儿装/亲子装>>羽绒服饰/羽绒内胆>>羽绒服", category: "羽绒服", subcategory: "中羽绒服", gender: "男", ageBand: "中童", sizeRange: "140-180" },
    skus: [{ size: "140" }],
  }, candidates);
  assert.equal(down.selected?.tradeId, "9680");
  const pants = selectBalabalaTrade({
    launchPlan: { category: "长裤", subcategory: "针织长裤", vipTrade: "儿童裤子", douyinTrade: "服饰内衣>服饰>童装>休闲裤", gender: "男", ageBand: "中童", sizeRange: "110-175" },
    skus: [{ size: "110" }],
  }, [
    { id: "10962", name: "长裤", tradePath: "童装婴幼儿服装>>中性童装>>长裤" },
    { id: "9659", name: "长裤", tradePath: "童装婴幼儿服装>>中大童>>长裤" },
    { id: "9685", name: "长裤", tradePath: "童装婴幼儿服装>>男童>>长裤" },
  ]);
  assert.equal(pants.selected?.tradeId, "9685");
});

test("lets specific denim evidence outrank a generic official pants leaf", () => {
  const result = selectBalabalaTrade({
    launchPlan: { officialTrade: "童装/婴儿装/亲子装>>裤子", category: "长裤", subcategory: "牛仔长裤", vipTrade: "儿童裤子", douyinTrade: "服饰内衣>服饰>童装>牛仔裤", gender: "女", ageBand: "中童", sizeRange: "140-175" },
    skus: [{ size: "140" }],
  }, [
    { id: "72", name: "裤子", tradePath: "童装婴幼儿服装>>裤子" },
    { id: "11740", name: "牛仔裤", tradePath: "童装婴幼儿服装>>中大童>>牛仔裤" },
  ]);
  assert.equal(result.selected?.tradeId, "11740");
  assert.equal(result.manualSelectionRequired, false);
});

test("uses Listingify priority roots when a complete DeepDraw hierarchy is available", () => {
  const result = selectBalabalaTrade({
    tenantName: "电商巴拉巴拉",
    launchPlan: { officialTrade: "童装婴幼儿服装>>男童>>羽绒服", category: "羽绒服", gender: "男" },
    skus: [{ size: "140" }],
  }, [
    { id: "adult", tradePath: "女装>>羽绒服", ancestorIds: ["adult"] },
    { id: "9680", tradePath: "童装婴幼儿服装>>男童>>羽绒服", ancestorIds: ["7", "9680"] },
    { id: "private", tradePath: "blbl&mini>>羽绒服", ancestorIds: ["9631", "private"] },
  ]);
  assert.equal(result.selected?.tradeId, "9680");
  assert.equal(result.candidates.find((item) => item.tradeId === "private")?.priorityTier, 99);
});

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

test("marks absent multi-platform readback as UI verification instead of verified", () => {
  const expected = { fields: { ...local.fields, 多平台尺码: { title: "天猫,京东", "26码": ",26" } } };
  delete expected.fields.尺码表;
  const result = compareBalabalaReadback(expected, { fields: { 商品展示标题: "新标题", 颜色: "蓝色,蓝色调00388", 尺码: "26码", 商家SKU: { title: "价格", "蓝色,蓝色调00388,26码": "359.9" } } });
  assert.equal(result.status, "needs_ui_verification");
  assert.equal(result.mismatches.length, 0);
  assert.deepEqual(result.uiVerification, ["多平台尺码"]);
});

test("treats an absent primary size table as a mismatch, while canonicalizing sale-colour SKU aliases", () => {
  const missingTable = compareBalabalaReadback(local, { fields: { 商品展示标题: "新标题", 颜色: "蓝色,蓝色调00388", 尺码: "26码", 商家SKU: { title: "价格", "蓝色调00388": { "26": "359.9" } } } });
  assert.equal(missingTable.status, "readback_mismatch");
  assert.ok(missingTable.mismatches.some((item) => item.field === "尺码表"));
  assert.equal(missingTable.mismatches.some((item) => item.field === "商家SKU"), false);
});

test("hydrates DeepDraw form fields plus sale colors and sizes without inventing values", () => {
  const draft = hydrateBalabalaRemoteDraft({
    productId: 6515908,
    id: "ed18698170c54da4baa88541d66e3536",
    code: "204426140121-test",
    title: "巴拉巴拉男中童运动鞋",
    trade: { id: "10175", path: "所有行业.母婴.童鞋/亲子鞋.男童鞋.运动鞋" },
    fields: [
      { field: { id: "32352", name: "商品展示标题", type: "TEXT" }, texts: ["巴拉巴拉男中童运动鞋"], options: [] },
      { field: { id: "chart", name: "尺码表", type: "MULTI_TEXT" }, value_json: { title: "尺码,脚长", "26码": "26,15.8" } },
    ],
    colors: { field: { id: "2040", type: "MULTI_CHOICE" }, optionAliases: { 蓝色: "蓝色调00388", 绿色: "白绿色调00414" }, options: ["蓝色", "绿色"] },
    sizes: { field: { id: "2398", type: "MULTI_CHOICE" }, optionAliases: { "26": "26", "27": "27" }, options: ["26", "27"] },
  });
  const fields = Object.fromEntries((draft.fields as Array<Record<string, unknown>>).map((field) => [field.field_name, field.value_text]));
  assert.equal(draft.productId, "6515908");
  assert.equal(draft.resourceId, "ed18698170c54da4baa88541d66e3536");
  assert.equal(fields.商品展示标题, "巴拉巴拉男中童运动鞋");
  assert.equal(fields.颜色, "蓝色,蓝色调00388;绿色,白绿色调00414");
  assert.equal(fields.尺码, "26;27");
  assert.deepEqual((draft.fields as Array<Record<string, unknown>>).find((field) => field.field_name === "尺码表")?.value_json, { title: "尺码,脚长", "26码": "26,15.8" });
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

test("protects nested merchant-SKU color-and-size keys and normalizes structured readback fields", () => {
  const localNested = {
    fields: {
      商家SKU: { title: "价格,货号", "蓝色调00388": { "26码": "359.9,204426140121" } },
      尺码表: { title: "尺码,脚长", "26码": "26,15.8" },
    },
  };
  const unrelated = prepareBalabalaExistingUpdate(localNested, { fields: { 商家SKU: { title: "价格,货号", "蓝色调00388": { "27码": "359.9,204426140121" } } } });
  assert.equal(unrelated.blocking[0]?.code, "sku_intersection_required");
  const comparison = compareBalabalaReadback(localNested, {
    fields: [
      { field_name: "商家SKU", field_type: "MULTI_TEXT", value_json: { "蓝色调00388": { "26码": "359.9,204426140121" }, title: "价格,货号" } },
      { field_name: "尺码表", field_type: "MULTI_TEXT", value_json: { title: "尺码,脚长", "26码": "26,15.8" } },
    ],
  });
  assert.equal(comparison.status, "readback_verified");
});

test("real form tables and SKU cells verify values, not merely row identities", () => {
  const expected = {fields:{颜色:"蓝色,蓝色调00388",商家SKU:{title:"价格,零售价",蓝色调00388:{"26码":"359.9,359.9"}},唯品会尺码表:{title:"脚长,鞋内长","26码":"160,170.32"},功能:"防滑;耐磨"}};
  const remote = {fields:[{field:{name:"功能",type:"MULTI_CHOICE"},texts:["耐磨","防滑"]}],colors:{options:["蓝色"],optionAliases:{蓝色:"蓝色调00388"}},sizeTables:[{field:{name:"唯品会尺码表"},sizeTableItems:[{size:"26",values:{脚长:"160",鞋内长:"170.32"}}]}],skus:{skuItems:[{color:"蓝色",size:"26",values:{价格:"359.9",零售价:"359.9"}}]}};
  assert.equal(compareBalabalaReadback(expected,remote).status,"readback_verified");
  remote.skus.skuItems[0].values.零售价="1";
  assert.ok(compareBalabalaReadback(expected,remote).mismatches.some(x=>x.field==="商家SKU"));
  remote.sizeTables[0].sizeTableItems[0].values.鞋内长="17.032";
  assert.ok(compareBalabalaReadback(expected,remote).mismatches.some(x=>x.field==="唯品会尺码表"));
  remote.skus.skuItems=[];
  assert.ok(compareBalabalaReadback(expected,remote).mismatches.some(x=>x.field==="商家SKU"));
});

test("omitted empty fields do not conceal missing nonempty fields",()=>{
  const result=compareBalabalaReadback({fields:{空值:"",品牌:"巴拉巴拉"}},{fields:[]});
  assert.deepEqual(result.mismatches.map(x=>x.field),["品牌"]);
});

test("quantity-price wire rows decode only valid numeric pairs",()=>{
  const remote=(texts:string[])=>({fields:[{field:{name:'价格区间',type:'MULTI_TEXT'},texts}]});
  assert.equal(compareBalabalaReadback({fields:{价格区间:'1,359.9'}},remote([':','1:359.9'])).status,'readback_verified');
  assert.equal(compareBalabalaReadback({fields:{价格区间:'1,359.9'}},remote([':','1:359.9:'])).status,'readback_mismatch');
  assert.equal(compareBalabalaReadback({fields:{价格区间:'1,359.9'}},remote([':','1:399.9'])).status,'readback_mismatch');
});

test("top-level form SKU projection preserves the full-update intersection gate",()=>{
 const remote={fields:[],colors:{options:['红色'],optionAliases:{红色:'红色调001'}},skus:{skuItems:[{color:'红色',size:'26',values:{价格:'359.9'}}]},sizeTables:[{field:{name:'尺码表',id:'table'},sizeTableItems:[{size:'26',values:{脚长:'16'}}]}]};
 const hydrated=hydrateBalabalaRemoteDraft(remote);
 assert.ok((hydrated.fields as Array<{field_name:string}>).some(x=>x.field_name==='尺码表'));
 assert.equal(prepareBalabalaExistingUpdate(local,remote).blocking[0]?.code,'sku_intersection_required');
});

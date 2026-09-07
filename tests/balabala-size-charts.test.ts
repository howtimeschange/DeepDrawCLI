import assert from "node:assert/strict";
import { test } from "node:test";
import { buildBalabalaSizeTables } from "../src/brands/balabala/size-charts.js";

const template = {
  fields: [
    { fieldName: "尺码表", fieldType: "MULTI_TEXT", options: ["尺码", "脚长", "鞋内长"] },
    { fieldName: "唯品会尺码表", fieldType: "MULTI_TEXT", options: ["欧洲码", "脚长", "鞋内长"] },
    { fieldName: "多平台尺码", fieldType: "MULTI_TEXT", options: ["天猫", "京东", "拼多多", "微信视频小店", "小红书", "快手"] },
  ],
};

test("builds sports-shoe tables only for actual integer SKU sizes", () => {
  const fields = buildBalabalaSizeTables({
    launchPlan: { productLine: "鞋品", category: "运动鞋", subcategory: "户外鞋" },
    skus: [{ size: "26" }, { size: "27" }],
    sizeChart: { source: "shoe_size_chart", group: "sport_leisure", rows: [
      { size: "26", footLength: "15.8-16.2", sportInnerLength: "17", sportRemark: "脚长15.8-16.2/内长17" },
      { size: "27", footLength: "16.3-16.7", sportInnerLength: "17.7", sportRemark: "脚长16.3-16.7/内长17.7" },
      { size: "28", footLength: "17", sportInnerLength: "18.4" },
    ] },
  }, template);
  const main = fields.find((field) => field.fieldName === "尺码表");
  const multi = fields.find((field) => field.fieldName === "多平台尺码");
  assert.deepEqual(main?.valueJson, { title: "尺码,脚长,鞋内长", "26码": "26,15.8-16.2,17", "27码": "27,16.3-16.7,17.7" });
  assert.equal(multi?.valueJson?.["26码"], ",26,26码（脚长15.8-16.2/内长17）,26码（脚长15.8-16.2/内长17）,26码（脚长15.8-16.2/内长17）,"
  );
});

test("blocks a sandal when structural visual evidence is absent", () => {
  const fields = buildBalabalaSizeTables({
    launchPlan: { productLine: "鞋品", category: "凉鞋" },
    skus: [{ size: "26" }],
    sizeChart: { source: "shoe_size_chart", rows: [{ size: "26", footLength: "15.8-16.2", sportInnerLength: "17" }] },
  }, template);
  assert.equal(fields.some((field) => field.staleReason === "needs_visual_classification"), true);
});

test("builds apparel upper tables with blank missing measurements and a kg reference", () => {
  const fields = buildBalabalaSizeTables({
    launchPlan: { productLine: "童装", category: "卫衣" },
    skus: [{ size: "140" }],
    plmSizeChart: { source: "plm_size_chart", rows: [{ size: "140", 衣长: "54", 肩宽: "35", 胸围: "78" }] },
  }, { fields: [{ fieldName: "尺码表", fieldType: "MULTI_TEXT", options: ["尺码", "衣长", "肩宽", "胸围", "袖长", "身高", "体重"] }] });
  assert.deepEqual(fields[0]?.valueJson, { title: "尺码,衣长,肩宽,胸围,袖长,身高,体重", "140cm": "140,54,35,78,,140,31kg" });
});

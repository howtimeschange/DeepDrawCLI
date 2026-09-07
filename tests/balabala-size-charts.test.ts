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

test("selects open and closed sandal tables and emits the Listingify shoe enums", () => {
  const sandalTemplate = {
    fields: [
      { fieldName: "尺码表", fieldType: "MULTI_TEXT", options: ["尺码", "脚长", "鞋内长"] },
      { fieldName: "25鞋子模板类型", fieldType: "SINGLE_CHOICE", options: ["运动", "休闲", "雪地靴", "婴童"] },
      { fieldName: "25鞋子尺码表", fieldType: "SINGLE_CHOICE", options: ["凉鞋", "镂空凉鞋", "包头凉鞋", "运动公主鞋"] },
      { fieldName: "22Q4-童鞋尺码表", fieldType: "SINGLE_CHOICE", options: ["凉鞋", "公主鞋"] },
      { fieldName: "尺码.", fieldType: "SINGLE_CHOICE", options: ["26码以下", "26-28码"] },
      { fieldName: "尺码类型", fieldType: "SINGLE_CHOICE", options: ["欧码（童鞋）"] },
    ],
  };
  const input = {
    launchPlan: { productLine: "鞋品", category: "凉鞋" },
    skus: [{ size: "26" }],
    sizeChart: { source: "shoe_size_chart", rows: [{ size: "26", footLength: "15.8-16.2", sportInnerLength: "17", openSandalInnerLength: "16.7", closedSandalInnerLength: "17.4" }] },
  };
  const open = buildBalabalaSizeTables({ ...input, sandalClassification: "前后空凉鞋" }, sandalTemplate);
  const closed = buildBalabalaSizeTables({ ...input, sandalClassification: "中空凉鞋（前后包鞋面）" }, sandalTemplate);
  assert.equal(open.find((field) => field.fieldName === "尺码表")?.valueJson?.["26码"], "26,15.8-16.2,16.7");
  assert.equal(closed.find((field) => field.fieldName === "尺码表")?.valueJson?.["26码"], "26,15.8-16.2,17.4");
  assert.equal(open.find((field) => field.fieldName === "25鞋子模板类型")?.valueText, "休闲");
  assert.equal(open.find((field) => field.fieldName === "25鞋子尺码表")?.valueText, "凉鞋");
  assert.equal(open.find((field) => field.fieldName === "22Q4-童鞋尺码表")?.valueText, "凉鞋");
  assert.equal(open.find((field) => field.fieldName === "尺码类型")?.valueText, "欧码（童鞋）");
});

test("builds apparel upper tables with blank missing measurements and Listingify's bare weight reference", () => {
  const fields = buildBalabalaSizeTables({
    launchPlan: { productLine: "童装", category: "卫衣" },
    skus: [{ size: "140" }],
    plmSizeChart: { source: "plm_size_chart", rows: [{ size: "140", 衣长: "54", 肩宽: "35", 胸围: "78" }] },
  }, { fields: [{ fieldName: "尺码表", fieldType: "MULTI_TEXT", options: ["尺码", "衣长", "肩宽", "胸围", "袖长", "身高", "体重"] }] });
  assert.deepEqual(fields[0]?.valueJson, { title: "尺码,衣长,肩宽,胸围,袖长,身高,体重", "140cm": "140,54,35,78,,140,31" });
});

test("builds every active apparel platform table from normalized PLM long rows", () => {
  const fields = buildBalabalaSizeTables({
    spu: "202426107129",
    launchPlan: { productLine: "童装", category: "牛仔裤", gender: "女" },
    skus: [{ size: "140" }],
    plmSizeChart: { source: "plm_size_chart", rows: [
      { 款号: "202426107129", 测量点: "裤长", 尺码: "140", 尺码值: "81" },
      { 款号: "202426107129", 测量点: "1/2腰围（平量）", 尺码: "140", 尺码值: "28" },
      { 款号: "202426107129", 测量点: "1/2臀围（平量）", 尺码: "140", 尺码值: "38" },
      { 款号: "202426107129", 测量点: "1/2脚口（平量）", 尺码: "140", 尺码值: "11" },
    ] },
  }, { fields: [
    { fieldName: "尺码表", fieldType: "MULTI_TEXT", options: ["尺码", "裤长", "腰围", "臀围", "脚口", "身高", "体重"] },
    { fieldName: "唯品会尺码表", fieldType: "MULTI_TEXT", options: ["号型", "裤长", "腰围", "臀围", "脚口", "前浪"] },
    { fieldName: "抖音尺码表", fieldType: "MULTI_TEXT", options: ["尺码", "体重(斤)"] },
    { fieldName: "天猫尺码表", fieldType: "MULTI_TEXT", options: ["尺码"] },
    { fieldName: "淘宝尺码表", fieldType: "MULTI_TEXT", options: ["尺码"] },
    { fieldName: "好衣库尺码表", fieldType: "MULTI_TEXT", options: ["尺码"] },
    { fieldName: "多平台尺码", fieldType: "MULTI_TEXT", options: ["天猫", "京东"] },
  ] });
  assert.deepEqual(fields.map((field) => field.fieldName), ["尺码表", "唯品会尺码表", "抖音尺码表", "天猫尺码表", "淘宝尺码表", "好衣库尺码表", "多平台尺码"]);
  assert.equal(fields.find((field) => field.fieldName === "尺码表")?.valueJson?.["140cm"], "140,81,56,76,22,140,31");
  assert.equal(fields.find((field) => field.fieldName === "唯品会尺码表")?.valueJson?.["140cm"], "140/55,81,56,76,22");
  assert.equal(fields.find((field) => field.fieldName === "抖音尺码表")?.valueJson?.["140cm"], "140,62");
  assert.equal(fields.find((field) => field.fieldName === "多平台尺码")?.valueJson?.["140cm"], ",140");
});

test("blocks an apparel main table without PLM while retaining reference-only VIP, Douyin and multi-platform tables", () => {
  const fields = buildBalabalaSizeTables({
    spu: "202426107128",
    launchPlan: { productLine: "童装", category: "羽绒服", gender: "男" },
    skus: [{ size: "140" }],
    apparelSizeReference: { source: "apparel_size_reference", rows: [{
      size: "140", weightKg: "32", age: "8-11岁", douyinWeightJin: "64",
      maleTop: "140/99", maleBottom: "140/98", femaleTop: "140/97", femaleBottom: "140/96", neutralTop: "140/95", neutralBottom: "140/94",
    }] },
  }, { fields: [
    { fieldName: "尺码表", fieldType: "MULTI_TEXT", options: ["尺码", "衣长", "肩宽", "胸围", "袖长", "身高", "体重"] },
    { fieldName: "上衣尺码表", fieldType: "MULTI_TEXT", options: ["尺码", "衣长"] },
    { fieldName: "唯品会尺码表", fieldType: "MULTI_TEXT", options: ["号型"] },
    { fieldName: "抖音尺码表", fieldType: "MULTI_TEXT", options: ["尺码", "体重(斤)"] },
    { fieldName: "多平台尺码", fieldType: "MULTI_TEXT", options: ["天猫", "京东", "拼多多"] },
    { fieldName: "25鞋子尺码表", fieldType: "SINGLE_CHOICE", options: ["凉鞋"] },
  ] });
  const main = fields.find((field) => field.fieldName === "尺码表");
  assert.deepEqual({ active: main?.active, validationStatus: main?.validationStatus, staleReason: main?.staleReason }, {
    active: true, validationStatus: "missing", staleReason: "plm_size_chart_required",
  });
  const top = fields.find((field) => field.fieldName === "上衣尺码表");
  assert.deepEqual({ active: top?.active, validationStatus: top?.validationStatus, staleReason: top?.staleReason }, {
    active: true, validationStatus: "missing", staleReason: "plm_size_chart_required",
  });
  assert.equal(fields.find((field) => field.fieldName === "唯品会尺码表")?.valueJson?.["140cm"], "140/99");
  assert.equal(fields.find((field) => field.fieldName === "抖音尺码表")?.valueJson?.["140cm"], "140,64");
  assert.equal(fields.find((field) => field.fieldName === "多平台尺码")?.valueJson?.["140cm"], ",140,");
  assert.equal(fields.some((field) => field.fieldName === "25鞋子尺码表"), false);
});

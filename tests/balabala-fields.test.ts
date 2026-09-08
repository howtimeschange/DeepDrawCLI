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

test("builds template-valid colors, sale sizes, nested merchant SKU and platform price fields", () => {
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
    "白绿色调00414": { "26码": "359.9,204426140121,a,,358.9,357.9" },
    "蓝色调00388": { "26码": "359.9,204426140121,b,,358.9,357.9" },
  });
});

test("uses cm sale-size aliases for apparel templates", () => {
  const fields = buildBalabalaFields({
    spu: "202426107129",
    launchPlan: { productLine: "童装", category: "卫衣" },
    copywriting: { rows: [] },
    skus: [{ color: "粉红调", size: "140" }],
  }, { fields: [
    { fieldName: "颜色", fieldType: "MULTI_CHOICE", options: ["粉红,粉红调"] },
    { fieldName: "尺码", fieldType: "MULTI_CHOICE", required: true, options: ["140cm"] },
  ] });
  assert.equal(fields.find((field) => field.fieldName === "尺码")?.valueText, "140cm");
  assert.equal(fields.find((field) => field.fieldName === "尺码")?.validationStatus, "valid");
});

test("marks unsupported special fields manual-required instead of synthesizing them", () => {
  const fields = buildBalabalaFields(context, { fields: [{ fieldName: "淘宝SKU参数", fieldType: "TEXT", required: true }] });
  assert.equal(fields[0]?.validationStatus, "missing");
  assert.equal(fields[0]?.staleReason, "manual_required_special_format");
});

test("builds Tmall guide-title category slots from local copywriting", () => {
  const fields = buildBalabalaFields({
    spu: "202426107128",
    launchPlan: { productLine: "童装", category: "羽绒服", subcategory: "中羽绒服" },
    copywriting: { rows: [{ guideTitle: "巴拉巴拉男童羽绒服" }] },
    skus: [],
  }, { fields: [{ fieldName: "天猫导购标题", fieldType: "TEXT", required: true }] });
  assert.equal(fields[0]?.validationStatus, "valid");
  const row = JSON.parse(fields[0]!.valueText!)[0];
  assert.equal(row["interest7,利益点"], "巴拉巴拉男童羽绒服");
  assert.equal(row["316102,衣长"], "");
});

test("accepts a reviewed manual value for a special-format field", () => {
  const fields = buildBalabalaFields({
    spu: "204426140121",
    launchPlan: { productLine: "鞋品", category: "运动鞋" },
    copywriting: { rows: [] },
    skus: [],
    manualOverrides: { 淘宝SKU参数: { valueText: "蓝色:26码" } },
  }, { fields: [{ fieldName: "淘宝SKU参数", fieldType: "TEXT", required: false }] });
  assert.deepEqual({
    fieldName: fields[0]?.fieldName, fieldType: fields[0]?.fieldType, sourceType: fields[0]?.sourceType,
    sourceRefs: fields[0]?.sourceRefs, active: fields[0]?.active, manualOverride: fields[0]?.manualOverride,
    validationStatus: fields[0]?.validationStatus, valueText: fields[0]?.valueText, valueJson: fields[0]?.valueJson,
  }, {
    fieldName: "淘宝SKU参数", fieldType: "TEXT", sourceType: "manual", sourceRefs: [], active: true,
    manualOverride: true, validationStatus: "valid", valueText: "蓝色:26码", valueJson: {},
  });
});

test("applies an explicit local field mapping before the Balabala fallback rules", () => {
  const fields = buildBalabalaFields({
    spu: "204426140121",
    launchPlan: { raw: { 销售属性: "旗舰店同款" } },
    copywriting: { rows: [] },
    skus: [],
    fieldMappings: [{ targetField: "自定义渠道字段", source: "launch_plan", sourceField: "销售属性" }],
  }, { fields: [{ fieldName: "自定义渠道字段", fieldType: "TEXT", required: true }] });
  assert.equal(fields[0]?.valueText, "旗舰店同款");
  assert.equal(fields[0]?.sourceType, "launch_plan");
});

test("derives and normalizes Balabala shoe fields from the same source evidence as Listingify", () => {
  const fields = buildBalabalaFields({
    spu: "204426140121",
    mdm: {
      title: "儿童户外鞋",
      rows: [{ raw: { 品牌名称: "巴拉巴拉", 季节名称: "Q4", 年份: "2026", 面料: "合成革", 里料: "织物" } }],
    },
    launchPlan: {
      productLine: "鞋品", category: "运动鞋", subcategory: "户外鞋", gender: "男", launchDate: "2026-09-04",
      raw: { 产品季: "426", 属性: "全域款", 年龄段: "中童", 尺码段: "26-40", 主款式: "运动休闲鞋", 品类: "运动鞋", 大身面料: "合成材料+织物", 里料材质: "织物", 鞋品企业名称: "浙江华建鞋业有限公司", FAB: "轻质防滑包头大底，革料搭配织物鞋面，旋钮穿脱" },
    },
    copywriting: { rows: [{
      name: "儿童户外鞋", upperMaterial: "合成材料+织物", lining: "织物",
      sellingPoint: "轻质防滑耐磨户外鞋，趣味科技旋钮扣", detail: "轻质防滑耐磨橡胶鞋底，天鹅绒内里，革料搭配织物鞋面，随芯旋钮设计",
      raw: { 名称: "儿童户外鞋", 品类: "运动鞋", 面料成分: "帮面材料：合成革+织物", 细节文案: "轻质防滑耐磨橡胶鞋底，天鹅绒内里，革料搭配织物鞋面，随芯旋钮设计" },
    }] },
    skus: [{ color: "白绿色调00414", size: "26" }],
  }, { fields: [
    { fieldName: "发货方式", fieldType: "SINGLE_CHOICE", required: true, options: ["快递发货"] },
    { fieldName: "单位", fieldType: "SINGLE_CHOICE", required: true, options: ["件", "双"] },
    { fieldName: "鞋面", fieldType: "SINGLE_CHOICE", required: true, options: ["织物+合成革"] },
    { fieldName: "配皮材质(多选)", fieldType: "MULTI_CHOICE", required: true, options: ["人造革", "织物"] },
    { fieldName: "鞋垫材质", fieldType: "SINGLE_CHOICE", required: true, options: ["其他"] },
    { fieldName: "鞋底材质", fieldType: "SINGLE_CHOICE", required: true, options: ["橡胶"] },
    { fieldName: "鞋面材质(多选)", fieldType: "MULTI_CHOICE", required: true, options: ["合成革", "织物"] },
    { fieldName: "类型(多选)", fieldType: "MULTI_CHOICE", required: true, options: ["户外休闲鞋"] },
    { fieldName: "适用年龄", fieldType: "SINGLE_CHOICE", required: true, options: ["7岁-14岁"] },
    { fieldName: "产地", fieldType: "SINGLE_CHOICE", required: true, options: ["浙江杭州"] },
    { fieldName: "款式(单选)", fieldType: "SINGLE_CHOICE", required: true, options: ["户外休闲鞋"] },
    { fieldName: "适用季节", fieldType: "SINGLE_CHOICE", required: true, options: ["2026年冬季"] },
    { fieldName: "适用人群", fieldType: "SINGLE_CHOICE", required: true, options: ["儿童"] },
    { fieldName: "适用人群(多选)", fieldType: "MULTI_CHOICE", required: true, options: ["中大童"] },
    { fieldName: "适用场合(多选)", fieldType: "MULTI_CHOICE", required: true, options: ["日常", "校园"] },
    { fieldName: "上市时间", fieldType: "SINGLE_CHOICE", required: true, options: ["2026年冬季"] },
    { fieldName: "功能", fieldType: "SINGLE_CHOICE", required: true, options: ["防滑"] },
    { fieldName: "功能(多选)", fieldType: "MULTI_CHOICE", required: true, options: ["防滑", "耐磨", "旋转扣"] },
    { fieldName: "产品类别", fieldType: "SINGLE_CHOICE", required: true, options: ["户外鞋"] },
    { fieldName: "闭合方式", fieldType: "SINGLE_CHOICE", required: true, options: ["旋钮扣"] },
    { fieldName: "原产国(AKC)", fieldType: "SINGLE_CHOICE", required: true, options: ["中国"] },
    { fieldName: "品牌(文本)", fieldType: "TEXT", required: true },
    { fieldName: "品牌(单选)", fieldType: "SINGLE_CHOICE", required: true, options: ["balabala/巴拉巴拉"] },
    { fieldName: "生产/经销厂家", fieldType: "TEXT", required: true },
    { fieldName: "厂家地址", fieldType: "TEXT", required: true },
    { fieldName: "货源类别", fieldType: "SINGLE_CHOICE", required: true, options: ["订货", "现货"] },
    { fieldName: "最快出货时间", fieldType: "TEXT", required: true },
    { fieldName: "退款规则", fieldType: "SINGLE_CHOICE", required: true, options: ["支持7天无理由退货"] },
    { fieldName: "原产国", fieldType: "TEXT", required: true },
    { fieldName: "详情页AI标注", fieldType: "SINGLE_CHOICE", options: ["展示"] },
    { fieldName: "婴童内着详情页", fieldType: "SINGLE_CHOICE", options: ["婴童", "内着"] },
    { fieldName: "适用场景", fieldType: "SINGLE_CHOICE", options: ["公路"] },
  ] });
  const values = Object.fromEntries(fields.map((field) => [field.fieldName, field.valueText]));
  assert.deepEqual(values, {
    发货方式: "快递发货", 单位: "双", 鞋面: "织物+合成革", "配皮材质(多选)": "人造革", 鞋垫材质: "其他", 鞋底材质: "橡胶", "鞋面材质(多选)": "合成革", "类型(多选)": "户外休闲鞋", 适用年龄: "7岁-14岁", 产地: "浙江杭州", "款式(单选)": "户外休闲鞋", 适用季节: "2026年冬季", 适用人群: "儿童", "适用人群(多选)": "中大童", "适用场合(多选)": "日常;校园", 上市时间: "2026年冬季", 功能: "防滑", "功能(多选)": "防滑;耐磨;旋转扣", 产品类别: "户外鞋", 闭合方式: "旋钮扣", "原产国(AKC)": "中国", "品牌(文本)": "巴拉巴拉", "品牌(单选)": "balabala/巴拉巴拉", "生产/经销厂家": "浙江森马服饰股份有限公司", 厂家地址: "温州市瓯海区娄桥工业园南汇路98号", 货源类别: "现货", 最快出货时间: "48小时", 退款规则: "支持7天无理由退货", 原产国: "中国", "详情页AI标注": undefined, "婴童内着详情页": "", 适用场景: "",
  });
  assert.equal(fields.find((field) => field.fieldName === "婴童内着详情页")?.validationStatus, "valid");
  assert.deepEqual(fields.find((field) => field.fieldName === "详情页AI标注"), {
    fieldId: undefined, fieldName: "详情页AI标注", fieldType: "SINGLE_CHOICE", sourceType: "skip", sourceRefs: [], active: false,
    manualOverride: false, validationStatus: "skipped", staleReason: "business_blank_field",
  });
  assert.equal(fields.find((field) => field.fieldName === "适用场景")?.validationStatus, "skipped");
});

test("derives apparel and cross-platform defaults without borrowing shoe-only rules", () => {
  const fields = buildBalabalaFields({
    spu: "202426107129",
    mdm: { title: "女童牛仔裤", rows: [{ raw: { 品牌名称: "巴拉巴拉" } }] },
    launchPlan: {
      productLine: "童装", category: "牛仔裤", subcategory: "牛仔长裤", gender: "女", launchDate: "2026-09-04",
      raw: { 属性: "专供新品", 产品季: "326", 尺码段: "130-175", 性别: "女", 主款式: "直筒裤", 厚薄: "加厚", 版型: "宽松" },
    },
    copywriting: { rows: [{
      title: "巴拉巴拉女童牛仔裤", guideTitle: "巴拉巴拉女童牛仔裤", sellingPoint: "舒适百搭", detail: "裤型利落，日常百搭",
      raw: { 搜索标题: "巴拉巴拉女童牛仔裤", 导购标题: "巴拉巴拉女童牛仔裤", 内容平台标题: "女童牛仔裤", 面料成分: "100%棉", 面料三个关键词: "防风 透气", 弹性: "微弹", "设计师说——主图4": "第一句\n第二句", 细节文案: "裤型利落；日常百搭" },
    }] },
    skus: [{ color: "蓝色", size: "140" }],
  }, { fields: [
    { fieldName: "销售渠道类型", fieldType: "SINGLE_CHOICE", required: true, options: ["纯电商", "商场同款"] },
    { fieldName: "是否商场同款", fieldType: "SINGLE_CHOICE", required: true, options: ["是", "否"] },
    { fieldName: "报价方式", fieldType: "SINGLE_CHOICE", required: true, options: ["按产品数量报价"] },
    { fieldName: "件重尺", fieldType: "SINGLE_CHOICE", required: true, options: ["按规格设置"] },
    { fieldName: "1688供货方式", fieldType: "SINGLE_CHOICE", required: true, options: ["现货"] },
    { fieldName: "所在地", fieldType: "SINGLE_CHOICE", required: true, options: ["浙江,杭州"] },
    { fieldName: "面料", fieldType: "SINGLE_CHOICE", required: true, options: ["纯棉"] },
    { fieldName: "面料多选", fieldType: "MULTI_CHOICE", required: true, options: ["棉"] },
    { fieldName: "选择期数", fieldType: "SINGLE_CHOICE", required: true, options: ["326"] },
    { fieldName: "厚薄", fieldType: "SINGLE_CHOICE", required: true, options: ["加厚"] },
    { fieldName: "服装版型", fieldType: "SINGLE_CHOICE", required: true, options: ["宽松型"] },
    { fieldName: "主图4文案1", fieldType: "TEXT", required: true },
    { fieldName: "主图4文案2", fieldType: "TEXT", required: true },
    { fieldName: "25服饰细节文案", fieldType: "TEXT", required: true },
    { fieldName: "25版型指数", fieldType: "TEXT", required: true },
    { fieldName: "25服装面料文案", fieldType: "TEXT", required: false },
    { fieldName: "性别多选", fieldType: "MULTI_CHOICE", required: true, options: ["女童"] },
    { fieldName: "是否带帽", fieldType: "SINGLE_CHOICE", required: true, options: ["连帽"] },
    { fieldName: "是否可开档", fieldType: "SINGLE_CHOICE", required: true, options: ["不开裆"] },
    { fieldName: "是否可定制", fieldType: "SINGLE_CHOICE", required: true, options: ["不可定制"] },
    { fieldName: "货源类别", fieldType: "SINGLE_CHOICE", required: true, options: ["订货", "现货"] },
    { fieldName: "腰型", fieldType: "SINGLE_CHOICE", required: true, options: ["自然腰"] },
    { fieldName: "裤门襟", fieldType: "SINGLE_CHOICE", required: true, options: ["松紧"] },
    { fieldName: "适用场合", fieldType: "SINGLE_CHOICE", required: true, options: ["日常"] },
    { fieldName: "适用年龄", fieldType: "SINGLE_CHOICE", required: true, options: ["7-16岁"] },
    { fieldName: "适用人群", fieldType: "SINGLE_CHOICE", required: true, options: ["青少年"] },
    { fieldName: "适用季节", fieldType: "SINGLE_CHOICE", required: true, options: ["2026年秋季"] },
    { fieldName: "面料工艺", fieldType: "SINGLE_CHOICE", required: true, options: ["涂层"] },
    { fieldName: "领型", fieldType: "SINGLE_CHOICE", required: true, options: ["连帽"] },
    { fieldName: "风格", fieldType: "SINGLE_CHOICE", required: true, options: ["休闲"] },
    { fieldName: "尺码表兼容平台", fieldType: "MULTI_CHOICE", required: true, options: ["天猫", "京东", "抖音"] },
  ] });
  const values = Object.fromEntries(fields.map((field) => [field.fieldName, field.valueText]));
  assert.deepEqual(values, {
    销售渠道类型: "纯电商", 是否商场同款: "否", 报价方式: "按产品数量报价", 件重尺: "按规格设置", "1688供货方式": "现货", 所在地: "浙江,杭州", 面料: "纯棉", 面料多选: "棉", 选择期数: "326", 厚薄: "加厚", 服装版型: "宽松型", 主图4文案1: "第一句", 主图4文案2: "第二句", "25服饰细节文案": "裤型利落*日常百搭", "25版型指数": "宽松", "25服装面料文案": "防风-透气", 性别多选: "女童", 是否带帽: "", 是否可开档: "不开裆", 是否可定制: "不可定制", 货源类别: "现货", 腰型: "自然腰", 裤门襟: "松紧", 适用场合: "日常", 适用年龄: "7-16岁", 适用人群: "青少年", 适用季节: "2026年秋季", 面料工艺: "涂层", 领型: "连帽", 风格: "休闲", 尺码表兼容平台: "天猫;京东;抖音",
  });
});

test("derives the remaining Listingify shoe source-rule and platform fields", () => {
  const fields = buildBalabalaFields({
    spu: "204426140121",
    launchPlan: {
      productLine: "鞋品", category: "运动鞋", subcategory: "户外鞋", launchDate: "2026-09-04",
      raw: { 产品季: "426" },
    },
    copywriting: { rows: [{
      title: "巴拉巴拉儿童户外鞋", guideTitle: "巴拉巴拉男童户外鞋", sellingPoint: "舒适百搭",
      raw: { 内容平台标题: "儿童户外鞋", 推荐理由: "舒适百搭", 细节文案: "防滑：旋钮穿脱；反光字母设计" },
    }] },
    skus: [{ color: "蓝色", size: "26" }],
  }, { fields: [
    { fieldName: "适用场景", fieldType: "SINGLE_CHOICE", required: true, options: ["休闲"] },
    { fieldName: "风格", fieldType: "SINGLE_CHOICE", required: true, options: ["运动"] },
    { fieldName: "流行元素(多选)", fieldType: "MULTI_CHOICE", required: true, options: ["反光", "旋钮扣", "字母"] },
    { fieldName: "单用户累计限购件", fieldType: "TEXT", required: true },
    { fieldName: "每次限购件", fieldType: "TEXT", required: true },
    { fieldName: "京东发货地", fieldType: "TEXT", required: true },
    { fieldName: "京东商品重量", fieldType: "TEXT", required: true },
    { fieldName: "抖音商品重量", fieldType: "TEXT", required: true },
    { fieldName: "京东包装宽", fieldType: "TEXT", required: true },
    { fieldName: "微信视频小店商品编码", fieldType: "TEXT", required: true },
    { fieldName: "唯品会款号", fieldType: "TEXT", required: true },
    { fieldName: "尺码类型", fieldType: "SINGLE_CHOICE", required: true, options: ["欧码（童鞋）"] },
    { fieldName: "质检报告", fieldType: "SINGLE_CHOICE", required: true, options: ["否"] },
    { fieldName: "单色平台AI标", fieldType: "SINGLE_CHOICE", required: true, options: ["坑位1"] },
    { fieldName: "多色平台AI", fieldType: "SINGLE_CHOICE", required: true, options: ["坑位1"] },
    { fieldName: "25实拍文案", fieldType: "TEXT", required: true },
    { fieldName: "微信视频小店副标题", fieldType: "TEXT", required: true },
  ] });
  assert.deepEqual(Object.fromEntries(fields.map((field) => [field.fieldName, field.valueText])), {
    适用场景: "休闲",
    风格: "运动",
    "流行元素(多选)": "反光;旋钮扣;字母",
    单用户累计限购件: "5",
    每次限购件: "5",
    京东发货地: "浙江杭州",
    京东商品重量: "1",
    抖音商品重量: "1",
    京东包装宽: "100",
    微信视频小店商品编码: "204426140121",
    唯品会款号: "204426140121",
    尺码类型: "欧码（童鞋）",
    质检报告: "否",
    单色平台AI标: undefined,
    多色平台AI: undefined,
    "25实拍文案": "防滑-旋钮穿脱*反光字母设计",
    微信视频小店副标题: "巴拉巴拉男童户外鞋",
  });
  assert.deepEqual(fields.filter((field) => /平台AI/.test(field.fieldName)).map((field) => [field.active, field.validationStatus, field.staleReason]), [
    [false, "skipped", "business_blank_field"], [false, "skipped", "business_blank_field"],
  ]);
});

test("uses Listingify provenance order for apparel enterprise and titles, while omitting business-blank PDD fields", () => {
  const fields = buildBalabalaFields({
    spu: "202426107129",
    mdm: { rows: [{ raw: {
      品牌名称: "巴拉巴拉", productionEnterpriseName: "宁波示例服饰有限公司", productionEnterpriseAddress: "宁波市示例路1号",
    } }] },
    launchPlan: {
      productLine: "童装", category: "牛仔裤", subcategory: "牛仔长裤", raw: { 性别: "女童", 年龄段: "7-16岁" },
    },
    copywriting: { rows: [{ raw: {
      搜索标题: "巴拉巴拉女童舒适牛仔裤", 内容平台标题: "女童牛仔裤", 导购标题: "巴拉巴拉女童牛仔裤", 推荐理由: "舒适百搭，挺括有型",
    } }] },
    skus: [{ color: "蓝色", size: "140" }],
  }, { fields: [
    { fieldName: "生产企业名称", fieldType: "TEXT", required: true },
    { fieldName: "厂家地址", fieldType: "TEXT", required: true },
    { fieldName: "产地", fieldType: "SINGLE_CHOICE", required: true, options: ["浙江杭州", "中国大陆"] },
    { fieldName: "商品展示标题", fieldType: "TEXT", required: true },
    { fieldName: "快手标题", fieldType: "TEXT", required: true },
    { fieldName: "拼多多标题", fieldType: "TEXT", required: true },
    { fieldName: "天猫推荐理由", fieldType: "TEXT", required: true },
    { fieldName: "主图4样式", fieldType: "SINGLE_CHOICE", required: true, options: ["225"] },
  ] });
  assert.deepEqual(Object.fromEntries(fields.map((field) => [field.fieldName, field.valueText])), {
    生产企业名称: "宁波示例服饰有限公司",
    厂家地址: "宁波市示例路1号",
    产地: "中国大陆",
    商品展示标题: "巴拉巴拉女童7-16岁牛仔裤",
    快手标题: "女童牛仔裤",
    拼多多标题: undefined,
    天猫推荐理由: "舒适百搭",
    主图4样式: "225",
  });
  const pdd = fields.find((field) => field.fieldName === "拼多多标题");
  assert.equal(pdd?.active, false);
  assert.equal(pdd?.validationStatus, "skipped");
});

test("parses Listingify apparel material sections and down-fill evidence without guessing", () => {
  const fields = buildBalabalaFields({
    spu: "202426107129",
    launchPlan: { productLine: "童装", category: "羽绒服", subcategory: "羽绒服" },
    copywriting: { rows: [{ raw: {
      面料成分: "大身面料：聚酯纤维100%\n里料：聚酯纤维100%\n填充物：白鸭绒\n含绒量：90%",
      面料三个关键词: "防风;防泼水;透气",
    } }] },
    skus: [{ color: "白色", size: "140" }],
  }, { fields: [
    { fieldName: "材质成分", fieldType: "TEXT", required: true },
    { fieldName: "京东材质成分", fieldType: "TEXT", required: true },
    { fieldName: "里料", fieldType: "TEXT", required: true },
    { fieldName: "详情页面料", fieldType: "TEXT", required: true },
    { fieldName: "填充物", fieldType: "SINGLE_CHOICE", required: true, options: ["鸭绒", "无"] },
    { fieldName: "含绒量", fieldType: "SINGLE_CHOICE", required: true, options: ["80%及以上", "80%以下"] },
    { fieldName: "里料材质成分含量(多选)", fieldType: "MULTI_CHOICE", required: true, options: ["100%", "95%以下"] },
    { fieldName: "功能(多选)", fieldType: "MULTI_CHOICE", required: true, options: ["防风", "防泼水", "透气"] },
  ] });
  assert.deepEqual(Object.fromEntries(fields.map((field) => [field.fieldName, field.valueText])), {
    材质成分: "聚酯纤维,100",
    京东材质成分: "涤纶(聚酯纤维),100",
    里料: "聚酯纤维100%",
    详情页面料: "大身面料：聚酯纤维100%\n里料：聚酯纤维100%",
    填充物: "鸭绒",
    含绒量: "80%及以上",
    "里料材质成分含量(多选)": "100%",
    "功能(多选)": "防风;防泼水;透气",
  });
});

test("applies Listingify wash-care and VIP apparel template rules, while excluding shoe-only AI slots", () => {
  const apparel = buildBalabalaFields({
    spu: "202426107129",
    launchPlan: { productLine: "童装", category: "羽绒服" },
    copywriting: { rows: [{ raw: { 面料成分: "填充物：白鸭绒\\n含绒量：90%" } }] },
    skus: [],
  }, { fields: [
    { fieldName: "羽绒服洗涤说明", fieldType: "SINGLE_CHOICE", required: true, options: ["羽绒服洗涤说明"] },
    { fieldName: "洗护方法", fieldType: "TEXT", required: true },
    { fieldName: "唯品会温馨提示", fieldType: "TEXT", required: true, thirdPlatform: "VIP" },
    { fieldName: "适用场景", fieldType: "SINGLE_CHOICE", required: true, thirdPlatform: "VIP", options: ["日常"] },
  ] });
  assert.deepEqual(Object.fromEntries(apparel.map((field) => [field.fieldName, field.valueText])), {
    羽绒服洗涤说明: "羽绒服洗涤说明",
    洗护方法: "请根据产品面料特性进行清洗养护，具体方法可参考产品水洗唛/标签",
    唯品会温馨提示: "手工测量难免存在误差，常规款袖长肩点到袖口，插肩袖(无明确肩点)款后领中量至袖口",
    适用场景: "日常",
  });
  const shoe = buildBalabalaFields({
    spu: "204426140121", launchPlan: { productLine: "鞋品", category: "运动鞋" }, copywriting: { rows: [{ raw: { 细节文案: "轻质运动鞋" } }] }, skus: [],
  }, { fields: [
    { fieldName: "详情页AI标注", fieldType: "SINGLE_CHOICE", required: true, options: ["展示"] },
    { fieldName: "单色平台AI标", fieldType: "SINGLE_CHOICE", required: true, options: ["坑位1"] },
    { fieldName: "拼多多标题", fieldType: "TEXT", required: true },
    { fieldName: "配饰版默认文案", fieldType: "SINGLE_CHOICE", required: true, options: ["帽子"] },
  ] });
  assert.deepEqual(shoe.map((field) => [field.active, field.validationStatus, field.staleReason]), [
    [false, "skipped", "business_blank_field"],
    [false, "skipped", "business_blank_field"],
    [false, "skipped", "business_blank_field"],
    [false, "skipped", "business_blank_field"],
  ]);
});

test("uses the Balabala apparel size reference before normalizing real apparel age and style enums", () => {
  const fields = buildBalabalaFields({
    spu: "202426108035",
    launchPlan: {
      productLine: "中童", category: "长裤", subcategory: "牛仔长裤", gender: "女",
      raw: { 尺码段: "140-175", "主款式 （唯品四级品类）": "牛仔长裤" },
    },
    copywriting: { rows: [{ raw: { 搜索标题: "巴拉巴拉女童牛仔长裤" } }] },
    skus: [{ color: "蓝色", size: "140" }],
  }, { fields: [
    {
      fieldName: "适用年龄", fieldType: "SINGLE_CHOICE", required: true,
      options: ["中小童(3~8岁，100~140cm)", "中大童(8岁以上，140cm以上)", "7-14岁"],
    },
    { fieldName: "类型", fieldType: "SINGLE_CHOICE", required: true, options: ["牛仔裤", "长裤"] },
  ] });

  assert.deepEqual(Object.fromEntries(fields.map((field) => [field.fieldName, field.valueText])), {
    适用年龄: "中大童(8岁以上，140cm以上)",
    类型: "牛仔裤",
  });
});

test("normalizes and de-duplicates SKU colors with Listingify color-family rules", () => {
  const fields = buildBalabalaFields({
    spu: "204426140121",
    launchPlan: { productLine: "鞋品", category: "运动鞋" },
    copywriting: { rows: [] },
    skus: [
      { color: "浅灰20047", size: "26" },
      { color: "杏色12345", size: "27" },
      { color: "镭射渐变007", size: "28" },
      { color: "蓝色", size: "29" },
      { color: "蓝色调00388", size: "30" },
    ],
  }, { fields: [{ fieldName: "颜色", fieldType: "MULTI_CHOICE", required: true, options: ["浅灰", "卡其", "其他", "蓝色"] }] });
  assert.equal(fields[0]?.valueText, "浅灰,浅灰20047;卡其,杏色12345;其他,镭射渐变007;蓝色,蓝色调00388");
});

test("supports Listingify sale-size aliases and base merchant-SKU columns", () => {
  const fields = buildBalabalaFields({
    spu: "202426107129",
    launchPlan: { productLine: "童装", category: "卫衣", retailPrice: "199" },
    copywriting: { rows: [] },
    skus: [{ color: "蓝色", size: "S" }, { color: "蓝色", size: "140" }],
  }, { fields: [
    { fieldName: "尺寸", fieldType: "MULTI_CHOICE", required: true, saleProp: true, options: ["S", "140cm"] },
    { fieldName: "商家SKU", fieldType: "MULTI_TEXT" },
  ] });
  assert.equal(fields.find((field) => field.fieldName === "尺寸")?.valueText, "S;140cm");
  assert.equal((fields.find((field) => field.fieldName === "商家SKU")?.valueJson as Record<string, string>)?.title, "价格,货号,上市时间,数量,商家编码,条形码,零售价,供货价,唯品会货号,唯品会条形码");
});

test("formal 108035 and 121024 compositions preserve sections and exact fiber facts regardless of enum order", () => {
  const cases = [
    { material: "成分\n面料:42.3%聚酯纤维 40.6%棉 15.9%莱赛尔 1.2%氨纶\n脚口面料:100%聚酯纤维\n(配料除外)", expected: "聚酯纤维,42.3;棉,40.6;莱赛尔纤维(莱赛尔),15.9;聚氨酯弹性纤维(氨纶),1.2", band: "41%(含)-60%(含)" },
    { material: "成分\n面料:37.6%棉 29.8%聚酯纤维 23.8%莫代尔 8.8%氨纶\n罗纹:97.1%棉 2.9%氨纶\n(配料除外）", expected: "棉,37.6;聚酯纤维,29.8;莫代尔纤维(莫代尔),23.8;聚氨酯弹性纤维(氨纶),8.8", band: "30%（含）-40%" },
  ];
  for (const item of cases) {
    const fields = buildBalabalaFields({ ...context, launchPlan: { productLine: "童装", category: "卫衣" }, copywriting: { rows: [{ raw: { 面料成分: item.material } }] } }, { fields: [
      { fieldName: "材质成分", fieldType: "TEXT", required: true, options: ["石棉(石绵)", "蚕丝棉", "驼绒棉", "棉", "聚酯纤维", "莱赛尔纤维(莱赛尔)", "莫代尔纤维(莫代尔)", "聚氨酯弹性纤维(氨纶)"] },
      { fieldName: "材质", options: ["纯棉（95%以上）", "石棉", "棉混纺布", "其它"] },
      { fieldName: "成分含量", options: ["96%及以上", "41%(含)-60%(含)", "30%（含）-40%"] },
    ] });
    assert.equal(fields[0]?.valueText, item.expected);
    assert.equal(fields[0]?.validationStatus, "valid");
    assert.equal(fields[1]?.valueText, item.material.includes("42.3%") ? "其它" : "棉混纺布");
    assert.equal(fields[2]?.valueText, item.band);
  }
});

test("invalid main material percentages block even optional fields without enum constraints", () => {
  for (const material of ["面料:120%棉", "面料:70%棉 50%聚酯纤维", "面料:60%棉 40%棉"]) {
    const fields = buildBalabalaFields({ ...context, launchPlan: { category: "卫衣" }, copywriting: { rows: [{ raw: { 面料成分: material } }] } }, { fields: [{ fieldName: "材质成分", fieldType: "TEXT" }] });
    assert.equal(fields[0]?.valueText, "");
    assert.equal(fields[0]?.validationStatus, "invalid");
    assert.equal(fields[0]?.staleReason, "invalid_source_material_percentages");
  }
});

test("raw workbook aliases, prices and Listingify defaults produce local fields", () => {
  const fields = buildBalabalaFields({ ...context, launchPlan: { category: "卫衣" }, copywriting: { rows: [{ raw: {
    主图4: "温暖冬日\n柔软亲肤\n日常百搭", "细节文案（不限定8个字，细节数量3-4个，字数尽量不超过12字）": "1.罗纹袖口\n2.舒适领口", 弹性: "弹力", 导购标题: "巴拉巴拉儿童舒适保暖百搭卫衣", 内容平台标题: "完整内容平台标题",
  } }] } }, { fields: [
    ...["主图4文案1", "主图4文案2", "25服饰细节文案", "导购短标题", "快手标题", "小红书标题", "奥莱店折扣价", "抖音参考价", "京东产地"].map((fieldName) => ({ fieldName })),
    { fieldName: "弹力", options: ["高弹", "微弹"] }, { fieldName: "主图4样式", options: ["主图4样式225"] },
  ] });
  const values = Object.fromEntries(fields.map((f) => [f.fieldName, f.valueText]));
  assert.equal(values.主图4文案1, "温暖冬日");
  assert.equal(values.主图4文案2, "柔软亲肤\n日常百搭");
  assert.equal(values['25服饰细节文案'], "罗纹袖口*舒适领口");
  assert.equal(values.导购短标题, "巴拉巴拉儿童卫衣");
  assert.equal(values.快手标题, "完整内容平台标题");
  assert.equal(values.小红书标题, "完整内容平台标题");
  assert.equal(values.奥莱店折扣价, "359.9");
  assert.equal(values.抖音参考价, "359.9");
  assert.equal(values.京东产地, "中国大陆");
  assert.equal(values.弹力, "微弹");
  assert.equal(values.主图4样式, "主图4样式225");
});

test("JD local size subattributes retain SKU order and reviewed special values override derived values", () => {
  const local = { ...context, skus: [{ size: "140cm" }, { size: "130cm" }, { size: "140cm" }] };
  const template = { fields: [{ fieldName: "京东规格子属性" }, { fieldName: "京东自营子属性" }] };
  assert.deepEqual(buildBalabalaFields(local, template).map((f) => f.valueText), ["140;130", "140;130"]);
  const preserved = buildBalabalaFields({ ...local, manualOverrides: { 京东规格子属性: { valueText: "existing" }, 京东自营子属性: { valueText: "" } } }, template);
  assert.deepEqual(preserved.map((f) => f.valueText), ["existing", ""]);
});

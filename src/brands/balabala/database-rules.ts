import { matchesRuleScope, type RuleSnapshotMetadata, type RuleScope } from "../rule-snapshot.js";
// Read-only Listingify snapshot: 电商巴拉巴拉 / 1162, 2026-09-08T08:59:45.522Z.
// No credentials; source/default rules do not override current template requirements.
export const DATABASE_RULE_VERSION = "2026-09-08T08:59:45.522Z";
export const DATABASE_RULES = [
  {
    "id": "1",
    "field_domain_type": "通用字段",
    "deepdraw_field": "产品分类",
    "source_type": "launch_plan",
    "source_field": "官方发布类目",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "2",
    "field_domain_type": "通用字段",
    "deepdraw_field": "兼容平台",
    "source_type": "fixed",
    "source_field": null,
    "default_value": "1688、天猫、京东、唯品会、有赞、拼多多、小红书、抖音、快手、微信视频小店",
    "enabled": true
  },
  {
    "id": "3",
    "field_domain_type": "通用字段",
    "deepdraw_field": "选择期数",
    "source_type": "mdm",
    "source_field": "对应日期",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "4",
    "field_domain_type": "通用字段",
    "deepdraw_field": "货号",
    "source_type": "launch_plan",
    "source_field": "款号",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "5",
    "field_domain_type": "通用字段",
    "deepdraw_field": "产品标题",
    "source_type": "copywriting",
    "source_field": "搜索标题",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "6",
    "field_domain_type": "通用字段",
    "deepdraw_field": "价格",
    "source_type": "launch_plan",
    "source_field": "吊牌价格",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "7",
    "field_domain_type": "通用字段",
    "deepdraw_field": "颜色",
    "source_type": "launch_plan",
    "source_field": "颜色",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "8",
    "field_domain_type": "通用字段",
    "deepdraw_field": "尺码",
    "source_type": "launch_plan",
    "source_field": "尺码",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "9",
    "field_domain_type": "通用字段",
    "deepdraw_field": "尺码表",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "10",
    "field_domain_type": "通用字段",
    "deepdraw_field": "多平台尺码",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "11",
    "field_domain_type": "通用字段",
    "deepdraw_field": "唯品会尺码表",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "12",
    "field_domain_type": "通用字段",
    "deepdraw_field": "抖音尺码表",
    "source_type": "fixed",
    "source_field": null,
    "default_value": "只需要填身高体重",
    "enabled": true
  },
  {
    "id": "13",
    "field_domain_type": "通用字段",
    "deepdraw_field": "天猫尺码表",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "14",
    "field_domain_type": "通用字段",
    "deepdraw_field": "商家SKU",
    "source_type": "launch_plan",
    "source_field": "SKU",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "15",
    "field_domain_type": "通用字段",
    "deepdraw_field": "详情页标题",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "16",
    "field_domain_type": "通用字段",
    "deepdraw_field": "抖音参考价",
    "source_type": "launch_plan",
    "source_field": "吊牌价格",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "17",
    "field_domain_type": "通用字段",
    "deepdraw_field": "抖音参考价格类型",
    "source_type": "fixed",
    "source_field": null,
    "default_value": "吊牌价",
    "enabled": true
  },
  {
    "id": "18",
    "field_domain_type": "通用字段",
    "deepdraw_field": "商家编码",
    "source_type": "launch_plan",
    "source_field": "款号",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "19",
    "field_domain_type": "通用字段",
    "deepdraw_field": "商家条形码",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "20",
    "field_domain_type": "通用字段",
    "deepdraw_field": "尺寸推荐表",
    "source_type": "fixed",
    "source_field": null,
    "default_value": "禁用",
    "enabled": true
  },
  {
    "id": "21",
    "field_domain_type": "通用字段",
    "deepdraw_field": "试穿报告表",
    "source_type": "fixed",
    "source_field": null,
    "default_value": "禁用",
    "enabled": true
  },
  {
    "id": "22",
    "field_domain_type": "通用字段",
    "deepdraw_field": "详情页面料",
    "source_type": "copywriting",
    "source_field": "面料成分",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "23",
    "field_domain_type": "通用字段",
    "deepdraw_field": "面料(多选)",
    "source_type": "copywriting",
    "source_field": "面料成分",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "24",
    "field_domain_type": "通用字段",
    "deepdraw_field": "模特实拍",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "25",
    "field_domain_type": "通用字段",
    "deepdraw_field": "是否商场同款",
    "source_type": "launch_plan",
    "source_field": "线上款为非商场同款，全域款为商场同款",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "26",
    "field_domain_type": "通用字段",
    "deepdraw_field": "材质成分",
    "source_type": "copywriting",
    "source_field": "面料成分",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "27",
    "field_domain_type": "通用字段",
    "deepdraw_field": "面料",
    "source_type": "copywriting",
    "source_field": "面料成分",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "28",
    "field_domain_type": "通用字段",
    "deepdraw_field": "成分及含量",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "29",
    "field_domain_type": "通用字段",
    "deepdraw_field": "材质",
    "source_type": "copywriting",
    "source_field": "面料成分",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "30",
    "field_domain_type": "通用字段",
    "deepdraw_field": "里料",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "31",
    "field_domain_type": "通用字段",
    "deepdraw_field": "填充物种类",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "32",
    "field_domain_type": "通用字段",
    "deepdraw_field": "安全等级",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "33",
    "field_domain_type": "通用字段",
    "deepdraw_field": "上市时间",
    "source_type": "launch_plan",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "34",
    "field_domain_type": "通用字段",
    "deepdraw_field": "适用性别",
    "source_type": "launch_plan",
    "source_field": "性别",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "35",
    "field_domain_type": "通用字段",
    "deepdraw_field": "适用性别(多选)",
    "source_type": "launch_plan",
    "source_field": "性别",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "36",
    "field_domain_type": "通用字段",
    "deepdraw_field": "成分含量",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "37",
    "field_domain_type": "通用字段",
    "deepdraw_field": "是否开裆",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "38",
    "field_domain_type": "通用字段",
    "deepdraw_field": "腰型",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "39",
    "field_domain_type": "通用字段",
    "deepdraw_field": "裤门襟",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "40",
    "field_domain_type": "通用字段",
    "deepdraw_field": "款式",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "41",
    "field_domain_type": "通用字段",
    "deepdraw_field": "风格",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "42",
    "field_domain_type": "通用字段",
    "deepdraw_field": "图案",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "43",
    "field_domain_type": "通用字段",
    "deepdraw_field": "适用年龄",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "44",
    "field_domain_type": "通用字段",
    "deepdraw_field": "服装版型",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "45",
    "field_domain_type": "通用字段",
    "deepdraw_field": "风格(多选)",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "46",
    "field_domain_type": "通用字段",
    "deepdraw_field": "流行元素(多选)",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "47",
    "field_domain_type": "通用字段",
    "deepdraw_field": "是否有腰带",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "48",
    "field_domain_type": "通用字段",
    "deepdraw_field": "厚薄",
    "source_type": "copywriting",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "49",
    "field_domain_type": "通用字段",
    "deepdraw_field": "里料材质(多选)",
    "source_type": "copywriting",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "50",
    "field_domain_type": "通用字段",
    "deepdraw_field": "是否加绒",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "51",
    "field_domain_type": "通用字段",
    "deepdraw_field": "包装种类",
    "source_type": "fixed",
    "source_field": null,
    "default_value": "人工填写，每个商品这个项都是填写一样的值",
    "enabled": true
  },
  {
    "id": "52",
    "field_domain_type": "通用字段",
    "deepdraw_field": "图案(多选)",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "53",
    "field_domain_type": "通用字段",
    "deepdraw_field": "裤长",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "54",
    "field_domain_type": "通用字段",
    "deepdraw_field": "成分含量(文本)",
    "source_type": "copywriting",
    "source_field": "面料成分",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "55",
    "field_domain_type": "通用字段",
    "deepdraw_field": "类型",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "56",
    "field_domain_type": "通用字段",
    "deepdraw_field": "模板厚度",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "57",
    "field_domain_type": "通用字段",
    "deepdraw_field": "模板柔软度",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "58",
    "field_domain_type": "通用字段",
    "deepdraw_field": "模板弹力",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "59",
    "field_domain_type": "通用字段",
    "deepdraw_field": "模板透气度",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "60",
    "field_domain_type": "通用字段",
    "deepdraw_field": "模板长度",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "61",
    "field_domain_type": "通用字段",
    "deepdraw_field": "模板版型",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "62",
    "field_domain_type": "通用字段",
    "deepdraw_field": "洗涤",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "63",
    "field_domain_type": "通用字段",
    "deepdraw_field": "介绍",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "64",
    "field_domain_type": "通用字段",
    "deepdraw_field": "适用季节(多选)",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "65",
    "field_domain_type": "通用字段",
    "deepdraw_field": "适用年龄(多选)",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "66",
    "field_domain_type": "通用字段",
    "deepdraw_field": "适用季节",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "67",
    "field_domain_type": "通用字段",
    "deepdraw_field": "是否可开档",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "68",
    "field_domain_type": "通用字段",
    "deepdraw_field": "洗涤说明",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "69",
    "field_domain_type": "通用字段",
    "deepdraw_field": "吊牌价",
    "source_type": "mdm",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "70",
    "field_domain_type": "通用字段",
    "deepdraw_field": "童装产地",
    "source_type": "fixed",
    "source_field": null,
    "default_value": "中国大陆",
    "enabled": true
  },
  {
    "id": "71",
    "field_domain_type": "通用字段",
    "deepdraw_field": "库存计数",
    "source_type": "fixed",
    "source_field": null,
    "default_value": "买家拍下减库存",
    "enabled": true
  },
  {
    "id": "72",
    "field_domain_type": "通用字段",
    "deepdraw_field": "会员打折",
    "source_type": "fixed",
    "source_field": null,
    "default_value": "不参与会员打折",
    "enabled": true
  },
  {
    "id": "73",
    "field_domain_type": "通用字段",
    "deepdraw_field": "所在地",
    "source_type": "fixed",
    "source_field": null,
    "default_value": "浙江杭州",
    "enabled": true
  },
  {
    "id": "74",
    "field_domain_type": "通用字段",
    "deepdraw_field": "原产国",
    "source_type": "fixed",
    "source_field": null,
    "default_value": "中国",
    "enabled": true
  },
  {
    "id": "75",
    "field_domain_type": "1688",
    "deepdraw_field": "报价方式",
    "source_type": "fixed",
    "source_field": null,
    "default_value": "按产品数量报价",
    "enabled": true
  },
  {
    "id": "76",
    "field_domain_type": "1688",
    "deepdraw_field": "价格区间",
    "source_type": "fixed",
    "source_field": null,
    "default_value": "购买数量>2  产品单价(元)=吊牌价",
    "enabled": true
  },
  {
    "id": "77",
    "field_domain_type": "1688",
    "deepdraw_field": "主面料成分含量",
    "source_type": "copywriting",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "78",
    "field_domain_type": "1688",
    "deepdraw_field": "销售单位",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "79",
    "field_domain_type": "1688",
    "deepdraw_field": "销售单位换算比率",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "80",
    "field_domain_type": "1688",
    "deepdraw_field": "供货方式",
    "source_type": "fixed",
    "source_field": null,
    "default_value": "仅现货",
    "enabled": true
  },
  {
    "id": "81",
    "field_domain_type": "1688",
    "deepdraw_field": "平车针距12~14针/3cm",
    "source_type": "fixed",
    "source_field": null,
    "default_value": "否",
    "enabled": true
  },
  {
    "id": "82",
    "field_domain_type": "1688",
    "deepdraw_field": "AQL抽检标准",
    "source_type": "fixed",
    "source_field": null,
    "default_value": "无",
    "enabled": true
  },
  {
    "id": "83",
    "field_domain_type": "1688",
    "deepdraw_field": "面料工艺",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "84",
    "field_domain_type": "1688",
    "deepdraw_field": "计量单位",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "85",
    "field_domain_type": "1688",
    "deepdraw_field": "货源类别",
    "source_type": "fixed",
    "source_field": null,
    "default_value": "现货",
    "enabled": true
  },
  {
    "id": "86",
    "field_domain_type": "1688",
    "deepdraw_field": "是否库存",
    "source_type": "fixed",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "87",
    "field_domain_type": "1688",
    "deepdraw_field": "是否跨境出口专供货源",
    "source_type": "fixed",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "88",
    "field_domain_type": "1688",
    "deepdraw_field": "建议零售价",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "89",
    "field_domain_type": "天猫",
    "deepdraw_field": "商品展示标题",
    "source_type": "fixed",
    "source_field": null,
    "default_value": "巴拉巴拉+性别+品类",
    "enabled": true
  },
  {
    "id": "90",
    "field_domain_type": "天猫",
    "deepdraw_field": "无线短标题",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "91",
    "field_domain_type": "天猫",
    "deepdraw_field": "天猫商品卖点",
    "source_type": "copywriting",
    "source_field": "推荐理由",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "92",
    "field_domain_type": "天猫",
    "deepdraw_field": "天猫推荐理由",
    "source_type": "copywriting",
    "source_field": "推荐理由",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "93",
    "field_domain_type": "天猫",
    "deepdraw_field": "奥莱店折扣价",
    "source_type": "launch_plan",
    "source_field": "吊牌价格",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "94",
    "field_domain_type": "天猫",
    "deepdraw_field": "天猫货号",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "95",
    "field_domain_type": "天猫",
    "deepdraw_field": "天猫导购标题",
    "source_type": "copywriting",
    "source_field": "导购标题",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "96",
    "field_domain_type": "天猫",
    "deepdraw_field": "是否新品",
    "source_type": "fixed",
    "source_field": null,
    "default_value": "是",
    "enabled": true
  },
  {
    "id": "97",
    "field_domain_type": "天猫",
    "deepdraw_field": "销售渠道类型(单选)",
    "source_type": "launch_plan",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "98",
    "field_domain_type": "天猫",
    "deepdraw_field": "专柜价",
    "source_type": "fixed",
    "source_field": null,
    "default_value": "10000",
    "enabled": true
  },
  {
    "id": "99",
    "field_domain_type": "天猫",
    "deepdraw_field": "尺码类型",
    "source_type": "fixed",
    "source_field": null,
    "default_value": "身型",
    "enabled": true
  },
  {
    "id": "100",
    "field_domain_type": "京东",
    "deepdraw_field": "京东-京东商品标语",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "101",
    "field_domain_type": "京东",
    "deepdraw_field": "标语加链接的文字",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "102",
    "field_domain_type": "京东",
    "deepdraw_field": "标语链接地址",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "103",
    "field_domain_type": "京东",
    "deepdraw_field": "京东标题",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "105",
    "field_domain_type": "京东",
    "deepdraw_field": "京东市场价",
    "source_type": "fixed",
    "source_field": null,
    "default_value": "吊牌价格",
    "enabled": true
  },
  {
    "id": "106",
    "field_domain_type": "京东",
    "deepdraw_field": "京东规格子属性",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "107",
    "field_domain_type": "京东",
    "deepdraw_field": "京东自营子属性",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "108",
    "field_domain_type": "京东",
    "deepdraw_field": "分类",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "109",
    "field_domain_type": "京东",
    "deepdraw_field": "京东材质成分",
    "source_type": "copywriting",
    "source_field": "吊牌成分",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "110",
    "field_domain_type": "京东",
    "deepdraw_field": "是否申请新品",
    "source_type": "fixed",
    "source_field": null,
    "default_value": "是",
    "enabled": true
  },
  {
    "id": "111",
    "field_domain_type": "京东",
    "deepdraw_field": "京东商品重量",
    "source_type": "fixed",
    "source_field": null,
    "default_value": "1",
    "enabled": true
  },
  {
    "id": "112",
    "field_domain_type": "京东",
    "deepdraw_field": "[包装]长",
    "source_type": "fixed",
    "source_field": null,
    "default_value": "100",
    "enabled": true
  },
  {
    "id": "113",
    "field_domain_type": "京东",
    "deepdraw_field": "[包装]宽",
    "source_type": "fixed",
    "source_field": null,
    "default_value": "100",
    "enabled": true
  },
  {
    "id": "114",
    "field_domain_type": "京东",
    "deepdraw_field": "[包装]高",
    "source_type": "fixed",
    "source_field": null,
    "default_value": "100",
    "enabled": true
  },
  {
    "id": "115",
    "field_domain_type": "京东",
    "deepdraw_field": "是否可定制",
    "source_type": "fixed",
    "source_field": null,
    "default_value": "不可定制",
    "enabled": true
  },
  {
    "id": "116",
    "field_domain_type": "京东",
    "deepdraw_field": "京东产地",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "117",
    "field_domain_type": "京东",
    "deepdraw_field": "规格参数",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "118",
    "field_domain_type": "京东",
    "deepdraw_field": "包装清单",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "119",
    "field_domain_type": "京东",
    "deepdraw_field": "售后服务",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "120",
    "field_domain_type": "京东",
    "deepdraw_field": "京东发货地",
    "source_type": "fixed",
    "source_field": null,
    "default_value": "浙江杭州",
    "enabled": true
  },
  {
    "id": "121",
    "field_domain_type": "京东",
    "deepdraw_field": "京东自营商品重量",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "122",
    "field_domain_type": "唯品会",
    "deepdraw_field": "唯品会款号",
    "source_type": "launch_plan",
    "source_field": "款号",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "123",
    "field_domain_type": "唯品会",
    "deepdraw_field": "唯品会标题",
    "source_type": "copywriting",
    "source_field": "唯品标题",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "124",
    "field_domain_type": "唯品会",
    "deepdraw_field": "唯品会副标题",
    "source_type": "copywriting",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "125",
    "field_domain_type": "唯品会",
    "deepdraw_field": "唯品会核心描述",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "126",
    "field_domain_type": "唯品会",
    "deepdraw_field": "唯品会市场价",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "127",
    "field_domain_type": "唯品会",
    "deepdraw_field": "唯品会温馨提示",
    "source_type": "fixed",
    "source_field": null,
    "default_value": "以上数据仅供参考，尺码手工测量难免1-2cm误差；插肩袖款式袖长为含领中尺寸数据",
    "enabled": true
  },
  {
    "id": "128",
    "field_domain_type": "唯品会",
    "deepdraw_field": "弹力",
    "source_type": "copywriting",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "129",
    "field_domain_type": "唯品会",
    "deepdraw_field": "选购热点",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "130",
    "field_domain_type": "唯品会",
    "deepdraw_field": "款式(多选)",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "131",
    "field_domain_type": "唯品会",
    "deepdraw_field": "唯品【包装】长",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "132",
    "field_domain_type": "唯品会",
    "deepdraw_field": "唯品【包装】宽",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "133",
    "field_domain_type": "唯品会",
    "deepdraw_field": "唯品【包装】高",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "134",
    "field_domain_type": "唯品会",
    "deepdraw_field": "唯品重量",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "135",
    "field_domain_type": "唯品会",
    "deepdraw_field": "适用人群(多选)",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "136",
    "field_domain_type": "唯品会",
    "deepdraw_field": "款式(单选)",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "137",
    "field_domain_type": "唯品会",
    "deepdraw_field": "唯品会产地",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "138",
    "field_domain_type": "唯品会",
    "deepdraw_field": "生产/经销厂家",
    "source_type": "fixed",
    "source_field": null,
    "default_value": "浙江森马服饰股份有限公司",
    "enabled": true
  },
  {
    "id": "139",
    "field_domain_type": "唯品会",
    "deepdraw_field": "厂家地址",
    "source_type": "fixed",
    "source_field": null,
    "default_value": "温州市瓯海区娄桥工业园南汇路98号",
    "enabled": true
  },
  {
    "id": "140",
    "field_domain_type": "唯品会",
    "deepdraw_field": "执行标准",
    "source_type": "copywriting",
    "source_field": "吊牌截取",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "141",
    "field_domain_type": "唯品会",
    "deepdraw_field": "详细材质信息(VIP)",
    "source_type": "copywriting",
    "source_field": "材质成分",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "142",
    "field_domain_type": "唯品会",
    "deepdraw_field": "唯品会洗涤说明",
    "source_type": "fixed",
    "source_field": null,
    "default_value": "请根据产品面料特性进行清洗养护，具体方法可参考产品水洗唛/标签",
    "enabled": true
  },
  {
    "id": "143",
    "field_domain_type": "唯品会",
    "deepdraw_field": "唯品会配件信息",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "144",
    "field_domain_type": "唯品会",
    "deepdraw_field": "唯品会售后信息",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "145",
    "field_domain_type": "有赞",
    "deepdraw_field": "有赞商品卖点",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "146",
    "field_domain_type": "有赞",
    "deepdraw_field": "划线价",
    "source_type": "launch_plan",
    "source_field": "吊牌价",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "147",
    "field_domain_type": "有赞",
    "deepdraw_field": "材质成分(多选)",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "148",
    "field_domain_type": "有赞",
    "deepdraw_field": "袖长(多选)",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "149",
    "field_domain_type": "有赞",
    "deepdraw_field": "上市时间(文本)",
    "source_type": "launch_plan",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "150",
    "field_domain_type": "有赞",
    "deepdraw_field": "童装产地(多选)",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "151",
    "field_domain_type": "拼多多",
    "deepdraw_field": "拼多多标题",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "152",
    "field_domain_type": "拼多多",
    "deepdraw_field": "商品短标题",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "153",
    "field_domain_type": "拼多多",
    "deepdraw_field": "商品描述",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "154",
    "field_domain_type": "拼多多",
    "deepdraw_field": "商品市场价",
    "source_type": "launch_plan",
    "source_field": "吊牌价",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "155",
    "field_domain_type": "拼多多",
    "deepdraw_field": "拼多多货源地",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "156",
    "field_domain_type": "拼多多",
    "deepdraw_field": "面料俗称",
    "source_type": "copywriting",
    "source_field": "根据面料成分填主材质",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "157",
    "field_domain_type": "小红书",
    "deepdraw_field": "小红书标题",
    "source_type": "copywriting",
    "source_field": "去掉巴拉巴拉",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "158",
    "field_domain_type": "小红书",
    "deepdraw_field": "商品简称",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "159",
    "field_domain_type": "小红书",
    "deepdraw_field": "商品特色",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "160",
    "field_domain_type": "小红书",
    "deepdraw_field": "净重（g）",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "161",
    "field_domain_type": "小红书",
    "deepdraw_field": "毛重（g）",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "162",
    "field_domain_type": "小红书",
    "deepdraw_field": "保质期（天）",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "163",
    "field_domain_type": "小红书",
    "deepdraw_field": "小红书商品描述",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "164",
    "field_domain_type": "小红书",
    "deepdraw_field": "小红书计量单位",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "165",
    "field_domain_type": "小红书",
    "deepdraw_field": "件数",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "166",
    "field_domain_type": "小红书",
    "deepdraw_field": "小红书发货时间",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "167",
    "field_domain_type": "抖音",
    "deepdraw_field": "抖音标题",
    "source_type": "copywriting",
    "source_field": "内容平台标题",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "168",
    "field_domain_type": "抖音",
    "deepdraw_field": "导购短标题",
    "source_type": "copywriting",
    "source_field": "导购标题",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "169",
    "field_domain_type": "抖音",
    "deepdraw_field": "抖音商品重量",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "170",
    "field_domain_type": "抖音",
    "deepdraw_field": "抖音商家推荐语",
    "source_type": "skip",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "171",
    "field_domain_type": "抖音",
    "deepdraw_field": "单用户累计限购(件)",
    "source_type": "fixed",
    "source_field": null,
    "default_value": "5",
    "enabled": true
  },
  {
    "id": "172",
    "field_domain_type": "抖音",
    "deepdraw_field": "每次限购(件)",
    "source_type": "fixed",
    "source_field": null,
    "default_value": "5",
    "enabled": true
  },
  {
    "id": "173",
    "field_domain_type": "抖音",
    "deepdraw_field": "售后服务承诺",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "174",
    "field_domain_type": "抖音",
    "deepdraw_field": "抖音面料材质",
    "source_type": "copywriting",
    "source_field": "面料成分",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "175",
    "field_domain_type": "抖音",
    "deepdraw_field": "里料材质(多选)",
    "source_type": "copywriting",
    "source_field": "面料成分",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "176",
    "field_domain_type": "抖音",
    "deepdraw_field": "里料材质成分含量(多选)",
    "source_type": "copywriting",
    "source_field": "面料成分",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "177",
    "field_domain_type": "快手",
    "deepdraw_field": "商品详情",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "178",
    "field_domain_type": "快手",
    "deepdraw_field": "快手标题",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "179",
    "field_domain_type": "快手",
    "deepdraw_field": "快手商品卖点",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "180",
    "field_domain_type": "快手",
    "deepdraw_field": "退款规则",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "181",
    "field_domain_type": "微信视频小店",
    "deepdraw_field": "微信视频小店标题",
    "source_type": "copywriting",
    "source_field": "内容平台标题",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "182",
    "field_domain_type": "微信视频小店",
    "deepdraw_field": "微信视频小店副标题",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "183",
    "field_domain_type": "微信视频小店",
    "deepdraw_field": "微信视频小店商品编码",
    "source_type": "launch_plan",
    "source_field": "款号",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "184",
    "field_domain_type": "微信视频小店",
    "deepdraw_field": "发货方式",
    "source_type": "fixed",
    "source_field": null,
    "default_value": "快递",
    "enabled": true
  },
  {
    "id": "185",
    "field_domain_type": "微信视频小店",
    "deepdraw_field": "适用场合",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "186",
    "field_domain_type": "微信视频小店",
    "deepdraw_field": "成分含量(文本)",
    "source_type": "copywriting",
    "source_field": "面料成分",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "187",
    "field_domain_type": "微信视频小店",
    "deepdraw_field": "适用年龄(文本)",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "188",
    "field_domain_type": "微信视频小店",
    "deepdraw_field": "颜色(文本)",
    "source_type": "launch_plan",
    "source_field": "颜色",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "189",
    "field_domain_type": "产品线：鞋品",
    "deepdraw_field": "25鞋子模板类型",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "190",
    "field_domain_type": "产品线：鞋品",
    "deepdraw_field": "25鞋子尺码表",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "191",
    "field_domain_type": "产品线：鞋品",
    "deepdraw_field": "是否婴童",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "192",
    "field_domain_type": "产品线：鞋品",
    "deepdraw_field": "25实拍文案",
    "source_type": "copywriting",
    "source_field": "细节文案",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "193",
    "field_domain_type": "产品线：鞋品",
    "deepdraw_field": "25产品名称",
    "source_type": "copywriting",
    "source_field": "名称",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "194",
    "field_domain_type": "产品线：鞋品",
    "deepdraw_field": "25面料成分",
    "source_type": "copywriting",
    "source_field": "面料成分+里料材质+鞋底材质",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "195",
    "field_domain_type": "产品线：中童",
    "deepdraw_field": "主图1",
    "source_type": "copywriting",
    "source_field": "主图ICON",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "196",
    "field_domain_type": "产品线：中童",
    "deepdraw_field": "主图2",
    "source_type": "copywriting",
    "source_field": "主图ICON",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "197",
    "field_domain_type": "产品线：中童",
    "deepdraw_field": "主图4文案1",
    "source_type": "copywriting",
    "source_field": "主图4第1句",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "198",
    "field_domain_type": "产品线：中童",
    "deepdraw_field": "主图4文案2",
    "source_type": "copywriting",
    "source_field": "主图4第2-3句",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "199",
    "field_domain_type": "产品线：中童",
    "deepdraw_field": "主图4样式",
    "source_type": "fixed",
    "source_field": null,
    "default_value": "主图4样式225",
    "enabled": true
  },
  {
    "id": "200",
    "field_domain_type": "产品线：中童",
    "deepdraw_field": "25产品名称",
    "source_type": "copywriting",
    "source_field": "名称",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "201",
    "field_domain_type": "产品线：中童",
    "deepdraw_field": "25面料成分",
    "source_type": "copywriting",
    "source_field": "面料成分",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "202",
    "field_domain_type": "产品线：中童",
    "deepdraw_field": "25服装面料文案",
    "source_type": "copywriting",
    "source_field": "面料名称-面料文案*面料三个关键词",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "203",
    "field_domain_type": "产品线：中童",
    "deepdraw_field": "25柔软指数",
    "source_type": "copywriting",
    "source_field": "柔软度",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "204",
    "field_domain_type": "产品线：中童",
    "deepdraw_field": "25厚薄指数",
    "source_type": "copywriting",
    "source_field": "厚薄",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "205",
    "field_domain_type": "产品线：中童",
    "deepdraw_field": "25弹力指数",
    "source_type": "copywriting",
    "source_field": "弹性",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "206",
    "field_domain_type": "产品线：中童",
    "deepdraw_field": "25服饰细节文案",
    "source_type": "copywriting",
    "source_field": "细节文案",
    "default_value": null,
    "enabled": true
  },
  {
    "id": "207",
    "field_domain_type": "产品线：中童",
    "deepdraw_field": "balaone仅专供新品",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "208",
    "field_domain_type": "产品线：中童",
    "deepdraw_field": "详情页AI标注",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "209",
    "field_domain_type": "产品线：中童",
    "deepdraw_field": "单色平台AI标",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  },
  {
    "id": "210",
    "field_domain_type": "产品线：中童",
    "deepdraw_field": "多色平台AI",
    "source_type": "manual",
    "source_field": null,
    "default_value": null,
    "enabled": true
  }
] as const;
export const DATABASE_RULE_SNAPSHOT: RuleSnapshotMetadata = {
  schemaVersion: 1,
  id: "balabala/ecommerce-balabala/1162",
  scope: { brandId: "balabala", tenantName: "电商巴拉巴拉", merchantId: "1162" },
  version: DATABASE_RULE_VERSION,
  source: "listingify.deepdraw_field_mapping_rule",
};

/** Legacy defaults belong only to the Balabala entry point, never the shared matcher. */
export function balabalaRuleScope(context: Record<string, unknown>): RuleScope {
  return {
    brandId: String(context.brandId ?? context.brand ?? "balabala"),
    tenantName: String(context.tenantName ?? context.tenant ?? "电商巴拉巴拉"),
    merchantId: String(context.merchantId ?? "1162"),
  };
}

export function databaseRuleSnapshot(context: Record<string, unknown>): RuleSnapshotMetadata | undefined {
  return matchesRuleScope(DATABASE_RULE_SNAPSHOT, balabalaRuleScope(context)) ? DATABASE_RULE_SNAPSHOT : undefined;
}

export function databaseRule(name: string, context: Record<string, unknown>, kind: string) {
  if (!databaseRuleSnapshot(context)) return undefined;
  const plan = (context.launchPlan ?? {}) as Record<string, unknown>;
  const category = JSON.stringify([plan.productLine, plan.category, plan.subcategory, (plan.raw as Record<string, unknown> | undefined)?.["年龄段"]]);
  return [...DATABASE_RULES].reverse().find(rule => rule.enabled && rule.deepdraw_field === name &&
    (rule.field_domain_type === "产品线：鞋品" ? kind === "shoe" : rule.field_domain_type === "产品线：中童" ? /中童|中大童/.test(category) : true));
}

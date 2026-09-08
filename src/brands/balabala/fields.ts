import type { WorkflowField } from "../../workflow/types.js";
import { balabalaApparelAgeTextForSizeRange } from "./size-chart-rules.js";

type JsonRecord = Record<string, unknown>;

const SPECIAL_MANUAL_FIELDS = new Set(["淘宝sku参数", "天猫sku参数", "天猫导购标题", "京东规格子属性", "京东自营子属性", "淘宝导购标题", "颜色备注"]);
const MERCHANT_SKU_COLUMNS = ["价格", "货号", "上市时间", "数量", "商家编码", "条形码", "零售价", "供货价", "唯品会货号", "唯品会条形码", "京东价", "划线价", "拼多多单买价", "拼多多团购价", "天猫特卖折扣价", "天猫特卖专柜价", "采购价", "京东自营市场价", "有赞标准价", "有赞价格", "原价", "小红书市场价", "抖音结算价格", "抖音价", "快手价", "爱库存供货价", "爱库存最低价", "好衣库结算价", "好衣库供货价", "好衣库价", "好衣库原价", "微信视频小店价格", "单品货号", "1688件重尺-重(g)", "小红书商家编码", "天猫SKU搜索标题"];
const MERCHANT_SKU_BASE_COLUMNS = MERCHANT_SKU_COLUMNS.slice(0, 10);
const MERCHANT_SKU_TRANSACTION_PRICE_COLUMNS = new Set(["价格", "供货价", "采购价", "抖音结算价格", "爱库存供货价", "好衣库结算价", "好衣库供货价"]);
const MERCHANT_SKU_LIST_PRICE_COLUMNS = new Set(MERCHANT_SKU_COLUMNS.filter((column) => /价$|市场价|标准价|原价/.test(column)));

function record(value: unknown): JsonRecord { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {}; }
function text(value: unknown): string { return value === undefined || value === null ? "" : typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value).trim() : ""; }
function compact(value: unknown): string { return text(value).replace(/[\s()（）:：]/g, "").toLowerCase(); }
function businessKey(value: unknown): string { return text(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ""); }
function nameOf(field: JsonRecord): string { return text(field.fieldName ?? field.field_name ?? field.name); }
function typeOf(field: JsonRecord): string { return text(field.fieldType ?? field.field_type ?? field.type) || "TEXT"; }
function bool(value: unknown): boolean { return value === true || value === 1 || ["true", "1"].includes(text(value).toLowerCase()); }
function required(field: JsonRecord): boolean { const attributes = record(field.attributes); return bool(field.required ?? field.isRequired ?? field.is_required ?? attributes.isRequired ?? attributes.is_required); }
function saleProp(field: JsonRecord): boolean { const attributes = record(field.attributes); return bool(field.saleProp ?? field.sale_prop ?? field.isSaleProp ?? field.is_sale_prop ?? attributes.isSaleProp ?? attributes.is_sale_prop); }
function optionText(value: unknown): string { const item = record(value); return text(typeof value === "object" ? item.name ?? item.value ?? item.label ?? item.text ?? item.optionName : value); }
function options(field: JsonRecord): string[] { const source = field.options ?? field.options_json ?? field.optionsJson; return Array.isArray(source) ? source.map(optionText).filter(Boolean) : []; }
function sourceRefs(...values: unknown[]): WorkflowField["sourceRefs"] { return values.map(record).map((value) => record(value.sourceRef)).filter((value) => text(value.path) && text(value.sha256)) as WorkflowField["sourceRefs"]; }

function decimal(value: unknown, adjustment = 0): string {
  const number = Number(text(value));
  return Number.isFinite(number) ? String(Number((number + adjustment).toFixed(2))) : "";
}

function productKind(context: JsonRecord): "shoe" | "apparel" | "generic" {
  const plan = record(context.launchPlan);
  const category = `${text(plan.productLine)} ${text(plan.category)} ${text(plan.subcategory)}`;
  if (/鞋|靴/.test(category)) return "shoe";
  if (/服|衣|裤|裙|童装/.test(category)) return "apparel";
  return "generic";
}

function saleSizeLabel(value: unknown, kind: "shoe" | "apparel" | "generic"): string {
  const raw = text(value);
  const number = raw.match(/^0*(\d{1,3}(?:\.5)?)(?:\s*(?:cm|厘米|公分|码))?$/i)?.[1] ?? "";
  if (number) return kind === "shoe" ? `${Number(number)}码` : kind === "apparel" ? `${Number(number)}cm` : String(Number(number));
  return kind === "apparel" ? raw : "";
}

function launchMonth(value: unknown): string {
  const match = text(value).match(/^(\d{4})[-/.](\d{1,2})/);
  return match ? `${match[1]}-${match[2].padStart(2, "0")}` : "";
}

function optionMatch(name: string, value: string, permitted: string[], multi = false): string {
  if (!value) return "";
  if (permitted.length === 0) return value;
  const key = compact(name);
  const pick = (...predicates: Array<(option: string) => boolean>): string => permitted.find((option) => predicates.some((predicate) => predicate(option))) ?? "";
  const exact = (input: string): string => permitted.find((option) => compact(option) === compact(input)) ?? "";
  const seasonal = (input: string): string => {
    const exactValue = exact(input);
    if (exactValue) return exactValue;
    const year = input.match(/20\d{2}/)?.[0] ?? "";
    const season = input.match(/[春夏秋冬]/)?.[0] ?? "";
    return pick(
      (option) => Boolean(year && season) && option.includes(year) && option.includes(season),
      (option) => Boolean(season) && compact(option) === compact(`${season}季`),
      (option) => Boolean(season) && compact(option) === compact(season),
    );
  };
  const ageRange = (input: string): { start: number; end: number } | undefined => {
    const match = input.replace(/[－—–~～至到]/g, "-").match(/(\d{1,2})\s*(?:岁|周岁)?\s*-\s*(\d{1,2})\s*(?:岁|周岁)?/);
    if (!match) return undefined;
    const start = Number(match[1]);
    const end = Number(match[2]);
    return Number.isFinite(start) && Number.isFinite(end) ? { start: Math.min(start, end), end: Math.max(start, end) } : undefined;
  };
  type AgeRangeMonths = { start: number; end: number };
  const ageMonths = (amount: number, unit: string): number => unit === "岁半" ? Math.round((amount + 0.5) * 12) : /岁|周岁/.test(unit) ? Math.round(amount * 12) : Math.round(amount);
  const closedAgeRange = (input: string): AgeRangeMonths | undefined => {
    if (/(?:周岁|岁|个月|月)\s*(?:以上|及以上|以后|起|以下|及以下|以内)/.test(input)) return undefined;
    const range = input.match(/(\d{1,2}(?:\.\d+)?)\s*(周岁|岁半|岁|个月|月)?\s*(?:[（(][^）)]*[）)])?\s*[-~～至—－]\s*(\d{1,2}(?:\.\d+)?)\s*(周岁|岁半|岁|个月|月)(?:\s*[（(][^）)]*[）)])?/);
    if (range) {
      const endUnit = range[4]!;
      const startUnit = range[2] || endUnit;
      const start = ageMonths(Number(range[1]), startUnit);
      const end = ageMonths(Number(range[3]), endUnit);
      return Number.isFinite(start) && Number.isFinite(end) ? { start: Math.min(start, end), end: Math.max(start, end) } : undefined;
    }
    const single = input.match(/(\d{1,2}(?:\.\d+)?)\s*(周岁|岁半|岁|个月|月)/);
    if (!single) return undefined;
    const months = ageMonths(Number(single[1]), single[2]!);
    return Number.isFinite(months) ? { start: months, end: months } : undefined;
  };
  const openAgeRange = (input: string): AgeRangeMonths | undefined => {
    const match = input.match(/(\d{1,2}(?:\.\d+)?)\s*(周岁|岁半|岁|个月|月)\s*(以上|及以上|以后|起|以下|及以下|以内)/);
    if (!match) return undefined;
    const months = ageMonths(Number(match[1]), match[2]!);
    if (!Number.isFinite(months)) return undefined;
    return /以下|以内/.test(match[3]!) ? { start: 0, end: months } : { start: months, end: Number.POSITIVE_INFINITY };
  };
  const ageRangesOverlap = (left: AgeRangeMonths, right: AgeRangeMonths): boolean => left.start <= right.end && left.end >= right.start;
  const ageRangeWidth = (range: AgeRangeMonths): number => range.end - range.start;
  const normalizedAge = (input: string, isMulti: boolean): string => {
    const ranges = input.split(/[;；]/).map(closedAgeRange).filter((range): range is AgeRangeMonths => Boolean(range));
    const source = ranges.length ? { start: Math.min(...ranges.map((range) => range.start)), end: Math.max(...ranges.map((range) => range.end)) } : openAgeRange(input);
    if (!source) return "";
    const candidates = permitted.map((option, index) => ({ option, index, range: closedAgeRange(option) ?? openAgeRange(option) }))
      .filter((candidate): candidate is { option: string; index: number; range: AgeRangeMonths } => Boolean(candidate.range));
    const allStage = permitted.find((option) => /^(?:全阶段|全年龄|全龄段|全龄|通用|不限)$/.test(option));
    if (isMulti) {
      const values = candidates.filter((candidate) => Number.isFinite(candidate.range.end) && ageRangesOverlap(source, candidate.range)).map((candidate) => candidate.option);
      return [...new Set(values)].join(";") || allStage || "";
    }
    const covering = candidates.filter((candidate) => candidate.range.start <= source.start && candidate.range.end >= source.end)
      .sort((left, right) => ageRangeWidth(left.range) - ageRangeWidth(right.range) || left.index - right.index)[0];
    if (covering) return covering.option;
    if (allStage) return allStage;
    return candidates.filter((candidate) => ageRangesOverlap(source, candidate.range))
      .sort((left, right) => {
        const leftOverlap = Math.min(left.range.end, source.end) - Math.max(left.range.start, source.start);
        const rightOverlap = Math.min(right.range.end, source.end) - Math.max(right.range.start, source.start);
        return rightOverlap - leftOverlap || ageRangeWidth(left.range) - ageRangeWidth(right.range) || left.index - right.index;
      })[0]?.option ?? "";
  };
  const population = (input: string, isMulti: boolean): string => {
    const range = ageRange(input);
    if (!range) return "";
    if (!isMulti) {
      const candidates = range.end <= 3
        ? ["婴幼儿", "婴童", "幼童", "儿童", "通用"]
        : range.end <= 8
          ? ["幼童", "小童", "儿童", "学生", "通用"]
          : range.start >= 12
            ? ["青少年", "少年", "中学生", "学生", "儿童", "通用"]
            : ["中大童", "中童", "儿童", "少年", "青少年", "学生", "通用"];
      return pick(...candidates.map((candidate) => (option: string) => option === candidate));
    }
    const ranges = new Map<string, { start: number; end: number }>([
      ["婴童", { start: 0, end: 3 }], ["幼童", { start: 1, end: 6 }], ["小童", { start: 3, end: 8 }], ["儿童", { start: 3, end: 14 }],
      ["小学生", { start: 6, end: 12 }], ["中童", { start: 6, end: 12 }], ["中大童", { start: 8, end: 14 }], ["中学生", { start: 12, end: 18 }], ["青少年", { start: 12, end: 18 }],
    ]);
    return permitted.filter((option) => {
      const optionRange = ranges.get(option);
      return Boolean(optionRange && range.start <= optionRange.end && range.end >= optionRange.start);
    }).join(";");
  };
  const material = (input: string): string => {
    const hasSynthetic = /合成材料|合成革|人造革|\bpu\b|羊巴革|油蜡|超纤/i.test(input);
    const hasTextile = /织物|纺织|布料|网布|网面|飞织/.test(input);
    if (key === "鞋面" && hasSynthetic && hasTextile) {
      const combination = pick((option) => /织物|纺织|网/.test(option) && /合成革|人造革|PU/i.test(option));
      if (combination) return combination;
    }
    if (/(鞋底材质|鞋底)/.test(key)) {
      if (/md|eva/i.test(input)) return pick((option) => /EVA/i.test(option), (option) => /复合底/.test(option), (option) => /^(?:其他|其它)$/.test(option));
      if (/rb|橡胶/i.test(input)) return pick((option) => /橡胶/.test(option));
      if (/tpr/i.test(input)) return pick((option) => /TPR|橡胶|复合底/i.test(option));
    }
    if (/鞋垫材质/.test(key)) {
      if (/长毛绒/.test(input)) return pick((option) => /人造.*长毛绒/.test(option), (option) => /人造毛/.test(option), (option) => /纺织/.test(option), (option) => /^(?:其他|其它)$/.test(option));
      if (/短毛绒|羊羔绒|人造毛|天鹅绒/.test(input)) return pick((option) => /人造.*短毛绒/.test(option), (option) => /人造毛/.test(option), (option) => /纺织/.test(option), (option) => /^(?:其他|其它)$/.test(option));
      if (hasTextile) return pick((option) => /纺织|织物|布/.test(option), (option) => /^(?:其他|其它)$/.test(option));
    }
    if (/帮面材质|鞋面材质|配皮材质/.test(key)) {
      if (/kpu|超纤|微纤/i.test(input)) return pick((option) => /微纤维革|超纤/.test(option), (option) => /^(?:其他|其它)$/.test(option));
      if (hasSynthetic) return pick((option) => /合成革|人造革|\bPU\b/i.test(option), (option) => /^(?:其他|其它)$/.test(option));
      if (hasTextile) return pick((option) => /棉布|绸缎|灯芯绒|织物|纺织|网布|网面/.test(option), (option) => /^(?:其他|其它)$/.test(option));
    }
    if (/内里材质|里料材质/.test(key)) {
      if (/短毛绒|天鹅绒|羊羔绒|绒/.test(input)) return pick((option) => /人造毛|绒|纺织/.test(option), (option) => /^(?:其他|其它)$/.test(option));
      if (hasTextile) return pick((option) => /纺织|织物/.test(option), (option) => /^(?:其他|其它)$/.test(option));
    }
    return "";
  };
  const shoeStructure = (input: string): string => {
    if (/(款式|类型|分类|产品类别)/.test(key)) {
      return pick(
        (option) => compact(option) === compact(input),
        (option) => /运动板鞋/.test(input) && option === "板鞋",
        (option) => /爬爬鞋|学步鞋/.test(input) && option === "学步鞋",
        (option) => /凉鞋/.test(input) && /运动凉鞋/.test(option),
        (option) => /户外/.test(input) && /户外休闲鞋/.test(option),
        (option) => /户外/.test(input) && /户外鞋/.test(option),
        (option) => /徒步/.test(input) && /徒步鞋/.test(option),
        (option) => /登山/.test(input) && /登山鞋/.test(option),
        (option) => /休闲|运动鞋|运动/.test(input) && /运动休闲鞋/.test(option),
        (option) => option.includes(input) || input.includes(option),
      );
    }
    return "";
  };
  const apparelStructure = (input: string): string => {
    if (!/(款式|类型|分类)/.test(key)) return "";
    return pick(
      (option) => compact(option) === compact(input),
      (option) => /直筒裤/.test(input) && option === "直筒裤",
      (option) => /牛仔(?:裤|长裤|短裤|中裤)/.test(input) && option === "牛仔裤",
      (option) => /弯刀/.test(input) && /弯刀裤/.test(option),
      (option) => /针织长裤|长裤/.test(input) && option === "长裤款",
      (option) => /针织长裤|长裤/.test(input) && option === "长裤",
      (option) => /三合一|一衣三穿/.test(input) && /三合一|一衣三穿/.test(option),
      (option) => /棉服|棉衣/.test(input) && option === "短款棉服",
      (option) => /棉服|棉衣/.test(input) && /棉服/.test(option),
      (option) => option.includes(input) || input.includes(option),
    );
  };
  const one = (input: string): string => {
    const direct = exact(input);
    if (direct) return direct;
    if (/适用季节|上市时间/.test(key)) return seasonal(input);
    if (/适用人群/.test(key)) return population(input, false) || (/男|女|中性|通用/.test(input) ? pick((option) => option === input, (option) => option.includes(input)) : "");
    if (/适用年龄|年龄段/.test(key)) return normalizedAge(input, false) || pick((option) => option === input, (option) => input.includes(option) || option.includes(input));
    if (/原产国/.test(key) && /中国|china/i.test(input)) return pick((option) => option === "中国", (option) => /中国/.test(option));
    if (key === "产地" && /浙江杭州|杭州|中国/.test(input)) return pick((option) => option === "浙江杭州", (option) => option.includes("杭州"), (option) => option.includes("中国"));
    if (key === "品牌单选" || key === "品牌") return /巴拉巴拉|balabala/i.test(input) ? pick((option) => /巴拉巴拉|balabala/i.test(option)) : "";
    if (key === "性别多选" || key === "性别") {
      if (/男/.test(input) && !/女/.test(input)) return pick((option) => option === "男童", (option) => option === "男", (option) => option.includes("男") && !option.includes("女"));
      if (/女/.test(input) && !/男/.test(input)) return pick((option) => option === "女童", (option) => option === "女", (option) => option.includes("女") && !option.includes("男"));
      if (/中性|男女|通用/.test(input)) return pick((option) => /中性|男女|通用/.test(option));
    }
    if (key === "服装版型" || key === "版型" || key.endsWith("版型")) {
      if (/宽松/.test(input)) return pick((option) => option === "宽松型", (option) => option === "宽松", (option) => option.includes("宽松"));
      if (/标准|常规/.test(input)) return pick((option) => option === "标准型", (option) => option === "标准", (option) => option === "常规");
      if (/紧身/.test(input)) return pick((option) => option === "紧身型", (option) => option.includes("紧身"));
      if (/直筒/.test(input)) return pick((option) => option === "直筒型", (option) => option.includes("直筒"));
    }
    if (key === "厚薄" || key === "厚度" || key.endsWith("厚薄指数")) {
      if (/偏厚|厚实|厚款|加厚/.test(input)) return pick((option) => option === "加厚", (option) => option === "超厚", (option) => option === "厚", (option) => option.includes("厚") && !option.includes("薄"));
      if (/适中|普通|常规/.test(input)) return pick((option) => option === "适中", (option) => option === "普通", (option) => option === "常规", (option) => option === "常规款");
      if (/超薄/.test(input)) return pick((option) => option === "超薄");
      if (/轻薄|薄款|偏薄|薄/.test(input)) return pick((option) => option === "轻薄", (option) => option === "薄", (option) => option.includes("薄"));
    }
    if (key === "弹力" || key === "弹性" || key.endsWith("弹力指数") || key.endsWith("弹性指数")) {
      if (/无弹/.test(input)) return pick((option) => option === "无弹", (option) => option.includes("无弹"));
      if (/微弹/.test(input)) return pick((option) => option === "微弹", (option) => option.includes("微弹"));
      if (/高弹/.test(input)) return pick((option) => option === "高弹", (option) => option.includes("高弹"));
      if (/弹力|弹性/.test(input)) return pick((option) => option === "常规", (option) => option === "微弹", (option) => option.includes("弹"));
    }
    if (key === "腰型" && /不适用|无|其他/.test(input)) return pick((option) => option === "自然腰", (option) => option === "松紧腰", (option) => option.includes("腰"));
    if (key === "裤门襟" && /不适用|无|其他/.test(input)) return pick((option) => option === "松紧", (option) => option === "松紧带", (option) => option === "其他");
    if (key === "是否可开档" || key === "是否开裆" || key === "是否可开裆") {
      if (/^(?:否|不|无)|不开|闭档/.test(input)) return pick((option) => option === "不开裆", (option) => option === "闭档", (option) => option.includes("不开"), (option) => option.includes("闭档"));
      if (/^(?:是|有)|开[档裆]/.test(input)) return pick((option) => option === "开裆", (option) => option === "开档", (option) => option.includes("可开"), (option) => option.includes("开裆") || option.includes("开档"));
    }
    if (["填充物", "填充物多选", "填充物种类", "填充物文本"].includes(key)) {
      if (/^(?:无|无填充|不填充)$/.test(input.replace(/\s+/g, ""))) return pick((option) => /^(?:无|无填充|不填充)$/.test(option), (option) => /其他|无填充|不填充/.test(option));
      if (/白鸭绒|灰鸭绒|鸭绒/.test(input)) return pick((option) => option === "鸭绒", (option) => option.includes("鸭绒"));
      if (/白鹅绒|灰鹅绒|鹅绒/.test(input)) return pick((option) => option === "鹅绒", (option) => option.includes("鹅绒"));
      if (/羽绒/.test(input)) return pick((option) => option === "羽绒", (option) => option.includes("羽绒"));
      if (/棉/.test(input)) return pick((option) => option === "棉", (option) => option.includes("棉"));
      if (/聚酯纤维/.test(input)) return pick((option) => option === "聚酯纤维", (option) => option.includes("聚酯纤维"));
    }
    if (["充绒量多选", "填充物含量", "填充物含量多选", "含绒量", "含绒量多选", "含绒量文本", "绒子含量", "绒子含量多选", "绒子含量文本", "成分含量", "主面料成分含量", "里料成分含量多选", "里料材质成分含量多选"].includes(key)) {
      const percent = materialPercentOption(input, permitted);
      if (percent) return percent;
    }
    if (/材质|面料|里料/.test(key)) {
      if (/棉/.test(input)) return pick((option) => option === "纯棉(棉含量100%)", (option) => option === "棉100%", (option) => option === "纯棉", (option) => option === "棉", (option) => option.includes("纯棉"), (option) => option.includes("棉"));
      if (/聚酯纤维|涤纶/.test(input)) return pick((option) => option === "聚酯纤维（涤纶）", (option) => option === "聚酯纤维", (option) => option.includes("聚酯纤维"), (option) => option.includes("涤纶"));
    }
    if (/发货方式/.test(key) && /快递/.test(input)) return pick((option) => option === "快递发货", (option) => option.includes("快递"));
    if (/闭合方式/.test(key)) {
      if (/粘扣|魔术贴|搭带/.test(input)) return pick((option) => /魔术贴|粘扣/.test(option));
      if (/旋钮|随芯|旋扣/.test(input)) return pick((option) => /旋钮|旋扣/.test(option));
      if (/松紧带|套脚/.test(input)) return pick((option) => /松紧|套脚/.test(option));
      if (/系带|鞋带/.test(input)) return pick((option) => /系带|鞋带/.test(option));
    }
    if (/鞋帮高度|靴筒高度/.test(key)) {
      if (/高帮/.test(input)) return pick((option) => /高帮|高筒/.test(option));
      if (/中帮/.test(input)) return pick((option) => /中帮|中筒/.test(option));
      if (/低帮|浅口/.test(input)) return pick((option) => /低帮|低筒|浅口/.test(option));
    }
    if (/功能/.test(key)) {
      if (/防风/.test(input)) return pick((option) => option === "防风", (option) => option.includes("防风"));
      if (/防滑/.test(input)) return pick((option) => option === "防滑", (option) => option.includes("防滑"));
      if (/耐磨/.test(input)) return pick((option) => option === "耐磨", (option) => option.includes("耐磨"));
      if (/透气/.test(input)) return pick((option) => option === "透气", (option) => option.includes("透气"));
      if (/防泼水|防水/.test(input)) return pick((option) => option === "防水", (option) => option === "防泼水");
      if (/保温|保暖|抗寒/.test(input)) return pick((option) => /保暖|保温|抗寒/.test(option));
      if (/旋钮|旋扣/.test(input)) return pick((option) => /旋转按钮|旋转扣|旋钮|旋扣/.test(option));
    }
    const materialValue = material(input);
    if (materialValue) return materialValue;
    // Listingify evaluates the apparel style candidates separately from shoe
    // templates.  Without this guard, the shoe catch-all `长裤` containment
    // match wins before a specific apparel value such as `牛仔裤`.
    const structure = /鞋|靴/.test(input) ? shoeStructure(input) : "";
    if (structure) return structure;
    const apparel = !/鞋|靴/.test(input) ? apparelStructure(input) : "";
    if (apparel) return apparel;
    if (/退款规则|面料工艺|衣长|袖长|领型/.test(key)) return pick((option) => option === input, (option) => option.includes(input) || input.includes(option));
    return "";
  };
  if (/适用年龄|年龄段/.test(key)) {
    const age = normalizedAge(value, multi);
    if (age) return age;
  }
  if (/适用人群/.test(key) && multi) {
    const populationValue = population(value, true);
    if (populationValue) return populationValue;
  }
  const inputs = multi ? value.split(/[;；]/).map((item) => item.trim()).filter(Boolean) : [value];
  const matched = inputs.map(one).filter(Boolean);
  return [...new Set(matched)].join(";");
}

function standardColor(raw: string, permitted: string[]): string {
  const rawText = text(raw);
  if (!rawText) return "";
  const rawKey = compact(rawText);
  const exact = permitted.find((option) => compact(option) === rawKey)
    ?? permitted.find((option) => compact(option).endsWith(rawKey));
  if (exact) return exact;
  const family = /黑/.test(rawText) ? "black"
    : /白|米白|乳白|象牙/.test(rawText) ? "white"
      : /浅灰/.test(rawText) ? "light_gray"
        : /中灰/.test(rawText) ? "mid_gray"
          : /深灰/.test(rawText) ? "dark_gray"
            : /灰|银/.test(rawText) ? "gray"
              : /粉|玫|桃|藕|樱/.test(rawText) ? "pink"
                : /红/.test(rawText) ? "red"
                  : /橙|桔/.test(rawText) ? "orange"
                    : /黄|金/.test(rawText) ? "yellow"
                      : /绿|青|橄榄|白绿/.test(rawText) ? "green"
                        : /蓝/.test(rawText) ? "blue"
                          : /紫/.test(rawText) ? "purple"
                            : /棕|褐|咖|卡其|沙卡|驼|杏|米|裸/.test(rawText) ? "neutral" : "";
  const optionFamily = (option: string): string => {
    if (/浅灰/.test(option)) return "light_gray";
    if (/中灰/.test(option)) return "mid_gray";
    if (/深灰/.test(option)) return "dark_gray";
    if (/黑/.test(option)) return "black";
    if (/白|米白|乳白|象牙/.test(option)) return "white";
    if (/灰|银/.test(option)) return "gray";
    if (/粉|玫|桃|藕|樱/.test(option)) return "pink";
    if (/红/.test(option)) return "red";
    if (/橙|桔/.test(option)) return "orange";
    if (/黄|金/.test(option)) return "yellow";
    if (/绿|青|橄榄/.test(option)) return "green";
    if (/蓝/.test(option)) return "blue";
    if (/紫/.test(option)) return "purple";
    if (/棕|褐|咖|卡其|沙卡|驼|杏|米|裸/.test(option)) return "neutral";
    return "";
  };
  const selected = permitted.find((option) => rawText.includes(option) || option.includes(rawText))
    ?? permitted.find((option) => family && optionFamily(option) === family)
    ?? permitted.find((option) => /^(?:扩展选项\d*|其他(?:颜色|色)?|其他)$/.test(option));
  if (!selected) return "";
  return selected === rawText || compact(selected).endsWith(rawKey) ? selected : `${selected},${rawText}`;
}

function uniqueStandardColors(values: string[]): string[] {
  const selected: string[] = [];
  for (const value of values.filter(Boolean)) {
    const parts = value.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
    const standard = parts[0] ?? value;
    const alias = parts.slice(1).join("");
    const index = selected.findIndex((existing) => (existing.split(/[,，]/)[0] ?? existing) === standard && (() => {
      const existingAlias = existing.split(/[,，]/).slice(1).join("");
      return !existingAlias || !alias || existingAlias.includes(alias) || alias.includes(existingAlias);
    })());
    if (index < 0) selected.push(value);
    else if (alias.length > selected[index]!.split(/[,，]/).slice(1).join("").length) selected[index] = value;
  }
  return selected;
}

function templateFields(template: JsonRecord): JsonRecord[] { return Array.isArray(template.fields) ? template.fields.map(record).filter((field) => nameOf(field)) : []; }
function childRequirement(template: JsonRecord): { parents: string[]; value: string } | undefined {
  const raw = record(template.rawPayload ?? template.raw_payload_json);
  const attributes = record(template.attributes ?? raw.attributes);
  if (!bool(attributes.isChildAttr ?? attributes.is_child_attr)) return undefined;
  const parentsRaw = attributes.parentAttr ?? attributes.parent_attr;
  const parents = (Array.isArray(parentsRaw) ? parentsRaw : [parentsRaw]).flatMap((value) => text(value).split(/[;,，；]/)).filter(Boolean);
  const value = text(attributes.parentAttrValue ?? attributes.parent_attr_value);
  return parents.length && value ? { parents, value } : undefined;
}

function titleValues(context: JsonRecord): JsonRecord {
  const copy = record(context.copywriting);
  const first = Array.isArray(copy.rows) ? record(copy.rows[0]) : {};
  return { title: text(first.title) || text(record(context.mdm).title), vipTitle: text(first.vipTitle), guideTitle: text(first.guideTitle), sellingPoint: text(first.sellingPoint), detail: text(first.detail) };
}

function rawValue(row: JsonRecord, field: string): string {
  if (!field) return "";
  const raw = record(row.raw);
  const rawMatch = Object.entries(raw).find(([name]) => compact(name) === compact(field));
  if (rawMatch && text(rawMatch[1])) return text(rawMatch[1]);
  const rowMatch = Object.entries(row).find(([name]) => name !== "raw" && compact(name) === compact(field));
  return rowMatch ? text(rowMatch[1]) : "";
}

type ScalarValue = { value: string; source: WorkflowField["sourceType"]; refs: WorkflowField["sourceRefs"] };

const ALWAYS_BUSINESS_BLANK_FIELDS = new Set(["商品描述", "微信视频小店副标题", "快手商品卖点"].map(businessKey));
const SHOE_BUSINESS_BLANK_FIELDS = new Set([
  "试穿报告表", "balaone仅专供新品", "balaone仅专供新品勾选", "25柔软指数", "25厚薄指数", "25弹力指数", "25版型指数",
  "25服饰细节文案", "25服饰品牌样式", "25服装面料文案", "羽绒服洗涤说明", "详情页AI标注", "单色平台AI标", "多色平台AI",
  "主图4文案1", "主图4文案2", "主图4样式",
].map(businessKey));
const SHOE_CONTEXT_FIELDS = new Set([
  "22Q4童鞋卖点", "22Q4童鞋卖点解析", "22Q4童鞋品名", "22Q4-童鞋尺码表", "22Q4童鞋尺码表", "童鞋核心卖点", "品名童鞋", "尺码童鞋",
  "25鞋子尺码表", "25鞋子模板类型", "鞋子尺码表", "鞋子模板类型",
].map(businessKey));

function templatePlatforms(template: JsonRecord): Set<string> {
  const rawPayload = record(template.rawPayload ?? template.raw_payload_json);
  const attributes = record(template.attributes ?? rawPayload.attributes);
  const value = template.thirdPlatform ?? template.third_platform ?? attributes.thirdPlatform ?? attributes.third_platform;
  const values = Array.isArray(value) ? value : [value];
  return new Set(values.flatMap((item) => text(item).split(/[,，;；、\s]+/)).map((item) => item.trim().toUpperCase()).filter(Boolean));
}

function hasDownEvidence(context: JsonRecord): boolean {
  const plan = record(context.launchPlan);
  const copyRows = record(context.copywriting).rows;
  const copy = Array.isArray(copyRows) ? record(copyRows[0]) : {};
  const mdmRows = record(context.mdm).rows;
  const mdm = Array.isArray(mdmRows) ? record(mdmRows[0]) : record(context.mdm);
  return /羽绒|充绒|含绒|绒子|鸭绒|鹅绒/.test([JSON.stringify(plan), JSON.stringify(copy), JSON.stringify(mdm)].join("\n"));
}

function isVipUsageSceneField(name: string, template: JsonRecord): boolean {
  const key = businessKey(name);
  const usage = key === "适用场景" || key === "适用场景多选" || /^唯品(?:会)?适用场景(?:多选)?$/.test(key);
  if (!usage) return false;
  if ([...templatePlatforms(template)].some((item) => /^(?:VIP|VIPSHOP|唯品会)$/i.test(item))) return true;
  return (key === "适用场景" || key === "适用场景多选") && options(template).some((option) => option === "日常");
}

function isBusinessBlankField(name: string, template: JsonRecord, context: JsonRecord): boolean {
  const key = businessKey(name);
  const kind = productKind(context);
  const shoe = kind === "shoe";
  const apparel = kind === "apparel";
  if (!shoe && !apparel) return false;
  const platforms = templatePlatforms(template);
  if (typeOf(template).toUpperCase() === "TEXT" && ((key === "吊牌价" && platforms.size > 1) || (key === "划线价" && platforms.size === 1 && platforms.has("YOUZAN")))) return true;
  if (key === "羽绒服洗涤说明" && !hasDownEvidence(context)) return true;
  if (key === "拼多多标题" || key === "拼多多短标题") return true;
  if (key === "商品短标题" && [...platforms].some((item) => /^(?:PDD|拼多多)$/i.test(item))) return true;
  if (/^唯品(?:会)?(?:商品)?市场价/.test(key) || /^有赞.*划线价/.test(key) || /多平台.*吊牌价/.test(key) || (shoe && (key === "京东市场价" || key === "京东自营市场价"))) return true;
  if (/^唯品(?:会)?重量$/.test(key) || /^唯品(?:会)?(?:商品)?包装?(?:重量|长度|宽度|高度|长|宽|高)$/.test(key)) return true;
  if (shoe && (SHOE_BUSINESS_BLANK_FIELDS.has(key) || (!key.includes("京东") && /^(?:商品)?(?:包裹|包装)(?:重量|长度|宽度|高度|长|宽|高)$/.test(key)))) return true;
  if (shoe && (key === "微信视频小店副标题" || key === "快手商品卖点")) return false;
  if (ALWAYS_BUSINESS_BLANK_FIELDS.has(key)) return true;
  if (SHOE_CONTEXT_FIELDS.has(key)) return !shoe;
  // Only product-category facts participate in conditional field activation.
  // Serializing a whole spreadsheet row is unsafe: inactive workbook columns
  // such as “饰品配件” would otherwise make a shoe look like an accessory.
  const plan = record(context.launchPlan);
  const category = [
    text(plan.productLine), text(plan.category), text(plan.subcategory),
    rawValue(plan, "产品线"), rawValue(plan, "品类"), rawValue(plan, "小类"), rawValue(plan, "主款式"),
  ].filter(Boolean).join(" ");
  if (key === "文胸图标") return !/文胸/.test(category);
  if (key === "水杯说明") return !/(?:水杯|杯子)/.test(category);
  if (key === "配饰版默认文案") return !/(?:配饰|饰品|帽子|帽类)/.test(category);
  return false;
}

function sourceRows(context: JsonRecord): Array<{ row: JsonRecord; source: WorkflowField["sourceType"] }> {
  const copyRows = record(context.copywriting).rows;
  const mdmRows = record(context.mdm).rows;
  const launch = record(context.launchPlan);
  const launchRows = Array.isArray(launch.rows) ? launch.rows.map(record) : [launch];
  // `launchPlan` itself is the importer-selected active row (dated and not
  // cancelled).  Keep all rows afterwards for explicit category-conflict
  // detection, but never let a first cancelled SKC row supply a scalar fact.
  const remainingLaunchRows = launchRows.filter((row) => row !== launch && text(row.skcCode) !== text(launch.skcCode));
  return [
    ...(Array.isArray(copyRows) ? copyRows.map(record).map((row) => ({ row, source: "copywriting" as const })) : []),
    { row: launch, source: "launch_plan" as const },
    ...remainingLaunchRows.map((row) => ({ row, source: "launch_plan" as const })),
    ...(Array.isArray(mdmRows) ? mdmRows.map(record).map((row) => ({ row, source: "mdm" as const })) : [record(context.mdm)].filter((row) => Object.keys(row).length > 0).map((row) => ({ row, source: "mdm" as const }))),
  ];
}

function sourceValue(context: JsonRecord, names: string[], extras: unknown[] = []): ScalarValue {
  for (const item of sourceRows(context)) {
    for (const name of names) {
      const value = rawValue(item.row, name);
      if (value) return { value, source: item.source, refs: sourceRefs(item.row) };
    }
  }
  const value = extras.map(text).find(Boolean) ?? "";
  return { value, source: value ? "derived" : "skip", refs: [] };
}

function shoeEvidence(context: JsonRecord): string {
  const plan = record(context.launchPlan);
  const copyRows = record(context.copywriting).rows;
  const copy = Array.isArray(copyRows) ? record(copyRows[0]) : {};
  return [
    copy.sellingPoint, copy.fab, copy.detail, copy.title, copy.guideTitle,
    plan.fab, plan.upperMaterial, plan.lining,
    ...["FAB", "推荐理由", "细节文案", "搜索标题", "内容平台标题", "导购标题", "品类", "名称", "大身面料", "帮面材料", "鞋底材质", "鞋垫材质", "里料材质"].flatMap((name) => sourceRows(context).map((item) => rawValue(item.row, name))),
  ].map(text).filter(Boolean).join("\n");
}

function shoeAgeFromSizeRange(value: unknown): string {
  const match = text(value).replace(/[－—–~～至到]/g, "-").match(/(\d{1,3})\s*-\s*(\d{1,3})/);
  if (!match) return "";
  const start = Math.min(Number(match[1]), Number(match[2]));
  const end = Math.max(Number(match[1]), Number(match[2]));
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "";
  if (end <= 24) return "4-24个月";
  if (end <= 33) return "3-7岁";
  if (end <= 39) return "8-14岁";
  if (end <= 40) return "7岁-14岁";
  return "";
}

function apparelAgeFromSizeRange(value: unknown): string {
  const referenceAge = balabalaApparelAgeTextForSizeRange(value);
  if (referenceAge) return referenceAge;
  const match = text(value).replace(/[－—–~～至到]/g, "-").match(/(\d{1,3})\s*-\s*(\d{1,3})/);
  if (!match) return "";
  const start = Math.min(Number(match[1]), Number(match[2]));
  const end = Math.max(Number(match[1]), Number(match[2]));
  const exact = new Map<string, string>([["52-66", "新生儿, 3个月"], ["66-90", "3-18个月"], ["73-100", "6个月-2岁"], ["90-130", "2-7岁"], ["90-140", "2-8岁"], ["90-180", "全阶段"], ["130-175", "7-16岁"], ["140-175", "8-16岁"]]);
  const direct = exact.get(`${start}-${end}`);
  if (direct) return direct;
  if (end <= 66) return "新生儿, 3个月";
  if (end <= 90) return "3-18个月";
  if (end <= 100) return "6个月-2岁";
  if (end <= 130) return "2-7岁";
  if (end <= 140) return "2-8岁";
  if (end <= 175) return start >= 140 ? "8-16岁" : "7-16岁";
  if (start <= 100 && end >= 175) return "全阶段";
  return "";
}

function seasonValue(context: JsonRecord): ScalarValue {
  const plan = record(context.launchPlan);
  const source = sourceValue(context, ["产品季类", "产品季", "季节名称", "季节"]);
  const raw = source.value || text(plan.launchDate);
  const year = raw.match(/20\d{2}/)?.[0] ?? text(plan.launchDate).match(/20\d{2}/)?.[0] ?? sourceValue(context, ["年份"]).value;
  const compactSeason = raw.match(/^([1-4])(\d{2})$/);
  const quarter = raw.match(/Q([1-4])/i)?.[1] ?? compactSeason?.[1] ?? "";
  const named = ({ "1": "春", "2": "夏", "3": "秋", "4": "冬" } as Record<string, string>)[quarter] ?? raw.match(/[春夏秋冬]/)?.[0] ?? "";
  const resolvedYear = year || (compactSeason ? `20${compactSeason[2]}` : "");
  if (named) return { value: `${resolvedYear ? `${resolvedYear}年` : ""}${named}季`, source: source.value ? source.source : "derived", refs: source.refs };
  const month = Number(text(plan.launchDate).match(/^20\d{2}[-/.](\d{1,2})/)?.[1]);
  if (Number.isFinite(month) && month > 0) return { value: `${text(plan.launchDate).slice(0, 4)}年${month <= 2 ? "冬" : month <= 5 ? "春" : month <= 8 ? "夏" : month <= 11 ? "秋" : "冬"}季`, source: "launch_plan", refs: sourceRefs(plan) };
  return source;
}

function brandValue(context: JsonRecord): ScalarValue {
  const source = sourceValue(context, ["品牌名称", "品牌"]);
  return source.value ? source : { value: "巴拉巴拉", source: "derived", refs: [] };
}

function firstClause(value: unknown, maxLength: number): string {
  return Array.from(text(value).split(/[，,。；;\n]/).map((part) => part.trim()).find(Boolean) ?? "").slice(0, maxLength).join("").trim();
}

function displayTitleValue(context: JsonRecord, kind: "shoe" | "apparel" | "generic", fallbackTitle: string): ScalarValue {
  const plan = record(context.launchPlan);
  const copyRows = record(context.copywriting).rows;
  const copy = Array.isArray(copyRows) ? record(copyRows[0]) : {};
  const brand = brandValue(context);
  const gender = sourceValue(context, ["性别", "适用性别"], [plan.gender]);
  const sizeRange = sourceValue(context, ["年龄段"], [kind === "shoe" ? shoeAgeFromSizeRange(sourceValue(context, ["尺码段", "规格段"]).value) : apparelAgeFromSizeRange(sourceValue(context, ["尺码段", "规格段"]).value)]);
  const category = sourceValue(context, ["品类", "商品类别", "产品类别", "名称"], [plan.category, plan.subcategory, copy.category, copy.name]);
  const values = [brand.value, gender.value, sizeRange.value, category.value].filter(Boolean);
  return { value: values.length ? [...new Set(values)].join("") : fallbackTitle, source: values.length ? "derived" : "copywriting", refs: [...brand.refs, ...gender.refs, ...sizeRange.refs, ...category.refs] };
}

const MATERIAL_SECTION_LABELS = ["主面料复合面布", "主面料", "大身面料", "复合面布", "复合底布", "梭织面料", "针织面料", "帽里料", "填充物", "填充料", "里料", "衬里", "花边", "配料", "辅料", "罗纹", "帽里", "胆料", "内胆", "装饰物", "鞋面", "鞋底", "面料"];

function materialSourceSections(value: unknown): string {
  const labels = MATERIAL_SECTION_LABELS.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  return text(value)
    .replace(/\u00a0/g, " ")
    .replace(/％/g, "%")
    .replace(/\r/g, "")
    .replace(/^\s*(?:成分|材质成分|面料成分)\s*[:：]?\s*/i, "")
    .replace(new RegExp(`\\s*(${labels})\\s*[:：]\\s*`, "g"), "\n$1：")
    .replace(/^\n/, "");
}

function materialSection(value: unknown, labels: string[]): string {
  const source = materialSourceSections(value);
  if (!source) return "";
  const escaped = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const match = new RegExp(`(?:^|\\n)\\s*(?:${escaped})\\s*[:：]\\s*`).exec(source);
  if (!match) return "";
  const after = source.slice(match.index + match[0].length);
  const allEscaped = MATERIAL_SECTION_LABELS.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const next = new RegExp(`(?:^|\\n)\\s*(?:${allEscaped})\\s*[:：]`, "m").exec(after);
  return (next ? after.slice(0, next.index) : after).split("\n").map((item) => item.trim()).filter(Boolean).join("；");
}

type MaterialComponent = { name: string; percent: string };

function materialName(value: unknown): string {
  const source = text(value).replace(/^[,，;；:：\s]+|[,，;；:：\s]+$/g, "").trim();
  if (/^(?:纯棉|全棉)$/.test(source)) return "棉";
  if (/^(?:涤纶|涤纶[（(]聚酯纤维[）)]|聚酯纤维[（(]涤纶[）)])$/.test(source)) return "聚酯纤维";
  if (/^(?:锦纶|尼龙|聚酰胺纤维|锦纶[（(]聚酰胺纤维[）)]|聚酰胺纤维[（(]锦纶[）)])$/.test(source)) return "聚酰胺纤维";
  if (/^(?:粘纤|黏纤|粘胶|黏胶|粘胶纤维|黏胶纤维|粘胶纤维[（(]粘纤[）)]|黏胶纤维[（(]黏纤[）)])$/.test(source)) return "粘胶纤维";
  return source;
}

function materialComponents(value: unknown): MaterialComponent[] {
  const source = text(value);
  const components: MaterialComponent[] = [];
  const add = (name: unknown, percent: unknown): void => {
    const normalizedName = materialName(name);
    const numeric = Number(text(percent));
    if (!normalizedName || !Number.isFinite(numeric)) return;
    const normalizedPercent = String(Number(numeric.toFixed(4)));
    const existing = components.find((item) => item.name === normalizedName);
    if (existing) existing.percent = String(Number((Number(existing.percent) + Number(normalizedPercent)).toFixed(4)));
    else components.push({ name: normalizedName, percent: normalizedPercent });
  };
  for (const match of source.matchAll(/(\d+(?:\.\d+)?)\s*%\s*([^\d%]+?)(?=(?:\s*[,，;；]?\s*\d+(?:\.\d+)?\s*%)|$)/g)) add(match[2], match[1]);
  if (components.length) return components;
  for (const match of source.matchAll(/([^\d%]+?)\s*(\d+(?:\.\d+)?)\s*%(?=\s*[,，;；]|\s*$)/g)) add(match[1], match[2]);
  return components;
}

function primaryMaterialComponents(value: unknown): MaterialComponent[] {
  const primary = materialSection(value, ["主面料复合面布", "主面料", "大身面料", "复合面布", "面料"]);
  return materialComponents(primary || materialSourceSections(value));
}

function allMaterialNames(value: unknown): string[] {
  const sections = materialSourceSections(value).split("\n");
  return [...new Set(sections.flatMap((section) => materialComponents(section.replace(/^[^：:\n]+[：:]\s*/, "")).map((component) => component.name)))];
}

function apparelDetailMaterial(value: unknown): string {
  const source = materialSourceSections(value);
  const filler = /(?:^|\n)\s*(?:填充物|填充料)\s*[:：]/.exec(source);
  return (filler ? source.slice(0, filler.index) : source).trim();
}

function materialPercentOption(value: string, permitted: string[]): string {
  const percent = Number(value.replace(/％/g, "%").match(/(\d+(?:\.\d+)?)\s*%/)?.[1]);
  if (!Number.isFinite(percent)) return "";
  const compactOption = (option: string) => option.replace(/％/g, "%").replace(/\s+/g, "");
  return permitted.find((option) => {
    const normalized = compactOption(option);
    const exact = Array.from(normalized.matchAll(/(\d+(?:\.\d+)?)%/g)).map((match) => Number(match[1]));
    return !/(?:以上|及以上|起|以下|及以下)/.test(normalized) && exact.length === 1 && exact[0] === percent;
  }) ?? permitted.find((option) => {
    const threshold = compactOption(option).match(/(\d+(?:\.\d+)?)%(?:以上|及以上|起)/)?.[1];
    return threshold !== undefined && percent >= Number(threshold);
  }) ?? permitted.find((option) => {
    const threshold = compactOption(option).match(/(\d+(?:\.\d+)?)%(?:以下|及以下)/)?.[1];
    return threshold !== undefined && percent <= Number(threshold);
  }) ?? "";
}

function mappingRows(context: JsonRecord): JsonRecord[] {
  const mappings = context.fieldMappings ?? context.field_mappings;
  if (Array.isArray(mappings)) return mappings.map(record);
  if (mappings && typeof mappings === "object") return Object.entries(record(mappings)).map(([targetField, value]) => ({ targetField, ...record(value) }));
  return [];
}

function mappedScalar(name: string, context: JsonRecord): { value: string; source: WorkflowField["sourceType"]; refs: WorkflowField["sourceRefs"] } | undefined {
  const mapping = mappingRows(context).find((item) => compact(item.targetField ?? item.target_field ?? item.fieldName ?? item.field_name) === compact(name));
  if (!mapping) return undefined;
  const sourceName = text(mapping.source ?? mapping.sourceType ?? mapping.source_type).replace(/[\s_-]/g, "").toLowerCase();
  const sourceField = text(mapping.sourceField ?? mapping.source_field ?? mapping.column ?? mapping.columnName ?? mapping.column_name);
  if (sourceName === "constant" || sourceName === "literal") return { value: text(mapping.value), source: "derived", refs: [] };
  if (sourceName === "launchplan" || sourceName === "launchplanrow" || sourceName === "launchplanrows" || sourceName === "launchplan") {
    const launch = record(context.launchPlan);
    return { value: rawValue(launch, sourceField), source: "launch_plan", refs: sourceRefs(launch) };
  }
  if (sourceName === "copywriting") {
    const copyRows = record(context.copywriting).rows;
    const copy = Array.isArray(copyRows) ? record(copyRows[0]) : {};
    return { value: rawValue(copy, sourceField), source: "copywriting", refs: sourceRefs(copy) };
  }
  if (sourceName === "mdm") {
    const rows = record(context.mdm).rows;
    const mdm = Array.isArray(rows) ? record(rows[0]) : record(context.mdm);
    return { value: rawValue(mdm, sourceField), source: "mdm", refs: sourceRefs(mdm) };
  }
  return undefined;
}

function scalarFor(name: string, context: JsonRecord, template: JsonRecord): ScalarValue {
  const mapped = mappedScalar(name, context);
  if (mapped) return mapped;
  const key = compact(name);
  const plan = record(context.launchPlan);
  const copyRows = record(context.copywriting).rows;
  const copy = Array.isArray(copyRows) ? record(copyRows[0]) : {};
  const titles = titleValues(context);
  const price = decimal(plan.retailPrice);
  const source = (value: unknown, sourceType: WorkflowField["sourceType"], ref: unknown) => ({ value: text(value), source: sourceType, refs: sourceRefs(ref) });
  const kind = productKind(context);
  const shoe = kind === "shoe";
  const apparel = kind === "apparel";
  const evidence = shoeEvidence(context);
  const surface = sourceValue(context, ["帮面材料", "帮面材质", "大身面料", "面料成分"], [plan.upperMaterial, copy.upperMaterial]);
  const lining = sourceValue(context, ["内里材质", "里料材质"], [plan.lining, copy.lining]);
  const sole = sourceValue(context, ["鞋底材质"], [copy.sole, /橡胶/.test(evidence) ? "橡胶" : "", /EVA/i.test(evidence) ? "EVA" : "", /TPR/i.test(evidence) ? "TPR" : ""]);
  const insole = sourceValue(context, ["鞋垫材质", "鞋垫材料", "鞋垫面料", "鞋垫"], []);
  const age = sourceValue(context, ["尺码段", "规格段"], [shoe ? shoeAgeFromSizeRange(sourceValue(context, ["尺码段", "规格段"]).value) : apparelAgeFromSizeRange(sourceValue(context, ["尺码段", "规格段"]).value)]);
  const applicableAge = shoe ? shoeAgeFromSizeRange(sourceValue(context, ["尺码段", "规格段"]).value) : apparelAgeFromSizeRange(sourceValue(context, ["尺码段", "规格段"]).value);
  const category = sourceValue(context, ["小类", "子类", "细分类目", "主款式 （唯品四级品类）", "主款式（唯品四级品类）"], [plan.subcategory, plan.category, copy.name, copy.category]);
  const season = seasonValue(context);
  const brand = brandValue(context);
  const attributes = sourceValue(context, ["属性", "属性-销"]);
  const thickness = sourceValue(context, ["厚薄"]);
  const silhouette = sourceValue(context, ["版型"]);
  const elasticity = sourceValue(context, ["弹性"]);
  const materialComposition = sourceValue(context, ["面料成分", "材质成分", "成分"]);
  const primaryMaterial = primaryMaterialComponents(materialComposition.value);
  const primaryMaterialText = primaryMaterial.map((component) => `${component.name},${component.percent}`).join(";");
  const jdPrimaryMaterialText = primaryMaterial.map((component) => `${component.name === "聚酯纤维" ? "涤纶(聚酯纤维)" : component.name},${component.percent}`).join(";");
  const liningMaterialText = materialSection(materialComposition.value, ["帽里料", "帽里", "里料", "衬里"]);
  const fillerMaterialText = materialSection(materialComposition.value, ["填充物", "填充料"]);
  const downContentText = materialComposition.value.match(/(?:绒子含量|含绒量)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*%?/)?.[1] ?? "";
  const detail = sourceValue(context, ["细节文案", "细节文案（不限定8个字，细节数量3-4个）"], [copy.detail]);
  const guideTitle = sourceValue(context, ["导购标题", "导购标题（品牌+品类+性别+款式+风格+季节）"], [copy.guideTitle, titles.guideTitle]);
  const platformTitle = sourceValue(context, ["内容标题", "内容平台标题", "搜索标题"], [titles.title]);
  const detailLines = detail.value.split(/\s*(?:\d+[.、]|[;；*]|\r?\n)\s*/g).map((part) => part.trim().replace(/[：:]/g, "-")).filter(Boolean).join("*");
  const mainPictureLines = sourceValue(context, ["设计师说——主图4"]);
  const mainPictureParts = mainPictureLines.value.split(/\r?\n/).map((part) => part.trim()).filter(Boolean);
  const compatiblePlatforms = "1688;天猫;京东;唯品会;有赞;拼多多;小红书;抖音;快手;微信视频小店";
  if (key === "羽绒服洗涤说明") return source(hasDownEvidence(context) ? "羽绒服洗涤说明" : "", "derived", copy);
  if ((shoe || apparel) && (key.includes("洗涤说明") || key.includes("洗护说明") || key.includes("洗涤方法") || key.includes("洗护方法"))) return source("请根据产品面料特性进行清洗养护，具体方法可参考产品水洗唛/标签", "derived", copy);
  if (apparel && key === "唯品会温馨提示" && ([...templatePlatforms(template)].some((item) => /^(?:VIP|VIPSHOP|唯品会)$/i.test(item)) || templatePlatforms(template).size === 0)) return source("手工测量难免存在误差，常规款袖长肩点到袖口，插肩袖(无明确肩点)款后领中量至袖口", "derived", copy);
  if (apparel && isVipUsageSceneField(name, template)) return source("日常", "derived", plan);
  if (key === "发货方式" && shoe) return source("快递发货", "derived", plan);
  if (key === "单位" || key === "计量单位") return source("件", "derived", plan);
  if (key === "库存计数") return source("买家拍下减库存", "derived", plan);
  if (key === "会员打折") return source("不参与会员打折", "derived", plan);
  if (shoe && ["货源类别"].includes(key)) return source("现货", "derived", plan);
  if (shoe && key === "最快出货时间") return source("48小时", "derived", plan);
  if (shoe && key === "最晚发货时间") return source("2天", "derived", plan);
  if (shoe && (key === "单用户累计限购件" || key === "每次限购件")) return source("5", "derived", plan);
  if (shoe && key.includes("京东发货地")) return source("杭州", "derived", plan);
  if (shoe && key.includes("京东商品重量")) return source("1", "derived", plan);
  if ((shoe || apparel) && key === "抖音商品重量") return source("1", "derived", plan);
  if (shoe && /京东.*包装.*[宽长高]/.test(name)) return source("100", "derived", plan);
  if (shoe && (key === "微信视频小店商品编码" || key === "唯品会款号")) return source(text(context.spu), "mdm", record(context.mdm));
  if (shoe && key === "尺码类型") return source("欧码（童鞋）", "derived", plan);
  if (shoe && (key === "质检报告" || key === "质检报告表")) return source("否", "derived", plan);
  if (shoe && (key === "单色平台ai标" || key === "多色平台ai")) return source("坑位1", "derived", plan);
  if (key === "退款规则") return source("支持7天无理由退货", "derived", plan);
  if (key === "售后服务承诺") return source(shoe && /板鞋|运动鞋/.test(`${text(plan.category)} ${text(plan.subcategory)}`) ? "延保90天" : "不设置", "derived", plan);
  if (key === "原产国" || key.startsWith("原产国")) return source("中国", "derived", plan);
  if (key === "产地") return source(shoe ? "浙江杭州" : "中国大陆", "derived", plan);
  if (key === "所在地") return source("浙江,杭州", "derived", plan);
  if (key === "品牌单选" || key === "品牌" || key === "品牌文本" || key === "品牌名称") return brand;
  if (["生产企业名称", "生产经销厂家", "生产/经销厂家", "生产经销企业"].includes(key)) {
    const explicit = sourceValue(context, ["productionEnterpriseName", "manufacturer", "producerName", "factoryName"]);
    return explicit.value ? explicit : source("浙江森马服饰股份有限公司", "derived", record(context.mdm));
  }
  if (key === "厂家地址") {
    const explicit = sourceValue(context, ["productionEnterpriseAddress", "manufacturerAddress", "producerAddress", "factoryAddress"]);
    return explicit.value ? explicit : source("温州市瓯海区娄桥工业园南汇路98号", "derived", record(context.mdm));
  }
  if (shoe && ["帮面材质", "帮面材质多选", "鞋面材质", "鞋面材质多选", "配皮材质", "配皮材质多选", "鞋面"].includes(key)) return surface;
  if (shoe && ["内里材质", "内里材质多选", "里料材质", "里料材质多选"].includes(key)) return lining;
  if (shoe && ["鞋底材质", "鞋底材质多选"].includes(key)) return sole;
  if (shoe && key === "鞋垫材质") return insole.value ? insole : source("其他", "derived", plan);
  if (shoe && ["详情页面料", "唯品会材质", "25面料成分"].includes(key)) return source([surface.value && `帮面材料：${surface.value}`, lining.value && `里料材质：${lining.value}`, sole.value && `鞋底材质：${sole.value}`].filter(Boolean).join("\n"), "derived", plan);
  if (shoe && key === "材质akc") {
    const synthetic = /合成材料|合成革|人造革|\bpu\b|超纤/i.test(surface.value || evidence);
    const textile = /织物|纺织|布料|网布|飞织/.test(surface.value || evidence);
    return source(synthetic && textile ? "合成材料+织物" : synthetic ? "合成材料" : textile ? "织物" : surface.value, "derived", plan);
  }
  if (shoe && key === "材质1688") return source(surface.value, surface.source, plan);
  if (shoe && key === "材质功能") return source(/防渗水|防水/.test(evidence) ? "防渗水" : /防泼水/.test(evidence) ? "防泼水" : /保温|保暖|抗寒/.test(evidence) ? "抗寒" : "", "copywriting", copy);
  if (shoe && ["闭合方式", "闭合方式多选"].includes(key)) return source(/旋钮|随芯|旋扣/.test(evidence) ? "旋钮扣" : /魔术贴|粘扣|搭带|一拉一贴/.test(evidence) ? "魔术贴" : /松紧带|套脚/.test(evidence) ? "松紧带" : /系带|鞋带/.test(evidence) ? "系带" : "", "copywriting", copy);
  if (shoe && ["鞋帮高度", "鞋帮高度多选", "靴筒高度"].includes(key)) return source(/高帮/.test(evidence) ? "高帮" : /中帮/.test(evidence) ? "中帮" : /低帮|浅口/.test(evidence) ? "低帮" : "", "copywriting", copy);
  if (shoe && (key === "流行元素" || key === "流行元素多选")) return source([/反光|3m/i.test(evidence) ? "反光" : "", /魔术贴|粘扣|搭带/.test(evidence) ? "魔术贴" : "", /旋钮|随芯/.test(evidence) ? "旋钮扣" : "", /蝴蝶结/.test(evidence) ? "蝴蝶结" : "", /星星/.test(evidence) ? "星星" : "", /字母/.test(evidence) ? "字母" : ""].filter(Boolean).join(";"), "copywriting", copy);
  if (shoe && (key === "风格" || key === "风格多选")) return source(/户外|运动|跑鞋|篮球|足球/.test(evidence) ? "运动" : /休闲|板鞋|学步|帆布/.test(evidence) ? "休闲" : "", "copywriting", copy);
  if (shoe && ["适用场合", "适用场合多选"].includes(key)) return source("日常;校园;公路", "derived", plan);
  if (shoe && ["适用场景", "适用场景多选"].includes(key)) return source("休闲", "derived", plan);
  if (shoe && ["功能", "功能多选"].includes(key)) return source([/防滑/.test(evidence) ? "防滑" : "", /耐磨/.test(evidence) ? "耐磨" : "", /透气/.test(evidence) ? "透气" : "", /防泼水|防水|防渗水/.test(evidence) ? "防泼水" : "", /保温|保暖|抗寒/.test(evidence) ? "保暖" : "", /旋钮|随芯|旋扣/.test(evidence) ? "旋转扣" : ""].filter(Boolean).join(";"), "copywriting", copy);
  if (shoe && ["产品类别", "商品类别", "款式", "款式多选", "款式单选", "类型", "类型多选", "分类"].includes(key)) return category;
  if (key === "适用季节" || key === "适用季节多选" || key === "上市时间" || key === "上市时间文本") return season;
  if (key === "适用人群" || key === "适用人群多选" || key === "适用年龄" || key === "适用年龄多选" || key === "适用年龄段" || key === "适用年龄段多选" || key === "淘宝天猫适用年龄" || key === "适合年龄段" || key === "适合年龄段多选" || key === "适用年龄文本") return source(applicableAge || age.value || sourceValue(context, ["年龄段"]).value, "launch_plan", plan);
  if (shoe && key === "详情页ai标注") return source(evidence ? "展示" : "", "derived", copy);
  if (key === "婴童内着详情页") return { value: "", source: "skip", refs: [] };
  if ((shoe || apparel) && key === "销售渠道类型") return source(/全域/.test(attributes.value) ? "商场同款" : "纯电商", "derived", plan);
  if ((shoe || apparel) && key === "是否商场同款") return source(/全域/.test(attributes.value) ? "是" : "否", "derived", plan);
  if (apparel && key === "报价方式") return source("按产品数量报价", "derived", plan);
  if (apparel && key === "件重尺") return source("按规格设置", "derived", plan);
  if (apparel && (key === "1688供货方式" || key === "供货方式1688")) return source("现货", "derived", plan);
  if (key.endsWith("兼容平台")) return source(compatiblePlatforms, "derived", plan);
  if (key === "选择期数") return source(sourceValue(context, ["产品季"]).value || season.value, "launch_plan", plan);
  if (key === "厚薄") return thickness;
  if (key === "服装版型" || key === "版型") return silhouette;
  if (key === "弹力" || key === "弹性") return elasticity;
  if (key === "主图4文案1") return source(mainPictureParts[0], "copywriting", copy);
  if (key === "主图4文案2") return source(mainPictureParts.slice(1).join("\n"), "copywriting", copy);
  if (apparel && key === "25服饰细节文案") return source(detailLines, "copywriting", copy);
  if (shoe && key === "25实拍文案") return source(detailLines, "copywriting", copy);
  if (apparel && key === "25版型指数") return silhouette;
  if (apparel && key === "25服装面料文案") {
    const materialName = sourceValue(context, ["面料名称"]).value;
    const materialCopy = sourceValue(context, ["面料文案"]).value;
    const keywords = sourceValue(context, ["面料三个关键词"]).value.split(/[\s,，、;；]+/).map((item) => item.trim()).filter(Boolean).join("-");
    return source([`${materialName}${materialName && materialCopy ? "-" : ""}${materialCopy}`, keywords].filter(Boolean).join("*"), "copywriting", copy);
  }
  if (apparel && key === "25面料成分") return materialComposition;
  if (apparel && ["里料", "里料成分", "里料材质", "内里材质", "里料材质多选", "内里材质多选", "里料成分含量", "里料成分含量多选", "里料材质成分含量", "里料材质成分含量多选"].includes(key)) return source(liningMaterialText || lining.value, materialComposition.value ? materialComposition.source : lining.source, materialComposition.value ? record(context.copywriting) : plan);
  if (key === "材质成分") return source(primaryMaterialText || materialComposition.value, materialComposition.source, record(context.copywriting));
  if (key === "京东材质成分") return source(jdPrimaryMaterialText || materialComposition.value, materialComposition.source, record(context.copywriting));
  if (key === "面料多选" || key === "材质多选" || key === "材质成分多选") return source(allMaterialNames(materialComposition.value).join(";") || materialComposition.value, materialComposition.source, record(context.copywriting));
  if (key === "抖音面料材质") return source(primaryMaterialText || materialComposition.value, materialComposition.source, record(context.copywriting));
  if (key === "面料" || key === "材质" || key === "面料俗称") return materialComposition.value ? source(primaryMaterial[0]?.name === "棉" && Number(primaryMaterial[0]?.percent) === 100 ? "纯棉(棉含量100%)" : primaryMaterial.length > 1 ? `${[...primaryMaterial].sort((left, right) => Number(right.percent) - Number(left.percent))[0]?.name ?? ""}混纺` : primaryMaterial[0]?.name ?? materialComposition.value, materialComposition.source, record(context.copywriting)) : surface;
  if (key === "详情页面料") return shoe ? source([surface.value && `帮面材料：${surface.value}`, lining.value && `里料材质：${lining.value}`, sole.value && `鞋底材质：${sole.value}`].filter(Boolean).join("\n"), "derived", plan) : source(apparelDetailMaterial(materialComposition.value) || materialComposition.value, materialComposition.source, record(context.copywriting));
  if (apparel && ["填充物", "填充物多选", "填充物种类", "填充物文本"].includes(key)) return source(fillerMaterialText || sourceValue(context, ["填充物", "填充物备注"]).value, materialComposition.source, record(context.copywriting));
  if (apparel && ["充绒量多选", "填充物含量", "填充物含量多选", "含绒量", "含绒量多选", "含绒量文本", "绒子含量", "绒子含量多选", "绒子含量文本"].includes(key)) return source(downContentText ? `${downContentText}%` : "", materialComposition.source, record(context.copywriting));
  if (key === "性别多选") return sourceValue(context, ["性别", "适用性别"], [plan.gender]);
  if (key === "是否带帽") return source("连帽", "derived", plan);
  if (key === "是否库存") return source("否", "derived", plan);
  if (key === "是否跨境出口专供货源" || key === "是否加绒" || key === "是否可开档" || key === "是否开裆") return source("否", "derived", plan);
  if (key === "是否可定制") return source("不可定制", "derived", plan);
  if (key === "balaone仅专供新品") return source(/专供新品/.test(attributes.value) ? "是" : "", "launch_plan", plan);
  if (!shoe && key === "货源类别") return source(/现货/.test(attributes.value) ? "现货" : /专供新品|订货|新品/.test(attributes.value) ? "订货" : "", "launch_plan", plan);
  if (apparel && ["款式", "款式多选", "款式单选"].includes(key)) return sourceValue(context, ["主款式 （唯品四级品类）", "主款式（唯品四级品类）", "主款式", "款式", "裤型", "廓形"], [plan.subcategory, plan.category]);
  if (!shoe && (key === "分类" || key === "类型")) return category;
  if (apparel && key === "袖长多选") return source("长袖", "derived", plan);
  if (apparel && key === "袖长") return source("长袖", "derived", plan);
  if (apparel && key === "衣长") return source("常规", "derived", plan);
  if (apparel && (key === "腰型" || key === "裤长" || key === "裤门襟")) return source("不适用", "derived", plan);
  if (apparel && key === "主图4样式") return source("225", "derived", plan);
  if (apparel && key === "功能多选") return source(sourceValue(context, ["面料三个关键词", "推荐理由"]).value, "copywriting", copy);
  if (!shoe && key === "适用场合") return source("日常", "derived", plan);
  if (!shoe && key === "面料工艺") return source("涂层", "derived", plan);
  if (!shoe && key === "领型") return source("连帽", "derived", plan);
  if (!shoe && (key === "风格" || key === "风格多选")) return source("休闲", "derived", plan);
  if (key === "商品展示标题") return displayTitleValue(context, kind, text(titles.title));
  if (key === "商品短标题") return guideTitle.value ? guideTitle : platformTitle;
  if (shoe && key === "微信视频小店副标题") return guideTitle.value ? guideTitle : platformTitle;
  if (key === "微信视频小店副标题" || key === "快手商品卖点") return source(titles.sellingPoint || detail.value, "copywriting", copy);
  if (key === "微信视频小店标题" || key === "抖音标题") return platformTitle;
  if (key === "快手标题") {
    const title = platformTitle.value;
    const productCode = text(context.spu);
    return source(apparel && productCode && !title.includes(productCode) ? `${title.slice(0, Math.max(0, 60 - productCode.length - 1))} ${productCode}` : title.slice(0, 60), "copywriting", copy);
  }
  if (key === "拼多多标题") {
    const title = sourceValue(context, ["搜索标题", "内容平台标题", "内容标题", "天猫标题", "商品标题", "标题"], [titles.title]);
    return title;
  }
  if (key === "天猫推荐理由") {
    const recommendation = sourceValue(context, ["推荐理由", "FAB"], [detail.value, titles.sellingPoint]);
    return { value: firstClause(recommendation.value, 15), source: recommendation.source, refs: recommendation.refs };
  }
  if (key === "商品描述") return { value: "", source: "skip", refs: [] };
  if (/商品展示标题|搜索标题|商品标题|^标题$/.test(key)) return source(titles.title, "copywriting", copy);
  if (/唯品.*标题/.test(key)) return source(titles.vipTitle || titles.title, "copywriting", copy);
  if (/抖音|小红书|视频号|快手/.test(key) && /标题/.test(key)) return source(titles.guideTitle || titles.title, "copywriting", copy);
  if (/推荐理由|商品卖点|产品卖点|销售卖点|^商品详情$|^详情$/.test(key)) return source(titles.sellingPoint || titles.detail, "copywriting", copy);
  if (/吊牌价|零售价|市场价|京东价|划线价|^价格$/.test(key)) return source(price, "launch_plan", plan);
  if (/拼多多.*单买价/.test(key)) return source(decimal(price, -1), "derived", plan);
  if (/拼多多.*团购价/.test(key)) return source(decimal(price, -2), "derived", plan);
  if (/1688.*价格区间|价格区间.*1688/.test(key)) return source(price ? `1*${price}` : "", "derived", plan);
  if (/款号|型号|货号/.test(key)) return source(context.spu, "mdm", record(context.mdm));
  if (key === "品牌" || key.includes("品牌名称")) return brand;
  if (/性别|适用人群/.test(key)) return source(plan.gender, "launch_plan", plan);
  if (/上市.*时间|上市日期|产品季/.test(key)) return season;
  if (/材质|面料|帮面/.test(key)) return surface;
  if (/里料/.test(key)) return lining;
  if (/填充/.test(key)) return source(plan.filling || copy.filling, "launch_plan", plan);
  if (/鞋底/.test(key)) return sole;
  return { value: "", source: "skip", refs: [] };
}

/**
 * DeepDraw's sale-colour field stores `base colour,merchant SKU colour`, but
 * the MULTI_TEXT merchant-SKU table is keyed by its last (SKU) component.
 * Keep that identity separate from the display value; otherwise a full update
 * creates a second colour bucket for every SKU.
 */
function merchantSkuColorKey(value: string): string {
  const parts = value.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
  return parts.at(-1) ?? value;
}

function buildMerchantSku(context: JsonRecord, template: JsonRecord, colorMap: Map<string, string>): WorkflowField {
  const plan = record(context.launchPlan);
  const kind = productKind(context);
  const price = decimal(plan.retailPrice);
  const allColumns = MERCHANT_SKU_COLUMNS.filter((allowed) => options(template).some((column) => compact(allowed) === compact(column)));
  const columns = options(template).length === 0 ? MERCHANT_SKU_BASE_COLUMNS : allColumns;
  const rows = (Array.isArray(context.skus) ? context.skus : []).map(record);
  const valueJson: Record<string, unknown> = { title: columns.join(",") };
  const copywriting = record(context.copywriting);
  const copyRows = Array.isArray(copywriting.rows) ? copywriting.rows.map(record) : [];
  const guideTitle = text(copyRows[0]?.guideTitle);
  for (const sku of rows) {
    const rawColor = text(sku.color ?? sku.colorName ?? sku.color_name);
    const color = merchantSkuColorKey(colorMap.get(rawColor) ?? rawColor);
    const size = saleSizeLabel(sku.size ?? sku.sizeName ?? sku.size_name, kind);
    if (!rawColor || !color || !size) continue;
    const skuPrice = decimal(sku.price) || price;
    const skuCode = text(sku.skuCode ?? sku.sku_code);
    const skcCode = text(sku.skcCode ?? sku.skc_code) || text(context.spu);
    const barcode = text(sku.barcode ?? sku.eanCode ?? sku.ean_code);
    const sellerCode = text(sku.sellerCode ?? sku.seller_code) || barcode || skuCode;
    const rawSize = text(sku.size ?? sku.sizeName ?? sku.size_name).match(/\d+(?:\.5)?/)?.[0] ?? "";
    const values: Record<string, string> = {
      价格: skuPrice,
      货号: text(context.spu),
      上市时间: launchMonth(plan.launchDate),
      数量: "0",
      商家编码: sellerCode,
      条形码: kind === "shoe" || kind === "apparel" ? "" : barcode,
      零售价: price,
      供货价: skuPrice,
      唯品会货号: skcCode,
      唯品会条形码: barcode,
      京东价: price,
      划线价: price,
      拼多多单买价: decimal(price, -1),
      拼多多团购价: decimal(price, -2),
      天猫特卖折扣价: price,
      天猫特卖专柜价: price,
      采购价: skuPrice,
      抖音结算价格: skuPrice,
      爱库存供货价: skuPrice,
      好衣库结算价: skuPrice,
      好衣库供货价: skuPrice,
      单品货号: barcode,
      "1688件重尺-重(g)": "1000",
      小红书商家编码: kind === "shoe" && rawSize ? `${skcCode}${rawSize}` : skuCode,
      天猫SKU搜索标题: guideTitle,
    };
    if (kind === "shoe" || kind === "apparel") {
      for (const column of MERCHANT_SKU_LIST_PRICE_COLUMNS) if (!(column in values)) values[column] = MERCHANT_SKU_TRANSACTION_PRICE_COLUMNS.has(column) ? skuPrice : price;
    }
    const bucket = record(valueJson[color]);
    bucket[size] = columns.map((column) => values[column] ?? "").join(",");
    valueJson[color] = bucket;
  }
  return { fieldId: text(template.fieldId ?? template.field_id ?? template.id) || undefined, fieldName: nameOf(template), fieldType: typeOf(template), valueJson, sourceType: "derived", sourceRefs: sourceRefs(plan, ...rows), active: true, validationStatus: Object.keys(valueJson).length > 1 ? "valid" : "missing" };
}

export function buildBalabalaFields(contextInput: Record<string, unknown>, templateInput: Record<string, unknown>): WorkflowField[] {
  const context = record(contextInput);
  const templates = templateFields(record(templateInput));
  const manualOverrides = record(context.manualOverrides ?? context.manual_overrides);
  const auditedValues = record(context.auditedValues ?? context.audited_values);
  const skus = (Array.isArray(context.skus) ? context.skus : []).map(record);
  const kind = productKind(context);
  const colors = [...new Set(skus.map((sku) => text(sku.color)).filter(Boolean))];
  const colorTemplate = templates.find((template) => compact(nameOf(template)) === "颜色");
  const colorOptions = colorTemplate ? options(colorTemplate) : [];
  const colorMap = new Map(colors.map((color) => [color, standardColor(color, colorOptions)]));
  const output: WorkflowField[] = [];

  for (const template of templates) {
    const name = nameOf(template);
    const key = compact(name);
    const override = record(manualOverrides[name] ?? manualOverrides[key]);
    const audited = record(auditedValues[name] ?? auditedValues[key]);
    const base: WorkflowField = { fieldId: text(template.fieldId ?? template.field_id ?? template.id) || undefined, fieldName: name, fieldType: typeOf(template), sourceType: "skip", sourceRefs: [], active: true, manualOverride: Boolean(Object.keys(override).length), validationStatus: "valid" };
    if (isBusinessBlankField(name, template, context)) {
      output.push({ ...base, active: false, validationStatus: "skipped", staleReason: "business_blank_field" });
      continue;
    }
    if (Object.keys(override).length) {
      output.push({ ...base, valueText: text(override.valueText ?? override.value_text ?? override.value), valueJson: record(override.valueJson ?? override.value_json), sourceType: "manual", sourceRefs: [] });
      continue;
    }
    // These formats cannot be synthesized safely, but a reviewed local input
    // is authoritative and must be allowed through the normal payload path.
    if (SPECIAL_MANUAL_FIELDS.has(key)) {
      output.push({ ...base, validationStatus: required(template) ? "missing" : "skipped", staleReason: "manual_required_special_format" });
      continue;
    }
    if (Object.keys(audited).length && key !== "颜色" && key !== "尺码" && key !== "商家sku") {
      const value = optionMatch(name, text(audited.valueText ?? audited.value_text ?? audited.value), options(template), /MULTI_CHOICE|MULTI_SELECT/.test(typeOf(template)));
      output.push({ ...base, valueText: value, sourceType: text(audited.sourceType ?? audited.source_type) === "ocr" ? "ocr" : "ai", sourceRefs: sourceRefs(audited), validationStatus: value ? "valid" : "invalid", ...(value ? {} : { staleReason: "audited_value_not_in_current_template_options" }) });
      continue;
    }
    if (key === "颜色") {
      const values = colors.map((color) => colorMap.get(color) ?? "");
      output.push({ ...base, valueText: uniqueStandardColors(values).join(";"), sourceType: "derived", sourceRefs: sourceRefs(...skus), validationStatus: values.every(Boolean) ? "valid" : "missing", ...(values.every(Boolean) ? {} : { staleReason: "manual_required_color_enum" }) });
      continue;
    }
    if (["尺码", "尺寸", "规格", "size"].includes(key)) {
      const rawSizes = [...new Set(skus.map((sku) => text(sku.size ?? sku.sizeName ?? sku.size_name)).filter(Boolean))];
      const values = rawSizes.map((size) => saleSizeLabel(size, kind)).filter(Boolean);
      const permitted = options(template);
      const supported = permitted.length === 0 || values.every((value, index) => permitted.some((option) => compact(option) === compact(value) || compact(option) === compact(rawSizes[index])));
      output.push({ ...base, valueText: supported ? values.join(";") : "", sourceType: "mdm", sourceRefs: sourceRefs(...skus), validationStatus: supported && values.length ? "valid" : "missing", ...(supported ? {} : { staleReason: "sale_size_not_in_template" }) });
      continue;
    }
    if (key === "商家sku" || key === "商家sku") {
      output.push(buildMerchantSku(context, template, colorMap));
      continue;
    }
    const scalar = scalarFor(name, context, template);
    const value = optionMatch(name, scalar.value, options(template), /MULTI_CHOICE|MULTI_SELECT/.test(typeOf(template)));
    const unsupportedOptional = Boolean(scalar.value && !value && !required(template));
    output.push({
      ...base,
      valueText: value,
      sourceType: scalar.source,
      sourceRefs: scalar.refs,
      validationStatus: unsupportedOptional ? "skipped" : scalar.value && !value ? "invalid" : required(template) && !value ? "missing" : "valid",
      ...(scalar.value && !value ? { staleReason: unsupportedOptional ? "optional_source_value_not_in_current_template_options" : "value_not_in_current_template_options" } : {}),
    });
  }

  for (const candidate of output) {
    const template = templates.find((item) => nameOf(item) === candidate.fieldName);
    const requirement = template ? childRequirement(template) : undefined;
    if (!requirement) continue;
    candidate.active = requirement.parents.some((parent) => output.some((field) => compact(field.fieldName) === compact(parent) && field.active !== false && text(field.valueText).split(/[;；]/).some((value) => compact(value) === compact(requirement.value))));
    if (!candidate.active) {
      candidate.validationStatus = "skipped";
      candidate.valueText = "";
      candidate.valueJson = {};
      candidate.staleReason = "inactive_child_field";
    }
  }
  return output;
}

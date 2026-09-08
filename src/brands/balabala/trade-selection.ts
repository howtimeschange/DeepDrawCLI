type JsonRecord = Record<string, unknown>;

export interface TradeCandidateDecision {
  tradeId: string;
  tradePath: string;
  score: number;
  platformCoverage: string[];
  missingPlatforms: string[];
  missingSizes: string[];
  priorityTier: number;
  reasons: string[];
}

export interface TradeDecision {
  selected?: TradeCandidateDecision;
  candidates: TradeCandidateDecision[];
  manualSelectionRequired: boolean;
  reasons: string[];
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function text(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value).trim();
  return "";
}

function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(list);
  if (value && typeof value === "object") {
    const item = record(value);
    return list(item.name ?? item.site ?? item.code ?? item.value ?? item.label);
  }
  return text(value).split(/[;,，；|/]/).map((item) => item.trim()).filter(Boolean);
}

function normalized(value: unknown): string {
  return text(value).replace(/[＞〉》]/g, ">").replace(/[\s/]/g, "").toLowerCase();
}

function leaf(value: unknown): string {
  const parts = normalized(value).split(">").filter(Boolean);
  return parts.at(-1) ?? "";
}

function isGenericOfficialLeaf(value: unknown): boolean {
  return ["裤子", "套装", "其他", "其他童装", "运动鞋", "t恤", "羽绒服", "马甲", "卫衣", "衬衫", "连衣裙", "大衣", "羽绒马甲", "运动裤卫裤", "学步鞋", "靴子", "鞋"].includes(leaf(value));
}

function valueFor(object: JsonRecord, names: string[]): unknown {
  // The upstream trade tree carries both `name` and the synthesized
  // `tradePath`. Prefer the semantic field order supplied by the caller;
  // relying on object insertion order collapses distinct category paths to
  // the same leaf name (for example three separate \"运动鞋\" categories).
  for (const expected of names) {
    const wanted = normalized(expected);
    const found = Object.entries(object).find(([name]) => normalized(name) === wanted);
    if (found) return found[1];
  }
  return undefined;
}

function platformKey(value: string): string {
  const key = normalized(value);
  if (/vip|唯品/.test(key)) return "VIP";
  if (/douyin|抖音/.test(key)) return "Douyin";
  if (/xhs|xiaohongshu|小红书/.test(key)) return "Xhs";
  if (/pdd|拼多多/.test(key)) return "PDD";
  if (/taobao|淘宝|tmall|天猫/.test(key)) return "Taobao";
  if (/kuaishou|快手/.test(key)) return "Kuaishou";
  if (/alibaba|1688|阿里/.test(key)) return "Alibaba";
  return text(value);
}

function launchRows(context: JsonRecord): JsonRecord[] {
  const plan = record(context.launchPlan);
  const rows = Array.isArray(plan.rows) ? plan.rows.map(record) : [];
  return rows.length ? rows : [plan];
}

function requiredPlatforms(context: JsonRecord): string[] {
  const required = new Set<string>();
  for (const plan of launchRows(context)) {
    if (text(plan.officialTrade)) ["Alibaba", "PDD", "Taobao", "Kuaishou"].forEach((item) => required.add(item));
    if (text(plan.vipTrade) || text(plan.vipStyle)) required.add("VIP");
    if (text(plan.douyinTrade)) required.add("Douyin");
  }
  return [...required];
}

function hasCategoryConflict(context: JsonRecord): boolean {
  const keys = ["officialTrade", "vipTrade", "vipStyle", "douyinTrade"];
  return keys.some((key) => new Set(launchRows(context).map((row) => text(row[key])).filter(Boolean)).size > 1);
}

const BALABALA_TRADE_TIERS = [
  new Set(["7", "531", "9483", "6741", "6744", "905", "10087"]),
  new Set(["3245", "3525", "893"]),
  new Set(["9631"]),
];

function candidateIds(candidate: JsonRecord): string[] {
  const values = candidate.ancestorIds ?? candidate.ancestor_ids ?? candidate.lineageIds ?? candidate.lineage_ids;
  const listed = Array.isArray(values) ? values.map(text) : text(values).split(/[,，;；]/).map((item) => item.trim());
  return [...new Set([text(valueFor(candidate, ["tradeId", "trade_id", "id"])), text(valueFor(candidate, ["parentTradeId", "parent_trade_id"])), ...listed].filter(Boolean))];
}

function priorityTier(context: JsonRecord, candidate: JsonRecord, path: string): number {
  if (/^blbl&mini(?:>|$)/.test(path)) return 99;
  const tenant = text(context.tenantName ?? context.tenant_name);
  const ids = candidateIds(candidate);
  if (tenant && tenant !== "电商巴拉巴拉") return 0;
  // Unit callers and some historical responses contain only flattened leaves.
  // In that case hierarchy cannot be proven, so retain the candidate and let
  // the semantic/platform/size checks decide rather than inventing an ID.
  if (ids.length <= 1) return 0;
  const match = BALABALA_TRADE_TIERS.findIndex((tier) => ids.some((id) => tier.has(id)));
  return match >= 0 ? match : 98;
}

function normalizedSize(value: unknown): string {
  return text(value).match(/\d+(?:\.5)?/)?.[0] ?? "";
}

function categoryEvidence(context: JsonRecord): Array<{ value: string; weight: number }> {
  const plan = record(context.launchPlan);
  const values: Array<{ value: string; weight: number }> = [
    // Listingify treats a generic official leaf (for example “裤子”) as a
    // candidate, not a mandate.  More specific VIP/Douyin/plan evidence may
    // safely replace it when it identifies a child-apparel leaf.
    { value: text(plan.officialTrade), weight: isGenericOfficialLeaf(plan.officialTrade) ? 300 : 1000 },
    { value: text(plan.vipTrade), weight: 420 },
    { value: text(plan.vipStyle), weight: 320 },
    { value: text(plan.douyinTrade), weight: 260 },
    { value: text(plan.subcategory), weight: 180 },
    { value: text(plan.category), weight: 160 },
  ];
  const aliases: Array<[RegExp, string[]]> = [
    [/休闲鞋|运动休闲鞋|时尚生活鞋/, ["板鞋", "运动鞋"]],
    [/跑步鞋|运动生活鞋/, ["运动鞋"]],
    [/宝宝鞋/, ["学步鞋", "婴儿鞋"]],
    [/毛衫/, ["毛衣", "针织衫"]],
    [/便服|长袖t恤|短袖t恤/i, ["t恤"]],
    [/衬衫/, ["衬衫"]],
    [/大衣/, ["呢大衣"]],
    [/运动裤卫裤|休闲裤/, ["长裤"]],
    [/牛仔(?:裤|长裤|短裤|中裤)/, ["牛仔裤"]],
  ];
  for (const { value, weight } of [...values]) {
    for (const [expression, matches] of aliases) {
      if (expression.test(value)) values.push(...matches.map((alias) => ({ value: alias, weight: weight - 80 })));
    }
  }
  return values.filter((item) => item.value);
}

function scoreCandidate(context: JsonRecord, candidate: JsonRecord): TradeCandidateDecision {
  const tradeId = text(valueFor(candidate, ["tradeId", "trade_id", "id"]));
  const tradePath = text(valueFor(candidate, ["tradePath", "trade_path", "path", "tradeName", "trade_name", "name"]));
  const path = normalized(tradePath);
  const tier = priorityTier(context, candidate, path);
  const candidateLeaf = leaf(tradePath);
  const reasons: string[] = [];
  let score = 0;
  for (const evidence of categoryEvidence(context)) {
    const source = normalized(evidence.value);
    if (!source) continue;
    const sourceLeaf = leaf(evidence.value);
    if (path === source) {
      score += evidence.weight;
      reasons.push(`精确匹配 ${evidence.value}`);
    } else if (sourceLeaf && candidateLeaf === sourceLeaf) {
      score += Math.round(evidence.weight * 0.72);
      reasons.push(`末级匹配 ${sourceLeaf}`);
    } else if (sourceLeaf && path.includes(sourceLeaf)) {
      score += Math.round(evidence.weight * 0.48);
      reasons.push(`路径包含 ${sourceLeaf}`);
    }
  }
  const plan = record(context.launchPlan);
  const pathContext = `${path}${normalized(plan.category)}${normalized(plan.subcategory)}`;
  if (/鞋|靴/.test(pathContext) && /童鞋|亲子鞋/.test(path)) score += 120;
  if (/鞋|靴/.test(pathContext) && /运动|户外/.test(path) && /运动|户外/.test(pathContext)) score += 80;
  if (/鞋|靴/.test(pathContext) && /男童鞋|女童鞋/.test(path) && !/男童鞋|女童鞋/.test(normalized(plan.officialTrade))) score -= 90;
  if (/blbl&mini/.test(path)) score -= 500;

  // The DeepDraw tree contains adult, sports and child leaves with identical
  // names.  This is the context/tie-break layer used by Listingify after a
  // leaf match: retain a real tie for manual review, but prefer the child
  // branch, then the gender/age/subcategory branch when source evidence is
  // explicit.  It is deliberately not a hard-coded trade id mapping.
  const apparel = /服|衣|裤|裙/.test(`${text(plan.productLine)} ${text(plan.category)} ${text(plan.subcategory)}`);
  const gender = normalized(plan.gender);
  const middleChild = /中童|大童/.test(normalized(plan.ageBand)) || Number((text(plan.sizeRange).match(/\d+/g) ?? []).at(-1) ?? 0) >= 130;
  const longPants = /长裤/.test(`${text(plan.category)} ${text(plan.subcategory)}`);
  const down = /羽绒服/.test(`${text(plan.category)} ${text(plan.subcategory)}`);
  const sweatshirt = /卫衣/.test(`${text(plan.category)} ${text(plan.subcategory)}`);
  const denim = /牛仔/.test(`${text(plan.category)} ${text(plan.subcategory)} ${text(plan.douyinTrade)}`);
  if (apparel && /童装婴幼儿服装/.test(path)) score += 480;
  if (apparel && /男/.test(gender) && /童装婴幼儿服装>+男童/.test(path)) score += 360;
  if (apparel && /女/.test(gender) && /童装婴幼儿服装>+中大童/.test(path)) score += 260;
  if (apparel && /中性|男女/.test(gender) && /童装婴幼儿服装>+中性童装/.test(path)) score += 300;
  if (apparel && middleChild && /童装婴幼儿服装>+中大童/.test(path)) score += 100;
  if (longPants && /男/.test(gender) && /童装婴幼儿服装>+男童>+长裤/.test(path)) score += 360;
  if (longPants && /女/.test(gender) && /童装婴幼儿服装>+中大童>+长裤/.test(path)) score += 260;
  if (longPants && /中性|男女/.test(gender) && /童装婴幼儿服装>+中性童装>+长裤/.test(path)) score += 300;
  if (down && /男/.test(gender) && /童装婴幼儿服装>+男童>+羽绒服/.test(path)) score += 220;
  if (down && /女/.test(gender) && /童装婴幼儿服装>+中大童>+羽绒服/.test(path)) score += 190;
  if (sweatshirt && /女/.test(gender) && /童装婴幼儿服装>+中大童>+卫衣/.test(path)) score += 170;
  if (denim && /童装婴幼儿服装>+(?:中大童>+)?牛仔裤/.test(path)) score += 500;

  const actualPlatforms = [...new Set(list(valueFor(candidate, ["sites", "platforms", "supportSites", "support_sites"])).map(platformKey))];
  const required = requiredPlatforms(context);
  const missingPlatforms = actualPlatforms.length === 0 ? [] : required.filter((item) => !actualPlatforms.includes(item));
  if (missingPlatforms.length) reasons.push(`缺少平台 ${missingPlatforms.join(",")}`);

  const skuSizes = [...new Set((Array.isArray(context.skus) ? context.skus : []).map((sku) => normalizedSize(record(sku).size)).filter(Boolean))];
  const sizeOptions = list(valueFor(candidate, ["sizeOptions", "size_options", "saleSizeOptions", "sale_size_options"])).map(normalizedSize).filter(Boolean);
  const missingSizes = sizeOptions.length === 0 ? [] : skuSizes.filter((size) => !sizeOptions.includes(size));
  if (missingSizes.length) reasons.push(`不支持尺码 ${missingSizes.join(",")}`);
  return { tradeId, tradePath, score, platformCoverage: actualPlatforms, missingPlatforms, missingSizes, priorityTier: tier, reasons };
}

export function selectBalabalaTrade(contextInput: Record<string, unknown>, candidatesInput: unknown[]): TradeDecision {
  const context = record(contextInput);
  const candidates = candidatesInput.map(record).map((candidate) => scoreCandidate(context, candidate))
    .filter((candidate) => candidate.tradeId && candidate.tradePath)
    .sort((left, right) => left.priorityTier - right.priorityTier || right.score - left.score || left.tradeId.localeCompare(right.tradeId));
  let eligible = candidates.filter((candidate) => candidate.priorityTier < 98 && candidate.score > 0 && candidate.missingPlatforms.length === 0 && candidate.missingSizes.length === 0);
  const shoe = categoryEvidence(context).some((item) => /鞋/.test(item.value));
  // A direct child-shoe leaf is more specific than gender-segmented copies
  // with the same name. Listingify only uses gendered shoe branches when no
  // direct leaf can satisfy source platform and size coverage.
  if (shoe && eligible.some((candidate) => !/男童鞋|女童鞋/.test(normalized(candidate.tradePath)))) {
    eligible = eligible.filter((candidate) => !/男童鞋|女童鞋/.test(normalized(candidate.tradePath)));
  }
  if (eligible.length === 0) {
    const reasons = candidates.flatMap((candidate) => candidate.reasons).filter(Boolean);
    return { candidates, manualSelectionRequired: true, reasons: reasons.length ? reasons : ["没有覆盖资料与当前模板要求的深绘类目"] };
  }
  const bestTier = Math.min(...eligible.map((candidate) => candidate.priorityTier));
  const tierEligible = eligible.filter((candidate) => candidate.priorityTier === bestTier);
  const top = tierEligible[0];
  const tied = tierEligible.filter((candidate) => candidate.score === top.score);
  if (tied.length > 1) return { candidates, manualSelectionRequired: true, reasons: [`类目评分并列：${tied.map((candidate) => candidate.tradeId).join(",")}`] };
  return { selected: top, candidates, manualSelectionRequired: false, reasons: [
    ...(hasCategoryConflict(context) ? ["上市计划同一类目来源存在冲突；已按优先级、平台、尺码与语义规则选择，需人工确认。"] : []),
    ...top.reasons,
  ] };
}

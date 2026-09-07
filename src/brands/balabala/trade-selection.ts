type JsonRecord = Record<string, unknown>;

export interface TradeCandidateDecision {
  tradeId: string;
  tradePath: string;
  score: number;
  platformCoverage: string[];
  missingPlatforms: string[];
  missingSizes: string[];
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

function requiredPlatforms(context: JsonRecord): string[] {
  const plan = record(context.launchPlan);
  const required = new Set<string>();
  if (text(plan.officialTrade)) ["Alibaba", "PDD", "Taobao", "Kuaishou"].forEach((item) => required.add(item));
  if (text(plan.vipTrade) || text(plan.vipStyle)) required.add("VIP");
  if (text(plan.douyinTrade)) required.add("Douyin");
  return [...required];
}

function normalizedSize(value: unknown): string {
  return text(value).match(/\d+(?:\.5)?/)?.[0] ?? "";
}

function categoryEvidence(context: JsonRecord): Array<{ value: string; weight: number }> {
  const plan = record(context.launchPlan);
  const values: Array<{ value: string; weight: number }> = [
    { value: text(plan.officialTrade), weight: 1000 },
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

  const actualPlatforms = [...new Set(list(valueFor(candidate, ["sites", "platforms", "supportSites", "support_sites"])).map(platformKey))];
  const required = requiredPlatforms(context);
  const missingPlatforms = actualPlatforms.length === 0 ? [] : required.filter((item) => !actualPlatforms.includes(item));
  if (missingPlatforms.length) reasons.push(`缺少平台 ${missingPlatforms.join(",")}`);

  const skuSizes = [...new Set((Array.isArray(context.skus) ? context.skus : []).map((sku) => normalizedSize(record(sku).size)).filter(Boolean))];
  const sizeOptions = list(valueFor(candidate, ["sizeOptions", "size_options", "saleSizeOptions", "sale_size_options"])).map(normalizedSize).filter(Boolean);
  const missingSizes = sizeOptions.length === 0 ? [] : skuSizes.filter((size) => !sizeOptions.includes(size));
  if (missingSizes.length) reasons.push(`不支持尺码 ${missingSizes.join(",")}`);
  return { tradeId, tradePath, score, platformCoverage: actualPlatforms, missingPlatforms, missingSizes, reasons };
}

export function selectBalabalaTrade(contextInput: Record<string, unknown>, candidatesInput: unknown[]): TradeDecision {
  const context = record(contextInput);
  const candidates = candidatesInput.map(record).map((candidate) => scoreCandidate(context, candidate))
    .filter((candidate) => candidate.tradeId && candidate.tradePath)
    .sort((left, right) => right.score - left.score || left.tradeId.localeCompare(right.tradeId));
  const eligible = candidates.filter((candidate) => candidate.score > 0 && candidate.missingPlatforms.length === 0 && candidate.missingSizes.length === 0);
  if (eligible.length === 0) {
    const reasons = candidates.flatMap((candidate) => candidate.reasons).filter(Boolean);
    return { candidates, manualSelectionRequired: true, reasons: reasons.length ? reasons : ["没有覆盖资料与当前模板要求的深绘类目"] };
  }
  const top = eligible[0];
  const tied = eligible.filter((candidate) => candidate.score === top.score);
  if (tied.length > 1) return { candidates, manualSelectionRequired: true, reasons: [`类目评分并列：${tied.map((candidate) => candidate.tradeId).join(",")}`] };
  return { selected: top, candidates, manualSelectionRequired: false, reasons: top.reasons };
}

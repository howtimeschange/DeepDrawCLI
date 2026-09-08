// Ported from Listingify product-archive-drafts.ts: complete-word short titles and category guide slots.
const stringValue = (value: unknown): string => String(value ?? "").trim();
const uniqueTextValues = (values: string[]): string[] => [...new Set(values.filter(Boolean))];
export function truncateCompleteWords(value: unknown, maxLength: number) {
  const text = stringValue(value)
  if (!text || text.length <= maxLength) return text
  const segments = Array.from(new Intl.Segmenter("zh-CN", { granularity: "word" }).segment(text))
  let output = ""
  for (const { segment } of segments) {
    if (`${output}${segment}`.length > maxLength) break
    output += segment
  }
  return output.replace(/[\s,，、。；;：:|/]+$/g, "").trim()
}

const SHORT_GUIDE_TITLE_DROP_WORDS = [
  "校园日常",
  "通勤百搭",
  "防滑耐磨",
  "舒适保暖",
  "轻便",
  "轻盈",
  "舒适",
  "防滑",
  "耐磨",
  "保暖",
  "缓震",
  "软底",
  "透气",
  "百搭",
  "通勤",
  "日常",
]

const SHORT_GUIDE_TITLE_AUDIENCE_WORDS = [
  "男女童",
  "男童",
  "女童",
  "儿童",
  "宝宝",
  "婴童",
  "幼童",
  "小童",
  "中童",
  "大童",
  "少年",
  "学生",
]

const SHORT_GUIDE_TITLE_CATEGORY_WORDS = [
  "户外运动鞋",
  "户外鞋",
  "运动鞋",
  "休闲鞋",
  "学步鞋",
  "篮球鞋",
  "足球鞋",
  "雪地靴",
  "帆布鞋",
  "公主鞋",
  "板鞋",
  "凉鞋",
  "拖鞋",
  "皮鞋",
  "鞋",
  "羽绒马甲",
  "羽绒服",
  "冲锋衣",
  "防晒服",
  "连衣裙",
  "半身裙",
  "直筒裤",
  "牛仔裤",
  "休闲裤",
  "长裤",
  "短裤",
  "裤子",
  "卫衣",
  "T恤",
  "上衣",
  "外套",
  "棉服",
  "夹克",
  "马甲",
  "衬衫",
  "套装",
  "两件套",
]

function indexedShortGuideTitleTerm(title: string, term: string, used: Array<[number, number]>) {
  const index = title.lastIndexOf(term)
  if (index < 0) return null
  const end = index + term.length
  if (used.some(([start, usedEnd]) => index < usedEnd && end > start)) return null
  return { index, term }
}

function preferredShortGuideTitleTerm(title: string, terms: string[], used: Array<[number, number]>) {
  for (const term of terms) {
    const match = indexedShortGuideTitleTerm(title, term, used)
    if (!match) continue
    used.push([match.index, match.index + match.term.length])
    return match.term
  }
  return ""
}

function shortGuideTitleProtectedFallback(title: string, maxLength: number) {
  const brand = title.includes("巴拉巴拉") ? "巴拉巴拉" : ""
  const used: Array<[number, number]> = []
  if (brand) used.push([title.indexOf(brand), title.indexOf(brand) + brand.length])
  const audience = preferredShortGuideTitleTerm(title, SHORT_GUIDE_TITLE_AUDIENCE_WORDS, used)
  const category = preferredShortGuideTitleTerm(title, SHORT_GUIDE_TITLE_CATEGORY_WORDS, used)
  for (const candidate of uniqueTextValues([
    `${brand}${audience}${category}`,
    `${brand}${category}`,
    `${audience}${category}`,
  ])) {
    if (candidate && candidate.length <= maxLength) return candidate
  }
  return ""
}

export function shortGuideTitle(title: string, maxLength = 12) {
  const compactTitle = title.replace(/[\s,，、。；;：:|/]+/g, "")
  if (!compactTitle) return ""
  if (compactTitle.length <= maxLength) return compactTitle

  const reducedTitle = [...SHORT_GUIDE_TITLE_DROP_WORDS]
    .sort((left, right) => right.length - left.length)
    .reduce((text, word) => text.replaceAll(word, ""), compactTitle)

  const protectedFallback = shortGuideTitleProtectedFallback(reducedTitle || compactTitle, maxLength)
  if (
    reducedTitle
    && reducedTitle.length <= maxLength
    && protectedFallback
    && protectedFallback.length < reducedTitle.length
    && /(?:运动鞋.*户外鞋|户外鞋.*运动鞋)/.test(reducedTitle)
  ) return protectedFallback
  if (reducedTitle && reducedTitle.length <= maxLength) return reducedTitle

  if (protectedFallback) return protectedFallback
  return truncateCompleteWords(compactTitle, maxLength) || compactTitle.slice(0, maxLength)
}

const PRODUCT_ARCHIVE_TMALL_GUIDE_TITLE_TEMPLATES: Record<string, string[]> = {
  shoe: ["200001,品牌", "203512,功能", "206083,风格", "322324,适用人群", "1000240545,亮点", "2165044216,品类词", "interest7,利益点"],
  toddlerShoe: ["200001,品牌", "2253274642,学步鞋类型", "203513,功能", "205484,适用性别", "332435,流行元素", "1000240546,亮点", "2165044217,品类词", "interest8,利益点"],
  downJacket: ["200001,品牌", "316102,衣长", "16269273,厚薄", "205484,适用性别", "1000240545,亮点", "2165044216,品类词", "interest7,利益点"],
  pants: ["200001,品牌", "232612,裤长", "205513,面料", "1222762104,裤子分类", "1000240545,亮点", "2165044216,品类词", "interest7,利益点"],
  sweatshirt: ["200001,品牌", "308962,适用季节", "205483,适用性别", "205514,面料", "206085,风格", "1000240546,亮点", "2165044217,品类词", "interest8,利益点"],
  skirt: ["200001,品牌", "205482,适用性别", "200863,款式", "206084,风格", "308965,适用季节", "1000240546,亮点", "2165044217,品类词", "interest8,利益点"],
  tshirt: ["200001,品牌", "206022,领型", "206083,风格", "206614,袖长", "1000240545,亮点", "2165044216,品类词", "interest7,利益点"],
  set: ["200001,品牌", "206082,风格", "205513,面料", "317454,件数", "308965,适用季节", "1000240546,亮点", "2165044217,品类词", "interest8,利益点"],
  coat: ["200001,品牌", "16269272,厚薄", "308963,适用季节", "206024,领型", "1000240545,亮点", "2165044216,品类词", "interest7,利益点"],
  default: ["interest7,利益点"],
}

function tmallGuideTitleTemplateKeys(text: string, shoe: boolean) {
  if (/学步鞋|爬爬鞋/.test(text)) return PRODUCT_ARCHIVE_TMALL_GUIDE_TITLE_TEMPLATES.toddlerShoe
  if (shoe) return PRODUCT_ARCHIVE_TMALL_GUIDE_TITLE_TEMPLATES.shoe
  if (/羽绒/.test(text)) return PRODUCT_ARCHIVE_TMALL_GUIDE_TITLE_TEMPLATES.downJacket
  if (/卫衣/.test(text)) return PRODUCT_ARCHIVE_TMALL_GUIDE_TITLE_TEMPLATES.sweatshirt
  if (/裙/.test(text)) return PRODUCT_ARCHIVE_TMALL_GUIDE_TITLE_TEMPLATES.skirt
  if (/T恤|t恤|TEE|长袖t/i.test(text)) return PRODUCT_ARCHIVE_TMALL_GUIDE_TITLE_TEMPLATES.tshirt
  if (/套装|两件套|三件套/.test(text)) return PRODUCT_ARCHIVE_TMALL_GUIDE_TITLE_TEMPLATES.set
  if (/裤/.test(text)) return PRODUCT_ARCHIVE_TMALL_GUIDE_TITLE_TEMPLATES.pants
  if (/棉服|外套/.test(text)) return PRODUCT_ARCHIVE_TMALL_GUIDE_TITLE_TEMPLATES.coat
  return PRODUCT_ARCHIVE_TMALL_GUIDE_TITLE_TEMPLATES.default
}

export function buildGuideTitle(category: string, shoe: boolean, title: string): string {
  if (!title) return "";
  const keys = tmallGuideTitleTemplateKeys(category, shoe)!;
  return JSON.stringify([Object.fromEntries(keys.map((key, index) => [key, index === keys.length - 1 ? title : ""]))]);
}

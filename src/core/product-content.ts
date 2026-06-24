export interface ProductContentSummary {
  productCode: string | null;
  productId: unknown;
  uid: string | null;
  title: string | null;
  brandName: string | null;
  tradeId: string | null;
  tradeName: string | null;
  colorCount: number;
  sizeCount: number;
  skuCount: number;
  pictureCount: number;
  detailPageCount: number;
  detailAssetCount: number;
}

export interface SkuSummary {
  color: string | null;
  size: string | null;
  sellerCode: string | null;
  barcode: string | null;
  skuCode: string | null;
  price: string | null;
  quantity: string | null;
}

export interface PictureAsset {
  place: string | null;
  pictureType: string;
  url: string;
  normalizedUrl: string;
  skc: string | null;
  color: string | null;
  id: string | null;
  name: string | null;
  width: number | null;
  height: number | null;
  fileSize: number | null;
  sortNo: number | null;
  withWatermark: boolean | null;
}

export interface DetailPageAsset {
  pageIndex: number;
  templateName: string | null;
  htmlPageUrl: string | null;
  imagePageUrl: string | null;
  mixedPageUrl: string | null;
  screenshotUrls: string[];
}

export interface DetailModuleAsset {
  pageIndex: number;
  moduleName: string;
  moduleIndex: number;
  url: string;
  normalizedUrl: string;
}

export interface ProductContentAssets {
  pictures: PictureAsset[];
  detailPages: DetailPageAsset[];
  detailModules: DetailModuleAsset[];
}

export interface ProductContentExtraction {
  summary: ProductContentSummary;
  skus: SkuSummary[];
  assets: ProductContentAssets;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringOrNull(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  return String(value);
}

function numberOrNull(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function booleanOrNull(value: unknown): boolean | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const text = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(text)) return true;
  if (["false", "0", "no", "n"].includes(text)) return false;
  return null;
}

export function normalizeDeepdrawUrl(url: unknown): string | null {
  const value = stringOrNull(url);
  if (!value) return null;
  if (value.startsWith("//")) return `http:${value}`;
  return value;
}

function bodyFromPayload(payload: unknown): Record<string, unknown> {
  const root = record(payload);
  return record(root.body ?? payload);
}

function skuValue(values: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = stringOrNull(values[key]);
    if (value) return value;
  }
  return null;
}

function extractSkus(body: Record<string, unknown>): SkuSummary[] {
  const skus = record(body.skus);
  return array(skus.skuItems).filter(isRecord).map((sku) => {
    const values = record(sku.values);
    return {
      color: stringOrNull(sku.color),
      size: stringOrNull(sku.size),
      sellerCode: skuValue(values, ["商家编码", "SKU码", "店内码"]),
      barcode: skuValue(values, ["条形码", "唯品会条形码", "有赞规格条码"]),
      skuCode: skuValue(values, ["唯品会货号", "小红书商家编码", "SKU_CODE", "skuCode"]),
      price: skuValue(values, ["价格", "零售价", "供货价"]),
      quantity: skuValue(values, ["数量", "库存"]),
    };
  });
}

function extractPictures(body: Record<string, unknown>): PictureAsset[] {
  const picturesRoot = record(record(body.pictures).pictures);
  const assets: PictureAsset[] = [];
  for (const [placeName, placeValue] of Object.entries(picturesRoot)) {
    const place = record(placeValue);
    const groups = record(place.pictures);
    for (const [pictureType, pictures] of Object.entries(groups)) {
      array(pictures).filter(isRecord).forEach((picture, index) => {
        const normalizedUrl = normalizeDeepdrawUrl(picture.url);
        const url = stringOrNull(picture.url);
        if (!url || !normalizedUrl) return;
        assets.push({
          place: stringOrNull(place.place) ?? placeName,
          pictureType,
          url,
          normalizedUrl,
          skc: stringOrNull(picture.skc),
          color: stringOrNull(picture.color),
          id: stringOrNull(picture.id),
          name: stringOrNull(picture.name),
          width: numberOrNull(picture.width),
          height: numberOrNull(picture.height),
          fileSize: numberOrNull(picture.size),
          sortNo: numberOrNull(picture.sortNum) ?? index + 1,
          withWatermark: booleanOrNull(picture.withWatermark),
        });
      });
    }
  }
  return assets;
}

function pageUrl(value: unknown): string | null {
  return normalizeDeepdrawUrl(value);
}

function extractDetailAssets(body: Record<string, unknown>): Pick<ProductContentAssets, "detailPages" | "detailModules"> {
  const pages = array(body.detalPages ?? body.detailPages).filter(isRecord);
  const detailPages: DetailPageAsset[] = [];
  const detailModules: DetailModuleAsset[] = [];

  pages.forEach((page, pageIndex) => {
    const index = pageIndex + 1;
    detailPages.push({
      pageIndex: index,
      templateName: stringOrNull(page.templateName),
      htmlPageUrl: pageUrl(page.htmlPageUrl),
      imagePageUrl: pageUrl(page.imagePageUrl),
      mixedPageUrl: pageUrl(page.mixedPageUrl),
      screenshotUrls: array(page.screenShotSectionUrls).map(normalizeDeepdrawUrl).filter((url): url is string => Boolean(url)),
    });

    for (const [moduleName, urls] of Object.entries(record(page.modules))) {
      array(urls).forEach((url, moduleIndex) => {
        const normalizedUrl = normalizeDeepdrawUrl(url);
        const originalUrl = stringOrNull(url);
        if (!originalUrl || !normalizedUrl) return;
        detailModules.push({
          pageIndex: index,
          moduleName,
          moduleIndex: moduleIndex + 1,
          url: originalUrl,
          normalizedUrl,
        });
      });
    }
  });

  return { detailPages, detailModules };
}

function detailAssetCount(assets: ProductContentAssets): number {
  return assets.detailModules.length + assets.detailPages.reduce((count, page) => {
    return count +
      (page.htmlPageUrl ? 1 : 0) +
      (page.imagePageUrl ? 1 : 0) +
      (page.mixedPageUrl ? 1 : 0) +
      page.screenshotUrls.length;
  }, 0);
}

export function extractDeepdrawProductContent(payload: unknown): ProductContentExtraction {
  const body = bodyFromPayload(payload);
  const trade = record(body.trade);
  const skus = extractSkus(body);
  const pictures = extractPictures(body);
  const detailAssets = extractDetailAssets(body);
  const assets: ProductContentAssets = {
    pictures,
    ...detailAssets,
  };

  return {
    summary: {
      productCode: stringOrNull(body.code ?? body.productCode),
      productId: body.productId ?? null,
      uid: stringOrNull(body.id),
      title: stringOrNull(body.title),
      brandName: stringOrNull(body.brandName),
      tradeId: stringOrNull(trade.id),
      tradeName: stringOrNull(trade.name),
      colorCount: array(record(body.colors).options).length,
      sizeCount: array(record(body.sizes).options).length,
      skuCount: skus.length,
      pictureCount: pictures.length,
      detailPageCount: detailAssets.detailPages.length,
      detailAssetCount: detailAssetCount(assets),
    },
    skus,
    assets,
  };
}

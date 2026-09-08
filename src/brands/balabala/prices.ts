type JsonRecord = Record<string, unknown>;
function record(value: unknown): JsonRecord { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {}; }

/** Missing/invalid money stays missing; never turn an empty cell into zero. */
export function money(value: unknown, offset = 0): string {
  const raw = typeof value === "number" || typeof value === "string" ? String(value).trim() : "";
  if (!raw || !/^\d+(?:\.\d+)?$/.test(raw)) return "";
  const amount = Math.round((Number(raw) + offset) * 100) / 100;
  return Number.isFinite(amount) && amount > 0 ? String(amount) : "";
}

/** The offline SKU export has 挂牌单价. Resolve a style price only when every SKU agrees. */
export function balabalaPriceEvidence(context: JsonRecord): { value: string; source: string; values: string[] } {
  const mdm = record(context.mdm);
  const spu = record(mdm.spu);
  const explicit = spu.price_tag ?? spu.priceTag ?? mdm.price_tag ?? mdm.priceTag;
  if (explicit !== undefined) return { value: money(explicit), source: "mdm_spu", values: [String(explicit)] };
  const skus = (Array.isArray(context.skus) ? context.skus : []).map(record);
  const prices = skus.map((sku) => money(sku.price));
  const values = [...new Set(prices)];
  return { value: skus.length > 0 && values.length === 1 && values[0] ? values[0] : "", source: "mdm_sku_export_unanimous_tag_price", values };
}
export function balabalaListPrice(context: JsonRecord): string { return balabalaPriceEvidence(context).value; }

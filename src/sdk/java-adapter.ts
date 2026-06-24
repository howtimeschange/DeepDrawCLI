import type { DeepdrawConfig } from "../core/config.js";
import { normalizeDeepdrawPayload } from "../core/result.js";

type SdkConfig = Pick<DeepdrawConfig, "appKey" | "appSecret" | "dopKey" | "baseUrl" | "merchantId">;

function sdkConfig(input: {
  config: SdkConfig;
  apiName: string;
  query: Record<string, unknown>;
}) {
  return {
    appKey: input.config.appKey,
    appSecret: input.config.appSecret,
    dopKey: input.config.dopKey,
    host: input.config.baseUrl,
    merchantId: input.config.merchantId,
    ...(input.apiName === "dp.product.create" ? { tradeId: input.query.tradeId } : {}),
  };
}

export function buildSdkInput(input: {
  config: SdkConfig;
  apiName: string;
  query: Record<string, unknown>;
  body: unknown;
}) {
  return {
    config: sdkConfig(input),
    ...(input.apiName === "dp.product.create" || input.apiName === "dp.product.update"
      ? { product: input.body ?? {}, query: input.query }
      : { query: input.query }),
  };
}

function extractJsonObject(text: string): unknown {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (line.startsWith("{") && line.endsWith("}")) {
      return JSON.parse(line);
    }
  }
  return JSON.parse(text);
}

export function parseSdkOutput(apiName: string, tenant: string, text: string) {
  const payload = extractJsonObject(text);
  return normalizeDeepdrawPayload(apiName, tenant, 200, payload);
}

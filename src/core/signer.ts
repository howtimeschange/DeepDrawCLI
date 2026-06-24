import crypto from "node:crypto";
import type { DeepdrawConfig } from "./config.js";
import type { DeepdrawPath, HttpMethod } from "./types.js";

export interface BuildSignedRequestInput {
  config: DeepdrawConfig;
  apiName: string;
  method: HttpMethod;
  path: DeepdrawPath;
  query?: Record<string, unknown>;
  now?: Date;
  nonce?: string;
}

export interface SignedRequest {
  url: string;
  headers: Record<string, string>;
  stringToSign: string;
}

const protectedQueryKeys = new Set(["dopKey", "merchantId", "type"]);
const acceptHeader = "application/json; charset=utf-8";
const contentTypeHeader = "application/x-www-form-urlencoded; charset=utf-8";

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function sortedEntries(object: Record<string, unknown>): [string, unknown][] {
  return Object.entries(object).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

function sanitizeQuery(query: Record<string, unknown> = {}): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(query)) {
    if (protectedQueryKeys.has(key)) continue;
    if (value === undefined || value === null || value === "") continue;
    output[key] = value;
  }
  return output;
}

function encodeQuery(params: Record<string, unknown>): string {
  return sortedEntries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value)).replace(/%20/g, "+")}`)
    .join("&");
}

function canonicalResource(requestPath: DeepdrawPath, params: Record<string, unknown>): string {
  const query = sortedEntries(params)
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return query ? `${requestPath}?${query}` : requestPath;
}

export function buildSignedRequest(input: BuildSignedRequestInput): SignedRequest {
  const now = input.now ?? new Date();
  const nonce = input.nonce ?? crypto.randomUUID();
  const baseUrl = normalizeBaseUrl(input.config.baseUrl);
  const url = new URL(input.path, baseUrl);
  const params: Record<string, unknown> = {
    dopKey: input.config.dopKey,
    merchantId: input.config.merchantId,
    ...sanitizeQuery(input.query),
    type: input.apiName,
  };
  url.search = encodeQuery(params);

  const date = now.toUTCString();
  const timestamp = String(now.getTime());
  const headersForSign: Record<string, string> = {
    "x-ca-key": input.config.appKey,
    "x-ca-nonce": nonce,
    "x-ca-signature-method": "HmacSHA256",
    "x-ca-timestamp": timestamp,
  };
  const canonicalHeaders = sortedEntries(headersForSign)
    .map(([key, value]) => `${key}:${value}\n`)
    .join("");
  const stringToSign = [
    input.method,
    acceptHeader,
    "",
    contentTypeHeader,
    date,
  ].join("\n") + "\n" + canonicalHeaders + canonicalResource(input.path, params);
  const signature = crypto
    .createHmac("sha256", input.config.appSecret)
    .update(stringToSign, "utf8")
    .digest("base64");

  return {
    url: url.toString(),
    stringToSign,
    headers: {
      accept: acceptHeader,
      "content-type": contentTypeHeader,
      date,
      host: url.host,
      "user-agent": "deepdraw-cli",
      ...headersForSign,
      "x-ca-signature-headers": Object.keys(headersForSign).sort().join(","),
      "x-ca-signature": signature,
      CA_VERSION: "1",
    },
  };
}

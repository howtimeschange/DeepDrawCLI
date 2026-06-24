import { findApiDefinition } from "./api-registry.js";
import type { DeepdrawConfig } from "./config.js";
import { normalizeDeepdrawPayload, type DeepdrawResult } from "./result.js";
import { buildSignedRequest } from "./signer.js";

export type DeepdrawFetch = typeof fetch;
type FetchBody = NonNullable<Parameters<DeepdrawFetch>[1]>["body"];

export interface CallDeepdrawInput {
  config: DeepdrawConfig;
  apiName: string;
  query: Record<string, unknown>;
  body?: unknown;
  fetchImpl?: DeepdrawFetch;
}

function serializeBody(body: unknown): FetchBody | undefined {
  if (body === undefined) return undefined;
  if (typeof body === "string") return body;
  return JSON.stringify(body);
}

function methodCannotSendBody(method: string): boolean {
  return method === "GET" || method === "HEAD";
}

async function parseResponsePayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.trim() === "") {
    return "";
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function callDeepdrawApi(input: CallDeepdrawInput): Promise<DeepdrawResult> {
  const api = findApiDefinition(input.apiName);
  if (!api) {
    throw new Error(`Unknown DeepDraw API: ${input.apiName}`);
  }
  if (api.transport !== "http") {
    throw new Error(`API ${api.apiName} requires transport: ${api.transport}`);
  }
  if (input.body !== undefined && methodCannotSendBody(api.method)) {
    throw new Error(`API ${api.apiName} uses ${api.method} and cannot send a request body`);
  }

  const request = buildSignedRequest({
    config: input.config,
    apiName: api.apiName,
    method: api.method,
    path: api.path,
    query: input.query,
  });
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(request.url, {
    method: api.method,
    headers: request.headers,
    body: serializeBody(input.body),
    signal: AbortSignal.timeout(input.config.timeoutMs),
  });
  const payload = await parseResponsePayload(response);

  return normalizeDeepdrawPayload(api.apiName, input.config.tenantName, response.status, payload);
}

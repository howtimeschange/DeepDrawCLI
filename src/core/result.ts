import type { CliError } from "./errors.js";

export interface DeepdrawResult {
  ok: boolean;
  api: string;
  tenant: string;
  requestId: string | null;
  httpStatus: number | null;
  businessCode: number | null;
  businessState: string | null;
  data: unknown;
  raw: unknown;
  error?: CliError;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function requestIdOrNull(value: unknown): string | null {
  if (typeof value === "string") return value.trim() !== "" ? value : null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return String(value);
  return null;
}

export function normalizeDeepdrawPayload(
  api: string,
  tenant: string,
  httpStatus: number | null,
  payload: unknown,
): DeepdrawResult {
  const root = asRecord(payload);
  const response = asRecord(root.response);
  const body = response.body ?? root.body ?? payload;
  const businessCode = numberOrNull(response.code ?? root.code);
  const businessState = stringOrNull(response.response ?? response.state ?? root.state ?? root.responseState);
  const status = numberOrNull(root.status) ?? httpStatus;
  const requestId = requestIdOrNull(response.requestId) ?? requestIdOrNull(root.requestId);
  const ok = (status === null || status === 200) &&
    (businessCode === null || businessCode === 10200) &&
    (!businessState || businessState === "success");

  return {
    ok,
    api,
    tenant,
    requestId,
    httpStatus: status,
    businessCode,
    businessState,
    data: body,
    raw: payload,
  };
}

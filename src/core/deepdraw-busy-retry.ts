import type { ApiDefinition } from "./types.js";
import type { DeepdrawResult } from "./result.js";

export type DeepdrawRetrySleep = (milliseconds: number) => Promise<void>;

export interface DeepdrawBusyRetryOptions {
  /** Total provider attempts, including the initial request. Defaults to one delayed probe. */
  maxAttempts?: number;
  /** A 10494 means the provider asked the caller to slow down; do not immediately hammer it. */
  initialDelayMs?: number;
  /** Caps later exponential delays if an embedding explicitly permits more than one retry. */
  maxDelayMs?: number;
  /** Symmetric jitter ratio, kept small so an operator can predict the cooling window. */
  jitterRatio?: number;
}

export interface DeepdrawBusyRetryMetadata {
  eligible: boolean;
  attempts: number;
  retried: boolean;
  exhausted: boolean;
  reason: string;
  delaysMs: number[];
}

const defaultBusyRetryOptions: Required<DeepdrawBusyRetryOptions> = {
  // One delayed probe is intentionally the default. A longer blind retry loop
  // hides a busy provider and is inappropriate for an interactive CLI.
  maxAttempts: 2,
  initialDelayMs: 180_000,
  maxDelayMs: 300_000,
  jitterRatio: 0.1,
};

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

function normalizeOptions(options: DeepdrawBusyRetryOptions | undefined): Required<DeepdrawBusyRetryOptions> {
  const maxAttempts = options?.maxAttempts ?? defaultBusyRetryOptions.maxAttempts;
  const initialDelayMs = options?.initialDelayMs ?? defaultBusyRetryOptions.initialDelayMs;
  const maxDelayMs = options?.maxDelayMs ?? defaultBusyRetryOptions.maxDelayMs;
  const jitterRatio = options?.jitterRatio ?? defaultBusyRetryOptions.jitterRatio;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 3) throw new Error("DeepDraw busy retry maxAttempts must be an integer from 1 to 3");
  if (!Number.isFinite(initialDelayMs) || initialDelayMs < 0) throw new Error("DeepDraw busy retry initialDelayMs must be a non-negative number");
  if (!Number.isFinite(maxDelayMs) || maxDelayMs < initialDelayMs) throw new Error("DeepDraw busy retry maxDelayMs must be at least initialDelayMs");
  if (!Number.isFinite(jitterRatio) || jitterRatio < 0 || jitterRatio > 0.5) throw new Error("DeepDraw busy retry jitterRatio must be between 0 and 0.5");
  return { maxAttempts, initialDelayMs, maxDelayMs, jitterRatio };
}

function rawText(value: unknown): string {
  if (typeof value === "string") return value;
  try { return JSON.stringify(value); } catch { return ""; }
}

/** Identifies provider-side load shedding without treating ordinary field errors as transient. */
export function deepdrawBusyReason(result: DeepdrawResult): string | undefined {
  if (result.businessCode === 10494) return "business_code_10494";
  if (result.httpStatus === 429) return "http_429";
  if (result.httpStatus === 503) return "http_503";
  const text = `${result.businessState ?? ""} ${rawText(result.raw)}`;
  if (/(访问频率过高|接口(?:过于)?繁忙|系统繁忙|rate[ _-]?limit|too many requests|service unavailable)/i.test(text)) return "provider_busy_message";
  return undefined;
}

/** Only idempotent, no-charge registry reads may be replayed automatically. */
export function canAutomaticallyRetryDeepdrawBusy(api: ApiDefinition): boolean {
  return api.riskLevel === "read";
}

function delayForRetry(retryIndex: number, options: Required<DeepdrawBusyRetryOptions>, random: () => number): number {
  const base = Math.min(options.maxDelayMs, options.initialDelayMs * (2 ** retryIndex));
  const jitter = base * options.jitterRatio * ((random() * 2) - 1);
  return Math.max(0, Math.round(base + jitter));
}

function withRetryMetadata(result: DeepdrawResult, metadata: DeepdrawBusyRetryMetadata): DeepdrawResult {
  return { ...result, retry: metadata };
}

/**
 * Replays only a known-busy read. The first retry is deliberately delayed by
 * three minutes, matching the provider's observed 10494 cooling behaviour.
 * Writes are returned immediately so callers can read back rather than create
 * a duplicate side effect.
 */
export async function callWithDeepdrawBusyRetry(input: {
  api: ApiDefinition;
  execute: () => Promise<DeepdrawResult>;
  options?: DeepdrawBusyRetryOptions;
  sleep?: DeepdrawRetrySleep;
  random?: () => number;
}): Promise<DeepdrawResult> {
  const options = normalizeOptions(input.options);
  const sleep = input.sleep ?? defaultSleep;
  const random = input.random ?? Math.random;
  const delaysMs: number[] = [];
  let latest: DeepdrawResult | undefined;
  let reason = "";

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    latest = await input.execute();
    const busyReason = deepdrawBusyReason(latest);
    if (!busyReason) {
      // Preserve the cooldown audit on a successful probe. Without this, the
      // caller would see a success that looks identical to a first attempt.
      if (delaysMs.length === 0) return latest;
      return withRetryMetadata(latest, {
        eligible: true,
        attempts: attempt,
        retried: true,
        exhausted: false,
        reason,
        delaysMs,
      });
    }
    reason = busyReason;
    const eligible = canAutomaticallyRetryDeepdrawBusy(input.api);
    if (!eligible) {
      return withRetryMetadata(latest, {
        eligible: false,
        attempts: attempt,
        retried: false,
        exhausted: false,
        reason,
        delaysMs,
      });
    }
    if (attempt === options.maxAttempts) {
      return withRetryMetadata(latest, {
        eligible: true,
        attempts: attempt,
        retried: delaysMs.length > 0,
        exhausted: true,
        reason,
        delaysMs,
      });
    }
    const delayMs = delayForRetry(attempt - 1, options, random);
    delaysMs.push(delayMs);
    await sleep(delayMs);
  }

  // The loop is bounded and always assigns latest before it can terminate.
  throw new Error(`DeepDraw busy retry did not produce a result for ${input.api.apiName}`);
}

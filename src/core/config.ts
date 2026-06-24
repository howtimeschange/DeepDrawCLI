import { existsSync, readFileSync } from "node:fs";
import { join, win32 } from "node:path";
import { parse as parseDotenv } from "dotenv";
import type { CredentialStore } from "./credentials.js";

export type ConfigPlatform = "darwin" | "linux" | "win32" | NodeJS.Platform;
export type CredentialSource = "env" | "store";

export interface DeepdrawConfig {
  tenantName: string;
  baseUrl: string;
  appKey: string;
  appSecret: string;
  dopKey: string;
  merchantId: string;
  timeoutMs: number;
  credentialSource: CredentialSource;
}

export interface StoredTenantConfig {
  baseUrl?: string;
  merchantId: string;
  timeoutMs?: number;
  appKeyRef: string;
  appSecretRef: string;
  dopKeyRef: string;
}

export interface StoredConfigFile {
  defaultTenant: string;
  tenants: Record<string, StoredTenantConfig>;
}

export interface ResolveDeepdrawConfigOptions {
  env?: NodeJS.ProcessEnv;
  platform?: ConfigPlatform;
  homeDir?: string;
  cwd?: string;
  configPath?: string;
  tenantName?: string;
  credentialStore: CredentialStore;
}

const defaultBaseUrl = "http://open.deepdraw.cn";
const defaultTimeoutMs = 30000;
const requiredEnvFields = [
  "DEEPDRAW_TENANT_NAME",
  "DEEPDRAW_APP_KEY",
  "DEEPDRAW_APP_SECRET",
  "DEEPDRAW_DOP_KEY",
  "DEEPDRAW_MERCHANT_ID",
] as const;

type RequiredEnvField = typeof requiredEnvFields[number];

export function configPathForPlatform(
  platform: ConfigPlatform,
  homeDir: string,
  env: NodeJS.ProcessEnv,
): string {
  if (platform === "win32") {
    const appData = env.APPDATA ?? win32.join(homeDir, "AppData", "Roaming");
    return win32.join(appData, "DeepDrawCli", "config.json");
  }

  return join(homeDir, ".config", "deepdraw", "config.json");
}

export async function resolveDeepdrawConfig(options: ResolveDeepdrawConfigOptions): Promise<DeepdrawConfig> {
  const env = options.env ?? process.env;
  const envResult = configFromEnv(env);
  if (envResult.ok) {
    return envResult.config;
  }

  const configPath = options.configPath
    ?? configPathForPlatform(options.platform ?? process.platform, options.homeDir ?? process.env.HOME ?? "", env);
  const storedConfig = readStoredConfig(configPath);
  if (storedConfig) {
    return configFromStoredConfig(storedConfig, options.credentialStore, configPath, options.tenantName);
  }

  const localEnv = mergeLocalEnv(env, options.cwd ?? process.cwd());
  const localEnvResult = configFromEnv(localEnv);
  if (localEnvResult.ok) {
    return localEnvResult.config;
  }

  throw new Error([
    "Missing DeepDraw configuration.",
    `Set ${requiredEnvFields.join(", ")} or create ${configPath}.`,
    localEnvResult.missing.length > 0 ? `Missing env fields: ${localEnvResult.missing.join(", ")}.` : "",
  ].filter(Boolean).join(" "));
}

function mergeLocalEnv(explicitEnv: NodeJS.ProcessEnv, cwd: string): NodeJS.ProcessEnv {
  const localEnvPath = join(cwd, ".env.local");
  if (!existsSync(localEnvPath)) {
    return { ...explicitEnv };
  }

  const parsed = parseDotenv(readFileSync(localEnvPath));
  return {
    ...parsed,
    ...explicitEnv,
  };
}

function configFromEnv(env: NodeJS.ProcessEnv): { ok: true; config: DeepdrawConfig } | { ok: false; missing: string[] } {
  const missing = requiredEnvFields.filter((field) => !env[field]);
  if (missing.length > 0) {
    return { ok: false, missing };
  }

  return {
    ok: true,
    config: {
      tenantName: requiredEnv(env, "DEEPDRAW_TENANT_NAME"),
      baseUrl: env.DEEPDRAW_BASE_URL ?? defaultBaseUrl,
      appKey: requiredEnv(env, "DEEPDRAW_APP_KEY"),
      appSecret: requiredEnv(env, "DEEPDRAW_APP_SECRET"),
      dopKey: requiredEnv(env, "DEEPDRAW_DOP_KEY"),
      merchantId: requiredEnv(env, "DEEPDRAW_MERCHANT_ID"),
      timeoutMs: parseTimeout(env.DEEPDRAW_TIMEOUT_MS, defaultTimeoutMs),
      credentialSource: "env",
    },
  };
}

function requiredEnv(env: NodeJS.ProcessEnv, field: RequiredEnvField): string {
  const value = env[field];
  if (!value) {
    throw new Error(`Missing required environment variable ${field}`);
  }
  return value;
}

function readStoredConfig(configPath: string): StoredConfigFile | undefined {
  if (!existsSync(configPath)) {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(configPath, "utf8"));
  } catch (error) {
    throw new Error(`Invalid DeepDraw config at ${configPath}: malformed JSON. ${errorMessage(error)}`);
  }

  if (!isRecord(parsed)) {
    throw new Error(`Invalid DeepDraw config at ${configPath}: root object is required.`);
  }
  if (!isNonEmptyString(parsed.defaultTenant)) {
    throw new Error(`Invalid DeepDraw config at ${configPath}: defaultTenant is required.`);
  }
  if (!isRecord(parsed.tenants)) {
    throw new Error(`Invalid DeepDraw config at ${configPath}: tenants must be a non-null object.`);
  }
  return parsed as unknown as StoredConfigFile;
}

async function configFromStoredConfig(
  storedConfig: StoredConfigFile,
  credentialStore: CredentialStore,
  configPath: string,
  tenantNameOverride?: string,
): Promise<DeepdrawConfig> {
  const tenantName = tenantNameOverride ?? storedConfig.defaultTenant;
  const tenant = storedConfig.tenants[tenantName];
  validateStoredTenant(configPath, tenantName, tenant);

  const appKey = await credentialStore.get(tenant.appKeyRef);
  const appSecret = await credentialStore.get(tenant.appSecretRef);
  const dopKey = await credentialStore.get(tenant.dopKeyRef);
  const missing = [
    appKey ? undefined : "appKey",
    appSecret ? undefined : "appSecret",
    dopKey ? undefined : "dopKey",
  ].filter((value): value is string => Boolean(value));

  if (missing.length > 0) {
    throw new Error(`Missing DeepDraw credentials for tenant "${tenantName}": ${missing.join(", ")}.`);
  }

  return {
    tenantName,
    baseUrl: tenant.baseUrl ?? defaultBaseUrl,
    appKey: appKey ?? missingCredentialAfterValidation("appKey"),
    appSecret: appSecret ?? missingCredentialAfterValidation("appSecret"),
    dopKey: dopKey ?? missingCredentialAfterValidation("dopKey"),
    merchantId: tenant.merchantId,
    timeoutMs: tenant.timeoutMs ?? defaultTimeoutMs,
    credentialSource: "store",
  };
}

function validateStoredTenant(
  configPath: string,
  tenantName: string,
  tenant: StoredTenantConfig | undefined,
): asserts tenant is StoredTenantConfig {
  if (!isRecord(tenant)) {
    throw new Error(`Invalid DeepDraw config at ${configPath}: tenant "${tenantName}" must be a non-null object.`);
  }

  const invalidFields = [
    isNonEmptyString(tenant.merchantId) ? undefined : "merchantId",
    isNonEmptyString(tenant.appKeyRef) ? undefined : "appKeyRef",
    isNonEmptyString(tenant.appSecretRef) ? undefined : "appSecretRef",
    isNonEmptyString(tenant.dopKeyRef) ? undefined : "dopKeyRef",
    tenant.baseUrl === undefined || isNonEmptyString(tenant.baseUrl) ? undefined : "baseUrl",
    tenant.timeoutMs === undefined || isPositiveInteger(tenant.timeoutMs) ? undefined : "timeoutMs",
  ].filter((value): value is string => Boolean(value));

  if (invalidFields.length > 0) {
    throw new Error(
      `Invalid DeepDraw config at ${configPath}: tenant "${tenantName}" has invalid fields: ${invalidFields.join(", ")}.`,
    );
  }
}

function missingCredentialAfterValidation(name: string): never {
  throw new Error(`Missing DeepDraw credential after validation: ${name}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseTimeout(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid DEEPDRAW_TIMEOUT_MS: ${value}`);
  }
  return parsed;
}

import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { delimiter, join, resolve } from "node:path";
import { spawn as spawnChild } from "node:child_process";
import { findApiDefinition } from "../core/api-registry.js";
import type { DeepdrawConfig } from "../core/config.js";
import { callWithDeepdrawBusyRetry, type DeepdrawBusyRetryOptions, type DeepdrawRetrySleep } from "../core/deepdraw-busy-retry.js";
import { normalizeDeepdrawPayload, type DeepdrawResult } from "../core/result.js";

type SdkConfig = Pick<DeepdrawConfig, "appKey" | "appSecret" | "dopKey" | "baseUrl" | "merchantId">;
export type JavaSdkSpawn = (command: string, args: string[], input: string) => Promise<{ stdout: string; stderr: string; exitCode: number | null }>;

export interface CallJavaSdkInput {
  config: DeepdrawConfig;
  apiName: string;
  query: Record<string, unknown>;
  body?: unknown;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  spawnImpl?: JavaSdkSpawn;
  retryOptions?: DeepdrawBusyRetryOptions;
  retrySleep?: DeepdrawRetrySleep;
  retryRandom?: () => number;
}

const sdkClasses: Record<string, string> = {
  "dp.product.create": "DeepdrawProductCreateCli",
  "dp.product.update": "DeepdrawProductUpdateCli",
  "dp.product.incremental.update": "DeepdrawProductIncrementalUpdateCli",
  "dp.product.sku.color.incremental.update": "DeepdrawProductSkuColorIncrementalUpdateCli",
  "dp.product.resource": "DeepdrawProductResourceCli",
};

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
    ...(input.apiName === "dp.product.create" || input.apiName === "dp.product.update" || input.apiName === "dp.product.incremental.update" || input.apiName === "dp.product.sku.color.incremental.update"
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

export async function callJavaSdkApi(input: CallJavaSdkInput): Promise<DeepdrawResult> {
  const className = sdkClasses[input.apiName];
  if (!className) {
    throw new Error(`API ${input.apiName} is not supported by the Java SDK runner`);
  }
  const api = findApiDefinition(input.apiName);
  if (!api) throw new Error(`Unknown DeepDraw API: ${input.apiName}`);

  if (input.apiName === "dp.product.incremental.update") {
    const fields = (input.body as { fields?: Record<string, unknown> } | undefined)?.fields;
    if (typeof fields?.尺码 === "string" && fields.尺码.includes("*")) throw new Error("带备注的销售尺码不兼容普通增量接口；必须使用经过计划的 dp.product.update，防止尺码/SKU 被重映射。");
  }
  const cwd = input.cwd ?? process.cwd();
  const env = input.env ?? process.env;
  const classpath = await resolveJavaClasspath(cwd, env, input.spawnImpl);
  const sdkInput = buildSdkInput({
    config: input.config,
    apiName: input.apiName,
    query: input.query,
    body: input.body,
  });
  const spawnImpl = input.spawnImpl ?? defaultJavaSpawn;
  return callWithDeepdrawBusyRetry({
    api,
    options: input.retryOptions,
    sleep: input.retrySleep,
    random: input.retryRandom,
    execute: async () => {
      const run = await spawnImpl("java", ["-cp", classpath, className], JSON.stringify(sdkInput));
      if (run.exitCode !== 0) {
        throw new Error(`Java SDK runner failed for ${input.apiName}: ${run.stderr || `exit code ${run.exitCode}`}`);
      }
      return parseSdkOutput(input.apiName, input.config.tenantName, run.stdout);
    },
  });
}

async function resolveJavaClasspath(cwd: string, env: NodeJS.ProcessEnv, spawnImpl?: JavaSdkSpawn): Promise<string> {
  const classDir = join(cwd, ".deepdraw-sdk", "classes");
  if (env.DEEPDRAW_SDK_CLASSPATH) {
    if (existsSync(join(cwd, "java"))) {
      await mkdir(classDir, { recursive: true });
      await compileJavaSources(cwd, classDir, env.DEEPDRAW_SDK_CLASSPATH, spawnImpl);
    }
    return [classDir, env.DEEPDRAW_SDK_CLASSPATH].join(delimiter);
  }

  const sdkDir = env.DEEPDRAW_SDK_DIR
    ?? firstExisting([
      join(cwd, "vendor", "deepdraw-sdk"),
      "/Users/xingyicheng/Documents/Listingify/vendor/deepdraw-sdk",
    ]);
  const sdkEntries = javaSdkClasspathEntries(sdkDir);
  if (existsSync(join(cwd, "java"))) {
    await mkdir(classDir, { recursive: true });
    await compileJavaSources(cwd, classDir, sdkEntries.length > 0 ? sdkEntries.join(delimiter) : undefined, spawnImpl);
  }

  return [classDir, ...sdkEntries].join(delimiter);
}

function javaSdkClasspathEntries(sdkDir: string | undefined): string[] {
  if (!sdkDir) {
    return [];
  }
  return [join(sdkDir, "*"), join(sdkDir, "lib", "*")];
}

async function compileJavaSources(
  cwd: string,
  classDir: string,
  sdkClasspath: string | undefined,
  spawnImpl?: JavaSdkSpawn,
): Promise<void> {
  const spawn = spawnImpl ?? defaultJavaSpawn;
  const classpath = sdkClasspath ?? classDir;
  const sources = [
    join(cwd, "java", "DeepdrawProductCreateCli.java"),
    join(cwd, "java", "DeepdrawProductUpdateCli.java"),
    join(cwd, "java", "DeepdrawProductIncrementalUpdateCli.java"),
    join(cwd, "java", "DeepdrawProductSkuColorIncrementalUpdateCli.java"),
    join(cwd, "java", "DeepdrawProductResourceCli.java"),
  ].filter((source) => existsSync(source));
  if (sources.length === 0) {
    return;
  }

  const run = await spawn("javac", ["-cp", classpath, "-d", classDir, ...sources], "");
  if (run.exitCode !== 0) {
    throw new Error(`Failed to compile DeepDraw Java SDK bridge: ${run.stderr || `exit code ${run.exitCode}`}`);
  }
}

function firstExisting(paths: string[]): string | undefined {
  return paths.map((path) => resolve(path)).find((path) => existsSync(path));
}

function defaultJavaSpawn(command: string, args: string[], input: string): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolveSpawn, reject) => {
    const child = spawnChild(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolveSpawn({ stdout, stderr, exitCode });
    });
    child.stdin.end(input);
  });
}

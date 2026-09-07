import { createHash } from "node:crypto";
import { spawn as spawnChild } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { apiRegistry, findApiDefinition } from "../core/api-registry.js";
import { createExecutionPlan, enforceApproval } from "../core/approval.js";
import { callDeepdrawApi, type DeepdrawFetch } from "../core/deepdraw-client.js";
import type { DeepdrawBusyRetryOptions, DeepdrawRetrySleep } from "../core/deepdraw-busy-retry.js";
import { configPathForPlatform, resolveDeepdrawConfig, type ConfigPlatform, type DeepdrawConfig, type StoredConfigFile } from "../core/config.js";
import { type CredentialStore, FileCredentialStore } from "../core/credentials.js";
import { extractDeepdrawProductContent } from "../core/product-content.js";
import { buildProductPayload, type ProductPayloadStage } from "../core/product-payload.js";
import { reviewBalabalaFields } from "../core/balabala-field-rules.js";
import { redactSensitive } from "../core/redact.js";
import { importBalabalaSources } from "../brands/balabala/importers.js";
import {
  DEFAULT_BALABALA_TEST_TARGETS,
  parseBalabalaTestTargets,
  resolveBalabalaRemoteTarget,
  type BalabalaRemoteTarget,
  type BalabalaWorkflowMode,
} from "../brands/balabala/remote-targets.js";
import { selectBalabalaTrade } from "../brands/balabala/trade-selection.js";
import { BalabalaWorkflowEngine } from "../workflow/engine.js";
import { WorkflowStore } from "../workflow/store.js";
import type { ApiDefinition } from "../core/types.js";
import { callJavaSdkApi, type JavaSdkSpawn } from "../sdk/java-adapter.js";
import { jsonLine } from "./format.js";

export interface CliRunOptions {
  env: NodeJS.ProcessEnv;
  stdin: string;
  /** An explicit semantic-command tenant selector for stored credentials. */
  tenantName?: string;
  fetchImpl?: DeepdrawFetch;
  credentialStore?: CredentialStore;
  configPath?: string;
  homeDir?: string;
  platform?: ConfigPlatform;
  cwd?: string;
  javaSpawnImpl?: JavaSdkSpawn;
  /** Test/embedding hooks for the bounded provider-busy retry policy. */
  deepdrawBusyRetryOptions?: DeepdrawBusyRetryOptions;
  deepdrawBusyRetrySleep?: DeepdrawRetrySleep;
  deepdrawBusyRetryRandom?: () => number;
}

export interface CliRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

type DoctorCheck = {
  name: string;
  ok: boolean;
  path?: string;
  count?: number;
  missing?: string[];
  message?: string;
};

const requiredDeepdrawSdkJars = [
  "dop-sdk-1.6.24.jar",
  "sdk-core-java-1.1.0.jar",
];

const requiredJavaDependencyJars = [
  "commons-codec-1.15.jar",
  "commons-collections-3.2.2.jar",
  "commons-collections4-4.1.jar",
  "commons-io-2.4.jar",
  "commons-lang3-3.11.jar",
  "commons-logging-1.2.jar",
  "fastjson-1.2.76.jar",
  "guava-20.0.jar",
  "httpclient-4.5.13.jar",
  "httpcore-4.4.14.jar",
  "okhttp-3.8.1.jar",
  "okio-1.13.0.jar",
  "slf4j-api-1.7.25.jar",
];

function helpText() {
  return [
    "Usage: deepdraw <command> [options]",
    "",
    "Commands:",
    "  call <api-name>    Call any registered DeepDraw API",
    "  balabala           Run the auditable Balabala listing workflow",
    "  product payload    Build a local Balabala product publish payload",
    "  product content    Extract product summary, SKU, and asset URLs",
    "  auth               Manage DeepDraw tenant credentials",
    "  config             Inspect local DeepDraw configuration",
  ].join("\n") + "\n";
}

function parseCallArgs(argv: string[], cwd: string): {
  dryRun: boolean;
  execute: boolean;
  yes: boolean;
  plan: boolean;
  query: Record<string, unknown>;
  body?: unknown;
} {
  const query: Record<string, unknown> = {};
  let body: unknown;
  let dryRun = false;
  let execute = false;
  let yes = false;
  let plan = false;

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--execute") {
      execute = true;
      continue;
    }
    if (arg === "--yes") {
      yes = true;
      continue;
    }
    if (arg === "--plan") {
      plan = true;
      continue;
    }
    if (arg === "--param") {
      const pair = argv[index + 1];
      if (!pair || !pair.includes("=")) {
        throw new Error("--param requires key=value");
      }
      const separator = pair.indexOf("=");
      query[pair.slice(0, separator)] = pair.slice(separator + 1);
      index += 1;
      continue;
    }
    if (arg === "--json") {
      const json = argv[index + 1];
      if (!json) {
        throw new Error("--json requires a JSON value");
      }
      body = JSON.parse(json) as unknown;
      index += 1;
      continue;
    }
    if (arg === "--json-file") {
      const jsonPath = argv[index + 1];
      if (!jsonPath) {
        throw new Error("--json-file requires a file path");
      }
      const fullPath = resolve(cwd, jsonPath);
      try {
        body = JSON.parse(readFileSync(fullPath, "utf8")) as unknown;
      } catch (error) {
        throw new Error(`Invalid JSON file ${fullPath}: ${errorMessage(error)}`);
      }
      index += 1;
      continue;
    }
    throw new Error(`Unknown call option: ${arg}`);
  }

  if (dryRun && execute) {
    throw new Error("Cannot combine --dry-run and --execute");
  }

  return { dryRun, execute, yes, plan, query, body };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function buildPlanParams(callArgs: ReturnType<typeof parseCallArgs>): Record<string, unknown> {
  if (callArgs.body === undefined) {
    return { query: callArgs.query };
  }
  return { query: callArgs.query, body: callArgs.body };
}

function stripSemanticPrefix(command: string): string {
  return command.replace(/^deepdraw\s+/, "");
}

function findSemanticApi(argv: string[]): ApiDefinition | undefined {
  const semanticKey = argv.slice(0, 2).join(" ");
  return apiRegistry.find((api) => api.semanticCommand && stripSemanticPrefix(api.semanticCommand) === semanticKey);
}

function parseSemanticArgs(argv: string[]): {
  dryRun: boolean;
  yes: boolean;
  plan: boolean;
  input?: string;
  params: Record<string, unknown>;
} {
  let dryRun = false;
  let yes = false;
  let plan = false;
  let input: string | undefined;
  const params: Record<string, unknown> = {};

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--yes") {
      yes = true;
      continue;
    }
    if (arg === "--plan") {
      plan = true;
      continue;
    }
    if (arg === "--input") {
      const inputPath = argv[index + 1];
      if (!inputPath) {
        throw new Error("--input requires a file path");
      }
      input = inputPath;
      index += 1;
      continue;
    }
    if (arg === "--param") {
      const pair = argv[index + 1];
      if (!pair || !pair.includes("=")) {
        throw new Error("--param requires key=value");
      }
      const separator = pair.indexOf("=");
      params[pair.slice(0, separator)] = pair.slice(separator + 1);
      index += 1;
      continue;
    }
    throw new Error(`Unknown semantic option: ${arg}`);
  }

  return { dryRun, yes, plan, input, params };
}

function parseProductContentArgs(argv: string[]): {
  dryRun: boolean;
  execute: boolean;
  summary: boolean;
  assets: boolean;
  query: Record<string, unknown>;
} {
  const query: Record<string, unknown> = {};
  let dryRun = false;
  let execute = false;
  let summary = false;
  let assets = false;

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(`${arg} requires a value`);
      }
      index += 1;
      return value;
    };

    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--execute") {
      execute = true;
      continue;
    }
    if (arg === "--summary") {
      summary = true;
      continue;
    }
    if (arg === "--assets") {
      assets = true;
      continue;
    }
    if (arg === "--product-code") {
      query.productCode = next();
      continue;
    }
    if (arg === "--product-id") {
      query.productId = next();
      continue;
    }
    if (arg === "--resource") {
      query.resource = next();
      continue;
    }
    if (arg === "--skc") {
      query.skc = next();
      continue;
    }
    if (arg === "--material") {
      query.material = next();
      continue;
    }
    if (arg === "--video") {
      query.video = next();
      continue;
    }
    if (arg === "--detail-page-site") {
      query.detailPageSite = next();
      continue;
    }
    if (arg === "--exclude-detail-page-modules") {
      query.excludeDetailPageModules = next();
      continue;
    }
    if (arg === "--tags") {
      query.tags = next();
      continue;
    }
    if (arg === "--param") {
      const pair = argv[index + 1];
      if (!pair || !pair.includes("=")) {
        throw new Error("--param requires key=value");
      }
      const separator = pair.indexOf("=");
      query[pair.slice(0, separator)] = pair.slice(separator + 1);
      index += 1;
      continue;
    }
    throw new Error(`Unknown product content option: ${arg}`);
  }

  if (dryRun && execute) {
    throw new Error("Cannot combine --dry-run and --execute");
  }
  if (!hasNonEmptyValue(query.productCode) && !hasNonEmptyValue(query.productId)) {
    throw new Error("product content requires --product-code or --product-id");
  }
  if (!summary && !assets) {
    summary = true;
  }

  return { dryRun, execute, summary, assets, query };
}

function parseProductPayloadArgs(argv: string[]): {
  input?: string;
  json?: unknown;
  stage: ProductPayloadStage;
  pretty: boolean;
  tenantName?: string;
  merchantId?: string;
} {
  let input: string | undefined;
  let json: unknown;
  let stage: ProductPayloadStage = "create";
  let pretty = false;
  let tenantName: string | undefined;
  let merchantId: string | undefined;

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (!value) throw new Error(`${arg} requires a value`);
      index += 1;
      return value;
    };

    if (arg === "--help") {
      continue;
    }
    if (arg === "--input") {
      input = next();
      continue;
    }
    if (arg === "--json") {
      try {
        json = JSON.parse(next()) as unknown;
      } catch (error) {
        throw new Error(`Invalid JSON: ${errorMessage(error)}`);
      }
      continue;
    }
    if (arg === "--stage") {
      const value = next();
      if (value !== "create" && value !== "update") {
        throw new Error("--stage must be create or update");
      }
      stage = value;
      continue;
    }
    if (arg === "--pretty") {
      pretty = true;
      continue;
    }
    if (arg === "--dry-run") {
      continue;
    }
    if (arg === "--tenant") {
      tenantName = next();
      continue;
    }
    if (arg === "--merchant-id") {
      merchantId = next();
      continue;
    }
    throw new Error(`Unknown product payload option: ${arg}`);
  }

  if (input && json !== undefined) throw new Error("product payload accepts either --input or --json, not both");
  if (!input && json === undefined) throw new Error("product payload requires --input file or --json JSON");
  return { input, json, stage, pretty, tenantName, merchantId };
}

function productPayloadHelpText(): string {
  return [
    "Usage: deepdraw product payload --input draft.json [--stage create|update] [--pretty]",
    "       deepdraw product payload --json JSON [--stage create|update] [--pretty]",
    "",
    "Builds a local Balabala payload only; it never reads credentials, calls the network, or publishes.",
  ].join("\n") + "\n";
}

type BalabalaWorkflowAction = "query" | "review" | "create" | "full-update" | "incremental";

type BalabalaWorkflowArgs = {
  action: BalabalaWorkflowAction;
  input?: string;
  json?: unknown;
  tenantName?: string;
  merchantId: string;
  productCode?: string;
  productId?: string;
  resource: string;
  incrementalFields: string[];
  dryRun: boolean;
  execute: boolean;
  yes: boolean;
  plan: boolean;
};

function balabalaWorkflowHelpText(): string {
  return [
    "       deepdraw balabala review --input draft.json",
    "",
    "Review validates the current class template, source evidence, AI candidates, and size-chart inputs locally.",
    "Remote query/create/full-update/incremental compatibility commands are disabled to prevent bypassing the stateful --mode/--spu target policy.",
    "Use `deepdraw balabala <sync|plan|publish|readback> --mode test|production --spu ...` instead; those commands remain thin wrappers over registered dp.* APIs.",
  ].join("\n") + "\n";
}

// Kept as a function (rather than a narrowing guard) while the old local
// review parser remains in this file for backwards-compatible review input.
function legacyBalabalaRemoteCommandDisabled(action: BalabalaWorkflowAction): boolean {
  return action !== "review";
}

function parseBalabalaWorkflowArgs(argv: string[]): BalabalaWorkflowArgs {
  const action = argv[1] as BalabalaWorkflowAction | undefined;
  if (!action || !["query", "review", "create", "full-update", "incremental"].includes(action)) {
    throw new Error("balabala requires query, review, create, full-update, or incremental");
  }

  let input: string | undefined;
  let json: unknown;
  let tenantName: string | undefined;
  let merchantId = "1162";
  let productCode: string | undefined;
  let productId: string | undefined;
  let resource = "form";
  let incrementalFields: string[] = [];
  let dryRun = false;
  let execute = false;
  let yes = false;
  let plan = false;

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (!value) throw new Error(`${arg} requires a value`);
      index += 1;
      return value;
    };
    if (arg === "--help") continue;
    if (arg === "--input") {
      input = next();
      continue;
    }
    if (arg === "--json") {
      try {
        json = JSON.parse(next()) as unknown;
      } catch (error) {
        throw new Error(`Invalid JSON: ${errorMessage(error)}`);
      }
      continue;
    }
    if (arg === "--tenant") {
      tenantName = next();
      continue;
    }
    if (arg === "--merchant-id") {
      merchantId = next();
      continue;
    }
    if (arg === "--product-code") {
      productCode = next();
      continue;
    }
    if (arg === "--product-id") {
      productId = next();
      continue;
    }
    if (arg === "--resource") {
      resource = next();
      continue;
    }
    if (arg === "--fields") {
      incrementalFields = [...new Set(next().split(",").map((value) => value.trim()).filter(Boolean))];
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--execute") {
      execute = true;
      continue;
    }
    if (arg === "--yes") {
      yes = true;
      continue;
    }
    if (arg === "--plan") {
      plan = true;
      continue;
    }
    throw new Error(`Unknown balabala option: ${arg}`);
  }

  if (dryRun && execute) throw new Error("Cannot combine --dry-run and --execute");
  if (input && json !== undefined) throw new Error("balabala accepts either --input or --json, not both");
  if (action === "query") {
    if (input || json !== undefined) throw new Error("balabala query does not accept --input or --json");
    if (!productCode && !productId) throw new Error("balabala query requires --product-code or --product-id");
  } else if (!input && json === undefined) {
    throw new Error(`balabala ${action} requires --input file or --json JSON`);
  }
  if (action !== "incremental" && incrementalFields.length > 0) {
    throw new Error("--fields is only supported by balabala incremental");
  }
  if (action === "incremental" && incrementalFields.length === 0) {
    throw new Error("balabala incremental requires --fields with one or more current template field names");
  }

  return {
    action,
    input,
    json,
    tenantName,
    merchantId,
    productCode,
    productId,
    resource,
    incrementalFields,
    dryRun,
    execute,
    yes,
    plan,
  };
}

function incrementalFieldKey(name: string): string {
  return name.replace(/\s+/g, "").toLocaleLowerCase();
}

function hasIncrementalFieldValue(value: unknown): boolean {
  return typeof value === "string" ? value.trim().length > 0 : value !== undefined && value !== null;
}

function balabalaIncrementalProduct(
  product: { fields: Record<string, unknown> },
  requestedFields: string[],
): { product?: { fields: Record<string, unknown> }; error?: string } {
  const actualNames = new Map(Object.keys(product.fields).map((name) => [incrementalFieldKey(name), name]));
  const selectedNames: string[] = [];
  for (const name of requestedFields) {
    const key = incrementalFieldKey(name);
    const actualName = actualNames.get(key);
    if (!actualName) return { error: `增量字段 ${name} 不在当前类目模板或没有可提交值。` };
    if (key === incrementalFieldKey("多平台尺码")) {
      return { error: "巴拉上新流程暂不允许通过增量更新写入多平台尺码；请使用全量更新并做资源回读。" };
    }
    if (key === incrementalFieldKey("商家SKU") || actualName.includes("尺码表")) {
      return { error: `巴拉上新流程暂不允许通过增量更新写入 ${actualName}；请使用全量更新并做资源回读。` };
    }
    if (!selectedNames.includes(actualName)) selectedNames.push(actualName);
  }

  const colorName = actualNames.get(incrementalFieldKey("颜色"));
  const sizeName = actualNames.get(incrementalFieldKey("尺码"));
  if (!colorName || !hasIncrementalFieldValue(product.fields[colorName])) {
    return { error: "巴拉上新流程的增量更新必须携带有效的颜色字段。" };
  }
  if (!sizeName || !hasIncrementalFieldValue(product.fields[sizeName])) {
    return { error: "巴拉上新流程的增量更新必须携带有效的尺码字段。" };
  }

  const fields = Object.fromEntries([...new Set([...selectedNames, colorName, sizeName])].map((name) => [name, product.fields[name]]));
  return { product: { fields } };
}

function readWorkflowInput(args: BalabalaWorkflowArgs, cwd: string): unknown {
  if (!args.input) return args.json;
  const inputPath = resolve(cwd, args.input);
  try {
    return JSON.parse(readFileSync(inputPath, "utf8")) as unknown;
  } catch (error) {
    throw new Error(`Invalid JSON file ${inputPath}: ${errorMessage(error)}`);
  }
}

function withReviewedBalabalaFields(input: unknown, fields: Record<string, unknown>[]): unknown {
  if (!isRecord(input)) return { fields };
  const attach = (value: unknown) => isRecord(value) ? { ...value, fields } : value;
  return {
    ...input,
    fields,
    ...(isRecord(input.product) ? { product: attach(input.product) } : {}),
    ...(isRecord(input.draft) ? { draft: attach(input.draft) } : {}),
    ...(isRecord(input.payload) ? { payload: attach(input.payload) } : {}),
  };
}

function withBalabalaWorkflowMetadata(
  result: CliRunResult,
  action: BalabalaWorkflowAction | string,
): CliRunResult {
  if (!result.stdout) return result;
  try {
    const payload = JSON.parse(result.stdout) as unknown;
    if (!isRecord(payload)) return result;
    return {
      ...result,
      stdout: jsonLine({ workflow: "balabala-listing", action, ...payload }),
    };
  } catch {
    return result;
  }
}

type StatefulBalabalaAction = "import" | "assemble" | "template" | "review" | "plan" | "publish" | "sync" | "readback" | "override";
type StatefulBalabalaStage = "create" | "full-update" | "incremental";

function text(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value).trim();
  return "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

type StatefulBalabalaArgs = {
  action: StatefulBalabalaAction;
  stage?: StatefulBalabalaStage;
  spu: string;
  mode: BalabalaWorkflowMode;
  testConfigPath?: string;
  planHash?: string;
  merchantId: string;
  tenantName?: string;
  workflowRoot: string;
  fields: string[];
  execute: boolean;
  yes: boolean;
  plan: boolean;
  mdmPath?: string;
  launchPlanPath?: string;
  copywritingPath?: string;
  shoeSizeChartPath?: string;
  plmSizeChartPath?: string;
  apparelSizeReferencePath?: string;
  fieldMappingsPath?: string;
  imagesPath?: string;
  aiResponsesPath?: string;
  ocrFactsPath?: string;
  overrideField?: string;
  overrideValue?: string;
};

const statefulBalabalaActions = new Set<StatefulBalabalaAction>(["import", "assemble", "template", "review", "plan", "publish", "sync", "readback", "override"]);
const deepdrawReadIntervalMs = 3_000;

function waitForDeepdrawReadInterval(): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, deepdrawReadIntervalMs));
}

function statefulBalabalaHelpText(): string {
  return [
    "Usage: deepdraw balabala import --mode test|production --spu SPU --mdm SKU.xlsx --launch-plan PLAN.xlsx --copywriting COPY.xlsx [--test-config TARGETS.json] [--shoe-size-chart SIZE.xlsx] [--plm-size-chart PLM.xlsx] [--apparel-size-reference 尺码数据模板.xlsx] [--field-mappings MAPPINGS.json] [--images DIR]",
    "       deepdraw balabala assemble --mode test|production --spu SPU [--test-config TARGETS.json]",
    "       deepdraw balabala template --mode test|production --spu SPU --execute [--test-config TARGETS.json]",
    "       deepdraw balabala review --mode test|production --spu SPU [--test-config TARGETS.json] [--ai-responses AI.json] [--ocr-facts OCR.json]",
    "       deepdraw balabala sync --mode test|production --spu SPU --execute [--test-config TARGETS.json]",
    "       deepdraw balabala override --mode test|production --spu SPU --field FIELD --value VALUE [--test-config TARGETS.json]",
    "       deepdraw balabala plan create|full-update|incremental --mode test|production --spu SPU --execute --plan [--test-config TARGETS.json] [--fields FIELD,...]",
    "       deepdraw balabala publish create|full-update|incremental --mode test|production --spu SPU --execute --yes [--plan-hash HASH] [--test-config TARGETS.json] [--fields FIELD,...]",
    "       deepdraw balabala readback --mode test|production --spu SPU --execute [--test-config TARGETS.json]",
    "",
    "Mode defaults to test. Test mode permits only an exact targetSpu in the built-in or --test-config mapping; sourceSpu is used only for local business data.",
    "Production accepts exactly the formal --spu given in this command. It never appends -test or expands a prefix. Production publish requires the exact --plan-hash returned by plan.",
    "Template, sync, readback and publish use registered dp.* APIs. Every write ends with resource=form readback; HTTP 200/10200 alone is not success.",
  ].join("\n") + "\n";
}

function parseStatefulBalabalaArgs(argv: string[], cwd: string): StatefulBalabalaArgs {
  const action = argv[1] as StatefulBalabalaAction | undefined;
  if (!action || !statefulBalabalaActions.has(action)) throw new Error("unknown stateful balabala action");
  let index = 2;
  let stage: StatefulBalabalaStage | undefined;
  if (action === "plan" || action === "publish") {
    const candidate = argv[index] as StatefulBalabalaStage | undefined;
    if (!candidate || !["create", "full-update", "incremental"].includes(candidate)) throw new Error(`balabala ${action} requires create, full-update, or incremental`);
    stage = candidate;
    index += 1;
  }
  let spu = "";
  let mode: BalabalaWorkflowMode = "test";
  let testConfigPath: string | undefined;
  let planHash: string | undefined;
  let merchantId = "1162";
  let tenantName: string | undefined;
  let workflowRoot = cwd;
  let fields: string[] = [];
  let execute = false;
  let yes = false;
  let plan = false;
  let mdmPath: string | undefined;
  let launchPlanPath: string | undefined;
  let copywritingPath: string | undefined;
  let shoeSizeChartPath: string | undefined;
  let plmSizeChartPath: string | undefined;
  let apparelSizeReferencePath: string | undefined;
  let fieldMappingsPath: string | undefined;
  let imagesPath: string | undefined;
  let aiResponsesPath: string | undefined;
  let ocrFactsPath: string | undefined;
  let overrideField: string | undefined;
  let overrideValue: string | undefined;
  for (; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (!value) throw new Error(`${arg} requires a value`);
      index += 1;
      return value;
    };
    if (arg === "--spu") { spu = next(); continue; }
    if (arg === "--mode") {
      const value = next();
      if (value !== "test" && value !== "production") throw new Error("--mode must be test or production");
      mode = value;
      continue;
    }
    if (arg === "--test-config") { testConfigPath = resolve(cwd, next()); continue; }
    if (arg === "--plan-hash") { planHash = next(); continue; }
    if (arg === "--merchant-id") { merchantId = next(); continue; }
    if (arg === "--tenant") { tenantName = next(); continue; }
    if (arg === "--workflow-root") { workflowRoot = resolve(cwd, next()); continue; }
    if (arg === "--fields") { fields = [...new Set(next().split(",").map((value) => value.trim()).filter(Boolean))]; continue; }
    if (arg === "--mdm") { mdmPath = resolve(cwd, next()); continue; }
    if (arg === "--launch-plan") { launchPlanPath = resolve(cwd, next()); continue; }
    if (arg === "--copywriting") { copywritingPath = resolve(cwd, next()); continue; }
    if (arg === "--shoe-size-chart") { shoeSizeChartPath = resolve(cwd, next()); continue; }
    if (arg === "--plm-size-chart") { plmSizeChartPath = resolve(cwd, next()); continue; }
    if (arg === "--apparel-size-reference") { apparelSizeReferencePath = resolve(cwd, next()); continue; }
    if (arg === "--field-mappings") { fieldMappingsPath = resolve(cwd, next()); continue; }
    if (arg === "--images") { imagesPath = resolve(cwd, next()); continue; }
    if (arg === "--ai-responses") { aiResponsesPath = resolve(cwd, next()); continue; }
    if (arg === "--ocr-facts") { ocrFactsPath = resolve(cwd, next()); continue; }
    if (arg === "--field") { overrideField = next(); continue; }
    if (arg === "--value") { overrideValue = next(); continue; }
    if (arg === "--execute") { execute = true; continue; }
    if (arg === "--yes") { yes = true; continue; }
    if (arg === "--plan") { plan = true; continue; }
    throw new Error(`Unknown balabala option: ${arg}`);
  }
  if (!/^[0-9]{12,}(?:-test)?$/.test(spu)) throw new Error("balabala stateful commands require --spu as a numeric code (optional -test suffix)");
  if (action === "import" && (!mdmPath || !launchPlanPath || !copywritingPath)) throw new Error("balabala import requires --mdm, --launch-plan, and --copywriting");
  if (stage === "incremental" && fields.length === 0) throw new Error("balabala incremental requires --fields");
  if (stage !== "incremental" && fields.length > 0) throw new Error("--fields is only supported by incremental");
  if (action === "plan" && (!execute || !plan)) throw new Error("balabala plan requires --execute --plan");
  if (action === "publish" && (!execute || !yes)) throw new Error("balabala publish requires --execute --yes after a reviewed plan");
  if (action !== "publish" && action !== "readback" && planHash) throw new Error("--plan-hash is only supported by balabala publish or its readback");
  if (mode === "production" && testConfigPath) throw new Error("--test-config is only valid in test mode");
  if (mode === "production" && action === "publish" && !planHash) throw new Error("balabala production publish requires --plan-hash from a reviewed plan");
  if ((aiResponsesPath || ocrFactsPath) && action !== "review") throw new Error("--ai-responses and --ocr-facts are only supported by balabala review");
  if ((overrideField || overrideValue) && action !== "override") throw new Error("--field and --value are only supported by balabala override");
  if (action === "override" && (!overrideField || overrideValue === undefined)) throw new Error("balabala override requires --field and --value");
  return { action, stage, spu, mode, testConfigPath, planHash, merchantId, tenantName, workflowRoot, fields, execute, yes, plan, mdmPath, launchPlanPath, copywritingPath, shoeSizeChartPath, plmSizeChartPath, apparelSizeReferencePath, fieldMappingsPath, imagesPath, aiResponsesPath, ocrFactsPath, overrideField, overrideValue };
}

function resultRecord(stdout: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(stdout) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch { return {}; }
}

function apiRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.filter(isRecord);
  const root = isRecord(data) ? data : {};
  for (const key of ["items", "list", "rows", "trades", "fields", "data", "body"]) {
    if (Array.isArray(root[key])) return root[key].filter(isRecord);
  }
  return [];
}

/**
 * `dp.merchant.trades` returns a tree.  Only a leaf has a submit-ready
 * `tradeId`; passing a parent id to `dp.trade.fields` returns DeepDraw 10404.
 * Preserve the hierarchy as a synthetic path so the Balabala selector can use
 * the same evidence ranking it uses for an already-flat API response.
 */
export function flattenTradeLeaves(data: unknown): Record<string, unknown>[] {
  const leaves: Record<string, unknown>[] = [];
  const visit = (node: Record<string, unknown>, parents: string[]): void => {
    const name = text(node.name ?? node.tradeName ?? node.trade_name ?? node.label);
    const explicitPath = text(node.tradePath ?? node.trade_path ?? node.path);
    // Some tenant responses put only the leaf name in `tradePath`. It is not
    // a full path and would erase the parent evidence needed to distinguish
    // direct child-shoe trades from gender-specific variants.
    const hasFullExplicitPath = explicitPath.includes(">") || parents.length === 0 || explicitPath !== name;
    const path = explicitPath && hasFullExplicitPath ? explicitPath : [...parents, name].filter(Boolean).join(">>");
    const children = Array.isArray(node.children) ? node.children.filter(isRecord) : [];
    if (children.length === 0) {
      const leafNode = { ...node };
      delete leafNode.children;
      leaves.push({ ...leafNode, ...(path ? { tradePath: path } : {}) });
      return;
    }
    for (const child of children) visit(child, path ? [path] : parents);
  };
  for (const row of apiRows(data)) visit(row, []);
  return leaves;
}

function resultMetadata(action: string, spu: string, snapshot: Awaited<ReturnType<BalabalaWorkflowEngine["snapshot"]>>, extra: Record<string, unknown> = {}): CliRunResult {
  const sourceSkus = Array.isArray(snapshot.normalized.skus) ? snapshot.normalized.skus : snapshot.draft.skus;
  return {
    exitCode: snapshot.blocking.length === 0 ? 0 : 1,
    stdout: jsonLine({
      ok: snapshot.blocking.length === 0,
      workflow: "balabala-listing",
      action,
      spu,
      state: snapshot.state,
      templateHash: text(snapshot.template.hash),
      sourceSummary: { sources: snapshot.sources.length, skus: Array.isArray(sourceSkus) ? sourceSkus.length : 0, images: Array.isArray(snapshot.normalized.images) ? snapshot.normalized.images.length : 0 },
      blocking: snapshot.blocking,
      manual: snapshot.manual,
      nextAction: snapshot.blocking.length ? "resolve blocking/manual items, then review" : snapshot.state === "ready" ? "generate an execution plan" : "inspect workflow state",
      ...extra,
    }),
    stderr: "",
  };
}

function productIdFrom(value: unknown): string {
  const root = isRecord(value) ? value : {};
  const direct = text(root.productId ?? root.product_id ?? root.id);
  if (direct) return direct;
  for (const child of Object.values(root)) {
    if (isRecord(child)) {
      const found = productIdFrom(child);
      if (found) return found;
    }
  }
  return "";
}

function resourceFormCode(value: unknown): string {
  const root = record(value);
  return text(root.code ?? record(root.form).code ?? record(root.product).code ?? record(root.data).code);
}

function assertResourceFormTarget(value: unknown, target: BalabalaRemoteTarget): void {
  const returned = resourceFormCode(value);
  if (!returned) throw new Error("resource=form did not return product code; cannot verify the configured remote target");
  if (returned !== target.targetSpu) throw new Error(`resource=form returned ${returned}, not configured targetSpu ${target.targetSpu}`);
}

function workflowPayload(snapshot: Awaited<ReturnType<BalabalaWorkflowEngine["snapshot"]>>, stage: StatefulBalabalaStage) {
  const result = buildProductPayload(snapshot.draft, { stage: stage === "create" ? "create" : "update" });
  if (!result.ok) throw new Error(result.diagnostics.errors.join("；"));
  return result;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function resolveStatefulBalabalaTarget(args: StatefulBalabalaArgs): BalabalaRemoteTarget {
  const testTargets = args.testConfigPath
    ? parseBalabalaTestTargets(JSON.parse(readFileSync(args.testConfigPath, "utf8")) as unknown)
    : DEFAULT_BALABALA_TEST_TARGETS;
  return resolveBalabalaRemoteTarget({
    mode: args.mode,
    userSpecifiedTargetSpu: args.spu,
    ...(args.mode === "test" ? { testTargets } : {}),
  });
}

function remoteOperationContext(target: BalabalaRemoteTarget, planHash?: string, requestId?: string | null) {
  return {
    mode: target.mode,
    sourceSpu: target.sourceSpu,
    targetSpu: target.targetSpu,
    userSpecifiedTargetSpu: target.userSpecifiedTargetSpu,
    ...(planHash ? { planHash } : {}),
    ...(requestId ? { requestId } : {}),
  } as const;
}

function fieldValueFromPayload(body: Record<string, unknown>, name: string): unknown {
  const fields = record(body.fields);
  const found = Object.entries(fields).find(([key]) => key.replace(/[\s()（）:：]/g, "").toLowerCase() === name.replace(/[\s()（）:：]/g, "").toLowerCase());
  return found?.[1];
}

function tableRowCount(value: unknown): number {
  const root = record(value);
  const entries = Object.entries(root).filter(([key]) => key !== "title");
  if (entries.length === 0) return 0;
  return entries.reduce((total, [, item]) => {
    const nested = record(item);
    return total + (Object.keys(nested).length ? Object.keys(nested).length : 1);
  }, 0);
}

function tableSummary(body: Record<string, unknown>): Array<{ field: string; columns: string[]; rows: number }> {
  return Object.entries(record(body.fields))
    .filter(([name]) => name.includes("尺码表") || name === "多平台尺码")
    .map(([field, value]) => ({
      field,
      columns: text(record(value).title).split(/[,，]/).map((item) => item.trim()).filter(Boolean),
      rows: tableRowCount(value),
    }));
}

function writePlanSummary(input: {
  snapshot: Awaited<ReturnType<BalabalaWorkflowEngine["snapshot"]>>;
  target: BalabalaRemoteTarget;
  stage: StatefulBalabalaStage;
  api: string;
  query: Record<string, string>;
  body: Record<string, unknown>;
}): Record<string, unknown> {
  const selectedTrade = record(record(input.snapshot.template).tradeDecision).selected;
  const trade = record(selectedTrade);
  const skuRows = Array.isArray(input.snapshot.draft.skus) ? input.snapshot.draft.skus : [];
  const mainAndPlatformTables = tableSummary(input.body);
  return {
    mode: input.target.mode,
    sourceSpu: input.target.sourceSpu,
    targetSpu: input.target.targetSpu,
    userSpecifiedTargetSpu: input.target.userSpecifiedTargetSpu,
    productId: text(input.query.productId ?? input.snapshot.draft.productId) || null,
    trade: {
      tradeId: text(input.snapshot.draft.tradeId ?? record(input.snapshot.template).tradeId) || null,
      path: text(trade.tradePath ?? trade.path ?? trade.name) || null,
    },
    colors: text(fieldValueFromPayload(input.body, "颜色")),
    saleSizes: text(fieldValueFromPayload(input.body, "尺码")),
    skuCount: skuRows.length,
    sizeTables: mainAndPlatformTables,
    coveringFullUpdateRisk: input.stage === "full-update"
      ? "dp.product.update is covering: omitted fields, colors, SKUs, sales sizes or platform size tables can be erased."
      : null,
  };
}

function planHashFor(input: {
  target: BalabalaRemoteTarget;
  stage: StatefulBalabalaStage;
  api: string;
  query: Record<string, string>;
  body: Record<string, unknown>;
}): string {
  return createHash("sha256").update(canonicalJson({
    mode: input.target.mode,
    sourceSpu: input.target.sourceSpu,
    targetSpu: input.target.targetSpu,
    userSpecifiedTargetSpu: input.target.userSpecifiedTargetSpu,
    stage: input.stage,
    api: input.api,
    query: input.query,
    body: input.body,
  })).digest("hex");
}

async function runStatefulBalabala(argv: string[], options: CliRunOptions, cwd: string): Promise<CliRunResult> {
  let args: StatefulBalabalaArgs;
  try { args = parseStatefulBalabalaArgs(argv, cwd); } catch (error) { return { exitCode: 1, stdout: "", stderr: `${errorMessage(error)}\n` }; }
  // This is intentionally the first action after argument parsing.  It runs
  // before the workflow store, credentials, SDK bridge and every dp.* request.
  // A suffix alone never grants test access, and production never rewrites the
  // explicitly supplied target code.
  let target: BalabalaRemoteTarget;
  try { target = resolveStatefulBalabalaTarget(args); } catch (error) { return { exitCode: 1, stdout: "", stderr: `${errorMessage(error)}\n` }; }
  if (target.mode === "test" && args.action === "publish" && args.stage === "create") {
    return { exitCode: 1, stdout: "", stderr: "balabala test mode cannot create a target archive; sync the configured existing -test archive and use full-update or incremental instead\n" };
  }
  const store = WorkflowStore.open("balabala", target.targetSpu, args.workflowRoot);
  const engine = new BalabalaWorkflowEngine(store);
  if (args.action === "import") {
    try {
      const imported = await importBalabalaSources({ spu: target.targetSpu, sourceSpu: target.sourceSpu, mdmPath: args.mdmPath!, launchPlanPath: args.launchPlanPath!, copywritingPath: args.copywritingPath!, ...(args.shoeSizeChartPath ? { shoeSizeChartPath: args.shoeSizeChartPath } : {}), ...(args.plmSizeChartPath ? { plmSizeChartPath: args.plmSizeChartPath } : {}), ...(args.apparelSizeReferencePath ? { apparelSizeReferencePath: args.apparelSizeReferencePath } : {}), ...(args.fieldMappingsPath ? { fieldMappingsPath: args.fieldMappingsPath } : {}), ...(args.imagesPath ? { imagesPath: args.imagesPath } : {}) });
      const snapshot = await engine.importNormalized(imported, imported.sources);
      return resultMetadata("import", target.targetSpu, snapshot, remoteOperationContext(target));
    } catch (error) { return { exitCode: 1, stdout: "", stderr: `${errorMessage(error)}\n` }; }
  }
  if (args.action === "assemble") {
    try { return resultMetadata("assemble", target.targetSpu, await engine.assemble(), remoteOperationContext(target)); } catch (error) { return { exitCode: 1, stdout: "", stderr: `${errorMessage(error)}\n` }; }
  }
  if (args.action === "template") {
    if (!args.execute) return { exitCode: 0, stdout: jsonLine({ ok: true, workflow: "balabala-listing", action: "template", spu: target.targetSpu, dryRun: true, apis: ["dp.merchant.trades", "dp.trade.fields"], ...remoteOperationContext(target) }), stderr: "" };
    const apiOptions: CliRunOptions = { ...options, tenantName: args.tenantName, env: { ...options.env, ...(args.tenantName ? { DEEPDRAW_TENANT_NAME: args.tenantName } : {}), DEEPDRAW_MERCHANT_ID: args.merchantId } };
    const tradesResult = await runCli(["call", "dp.merchant.trades", "--execute", "--param", `merchantId=${args.merchantId}`], apiOptions);
    if (tradesResult.exitCode !== 0) return withBalabalaWorkflowMetadata(tradesResult, "template");
    try {
      const tradeRequestId = text(resultRecord(tradesResult.stdout).requestId) || null;
      await store.recordExecution({ operation: "template-trades-read", status: "verified", api: "dp.merchant.trades", requestId: tradeRequestId, details: { ...remoteOperationContext(target, undefined, tradeRequestId) } });
      const snapshot = await engine.snapshot();
      const trades = flattenTradeLeaves(resultRecord(tradesResult.stdout).data);
      const decision = selectBalabalaTrade(snapshot.normalized, trades);
      if (decision.manualSelectionRequired || !decision.selected) return resultMetadata("template", target.targetSpu, await engine.syncTemplate(trades, []), remoteOperationContext(target));
      await waitForDeepdrawReadInterval();
      const fieldsResult = await runCli(["call", "dp.trade.fields", "--execute", "--param", `merchantId=${args.merchantId}`, "--param", `tradeId=${decision.selected.tradeId}`], apiOptions);
      if (fieldsResult.exitCode !== 0) return withBalabalaWorkflowMetadata(fieldsResult, "template");
      const fields = apiRows(resultRecord(fieldsResult.stdout).data);
      const synced = await engine.syncTemplate(trades, fields);
      const requestId = text(resultRecord(fieldsResult.stdout).requestId) || null;
      await store.recordExecution({ operation: "template-sync", status: "verified", api: "dp.trade.fields", requestId, details: { ...remoteOperationContext(target, undefined, requestId), tradeId: decision.selected.tradeId, fieldCount: fields.length } });
      return resultMetadata("template", target.targetSpu, synced, remoteOperationContext(target, undefined, requestId));
    } catch (error) { return { exitCode: 1, stdout: "", stderr: `${errorMessage(error)}\n` }; }
  }
  if (args.action === "review") {
    try {
      if (args.aiResponsesPath) {
        const payload = JSON.parse(readFileSync(args.aiResponsesPath, "utf8")) as unknown;
        if (!Array.isArray(payload)) throw new Error("--ai-responses must contain a JSON array");
        await engine.auditAi(payload);
      }
      if (args.ocrFactsPath) {
        const payload = JSON.parse(readFileSync(args.ocrFactsPath, "utf8")) as unknown;
        if (!Array.isArray(payload)) throw new Error("--ocr-facts must contain a JSON array");
        await engine.auditOcr(payload);
      }
      return resultMetadata("review", target.targetSpu, await engine.snapshot(), remoteOperationContext(target));
    } catch (error) { return { exitCode: 1, stdout: "", stderr: `${errorMessage(error)}\n` }; }
  }
  if (args.action === "sync") {
    if (!args.execute) return { exitCode: 0, stdout: jsonLine({ ok: true, workflow: "balabala-listing", action: "sync", spu: target.targetSpu, dryRun: true, api: "dp.product.resource", ...remoteOperationContext(target) }), stderr: "" };
    try {
      const resource = await runCli(["call", "dp.product.resource", "--execute", "--param", `merchantId=${args.merchantId}`, "--param", `productCode=${target.targetSpu}`, "--param", "resource=form"], { ...options, tenantName: args.tenantName, env: { ...options.env, ...(args.tenantName ? { DEEPDRAW_TENANT_NAME: args.tenantName } : {}), DEEPDRAW_MERCHANT_ID: args.merchantId } });
      if (resource.exitCode !== 0) return withBalabalaWorkflowMetadata(resource, "sync");
      const result = resultRecord(resource.stdout);
      assertResourceFormTarget(result.data, target);
      const requestId = text(result.requestId) || null;
      const context = remoteOperationContext(target, undefined, requestId);
      const synced = await engine.syncRemote(record(result.data), context);
      await store.recordExecution({ operation: "resource-form-sync", status: "verified", api: "dp.product.resource", requestId, details: { ...context, productId: text(synced.draft.productId), fieldCount: Array.isArray(synced.draft.fields) ? synced.draft.fields.length : 0, readbackStatus: "synced" } });
      return resultMetadata("sync", target.targetSpu, synced, { ...context, provider: { httpStatus: result.httpStatus, businessCode: result.businessCode }, productId: text(synced.draft.productId), fieldCount: Array.isArray(synced.draft.fields) ? synced.draft.fields.length : 0 });
    } catch (error) { return { exitCode: 1, stdout: "", stderr: `${errorMessage(error)}\n` }; }
  }
  if (args.action === "override") {
    try { return resultMetadata("override", target.targetSpu, await engine.overrideDraftField(args.overrideField!, args.overrideValue!), remoteOperationContext(target)); } catch (error) { return { exitCode: 1, stdout: "", stderr: `${errorMessage(error)}\n` }; }
  }
  if (args.action === "readback") {
    if (!args.execute) return { exitCode: 0, stdout: jsonLine({ ok: true, workflow: "balabala-listing", action: "readback", spu: target.targetSpu, dryRun: true, api: "dp.product.resource", ...remoteOperationContext(target, args.planHash) }), stderr: "" };
    try {
      const snapshot = await engine.snapshot();
      const productId = text(snapshot.draft.productId);
      const resourceId = text(snapshot.draft.resourceId ?? snapshot.normalized.resourceId);
      const resource = await runCli(["call", "dp.product.resource", "--execute", "--param", `merchantId=${args.merchantId}`, "--param", resourceId ? `productId=${resourceId}` : `productCode=${target.targetSpu}`, "--param", "resource=form"], { ...options, tenantName: args.tenantName, env: { ...options.env, ...(args.tenantName ? { DEEPDRAW_TENANT_NAME: args.tenantName } : {}), DEEPDRAW_MERCHANT_ID: args.merchantId } });
      if (resource.exitCode !== 0) return withBalabalaWorkflowMetadata(resource, "readback");
      const result = resultRecord(resource.stdout);
      assertResourceFormTarget(result.data, target);
      const productIdFromReadback = productIdFrom(result.data);
      const saved = await engine.replace({ ...(await engine.snapshot()), draft: { ...snapshot.draft, ...(productIdFromReadback ? { productId: productIdFromReadback } : {}) } });
      const requestId = text(result.requestId) || null;
      const context = remoteOperationContext(target, args.planHash, requestId);
      const compared = await engine.compareReadback(record(result.data), context);
      await store.recordExecution({ operation: "resource-form-readback", status: compared.state === "readback_verified" ? "verified" : compared.state === "needs_ui_verification" ? "unknown" : "failed", api: "dp.product.resource", requestId, details: { ...context, productId: text(saved.draft.productId) || null, readbackStatus: compared.state } });
      return resultMetadata("readback", target.targetSpu, compared, { ...context, provider: { httpStatus: result.httpStatus, businessCode: result.businessCode }, productId: text(saved.draft.productId) || undefined, readbackStatus: compared.state });
    } catch (error) { return { exitCode: 1, stdout: "", stderr: `${errorMessage(error)}\n` }; }
  }
  try {
    let snapshot = await engine.snapshot();
    const stage = args.stage!;
    const apiName = stage === "create" ? "dp.product.create" : stage === "full-update" ? "dp.product.update" : "dp.product.incremental.update";
    let query: Record<string, string>;
    let body: Record<string, unknown>;
    if (stage === "incremental") {
      body = await engine.buildIncremental(args.fields);
      query = { productId: text(snapshot.draft.productId) };
    } else {
      if (stage === "full-update" && text(snapshot.draft.productId) === "") throw new Error("full-update requires a productId from resource=form readback or create response");
      const payload = workflowPayload(snapshot, stage);
      body = payload.sdkInput.product;
      query = stage === "create" ? payload.sdkInput.query : { productId: text(snapshot.draft.productId) };
    }
    if (!Object.values(query).every(Boolean)) throw new Error(`${stage} lacks required DeepDraw identifier`);
    // A covering update must be planned from the merged remote snapshot, not
    // from a stale local approximation. This is still a read-only operation.
    if (stage === "full-update") {
      const resourceId = text(snapshot.draft.resourceId ?? snapshot.normalized.resourceId);
      const preRead = await runCli(["call", "dp.product.resource", "--execute", "--param", `merchantId=${args.merchantId}`, "--param", resourceId ? `productId=${resourceId}` : `productCode=${target.targetSpu}`, "--param", "resource=form"], { ...options, tenantName: args.tenantName, env: { ...options.env, ...(args.tenantName ? { DEEPDRAW_TENANT_NAME: args.tenantName } : {}), DEEPDRAW_MERCHANT_ID: args.merchantId } });
      if (preRead.exitCode !== 0) return withBalabalaWorkflowMetadata(preRead, args.action === "plan" ? "plan" : "publish");
      const preReadPayload = resultRecord(preRead.stdout);
      assertResourceFormTarget(preReadPayload.data, target);
      const preReadRequestId = text(preReadPayload.requestId) || null;
      await store.recordExecution({ operation: "full-update-pre-read", status: "verified", api: "dp.product.resource", requestId: preReadRequestId, details: { ...remoteOperationContext(target, undefined, preReadRequestId), productId: text(snapshot.draft.productId) || null } });
      const prepared = await engine.prepareExistingUpdate(record(preReadPayload.data));
      if (prepared.blocking.length) return resultMetadata(args.action === "plan" ? "plan" : "publish", target.targetSpu, await engine.snapshot(), { ...remoteOperationContext(target), stage });
      snapshot = await engine.snapshot();
      body = workflowPayload(snapshot, stage).sdkInput.product;
      query = { productId: text(snapshot.draft.productId) };
    }
    const planHash = planHashFor({ target, stage, api: apiName, query, body });
    const summary = writePlanSummary({ snapshot, target, stage, api: apiName, query, body });
    if (args.action === "plan") {
      const command = ["call", apiName, "--execute", "--plan", ...Object.entries(query).flatMap(([key, value]) => ["--param", `${key}=${value}`]), "--json", JSON.stringify(body)];
      const planned = await runCli(command, { ...options, tenantName: args.tenantName, env: { ...options.env, ...(args.tenantName ? { DEEPDRAW_TENANT_NAME: args.tenantName } : {}), DEEPDRAW_MERCHANT_ID: args.merchantId } });
      const payload = resultRecord(planned.stdout);
      const providerPlan = record(payload.plan);
      const workflowPlan = { ...providerPlan, planHash, stage, api: apiName, ...summary };
      await store.recordExecution({ operation: `${stage}-plan`, status: "planned", api: apiName, inputHash: planHash, details: { ...remoteOperationContext(target, planHash), ...summary, fields: stage === "incremental" ? Object.keys(body.fields as Record<string, unknown>) : undefined } });
      snapshot = await engine.replace({ ...snapshot, state: "planned", plans: [...snapshot.plans, workflowPlan] });
      return { ...planned, stdout: jsonLine({ workflow: "balabala-listing", action: "plan", stage, spu: target.targetSpu, state: snapshot.state, ...remoteOperationContext(target, planHash), ...payload, plan: workflowPlan }) };
    }
    if (args.mode === "production") {
      const reviewed = snapshot.plans.some((plan) => text(plan.planHash) === args.planHash
        && text(plan.stage) === stage
        && text(plan.targetSpu) === target.targetSpu
        && text(plan.api) === apiName);
      if (!reviewed) throw new Error("balabala production publish requires a matching reviewed plan in this workflow state");
      if (args.planHash !== planHash) throw new Error("balabala production publish plan hash does not match the current payload; generate and review a new plan");
    }
    // Incremental writes do not otherwise need a full merge.  Still verify the
    // saved numeric productId resolves to this exact configured code before
    // sending a write, so a stale or manually edited workflow cannot target a
    // neighbouring test archive (or a different formal product).
    if (stage === "incremental") {
      const resourceId = text(snapshot.draft.resourceId ?? snapshot.normalized.resourceId);
      const verify = await runCli(["call", "dp.product.resource", "--execute", "--param", `merchantId=${args.merchantId}`, "--param", resourceId ? `productId=${resourceId}` : `productCode=${target.targetSpu}`, "--param", "resource=form"], { ...options, tenantName: args.tenantName, env: { ...options.env, ...(args.tenantName ? { DEEPDRAW_TENANT_NAME: args.tenantName } : {}), DEEPDRAW_MERCHANT_ID: args.merchantId } });
      if (verify.exitCode !== 0) return withBalabalaWorkflowMetadata(verify, "publish");
      const verifyPayload = resultRecord(verify.stdout);
      assertResourceFormTarget(verifyPayload.data, target);
      const returnedProductId = productIdFrom(verifyPayload.data);
      if (returnedProductId && returnedProductId !== query.productId) throw new Error(`resource=form returned productId ${returnedProductId}, not planned ${query.productId}`);
      const verifyRequestId = text(verifyPayload.requestId) || null;
      await store.recordExecution({ operation: "incremental-target-verify", status: "verified", api: "dp.product.resource", requestId: verifyRequestId, details: { ...remoteOperationContext(target, planHash, verifyRequestId), productId: query.productId } });
    }
    const command = ["call", apiName, "--execute", "--yes", ...Object.entries(query).flatMap(([key, value]) => ["--param", `${key}=${value}`]), "--json", JSON.stringify(body)];
    const write = await runCli(command, { ...options, tenantName: args.tenantName, env: { ...options.env, ...(args.tenantName ? { DEEPDRAW_TENANT_NAME: args.tenantName } : {}), DEEPDRAW_MERCHANT_ID: args.merchantId } });
    const writePayload = resultRecord(write.stdout);
    const writeRequestId = text(writePayload.requestId) || null;
    await store.recordExecution({ operation: stage, status: write.exitCode === 0 ? "in_progress" : "failed", api: apiName, requestId: writeRequestId, inputHash: planHash, details: { ...remoteOperationContext(target, planHash, writeRequestId), ...summary } });
    if (write.exitCode !== 0) return withBalabalaWorkflowMetadata(write, "publish");
    if (stage === "create") {
      const productId = productIdFrom(writePayload.data);
      if (!productId) return { exitCode: 1, stdout: jsonLine({ ok: false, workflow: "balabala-listing", action: "publish", stage, spu: target.targetSpu, state: "transport_unknown", ...remoteOperationContext(target, planHash, writeRequestId), message: "create accepted but productId is absent; query resource before retrying" }), stderr: "" };
      snapshot = await engine.replace({ ...snapshot, state: "post_create_update", draft: { ...snapshot.draft, productId } });
      if (args.mode === "test") {
        const full = await runCli(["balabala", "publish", "full-update", "--mode", "test", "--spu", target.targetSpu, "--merchant-id", args.merchantId, ...(args.testConfigPath ? ["--test-config", args.testConfigPath] : []), ...(args.tenantName ? ["--tenant", args.tenantName] : []), "--workflow-root", args.workflowRoot, "--execute", "--yes"], options);
        return { ...full, stdout: jsonLine({ workflow: "balabala-listing", action: "publish", stage, spu: target.targetSpu, ...remoteOperationContext(target, planHash, writeRequestId), write: { requestId: writePayload.requestId, data: writePayload.data }, postCreateFullUpdate: resultRecord(full.stdout) }) };
      }
      await waitForDeepdrawReadInterval();
      const read = await runCli(["balabala", "readback", "--mode", "production", "--spu", target.targetSpu, "--merchant-id", args.merchantId, ...(args.tenantName ? ["--tenant", args.tenantName] : []), "--workflow-root", args.workflowRoot, "--plan-hash", planHash, "--execute"], options);
      return { ...read, stdout: jsonLine({ workflow: "balabala-listing", action: "publish", stage, spu: target.targetSpu, ...remoteOperationContext(target, planHash, writeRequestId), write: { requestId: writePayload.requestId, data: writePayload.data }, readback: resultRecord(read.stdout), nextAction: "review and run a separately planned full-update before declaring the created product complete" }) };
    }
    await waitForDeepdrawReadInterval();
    const read = await runCli(["balabala", "readback", "--mode", args.mode, "--spu", target.targetSpu, "--merchant-id", args.merchantId, ...(args.testConfigPath ? ["--test-config", args.testConfigPath] : []), ...(args.tenantName ? ["--tenant", args.tenantName] : []), "--workflow-root", args.workflowRoot, "--plan-hash", planHash, "--execute"], options);
    return { ...read, stdout: jsonLine({ workflow: "balabala-listing", action: "publish", stage, spu: target.targetSpu, ...remoteOperationContext(target, planHash, writeRequestId), write: { requestId: writePayload.requestId, data: writePayload.data }, readback: resultRecord(read.stdout) }) };
  } catch (error) { return { exitCode: 1, stdout: "", stderr: `${errorMessage(error)}\n` }; }
}

function redactSemanticCommandArgv(argv: string[]): string[] {
  const redactedArgv: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    redactedArgv.push(arg);
    if (arg === "--param") {
      const pair = argv[index + 1];
      if (pair?.includes("=")) {
        const separator = pair.indexOf("=");
        const key = pair.slice(0, separator);
        const value = pair.slice(separator + 1);
        const redactedParam = redactSensitive({ [key]: value }) as Record<string, unknown>;
        redactedArgv.push(`${key}=${String(redactedParam[key])}`);
        index += 1;
      }
    }
  }
  return redactedArgv;
}

function buildSemanticPlanParams(argv: string[], args: ReturnType<typeof parseSemanticArgs>): Record<string, unknown> {
  const params: Record<string, unknown> = { command: redactSemanticCommandArgv(argv).join(" ") };
  if (args.input !== undefined) {
    params.input = args.input;
  }
  if (Object.keys(args.params).length > 0) {
    params.params = args.params;
  }
  return params;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function runCli(argv: string[], options: CliRunOptions): Promise<CliRunResult> {
  const cwd = options.cwd ?? process.cwd();
  if (argv[0] === "product" && argv[1] === "payload") {
    if (argv.includes("--help")) {
      return { exitCode: 0, stdout: productPayloadHelpText(), stderr: "" };
    }

    let payloadArgs: ReturnType<typeof parseProductPayloadArgs>;
    try {
      payloadArgs = parseProductPayloadArgs(argv);
    } catch (error) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: `${errorMessage(error)}\n`,
      };
    }

    let input: unknown = payloadArgs.json;
    if (payloadArgs.input) {
      const inputPath = resolve(cwd, payloadArgs.input);
      try {
        input = JSON.parse(readFileSync(inputPath, "utf8")) as unknown;
      } catch (error) {
        return {
          exitCode: 1,
          stdout: "",
          stderr: `Invalid JSON file ${inputPath}: ${errorMessage(error)}\n`,
        };
      }
    }

    try {
      const result = buildProductPayload(input, {
        stage: payloadArgs.stage,
        tenantName: payloadArgs.tenantName,
        merchantId: payloadArgs.merchantId,
      });
      return {
        exitCode: result.ok ? 0 : 1,
        stdout: jsonLine(result, payloadArgs.pretty),
        stderr: "",
      };
    } catch (error) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: `${errorMessage(error)}\n`,
      };
    }
  }

  const statefulBalabalaInvocation = argv[0] === "balabala" && statefulBalabalaActions.has(argv[1] as StatefulBalabalaAction) && argv.includes("--spu");
  if (argv[0] === "balabala" && (statefulBalabalaInvocation || (argv[1] === "--help" && argv.length === 2))) {
    if (argv[1] === "--help") return { exitCode: 0, stdout: `${statefulBalabalaHelpText()}\n${balabalaWorkflowHelpText()}`, stderr: "" };
    return runStatefulBalabala(argv, options, cwd);
  }

  if (argv[0] === "balabala") {
    if (argv.includes("--help")) {
      return { exitCode: 0, stdout: balabalaWorkflowHelpText(), stderr: "" };
    }

    let workflowArgs: BalabalaWorkflowArgs;
    try {
      workflowArgs = parseBalabalaWorkflowArgs(argv);
    } catch (error) {
      return { exitCode: 1, stdout: "", stderr: `${errorMessage(error)}\n` };
    }

    if (legacyBalabalaRemoteCommandDisabled(workflowArgs.action)) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: "Remote balabala compatibility commands are disabled; use the stateful balabala flow with --mode and an explicit --spu.\n",
      };
    }

    const query: Record<string, string> = {
      merchantId: workflowArgs.merchantId,
      ...(workflowArgs.productCode ? { productCode: workflowArgs.productCode } : {}),
      ...(workflowArgs.productId ? { productId: workflowArgs.productId } : {}),
      resource: workflowArgs.resource,
    };
    if (workflowArgs.action === "query") {
      if (!workflowArgs.execute) {
        return {
          exitCode: 0,
          stdout: jsonLine({
            ok: true,
            workflow: "balabala-listing",
            action: "query",
            api: "dp.product.resource",
            dryRun: true,
            query,
          }),
          stderr: "",
        };
      }
      const callArgv = [
        "call",
        "dp.product.resource",
        "--execute",
        "--param",
        `merchantId=${workflowArgs.merchantId}`,
        ...(workflowArgs.productCode ? ["--param", `productCode=${workflowArgs.productCode}`] : []),
        ...(workflowArgs.productId ? ["--param", `productId=${workflowArgs.productId}`] : []),
        "--param",
        `resource=${workflowArgs.resource}`,
      ];
      const result = await runCli(callArgv, {
        ...options,
        tenantName: workflowArgs.tenantName,
        env: {
          ...options.env,
          ...(workflowArgs.tenantName ? { DEEPDRAW_TENANT_NAME: workflowArgs.tenantName } : {}),
          DEEPDRAW_MERCHANT_ID: workflowArgs.merchantId,
        },
      });
      return withBalabalaWorkflowMetadata(result, workflowArgs.action);
    }

    let workflowInput: unknown;
    try {
      workflowInput = readWorkflowInput(workflowArgs, cwd);
    } catch (error) {
      return { exitCode: 1, stdout: "", stderr: `${errorMessage(error)}\n` };
    }
    const review = reviewBalabalaFields(workflowInput);
    if (workflowArgs.action === "review") {
      return {
        exitCode: review.ok ? 0 : 1,
        stdout: jsonLine({ workflow: "balabala-listing", action: "review", ...review }),
        stderr: "",
      };
    }
    if (!review.ok) {
      return {
        exitCode: 1,
        stdout: jsonLine({
          ok: false,
          workflow: "balabala-listing",
          action: workflowArgs.action,
          review,
          diagnostics: review.diagnostics,
        }),
        stderr: "",
      };
    }

    let assembled;
    try {
      assembled = buildProductPayload(withReviewedBalabalaFields(workflowInput, review.submissionFields), {
        stage: workflowArgs.action === "create" ? "create" : "update",
        tenantName: workflowArgs.tenantName,
        merchantId: workflowArgs.merchantId,
        allowedFieldNames: review.activeTemplateFieldNames,
      });
    } catch (error) {
      return { exitCode: 1, stdout: "", stderr: `${errorMessage(error)}\n` };
    }
    if (!assembled.ok) {
      return {
        exitCode: 1,
        stdout: jsonLine({
          ok: false,
          workflow: "balabala-listing",
          action: workflowArgs.action,
          diagnostics: assembled.diagnostics,
        }),
        stderr: "",
      };
    }

    const apiName = workflowArgs.action === "create"
      ? "dp.product.create"
      : workflowArgs.action === "full-update"
        ? "dp.product.update"
        : "dp.product.incremental.update";
    const writeQuery = workflowArgs.action === "create"
      ? assembled.sdkInput.query
      : { productId: assembled.query.productId };
    const incremental = workflowArgs.action === "incremental"
      ? balabalaIncrementalProduct(assembled.sdkInput.product, workflowArgs.incrementalFields)
      : undefined;
    if (incremental?.error) return { exitCode: 1, stdout: "", stderr: `${incremental.error}\n` };
    const writeProduct = incremental?.product ?? assembled.sdkInput.product;
    const writeArgv = [
      "call",
      apiName,
      ...(workflowArgs.execute ? ["--execute"] : []),
      ...(workflowArgs.yes ? ["--yes"] : []),
      ...(workflowArgs.plan ? ["--plan"] : []),
      ...Object.entries(writeQuery).flatMap(([key, value]) => value ? ["--param", `${key}=${value}`] : []),
      "--json",
      JSON.stringify(writeProduct),
    ];
    const result = await runCli(writeArgv, {
      ...options,
      tenantName: workflowArgs.tenantName,
      env: {
        ...options.env,
        DEEPDRAW_TENANT_NAME: assembled.tenant,
        DEEPDRAW_MERCHANT_ID: assembled.merchantId,
      },
    });
    return withBalabalaWorkflowMetadata(result, workflowArgs.action);
  }

  if (argv[0] === "call") {
    const apiName = argv[1];
    if (!apiName || apiName === "--help") {
      return {
        exitCode: 0,
        stdout: "Usage: deepdraw call <api-name> [--dry-run] [--execute] [--yes] [--plan] [--param key=value] [--json JSON] [--json-file file]\n",
        stderr: "",
      };
    }
    const api = findApiDefinition(apiName);
    if (!api) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: `Unknown DeepDraw API: ${apiName}\n`,
      };
    }
    let callArgs: ReturnType<typeof parseCallArgs>;
    try {
      callArgs = parseCallArgs(argv, cwd);
    } catch (error) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: `${errorMessage(error)}\n`,
      };
    }
    if (callArgs.execute) {
      const approval = enforceApproval({
        apiName: api.apiName,
        argv: argv.slice(2),
        interactive: false,
      });
      if (!approval.allowed) {
        const plan = createExecutionPlan({
          apiName: api.apiName,
          tenant: options.env.DEEPDRAW_TENANT_NAME ?? "unconfigured",
          params: buildPlanParams(callArgs),
        });
        return {
          exitCode: 1,
          stdout: JSON.stringify({
            ok: false,
            error: {
              kind: "approval_required",
              message: "User approval is required",
              reason: approval.reason,
            },
            plan,
          }) + "\n",
          stderr: "",
        };
      }
      try {
        const credentialStore = options.credentialStore ?? new FileCredentialStore(defaultCredentialPath(options));
        const config = await resolveDeepdrawConfig({
          env: options.env,
          cwd,
          platform: options.platform,
          homeDir: options.homeDir,
          configPath: options.configPath,
          tenantName: options.tenantName,
          credentialStore,
        });
        const query = withConfigDefaults(api, callArgs.query, config);
        validateRequiredParams(api, query, callArgs.body);
        const result = api.transport === "java-sdk"
          ? await callJavaSdkApi({
            config,
            apiName: api.apiName,
            query,
            body: callArgs.body,
            env: options.env,
            cwd,
            spawnImpl: options.javaSpawnImpl,
            retryOptions: options.deepdrawBusyRetryOptions,
            retrySleep: options.deepdrawBusyRetrySleep,
            retryRandom: options.deepdrawBusyRetryRandom,
          })
          : await callDeepdrawApi({
            config,
            apiName: api.apiName,
            query,
            body: callArgs.body,
            fetchImpl: options.fetchImpl,
            retryOptions: options.deepdrawBusyRetryOptions,
            retrySleep: options.deepdrawBusyRetrySleep,
            retryRandom: options.deepdrawBusyRetryRandom,
          });
        return {
          exitCode: result.ok ? 0 : 1,
          stdout: JSON.stringify(result) + "\n",
          stderr: "",
        };
      } catch (error) {
        return {
          exitCode: 1,
          stdout: "",
          stderr: `${errorMessage(error)}\n`,
        };
      }
    }

    return {
      exitCode: 0,
      stdout: JSON.stringify({ ok: true, api: api.apiName, dryRun: true, callSyntax: api.callSyntax }) + "\n",
      stderr: "",
    };
  }

  if (argv[0] === "product" && argv[1] === "content") {
    let contentArgs: ReturnType<typeof parseProductContentArgs>;
    try {
      contentArgs = parseProductContentArgs(argv);
    } catch (error) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: `${errorMessage(error)}\n`,
      };
    }

    if (!contentArgs.execute) {
      return {
        exitCode: 0,
        stdout: jsonLine({
          ok: true,
          api: "dp.product.resource",
          command: "deepdraw product content",
          dryRun: true,
          query: contentArgs.query,
          output: {
            summary: contentArgs.summary,
            assets: contentArgs.assets,
          },
        }),
        stderr: "",
      };
    }

    try {
      const credentialStore = options.credentialStore ?? new FileCredentialStore(defaultCredentialPath(options));
      const config = await resolveDeepdrawConfig({
        env: options.env,
        cwd,
        platform: options.platform,
        homeDir: options.homeDir,
          configPath: options.configPath,
          tenantName: options.tenantName,
          credentialStore,
      });
      const result = await callJavaSdkApi({
        config,
        apiName: "dp.product.resource",
        query: contentArgs.query,
        env: options.env,
        cwd,
        spawnImpl: options.javaSpawnImpl,
        retryOptions: options.deepdrawBusyRetryOptions,
        retrySleep: options.deepdrawBusyRetrySleep,
        retryRandom: options.deepdrawBusyRetryRandom,
      });
      if (!result.ok) {
        return {
          exitCode: 1,
          stdout: jsonLine({
            ok: false,
            api: result.api,
            command: "deepdraw product content",
            tenant: result.tenant,
            requestId: result.requestId,
            httpStatus: result.httpStatus,
            businessCode: result.businessCode,
            businessState: result.businessState,
            ...(result.retry ? { retry: result.retry } : {}),
            data: result.data,
          }),
          stderr: "",
        };
      }

      const content = extractDeepdrawProductContent(result.data);
      return {
        exitCode: 0,
        stdout: jsonLine({
          ok: true,
          api: result.api,
          command: "deepdraw product content",
          tenant: result.tenant,
          requestId: result.requestId,
          httpStatus: result.httpStatus,
          businessCode: result.businessCode,
          businessState: result.businessState,
          ...(result.retry ? { retry: result.retry } : {}),
          ...(contentArgs.summary ? { summary: content.summary, skus: content.skus } : {}),
          ...(contentArgs.assets ? { assets: content.assets } : {}),
        }),
        stderr: "",
      };
    } catch (error) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: `${errorMessage(error)}\n`,
      };
    }
  }

  const semanticApi = findSemanticApi(argv);
  if (semanticApi) {
    let semanticArgs: ReturnType<typeof parseSemanticArgs>;
    try {
      semanticArgs = parseSemanticArgs(argv);
    } catch (error) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: `${errorMessage(error)}\n`,
      };
    }

    const approval = enforceApproval({
      apiName: semanticApi.apiName,
      argv: argv.slice(2),
      interactive: false,
    });
    if (!approval.allowed) {
      const plan = createExecutionPlan({
        apiName: semanticApi.apiName,
        tenant: options.env.DEEPDRAW_TENANT_NAME ?? "unconfigured",
        params: buildSemanticPlanParams(argv, semanticArgs),
      });
      return {
        exitCode: 1,
        stdout: jsonLine({
          ok: false,
          error: {
            kind: "approval_required",
            message: "User approval is required",
            reason: approval.reason,
          },
          plan,
        }),
        stderr: "",
      };
    }

    return {
      exitCode: 0,
      stdout: jsonLine({ ok: true, api: semanticApi.apiName, dryRun: true }),
      stderr: "",
    };
  }

  if (argv[0] === "auth" && argv[1] === "login" && argv[2] === "--stdin-json") {
    if (argv.length > 3) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: `Unknown auth login option: ${argv[3]}\n`,
      };
    }

    let credentialsInput: Record<string, unknown>;
    try {
      const parsedInput = JSON.parse(options.stdin) as unknown;
      if (!isRecord(parsedInput)) {
        return {
          exitCode: 1,
          stdout: "",
          stderr: "Expected auth input JSON object\n",
        };
      }
      credentialsInput = parsedInput;
    } catch (error) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: `Invalid JSON from stdin: ${errorMessage(error)}\n`,
      };
    }

    try {
      const login = validateAuthLoginInput(credentialsInput);
      const configPath = options.configPath
        ?? configPathForPlatform(options.platform ?? process.platform, options.homeDir ?? process.env.HOME ?? "", options.env);
      const credentialStore = options.credentialStore ?? new FileCredentialStore(defaultCredentialPath({ ...options, configPath }));
      const refs = credentialRefs(login.tenantName);
      await credentialStore.set(refs.appKeyRef, login.appKey);
      await credentialStore.set(refs.appSecretRef, login.appSecret);
      await credentialStore.set(refs.dopKeyRef, login.dopKey);
      await writeTenantConfig(configPath, login, refs);
      return {
        exitCode: 0,
        stdout: jsonLine({
          ok: true,
          tenant: login.tenantName,
          defaultTenant: Boolean(login.defaultTenant),
          configPath,
          credentials: redactSensitive({
            appKey: login.appKey,
            appSecret: login.appSecret,
            dopKey: login.dopKey,
          }),
        }),
        stderr: "",
      };
    } catch (error) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: `${errorMessage(error)}\n`,
      };
    }
  }

  if (argv[0] === "config" && argv[1] === "doctor" && argv[2] === "--dry-run") {
    if (argv.length > 3) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: `Unknown config doctor option: ${argv[3]}\n`,
      };
    }

    const checks = await configDoctorChecks({
      cwd: options.cwd ?? process.cwd(),
      env: options.env,
      spawnImpl: options.javaSpawnImpl,
    });

    return {
      exitCode: 0,
      stdout: jsonLine({
        ok: checks.every((check) => check.ok),
        dryRun: true,
        checks,
      }),
      stderr: "",
    };
  }

  if (argv.includes("--help") || argv.length === 0) {
    return { exitCode: 0, stdout: helpText(), stderr: "" };
  }

  return {
    exitCode: 1,
    stdout: "",
    stderr: `Unknown command: ${argv[0] ?? ""}\n`,
  };
}

async function configDoctorChecks(options: {
  cwd: string;
  env: NodeJS.ProcessEnv;
  spawnImpl?: JavaSdkSpawn;
}): Promise<DoctorCheck[]> {
  const sdkDir = options.env.DEEPDRAW_SDK_DIR
    ? resolve(options.env.DEEPDRAW_SDK_DIR)
    : join(options.cwd, "vendor", "deepdraw-sdk");

  const javaRuntime = await checkLocalJavaTool("java-runtime", "java", options.spawnImpl);
  const javac = await checkLocalJavaTool("javac", "javac", options.spawnImpl);

  return [
    { name: "config-path", ok: true },
    { name: "credential-store", ok: true },
    javaRuntime,
    javac,
    checkJarSet("deepdraw-sdk-jars", sdkDir, requiredDeepdrawSdkJars),
    checkJarSet("java-sdk-dependency-jars", join(sdkDir, "lib"), requiredJavaDependencyJars),
  ];
}

async function checkLocalJavaTool(name: string, command: string, spawnImpl?: JavaSdkSpawn): Promise<DoctorCheck> {
  const spawn = spawnImpl ?? defaultDoctorSpawn;
  try {
    const run = await spawn(command, ["-version"], "");
    if (run.exitCode === 0) {
      return { name, ok: true };
    }
    return {
      name,
      ok: false,
      message: (run.stderr || run.stdout || `exit code ${run.exitCode}`).trim(),
    };
  } catch (error) {
    return {
      name,
      ok: false,
      message: errorMessage(error),
    };
  }
}

function checkJarSet(name: string, directory: string, jars: string[]): DoctorCheck {
  const missing = jars.filter((jar) => !existsSync(join(directory, jar)));
  return {
    name,
    ok: missing.length === 0,
    path: directory,
    count: jars.length - missing.length,
    ...(missing.length > 0 ? { missing } : {}),
  };
}

function defaultDoctorSpawn(command: string, args: string[], input: string): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolveSpawn) => {
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
    child.on("error", (error) => {
      resolveSpawn({ stdout: "", stderr: error.message, exitCode: 1 });
    });
    child.on("close", (exitCode) => {
      resolveSpawn({ stdout, stderr, exitCode });
    });
    child.stdin.end(input);
  });
}

function defaultCredentialPath(options: Pick<CliRunOptions, "configPath" | "platform" | "homeDir" | "env">): string {
  const configPath = options.configPath
    ?? configPathForPlatform(options.platform ?? process.platform, options.homeDir ?? process.env.HOME ?? "", options.env);
  return join(dirname(configPath), "credentials.json");
}

function withConfigDefaults(
  api: ApiDefinition,
  query: Record<string, unknown>,
  config: DeepdrawConfig,
): Record<string, unknown> {
  if (api.requiredParams.some((param) => param.source === "query" && param.name === "merchantId") && !hasNonEmptyValue(query.merchantId)) {
    return { ...query, merchantId: config.merchantId };
  }
  return query;
}

function validateRequiredParams(api: ApiDefinition, query: Record<string, unknown>, body: unknown): void {
  const missing = api.requiredParams.filter((param) => {
    if (param.source === "query") {
      return !hasNonEmptyValue(query[param.name]);
    }
    return !hasRequiredBodyParam(param.name, body);
  }).map((param) => param.name);

  if (missing.length > 0) {
    throw new Error(`Missing required parameters for ${api.apiName}: ${missing.join(", ")}`);
  }
}

function hasRequiredBodyParam(name: string, body: unknown): boolean {
  if (!hasNonEmptyValue(body)) {
    return false;
  }
  if (!isRecord(body)) {
    return true;
  }
  if (Object.prototype.hasOwnProperty.call(body, name)) {
    return hasNonEmptyValue(body[name]);
  }
  if (name === "product") {
    return true;
  }
  if (name === "images") {
    return ["addImages", "updateImages", "deleteImages"].some((field) => hasNonEmptyValue(body[field]));
  }
  return false;
}

function hasNonEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (isRecord(value)) {
    return Object.keys(value).length > 0;
  }
  return true;
}

interface AuthLoginInput {
  tenantName: string;
  merchantId: string;
  appKey: string;
  appSecret: string;
  dopKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  defaultTenant?: boolean;
}

function validateAuthLoginInput(input: Record<string, unknown>): AuthLoginInput {
  const required = ["tenantName", "merchantId", "appKey", "appSecret", "dopKey"] as const;
  const missing = required.filter((field) => !hasNonEmptyValue(input[field]));
  if (missing.length > 0) {
    throw new Error(`Missing auth login fields: ${missing.join(", ")}`);
  }
  if (input.timeoutMs !== undefined && (!Number.isInteger(input.timeoutMs) || Number(input.timeoutMs) <= 0)) {
    throw new Error("timeoutMs must be a positive integer");
  }
  return {
    tenantName: String(input.tenantName),
    merchantId: String(input.merchantId),
    appKey: String(input.appKey),
    appSecret: String(input.appSecret),
    dopKey: String(input.dopKey),
    baseUrl: input.baseUrl === undefined ? undefined : String(input.baseUrl),
    timeoutMs: input.timeoutMs === undefined ? undefined : Number(input.timeoutMs),
    defaultTenant: Boolean(input.defaultTenant),
  };
}

function credentialRefs(tenantName: string): Pick<StoredConfigFile["tenants"][string], "appKeyRef" | "appSecretRef" | "dopKeyRef"> {
  return {
    appKeyRef: `tenant:${tenantName}:appKey`,
    appSecretRef: `tenant:${tenantName}:appSecret`,
    dopKeyRef: `tenant:${tenantName}:dopKey`,
  };
}

async function writeTenantConfig(
  configPath: string,
  input: AuthLoginInput,
  refs: Pick<StoredConfigFile["tenants"][string], "appKeyRef" | "appSecretRef" | "dopKeyRef">,
): Promise<void> {
  const existing = readExistingStoredConfig(configPath);
  const defaultTenant = input.defaultTenant || !existing.defaultTenant ? input.tenantName : existing.defaultTenant;
  const config: StoredConfigFile = {
    defaultTenant,
    tenants: {
      ...existing.tenants,
      [input.tenantName]: {
        merchantId: input.merchantId,
        ...(input.baseUrl ? { baseUrl: input.baseUrl } : {}),
        ...(input.timeoutMs ? { timeoutMs: input.timeoutMs } : {}),
        ...refs,
      },
    },
  };
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf8");
}

function readExistingStoredConfig(configPath: string): StoredConfigFile {
  if (!existsSync(configPath)) {
    return { defaultTenant: "", tenants: {} };
  }
  const parsed = JSON.parse(readFileSync(configPath, "utf8")) as unknown;
  if (!isRecord(parsed) || !isRecord(parsed.tenants)) {
    throw new Error(`Invalid DeepDraw config at ${configPath}: root object with tenants is required.`);
  }
  return parsed as unknown as StoredConfigFile;
}

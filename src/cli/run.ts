import { spawn as spawnChild } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { apiRegistry, findApiDefinition } from "../core/api-registry.js";
import { createExecutionPlan, enforceApproval } from "../core/approval.js";
import { callDeepdrawApi, type DeepdrawFetch } from "../core/deepdraw-client.js";
import { configPathForPlatform, resolveDeepdrawConfig, type ConfigPlatform, type DeepdrawConfig, type StoredConfigFile } from "../core/config.js";
import { type CredentialStore, FileCredentialStore } from "../core/credentials.js";
import { extractDeepdrawProductContent } from "../core/product-content.js";
import { redactSensitive } from "../core/redact.js";
import type { ApiDefinition } from "../core/types.js";
import { callJavaSdkApi, type JavaSdkSpawn } from "../sdk/java-adapter.js";
import { jsonLine } from "./format.js";

export interface CliRunOptions {
  env: NodeJS.ProcessEnv;
  stdin: string;
  fetchImpl?: DeepdrawFetch;
  credentialStore?: CredentialStore;
  configPath?: string;
  homeDir?: string;
  platform?: ConfigPlatform;
  cwd?: string;
  javaSpawnImpl?: JavaSdkSpawn;
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
  "dop-sdk-1.6.0.jar",
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
          })
          : await callDeepdrawApi({
            config,
            apiName: api.apiName,
            query,
            body: callArgs.body,
            fetchImpl: options.fetchImpl,
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
        credentialStore,
      });
      const result = await callDeepdrawApi({
        config,
        apiName: "dp.product.resource",
        query: contentArgs.query,
        fetchImpl: options.fetchImpl,
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

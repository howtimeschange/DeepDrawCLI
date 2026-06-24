import { apiRegistry, findApiDefinition } from "../core/api-registry.js";
import { createExecutionPlan, enforceApproval } from "../core/approval.js";
import { callDeepdrawApi, type DeepdrawFetch } from "../core/deepdraw-client.js";
import { resolveDeepdrawConfig } from "../core/config.js";
import { EnvCredentialStore } from "../core/credentials.js";
import { redactSensitive } from "../core/redact.js";
import type { ApiDefinition } from "../core/types.js";
import { jsonLine } from "./format.js";

export interface CliRunOptions {
  env: NodeJS.ProcessEnv;
  stdin: string;
  fetchImpl?: DeepdrawFetch;
}

export interface CliRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function helpText() {
  return [
    "Usage: deepdraw <command> [options]",
    "",
    "Commands:",
    "  call <api-name>    Call any registered DeepDraw API",
    "  auth               Manage DeepDraw tenant credentials",
    "  config             Inspect local DeepDraw configuration",
  ].join("\n") + "\n";
}

function parseCallArgs(argv: string[]): {
  execute: boolean;
  yes: boolean;
  plan: boolean;
  query: Record<string, unknown>;
  body?: unknown;
} {
  const query: Record<string, unknown> = {};
  let body: unknown;
  let execute = false;
  let yes = false;
  let plan = false;

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
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
    throw new Error(`Unknown call option: ${arg}`);
  }

  return { execute, yes, plan, query, body };
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
  if (argv[0] === "call") {
    const apiName = argv[1];
    if (!apiName || apiName === "--help") {
      return {
        exitCode: 0,
        stdout: "Usage: deepdraw call <api-name> [--execute] [--yes] [--plan] [--param key=value] [--json JSON] [--json-file file]\n",
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
      callArgs = parseCallArgs(argv);
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
        const config = await resolveDeepdrawConfig({
          env: options.env,
          cwd: process.cwd(),
          credentialStore: new EnvCredentialStore(options.env),
        });
        const result = await callDeepdrawApi({
          config,
          apiName: api.apiName,
          query: callArgs.query,
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

    return {
      exitCode: 0,
      stdout: jsonLine({
        ok: true,
        tenant: credentialsInput.tenantName,
        defaultTenant: Boolean(credentialsInput.defaultTenant),
        credentials: redactSensitive({
          appKey: credentialsInput.appKey,
          appSecret: credentialsInput.appSecret,
          dopKey: credentialsInput.dopKey,
        }),
      }),
      stderr: "",
    };
  }

  if (argv[0] === "config" && argv[1] === "doctor" && argv[2] === "--dry-run") {
    if (argv.length > 3) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: `Unknown config doctor option: ${argv[3]}\n`,
      };
    }

    return {
      exitCode: 0,
      stdout: jsonLine({
        ok: true,
        dryRun: true,
        checks: [
          { name: "config-path", ok: true },
          { name: "credential-store", ok: true },
        ],
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

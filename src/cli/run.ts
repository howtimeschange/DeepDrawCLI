import { findApiDefinition } from "../core/api-registry.js";

export interface CliRunOptions {
  env: NodeJS.ProcessEnv;
  stdin: string;
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

export async function runCli(argv: string[], _options: CliRunOptions): Promise<CliRunResult> {
  if (argv[0] === "call") {
    const apiName = argv[1];
    if (!apiName || apiName === "--help") {
      return {
        exitCode: 0,
        stdout: "Usage: deepdraw call <api-name> [--param key=value] [--json JSON] [--json-file file]\n",
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
    return {
      exitCode: 0,
      stdout: JSON.stringify({ ok: true, api: api.apiName, dryRun: true, callSyntax: api.callSyntax }) + "\n",
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

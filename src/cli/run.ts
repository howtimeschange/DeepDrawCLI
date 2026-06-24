export interface CliRunOptions {
  env: NodeJS.ProcessEnv;
  stdin: string;
}

export interface CliRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function runCli(argv: string[], _options: CliRunOptions): Promise<CliRunResult> {
  if (argv.includes("--help") || argv.length === 0) {
    return {
      exitCode: 0,
      stdout: [
        "Usage: deepdraw <command> [options]",
        "",
        "Commands:",
        "  call <api-name>    Call any registered DeepDraw API",
        "  auth               Manage DeepDraw tenant credentials",
        "  config             Inspect local DeepDraw configuration",
      ].join("\n") + "\n",
      stderr: "",
    };
  }

  return {
    exitCode: 1,
    stdout: "",
    stderr: `Unknown command: ${argv[0] ?? ""}\n`,
  };
}

import assert from "node:assert/strict";
import { test } from "node:test";
import { runCli } from "../src/cli/run.js";
import { apiRegistry } from "../src/core/api-registry.js";

function parseStdout(stdout: string): Record<string, unknown> {
  return JSON.parse(stdout) as Record<string, unknown>;
}

function semanticArgv(semanticCommand: string): string[] {
  assert.match(semanticCommand, /^deepdraw /);
  return semanticCommand.replace(/^deepdraw /, "").split(" ");
}

test("semantic color list maps to registered API dry-run", async () => {
  const result = await runCli(["color", "list", "--dry-run"], {
    env: {},
    stdin: "",
    fetchImpl: async () => {
      throw new Error("semantic dry-run must not fetch");
    },
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.deepEqual(parseStdout(result.stdout), {
    ok: true,
    api: "dp.colors.get",
    dryRun: true,
  });
});

test("risky semantic command returns approval_required without --yes", async () => {
  const result = await runCli(["product", "create", "--input", "product.json"], {
    env: {},
    stdin: "",
    fetchImpl: async () => {
      throw new Error("semantic approval gate must not fetch");
    },
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stderr, "");
  const payload = parseStdout(result.stdout);
  assert.equal(payload.ok, false);
  assert.deepEqual(payload.error, {
    kind: "approval_required",
    message: "User approval is required",
    reason: "approval_required",
  });
  assert.equal((payload.plan as Record<string, unknown>).api, "dp.product.create");
});

test("risky semantic --plan --yes still returns approval plan without fetching", async () => {
  let fetched = false;
  const result = await runCli(["product", "create", "--plan", "--yes"], {
    env: {},
    stdin: "",
    fetchImpl: async () => {
      fetched = true;
      return new Response("{}", { status: 200 });
    },
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stderr, "");
  assert.equal(fetched, false);
  const payload = parseStdout(result.stdout);
  assert.equal(payload.ok, false);
  assert.equal((payload.error as Record<string, unknown>).reason, "plan_requested");
  assert.equal((payload.plan as Record<string, unknown>).api, "dp.product.create");
});

test("every registered semantic command routes to its API in dry-run mode", async () => {
  const semanticApis = apiRegistry.filter((api) => api.semanticCommand);

  assert.ok(semanticApis.length > 0);
  for (const api of semanticApis) {
    const argv = [...semanticArgv(api.semanticCommand ?? ""), "--dry-run"];
    if (api.approvalRequired) {
      argv.push("--yes");
    }

    const result = await runCli(argv, {
      env: {},
      stdin: "",
      fetchImpl: async () => {
        throw new Error(`${api.semanticCommand} must not fetch`);
      },
    });

    assert.equal(result.exitCode, 0, api.semanticCommand ?? api.apiName);
    assert.equal(result.stderr, "", api.semanticCommand ?? api.apiName);
    const payload = parseStdout(result.stdout);
    assert.equal(payload.ok, true, api.semanticCommand ?? api.apiName);
    assert.equal(payload.api, api.apiName, api.semanticCommand ?? api.apiName);
    assert.equal(payload.dryRun, true, api.semanticCommand ?? api.apiName);
  }
});

test("risky semantic approval plan redacts secret-like params", async () => {
  const result = await runCli([
    "product",
    "create",
    "--input",
    "product.json",
    "--param",
    "appSecret=secret-value",
  ], {
    env: { DEEPDRAW_TENANT_NAME: "demo" },
    stdin: "",
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stderr, "");
  const payload = parseStdout(result.stdout);
  const plan = payload.plan as Record<string, unknown>;
  assert.equal(plan.tenant, "demo");
  assert.deepEqual(plan.sanitizedParams, {
    command: "product create --input product.json --param appSecret=[REDACTED]",
    input: "product.json",
    params: {
      appSecret: "[REDACTED]",
    },
  });
});

test("semantic commands reject unknown options", async () => {
  const result = await runCli(["color", "list", "--bogus"], {
    env: {},
    stdin: "",
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /Unknown semantic option: --bogus/);
});

test("semantic commands reject malformed params", async () => {
  const result = await runCli(["product", "create", "--param", "merchantId"], {
    env: {},
    stdin: "",
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /--param requires key=value/);
});

test("semantic commands reject missing input path", async () => {
  const result = await runCli(["product", "create", "--input"], {
    env: {},
    stdin: "",
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /--input requires a file path/);
});

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { runCli } from "../src/cli/run.js";
import { resolveDeepdrawConfig } from "../src/core/config.js";
import { FakeCredentialStore } from "../src/core/credentials.js";

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "deepdraw-cli-auth-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("auth login --stdin-json returns redacted tenant summary", async () => {
  const result = await runCli(["auth", "login", "--stdin-json"], {
    env: {},
    stdin: JSON.stringify({
      tenantName: "电商巴拉巴拉",
      merchantId: "1162",
      appKey: "app-key",
      appSecret: "secret",
      dopKey: "dop",
      baseUrl: "http://open.deepdraw.cn",
      defaultTenant: true,
    }),
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.tenant, "电商巴拉巴拉");
  assert.equal(payload.defaultTenant, true);
  assert.equal(payload.credentials.appKey, "[REDACTED]");
  assert.equal(payload.credentials.appSecret, "[REDACTED]");
  assert.equal(payload.credentials.dopKey, "[REDACTED]");
  assert.doesNotMatch(result.stdout, /"app-key"|"secret"|"dop"/);
});

test("auth login --stdin-json writes stored config and credential refs without leaking secrets", async () => {
  await withTempDir(async (dir) => {
    const configPath = join(dir, "config.json");
    const credentialStore = new FakeCredentialStore();
    const result = await runCli(["auth", "login", "--stdin-json"], {
      env: {},
      stdin: JSON.stringify({
        tenantName: "电商巴拉巴拉",
        merchantId: "1162",
        appKey: "app-key",
        appSecret: "secret",
        dopKey: "dop",
        baseUrl: "http://open.deepdraw.cn",
        timeoutMs: 45000,
        defaultTenant: true,
      }),
      configPath,
      credentialStore,
    });

    assert.equal(result.exitCode, 0);
    assert.equal(result.stderr, "");
    assert.doesNotMatch(result.stdout, /"app-key"|"secret"|"dop"/);
    const storedText = await readFile(configPath, "utf8");
    assert.doesNotMatch(storedText, /"app-key"|"secret"|"dop"/);
    assert.deepEqual(JSON.parse(storedText), {
      defaultTenant: "电商巴拉巴拉",
      tenants: {
        "电商巴拉巴拉": {
          merchantId: "1162",
          baseUrl: "http://open.deepdraw.cn",
          timeoutMs: 45000,
          appKeyRef: "tenant:电商巴拉巴拉:appKey",
          appSecretRef: "tenant:电商巴拉巴拉:appSecret",
          dopKeyRef: "tenant:电商巴拉巴拉:dopKey",
        },
      },
    });
    assert.equal(await credentialStore.get("tenant:电商巴拉巴拉:appKey"), "app-key");
    assert.equal(await credentialStore.get("tenant:电商巴拉巴拉:appSecret"), "secret");
    assert.equal(await credentialStore.get("tenant:电商巴拉巴拉:dopKey"), "dop");

    const resolved = await resolveDeepdrawConfig({
      env: {},
      configPath,
      credentialStore,
    });
    assert.equal(resolved.tenantName, "电商巴拉巴拉");
    assert.equal(resolved.appKey, "app-key");
    assert.equal(resolved.appSecret, "secret");
    assert.equal(resolved.dopKey, "dop");
    assert.equal(resolved.merchantId, "1162");
    assert.equal(resolved.credentialSource, "store");
  });
});

test("auth login --stdin-json reports invalid JSON as CLI error", async () => {
  const result = await runCli(["auth", "login", "--stdin-json"], {
    env: {},
    stdin: "{",
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /Invalid JSON from stdin/);
});

test("auth login --stdin-json rejects non-object JSON input", async () => {
  const result = await runCli(["auth", "login", "--stdin-json"], {
    env: {},
    stdin: JSON.stringify([]),
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /Expected auth input JSON object/);
});

test("auth login --stdin-json rejects unknown trailing args", async () => {
  const result = await runCli(["auth", "login", "--stdin-json", "--bogus"], {
    env: {},
    stdin: JSON.stringify({
      tenantName: "电商巴拉巴拉",
      appKey: "app-key",
      appSecret: "secret",
      dopKey: "dop",
    }),
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /Unknown auth login option: --bogus/);
});

test("auth login --stdin-json coerces defaultTenant to boolean", async () => {
  const missingDefaultTenant = await runCli(["auth", "login", "--stdin-json"], {
    env: {},
    stdin: JSON.stringify({
      tenantName: "未设默认租户",
      merchantId: "1162",
      appKey: "app-key",
      appSecret: "secret",
      dopKey: "dop",
    }),
  });
  const stringDefaultTenant = await runCli(["auth", "login", "--stdin-json"], {
    env: {},
    stdin: JSON.stringify({
      tenantName: "字符串默认租户",
      merchantId: "1162",
      appKey: "app-key",
      appSecret: "secret",
      dopKey: "dop",
      defaultTenant: "false",
    }),
  });

  assert.equal(missingDefaultTenant.exitCode, 0);
  assert.equal(JSON.parse(missingDefaultTenant.stdout).defaultTenant, false);

  assert.equal(stringDefaultTenant.exitCode, 0);
  assert.equal(JSON.parse(stringDefaultTenant.stdout).defaultTenant, true);
});

test("config doctor --dry-run rejects unknown trailing args", async () => {
  const result = await runCli(["config", "doctor", "--dry-run", "--execute"], {
    env: {},
    stdin: "",
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /Unknown config doctor option: --execute/);
});

test("config doctor --dry-run succeeds without live network calls", async () => {
  let fetched = false;
  const result = await runCli(["config", "doctor", "--dry-run"], {
    env: {},
    stdin: "",
    fetchImpl: async () => {
      fetched = true;
      throw new Error("network should not be called");
    },
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.equal(fetched, false);

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.dryRun, true);
  assert.deepEqual(payload.checks, [
    { name: "config-path", ok: true },
    { name: "credential-store", ok: true },
  ]);
});

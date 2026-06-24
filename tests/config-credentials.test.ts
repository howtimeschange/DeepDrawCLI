import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import {
  configPathForPlatform,
  resolveDeepdrawConfig,
  type StoredConfigFile,
} from "../src/core/config.js";
import { EnvCredentialStore, FakeCredentialStore } from "../src/core/credentials.js";

function envConfig(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    DEEPDRAW_TENANT_NAME: "env-tenant",
    DEEPDRAW_APP_KEY: "env-app-key",
    DEEPDRAW_APP_SECRET: "env-app-secret",
    DEEPDRAW_DOP_KEY: "env-dop-key",
    DEEPDRAW_MERCHANT_ID: "env-merchant",
    ...overrides,
  };
}

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = join(tmpdir(), `deepdraw-cli-test-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(dir, { recursive: true });
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function writeRawConfig(dir: string, config: unknown): Promise<string> {
  const configPath = join(dir, "config.json");
  await writeFile(configPath, JSON.stringify(config), "utf8");
  return configPath;
}

test("configPathForPlatform returns platform-specific user config paths", () => {
  assert.equal(
    configPathForPlatform("darwin", "/Users/me", {}),
    "/Users/me/.config/deepdraw/config.json",
  );
  assert.equal(
    configPathForPlatform("linux", "/home/me", {}),
    "/home/me/.config/deepdraw/config.json",
  );
  assert.equal(
    configPathForPlatform("win32", "C:\\Users\\me", { APPDATA: "C:\\Users\\me\\AppData\\Roaming" }),
    "C:\\Users\\me\\AppData\\Roaming\\DeepDrawCli\\config.json",
  );
});

test("EnvCredentialStore reads credentials from environment without allowing writes", async () => {
  const store = new EnvCredentialStore({
    DEEPDRAW_APP_KEY: "app-key",
    DEEPDRAW_APP_SECRET: "app-secret",
  });

  assert.equal(await store.get("appKey"), "app-key");
  assert.equal(await store.get("appSecret"), "app-secret");
  assert.equal(await store.get("dopKey"), undefined);
  await assert.rejects(() => store.set("dopKey", "dop-key"), /read-only/);
  await assert.rejects(() => store.delete("appKey"), /read-only/);
});

test("FakeCredentialStore supports async get set and delete", async () => {
  const store = new FakeCredentialStore({ appKey: "initial" });

  assert.equal(await store.get("appKey"), "initial");
  await store.set("appSecret", "secret");
  assert.equal(await store.get("appSecret"), "secret");
  await store.delete("appKey");
  assert.equal(await store.get("appKey"), undefined);
});

test("resolveDeepdrawConfig prefers explicit environment variables over stored credentials", async () => {
  await withTempDir(async (dir) => {
    const configPath = join(dir, "config.json");
    const storedConfig: StoredConfigFile = {
      defaultTenant: "stored-tenant",
      tenants: {
        "stored-tenant": {
          merchantId: "stored-merchant",
          appKeyRef: "stored-app-key-ref",
          appSecretRef: "stored-app-secret-ref",
          dopKeyRef: "stored-dop-key-ref",
        },
      },
    };
    await writeFile(configPath, JSON.stringify(storedConfig), "utf8");

    const config = await resolveDeepdrawConfig({
      env: envConfig({
        DEEPDRAW_BASE_URL: "https://env.example.test",
        DEEPDRAW_TIMEOUT_MS: "45000",
      }),
      configPath,
      credentialStore: new FakeCredentialStore({
        "stored-app-key-ref": "stored-app-key",
        "stored-app-secret-ref": "stored-app-secret",
        "stored-dop-key-ref": "stored-dop-key",
      }),
    });

    assert.deepEqual(config, {
      tenantName: "env-tenant",
      baseUrl: "https://env.example.test",
      appKey: "env-app-key",
      appSecret: "env-app-secret",
      dopKey: "env-dop-key",
      merchantId: "env-merchant",
      timeoutMs: 45000,
      credentialSource: "env",
    });
  });
});

test("resolveDeepdrawConfig reads stored tenant config and credential references", async () => {
  await withTempDir(async (dir) => {
    const configPath = join(dir, "config.json");
    const storedConfig: StoredConfigFile = {
      defaultTenant: "default-tenant",
      tenants: {
        "default-tenant": {
          baseUrl: "https://stored.example.test",
          merchantId: "stored-merchant",
          timeoutMs: 60000,
          appKeyRef: "deepdraw/default/app-key",
          appSecretRef: "deepdraw/default/app-secret",
          dopKeyRef: "deepdraw/default/dop-key",
        },
      },
    };
    await writeFile(configPath, JSON.stringify(storedConfig), "utf8");

    const config = await resolveDeepdrawConfig({
      env: {},
      configPath,
      credentialStore: new FakeCredentialStore({
        "deepdraw/default/app-key": "stored-app-key",
        "deepdraw/default/app-secret": "stored-app-secret",
        "deepdraw/default/dop-key": "stored-dop-key",
      }),
    });

    assert.deepEqual(config, {
      tenantName: "default-tenant",
      baseUrl: "https://stored.example.test",
      appKey: "stored-app-key",
      appSecret: "stored-app-secret",
      dopKey: "stored-dop-key",
      merchantId: "stored-merchant",
      timeoutMs: 60000,
      credentialSource: "store",
    });
  });
});

test("resolveDeepdrawConfig can select a non-default stored tenant", async () => {
  await withTempDir(async (dir) => {
    const configPath = join(dir, "config.json");
    const storedConfig: StoredConfigFile = {
      defaultTenant: "default-tenant",
      tenants: {
        "default-tenant": {
          merchantId: "default-merchant",
          appKeyRef: "deepdraw/default/app-key",
          appSecretRef: "deepdraw/default/app-secret",
          dopKeyRef: "deepdraw/default/dop-key",
        },
        "selected-tenant": {
          baseUrl: "https://selected.example.test",
          merchantId: "selected-merchant",
          timeoutMs: 75000,
          appKeyRef: "deepdraw/selected/app-key",
          appSecretRef: "deepdraw/selected/app-secret",
          dopKeyRef: "deepdraw/selected/dop-key",
        },
      },
    };
    await writeFile(configPath, JSON.stringify(storedConfig), "utf8");

    const config = await resolveDeepdrawConfig({
      env: {},
      configPath,
      tenantName: "selected-tenant",
      credentialStore: new FakeCredentialStore({
        "deepdraw/default/app-key": "default-app-key",
        "deepdraw/default/app-secret": "default-app-secret",
        "deepdraw/default/dop-key": "default-dop-key",
        "deepdraw/selected/app-key": "selected-app-key",
        "deepdraw/selected/app-secret": "selected-app-secret",
        "deepdraw/selected/dop-key": "selected-dop-key",
      }),
    });

    assert.deepEqual(config, {
      tenantName: "selected-tenant",
      baseUrl: "https://selected.example.test",
      appKey: "selected-app-key",
      appSecret: "selected-app-secret",
      dopKey: "selected-dop-key",
      merchantId: "selected-merchant",
      timeoutMs: 75000,
      credentialSource: "store",
    });
  });
});

test("resolveDeepdrawConfig prefers stored config over complete .env.local fallback", async () => {
  await withTempDir(async (dir) => {
    await writeFile(join(dir, ".env.local"), [
      "DEEPDRAW_TENANT_NAME=local-tenant",
      "DEEPDRAW_APP_KEY=local-app-key",
      "DEEPDRAW_APP_SECRET=local-app-secret",
      "DEEPDRAW_DOP_KEY=local-dop-key",
      "DEEPDRAW_MERCHANT_ID=local-merchant",
      "",
    ].join("\n"), "utf8");

    const configPath = join(dir, "config.json");
    const storedConfig: StoredConfigFile = {
      defaultTenant: "stored-tenant",
      tenants: {
        "stored-tenant": {
          merchantId: "stored-merchant",
          appKeyRef: "stored/app-key",
          appSecretRef: "stored/app-secret",
          dopKeyRef: "stored/dop-key",
        },
      },
    };
    await writeFile(configPath, JSON.stringify(storedConfig), "utf8");

    const config = await resolveDeepdrawConfig({
      env: {
        DEEPDRAW_TENANT_NAME: "explicit-incomplete-tenant",
      },
      configPath,
      cwd: dir,
      credentialStore: new FakeCredentialStore({
        "stored/app-key": "stored-app-key",
        "stored/app-secret": "stored-app-secret",
        "stored/dop-key": "stored-dop-key",
      }),
    });

    assert.equal(config.tenantName, "stored-tenant");
    assert.equal(config.appKey, "stored-app-key");
    assert.equal(config.appSecret, "stored-app-secret");
    assert.equal(config.dopKey, "stored-dop-key");
    assert.equal(config.merchantId, "stored-merchant");
    assert.equal(config.credentialSource, "store");
  });
});

test("resolveDeepdrawConfig loads .env.local values without overriding explicit env", async () => {
  await withTempDir(async (dir) => {
    await writeFile(join(dir, ".env.local"), [
      "DEEPDRAW_TENANT_NAME=local-tenant",
      "DEEPDRAW_APP_KEY=local-app-key",
      "DEEPDRAW_APP_SECRET=local-app-secret",
      "DEEPDRAW_DOP_KEY=local-dop-key",
      "DEEPDRAW_MERCHANT_ID=local-merchant",
      "DEEPDRAW_BASE_URL=https://local.example.test",
      "DEEPDRAW_TIMEOUT_MS=90000",
      "",
    ].join("\n"), "utf8");

    const config = await resolveDeepdrawConfig({
      env: {
        DEEPDRAW_APP_KEY: "explicit-app-key",
      },
      configPath: join(dir, "missing-config.json"),
      cwd: dir,
      credentialStore: new FakeCredentialStore(),
    });

    assert.equal(config.tenantName, "local-tenant");
    assert.equal(config.appKey, "explicit-app-key");
    assert.equal(config.appSecret, "local-app-secret");
    assert.equal(config.dopKey, "local-dop-key");
    assert.equal(config.merchantId, "local-merchant");
    assert.equal(config.baseUrl, "https://local.example.test");
    assert.equal(config.timeoutMs, 90000);
    assert.equal(config.credentialSource, "env");
  });
});

test("resolveDeepdrawConfig reports useful missing credential errors", async () => {
  await withTempDir(async (dir) => {
    const configPath = join(dir, "config.json");
    const storedConfig: StoredConfigFile = {
      defaultTenant: "default-tenant",
      tenants: {
        "default-tenant": {
          merchantId: "stored-merchant",
          appKeyRef: "missing-app-key",
          appSecretRef: "missing-app-secret",
          dopKeyRef: "missing-dop-key",
        },
      },
    };
    await writeFile(configPath, JSON.stringify(storedConfig), "utf8");

    await assert.rejects(
      () => resolveDeepdrawConfig({
        env: {},
        configPath,
        credentialStore: new FakeCredentialStore({
          "missing-app-key": "stored-app-key",
        }),
      }),
      /Missing DeepDraw credentials.*appSecret.*dopKey/,
    );
  });
});

test("resolveDeepdrawConfig rejects stored config with null tenants", async () => {
  await withTempDir(async (dir) => {
    const configPath = await writeRawConfig(dir, {
      defaultTenant: "default-tenant",
      tenants: null,
    });

    await assert.rejects(
      () => resolveDeepdrawConfig({
        env: {},
        configPath,
        credentialStore: new FakeCredentialStore(),
      }),
      new RegExp(`Invalid DeepDraw config at ${configPath}.*tenants`),
    );
  });
});

test("resolveDeepdrawConfig rejects selected tenant missing required fields", async () => {
  await withTempDir(async (dir) => {
    const configPath = await writeRawConfig(dir, {
      defaultTenant: "default-tenant",
      tenants: {
        "default-tenant": {
          appKeyRef: "app-key-ref",
        },
      },
    });

    await assert.rejects(
      () => resolveDeepdrawConfig({
        env: {},
        configPath,
        credentialStore: new FakeCredentialStore(),
      }),
      /Invalid DeepDraw config.*merchantId.*appSecretRef.*dopKeyRef/,
    );
  });
});

test("resolveDeepdrawConfig rejects invalid stored tenant timeout", async () => {
  await withTempDir(async (dir) => {
    const configPath = await writeRawConfig(dir, {
      defaultTenant: "default-tenant",
      tenants: {
        "default-tenant": {
          merchantId: "stored-merchant",
          appKeyRef: "app-key-ref",
          appSecretRef: "app-secret-ref",
          dopKeyRef: "dop-key-ref",
          timeoutMs: 0,
        },
      },
    });

    await assert.rejects(
      () => resolveDeepdrawConfig({
        env: {},
        configPath,
        credentialStore: new FakeCredentialStore(),
      }),
      /Invalid DeepDraw config.*timeoutMs/,
    );
  });
});

test("resolveDeepdrawConfig reports config path for malformed JSON", async () => {
  await withTempDir(async (dir) => {
    const configPath = join(dir, "config.json");
    await writeFile(configPath, "{not-json", "utf8");

    await assert.rejects(
      () => resolveDeepdrawConfig({
        env: {},
        configPath,
        credentialStore: new FakeCredentialStore(),
      }),
      new RegExp(`Invalid DeepDraw config at ${configPath}`),
    );
  });
});

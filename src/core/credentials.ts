import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export interface CredentialStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

const envCredentialNames: Record<string, string> = {
  appKey: "DEEPDRAW_APP_KEY",
  appSecret: "DEEPDRAW_APP_SECRET",
  dopKey: "DEEPDRAW_DOP_KEY",
};

export class FakeCredentialStore implements CredentialStore {
  private readonly values: Map<string, string>;

  constructor(initialValues: Record<string, string> = {}) {
    this.values = new Map(Object.entries(initialValues));
  }

  async get(key: string): Promise<string | undefined> {
    return this.values.get(key);
  }

  async set(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }
}

export class EnvCredentialStore implements CredentialStore {
  constructor(private readonly env: NodeJS.ProcessEnv) {}

  async get(key: string): Promise<string | undefined> {
    const envName = envCredentialNames[key] ?? key;
    return this.env[envName];
  }

  async set(_key: string, _value: string): Promise<void> {
    throw new Error("EnvCredentialStore is read-only");
  }

  async delete(_key: string): Promise<void> {
    throw new Error("EnvCredentialStore is read-only");
  }
}

export class FileCredentialStore implements CredentialStore {
  constructor(private readonly filePath: string) {}

  async get(key: string): Promise<string | undefined> {
    return this.readValues()[key];
  }

  async set(key: string, value: string): Promise<void> {
    const values = this.readValues();
    values[key] = value;
    await this.writeValues(values);
  }

  async delete(key: string): Promise<void> {
    const values = this.readValues();
    delete values[key];
    await this.writeValues(values);
  }

  private readValues(): Record<string, string> {
    if (!existsSync(this.filePath)) {
      return {};
    }
    const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`Invalid DeepDraw credential file at ${this.filePath}: root object is required.`);
    }
    return parsed as Record<string, string>;
  }

  private async writeValues(values: Record<string, string>): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(values, null, 2), { encoding: "utf8", mode: 0o600 });
  }
}

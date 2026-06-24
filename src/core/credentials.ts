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

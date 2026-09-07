import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ExecutionRecord, WorkflowSnapshot, WorkflowState } from "./types.js";

const SECRET_KEY = /(?:app[_-]?secret|dop[_-]?key|signature|authorization|access[_-]?token|password|credential)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !SECRET_KEY.test(key))
    .map(([key, item]) => [key, redact(item)]));
}

function snapshotState(value: unknown): WorkflowState {
  const state = typeof value === "string" ? value : "imported";
  const states: WorkflowState[] = ["imported", "assembled", "template_ready", "review_required", "ready", "planned", "publishing", "post_create_update", "readback_verified", "readback_mismatch", "needs_ui_verification", "transport_unknown", "failed"];
  return states.includes(state as WorkflowState) ? state as WorkflowState : "failed";
}

export function fingerprint(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function createWorkflowSnapshot(brand: string, spu: string): WorkflowSnapshot {
  return {
    version: 1,
    brand,
    spu,
    state: "imported",
    updatedAt: new Date().toISOString(),
    sources: [],
    normalized: {},
    template: {},
    draft: {},
    audit: {},
    plans: [],
    readbacks: [],
    executions: [],
    blocking: [],
    manual: [],
  };
}

export class WorkflowStore {
  private constructor(
    readonly brand: string,
    readonly spu: string,
    readonly root: string,
  ) {}

  static open(brand: string, spu: string, root = process.cwd()): WorkflowStore {
    if (!/^[A-Za-z0-9._-]+$/.test(brand)) throw new Error("workflow brand contains unsupported characters");
    if (!/^[A-Za-z0-9._-]+$/.test(spu)) throw new Error("workflow spu contains unsupported characters");
    return new WorkflowStore(brand, spu, root);
  }

  get directory(): string {
    return join(this.root, ".deepdraw-workflows", this.brand, this.spu);
  }

  get statePath(): string {
    return join(this.directory, "state.json");
  }

  async read(): Promise<WorkflowSnapshot | undefined> {
    try {
      const parsed = JSON.parse(await readFile(this.statePath, "utf8")) as Partial<WorkflowSnapshot>;
      if (parsed.version !== 1 || parsed.brand !== this.brand || parsed.spu !== this.spu) throw new Error("workflow state identity does not match path");
      return {
        ...createWorkflowSnapshot(this.brand, this.spu),
        ...parsed,
        state: snapshotState(parsed.state),
        sources: Array.isArray(parsed.sources) ? parsed.sources : [],
        normalized: isRecord(parsed.normalized) ? parsed.normalized : {},
        template: isRecord(parsed.template) ? parsed.template : {},
        draft: isRecord(parsed.draft) ? parsed.draft : {},
        audit: isRecord(parsed.audit) ? parsed.audit : {},
        plans: Array.isArray(parsed.plans) ? parsed.plans.filter(isRecord) : [],
        readbacks: Array.isArray(parsed.readbacks) ? parsed.readbacks.filter(isRecord) : [],
        executions: Array.isArray(parsed.executions) ? parsed.executions as ExecutionRecord[] : [],
        blocking: Array.isArray(parsed.blocking) ? parsed.blocking.filter(isRecord).map((entry) => ({ code: String(entry.code ?? "unknown"), message: String(entry.message ?? "") })) : [],
        manual: Array.isArray(parsed.manual) ? parsed.manual.filter(isRecord).map((entry) => ({ code: String(entry.code ?? "unknown"), message: String(entry.message ?? "") })) : [],
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  async write(snapshot: WorkflowSnapshot): Promise<WorkflowSnapshot> {
    if (snapshot.brand !== this.brand || snapshot.spu !== this.spu) throw new Error("workflow state identity does not match store");
    const safe = redact({ ...snapshot, updatedAt: new Date().toISOString() }) as WorkflowSnapshot;
    await mkdir(this.directory, { recursive: true });
    await this.atomicWrite(this.statePath, safe);
    await Promise.all([
      this.atomicWrite(join(this.directory, "sources.json"), safe.sources),
      this.atomicWrite(join(this.directory, "normalized.json"), safe.normalized),
      this.atomicWrite(join(this.directory, "template.json"), safe.template),
      this.atomicWrite(join(this.directory, "draft.json"), safe.draft),
      this.atomicWrite(join(this.directory, "audit.json"), safe.audit),
    ]);
    return safe;
  }

  async recordExecution(record: ExecutionRecord): Promise<ExecutionRecord> {
    const current = await this.read() ?? createWorkflowSnapshot(this.brand, this.spu);
    const safe = redact({ ...record, at: record.at ?? new Date().toISOString() }) as ExecutionRecord;
    const entryPath = join(this.directory, "executions", `${safe.at?.replace(/[:.]/g, "-") ?? Date.now()}-${fingerprint(JSON.stringify(safe)).slice(0, 12)}.json`);
    await mkdir(dirname(entryPath), { recursive: true });
    await this.atomicWrite(entryPath, safe);
    await this.write({ ...current, executions: [...current.executions, safe] });
    return safe;
  }

  private async atomicWrite(path: string, data: unknown): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const tempPath = `${path}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(tempPath, path);
  }
}

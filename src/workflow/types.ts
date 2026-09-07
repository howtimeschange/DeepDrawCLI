export type WorkflowState =
  | "imported"
  | "assembled"
  | "template_ready"
  | "review_required"
  | "ready"
  | "planned"
  | "publishing"
  | "post_create_update"
  | "readback_verified"
  | "readback_mismatch"
  | "transport_unknown"
  | "failed";

export type FieldSourceType =
  | "manual"
  | "mdm"
  | "launch_plan"
  | "copywriting"
  | "ocr"
  | "ai"
  | "derived"
  | "remote"
  | "skip";

export interface SourceReference {
  path: string;
  sha256: string;
  sheet?: string;
  row?: number;
  role?: string;
  [key: string]: unknown;
}

export interface WorkflowField {
  fieldId?: string;
  fieldName: string;
  fieldType?: string;
  valueText?: string;
  valueJson?: Record<string, unknown>;
  sourceType: FieldSourceType;
  sourceRefs: SourceReference[];
  confidence?: number;
  manualOverride?: boolean;
  active?: boolean;
  validationStatus?: "valid" | "missing" | "invalid" | "skipped";
  staleReason?: string;
  [key: string]: unknown;
}

export interface ExecutionRecord {
  operation: string;
  status: "planned" | "in_progress" | "verified" | "failed" | "unknown";
  at?: string;
  requestId?: string | null;
  api?: string;
  inputHash?: string;
  details?: Record<string, unknown>;
}

export interface WorkflowSnapshot {
  version: 1;
  brand: string;
  spu: string;
  state: WorkflowState;
  updatedAt: string;
  sources: SourceReference[];
  normalized: Record<string, unknown>;
  template: Record<string, unknown>;
  draft: Record<string, unknown>;
  audit: Record<string, unknown>;
  plans: Record<string, unknown>[];
  readbacks: Record<string, unknown>[];
  executions: ExecutionRecord[];
  blocking: Array<{ code: string; message: string }>;
  manual: Array<{ code: string; message: string }>;
}

export interface WorkflowResult {
  ok: boolean;
  workflow: "balabala-listing";
  action: string;
  spu: string;
  state: WorkflowState;
  templateHash?: string;
  sourceSummary: Record<string, unknown>;
  blocking: Array<{ code: string; message: string }>;
  manual: Array<{ code: string; message: string }>;
  nextAction: string;
  [key: string]: unknown;
}

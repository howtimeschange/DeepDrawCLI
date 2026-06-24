export type CliErrorKind =
  | "config_missing"
  | "credential_missing"
  | "credential_store_unavailable"
  | "approval_required"
  | "input_validation_error"
  | "network_timeout"
  | "http_error"
  | "deepdraw_business_error"
  | "sdk_compile_error"
  | "sdk_runtime_error"
  | "unknown_error";

export interface CliError {
  kind: CliErrorKind;
  message: string;
  details?: Record<string, unknown>;
}

export function createCliError(
  kind: CliErrorKind,
  message: string,
  details?: Record<string, unknown>,
): CliError {
  return details ? { kind, message, details } : { kind, message };
}

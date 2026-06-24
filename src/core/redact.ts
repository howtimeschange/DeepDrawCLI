const SENSITIVE_KEYS = new Set([
  "appsecret",
  "dopkey",
  "authorization",
  "x-ca-signature",
  "signature",
]);

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[_-]/g, "");
  return SENSITIVE_KEYS.has(key.toLowerCase()) ||
    SENSITIVE_KEYS.has(normalized) ||
    normalized.includes("secret") ||
    normalized.includes("token");
}

export function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redactSensitive(item));
  if (!value || typeof value !== "object") return value;

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    output[key] = isSensitiveKey(key) ? "[REDACTED]" : redactSensitive(entry);
  }
  return output;
}

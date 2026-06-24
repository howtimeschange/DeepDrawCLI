export function jsonLine(value: unknown, pretty = false): string {
  return `${JSON.stringify(value, null, pretty ? 2 : 0)}\n`;
}

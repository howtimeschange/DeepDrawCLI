export function extractReferenceApis(markdown: string): string[] {
  const apiNames = new Set<string>();
  const pattern = /\bdp(?:\.[a-z0-9]+){2,}\b/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(markdown)) !== null) {
    const value = match[0];
    if (value !== "dp.*") apiNames.add(value);
  }

  return [...apiNames].sort((a, b) => a.localeCompare(b));
}

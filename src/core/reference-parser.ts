export function extractReferenceApis(markdown: string): string[] {
  const apiNames = new Set<string>();
  const pattern = /`(dp\.[a-z0-9.]+)`/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(markdown)) !== null) {
    const value = match[1];
    if (value !== "dp.*") apiNames.add(value);
  }

  return [...apiNames].sort((a, b) => a.localeCompare(b));
}

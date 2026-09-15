export function firstNonBlank(
  candidates: ReadonlyArray<string | null | undefined>,
  fallback: string,
): string {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return fallback;
}

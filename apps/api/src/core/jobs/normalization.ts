import { createHash } from "node:crypto";

export function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function buildDedupKey(title: string, company: string, location: string): string {
  const normalized = [
    normalizeText(title),
    normalizeText(company),
    normalizeText(location),
  ].join("|");

  return createHash("sha1").update(normalized).digest("hex");
}

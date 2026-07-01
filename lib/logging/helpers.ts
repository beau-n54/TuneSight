import type { TranslatedLogRow } from "./types";

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function read(row: Record<string, unknown>, aliases: string[]): number | null {
  for (const alias of aliases) {
    if (alias in row) return toNumber(row[alias]);
  }

  return null;
}

export function getMissingCoreChannels(rows: TranslatedLogRow[]): string[] {
  const hasAnyValue = (key: keyof TranslatedLogRow) =>
    rows.some((row) => row[key] !== null && row[key] !== undefined);

  const missing: string[] = [];

  if (!hasAnyValue("rpm")) missing.push("rpm");
  if (!hasAnyValue("boostPsi")) missing.push("boostPsi");
  if (!hasAnyValue("boostTargetPsi")) missing.push("boostTargetPsi");
  if (!hasAnyValue("throttle")) missing.push("throttle");

  return missing;
}
import type { TranslatedLogRow } from "./types";

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "") || (typeof value !== "string" && typeof value !== "number")) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function read(row: Record<string, unknown>, aliases: string[]): number | null {
  const matches = aliases.filter(alias => Object.hasOwn(row, alias));
  // Do not silently pick the first of conflicting source columns.
  if (matches.length !== 1) return null;
  return toNumber(row[matches[0]]);
}

export const TEMPERATURE_ALIASES = ["IAT (*C)", "IAT (C)", "IAT[°C]", "IAT[C]", "Intake Air Temperature (C)", "IAT[F]", "IAT[°F]", "IAT (F)", "IAT (*F)", "Intake Air Temperature (F)"];
export const additionalCylinderAliases = (cylinder: 7 | 8) => [`Cyl${cylinder} Timing Cor (*)`, `Cyl ${cylinder} Timing Cor (*)`, `(RAM) Ignition Timing Corr. Cyl. ${cylinder}[\u00B0]`];

export function readTemperatureC(row: Record<string, unknown>): number | null {
  const celsius = TEMPERATURE_ALIASES.slice(0, 5);
  const fahrenheit = TEMPERATURE_ALIASES.slice(5);
  const matches = [...celsius, ...fahrenheit].filter(name => Object.hasOwn(row, name));
  if (matches.length !== 1) return null;
  const value = toNumber(row[matches[0]]);
  return value === null ? null : fahrenheit.includes(matches[0]) ? (value - 32) * 5 / 9 : value;
}

/** Explicit logger channel identifiers, not an inference of installed cylinder count. */
export function readAdditionalCylinderCorrection(row: Record<string, unknown>, cylinder: 7 | 8): number | null {
  return read(row, additionalCylinderAliases(cylinder));
}

export function getMissingCoreChannels(rows: TranslatedLogRow[]): string[] {
  const hasAnyValue = (key: keyof TranslatedLogRow) =>
    rows.some((row) => row[key] !== null && row[key] !== undefined);

  const missing: string[] = [];

  if (!hasAnyValue("time")) missing.push("time");
  if (!hasAnyValue("rpm")) missing.push("rpm");
  if (!hasAnyValue("boostPsi")) missing.push("boostPsi");
  if (!hasAnyValue("boostTargetPsi")) missing.push("boostTargetPsi");
  if (!hasAnyValue("throttle")) missing.push("throttle");

  return missing;
}

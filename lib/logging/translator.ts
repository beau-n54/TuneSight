import { translateBm3Rows } from "./bm3";
import { translateDimsportRows } from "./dimsport";
import { translateMhdRows } from "./mhd";
import { translateProtoolRows } from "./protool";
import { translateXhpRows } from "./xhp";
import type { TranslatedLog } from "./types";

function hasHeader(lowerHeaders: string[], terms: string[]): boolean {
  return lowerHeaders.some((header) => terms.some((term) => header.includes(term)));
}

export function translateLogRows(rawRows: Record<string, unknown>[]): TranslatedLog {
  const headers = Object.keys(rawRows[0] ?? {});
  const lowerHeaders = headers.map((header) => header.toLowerCase());

  const isMhd = hasHeader(lowerHeaders, [
    "boost mean psi",
    "boost target",
    "wgdc",
    "bank 1 afr",
  ]);

  const isBm3 = hasHeader(lowerHeaders, [
    "load actual",
    "boost pressure",
    "ignition timing",
    "pedal position",
  ]);

  const isXhp = hasHeader(lowerHeaders, [
    "gear",
    "transmission",
    "torque converter",
    "shift",
  ]);

  const isDimsport = hasHeader(lowerHeaders, [
    "manifold pressure",
    "actual torque",
  ]);

  const isProtool = hasHeader(lowerHeaders, [
    "protool",
    "boost pressure actual",
  ]);

  if (isMhd) return translateMhdRows(rawRows);
  if (isBm3) return translateBm3Rows(rawRows);
  if (isXhp) return translateXhpRows(rawRows);
  if (isDimsport) return translateDimsportRows(rawRows);
  if (isProtool) return translateProtoolRows(rawRows);

  return {
    platform: "unknown",
    confidence: 0.2,
    rowCount: rawRows.length,
    rows: [],
    detectedHeaders: headers,
    missingCoreChannels: [],
  };
}
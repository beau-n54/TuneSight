import type { TranslatedLog } from "./types";

export function translateProtoolRows(rawRows: Record<string, unknown>[]): TranslatedLog {
  const headers = Object.keys(rawRows[0] ?? {});

  return {
    platform: "protool",
    confidence: 0.3,
    rowCount: rawRows.length,
    rows: [],
    detectedHeaders: headers,
    missingCoreChannels: [],
  };
}
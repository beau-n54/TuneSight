import type { TranslatedLog } from "./types";

export function translateXhpRows(rawRows: Record<string, unknown>[]): TranslatedLog {
  const headers = Object.keys(rawRows[0] ?? {});

  return {
    platform: "xhp",
    confidence: 0.3,
    rowCount: rawRows.length,
    rows: [],
    detectedHeaders: headers,
    missingCoreChannels: [],
  };
}
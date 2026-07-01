import type { TranslatedLog } from "../logging/types";
import type { TuneSightLoggerIntelligence } from "./types";

export function buildLoggerIntelligence(
  translatedLog: TranslatedLog | null
): TuneSightLoggerIntelligence {
  if (!translatedLog) {
    return {
      platform: "unknown",
      confidence: 0,
      rowCount: 0,
      missingCoreChannels: [],
    };
  }

  return {
    platform: translatedLog.platform,
    confidence: translatedLog.confidence,
    rowCount: translatedLog.rowCount,
    missingCoreChannels: translatedLog.missingCoreChannels,
  };
}
import type { TranslatedLog } from "../logging/types";
import { buildLoggerIntelligence } from "./loggerAdapter";
import { buildCalibrationIntelligenceFromTuneProfile } from "./tuneProfileAdapter";
import type {
  CalibrationIntelligence,
  TuneSightIntelligence,
} from "./types";

type TuneProfileInput = Parameters<
  typeof buildCalibrationIntelligenceFromTuneProfile
>[0];

export function buildTuneSightIntelligence(input: {
  calibration?: CalibrationIntelligence | null;
  tuneProfile?: TuneProfileInput | null;
  translatedLog?: TranslatedLog | null;
}): TuneSightIntelligence {
  const calibration =
    input.calibration ??
    buildCalibrationIntelligenceFromTuneProfile(input.tuneProfile ?? null);

  const logger = buildLoggerIntelligence(input.translatedLog ?? null);

  const reasons: string[] = [];

  if (logger.platform !== "unknown") {
    reasons.push(`Logger platform identified: ${logger.platform}.`);
  }

  if (calibration.romFamily !== "unknown") {
    reasons.push(`ROM family identified: ${calibration.romFamily}.`);
  }

  if (calibration.suggestedXdf !== "unknown") {
    reasons.push(`Suggested XDF identified: ${calibration.suggestedXdf}.`);
  }

  return {
    logger,

    calibration: {
      platform: calibration.platform,
      engine: calibration.engine,
      ecuFamily: calibration.ecuFamily,
      romFamily: calibration.romFamily,
      romFingerprint: calibration.romFingerprint,
      suggestedXdf: calibration.suggestedXdf,
      xdfConfidence: calibration.xdfConfidence,
      tableCount: calibration.tableCount,
      modifiedTableCount: calibration.modifiedTableCount,
      capabilities: calibration.capabilities,
      knownStrategies: calibration.knownStrategies,
    },

    confidence: {
      score: Math.max(logger.confidence, calibration.confidence.score),
      reasons,
    },
  };
}

export function buildCalibrationIntelligence(): CalibrationIntelligence {
  return buildCalibrationIntelligenceFromTuneProfile(null);
}
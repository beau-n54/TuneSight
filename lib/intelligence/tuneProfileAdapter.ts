import type { CalibrationIntelligence } from "./types";

type TuneProfileRowLike = {
  detected_platform?: string | null;
  detected_strategy?: string | null;
  detected_rom?: string | null;
  confidence?: number | null;

  rom_platform?: string | null;
  ecu_family?: string | null;
  rom_family?: string | null;
  binary_signature?: string | null;

  xdf_suggested?: string | null;
  rom_confidence?: number | null;

  binary_changed_regions?: unknown[] | null;
  binary_changed_bytes?: number | null;

  notes?: string[] | null;
};

export function buildCalibrationIntelligenceFromTuneProfile(
  tuneProfile: TuneProfileRowLike | null
): CalibrationIntelligence {
  const reasons: string[] = [];

  if (!tuneProfile) {
    return {
      loggerPlatform: "unknown",
      loggerConfidence: 0,

      platform: "unknown",
      engine: "unknown",
      ecuFamily: "unknown",
      romFamily: "unknown",
      romFingerprint: "unknown",

      suggestedXdf: "unknown",
      xdfConfidence: 0,

      tableCount: 0,
      modifiedTableCount: 0,

      capabilities: [],
      knownStrategies: [],

      confidence: {
        score: 0,
        reasons: ["No tune profile was available."],
      },
    };
  }

  const platform =
    tuneProfile.rom_platform ??
    tuneProfile.detected_platform ??
    "unknown";

  const ecuFamily = tuneProfile.ecu_family ?? "unknown";
  const romFamily =
    tuneProfile.rom_family ??
    tuneProfile.detected_rom ??
    "unknown";

  const suggestedXdf = tuneProfile.xdf_suggested ?? "unknown";

  if (platform !== "unknown") reasons.push(`Platform detected: ${platform}.`);
  if (ecuFamily !== "unknown") reasons.push(`ECU family detected: ${ecuFamily}.`);
  if (romFamily !== "unknown") reasons.push(`ROM family detected: ${romFamily}.`);
  if (suggestedXdf !== "unknown") reasons.push(`Suggested XDF: ${suggestedXdf}.`);

  const modifiedTableCount = Array.isArray(tuneProfile.binary_changed_regions)
    ? tuneProfile.binary_changed_regions.length
    : 0;

  if (modifiedTableCount > 0) {
    reasons.push(`${modifiedTableCount} modified binary regions detected.`);
  }

  const confidenceScore =
    typeof tuneProfile.rom_confidence === "number"
      ? tuneProfile.rom_confidence
      : typeof tuneProfile.confidence === "number"
        ? tuneProfile.confidence
        : 0;

  return {
    loggerPlatform: "unknown",
    loggerConfidence: 0,

    platform,
    engine: platform,
    ecuFamily,
    romFamily,
    romFingerprint: tuneProfile.binary_signature ?? romFamily,

    suggestedXdf,
    xdfConfidence: suggestedXdf !== "unknown" ? confidenceScore : 0,

    tableCount: 0,
    modifiedTableCount,

    capabilities: [],
    knownStrategies: [],

    confidence: {
      score: confidenceScore,
      reasons,
    },
  };
}
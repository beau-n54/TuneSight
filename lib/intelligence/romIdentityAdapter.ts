export type RomVerificationStatus =
  | "pending"
  | "verified"
  | "valid"
  | "invalid"
  | "matched"
  | "not_matched"
  | "not_available";

export type RomDetectionLevel =
  | "unknown"
  | "platform_detected"
  | "ecu_detected"
  | "rom_family_detected"
  | "confirmed_rom_signature"
  | "exact_binary_match"
  | "checksum_verified";

export interface RomIdentity {
  detectedPlatform: string | null;
  detectedEcu: string | null;
  dmeVariant: string | null;

  romSignature: string | null;
  romFamily: string | null;
  softwareVersion: string | null;
  calibrationId: string | null;

  binaryType: string | null;
  binarySizeBytes: number | null;

  matchingXdf: string | null;
  stockReference: string | null;
  mapSwitchReference: string | null;

  confidence: number;
  detectionLevel: RomDetectionLevel;

  evidence: string[];
  warnings: string[];

  checksumFamily: string | null;
  checksumVerification: RomVerificationStatus;
  calibrationVerification: RomVerificationStatus;
  exactBinaryMatch: RomVerificationStatus;
}

export type TuneProfileForRomIdentity = {
  rom_platform?: string | null;
  detected_platform?: string | null;

  ecu_family?: string | null;
  dme_variant?: string | null;

  rom_family?: string | null;
  detected_rom?: string | null;
  binary_signature?: string | null;

  software_version?: string | null;
  calibration_id?: string | null;

  binary_type?: string | null;
  binary_size_bytes?: number | null;

  xdf_suggested?: string | null;
  stock_bin_suggested?: string | null;
  map_switch_bin_suggested?: string | null;

  rom_confidence?: number | null;
  confidence?: number | null;

  rom_evidence?: string[] | null;
  rom_warnings?: string[] | null;
  parser_notes?: string[] | null;

  checksum_family?: string | null;
  checksum_status?: string | null;
  checksum_verification_status?: string | null;

  calibration_verification_status?: string | null;
  exact_binary_match_status?: string | null;
};

function normaliseVerificationStatus(
  value: string | null | undefined
): RomVerificationStatus {
  switch (value) {
    case "verified":
    case "valid":
    case "invalid":
    case "matched":
    case "not_matched":
    case "not_available":
      return value;

    default:
      return "pending";
  }
}

function determineDetectionLevel(input: {
  confidence: number;
  platform: string | null;
  ecu: string | null;
  romFamily: string | null;
  romSignature: string | null;
  exactBinaryMatch: RomVerificationStatus;
  checksumVerification: RomVerificationStatus;
}): RomDetectionLevel {
  if (
    input.checksumVerification === "verified" ||
    input.checksumVerification === "valid"
  ) {
    return "checksum_verified";
  }

  if (input.exactBinaryMatch === "matched") {
    return "exact_binary_match";
  }

  if (
    input.romSignature &&
    input.romFamily &&
    input.confidence >= 0.9
  ) {
    return "confirmed_rom_signature";
  }

  if (input.romFamily) {
    return "rom_family_detected";
  }

  if (input.ecu) {
    return "ecu_detected";
  }

  if (input.platform) {
    return "platform_detected";
  }

  return "unknown";
}

export function buildRomIdentityFromTuneProfile(
  profile: TuneProfileForRomIdentity | null
): RomIdentity {
  if (!profile) {
    return {
      detectedPlatform: null,
      detectedEcu: null,
      dmeVariant: null,

      romSignature: null,
      romFamily: null,
      softwareVersion: null,
      calibrationId: null,

      binaryType: null,
      binarySizeBytes: null,

      matchingXdf: null,
      stockReference: null,
      mapSwitchReference: null,

      confidence: 0,
      detectionLevel: "unknown",

      evidence: [],
      warnings: ["No tune profile was available."],

      checksumFamily: null,
      checksumVerification: "pending",
      calibrationVerification: "pending",
      exactBinaryMatch: "pending",
    };
  }

  const detectedPlatform =
    profile.rom_platform ??
    profile.detected_platform ??
    null;

  const detectedEcu = profile.ecu_family ?? null;

  const romFamily =
    profile.rom_family ??
    profile.detected_rom ??
    null;

  const rawRomSignature =
  profile.binary_signature ||
  profile.detected_rom ||
  null;

  const invalidRomSignatures = [
    detectedEcu,
    detectedPlatform,
    "MG1",
    "MG1CS201",
    "MSD80",
    "MSD81",
    "MEVD17",
    "UNKNOWN",
    ]
    .filter(Boolean)
    .map((value) => value?.toUpperCase());

  const romSignature =
    rawRomSignature &&
    !invalidRomSignatures.includes(rawRomSignature.toUpperCase())
        ? rawRomSignature
        : romFamily;

  const confidence =
    typeof profile.rom_confidence === "number"
      ? profile.rom_confidence
      : typeof profile.confidence === "number"
        ? profile.confidence
        : 0;

  const checksumVerification =
    normaliseVerificationStatus(
      profile.checksum_verification_status ??
        profile.checksum_status
    );

  const calibrationVerification =
    normaliseVerificationStatus(
      profile.calibration_verification_status
    );

  const exactBinaryMatch =
    normaliseVerificationStatus(
      profile.exact_binary_match_status
    );

  const evidence =
    Array.isArray(profile.rom_evidence) &&
    profile.rom_evidence.length > 0
      ? profile.rom_evidence
      : Array.isArray(profile.parser_notes)
        ? profile.parser_notes
        : [];

  const warnings = Array.isArray(profile.rom_warnings)
    ? profile.rom_warnings
    : [];

  const detectionLevel = determineDetectionLevel({
    confidence,
    platform: detectedPlatform,
    ecu: detectedEcu,
    romFamily,
    romSignature,
    exactBinaryMatch,
    checksumVerification,
  });

  return {
    detectedPlatform,
    detectedEcu,
    dmeVariant:
      profile.dme_variant ??
      detectedEcu,

    romSignature,
    romFamily,
    softwareVersion:
      profile.software_version ||
      null,

    calibrationId:
      profile.calibration_id ??
      null,

    binaryType:
      profile.binary_type ??
      null,

    binarySizeBytes:
      profile.binary_size_bytes ??
      null,

    matchingXdf:
      profile.xdf_suggested ??
      null,

    stockReference:
      profile.stock_bin_suggested ??
      null,

    mapSwitchReference:
      profile.map_switch_bin_suggested ??
      null,

    confidence,
    detectionLevel,

    evidence,
    warnings,

    checksumFamily:
      profile.checksum_family ??
      null,

    checksumVerification,
    calibrationVerification,
    exactBinaryMatch,
  };
}
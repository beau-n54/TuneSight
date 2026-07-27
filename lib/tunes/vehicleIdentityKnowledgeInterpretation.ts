import type { RuntimeStockVariantKnowledgeResponse } from "../knowledge/runtimeStockVariantKnowledge";
import type { StockVariantLookupResult } from "../knowledge/stockVariants";
import type { RomFingerprintResult } from "./romFingerprint";

export type VehicleIdentityKnowledgeOutcome =
  | StockVariantLookupResult["status"]
  | "runtime_unavailable";

export type VehicleIdentityKnowledgeInterpretation = Readonly<{
  outcome: VehicleIdentityKnowledgeOutcome;
  knowledge: RuntimeStockVariantKnowledgeResponse;
  binaryType: RomFingerprintResult["binaryType"];
  exactBinaryMatch: boolean;
  evidence: readonly string[];
  warnings: readonly string[];
}>;

function preserveNonStockLegacyClassification(
  fingerprint: RomFingerprintResult
): Pick<RomFingerprintResult, "binaryType" | "exactBinaryMatch"> {
  if (fingerprint.binaryType !== "stock") {
    return {
      binaryType: fingerprint.binaryType,
      exactBinaryMatch: fingerprint.exactBinaryMatch,
    };
  }

  return {
    binaryType: "unknown",
    exactBinaryMatch: false,
  };
}

function knowledgeQualificationEvidence(
  result: StockVariantLookupResult
): string[] {
  const evidence = [
    `Qualified Stock Variant Knowledge outcome: ${result.status}.`,
    `Knowledge confidence: ${result.confidence}.`,
  ];

  if (result.verificationStatus) {
    evidence.push(
      `Knowledge verification status: ${result.verificationStatus}.`
    );
  }

  if (result.provenanceSummary.length > 0) {
    evidence.push(
      `Knowledge provenance preserved from ${result.provenanceSummary.length} source record(s).`
    );
  }

  return evidence;
}

export function interpretRuntimeStockVariantKnowledge(input: {
  knowledge: RuntimeStockVariantKnowledgeResponse;
  legacyFingerprint: RomFingerprintResult;
}): VehicleIdentityKnowledgeInterpretation {
  const { knowledge, legacyFingerprint } = input;

  if (knowledge.availability === "unavailable") {
    return Object.freeze({
      outcome: "runtime_unavailable",
      knowledge,
      binaryType: legacyFingerprint.binaryType,
      exactBinaryMatch:
        legacyFingerprint.exactBinaryMatch,
      evidence: Object.freeze([
        ...legacyFingerprint.evidence,
      ]),
      warnings: Object.freeze([
        ...legacyFingerprint.warnings,
        knowledge.unavailableReason,
      ]),
    });
  }

  const result = knowledge.result;
  const evidence = [
    ...legacyFingerprint.evidence,
    ...knowledgeQualificationEvidence(result),
  ];
  const warnings = [...legacyFingerprint.warnings];

  switch (result.status) {
    case "exact_verified":
      return Object.freeze({
        outcome: result.status,
        knowledge,
        binaryType: "stock",
        exactBinaryMatch: true,
        evidence: Object.freeze(evidence),
        warnings: Object.freeze(warnings),
      });

    case "exact_candidate":
    case "family_only":
    case "conflict":
    case "unknown":
    case "invalid":
      break;

    default: {
      const exhaustiveStatus: never =
        result.status;
      throw new Error(
        `Unsupported Stock Variant Knowledge status: ${exhaustiveStatus}`
      );
    }
  }

  const legacyConclusion =
    preserveNonStockLegacyClassification(
      legacyFingerprint
    );

  if (result.unresolvedReason) {
    warnings.push(result.unresolvedReason);
  }

  return Object.freeze({
    outcome: result.status,
    knowledge,
    ...legacyConclusion,
    evidence: Object.freeze(evidence),
    warnings: Object.freeze(warnings),
  });
}

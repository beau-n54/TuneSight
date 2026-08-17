import { translateLogRows } from "../logging/translator.ts";
import type {
  LoggerPlatform,
  TranslatedLog,
  TranslatedLogRow,
} from "../logging/types";
import {
  defineEvidenceProcessingOutcome,
  type EvidenceSourceAvailability,
  type InvalidOrIncompleteSourceOutcome,
  type UnsupportedSourceOutcome,
} from "./evidenceProcessingOutcome.ts";

export type EvidenceSourceQualificationContext = Readonly<{
  sourceLogId: string | null;
  sourceAvailability: EvidenceSourceAvailability;
}>;

export type SupportedUsableEvidenceSource = Readonly<{
  kind: "supported_and_usable";
  translatedLog: TranslatedLog;
}>;

export type UnsupportedEvidenceSource = Readonly<{
  kind: "unsupported_source";
  translatedLog: TranslatedLog;
  outcome: UnsupportedSourceOutcome;
}>;

export type InvalidOrIncompleteEvidenceSource = Readonly<{
  kind: "invalid_or_incomplete_source";
  translatedLog: TranslatedLog;
  outcome: InvalidOrIncompleteSourceOutcome;
  missingRequiredCoreChannels: readonly string[];
}>;

export type EvidenceSourceQualification =
  | SupportedUsableEvidenceSource
  | UnsupportedEvidenceSource
  | InvalidOrIncompleteEvidenceSource;

const implementedAuthoritativeTranslators = new Set<LoggerPlatform>([
  "mhd",
  "bm3",
]);

const requiredCoreChannels = Object.freeze([
  "rpm",
  "boostPsi",
  "boostTargetPsi",
  "throttle",
] as const satisfies readonly (keyof TranslatedLogRow)[]);

function deepCloneFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    return Object.freeze(value.map(deepCloneFreeze)) as T;
  }

  if (value !== null && typeof value === "object") {
    const clone: Record<PropertyKey, unknown> = {};
    for (const key of Reflect.ownKeys(value)) {
      clone[key] = deepCloneFreeze(
        (value as Readonly<Record<PropertyKey, unknown>>)[key]
      );
    }
    return Object.freeze(clone) as T;
  }

  return value;
}

function retryDisposition(
  availability: EvidenceSourceAvailability
): "retryable_from_source" | "not_retryable" | "retryability_unknown" {
  if (availability === "available") return "retryable_from_source";
  if (availability === "unavailable") return "not_retryable";
  return "retryability_unknown";
}

function hasInvalidRequiredObservation(rows: readonly TranslatedLogRow[]): boolean {
  return rows.some((row) =>
    requiredCoreChannels.some((channel) => {
      const value = row[channel];
      return value !== null && value !== undefined && !Number.isFinite(value);
    })
  );
}

function hasAnyUsableObservation(rows: readonly TranslatedLogRow[]): boolean {
  return rows.some((row) =>
    requiredCoreChannels.some(
      (channel) =>
        typeof row[channel] === "number" && Number.isFinite(row[channel])
    )
  );
}

function preserveDetectedHeaders(
  rawRows: readonly Record<string, unknown>[],
  detectedHeaders: readonly string[]
): Record<string, unknown>[] {
  return rawRows.map((row, index) => {
    if (index !== 0) return { ...row };
    const preserved = Object.fromEntries(
      detectedHeaders.map((header) => [header, row[header] ?? null])
    );
    return { ...preserved, ...row };
  });
}

function translateWithDetectedHeaders(
  rawRows: readonly Record<string, unknown>[],
  detectedHeaders: readonly string[]
): TranslatedLog {
  if (rawRows.length === 0 && detectedHeaders.length > 0) {
    const headerProbe = Object.fromEntries(
      detectedHeaders.map((header) => [header, null])
    );
    const classified = translateLogRows([headerProbe]);
    return {
      ...classified,
      rowCount: 0,
      rows: [],
      detectedHeaders: [...detectedHeaders],
    };
  }

  return translateLogRows(preserveDetectedHeaders(rawRows, detectedHeaders));
}

function unsupported(
  translatedLog: TranslatedLog,
  context: EvidenceSourceQualificationContext,
  reasonCode: UnsupportedSourceOutcome["reasonCode"]
): UnsupportedEvidenceSource {
  const stage =
    reasonCode === "unknown_source_format"
      ? "source_classification"
      : "translation";
  const outcome = defineEvidenceProcessingOutcome({
    contractVersion: "1.0",
    kind: "unsupported_source",
    stage,
    sourceLogId: context.sourceLogId,
    loggerPlatform: translatedLog.platform,
    sourceAvailability: context.sourceAvailability,
    evidenceAvailability: "unavailable",
    downstreamConsumption: "blocked",
    retryDisposition: retryDisposition(context.sourceAvailability),
    reasonCode,
  });

  return deepCloneFreeze({
    kind: "unsupported_source",
    translatedLog,
    outcome,
  });
}

function invalidOrIncomplete(
  translatedLog: TranslatedLog,
  context: EvidenceSourceQualificationContext,
  reasonCode: InvalidOrIncompleteSourceOutcome["reasonCode"]
): InvalidOrIncompleteEvidenceSource {
  const outcome = defineEvidenceProcessingOutcome({
    contractVersion: "1.0",
    kind: "invalid_or_incomplete_source",
    stage: "translation",
    sourceLogId: context.sourceLogId,
    loggerPlatform: translatedLog.platform,
    sourceAvailability: context.sourceAvailability,
    evidenceAvailability: "unavailable",
    downstreamConsumption: "blocked",
    retryDisposition: retryDisposition(context.sourceAvailability),
    reasonCode,
  });

  return deepCloneFreeze({
    kind: "invalid_or_incomplete_source",
    translatedLog,
    outcome,
    missingRequiredCoreChannels: [...translatedLog.missingCoreChannels].sort(),
  });
}

export function qualifyTranslatedEvidenceSource(
  translatedLog: TranslatedLog,
  context: EvidenceSourceQualificationContext
): EvidenceSourceQualification {
  if (translatedLog.platform === "unknown") {
    return unsupported(translatedLog, context, "unknown_source_format");
  }

  if (!implementedAuthoritativeTranslators.has(translatedLog.platform)) {
    return unsupported(translatedLog, context, "translator_unavailable");
  }

  if (
    translatedLog.rows.length === 0 ||
    !hasAnyUsableObservation(translatedLog.rows)
  ) {
    return invalidOrIncomplete(translatedLog, context, "no_usable_rows");
  }

  if (
    !Number.isSafeInteger(translatedLog.rowCount) ||
    translatedLog.rowCount < 1 ||
    translatedLog.rowCount !== translatedLog.rows.length ||
    hasInvalidRequiredObservation(translatedLog.rows)
  ) {
    return invalidOrIncomplete(
      translatedLog,
      context,
      "invalid_source_observations"
    );
  }

  if (translatedLog.missingCoreChannels.length > 0) {
    return invalidOrIncomplete(
      translatedLog,
      context,
      "missing_required_core_channels"
    );
  }

  return deepCloneFreeze({
    kind: "supported_and_usable",
    translatedLog,
  });
}

export function qualifyEvidenceSource(
  rawRows: readonly Record<string, unknown>[],
  context: EvidenceSourceQualificationContext,
  detectedHeaders: readonly string[] = []
): EvidenceSourceQualification {
  return qualifyTranslatedEvidenceSource(
    translateWithDetectedHeaders(rawRows, detectedHeaders),
    context
  );
}

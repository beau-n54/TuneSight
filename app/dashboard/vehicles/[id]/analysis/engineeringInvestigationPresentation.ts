import type {
  PresentationEvent,
  PresentationRootCause,
} from "./evidenceHierarchyPresentation";

export type XdfAuthorityState =
  | "confirmed"
  | "inferred"
  | "provisional"
  | "unavailable";

export type PresentationXdfReference = {
  tableId?: string;
  tableName?: string;
  name?: string;
  category?: string;
  description?: string;
  axis?: string;
  matchReason?: string;
  reason?: string;
  confidence?: number;
};

export type XdfComparisonHandoffContext = {
  vehicleId?: string;
  tuneId?: string;
  analysisId?: string;
  eventId?: string;
  observation?: number;
  rpmStart?: number;
  rpmEnd?: number;
  loadRegion?: string;
  recommendedTable: string;
  reason: string;
};

export type CalibrationInspectionRecord = {
  tableName: string;
  exactIdentifier: string | null;
  subsystem: string | null;
  sourceBasis: string;
  authorityState: XdfAuthorityState;
  relevance: string;
  rpmRange: [number, number] | null;
  loadRegion: string | null;
  axes: readonly string[];
  inspectionFocus: string;
  eventId: string | null;
  supportingChannels: readonly string[];
  measuredValues: readonly { label: string; value: string }[];
  supports: "primary cause" | "alternative supported cause";
  confidence: number | null;
  limitation: string;
  comparisonHandoff: {
    enabled: false;
    unavailableReason: string;
    context: XdfComparisonHandoffContext;
  };
};

function nonBlank(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function humanizeMetric(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function eventMeasuredValues(
  event: PresentationEvent | null
): { label: string; value: string }[] {
  if (!event?.metrics) return [];

  return Object.entries(event.metrics).flatMap(([label, value]) => {
    if (
      typeof value !== "number" &&
      typeof value !== "string" &&
      typeof value !== "boolean"
    ) {
      return [];
    }

    return [
      {
        label: humanizeMetric(label),
        value:
          typeof value === "number" && Number.isFinite(value)
            ? Number(value.toFixed(3)).toString()
            : String(value),
      },
    ];
  });
}

export function buildCalibrationInspectionRecords(args: {
  analysisId?: string;
  event: PresentationEvent | null;
  observation?: number;
  relatedXdfTables: readonly PresentationXdfReference[];
  rootCause: PresentationRootCause;
  tuneId?: string;
  vehicleId?: string;
}): CalibrationInspectionRecord[] {
  const {
    analysisId,
    event,
    observation,
    relatedXdfTables,
    rootCause,
    tuneId,
    vehicleId,
  } = args;
  const references = new Map<string, PresentationXdfReference>();

  for (const reference of relatedXdfTables) {
    const tableName = nonBlank(reference.tableName) ?? nonBlank(reference.name);
    if (!tableName) continue;
    references.set(tableName.toLowerCase(), reference);
  }

  for (const tableName of rootCause.relatedTables ?? []) {
    const normalizedName = nonBlank(tableName);
    if (!normalizedName || references.has(normalizedName.toLowerCase())) {
      continue;
    }
    references.set(normalizedName.toLowerCase(), { tableName: normalizedName });
  }

  return [...references.values()].flatMap((reference) => {
    const tableName = nonBlank(reference.tableName) ?? nonBlank(reference.name);
    if (!tableName) return [];

    const exactIdentifier = nonBlank(reference.tableId);
    const subsystem = nonBlank(reference.category);
    const suppliedReason =
      nonBlank(reference.reason) ??
      nonBlank(reference.matchReason) ??
      nonBlank(reference.description);
    const relevance =
      suppliedReason ??
      `The supplied event-scoped engineering result identifies ${tableName} as a calibration area for inspection.`;
    const rpmRange =
      typeof event?.rpmStart === "number" &&
      Number.isFinite(event.rpmStart) &&
      typeof event.rpmEnd === "number" &&
      Number.isFinite(event.rpmEnd)
        ? ([event.rpmStart, event.rpmEnd] as [number, number])
        : null;
    const axis = nonBlank(reference.axis);
    const authorityState: XdfAuthorityState = exactIdentifier
      ? "inferred"
      : "provisional";
    const sourceBasis = exactIdentifier
      ? "Runtime XDF table identity with deterministic category matching"
      : "Event-scoped calibration guidance; no exact XDF table identity is available";
    const supports =
      rootCause.rank === "primary"
        ? ("primary cause" as const)
        : ("alternative supported cause" as const);

    return [
      {
        tableName,
        exactIdentifier,
        subsystem,
        sourceBasis,
        authorityState,
        relevance,
        rpmRange,
        loadRegion: null,
        axes: axis ? [axis] : [],
        inspectionFocus:
          "Inspect represented values, transitions, limits, compensations, and control authority within the recorded event region only where those structures exist in the source XDF.",
        eventId: event?.id ?? null,
        supportingChannels: event?.supportingChannels ?? [],
        measuredValues: eventMeasuredValues(event),
        supports,
        confidence:
          typeof rootCause.confidence === "number"
            ? rootCause.confidence
            : null,
        limitation:
          "This recommendation identifies a calibration area for inspection. It does not establish that the table is incorrectly calibrated.",
        comparisonHandoff: {
          enabled: false,
          unavailableReason:
            "XDF Comparison handoff is unavailable because /garage/xdf-comparison is not implemented.",
          context: {
            vehicleId,
            tuneId,
            analysisId,
            eventId: event?.id,
            observation,
            rpmStart: rpmRange?.[0],
            rpmEnd: rpmRange?.[1],
            recommendedTable: tableName,
            reason: relevance,
          },
        },
      },
    ];
  });
}


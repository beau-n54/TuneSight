import type {
  PresentationCrossReference,
  PresentationEvent,
  PresentationRootCause,
} from "./evidenceHierarchyPresentation";

const TIMING_EVENT_TYPES = new Set([
  "timing_correction",
  "multi_cyl_timing_correction",
]);

const CYLINDER_CHANNEL_PATTERN = /^timing_correction_cyl_([1-9]\d*)$/;

export type CylinderEvidencePresentation = {
  channel: string;
  label: string;
  value: number | null;
};

export type CylinderIntelligencePresentation = {
  eventId: string;
  state: "explained" | "event_only";
  title: "Cylinder Timing Observation";
  severity?: string;
  eventConfidence?: number;
  rpmRange: readonly [number, number] | null;
  primaryCause: string | null;
  causeConfidence: number | null;
  affectedCylinders: readonly CylinderEvidencePresentation[];
  sourceEvidence: readonly string[];
  rejectedAlternatives: readonly {
    cause: string;
    reason: string;
    confidence?: number;
  }[];
  inspectionDirection: string | null;
  provenance: {
    source: "qualified_engineering_event";
    eventId: string;
    eventType: string;
  };
};

export function humanizeCylinderChannel(channel: string): string | null {
  const match = channel.match(CYLINDER_CHANNEL_PATTERN);
  return match ? `Cylinder ${match[1]}` : null;
}

export function humanizeCylinderIdentifiersInText(value: string): string {
  return value.replace(
    /timing_correction_cyl_([1-9]\d*)/g,
    (_identifier, cylinder: string) => `Cylinder ${cylinder}`
  );
}

function selectPrimaryCause(
  crossReference: PresentationCrossReference | undefined
): PresentationRootCause | null {
  return (
    crossReference?.rootCauses?.find(
      (rootCause) => rootCause.rank === "primary" && rootCause.cause
    ) ?? null
  );
}

function buildAffectedCylinderEvidence(
  event: PresentationEvent
): CylinderEvidencePresentation[] {
  const channels = new Set([
    ...(event.supportingChannels ?? []),
    ...Object.keys(event.metrics ?? {}),
  ]);

  return [...channels].flatMap((channel) => {
    const label = humanizeCylinderChannel(channel);
    if (!label) return [];

    const metricValue = event.metrics?.[channel];

    return [
      {
        channel,
        label,
        value:
          typeof metricValue === "number" && Number.isFinite(metricValue)
            ? metricValue
            : null,
      },
    ];
  });
}

export function buildCylinderIntelligencePresentation(
  events: readonly PresentationEvent[],
  crossReferences: readonly PresentationCrossReference[]
): CylinderIntelligencePresentation[] {
  const crossReferenceByEventId = new Map(
    crossReferences.flatMap((crossReference) =>
      crossReference.eventId
        ? [[crossReference.eventId, crossReference] as const]
        : []
    )
  );
  const seenEventIds = new Set<string>();

  return events.flatMap((event) => {
    if (
      !event.id ||
      !event.type ||
      !TIMING_EVENT_TYPES.has(event.type) ||
      seenEventIds.has(event.id)
    ) {
      return [];
    }

    seenEventIds.add(event.id);
    const primaryCause = selectPrimaryCause(
      crossReferenceByEventId.get(event.id)
    );
    const rpmRange =
      typeof event.rpmStart === "number" &&
      Number.isFinite(event.rpmStart) &&
      typeof event.rpmEnd === "number" &&
      Number.isFinite(event.rpmEnd)
        ? ([event.rpmStart, event.rpmEnd] as const)
        : null;

    return [
      {
        eventId: event.id,
        state: primaryCause ? "explained" : "event_only",
        title: "Cylinder Timing Observation" as const,
        severity: event.severity,
        eventConfidence: event.confidence,
        rpmRange,
        primaryCause: primaryCause?.cause ?? null,
        causeConfidence:
          typeof primaryCause?.confidence === "number"
            ? primaryCause.confidence
            : null,
        affectedCylinders: buildAffectedCylinderEvidence(event),
        sourceEvidence: (event.evidence ?? []).map(
          humanizeCylinderIdentifiersInText
        ),
        rejectedAlternatives: primaryCause?.rejectedCauses ?? [],
        inspectionDirection: primaryCause?.suggestedDirection ?? null,
        provenance: {
          source: "qualified_engineering_event" as const,
          eventId: event.id,
          eventType: event.type,
        },
      },
    ];
  });
}

export type PresentationEvent = {
  id?: string;
  type?: string;
  confidence?: number;
  severity?: string;
  rpmStart?: number;
  rpmEnd?: number;
  evidence?: readonly string[];
  supportingChannels?: readonly string[];
  metrics?: Readonly<Record<string, number | string | boolean | null>>;
};

export type PresentationLikelyCause = {
  label?: string;
  score?: number;
  reason?: string;
};

export type PresentationRootCause = {
  rank?: "primary" | "secondary" | "tertiary";
  cause?: string;
  confidence?: number;
  evidence?: readonly RootCauseEvidence[];
  candidateCauses?: readonly CandidateCause[];
  confidenceBreakdown?: readonly ConfidenceFactor[];
  reasoningNarrative?: string;
  relatedTables?: readonly string[];
  rejectedCauses?: readonly RejectedCause[];
  suggestedDirection?: string;
};

export type PresentationCrossReference = {
  eventId?: string;
  likelyCauses?: readonly PresentationLikelyCause[];
  rootCauses?: readonly PresentationRootCause[];
  notes?: readonly string[];
};

export type EventObservation = {
  event: PresentationEvent;
  crossReference: PresentationCrossReference;
};

export type RepeatedObservationGroup = {
  eventType: string;
  observations: readonly EventObservation[];
};

export type CauseHierarchy = {
  primary: PresentationRootCause | null;
  alternatives: readonly PresentationRootCause[];
};

const ROOT_CAUSE_RANK = {
  primary: 0,
  secondary: 1,
  tertiary: 2,
} as const;

export function orderRootCauses(
  rootCauses: readonly PresentationRootCause[]
): PresentationRootCause[] {
  return rootCauses
    .map((cause, index) => ({ cause, index }))
    .sort((left, right) => {
      const leftRank = left.cause.rank
        ? ROOT_CAUSE_RANK[left.cause.rank]
        : Number.MAX_SAFE_INTEGER;
      const rightRank = right.cause.rank
        ? ROOT_CAUSE_RANK[right.cause.rank]
        : Number.MAX_SAFE_INTEGER;

      return leftRank - rightRank || left.index - right.index;
    })
    .map(({ cause }) => cause);
}

export function buildCauseHierarchy(
  rootCauses: readonly PresentationRootCause[]
): CauseHierarchy {
  const ordered = orderRootCauses(rootCauses);

  return {
    primary:
      ordered.find((cause) => cause.rank === "primary") ?? null,
    alternatives: ordered.filter(
      (cause) =>
        cause.rank === "secondary" || cause.rank === "tertiary"
    ),
  };
}

export function groupRepeatedEventObservations(
  events: readonly PresentationEvent[],
  crossReferences: readonly PresentationCrossReference[]
): RepeatedObservationGroup[] {
  const eventById = new Map(
    events.flatMap((event) =>
      event.id ? [[event.id, event] as const] : []
    )
  );
  const seenEventIds = new Set<string>();
  const groups = new Map<string, EventObservation[]>();

  for (const crossReference of crossReferences) {
    const eventId = crossReference.eventId;
    if (!eventId || seenEventIds.has(eventId)) {
      continue;
    }

    const event = eventById.get(eventId);
    if (!event?.type) {
      continue;
    }

    seenEventIds.add(eventId);
    const current = groups.get(event.type) ?? [];
    current.push({ event, crossReference });
    groups.set(event.type, current);
  }

  return [...groups.entries()]
    .filter(([, observations]) => observations.length > 1)
    .map(([eventType, observations]) => ({
      eventType,
      observations,
    }));
}

export function dedupeCrossReferencesByEventId(
  crossReferences: readonly PresentationCrossReference[]
): PresentationCrossReference[] {
  const seen = new Set<string>();

  return crossReferences.filter((crossReference) => {
    if (!crossReference.eventId) {
      return true;
    }

    if (seen.has(crossReference.eventId)) {
      return false;
    }

    seen.add(crossReference.eventId);
    return true;
  });
}

export function observationCountLabel(count: number): string {
  return `${count} distinct ${
    count === 1 ? "observation" : "observations"
  }`;
}
import type {
  CandidateCause,
  ConfidenceFactor,
  RejectedCause,
  RootCauseEvidence,
} from "@/lib/analysis/rootCauseEngine";

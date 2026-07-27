export type CorrelationRelationshipType =
  | "repeated_pattern"
  | "supporting_relationship"
  | "contradictory_relationship"
  | "dependent_evidence"
  | "shared_cause_relationship"
  | "unresolved_relationship";

export type CorrelationStrength =
  | "strong"
  | "moderate"
  | "limited"
  | "unresolved"
  | "contradictory";

export type CorrelationEvent = {
  id?: string;
  type?: string;
  startIndex?: number;
  endIndex?: number;
  rpmStart?: number;
  rpmEnd?: number;
  severity?: string;
  confidence?: number;
  supportingChannels?: readonly string[];
  evidence?: readonly string[];
};

export type CorrelationPull = {
  id?: string;
  startIndex?: number;
  endIndex?: number;
};

export type CorrelationRootCause = {
  rank?: "primary" | "secondary" | "tertiary";
  cause?: string;
  confidence?: number;
  rejectedCauses?: readonly {
    cause?: string;
    confidence?: number;
    reason?: string;
  }[];
};

export type CorrelationCrossReference = {
  eventId?: string;
  rootCauses?: readonly CorrelationRootCause[];
};

export type CorrelationEvidenceReference = {
  eventId: string;
  evidenceIndex: number;
  statement: string;
};

export type CorrelationProvenance = {
  analysisId?: string;
  eventIds: readonly string[];
  crossReferenceEventIds: readonly string[];
  pullIds: readonly string[];
  evidenceReferences: readonly CorrelationEvidenceReference[];
};

export type CorrelationGroup = {
  id: string;
  label: string;
  relationshipType: CorrelationRelationshipType;
  relatedEventIds: readonly string[];
  relatedPullIds: readonly string[];
  sharedFamily?: string;
  sharedChannels: readonly string[];
  supportingEvidence: readonly CorrelationEvidenceReference[];
  contradictingEvidence: readonly string[];
  dependencyClassification:
    | "independent_observations"
    | "shared_signal_dependency"
    | "mixed"
    | "unresolved";
  strength: CorrelationStrength;
  unresolvedLimitations: readonly string[];
  provenance: CorrelationProvenance;
  appliedRuleIds: readonly string[];
};

export type ConservativeCorrelationResult = {
  groups: readonly CorrelationGroup[];
  uncorrelatedEventIds: readonly string[];
};

export type ConservativeCorrelationInput = {
  analysisId?: string;
  events?: readonly CorrelationEvent[];
  pullWindows?: readonly CorrelationPull[];
  crossReferences?: readonly CorrelationCrossReference[];
};

export const CORRELATION_RULES = {
  repeatedEventPattern: {
    id: "COR-V1-REPEATED-EVENT-TYPE",
    description:
      "Distinct events of the same authoritative type establish repetition only.",
    requiredInputs: ["two distinct event IDs", "same event type"],
    blockingConditions: ["fewer than two distinct events"],
  },
  sharedSignalDependency: {
    id: "COR-V1-SHARED-SIGNAL-DEPENDENCY",
    description:
      "Overlapping observations using the same channels are dependent evidence, not independent corroboration.",
    requiredInputs: [
      "two distinct event IDs",
      "overlapping sample regions",
      "at least one shared supporting channel",
    ],
    blockingConditions: ["no shared channel", "non-overlapping regions"],
  },
  sharedAuthoritativeCause: {
    id: "COR-V1-SHARED-AUTHORITATIVE-CAUSE",
    description:
      "The same explicitly primary owner-domain cause may be recorded across distinct events without becoming a global diagnosis.",
    requiredInputs: [
      "two distinct event IDs",
      "same explicitly primary cause",
    ],
    blockingConditions: [
      "missing explicit primary rank",
      "cause rejected by a contributing event",
    ],
  },
  contradictoryCause: {
    id: "COR-V1-CONTRADICTORY-CAUSE",
    description:
      "An explicitly primary cause that another event explicitly rejects remains a contradictory relationship.",
    requiredInputs: [
      "explicit primary cause",
      "same cause explicitly rejected by another event",
    ],
    blockingConditions: ["no explicit owner-domain rejection"],
  },
} as const;

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function stableGroupId(
  ruleId: string,
  discriminator: string,
  eventIds: readonly string[]
): string {
  const normalized = discriminator
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${ruleId.toLowerCase()}-${normalized}-${[...eventIds]
    .sort()
    .join("-")}`;
}

function eventEvidence(
  events: readonly CorrelationEvent[]
): CorrelationEvidenceReference[] {
  return events.flatMap((event) =>
    event.id
      ? (event.evidence ?? []).map((statement, evidenceIndex) => ({
          eventId: event.id as string,
          evidenceIndex,
          statement,
        }))
      : []
  );
}

function pullIdsForEvent(
  event: CorrelationEvent,
  pulls: readonly CorrelationPull[]
): string[] {
  if (
    typeof event.startIndex !== "number" ||
    typeof event.endIndex !== "number"
  ) {
    return [];
  }
  const eventStart = event.startIndex;
  const eventEnd = event.endIndex;

  return pulls.flatMap((pull, index) => {
    if (
      typeof pull.startIndex !== "number" ||
      typeof pull.endIndex !== "number"
    ) {
      return [];
    }

    const overlaps =
      eventStart <= pull.endIndex &&
      eventEnd >= pull.startIndex;

    return overlaps ? [pull.id ?? `pull_${index + 1}`] : [];
  });
}

function buildProvenance(
  input: ConservativeCorrelationInput,
  events: readonly CorrelationEvent[]
): CorrelationProvenance {
  const eventIds = events.flatMap((event) => (event.id ? [event.id] : []));
  const crossReferenceEventIds = (input.crossReferences ?? []).flatMap(
    (crossReference) =>
      crossReference.eventId &&
      eventIds.includes(crossReference.eventId)
        ? [crossReference.eventId]
        : []
  );
  const pullIds = unique(
    events.flatMap((event) =>
      pullIdsForEvent(event, input.pullWindows ?? [])
    )
  );

  return {
    analysisId: input.analysisId,
    eventIds,
    crossReferenceEventIds: unique(crossReferenceEventIds),
    pullIds,
    evidenceReferences: eventEvidence(events),
  };
}

function commonChannels(events: readonly CorrelationEvent[]): string[] {
  if (events.length === 0) {
    return [];
  }

  return unique(events[0].supportingChannels ?? []).filter((channel) =>
    events.every((event) =>
      (event.supportingChannels ?? []).includes(channel)
    )
  );
}

function humanizeEventType(type: string): string {
  return type
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function repeatedPatternGroups(
  input: ConservativeCorrelationInput,
  events: readonly CorrelationEvent[]
): CorrelationGroup[] {
  const byType = new Map<string, CorrelationEvent[]>();

  for (const event of events) {
    if (!event.type) continue;
    const current = byType.get(event.type) ?? [];
    current.push(event);
    byType.set(event.type, current);
  }

  return [...byType.entries()].flatMap(([type, matches]) => {
    const distinct = matches.filter(
      (event, index, all) =>
        !!event.id &&
        all.findIndex((candidate) => candidate.id === event.id) === index
    );

    if (distinct.length < 2) return [];

    const provenance = buildProvenance(input, distinct);
    const pullCount = provenance.pullIds.length;
    const sharedChannels = commonChannels(distinct);
    const wgdc = type === "wgdc_saturation";

    return [
      {
        id: stableGroupId(
          CORRELATION_RULES.repeatedEventPattern.id,
          type,
          provenance.eventIds
        ),
        label: wgdc
          ? "WGDC Control Saturation Pattern"
          : `${humanizeEventType(type)} Pattern`,
        relationshipType: "repeated_pattern" as const,
        relatedEventIds: provenance.eventIds,
        relatedPullIds: provenance.pullIds,
        sharedFamily: type,
        sharedChannels,
        supportingEvidence: provenance.evidenceReferences,
        contradictingEvidence: [],
        dependencyClassification: "independent_observations" as const,
        strength:
          pullCount >= 3
            ? ("strong" as const)
            : ("moderate" as const),
        unresolvedLimitations: wgdc
          ? [
              "The repeated relationship does not establish the underlying mechanical or calibration cause.",
            ]
          : [
              "Repetition does not establish a shared underlying cause.",
            ],
        provenance,
        appliedRuleIds: [
          CORRELATION_RULES.repeatedEventPattern.id,
        ],
      },
    ];
  });
}

function regionsOverlap(
  left: CorrelationEvent,
  right: CorrelationEvent
): boolean {
  return (
    typeof left.startIndex === "number" &&
    typeof left.endIndex === "number" &&
    typeof right.startIndex === "number" &&
    typeof right.endIndex === "number" &&
    left.startIndex <= right.endIndex &&
    left.endIndex >= right.startIndex
  );
}

function dependentEvidenceGroups(
  input: ConservativeCorrelationInput,
  events: readonly CorrelationEvent[]
): CorrelationGroup[] {
  const groups: CorrelationGroup[] = [];

  for (let leftIndex = 0; leftIndex < events.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < events.length;
      rightIndex += 1
    ) {
      const pair = [events[leftIndex], events[rightIndex]];
      if (
        !pair[0].id ||
        !pair[1].id ||
        pair[0].id === pair[1].id ||
        pair[0].type === pair[1].type ||
        !regionsOverlap(pair[0], pair[1])
      ) {
        continue;
      }

      const sharedChannels = commonChannels(pair);
      if (sharedChannels.length === 0) continue;

      const provenance = buildProvenance(input, pair);
      groups.push({
        id: stableGroupId(
          CORRELATION_RULES.sharedSignalDependency.id,
          sharedChannels.join("-"),
          provenance.eventIds
        ),
        label: "Shared Signal Dependency",
        relationshipType: "dependent_evidence",
        relatedEventIds: provenance.eventIds,
        relatedPullIds: provenance.pullIds,
        sharedChannels,
        supportingEvidence: provenance.evidenceReferences,
        contradictingEvidence: [],
        dependencyClassification: "shared_signal_dependency",
        strength: "limited",
        unresolvedLimitations: [
          "The observations share source telemetry and are not independent corroboration.",
        ],
        provenance,
        appliedRuleIds: [
          CORRELATION_RULES.sharedSignalDependency.id,
        ],
      });
    }
  }

  return groups;
}

function primaryCausesByEvent(
  crossReferences: readonly CorrelationCrossReference[]
): Map<string, string[]> {
  return new Map(
    crossReferences.flatMap((crossReference) =>
      crossReference.eventId
        ? [
            [
              crossReference.eventId,
              unique(
                (crossReference.rootCauses ?? []).flatMap((cause) =>
                  cause.rank === "primary" && cause.cause
                    ? [cause.cause]
                    : []
                )
              ),
            ] as const,
          ]
        : []
    )
  );
}

function rejectedCausesByEvent(
  crossReferences: readonly CorrelationCrossReference[]
): Map<string, string[]> {
  return new Map(
    crossReferences.flatMap((crossReference) =>
      crossReference.eventId
        ? [
            [
              crossReference.eventId,
              unique(
                (crossReference.rootCauses ?? []).flatMap((cause) =>
                  (cause.rejectedCauses ?? []).flatMap((rejected) =>
                    rejected.cause ? [rejected.cause] : []
                  )
                )
              ),
            ] as const,
          ]
        : []
    )
  );
}

function causeRelationshipGroups(
  input: ConservativeCorrelationInput,
  events: readonly CorrelationEvent[]
): CorrelationGroup[] {
  const crossReferences = input.crossReferences ?? [];
  const primaryByEvent = primaryCausesByEvent(crossReferences);
  const rejectedByEvent = rejectedCausesByEvent(crossReferences);
  const byCause = new Map<string, CorrelationEvent[]>();

  for (const event of events) {
    if (!event.id) continue;
    for (const cause of primaryByEvent.get(event.id) ?? []) {
      const current = byCause.get(cause) ?? [];
      current.push(event);
      byCause.set(cause, current);
    }
  }

  return [...byCause.entries()].flatMap(([cause, matches]) => {
    const distinct = matches.filter(
      (event, index, all) =>
        !!event.id &&
        all.findIndex((candidate) => candidate.id === event.id) === index
    );
    if (distinct.length < 2) return [];

    const contradictingEventIds = events.flatMap((event) =>
      event.id && (rejectedByEvent.get(event.id) ?? []).includes(cause)
        ? [event.id]
        : []
    );
    const provenance = buildProvenance(input, [
      ...distinct,
      ...events.filter(
        (event) =>
          !!event.id && contradictingEventIds.includes(event.id)
      ),
    ]);
    const contradictory = contradictingEventIds.length > 0;

    return [
      {
        id: stableGroupId(
          contradictory
            ? CORRELATION_RULES.contradictoryCause.id
            : CORRELATION_RULES.sharedAuthoritativeCause.id,
          cause,
          provenance.eventIds
        ),
        label: contradictory
          ? `Contradictory ${cause} Relationship`
          : `Shared ${cause} Relationship`,
        relationshipType: contradictory
          ? ("contradictory_relationship" as const)
          : ("shared_cause_relationship" as const),
        relatedEventIds: provenance.eventIds,
        relatedPullIds: provenance.pullIds,
        sharedFamily: cause,
        sharedChannels: commonChannels(distinct),
        supportingEvidence: eventEvidence(distinct),
        contradictingEvidence: contradictingEventIds.map(
          (eventId) =>
            `${eventId} explicitly rejects ${cause}.`
        ),
        dependencyClassification: "mixed" as const,
        strength: contradictory
          ? ("contradictory" as const)
          : ("moderate" as const),
        unresolvedLimitations: [
          contradictory
            ? "Explicit owner-domain rejection blocks an unqualified shared relationship."
            : "The shared event-level cause remains a relationship and is not a global diagnosis.",
        ],
        provenance,
        appliedRuleIds: [
          contradictory
            ? CORRELATION_RULES.contradictoryCause.id
            : CORRELATION_RULES.sharedAuthoritativeCause.id,
        ],
      },
    ];
  });
}

export function correlateEngineeringObservations(
  input: ConservativeCorrelationInput
): ConservativeCorrelationResult {
  const events = (input.events ?? []).filter(
    (event): event is CorrelationEvent & { id: string } => !!event.id
  );
  const groups = [
    ...repeatedPatternGroups(input, events),
    ...causeRelationshipGroups(input, events),
    ...dependentEvidenceGroups(input, events),
  ];
  const correlated = new Set(
    groups.flatMap((group) => group.relatedEventIds)
  );

  return {
    groups,
    uncorrelatedEventIds: events.flatMap((event) =>
      correlated.has(event.id) ? [] : [event.id]
    ),
  };
}

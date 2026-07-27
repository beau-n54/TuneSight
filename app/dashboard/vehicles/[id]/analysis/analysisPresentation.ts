import type {
  PresentationCrossReference,
  PresentationEvent,
  PresentationRootCause,
} from "./evidenceHierarchyPresentation";

export type EventPresentationGroup = {
  eventType: string;
  events: readonly PresentationEvent[];
};

export type GlobalPresentationNote = {
  text: string;
  sourceEventIds: readonly string[];
};

export type NotePresentationHierarchy = {
  globalNotes: readonly GlobalPresentationNote[];
  eventSpecificNotes: ReadonlyMap<string, readonly string[]>;
};

export type ScopedPrimaryResult = {
  event: PresentationEvent;
  crossReference: PresentationCrossReference;
  rootCause: PresentationRootCause;
};

const GLOBAL_TUNE_NOTE_PREFIXES = [
  "Tune profile available for V3 reasoning.",
  "Detected platform:",
  "Strategy hint:",
  "ROM hint:",
  "Boost intent:",
  "Ignition intent:",
  "Fueling intent:",
] as const;

export const STANDARD_INSPECTION_PANEL_GEOMETRY =
  "grid h-[31rem] grid-rows-[8.5rem_minmax(0,1fr)_3.75rem]";

export const WIDE_INSPECTION_PANEL_GEOMETRY =
  "grid h-[34rem] grid-rows-[8.5rem_minmax(0,1fr)_3.75rem]";

export function isAnalysisWideTuneNote(note: string): boolean {
  return GLOBAL_TUNE_NOTE_PREFIXES.some((prefix) =>
    note.startsWith(prefix)
  );
}

export function groupEventsForPresentation(
  events: readonly PresentationEvent[]
): EventPresentationGroup[] {
  const groups = new Map<string, PresentationEvent[]>();

  for (const event of events) {
    const eventType = event.type ?? "unknown_event";
    const current = groups.get(eventType) ?? [];
    current.push(event);
    groups.set(eventType, current);
  }

  return [...groups.entries()].map(([eventType, groupedEvents]) => ({
    eventType,
    events: groupedEvents,
  }));
}

export function classifyCrossReferenceNotes(
  crossReferences: readonly PresentationCrossReference[]
): NotePresentationHierarchy {
  const globalByText = new Map<string, string[]>();
  const eventSpecificNotes = new Map<string, readonly string[]>();

  for (const crossReference of crossReferences) {
    const eventId = crossReference.eventId;
    if (!eventId) continue;

    const eventNotes: string[] = [];
    for (const note of crossReference.notes ?? []) {
      if (isAnalysisWideTuneNote(note)) {
        const sources = globalByText.get(note) ?? [];
        if (!sources.includes(eventId)) sources.push(eventId);
        globalByText.set(note, sources);
      } else {
        eventNotes.push(note);
      }
    }

    eventSpecificNotes.set(eventId, eventNotes);
  }

  return {
    globalNotes: [...globalByText.entries()].map(
      ([text, sourceEventIds]) => ({
        text,
        sourceEventIds,
      })
    ),
    eventSpecificNotes,
  };
}

export function selectScopedPrimaryResults(
  events: readonly PresentationEvent[],
  crossReferences: readonly PresentationCrossReference[]
): ScopedPrimaryResult[] {
  const crossReferenceByEventId = new Map(
    crossReferences.flatMap((crossReference) =>
      crossReference.eventId
        ? [[crossReference.eventId, crossReference] as const]
        : []
    )
  );

  return events.flatMap((event) => {
    if (!event.id) return [];
    const crossReference = crossReferenceByEventId.get(event.id);
    if (!crossReference) return [];
    const primary = (crossReference.rootCauses ?? []).find(
      (rootCause) => rootCause.rank === "primary"
    );

    return primary
      ? [{ event, crossReference, rootCause: primary }]
      : [];
  });
}

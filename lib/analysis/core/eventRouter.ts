import type { DetectedEvent, RoutedEvent } from "../types";
import { priorityForEvent } from "./severityPolicy";
import { shouldSurfaceEvent, surfaceLevelForEvent } from "./surfacePolicy";
import { normalizedConfidence } from "./confidencePolicy";
import { categoryForEvent } from "./categoryPolicy";
import {
  reasoningForEvent,
  suggestedActionsForEvent,
} from "./eventMessaging";

function dedupeEvents(events: DetectedEvent[]): DetectedEvent[] {
  const seen = new Map<string, DetectedEvent>();

  for (const event of events) {
    const key = `${event.type}-${event.rpmStart}-${event.rpmEnd}`;

    const existing = seen.get(key);

    if (!existing || event.confidence > existing.confidence) {
      seen.set(key, event);
    }
  }

  return [...seen.values()];
}

export function routeDetectedEvents(events: DetectedEvent[]): RoutedEvent[] {
  return dedupeEvents(events)
    .map<RoutedEvent>((event) => {
      const normalizedEvent = {
        ...event,
        confidence: normalizedConfidence(event),
      };

      return {
        event: normalizedEvent,
        source: "detector",
        category: categoryForEvent(normalizedEvent.type),
        priority: priorityForEvent(normalizedEvent),
        surfaced: shouldSurfaceEvent(normalizedEvent),
        surfacedAs: surfaceLevelForEvent(normalizedEvent),
        reasoning: reasoningForEvent(normalizedEvent),
        suggestedActions: suggestedActionsForEvent(normalizedEvent),
      };
    })
    .sort((a, b) => b.priority - a.priority);
}
import type { DetectedEvent } from "../types";

export function priorityForEvent(event: DetectedEvent): number {
  const severityScore =
    event.severity === "critical"
      ? 100
      : event.severity === "high"
        ? 75
        : event.severity === "medium"
          ? 50
          : 25;

  return severityScore + Math.round(event.confidence * 10);
}
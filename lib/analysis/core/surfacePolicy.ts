import type { DetectedEvent, RoutedEvent } from "../types";

export function shouldSurfaceEvent(event: DetectedEvent): boolean {
  if (event.severity === "critical") {
    return true;
  }

  if (event.severity === "high" && event.confidence >= 0.65) {
    return true;
  }

  return false;
}

export function surfaceLevelForEvent(
  event: DetectedEvent
): RoutedEvent["surfacedAs"] {
  if (event.severity === "critical") {
    return "critical";
  }

  if (event.severity === "high") {
    return "warning";
  }

  if (event.severity === "medium") {
    return "info";
  }

  return "hidden";
}
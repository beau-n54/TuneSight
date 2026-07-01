import type { DetectedEvent } from "../types";

export function reasoningForEvent(event: DetectedEvent): string[] {
  const reasons: string[] = [];

  reasons.push(`Detected ${event.type} event with ${event.severity} severity.`);

  if (event.confidence >= 0.8) {
    reasons.push("High confidence detection based on supporting telemetry.");
  }

  if (event.rpmStart !== undefined && event.rpmEnd !== undefined) {
    reasons.push(
      `Event occurred between ${event.rpmStart} and ${event.rpmEnd} RPM.`
    );
  }

  return reasons;
}

export function suggestedActionsForEvent(event: DetectedEvent): string[] {
  const actions: string[] = [];

  if (event.type.includes("boost") || event.type.includes("wgdc")) {
    actions.push(
      "Review boost target, boost actual, WGDC, and throttle closure around this event."
    );
  }

  if (
    event.type.includes("fuel") ||
    event.type.includes("pressure") ||
    event.type.includes("lean")
  ) {
    actions.push(
      "Review rail pressure, LPFP pressure, AFR/lambda, and fuel demand around this event."
    );
  }

  if (event.type.includes("timing")) {
    actions.push(
      "Review timing corrections, ignition advance, IAT, fuel quality, and cylinder-specific knock activity."
    );
  }

  if (actions.length === 0) {
    actions.push("Review supporting channels and surrounding log data for context.");
  }

  return actions;
}
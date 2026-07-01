import type { DetectedEvent } from "../types";

export function normalizedConfidence(event: DetectedEvent): number {
  let confidence = event.confidence;

  if (event.severity === "critical") {
    confidence += 0.05;
  }

  if (event.supportingChannels.length >= 4) {
    confidence += 0.05;
  }

  return Math.min(1, Number(confidence.toFixed(2)));
}
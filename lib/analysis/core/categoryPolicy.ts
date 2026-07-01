import type { DetectedEvent, RoutedEvent } from "../types";

export function categoryForEvent(
  type: DetectedEvent["type"]
): RoutedEvent["category"] {
  if (
    type.includes("boost") ||
    type.includes("wgdc") ||
    type.includes("spool")
  ) {
    return "boost";
  }

  if (
    type.includes("fuel") ||
    type.includes("pressure") ||
    type.includes("lpfp") ||
    type.includes("hpfp") ||
    type.includes("lean")
  ) {
    return "fuel";
  }

  if (type.includes("timing")) {
    return "ignition";
  }

  if (type.includes("torque")) {
    return "torque";
  }

  if (type.includes("heat")) {
    return "thermal";
  }

  if (type.includes("throttle")) {
    return "airflow";
  }

  return "system";
}
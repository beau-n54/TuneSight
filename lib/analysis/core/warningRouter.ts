import type { AnalysisWarning } from "./analysisWarning";
import type { DetectedEvent, RoutedEvent } from "../types";

function severityFromWarning(
  severity: AnalysisWarning["severity"]
): DetectedEvent["severity"] {
  if (severity === "critical") return "critical";
  if (severity === "warning") return "high";
  return "low";
}

function categoryFromWarning(
  category: AnalysisWarning["category"]
): RoutedEvent["category"] {
  if (category === "temperature") return "thermal";
  if (category === "tune") return "system";
  if (category === "log") return "system";
  if (category === "general") return "system";

  return category;
}

export function routeAnalysisWarnings(
  warnings: AnalysisWarning[]
): RoutedEvent[] {
  return warnings.map<RoutedEvent>((warning) => {
    const event: DetectedEvent = {
      id: warning.id,
      type: "torque_intervention",
      severity: severityFromWarning(warning.severity),
      confidence: 0.7,
      startIndex: 0,
      endIndex: 0,
      rpmStart: 0,
      rpmEnd: 0,
      supportingChannels: [],
      evidence: [warning.title, warning.message],
      metrics: {},
    };

    return {
      event,
      source: "analysis_warning",
      category: categoryFromWarning(warning.category),
      priority: warning.severity === "critical" ? 90 : warning.severity === "warning" ? 65 : 25,
      surfaced: warning.severity !== "info",
      surfacedAs: warning.severity,
      reasoning: [warning.message],
      suggestedActions: [],
    };
  });
}
export type QualifiedWarningSeverity = {
  severity?: string;
};

export type IntelligentWarningsSummary = {
  state: "good" | "caution" | "warning";
  title: string;
  message: string;
};

const WARNING_SEVERITIES = new Set(["high", "critical", "warning"]);
const CAUTION_SEVERITIES = new Set(["low", "medium", "caution", "info"]);

export function buildIntelligentWarningsSummary(input: {
  events?: readonly QualifiedWarningSeverity[] | null;
  warnings?: readonly QualifiedWarningSeverity[] | null;
}): IntelligentWarningsSummary {
  const qualifiedFindings = [
    ...(input.events ?? []),
    ...(input.warnings ?? []),
  ];
  const normalizedSeverities = qualifiedFindings.flatMap((finding) =>
    typeof finding.severity === "string"
      ? [finding.severity.toLowerCase()]
      : []
  );

  if (
    normalizedSeverities.some((severity) =>
      WARNING_SEVERITIES.has(severity)
    )
  ) {
    return {
      state: "warning",
      title: "Significant Engineering Findings",
      message:
        "Significant engineering findings detected. Review the investigation records below.",
    };
  }

  if (
    qualifiedFindings.some(
      (finding) => typeof finding.severity !== "string"
    ) ||
    normalizedSeverities.some((severity) =>
      CAUTION_SEVERITIES.has(severity)
    )
  ) {
    return {
      state: "caution",
      title: "Engineering Observations Require Review",
      message: "Engineering observations require review.",
    };
  }

  return {
    state: "good",
    title: "No Significant Engineering Warnings",
    message: "No significant engineering warnings detected.",
  };
}

import type { GroupableDiagnosticEvent } from "./groupDiagnosticEvents";

export type HistoricalDiagnosticEvent = GroupableDiagnosticEvent & {
  category: string;
  source: string;
  priority: number;
  reasoning: string[];
  tone: "good" | "info" | "warn" | "bad";
  surfaceAs?: "critical" | "warning" | "info";
  message: string;
  event?: {
    type?: string;
    confidence?: number;
    rpmStart?: number;
    rpmEnd?: number;
  };
};

export type HistoricalSummaryInput = {
  warnings?: string[];
  maxBoost?: number | null;
  maxBoostTarget?: number | null;
  minRailPressure?: number | null;
  minLpfp?: number | null;
  maxIat?: number | null;
  cylinderCorrections?: Record<string, number | null | undefined>;
};

function calculateTrendDirection(
  values: Array<number | null | undefined>
): "improving" | "worsening" | "stable" | null {
  const filtered = values.filter(
    (value): value is number => typeof value === "number"
  );

  if (filtered.length < 3) {
    return null;
  }

  const first = filtered[0];
  const last = filtered[filtered.length - 1];
  const delta = last - first;

  if (Math.abs(delta) < 2) {
    return "stable";
  }

  return delta > 0 ? "worsening" : "improving";
}

function calculateTrendConfidence(
  values: Array<number | null | undefined>
): number {
  const filtered = values.filter(
    (value): value is number => typeof value === "number"
  );

  if (filtered.length < 2) {
    return 0.5;
  }

  const first = filtered[0];
  const last = filtered[filtered.length - 1];
  const delta = Math.abs(last - first);
  const confidence = 0.6 + Math.min(0.35, delta / 20);

  return Math.min(0.95, Number(confidence.toFixed(2)));
}

function findRepeatedCylinderCorrections(
  historicalSummaries: HistoricalSummaryInput[]
): Array<{
  cylinder: string;
  occurrences: number;
}> {
  const counts: Record<string, number> = {};

  for (const summary of historicalSummaries) {
    const corrections = summary.cylinderCorrections;

    if (!corrections) {
      continue;
    }

    for (const [cylinder, value] of Object.entries(corrections)) {
      if (typeof value !== "number") {
        continue;
      }

      if (value <= -3) {
        counts[cylinder] = (counts[cylinder] || 0) + 1;
      }
    }
  }

  return Object.entries(counts)
    .filter(([, occurrences]) => occurrences >= 2)
    .map(([cylinder, occurrences]) => ({
      cylinder,
      occurrences,
    }));
}

export function buildHistoricalDiagnosticEvents(
  historicalSummaries: HistoricalSummaryInput[]
): HistoricalDiagnosticEvent[] {
  if (!historicalSummaries || historicalSummaries.length < 2) {
    return [];
  }

  const recent = historicalSummaries.slice(-3);

  const iatTrend = calculateTrendDirection(
    recent.map((summary) => summary.maxIat)
  );

  const railTrend = calculateTrendDirection(
    recent.map((summary) => summary.minRailPressure)
  );

  const boostTrendValues = recent.map((summary) => {
    if (
      typeof summary.maxBoost !== "number" ||
      typeof summary.maxBoostTarget !== "number"
    ) {
      return null;
    }

    return Math.abs(summary.maxBoost - summary.maxBoostTarget);
  });

  const boostTrend = calculateTrendDirection(boostTrendValues);

  const iatTrendConfidence = calculateTrendConfidence(
    recent.map((summary) => summary.maxIat)
  );

  const railTrendConfidence = calculateTrendConfidence(
    recent.map((summary) => summary.minRailPressure)
  );

  const boostTrendConfidence = calculateTrendConfidence(boostTrendValues);

  const repeatedCylinderCorrections =
    findRepeatedCylinderCorrections(recent);

  const repeatedWarnings = recent
    .flatMap((summary) => summary.warnings || [])
    .reduce<Record<string, number>>((counts, warning) => {
      counts[warning] = (counts[warning] || 0) + 1;
      return counts;
    }, {});

  const repeatedWarningEvents: HistoricalDiagnosticEvent[] = Object.entries(
    repeatedWarnings
  )
    .filter(([, count]) => count >= 2)
    .map(([warning, count]) => ({
      category: "Historical Pattern",
      source: "historical-comparison",
      priority: count >= 3 ? 90 : count === 2 ? 75 : 50,
      tone: count >= 3 ? "bad" : count === 2 ? "warn" : "info",
      surfaceAs: count >= 3 ? "critical" : count === 2 ? "warning" : "info",
      message: `This issue appeared in ${count} recent logs.`,
      reasoning: [
        `Repeated warning detected: ${warning}`,
        `Observed across ${count} of the last ${recent.length} logs.`,
      ],
      event: {
        type: "historical_repeated_warning",
        confidence: Math.min(0.95, 0.65 + count * 0.1),
      },
    }));

  const trendEvents: HistoricalDiagnosticEvent[] = [];

  if (iatTrend === "worsening") {
    trendEvents.push({
      category: "Thermal Trend",
      source: "historical-comparison",
      priority: 85,
      tone: "warn",
      surfaceAs: "warning",
      message: "IAT trend is worsening across recent logs.",
      reasoning: [
        "Intake air temperatures have increased over recent sessions.",
        "Thermal conditions may be degrading consistency or performance.",
      ],
      event: {
        type: "historical_iat_trend",
        confidence: iatTrendConfidence,
      },
    });
  }

  if (railTrend === "worsening") {
    trendEvents.push({
      category: "Fuel Pressure Trend",
      source: "historical-comparison",
      priority: 90,
      tone: "bad",
      surfaceAs: "critical",
      message: "Rail pressure trend is worsening across recent logs.",
      reasoning: [
        "Minimum rail pressure has declined over recent sessions.",
        "Fuel system stability may be degrading under load.",
      ],
      event: {
        type: "historical_rail_trend",
        confidence: railTrendConfidence,
      },
    });
  }

  if (boostTrend === "worsening") {
    trendEvents.push({
      category: "Boost Control Trend",
      source: "historical-comparison",
      priority: 88,
      tone: "warn",
      surfaceAs: "warning",
      message: "Boost control deviation is worsening across recent logs.",
      reasoning: [
        "The gap between boost and boost target has increased over recent sessions.",
        "Wastegate control, boost leaks, turbo response, or tune targeting may need review.",
      ],
      event: {
        type: "historical_boost_control_trend",
        confidence: boostTrendConfidence,
      },
    });
  }

  const cylinderEvents: HistoricalDiagnosticEvent[] =
    repeatedCylinderCorrections.map(({ cylinder, occurrences }) => ({
      category: "Cylinder Correction Trend",
      source: "historical-comparison",
      priority: occurrences >= 3 ? 92 : 78,
      tone: occurrences >= 3 ? "bad" : "warn",
      surfaceAs: occurrences >= 3 ? "critical" : "warning",
      message: `${cylinder} has shown repeated timing corrections across recent logs.`,
      reasoning: [
        `${cylinder} exceeded correction thresholds in ${occurrences} recent logs.`,
        "Persistent ignition instability may indicate fueling, ignition, injector, plug, coil, or mechanical issues.",
      ],
      event: {
        type: "historical_cylinder_correction",
        confidence: Math.min(0.96, 0.7 + occurrences * 0.08),
      },
    }));

  return [
    ...repeatedWarningEvents,
    ...trendEvents,
    ...cylinderEvents,
  ];
}
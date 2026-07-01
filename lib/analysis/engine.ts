import type {
  AnalysisResult,
  CrossReference,
  DetectedEvent,
  LogSummary,
  ParsedLog,
  QuickVerdict,
  SuggestedFix,
  TuneProfile,
  VehicleSetup,
  WarningCard,
} from "./types";

import { segmentPulls } from "../logs/segmentPulls";
import { detectEvents } from "../logs/detectEvents";
import { buildReasoningForEvent } from "./reasoningEngine";
import { analyzePerCylinderIntelligence } from "@/lib/logs/perCylinderIntelligence";
import {
  getFuelPressureThresholds,
  validateFuelAgainstTune,
} from "./fuelValidation";
import { runAnalysisPipeline } from "./core/analysisPipeline";
import { buildWarnings as buildPipelineWarnings } from "./core/buildWarnings";
import { routeDetectedEvents } from "./core/eventRouter";
import { routeAnalysisWarnings } from "./core/warningRouter";
import type { ParsedXdfTable } from "@/lib/xdf";
import { crossReferenceXdfTables } from "@/lib/xdf";

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function max(values: number[]): number | null {
  if (!values.length) return null;
  return Math.max(...values);
}

function min(values: number[]): number | null {
  if (!values.length) return null;
  return Math.min(...values);
}

function severityRank(severity: "low" | "medium" | "high" | "critical"): number {
  if (severity === "critical") return 4;
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  return 1;
}

function sortEvents(events: DetectedEvent[]): DetectedEvent[] {
  return [...events].sort((a, b) => {
    const severityDiff = severityRank(b.severity) - severityRank(a.severity);
    if (severityDiff !== 0) return severityDiff;
    return b.confidence - a.confidence;
  });
}

function buildSummary(parsedLog: ParsedLog): LogSummary {
  const boost = parsedLog.channels.boost || [];
  const rawBoostTarget =
  parsedLog.channels.boost_target ||
  parsedLog.channels.boostTarget ||
  parsedLog.channels.target_boost ||
  parsedLog.channels.boost_target_psi ||
  parsedLog.channels["boost target"] ||
  parsedLog.channels["boost target psi"] ||
  [];

const boostTarget = rawBoostTarget.map((value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return n;

  // Safety clamp for bad parser/unit scaling.
  // If target is showing 185–240 on a normal PSI test log, convert it back down.
  if (n > 80) return n / 10;

  return n;
});
  const iat = parsedLog.channels.iat || [];
  const afr = parsedLog.channels.afr || [];
  const rail = parsedLog.channels.rail_pressure || [];
  const lpfp = parsedLog.channels.lpfp || [];
  const wgdc = parsedLog.channels.wgdc || [];
  const ethanol = parsedLog.channels.ethanol || [];
  const throttle = parsedLog.channels.throttle || [];

  const cylTimingCorrections: Record<string, number | null> = {};

  Object.keys(parsedLog.channels)
    .filter((key) => key.startsWith("timing_correction_cyl_"))
    .forEach((key) => {
      cylTimingCorrections[key] = min(parsedLog.channels[key]);
    });

    const diagnosticTimeline = [];

if (typeof max(boost) === "number" && typeof max(boostTarget) === "number") {
  const boostError = max(boostTarget)! - max(boost)!;

  if (boostError > 3) {
    diagnosticTimeline.push({
      timestamp: 0,
      event: "Boost undershoot detected",
      severity: "medium" as const,
    });
  }
}

if ((min(rail) ?? 9999) < 1500) {
  diagnosticTimeline.push({
    timestamp: 0,
    event: "Rail pressure drop detected",
    severity: "high" as const,
  });
}

if ((min(lpfp) ?? 9999) < 50) {
  diagnosticTimeline.push({
    timestamp: 0,
    event: "LPFP pressure drop detected",
    severity: "medium" as const,
  });
}

if ((min(Object.values(cylTimingCorrections).filter(
  (value): value is number => typeof value === "number"
)) ?? 0) < -3) {
  diagnosticTimeline.push({
    timestamp: 0,
    event: "Timing correction detected",
    severity: "high" as const,
  });
}

    const worstCylinder =
  Object.entries(cylTimingCorrections)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number")
    .sort((a, b) => a[1] - b[1])[0]?.[0] ?? null;

  return {
    avgBoost: average(boost),
    maxBoost: max(boost),
    avgBoostTarget: average(boostTarget),
    maxBoostTarget: max(boostTarget),
    maxIat: max(iat),
    minAfr: min(afr),
    minRailPressure: min(rail),
    minLpfp: min(lpfp),
    maxWgdc: max(wgdc),
    ethanolContent: average(ethanol),
    throttleClosureDetected: throttle.some((value) => value < 70),
    telemetry: {
      rpm: parsedLog.rpm ?? (parsedLog.channels as any)?.rpm ?? [],
      boost,
      boostTarget,
      iat,
      afr,
      rail,
      railPressure: rail,
      rail_pressure: rail,
      lpfp,
      wgdc,
      ethanol,
      throttle,
      timing_correction_cyl_1: parsedLog.channels.timing_correction_cyl_1 ?? [],
      timing_correction_cyl_2: parsedLog.channels.timing_correction_cyl_2 ?? [],
      timing_correction_cyl_3: parsedLog.channels.timing_correction_cyl_3 ?? [],
      timing_correction_cyl_4: parsedLog.channels.timing_correction_cyl_4 ?? [],
      timing_correction_cyl_5: parsedLog.channels.timing_correction_cyl_5 ?? [],
      timing_correction_cyl_6: parsedLog.channels.timing_correction_cyl_6 ?? [],
   },
    max_timing_correction: min(
  Object.values(cylTimingCorrections).filter(
    (value): value is number => typeof value === "number"
  )
),

cyl1_max_timing_correction: cylTimingCorrections.timing_correction_cyl_1 ?? null,
cyl2_max_timing_correction: cylTimingCorrections.timing_correction_cyl_2 ?? null,
cyl3_max_timing_correction: cylTimingCorrections.timing_correction_cyl_3 ?? null,
cyl4_max_timing_correction: cylTimingCorrections.timing_correction_cyl_4 ?? null,
cyl5_max_timing_correction: cylTimingCorrections.timing_correction_cyl_5 ?? null,
cyl6_max_timing_correction: cylTimingCorrections.timing_correction_cyl_6 ?? null,

cylTimingCorrections,
worstCylinder,
diagnosticTimeline,
  };
}

function tuneConfidenceModifier(tune: TuneProfile | null): number {
  if (!tune) return -0.1;
  if (tune.parsingStatus !== "profiled") return -0.05;
  if (tune.detectedPlatform === "unknown") return -0.05;
  return 0.05;
}

function clampConfidence(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function buildCrossReferences(
  events: DetectedEvent[],
  vehicle: VehicleSetup | null,
  tuneProfile: TuneProfile | null
): CrossReference[] {
  return events.map((event) => ({
    eventId: event.id,
    ...buildReasoningForEvent({
      event,
      vehicle,
      tune: tuneProfile,
    }),
  }));
}

function buildEventWarnings(
  events: DetectedEvent[],
  crossReferences: CrossReference[],
  tuneProfile: TuneProfile | null
): WarningCard[] {
  const warnings: WarningCard[] = events.map((event): WarningCard => {
    const crossRef = crossReferences.find((c) => c.eventId === event.id);
    const topCause = crossRef?.likelyCauses?.[0]?.label;
    const tuneLimited = tuneProfile?.parsingStatus !== "profiled";

    let summary =
      event.evidence[0] || "Issue detected during pull analysis";

    if (topCause) {
      summary += ` Likely cause: ${topCause}.`;
    }

    if (tuneLimited) {
      summary += " Tune insight is currently metadata-level only.";
    }

    return {
      id: event.id,
      title: event.type.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      severity: event.severity,
      summary,
      rpmRange: [event.rpmStart, event.rpmEnd],
      confidence: clampConfidence(event.confidence + tuneConfidenceModifier(tuneProfile)),
      likelyCauses: crossRef?.likelyCauses || [],
      rootCauses: crossRef?.rootCauses || [],
      linkedSystems: [
        ...(crossRef?.primaryTuneAreas || []),
        ...(crossRef?.secondaryTuneAreas || []),
      ],
      supportingEvidence: event.evidence,
    };
  });

  return warnings.sort((a, b) => {
    const severityDiff = severityRank(b.severity) - severityRank(a.severity);
    if (severityDiff !== 0) return severityDiff;
    return b.confidence - a.confidence;
  });
}

function buildSuggestedFixes(
  events: DetectedEvent[],
  crossReferences: CrossReference[],
  tuneProfile: TuneProfile | null
): SuggestedFix[] {
  const fixes: SuggestedFix[] = events.map((event): SuggestedFix => {
    const crossRef = crossReferences.find((c) => c.eventId === event.id);
    const tuneAggressive = tuneProfile?.boostIntent === "aggressive";
    const tuneEthanol =
      tuneProfile?.fuelingIntent === "ethanol_blend" ||
      tuneProfile?.fuelingIntent === "full_ethanol";

    if (event.type === "boost_undershoot") {
      return {
        id: `fix_${event.id}`,
        eventId: event.id,
        title: tuneAggressive
          ? "Reduce aggressive boost demand or improve airflow"
          : "Review boost control strategy",
        recommendation: tuneAggressive
          ? "The tune profile suggests aggressive boost intent. Review upper-RPM boost target and WGDC strategy together, or improve airflow support."
          : "Review boost target, WGDC base, and compensation together before increasing duty further.",
        rationale:
          "Boost is not meeting requested target under the current control and setup conditions.",
        relatedTables: ["boost target", "WGDC"],
        affectedSystems: ["boost control", "load targeting"],
        risk: "medium",
      };
    }

    if (event.type === "top_end_taper") {
      return {
        id: `fix_${event.id}`,
        eventId: event.id,
        title: "Reshape late-pull boost demand",
        recommendation:
          "Review upper-RPM boost target and WGDC strategy together instead of commanding more top-end boost blindly.",
        rationale:
          "Top-end taper suggests the setup is falling away later in the pull rather than failing everywhere equally.",
        relatedTables: ["boost target", "WGDC", "IAT compensation"],
        affectedSystems: ["boost control", "top-end airflow"],
        risk: "medium",
      };
    }

    if (event.type === "rail_pressure_drop") {
      return {
        id: `fix_${event.id}`,
        eventId: event.id,
        title: tuneEthanol
          ? "Reduce ethanol fuel strain or upgrade support"
          : "Reduce fuel system strain",
        recommendation: tuneEthanol
          ? "The tune profile suggests ethanol fueling intent. Reduce load/boost demand or improve high-pressure fuel support."
          : "Review load and fueling demand before pushing harder.",
        rationale:
          "Rail pressure dropped under load, which indicates high-pressure fuel strain.",
        relatedTables: ["fueling", "load", "boost target"],
        affectedSystems: ["HPFP", "fuel demand"],
        risk: "high",
      };
    }

    if (event.type === "lpfp_drop") {
      return {
        id: `fix_${event.id}`,
        eventId: event.id,
        title: "Review low-pressure fuel support",
        recommendation:
          "Check whether low-pressure fuel support remains stable through the whole pull, especially later under sustained load.",
        rationale:
          "LPFP weakness can distort overall fueling behavior and amplify tune demand mismatches.",
        relatedTables: ["fueling", "load"],
        affectedSystems: ["LPFP", "fuel demand"],
        risk: "high",
      };
    }

    if (
      event.type === "timing_correction" ||
      event.type === "multi_cyl_timing_correction"
    ) {
      return {
        id: `fix_${event.id}`,
        eventId: event.id,
        title: "Review ignition and cylinder pressure demand",
        recommendation:
          "Review ignition timing, boost target, lambda target, and IAT compensation together rather than changing only one area.",
        rationale:
          "Timing correction under load often means the combined calibration demand is too aggressive for the current conditions.",
        relatedTables: ["ignition timing", "boost target", "lambda target", "IAT compensation"],
        affectedSystems: ["ignition", "boost", "fueling"],
        risk: "high",
      };
    }

    if (event.type === "heat_soak") {
      return {
        id: `fix_${event.id}`,
        eventId: event.id,
        title: "Account for thermal conditions",
        recommendation:
          "Reduce repeated hot-pull weighting and review IAT compensation before chasing more boost or timing.",
        rationale:
          "High charge temperatures reduce margin and can distort how the rest of the pull should be interpreted.",
        relatedTables: ["IAT compensation", "ignition timing", "boost target"],
        affectedSystems: ["thermal control", "ignition", "boost"],
        risk: "medium",
      };
    }

    if (event.type === "throttle_closure") {
      return {
        id: `fix_${event.id}`,
        eventId: event.id,
        title: "Review torque intervention path",
        recommendation:
          "Review torque limits, load targets, and throttle strategy together rather than treating closure as an isolated airflow problem.",
        rationale:
          "Throttle closure during a loaded pull often points to intervention logic.",
        relatedTables: ["torque/load limiters", "boost target", "throttle control"],
        affectedSystems: ["torque management", "boost control"],
        risk: "medium",
      };
    }

    if (event.type === "lean_under_load") {
      return {
        id: `fix_${event.id}`,
        eventId: event.id,
        title: "Correct lean load behavior",
        recommendation:
          "Review lambda targets, fueling demand, and load request together before increasing power demand.",
        rationale:
          "Lean behavior under load usually means fueling support or fueling calibration is insufficient.",
        relatedTables: ["lambda target", "fueling", "load"],
        affectedSystems: ["fueling", "load control"],
        risk: "high",
      };
    }

    return {
      id: `fix_${event.id}`,
      eventId: event.id,
      title: "Review related tune areas",
      recommendation:
        "Inspect the mapped tune systems connected to this event before making isolated changes.",
      rationale:
        "This issue is better handled as a system-level review than a single-table change.",
      relatedTables: crossRef?.primaryTuneAreas || [],
      affectedSystems: crossRef?.primaryTuneAreas || [],
      risk: "medium",
    };
  });

  return fixes.sort((a, b) => {
    const riskRank: Record<SuggestedFix["risk"], number> = {
      high: 3,
      medium: 2,
      low: 1,
    };
    return riskRank[b.risk] - riskRank[a.risk];
  });
}

function buildQuickVerdict(
  events: DetectedEvent[],
  pullQuality: "strong" | "usable" | "questionable",
  tuneProfile: TuneProfile | null
): QuickVerdict {
  const criticalCount = events.filter((e) => e.severity === "critical").length;
  const highCount = events.filter((e) => e.severity === "high").length;
  const mediumCount = events.filter((e) => e.severity === "medium").length;

  let summary = "No major critical issues were detected in this first-pass analysis.";

  if (criticalCount > 0) {
    summary =
      "Critical issues were detected in the latest analysis. The pull suggests meaningful safety, fueling, or control concerns.";
  } else if (highCount >= 2 || highCount + mediumCount >= 3) {
    summary =
      "The log shows multiple meaningful issues that need review before pushing harder.";
  } else if (highCount === 1 || mediumCount >= 1) {
    summary =
      "The engine analysis found at least one meaningful issue worth reviewing, even if no immediate critical event was detected.";
  }

  if (tuneProfile?.parsingStatus !== "profiled") {
    summary += " Tune insight is currently metadata-level only.";
  }

  if (!tuneProfile) {
    summary += " No tune profile is currently available.";
  }

  if (criticalCount > 0) {
    return {
      status: "critical",
      summary,
      confidence: clampConfidence(0.9 + tuneConfidenceModifier(tuneProfile)),
      pullQuality,
    };
  }

  if (highCount >= 1 || mediumCount >= 1) {
    return {
      status: "caution",
      summary,
      confidence: clampConfidence(0.8 + tuneConfidenceModifier(tuneProfile)),
      pullQuality,
    };
  }

  return {
    status: "healthy",
    summary,
    confidence: clampConfidence(0.72 + tuneConfidenceModifier(tuneProfile)),
    pullQuality,
  };
}

type PerCylinderRow = Record<string, number | string | null | undefined>;

export function buildAnalysisResult(input: {
  parsedLog: ParsedLog;
  vehicle: VehicleSetup | null;
  tuneProfile: TuneProfile | null;
  xdfTables?: ParsedXdfTable[];
}): AnalysisResult {
  const pullWindows = segmentPulls(input.parsedLog);
  const summary = buildSummary(input.parsedLog);

  const perCylinderAnalysis = analyzePerCylinderIntelligence(
  Object.entries(input.parsedLog.channels).map(([key, values]) => {
    return values.reduce<PerCylinderRow[]>((rows, value, index) => {
  if (!rows[index]) {
    rows[index] = {};
  }

  rows[index][key] = value;

  return rows;
}, []);
  }).flat()
);

  const fuelValidation = validateFuelAgainstTune({
  platform: "n54",

  ethanolContent: Number(
    (summary as any).ethanolContent ??
      (summary as any).ethanol_content
  ),

  fuelingIntent:
    (input.tuneProfile as any)?.fuelingIntent ??
    (input.tuneProfile as any)?.fueling_intent,
});

const pipelineResult = runAnalysisPipeline({
  platform: "n54",

  ethanolContent: Number(
    (summary as any).ethanolContent ??
      (summary as any).ethanol_content
  ),

  maxBoost: Number(
    (summary as any).maxBoost ??
      (summary as any).max_boost
  ),

  maxBoostTarget: Number(
    (summary as any).maxBoostTarget ??
      (summary as any).max_boost_target
  ),

  maxWgdc: Number(summary.maxWgdc),

 boostIntent: input.tuneProfile?.boostIntent,

  fuelingIntent: input.tuneProfile?.fuelingIntent,

});


const boostValidation = pipelineResult.boost;
const pipelineWarnings = buildPipelineWarnings(pipelineResult);
const fuelPressureThresholds = getFuelPressureThresholds(
  fuelValidation.detectedFuel
);

  const rawEvents = detectEvents(input.parsedLog, pullWindows, {
  railDropThreshold: fuelPressureThresholds.minRailPressure,
  railCriticalThreshold: Math.round(
    fuelPressureThresholds.minRailPressure * 0.82
  ),
  lpfpDropThreshold: fuelPressureThresholds.minLpfpPressure,
  lpfpCriticalThreshold: Math.round(
    fuelPressureThresholds.minLpfpPressure * 0.75
  ),
});
  const events = sortEvents(rawEvents);
  const xdfFindingTypes = events.flatMap((event) => {
  const type = String((event as any)?.type ?? "").toLowerCase();

  if (type.includes("boost")) return ["overboost"];
  if (type.includes("rail")) return ["railPressureDrop"];
  if (type.includes("lpfp")) return ["lowLpfp"];
  if (type.includes("timing")) return ["timingCorrection"];
  if (type.includes("iat")) return ["highIat"];
  if (type.includes("throttle")) return ["throttleClosure"];

  return [];
});
  const routedWarningEvents = routeAnalysisWarnings(pipelineWarnings);

const routedEvents = [
  ...routeDetectedEvents(events),
  ...routedWarningEvents,
];

  const effectiveTuneProfile =
  input.tuneProfile &&
  Number((summary as any).ethanolContent ?? (summary as any).ethanol_content ?? 0) >= 50 &&
  (
    (input.tuneProfile as any).fuelingIntent === "pump" ||
    (input.tuneProfile as any).fueling_intent === "pump"
  )
    ? {
        ...input.tuneProfile,
        fuelingIntent: "full_ethanol",
        fueling_intent: "full_ethanol",
      }
    : input.tuneProfile;

 const xdfTables = input.xdfTables ?? [];

const xdfCrossReferences =
  typeof crossReferenceXdfTables === "function" && xdfTables.length > 0
    ? xdfFindingTypes.flatMap((findingType) =>
        crossReferenceXdfTables(findingType, xdfTables),
      )
    : [];

const crossReferences = buildCrossReferences(
  events,
  input.vehicle,
  effectiveTuneProfile as TuneProfile | null
);

const warnings = buildEventWarnings(
  events,
  crossReferences,
  effectiveTuneProfile as TuneProfile | null
);

const unifiedWarnings = [
  ...warnings,
  ...pipelineWarnings,
];

const suggestedFixes = buildSuggestedFixes(
  events,
  crossReferences,
  effectiveTuneProfile as TuneProfile | null
);

const bestPullQuality =
  pullWindows.find((p) => p.quality === "strong")?.quality ||
  pullWindows.find((p) => p.quality === "usable")?.quality ||
  "questionable";

const quickVerdict = buildQuickVerdict(
  events,
  bestPullQuality,
  effectiveTuneProfile as TuneProfile | null
);

  return {
  quickVerdict,
  warnings,
  pipelineWarnings,
  suggestedFixes,
  crossReferences,
  xdfCrossReferences,
  summary,
  fuelValidation,
  fuelPressureThresholds,
  events,
  routedEvents,
  pullWindows,
  telemetry: summary.telemetry,
  worstCylinder: summary.worstCylinder,
  diagnosticTimeline: summary.diagnosticTimeline,
};
}
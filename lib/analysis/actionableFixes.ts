import type { RoutedEvent } from "@/lib/analysis/types";

type FlagTone = "good" | "warn" | "bad" | "info";

type AnalysisFlag = {
  title: string;
  message: string;
  tone: FlagTone;
};

type EngineFix = {
  title?: string;
  recommendation?: string;
  rationale?: string;
  risk?: "low" | "medium" | "high";
};

type TuneProfileLike = {
  fueling_intent?: string | null;
  boost_intent?: string | null;
  ignition_intent?: string | null;
  detected_platform?: string | null;
};

export type ActionableFix = {
  title: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  confidence: number;
  source?: string;
  reason: string;
  actions: string[];
  checkFirst?: string;
  avoidUntilVerified?: string;
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && !Number.isNaN(value)) return value;

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

function calculateBoostError(
  maxBoost: unknown,
  maxBoostTarget: unknown
): number | null {
  const boost = toNumber(maxBoost);
  const target = toNumber(maxBoostTarget);

  if (boost === null || target === null) return null;
  return target - boost;
}

function rpmTargetHint(summary: any): string {
  const start = summary?.rpm_start ?? null;
  const end = summary?.rpm_end ?? null;

  if (start === null || end === null) {
    return "Review behaviour across the full pull.";
  }

  const mid = (start + end) / 2;

  if (mid < 3000) {
    return "Focus on spool region (low RPM / early boost).";
  }

  if (mid < 4500) {
    return "Focus on midrange load and torque demand.";
  }

  if (mid < 6000) {
    return "Focus on upper-midrange power delivery.";
  }

  return "Focus on top-end airflow and fuel demand.";
}

function rpmBand(summary: any): string {
  const rpm =
    Number(summary?.peak_issue_rpm) ||
    Number(summary?.peak_boost_rpm) ||
    Number(summary?.peak_timing_pull_rpm) ||
    Number(summary?.peak_load_rpm);

  if (!rpm || Number.isNaN(rpm)) {
    return "affected RPM region";
  }

  const low = Math.max(2000, Math.floor((rpm - 500) / 250) * 250);
  const high = Math.min(7500, Math.ceil((rpm + 500) / 250) * 250);

  return `${low}-${high} RPM`;
}

function loadBand(summary: any): string {
  const load =
    Number(summary?.peak_issue_load) ||
    Number(summary?.peak_boost_load) ||
    Number(summary?.peak_load);

  if (!load || Number.isNaN(load)) {
    return "affected load region";
  }

  const low = Math.max(40, Math.floor((load - 20) / 10) * 10);
  const high = Math.min(250, Math.ceil((load + 20) / 10) * 10);

  return `${low}-${high} load`;
}

function tableTargetHints(summary: any): string[] {
  const hints: string[] = [];

  const maxWgdc = Number(summary?.max_wgdc ?? NaN);
  const boostError = Number(summary?.max_boost_target ?? 0) - Number(summary?.max_boost ?? 0);
  const minRail = Number(summary?.min_rail_pressure ?? NaN);
  const minAfr = Number(summary?.min_afr ?? NaN);
  const maxIat = Number(summary?.max_iat ?? NaN);

  if (!Number.isNaN(maxWgdc) && maxWgdc > 75) {
    hints.push("Review WGDC table in the affected RPM/load region.");
  }

  if (boostError > 2) {
    hints.push("Review boost target vs WGDC balance in this region.");
  }

  if (!Number.isNaN(minRail) && minRail < 1500) {
    hints.push("Review fuel scalar, PI split, and rail pressure control tables.");
  }

  if (!Number.isNaN(minAfr) && minAfr > 13) {
    hints.push("Review lambda target and fueling tables under load.");
  }

  if (!Number.isNaN(maxIat) && maxIat > 50) {
    hints.push("Review IAT timing compensation and ignition tables.");
  }

  return hints;
}

function causeSpecificTableHints(
  title: string,
  summary: any
): string[] {
  const t = title.toLowerCase();

  const rpmRegion = rpmBand(summary);
  const loadRegion = loadBand(summary);

  if (t.includes("rail") || t.includes("hpfp")) {
    return [
      `Review fuel scalar around ${rpmRegion} / ${loadRegion}.`, 
      `Review PI split / supplemental fueling around ${rpmRegion} / ${loadRegion}.`,
      `Review rail pressure target/control around ${rpmRegion} / ${loadRegion}.`,
    ];
  }

  if (t.includes("lpfp")) {
    return [
      `Review low-pressure fuel compensation around ${rpmRegion} / ${loadRegion}.`,
      `Review LPFP control / voltage compensation around ${rpmRegion} / ${loadRegion}.`
    ];
  }

  if (t.includes("boost") || t.includes("wgdc")) {
    return [
      "Review WGDC base table in affected RPM/load area.",
      "Review boost target versus achievable turbo efficiency.",
      "Review spool / boost control compensation tables.",
    ];
  }

  if (t.includes("timing") || t.includes("knock")) {
    return [
      "Review ignition timing in affected load/RPM area.",
      "Review IAT timing compensation tables.",
      "Review knock sensitivity / correction strategy.",
    ];
  }

  if (t.includes("afr") || t.includes("lean")) {
    return [
      "Review lambda target tables under load.",
      "Review fuel scalar / injector characterization.",
      "Review enrichment / fuel compensation logic.",
    ];
  }

  if (t.includes("throttle")) {
    return [
      "Review torque limiter tables.",
      "Review requested load versus torque model.",
      "Review throttle intervention thresholds.",
    ];
  }

  return tableTargetHints(summary);
}

function correlationFixes(args: {
  summary: any;
  tuneProfile: TuneProfileLike | null;
  rpmHint: string;
}): ActionableFix[] {
  const { summary, tuneProfile, rpmHint } = args;

  const fixes: ActionableFix[] = [];
  const rootCauseMap = new Map<string, ActionableFix>();

  const ethanolContent = toNumber(summary?.ethanol_content);
  const minRailPressure = toNumber(summary?.min_rail_pressure);
  const minLpfp = toNumber(summary?.min_lpfp);
  const minAfr = toNumber(summary?.min_afr);
  const maxWgdc = toNumber(summary?.max_wgdc);
  const maxIat = toNumber(summary?.max_iat);
  const boostError = calculateBoostError(
    summary?.max_boost,
    summary?.max_boost_target
  );

  const timingValues = [
    summary?.cyl1_max_timing_correction,
    summary?.cyl2_max_timing_correction,
    summary?.cyl3_max_timing_correction,
    summary?.cyl4_max_timing_correction,
    summary?.cyl5_max_timing_correction,
    summary?.cyl6_max_timing_correction,
    summary?.max_timing_correction,
  ]
    .map(toNumber)
    .filter((v): v is number => v !== null);

  const worstTiming = timingValues.length ? Math.min(...timingValues) : null;

  const pumpTuneWithEthanol =
    tuneProfile?.fueling_intent === "pump" &&
    ethanolContent !== null &&
    ethanolContent >= 20;

  const railWeak = minRailPressure !== null && minRailPressure < 1500;
  const lpfpWeak = minLpfp !== null && minLpfp < 50;
  const lean = minAfr !== null && minAfr > 13;
  const boostControlStress =
    (maxWgdc !== null && maxWgdc > 75) ||
    (boostError !== null && boostError > 2);
  const knock = worstTiming !== null && worstTiming <= -3;
  const heat = maxIat !== null && maxIat > 50;

  if (pumpTuneWithEthanol && (railWeak || lpfpWeak || lean)) {
    rootCauseMap.set("boost_control", {
      title: "Root correlation: fuel mismatch driving fuel-system stress",
      priority: "HIGH",
      confidence: 95,
      source: "V5 cross-system correlation",
      reason:
        "Pump-style tune intent, ethanol content, and fuel pressure weakness are appearing together. Treat this as one root mismatch before chasing separate symptoms.",
      actions: [
        rpmHint,
        ...causeSpecificTableHints("High-pressure fuel system review", summary),
        "Align the fuel blend with the tune before doing more WOT pulls.",
        "If ethanol is intentional, use the correct ethanol/flex tune and confirm PI contribution.",
        "Only reassess HPFP/LPFP hardware after fuel and tune are aligned.",
      ],
    });
  }

  if ((railWeak || lpfpWeak) && boostControlStress) {
    fixes.push({
      title: "Root correlation: fuel supply may be limiting boost control",
      priority: "HIGH",
      confidence: 88,
      source: "V5 cross-system correlation",
      reason:
        "Fuel pressure weakness and boost control stress are present together. The boost issue may be a symptom of fuel/load limitation rather than only a turbo or leak problem.",
      actions: [
        rpmHint,
        ...causeSpecificTableHints("Boost control efficiency check", summary),
        ...causeSpecificTableHints("High-pressure fuel system review", summary),
        "Stabilise fuel pressure before increasing boost target or WGDC.",
        "Compare boost error, WGDC, rail pressure, and LPFP at the same RPM/load point.",
      ],
    });
  }

  if (knock && heat) {
    fixes.push({
      title: "Root correlation: heat is reducing knock margin",
      priority: "HIGH",
      confidence: 86,
      source: "V5 cross-system correlation",
      reason:
        "Timing correction and elevated IAT are present together. The knock issue may be temperature-driven rather than purely ignition-table related.",
      actions: [
        rpmHint,
        ...causeSpecificTableHints("Timing correction investigation", summary),
        "Improve charge-air cooling or allow more cooldown between pulls.",
        "Review IAT timing compensation before making broad ignition changes.",
        "Re-test when IAT is lower to confirm whether correction improves.",
      ],
    });
  }

  if (pumpTuneWithEthanol && knock) {
    fixes.push({
      title: "Root correlation: fuel mismatch may be contributing to knock",
      priority: "HIGH",
      confidence: 90,
      source: "V5 cross-system correlation",
      reason:
        "The tune profile looks pump-oriented, ethanol is present, and timing correction is showing. Confirm tune/fuel alignment before blaming the ignition map alone.",
      actions: [
        rpmHint,
        ...causeSpecificTableHints("Correct fuel-to-tune mismatch", summary),
        ...causeSpecificTableHints("Timing correction investigation", summary),
        "Confirm the tune is designed for the logged ethanol content.",
        "Do not add timing or boost until fuel/tune alignment is confirmed.",
      ],
    });
  }

  if (lean && (railWeak || lpfpWeak)) {
    fixes.push({
      title: "Root correlation: lean behaviour follows fuel-pressure weakness",
      priority: "HIGH",
      confidence: 91,
      source: "V5 cross-system correlation",
      reason:
        "Lean AFR and fuel pressure weakness are appearing together. Fuel delivery should be treated as the primary safety concern.",
      actions: [
        rpmHint,
        ...causeSpecificTableHints("Lean under-load fueling check", summary),
        ...causeSpecificTableHints("High-pressure fuel system review", summary),
        "Do not increase load until AFR and fuel pressure are stable together.",
        "Review lambda target, fuel scalar, PI contribution, HPFP, and LPFP as one system.",
      ],
    });
  }

  
 const groupedFixes = Array.from(rootCauseMap.values());

return [...groupedFixes, ...fixes];
}

export function buildActionableFixes(args: {
  tuneProfile: TuneProfileLike | null;
  summary: any;
  tuneReasoningFlags: AnalysisFlag[];
  warnings: AnalysisFlag[];
  routedEvents?: RoutedEvent[];
  engineFixes?: EngineFix[];
  historicalSummaries?: any[];
}): ActionableFix[] {

  const {
  tuneProfile,
  summary,
  tuneReasoningFlags,
  warnings,
  routedEvents = [],
  engineFixes = [],
  historicalSummaries = [],
} = args;

  if (!summary) return [];

  const fixes: ActionableFix[] = [];

  const rpmHint = rpmTargetHint(summary);
  const tableHints = tableTargetHints(summary);
  const repeatRailCount = historicalSummaries.filter((item) => {
  const row = item?.summary || item;
  return toNumber(row?.min_rail_pressure) !== null && toNumber(row?.min_rail_pressure)! < 1500;
}).length;

const repeatLpfpCount = historicalSummaries.filter((item) => {
  const row = item?.summary || item;
  return toNumber(row?.min_lpfp) !== null && toNumber(row?.min_lpfp)! < 50;
}).length;

const repeatBoostCount = historicalSummaries.filter((item) => {
  const row = item?.summary || item;
  const error = calculateBoostError(row?.max_boost, row?.max_boost_target);
  return error !== null && error > 2;
}).length;

const repeatTimingCount = historicalSummaries.filter((item) => {
  const row = item?.summary || item;

  const timingValues = [
    row?.cyl1_max_timing_correction,
    row?.cyl2_max_timing_correction,
    row?.cyl3_max_timing_correction,
    row?.cyl4_max_timing_correction,
    row?.cyl5_max_timing_correction,
    row?.cyl6_max_timing_correction,
    row?.max_timing_correction,
  ]
    .map(toNumber)
    .filter((v): v is number => v !== null);

  const worst = timingValues.length ? Math.min(...timingValues) : null;
  return worst !== null && worst <= -3;
}).length;

  const routedEventText = routedEvents
  .map((event) => `${event.category} ${event.reasoning}`)
  .join(" ");

const allText = [
  ...tuneReasoningFlags,
  ...warnings,
]
  .map((item) => `${item.title} ${item.message}`.toLowerCase())
  .join(" ")
  .concat(" ", routedEventText.toLowerCase());

  const has = (keyword: string) => allText.includes(keyword.toLowerCase());

  const ethanolContent = toNumber(summary?.ethanol_content);
  const minRailPressure = toNumber(summary?.min_rail_pressure);
  const minLpfp = toNumber(summary?.min_lpfp);
  const maxWgdc = toNumber(summary?.max_wgdc);
  const minAfr = toNumber(summary?.min_afr);
  const boostError = calculateBoostError(
    summary?.max_boost,
    summary?.max_boost_target
  );

  const timingValues = [
    summary?.cyl1_max_timing_correction,
    summary?.cyl2_max_timing_correction,
    summary?.cyl3_max_timing_correction,
    summary?.cyl4_max_timing_correction,
    summary?.cyl5_max_timing_correction,
    summary?.cyl6_max_timing_correction,
    summary?.max_timing_correction,
  ]
    .map(toNumber)
    .filter((v): v is number => v !== null);

  const worstTiming = timingValues.length ? Math.min(...timingValues) : null;

  if (
    has("fuel mismatch") ||
    (tuneProfile?.fueling_intent === "pump" &&
      ethanolContent !== null &&
      ethanolContent >= 20)
  ) {
    fixes.push({
      title: "Correct fuel-to-tune mismatch",
      priority: "HIGH",
      confidence: 92,
      checkFirst: "Verify actual ethanol content before changing tune calibration.",
avoidUntilVerified:
  "Do not increase boost or ignition advance until fuel/tune alignment is confirmed.",
      source: "Tune profile + logged ethanol content",
      reason:
        "The tune profile appears pump-based, but the log shows meaningful ethanol content. This can distort fuel pressure, AFR, timing, and knock behaviour.",
      actions: [
        rpmHint,
        ...causeSpecificTableHints("Correct fuel-to-tune mismatch", summary),
        "Confirm the actual fuel blend in the tank.",
        "If this tune is meant for pump fuel, reduce ethanol content before doing another pull.",
        "If ethanol is intentional, flash or upload the matching ethanol/flex-fuel tune.",
        "Re-log after the fuel and tune are aligned.",
      ],
    });
  }

  if (
    has("rail pressure") ||
    (minRailPressure !== null && minRailPressure < 1500)
  ) {
    fixes.push({
      title: "High-pressure fuel system review",
      priority: "HIGH",
      confidence: minRailPressure !== null && minRailPressure < 1000 ? 94 : 86,
      source: "Rail pressure behaviour",
      reason:
        "Rail pressure is dropping lower than expected under load. This can point to HPFP limitation, fuel demand mismatch, or ethanol demand exceeding support.",
      actions: [
        rpmHint,
        ...causeSpecificTableHints("High-pressure fuel system review", summary),
        "Reduce boost/load until rail pressure is stable.",
        "Verify HPFP condition and capacity for the current fuel blend.",
        "If port injection is fitted, review PI contribution under load.",
        "Compare rail pressure against RPM/load instead of only using min value.",
      ],
    });
  }

  if (has("lpfp") || (minLpfp !== null && minLpfp < 50)) {
    fixes.push({
      title: "Low-pressure fuel supply check",
      priority: minLpfp !== null && minLpfp < 40 ? "HIGH" : "MEDIUM",
      confidence: minLpfp !== null && minLpfp < 40 ? 91 : 82,
      source: "LPFP pressure behaviour",
      reason:
        "Low-pressure fuel is dropping harder than expected. LPFP weakness can starve the high-pressure side and destabilise fueling.",
      actions: [
        rpmHint,
        ...causeSpecificTableHints("Low-pressure fuel supply check", summary),
        "Check LPFP voltage, wiring, relay, grounds, and controller behaviour.",
        "Inspect fuel filter/regulator condition.",
        "Confirm the saved vehicle setup matches the real fuel pump setup.",
        "Avoid higher ethanol blends until LPFP pressure is stable.",
      ],
    });
  }

  if (
    has("knock") ||
    has("timing") ||
    (worstTiming !== null && worstTiming <= -3)
  ) {
    fixes.push({
      title: "Timing correction investigation",
      priority: "HIGH",
      confidence: worstTiming !== null && worstTiming <= -5 ? 91 : 83,
      source: "Timing correction behaviour",
      reason:
        "The log shows meaningful timing correction. If the tune profile is conservative, this is especially suspicious and points toward fuel quality, heat, plug/coil, or mismatch issues.",
      actions: [
        rpmHint,
        ...causeSpecificTableHints("Timing correction review", summary),
        "Confirm the fuel in the tank matches the tune.",
        "Check spark plugs, plug gap, and coil health.",
        "Review IAT and heat soak before adding boost or timing.",
        "Reduce ignition advance in the affected RPM/load area once table-level tuning is available.",
      ],
    });
  }

  if (has("throttle closure") || summary?.throttle_closure_detected === true) {
    fixes.push({
      title: "Torque intervention and throttle closure review",
      priority: "MEDIUM",
      confidence: 78,
      source: "Throttle closure behaviour",
      reason:
        "Throttle closure during a pull often points to torque intervention, load control, or protection logic rather than a simple mechanical boost issue.",
      actions: [
        rpmHint,
        ...causeSpecificTableHints("Torque intervention and throttle closure review", summary),
        "Review torque limits, load request, and throttle control logic.",
        "Check whether boost/load request is exceeding model limits.",
        "Compare closure point with timing correction and fuel pressure drops.",
        "Do not treat this as only a boost leak problem.",
      ],
    });
  }

  if (
    (maxWgdc !== null && maxWgdc > 75) ||
    (boostError !== null && boostError > 2)
  ) {
    fixes.push({
      title: "Boost control efficiency check",
      priority: boostError !== null && boostError > 3 ? "HIGH" : "MEDIUM",
      confidence: maxWgdc !== null && maxWgdc > 85 ? 84 : 74,
      source: "Boost target vs actual + WGDC",
      reason:
        "The car is either missing boost target, using high WGDC, or both. This can indicate a boost leak, restriction, wastegate control issue, or an unrealistic boost target.",
      actions: [
        rpmHint,
        ...causeSpecificTableHints("Boost control review", summary),
        "Pressure test the intake and charge piping.",
        "Inspect vacuum lines, boost solenoids, wastegate control, and intercooler joins.",
        "Review boost target and WGDC strategy together once tune tables are parsed.",
        "Compare WGDC trend against RPM, not just max WGDC.",
      ],
    });
  }

  if (minAfr !== null && minAfr > 13) {
    fixes.push({
      title: "Lean under-load fueling check",
      priority: "HIGH",
      confidence: 84,
      source: "AFR behaviour",
      reason:
        "AFR appears leaner than expected under load. This is a safety-critical fuel issue.",
      actions: [
        rpmHint,
        ...causeSpecificTableHints("Lean undeer-load fueling review", summary),
        "Stop increasing load until AFR behaviour is confirmed.",
        "Verify injector data, fuel scalar, and lambda target behaviour.",
        "Check fuel pressure stability at the same point in the pull.",
        "Re-log with matching fuel and tune profile.",
      ],
    });
  }

fixes.push(
  ...correlationFixes({
    summary,
    tuneProfile,
    rpmHint,
  })
);
  engineFixes.forEach((fix) => {
    if (!fix.title && !fix.recommendation) return;

    const title = fix.title || "Engine suggested fix";
    const alreadyExists = fixes.some(
      (existing) => existing.title.toLowerCase() === title.toLowerCase()
    );

    if (!alreadyExists) {
      fixes.push({
        title,
        priority: fix.risk === "high" ? "HIGH" : fix.risk === "low" ? "LOW" : "MEDIUM",
        confidence: 70,
        source: "Engine v2 suggested fix",
        reason: fix.rationale || "The engine returned this as a recommended review item.",
        actions: [
            rpmHint,
            ...causeSpecificTableHints(title, summary),
          fix.recommendation ||
            "Review the related tune, log, and hardware systems together.",
        ],
      });
    }
  });

  if (repeatRailCount >= 3) {
  fixes.push({
    title: "Persistent rail pressure fault pattern",
    priority: "HIGH",
    confidence: 95,
    source: "Historical log trend analysis",
    reason: `Rail pressure weakness detected in ${repeatRailCount} recent logs. This appears to be a recurring issue, not an isolated event.`,
    actions: [
      "Investigate HPFP / PI / rail system as a persistent fueling limitation.",
      "Review tune fuel demand in affected operating range.",
      "Inspect fuel system for heat soak or progressive degradation.",
    ],
  });
}

if (repeatLpfpCount >= 3) {
  fixes.push({
    title: "Persistent LPFP pressure instability",
    priority: "HIGH",
    confidence: 93,
    source: "Historical log trend analysis",
    reason: `LPFP pressure weakness detected in ${repeatLpfpCount} recent logs.`,
    actions: [
      "Inspect LPFP, controller, wiring, relay, and fuel filter/regulator.",
      "Check if issue worsens with fuel level or temperature.",
      "Review low-pressure fuel compensation strategy.",
    ],
  });
}

if (repeatBoostCount >= 3) {
  fixes.push({
    title: "Recurring boost control deviation",
    priority: "MEDIUM",
    confidence: 88,
    source: "Historical log trend analysis",
    reason: `Boost deviation detected in ${repeatBoostCount} recent logs.`,
    actions: [
      "Inspect WGDC / boost control strategy for repeat overshoot/undershoot.",
      "Pressure test charge system and vacuum routing.",
      "Review turbo efficiency and boost target realism.",
    ],
  });
}

if (repeatTimingCount >= 3) {
  fixes.push({
    title: "Recurring ignition correction pattern",
    priority: "HIGH",
    confidence: 90,
    source: "Historical log trend analysis",
    reason: `Timing correction / knock pattern detected in ${repeatTimingCount} recent logs.`,
    actions: [
      "Review ignition timing strategy and knock sensitivity.",
      "Inspect plugs, coils, fuel quality, and IAT trends.",
      "Reduce timing/load until cause is confirmed.",
    ],
  });
}

const hasPersistentRail = fixes.some(
  (fix) => fix.title === "Persistent rail pressure fault pattern"
);

const hasPersistentLpfp = fixes.some(
  (fix) => fix.title === "Persistent LPFP pressure instability"
);

const hasPersistentBoost = fixes.some(
  (fix) => fix.title === "Recurring boost control deviation"
);

const hasPersistentTiming = fixes.some(
  (fix) => fix.title === "Recurring ignition correction pattern"
);

for (let i = fixes.length - 1; i >= 0; i--) {
  const title = fixes[i].title.toLowerCase();

  if (
    hasPersistentRail &&
    title.includes("high-pressure fuel system review")
  ) {
    fixes.splice(i, 1);
  }

  if (
    hasPersistentLpfp &&
    title.includes("low-pressure fuel supply check")
  ) {
    fixes.splice(i, 1);
  }

  if (
    hasPersistentBoost &&
    title.includes("boost control efficiency check")
  ) {
    fixes.splice(i, 1);
  }

  if (
    hasPersistentTiming &&
    title.includes("timing correction investigation")
  ) {
    fixes.splice(i, 1);
  }
}

  const unique = new Map<string, ActionableFix>();

  fixes.forEach((fix) => {
    if (!unique.has(fix.title)) {
      unique.set(fix.title, fix);
    }
  });

  return Array.from(unique.values()).sort((a, b) => {
    const rank = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    const priorityDiff = rank[b.priority] - rank[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return b.confidence - a.confidence;
  });
}
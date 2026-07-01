import type {
  CrossReference,
  DetectedEvent,
  TuneProfile,
  VehicleSetup,
} from "./types";

import { getRootCauseResults } from "./rootCauseEngine";

type ReasoningResult = {
  primaryTuneAreas: string[];
  secondaryTuneAreas: string[];
  protectionAreas: string[];
  hardwareFactors: string[];
  likelyCauses: CrossReference["likelyCauses"];
  notes: string[];
  rootCauses: CrossReference["rootCauses"];
};

type ScoreCause = {
  label: string;
  score: number;
  reason: string;
};

function text(value: unknown): string {
  return String(value || "").toLowerCase();
}

function has(value: unknown, keyword: string): boolean {
  return text(value).includes(keyword.toLowerCase());
}

function metric(
  event: DetectedEvent,
  key: string
): number | null {
  const value = event.metrics?.[key];

  if (typeof value === "number" && !Number.isNaN(value)) return value;

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

function clampScore(value: number): number {
  return Math.max(0.35, Math.min(0.98, value));
}

function stackConfidence(args: {
  base: number;
  event: DetectedEvent;
  metrics: Record<string, number | null>;
  profile: {
    ethanol: boolean;
    strongFuel: boolean;
    upgradedTurbo: boolean;
  };
}): number {
  let score = args.base;

  const { metrics, profile } = args;

  // 🔥 Fuel stacking
  if (
    profile.ethanol &&
    metrics.minRail !== null &&
    metrics.minRail < 1500
  ) {
    score += 0.06;
  }

  if (
    profile.ethanol &&
    metrics.minLpfp !== null &&
    metrics.minLpfp < 50
  ) {
    score += 0.05;
  }

  // 🔥 Boost + WGDC stacking
  if (
    metrics.avgBoostError !== null &&
    metrics.avgBoostError > 2 &&
    metrics.maxWgdc !== null &&
    metrics.maxWgdc > 80
  ) {
    score += 0.06;
  }

  // 🔥 Timing + heat stacking
  if (
    metrics.maxIat !== null &&
    metrics.maxIat > 50
  ) {
    score += 0.04;
  }

  // 🔥 Strong setup behaving badly = more suspicious
  if (
    profile.strongFuel &&
    metrics.minRail !== null &&
    metrics.minRail < 1500
  ) {
    score += 0.05;
  }

  return clampScore(score);
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)));
}

function eventRpmBand(event: DetectedEvent): string {
  const start = typeof event.rpmStart === "number" ? event.rpmStart : null;
  const end = typeof event.rpmEnd === "number" ? event.rpmEnd : null;

  if (start === null || end === null) return "unknown RPM range";

  const mid = (start + end) / 2;

  if (mid < 3000) return "low RPM / spool area";
  if (mid < 4500) return "midrange load area";
  if (mid < 6000) return "upper-midrange power area";
  return "top-end power area";
}

function rpmStrategyNotes(event: DetectedEvent): string[] {
  const start = typeof event.rpmStart === "number" ? event.rpmStart : null;
  const end = typeof event.rpmEnd === "number" ? event.rpmEnd : null;

  if (start === null || end === null) {
    return ["RPM range was not available, so V3.1 cannot localise the issue precisely."];
  }

  const mid = (start + end) / 2;

  if (mid < 3000) {
    return [
      "V3.1 RPM insight: issue appears early in the pull, so spool control, wastegate response, traction intervention, or throttle/load request should be reviewed first.",
    ];
  }

  if (mid < 4500) {
    return [
      "V3.1 RPM insight: issue appears in the midrange, where torque/load demand and fuel pressure stress usually peak.",
    ];
  }

  if (mid < 6000) {
    return [
      "V3.1 RPM insight: issue appears in the upper-midrange, where boost control, timing correction, and fuel delivery need to be judged together.",
    ];
  }

  return [
    "V3.1 RPM insight: issue appears near the top end, so airflow ceiling, turbo efficiency, fuel volume, and heat should be prioritised.",
  ];
}

function vehicleFactors(vehicle: VehicleSetup | null): string[] {
  if (!vehicle) return ["Unknown vehicle setup"];

  const factors: string[] = [];

  if (vehicle.turboSetup) factors.push(vehicle.turboSetup);
  if (vehicle.fuelingSetup) factors.push(vehicle.fuelingSetup);
  if (vehicle.intercooler) factors.push(vehicle.intercooler);
  if (vehicle.fuelType) factors.push(vehicle.fuelType);
  if (vehicle.transmissionTune) factors.push(vehicle.transmissionTune);
  if (vehicle.portInjection) factors.push("Port injection present");
  if (vehicle.horsepowerGoal) factors.push(`HP goal ${vehicle.horsepowerGoal}`);

  if (vehicle.mapSensorBar !== null && vehicle.mapSensorBar !== undefined) {
    factors.push(`MAP sensor ${vehicle.mapSensorBar} bar`);
  }

  return factors.length ? factors : ["Unknown vehicle setup"];
}

function tuneNotes(tune: TuneProfile | null): string[] {
  if (!tune) return ["No tune profile available."];

  const notes: string[] = ["Tune profile available for V3 reasoning."];

  if (tune.detectedPlatform) notes.push(`Detected platform: ${tune.detectedPlatform}.`);
  if (tune.detectedStrategy) notes.push(`Strategy hint: ${tune.detectedStrategy}.`);
  if (tune.detectedRom) notes.push(`ROM hint: ${tune.detectedRom}.`);

  if (tune.boostIntent) notes.push(`Boost intent: ${tune.boostIntent}.`);
  if (tune.ignitionIntent) notes.push(`Ignition intent: ${tune.ignitionIntent}.`);
  if (tune.fuelingIntent) notes.push(`Fueling intent: ${tune.fuelingIntent}.`);

  return notes;
}

function setupProfile(vehicle: VehicleSetup | null, tune: TuneProfile | null) {
  const fuelType = text(vehicle?.fuelType);
  const fuelingSetup = text(vehicle?.fuelingSetup);
  const turboSetup = text(vehicle?.turboSetup);
  const intercooler = text(vehicle?.intercooler);

  const upgradedTurbo =
    has(turboSetup, "19t") ||
    has(turboSetup, "17t") ||
    has(turboSetup, "pure") ||
    has(turboSetup, "hybrid") ||
    has(turboSetup, "upgraded");

  const strongFueling =
    has(fuelingSetup, "stage 3") ||
    has(fuelingSetup, "stage 4") ||
    has(fuelingSetup, "walbro") ||
    has(fuelingSetup, "525") ||
    has(fuelingSetup, "port") ||
    vehicle?.portInjection === true;

  const ethanolSetup =
    has(fuelType, "e") ||
    has(fuelType, "ethanol") ||
    tune?.fuelingIntent === "ethanol_blend" ||
    tune?.fuelingIntent === "full_ethanol";

  const coolingUpgrade =
    has(intercooler, "race") ||
    has(intercooler, "7") ||
    has(intercooler, "vrsf") ||
    has(intercooler, "large") ||
    has(intercooler, "upgraded");

  return {
    upgradedTurbo,
    strongFueling,
    ethanolSetup,
    coolingUpgrade,
  };
}

function addCause(
  causes: ScoreCause[],
  label: string,
  baseScore: number,
  reason: string,
  modifiers: number[] = []
) {
  const score = clampScore(baseScore + modifiers.reduce((sum, value) => sum + value, 0));

  causes.push({
    label,
    score,
    reason,
  });
}

function baseNotes(args: {
  event: DetectedEvent;
  vehicle: VehicleSetup | null;
  tune: TuneProfile | null;
}): string[] {
  const { event, vehicle, tune } = args;
  const notes: string[] = [];

  notes.push(...tuneNotes(tune));
  notes.push(`Event appears in the ${eventRpmBand(event)}.`);
  notes.push(...rpmStrategyNotes(event));

  const profile = setupProfile(vehicle, tune);

  if (profile.upgradedTurbo) {
    notes.push("Vehicle setup suggests upgraded turbo airflow capability.");
  }

  if (profile.strongFueling) {
    notes.push("Vehicle setup suggests stronger-than-stock fuel system support.");
  }

  if (profile.ethanolSetup) {
    notes.push("Vehicle setup or tune profile suggests ethanol fuel demand.");
  }

  if (profile.coolingUpgrade) {
    notes.push("Vehicle setup suggests upgraded charge-air cooling.");
  }

  return unique(notes);
}

function severityModifier(event: DetectedEvent): number {
  if (event.severity === "critical") return 0.08;
  if (event.severity === "high") return 0.06;
  if (event.severity === "medium") return 0.03;
  return 0;
}

function confidenceModifier(event: DetectedEvent): number {
  if (typeof event.confidence !== "number") return 0;
  if (event.confidence >= 0.9) return 0.05;
  if (event.confidence >= 0.75) return 0.03;
  if (event.confidence < 0.5) return -0.06;
  return 0;
}

export function buildReasoningForEvent(args: {
  event: DetectedEvent;
  vehicle: VehicleSetup | null;
  tune: TuneProfile | null;
}): ReasoningResult {
  const { event, vehicle, tune } = args;

  const profile = setupProfile(vehicle, tune);

  const avgBoost = metric(event, "avgBoost");
  const maxBoost = metric(event, "maxBoost");
  const avgBoostError = metric(event, "avgBoostError");
  const lateBoostError = metric(event, "lateBoostError");
  const avgWgdc = metric(event, "avgWgdc");
  const maxWgdc = metric(event, "maxWgdc");
  const minRail = metric(event, "minRail");
  const minLpfp = metric(event, "minLpfp");
  const minAfr = metric(event, "minAfr");
  const maxIat = metric(event, "maxIat");

  const commonModifiers = [
    severityModifier(event),
    confidenceModifier(event),
  ];

  const notes = baseNotes({ event, vehicle, tune });
  const hardwareFactors = vehicleFactors(vehicle);
  const causes: ScoreCause[] = [];

  const metricNumber = (key: string): number | undefined => {
  const value = event.metrics?.[key];

  return typeof value === "number"
    ? value
    : undefined;
};

const rootCauseBoostError =
  metricNumber("maxBoostError") ??
  metricNumber("boostError") ??
  metricNumber("avgBoostError") ??
  metricNumber("lateBoostError") ??
  avgBoostError ??
  lateBoostError ??
  undefined;

const rootCauseWgdc =
  metricNumber("avgWgdc") ??
  metricNumber("maxWgdc") ??
  avgWgdc ??
  maxWgdc ??
  undefined;

const rootCauses = getRootCauseResults({
  eventType: event.type,
  boostError:
  metricNumber("maxBoostError") ??
  metricNumber("boostError") ??
  metricNumber("avgBoostError") ??
  metricNumber("lateBoostError") ??
  avgBoostError ??
  lateBoostError ??
  undefined,
  wgdc: rootCauseWgdc,
  avgWgdc: metricNumber("avgWgdc") ?? avgWgdc ?? undefined,
  maxWgdc: metricNumber("maxWgdc") ?? maxWgdc ?? undefined,
  throttle: metricNumber("avgThrottle"),
  iat: maxIat ?? undefined,
  railPressure: minRail ?? undefined,
  lpfp: minLpfp ?? undefined,
});

  if (
  event.type === "rail_pressure_drop" ||
  event.type === "hpfp_capacity_limit"
) { 
    addCause(
      causes,
      event.type === "hpfp_capacity_limit"
  ? "HPFP capacity limit reached"
  : "HPFP support limit",
      stackConfidence({
  base: 0.86,
  event,
  metrics: {
    minRail,
    minLpfp,
    avgBoostError,
    maxWgdc,
    maxIat,
  },
  profile: {
    ethanol: profile.ethanolSetup,
    strongFuel: profile.strongFueling,
    upgradedTurbo: profile.upgradedTurbo,
  },
}),
      "Rail pressure dropped under load, which usually points to high-pressure fuel system strain.",
      [
        ...commonModifiers,
        minRail !== null && minRail < 1000 ? 0.08 : 0,
        profile.ethanolSetup ? 0.06 : 0,
      ]
    );

    if (tune?.fuelingIntent === "pump" && profile.ethanolSetup) {
      addCause(
        causes,
        "Fuel-to-tune mismatch increasing fuel demand",
        0.91,
        "The tune profile appears pump-oriented while the setup/log context suggests ethanol demand.",
        commonModifiers
      );
    }

    if (profile.strongFueling && minRail !== null && minRail < 1500) {
      addCause(
        causes,
        "Demand exceeds expected support",
        0.82,
        "The saved setup suggests strong fuel hardware, so low rail pressure may indicate calibration, PI split, hardware fault, or demand mismatch.",
        commonModifiers
      );
    }

    return {
      primaryTuneAreas: ["fuel scalar", "load target", "fuel pressure control"],
      secondaryTuneAreas: ["boost target", "lambda target", "PI contribution"],
      protectionAreas: ["fuel safety", "rail pressure protection"],
      hardwareFactors,
      likelyCauses: causes,
      notes,
      rootCauses,
    };
  }

  if (event.type === "lpfp_drop") {
    addCause(
      causes,
      "Low-pressure supply weakness",
      stackConfidence({
  base: 0.84,
  event,
  metrics: {
    minRail,
    minLpfp,
    avgBoostError,
    maxWgdc,
    maxIat,
  },
  profile: {
    ethanol: profile.ethanolSetup,
    strongFuel: profile.strongFueling,
    upgradedTurbo: profile.upgradedTurbo,
  },
}),
      "LPFP pressure dropped under load, which can starve the high-pressure side.",
      [
        ...commonModifiers,
        minLpfp !== null && minLpfp < 40 ? 0.08 : 0,
        profile.ethanolSetup ? 0.05 : 0,
      ]
    );

    if (profile.strongFueling) {
      addCause(
        causes,
        "LPFP control, wiring, or delivery issue",
        0.8,
        "The setup suggests upgraded fuel hardware, so pressure drop may point to wiring, voltage, controller, filter, or pump behaviour.",
        commonModifiers
      );
    }

    return {
      primaryTuneAreas: ["fueling", "load target"],
      secondaryTuneAreas: ["boost target", "lambda target"],
      protectionAreas: ["fuel safety", "LPFP safety"],
      hardwareFactors,
      likelyCauses: causes,
      notes,
      rootCauses,
    };
  }

  if (
    event.type === "timing_correction" ||
    event.type === "multi_cyl_timing_correction"
  ) {
    if (event.type === "multi_cyl_timing_correction") {
  addCause(
    causes,
    "Multiple cylinders showing coordinated timing correction",
    stackConfidence({
      base: 0.92,
      event,
      metrics: {
        minRail,
        minLpfp,
        avgBoostError,
        maxWgdc,
        maxIat,
      },
      profile: {
        ethanol: profile.ethanolSetup,
        strongFuel: profile.strongFueling,
        upgradedTurbo: profile.upgradedTurbo,
      },
    }),
    "Correction is occurring across multiple cylinders at the same time, suggesting a broader knock, fuel quality, heat, or tune-load issue rather than one isolated cylinder.",
    [
      ...commonModifiers,
      maxIat !== null && maxIat > 45 ? 0.05 : 0,
    ]
  );
} else {
  addCause(
    causes,
    "Single-cylinder timing correction detected",
    stackConfidence({
      base: 0.72,
      event,
      metrics: {
        minRail,
        minLpfp,
        avgBoostError,
        maxWgdc,
        maxIat,
      },
      profile: {
        ethanol: profile.ethanolSetup,
        strongFuel: profile.strongFueling,
        upgradedTurbo: profile.upgradedTurbo,
      },
    }),
    "Timing correction appears isolated to one cylinder, which may point toward plug, coil, injector, cylinder-specific combustion variation, or localized knock sensitivity.",
    commonModifiers
  );
}

    if (tune?.ignitionIntent === "conservative") {
      addCause(
        causes,
        "Unexpected correction for conservative ignition profile",
        0.87,
        "The tune profile suggests conservative ignition intent, so meaningful correction points more strongly toward fuel quality, heat, hardware, or profile mismatch.",
        commonModifiers
      );
    }

    if (tune?.ignitionIntent === "aggressive") {
      addCause(
        causes,
        "Ignition advance may be too aggressive for conditions",
        0.82,
        "The tune profile suggests aggressive ignition intent, which gives less knock margin.",
        commonModifiers
      );
    }

    return {
      primaryTuneAreas: ["ignition timing", "IAT timing compensation"],
      secondaryTuneAreas: ["boost target", "lambda target"],
      protectionAreas: ["knock control", "timing correction safety"],
      hardwareFactors,
      likelyCauses: causes,
      notes,
      rootCauses,
    };
  }

  if (event.type === "boost_undershoot") {
    addCause(
      causes,
      "Boost target not being met",
      stackConfidence({
  base: 0.8,
  event,
  metrics: {
    minRail,
    minLpfp,
    avgBoostError,
    maxWgdc,
    maxIat,
  },
  profile: {
    ethanol: profile.ethanolSetup,
    strongFuel: profile.strongFueling,
    upgradedTurbo: profile.upgradedTurbo,
  },
}),
      "The log shows boost delivery falling short of expected/requested behaviour.",
      [
        ...commonModifiers,
        avgBoostError !== null && avgBoostError > 3 ? 0.08 : 0,
        maxWgdc !== null && maxWgdc > 80 ? 0.05 : 0,
      ]
    );

    if (profile.upgradedTurbo && maxWgdc !== null && maxWgdc > 75) {
      addCause(
        causes,
        "Boost control strategy or mechanical leak likely",
        0.84,
        "With upgraded turbo capability, high WGDC and missed boost is more suspicious for control strategy, leak, wastegate, or restriction.",
        commonModifiers
      );
    }

    if (tune?.boostIntent === "aggressive") {
      addCause(
        causes,
        "Tune demand may exceed clean delivery",
        0.86,
        "The tune profile suggests aggressive boost intent, and the log is showing delivery shortfall.",
        commonModifiers
      );
    }

    if (tune?.boostIntent === "low" && maxBoost !== null) {
  if (maxBoost >= 26) {
    addCause(
      causes,
      "Severe boost deviation from low-boost tune profile",
      0.94,
      "The tune profile suggests modest boost targeting, yet the log shows extremely elevated boost pressure. This may indicate incorrect tune configuration, boost control problems, or boost targeting inconsistent with the uploaded calibration.",
      commonModifiers
    );
  } else if (maxBoost >= 22) {
    addCause(
      causes,
      "Boost exceeds conservative tune expectation",
      0.84,
      "The uploaded tune profile appears relatively low boost, but logged boost pressure is noticeably higher than expected for this calibration style.",
      commonModifiers
    );
  } else if (maxBoost >= 19) {
    addCause(
      causes,
      "Slightly elevated boost for low-boost calibration",
      0.68,
      "Boost pressure is slightly above what would normally be expected from a low-boost calibration. This may still fall within acceptable variance depending on environmental conditions and boost control behavior.",
      commonModifiers
    );
  }
}

    return {
      primaryTuneAreas: ["boost target", "WGDC"],
      secondaryTuneAreas: ["load target", "torque limiters"],
      protectionAreas: ["boost ceiling", "torque intervention"],
      hardwareFactors,
      likelyCauses: causes,
      notes,
      rootCauses,
    };
  }

if (event.type === "top_end_taper") {
  addCause(
    causes,
    "Late-pull boost or airflow taper",
    stackConfidence({
      base: 0.86,
      event,
      metrics: {
        minRail,
        minLpfp,
        avgBoostError,
        maxWgdc,
        maxIat,
      },
      profile: {
        upgradedTurbo: profile.upgradedTurbo,
        ethanol: profile.ethanolSetup,
        strongFuel: profile.strongFueling,
      },
    }),
    "Boost or airflow falling away later in the pull usually points to boost target taper, WGDC ceiling, turbo flow limit, backpressure, or load-request reduction.",
    [
      ...commonModifiers,
      maxWgdc !== null && maxWgdc > 85 ? 0.06 : 0,
      avgBoostError !== null && avgBoostError > 2 ? 0.05 : 0,
      maxIat !== null && maxIat > 55 ? 0.04 : 0,
    ]
  );

  if (tune?.boostIntent === "aggressive") {
    addCause(
      causes,
      "Aggressive boost request may exceed top-end airflow",
      0.82,
      "The tune profile suggests aggressive boost intent, so late-pull taper may be the system reaching its airflow or wastegate duty limit.",
      commonModifiers
    );
  }

  return {
    primaryTuneAreas: ["boost target", "WGDC", "load target"],
    secondaryTuneAreas: ["IAT compensation", "torque limiters"],
    protectionAreas: ["boost ceiling", "WGDC safety", "thermal protection"],
    hardwareFactors,
    likelyCauses: causes,
    notes,
    rootCauses,
  };
}

  if (event.type === "wgdc_saturation") {
  if (avgWgdc != null && avgWgdc >= 95) {
    addCause(
      causes,
      "Wastegate duty fully saturated",
      0.96,
      "WGDC is effectively maxed out, indicating the turbo system is struggling to achieve boost target. This commonly points toward boost leaks, turbine inefficiency, wastegate sealing issues, exhaust restriction, or airflow limitations.",
      [
        ...commonModifiers,
        avgWgdc > 98 ? 0.08 : 0,
      ]
    );
  } else if (avgWgdc != null && avgWgdc >= 88) {
    addCause(
      causes,
      "Very high wastegate duty cycle",
      0.84,
      "The boost control system is working aggressively to maintain target boost pressure. This may indicate developing airflow inefficiency, minor boost leakage, or turbocharger efficiency limits.",
      commonModifiers
    );
  } else if (avgWgdc != null && avgWgdc >= 80) {
    addCause(
      causes,
      "Elevated wastegate duty observed",
      0.68,
      "WGDC is elevated but not yet saturated. This can occur under higher load demand, though persistent elevated duty may still indicate early airflow or boost control inefficiency.",
      commonModifiers
    );
  }
 

    if (avgBoostError !== null && avgBoostError > 2) {
      addCause(
        causes,
        "High control effort with poor result",
        0.88,
        "High WGDC combined with boost error suggests leak, restriction, turbo efficiency limit, or unrealistic boost target.",
        commonModifiers
      );
    }

    return {
      primaryTuneAreas: ["WGDC", "boost target"],
      secondaryTuneAreas: ["load target"],
      protectionAreas: ["boost ceiling"],
      hardwareFactors,
      likelyCauses: causes,
      notes,
      rootCauses,
    };
  }

  if (event.type === "throttle_closure") {
    addCause(
      causes,
      "Torque intervention path",
      0.86,
      "Throttle closure during a pull often points to torque/load intervention rather than a simple airflow problem.",
      commonModifiers
    );

    if (tune?.boostIntent === "aggressive") {
      addCause(
        causes,
        "Boost/load request may be forcing intervention",
        0.82,
        "Aggressive boost or load targets can trigger torque model intervention if limits are not aligned.",
        commonModifiers
      );
    }

    return {
      primaryTuneAreas: ["torque limiters", "load target"],
      secondaryTuneAreas: ["boost target", "throttle control"],
      protectionAreas: ["torque intervention", "load protection"],
      hardwareFactors,
      likelyCauses: causes,
      notes,
      rootCauses,
    };
  }

  if (event.type === "lean_under_load") {
    addCause(
      causes,
      "Fuel delivery or lambda target issue",
      0.88,
      "Lean behaviour under load is a safety-critical signal and should be treated carefully.",
      [
        ...commonModifiers,
        minAfr !== null && minAfr > 13 ? 0.06 : 0,
      ]
    );

    if (profile.ethanolSetup) {
      addCause(
        causes,
        "Ethanol demand amplifying fuel weakness",
        0.9,
        "Ethanol requires more fuel volume, so lean behaviour becomes more serious.",
        commonModifiers
      );
    }

    return {
      primaryTuneAreas: ["lambda target", "fuel scalar", "fueling"],
      secondaryTuneAreas: ["load target", "boost target"],
      protectionAreas: ["fuel safety", "lean protection"],
      hardwareFactors,
      likelyCauses: causes,
      notes,
      rootCauses,
    };
  }

  if (event.type === "heat_soak") {
    addCause(
      causes,
      "Thermal load reducing performance margin",
      0.84,
      "Elevated IAT reduces knock margin and power consistency.",
      [
        ...commonModifiers,
        maxIat !== null && maxIat > 55 ? 0.06 : 0,
      ]
    );

    if (tune?.ignitionIntent === "aggressive" || tune?.boostIntent === "aggressive") {
      addCause(
        causes,
        "Tune posture less tolerant of heat",
        0.82,
        "Aggressive boost or ignition intent becomes harder to support when IAT climbs.",
        commonModifiers
      );
    }

    return {
      primaryTuneAreas: ["IAT compensation", "boost target"],
      secondaryTuneAreas: ["ignition timing"],
      protectionAreas: ["thermal protection", "knock control"],
      hardwareFactors,
      likelyCauses: causes,
      notes,
      rootCauses,
    };
  }

  addCause(
    causes,
    "General calibration or setup issue",
    0.55,
   "This event is being reviewed using general cross-system logic until a more specific reasoning path is available." ,
    commonModifiers
  );

  return {
    primaryTuneAreas: ["general tune review"],
    secondaryTuneAreas: [],
    protectionAreas: [],
    hardwareFactors,
    likelyCauses: causes,
    notes,
    rootCauses,
  };
}
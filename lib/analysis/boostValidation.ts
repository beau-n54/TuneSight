import { n54Thresholds } from "../config/thresholds";

export type BoostValidationResult = {
  status: "pass" | "warning" | "fail";
  boostIntent: string;
  boostErrorPsi: number | null;
  message: string;
};

import type { AnalysisContext } from "./core/analysisContext";

export function validateBoostAgainstTune(
  context: AnalysisContext & {
    boostIntent?: string | null;
  }
)
: BoostValidationResult {
  const maxBoost = Number(context.maxBoost ?? 0);
  const maxBoostTarget = Number(context.maxBoostTarget ?? 0);
  const maxWgdc = Number(context.maxWgdc ?? 0);
  const boostIntent = context.boostIntent ?? "unknown";

  const boostThresholds = n54Thresholds.boost;

  const acceptableBoostErrorPsi = 1.5;
  const overboostErrorPsi = -Math.abs(boostThresholds.overboostErrorPsi);
  const underboostErrorPsi = Math.abs(boostThresholds.underboostErrorPsi);
  const highWgdcPercent = boostThresholds.highWgdcPercent;

  if (!maxBoost || !maxBoostTarget) {
    return {
      status: "warning",
      boostIntent,
      boostErrorPsi: null,
      message: "Boost target or actual boost data is missing.",
    };
  }

  const boostErrorPsi = Number((maxBoostTarget - maxBoost).toFixed(1));

  if (
    boostErrorPsi <= acceptableBoostErrorPsi &&
    boostErrorPsi >= -acceptableBoostErrorPsi
  ) {
    return {
      status: "pass",
      boostIntent,
      boostErrorPsi,
      message: "Actual boost is close to target.",
    };
  }

  if (boostErrorPsi <= overboostErrorPsi) {
    return {
      status: "fail",
      boostIntent,
      boostErrorPsi,
      message:
        "Actual boost is above target. This may indicate overboost, boost control overshoot, wastegate control error, or tune target mismatch.",
    };
  }

  if (boostErrorPsi > underboostErrorPsi && maxWgdc >= highWgdcPercent) {
    return {
      status: "fail",
      boostIntent,
      boostErrorPsi,
      message:
        "Boost is well below target while WGDC is high. This suggests a boost leak, turbo efficiency limit, exhaust restriction, or wastegate control issue.",
    };
  }

  if (boostErrorPsi > underboostErrorPsi && maxWgdc < highWgdcPercent) {
    return {
      status: "warning",
      boostIntent,
      boostErrorPsi,
      message:
        "Boost is below target, but WGDC is not extremely high. Review boost target realism, load request, throttle closure, torque limits, and boost control strategy.",
    };
  }

  if (boostErrorPsi > acceptableBoostErrorPsi) {
    return {
      status: "warning",
      boostIntent,
      boostErrorPsi,
      message:
        "Boost is slightly below target. Monitor whether the gap increases at higher RPM or higher load.",
    };
  }

  return {
    status: "warning",
    boostIntent,
    boostErrorPsi,
    message: "Boost behaviour needs review.",
  };
}
import type {
  DetectedEvent,
  ParsedLog,
  PullWindow,
} from "../analysis/types";

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function max(values: number[]): number {
  if (!values.length) return 0;
  return Math.max(...values);
}

function min(values: number[]): number {
  if (!values.length) return 0;
  return Math.min(...values);
}

function buildEventId(prefix: string, index: number): string {
  return `${prefix}_${index + 1}`;
}

function getSlice(values: number[], start: number, end: number): number[] {
  return values.slice(start, end + 1);
}

function splitWindow(start: number, end: number) {
  const length = end - start + 1;
  const third = Math.max(1, Math.floor(length / 3));

  return {
    early: {
      start,
      end: Math.min(end, start + third - 1),
    },
    mid: {
      start: Math.min(end, start + third),
      end: Math.min(end, start + third * 2 - 1),
    },
    late: {
      start: Math.min(end, start + third * 2),
      end,
    },
  };
}

function findLowestThrottleIndex(values: number[], start: number, end: number): number {
  let lowestIndex = start;
  let lowestValue = values[start] ?? 100;

  for (let i = start; i <= end; i++) {
    const value = values[i] ?? 100;
    if (value < lowestValue) {
      lowestValue = value;
      lowestIndex = i;
    }
  }

  return lowestIndex;
}

function hasMeaningfulData(values: number[]): boolean {
  return values.some((v) => v !== 0);
}

function normalizeWindow(
  pull: PullWindow | { startIndex: number; endIndex: number; quality: "questionable" | "usable" | "strong" }
) {
  return {
    startIndex: pull.startIndex,
    endIndex: pull.endIndex,
    quality: pull.quality,
  };
}

export function detectEvents(
  parsedLog: ParsedLog,
  pullWindows: PullWindow[],
 fuelPressureThresholds?: {
  railDropThreshold: number;
  railCriticalThreshold: number;
  lpfpDropThreshold: number;
  lpfpCriticalThreshold: number;
}
): DetectedEvent[] {
  const events: DetectedEvent[] = [];

  const boost = parsedLog.channels.boost || [];
  const boostTarget = parsedLog.channels.boost_target || [];
  const wgdc = parsedLog.channels.wgdc || [];
  const throttle =
    parsedLog.channels.throttle ||
    parsedLog.channels.accelerator_pedal ||
    parsedLog.channels.pedal ||
    [];
  const iat = parsedLog.channels.iat || [];
  const rail = parsedLog.channels.rail_pressure || [];
  const lpfp = parsedLog.channels.lpfp || [];
  const afr = parsedLog.channels.afr || [];
  const rpm =
  parsedLog.rpm ||
  parsedLog.channels.rpm ||
  parsedLog.channels.engine_speed ||
  parsedLog.channels.EngineSpeed ||
  parsedLog.channels.RPM ||
  [];

  const cylKeys = Object.keys(parsedLog.channels).filter((key) =>
    key.startsWith("timing_correction_cyl_")
  );

  const windowsToAnalyze =
    pullWindows.length > 0
      ? pullWindows.map(normalizeWindow)
      : [
          {
            startIndex: 0,
            endIndex: Math.max(0, parsedLog.timestamps.length - 1),
            quality: "questionable" as const,
          },
        ];

  windowsToAnalyze.forEach((pull, index) => {
    const start = pull.startIndex;
    const end = pull.endIndex;
    
    if (end <= start) return;
    const sections = splitWindow(start, end);
    const boostSlice = getSlice(boost, start, end);
    const boostTargetSlice = getSlice(boostTarget, start, end);
    const wgdcSlice = getSlice(wgdc, start, end);
    const throttleSlice = getSlice(throttle, start, end);
    const iatSlice = getSlice(iat, start, end);
    const railSlice = getSlice(rail, start, end);
    const lpfpSlice = getSlice(lpfp, start, end);
    const afrSlice = getSlice(afr, start, end);

    const avgBoost = average(boostSlice);
    const avgBoostTarget = average(boostTargetSlice);
    const maxBoostError = Math.max(...boostTargetSlice.map((target, i) =>
          Math.abs(target - (boostSlice[i] ?? target))
        ));
    const avgBoostError = avgBoostTarget - avgBoost;
    const avgWgdc = average(wgdcSlice);
    const avgThrottle = average(throttleSlice);
    const maxIat = max(iatSlice);
    const minRail = min(railSlice.filter((v) => v > 0));
    const minLpfp = min(lpfpSlice.filter((v) => v > 0));
    const minAfr = min(afrSlice.filter((v) => v > 0));

    const earlyBoost = average(getSlice(boost, sections.early.start, sections.early.end));
    const midBoost = average(getSlice(boost, sections.mid.start, sections.mid.end));
    const lateBoost = average(getSlice(boost, sections.late.start, sections.late.end));

    const earlyBoostTarget = average(
      getSlice(boostTarget, sections.early.start, sections.early.end)
    );
    const midBoostTarget = average(
      getSlice(boostTarget, sections.mid.start, sections.mid.end)
    );
    const lateBoostTarget = average(
      getSlice(boostTarget, sections.late.start, sections.late.end)
    );

    const earlyBoostError = earlyBoostTarget - earlyBoost;
    const midBoostError = midBoostTarget - midBoost;
    const lateBoostError = lateBoostTarget - lateBoost;

    const earlyRail = min(
      getSlice(rail, sections.early.start, sections.early.end).filter((v) => v > 0)
    );
    const midRail = min(
      getSlice(rail, sections.mid.start, sections.mid.end).filter((v) => v > 0)
    );
    const lateRail = min(
      getSlice(rail, sections.late.start, sections.late.end).filter((v) => v > 0)
    );

    const earlyLpfp = min(
      getSlice(lpfp, sections.early.start, sections.early.end).filter((v) => v > 0)
    );
    const midLpfp = min(
      getSlice(lpfp, sections.mid.start, sections.mid.end).filter((v) => v > 0)
    );
    const lateLpfp = min(
      getSlice(lpfp, sections.late.start, sections.late.end).filter((v) => v > 0)
    );

    const earlyIat = max(getSlice(iat, sections.early.start, sections.early.end));
    const lateIat = max(getSlice(iat, sections.late.start, sections.late.end));

    if (
  hasMeaningfulData(boostSlice) &&
  hasMeaningfulData(boostTargetSlice) &&
  avgBoostError > 3 &&
  avgWgdc >= 70 &&
  avgThrottle > 60
) {

      events.push({
        id: buildEventId("boost_undershoot", index),
        type: "boost_undershoot",
        severity: avgBoostError > 3 ? "high" : "medium",
        confidence: avgWgdc > 70 ? 0.82 : 0.68,
        startIndex: start,
        endIndex: end,
        rpmStart: rpm[start] ?? 0,
        rpmEnd: rpm[end] ?? 0,
        supportingChannels: ["boost", "boost_target", "wgdc", "throttle"],
        evidence: [
          `Average boost trailed target by ${avgBoostError.toFixed(1)} psi`,
          `Average WGDC during event was ${avgWgdc.toFixed(1)}%`,
          `Average throttle during event was ${avgThrottle.toFixed(1)}%`,
        ],
        metrics: {
          avgBoost,
          avgBoostTarget,
          avgBoostError,
          maxBoostError,
          boostError: avgBoostError,
          avgWgdc,
          wgdc: avgWgdc,
          avgThrottle,
          throttle: avgThrottle,
        },
      });
    }

    if (
      hasMeaningfulData(boostSlice) &&
      hasMeaningfulData(boostTargetSlice) &&
      maxBoostError > 3 &&
      lateBoostError > midBoostError + 0.4
    ) {
      
      events.push({
        id: buildEventId("top_end_taper", index),
        type: "top_end_taper",
        severity: lateBoostError > 3.2 ? "high" : "medium",
        confidence: avgWgdc > 65 ? 0.84 : 0.72,
        startIndex: sections.late.start,
        endIndex: sections.late.end,
        rpmStart: rpm[sections.late.start] ?? 0,
        rpmEnd: rpm[sections.late.end] ?? 0,
        supportingChannels: ["boost", "boost_target", "wgdc"],
        evidence: [
          `Top-end boost error worsened to ${lateBoostError.toFixed(1)} psi`,
          `Midrange error was ${midBoostError.toFixed(1)} psi`,
        ],
        metrics: {
          boostError: lateBoostError,
          avgBoostError: lateBoostError,
          maxBoostError,
          avgWgdc,
          wgdc: avgWgdc,
        },
      });
        

    if (
      hasMeaningfulData(boostSlice) &&
      hasMeaningfulData(boostTargetSlice) &&
      avgBoostError < -3 &&
      avgThrottle > 60
    ) {
  
  events.push({
    id: buildEventId("boost_overshoot", index),
    type: "boost_overshoot",
    severity: avgBoostError < -5 ? "high" : "medium",
    confidence: avgThrottle > 70 ? 0.84 : 0.72,

    startIndex: start,
    endIndex: end,

    rpmStart: rpm[start] ?? 0,
    rpmEnd: rpm[end] ?? 0,

    supportingChannels: [
      "boost",
      "boost_target",
      "wgdc",
      "throttle",
    ],

    evidence: [
      `Average boost exceeded target by ${Math.abs(avgBoostError).toFixed(1)} psi`,
      `Average throttle during event was ${avgThrottle.toFixed(1)}%`,
    ],

    metrics: {
      avgBoost,
      avgBoostTarget,
      avgBoostError,
      avgWgdc,
      avgThrottle,
    },
  });
}
}

    if (hasMeaningfulData(wgdcSlice) && avgWgdc >= 78) {
      events.push({
        id: buildEventId("wgdc_saturation", index),
        type: "wgdc_saturation",
        severity: avgWgdc >= 90 ? "high" : "medium",
        confidence: 0.8,
        startIndex: start,
        endIndex: end,
        rpmStart: rpm[start] ?? 0,
        rpmEnd: rpm[end] ?? 0,
        supportingChannels: ["wgdc", "boost", "boost_target"],
        evidence: [
          `Average WGDC was ${avgWgdc.toFixed(1)}% across the pull window`,
        ],
        metrics: {
          avgWgdc,
        },
      });
    }

    if (hasMeaningfulData(iatSlice) && maxIat >= 45) {
      events.push({
        id: buildEventId("heat_soak", index),
        type: "heat_soak",
        severity: maxIat >= 58 ? "high" : "medium",
        confidence: 0.82,
        startIndex: start,
        endIndex: end,
        rpmStart: rpm[start] ?? 0,
        rpmEnd: rpm[end] ?? 0,
        supportingChannels: ["iat"],
        evidence: [
          `Peak IAT reached ${maxIat.toFixed(1)}°`,
          `IAT rose from roughly ${earlyIat.toFixed(1)}° to ${lateIat.toFixed(1)}° across the pull`,
        ],
        metrics: {
          maxIat,
          earlyIat,
          lateIat,
        },
      });
    }

   const railDropThreshold = 1650;
   const railCriticalThreshold = 1350;

if (minRail > 0 && minRail < railDropThreshold) {
  const severeRailDrop = minRail < railCriticalThreshold;

  events.push({
   id: buildEventId(
  severeRailDrop
    ? "hpfp_capacity_limit"
    : "rail_pressure_drop",
  index
),
type: severeRailDrop
  ? "hpfp_capacity_limit"
  : "rail_pressure_drop",
severity: severeRailDrop ? "high" : "medium",
        confidence: 0.86,
        startIndex: start,
        endIndex: end,
        rpmStart: rpm[start] ?? 0,
        rpmEnd: rpm[end] ?? 0,
        supportingChannels: ["rail_pressure", "throttle", "boost"],
        evidence: [`Minimum rail pressure dropped to ${minRail.toFixed(1)}`],
        metrics: {
          minRail,
          earlyRail,
          midRail,
          lateRail,
        },
      });
    }

    if (
      earlyRail > 0 &&
      lateRail > 0 &&
      lateRail < earlyRail - 120 &&
      lateRail < 1800
    ) {
      events.push({
        id: buildEventId("rail_pressure_drop_late", index),
        type: "rail_pressure_drop",
        severity: lateRail < 1450 ? "high" : "medium",
        confidence: 0.8,
        startIndex: sections.late.start,
        endIndex: sections.late.end,
        rpmStart: rpm[sections.late.start] ?? 0,
        rpmEnd: rpm[sections.late.end] ?? 0,
        supportingChannels: ["rail_pressure"],
        evidence: [
          `Rail pressure weakened later in the pull`,
          `Early minimum ${earlyRail.toFixed(1)}, late minimum ${lateRail.toFixed(1)}`,
        ],
        metrics: {
          earlyRail,
          midRail,
          lateRail,
        },
      });
    }

    const lpfpDropThreshold =
  fuelPressureThresholds?.lpfpDropThreshold ?? 60;

    const lpfpCriticalThreshold =
  fuelPressureThresholds?.lpfpCriticalThreshold ?? 45;

if (minLpfp > 0 && minLpfp < lpfpDropThreshold) {
  events.push({
    id: buildEventId("lpfp_drop", index),
    type: "lpfp_drop",
    severity: minLpfp < lpfpCriticalThreshold ? "high" : "medium",
        confidence: 0.82,
        startIndex: start,
        endIndex: end,
        rpmStart: rpm[start] ?? 0,
        rpmEnd: rpm[end] ?? 0,
        supportingChannels: ["lpfp", "throttle", "boost"],
        evidence: [`Minimum LPFP dropped to ${minLpfp.toFixed(1)}`],
        metrics: {
          minLpfp,
          earlyLpfp,
          midLpfp,
          lateLpfp,
        },
      });
    }

    if (
      earlyLpfp > 0 &&
      lateLpfp > 0 &&
      lateLpfp < earlyLpfp - 5 &&
      lateLpfp < 65
    ) {
      events.push({
        id: buildEventId("lpfp_drop_late", index),
        type: "lpfp_drop",
        severity: lateLpfp < 50 ? "high" : "medium",
        confidence: 0.78,
        startIndex: sections.late.start,
        endIndex: sections.late.end,
        rpmStart: rpm[sections.late.start] ?? 0,
        rpmEnd: rpm[sections.late.end] ?? 0,
        supportingChannels: ["lpfp"],
        evidence: [
          `LPFP weakened later in the pull`,
          `Early minimum ${earlyLpfp.toFixed(1)}, late minimum ${lateLpfp.toFixed(1)}`,
        ],
        metrics: {
          earlyLpfp,
          midLpfp,
          lateLpfp,
        },
      });
    }

    if (minAfr > 0 && minAfr > 12.3) {
      events.push({
        id: buildEventId("lean_under_load", index),
        type: "lean_under_load",
        severity: minAfr > 13 ? "high" : "medium",
        confidence: 0.76,
        startIndex: start,
        endIndex: end,
        rpmStart: rpm[start] ?? 0,
        rpmEnd: rpm[end] ?? 0,
        supportingChannels: ["afr", "throttle", "boost"],
        evidence: [
          `Lean condition under load, minimum AFR was ${minAfr.toFixed(2)}`,
        ],
        metrics: {
          minAfr,
        },
      });
    }

    if (hasMeaningfulData(throttleSlice)) {
      const throttleDropIndex = findLowestThrottleIndex(throttle, start, end);
      const throttleDrop = throttle[throttleDropIndex] ?? 100;

      if ((avgThrottle > 60 && throttleDrop < 75) || throttleDrop < 65) {
        const eventStart = Math.max(start, throttleDropIndex - 2);
        const eventEnd = Math.min(end, throttleDropIndex + 2);

        events.push({
          id: buildEventId("throttle_closure", index),
          type: "throttle_closure",
          severity: throttleDrop < 55 ? "high" : "medium",
          confidence: 0.82,
          startIndex: eventStart,
          endIndex: eventEnd,
          rpmStart: rpm[eventStart] ?? 0,
          rpmEnd: rpm[eventEnd] ?? 0,
          supportingChannels: ["throttle", "boost", "boost_target"],
          evidence: [
            `Throttle dropped to ${throttleDrop.toFixed(1)}% near ${Math.round(
              rpm[throttleDropIndex] ?? 0
            )} RPM`,
          ],
          metrics: {
            throttleDrop,
            avgThrottle,
            throttleDropIndex,
          },
        });
      }
    }

    if (cylKeys.length) {
      const cylPeaks = cylKeys.map((key) => {
        const values = parsedLog.channels[key] || [];
        let worstIndex = start;
        let worstValue = values[start] ?? 0;

        for (let i = start; i <= end; i++) {
          const value = values[i] ?? 0;
          if (value < worstValue) {
            worstValue = value;
            worstIndex = i;
          }
        }

        return {
          key,
          peak: worstValue,
          index: worstIndex,
        };
      });

      const strongCorrections = cylPeaks.filter((c) => c.peak <= -2);

      if (strongCorrections.length >= 2) {
        const eventStart = Math.max(
          start,
          Math.min(...strongCorrections.map((c) => c.index)) - 2
        );
        const eventEnd = Math.min(
          end,
          Math.max(...strongCorrections.map((c) => c.index)) + 2
        );

        events.push({
          id: buildEventId("multi_cyl_timing_correction", index),
          type: "multi_cyl_timing_correction",
          severity: strongCorrections.some((c) => c.peak <= -4) ? "high" : "medium",
          confidence: 0.84,
          startIndex: eventStart,
          endIndex: eventEnd,
          rpmStart: rpm[eventStart] ?? 0,
          rpmEnd: rpm[eventEnd] ?? 0,
          supportingChannels: strongCorrections.map((c) => c.key),
          evidence: [
               `Multiple cylinders showed timing correction: ${strongCorrections
                  .map((c) => {
                const cyl = c.key.match(/\d+/)?.[0] ?? "?";
                return `Cylinder ${cyl}: ${c.peak.toFixed(1)}°`;
                })
                  .join(", ")}`,
          ],
          metrics: Object.fromEntries(
            strongCorrections.map((c) => [c.key, c.peak])
          ),
        });
      } else {
        const worst = cylPeaks.find((c) => c.peak <= -2);

        if (worst) {
          const eventStart = Math.max(start, worst.index - 2);
          const eventEnd = Math.min(end, worst.index + 2);

          events.push({
            id: buildEventId("timing_correction", index),
            type: "timing_correction",
            severity: worst.peak <= -4 ? "high" : "medium",
            confidence: 0.76,
            startIndex: eventStart,
            endIndex: eventEnd,
            rpmStart: rpm[eventStart] ?? 0,
            rpmEnd: rpm[eventEnd] ?? 0,
            supportingChannels: [worst.key],
            evidence: [
              `${worst.key} showed timing correction of ${worst.peak.toFixed(1)} near ${Math.round(
                rpm[worst.index] ?? 0
              )} RPM`,
            ],
            metrics: {
              [worst.key]: worst.peak,
              worstIndex: worst.index,
            },
          });
        }
      }
    }
  });

  return events;
}
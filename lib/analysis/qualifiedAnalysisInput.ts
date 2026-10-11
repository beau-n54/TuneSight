import type { ParsedLog, VehicleSetup } from "./types.ts";
import type { TranslatedLog, TranslatedLogRow } from "../logging/types.ts";

const channelKeys = {
  boost: "boostPsi", boost_target: "boostTargetPsi", throttle: "throttlePlate", accelerator_pedal: "acceleratorPedal", iat: "iat", afr: "afr",
  rail_pressure: "railPressure", lpfp: "lpfp", wgdc: "wgdc",
  ethanol: "ethanol",
  timing_correction_cyl_1: "timingCyl1", timing_correction_cyl_2: "timingCyl2", timing_correction_cyl_3: "timingCyl3",
  timing_correction_cyl_4: "timingCyl4", timing_correction_cyl_5: "timingCyl5", timing_correction_cyl_6: "timingCyl6",
} as const satisfies Record<string, keyof TranslatedLogRow>;

export function qualifiedAnalysisPlatform(vehicle: VehicleSetup | null): "n54" | "unknown" {
  // Only the existing N54 rule set is qualified. A model name, expected offline
  // ROM, source/logger family or a B58 label cannot grant N54 applicability.
  return vehicle?.engineCode?.trim().toUpperCase() === "N54" ? "n54" : "unknown";
}

export function buildQualifiedParsedLog(log: TranslatedLog): ParsedLog {
  const timestamps = log.rows.map(row => row.time);
  const rpm = log.rows.map(row => row.rpm);
  if (!timestamps.length || !timestamps.every((value): value is number => typeof value === "number" && Number.isFinite(value)) || !rpm.every((value): value is number => typeof value === "number" && Number.isFinite(value)) || timestamps.some((value, i) => i > 0 && value <= timestamps[i - 1])) throw new Error("Qualified time and RPM observations are required.");
  const channels: ParsedLog["channels"] = { rpm: [...rpm] };
  const unavailableChannels: string[] = [];
  for (const [key, source] of Object.entries(channelKeys)) {
    const values = log.rows.map(row => row[source]);
    // A rule consumes only a fully observed aligned channel. Partial source
    // observations remain in evidenceTelemetry; no interpolation or zero fill.
    if (values.every((value): value is number => typeof value === "number" && Number.isFinite(value))) channels[key] = values;
    else { channels[key] = []; unavailableChannels.push(key); }
  }
  return { sampleCount: log.rows.length, durationSec: timestamps.at(-1)! - timestamps[0], timestamps, rpm, channels,
    unavailableChannels,
    evidenceTelemetry: Object.fromEntries(Object.entries(channelKeys).map(([key, source]) => [key, log.rows.map(row => typeof row[source] === "number" && Number.isFinite(row[source]) ? row[source]! : null)])),
  };
}

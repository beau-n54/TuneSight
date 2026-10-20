import { buildAnalysisResult } from "./engine";
import { qualifiedAnalysisPlatform } from "./qualifiedAnalysisInput";
import type { OwnedLog } from "./analysisCapabilities";
import type { AnalysisSource } from "./analysisSource";
import type { VehicleSetup } from "./types";

/** Response-only view. Deliberately no database, storage or write capability. */
export function recoverAnalysisWorkspace(input: {
  log: OwnedLog | null; owner: string; vehicle: VehicleSetup; source: AnalysisSource | null;
}) {
  const { log, owner, vehicle, source } = input;
  const owned = log?.user_id === owner && log.vehicle_id === vehicle.vehicleId;
  const measurements = owned && source?.state === "available" && source.digest ? source.measurements : null;
  const telemetry: Record<string, (number | null)[]> = {};
  const aliases: Record<string, string> = { boost_target: "boostTarget", rail_pressure: "railPressure" };
  for (const channel of measurements?.channels ?? []) telemetry[aliases[channel.key] ?? channel.key] = [...channel.values];
  if (measurements?.timestamps) telemetry.timestamps = [...measurements.timestamps];
  const observed = (key: string) => measurements?.channels.find(channel => channel.key === key)?.values.filter((value): value is number => value !== null) ?? [];
  const minimum = (key: string) => { const values = observed(key); return values.length ? values.reduce((a, b) => Math.min(a, b)) : null; };
  const maximum = (key: string) => { const values = observed(key); return values.length ? values.reduce((a, b) => Math.max(a, b)) : null; };
  const average = (key: string) => { const values = observed(key); return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null; };
  let analysis: ReturnType<typeof buildAnalysisResult> | null = null;
  let finding = !measurements ? source?.finding ?? "No owned source is selected."
    : qualifiedAnalysisPlatform(vehicle) === "unknown"
      ? "Source measurements recovered. Platform-specific conclusions are unavailable under the current declared-platform rule contract; N54 rules were not applied."
      : "Source measurements recovered. Diagnostic input lacks a fully observed RPM channel or qualified timebase.";
  if (measurements?.parsedLog && qualifiedAnalysisPlatform(vehicle) === "n54") {
    try {
      // An unrelated latest tune/profile cannot establish which tune produced this log.
      analysis = buildAnalysisResult({ parsedLog: measurements.parsedLog, vehicle, tuneProfile: null });
      finding = "Existing owned source analysed in memory under qualified-source-v1. No log, result or source was created or changed.";
    } catch {
      finding = "Source measurements recovered, but diagnostic processing could not complete. Retry this same source; no duplicate upload is required.";
    }
  }
  return {
    diagnostics: analysis !== null, finding, telemetry: {...telemetry, ...analysis?.summary.telemetry},
    summaryRow: measurements ? {
      id: `in-memory:${log!.id}:${source!.digest}`,
      avg_boost: average("boost"), max_boost: maximum("boost"),
      avg_boost_target: average("boost_target"), max_boost_target: maximum("boost_target"),
      max_iat: maximum("iat"), min_afr: minimum("afr"), max_wgdc: maximum("wgdc"),
      min_rail_pressure: minimum("rail_pressure"), min_lpfp: minimum("lpfp"),
      ethanol_content: average("ethanol"),
      cyl1_max_timing_correction: minimum("timing_correction_cyl_1"),
      cyl2_max_timing_correction: minimum("timing_correction_cyl_2"),
      cyl3_max_timing_correction: minimum("timing_correction_cyl_3"),
      cyl4_max_timing_correction: minimum("timing_correction_cyl_4"),
      cyl5_max_timing_correction: minimum("timing_correction_cyl_5"),
      cyl6_max_timing_correction: minimum("timing_correction_cyl_6"),
      throttle_closure_detected: analysis?.summary.throttleClosureDetected ?? null,
      analysis: analysis ? { fuelValidation: analysis.fuelValidation } : null,
      summary: { engine_v2: analysis },
    } : null,
  };
}

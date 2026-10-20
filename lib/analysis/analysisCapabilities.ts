import { buildQualifiedParsedLog, qualifiedAnalysisPlatform } from "./qualifiedAnalysisInput.ts";
import type { ParsedLog } from "./types.ts";
import { parseBoundedLogCsv } from "../logging/boundedCsv.ts";
import { translateLogRows } from "../logging/translator.ts";
import { qualifyTranslatedEvidenceSource } from "./evidenceSourceQualification.ts";
import { loadEvidenceReloadWithProvenance } from "./evidenceProvenance.ts";
import type { TranslatedLogRow } from "../logging/types.ts";
import type { VehicleSetup } from "./types.ts";

export type OwnedLog = { id: string; user_id: string; vehicle_id: string; created_at: string; log_name?: string | null; raw_source_storage_path?: string | null; file_url?: string | null; authoritative_log_summary_id?: string | null };
export type OwnedResult = { id: string; user_id: string; vehicle_id: string; log_id: string; created_at?: string; summary?: unknown };
export type SourceState = "available" | "missing" | "unresolved" | "temporarily_unavailable";

export function diagnosticResultQualified(result: OwnedResult, log: OwnedLog, owner: string, vehicle: VehicleSetup): boolean {
  if (log.user_id !== owner || log.vehicle_id !== vehicle.vehicleId || result.user_id !== owner || result.vehicle_id !== vehicle.vehicleId || result.log_id !== log.id || result.id !== log.authoritative_log_summary_id) return false;
  const payload = result.summary as { engine_v2?: { inputQualification?: { contract?: string; platform?: string } } } | null;
  const qualification = payload?.engine_v2?.inputQualification;
  const rulePlatform = qualifiedAnalysisPlatform(vehicle);
  return rulePlatform !== "unknown" && qualification?.contract === "qualified-source-v1" && qualification.platform === rulePlatform;
}

export function ownedCandidates(logs: readonly OwnedLog[], owner: string, vehicleId: string, selectedId?: string) {
  return logs.filter(log => log.user_id === owner && log.vehicle_id === vehicleId && (!selectedId || log.id === selectedId))
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
}

/** Never promote an uncommitted candidate or rewrite authority to recover a page. */
export async function selectAnalysisEvidence(logs: readonly OwnedLog[], results: readonly OwnedResult[], owner: string, vehicle: VehicleSetup, selectedId?: string) {
  const candidates = ownedCandidates(logs, owner, vehicle.vehicleId, selectedId);
  for (const log of candidates) {
    const result = results.find(item => diagnosticResultQualified(item, log, owner, vehicle));
    if (!result) continue;
    const reload = await loadEvidenceReloadWithProvenance({loadLog: async () => log, loadSummary: async id => results.find(item => item.id === id)},
      {logId: log.id, expectedUserId: owner, expectedVehicleId: vehicle.vehicleId});
    if (reload.currentAuthority.state === "available" && reload.evidenceProvenance.state === "available") return {log, result};
  }
  return {log: candidates[0] ?? null, result: null};
}

const channelDefinitions = {
  rpm: ["rpm", "rpm"], boost: ["boostPsi", "psi"], boost_target: ["boostTargetPsi", "psi"],
  throttle: ["throttlePlate", "%"], accelerator_pedal: ["acceleratorPedal", "%"], iat: ["iat", "°C"],
  afr: ["afr", "AFR"], rail_pressure: ["railPressure", "psi"], lpfp: ["lpfp", "psi"], wgdc: ["wgdc", "%"], ethanol: ["ethanol", "%"],
  timing_correction_cyl_1: ["timingCyl1", "°"], timing_correction_cyl_2: ["timingCyl2", "°"], timing_correction_cyl_3: ["timingCyl3", "°"],
  timing_correction_cyl_4: ["timingCyl4", "°"], timing_correction_cyl_5: ["timingCyl5", "°"], timing_correction_cyl_6: ["timingCyl6", "°"],
  timing_correction_cyl_7: ["timingCyl7", "°"], timing_correction_cyl_8: ["timingCyl8", "°"],
} as const satisfies Record<string, readonly [keyof TranslatedLogRow, string]>;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/** Uses the source owner's translators, without the diagnostic engine's RPM/core-channel prerequisite. */
export function parseSourceMeasurements(text: string) {
  let metadataTrailer = false;
  let csv: ReturnType<typeof parseBoundedLogCsv>;
  try { csv = parseBoundedLogCsv(text); }
  catch (error) {
    // Some BM3 exports append a 24-hex logger identifier after their version header,
    // without a data column. Remove only that exact non-measurement header in memory;
    // the strict parser must still validate every remaining column and row.
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
    const header = lines.findIndex(line => line.trim() && !line.startsWith("#"));
    if (header < 0 || !/,bootmod3_[A-Za-z0-9._-]+,[a-f0-9]{24}$/.test(lines[header])) throw error;
    lines[header] = lines[header].replace(/,[a-f0-9]{24}$/, "");
    csv = parseBoundedLogCsv(lines.join("\n"));
    metadataTrailer = true;
  }
  const translated = translateLogRows(csv.rows);
  const qualification = qualifyTranslatedEvidenceSource(translated, {sourceLogId: null, sourceAvailability: "unknown"});
  if (qualification.kind === "unsupported_source") return {parsedLog: null, timestamps: null, channels: [] as {key: string; unit: string; values: (number | null)[]}[], blockers: ["CSV parsed, but no qualified channel/unit translator exists for this source format. No measurements or diagnostic conclusions are inferred."], sourceFormat: translated.platform, sampleCount: csv.rows.length};
  const times = translated.rows.map(row => row.time);
  const timestamps = times.length && times.every(finite) && times.every((value, index) => index === 0 || value > times[index - 1]!) ? times as number[] : null;
  const channels: {key: string; unit: string; values: (number | null)[]}[] = [];
  const blockers: string[] = metadataTrailer ? ["BM3 trailing logger identifier has no measurement column; excluded from the in-memory projection only."] : [];
  for (const [key, [source, unit]] of Object.entries(channelDefinitions)) {
    // An optional eight-cylinder logger layout is displayed only when supplied.
    // It cannot establish physical cylinder count or change diagnostic applicability.
    if (/timing_correction_cyl_[78]/.test(key) && !csv.headers.some(h => h.toLowerCase().replace(/[.\s]/g, "").includes(`cyl${key.at(-1)}`))) continue;
    const values = translated.rows.map(row => finite(row[source]) ? row[source] as number : null);
    if (values.some(finite)) {
      channels.push({key, unit, values});
      if (values.some(value => value === null)) blockers.push(`${key}: incomplete observations; gaps are preserved.`);
    } else blockers.push(`${key}: no unambiguous finite observations accepted by the ${translated.platform} channel/unit contract.`);
  }
  const temperatureHeaders = csv.headers.filter(header => /iat|intake air temp/i.test(header));
  if (!channels.some(channel => channel.key === "iat") && temperatureHeaders.length) blockers.push(`Temperature unit/alias blocker: source headers ${temperatureHeaders.join(", ")}. Exactly one recognised Celsius or Fahrenheit column with finite values is required.`);
  if (!timestamps) blockers.push("Elapsed-time graphs unavailable: time observations must be finite, in qualified seconds, and strictly increasing. Channel measurements remain available in source-row order.");
  let parsedLog: ParsedLog | null = null;
  try { parsedLog = buildQualifiedParsedLog(translated); }
  catch { blockers.push("Diagnostic input unavailable: aligned finite RPM and a strictly increasing timebase are required."); }
  return {parsedLog, timestamps, channels, blockers, sourceFormat: translated.platform, sampleCount: translated.rows.length};
}
export type SourceMeasurements = ReturnType<typeof parseSourceMeasurements>;
export function analysisCapabilities(source: SourceState, measurements: SourceMeasurements | null, vehicle: VehicleSetup, diagnostics: boolean) {
  return {ownedSourceAccessible: source === "available", sourceParsed: measurements !== null,
    unitsQualified: !measurements?.channels.length ? "unavailable" : measurements.blockers.length ? "partial" : "qualified",
    // This route has no qualified controller observations; a saved label is not observed evidence.
    platformEvidenceAvailable: false, platformSpecificRulesQualified: qualifiedAnalysisPlatform(vehicle) !== "unknown",
    diagnosticConclusionsAvailable: diagnostics};
}

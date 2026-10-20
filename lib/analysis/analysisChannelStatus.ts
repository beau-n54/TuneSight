import type { AnalysisSource } from "./analysisSource";
import type { AnalysisCalibrationResolution } from "./analysisCalibrationContext";
import { analysisEvidenceSections } from "./analysisEvidenceSections.ts";
import { sourceObservationEvents } from "./sourceObservationEvents.ts";

/** Telemetry existence and semantic authority are independent. No alias guessing,
 * source admission, diagnostic inference or persistence takes place here. */
export function analysisChannelStatus(source: AnalysisSource | null, resolution: AnalysisCalibrationResolution, diagnosticChannels: readonly string[] = []) {
  const m = source?.state === "available" && source.digest ? source.measurements : null;
  const facts = analysisEvidenceSections(source), events = sourceObservationEvents(source);
  const unassignedHeaders = m?.headerEvidence?.unassigned ?? [];
  const keys = [...new Set([...(m?.headerEvidence?.channels.map(c => c.key) ?? []), ...(m?.channels.map(c => c.key) ?? [])])];
  const channels = keys.map(key => {
    const values = m?.channels.find(c => c.key === key);
    const count = values?.values.filter(v => typeof v === "number" && Number.isFinite(v)).length ?? 0;
    const headers = m?.headerEvidence?.channels.find(c => c.key === key)?.headers ?? [];
    const raw = headers.length || count ? "present" : unassignedHeaders.length || !m?.headerEvidence ? "unresolved" : "absent";
    const alias = headers.length === 1 || count ? "qualified" : headers.length > 1 ? "ambiguous" : "unqualified";
    const relationships = resolution.relationships.filter(r => r.channel === key);
    const bindings = relationships.filter(r => r.grade === "Exact Definition telemetry relationship");
    const system = facts.systems.find(s => s.channels.includes(key))?.system ?? null;
    const usage = count ? events.checks.filter(c => c.channels.includes(key) && c.state !== "unavailable").map(c => c.title) : [];
    const telemetryMessage = count ? `${count} valid observations (${values!.unit}).`
      : raw === "absent" ? "Not present in the selected log."
      : headers.length > 1 ? `Source columns exist, but multiple authorised aliases conflict: ${headers.join(", ")}. No column is selected.`
      : headers.length === 1 ? `Source column ${headers[0]} is recognised; no finite observations were accepted.`
      : "No authorised channel/unit mapping is established. Unassigned source headers are listed below; they are not treated as absent or guessed into this channel.";
    return {key, raw, headers, alias, samples: {state: count ? "available" : "unavailable", count, unit: values?.unit ?? null},
      system, eventUsage: usage, bindings, inspectionRelationships: relationships.filter(r => !bindings.includes(r)),
      diagnosticRelationship: count && diagnosticChannels.includes(key) ? "available" : "not_established",
      telemetryMessage, bindingMessage: bindings.length ? "Qualified exact Calibration-table binding available."
        : count ? "Telemetry available; no qualified Calibration-table binding has been established."
        : "No qualified Calibration-table binding has been established."};
  });
  return {channels, unassignedHeaders, sourceFinding: m ? null : source?.finding ?? "No owned source selected."};
}
export type AnalysisChannelStatus = ReturnType<typeof analysisChannelStatus>;

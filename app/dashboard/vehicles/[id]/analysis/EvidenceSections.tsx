import Link from "next/link";
import type { ReactNode } from "react";
import type { AnalysisEvidenceSections } from "@/lib/analysis/analysisEvidenceSections";
import type { AnalysisCalibrationResolution } from "@/lib/analysis/analysisCalibrationContext";
import type { AnalysisSource } from "@/lib/analysis/analysisSource";
import { analysisChannelStatus } from "@/lib/analysis/analysisChannelStatus";
import type { SourceInvestigation } from "@/lib/analysis/sourceInvestigation";

function Section({title, children}: {title: string; children: ReactNode}) {
  return <section className="min-w-0 space-y-2" data-analysis-section={title}>
    <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
    <div className="break-words text-sm text-zinc-300">{children}</div>
  </section>;
}
const number = (value: number) => value.toLocaleString("en", {maximumFractionDigits: 3});
function Items({items, empty}: {items: readonly string[]; empty: string}) {
  return items.length ? <ul className="list-disc space-y-1 pl-5">{items.map((s, i) => <li key={i}>{s}</li>)}</ul> : <p>{empty}</p>;
}

export function SourceWarningSections({facts, diagnostics}: {facts: AnalysisEvidenceSections; diagnostics: boolean}) {
  return <div className="grid gap-4 md:grid-cols-2">
    <Section title="Source and data quality">{facts.source}</Section>
    <Section title="Missing-channel warnings"><Items items={facts.missing} empty="No missing-channel blockers reported by the source contract."/></Section>
    <Section title="Unit and header warnings"><Items items={facts.units} empty="Accepted channels use recognised units; no additional header blockers reported."/></Section>
    <Section title="Measurement-limit observations">
      Observed ranges are source extrema, not validated operating limits or an all-clear.
      {facts.ranges.length ? <ul className="mt-2 space-y-1">{facts.ranges.map(r => <li key={r.channel}>{r.channel}: {number(r.minimum)} to {number(r.maximum)} {r.unit} ({r.count} observations; {r.missing} gaps)</li>)}</ul> : <p>No qualified finite measurements available.</p>}
    </Section>
    <Section title="Factual target-versus-actual observations">{facts.targetDifference
      ? <p>Boost actual minus target at matching source rows: {number(facts.targetDifference.minimum)} to {number(facts.targetDifference.maximum)} {facts.targetDifference.unit}, over {facts.targetDifference.count} paired observations. This is not an overboost diagnosis, a taper classification or a calibrated tolerance.</p>
      : <p>Unavailable: both unambiguous boost and boost-target channels in the same qualified unit are required. Independent peaks are not subtracted.</p>}</Section>
    <Section title="Platform-specific diagnostic warnings">{diagnostics
      ? "Qualified diagnostic warnings and event evidence follow below; source facts above retain their independent authority."
      : "Fault severity and causal conclusions need an applicable rule and its required channels. Source-derived observations and inspection evidence remain available independently."}</Section>
  </div>;
}

export function FactualInvestigation({facts, diagnostics, references, investigation}: {facts: AnalysisEvidenceSections; diagnostics: boolean; references: number; investigation: SourceInvestigation}) {
  return <div className="space-y-4">
    <Section title="Pull and operating windows">
      <p>{investigation.operatingRegion}</p>
      <p>{investigation.windowBlocker ?? (investigation.pullState === "observed" ? `${investigation.windows.filter(w => w.loadedAcceleration).length} measured high-demand acceleration window(s).` : "No qualifying high-demand acceleration window was captured. Source observations remain available in the recorded operating region.")}</p>
      <details><summary>Window criteria and exact source intervals</summary><p>{investigation.windowCriteria}</p>
        <ul>{investigation.windows.map(w => <li key={w.startRow}>Rows {w.startRow + 1}–{w.endRow + 1}; {number(w.startSeconds)}–{number(w.endSeconds)} s; {w.rpmStart}–{w.rpmEnd} rpm. {w.loadedAcceleration ? "Acceleration selection criteria met." : "Demand interval only; duration or net acceleration criteria not met."}</li>)}</ul>
      </details>
    </Section>
    <Section title="Factual observations"><Items items={facts.systems.map(s => `${s.channels.join(", ")} → ${s.system}. Factual channel-to-system association only; not a Definition binding or diagnosis.`)} empty="No qualified channel-to-system observations available."/></Section>
    <Section title="Root Cause and candidate ranking">{diagnostics && references
      ? `${references} qualified event cross-reference records are expanded in Cross-Reference Details below, with their existing candidate ranking and evidence.`
      : "Root cause is not established. Measured inspection candidates below remain available without a platform-specific fault contract or active modified BIN."}
      <p>{investigation.ranking}</p>
      {investigation.observations.checks.filter(c => c.events.length).map(check => <details key={check.id}>
        <summary>{check.title} — {check.events.length} evidence-supported inspection candidates</summary>
        <ol className="list-decimal space-y-2 pl-5">{investigation.candidates.filter(c => c.event.kind === check.id).slice(0, 50).map(c => <li key={c.event.id}>
          <p>#{c.rankWithinCheck} within this check: {c.note} Rows {c.event.startRow + 1}–{c.event.endRow + 1}.</p>
          <p>Coincident observations: {c.relatedKinds.join("; ") || "none established"}. Coincidence does not identify a cause.</p>
          {c.contextCandidate && <details><summary>Evidence-supported context candidate: {c.contextCandidate.label}</summary><p>{c.contextCandidate.conclusion}</p><Items items={c.contextCandidate.evidence} empty="No transition evidence."/></details>}
        </li>)}</ol>
        {check.events.length > 50 && <p>First 50 ranked candidates displayed; all {check.events.length} intervals remain included in the count. Inspect the original source for the complete sequence.</p>}
      </details>)}
      {!investigation.candidates.length && <p>No event candidate established by the available source checks; individual channel blockers remain listed below.</p>}
    </Section>
    <Section title="Alternatives and rejected explanations">{diagnostics && references
      ? "Event-specific alternatives and rejected candidates remain in the qualified cross-reference records below."
      : "Alternatives remain open unless independent evidence distinguishes them. A source-derived observation is not a component diagnosis."}
      {investigation.observations.primary.map(event => <details key={event.id}><summary>{event.title}: alternatives and unsupported claims</summary>
        <Items items={event.alternatives.map(a => `${a}: open; not excluded by these observations.`)} empty="No alternative established."/>
        <p>Unsupported claim withheld: {event.withheld}</p>
      </details>)}
    </Section>
    <Section title="Inspection directions">{facts.ranges.length
      ? "Inspect the original source rows and channel gaps alongside the graphs. Exact Calibration inspection requires the admitted Definition relationship shown in Related XDF; a measured range is not an instruction to change a table."
      : "Recover access to the selected original source before investigating its measurements."}
      <Items items={investigation.observations.primary.map(e => `${e.title}: ${e.inspection}`)} empty="No additional event-specific inspection direction."/>
    </Section>
    <Section title="Event notes">{diagnostics && <p>Qualified diagnostic event notes remain attached to their event records below.</p>}
      <p>{investigation.candidates.length} source-derived event notes, independent of diagnostic qualification. No fault severity is implied.</p>
      <details><summary>Exact event notes and channel blockers</summary>
        <Items items={investigation.candidates.slice(0, 200).map(c => `${c.event.title}; rows ${c.event.startRow + 1}–${c.event.endRow + 1}: ${c.note}`)} empty="No matching event observed."/>
        {investigation.candidates.length > 200 && <p>First 200 notes displayed; counts include all source intervals.</p>}
        <Items items={investigation.observations.checks.filter(c => c.state === "unavailable").map(c => `${c.title}: ${c.reason}`)} empty="All source checks have their required inputs."/>
      </details>
    </Section>
    <Section title="Cylinder Timing Observation"><Items items={facts.timing.map(r => `${r.channel}: ${number(r.minimum)} to ${number(r.maximum)} ${r.unit}; ${r.count} observations, ${r.missing} gaps. Measured correction only, not a knock diagnosis.`)} empty="Unavailable: no unambiguous cylinder timing-correction channel with qualified units. Damaged or missing headers are not inferred."/></Section>
    <Section title="Channel and unit blockers"><Items items={facts.blockers} empty="No additional source-contract blockers reported."/></Section>
  </div>;
}

export function CalibrationEvidenceSections({resolution, source, diagnosticChannels = [], logId, vehicleId}: {resolution: AnalysisCalibrationResolution; source: AnalysisSource | null; diagnosticChannels?: readonly string[]; logId: string | null; vehicleId: string}) {
  const identity = resolution.identity;
  const status = analysisChannelStatus(source, resolution, diagnosticChannels);
  const observed = status.channels.filter(c => c.samples.state === "available");
  const blocked = status.channels.filter(c => c.samples.state !== "available");
  const unbound = observed.filter(c => !c.bindings.length);
  return <div className="space-y-4">
    <Section title="Universal XDF">
      <p>Calibration evidence is checked against the selected owned log. Definition-source identity is separate from observed DME/ROM identity.</p>
      <details><summary className="cursor-pointer text-sky-300">Selected log evidence</summary><p>Vehicle {vehicleId}; selected owned log {logId ?? "unavailable"}.</p></details>
      {identity && <details><summary className="cursor-pointer text-sky-300">Exact source identity and admission evidence — {identity.software}</summary><dl className="mt-2 space-y-1">
        <dt>Owned vehicle / selected log</dt><dd>{vehicleId} / {logId ?? "unavailable"}</dd>
        <dt>Read-only resolution path / durable source record</dt><dd>{resolution.resolutionPath} {resolution.sourceId}</dd>
        <dt>Exact source software / Definition-source family</dt><dd>{identity.software} / {identity.family ?? "unestablished"}</dd>
        <dt>Source container / engineering bytes</dt><dd>{identity.container} / {identity.bytes.toLocaleString("en")}</dd>
        <dt>Engineering source SHA-256</dt><dd className="break-all">{identity.digest}</dd>
        <dt>Dataset revision</dt><dd className="break-all">{identity.dataset}</dd>
        <dt>Definition Set / source artifact</dt><dd className="break-all">{identity.definitionSet} / {identity.artifact}</dd>
      </dl></details>}
    </Section>
    <Section title="Calibration Cross Reference">
      <p>{observed.length} telemetry channels have valid observations. Table bindings and diagnostic relationships are assessed separately.</p>
      <Section title="Observed Telemetry">
        <ul className="space-y-2">{observed.map(c => <li key={c.key} data-telemetry-channel={c.key} data-telemetry-state="available">
          <strong>{c.key}</strong>: {c.telemetryMessage} <p>{c.bindingMessage}</p>
          {resolution.relationships.some(r => r.channel === c.key) && <div className="mt-1 text-sm">
            <p>Qualified Definition inspection relationships (independent of active modified bytes):</p>
            <ul>{resolution.relationships.filter(r => r.channel === c.key).map(r => <li key={`${r.key}:${r.assertion}`}>{r.title} — {r.grade}.</li>)}</ul>
            <p>Active-tune table values are not established by an inspection relationship.</p>
          </div>}
          <details><summary className="cursor-pointer text-sky-300">Channel evidence and independent states</summary>
            <p>Raw channel: {c.raw}; translator alias: {c.alias}; headers: {c.headers.join(", ") || "qualified normalised source"}.</p>
            <p>System association: {c.system ?? "not established"}.</p>
            <p>Platform-neutral event usage: {c.eventUsage.join("; ") || "no applicable check established; measurements remain available"}.</p>
            <p>Platform-qualified diagnostic relationship: {c.diagnosticRelationship === "available" ? "available in the separately qualified event cross-references" : "not established for this channel"}.</p>
          </details>
        </li>)}</ul>
        {!observed.length && <p>{status.sourceFinding ?? "No qualified finite observations are available."}</p>}
        <details><summary className="cursor-pointer text-sky-300">Missing or blocked telemetry channels ({blocked.length})</summary>
          <Items items={blocked.map(c => `${c.key}: ${c.telemetryMessage}`)} empty="No additional channel blockers."/>
          {status.unassignedHeaders.length > 0 && <p>Source columns present without an authorised mapping: {status.unassignedHeaders.join(", ")}. Their alias/unit is unqualified; no fuzzy mapping is applied.</p>}
        </details>
      </Section>
      <Section title="System Association">
        <Items items={Array.from(new Set(observed.filter(c => c.system).map(c => c.system))).map(system => `${system}: ${observed.filter(c => c.system === system).map(c => c.key).join(", ")}.`)} empty="No factual system association established."/>
        <p>Factual associations are not exact table bindings or diagnostic conclusions.</p>
      </Section>
      <Section title="Unavailable Bindings">
        {unbound.length ? <p>Binding only — {unbound.map(c => c.key).join(", ")}: Telemetry available; no qualified Calibration-table binding has been established.</p> : <p>No additional binding gap for the observed channels.</p>}
        <details><summary className="cursor-pointer text-sky-300">Binding authority and limits</summary>
          <p>{resolution.reason ?? `${resolution.relationships.length} evidence-supported inspection relationships available. Exact telemetry bindings, system membership and source-described suggestions retain separate grades.`}</p>
          <p>An inspection suggestion is not promoted to an exact binding. No diagnostic, editing or persistence authority is implied.</p>
        </details>
      </Section>
    </Section>
    <Section title="Related XDF">
      {resolution.relationships.length ? <ul className="space-y-3">{resolution.relationships.map((r, i) => <li key={`${r.key}:${i}`}>
        {resolution.href ? <Link className="text-sky-300 underline" href={`${resolution.href}&definition=${encodeURIComponent(r.key)}`}>{r.title}</Link> : <strong>{r.title}</strong>}
        <p>{r.grade}: {r.channel} → {r.meaning}</p>
        <details><summary className="cursor-pointer text-sky-300">Definition, provenance and limits</summary><p className="break-all">Occurrence {r.occurrence}; {r.revision}; assertion {r.assertion}</p>
        <Items items={r.provenance} empty="No additional provenance text."/>
        <Items items={r.limitations} empty="No additional assertion-specific limitations."/></details>
      </li>)}</ul> : <p>Related XDF unavailable: {resolution.reason}</p>}
    </Section>
    <Section title="Related Calibration Tables">
      {resolution.relationships.length ? <ul className="space-y-2">{Array.from(new Map(resolution.relationships.map(r => [r.key, r])).values()).map(r => <li key={r.key}><strong>{r.title}</strong><details><summary className="cursor-pointer text-sky-300">Exact table occurrence</summary><p className="break-all">{r.revision}; occurrence {r.occurrence}. {resolution.href ? "Inspectable in the current Calibration session." : "Exact admitted Definition evidence is displayed above in this response. No persistent Calibration session or editing access was created."}</p></details></li>)}</ul>
        : <p>Unavailable: {resolution.reason} No table name, address or relationship is guessed.</p>}
    </Section>
  </div>;
}

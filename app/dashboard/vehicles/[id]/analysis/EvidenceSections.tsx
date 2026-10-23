import Link from "next/link";
import { EvidenceDisclosure } from "./SourceInspectionDetails";
import { relationshipInventory, relationshipPresentation, uniqueWarnings } from "./relationshipPresentation";
import type { ReactNode } from "react";
import type { AnalysisEvidenceSections } from "@/lib/analysis/analysisEvidenceSections";
import type { AnalysisCalibrationResolution } from "@/lib/analysis/analysisCalibrationContext";
import type { AnalysisSource } from "@/lib/analysis/analysisSource";
import { analysisChannelStatus } from "@/lib/analysis/analysisChannelStatus";
import type { SourceInvestigation } from "@/lib/analysis/sourceInvestigation";

function Section({title, children}: {title: string; children: ReactNode}) {
  return <section className="min-w-0 space-y-3 rounded-2xl border border-slate-700/70 bg-gradient-to-br from-slate-900/80 to-zinc-950 p-4 shadow-sm sm:p-5" data-analysis-section={title}>
    <h3 className="text-base font-semibold text-sky-100">{title}</h3>
    <div className="break-words text-sm leading-6 text-zinc-300">{children}</div>
  </section>;
}
const number = (value: number) => value.toLocaleString("en", {maximumFractionDigits: 3});
function Items({items, empty}: {items: readonly string[]; empty: string}) {
  return items.length ? <ul className="list-disc space-y-1 pl-5">{items.map((s, i) => <li key={i}>{s}</li>)}</ul> : <p>{empty}</p>;
}

export function SourceWarningSections({facts, diagnostics}: {facts: AnalysisEvidenceSections; diagnostics: boolean}) {
  const warnings = uniqueWarnings([...facts.missing, ...facts.units, ...facts.blockers]);
  return <div className="grid items-start gap-4 md:grid-cols-2">
    <Section title="Source and data quality">{facts.source}</Section>
    <Section title="Missing or unusable channels">
      <span className="inline-flex rounded-md border border-amber-800/60 bg-amber-950/30 px-2 py-1 text-amber-200">{warnings.length} distinct evidence blocker(s)</span>
      <p>Missing-channel warnings, unit and header warnings retain their exact reasons below. This status describes evidence availability, not fault severity.</p>
      <EvidenceDisclosure title="Channel and source-quality evidence"><Items items={warnings} empty="No additional source-contract blockers reported."/></EvidenceDisclosure>
    </Section>
    <Section title="Measured operating ranges">
      Observed ranges are source extrema, not validated operating limits or an all-clear.
      {facts.ranges.length ? <dl className="mt-3 divide-y divide-slate-700">{facts.ranges.map(r => <div key={r.channel} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2"><dt className="font-medium text-zinc-100">{r.channel}</dt><dd className="tabular-nums text-sky-200">{number(r.minimum)} to {number(r.maximum)} {r.unit}<span className="block text-xs text-zinc-400">{r.count} observations; {r.missing} gaps</span></dd></div>)}</dl> : <p>No qualified finite measurements available.</p>}
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
      <EvidenceDisclosure title={<> Window criteria and exact source intervals </>}><p>{investigation.windowCriteria}</p>
        <ul>{investigation.windows.map(w => <li key={w.startRow}>Rows {w.startRow + 1}–{w.endRow + 1}; {number(w.startSeconds)}–{number(w.endSeconds)} s; {w.rpmStart}–{w.rpmEnd} rpm. {w.loadedAcceleration ? "Acceleration selection criteria met." : "Demand interval only; duration or net acceleration criteria not met."}</li>)}</ul>
      </EvidenceDisclosure>
    </Section>
    <Section title="Factual observations"><Items items={facts.systems.map(s => `${s.channels.join(", ")} → ${s.system}. Factual channel-to-system association only; not a Definition binding or diagnosis.`)} empty="No qualified channel-to-system observations available."/></Section>
    <Section title="Evidence-supported investigation candidates">{diagnostics && references
      ? `${references} qualified event cross-reference records are expanded in Cross-Reference Details below, with their existing candidate ranking and evidence.`
      : "Root cause is not established. Measured inspection candidates below remain available without a platform-specific fault contract or active modified BIN."}
      <p>{investigation.ranking}</p>
      {investigation.observations.checks.filter(c => c.events.length).map(check => <EvidenceDisclosure key={check.id} title={`${check.title} — ${check.events.length} evidence-supported inspection candidates`}>
        <ol className="list-decimal space-y-2 pl-5">{investigation.candidates.filter(c => c.event.kind === check.id).map(c => <li key={c.event.id}>
          <a className="text-sky-300 underline" href={`#occurrence-${c.event.id}`}>Canonical observation: {c.event.title}, rows {c.event.startRow+1}–{c.event.endRow+1}</a>
          <p>Coincident observations: {c.relatedKinds.join("; ") || "none established"}. Coincidence does not identify a cause.</p>
          {c.contextCandidate && <EvidenceDisclosure title={<> Evidence-supported context candidate: {c.contextCandidate.label} </>}><p>{c.contextCandidate.conclusion}</p><Items items={c.contextCandidate.evidence} empty="No transition evidence."/></EvidenceDisclosure>}
        </li>)}</ol>
      </EvidenceDisclosure>)}
      {!investigation.candidates.length && <p>No event candidate established by the available source checks; individual channel blockers remain listed below.</p>}
    </Section>
    <Section title="Alternatives and rejected explanations">{diagnostics && references
      ? "Event-specific alternatives and rejected candidates remain in the qualified cross-reference records below."
      : "Alternatives remain open unless independent evidence distinguishes them. A source-derived observation is not a component diagnosis."}
      {investigation.observations.primary.map(event => <EvidenceDisclosure key={event.id} title={<> {event.title}: alternatives and unsupported claims </>}>
        <a className="text-sky-300 underline" href={`#occurrence-${event.id}`}>Review unresolved alternatives and withheld conclusions with the canonical observation.</a>
      </EvidenceDisclosure>)}
    </Section>
    <Section title="Inspection directions">{facts.ranges.length
      ? "Inspect the original source rows and channel gaps alongside the graphs. Exact Calibration inspection requires the admitted Definition relationship shown in Related XDF; a measured range is not an instruction to change a table."
      : "Recover access to the selected original source before investigating its measurements."}
      {investigation.observations.primary.map(e=><a key={e.id} className="block text-sky-300 underline" href={`#finding-${e.kind}`}>{e.title}: next check</a>)}
    </Section>
    <Section title="Event notes">{diagnostics && <p>Qualified diagnostic event notes remain attached to their event records below.</p>}
      <p>{investigation.candidates.length} source-derived event notes, independent of diagnostic qualification. No fault severity is implied.</p>
      <EvidenceDisclosure title={<> Exact event notes and channel blockers </>}>
        {investigation.candidates.map(c=><a key={c.event.id} className="block text-sky-300 underline" href={`#occurrence-${c.event.id}`}>{c.event.title}; rows {c.event.startRow+1}–{c.event.endRow+1}</a>)}
        <Items items={investigation.observations.checks.filter(c => c.state === "unavailable").map(c => `${c.title}: ${c.reason}`)} empty="All source checks have their required inputs."/>
      </EvidenceDisclosure>
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
  const inventory = relationshipInventory(resolution.relationships);
  const kinds = resolution.relationships.map(relationshipPresentation);
  const summary = [
    ["Selected source", source?.state ?? "unavailable"],
    ["Observed telemetry", observed.length],
    ["Direct table relationships", kinds.filter(k => k.kind === "direct").length],
    ["Related-system relationships", kinds.filter(k => k.kind === "related").length],
    ["Source-described relationships", kinds.filter(k => k.kind === "described").length],
    ["Channels without exact bindings", unbound.length],
    ["Definition/XDF admission", identity ? "Exact source admitted" : "Evidence unavailable"],
  ];
  return <div className="bmw-border min-w-0 space-y-4 rounded-2xl bg-slate-950 p-4 sm:p-6" data-calibration-inventory="primary">
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{summary.map(([label, value]) => <div key={label} className="rounded-xl border border-blue-800/60 bg-blue-950/30 p-4"><dt className="text-sm text-blue-200">{label}</dt><dd className="mt-2 text-lg font-semibold text-zinc-100">{value}</dd></div>)}</dl>
    <Section title="Universal XDF">
      <p>Calibration evidence is checked against the selected owned log. Definition-source identity is separate from observed DME/ROM identity.</p>
      <EvidenceDisclosure title={<> Selected log evidence </>}><p>Vehicle {vehicleId}; selected owned log {logId ?? "unavailable"}.</p></EvidenceDisclosure>
      {identity && <EvidenceDisclosure title={<> Exact source identity and admission evidence — {identity.software} </>}><dl className="mt-2 space-y-1">
        <dt>Owned vehicle / selected log</dt><dd>{vehicleId} / {logId ?? "unavailable"}</dd>
        <dt>Read-only resolution path / durable source record</dt><dd>{resolution.resolutionPath} {resolution.sourceId}</dd>
        <dt>Exact source software / Definition-source family</dt><dd>{identity.software} / {identity.family ?? "unestablished"}</dd>
        <dt>Source container / engineering bytes</dt><dd>{identity.container} / {identity.bytes.toLocaleString("en")}</dd>
        <dt>Engineering source SHA-256</dt><dd className="break-all">{identity.digest}</dd>
        <dt>Dataset revision</dt><dd className="break-all">{identity.dataset}</dd>
        <dt>Definition Set / source artifact</dt><dd className="break-all">{identity.definitionSet} / {identity.artifact}</dd>
      </dl></EvidenceDisclosure>}
    </Section>
    <Section title="Calibration Cross Reference">
      <p>{observed.length} telemetry channels have valid observations. Table bindings and diagnostic relationships are assessed separately.</p>
      <EvidenceDisclosure title={`Observed Telemetry — ${observed.length} available channels`}>
        <ul className="grid gap-3 md:grid-cols-2">{observed.map(c => <li key={c.key} data-telemetry-channel={c.key} data-telemetry-state="available" className="min-w-0 rounded-lg border border-slate-700 p-3">
          <strong className="text-sky-200">{c.key}</strong>: {c.telemetryMessage}<p>{c.bindingMessage}</p>
          <EvidenceDisclosure title="Channel evidence and independent states">
            <p>Raw channel: {c.raw}; translator alias: {c.alias}; headers: {c.headers.join(", ") || "qualified normalised source"}.</p>
            <p>System association: {c.system ?? "not established"}.</p>
            <p>Platform-neutral event usage: {c.eventUsage.join("; ") || "no applicable check established; measurements remain available"}.</p>
            <p>Platform-qualified diagnostic relationship: {c.diagnosticRelationship === "available" ? "available in the separately qualified event cross-references" : "not established for this channel"}.</p>
          </EvidenceDisclosure>
        </li>)}</ul>
        {!observed.length && <p>{status.sourceFinding ?? "No qualified finite observations are available."}</p>}
      </EvidenceDisclosure>
      <EvidenceDisclosure title={`Missing or blocked telemetry channels (${blocked.length})`}>
        <Items items={blocked.map(c => `${c.key}: ${c.telemetryMessage}`)} empty="No additional channel blockers."/>
        {status.unassignedHeaders.length > 0 && <p>Source columns present without an authorised mapping: {status.unassignedHeaders.join(", ")}. Their alias/unit is unqualified; no fuzzy mapping is applied.</p>}
      </EvidenceDisclosure>
      <EvidenceDisclosure title="System Association">
        <Items items={Array.from(new Set(observed.filter(c => c.system).map(c => c.system))).map(system => `${system}: ${observed.filter(c => c.system === system).map(c => c.key).join(", ")}.`)} empty="No factual system association established."/>
        <p>Factual associations are not exact table bindings or diagnostic conclusions.</p>
      </EvidenceDisclosure>
      <EvidenceDisclosure title={`Unavailable Bindings — ${unbound.length} observed channels without an exact table binding`}>
        {unbound.length ? <p>Binding only — {unbound.map(c => c.key).join(", ")}: Telemetry available; no qualified Calibration-table binding has been established.</p> : <p>No additional binding gap for the observed channels.</p>}
        <p>{resolution.reason ?? `${resolution.relationships.length} evidence-supported inspection relationships available. Exact telemetry bindings, system membership and source-described suggestions retain separate grades.`}</p>
        <Items items={resolution.withheld} empty="No additional withheld relationship."/>
        <p>An inspection suggestion is not promoted to an exact binding. No diagnostic, editing or persistence authority is implied.</p>
      </EvidenceDisclosure>
    </Section>
    <Section title="Related XDF and Related Calibration Tables">
      <p>{inventory.length} exact Definition/table occurrence(s). Related channels are grouped under each table; table availability does not establish active-tune values.</p>
      {[...new Set(inventory.map(t => t.group))].map(group => <div key={group} className="mt-5 space-y-3">
        <h4 className="border-l-2 border-sky-500 pl-3 text-base font-semibold text-blue-100">{group}</h4>
        {inventory.filter(t => t.group === group).map(t => <article key={t.id} data-primary-table={t.id} className="bmw-border min-w-0 rounded-xl bg-zinc-950/70 p-4">
          <h5 className="text-base font-semibold text-sky-100">{resolution.href ? <Link className="underline focus-visible:outline-2 focus-visible:outline-sky-300" href={`${resolution.href}&definition=${encodeURIComponent(t.relationships[0].key)}`}>{t.title}</Link> : t.title}</h5>
          <p className="mt-2">Observed channels: {[...new Set(t.relationships.map(r => r.channel))].join(", ")}.</p>
          {[...new Map(t.relationships.map(r => {const p = relationshipPresentation(r); return [p.label, p] as const;})).values()].map(p => <div key={p.label} className="mt-3"><span className="inline-flex rounded-md border border-blue-700 bg-blue-950/60 px-2 py-1 text-sm font-medium text-blue-200">{p.label}</span><p className="mt-1">{p.explanation}</p></div>)}
          <EvidenceDisclosure title="Advanced technical evidence">
            {t.relationships.map((r, i) => <div key={i} className="space-y-2 break-words border-b border-slate-700 pb-3 last:border-0">
              <p>{r.grade}: {r.channel} → {r.meaning}</p>
              <p className="break-all">Occurrence {r.occurrence}; {r.revision}; exact key {r.key}; assertion {r.assertion}</p>
              <Items items={r.provenance} empty="No additional provenance text."/>
              <Items items={r.limitations} empty="No additional assertion-specific limitations."/>
            </div>)}
            <p>{resolution.href ? "Inspectable in the current Calibration session." : "Exact admitted Definition evidence is displayed above in this response. No persistent Calibration session or editing access was created."}</p>
          </EvidenceDisclosure>
        </article>)}
      </div>)}
      {!inventory.length && <p>Related XDF unavailable: {resolution.reason} No table name, address or relationship is guessed.</p>}
    </Section>
  </div>;
}

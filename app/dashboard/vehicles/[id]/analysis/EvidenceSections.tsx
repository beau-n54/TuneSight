import Link from "next/link";
import type { ReactNode } from "react";
import type { AnalysisEvidenceSections } from "@/lib/analysis/analysisEvidenceSections";
import type { AnalysisCalibrationResolution } from "@/lib/analysis/analysisCalibrationContext";

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
      : "Unavailable: no applicable qualified source/platform diagnostic rule contract for this selection. N54 thresholds and causal conclusions are not applied."}</Section>
  </div>;
}

export function FactualInvestigation({facts, diagnostics, references}: {facts: AnalysisEvidenceSections; diagnostics: boolean; references: number}) {
  return <div className="space-y-4">
    <Section title="Factual observations"><Items items={facts.systems.map(s => `${s.channels.join(", ")} → ${s.system}. Factual channel-to-system association only; not a Definition binding or diagnosis.`)} empty="No qualified channel-to-system observations available."/></Section>
    <Section title="Root Cause and candidate ranking">{diagnostics && references
      ? `${references} qualified event cross-reference records are expanded in Cross-Reference Details below, with their existing candidate ranking and evidence.`
      : "Unavailable: source measurements alone do not establish a qualified causal ranking."}</Section>
    <Section title="Alternatives and rejected explanations">{diagnostics && references
      ? "Event-specific alternatives and rejected candidates remain in the qualified cross-reference records below."
      : "Unavailable: no qualified causal assessment exists from which to accept or reject an explanation."}</Section>
    <Section title="Inspection directions">{facts.ranges.length
      ? "Inspect the original source rows and channel gaps alongside the graphs. Exact Calibration inspection requires the admitted Definition relationship shown in Related XDF; a measured range is not an instruction to change a table."
      : "Recover access to the selected original source before investigating its measurements."}</Section>
    <Section title="Event notes">{diagnostics ? "Qualified event notes remain attached to their event records below." : "No qualified diagnostic event notes are available. Factual observations do not imply event severity."}</Section>
    <Section title="Cylinder Timing Observation"><Items items={facts.timing.map(r => `${r.channel}: ${number(r.minimum)} to ${number(r.maximum)} ${r.unit}; ${r.count} observations, ${r.missing} gaps. Measured correction only, not a knock diagnosis.`)} empty="Unavailable: no unambiguous cylinder timing-correction channel with qualified units. Damaged or missing headers are not inferred."/></Section>
    <Section title="Channel and unit blockers"><Items items={facts.blockers} empty="No additional source-contract blockers reported."/></Section>
  </div>;
}

export function CalibrationEvidenceSections({resolution, logId, vehicleId}: {resolution: AnalysisCalibrationResolution; logId: string | null; vehicleId: string}) {
  const identity = resolution.identity;
  return <div className="space-y-4">
    <Section title="Universal XDF">
      <p>Vehicle {vehicleId}; selected owned log {logId ?? "unavailable"}. Definition-source identity is separate from observed DME/ROM identity.</p>
      {identity && <dl className="mt-2 space-y-1">
        <dt>Exact source software / Definition-source family</dt><dd>{identity.software} / {identity.family ?? "unestablished"}</dd>
        <dt>Source container / engineering bytes</dt><dd>{identity.container} / {identity.bytes.toLocaleString("en")}</dd>
        <dt>Engineering source SHA-256</dt><dd className="break-all">{identity.digest}</dd>
        <dt>Dataset revision</dt><dd className="break-all">{identity.dataset}</dd>
        <dt>Definition Set / source artifact</dt><dd className="break-all">{identity.definitionSet} / {identity.artifact}</dd>
      </dl>}
    </Section>
    <Section title="Calibration Cross Reference">
      <p>Evidence path: owned selected log → owned vehicle → exact Calibration source → admitted Dataset → exact Definition occurrence → qualified telemetry relationship.</p>
      <p>{resolution.reason ?? `${resolution.relationships.length} exact relationships available. These do not establish a platform-specific diagnosis or editing authority.`}</p>
    </Section>
    <Section title="Related XDF">
      {resolution.relationships.length ? <ul className="space-y-3">{resolution.relationships.map((r, i) => <li key={`${r.key}:${i}`}>
        <Link className="text-sky-300 underline" href={`${resolution.href}&definition=${encodeURIComponent(r.key)}`}>{r.title}</Link>
        <p>{r.grade}: {r.channel} → {r.meaning}</p>
        <p className="break-all">Occurrence {r.occurrence}; {r.revision}; assertion {r.assertion}</p>
        <Items items={r.provenance} empty="No additional provenance text."/>
        <Items items={r.limitations} empty="No additional assertion-specific limitations."/>
      </li>)}</ul> : <p>Related XDF unavailable: {resolution.reason}</p>}
    </Section>
    <Section title="Related Calibration Tables">
      {resolution.relationships.length ? <p>The exact inspectable occurrences above are the related tables. Suggested investigation targets and diagnostic conclusions are not interchangeable with these bindings.</p>
        : <p>Unavailable: {resolution.reason} No table name, address or relationship is guessed.</p>}
    </Section>
  </div>;
}

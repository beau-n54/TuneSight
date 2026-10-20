import type { AnalysisSource } from "./analysisSource";

/** Measured facts only. No platform, engine, threshold or persistence dependency. */
export function analysisEvidenceSections(source: AnalysisSource | null) {
  const m = source?.state === "available" && source.digest ? source.measurements : null;
  const ranges = (m?.channels ?? []).flatMap(channel => {
    const values = channel.values.filter((v): v is number => v !== null && Number.isFinite(v));
    return values.length ? [{channel: channel.key, unit: channel.unit, count: values.length,
      missing: channel.values.length - values.length, minimum: values.reduce((a, b) => Math.min(a, b)), maximum: values.reduce((a, b) => Math.max(a, b))}] : [];
  });
  const actual = m?.channels.find(c => c.key === "boost");
  const target = m?.channels.find(c => c.key === "boost_target");
  const differences = actual && target && actual.unit === target.unit
    ? actual.values.flatMap((a, i) => {
      const t = target.values[i];
      return a !== null && Number.isFinite(a) && t !== null && t !== undefined && Number.isFinite(t) ? [a - t] : [];
    }) : [];
  const blockers = m?.blockers ?? [source?.finding ?? "No owned source selected."];
  return {
    source: m ? `${m.sampleCount} source rows; ${m.channels.length} qualified channel/unit mappings. Original bytes remain unchanged.` : source?.finding ?? "No owned source selected.",
    blockers,
    missing: blockers.filter(b => b.includes("no unambiguous") || b.includes("unavailable")),
    units: blockers.filter(b => /unit|header|logger|alias|time observations/i.test(b)),
    ranges,
    targetDifference: differences.length ? {count: differences.length, unit: actual!.unit,
      minimum: differences.reduce((a, b) => Math.min(a, b)), maximum: differences.reduce((a, b) => Math.max(a, b))} : null,
    timing: ranges.filter(r => /^timing_correction_cyl_[1-8]$/.test(r.channel)),
    systems: [
      {channels: ["rail_pressure"], system: "High-pressure fuel supply"},
      {channels: ["lpfp"], system: "Low-pressure fuel supply"},
      {channels: ["throttle", "accelerator_pedal"], system: "Air / driver demand"},
      {channels: ["boost", "boost_target", "wgdc"], system: "Boost / wastegate measurements"},
      {channels: ranges.filter(r => /^timing_correction_cyl_/.test(r.channel)).map(r => r.channel), system: "Cylinder timing measurements"},
    ].map(s => ({...s, channels: s.channels.filter(c => ranges.some(r => r.channel === c))})).filter(s => s.channels.length),
  };
}
export type AnalysisEvidenceSections = ReturnType<typeof analysisEvidenceSections>;

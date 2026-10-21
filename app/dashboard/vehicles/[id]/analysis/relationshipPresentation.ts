import type { AnalysisCalibrationResolution } from "@/lib/analysis/analysisCalibrationContext";

type Relationship = AnalysisCalibrationResolution["relationships"][number];

// Display labels only. The original relationship, grade and authority are retained.
export function relationshipPresentation(r: Relationship) {
  const system = r.meaning.match(/^The observed channel and this exact Definition share the qualified (.+) system context\./)?.[1]
    ?? (r.grade === "Suggested inspection target — qualified system relationship" && r.channel === "lpfp" ? "Low-pressure fuel supply" : null);
  const direct = r.grade === "Exact Definition telemetry relationship";
  const related = r.grade === "Suggested inspection target — qualified system membership" || r.grade === "Suggested inspection target — qualified system relationship";
  const described = r.grade.startsWith("Suggested inspection target — admitted source description");
  return {
    kind: direct ? "direct" : related ? "related" : described ? "described" : "unavailable",
    label: direct ? "Direct table relationship" : related ? `Related system to inspect${system ? ` — ${system}` : ""}` : described ? "Source-described relationship" : "Evidence unavailable",
    explanation: related ? "The logged channel and this table belong to the same engineering system. A direct control or causal relationship has not been confirmed." : described ? "The admitted source describes this relationship; independent semantic validation and active map selection are not established." : direct ? "An exact Definition relationship is available. This does not establish an active map value or causal diagnosis." : "No subscriber relationship label is established for this evidence grade; inspect the original evidence below.",
  };
}

// Navigation groups use already-qualified channel IDs, never table-name similarity.
export function relationshipGroup(r: Relationship) {
  if (["boost", "boost_target", "wgdc"].includes(r.channel)) return "Boost and WGDC";
  if (/^timing_correction_cyl_[1-8]$/.test(r.channel)) return "Ignition and timing";
  if (["rail_pressure", "lpfp", "afr", "ethanol"].includes(r.channel)) return "Fuel pressure and fueling";
  if (r.channel === "iat") return "Intake temperature and thermal control";
  if (r.meaning.includes("qualified Load & Torque system context.")) return "Torque/load";
  if (["throttle", "accelerator_pedal"].includes(r.channel)) return "Airflow and driver demand";
  return "Other applicable systems";
}

export function relationshipInventory(relationships: readonly Relationship[]) {
  const tables = new Map<string, {id: string; title: string; group: string; relationships: Relationship[]}>();
  for (const r of relationships) {
    const id = JSON.stringify([r.revision, r.occurrence, r.key]);
    const table = tables.get(id) ?? {id, title: r.title, group: relationshipGroup(r), relationships: []};
    table.relationships.push(r);
    tables.set(id, table);
  }
  return [...tables.values()];
}

export const uniqueWarnings = (warnings: readonly string[]) => [...new Set(warnings)];

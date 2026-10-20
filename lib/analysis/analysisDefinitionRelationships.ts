import type { CalibrationDatasetDefinition } from "../xdf/qualifiedCalibrationDataset";
import type { WorkshopSemanticBinding } from "../calibration-workshop/definitionKnowledgeBinding";

/** Inspection grades only; no detector, threshold, tuning or mutation authority. */
export function definitionInspectionRelationships(definition: CalibrationDatasetDefinition, semantic: WorkshopSemanticBinding, channels: readonly string[]) {
  const results: {channel: string; meaning: string; grade: string; assertion: string; provenance: readonly string[]; limitations: readonly string[]}[] = [];
  if (semantic.outcome === "exact") {
    for (const field of semantic.telemetryRelationships) if (channels.includes(field.value.channelId)) results.push({
      channel: field.value.channelId, meaning: field.value.meaning, grade: "Exact Definition telemetry relationship",
      assertion: `${field.assertionId}@${field.assertionRevision}`, provenance: field.provenance, limitations: field.limitations,
    });
    const system = semantic.engineeringSystem;
    const candidates: Record<string, readonly string[]> = {
      "Boost & Air Control": ["boost", "boost_target"],
      "Wastegate / WGDC": ["wgdc"],
      "Ignition / Timing": channels.filter(c => /^timing_correction_cyl_[1-6]$/.test(c)),
      "Load & Torque": ["throttle", "accelerator_pedal"],
      "Fueling / Lambda": ["afr", "ethanol"],
    };
    if (system) for (const channel of candidates[system.value] ?? []) if (channels.includes(channel) && !results.some(r => r.channel === channel)) results.push({
      channel, meaning: `The observed channel and this exact Definition share the qualified ${system.value} system context. This does not establish direct control or causation.`,
      grade: "Suggested inspection target — qualified system membership", assertion: `${system.assertionId}@${system.assertionRevision}`,
      provenance: system.provenance, limitations: [...(semantic.limitations ?? []), "No direct telemetry-to-control relationship or active map selection is asserted."],
    });
    for (const field of semantic.relatedCalibrations ?? []) if (field.value.targetKnowledgeId === "low-pressure-fuel-system" && channels.includes("lpfp")) results.push({
      channel: "lpfp", meaning: `Qualified low-pressure fuel-system relationship: ${field.value.relationship}. Inspect alongside the measured LPFP channel; no failure threshold is implied.`,
      grade: "Suggested inspection target — qualified system relationship", assertion: `${field.assertionId}@${field.assertionRevision}`, provenance: field.provenance, limitations: semantic.limitations,
    });
  }
  // An admitted source can explicitly describe an inspection relationship even
  // when no separately published semantic record exists. Title similarity is unused.
  const description = definition.description?.replace(/\s+/g, " ").trim() ?? "";
  if (!results.length && description.includes("This ceiling is applied to the intake manifold boost target.")
    && /^psi(?: \(relative\))?$/i.test(definition.units ?? "") && channels.includes("boost")) {
    results.push({channel: "boost", meaning: `Source-described boost inspection context: ${description}`,
      grade: "Suggested inspection target — admitted source description, not independently validated semantics",
      assertion: `${definition.definitionRevisionId}:${definition.sourceBindingDigest}`,
      provenance: definition.provenance,
      limitations: ["The source description is not a platform-specific diagnostic rule.", "Active map/enable state and logger pressure location are unestablished; no direct value comparison, causal conclusion or edit instruction is authorised."]});
  }
  return results;
}

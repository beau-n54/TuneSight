import type {AnalysisCalibrationResolution} from "./analysisCalibrationContext";
import type {SourceEvidenceScores} from "./sourceEvidenceScoring";

/** Input is the owner/source/Definition-admitted inventory, never title search.
 * Control-context channels widen inspection only; they do not assert causality.
 * One Definition revision is one table, even if repeated occurrences exist.
 */
export function sourceInspectionCrossReferences(scores: SourceEvidenceScores, calibration: AnalysisCalibrationResolution, observedChannels: readonly string[]) {
  const available = new Set(observedChannels);
  const families = scores.map(score => {
    const direct = score.events[0].channels;
    const context = score.kind === "actual-above-target" || score.kind === "actual-below-target"
      ? ["wgdc", "accelerator_pedal", "throttle"] : [];
    const channels = new Set([...direct, ...context].filter(c => available.has(c)));
    const relationships = calibration.identity ? calibration.relationships.filter(r => channels.has(r.channel)) : [];
    return {...score, relationships, unavailable: relationships.length ? null : "No qualified Calibration-table relationship is available for this event."};
  });
  const admitted = calibration.identity ? calibration.relationships.filter(r=>available.has(r.channel)) : [];
  const tables = new Map<string, {revision: string; title: string; relationships: typeof calibration.relationships; families: {kind: string; relationships: typeof calibration.relationships}[]}>();
  for (const r of admitted) {
    const table = tables.get(r.revision) ?? {revision:r.revision,title:r.title,relationships:[],families:[]};
    table.relationships.push(r); tables.set(r.revision,table);
  }
  for (const family of families) {
    for (const revision of new Set(family.relationships.map(r => r.revision))) {
      const relationships = family.relationships.filter(r => r.revision === revision);
      const table = tables.get(revision)!;
      table.families.push({kind: family.kind, relationships});
      tables.set(revision, table);
    }
  }
  return {families, tables: [...tables.values()], mapCount: tables.size};
}
export type SourceInspectionCrossReferences = ReturnType<typeof sourceInspectionCrossReferences>;

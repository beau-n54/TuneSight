export type WorkshopSemanticOutcome = "exact" | "partial" | "ambiguous" | "conflict" | "unavailable";

export type QualifiedSemanticField<T> = Readonly<{
  value: T;
  assertionId: string;
  assertionRevision: string;
  authority: string;
  provenance: readonly string[];
  limitations: readonly string[];
}>;

export type WorkshopKnowledgeRecord = Readonly<{
  knowledgeId: string;
  knowledgeRevision: string;
  lifecycle: "active" | "superseded" | "deprecated" | "rejected";
  verification: "candidate" | "provisional" | "verified" | "founder_verified" | "authoritatively_verified" | "disputed";
  conflict: boolean;
  exactWorkshopInstanceIdentities: readonly string[];
  exactDefinitionIdentities: readonly string[];
  exactDefinitionRevisions: readonly string[];
  applicability: readonly string[];
  aliases: readonly QualifiedSemanticField<string>[];
  engineeringSystem: QualifiedSemanticField<string> | null;
  controls: readonly QualifiedSemanticField<string>[];
  whyItMatters: readonly QualifiedSemanticField<string>[];
  howToRead: readonly QualifiedSemanticField<string>[];
  directionalEffects: readonly QualifiedSemanticField<string>[];
  operatingContexts: readonly QualifiedSemanticField<string>[];
  engineeringConsiderations: readonly QualifiedSemanticField<string>[];
  axisMeanings: readonly QualifiedSemanticField<Readonly<{ axisId: string; meaning: string }>>[];
  relatedCalibrations: readonly QualifiedSemanticField<Readonly<{ targetKnowledgeId: string; relationship: string }>>[];
  telemetryRelationships: readonly QualifiedSemanticField<Readonly<{ channelId: string; meaning: string }>>[];
  limitations: readonly string[];
}>;

export type WorkshopSemanticBinding = Readonly<{
  outcome: WorkshopSemanticOutcome;
  candidates: readonly string[];
  knowledgeId: string | null;
  knowledgeRevision: string | null;
  engineeringSystem: QualifiedSemanticField<string> | null;
  controls: readonly QualifiedSemanticField<string>[];
  whyItMatters: readonly QualifiedSemanticField<string>[];
  howToRead: readonly QualifiedSemanticField<string>[];
  directionalEffects: readonly QualifiedSemanticField<string>[];
  operatingContexts: readonly QualifiedSemanticField<string>[];
  engineeringConsiderations: readonly QualifiedSemanticField<string>[];
  axisMeanings: readonly QualifiedSemanticField<Readonly<{ axisId: string; meaning: string }>>[];
  relatedCalibrations: readonly QualifiedSemanticField<Readonly<{ targetKnowledgeId: string; relationship: string }>>[];
  telemetryRelationships: readonly QualifiedSemanticField<Readonly<{ channelId: string; meaning: string }>>[];
  aliases: readonly string[];
  provenance: readonly string[];
  limitations: readonly string[];
  unavailableReason: string | null;
}>;

const authoritative = new Set(["verified", "founder_verified", "authoritatively_verified"]);
const empty = (outcome: WorkshopSemanticOutcome, candidates: readonly string[], reason: string): WorkshopSemanticBinding => Object.freeze({ outcome, candidates: Object.freeze([...candidates]), knowledgeId: null, knowledgeRevision: null, engineeringSystem: null, controls: Object.freeze([]), whyItMatters: Object.freeze([]), howToRead: Object.freeze([]), directionalEffects: Object.freeze([]), operatingContexts: Object.freeze([]), engineeringConsiderations: Object.freeze([]), axisMeanings: Object.freeze([]), relatedCalibrations: Object.freeze([]), telemetryRelationships: Object.freeze([]), aliases: Object.freeze([]), provenance: Object.freeze([]), limitations: Object.freeze([]), unavailableReason: reason });

export function bindDefinitionKnowledge(definition: Readonly<{ key?: string; definitionIdentity: string | null; definitionRevision: string }>, records: readonly WorkshopKnowledgeRecord[]): WorkshopSemanticBinding {
  const appliesToInstance = (record: WorkshopKnowledgeRecord) => record.exactWorkshopInstanceIdentities.length === 0 || (definition.key !== undefined && record.exactWorkshopInstanceIdentities.includes(definition.key));
  const exact = records.filter((record) => record.lifecycle === "active" && appliesToInstance(record) && ((definition.definitionIdentity !== null && record.exactDefinitionIdentities.includes(definition.definitionIdentity)) || record.exactDefinitionRevisions.includes(definition.definitionRevision)));
  if (exact.some((record) => record.conflict || record.verification === "disputed")) return empty("conflict", exact.map((record) => record.knowledgeId), "Qualified Knowledge conflicts with this Definition context.");
  if (exact.length > 1) return empty("ambiguous", exact.map((record) => record.knowledgeId), "Multiple exact Knowledge candidates remain plausible.");
  const contextual = records.filter((record) => record.lifecycle === "active" && appliesToInstance(record) && definition.definitionIdentity !== null && record.applicability.includes(definition.definitionIdentity));
  const record = exact[0] ?? (contextual.length === 1 ? contextual[0] : undefined);
  if (!record) return contextual.length > 1 ? empty("ambiguous", contextual.map((item) => item.knowledgeId), "Multiple contextual Knowledge candidates remain plausible.") : empty("unavailable", [], "Engineering interpretation not yet available.");
  const outcome: WorkshopSemanticOutcome = exact[0] && authoritative.has(record.verification) ? "exact" : "partial";
  const fields = [record.engineeringSystem, ...record.controls, ...record.whyItMatters, ...record.howToRead, ...record.directionalEffects, ...record.operatingContexts, ...record.engineeringConsiderations, ...record.axisMeanings, ...record.relatedCalibrations, ...record.telemetryRelationships].filter((field): field is NonNullable<typeof field> => field !== null);
  return Object.freeze({ outcome, candidates: Object.freeze([record.knowledgeId]), knowledgeId: record.knowledgeId, knowledgeRevision: record.knowledgeRevision, engineeringSystem: record.engineeringSystem, controls: record.controls, whyItMatters: record.whyItMatters, howToRead: record.howToRead, directionalEffects: record.directionalEffects, operatingContexts: record.operatingContexts, engineeringConsiderations: record.engineeringConsiderations, axisMeanings: record.axisMeanings, relatedCalibrations: record.relatedCalibrations, telemetryRelationships: record.telemetryRelationships, aliases: Object.freeze(record.aliases.map((alias) => alias.value)), provenance: Object.freeze([...new Set(fields.flatMap((field) => field.provenance))]), limitations: Object.freeze([...new Set([...record.limitations, ...fields.flatMap((field) => field.limitations)])]), unavailableReason: outcome === "partial" ? "Definition-specific engineering interpretation remains incomplete." : null });
}

export function searchDefinitionsByIntent<T extends Readonly<{ semantic: WorkshopSemanticBinding }>>(definitions: readonly T[], query: string): readonly T[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return definitions;
  return definitions.filter((definition) => definition.semantic.outcome === "exact" && [definition.semantic.engineeringSystem?.value, ...definition.semantic.aliases, ...definition.semantic.controls.map((field) => field.value), ...definition.semantic.whyItMatters.map((field) => field.value)].some((value) => value?.toLocaleLowerCase().includes(normalized)));
}

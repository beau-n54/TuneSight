import type { QualifiedSemanticField, WorkshopSemanticBinding } from "./definitionKnowledgeBinding.ts";

export const TABLE_GUIDANCE_CONTRACT = "tunesight.table-guidance-input.v1" as const;
/** R01 prepares producer-owned inputs. U2/U3/U4 own their eventual rendering.
 * Source titles are carried literally; neither titles nor values create education.
 */
export function tableGuidanceInput(input: Readonly<{
  tableKey: string; definitionRevision: string; sourceTitle: string; semantic: WorkshopSemanticBinding | null;
}>) {
  const semantic = input.semantic;
  const admitted = Boolean(semantic?.outcome === "exact" && semantic.knowledgeId && semantic.knowledgeRevision);
  const fields = <T>(items: readonly QualifiedSemanticField<T>[]) => admitted
    ? items.filter(item => item.assertionId && item.assertionRevision && item.authority && item.provenance.length)
      .map(item => ({ ...item, provenance: [...item.provenance], limitations: [...item.limitations] })) : [];
  const reason = semantic?.unavailableReason ?? "Engineering interpretation not yet available for this exact Table.";
  const section = <T>(items: readonly QualifiedSemanticField<T>[]) => {
    const values = fields(items);
    return { state: values.length ? "available" as const : "unavailable" as const, fields: values, unavailableReason: values.length ? null : reason };
  };
  return { contract: TABLE_GUIDANCE_CONTRACT, owner: "definitionKnowledgeBinding" as const,
    tableKey: input.tableKey, definitionRevision: input.definitionRevision, sourceTitle: input.sourceTitle,
    terminology: { entity: "Table" as const, related: "Related Table" as const, beginner: "Understand" as const, engineering: "Engineering Detail" as const },
    knowledgeId: admitted ? semantic!.knowledgeId : null, knowledgeRevision: admitted ? semantic!.knowledgeRevision : null,
    unavailableReason: admitted ? null : reason,
    understand: { controls: section(semantic?.controls ?? []), whyItMatters: section(semantic?.whyItMatters ?? []),
      howToRead: section(semantic?.howToRead ?? []), operatingContexts: section(semantic?.operatingContexts ?? []),
      considerations: section(semantic?.engineeringConsiderations ?? []) },
    engineering: { axes: section(semantic?.axisMeanings ?? []), output: section(semantic?.outputMeaning ? [semantic.outputMeaning] : []),
      relatedTables: section(semantic?.relatedCalibrations ?? []), telemetry: section(semantic?.telemetryRelationships ?? []),
      provenance: admitted ? [...semantic!.provenance] : [], limitations: [...(semantic?.limitations ?? [])] } };
}

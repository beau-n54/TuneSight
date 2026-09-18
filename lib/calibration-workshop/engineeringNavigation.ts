import type { WorkshopSemanticBinding } from "./definitionKnowledgeBinding.ts";
import { TUNING_ESSENTIAL_SYSTEMS, tuningEssentialSystem } from "./tuningEssentials.ts";

export type EngineeringClassificationState = "ENGINEERING_QUALIFIED" | "SOURCE_DERIVED_CANDIDATE" | "UNCLASSIFIED";
export type EngineeringNavigationMode = "all" | "essentials" | "systems" | "evidence";
export type EngineeringNavigableDefinition = Readonly<{
  key: string;
  title: string;
  available: boolean;
  semantic?: WorkshopSemanticBinding;
}>;
export type EngineeringNavigationEntry<T extends EngineeringNavigableDefinition = EngineeringNavigableDefinition> = Readonly<{
  definition: T;
  classification: EngineeringClassificationState;
  systems: readonly string[];
  essential: boolean;
  englishName: string | null;
  originalTitle: string;
}>;
export type EngineeringNavigationIndex<T extends EngineeringNavigableDefinition = EngineeringNavigableDefinition> = Readonly<{
  entries: readonly EngineeringNavigationEntry<T>[];
  systems: readonly Readonly<{ id: string; label: string; qualified: number; candidate: number; essentials: number }>[];
  counts: Readonly<Record<EngineeringClassificationState, number> & { essentials: number; duplicateSystemMemberships: number }>;
}>;
export type EngineeringNavigationEmptyState = "knowledge_empty" | "filter_zero" | null;

const normalized = (value: string) => value.trim().toLowerCase();
const compare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;

export function buildEngineeringNavigationIndex<T extends EngineeringNavigableDefinition>(definitions: readonly T[]): EngineeringNavigationIndex<T> {
  const entries = definitions.map((definition): EngineeringNavigationEntry<T> => {
    const semantic = definition.semantic, system = semantic?.engineeringSystem?.value.trim() || null;
    const classification: EngineeringClassificationState = system && semantic?.outcome === "exact" ? "ENGINEERING_QUALIFIED" : system && semantic?.outcome === "partial" ? "SOURCE_DERIVED_CANDIDATE" : "UNCLASSIFIED";
    const systems = Object.freeze([...new Set([system, ...(semantic?.relatedEngineeringSystems?.map(field => field.value.trim()) ?? [])].filter((value): value is string => Boolean(value)).map(value => tuningEssentialSystem(value) ?? value))].sort(compare));
    const essential = classification === "ENGINEERING_QUALIFIED" && definition.available && Boolean(semantic && (semantic.controls.length || semantic.whyItMatters.length || semantic.operatingContexts.length));
    return Object.freeze({ definition, classification, systems, essential, englishName: classification === "ENGINEERING_QUALIFIED" ? semantic?.aliases[0] ?? null : null, originalTitle: definition.title });
  });
  const discovered = [...new Set(entries.flatMap(entry => entry.systems))];
  const labels = [...TUNING_ESSENTIAL_SYSTEMS, ...discovered.filter(label => !TUNING_ESSENTIAL_SYSTEMS.includes(label as typeof TUNING_ESSENTIAL_SYSTEMS[number])).sort(compare)];
  const systems = labels.map(label => { const members = entries.filter(entry => entry.systems.includes(label)); return Object.freeze({ id: normalized(label), label, qualified: members.filter(entry => entry.classification === "ENGINEERING_QUALIFIED").length, candidate: members.filter(entry => entry.classification === "SOURCE_DERIVED_CANDIDATE").length, essentials: members.filter(entry => entry.essential).length }); });
  return Object.freeze({ entries: Object.freeze(entries), systems: Object.freeze(systems), counts: Object.freeze({ ENGINEERING_QUALIFIED: entries.filter(entry => entry.classification === "ENGINEERING_QUALIFIED").length, SOURCE_DERIVED_CANDIDATE: entries.filter(entry => entry.classification === "SOURCE_DERIVED_CANDIDATE").length, UNCLASSIFIED: entries.filter(entry => entry.classification === "UNCLASSIFIED").length, essentials: entries.filter(entry => entry.essential).length, duplicateSystemMemberships: entries.filter(entry => entry.systems.length > 1).length }) });
}

export function engineeringNavigationEmptyState<T extends EngineeringNavigableDefinition>(index: EngineeringNavigationIndex<T>, input: Readonly<{ mode: EngineeringNavigationMode; system?: string | null; query?: string }>, resultCount: number): EngineeringNavigationEmptyState {
  if (resultCount > 0) return null;
  const query = normalized(input.query ?? "");
  if (query) return "filter_zero";
  if (input.mode === "essentials" && index.counts.essentials === 0) return "knowledge_empty";
  if (input.mode === "systems" && input.system) {
    const selected = index.systems.find(item => normalized(item.label) === normalized(input.system ?? ""));
    if (!selected || selected.essentials === 0) return "knowledge_empty";
  }
  return "filter_zero";
}

export function filterEngineeringNavigation<T extends EngineeringNavigableDefinition>(index: EngineeringNavigationIndex<T>, input: Readonly<{ mode: EngineeringNavigationMode; system?: string | null; query?: string }>): readonly EngineeringNavigationEntry<T>[] {
  const query = normalized(input.query ?? ""), system = normalized(input.system ?? "");
  return index.entries.filter(entry => {
    if (input.mode === "essentials" && !entry.essential) return false;
    if (input.mode === "systems" && (!system || !entry.systems.some(value => normalized(value) === system))) return false;
    if (query) {
      const literal = [entry.originalTitle, entry.definition.key].some(value => normalized(value).includes(query));
      const intent = [entry.englishName, ...entry.systems, ...(entry.definition.semantic?.aliases ?? []), entry.definition.semantic?.calibrationRole?.value, entry.definition.semantic?.outputMeaning?.value, ...(entry.definition.semantic?.controls.map(field => field.value) ?? []), ...(entry.definition.semantic?.whyItMatters.map(field => field.value) ?? [])].filter((value): value is string => Boolean(value)).map(normalized).join(" ");
      const semantic = entry.classification === "ENGINEERING_QUALIFIED" && query.split(/\s+/).every(token => intent.includes(token));
      if (!literal && !semantic) return false;
    }
    return true;
  });
}

import { createHash } from "node:crypto";
import type { XdfDefinitionRevision } from "./canonicalXdfDefinition.ts";
import type { DefinitionSetRevision } from "./definitionRomApplicability.ts";

export const CANONICAL_DEFINITION_SOURCE_CONTRACT = "tunesight.canonical-definition-source.v1" as const;
export type DefinitionSourceFormat = "xdf_xml" | "tunesight_native" | "qualified_external" | "governed_cross_rom" | "qualified_reverse_engineering";
export type CanonicalDefinitionSource = Readonly<{ sourceId: string; sourceRevision: string; contractVersion: typeof CANONICAL_DEFINITION_SOURCE_CONTRACT; format: DefinitionSourceFormat; artifactId: string; artifactDigest: string; upstreamRevision: string | null; provenance: readonly string[]; limitations: readonly string[] }>;
export type CanonicalDefinitionSet = Readonly<{ canonicalSetId: string; canonicalSetRevision: string; source: CanonicalDefinitionSource; definitionSetId: string; definitionSetRevision: string; definitions: readonly XdfDefinitionRevision[] }>;

function canonical(value: unknown): string { if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value); if (typeof value === "number") { if (!Number.isFinite(value)) throw new Error("Canonical Definition source contains a non-finite number."); return JSON.stringify(value); } if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`; if (!value || typeof value !== "object") throw new Error("Canonical Definition source contains unsupported material."); const object = value as Readonly<Record<string, unknown>>; return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`).join(",")}}`; }
function digest(domain: string, value: unknown): string { return createHash("sha256").update(domain).update(Buffer.from([0])).update(canonical(value)).digest("hex"); }
function freeze<T>(value: T): T { if (Array.isArray(value)) return Object.freeze(value.map(freeze)) as T; if (value && typeof value === "object") return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, freeze(item)]))) as T; return value; }

export function defineCanonicalDefinitionSource(input: Readonly<{ format: DefinitionSourceFormat; artifactId: string; artifactDigest: string; upstreamRevision?: string | null; provenance: readonly string[]; limitations: readonly string[] }>): CanonicalDefinitionSource {
  if (!input.artifactId.trim() || !input.artifactDigest.trim() || !input.provenance.some((item) => item.trim())) throw new Error("Canonical Definition source requires exact artifact identity, digest and provenance.");
  const identity = { format: input.format, artifactId: input.artifactId, artifactDigest: input.artifactDigest }; const material = { ...identity, upstreamRevision: input.upstreamRevision ?? null, provenance: [...new Set(input.provenance.map((item) => item.trim()).filter(Boolean))].sort(), limitations: [...new Set(input.limitations.map((item) => item.trim()).filter(Boolean))].sort(), contractVersion: CANONICAL_DEFINITION_SOURCE_CONTRACT };
  return freeze({ sourceId: `canonical-definition-source:${digest("tunesight.canonical-definition-source-identity.v1", identity)}`, sourceRevision: `canonical-definition-source-revision:${digest("tunesight.canonical-definition-source-revision.v1", material)}`, ...material });
}

export function bindCanonicalDefinitionSet(input: Readonly<{ source: CanonicalDefinitionSource; definitionSet: DefinitionSetRevision; definitions: readonly XdfDefinitionRevision[] }>): CanonicalDefinitionSet {
  if (input.definitionSet.definitionCount !== input.definitions.length || input.definitionSet.sourceArtifactId !== input.source.artifactId || input.definitionSet.sourceArtifactDigest !== input.source.artifactDigest || input.definitions.some((item) => !input.definitionSet.definitionRevisionIds.includes(item.revisionId))) throw new Error("Canonical Definition Set requires the complete exact source-bound Definition revision set.");
  const identity = { sourceId: input.source.sourceId, definitionSetId: input.definitionSet.definitionSetId }; const material = { ...identity, sourceRevision: input.source.sourceRevision, definitionSetRevision: input.definitionSet.revisionId, definitionRevisions: input.definitions.map((item) => item.revisionId).sort() };
  return freeze({ canonicalSetId: `canonical-definition-set:${digest("tunesight.canonical-definition-set-identity.v1", identity)}`, canonicalSetRevision: `canonical-definition-set-revision:${digest("tunesight.canonical-definition-set-revision.v1", material)}`, source: input.source, definitionSetId: input.definitionSet.definitionSetId, definitionSetRevision: input.definitionSet.revisionId, definitions: [...input.definitions] });
}

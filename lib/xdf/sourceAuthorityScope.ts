import { createHash } from "node:crypto";

export const SOURCE_AUTHORITY_RECORD_CONTRACT = "tunesight.xdf-source-authority-record.v1" as const;

export type SourceAuthorityClass = "explicit_source_authority" | "governed_evidence_review" | "authoritative_stock_variant_relationship";
export type SourceAuthorityScopeBinding = Readonly<{ sourceArtifactId: string; sourceArtifactDigest: string; definitionSetId: string; definitionSetRevision: string; family: string }>;
export type SourceAuthorityRecord = Readonly<{ authorityId: string; authorityRevision: string; contractVersion: typeof SOURCE_AUTHORITY_RECORD_CONTRACT; authorityClass: SourceAuthorityClass; founderAuthorityId: string; authorizedAt: string; lineage: readonly string[]; scope: readonly SourceAuthorityScopeBinding[]; evidenceBasis: readonly string[]; provenance: readonly string[]; limitations: readonly string[] }>;
export type SourceAuthorityScopeResult = Readonly<{ outcome: "in_scope" | "out_of_scope"; authorityId: string; authorityRevision: string; binding: SourceAuthorityScopeBinding; findings: readonly string[] }>;

function canonical(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") { if (!Number.isFinite(value)) throw new Error("Authority identity contains a non-finite number."); return JSON.stringify(Object.is(value, -0) ? 0 : value); }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (!value || typeof value !== "object") throw new Error("Authority identity contains an unsupported value.");
  const record = value as Readonly<Record<string, unknown>>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}
function digest(domain: string, value: unknown): string { return createHash("sha256").update(domain).update(Buffer.from([0])).update(canonical(value)).digest("hex"); }
function freeze<T>(value: T): T { if (Array.isArray(value)) return Object.freeze(value.map(freeze)) as T; if (value && typeof value === "object") return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, freeze(item)]))) as T; return value; }
function strings(values: readonly string[], field: string): readonly string[] { const result = [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort(); if (!result.length) throw new Error(`${field} requires at least one nonblank value.`); return result; }
function bindingKey(value: SourceAuthorityScopeBinding): string { return canonical(value); }
function normalizeBinding(value: SourceAuthorityScopeBinding): SourceAuthorityScopeBinding {
  const binding = { sourceArtifactId: value.sourceArtifactId.trim(), sourceArtifactDigest: value.sourceArtifactDigest.trim().toLowerCase(), definitionSetId: value.definitionSetId.trim(), definitionSetRevision: value.definitionSetRevision.trim(), family: value.family.trim() };
  if (!binding.sourceArtifactId || !/^(?:sha256:)?[a-f0-9]{64}$/.test(binding.sourceArtifactDigest) || !binding.definitionSetId || !binding.definitionSetRevision || !binding.family) throw new Error("Source authority scope requires exact artifact, digest, Definition Set revision and family bindings.");
  return freeze(binding);
}

export function constructSourceAuthorityRecord(input: Readonly<{ authorityClass: SourceAuthorityClass; founderAuthorityId: string; authorizedAt: string; lineage: readonly string[]; scope: readonly SourceAuthorityScopeBinding[]; evidenceBasis: readonly string[]; provenance: readonly string[]; limitations: readonly string[] }>): SourceAuthorityRecord {
  const scope = [...new Map(input.scope.map((value) => { const normalized = normalizeBinding(value); return [bindingKey(normalized), normalized]; })).values()].sort((left, right) => bindingKey(left).localeCompare(bindingKey(right)));
  if (!scope.length) throw new Error("Source authority cannot exist without an explicitly bounded exact scope.");
  const founderAuthorityId = input.founderAuthorityId.trim(); if (!founderAuthorityId) throw new Error("Founder authority identity is required."); const authorizedAt = new Date(input.authorizedAt); if (!Number.isFinite(authorizedAt.valueOf()) || authorizedAt.toISOString() !== input.authorizedAt) throw new Error("Authority timestamp must be supplied in canonical UTC form.");
  const lineage = strings(input.lineage, "Source lineage"); const evidenceBasis = strings(input.evidenceBasis, "Source authority Evidence basis"); const provenance = strings(input.provenance, "Source authority provenance"); const limitations = strings(input.limitations, "Source authority limitations");
  const identity = { authorityClass: input.authorityClass, founderAuthorityId, lineage, scope };
  const authorityId = `xdf-source-authority:${digest("tunesight.xdf-source-authority-identity.v1", identity)}`;
  const material = { ...identity, authorizedAt: input.authorizedAt, evidenceBasis, provenance, limitations, contractVersion: SOURCE_AUTHORITY_RECORD_CONTRACT };
  return freeze({ authorityId, authorityRevision: `xdf-source-authority-revision:${digest("tunesight.xdf-source-authority-revision.v1", material)}`, ...material });
}

export function assessSourceAuthorityScope(authority: SourceAuthorityRecord, candidate: SourceAuthorityScopeBinding): SourceAuthorityScopeResult {
  const binding = normalizeBinding(candidate); const exact = authority.scope.some((value) => bindingKey(value) === bindingKey(binding));
  return freeze({ outcome: exact ? "in_scope" : "out_of_scope", authorityId: authority.authorityId, authorityRevision: authority.authorityRevision, binding, findings: exact ? ["Exact Source Artifact digest and Definition Set Revision are explicitly within authority scope."] : ["Authority scope does not contain this exact Source Artifact, digest, Definition Set Revision and family binding."] });
}

export type ApplicabilityReviewEligibility = Readonly<{ assessmentOutcome: string; decisionEligible: boolean; publicationEligible: false; decisionState: "pending_explicit_authority" | "blocked"; publicationState: "not_authorized"; blockers: readonly string[] }>;
export function assessReviewEligibility(input: Readonly<{ assessmentOutcome: string; sourceScope: SourceAuthorityScopeResult | null; completeExtraction: boolean; completeConversion: boolean; hardConflicts: readonly string[] }>): ApplicabilityReviewEligibility {
  const blockers = [...input.hardConflicts];
  if (!input.sourceScope || input.sourceScope.outcome !== "in_scope") blockers.push("Exact source authority scope is unresolved.");
  if (!input.completeExtraction) blockers.push("Complete extraction validation is required.");
  if (!input.completeConversion) blockers.push("Complete engineering conversion validation is required.");
  if (input.assessmentOutcome !== "reviewable_for_exact_applicability") blockers.push(`Applicability assessment is ${input.assessmentOutcome}.`);
  const decisionEligible = blockers.length === 0;
  return freeze({ assessmentOutcome: input.assessmentOutcome, decisionEligible, publicationEligible: false, decisionState: decisionEligible ? "pending_explicit_authority" : "blocked", publicationState: "not_authorized", blockers: [...new Set(blockers)].sort() });
}

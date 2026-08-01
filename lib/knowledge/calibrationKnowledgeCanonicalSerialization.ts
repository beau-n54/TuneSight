import { createHash } from "node:crypto";
import {
  defineCalibrationKnowledgeObject,
  type CalibrationKnowledgeObject,
} from "./calibrationKnowledge.ts";

export type CanonicalSerializationSupportState = "supported" | "deprecated";
export type CanonicalSerializationPolicy = Readonly<{
  policyId: "tunesight.calibration-knowledge.serialization";
  policyVersion: string;
  format: "canonical-json";
  encoding: "utf-8";
  supportState: CanonicalSerializationSupportState;
}>;

export type CalibrationKnowledgeDigestPolicy = Readonly<{
  policyId: "tunesight.calibration-knowledge.digest";
  policyVersion: string;
  algorithm: "sha-256";
  encoding: "lowercase-hexadecimal";
  supportState: CanonicalSerializationSupportState;
}>;

export type CalibrationKnowledgeDigestDomain =
  | "calibration_knowledge_content"
  | "proposed_revision_envelope"
  | "publication_source_identity"
  | "publication_instruction"
  | "publication_execution_result"
  | "publication_receipt"
  | "registry_record_set_manifest"
  | "registry_snapshot_envelope";

export type ImmutableCanonicalByteSequence = Readonly<{
  encoding: "utf-8";
  byteLength: number;
  bytes: readonly number[];
}>;

export type CanonicalCalibrationKnowledgePayload = Readonly<{
  serializationPolicy: CanonicalSerializationPolicy;
  knowledge: CalibrationKnowledgeObject;
  canonicalJson: string;
  canonicalBytes: ImmutableCanonicalByteSequence;
}>;

export type CanonicalDomainPayload = Readonly<{
  canonicalJson: string;
  canonicalBytes: ImmutableCanonicalByteSequence;
}>;

export type DomainSeparatedDigest = Readonly<{
  domain: CalibrationKnowledgeDigestDomain;
  domainLabel: string;
  serializationPolicyId: string;
  serializationPolicyVersion: string;
  digestPolicyId: string;
  digestPolicyVersion: string;
  qualifiedDigest: string;
}>;

export type CalibrationKnowledgeContentDigests = Readonly<{
  payload: CanonicalCalibrationKnowledgePayload;
  acceptedKnowledgeDigest: string;
  expectedResultingCanonicalDigest: string;
  digest: DomainSeparatedDigest;
}>;

export const CALIBRATION_KNOWLEDGE_SERIALIZATION_POLICY_V1 = defineCanonicalSerializationPolicy({
  policyId: "tunesight.calibration-knowledge.serialization",
  policyVersion: "1",
  format: "canonical-json",
  encoding: "utf-8",
  supportState: "supported",
});

export const CALIBRATION_KNOWLEDGE_DIGEST_POLICY_V1 = defineCalibrationKnowledgeDigestPolicy({
  policyId: "tunesight.calibration-knowledge.digest",
  policyVersion: "1",
  algorithm: "sha-256",
  encoding: "lowercase-hexadecimal",
  supportState: "supported",
});

const DOMAIN_LABELS: Readonly<Record<CalibrationKnowledgeDigestDomain, string>> = Object.freeze({
  calibration_knowledge_content: "tunesight.calibration-knowledge.content",
  proposed_revision_envelope: "tunesight.calibration-knowledge.proposed-revision",
  publication_source_identity: "tunesight.calibration-knowledge.publication-source",
  publication_instruction: "tunesight.calibration-knowledge.publication-instruction",
  publication_execution_result: "tunesight.calibration-knowledge.publication-execution-result",
  publication_receipt: "tunesight.calibration-knowledge.publication-receipt",
  registry_record_set_manifest: "tunesight.calibration-knowledge.registry-record-set",
  registry_snapshot_envelope: "tunesight.calibration-knowledge.registry-snapshot",
});

const ASSERTION_ARRAYS = new Set(["aliases", "purposes", "engineeringIntents", "relatedSubsystems", "sourceRepresentations", "directionalBehaviours", "relationships", "boundaryConditions", "nonlinearCharacteristics", "potentialProtectiveResponses"]);
const STRING_SET_ARRAYS = new Set(["platforms", "engineFamilies", "ecuFamilies", "dmeVariants", "controlStrategies", "romFamilies", "softwareVersions", "calibrationIds", "stockVariantIds", "operatingModes", "transmissions", "regions", "emissionsSpecifications", "hardwareConfigurations", "sourceReferenceIds", "protectedInterests", "governingConstraints", "documentedTradeoffs", "activationConditions", "relatedCalibrationIds", "preconditions", "dependencyCalibrationIds", "exceptions", "supersedesIds", "addedAssertionIds", "amendedAssertionIds", "retainedAssertionIds", "supersededAssertionIds", "removedFromCurrentAssertionIds"]);
const VOCABULARY_ARRAYS = new Set(["participatingSubsystems", "affectedSubsystems"]);
const ORDERED_ARRAYS = new Set(["axes", "transformationHistory"]);

function requireNonBlank(value: string, field: string): void {
  if (!value.trim()) throw new Error(`${field} is required.`);
}

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) return Object.freeze(value.map(deepFreeze)) as T;
  if (value !== null && typeof value === "object") {
    const clone: Record<PropertyKey, unknown> = {};
    for (const key of Reflect.ownKeys(value)) clone[key] = deepFreeze((value as Record<PropertyKey, unknown>)[key]);
    return Object.freeze(clone) as T;
  }
  return value;
}

export function defineCanonicalSerializationPolicy(input: CanonicalSerializationPolicy): CanonicalSerializationPolicy {
  if (input.policyId !== "tunesight.calibration-knowledge.serialization") throw new Error("Canonical serialization policy identity is unsupported.");
  requireNonBlank(input.policyVersion, "Canonical serialization policy version");
  if (!/^\d+$/.test(input.policyVersion)) throw new Error("Canonical serialization policy version must be numeric.");
  if (input.format !== "canonical-json") throw new Error("Canonical serialization format is unsupported.");
  if (input.encoding !== "utf-8") throw new Error("Canonical serialization encoding is unsupported.");
  if (input.supportState !== "supported" && input.supportState !== "deprecated") throw new Error("Canonical serialization support state is unsupported.");
  return deepFreeze(input);
}

export function defineCalibrationKnowledgeDigestPolicy(input: CalibrationKnowledgeDigestPolicy): CalibrationKnowledgeDigestPolicy {
  if (input.policyId !== "tunesight.calibration-knowledge.digest") throw new Error("Calibration Knowledge digest policy identity is unsupported.");
  requireNonBlank(input.policyVersion, "Calibration Knowledge digest policy version");
  if (!/^\d+$/.test(input.policyVersion)) throw new Error("Calibration Knowledge digest policy version must be numeric.");
  if (input.algorithm !== "sha-256") throw new Error("Calibration Knowledge digest algorithm is unsupported.");
  if (input.encoding !== "lowercase-hexadecimal") throw new Error("Calibration Knowledge digest encoding is unsupported.");
  if (input.supportState !== "supported" && input.supportState !== "deprecated") throw new Error("Calibration Knowledge digest support state is unsupported.");
  return deepFreeze(input);
}

function normalizeString(value: string, path: readonly string[]): string {
  if (/\p{Surrogate}/u.test(value)) throw new Error(`Canonical string at ${path.join(".")} contains an invalid surrogate.`);
  const normalized = value.normalize("NFC");
  const field = path.at(-1);
  if (field === "validationDate") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
    if (!match) throw new Error("Canonical validation date must be YYYY-MM-DD.");
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    if (date.toISOString().slice(0, 10) !== normalized) throw new Error("Canonical validation date is invalid.");
  }
  if (field === "effectiveAt") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
    const timestamp = new Date(normalized);
    if (!Number.isFinite(timestamp.valueOf())) throw new Error("Canonical lifecycle timestamp is invalid.");
    return timestamp.toISOString();
  }
  return normalized;
}

function vocabularyKey(value: Readonly<Record<string, unknown>>): string {
  return `${String(value.vocabularyId)}\u0000${String(value.vocabularyVersion)}\u0000${String(value.termId)}`;
}

function semanticArrayKey(value: unknown, field: string): string {
  if (typeof value === "string") return value;
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  const object = value as Readonly<Record<string, unknown>>;
  if (ASSERTION_ARRAYS.has(field)) return String(object.assertionId);
  if (field === "provenance") return `${String(object.sourceType)}\u0000${String(object.sourceIdentifier)}`;
  if (field === "supportingEvidence" || field === "contradictoryEvidence") return String(object.evidenceId);
  if (field === "engineeringObjectives") return String(object.objectiveId);
  if (VOCABULARY_ARRAYS.has(field)) return vocabularyKey(object);
  if (field === "changes") return `${String(object.sequence).padStart(16, "0")}\u0000${String(object.changeId)}`;
  return JSON.stringify(value);
}

function isSetLike(field: string): boolean {
  return ASSERTION_ARRAYS.has(field) || STRING_SET_ARRAYS.has(field) || VOCABULARY_ARRAYS.has(field) || field === "provenance" || field === "supportingEvidence" || field === "contradictoryEvidence" || field === "engineeringObjectives" || field === "changes";
}

function normalizeCanonicalValue(value: unknown, path: readonly string[]): unknown {
  if (value === undefined) throw new Error(`Canonical value at ${path.join(".")} must not be undefined.`);
  if (typeof value === "string") return normalizeString(value, path);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`Canonical number at ${path.join(".")} must be finite.`);
    if (Number.isInteger(value) && !Number.isSafeInteger(value)) throw new Error(`Canonical integer at ${path.join(".")} must be safe.`);
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value === "boolean" || value === null) return value;
  if (typeof value === "bigint" || typeof value === "symbol" || typeof value === "function") throw new Error(`Canonical value at ${path.join(".")} has an unsupported type.`);
  if (Array.isArray(value)) {
    const field = path.at(-1) ?? "";
    const normalized = value.map((item, index) => normalizeCanonicalValue(item, [...path, String(index)]));
    if (ORDERED_ARRAYS.has(field) || !isSetLike(field)) return normalized;
    const keyed = normalized.map((item) => ({ item, key: semanticArrayKey(item, field) })).sort((left, right) => left.key < right.key ? -1 : left.key > right.key ? 1 : 0);
    for (let index = 1; index < keyed.length; index += 1) if (keyed[index].key === keyed[index - 1].key) throw new Error(`Canonical ${field} contains duplicate semantic identity ${keyed[index].key}.`);
    return keyed.map(({ item }) => item);
  }
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new Error(`Canonical object at ${path.join(".")} must be a plain object.`);
  const object = value as Readonly<Record<string, unknown>>;
  const normalized: Record<string, unknown> = {};
  const keys = Object.keys(object).map((key) => ({ key, normalizedKey: normalizeString(key, [...path, "$key"]) })).sort((left, right) => left.normalizedKey < right.normalizedKey ? -1 : left.normalizedKey > right.normalizedKey ? 1 : 0);
  for (let index = 0; index < keys.length; index += 1) {
    if (index > 0 && keys[index].normalizedKey === keys[index - 1].normalizedKey) throw new Error(`Canonical object at ${path.join(".")} contains duplicate normalized key ${keys[index].normalizedKey}.`);
    normalized[keys[index].normalizedKey] = normalizeCanonicalValue(object[keys[index].key], [...path, keys[index].normalizedKey]);
  }
  return normalized;
}

function contentProjection(input: CalibrationKnowledgeObject): CalibrationKnowledgeObject {
  return {
    identity: input.identity,
    canonicalName: input.canonicalName,
    aliases: input.aliases,
    purposes: input.purposes,
    engineeringIntents: input.engineeringIntents,
    calibrationKind: input.calibrationKind,
    primarySubsystem: input.primarySubsystem,
    relatedSubsystems: input.relatedSubsystems,
    applicability: input.applicability,
    sourceRepresentations: input.sourceRepresentations,
    directionalBehaviours: input.directionalBehaviours,
    relationships: input.relationships,
    provenance: input.provenance,
    lifecycle: input.lifecycle,
    version: input.version,
  };
}

export function canonicalizeDigestDomainPayload(input: unknown): CanonicalDomainPayload {
  const normalized = normalizeCanonicalValue(input, ["payload"]);
  const canonicalJson = JSON.stringify(normalized);
  if (canonicalJson === undefined) throw new Error("Canonical domain payload must produce JSON content.");
  const encoded = new TextEncoder().encode(canonicalJson);
  return deepFreeze({ canonicalJson, canonicalBytes: { encoding: "utf-8" as const, byteLength: encoded.byteLength, bytes: Array.from(encoded) } });
}

export function canonicalizeCalibrationKnowledge(
  input: CalibrationKnowledgeObject,
  policy: CanonicalSerializationPolicy = CALIBRATION_KNOWLEDGE_SERIALIZATION_POLICY_V1
): CanonicalCalibrationKnowledgePayload {
  const validatedPolicy = defineCanonicalSerializationPolicy(policy);
  const knowledge = defineCalibrationKnowledgeObject(contentProjection(input));
  const normalized = normalizeCanonicalValue(knowledge, ["knowledge"]);
  const { canonicalJson, canonicalBytes } = canonicalizeDigestDomainPayload(normalized);
  return deepFreeze({ serializationPolicy: validatedPolicy, knowledge: normalized as CalibrationKnowledgeObject, canonicalJson, canonicalBytes });
}

export function deriveDomainSeparatedDigest(
  canonicalBytes: ImmutableCanonicalByteSequence,
  domain: CalibrationKnowledgeDigestDomain,
  serializationPolicy: CanonicalSerializationPolicy = CALIBRATION_KNOWLEDGE_SERIALIZATION_POLICY_V1,
  digestPolicy: CalibrationKnowledgeDigestPolicy = CALIBRATION_KNOWLEDGE_DIGEST_POLICY_V1
): DomainSeparatedDigest {
  const serialization = defineCanonicalSerializationPolicy(serializationPolicy);
  const digest = defineCalibrationKnowledgeDigestPolicy(digestPolicy);
  const label = DOMAIN_LABELS[domain];
  if (!label) throw new Error(`Calibration Knowledge digest domain ${domain} is unsupported.`);
  if (canonicalBytes.encoding !== "utf-8" || canonicalBytes.byteLength !== canonicalBytes.bytes.length || canonicalBytes.bytes.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)) throw new Error("Canonical byte sequence is invalid.");
  const fields = [label, serialization.policyId, serialization.policyVersion, digest.policyId, digest.policyVersion];
  const hash = createHash("sha256");
  for (const field of fields) {
    hash.update(Buffer.from(field, "utf8"));
    hash.update(Buffer.from([0]));
  }
  hash.update(Buffer.from(canonicalBytes.bytes));
  return deepFreeze({ domain, domainLabel: label, serializationPolicyId: serialization.policyId, serializationPolicyVersion: serialization.policyVersion, digestPolicyId: digest.policyId, digestPolicyVersion: digest.policyVersion, qualifiedDigest: `sha256:${hash.digest("hex")}` });
}

export function deriveCalibrationKnowledgeContentDigests(
  input: CalibrationKnowledgeObject,
  serializationPolicy: CanonicalSerializationPolicy = CALIBRATION_KNOWLEDGE_SERIALIZATION_POLICY_V1,
  digestPolicy: CalibrationKnowledgeDigestPolicy = CALIBRATION_KNOWLEDGE_DIGEST_POLICY_V1
): CalibrationKnowledgeContentDigests {
  const payload = canonicalizeCalibrationKnowledge(input, serializationPolicy);
  const digest = deriveDomainSeparatedDigest(payload.canonicalBytes, "calibration_knowledge_content", payload.serializationPolicy, digestPolicy);
  return deepFreeze({ payload, acceptedKnowledgeDigest: digest.qualifiedDigest, expectedResultingCanonicalDigest: digest.qualifiedDigest, digest });
}

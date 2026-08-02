import { createHash } from "node:crypto";

import {
  canonicalizeDigestDomainPayload,
  type CanonicalDomainPayload,
  type ImmutableCanonicalByteSequence,
} from "./calibrationKnowledgeCanonicalSerialization.ts";
import {
  defineEngineeringAssertion,
  type EngineeringAssertion,
  type EngineeringAssertionMembershipContext,
  type EngineeringAssertionRelationshipReference,
} from "./engineeringAssertion.ts";

export type EngineeringAssertionSerializationPolicy = Readonly<{
  policyId: "tunesight.engineering-assertion.serialization";
  policyVersion: string;
  format: "canonical-json";
  encoding: "utf-8";
  supportState: "supported" | "deprecated";
}>;

export type EngineeringAssertionDigestPolicy = Readonly<{
  policyId: "tunesight.engineering-assertion.digest";
  policyVersion: string;
  algorithm: "sha-256";
  encoding: "lowercase-hexadecimal";
  supportState: "supported" | "deprecated";
}>;

export type EngineeringAssertionDigestDomain =
  | "engineering_assertion_content"
  | "engineering_assertion_revision_envelope";

export type EngineeringAssertionContentProjection = Readonly<{
  stableAssertionId: string;
  statement: EngineeringAssertion["statement"];
  assertionClass: EngineeringAssertion["assertionClass"];
  proposition: EngineeringAssertion["proposition"];
  scope: EngineeringAssertion["scope"];
  memberships: readonly EngineeringAssertionMembershipContext[];
  relationshipReferences: readonly EngineeringAssertionRelationshipReference[];
}>;

export type EngineeringAssertionRevisionEnvelopeProjection = Readonly<{
  stableAssertionId: string;
  assertionRevision: string;
  canonicalAssertionDigest: string;
  qualification: EngineeringAssertion["qualification"];
  lifecycle: EngineeringAssertion["lifecycle"];
  contractVersion: string;
}>;

export type CanonicalEngineeringAssertionContent = Readonly<{
  serializationPolicy: EngineeringAssertionSerializationPolicy;
  content: EngineeringAssertionContentProjection;
  canonicalJson: string;
  canonicalBytes: ImmutableCanonicalByteSequence;
}>;

export type CanonicalEngineeringAssertionRevisionEnvelope = Readonly<{
  serializationPolicy: EngineeringAssertionSerializationPolicy;
  envelope: EngineeringAssertionRevisionEnvelopeProjection;
  canonicalJson: string;
  canonicalBytes: ImmutableCanonicalByteSequence;
}>;

export type EngineeringAssertionDomainDigest = Readonly<{
  domain: EngineeringAssertionDigestDomain;
  domainLabel: string;
  serializationPolicyId: string;
  serializationPolicyVersion: string;
  digestPolicyId: string;
  digestPolicyVersion: string;
  qualifiedDigest: string;
}>;

export type EngineeringAssertionRevisionDigests = Readonly<{
  assertion: EngineeringAssertion;
  content: CanonicalEngineeringAssertionContent;
  contentDigest: EngineeringAssertionDomainDigest;
  revisionEnvelope: CanonicalEngineeringAssertionRevisionEnvelope;
  revisionEnvelopeDigest: EngineeringAssertionDomainDigest;
}>;

export const ENGINEERING_ASSERTION_SERIALIZATION_POLICY_V1 = defineEngineeringAssertionSerializationPolicy({
  policyId: "tunesight.engineering-assertion.serialization",
  policyVersion: "1",
  format: "canonical-json",
  encoding: "utf-8",
  supportState: "supported",
});

export const ENGINEERING_ASSERTION_DIGEST_POLICY_V1 = defineEngineeringAssertionDigestPolicy({
  policyId: "tunesight.engineering-assertion.digest",
  policyVersion: "1",
  algorithm: "sha-256",
  encoding: "lowercase-hexadecimal",
  supportState: "supported",
});

const DOMAIN_LABELS: Readonly<Record<EngineeringAssertionDigestDomain, string>> = Object.freeze({
  engineering_assertion_content: "tunesight.engineering-assertion.content",
  engineering_assertion_revision_envelope: "tunesight.engineering-assertion.revision-envelope",
});

function requireNonBlank(value: string, field: string): void {
  if (!value.trim()) throw new Error(`${field} is required.`);
}

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) return Object.freeze(value.map(deepFreeze)) as T;
  if (value !== null && typeof value === "object") {
    const clone: Record<PropertyKey, unknown> = {};
    for (const key of Reflect.ownKeys(value)) {
      clone[key] = deepFreeze((value as Record<PropertyKey, unknown>)[key]);
    }
    return Object.freeze(clone) as T;
  }
  return value;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function membershipKey(value: EngineeringAssertionMembershipContext): string {
  return [
    value.calibrationKnowledgeStableId,
    value.calibrationKnowledgeVersion,
    value.role.vocabularyId,
    value.role.vocabularyVersion,
    value.role.termId,
    value.requirement.vocabularyId,
    value.requirement.vocabularyVersion,
    value.requirement.termId,
  ].join("\u0000");
}

function relationshipKey(value: EngineeringAssertionRelationshipReference): string {
  return [value.relationshipStableId, value.relationshipRevision, value.relationshipDigest].join("\u0000");
}

function sorted<T>(values: readonly T[], key: (value: T) => string): readonly T[] {
  return [...values].sort((left, right) => compareText(key(left), key(right)));
}

export function defineEngineeringAssertionSerializationPolicy(
  input: EngineeringAssertionSerializationPolicy
): EngineeringAssertionSerializationPolicy {
  if (input.policyId !== "tunesight.engineering-assertion.serialization") throw new Error("Engineering Assertion serialization policy identity is unsupported.");
  requireNonBlank(input.policyVersion, "Engineering Assertion serialization policy version");
  if (!/^\d+$/.test(input.policyVersion)) throw new Error("Engineering Assertion serialization policy version must be numeric.");
  if (input.format !== "canonical-json" || input.encoding !== "utf-8") throw new Error("Engineering Assertion serialization representation is unsupported.");
  if (input.supportState !== "supported" && input.supportState !== "deprecated") throw new Error("Engineering Assertion serialization support state is unsupported.");
  return deepFreeze(input);
}

export function defineEngineeringAssertionDigestPolicy(
  input: EngineeringAssertionDigestPolicy
): EngineeringAssertionDigestPolicy {
  if (input.policyId !== "tunesight.engineering-assertion.digest") throw new Error("Engineering Assertion digest policy identity is unsupported.");
  requireNonBlank(input.policyVersion, "Engineering Assertion digest policy version");
  if (!/^\d+$/.test(input.policyVersion)) throw new Error("Engineering Assertion digest policy version must be numeric.");
  if (input.algorithm !== "sha-256" || input.encoding !== "lowercase-hexadecimal") throw new Error("Engineering Assertion digest representation is unsupported.");
  if (input.supportState !== "supported" && input.supportState !== "deprecated") throw new Error("Engineering Assertion digest support state is unsupported.");
  return deepFreeze(input);
}

function contentProjection(input: EngineeringAssertion): EngineeringAssertionContentProjection {
  return {
    stableAssertionId: input.identity.stableAssertionId,
    statement: input.statement,
    assertionClass: input.assertionClass,
    proposition: input.proposition,
    scope: input.scope,
    memberships: sorted(input.memberships, membershipKey),
    relationshipReferences: sorted(input.relationships, relationshipKey),
  };
}

export function canonicalizeEngineeringAssertionContent(
  input: EngineeringAssertion,
  policy: EngineeringAssertionSerializationPolicy = ENGINEERING_ASSERTION_SERIALIZATION_POLICY_V1
): CanonicalEngineeringAssertionContent {
  const validated = defineEngineeringAssertion(input);
  const serializationPolicy = defineEngineeringAssertionSerializationPolicy(policy);
  const content = deepFreeze(contentProjection(validated));
  const canonical: CanonicalDomainPayload = canonicalizeDigestDomainPayload(content);
  const normalizedContent = JSON.parse(canonical.canonicalJson) as EngineeringAssertionContentProjection;
  return deepFreeze({ serializationPolicy, content: normalizedContent, canonicalJson: canonical.canonicalJson, canonicalBytes: canonical.canonicalBytes });
}

export function deriveEngineeringAssertionDigest(
  canonicalBytes: ImmutableCanonicalByteSequence,
  domain: EngineeringAssertionDigestDomain,
  serializationPolicy: EngineeringAssertionSerializationPolicy = ENGINEERING_ASSERTION_SERIALIZATION_POLICY_V1,
  digestPolicy: EngineeringAssertionDigestPolicy = ENGINEERING_ASSERTION_DIGEST_POLICY_V1
): EngineeringAssertionDomainDigest {
  const serialization = defineEngineeringAssertionSerializationPolicy(serializationPolicy);
  const digest = defineEngineeringAssertionDigestPolicy(digestPolicy);
  const label = DOMAIN_LABELS[domain];
  if (!label) throw new Error(`Engineering Assertion digest domain ${domain} is unsupported.`);
  if (canonicalBytes.encoding !== "utf-8" || canonicalBytes.byteLength !== canonicalBytes.bytes.length || canonicalBytes.bytes.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)) throw new Error("Canonical byte sequence is invalid.");
  const hash = createHash("sha256");
  for (const field of [label, serialization.policyId, serialization.policyVersion, digest.policyId, digest.policyVersion]) {
    hash.update(Buffer.from(field, "utf8"));
    hash.update(Buffer.from([0]));
  }
  hash.update(Buffer.from(canonicalBytes.bytes));
  return deepFreeze({ domain, domainLabel: label, serializationPolicyId: serialization.policyId, serializationPolicyVersion: serialization.policyVersion, digestPolicyId: digest.policyId, digestPolicyVersion: digest.policyVersion, qualifiedDigest: `sha256:${hash.digest("hex")}` });
}

export function deriveEngineeringAssertionContentDigest(
  input: EngineeringAssertion,
  serializationPolicy: EngineeringAssertionSerializationPolicy = ENGINEERING_ASSERTION_SERIALIZATION_POLICY_V1,
  digestPolicy: EngineeringAssertionDigestPolicy = ENGINEERING_ASSERTION_DIGEST_POLICY_V1
): Readonly<{ content: CanonicalEngineeringAssertionContent; digest: EngineeringAssertionDomainDigest }> {
  const content = canonicalizeEngineeringAssertionContent(input, serializationPolicy);
  const digest = deriveEngineeringAssertionDigest(content.canonicalBytes, "engineering_assertion_content", content.serializationPolicy, digestPolicy);
  return deepFreeze({ content, digest });
}

export function canonicalizeEngineeringAssertionRevisionEnvelope(
  input: EngineeringAssertion,
  policy: EngineeringAssertionSerializationPolicy = ENGINEERING_ASSERTION_SERIALIZATION_POLICY_V1
): CanonicalEngineeringAssertionRevisionEnvelope {
  const validated = defineEngineeringAssertion(input);
  const serializationPolicy = defineEngineeringAssertionSerializationPolicy(policy);
  const derivedContent = deriveEngineeringAssertionContentDigest(validated, serializationPolicy);
  if (validated.identity.canonicalAssertionDigest !== derivedContent.digest.qualifiedDigest) throw new Error("Assertion revision canonical digest does not match its canonical assertion content.");
  const envelope = deepFreeze({
    stableAssertionId: validated.identity.stableAssertionId,
    assertionRevision: validated.identity.assertionRevision,
    canonicalAssertionDigest: validated.identity.canonicalAssertionDigest,
    qualification: validated.qualification,
    lifecycle: validated.lifecycle,
    contractVersion: validated.contractVersion,
  });
  const canonical = canonicalizeDigestDomainPayload(envelope);
  const normalizedEnvelope = JSON.parse(canonical.canonicalJson) as EngineeringAssertionRevisionEnvelopeProjection;
  return deepFreeze({ serializationPolicy, envelope: normalizedEnvelope, canonicalJson: canonical.canonicalJson, canonicalBytes: canonical.canonicalBytes });
}

export function deriveEngineeringAssertionRevisionDigests(
  input: EngineeringAssertion,
  serializationPolicy: EngineeringAssertionSerializationPolicy = ENGINEERING_ASSERTION_SERIALIZATION_POLICY_V1,
  digestPolicy: EngineeringAssertionDigestPolicy = ENGINEERING_ASSERTION_DIGEST_POLICY_V1
): EngineeringAssertionRevisionDigests {
  const assertion = defineEngineeringAssertion(input);
  const { content, digest: contentDigest } = deriveEngineeringAssertionContentDigest(assertion, serializationPolicy, digestPolicy);
  if (assertion.identity.canonicalAssertionDigest !== contentDigest.qualifiedDigest) throw new Error("Assertion revision canonical digest does not match its canonical assertion content.");
  const revisionEnvelope = canonicalizeEngineeringAssertionRevisionEnvelope(assertion, serializationPolicy);
  const revisionEnvelopeDigest = deriveEngineeringAssertionDigest(revisionEnvelope.canonicalBytes, "engineering_assertion_revision_envelope", revisionEnvelope.serializationPolicy, digestPolicy);
  return deepFreeze({ assertion, content, contentDigest, revisionEnvelope, revisionEnvelopeDigest });
}

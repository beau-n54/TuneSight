import assert from "node:assert/strict";
import test from "node:test";

import type { CalibrationApplicability, GovernedVocabularyReference, QualifiedAssertion } from "./calibrationKnowledge.ts";
import {
  canonicalizeEngineeringAssertionContent,
  deriveEngineeringAssertionContentDigest,
  deriveEngineeringAssertionDigest,
  deriveEngineeringAssertionRevisionDigests,
} from "./engineeringAssertionCanonicalSerialization.ts";
import type { EngineeringAssertion } from "./engineeringAssertion.ts";

const digest = (character: string): string => `sha256:${character.repeat(64)}`;
const vocabulary = (termId: string): GovernedVocabularyReference => ({
  vocabularyId: "engineering-assertion-vocabulary", vocabularyVersion: "1", termId,
  label: termId.replaceAll("_", " "), recognition: "known",
});
const applicability = (platforms: readonly string[] = []): CalibrationApplicability => ({
  scope: vocabulary("strategy_scoped"), platforms, engineFamilies: [], ecuFamilies: [], dmeVariants: [],
  controlStrategies: ["strategy-b", "strategy-a"], romFamilies: [], softwareVersions: [], calibrationIds: [],
  stockVariantIds: [], operatingModes: [], transmissions: [], regions: [], emissionsSpecifications: [],
  hardwareConfigurations: [], sourceReferenceIds: [], unresolvedReason: null,
});
const qualifiedText = (assertionId: string, value: string): QualifiedAssertion<string> => ({
  assertionId, value, verificationStatus: "candidate", confidence: "medium", authority: null,
  provenance: [], supportingEvidence: [], contradictoryEvidence: [], applicability: applicability(),
  conflictState: "none", unresolvedReason: null, version: "1", lifecycle: { status: "active", version: "1" },
});

const unboundAssertion = (): EngineeringAssertion => ({
  identity: { stableAssertionId: "engineering-assertion:test:requested-pressure", assertionRevision: "1", canonicalAssertionDigest: digest("0") },
  statement: { statementRepresentationId: "statement:test:requested-pressure:en", statementRevision: "1", language: "en-AU", text: "The calibration represents a requested pressure quantity.", canonicalStatementDigest: digest("b") },
  assertionClass: vocabulary("purpose"),
  proposition: {
    subject: { knowledgeId: "calibration:test", governedTerm: null, literal: null },
    predicate: vocabulary("represents"),
    object: { knowledgeId: null, governedTerm: vocabulary("requested_pressure"), literal: null },
    direction: null, modality: vocabulary("descriptive"), causality: vocabulary("non_causal"),
  },
  scope: {
    applicability: applicability(["platform-b", "platform-a"]),
    preconditions: [qualifiedText("scope:precondition:b", "Condition B"), qualifiedText("scope:precondition:a", "Condition A")],
    exclusions: [], knownLimitations: [], unresolvedDimensions: [],
  },
  qualification: {
    verificationStatus: "candidate", confidence: "medium", authority: null,
    provenance: [], supportingEvidence: [], contradictoryEvidence: [], conflictState: "none", unresolvedReason: null,
  },
  memberships: [
    { calibrationKnowledgeStableId: "calibration:z", calibrationKnowledgeVersion: "1", role: vocabulary("member"), requirement: vocabulary("required") },
    { calibrationKnowledgeStableId: "calibration:a", calibrationKnowledgeVersion: "1", role: vocabulary("member"), requirement: vocabulary("required") },
  ],
  relationships: [
    { relationshipStableId: "relationship:z", relationshipRevision: "1", relationshipDigest: digest("e"), relatedStableAssertionId: "assertion:z", relatedAssertionRevision: "1", relatedAssertionDigest: digest("f"), direction: vocabulary("forward") },
    { relationshipStableId: "relationship:a", relationshipRevision: "1", relationshipDigest: digest("c"), relatedStableAssertionId: "assertion:a", relatedAssertionRevision: "1", relatedAssertionDigest: digest("d"), direction: vocabulary("forward") },
  ],
  lifecycle: { status: "active", version: "1" }, contractVersion: "1.0",
});

const boundAssertion = (): EngineeringAssertion => {
  const input = unboundAssertion();
  const content = deriveEngineeringAssertionContentDigest(input);
  return { ...input, identity: { ...input.identity, canonicalAssertionDigest: content.digest.qualifiedDigest } };
};

test("derives distinct assertion-content and revision-envelope digests", () => {
  const result = deriveEngineeringAssertionRevisionDigests(boundAssertion());
  assert.equal(result.contentDigest.domain, "engineering_assertion_content");
  assert.equal(result.revisionEnvelopeDigest.domain, "engineering_assertion_revision_envelope");
  assert.notEqual(result.contentDigest.qualifiedDigest, result.revisionEnvelopeDigest.qualifiedDigest);
});

test("excludes the self-referential content digest from content bytes", () => {
  const left = unboundAssertion();
  const right = { ...left, identity: { ...left.identity, canonicalAssertionDigest: digest("9") } };
  assert.deepEqual(canonicalizeEngineeringAssertionContent(left).canonicalBytes, canonicalizeEngineeringAssertionContent(right).canonicalBytes);
});

test("rejects an assertion revision whose declared content digest is substituted", () => {
  const input = boundAssertion();
  const substituted = { ...input, identity: { ...input.identity, canonicalAssertionDigest: digest("9") } };
  assert.throws(() => deriveEngineeringAssertionRevisionDigests(substituted), /does not match/);
});

test("canonical collection order is independent of caller order", () => {
  const left = boundAssertion();
  const right: EngineeringAssertion = {
    ...left,
    scope: { ...left.scope, applicability: { ...left.scope.applicability, platforms: [...left.scope.applicability.platforms].reverse(), controlStrategies: [...left.scope.applicability.controlStrategies].reverse() }, preconditions: [...left.scope.preconditions].reverse() },
    memberships: [...left.memberships].reverse(),
    relationships: [...left.relationships].reverse(),
  };
  const rebound = { ...right, identity: { ...right.identity, canonicalAssertionDigest: deriveEngineeringAssertionContentDigest(right).digest.qualifiedDigest } };
  const leftResult = deriveEngineeringAssertionRevisionDigests(left);
  const rightResult = deriveEngineeringAssertionRevisionDigests(rebound);
  assert.deepEqual(leftResult.content, rightResult.content);
  assert.deepEqual(leftResult.contentDigest, rightResult.contentDigest);
  assert.deepEqual(leftResult.revisionEnvelope, rightResult.revisionEnvelope);
  assert.deepEqual(leftResult.revisionEnvelopeDigest, rightResult.revisionEnvelopeDigest);
});

test("material proposition and scope changes alter the content digest", () => {
  const base = boundAssertion();
  const propositionChange: EngineeringAssertion = { ...base, proposition: { ...base.proposition, object: { knowledgeId: null, governedTerm: vocabulary("different_quantity"), literal: null } } };
  const scopeChange: EngineeringAssertion = { ...base, scope: { ...base.scope, applicability: applicability(["another-platform"]) } };
  assert.notEqual(deriveEngineeringAssertionContentDigest(base).digest.qualifiedDigest, deriveEngineeringAssertionContentDigest(propositionChange).digest.qualifiedDigest);
  assert.notEqual(deriveEngineeringAssertionContentDigest(base).digest.qualifiedDigest, deriveEngineeringAssertionContentDigest(scopeChange).digest.qualifiedDigest);
});

test("qualification and lifecycle changes alter only the revision envelope", () => {
  const base = boundAssertion();
  const changed: EngineeringAssertion = { ...base, qualification: { ...base.qualification, confidence: "low" }, lifecycle: { ...base.lifecycle, version: "2" } };
  const left = deriveEngineeringAssertionRevisionDigests(base);
  const right = deriveEngineeringAssertionRevisionDigests(changed);
  assert.equal(left.contentDigest.qualifiedDigest, right.contentDigest.qualifiedDigest);
  assert.notEqual(left.revisionEnvelopeDigest.qualifiedDigest, right.revisionEnvelopeDigest.qualifiedDigest);
});

test("canonical statement representation remains content-distinct from assertion identity", () => {
  const base = boundAssertion();
  const changed: EngineeringAssertion = { ...base, statement: { ...base.statement, statementRevision: "2", text: "The calibration represents requested pressure." } };
  assert.notEqual(deriveEngineeringAssertionContentDigest(base).digest.qualifiedDigest, deriveEngineeringAssertionContentDigest(changed).digest.qualifiedDigest);
  assert.equal(base.identity.stableAssertionId, changed.identity.stableAssertionId);
});

test("Unicode NFC and object insertion order produce stable canonical bytes", () => {
  const base = unboundAssertion();
  const decomposed: EngineeringAssertion = { ...base, statement: { ...base.statement, text: "Cafe\u0301 pressure" } };
  const composed: EngineeringAssertion = { ...base, statement: { ...base.statement, text: "Café pressure" } };
  assert.deepEqual(canonicalizeEngineeringAssertionContent(decomposed).canonicalBytes, canonicalizeEngineeringAssertionContent(composed).canonicalBytes);
});

test("digest domains remain separated for identical canonical bytes", () => {
  const bytes = canonicalizeEngineeringAssertionContent(unboundAssertion()).canonicalBytes;
  const content = deriveEngineeringAssertionDigest(bytes, "engineering_assertion_content");
  const envelope = deriveEngineeringAssertionDigest(bytes, "engineering_assertion_revision_envelope");
  assert.notEqual(content.qualifiedDigest, envelope.qualifiedDigest);
});

test("produces stable deterministic digest vectors", () => {
  const result = deriveEngineeringAssertionRevisionDigests(boundAssertion());
  assert.equal(result.contentDigest.qualifiedDigest, "sha256:278dfdded5f89e63ea00651ecdbabec8d0de926cf8f664f178487c1cb0cc535a");
  assert.equal(result.revisionEnvelopeDigest.qualifiedDigest, "sha256:98089fde1c948e5d42a46eb0497c69021f7df815dcf2e3e03d2d3990d2dbf186");
});

test("canonical outputs are recursively frozen and caller-isolated", () => {
  const input = boundAssertion();
  const result = deriveEngineeringAssertionRevisionDigests(input);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.content.canonicalBytes.bytes));
  assert.ok(Object.isFrozen(result.revisionEnvelope.envelope.qualification));
  (input.scope.applicability.platforms as string[]).push("mutation");
  assert.deepEqual(result.content.content.scope.applicability.platforms, ["platform-a", "platform-b"]);
});

test("serialization has no operational identity or execution surface", () => {
  const result = deriveEngineeringAssertionRevisionDigests(boundAssertion());
  const keys = JSON.stringify(result);
  for (const prohibited of ["admissionIdentity", "publicationIdentity", "registryIdentity", "receiptIdentity", "executedAt"]) {
    assert.equal(keys.includes(prohibited), false);
  }
});

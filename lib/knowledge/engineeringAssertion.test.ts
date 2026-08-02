import assert from "node:assert/strict";
import test from "node:test";

import { defineEngineeringAssertion, type EngineeringAssertion } from "./engineeringAssertion.ts";
import type { CalibrationApplicability, GovernedVocabularyReference, QualifiedAssertion } from "./calibrationKnowledge.ts";

const digest = (character: string): string => `sha256:${character.repeat(64)}`;
const vocabulary = (termId: string, recognition: GovernedVocabularyReference["recognition"] = "known"): GovernedVocabularyReference => ({
  vocabularyId: "engineering-assertion-vocabulary",
  vocabularyVersion: "1",
  termId,
  label: termId.replaceAll("_", " "),
  recognition,
});
const applicability = (): CalibrationApplicability => ({
  scope: vocabulary("strategy_scoped"), platforms: [], engineFamilies: [], ecuFamilies: [], dmeVariants: [],
  controlStrategies: ["test-strategy"], romFamilies: [], softwareVersions: [], calibrationIds: [],
  stockVariantIds: [], operatingModes: [], transmissions: [], regions: [], emissionsSpecifications: [],
  hardwareConfigurations: [], sourceReferenceIds: [], unresolvedReason: null,
});
const qualifiedText = (assertionId: string, value: string): QualifiedAssertion<string> => ({
  assertionId, value, verificationStatus: "candidate", confidence: "medium", authority: null,
  provenance: [], supportingEvidence: [], contradictoryEvidence: [], applicability: applicability(),
  conflictState: "none", unresolvedReason: null, version: "1", lifecycle: { status: "active", version: "1" },
});

const assertion = () => ({
  identity: { stableAssertionId: "engineering-assertion:test:boost-request", assertionRevision: "1", canonicalAssertionDigest: digest("a") },
  statement: { statementRepresentationId: "statement:test:boost-request:en", statementRevision: "1", language: "en-AU", text: "The calibration represents a requested pressure quantity.", canonicalStatementDigest: digest("b") },
  assertionClass: vocabulary("purpose"),
  proposition: {
    subject: { knowledgeId: "calibration:test", governedTerm: null, literal: null },
    predicate: vocabulary("represents"),
    object: { knowledgeId: null, governedTerm: vocabulary("requested_pressure"), literal: null },
    direction: null, modality: vocabulary("descriptive"), causality: vocabulary("non_causal"),
  },
  scope: { applicability: applicability(), preconditions: [qualifiedText("scope:precondition:1", "The strategy is active.")], exclusions: [], knownLimitations: [], unresolvedDimensions: [] },
  qualification: { verificationStatus: "candidate", confidence: "medium", authority: null, provenance: [], supportingEvidence: [], contradictoryEvidence: [], conflictState: "none", unresolvedReason: null },
  memberships: [{ calibrationKnowledgeStableId: "calibration:test", calibrationKnowledgeVersion: "1", role: vocabulary("contextual_member"), requirement: vocabulary("required") }],
  relationships: [] as EngineeringAssertion["relationships"],
  lifecycle: { status: "active" as const, version: "1" }, contractVersion: "1.0",
}) satisfies EngineeringAssertion;

test("constructs, clones and deeply freezes a candidate Engineering Assertion", () => {
  const input = assertion();
  const result = defineEngineeringAssertion(input);
  assert.notEqual(result, input);
  assert.deepEqual(result, input);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.proposition));
  assert.ok(Object.isFrozen(result.scope.preconditions[0].applicability.platforms));
  (input.scope.applicability.controlStrategies as string[]).push("mutated");
  assert.deepEqual(result.scope.applicability.controlStrategies, ["test-strategy"]);
});

test("preserves the three-level identity hierarchy", () => {
  const result = defineEngineeringAssertion(assertion());
  assert.equal(result.identity.stableAssertionId, "engineering-assertion:test:boost-request");
  assert.equal(result.identity.assertionRevision, "1");
  assert.equal(result.statement.statementRepresentationId, "statement:test:boost-request:en");
  assert.notEqual(result.identity.canonicalAssertionDigest, result.statement.canonicalStatementDigest);
});

test("keeps taxonomy governed, extensible and unknown-preserving", () => {
  const base = assertion();
  const input: EngineeringAssertion = {
    ...base,
    assertionClass: { ...base.assertionClass, termId: "future_governed_class", recognition: "unrecognized" },
    qualification: { ...base.qualification, unresolvedReason: "The assertion class is not admitted." },
  };
  assert.equal(defineEngineeringAssertion(input).assertionClass.termId, "future_governed_class");
});

test("requires exactly one term representation", () => {
  const base = assertion();
  const input: EngineeringAssertion = { ...base, proposition: { ...base.proposition, subject: { ...base.proposition.subject, literal: "duplicate" } } };
  assert.throws(() => defineEngineeringAssertion(input), /exactly one representation/);
});

test("rejects malformed digest and blank statement", () => {
  const malformed = assertion();
  malformed.identity.canonicalAssertionDigest = "not-a-digest";
  assert.throws(() => defineEngineeringAssertion(malformed), /qualified SHA-256 digest/);
  const blank = assertion();
  blank.statement.text = "   ";
  assert.throws(() => defineEngineeringAssertion(blank), /Canonical statement text is required/);
});

test("rejects duplicate scope identities and parent memberships", () => {
  const baseScope = assertion();
  const duplicateScope: EngineeringAssertion = { ...baseScope, scope: { ...baseScope.scope, exclusions: [qualifiedText("scope:precondition:1", "Excluded")] } };
  assert.throws(() => defineEngineeringAssertion(duplicateScope), /Scope assertion identity.*duplicated/);
  const duplicateMembership = assertion();
  duplicateMembership.memberships = [...duplicateMembership.memberships, duplicateMembership.memberships[0]];
  assert.throws(() => defineEngineeringAssertion(duplicateMembership), /Membership identity.*duplicated/);
});

test("requires unresolved truth to preserve its reason", () => {
  const base = assertion();
  const input: EngineeringAssertion = { ...base, qualification: { ...base.qualification, verificationStatus: "unknown" } };
  assert.throws(() => defineEngineeringAssertion(input), /requires an unresolved reason/);
});

test("keeps supporting and contradictory Evidence roles distinct", () => {
  const base = assertion();
  const evidence = { evidenceId: "evidence:1", sourceType: "document", sourceIdentifier: "document:1" };
  const input: EngineeringAssertion = { ...base, qualification: { ...base.qualification, supportingEvidence: [evidence], contradictoryEvidence: [evidence] } };
  assert.throws(() => defineEngineeringAssertion(input), /both supporting and contradictory/);
});

test("preserves exact immutable relationship revision references", () => {
  const input = assertion();
  input.relationships = [{ relationshipStableId: "relationship:1", relationshipRevision: "1", relationshipDigest: digest("c"), relatedStableAssertionId: "engineering-assertion:related", relatedAssertionRevision: "2", relatedAssertionDigest: digest("d"), direction: vocabulary("forward") }];
  const result = defineEngineeringAssertion(input);
  assert.equal(result.relationships[0].relatedAssertionRevision, "2");
  assert.ok(Object.isFrozen(result.relationships[0]));
});

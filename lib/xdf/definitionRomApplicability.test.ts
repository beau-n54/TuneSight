import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createStockVariantRegistry, type StockVariantKnowledge } from "../knowledge/stockVariants.ts";
import { requestRuntimeStockVariantKnowledge } from "../knowledge/runtimeStockVariantKnowledge.ts";
import { resolveBinaryContainer } from "../tunes/binaryContainer.ts";
import type { XdfDefinitionRevision } from "./canonicalXdfDefinition.ts";
import {
  assessCalibratedIntentGate,
  buildMasterLibraryApplicabilityReport,
  defineDefinitionSetRevision,
  identifyEngineeringBinary,
  inheritDefinitionApplicability,
  qualifyDefinitionSetApplicability,
  type DefinitionRomApplicabilityEvidence,
} from "./definitionRomApplicability.ts";
import { interpretXdfStructure } from "./interpretXdfStructure.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "BMW-XDFs-master");
const tinyXdf = (title = "Test") => `<?xml version="1.0"?><XDFFORMAT version="1.70"><XDFHEADER><DEFAULTS datasizeinbits="8" lsbfirst="1" signed="0" float="0" /></XDFHEADER><XDFTABLE><TITLE>${title}</TITLE><XDFAXIS id="z"><EMBEDDEDDATA mmedaddress="0" mmedelementsizebits="8" mmedrowcount="1" mmedcolcount="1" /><DATATYPE>0</DATATYPE></XDFAXIS></XDFTABLE></XDFFORMAT>`;

function parsed(xml = tinyXdf(), filename = "fixture.xdf") {
  const result = interpretXdfStructure({ xml, filename, provenance: "deterministic applicability fixture" });
  assert.equal(result.outcome, "structurally_interpreted");
  assert.ok(result.sourceArtifact);
  return { interpretation: result, set: defineDefinitionSetRevision({ sourceArtifact: result.sourceArtifact!, definitions: result.definitions }) };
}

function binary(bytes: Uint8Array, fileName = "fixture.bin", identity: { romFamily?: string; softwareIdentity?: string; calibrationIdentity?: string; internalRomIdentifiers?: readonly string[] } = {}) {
  const resolved = resolveBinaryContainer({ bytes, fileName });
  assert.equal(resolved.status, "resolved");
  return identifyEngineeringBinary({ engineeringBinary: resolved.engineeringBinary!, ...identity, identityProvenance: ["deterministic test observation"] });
}

function evidence(input: Partial<DefinitionRomApplicabilityEvidence> & Pick<DefinitionRomApplicabilityEvidence, "evidenceId" | "signal">): DefinitionRomApplicabilityEvidence {
  return { strength: "qualified", relationship: "supports", definitionSetRevisionId: null, binaryDigest: null, assertedValue: null, provenance: "controlled test Evidence", explanation: "Controlled Evidence supports this applicability claim.", ...input };
}

test("Definition Set identity binds one exact source and interpreted revision set", () => {
  const first = parsed(); const second = parsed(); const changed = parsed(tinyXdf("Changed"));
  assert.deepEqual(first.set, second.set); assert.notEqual(first.set.revisionId, changed.set.revisionId); assert.ok(Object.isFrozen(first.set)); assert.ok(Object.isFrozen(first.set.definitionRevisionIds));
  assert.throws(() => defineDefinitionSetRevision({ sourceArtifact: first.interpretation.sourceArtifact!, definitions: changed.interpretation.definitions }), /exact Definition Set/);
});

test("Engineering Binary identity binds exact extracted bytes and container evidence", () => {
  const first = binary(Uint8Array.from([1, 2, 3])); const renamed = binary(Uint8Array.from([1, 2, 3]), "misleading-name.bin"); const changed = binary(Uint8Array.from([1, 2, 4]));
  assert.equal(first.digest, renamed.digest); assert.equal(first.identityId, renamed.identityId); assert.notEqual(first.digest, changed.digest); assert.equal(first.byteLength, 3); assert.equal(first.containerType, "bin"); assert.ok(Object.isFrozen(first));
});

test("qualified exact digest pairing establishes exact applicability deterministically", () => {
  const fixture = parsed(); const target = binary(Uint8Array.from([1, 2, 3]));
  const pairing = evidence({ evidenceId: "pair:1", signal: "exact_digest_pair", definitionSetRevisionId: fixture.set.revisionId, binaryDigest: target.digest, explanation: "A controlled qualified source record binds these exact revisions." });
  const qualify = () => qualifyDefinitionSetApplicability({ definitionSet: fixture.set, binaryIdentity: target, evidence: [pairing] });
  const first = qualify(); assert.deepEqual(first, qualify()); assert.equal(first.outcome, "exactly_applicable"); assert.ok(Object.isFrozen(first)); assert.ok(Object.isFrozen(first.evidence));
});

test("provisional source pairing remains a qualified candidate", () => {
  const fixture = parsed(); const target = binary(Uint8Array.from([3, 2, 1]));
  const result = qualifyDefinitionSetApplicability({ definitionSet: fixture.set, binaryIdentity: target, evidence: [evidence({ evidenceId: "association", signal: "source_association", strength: "provisional", definitionSetRevisionId: fixture.set.revisionId, binaryDigest: target.digest })] });
  assert.equal(result.outcome, "qualified_candidate");
});

test("family compatibility remains distinct from exact authority", () => {
  const fixture = parsed(); const target = binary(Uint8Array.from([1]), "same-size.bin", { romFamily: "IJE0S" });
  const result = qualifyDefinitionSetApplicability({ definitionSet: fixture.set, binaryIdentity: target, expectedRomFamily: "IJE0S" });
  assert.equal(result.outcome, "family_compatible"); assert.match(result.unresolvedConditions[0], /does not prove exact/);
});

test("material positive and negative Evidence remains conflicting", () => {
  const fixture = parsed(); const target = binary(Uint8Array.from([1, 2]));
  const result = qualifyDefinitionSetApplicability({ definitionSet: fixture.set, binaryIdentity: target, evidence: [
    evidence({ evidenceId: "applies", signal: "exact_digest_pair", definitionSetRevisionId: fixture.set.revisionId, binaryDigest: target.digest }),
    evidence({ evidenceId: "contradiction", signal: "calibration_identity", relationship: "contradicts", explanation: "A qualified calibration identity disagrees." }),
  ] });
  assert.equal(result.outcome, "conflicting");
});

test("unknown and invalid inputs remain explicit", () => {
  const fixture = parsed(); const target = binary(Uint8Array.from([5]));
  assert.equal(qualifyDefinitionSetApplicability({ definitionSet: fixture.set, binaryIdentity: target }).outcome, "unknown");
  assert.equal(qualifyDefinitionSetApplicability({ definitionSet: null, binaryIdentity: target }).outcome, "invalid");
});

test("qualified exclusion and mismatched ROM identity establish inapplicability", () => {
  const fixture = parsed(); const target = binary(Uint8Array.from([1]), "wrong.bin", { romFamily: "OTHER" });
  assert.equal(qualifyDefinitionSetApplicability({ definitionSet: fixture.set, binaryIdentity: target, expectedRomFamily: "IJE0S" }).outcome, "inapplicable");
  assert.equal(qualifyDefinitionSetApplicability({ definitionSet: fixture.set, binaryIdentity: target, evidence: [evidence({ evidenceId: "exclude", signal: "explicit_exclusion", explanation: "Qualified evidence excludes this exact pair." })] }).outcome, "inapplicable");
});

test("filename directory and size alone cannot manufacture authority", () => {
  const fixture = parsed(tinyXdf(), "IJE0S.xdf"); const sameSizeWrong = binary(Uint8Array.from([9, 9, 9]), "IJE0S_original.bin");
  const result = qualifyDefinitionSetApplicability({ definitionSet: fixture.set, binaryIdentity: sameSizeWrong, evidence: [evidence({ evidenceId: "size", signal: "size_compatibility", strength: "observed", explanation: "Only byte length is compatible." })] });
  assert.equal(result.outcome, "unknown");
});

test("an internal ROM identifier corroborates but does not independently create exact authority", () => {
  const fixture = parsed(); const target = binary(Uint8Array.from([1, 2, 3]), "fixture.bin", { internalRomIdentifiers: ["IJE0S"] });
  const withoutPair = qualifyDefinitionSetApplicability({ definitionSet: fixture.set, binaryIdentity: target, expectedInternalRomIdentifiers: ["IJE0S"] });
  assert.equal(withoutPair.outcome, "unknown");
  const withPair = qualifyDefinitionSetApplicability({ definitionSet: fixture.set, binaryIdentity: target, expectedInternalRomIdentifiers: ["IJE0S"], evidence: [evidence({ evidenceId: "pair", signal: "exact_digest_pair", definitionSetRevisionId: fixture.set.revisionId, binaryDigest: target.digest })] });
  assert.equal(withPair.outcome, "exactly_applicable"); assert.match(withPair.reasons.join(" "), /internal ROM identifier/);
});

test("a mismatched internal ROM identifier blocks exact authority", () => {
  const fixture = parsed(); const target = binary(Uint8Array.from([1, 2, 3]), "fixture.bin", { internalRomIdentifiers: ["INA0S"] });
  const result = qualifyDefinitionSetApplicability({ definitionSet: fixture.set, binaryIdentity: target, expectedInternalRomIdentifiers: ["IJE0S"], evidence: [evidence({ evidenceId: "pair", signal: "exact_digest_pair", definitionSetRevisionId: fixture.set.revisionId, binaryDigest: target.digest })] });
  assert.equal(result.outcome, "conflicting"); assert.match(result.reasons.join(" "), /Internal ROM identifiers/);
});

function stockVariant(set: ReturnType<typeof parsed>["set"], target: ReturnType<typeof binary>, verificationStatus: StockVariantKnowledge["verificationStatus"]): StockVariantKnowledge {
  return { id: `stock:${verificationStatus}`, sha256: target.digest, binarySizeBytes: target.byteLength, romFamily: "IJE0S", verificationStatus, confidence: verificationStatus === "authoritatively_verified" ? "high" : "medium", provenance: [{ sourceType: "test", sourceIdentifier: "controlled-stock", validationMethod: verificationStatus === "authoritatively_verified" ? "Exact bytes and source relationship reviewed" : undefined, validationAuthority: verificationStatus === "authoritatively_verified" ? "Founder fixture authority" : undefined, validationDate: verificationStatus === "authoritatively_verified" ? "2026-08-23" : undefined }], supportingEvidence: ["Exact fixture digest", "Exact XDF source relationship"], xdfRelationships: [set.sourceArtifactId], lifecycleStatus: "active", conflictState: "none" };
}

test("Stock Variant Knowledge strengthens applicability without parallel stock identity", () => {
  const fixture = parsed(); const target = binary(Uint8Array.from([4, 5, 6]), "stock.bin", { romFamily: "IJE0S" });
  const authoritative = requestRuntimeStockVariantKnowledge({ registry: createStockVariantRegistry([stockVariant(fixture.set, target, "authoritatively_verified")]), lookup: { sha256: target.digest, binarySizeBytes: target.byteLength, romFamily: "IJE0S" } });
  const provisional = requestRuntimeStockVariantKnowledge({ registry: createStockVariantRegistry([stockVariant(fixture.set, target, "provisional")]), lookup: { sha256: target.digest, binarySizeBytes: target.byteLength, romFamily: "IJE0S" } });
  assert.equal(qualifyDefinitionSetApplicability({ definitionSet: fixture.set, binaryIdentity: target, stockVariantKnowledge: authoritative }).outcome, "exactly_applicable");
  assert.equal(qualifyDefinitionSetApplicability({ definitionSet: fixture.set, binaryIdentity: target, stockVariantKnowledge: provisional }).outcome, "qualified_candidate");
  assert.equal(qualifyDefinitionSetApplicability({ definitionSet: fixture.set, binaryIdentity: target, stockVariantKnowledge: requestRuntimeStockVariantKnowledge({ registry: null, lookup: {} }) }).outcome, "unknown");
});

test("only valid non-conflicting Definitions inherit an exact set qualification", () => {
  const fixture = parsed(); const target = binary(Uint8Array.from([7])); const qualification = qualifyDefinitionSetApplicability({ definitionSet: fixture.set, binaryIdentity: target, evidence: [evidence({ evidenceId: "pair", signal: "exact_digest_pair", definitionSetRevisionId: fixture.set.revisionId, binaryDigest: target.digest })] });
  const inherited = inheritDefinitionApplicability({ definition: fixture.interpretation.definitions[0], definitionSet: fixture.set, qualification });
  assert.equal(inherited.status, "inherited_exact"); assert.equal(assessCalibratedIntentGate({ qualification, inheritance: inherited, extractionSucceeded: true }).authorised, true);
  const conflicting = { ...fixture.interpretation.definitions[0], identity: { status: "conflicting", stableId: null, derivationBasis: null, unresolvedReason: "fixture conflict" } } as XdfDefinitionRevision;
  const blocked = inheritDefinitionApplicability({ definition: conflicting, definitionSet: fixture.set, qualification });
  assert.equal(blocked.status, "definition_conflicting"); assert.equal(assessCalibratedIntentGate({ qualification, inheritance: blocked, extractionSucceeded: true }).authorised, false);
  assert.equal(assessCalibratedIntentGate({ qualification, inheritance: inherited, extractionSucceeded: false }).authorised, false);
});

function realFixture(relativeXdf: string, relativeBin: string, identity: { romFamily: string; internalRomIdentifiers?: readonly string[] }) {
  const xdfPath = path.join(root, relativeXdf); const binPath = path.join(root, relativeBin);
  const interpretation = interpretXdfStructure({ xml: fs.readFileSync(xdfPath, "utf8"), filename: path.basename(xdfPath), provenance: `real repository fixture ${relativeXdf}` });
  assert.equal(interpretation.outcome, "structurally_interpreted");
  const set = defineDefinitionSetRevision({ sourceArtifact: interpretation.sourceArtifact!, definitions: interpretation.definitions });
  const target = binary(fs.readFileSync(binPath), path.basename(binPath), identity);
  return { interpretation, set, target };
}

test("real N54 fixture distinguishes exact qualification and wrong-ROM negative proof", () => {
  const n54 = realFixture("N54/IJE0S.xdf", "N54/IJE0S_original.bin", { romFamily: "IJE0S", internalRomIdentifiers: ["IJE0S"] });
  const exact = qualifyDefinitionSetApplicability({ definitionSet: n54.set, binaryIdentity: n54.target, expectedRomFamily: "IJE0S", expectedInternalRomIdentifiers: ["IJE0S"], evidence: [evidence({ evidenceId: "n54:controlled-pair", signal: "exact_digest_pair", definitionSetRevisionId: n54.set.revisionId, binaryDigest: n54.target.digest, provenance: "controlled N54 repository-fixture qualification", explanation: "The deterministic test authority binds the exact IJE0S XDF source and stock binary bytes." })] });
  assert.equal(exact.outcome, "exactly_applicable");
  const wrong = binary(fs.readFileSync(path.join(root, "N54/INA0S_original.bin")), "renamed-IJE0S.bin", { romFamily: "INA0S", internalRomIdentifiers: ["INA0S"] });
  assert.equal(qualifyDefinitionSetApplicability({ definitionSet: n54.set, binaryIdentity: wrong, expectedRomFamily: "IJE0S", expectedInternalRomIdentifiers: ["IJE0S"] }).outcome, "inapplicable");
});

test("real B58 fixture remains candidate when repository association lacks exact authority", () => {
  const b58 = realFixture("B58gen1/000030765A3C06.xdf", "B58gen1/000030765A3C06_original.bin", { romFamily: "000030765A3C06" });
  const result = qualifyDefinitionSetApplicability({ definitionSet: b58.set, binaryIdentity: b58.target, expectedRomFamily: "000030765A3C06", evidence: [evidence({ evidenceId: "b58:colocation", signal: "source_association", strength: "provisional", definitionSetRevisionId: b58.set.revisionId, binaryDigest: b58.target.digest, provenance: "BMW master-library co-location observation", explanation: "The exact XDF and BIN are repository-associated, but that association is not authoritative verification." })] });
  assert.equal(result.outcome, "qualified_candidate");
});

test("real B58 Gen2 and S63 fixtures prove generic additional-family behavior", () => {
  const b58 = realFixture("B58gen2/00005D5532C808/00005D5532C808.xdf", "B58gen2/00005D5532C808/00005D5532C808_original.bin", { romFamily: "00005D5532C808" });
  assert.equal(qualifyDefinitionSetApplicability({ definitionSet: b58.set, binaryIdentity: b58.target, expectedRomFamily: "00005D5532C808" }).outcome, "family_compatible");
  const s63 = realFixture("S63/00004ACF0A3204/00004ACF0A3204.xdf", "S63/00004ACF0A3204/00004ACF0A3204_original.bin", { romFamily: "00004ACF0A3204" });
  assert.equal(qualifyDefinitionSetApplicability({ definitionSet: s63.set, binaryIdentity: s63.target, expectedRomFamily: "00004ACF0A3204" }).outcome, "family_compatible");
});

test("master-library applicability report exposes provisional pairings and authority gaps", () => {
  const xdfs: string[] = []; const walk = (directory: string) => fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => { const full = path.join(directory, entry.name); if (entry.isDirectory()) walk(full); else if (entry.name.toLowerCase().endsWith(".xdf")) xdfs.push(full); }); walk(root);
  const records = xdfs.sort().map((xdf) => { const directory = path.dirname(xdf); const stem = path.basename(xdf, path.extname(xdf)).replace(/_Legacy$/i, ""); const paired = fs.readdirSync(directory).some((name) => name.toLowerCase().endsWith(".bin") && path.basename(name, path.extname(name)).toLowerCase().startsWith(stem.toLowerCase())); return { outcome: paired ? "qualified_candidate" as const : "unknown" as const, sourceAssociationDiscovered: paired, family: path.relative(root, xdf).split(path.sep)[0] }; });
  const report = buildMasterLibraryApplicabilityReport(records); console.log(`BMW_MASTER_APPLICABILITY_COVERAGE ${JSON.stringify(report)}`);
  assert.equal(report.definitionSetsDiscovered, 99); assert.equal(report.exactRelationships, 0); assert.ok(report.candidateRelationships > 0); assert.ok(report.unresolvedRelationships > 0); assert.equal(report.candidateRelationships + report.unresolvedRelationships, 99); assert.ok(report.familiesRepresented.length >= 7); assert.ok(Object.isFrozen(report));
});

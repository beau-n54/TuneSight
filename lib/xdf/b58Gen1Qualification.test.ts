import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { resolveBinaryContainer } from "../tunes/binaryContainer.ts";
import { collectInternalIdentityObservations } from "./applicabilityEvidenceProposal.ts";
import { constructGovernedEvidenceAuthorityCandidate, validateCompleteDefinitionSet } from "./bmwMasterFullValidation.ts";
import { B58_GEN1_SOURCE_AUTHORITY_DECISION_CANDIDATES } from "./b58Gen1SourceAuthorityCandidates.ts";
import { extractRawCalibrationValues } from "./calibrationValueExtraction.ts";
import { defineDefinitionSetRevision } from "./definitionRomApplicability.ts";
import { evaluateParsedXdfEquation, parseXdfEquation } from "./engineeringValueConversion.ts";
import { interpretXdfStructure } from "./interpretXdfStructure.ts";

const root = path.resolve("BMW-XDFs-master/B58gen1");
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

test("B58 Gen1 invalid numeric and representation blockers are definition-exact", { timeout: 900_000 }, (context) => {
  const invalid: unknown[] = [], conflicts: unknown[] = [];
  for (const xdfName of fs.readdirSync(root).filter((name) => name.endsWith(".xdf")).sort()) {
    const rom = path.basename(xdfName, ".xdf"), parsed = interpretXdfStructure({ xml: fs.readFileSync(path.join(root, xdfName), "utf8"), filename: xdfName, provenance: `B58 Gen1 qualification audit ${xdfName}` });
    assert.equal(parsed.outcome, "structurally_interpreted");
    for (const definition of parsed.definitions.filter((item) => item.identity.status === "conflicting")) conflicts.push({ rom, title: definition.title, revision: definition.revisionId, address: definition.primaryAddress, axes: definition.axes.map((axis) => ({ id: axis.axisId, units: axis.units, equation: axis.equationSource, dataType: axis.dataType, count: axis.indexCount })) });
    for (const binName of fs.readdirSync(root).filter((name) => name.startsWith(rom) && name.endsWith(".bin")).sort()) {
      const resolved = resolveBinaryContainer({ bytes: fs.readFileSync(path.join(root, binName)), fileName: binName }); assert.equal(resolved.status, "resolved");
      for (const definition of parsed.definitions) {
        const raw = extractRawCalibrationValues(resolved.engineeringBinary!, definition); if (raw.outcome !== "extracted") continue;
        const axis = definition.axes.find((item) => item.axisId.toLowerCase() === "z") ?? definition.axes.at(-1); if (!axis?.equationSource || raw.shape?.values[0] === undefined) continue;
        const equation = parseXdfEquation(axis.equationSource); if (equation.outcome === "unsupported_expression" || equation.outcome === "malformed_equation") continue;
        const evaluated = evaluateParsedXdfEquation(equation, raw.shape.values[0]);
        if (evaluated.outcome === "invalid_numeric_result") invalid.push({ rom, binary: binName, title: definition.title, revision: definition.revisionId, address: definition.primaryAddress, rawValue: raw.shape.values[0], rawOffset: raw.offsets[0], units: axis.units, equation: axis.equationSource, finding: evaluated.finding });
      }
    }
  }
  assert.equal(invalid.length, 5);
  const invalidFindings = invalid as { title: string; revision: string; address: number; rawValue: number; rawOffset: number; equation: string; finding: string }[];
  assert.deepEqual([...new Set(invalidFindings.map((item) => item.revision))], ["xdf-definition-revision:42026e596f3a1b7220bf5c609596e38b5cdb0e8138fd21ac9576e3023cb8ad35"]);
  assert.ok(invalidFindings.every((item) => item.title === "Injector Scalar (Auto)" && item.address === 7_445_148 && item.rawOffset === 7_445_148 && item.rawValue === 0 && item.equation === "1/(X*0.000011518903) * 80.11750567498999" && item.finding === "Division by zero."));
  assert.equal(conflicts.length, 4);
  const conflictFindings = conflicts as { rom: string; revision: string; address: number }[];
  assert.deepEqual([...new Set(conflictFindings.map((item) => item.rom))].sort(), ["000030765A3C06", "000030765A5005"]);
  assert.deepEqual([...new Set(conflictFindings.map((item) => item.revision))].sort(), ["xdf-definition-revision:cdb3a13ebbc80129453d0899731c77a72efcf33580e2ae1c8abb520e05440938", "xdf-definition-revision:f470b44e75278b2d7d7e22850fe53746cf09b7f67c289c359c69d80b420c11bb"]);
  assert.ok(conflictFindings.every((item) => item.address === 7_340_032));
  context.diagnostic(`B58_GEN1_INVALID_NUMERIC ${JSON.stringify(invalid)}`);
  context.diagnostic(`B58_GEN1_REPRESENTATION_CONFLICTS ${JSON.stringify(conflicts)}`);
});

test("the clean single-binary B58 Gen1 source advances to an exact Source Authority candidate only", { timeout: 120_000 }, (context) => {
  const rom = "00007972000705", xdfName = `${rom}.xdf`, binName = `${rom}_original.bin`;
  const parsed = interpretXdfStructure({ xml: fs.readFileSync(path.join(root, xdfName), "utf8"), filename: xdfName, provenance: `B58 Gen1 exact Source Authority candidate ${xdfName}` }); assert.equal(parsed.outcome, "structurally_interpreted");
  const source = parsed.sourceArtifact!, set = defineDefinitionSetRevision({ sourceArtifact: source, definitions: parsed.definitions });
  const resolved = resolveBinaryContainer({ bytes: fs.readFileSync(path.join(root, binName)), fileName: binName }); assert.equal(resolved.status, "resolved");
  const binary = resolved.engineeringBinary!, binaryDigest = sha(binary.bytes), validation = validateCompleteDefinitionSet({ sourceDigest: source.sourceDigest, definitionSetRevision: set.revisionId, binary, binaryDigest, definitions: parsed.definitions });
  const observations = collectInternalIdentityObservations({ binaryBytes: binary.bytes, credibleIdentifiers: [{ identifier: rom, kind: "calibration_identifier", confidence: "known_identity", reason: "Exact B58 Gen1 cohort identity", encodings: ["ascii", "hex_encoded"] }] });
  const candidate = constructGovernedEvidenceAuthorityCandidate({ scope: { sourceArtifactId: source.artifactId, sourceArtifactDigest: source.sourceDigest, definitionSetId: set.definitionSetId, definitionSetRevision: set.revisionId, family: "B58gen1" }, romSoftwareIdentity: rom, validations: [validation], identityCoherent: observations.some((item) => item.normalizedForm === rom), limitations: ["Upstream acquisition and XDF authorship remain unknown.", "Candidate authority is pending Founder review.", "Stock authenticity, semantic Knowledge, applicability decision and publication remain separate."] });
  assert.equal(candidate.state, "pending_founder_authority");
  assert.deepEqual(B58_GEN1_SOURCE_AUTHORITY_DECISION_CANDIDATES, [candidate]);
  context.diagnostic(`B58_GEN1_SOURCE_AUTHORITY_CANDIDATE ${JSON.stringify({ rom, sourceArtifactId: source.artifactId, sourceDigest: source.sourceDigest, definitionSetId: set.definitionSetId, definitionSetRevision: set.revisionId, definitions: parsed.definitions.length, binary: { digest: binaryDigest, byteLength: binary.byteLength, container: binary.source.containerType }, markers: observations.map((item) => ({ detector: item.detector, offsets: item.offsets, multiplicity: item.occurrenceCount })), validation, candidate })}`);
});

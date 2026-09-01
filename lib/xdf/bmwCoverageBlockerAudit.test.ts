import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { resolveBinaryContainer } from "../tunes/binaryContainer.ts";
import { validateCompleteDefinitionSet } from "./bmwMasterFullValidation.ts";
import { collectInternalIdentityObservations } from "./applicabilityEvidenceProposal.ts";
import { defineDefinitionSetRevision } from "./definitionRomApplicability.ts";
import { constructCoverageBlockerAudit, type CoverageSourceAudit, type RepresentationConflict } from "./coverageBlockerAudit.ts";
import { interpretXdfStructure } from "./interpretXdfStructure.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "BMW-XDFs-master");
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

function auditFamily(family: "B58gen1" | "F series N55 S55 N13") {
  const directory = path.join(root, family), xdfs = fs.readdirSync(directory).filter((name) => name.toLowerCase().endsWith(".xdf")).sort(), vocabulary = xdfs.map((name) => path.basename(name, ".xdf"));
  const sources: CoverageSourceAudit[] = xdfs.map((name) => {
    const rom = path.basename(name, ".xdf"), parsed = interpretXdfStructure({ xml: fs.readFileSync(path.join(directory, name), "utf8"), filename: name, provenance: `Repository-controlled blocker audit ${family}/${name}` }); assert.equal(parsed.outcome, "structurally_interpreted");
    const artifact = parsed.sourceArtifact!, set = defineDefinitionSetRevision({ sourceArtifact: artifact, definitions: parsed.definitions });
    const bins = fs.readdirSync(directory).filter((item) => item.toLowerCase().endsWith(".bin") && path.basename(item, ".bin").toLowerCase().startsWith(rom.toLowerCase())).sort().map((filename) => {
      const resolved = resolveBinaryContainer({ bytes: fs.readFileSync(path.join(directory, filename)), fileName: filename }); assert.equal(resolved.status, "resolved"); const binary = resolved.engineeringBinary!;
      const observations = collectInternalIdentityObservations({ binaryBytes: binary.bytes, credibleIdentifiers: vocabulary.map((identifier) => ({ identifier, kind: "calibration_identifier" as const, confidence: "candidate_correspondence" as const, reason: "Exact repository cohort identity vocabulary", encodings: ["ascii" as const, "hex_encoded" as const] })) });
      const validation = validateCompleteDefinitionSet({ sourceDigest: artifact.sourceDigest, definitionSetRevision: set.revisionId, binary, binaryDigest: digest(binary.bytes), definitions: parsed.definitions });
      return { filename, digest: validation.binaryDigest, byteLength: binary.byteLength, containerType: binary.source.containerType, stockState: "candidate" as const, markers: observations.map((item) => ({ identifier: item.normalizedForm, encoding: item.detector === "bounded_ascii_exact" ? "ascii" as const : "hex_encoded" as const, offsets: item.offsets, multiplicity: item.occurrenceCount, classification: item.normalizedForm === rom.toUpperCase() ? "candidate_specific" as const : "common_shared" as const })), extraction: { attempted: validation.extractionAttempts, successful: validation.extractionSuccess, blocked: validation.blocked }, conversion: { converted: validation.converted, identityNoOp: validation.identityNoOp, invalid: validation.invalidNumeric + validation.malformed, unavailable: validation.unavailable } };
    });
    const grouped = new Map<string, typeof parsed.definitions>(); for (const definition of parsed.definitions.filter((item) => item.identity.status === "conflicting")) { const key = `${definition.primaryAddress}:${definition.title}`; grouped.set(key, [...(grouped.get(key) ?? []), definition]); }
    const conflicts: RepresentationConflict[] = [...grouped.values()].map((items) => ({
      definitionRevision: items.map((item) => item.revisionId).sort().join(" + "),
      title: items[0]?.title ?? "Untitled",
      units: [...new Set(items.flatMap((item) => item.axes.map((axis) => axis.units).filter((value): value is string => Boolean(value))))].sort(),
      equations: [...new Set(items.flatMap((item) => item.axes.map((axis) => axis.equationSource).filter((value): value is string => Boolean(value))))].sort(),
      storageSignatures: [...new Set(items.map((item) => JSON.stringify({ layout: item.defaultDataLayout, byteOrder: item.byteOrderMetadata, axes: item.axes.map((axis) => ({ id: axis.axisId, count: axis.indexCount, dataType: axis.dataType, embedded: axis.embeddedData })) })))].sort(),
    }));
    return { family, romSoftwareIdentity: rom, sourceArtifactId: artifact.artifactId, sourceRevision: artifact.sourceRevision ?? artifact.sourceDigest, definitionSetRevision: set.revisionId, sourceDescription: parsed.definitions.find((item) => item.description)?.description ?? null, categories: [], binaries: bins, conflicts, provenance: [artifact.provenance, "Upstream acquisition and authorship unknown."], founderReferenceRelationships: [] };
  });
  return constructCoverageBlockerAudit({ familyLabel: family, sources, separationRules: family === "F series N55 S55 N13" ? ["Repository evidence does not currently bind any exact source to N55, S55 or N13; directory membership and filename are insufficient."] : ["Multiple observed exact cohort identifiers are preserved; candidate-specific identity requires a unique governed marker combination or qualified external observation."] });
}

test("B58 Gen1 repository census exhausts markers and preserves unresolved identities", { timeout: 900_000 }, (context) => { const audit = auditFamily("B58gen1"); assert.equal(audit.sources.length, 7); assert.equal(audit.sources.reduce((sum, item) => sum + item.binaries.length, 0), 11); assert.equal(audit.sources.filter((item) => item.binaries.length === 0).map((item) => item.romSoftwareIdentity).join(), "000030765A5005"); assert.equal(audit.sources.reduce((sum, item) => sum + item.conflicts.reduce((n, conflict) => n + conflict.definitionRevision.split(" + ").length, 0), 0), 4); assert.ok(audit.sources.flatMap((item) => item.binaries).every((binary) => binary.extraction.attempted === binary.extraction.successful + binary.extraction.blocked)); assert.equal(audit.authorityGranted, false); context.diagnostic(`B58_GEN1_BLOCKER_AUDIT ${JSON.stringify(audit)}`); });
test("mixed N55 S55 N13 census preserves all platform assignments as ambiguous and groups 50 conflicts", { timeout: 900_000 }, (context) => { const audit = auditFamily("F series N55 S55 N13"); assert.equal(audit.sources.length, 13); assert.equal(audit.sources.reduce((sum, item) => sum + item.binaries.length, 0), 26); assert.ok(Object.values(audit.platformAssignments).every((item) => item === "ambiguous")); assert.equal(audit.sources.reduce((sum, item) => sum + item.conflicts.reduce((n, conflict) => n + conflict.definitionRevision.split(" + ").length, 0), 0), 50); assert.equal(audit.authorityGranted, false); context.diagnostic(`N55_S55_N13_BLOCKER_AUDIT ${JSON.stringify(audit)}`); });

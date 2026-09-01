import assert from "node:assert/strict";
import test from "node:test";
import { constructCoverageBlockerAudit, type CoverageSourceAudit } from "./coverageBlockerAudit.ts";

const source = (rom: string, units: readonly string[], equations: readonly string[]): CoverageSourceAudit => ({ family: "F series N55 S55 N13", romSoftwareIdentity: rom, sourceArtifactId: `xdf-source:${rom.padEnd(64, "0").slice(0, 64)}`, sourceRevision: `source-revision:${rom}`, definitionSetRevision: `set-revision:${rom}`, sourceDescription: null, categories: [], binaries: [], conflicts: [{ definitionRevision: `definition:${rom}`, title: "Conflict", units, equations, storageSignatures: ["same"] }], provenance: ["Repository-controlled source"], founderReferenceRelationships: [] });

test("mixed-platform audit preserves ambiguity and groups reusable representation classes", () => {
  const audit = constructCoverageBlockerAudit({ familyLabel: "F series N55 S55 N13", sources: [source("A000", ["psi", "bar"], ["X"]), source("B000", ["psi"], ["X", "X*2"])], separationRules: ["Only exact repository-governed platform evidence may assign an engine platform."] });
  assert.deepEqual(Object.values(audit.platformAssignments), ["ambiguous", "ambiguous"]);
  assert.deepEqual(audit.conflictClasses.map((item) => item.classId), ["units_only", "equation_only"]);
  assert.equal(audit.authorityGranted, false); assert.deepEqual(audit.publicationSideEffects, []);
});

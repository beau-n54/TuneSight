import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import { defineEcuIdentityObservation } from "../vehicle-interface/nativeVehicleData.ts";
import { resolveBinaryContainer, type EngineeringBinary } from "../tunes/binaryContainer.ts";
import type { ConnectedRomObservation } from "../xdf/definitionCoverageDiscovery.ts";
import { deriveWorkshopCapabilities, resolveMasterCalibration, type DefinitionCatalog, type DefinitionCatalogEntry } from "./masterCalibrationResolver.ts";
import { RepositoryDefinitionCatalog } from "./repositoryDefinitionCatalog.ts";

const observedAt = "2026-09-14T00:00:00.000Z";

function binary(name: string): EngineeringBinary {
  const resolved = resolveBinaryContainer({ bytes: fs.readFileSync(`BMW-XDFs-master/N54/${name}`), fileName: name });
  assert.equal(resolved.status, "resolved");
  return resolved.engineeringBinary!;
}

function connected(identity: string, engineeringBinary: EngineeringBinary): ConnectedRomObservation {
  const observation = defineEcuIdentityObservation({ sessionId: `resolver:${identity}`, endpointId: "resolver-test", protocol: "file-upload", observedDmeFamily: identity.length === 5 ? "N54" : "B58gen1", softwareIdentity: identity, calibrationIdentity: identity, vin: null, observedAt, capabilityObservations: [], qualification: "observed_unqualified", provenance: "Controlled resolver contract evidence" });
  return Object.freeze({ observation, trust: "qualified_supplied_evidence", ecuFamily: identity.length === 5 ? "MSD81" : "MG1", binary: Object.freeze({ digest: createHash("sha256").update(engineeringBinary.bytes).digest("hex"), byteLength: engineeringBinary.byteLength, container: engineeringBinary.source.containerType, markers: Object.freeze([]) }), provenance: Object.freeze(["Controlled resolver contract evidence"]), limitations: Object.freeze([]) });
}

function resolve(identity: string, engineeringBinary: EngineeringBinary, catalog: DefinitionCatalog = RepositoryDefinitionCatalog, sourceKind: "manual_upload" | "dme_read" = "manual_upload") {
  return resolveMasterCalibration({ current: Object.freeze({ engineeringBinary, sourceKind, ownerScope: "owner", vehicleScope: "vehicle", provenance: Object.freeze(["Controlled resolver input"]) }), connectedRom: connected(identity, engineeringBinary), catalog });
}

test("repository catalog preserves five prior relationships and exposes 63 bulk Current VIEW admissions", () => {
  const entries = RepositoryDefinitionCatalog.listEntries();
  assert.equal(entries.length, 68);
  for (const identity of ["00003076501103", "I8A0S", "IJE0S", "IKM0S", "INA0S"]) assert.ok(entries.some((entry) => entry.identity.romSoftwareIdentity === identity));
  assert.ok(entries.every((entry) => entry.lifecycleState === "active" && entry.sourceAuthorityState === "qualified" && entry.applicabilityState === "published"));
  assert.doesNotMatch(JSON.stringify(entries), /Development Evidence Preview|development_fixture|MapSwitch Dataset/);
});

test("exact N54 publication resolves and Workshop mode follows Reference capability", () => {
  const result = resolve("IJE0S", binary("IJE0S_original.bin"));
  assert.equal(result.outcome, "EXACT_QUALIFIED_MATCH");
  assert.equal(result.scope, "CALIBRATION_CAPABILITY_ONLY");
  assert.equal(result.catalogEntry?.identity.romSoftwareIdentity, "IJE0S");
  assert.equal(deriveWorkshopCapabilities(result.catalogEntry!).mode, "reference_comparison");
});

test("exact B58 publication resolves and capability derivation selects Current-only", () => {
  const bytes = Buffer.alloc(7_864_320), marker = Buffer.from("00003076501103", "hex");
  for (const offset of [262469, 6814977, 7863823]) marker.copy(bytes, offset);
  const resolved = resolveBinaryContainer({ bytes, fileName: "controlled.bin" });
  assert.equal(resolved.status, "resolved");
  const result = resolve("00003076501103", resolved.engineeringBinary!);
  assert.equal(result.outcome, "EXACT_QUALIFIED_MATCH");
  assert.equal(deriveWorkshopCapabilities(result.catalogEntry!).mode, "current_only");
});

test("recognized but unpublished and unknown ROMs fail closed", () => {
  const current = binary("IJE0S_original.bin");
  assert.equal(resolve("00005D5532E605", current).outcome, "ROM_RECOGNIZED_DEFINITION_MISSING");
  assert.equal(resolve("00003076501D02", current).outcome, "EXACT_QUALIFIED_MATCH");
  assert.equal(resolve("FUTURE-ROM", current).outcome, "ROM_UNKNOWN");
});

test("ambiguous and inactive catalog relationships cannot resolve", () => {
  const current = binary("IJE0S_original.bin"), base = RepositoryDefinitionCatalog.listEntries().find((entry) => entry.identity.romSoftwareIdentity === "IJE0S")!;
  const duplicate = Object.freeze({ ...base, catalogEntryId: "duplicate", coverageCandidate: Object.freeze({ ...base.coverageCandidate, candidateId: "duplicate" }) });
  const ambiguous: DefinitionCatalog = { catalogId: "ambiguous", listIdentities: RepositoryDefinitionCatalog.listIdentities, listEntries: () => [base, duplicate] };
  assert.equal(resolve("IJE0S", current, ambiguous).outcome, "AMBIGUOUS_MATCH");
  const superseded: DefinitionCatalogEntry = Object.freeze({ ...base, lifecycleState: "superseded" });
  const inactive: DefinitionCatalog = { catalogId: "inactive", listIdentities: RepositoryDefinitionCatalog.listIdentities, listEntries: () => [superseded] };
  assert.equal(resolve("IJE0S", current, inactive).outcome, "ROM_RECOGNIZED_DEFINITION_MISSING");
});

test("a future catalog can disclose an exact candidate without granting Workshop authority", () => {
  const current = binary("IJE0S_original.bin"), base = RepositoryDefinitionCatalog.listEntries().find((entry) => entry.identity.romSoftwareIdentity === "IJE0S")!;
  const candidate: DefinitionCatalogEntry = Object.freeze({ ...base, catalogEntryId: "acquired-candidate", sourceKind: "acquired", lifecycleState: "inactive", sourceAuthorityState: "candidate", applicabilityState: "candidate", coverageCandidate: Object.freeze({ ...base.coverageCandidate, candidateId: "acquired-candidate", coverageState: "candidate_only" }) });
  const acquired: DefinitionCatalog = { catalogId: "future-acquired-catalog", listIdentities: RepositoryDefinitionCatalog.listIdentities, listEntries: () => [candidate] };
  const result = resolve("IJE0S", current, acquired);
  assert.equal(result.outcome, "MATCH_REQUIRES_QUALIFICATION");
  assert.equal(result.catalogEntry, null);
  assert.equal(result.coverage.workshopEligible, false);
});

test("binary mismatch is invalid and a future DME adapter uses the same resolver interface", () => {
  const current = binary("IJE0S_original.bin"), other = binary("IKM0S_original.bin");
  const mismatch = resolveMasterCalibration({ current: { engineeringBinary: other, sourceKind: "dme_read", ownerScope: "owner", vehicleScope: "vehicle", provenance: ["Future read adapter"] }, connectedRom: connected("IJE0S", current), catalog: RepositoryDefinitionCatalog });
  assert.equal(mismatch.outcome, "INVALID_BINARY");
  assert.equal(resolve("IJE0S", current, RepositoryDefinitionCatalog, "dme_read").outcome, "EXACT_QUALIFIED_MATCH");
});

test("subscriber provider contains no platform or ROM-specific resolution branch", () => {
  const source = fs.readFileSync("lib/calibration-workshop/subscriberCalibrationProvider.ts", "utf8");
  assert.doesNotMatch(source, /\bN54\b|\bB58\b|IJE0S|00003076501103|Development Evidence Preview/);
});

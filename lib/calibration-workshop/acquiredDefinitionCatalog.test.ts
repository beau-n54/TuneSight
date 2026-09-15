import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import { defineEcuIdentityObservation } from "../vehicle-interface/nativeVehicleData.ts";
import { resolveBinaryContainer } from "../tunes/binaryContainer.ts";
import { createAcquiredDefinitionCatalog, composeDefinitionCatalogs } from "./acquiredDefinitionCatalog.ts";
import { resolveMasterCalibration, type CurrentCalibrationBinary, type DefinitionCatalogEntry } from "./masterCalibrationResolver.ts";
import { RepositoryDefinitionCatalog } from "./repositoryDefinitionCatalog.ts";

const base = () => RepositoryDefinitionCatalog.listEntries().find((entry) => entry.identity.romSoftwareIdentity === "IJE0S")!;
const current = () => { const result = resolveBinaryContainer({ bytes: fs.readFileSync("BMW-XDFs-master/N54/IJE0S_original.bin"), fileName: "current.bin" }); assert.equal(result.status, "resolved"); return result.engineeringBinary!; };
function resolve(catalog: ReturnType<typeof createAcquiredDefinitionCatalog> | ReturnType<typeof composeDefinitionCatalogs>) { const engineeringBinary = current(), digest = createHash("sha256").update(engineeringBinary.bytes).digest("hex"), observation = defineEcuIdentityObservation({ sessionId: "acquired-test", endpointId: "test", protocol: "file-upload", observedDmeFamily: "N54", softwareIdentity: "IJE0S", calibrationIdentity: "IJE0S", vin: null, observedAt: "2026-09-14T00:00:00.000Z", capabilityObservations: [], qualification: "observed_unqualified", provenance: "Acquired catalog test" }); return resolveMasterCalibration({ current: { engineeringBinary, sourceKind: "manual_upload", ownerScope: "owner", vehicleScope: "vehicle", provenance: ["test"] } satisfies CurrentCalibrationBinary, connectedRom: { observation, trust: "qualified_supplied_evidence", ecuFamily: "MSD81", binary: { digest, byteLength: engineeringBinary.byteLength, container: engineeringBinary.source.containerType, markers: [] }, provenance: ["test"], limitations: [] }, catalog }); }
function acquired(entry: DefinitionCatalogEntry, state: "candidate" | "active" | "inactive" | "superseded") { return createAcquiredDefinitionCatalog({ catalogId: `acquired-${state}`, identities: [entry.identity], descriptors: [{ entry, admissionState: state }] }); }

test("candidate, inactive and superseded acquired relationships never resolve", () => {
  const candidate: DefinitionCatalogEntry = { ...base(), lifecycleState: "inactive", sourceAuthorityState: "candidate", applicabilityState: "candidate", coverageCandidate: { ...base().coverageCandidate, coverageState: "candidate_only" } };
  assert.equal(resolve(acquired(candidate, "candidate")).outcome, "MATCH_REQUIRES_QUALIFICATION");
  assert.equal(resolve(acquired({ ...base(), lifecycleState: "inactive" }, "inactive")).outcome, "ROM_RECOGNIZED_DEFINITION_MISSING");
  assert.equal(resolve(acquired({ ...base(), lifecycleState: "superseded" }, "superseded")).outcome, "ROM_RECOGNIZED_DEFINITION_MISSING");
});

test("one active admitted acquired relationship resolves through the unchanged Master Resolver", () => assert.equal(resolve(acquired(base(), "active")).outcome, "EXACT_QUALIFIED_MATCH"));

test("composite catalogs ignore candidate shadows but fail closed for two active authorities", () => {
  const candidate: DefinitionCatalogEntry = { ...base(), lifecycleState: "inactive", sourceAuthorityState: "candidate", applicabilityState: "candidate", coverageCandidate: { ...base().coverageCandidate, candidateId: "candidate", coverageState: "candidate_only" } };
  assert.equal(resolve(composeDefinitionCatalogs("repository-plus-candidate", [RepositoryDefinitionCatalog, acquired(candidate, "candidate")])).outcome, "EXACT_QUALIFIED_MATCH");
  const second = { ...base(), catalogEntryId: "second-active", coverageCandidate: { ...base().coverageCandidate, candidateId: "second-active" } };
  assert.equal(resolve(composeDefinitionCatalogs("ambiguous", [RepositoryDefinitionCatalog, acquired(second, "active")])).outcome, "AMBIGUOUS_MATCH");
});

test("an identity admitted by the bulk VIEW catalogue remains active in the repository catalogue", () => {
  const identity = RepositoryDefinitionCatalog.listIdentities().find((item) => item.romSoftwareIdentity === "00005D553C8C05");
  assert.ok(identity); assert.equal(RepositoryDefinitionCatalog.listEntries().some((entry) => entry.identity.romSoftwareIdentity === identity.romSoftwareIdentity), true);
});

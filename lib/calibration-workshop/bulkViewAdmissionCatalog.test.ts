import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { deriveWorkshopCapabilities } from "./masterCalibrationResolver.ts";
import { BMW_BULK_VIEW_ADMISSION_MANIFEST, BulkViewAdmissionCatalog } from "./bulkViewAdmissionCatalog.ts";
import { RepositoryDefinitionCatalog } from "./repositoryDefinitionCatalog.ts";
import { loadSubscriberCalibration } from "./subscriberCalibrationProvider.ts";

test("one immutable manifest bulk-admits 60 exact Current VIEW relationships and rejects six explicitly", () => {
  assert.equal(BMW_BULK_VIEW_ADMISSION_MANIFEST.admitted.length, 60); assert.equal(BMW_BULK_VIEW_ADMISSION_MANIFEST.rejected.length, 6);
  assert.equal(BulkViewAdmissionCatalog.listEntries().length, 60); assert.equal(RepositoryDefinitionCatalog.listEntries().length, 65);
  assert.equal(new Set(RepositoryDefinitionCatalog.listEntries().map((entry) => entry.identity.romSoftwareIdentity)).size, 65);
  assert.ok(BulkViewAdmissionCatalog.listEntries().every((entry) => entry.referenceCapability.state === "reference_unavailable" && deriveWorkshopCapabilities(entry).mode === "current_only"));
  assert.doesNotMatch(JSON.stringify(BulkViewAdmissionCatalog.listEntries()), /EDIT_QUALIFIED|EXPORT_QUALIFIED|FLASH_QUALIFIED|Development Evidence Preview/);
});

test("Christos relationship is admitted by the generic catalog and materializes Current-only", { timeout: 180_000 }, async () => {
  const identity = "00005D553C8C05", entry = BulkViewAdmissionCatalog.listEntries().find((item) => item.identity.romSoftwareIdentity === identity);
  assert.ok(entry); assert.equal(entry.authority.definitionSet.definitionCount, 1242); assert.equal(deriveWorkshopCapabilities(entry).mode, "current_only");
  const fileName = `${identity}_original.bin`, bytes = fs.readFileSync(`BMW-XDFs-master/B58gen2/${identity}/${fileName}`);
  const result = await loadSubscriberCalibration({ bytes, fileName, mimeType: "application/octet-stream", observedAt: "2026-09-14T00:00:00.000Z" });
  assert.equal(result.status, "workshop_ready"); if (result.status === "workshop_ready") { assert.equal(result.identity, identity); assert.equal(result.material.reference, null); assert.ok("mode" in result.workshop); if ("mode" in result.workshop) assert.equal(result.workshop.mode, "current_only"); }
});

test("bulk admissions retain immutable source and Definition Set bindings", () => {
  for (const admission of BMW_BULK_VIEW_ADMISSION_MANIFEST.admitted) {
    const entry = BulkViewAdmissionCatalog.listEntries().find((item) => item.identity.romSoftwareIdentity === admission.romSoftwareIdentity)!;
    assert.equal(entry.coverageCandidate.sourceArtifactId, admission.sourceArtifactId); assert.equal(entry.coverageCandidate.definitionSetRevision, admission.definitionSetRevision);
    assert.equal(entry.authority.relationship.sourceArtifactDigest, admission.sourceArtifactDigest); assert.equal(entry.authority.relationship.definitionSetRevisionId, admission.definitionSetRevision);
  }
});

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createSourceBinaryLeaseRecord, resolveSourceBinaryLease, verifyExactSourceBinary } from "./sourceBinaryReconstructionLease.ts";
import { decodeSubscriberSession, encodeSubscriberSession } from "./subscriberCalibrationPersistence.ts";
import { loadSubscriberCalibration } from "./subscriberCalibrationProvider.ts";

test("production-shaped 7.86 MB B58 processing binds source lease and durable session", { timeout: 60_000 }, async () => {
  const ownerId = "controlled-owner", vehicleId = "controlled-vehicle";
  const bytes = fs.readFileSync("BMW-XDFs-master/B58gen1/00003076501103_MapSwitchBase.bin");
  assert.equal(bytes.byteLength, 7_864_320);
  const result = await loadSubscriberCalibration({ bytes, fileName: "subscriber.bin", mimeType: "application/octet-stream", observedAt: "2026-09-15T00:00:00.000Z" });
  assert.equal(result.status, "workshop_ready");
  if (result.status !== "workshop_ready") return;
  const current = result.material.current;
  const binding = Object.freeze({ currentCalibrationId: current.exactBinaryIdentity.identityId, currentCalibrationRevision: current.datasetRevision, currentDatasetId: current.datasetId, currentDatasetRevision: current.datasetRevision, romLayoutId: current.romLayoutId, relationshipRevision: current.relationshipRevision, exactBinaryDigest: result.digest, byteLength: result.byteLength, containerType: result.container as "bin" | "dtf" });
  assert.equal(verifyExactSourceBinary(bytes, binding), true);
  const stored = createSourceBinaryLeaseRecord({ ownerId, vehicleId, objectId: "opaque_source", leaseId: "opaque_lease", binding, createdAt: "2026-09-15T00:00:00.000Z" });
  assert.equal(resolveSourceBinaryLease(stored, { ownerId, vehicleId, expected: binding, now: Date.parse("2026-09-15T00:01:00.000Z") }).status, "resolved");
  assert.equal(resolveSourceBinaryLease(stored, { ownerId: "other-owner", vehicleId, expected: binding, now: 0 }).status, "unauthorized");
  assert.equal(resolveSourceBinaryLease(stored, { ownerId, vehicleId: "other-vehicle", expected: binding, now: 0 }).status, "unauthorized");
  const sessionResult = Object.freeze({ ...result, sourceLease: stored.receipt });
  const session = encodeSubscriberSession(ownerId, vehicleId, Date.parse("2026-09-15T00:30:00.000Z"), sessionResult);
  const recovered = decodeSubscriberSession(session, ownerId, vehicleId, Date.parse("2026-09-15T00:01:00.000Z"));
  assert.equal(recovered?.status, "workshop_ready");
  if (recovered?.status === "workshop_ready") assert.equal(recovered.sourceLease?.leaseRevision, stored.receipt.leaseRevision);
  assert.equal(decodeSubscriberSession(session, "other-owner", vehicleId, Date.parse("2026-09-15T00:01:00.000Z")), null);
});

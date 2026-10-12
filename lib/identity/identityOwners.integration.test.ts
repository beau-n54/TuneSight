import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { serialize } from "node:v8";
import test from "node:test";
import { loadSubscriberCalibration } from "../calibration-workshop/subscriberCalibrationProvider.ts";
import { decodeSubscriberSession } from "../calibration-workshop/subscriberCalibrationPersistence.ts";
import { calibrationSourceIdentity } from "./calibrationIdentity.ts";
import { identityOwners } from "./identityOwners.ts";
import { buildCalibrationIntelligenceFromTuneProfile } from "../intelligence/tuneProfileAdapter.ts";

const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const observedAt = "2026-10-12T00:00:00.000Z";
function b58() {
  const bytes = Buffer.alloc(7_864_320);
  for (const offset of [262469, 6814977, 7863823]) bytes.set(Buffer.from("00003076501103", "hex"), offset);
  return bytes;
}
function supra() {
  const bytes = Buffer.alloc(8_388_608, 255);
  for (const [offset, text] of [[0x2001a, "#DME_8XT0#C2#HWE#Hardware_DME8XT1_35UP"], [0x2020a, "#DME_86Tx#C2#HWA#DME8.6.T_B58TUE_V1"], [0x5fe1e, "#DME_86T0#C2#BTL#MDG1G_35up"], [0x6a0540, "56/1/MG1CS201/11/MG1CS201_BX8TUE"], [0x7ffe36, "#DME_86T0__________#C2#DST"]] as const) bytes.write(text, offset, "ascii");
  for (const offset of [524613, 7339265, 8388111]) bytes.set(Buffer.from("00005D553C8C05", "hex"), offset);
  bytes.set(Buffer.from("00005D553C7805", "hex"), 131371);
  return bytes;
}
for (const fixture of [
  { label: "N54", rom: "I8A0S", container: "bin", bytes: () => fs.readFileSync("BMW-XDFs-master/N54/I8A0S_original.bin"), comparison: true },
  { label: "B58 Gen 1", rom: "00003076501103", container: "bin", bytes: b58, comparison: false },
  { label: "B58 Gen 2", rom: "00005D553C8C05", container: "dtf", bytes: supra, comparison: false },
]) test(`R01 integration: ${fixture.label} exact source and legacy sessions preserve independent identities`, async () => {
  const bytes = fixture.bytes(), digest = sha(bytes);
  const result = await loadSubscriberCalibration({ bytes, fileName: `controlled.${fixture.container}`, mimeType: null, observedAt });
  assert.equal(result.status, "workshop_ready"); if (result.status !== "workshop_ready") return;
  const source = calibrationSourceIdentity(result);
  assert.equal(source.containerDigest, digest); assert.equal(source.exactSoftwareIdentity, fixture.rom);
  assert.equal(source.containerType, fixture.container); assert.equal(Boolean(result.material.reference), fixture.comparison);
  const before = serialize(result.material);
  const compact = Object.fromEntries(Object.entries(result).filter(([key]) => key !== "workshop" && key !== "containerDigest"));
  for (const version of [1, 2]) {
    const stored = serialize({ version, ownerId: "controlled-owner", vehicleId: "controlled-vehicle", expiresAt: Date.parse(observedAt) + 60000,
      result: version === 1 ? { ...compact, workshop: result.workshop } : compact });
    const originalStored = Buffer.from(stored);
    const restored = decodeSubscriberSession(stored, "controlled-owner", "controlled-vehicle", Date.parse(observedAt));
    assert.equal(restored?.status, "workshop_ready"); if (restored?.status !== "workshop_ready") return;
    const restoredSource = calibrationSourceIdentity(restored);
    const owners = identityOwners({ vehicle: { engine_code: fixture.label }, calibration: restoredSource });
    assert.equal(owners.savedVehicle.declaredEngineCode, fixture.label);
    assert.equal(owners.controller.observedDmeFamily.value, null); assert.equal(owners.controller.exactSoftwareIdentity.value, null);
    assert.equal(restoredSource.containerDigest, digest); assert.equal(restoredSource.datasetId, source.datasetId);
    assert.equal(restoredSource.datasetRevision, source.datasetRevision);
    assert.deepEqual(serialize(restored.material), before); assert.deepEqual(stored, originalStored);
    assert.equal(restored.material.current.exactBinaryIdentity.softwareIdentity, fixture.rom);
  }
  assert.deepEqual(serialize(result.material), before); assert.equal(sha(bytes), digest);
});
test("R01: legacy file-profile candidates cannot populate another identity authority", () => {
  const result = buildCalibrationIntelligenceFromTuneProfile({ detected_platform: "N54", detected_rom: "I8A0S", ecu_family: "MSD81" });
  assert.equal(result.platform, "N54"); assert.equal(result.engine, "unknown");
  assert.equal(result.romFamily, "unknown"); assert.equal(result.romFingerprint, "unknown");
});

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const storage = fs.readFileSync(new URL("./vehicleCalibrationRoleStorage.ts", import.meta.url), "utf8");
const materialization = fs.readFileSync(new URL("./vehicleOwnedTuneMaterialization.server.ts", import.meta.url), "utf8");
const readOnly = fs.readFileSync(new URL("./vehicleOwnedTuneRead.server.ts", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../../app/api/vehicles/calibration-role/route.ts", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../../app/dashboard/vehicles/[id]/calibration/page.tsx", import.meta.url), "utf8");
const tune = fs.readFileSync(new URL("../../app/dashboard/vehicles/[id]/tune/subscriber-page-client.tsx", import.meta.url), "utf8");

test("vehicle-level roles are private, opaque, explicit, owner-and-vehicle scoped", () => {
  assert.match(storage, /createHmac\("sha256"/);
  assert.match(storage, /ownerId.*vehicleId.*role/);
  assert.match(storage, /explicit_user_assignment/);
  assert.match(storage, /privateOnly: true/);
  assert.doesNotMatch(storage, /getPublicUrl|createSignedUrl|console\./);
});

test("existing Tune Current designation reuses private bytes through the governed materializer", () => {
  assert.match(readOnly, /from\("tunes"\).*download/);
  assert.match(readOnly, /loadSubscriberCalibration/);
  assert.match(materialization, /readVehicleOwnedTune\(input\)/);
  assert.match(materialization, /createSubscriberWorkshopSession/);
  assert.match(readOnly, /eq\("vehicle_id", input\.vehicleId\)[\s\S]*eq\("user_id", input\.ownerId\)/);
  assert.match(readOnly, /data\.is_stock_reference/);
  assert.doesNotMatch(materialization + readOnly, /file_url|getPublicUrl|createSignedUrl/);
  assert.doesNotMatch(readOnly, /createSubscriberWorkshopSession|\.upload\(|\.insert\(|\.delete\(|\.upsert\(/);
  assert.equal((readOnly.match(/\.update\(/g) ?? []).length, 1, "Only the SHA-256 digest accumulator uses update");
  assert.match(readOnly, /createHash\("sha256"\)\.update\(container\.engineeringBinary\.bytes\)/);
});

test("Current assignment is explicit and contains no newest-file or filename heuristic", () => {
  assert.match(route, /body\?\.role !== "current"/);
  assert.match(route, /assignVehicleCalibrationRole/);
  assert.match(tune, /Set as Current Calibration/);
  for (const source of [route, materialization, storage]) assert.doesNotMatch(source, /created_at|order\(|file_name.*includes|tune_name.*includes/i);
});

test("Calibration GET reads the scoped session; persistent role recovery requires the explicit leased POST", () => {
  const session = page.indexOf("readLatestSubscriberWorkshopSession");
  const empty = page.indexOf('entry.mode === "empty"');
  assert.ok(session >= 0 && empty > session);
  assert.doesNotMatch(page, /recoverVehicleOwnedTuneCalibration|createSubscriberWorkshopSession/);
  assert.match(page, /recoverVehicle: async \(\) => null/);
  assert.match(route, /body\?\.action === "repair_session"/);
  assert.match(route, /claim_calibration_repair_v1[\s\S]*readLatestSubscriberWorkshopSession[\s\S]*recoverVehicleOwnedTuneCalibration/);
  assert.match(route, /finally[\s\S]*release_calibration_repair_v1/);
  assert.match(page, /resolveVehicleOwnedCalibrationEvidence\(\{ ownerId: user\.id, vehicleId: vehicle\.id, result: subscriberResult \}/);
});

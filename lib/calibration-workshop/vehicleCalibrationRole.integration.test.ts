import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const storage = fs.readFileSync(new URL("./vehicleCalibrationRoleStorage.ts", import.meta.url), "utf8");
const materialization = fs.readFileSync(new URL("./vehicleOwnedTuneMaterialization.server.ts", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../../app/api/vehicles/calibration-role/route.ts", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../../app/dashboard/vehicles/[id]/calibration/page.tsx", import.meta.url), "utf8");
const tune = fs.readFileSync(new URL("../../app/dashboard/vehicles/[id]/tune/page.tsx", import.meta.url), "utf8");

test("vehicle-level roles are private, opaque, explicit, owner-and-vehicle scoped", () => {
  assert.match(storage, /createHmac\("sha256"/);
  assert.match(storage, /ownerId.*vehicleId.*role/);
  assert.match(storage, /explicit_user_assignment/);
  assert.match(storage, /privateOnly: true/);
  assert.doesNotMatch(storage, /getPublicUrl|createSignedUrl|console\./);
});

test("existing Tune Current designation reuses private bytes through the governed materializer", () => {
  assert.match(materialization, /from\("tunes"\).*download/);
  assert.match(materialization, /loadSubscriberCalibration/);
  assert.match(materialization, /createSubscriberWorkshopSession/);
  assert.match(materialization, /eq\("vehicle_id", input\.vehicleId\)[\s\S]*eq\("user_id", input\.ownerId\)/);
  assert.match(materialization, /data\.is_stock_reference/);
  assert.doesNotMatch(materialization, /file_url|getPublicUrl|createSignedUrl/);
});

test("Current assignment is explicit and contains no newest-file or filename heuristic", () => {
  assert.match(route, /body\?\.role !== "current"/);
  assert.match(route, /assignVehicleCalibrationRole/);
  assert.match(tune, /Set as Current Calibration/);
  for (const source of [route, materialization, storage]) assert.doesNotMatch(source, /created_at|order\(|file_name.*includes|tune_name.*includes/i);
});

test("Calibration entry uses session first, then vehicle role recovery, then neutral state", () => {
  const session = page.indexOf("readLatestSubscriberWorkshopSession");
  const role = page.indexOf("recoverVehicleOwnedTuneCalibration");
  const empty = page.indexOf('entry.mode === "empty"');
  assert.ok(session >= 0 && role > session && empty > role);
  assert.match(page, /!subscriberSession && !subscriberResult/);
});

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("production upload bypasses the Function body and keeps raw and session namespaces separate", () => {
  const route = fs.readFileSync(path.resolve("app/api/calibration-workshop/upload/route.ts"), "utf8");
  const client = fs.readFileSync(path.resolve("app/dashboard/vehicles/[id]/calibration/upload-calibration.tsx"), "utf8");
  const storage = fs.readFileSync(path.resolve("lib/calibration-workshop/subscriberCalibrationStorage.ts"), "utf8");
  assert.match(client, /uploadToSignedUrl/);
  assert.match(client, /action: "prepare"/);
  assert.match(client, /action: "process"/);
  assert.doesNotMatch(route, /formData\(/);
  assert.match(storage, /RAW_PREFIX = "raw", SESSION_PREFIX = "sessions"/);
  assert.match(route, /finally[\s\S]*upload\.cleanup/);
});

test("the controlled bucket migration enforces private storage", () => {
  const migration = fs.readFileSync(path.resolve("supabase/migrations/20260913_add_private_subscriber_calibration_storage.sql"), "utf8");
  assert.match(migration, /subscriber-calibration-private/);
  assert.match(migration, /false/);
  assert.doesNotMatch(migration, /create policy|publicUrl/i);
});

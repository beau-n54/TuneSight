import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const wrapper = fs.readFileSync("lib/calibration-workshop/supabaseAcquiredDefinitionPersistence.ts", "utf8");
const core = fs.readFileSync("lib/calibration-workshop/supabaseAcquiredDefinitionPersistenceCore.ts", "utf8");
const source = `${wrapper}\n${core}`;

test("production adapter is server-only and uses the private acquired bucket", () => {
  assert.match(source, /^import "server-only"/); assert.match(source, /acquired-xdf-private/); assert.match(source, /createTrustedServerClient/);
  assert.doesNotMatch(source, /createSigned|publicUrl|NEXT_PUBLIC|console\./);
});

test("production adapter validates opaque raw keys and persists source and receipt separately", () => {
  assert.match(source, /\^acquired-xdf\\\/raw/); assert.match(source, /upsert: false/); assert.match(source, /acquired_xdf_source_artifacts/); assert.match(source, /acquired_xdf_contribution_receipts/);
  assert.doesNotMatch(source, /fileName|ownerId.*objectKey|vin/i);
});

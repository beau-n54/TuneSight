import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync("supabase/migrations/20260914_add_private_acquired_xdf_library.sql", "utf8");

test("acquired XDF migration creates one private bounded bucket without public object policy", () => {
  assert.match(migration, /'acquired-xdf-private'[\s\S]*false[\s\S]*4194304/i);
  assert.doesNotMatch(migration, /storage\.objects|publicUrl|signedUrl/i);
  assert.doesNotMatch(migration, /update\s+storage\.buckets|delete\s+from\s+storage\.buckets/i);
});

test("authority metadata is service-role-only while owner audit linkage is isolated", () => {
  assert.match(migration, /enable row level security/gi);
  assert.match(migration, /revoke all on public\.acquired_xdf_source_artifacts[\s\S]*from anon, authenticated/i);
  assert.match(migration, /grant all on public\.acquired_xdf_source_artifacts[\s\S]*to service_role/i);
  assert.match(migration, /owner_id = auth\.uid\(\)/i);
  assert.match(migration, /drop policy if exists acquired_xdf_receipts_owner_select/i);
});

test("migration retains immutable source, Definition, validation and governance bindings", () => {
  for (const field of ["source_digest", "storage_object_id", "definition_set_revision", "validation", "source_authority_state", "applicability_state", "admission_state", "supersedes_id"]) assert.match(migration, new RegExp(field));
  assert.doesNotMatch(migration, /on delete cascade/i);
});

import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { persistAcquiredXdfContribution } from "../lib/calibration-workshop/acquiredDefinitionLibrary.ts";
import { ACQUIRED_XDF_BUCKET, createSupabaseAcquiredDefinitionPersistenceCore } from "../lib/calibration-workshop/supabaseAcquiredDefinitionPersistenceCore.ts";
import { resolveTrustedServerConfiguration } from "../lib/supabase/trustedServerConfiguration.ts";

const configuration = resolveTrustedServerConfiguration(process.env);
const service = createClient(configuration.supabaseUrl, configuration.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
if (!anonKey) throw new Error("Production verification requires the public anonymous key.");

const buckets = await service.storage.listBuckets();
if (buckets.error) throw new Error("Acquired XDF bucket verification failed.");
const bucket = buckets.data.find((item) => item.id === ACQUIRED_XDF_BUCKET);
assert.ok(bucket, "Private acquired XDF bucket is absent.");
assert.equal(bucket.public, false); assert.equal(bucket.file_size_limit, 4 * 1024 * 1024);

for (const table of ["acquired_xdf_source_artifacts", "acquired_xdf_candidate_relationships", "acquired_xdf_contribution_receipts"]) {
  const result = await service.from(table).select("id", { head: true, count: "exact" });
  if (result.error) throw new Error(`Acquired XDF table verification failed: ${table}`);
}
const anonymous = createClient(configuration.supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const anonymousAuthority = await anonymous.from("acquired_xdf_source_artifacts").select("id").limit(1);
assert.ok(anonymousAuthority.error || anonymousAuthority.data.length === 0, "Anonymous client unexpectedly read acquired authority metadata.");

const users = await service.auth.admin.listUsers({ page: 1, perPage: 1 });
if (users.error || !users.data.users[0]) throw new Error("No production owner is available for the scoped contribution receipt proof.");
const ownerId = users.data.users[0].id;
const xml = (title: string) => new TextEncoder().encode(`<XDFFORMAT version="1.70"><XDFHEADER><DEFAULTS datasizeinbits="8" signed="0" float="0"/></XDFHEADER><XDFTABLE><TITLE>${title}</TITLE><XDFAXIS id="z"><EMBEDDEDDATA mmedaddress="1" mmedelementsizebits="8" mmedrowcount="1" mmedcolcount="1"/></XDFAXIS></XDFTABLE></XDFFORMAT>`);
const contribution = { bytes: xml("TuneSight production persistence proof A"), ownerId, contributedAt: new Date().toISOString() };
const first = await persistAcquiredXdfContribution({ ...contribution, ...createSupabaseAcquiredDefinitionPersistenceCore(service) });
const reloaded = await createSupabaseAcquiredDefinitionPersistenceCore(service).metadataStore.findSourceByDigest(first.source.sourceDigest);
assert.ok(reloaded); assert.equal(reloaded.sourceRecordId, first.source.sourceRecordId); assert.equal(reloaded.definitionSetRevision, first.source.definitionSetRevision);
const duplicate = await persistAcquiredXdfContribution({ ...contribution, contributedAt: new Date().toISOString(), ...createSupabaseAcquiredDefinitionPersistenceCore(service) });
assert.equal(duplicate.duplicate, true); assert.equal(duplicate.source.sourceRecordId, first.source.sourceRecordId); assert.notEqual(duplicate.receipt.receiptId, first.receipt.receiptId);
const changed = await persistAcquiredXdfContribution({ bytes: xml("TuneSight production persistence proof B"), ownerId, contributedAt: new Date().toISOString(), ...createSupabaseAcquiredDefinitionPersistenceCore(service) });
assert.equal(changed.duplicate, false); assert.notEqual(changed.source.sourceRecordId, first.source.sourceRecordId); assert.notEqual(changed.source.definitionSetRevision, first.source.definitionSetRevision);

const objects = await service.storage.from(ACQUIRED_XDF_BUCKET).list("acquired-xdf/raw", { limit: 100 });
if (objects.error) throw new Error("Private acquired object reload verification failed.");
assert.ok(objects.data.some((item) => item.name === first.source.storageObjectId)); assert.ok(objects.data.some((item) => item.name === changed.source.storageObjectId));
console.log(JSON.stringify({ status: "verified", project: "production", bucketPrivate: true, maximumBytes: bucket.file_size_limit, tables: 3, anonymousAuthorityReadable: false, firstPersisted: true, crossInvocationReload: true, exactByteDeduplicated: true, separateReceipts: true, changedByteRevision: true, rawObjectsCreated: 2 }));

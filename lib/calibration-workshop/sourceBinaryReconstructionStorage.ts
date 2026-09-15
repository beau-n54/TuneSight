import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { deserialize, serialize } from "node:v8";
import { createTrustedServerClient } from "@/lib/supabase/trustedServer";
import { resolveTrustedServerConfiguration } from "@/lib/supabase/trustedServerConfiguration";
import { SUBSCRIBER_CALIBRATION_BUCKET } from "./subscriberCalibrationStorage";
import { createSourceBinaryLeaseRecord, resolveSourceBinaryLease, SOURCE_BINARY_RECONSTRUCTION_TTL_MS, verifyExactSourceBinary, type SourceBinaryBinding, type StoredSourceBinaryLease } from "./sourceBinaryReconstructionLease";

const SOURCE_PREFIX = "sources", LEASE_PREFIX = "source-leases", ACTIVE_PREFIX = "source-active";
const opaque = () => randomBytes(24).toString("base64url");
const sourcePath = (id: string) => `${SOURCE_PREFIX}/${id}`, leasePath = (id: string) => `${LEASE_PREFIX}/${id}`;
const activeId = (ownerId: string, vehicleId: string) => createHmac("sha256", resolveTrustedServerConfiguration(process.env).serviceRoleKey).update(`${ownerId}\0${vehicleId}`).digest("base64url");
const activePath = (ownerId: string, vehicleId: string) => `${ACTIVE_PREFIX}/${activeId(ownerId, vehicleId)}`;
const storage = () => createTrustedServerClient().storage.from(SUBSCRIBER_CALIBRATION_BUCKET);

async function readRecord(leaseId: string): Promise<StoredSourceBinaryLease | null> { const { data, error } = await storage().download(leasePath(leaseId)); if (error || !data) return null; try { return deserialize(new Uint8Array(await data.arrayBuffer())) as StoredSourceBinaryLease; } catch { return null; } }
async function removeLease(leaseId: string) { const record = await readRecord(leaseId); const paths = [leasePath(leaseId), ...(record ? [sourcePath(record.objectId)] : [])]; const { error } = await storage().remove(paths); if (error) throw new Error("SOURCE_BINARY_DELETE_FAILED"); }
export async function revokeSourceBinaryReconstructionLease(leaseId: string) { if (/^[A-Za-z0-9_-]{32}$/.test(leaseId)) await removeLease(leaseId); }
async function priorLeaseId(ownerId: string, vehicleId: string): Promise<string | null> { const { data, error } = await storage().download(activePath(ownerId, vehicleId)); if (error || !data) return null; const value = (await data.text()).trim(); return /^[A-Za-z0-9_-]{32}$/.test(value) ? value : null; }

export async function persistSourceBinaryReconstructionLease(input: Readonly<{ ownerId: string; vehicleId: string; bytes: Uint8Array; binding: SourceBinaryBinding; now?: Date }>) {
  if (!verifyExactSourceBinary(input.bytes, input.binding)) throw new Error("SOURCE_BINARY_BINDING_MISMATCH");
  await cleanupExpiredSourceBinaryLeases((input.now ?? new Date()).getTime());
  const objectId = opaque(), leaseId = opaque(), record = createSourceBinaryLeaseRecord({ ownerId: input.ownerId, vehicleId: input.vehicleId, objectId, leaseId, binding: input.binding, createdAt: (input.now ?? new Date()).toISOString() }), bucket = storage(), previous = await priorLeaseId(input.ownerId, input.vehicleId);
  const source = await bucket.upload(sourcePath(objectId), input.bytes, { contentType: "application/octet-stream", cacheControl: "0", upsert: false }); if (source.error) throw new Error("SOURCE_BINARY_WRITE_FAILED");
  const metadata = await bucket.upload(leasePath(leaseId), serialize(record), { contentType: "application/octet-stream", cacheControl: "0", upsert: false }); if (metadata.error) { await bucket.remove([sourcePath(objectId)]); throw new Error("SOURCE_BINARY_LEASE_WRITE_FAILED"); }
  const pointer = await bucket.upload(activePath(input.ownerId, input.vehicleId), leaseId, { contentType: "text/plain", cacheControl: "0", upsert: true }); if (pointer.error) { await bucket.remove([sourcePath(objectId), leasePath(leaseId)]); throw new Error("SOURCE_BINARY_POINTER_WRITE_FAILED"); }
  if (previous && previous !== leaseId) await removeLease(previous);
  return record.receipt;
}

export async function retrieveSourceBinaryReconstructionLease(input: Readonly<{ leaseId: string; ownerId: string; vehicleId: string; expected: SourceBinaryBinding; now?: number }>) {
  const record = await readRecord(input.leaseId); if (!record) return Object.freeze({ status: "unavailable" as const });
  const resolved = resolveSourceBinaryLease(record, input); if (resolved.status !== "resolved") { if (resolved.status === "expired") await removeLease(input.leaseId); return resolved; }
  const { data, error } = await storage().download(sourcePath(resolved.objectId)); if (error || !data) return Object.freeze({ status: "unavailable" as const }); const bytes = new Uint8Array(await data.arrayBuffer());
  if (!verifyExactSourceBinary(bytes, input.expected)) return Object.freeze({ status: "binding_mismatch" as const });
  return Object.freeze({ status: "resolved" as const, receipt: resolved.receipt, bytes });
}

export async function rebindExactSourceBinary(input: Readonly<{ ownerId: string; vehicleId: string; bytes: Uint8Array; expected: SourceBinaryBinding }>) { if (!verifyExactSourceBinary(input.bytes, input.expected)) return Object.freeze({ status: "binding_mismatch" as const }); return Object.freeze({ status: "rebound" as const, receipt: await persistSourceBinaryReconstructionLease({ ...input, binding: input.expected }) }); }

export async function cleanupExpiredSourceBinaryLeases(now = Date.now()) { const bucket = storage(), { data } = await bucket.list(LEASE_PREFIX, { limit: 24, sortBy: { column: "created_at", order: "asc" } }); if (!data) return 0; let removed = 0; for (const item of data) { const record = await readRecord(item.name); if (record && Date.parse(record.receipt.expiresAt) <= now) { await removeLease(item.name); removed++; } } return removed; }

export const SOURCE_BINARY_STORAGE_ARCHITECTURE = Object.freeze({ bucket: SUBSCRIBER_CALIBRATION_BUCKET, privateOnly: true, serverOnly: true, publicUrls: false, sourcePrefix: SOURCE_PREFIX, leasePrefix: LEASE_PREFIX, activePointerPrefix: ACTIVE_PREFIX, ttlMs: SOURCE_BINARY_RECONSTRUCTION_TTL_MS, objectKeys: "opaque_non_identifying", rawBytesLogged: false, digestLogged: false });

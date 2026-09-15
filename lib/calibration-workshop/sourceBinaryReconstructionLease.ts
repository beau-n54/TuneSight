import { createHash } from "node:crypto";

export const SOURCE_BINARY_RECONSTRUCTION_LEASE_CONTRACT = "tunesight.source-binary-reconstruction-lease.v1" as const;
export const SOURCE_BINARY_RECONSTRUCTION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type SourceBinaryBinding = Readonly<{ currentCalibrationId: string; currentCalibrationRevision: string; currentDatasetId: string; currentDatasetRevision: string; romLayoutId: string; relationshipRevision: string; exactBinaryDigest: string; byteLength: number; containerType: "bin" | "dtf" }>;
export type SourceBinaryLeaseReceipt = SourceBinaryBinding & Readonly<{ contractVersion: typeof SOURCE_BINARY_RECONSTRUCTION_LEASE_CONTRACT; leaseId: string; leaseRevision: string; createdAt: string; expiresAt: string; state: "active" }>;
export type StoredSourceBinaryLease = Readonly<{ version: 1; ownerId: string; vehicleId: string; objectId: string; receipt: SourceBinaryLeaseReceipt }>;

const canonical = (value: unknown): string => { if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value); if (typeof value === "number") { if (!Number.isFinite(value)) throw new Error("Lease identity requires finite numbers."); return JSON.stringify(value); } if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`; if (!value || typeof value !== "object") throw new Error("Lease identity contains unsupported material."); const record = value as Record<string, unknown>; return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`; };
const hash = (domain: string, value: unknown) => createHash("sha256").update(domain).update(Buffer.from([0])).update(canonical(value)).digest("hex");
const populated = (binding: SourceBinaryBinding) => [binding.currentCalibrationId, binding.currentCalibrationRevision, binding.currentDatasetId, binding.currentDatasetRevision, binding.romLayoutId, binding.relationshipRevision, binding.exactBinaryDigest].every((value) => value.trim()) && Number.isSafeInteger(binding.byteLength) && binding.byteLength > 0;

export function createSourceBinaryLeaseRecord(input: Readonly<{ ownerId: string; vehicleId: string; objectId: string; leaseId: string; binding: SourceBinaryBinding; createdAt: string; ttlMs?: number }>): StoredSourceBinaryLease {
  const ttl = input.ttlMs ?? SOURCE_BINARY_RECONSTRUCTION_TTL_MS, created = Date.parse(input.createdAt);
  if (![input.ownerId, input.vehicleId, input.objectId, input.leaseId].every((value) => /^[A-Za-z0-9_:-]+$/.test(value)) || !populated(input.binding) || !Number.isFinite(created) || !Number.isSafeInteger(ttl) || ttl <= 0) throw new Error("Source Binary lease input is invalid.");
  const expiresAt = new Date(created + ttl).toISOString(), identity = { leaseId: input.leaseId, ownerId: input.ownerId, vehicleId: input.vehicleId, objectId: input.objectId, binding: input.binding }, material = { ...identity, createdAt: input.createdAt, expiresAt };
  const receipt = Object.freeze({ contractVersion: SOURCE_BINARY_RECONSTRUCTION_LEASE_CONTRACT, leaseId: input.leaseId, leaseRevision: `source-binary-lease-revision:${hash("tunesight.source-binary-reconstruction-lease-revision.v1", material)}`, ...input.binding, createdAt: input.createdAt, expiresAt, state: "active" as const });
  return Object.freeze({ version: 1 as const, ownerId: input.ownerId, vehicleId: input.vehicleId, objectId: input.objectId, receipt });
}

export function resolveSourceBinaryLease(record: StoredSourceBinaryLease, input: Readonly<{ ownerId: string; vehicleId: string; expected: SourceBinaryBinding; now?: number }>): Readonly<{ status: "resolved"; receipt: SourceBinaryLeaseReceipt; objectId: string }> | Readonly<{ status: "expired" | "binding_mismatch" | "unauthorized" }> {
  if (record.ownerId !== input.ownerId || record.vehicleId !== input.vehicleId) return Object.freeze({ status: "unauthorized" });
  if (Date.parse(record.receipt.expiresAt) <= (input.now ?? Date.now())) return Object.freeze({ status: "expired" });
  const actual = record.receipt, expected = input.expected;
  if (actual.currentCalibrationId !== expected.currentCalibrationId || actual.currentCalibrationRevision !== expected.currentCalibrationRevision || actual.currentDatasetId !== expected.currentDatasetId || actual.currentDatasetRevision !== expected.currentDatasetRevision || actual.romLayoutId !== expected.romLayoutId || actual.relationshipRevision !== expected.relationshipRevision || actual.exactBinaryDigest !== expected.exactBinaryDigest || actual.byteLength !== expected.byteLength || actual.containerType !== expected.containerType) return Object.freeze({ status: "binding_mismatch" });
  return Object.freeze({ status: "resolved", receipt: actual, objectId: record.objectId });
}

export function verifyExactSourceBinary(bytes: Uint8Array, binding: SourceBinaryBinding): boolean { return bytes.byteLength === binding.byteLength && createHash("sha256").update(bytes).digest("hex") === binding.exactBinaryDigest; }

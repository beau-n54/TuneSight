import { createHmac, timingSafeEqual } from "node:crypto";
import { deserialize, serialize } from "node:v8";
import { buildSubscriberWorkshop, type SubscriberCalibrationResult, type SubscriberCalibrationSuccess } from "./subscriberCalibrationProvider.ts";

export type ContainerExtension = "bin" | "dtf";
type CompactSubscriberSuccess = Omit<SubscriberCalibrationSuccess, "workshop">;
type StoredSessionV1 = { version: 1; ownerId: string; vehicleId: string; expiresAt: number; result: SubscriberCalibrationResult };
type StoredSessionV2 = { version: 2; ownerId: string; vehicleId: string; expiresAt: number; result: Exclude<SubscriberCalibrationResult, SubscriberCalibrationSuccess> | CompactSubscriberSuccess };
type StoredSession = StoredSessionV1 | StoredSessionV2;
const sign = (value: string, secret: string) => createHmac("sha256", secret).update(value).digest("base64url");
const equal = (left: string, right: string) => { const a = Buffer.from(left), b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); };

export function issueUploadLease(id: string, expiresAt: number, extension: ContainerExtension, ownerId: string, vehicleId: string, secret: string): string {
  const fields = `${id}.${expiresAt}.${extension}`;
  return `${fields}.${sign(`${fields}.${ownerId}.${vehicleId}`, secret)}`;
}
export function resolveUploadLease(lease: string, ownerId: string, vehicleId: string, secret: string, now = Date.now()): { id: string; extension: ContainerExtension } | null {
  const match = /^([A-Za-z0-9_-]{32})\.(\d{13})\.(bin|dtf)\.([A-Za-z0-9_-]{43})$/.exec(lease);
  if (!match || Number(match[2]) <= now) return null;
  const expected = sign(`${match[1]}.${match[2]}.${match[3]}.${ownerId}.${vehicleId}`, secret);
  return equal(match[4], expected) ? { id: match[1], extension: match[3] as ContainerExtension } : null;
}
export function expiredObjectPaths(objects: readonly { name: string; created_at?: string | null }[], now: number, ttlMs: number, prefix: string, limit = 24): string[] {
  return objects.filter((item) => { const created = Date.parse(item.created_at ?? ""); return item.name && Number.isFinite(created) && created + ttlMs <= now; }).slice(0, limit).map((item) => `${prefix}/${item.name}`);
}
export function encodeSubscriberSession(ownerId: string, vehicleId: string, expiresAt: number, result: SubscriberCalibrationResult): Uint8Array {
  const compactResult = result.status === "workshop_ready" ? Object.fromEntries(Object.entries(result).filter(([key]) => key !== "workshop")) as CompactSubscriberSuccess : result;
  return serialize({ version: 2, ownerId, vehicleId, expiresAt, result: compactResult } satisfies StoredSessionV2);
}
export function decodeSubscriberSession(bytes: Uint8Array, ownerId: string, vehicleId: string, now = Date.now()): SubscriberCalibrationResult | null {
  try { const entry = deserialize(bytes) as StoredSession; if ((entry.version !== 1 && entry.version !== 2) || entry.expiresAt <= now || entry.ownerId !== ownerId || entry.vehicleId !== vehicleId) return null; if (entry.version === 1) return entry.result; if (entry.result.status !== "workshop_ready") return entry.result; return Object.freeze({ ...entry.result, workshop: buildSubscriberWorkshop(entry.result) }); }
  catch { return null; }
}

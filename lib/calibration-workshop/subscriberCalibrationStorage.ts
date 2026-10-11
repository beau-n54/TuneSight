import "server-only";
import { randomBytes } from "node:crypto";
import { createTrustedServerClient } from "@/lib/supabase/trustedServer";
import { resolveTrustedServerConfiguration } from "@/lib/supabase/trustedServerConfiguration";
import type { SubscriberCalibrationResult } from "./subscriberCalibrationProvider";
import { isSubscriberWorkshopSessionId } from "./subscriberUploadNavigation";
import { decodeSubscriberSession, inspectSubscriberSession, encodeSubscriberSession, expiredObjectPaths, issueUploadLease, resolveUploadLease, type ContainerExtension } from "./subscriberCalibrationPersistence";
import { activeSubscriberSessionObjectPath } from "./subscriberSessionPointer";
import { registerPrivateObjects } from "../security/privateObjectInventory.server";

export const SUBSCRIBER_CALIBRATION_BUCKET = "subscriber-calibration-private";
const BUCKET = SUBSCRIBER_CALIBRATION_BUCKET, RAW_PREFIX = "raw", SESSION_PREFIX = "sessions", CLEANUP_LIMIT = 24;
export const RAW_UPLOAD_TTL_MS = 2 * 60 * 60 * 1000;
// Derived governed Dataset evidence outlives the independently bounded raw-source
// reconstruction lease. Losing source bytes disables reconstruction, not VIEW.
export const SUBSCRIBER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const opaqueId = () => randomBytes(24).toString("base64url");
const rawPath = (id: string) => `${RAW_PREFIX}/${id}`;
const sessionPath = (id: string) => `${SESSION_PREFIX}/${id}`;
const activeSessionPath = (ownerId: string, vehicleId: string) => activeSubscriberSessionObjectPath(ownerId, vehicleId, resolveTrustedServerConfiguration(process.env).serviceRoleKey);
async function readActiveSessionId(ownerId: string, vehicleId: string): Promise<string | null> {
  const { data, error } = await createTrustedServerClient().storage.from(BUCKET).download(activeSessionPath(ownerId, vehicleId));
  if (error) {
    if (String(error.statusCode) === "404" || error.message === "Object not found") return null;
    throw new Error("SUBSCRIBER_POINTER_TEMPORARILY_UNAVAILABLE");
  }
  if (!data) return null;
  const id = (await data.text()).trim();
  return isSubscriberWorkshopSessionId(id) ? id : null;
}
export async function cleanupSubscriberPrefix(prefix: "raw" | "sessions", ttlMs: number, now = Date.now()) {
  const storage = createTrustedServerClient().storage.from(BUCKET);
  const { data, error } = await storage.list(prefix, { limit: CLEANUP_LIMIT, sortBy: { column: "created_at", order: "asc" } });
  if (error || !data) return;
  const paths = expiredObjectPaths(data, now, ttlMs, prefix);
  if (paths.length) await storage.remove(paths);
}
export async function prepareSubscriberCalibrationUpload(ownerId: string, vehicleId: string, extension: ContainerExtension) {
  const id = opaqueId(), expiresAt = Date.now() + RAW_UPLOAD_TTL_MS, path = rawPath(id);
  await registerPrivateObjects(ownerId, vehicleId, [path], expiresAt);
  const { data, error } = await createTrustedServerClient().storage.from(BUCKET).createSignedUploadUrl(path, { upsert: false });
  if (error || !data) throw new Error("PRIVATE_UPLOAD_PREPARATION_FAILED");
  return Object.freeze({ uploadId: id, uploadPath: path, uploadToken: data.token, lease: issueUploadLease(id, expiresAt, extension, ownerId, vehicleId, resolveTrustedServerConfiguration(process.env).serviceRoleKey) });
}
export async function consumeSubscriberCalibrationUpload(lease: string, ownerId: string, vehicleId: string): Promise<{ bytes: Uint8Array; fileName: string; mimeType: string | null; cleanup: () => Promise<void> }> {
  const resolved = resolveUploadLease(lease, ownerId, vehicleId, resolveTrustedServerConfiguration(process.env).serviceRoleKey);
  if (!resolved) throw new Error("PRIVATE_UPLOAD_LEASE_INVALID");
  const storage = createTrustedServerClient().storage.from(BUCKET), path = rawPath(resolved.id);
  const info = await storage.info(path);
  if (info.error || !info.data || typeof info.data.size !== "number" || !Number.isSafeInteger(info.data.size) || info.data.size <= 0 || info.data.size > 32 * 1024 * 1024) throw new Error("PRIVATE_UPLOAD_SIZE_INVALID");
  const { data, error } = await storage.download(path);
  if (error || !data) throw new Error("PRIVATE_UPLOAD_READ_FAILED");
  let cleaned = false;
  return { bytes: new Uint8Array(await data.arrayBuffer()), fileName: `subscriber.${resolved.extension}`, mimeType: resolved.extension === "bin" ? "application/octet-stream" : null, cleanup: async () => { if (cleaned) return; cleaned = true; const removed = await storage.remove([path]); if (removed.error) throw new Error("PRIVATE_UPLOAD_DELETE_FAILED"); } };
}
export async function discardSubscriberCalibrationUpload(lease: string, ownerId: string, vehicleId: string): Promise<void> {
  const resolved = resolveUploadLease(lease, ownerId, vehicleId, resolveTrustedServerConfiguration(process.env).serviceRoleKey);
  if (!resolved) return;
  const { error } = await createTrustedServerClient().storage.from(BUCKET).remove([rawPath(resolved.id)]);
  if (error) throw new Error("PRIVATE_UPLOAD_DELETE_FAILED");
}
export async function createDurableSubscriberWorkshopSession(ownerId: string, vehicleId: string, result: SubscriberCalibrationResult): Promise<string> {
  const storage = createTrustedServerClient().storage.from(BUCKET), previousId = await readActiveSessionId(ownerId, vehicleId), id = opaqueId(), bytes = encodeSubscriberSession(ownerId, vehicleId, Date.now() + SUBSCRIBER_SESSION_TTL_MS, result);
  await registerPrivateObjects(ownerId, vehicleId, [sessionPath(id), activeSessionPath(ownerId, vehicleId)], Date.now() + SUBSCRIBER_SESSION_TTL_MS);
  const { error } = await storage.upload(sessionPath(id), bytes, { contentType: "application/octet-stream", cacheControl: "0", upsert: false });
  if (error) throw new Error("SUBSCRIBER_SESSION_WRITE_FAILED");
  const pointer = await storage.upload(activeSessionPath(ownerId, vehicleId), new TextEncoder().encode(id), { contentType: "application/octet-stream", cacheControl: "0", upsert: true });
  if (pointer.error) { await storage.remove([sessionPath(id)]); throw new Error("SUBSCRIBER_SESSION_POINTER_WRITE_FAILED"); }
  if (previousId && previousId !== id) await storage.remove([sessionPath(previousId)]);
  return id;
}
export async function readDurableSubscriberWorkshopSession(id: string, ownerId: string, vehicleId: string): Promise<SubscriberCalibrationResult | null> {
  if (!isSubscriberWorkshopSessionId(id)) return null;
  const storage = createTrustedServerClient().storage.from(BUCKET), { data, error } = await storage.download(sessionPath(id));
  if (error) {
    if (String(error.statusCode) === "404" || error.message === "Object not found") return null;
    throw new Error("SUBSCRIBER_SESSION_TEMPORARILY_UNAVAILABLE");
  }
  if (!data) return null;
  return decodeSubscriberSession(new Uint8Array(await data.arrayBuffer()), ownerId, vehicleId);
}
export async function readLatestDurableSubscriberWorkshopSession(ownerId: string, vehicleId: string): Promise<Readonly<{ sessionId: string; result: SubscriberCalibrationResult }> | null> {
  const sessionId = await readActiveSessionId(ownerId, vehicleId);
  if (!sessionId) return null;
  const result = await readDurableSubscriberWorkshopSession(sessionId, ownerId, vehicleId);
  if (result) return Object.freeze({ sessionId, result });
  // Reads never clean up a pointer or evidence, including corrupt/expired data.
  // Only an explicit owner-authorised repair may replace this state.
  return null;
}

// Called only after the owned vehicle's durable deletion intent is established.
export async function subscriberSessionDeletionPaths(ownerId: string, vehicleId: string): Promise<string[]> {
  const id = await readActiveSessionId(ownerId, vehicleId);
  if (id) {
    const { data, error } = await createTrustedServerClient().storage.from(BUCKET).download(sessionPath(id));
    if (error && String(error.statusCode) !== "404" && error.message !== "Object not found") throw new Error("Session deletion scope is temporarily unavailable.");
    if (data) {
      const inspection = inspectSubscriberSession(new Uint8Array(await data.arrayBuffer()),ownerId,vehicleId);
      if (inspection.state === "corrupt" || inspection.state === "scope_mismatch") throw new Error("Session deletion scope cannot be verified.");
    }
  }
  return [activeSessionPath(ownerId, vehicleId), ...(id ? [sessionPath(id)] : [])];
}

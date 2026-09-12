import "server-only";
import { randomBytes } from "node:crypto";
import { createTrustedServerClient } from "@/lib/supabase/trustedServer";
import { resolveTrustedServerConfiguration } from "@/lib/supabase/trustedServerConfiguration";
import type { SubscriberCalibrationResult } from "./subscriberCalibrationProvider";
import { isSubscriberWorkshopSessionId } from "./subscriberUploadNavigation";
import { decodeSubscriberSession, encodeSubscriberSession, expiredObjectPaths, issueUploadLease, resolveUploadLease, type ContainerExtension } from "./subscriberCalibrationPersistence";

export const SUBSCRIBER_CALIBRATION_BUCKET = "subscriber-calibration-private";
const BUCKET = SUBSCRIBER_CALIBRATION_BUCKET, RAW_PREFIX = "raw", SESSION_PREFIX = "sessions", CLEANUP_LIMIT = 24;
export const RAW_UPLOAD_TTL_MS = 2 * 60 * 60 * 1000;
export const SUBSCRIBER_SESSION_TTL_MS = 30 * 60 * 1000;
const opaqueId = () => randomBytes(24).toString("base64url");
const rawPath = (id: string) => `${RAW_PREFIX}/${id}`;
const sessionPath = (id: string) => `${SESSION_PREFIX}/${id}`;
async function cleanupPrefix(prefix: string, ttlMs: number, now = Date.now()) {
  const storage = createTrustedServerClient().storage.from(BUCKET);
  const { data, error } = await storage.list(prefix, { limit: CLEANUP_LIMIT, sortBy: { column: "created_at", order: "asc" } });
  if (error || !data) return;
  const paths = expiredObjectPaths(data, now, ttlMs, prefix);
  if (paths.length) await storage.remove(paths);
}
export async function prepareSubscriberCalibrationUpload(ownerId: string, vehicleId: string, extension: ContainerExtension) {
  await cleanupPrefix(RAW_PREFIX, RAW_UPLOAD_TTL_MS);
  const id = opaqueId(), expiresAt = Date.now() + RAW_UPLOAD_TTL_MS, path = rawPath(id);
  const { data, error } = await createTrustedServerClient().storage.from(BUCKET).createSignedUploadUrl(path, { upsert: false });
  if (error || !data) throw new Error("PRIVATE_UPLOAD_PREPARATION_FAILED");
  return Object.freeze({ uploadId: id, uploadPath: path, uploadToken: data.token, lease: issueUploadLease(id, expiresAt, extension, ownerId, vehicleId, resolveTrustedServerConfiguration(process.env).serviceRoleKey) });
}
export async function consumeSubscriberCalibrationUpload(lease: string, ownerId: string, vehicleId: string): Promise<{ bytes: Uint8Array; fileName: string; mimeType: string | null; cleanup: () => Promise<void> }> {
  const resolved = resolveUploadLease(lease, ownerId, vehicleId, resolveTrustedServerConfiguration(process.env).serviceRoleKey);
  if (!resolved) throw new Error("PRIVATE_UPLOAD_LEASE_INVALID");
  const storage = createTrustedServerClient().storage.from(BUCKET), path = rawPath(resolved.id), { data, error } = await storage.download(path);
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
  await cleanupPrefix(SESSION_PREFIX, SUBSCRIBER_SESSION_TTL_MS);
  const id = opaqueId(), bytes = encodeSubscriberSession(ownerId, vehicleId, Date.now() + SUBSCRIBER_SESSION_TTL_MS, result);
  const { error } = await createTrustedServerClient().storage.from(BUCKET).upload(sessionPath(id), bytes, { contentType: "application/octet-stream", cacheControl: "0", upsert: false });
  if (error) throw new Error("SUBSCRIBER_SESSION_WRITE_FAILED");
  return id;
}
export async function readDurableSubscriberWorkshopSession(id: string, ownerId: string, vehicleId: string): Promise<SubscriberCalibrationResult | null> {
  if (!isSubscriberWorkshopSessionId(id)) return null;
  const storage = createTrustedServerClient().storage.from(BUCKET), { data, error } = await storage.download(sessionPath(id));
  if (error || !data) return null;
  return decodeSubscriberSession(new Uint8Array(await data.arrayBuffer()), ownerId, vehicleId);
}

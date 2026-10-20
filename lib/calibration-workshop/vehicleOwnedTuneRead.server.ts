import "server-only";
import { createTrustedServerClient } from "@/lib/supabase/trustedServer";
import { loadSubscriberCalibration } from "./subscriberCalibrationProvider";
import { ownedStoragePath, TUNE_MAX_BYTES } from "@/lib/security/uploadPolicy";
import { createHash } from "node:crypto";
import { resolveBinaryContainer } from "../tunes/binaryContainer";

export type OwnedSourceLocator = Readonly<{digest: string; byteLength: number; software: string}>;

/** The existing Current selector and admission path, without session persistence. */
export async function readVehicleOwnedTune(input: Readonly<{ ownerId: string; vehicleId: string; tuneId: string; locator?: OwnedSourceLocator }>) {
  const client = createTrustedServerClient();
  const { data } = await client.from("tunes").select("id,file_name,storage_path,is_stock_reference,created_at").eq("id", input.tuneId).eq("vehicle_id", input.vehicleId).eq("user_id", input.ownerId).maybeSingle();
  if (!data || (data.is_stock_reference && !input.locator) || !ownedStoragePath(data.storage_path, input.ownerId, input.vehicleId)) return null;
  const { data: sourceInfo } = await client.storage.from("tunes").info(data.storage_path);
  if (!sourceInfo || typeof sourceInfo.size !== "number" || sourceInfo.size < 1 || sourceInfo.size > TUNE_MAX_BYTES) return null;
  const { data: source, error } = await client.storage.from("tunes").download(data.storage_path);
  if (error || !source || source.size !== sourceInfo.size) return null;
  const bytes = new Uint8Array(await source.arrayBuffer());
  if (input.locator) {
    const container = resolveBinaryContainer({bytes, fileName: data.file_name ?? "vehicle-current.bin", mimeType: null});
    if (container.status !== "resolved" || container.engineeringBinary.byteLength !== input.locator.byteLength
      || createHash("sha256").update(container.engineeringBinary.bytes).digest("hex") !== input.locator.digest) return null;
  }
  const sourceTime = Date.parse(data.created_at);
  if (!Number.isFinite(sourceTime)) return null;
  // Existing durable source observation time keeps response-only revisions stable.
  const result = await loadSubscriberCalibration({ bytes, fileName: data.file_name ?? "vehicle-current.bin", mimeType: null, observedAt: new Date(sourceTime).toISOString() });
  return result.status === "workshop_ready" && (!input.locator || result.identity === input.locator.software) ? result : null;
}

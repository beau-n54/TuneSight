import "server-only";
import { createTrustedServerClient } from "@/lib/supabase/trustedServer";
import { loadSubscriberCalibration } from "./subscriberCalibrationProvider";
import { ownedStoragePath, TUNE_MAX_BYTES } from "@/lib/security/uploadPolicy";
import { createHash } from "node:crypto";
import { resolveBinaryContainer } from "../tunes/binaryContainer";

export type OwnedSourceLocator = Readonly<{digest: string; byteLength: number; software: string}>;
type OwnedTuneInput = Readonly<{ownerId: string; vehicleId: string; tuneId: string; locator?: OwnedSourceLocator}>;

/** The existing Current selector and admission path, without session persistence. */
async function readOwnedBytes(input: OwnedTuneInput) {
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
  return {bytes, fileName: data.file_name ?? "vehicle-current.bin", observedAt: new Date(sourceTime).toISOString()};
}
export async function readVehicleOwnedTune(input: OwnedTuneInput) {
  const source = await readOwnedBytes(input);
  if (!source) return null;
  const result = await loadSubscriberCalibration({...source, mimeType: null});
  return result.status === "workshop_ready" && (!input.locator || result.identity === input.locator.software) ? result : null;
}

/** Identical-content aliases retain all owned record references. Never choose
 * an authoritative upload by filename, chronology or identifier ordering. */
export async function readUniqueVehicleOwnedTune(input: Readonly<{ownerId: string; vehicleId: string; tuneIds: readonly string[]; locator: OwnedSourceLocator}>) {
  if (!input.tuneIds.length || input.tuneIds.length > 100 || new Set(input.tuneIds).size !== input.tuneIds.length) return null;
  let unique: Awaited<ReturnType<typeof readOwnedBytes>> = null;
  const sourceIds: string[] = [];
  for (let offset = 0; offset < input.tuneIds.length; offset += 4) {
    const group = input.tuneIds.slice(offset, offset + 4);
    const sources = await Promise.all(group.map(tuneId => readOwnedBytes({...input, tuneId})));
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      if (!source) continue;
      if (unique && !Buffer.from(unique.bytes).equals(Buffer.from(source.bytes))) return null;
      unique ??= source;
      sourceIds.push(group[i]);
    }
  }
  if (!unique) return null;
  // This is a new server observation of one exact content identity, not a
  // selection of any upload's historical Dataset or observation timestamp.
  const result = await loadSubscriberCalibration({bytes: unique.bytes, fileName: unique.fileName, mimeType: null, observedAt: new Date().toISOString()});
  return result.status === "workshop_ready" && result.identity === input.locator.software ? {result, sourceIds} : null;
}

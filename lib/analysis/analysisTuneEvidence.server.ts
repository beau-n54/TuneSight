import "server-only";
import {createHash} from "node:crypto";
import {createTrustedServerClient} from "../supabase/trustedServer";
import {ownedStoragePath, TUNE_MAX_BYTES} from "../security/uploadPolicy";
import type {TuneByteEvidence} from "./analysisTuneEvidence";

/** Fresh bounded read of two explicitly linked, owned objects. No label inference,
 * role mutation, Dataset creation, persistence or guessed reference selection. */
export async function readAnalysisTuneEvidence(owner: string, vehicle: string, tuneId: string | null): Promise<TuneByteEvidence | null> {
  if (!tuneId) return null;
  try {
    const db = createTrustedServerClient();
    const read = async (id: string) => {
      const {data: row, error} = await db.from("tunes").select("id,file_name,storage_path,is_stock_reference,reference_tune_id")
        .eq("id", id).eq("user_id", owner).eq("vehicle_id", vehicle).maybeSingle();
      if (error || !row || !ownedStoragePath(row.storage_path, owner, vehicle)) return null;
      const {data: info} = await db.storage.from("tunes").info(row.storage_path);
      if (!info || typeof info.size !== "number" || !Number.isSafeInteger(info.size) || info.size < 1 || info.size > TUNE_MAX_BYTES) return null;
      const {data, error: downloadError} = await db.storage.from("tunes").download(row.storage_path);
      if (downloadError || !data || data.size !== info.size) return null;
      const bytes = Buffer.from(await data.arrayBuffer());
      return {row, bytes, digest: createHash("sha256").update(bytes).digest("hex")};
    };
    const source = await read(tuneId);
    if (!source) return null;
    const reference = source.row.reference_tune_id && source.row.reference_tune_id !== tuneId ? await read(source.row.reference_tune_id) : null;
    return {sourceId: tuneId, fileName: source.row.file_name ?? "Owned source", digest: source.digest, byteLength: source.bytes.length,
      referenceId: reference?.row.id ?? null, referenceDigest: reference?.digest ?? null,
      matchesOwnedStockReference: reference?.row.is_stock_reference === true && source.bytes.equals(reference.bytes)};
  } catch { return null; }
}

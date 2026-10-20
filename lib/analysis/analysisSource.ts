import { ownedStoragePath } from "../security/uploadPolicy.ts";
import { LOG_MAX_BYTES } from "../logging/boundedCsv.ts";
import { parseSourceMeasurements, ownedCandidates, type OwnedLog, type SourceMeasurements, type SourceState } from "./analysisCapabilities.ts";
import { createHash } from "node:crypto";

export type AnalysisSource = {state: SourceState; measurements: SourceMeasurements | null; finding: string; digest: string | null};
type Download = (path: string) => Promise<{data: Blob | null; error: {statusCode?: string | number; code?: string} | null}>;

/** Only this injected read capability is available. No write client, URL fetch or persistence. */
export async function readOwnedAnalysisSource(log: OwnedLog, owner: string, vehicleId: string, projectUrl: string, download: Download): Promise<AnalysisSource> {
  const unavailable = (state: SourceState, finding: string): AnalysisSource => ({state, measurements: null, digest: null, finding});
  if (log.user_id !== owner || log.vehicle_id !== vehicleId) return unavailable("unresolved", "Source ownership does not match this vehicle.");
  let storagePath = log.raw_source_storage_path;
  if (!storagePath && log.file_url) try {
    const legacy = new URL(log.file_url), project = new URL(projectUrl);
    const prefix = "/storage/v1/object/sign/logs/";
    if (legacy.origin === project.origin && legacy.pathname.startsWith(prefix)) storagePath = decodeURIComponent(legacy.pathname.slice(prefix.length));
  } catch { /* Never follow an untrusted legacy URL. */ }
  if (!ownedStoragePath(storagePath, owner, vehicleId)) return unavailable("unresolved", "The owned storage relationship cannot be established. Source existence is unverified; review this log's history.");
  try {
    const {data, error} = await download(storagePath);
    if (error || !data) {
      const missing = String(error?.statusCode) === "404" || error?.code === "NoSuchKey";
      return unavailable(missing ? "missing" : "temporarily_unavailable", missing ? "The original object for this exact log is missing." : "Source access could not be verified. Retry without uploading another copy.");
    }
    if (data.size > LOG_MAX_BYTES) return unavailable("available", "Original source exists but exceeds the bounded parser size limit. No re-upload is needed.");
    const bytes = new Uint8Array(await data.arrayBuffer()), digest = createHash("sha256").update(bytes).digest("hex");
    try {
      return {state: "available", measurements: parseSourceMeasurements(new TextDecoder("utf-8", {fatal: true}).decode(bytes)), digest, finding: "Your original log remains available and has not been changed."};
    } catch {
      return {state: "available", measurements: null, digest, finding: "Original source exists. Its encoding, CSV structure or source format is not qualified for this bounded parser. No re-upload is needed."};
    }
  } catch { return unavailable("temporarily_unavailable", "Source access is temporarily unavailable. Retry without uploading another copy."); }
}

/** Newest usable measurements, then parsed source, then existing source. Explicit selection never silently switches logs. */
export async function selectMeasurementSource(logs: readonly OwnedLog[], owner: string, vehicleId: string, read: (log: OwnedLog) => Promise<AnalysisSource>, selectedId?: string) {
  let best: {log: OwnedLog; source: AnalysisSource} | null = null, bestRank = -1;
  for (const log of ownedCandidates(logs, owner, vehicleId, selectedId)) {
    const source = await read(log);
    const rank = source.measurements?.channels.length ? 3 : source.measurements ? 2 : source.state === "available" ? 1 : 0;
    if (rank > bestRank) { best = {log, source}; bestRank = rank; }
    if (rank === 3 || selectedId || source.state === "temporarily_unavailable") break;
  }
  return best;
}

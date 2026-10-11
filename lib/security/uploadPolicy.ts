import { LOG_MAX_BYTES } from "../logging/boundedCsv.ts";
export const TUNE_MAX_BYTES = 32 * 1024 * 1024;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validLogUpload(file: Pick<File, "name" | "type" | "size">): boolean {
  return file.size > 0 && file.size <= LOG_MAX_BYTES && /\.csv$/i.test(file.name)
    && ["", "text/csv", "application/csv", "text/plain", "application/vnd.ms-excel", "application/octet-stream"].includes(file.type.toLowerCase());
}
export function validTuneUpload(file: Pick<File, "name" | "type" | "size">): boolean {
  return file.size > 0 && file.size <= TUNE_MAX_BYTES && /\.(bin|dtf)$/i.test(file.name)
    && ["", "application/octet-stream", "application/x-binary"].includes(file.type.toLowerCase());
}
export function ownedStoragePath(path: unknown, ownerId: string, vehicleId: string): path is string {
  if (typeof path !== "string" || path.length > 512) return false;
  const parts = path.split("/");
  return parts.length === 3 && parts[0] === ownerId && parts[1] === vehicleId
    && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,254}$/.test(parts[2]) && !parts[2].includes("..");
}

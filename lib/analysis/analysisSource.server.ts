import "server-only";
import { createTrustedServerClient } from "../supabase/trustedServer";
import { readOwnedAnalysisSource } from "./analysisSource";
import type { OwnedLog } from "./analysisCapabilities";

export function readAnalysisSource(log: OwnedLog, owner: string, vehicleId: string) {
  return readOwnedAnalysisSource(log, owner, vehicleId, process.env.NEXT_PUBLIC_SUPABASE_URL!,
    path => createTrustedServerClient().storage.from("logs").download(path));
}

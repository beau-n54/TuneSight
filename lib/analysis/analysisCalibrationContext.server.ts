import "server-only";
import { createTrustedServerClient } from "../supabase/trustedServer";
import { resolveTrustedServerConfiguration } from "../supabase/trustedServerConfiguration";
import type { OwnedLog } from "./analysisCapabilities";
import { readAnalysisCalibrationContext } from "./analysisCalibrationRead";

export async function readAnalysisCalibration(log: OwnedLog | null, owner: string, vehicle: string) {
  try {
    return await readAnalysisCalibrationContext(log, owner, vehicle,
      resolveTrustedServerConfiguration(process.env).serviceRoleKey,
      path => createTrustedServerClient().storage.from("subscriber-calibration-private").download(path));
  } catch {
    return {state: "unavailable" as const, reason: "The server-owned Calibration context is temporarily unavailable. No source or configuration was changed."};
  }
}

import "server-only";
import { createTrustedServerClient } from "../supabase/trustedServer";
import { resolveTrustedServerConfiguration } from "../supabase/trustedServerConfiguration";
import type { OwnedLog } from "./analysisCapabilities";
import { readAnalysisCalibrationContext } from "./analysisCalibrationRead";
import { resolveDurableAnalysisContext } from "./analysisDurableContext";
import { readVehicleCalibrationRole } from "../calibration-workshop/vehicleCalibrationRoleStorage";
import { readVehicleOwnedTune, readUniqueVehicleOwnedTune } from "../calibration-workshop/vehicleOwnedTuneRead.server";

export async function readAnalysisCalibration(log: OwnedLog | null, owner: string, vehicle: string) {
  try {
    return await resolveDurableAnalysisContext(log, owner, vehicle, () => readAnalysisCalibrationContext(log, owner, vehicle,
      resolveTrustedServerConfiguration(process.env).serviceRoleKey,
      path => createTrustedServerClient().storage.from("subscriber-calibration-private").download(path)),
    async session => {
      const assignment = await readVehicleCalibrationRole(owner, vehicle, "current");
      if (assignment) {
        const result = await readVehicleOwnedTune({ownerId: owner, vehicleId: vehicle, tuneId: assignment.tuneId});
        return result ? {state: "available", owner, vehicle, sessionId: null, sourceId: assignment.tuneId, result,
          resolutionPath: "Explicit vehicle Current assignment → exact owned bytes → existing Calibration admission provider → response-only Dataset."}
          : {state: "unavailable", reason: "The explicitly assigned owned Current source could not be read or admitted. No substitute was selected."};
      }
      if (!session.locator) return {state: "unavailable", reason: `No explicit Current assignment or owner-scoped source-hash locator is available. ${session.state === "unavailable" ? session.reason : ""}`};
      // Locate exact bytes only. Stock flags and role assignments remain unchanged.
      const client = createTrustedServerClient();
      const {data, error} = await client.from("tunes").select("id").eq("user_id", owner).eq("vehicle_id", vehicle).order("id").limit(101);
      if (error || !data || data.length > 100) return {state: "unavailable", reason: "The bounded owned-source locator could not resolve the vehicle's source inventory."};
      const admitted = await readUniqueVehicleOwnedTune({ownerId: owner, vehicleId: vehicle, tuneIds: data.map(tune => tune.id), locator: session.locator});
      if (admitted) return {state: "available", owner, vehicle, sessionId: null, sourceId: admitted.sourceIds.join(", "), result: admitted.result,
        resolutionPath: "Owner-scoped historical hash locator → one byte-identical owned content identity (all matching source records retained) → fresh existing Calibration admission → response-only Dataset. No upload is promoted to Current; expired metadata supplies no admission authority."};
      return {state: "unavailable", reason: "No unique owned content identity could be admitted: source hash, length, software or byte-equivalence checks failed. No ambiguous source was selected."};
    });
  } catch {
    return {state: "unavailable" as const, reason: "The server-owned Calibration context is temporarily unavailable. No source or configuration was changed."};
  }
}

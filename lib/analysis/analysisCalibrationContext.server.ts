import "server-only";
import { createTrustedServerClient } from "../supabase/trustedServer";
import { resolveTrustedServerConfiguration } from "../supabase/trustedServerConfiguration";
import type { OwnedLog } from "./analysisCapabilities";
import { readAnalysisCalibrationContext } from "./analysisCalibrationRead";
import { resolveDurableAnalysisContext } from "./analysisDurableContext";
import { readVehicleCalibrationRole } from "../calibration-workshop/vehicleCalibrationRoleStorage";
import { readVehicleOwnedTune } from "../calibration-workshop/vehicleOwnedTuneRead.server";

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
      if (!session.locator) return {state: "unavailable", reason: "No explicit Current assignment or owner-scoped source-hash locator is available."};
      // Locate exact bytes only. Stock flags and role assignments remain unchanged.
      const client = createTrustedServerClient();
      const {data, error} = await client.from("tunes").select("id").eq("user_id", owner).eq("vehicle_id", vehicle).order("id").limit(101);
      if (error || !data || data.length > 100) return {state: "unavailable", reason: "The bounded owned-source locator could not resolve the vehicle's source inventory."};
      for (const tune of data) {
        const result = await readVehicleOwnedTune({ownerId: owner, vehicleId: vehicle, tuneId: tune.id, locator: session.locator});
        if (result) return {state: "available", owner, vehicle, sessionId: null, sourceId: tune.id, result,
          resolutionPath: "Owner-scoped historical hash locator → matching durable owned bytes → fresh existing Calibration admission → response-only Dataset. Expired metadata supplied no admission authority."};
      }
      return {state: "unavailable", reason: "No durable owned source matches the exact historical source hash, length and independently re-observed software identity."};
    });
  } catch {
    return {state: "unavailable" as const, reason: "The server-owned Calibration context is temporarily unavailable. No source or configuration was changed."};
  }
}

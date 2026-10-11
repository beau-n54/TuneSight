import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createTrustedServerClient } from "../supabase/trustedServer";
import { subscriberSessionDeletionPaths } from "../calibration-workshop/subscriberCalibrationStorage";
import { sourceBinaryDeletionPaths } from "../calibration-workshop/sourceBinaryReconstructionStorage";
import { vehicleCalibrationRoleDeletionPaths } from "../calibration-workshop/vehicleCalibrationRoleStorage";
import { completeObjectDeletion, type DeletionObject } from "./deletionWorkflow";
import { UUID_PATTERN } from "./uploadPolicy";

export async function deleteOwnedVehicle(client: SupabaseClient, ownerId: string, vehicleId: string): Promise<void> {
  if (!UUID_PATTERN.test(vehicleId)) throw new Error("Vehicle unavailable.");
  const { data: vehicle, error: vehicleError } = await client.from("vehicles").select("id").eq("id",vehicleId).eq("user_id",ownerId).maybeSingle();
  if (vehicleError) throw new Error("Vehicle lookup temporarily unavailable.");
  // The RPC independently checks auth.uid() ownership, including a completed
  // job after its vehicle was removed. The caller enforces session/beta access.
  const { data: jobId, error: reservationError } = await client.rpc("prepare_vehicle_deletion_v1", { p_vehicle_id: vehicleId });
  if (reservationError || !jobId) throw new Error("Deletion could not be prepared. Nothing has been removed.");
  const trusted = createTrustedServerClient();
  const { data: job, error } = await trusted.from("security_vehicle_deletions").select("source_paths,calibration_paths,status").eq("id",jobId).eq("owner_id",ownerId).eq("vehicle_id",vehicleId).single();
  if (error || !job) throw new Error("Deletion recovery is temporarily unavailable.");
  if (job.status === "completed") return;
  if (!vehicle) throw new Error("Vehicle unavailable.");
  let calibrationPaths = job.calibration_paths as string[] | null;
  if (calibrationPaths === null) {
    const inventory = await trusted.from("security_private_objects").select("path").eq("owner_id",ownerId).eq("vehicle_id",vehicleId).is("deleted_at",null).limit(5001);
    if (inventory.error || !inventory.data || inventory.data.length > 5000) throw new Error("Private inventory is unavailable or exceeds the bounded operation.");
    calibrationPaths = [...new Set([...inventory.data.map(item => item.path as string), ...await subscriberSessionDeletionPaths(ownerId,vehicleId), ...await sourceBinaryDeletionPaths(ownerId,vehicleId), ...vehicleCalibrationRoleDeletionPaths(ownerId,vehicleId)])];
    const saved = await trusted.from("security_vehicle_deletions").update({ calibration_paths: calibrationPaths }).eq("id",jobId).eq("owner_id",ownerId).eq("vehicle_id",vehicleId);
    if (saved.error) throw new Error("Deletion inventory could not be saved. Retry later.");
  }
  const objects = job.source_paths as DeletionObject[];
  if (!Array.isArray(objects) || objects.some(object => !["logs","tunes"].includes(object.bucket) || !object.path.startsWith(`${ownerId}/${vehicleId}/`))) throw new Error("Deletion scope cannot be verified.");
  await completeObjectDeletion([...objects,...calibrationPaths.map(path => ({ bucket: "subscriber-calibration-private",path }))], async (bucket,paths) => {
    const result = await trusted.storage.from(bucket).remove(paths); if (result.error) throw new Error("Object deletion interrupted. Retry the same vehicle deletion.");
  }, async () => {
    const result = await trusted.rpc("finish_vehicle_deletion_v1", { p_job_id: jobId,p_owner_id: ownerId });
    if (result.error) throw new Error("Deletion is incomplete. Source inventory is retained for retry.");
  });
}

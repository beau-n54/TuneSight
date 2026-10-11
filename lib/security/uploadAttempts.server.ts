import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type UploadAttempt = { id: string; token: string; resource_id: string; outcome: "claimed" | "completed" | "busy" };
export async function claimUpload(client: SupabaseClient, vehicleId: string, kind: "log" | "tune", digest: string): Promise<UploadAttempt> {
  const { data, error } = await client.rpc("claim_security_upload_v1", { p_vehicle_id: vehicleId, p_kind: kind, p_digest: digest });
  if (error || !data || !["claimed", "completed", "busy"].includes(data.outcome)) throw new Error("Upload reservation unavailable. Retry later.");
  return data as UploadAttempt;
}
export async function finishUpload(client: SupabaseClient, attempt: UploadAttempt, completed: boolean): Promise<void> {
  if (attempt.outcome !== "claimed") return;
  const { error } = await client.rpc("finish_security_upload_v1", { p_id: attempt.id, p_token: attempt.token, p_completed: completed });
  if (error) throw new Error("Upload completion could not be confirmed. Retry the same file.");
}

export async function resumeUpload(client: SupabaseClient, ownerId: string, vehicleId: string, id: string, token: string): Promise<UploadAttempt & { digest: string }> {
  const { data, error } = await client.from("security_upload_attempts").select("id,token,resource_id,digest,lease_until,status")
    .eq("id", id).eq("token", token).eq("owner_id", ownerId).eq("vehicle_id", vehicleId).eq("kind", "tune").single();
  if (error || !data || data.status !== "processing" || !Number.isFinite(Date.parse(data.lease_until)) || Date.parse(data.lease_until) <= Date.now()) throw new Error("Upload lease expired. Select the same file to retry.");
  return { ...data, outcome: "claimed" };
}

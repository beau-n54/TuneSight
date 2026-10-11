import { protectSubscriberRequest } from "@/lib/security/subscriberAccess.server";
import { createClient } from "@/lib/supabase/server";
import { assignVehicleCalibrationRole, readVehicleCalibrationRole } from "@/lib/calibration-workshop/vehicleCalibrationRoleStorage";
import { materializeVehicleOwnedTune, recoverVehicleOwnedTuneCalibration } from "@/lib/calibration-workshop/vehicleOwnedTuneMaterialization.server";
import { readLatestSubscriberWorkshopSession } from "@/lib/calibration-workshop/subscriberWorkshopSession.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const json = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function authenticatedVehicle(request: Request) {
  const client = await createClient(); const { data: { user } } = await client.auth.getUser();
  const url = new URL(request.url), vehicleId = url.searchParams.get("vehicleId")?.trim() ?? "";
  if (!user || !vehicleId) return null;
  const { data: vehicle } = await client.from("vehicles").select("id").eq("id", vehicleId).eq("user_id", user.id).maybeSingle();
  return vehicle ? { client, user, vehicleId } : null;
}

async function handleGET(request: Request) {
  try { const scope = await authenticatedVehicle(request); if (!scope) return json({ outcome: "unavailable" }, 404);
    const [reference, current] = await Promise.all([readVehicleCalibrationRole(scope.user.id, scope.vehicleId, "reference"), readVehicleCalibrationRole(scope.user.id, scope.vehicleId, "current")]);
    return json({ outcome: "resolved", referenceTuneId: reference?.tuneId ?? null, currentTuneId: current?.tuneId ?? null });
  } catch { return json({ outcome: "infrastructure_failure" }, 503); }
}

async function handlePOST(request: Request) {
  try { const scope = await authenticatedVehicle(request); if (!scope) return json({ outcome: "unavailable" }, 404);
    const body = await request.json().catch(() => null) as { action?: string; tuneId?: string; role?: string } | null, tuneId = body?.tuneId?.trim() ?? "";
    if (body?.action !== "repair_session" && (!tuneId || body?.role !== "current")) return json({ outcome: "invalid_role", error: "A Current calibration Tune selection is required." }, 400);
      const { data: lease, error: leaseError } = await scope.client.rpc("claim_calibration_repair_v1", { p_vehicle_id: scope.vehicleId });
      if (leaseError) return json({ outcome: "repair_unavailable" }, 503);
      if (!lease) return json({ outcome: "repair_in_progress", error: "Repair is already in progress. Retry shortly." }, 409);
      try {
    if (body?.action === "repair_session") {
      // A transient read throws; it must never be interpreted as absent evidence.
      const existing = await readLatestSubscriberWorkshopSession(scope.user.id, scope.vehicleId);
      if (existing) return json({ outcome: "session_restored", session: existing.sessionId });
      const recovered = await recoverVehicleOwnedTuneCalibration(scope.user.id, scope.vehicleId);
      return recovered ? json({ outcome: "session_restored", session: recovered.sessionId }) : json({ outcome: "qualification_unavailable" }, 422);
    }
    const materialized = await materializeVehicleOwnedTune({ ownerId: scope.user.id, vehicleId: scope.vehicleId, tuneId });
    if (!materialized) return json({ outcome: "qualification_unavailable", error: "This existing Tune could not be qualified as the vehicle Current Calibration." }, 422);
    await assignVehicleCalibrationRole({ ownerId: scope.user.id, vehicleId: scope.vehicleId, role: "current", tuneId });
    return json({ outcome: "current_assigned", session: materialized.sessionId });
      } finally { await scope.client.rpc("release_calibration_repair_v1", { p_vehicle_id: scope.vehicleId, p_token: lease }); }
  } catch { return json({ outcome: "infrastructure_failure", error: "Current Calibration assignment could not be completed." }, 503); }
}

export const GET = protectSubscriberRequest(handleGET, 32768);

export const POST = protectSubscriberRequest(handlePOST, 32768);

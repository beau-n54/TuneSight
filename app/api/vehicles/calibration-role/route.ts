import { createClient } from "@/lib/supabase/server";
import { assignVehicleCalibrationRole, readVehicleCalibrationRole } from "@/lib/calibration-workshop/vehicleCalibrationRoleStorage";
import { materializeVehicleOwnedTune } from "@/lib/calibration-workshop/vehicleOwnedTuneMaterialization.server";

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

export async function GET(request: Request) {
  try { const scope = await authenticatedVehicle(request); if (!scope) return json({ outcome: "unavailable" }, 404);
    const [reference, current] = await Promise.all([readVehicleCalibrationRole(scope.user.id, scope.vehicleId, "reference"), readVehicleCalibrationRole(scope.user.id, scope.vehicleId, "current")]);
    return json({ outcome: "resolved", referenceTuneId: reference?.tuneId ?? null, currentTuneId: current?.tuneId ?? null });
  } catch { return json({ outcome: "infrastructure_failure" }, 503); }
}

export async function POST(request: Request) {
  try { const scope = await authenticatedVehicle(request); if (!scope) return json({ outcome: "unavailable" }, 404);
    const body = await request.json().catch(() => null) as { tuneId?: string; role?: string } | null, tuneId = body?.tuneId?.trim() ?? "";
    if (!tuneId || body?.role !== "current") return json({ outcome: "invalid_role", error: "A Current calibration Tune selection is required." }, 400);
    const materialized = await materializeVehicleOwnedTune({ ownerId: scope.user.id, vehicleId: scope.vehicleId, tuneId });
    if (!materialized) return json({ outcome: "qualification_unavailable", error: "This existing Tune could not be qualified as the vehicle Current Calibration." }, 422);
    await assignVehicleCalibrationRole({ ownerId: scope.user.id, vehicleId: scope.vehicleId, role: "current", tuneId });
    return json({ outcome: "current_assigned", session: materialized.sessionId });
  } catch { return json({ outcome: "infrastructure_failure", error: "Current Calibration assignment could not be completed." }, 503); }
}

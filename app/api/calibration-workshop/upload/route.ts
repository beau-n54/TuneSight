import { createClient } from "@/lib/supabase/server";
import { loadSubscriberCalibration, SUBSCRIBER_CALIBRATION_MAX_UPLOAD_BYTES } from "@/lib/calibration-workshop/subscriberCalibrationProvider";
import { createSubscriberWorkshopSession } from "@/lib/calibration-workshop/subscriberWorkshopSession.server";
import { consumeSubscriberCalibrationUpload, discardSubscriberCalibrationUpload, prepareSubscriberCalibrationUpload } from "@/lib/calibration-workshop/subscriberCalibrationStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const json = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  try {
    const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ outcome: "infrastructure_failure", error: "Authentication required." }, 401);
    const body = await request.json().catch(() => null) as { action?: string; vehicleId?: string; byteLength?: number; extension?: string; lease?: string } | null;
    const vehicleId = body?.vehicleId?.trim() ?? "";
    if (!body || !vehicleId) return json({ outcome: "invalid_upload", error: "A valid upload request is required." }, 400);
    const { data: vehicle } = await supabase.from("vehicles").select("id").eq("id", vehicleId).eq("user_id", user.id).single();
    if (!vehicle) return json({ outcome: "invalid_upload", error: "Vehicle unavailable." }, 404);
    if (body.action === "prepare") {
      if (!Number.isInteger(body.byteLength) || body.byteLength! <= 0 || body.byteLength! > SUBSCRIBER_CALIBRATION_MAX_UPLOAD_BYTES || !["bin", "dtf"].includes(body.extension ?? "")) return json({ outcome: "invalid_upload", error: `Calibration file must be a BIN or DTF between 1 byte and ${SUBSCRIBER_CALIBRATION_MAX_UPLOAD_BYTES} bytes.` }, 413);
      try { const prepared = await prepareSubscriberCalibrationUpload(user.id, vehicleId, body.extension as "bin" | "dtf"); return json({ outcome: "upload_ready", ...prepared }); }
      catch { return json({ outcome: "storage_failure", error: "Private calibration upload could not be prepared." }, 503); }
    }
    if (body.action !== "process" || !body.lease) return json({ outcome: "invalid_upload", error: "A valid processing lease is required." }, 400);
    let upload: Awaited<ReturnType<typeof consumeSubscriberCalibrationUpload>> | null = null;
    try {
      upload = await consumeSubscriberCalibrationUpload(body.lease, user.id, vehicleId);
      if (!upload.bytes.byteLength || upload.bytes.byteLength > SUBSCRIBER_CALIBRATION_MAX_UPLOAD_BYTES) return json({ outcome: "invalid_upload", error: "Calibration upload size is invalid." }, 413);
      const result = await loadSubscriberCalibration(upload);
      let session: string;
      try { session = await createSubscriberWorkshopSession(user.id, vehicleId, result); }
      catch { return json({ outcome: "session_failure", error: "Calibration session could not be stored." }, 503); }
      return json({ outcome: result.status, session, status: result.status });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "PRIVATE_UPLOAD_LEASE_INVALID") return json({ outcome: "invalid_upload", error: "Calibration upload lease is invalid or expired." }, 400);
      return json({ outcome: code.startsWith("PRIVATE_UPLOAD") ? "storage_failure" : "provider_rejection", error: code.startsWith("PRIVATE_UPLOAD") ? "Private calibration upload could not be processed." : "Calibration evidence was rejected by the governed provider." }, code.startsWith("PRIVATE_UPLOAD") ? 503 : 422);
    } finally {
      try { if (upload) await upload.cleanup(); else await discardSubscriberCalibrationUpload(body.lease, user.id, vehicleId); }
      catch { return json({ outcome: "storage_failure", error: "Private calibration upload cleanup failed." }, 503); }
    }
  } catch { return json({ outcome: "infrastructure_failure", error: "Calibration service is temporarily unavailable." }, 503); }
}

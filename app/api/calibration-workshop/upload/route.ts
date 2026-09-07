import { createClient } from "@/lib/supabase/server";
import { loadSubscriberCalibration, SUBSCRIBER_CALIBRATION_MAX_UPLOAD_BYTES } from "@/lib/calibration-workshop/subscriberCalibrationProvider";
import { createSubscriberWorkshopSession } from "@/lib/calibration-workshop/subscriberWorkshopSession.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  const form = await request.formData(), file = form.get("calibration"), vehicleId = String(form.get("vehicleId") ?? "").trim();
  if (!(file instanceof File) || !vehicleId) return Response.json({ error: "A calibration file and vehicle identity are required." }, { status: 400 });
  if (file.size <= 0 || file.size > SUBSCRIBER_CALIBRATION_MAX_UPLOAD_BYTES) return Response.json({ error: `Calibration file must be between 1 byte and ${SUBSCRIBER_CALIBRATION_MAX_UPLOAD_BYTES} bytes.` }, { status: 413 });
  const { data: vehicle } = await supabase.from("vehicles").select("id").eq("id", vehicleId).eq("user_id", user.id).single();
  if (!vehicle) return Response.json({ error: "Vehicle unavailable." }, { status: 404 });
  const result = await loadSubscriberCalibration({ bytes: new Uint8Array(await file.arrayBuffer()), fileName: file.name, mimeType: file.type || null });
  const session = createSubscriberWorkshopSession(user.id, vehicleId, result);
  return Response.json({ session, status: result.status }, { headers: { "Cache-Control": "no-store" } });
}

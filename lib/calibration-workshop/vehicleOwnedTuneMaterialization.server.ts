import "server-only";
import { createTrustedServerClient } from "@/lib/supabase/trustedServer";
import { loadSubscriberCalibration, type SubscriberCalibrationSuccess } from "./subscriberCalibrationProvider";
import { createSubscriberWorkshopSession } from "./subscriberWorkshopSession.server";
import { readVehicleCalibrationRole } from "./vehicleCalibrationRoleStorage";

type TuneSource = Readonly<{ id: string; file_name: string | null; storage_path: string | null; is_stock_reference: boolean }>;

export async function materializeVehicleOwnedTune(input: Readonly<{ ownerId: string; vehicleId: string; tuneId: string }>): Promise<Readonly<{ result: SubscriberCalibrationSuccess; sessionId: string }> | null> {
  const client = createTrustedServerClient();
  const { data } = await client.from("tunes").select("id,file_name,storage_path,is_stock_reference").eq("id", input.tuneId).eq("vehicle_id", input.vehicleId).eq("user_id", input.ownerId).maybeSingle<TuneSource>();
  if (!data || data.is_stock_reference || !data.storage_path) return null;
  const { data: source, error } = await client.storage.from("tunes").download(data.storage_path);
  if (error || !source) return null;
  const result = await loadSubscriberCalibration({ bytes: new Uint8Array(await source.arrayBuffer()), fileName: data.file_name ?? "vehicle-current.bin", mimeType: null });
  if (result.status !== "workshop_ready") return null;
  const sessionId = await createSubscriberWorkshopSession(input.ownerId, input.vehicleId, result);
  return Object.freeze({ result, sessionId });
}

export async function recoverVehicleOwnedTuneCalibration(ownerId: string, vehicleId: string) {
  const assignment = await readVehicleCalibrationRole(ownerId, vehicleId, "current");
  return assignment ? materializeVehicleOwnedTune({ ownerId, vehicleId, tuneId: assignment.tuneId }) : null;
}

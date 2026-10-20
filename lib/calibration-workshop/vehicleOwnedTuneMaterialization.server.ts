import "server-only";
import type { SubscriberCalibrationSuccess } from "./subscriberCalibrationProvider";
import { readVehicleOwnedTune } from "./vehicleOwnedTuneRead.server";
import { createSubscriberWorkshopSession } from "./subscriberWorkshopSession.server";
import { readVehicleCalibrationRole } from "./vehicleCalibrationRoleStorage";

export async function materializeVehicleOwnedTune(input: Readonly<{ ownerId: string; vehicleId: string; tuneId: string }>): Promise<Readonly<{ result: SubscriberCalibrationSuccess; sessionId: string }> | null> {
  const result = await readVehicleOwnedTune(input);
  if (!result) return null;
  const sessionId = await createSubscriberWorkshopSession(input.ownerId, input.vehicleId, result);
  return Object.freeze({ result, sessionId });
}

export async function recoverVehicleOwnedTuneCalibration(ownerId: string, vehicleId: string) {
  const assignment = await readVehicleCalibrationRole(ownerId, vehicleId, "current");
  return assignment ? materializeVehicleOwnedTune({ ownerId, vehicleId, tuneId: assignment.tuneId }) : null;
}

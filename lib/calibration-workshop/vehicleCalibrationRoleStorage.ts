import "server-only";
import { createHmac } from "node:crypto";
import { createTrustedServerClient } from "@/lib/supabase/trustedServer";
import { resolveTrustedServerConfiguration } from "@/lib/supabase/trustedServerConfiguration";
import { SUBSCRIBER_CALIBRATION_BUCKET } from "./subscriberCalibrationStorage";

export type VehicleCalibrationRole = "reference" | "current";
export type VehicleCalibrationRoleAssignment = Readonly<{ version: 1; ownerId: string; vehicleId: string; role: VehicleCalibrationRole; tuneId: string; assignedAt: string; provenance: "explicit_user_assignment" }>;
const PREFIX = "vehicle-calibration-roles";
const path = (ownerId: string, vehicleId: string, role: VehicleCalibrationRole) => `${PREFIX}/${createHmac("sha256", resolveTrustedServerConfiguration(process.env).serviceRoleKey).update(`${ownerId}\0${vehicleId}\0${role}`).digest("base64url")}`;
const valid = (value: string) => /^[A-Za-z0-9_-]{8,128}$/.test(value);

export async function readVehicleCalibrationRole(ownerId: string, vehicleId: string, role: VehicleCalibrationRole): Promise<VehicleCalibrationRoleAssignment | null> {
  const { data, error } = await createTrustedServerClient().storage.from(SUBSCRIBER_CALIBRATION_BUCKET).download(path(ownerId, vehicleId, role));
  if (error || !data) return null;
  try { const value = JSON.parse(await data.text()) as VehicleCalibrationRoleAssignment; return value.version === 1 && value.ownerId === ownerId && value.vehicleId === vehicleId && value.role === role && valid(value.tuneId) && value.provenance === "explicit_user_assignment" ? Object.freeze(value) : null; }
  catch { return null; }
}

export async function assignVehicleCalibrationRole(input: Readonly<{ ownerId: string; vehicleId: string; role: VehicleCalibrationRole; tuneId: string; assignedAt?: string }>): Promise<VehicleCalibrationRoleAssignment> {
  if (![input.ownerId, input.vehicleId, input.tuneId].every(valid)) throw new Error("VEHICLE_CALIBRATION_ROLE_INVALID");
  const assignment = Object.freeze({ version: 1 as const, ownerId: input.ownerId, vehicleId: input.vehicleId, role: input.role, tuneId: input.tuneId, assignedAt: input.assignedAt ?? new Date().toISOString(), provenance: "explicit_user_assignment" as const });
  const { error } = await createTrustedServerClient().storage.from(SUBSCRIBER_CALIBRATION_BUCKET).upload(path(input.ownerId, input.vehicleId, input.role), new TextEncoder().encode(JSON.stringify(assignment)), { contentType: "application/octet-stream", cacheControl: "0", upsert: true });
  if (error) throw new Error("VEHICLE_CALIBRATION_ROLE_WRITE_FAILED");
  return assignment;
}

export const VEHICLE_CALIBRATION_ROLE_STORAGE = Object.freeze({ privateOnly: true, ownerVehicleScoped: true, objectKeys: "opaque_non_identifying", prefix: PREFIX, explicitAssignmentOnly: true });

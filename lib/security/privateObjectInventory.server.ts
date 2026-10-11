import "server-only";
import { createTrustedServerClient } from "../supabase/trustedServer";

/** The database verifies owner, active beta and deletion state atomically before
 * registering opaque paths. A storage trigger enforces the same state at write. */
export async function registerPrivateObjects(ownerId: string, vehicleId: string, paths: string[], expiresAt: number): Promise<void> {
  const { error } = await createTrustedServerClient().rpc("register_private_objects_v1", {
    p_owner_id: ownerId, p_vehicle_id: vehicleId, p_paths: paths, p_expires_at: new Date(expiresAt).toISOString(),
  });
  if (error) throw new Error("PRIVATE_OBJECT_INVENTORY_UNAVAILABLE");
}

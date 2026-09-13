import "server-only";
import { createTrustedServerClient } from "../supabase/trustedServer.ts";
import { createSupabaseAcquiredDefinitionPersistenceCore } from "./supabaseAcquiredDefinitionPersistenceCore.ts";

export { ACQUIRED_XDF_BUCKET } from "./supabaseAcquiredDefinitionPersistenceCore.ts";
export const createSupabaseAcquiredDefinitionPersistence = () => createSupabaseAcquiredDefinitionPersistenceCore(createTrustedServerClient());

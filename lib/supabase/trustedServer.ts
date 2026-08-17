import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { resolveTrustedServerConfiguration } from "./trustedServerConfiguration.ts";

export function createTrustedServerClient(): SupabaseClient {
  const configuration = resolveTrustedServerConfiguration(process.env);

  return createClient(
    configuration.supabaseUrl,
    configuration.serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

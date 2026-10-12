import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { resolveTrustedServerConfiguration } from "./trustedServerConfiguration.ts";
import { fetchWithTimeout } from "../security/networkTimeout.ts";

export function createTrustedServerClient(observeResponse?: (url: string, response: Response) => void): SupabaseClient {
  const configuration = resolveTrustedServerConfiguration(process.env);

  return createClient(
    configuration.supabaseUrl,
    configuration.serviceRoleKey,
    {
      global: { fetch: observeResponse ? async (input, init) => {
        const response = await fetchWithTimeout(input, init);
        observeResponse(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, response);
        return response;
      } : fetchWithTimeout },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

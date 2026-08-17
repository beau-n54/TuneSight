export type TrustedServerConfiguration = Readonly<{
  supabaseUrl: string;
  serviceRoleKey: string;
}>;

export function resolveTrustedServerConfiguration(
  environment: Readonly<Record<string, string | undefined>>
): TrustedServerConfiguration {
  const supabaseUrl = environment.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = environment.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl) {
    throw new Error("Trusted Supabase endpoint configuration is unavailable.");
  }

  if (!serviceRoleKey) {
    throw new Error("Trusted Supabase server configuration is unavailable.");
  }

  return Object.freeze({ supabaseUrl, serviceRoleKey });
}

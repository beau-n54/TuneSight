import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "../supabase/server";
import { betaAccessDecision, isSameOriginMutation, type BetaProfile } from "./accessPolicy";
import { boundedRequest, RequestBoundaryError } from "./requestBounds";

export async function subscriberAccess(client: SupabaseClient) {
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return { allowed: false as const, status: error && Number(error.status) >= 500 ? 503 : 401, destination: "/login", user: null, profile: null };
  const result = await client.from("profiles").select("legal_accepted,beta_access,beta_status,beta_expires_at,role").eq("id", user.id).single();
  const profile = result.error ? null : result.data as BetaProfile | null;
  const decision = betaAccessDecision(profile);
  if (decision !== "allowed") return { allowed: false as const, status: result.error ? 503 : 403, destination: decision === "legal_required" ? "/legal-acceptance" : "/beta-access", user: null, profile: null };
  return { allowed: true as const, status: 200, destination: null, user, profile: profile! };
}

// React cache is scoped to the render, never a process-wide entitlement cache.
export const requireSubscriberPage = cache(async () => {
  const supabase = await createClient();
  const access = await subscriberAccess(supabase);
  if (access.status === 503) throw new Error("Access service temporarily unavailable. Please retry.");
  if (!access.allowed) redirect(access.destination);
  return { supabase, user: access.user, profile: access.profile };
});

export async function requireSubscriberAction() {
  const incoming = await headers(), origin = incoming.get("origin"), host = incoming.get("x-forwarded-host") ?? incoming.get("host");
  if (!origin || !host || host.includes(",")) throw new Error("Same-origin action required.");
  let source: URL;
  try { source = new URL(origin); } catch { throw new Error("Same-origin action required."); }
  if (source.origin !== origin || source.host !== host || !["http:", "https:"].includes(source.protocol)) throw new Error("Same-origin action required.");
  return requireSubscriberPage();
}

/** Route-level authority runs before reading any request body; middleware is only an early check. */
export type SubscriberRequestAuthority = Readonly<{ supabase: SupabaseClient; user: User; profile: BetaProfile; authorizationMs: number }>;
export function protectSubscriberRequest(handler: (request: Request, authority: SubscriberRequestAuthority) => Promise<Response>, maxBytes: number) {
  return async (request: Request): Promise<Response> => {
    const headers = { "Cache-Control": "no-store" };
    try {
      if (!["GET", "HEAD"].includes(request.method) && !isSameOriginMutation(request)) return Response.json({ error: "Same-origin request required." }, { status: 403, headers });
      const authorizationStart = performance.now(), supabase = await createClient();
      const access = await subscriberAccess(supabase);
      if (!access.allowed) return Response.json({ error: access.status === 503 ? "Access could not be checked. Retry later." : access.status === 401 ? "Sign in required." : "Approved beta access required." }, { status: access.status, headers });
      // Validated for this invocation only: no browser-supplied authority and no
      // shared entitlement cache. Consumers can reuse the exact guarded identity.
      const authority = Object.freeze({ supabase, user: access.user, profile: access.profile,
        authorizationMs: performance.now() - authorizationStart });
      const response = await handler(await boundedRequest(request, maxBytes), authority);
      response.headers.set("Cache-Control", "no-store");
      return response;
    } catch (error) {
      const status = error instanceof RequestBoundaryError ? error.status : 503;
      return Response.json({ error: error instanceof RequestBoundaryError ? error.message : "Service temporarily unavailable. Retry later." }, { status, headers });
    }
  };
}

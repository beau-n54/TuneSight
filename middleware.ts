import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { betaAccessDecision } from "./lib/security/accessPolicy";
import { fetchWithTimeout } from "./lib/security/networkTimeout";

export async function middleware(req: NextRequest) {
  try {
  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: fetchWithTimeout },
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookies) {
          cookies.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          cookies.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();
  if (authenticationError && Number(authenticationError.status) >= 500) throw new Error("AUTH_SERVICE_UNAVAILABLE");

  const redirectWithCookies = (destination: string) => {
    const response = NextResponse.redirect(new URL(destination, req.url));
    res.cookies.getAll().forEach(cookie => response.cookies.set(cookie));
    response.headers.set("Cache-Control", "no-store");
    return response;
  };
  if (!user) {
    return redirectWithCookies(`/login?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`);
  }

  const { data: profile, error } = await supabase.from("profiles").select("legal_accepted,beta_access,beta_status,beta_expires_at,role").eq("id", user.id).single();
  if (error) throw new Error("ACCESS_PROFILE_UNAVAILABLE");
  const access = betaAccessDecision(error ? null : profile);
  if (access !== "allowed") return redirectWithCookies(access === "legal_required" ? "/legal-acceptance" : "/beta-access");
  res.headers.set("Cache-Control", "no-store");

  return res;
  } catch { return new NextResponse("Sign-in service temporarily unavailable. Please retry.", { status: 503, headers: { "Cache-Control": "no-store" } }); }
}

// Explicit static matchers include nested pages. APIs independently authorize.
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/garage/:path*",
    "/account/:path*",
    "/vehicle/:path*",
    "/mods/:path*",
    "/logs/:path*",
    "/checkout/:path*",
  ],
};

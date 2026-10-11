import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeReturnPath } from "@/lib/security/accessPolicy";
import type { EmailOtpType } from "@supabase/supabase-js";
import { fetchWithTimeout } from "@/lib/security/networkTimeout";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);

  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const next = safeReturnPath(requestUrl.searchParams.get("next"));

  const response = NextResponse.redirect(new URL(next, requestUrl.origin));

  if (!tokenHash || !type || !["signup", "invite", "magiclink", "recovery", "email_change", "email"].includes(type)) {
    return NextResponse.redirect(
      new URL("/login?message=Invalid reset link", requestUrl.origin), { headers: { "Cache-Control": "no-store" } }
    );
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: fetchWithTimeout },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as EmailOtpType,
  }).catch(() => ({ error: true }));

  if (error) {
    const failed = NextResponse.redirect(
      new URL("/login?message=Recovery%20link%20could%20not%20be%20verified.%20Retry%20or%20request%20a%20fresh%20link.", requestUrl.origin), { headers: { "Cache-Control": "no-store" } }
    );
    response.cookies.getAll().forEach(cookie => failed.cookies.set(cookie));
    return failed;
  }

  response.headers.set("Cache-Control", "no-store");
  return response;
}

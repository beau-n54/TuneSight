import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeReturnPath } from "@/lib/security/accessPolicy";
import { fetchWithTimeout } from "@/lib/security/networkTimeout";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeReturnPath(requestUrl.searchParams.get("next"));

  let response = NextResponse.redirect(new URL(next, requestUrl.origin));

  if (!code) return NextResponse.redirect(new URL("/login?message=Invalid%20sign-in%20link", requestUrl.origin), { headers: { "Cache-Control": "no-store" } });
  if (code) {
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

    const { error } = await supabase.auth.exchangeCodeForSession(code).catch(() => ({ error: true }));

    if (error) {
      const failed = NextResponse.redirect(
        new URL("/login?message=Sign-in%20link%20could%20not%20be%20verified.%20Retry%20or%20request%20a%20fresh%20link.", requestUrl.origin)
      );
      response.cookies.getAll().forEach(cookie => failed.cookies.set(cookie));
      response = failed;
    }
  }

  response.headers.set("Cache-Control", "no-store");
  return response;
}

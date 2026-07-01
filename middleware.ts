import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookies) {
          cookies.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 🚫 If NOT logged in → kick to login
  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return res;
}

// 👇 Protect ONLY these routes
export const config = {
  matcher: [
    "/dashboard",
    "/garage",
    "/account",
    "/vehicle",
    "/mods",
    "/logs",
  ],
};
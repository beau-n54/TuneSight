"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { safeReturnPath } from "@/lib/security/accessPolicy";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [message, setMessage] = useState("");
  const pending = useRef(false);

  function getPasswordResetRedirectUrl() {
    return `${window.location.origin}/auth/callback?next=/reset-password`;
  }

  async function handleLogin() {
    if (pending.current) return;
    pending.current = true;
    setLoading(true);
    setMessage("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) { setMessage("Sign in failed. Check your registered email, password and connection, then retry."); return; }
      // A fresh server request checks legal acceptance, suspension and beta expiry.
      const next = safeReturnPath(new URLSearchParams(window.location.search).get("next"));
      router.replace(next);
      router.refresh();
    } catch { setMessage("Sign in could not complete. Check your connection and retry."); }
    finally { pending.current = false; setLoading(false); }
  }

  async function handleForgotPassword() {
    if (pending.current) return;
    setMessage("");

    if (!email) {
      setMessage("Enter your email address first, then press Forgot Password.");
      return;
    }

    setResetLoading(true);
    pending.current = true;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: getPasswordResetRedirectUrl() });
      setMessage(error ? "Reset request could not complete. Check your connection and retry." : "If this is your registered address, check your inbox for the password reset link.");
    } catch { setMessage("Reset request could not complete. Check your connection and retry."); }
    finally { pending.current = false; setResetLoading(false); }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <div className="bmw-border w-full max-w-md rounded-2xl bg-zinc-900 p-8">
        <Link href="/" className="text-zinc-400 transition hover:text-white">
          ← Back to Home
        </Link>

        <h1 className="mb-4 mt-8 text-4xl font-bold">Member Login</h1>

        <p className="mb-8 text-zinc-400">Login with your TuneSight account.</p>

        <input
          id="login-email"
          name="email"
          aria-label="Registered email"
          autoComplete="email"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mb-4 w-full rounded-xl border border-zinc-700 bg-black p-4"
        />

        <input
          id="login-password"
          name="password"
          aria-label="Password"
          autoComplete="current-password"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mb-6 w-full rounded-xl border border-zinc-700 bg-black p-4"
        />

        <button
          type="button"
          onClick={handleLogin}
          disabled={loading || resetLoading}
          className="w-full rounded-xl bg-white py-4 font-semibold text-black transition hover:opacity-80 disabled:opacity-50"
        >
          {loading ? "Logging In..." : "Login"}
        </button>

        <button
          type="button"
          onClick={handleForgotPassword}
          disabled={loading || resetLoading}
          className="mt-4 w-full text-sm text-zinc-400 transition hover:text-white disabled:opacity-50"
        >
          {resetLoading ? "Sending reset email..." : "Forgot Password?"}
        </button>

        {message && <p className="mt-6 text-sm text-zinc-300">{message}</p>}
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  plan: string | null;
  subscription_status: string | null;
  legal_accepted: boolean | null;
  beta_access: boolean | null;
  beta_status: string | null;
};

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [message, setMessage] = useState("");

  function getPasswordResetRedirectUrl() {
    return `${window.location.origin}/auth/callback?next=/reset-password`;
  }

  async function handleLogin() {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const user = data.user;

    if (!user) {
      setMessage("Login failed. No user returned.");
      setLoading(false);
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select(
        "plan, subscription_status, legal_accepted, beta_access, beta_status"
      )
      .eq("id", user.id)
      .single();

    const profile = profileData as Profile | null;

    if (profileError || !profile) {
      setMessage(profileError?.message || "Profile not found.");
      setLoading(false);
      return;
    }

    localStorage.setItem("ts_plan", profile.plan || "starter");

    router.refresh();

    if (!profile.legal_accepted) {
      router.push("/legal-acceptance");
      return;
    }

    if (!profile.beta_access || profile.beta_status === "suspended") {
      router.push("/beta-access");
      return;
    }

    router.push("/dashboard");
  }

  async function handleForgotPassword() {
    setMessage("");

    if (!email) {
      setMessage("Enter your email address first, then press Forgot Password.");
      return;
    }

    setResetLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getPasswordResetRedirectUrl(),
    });

    if (error) {
      setMessage(error.message);
      setResetLoading(false);
      return;
    }

    setMessage("Password reset email sent. Check your inbox.");
    setResetLoading(false);
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
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mb-4 w-full rounded-xl border border-zinc-700 bg-black p-4"
        />

        <input
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
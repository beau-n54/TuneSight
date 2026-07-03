"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "../../lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [message, setMessage] = useState("");

  const getPasswordResetRedirectUrl = () => {
  return `${window.location.origin}/auth/callback?next=/reset-password`;
};

  const handleLogin = async () => {
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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("plan, subscription_status")
      .eq("id", user.id)
      .single();

    if (profileError) {
      setMessage(profileError.message);
      setLoading(false);
      return;
    }

    if (profile.subscription_status !== "active") {
      await supabase.auth.signOut();
      setMessage("Your subscription is not active yet.");
      setLoading(false);
      return;
    }

    localStorage.setItem("ts_plan", profile.plan || "starter");

    router.refresh();
    router.push("/dashboard");
  };

  const handleForgotPassword = async () => {
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
  };

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="bmw-border max-w-md w-full bg-zinc-900 rounded-2xl p-8">
        <Link href="/" className="text-zinc-400 hover:text-white transition">
          ← Back to Home
        </Link>

        <h1 className="text-4xl font-bold mt-8 mb-4">Member Login</h1>

        <p className="text-zinc-400 mb-8">
          Login with your TuneSight account.
        </p>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-4 p-4 rounded-xl bg-black border border-zinc-700"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-6 p-4 rounded-xl bg-black border border-zinc-700"
        />

        <button
          onClick={handleLogin}
          disabled={loading || resetLoading}
          className="w-full py-4 rounded-xl bg-white text-black font-semibold hover:opacity-80 transition disabled:opacity-50"
        >
          {loading ? "Logging In..." : "Login"}
        </button>

        <button
          onClick={handleForgotPassword}
          disabled={loading || resetLoading}
          className="w-full mt-4 text-sm text-zinc-400 hover:text-white transition disabled:opacity-50"
        >
          {resetLoading ? "Sending reset email..." : "Forgot Password?"}
        </button>

        {message && (
          <p className="mt-6 text-sm text-zinc-300">
            {message}
          </p>
        )}
      </div>
    </main>
  );
}
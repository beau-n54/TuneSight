"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "../../lib/supabase/client";

export default function ResetPasswordPage() {
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleUpdatePassword = async () => {
    setMessage("");

    if (!password || !confirmPassword) {
      setMessage("Please enter and confirm your new password.");
      return;
    }

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setMessage("Password updated successfully. You can now log in.");
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="bmw-border max-w-md w-full bg-zinc-900 rounded-2xl p-8">
        <Link href="/login" className="text-zinc-400 hover:text-white transition">
          ← Back to Login
        </Link>

        <h1 className="text-4xl font-bold mt-8 mb-4">Reset Password</h1>

        <p className="text-zinc-400 mb-8">
          Enter your new TuneSight password below.
        </p>

        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-4 p-4 rounded-xl bg-black border border-zinc-700"
        />

        <input
          type="password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full mb-6 p-4 rounded-xl bg-black border border-zinc-700"
        />

        <button
          onClick={handleUpdatePassword}
          disabled={loading}
          className="w-full py-4 rounded-xl bg-white text-black font-semibold hover:opacity-80 transition disabled:opacity-50"
        >
          {loading ? "Updating Password..." : "Update Password"}
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
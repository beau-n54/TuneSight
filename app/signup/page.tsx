"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [plan, setPlan] = useState("starter");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSignup() {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase.auth.signUp({
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
      setMessage("Signup completed, but no user was returned.");
      setLoading(false);
      return;
    }

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: user.id,
      full_name: fullName,
      plan,
      subscription_status: "inactive",
      legal_accepted: false,
      legal_version: null,
      accepted_at: null,
      beta_access: false,
      beta_status: "awaiting",
      beta_plan: plan,
      beta_expires_at: null,
    });

    if (profileError) {
      setMessage(profileError.message);
      setLoading(false);
      return;
    }

    localStorage.setItem("ts_plan", plan);

    router.push("/legal-acceptance");
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6 py-16">
      <div className="bmw-border max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
        <Link href="/" className="text-zinc-400 hover:text-white transition">
          ← Back to Home
        </Link>

        <h1 className="text-4xl font-bold mt-8 mb-4">Create Account</h1>

        <p className="text-zinc-400 mb-8">
          Create your TuneSight account and begin the beta onboarding process.
        </p>

        <input
          type="text"
          placeholder="Full Name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          className="w-full mb-4 p-4 rounded-xl bg-black border border-zinc-700"
        />

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full mb-4 p-4 rounded-xl bg-black border border-zinc-700"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full mb-4 p-4 rounded-xl bg-black border border-zinc-700"
        />

        <select
          value={plan}
          onChange={(event) => setPlan(event.target.value)}
          className="w-full mb-6 p-4 rounded-xl bg-black border border-zinc-700"
        >
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="workshop">Workshop</option>
        </select>

        <button
          type="button"
          onClick={handleSignup}
          disabled={loading}
          className="w-full py-4 rounded-xl bg-white text-black font-semibold hover:opacity-80 transition disabled:opacity-50"
        >
          {loading ? "Creating Account..." : "Create Account"}
        </button>

        {message && <p className="mt-6 text-sm text-zinc-300">{message}</p>}
      </div>
    </main>
  );
}
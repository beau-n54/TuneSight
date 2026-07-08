"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  legal_accepted: boolean | null;
  beta_access: boolean | null;
  beta_status: string | null;
  beta_plan: string | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [plan, setPlan] = useState("starter");
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);

  useEffect(() => {
    async function checkDashboardAccess() {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push("/login");
        return;
      }

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("legal_accepted, beta_access, beta_status, beta_plan")
        .eq("id", user.id)
        .single();

      const profile = data as Profile | null;

      if (profileError || !profile) {
        router.push("/legal-acceptance");
        return;
      }

      if (!profile.legal_accepted) {
        router.push("/legal-acceptance");
        return;
      }

      if (!profile.beta_access || profile.beta_status === "suspended") {
        router.push("/beta-access");
        return;
      }

      setPlan(profile.beta_plan || localStorage.getItem("ts_plan") || "starter");
      setIsCheckingAccess(false);
    }

    checkDashboardAccess();
  }, [router, supabase]);

  if (isCheckingAccess) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-5xl">
          <div className="bmw-border rounded-2xl bg-zinc-900 p-8">
            Checking dashboard access...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-4 text-5xl font-bold">Dashboard</h1>

        <p className="mb-2 text-zinc-400">Welcome to TuneSight.</p>

        <p className="mb-10 text-zinc-400">
          Current Plan:{" "}
          <span className="font-semibold capitalize text-white">{plan}</span>
        </p>

        <div className="grid gap-6 md:grid-cols-3">
          <Link
            href="/garage"
            className="bmw-border block rounded-2xl bg-zinc-900 p-8 transition hover:scale-[1.02] hover:border-white"
          >
            <h2 className="mb-2 text-2xl font-semibold">Garage</h2>
            <p className="text-zinc-400">
              View and manage your vehicles, logs, modifications, and tunes.
            </p>
          </Link>

          <Link
            href="/logs"
            className="bmw-border block rounded-2xl bg-zinc-900 p-8 transition hover:scale-[1.02] hover:border-white"
          >
            <h2 className="mb-2 text-2xl font-semibold">Upload Log</h2>
            <p className="text-zinc-400">
              Quickly upload and analyse a new MHD log file.
            </p>
          </Link>

          <Link
            href="/account"
            className="bmw-border rounded-2xl bg-zinc-900 p-8 transition hover:opacity-90"
          >
            <h2 className="mb-2 text-2xl font-semibold">Account</h2>
            <p className="text-zinc-400">
              Manage your login, subscription, billing, and support options.
            </p>
          </Link>
        </div>

        {plan === "starter" && (
          <div className="bmw-border mt-10 rounded-2xl bg-zinc-900 p-8">
            <h2 className="mb-2 text-2xl font-semibold">Starter Features</h2>
            <p className="text-zinc-400">
              Single vehicle workflow, log upload, core insights, and basic
              setup tracking.
            </p>
          </div>
        )}

        {plan === "pro" && (
          <div className="bmw-border mt-10 rounded-2xl bg-zinc-900 p-8">
            <h2 className="mb-2 text-2xl font-semibold">Pro Features</h2>
            <p className="text-zinc-400">
              Multiple vehicle support, unlimited log uploads, tune file upload,
              and log-to-tune cross-referencing.
            </p>
          </div>
        )}

        {plan === "workshop" && (
          <div className="bmw-border mt-10 rounded-2xl bg-zinc-900 p-8">
            <h2 className="mb-2 text-2xl font-semibold">Workshop Features</h2>
            <p className="text-zinc-400">
              Team workflow, customer vehicle management, unlimited uploads, and
              workshop-level tune/log organisation.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
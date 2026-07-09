"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type BetaStatus = "approved" | "awaiting" | "suspended" | string;

type Profile = {
  legal_accepted: boolean | null;
  beta_access: boolean | null;
  beta_status: BetaStatus | null;
  beta_plan: string | null;
  beta_expires_at: string | null;
};

export default function BetaAccessPage() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfile() {
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
        .select(
          "legal_accepted, beta_access, beta_status, beta_plan, beta_expires_at"
        )
        .eq("id", user.id)
        .single();

      if (profileError) {
        setError(profileError.message);
        setIsLoading(false);
        return;
      }

      if (!data?.legal_accepted) {
        router.push("/legal-acceptance");
        return;
      }

      setProfile(data);
      setIsLoading(false);
    }

    loadProfile();
  }, [router, supabase]);

  const isApproved =
    profile?.beta_access === true && profile?.beta_status !== "suspended";

  const isSuspended = profile?.beta_status === "suspended";
  const isAwaiting = !isApproved && !isSuspended;

  return (
    <main className="min-h-screen bg-black px-6 py-12 text-white">
      <div className="mx-auto flex max-w-4xl flex-col">
        <p className="mb-3 text-sm uppercase tracking-[0.3em] text-cyan-400">
          TuneSight Beta Access
        </p>

        <h1 className="mb-4 text-4xl font-bold">Beta Access Status</h1>

        <p className="mb-8 text-zinc-400">
          TuneSight checks your beta access status before unlocking the
          diagnostic platform.
        </p>

        {isLoading && (
          <div className="bmw-border rounded-2xl bg-zinc-900 p-8 text-zinc-300">
            Checking your beta access...
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-red-400">
            {error}
          </div>
        )}

        {!isLoading && !error && profile && (
          <>
            {isApproved && (
              <section className="bmw-border rounded-2xl bg-zinc-900 p-8">
                <p className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
                  Approved
                </p>

                <h2 className="text-2xl font-bold text-white">
                  Your TuneSight beta access is active.
                </h2>

                <p className="mt-4 text-zinc-400">
                  You can now enter the TuneSight dashboard and begin using the
                  beta diagnostic platform.
                </p>

                {profile.beta_plan && (
                  <p className="mt-4 text-sm text-zinc-400">
                    Plan: {profile.beta_plan}
                  </p>
                )}

                {profile.beta_expires_at && (
                  <p className="mt-2 text-sm text-zinc-400">
                    Beta expires:{" "}
                    {new Date(profile.beta_expires_at).toLocaleDateString()}
                  </p>
                )}

                <Link
                  href="/dashboard"
                  className="mt-8 inline-flex rounded-xl bg-cyan-500 px-6 py-4 font-semibold text-white transition hover:bg-cyan-600"
                >
                  Enter Dashboard
                </Link>
              </section>
            )}

            {isAwaiting && (
              <section className="bmw-border rounded-2xl bg-zinc-900 p-8">
                <p className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-yellow-400">
                  Awaiting Approval
                </p>

                <h2 className="text-2xl font-bold text-white">
                  Your beta access request is being reviewed.
                </h2>

                <p className="mt-4 text-zinc-400">
                  Your legal acceptance has been saved. TuneSight beta access is
                  currently awaiting approval.
                </p>

                <p className="mt-4 text-sm text-zinc-400">
                  Once approved, this page will automatically unlock dashboard
                  access.
                </p>
              </section>
            )}

            {isSuspended && (
              <section className="bmw-border rounded-2xl bg-zinc-900 p-8">
                <p className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-red-400">
                  Access Suspended
                </p>

                <h2 className="text-2xl font-bold text-white">
                  Your TuneSight beta access is currently suspended.
                </h2>

                <p className="mt-4 text-zinc-400">
                  Please contact TuneSight support if you believe this is a
                  mistake or need your beta access reviewed.
                </p>

                <Link
                  href="/support"
                  className="mt-8 inline-flex rounded-xl bg-cyan-500 px-6 py-4 font-semibold text-white transition hover:bg-cyan-600"
                >
                  Contact Support
                </Link>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
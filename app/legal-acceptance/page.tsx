"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LEGAL_VERSION = "1.0";

export default function LegalAcceptancePage() {
  const router = useRouter();
  const supabase = createClient();

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleAccept() {
    setIsSaving(true);
    setError("");

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      router.push("/login");
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        legal_accepted: true,
        legal_version: LEGAL_VERSION,
        accepted_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      setError(updateError.message);
      setIsSaving(false);
      return;
    }

    router.push("/beta-access");
  }

  return (
    <main className="min-h-screen bg-black px-6 py-12 text-white">
      <div className="mx-auto flex max-w-4xl flex-col">
        <p className="mb-3 text-sm uppercase tracking-[0.3em] text-cyan-400">
          TuneSight Legal Review
        </p>

        <h1 className="mb-4 text-4xl font-bold">Legal Review</h1>

        <p className="mb-8 text-zinc-400">
          Before accessing the TuneSight Beta you must review and accept the
          Legal Disclaimer, Terms & Conditions and Privacy Policy.
        </p>

        <div className="space-y-4">
          <a
            href="/legal"
            className="bmw-border block rounded-2xl bg-zinc-900 p-5 transition hover:bg-zinc-800"
          >
            <h2 className="font-semibold text-white">Legal Disclaimer</h2>
            <p className="text-sm text-zinc-400">
              Read the TuneSight Legal Disclaimer.
            </p>
          </a>

          <a
            href="/terms"
            className="bmw-border block rounded-2xl bg-zinc-900 p-5 transition hover:bg-zinc-800"
          >
            <h2 className="font-semibold text-white">Terms & Conditions</h2>
            <p className="text-sm text-zinc-400">
              Review the Terms & Conditions.
            </p>
          </a>

          <a
            href="/privacy"
            className="bmw-border block rounded-2xl bg-zinc-900 p-5 transition hover:bg-zinc-800"
          >
            <h2 className="font-semibold text-white">Privacy Policy</h2>
            <p className="text-sm text-zinc-400">
              Review how TuneSight stores and protects your information.
            </p>
          </a>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-400">
            {error}
          </div>
        )}

        <button
          onClick={handleAccept}
          disabled={isSaving}
          className="mt-10 rounded-xl bg-cyan-500 px-6 py-4 font-semibold text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Accept & Continue"}
        </button>
      </div>
    </main>
  );
}
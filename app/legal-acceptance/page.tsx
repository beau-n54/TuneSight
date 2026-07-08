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
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-12">
      <h1 className="mb-4 text-4xl font-bold">
        Legal Review
      </h1>

      <p className="mb-8 text-muted-foreground">
        Before accessing the TuneSight Beta you must review and accept the
        Legal Disclaimer, Terms & Conditions and Privacy Policy.
      </p>

      <div className="space-y-4">

        <a
          href="/legal"
          className="block rounded-xl border p-5 hover:bg-muted/40 transition"
        >
          <h2 className="font-semibold">Legal Disclaimer</h2>
          <p className="text-sm text-muted-foreground">
            Read the TuneSight Legal Disclaimer.
          </p>
        </a>

        <a
          href="/terms"
          className="block rounded-xl border p-5 hover:bg-muted/40 transition"
        >
          <h2 className="font-semibold">Terms & Conditions</h2>
          <p className="text-sm text-muted-foreground">
            Review the Terms & Conditions.
          </p>
        </a>

        <a
          href="/privacy"
          className="block rounded-xl border p-5 hover:bg-muted/40 transition"
        >
          <h2 className="font-semibold">Privacy Policy</h2>
          <p className="text-sm text-muted-foreground">
            Review how TuneSight stores and protects your information.
          </p>
        </a>

      </div>

      {error && (
        <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-500">
          {error}
        </div>
      )}

      <button
        onClick={handleAccept}
        disabled={isSaving}
        className="mt-10 rounded-xl bg-cyan-500 px-6 py-4 font-semibold text-white transition hover:bg-cyan-600 disabled:opacity-60"
      >
        {isSaving ? "Saving..." : "Accept & Continue"}
      </button>
    </main>
  );
}
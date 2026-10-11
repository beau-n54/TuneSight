"use client";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LogoutControl() {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  async function logout() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setMessage("");
    try {
      const { error } = await createClient().auth.signOut({ scope: "local" });
      if (error) { setMessage("Sign out did not complete. Check your connection and retry."); return; }
      // Full navigation discards subscriber React state and in-memory bridge tokens.
      window.location.replace("/login");
    } catch { setMessage("Sign out did not complete. Check your connection and retry."); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div className="mt-6"><button onClick={logout} disabled={busy} className="rounded-xl border border-zinc-600 px-5 py-3 disabled:opacity-50">{busy ? "Signing out…" : "Sign out"}</button>{message && <p role="alert" className="mt-2 text-amber-300">{message}</p>}</div>;
}

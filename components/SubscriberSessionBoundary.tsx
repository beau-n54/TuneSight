"use client";
import { useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

/** A different login in another tab must not keep the old owner's rendered
 * evidence or local-recording controls visible. RLS/server checks remain authority. */
export default function SubscriberSessionBoundary({ ownerId, children }: { ownerId: string; children: ReactNode }) {
  const [changed, setChanged] = useState(false);
  useEffect(() => {
    const { data: { subscription } } = createClient().auth.onAuthStateChange((_event, session) => {
      if (session?.user.id !== ownerId) { setChanged(true); window.location.replace("/login"); }
    });
    return () => subscription.unsubscribe();
  }, [ownerId]);
  return changed ? <p role="status">Session changed. Returning to sign in.</p> : children;
}

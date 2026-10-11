"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function RestoreCalibrationSession({ vehicleId }: { vehicleId: string }) {
  const router = useRouter(), pending = useRef(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  async function restore() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/vehicles/calibration-role?vehicleId=${encodeURIComponent(vehicleId)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "repair_session" }), signal: AbortSignal.timeout(60_000) });
      const result = await response.json();
      if (!response.ok || typeof result.session !== "string") { setMessage("Saved Current Calibration could not be restored. Its evidence has not been removed. Retry later or open the source file."); return; }
      router.replace(`/dashboard/vehicles/${encodeURIComponent(vehicleId)}/calibration?session=${encodeURIComponent(result.session)}`);
      router.refresh();
    } catch { setMessage("Restore did not complete. Keep existing evidence and retry later."); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div className="mt-3"><button type="button" disabled={busy} onClick={restore} className="rounded-lg border border-blue-400 px-4 py-2 text-sm text-blue-200">{busy ? "Restoring saved Current…" : "Restore saved Current Calibration"}</button><p className="mt-2 text-xs text-zinc-400">Explicitly rebuild a session from this vehicle’s assigned Current Tune. No evidence is changed by simply opening this page.</p>{message && <p role="alert" className="mt-2 text-sm text-amber-200">{message}</p>}</div>;
}

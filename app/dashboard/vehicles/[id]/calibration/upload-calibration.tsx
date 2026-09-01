"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export default function UploadCalibration({ vehicleId }: { vehicleId: string }) {
  const router = useRouter(), input = useRef<HTMLInputElement>(null), [pending, setPending] = useState(false), [error, setError] = useState<string | null>(null);
  async function upload(file: File) { setPending(true); setError(null); try { const form = new FormData(); form.set("vehicleId", vehicleId); form.set("calibration", file); const response = await fetch("/api/calibration-workshop/upload", { method: "POST", body: form, cache: "no-store" }); const payload = await response.json() as { session?: string; error?: string }; if (!response.ok || !payload.session) throw new Error(payload.error ?? "Calibration upload failed."); router.push(`/dashboard/vehicles/${encodeURIComponent(vehicleId)}/calibration?session=${encodeURIComponent(payload.session)}`); } catch (value) { setError(value instanceof Error ? value.message : "Calibration upload failed."); } finally { setPending(false); if (input.current) input.current.value = ""; } }
  return <div><input ref={input} type="file" accept=".bin,.dtf" className="sr-only" onChange={event=>{const file=event.target.files?.[0];if(file)void upload(file)}}/><button type="button" disabled={pending} onClick={()=>input.current?.click()} className="rounded-lg border border-blue-400/50 bg-blue-400/10 px-4 py-2 text-sm font-semibold text-blue-100 disabled:opacity-50">{pending?"Opening Calibration…":"Open Calibration File"}</button>{error&&<p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}<p className="mt-2 text-xs text-zinc-500">Supported containers are validated server-side; extension alone does not establish support. Maximum 32 MiB.</p></div>;
}

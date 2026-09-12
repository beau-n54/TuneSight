"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { calibrationWorkshopPath, subscriberWorkshopSessionPath } from "@/lib/calibration-workshop/subscriberUploadNavigation";
import { createClient } from "@/lib/supabase/client";
import { decodeSubscriberUploadResponse } from "@/lib/calibration-workshop/subscriberUploadContract";

export default function UploadCalibration({ vehicleId }: { vehicleId: string }) {
  const router = useRouter(), input = useRef<HTMLInputElement>(null), [pending, setPending] = useState(false), [error, setError] = useState<string | null>(null);
  const workshopPath = calibrationWorkshopPath(vehicleId);
  function chooseFile() { window.history.replaceState(window.history.state, "", workshopPath); input.current?.click(); }
  async function upload(file: File) { setPending(true); setError(null); try {
    const extension = file.name.toLowerCase().endsWith(".dtf") ? "dtf" : file.name.toLowerCase().endsWith(".bin") ? "bin" : null;
    if (!extension) throw new Error("Choose a BIN or DTF calibration file.");
    const prepareResponse = await fetch("/api/calibration-workshop/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "prepare", vehicleId, byteLength: file.size, extension }), cache: "no-store" });
    const prepared = await decodeSubscriberUploadResponse(prepareResponse);
    if (prepared.outcome !== "upload_ready") throw new Error("Private calibration upload could not be prepared.");
    const { error: uploadError } = await createClient().storage.from("subscriber-calibration-private").uploadToSignedUrl(prepared.uploadPath, prepared.uploadToken, file, { contentType: "application/octet-stream", cacheControl: "0" });
    if (uploadError) throw new Error("Private calibration upload failed before processing.");
    const processResponse = await fetch("/api/calibration-workshop/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "process", vehicleId, lease: prepared.lease }), cache: "no-store" });
    const processed = await decodeSubscriberUploadResponse(processResponse);
    if (!("session" in processed)) throw new Error("Calibration processing did not issue a Workshop session.");
    router.replace(subscriberWorkshopSessionPath(vehicleId, processed.session));
  } catch (value) { setError(value instanceof Error ? value.message : "Calibration upload failed."); } finally { setPending(false); if (input.current) input.current.value = ""; } }
  return <div><input ref={input} type="file" accept=".bin,.dtf" className="sr-only" onChange={event=>{const file=event.target.files?.[0];if(file)void upload(file)}}/><button type="button" disabled={pending} onClick={chooseFile} className="rounded-lg border border-blue-400/50 bg-blue-400/10 px-4 py-2 text-sm font-semibold text-blue-100 disabled:opacity-50">{pending?"Opening Calibration…":"Open Calibration File"}</button>{error&&<p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}<p className="mt-2 text-xs text-zinc-500">Supported containers are validated server-side; extension alone does not establish support. Maximum 32 MiB.</p></div>;
}

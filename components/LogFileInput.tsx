"use client";

import { validLogUpload } from "@/lib/security/uploadPolicy";

export default function LogFileInput() {
  return <div className="space-y-2">
    <label htmlFor="logFile" className="text-sm text-zinc-400">Log File</label>
    <input id="logFile" type="file" name="logFile" accept=".csv,text/csv" required
      aria-describedby="log-upload-limit"
      onChange={event => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.setCustomValidity(file && !validLogUpload(file) ? "Choose a non-empty CSV log up to 4 MiB." : "");
        event.currentTarget.reportValidity();
      }}
      className="cursor-pointer block w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white file:cursor-pointer file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-4 file:py-2 file:text-white hover:file:bg-zinc-700" />
    <p id="log-upload-limit" className="text-sm text-zinc-400">CSV only, up to 4 MiB. Larger logs are not accepted by this hosted upload path.</p>
  </div>;
}

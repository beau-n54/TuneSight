"use client";

import { useState } from "react";

export default function LiveBridgeControls({ state, finding, manualToken, onManualToken, onConnect, onDisconnect }: {
  state: "disconnected" | "connecting" | "connected" | "disconnecting" | "failed";
  finding: string; manualToken: string; onManualToken: (value: string) => void;
  onConnect: () => void; onDisconnect: () => void;
}) {
  const [advanced, setAdvanced] = useState(false);
  const busy = state === "connecting" || state === "disconnecting";
  return <div className="max-w-xl space-y-3">
    <p role="status" className="text-sm text-zinc-300">{finding}</p>
    <div className="flex flex-wrap gap-3">
      <button onClick={onConnect} disabled={busy || state === "connected"} className="rounded-xl bg-blue-500 px-5 py-3 font-semibold text-white disabled:opacity-50">{state === "connecting" ? "Connecting…" : "Connect BMW"}</button>
      <button onClick={onDisconnect} disabled={busy || state !== "connected"} className="rounded-xl border border-zinc-600 px-5 py-3 disabled:opacity-50">{state === "disconnecting" ? "Disconnecting…" : "Disconnect"}</button>
      <button onClick={() => setAdvanced(value => !value)} disabled={busy || state === "connected"} aria-expanded={advanced} className="rounded-xl px-3 py-3 text-sm text-zinc-400 disabled:opacity-50">Advanced</button>
    </div>
    {advanced && <div className="rounded-xl border border-zinc-700 p-3">
      <label className="text-xs text-zinc-400">Bridge token (manual fallback)<input aria-label="Bridge token" type="password" value={manualToken} onChange={event => onManualToken(event.target.value)} autoComplete="off" disabled={busy || state === "connected"} className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-white" /></label>
      <p className="mt-2 text-xs text-zinc-400">For an older bridge with a locally supplied token. Leave blank for automatic pairing. Tokens stay in page memory only.</p>
    </div>}
  </div>;
}

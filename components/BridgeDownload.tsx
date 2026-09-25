"use client";

import { useState } from "react";
import { createLocalBridgeClient, bridgeFailureMessage } from "@/lib/vehicle-interface/localBridgeClient";
import { publicBridgeRelease } from "@/lib/vehicle-interface/bridgeRelease";
import releases from "@/public/bridge/releases.json";
import { DESKTOP_BRIDGE_VERSION } from "@/lib/vehicle-interface/bridgeVersion";

export default function BridgeDownload() {
  const release = publicBridgeRelease(releases);
  const [client] = useState(() => createLocalBridgeClient());
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState("Installed status unknown. Check the bridge on this laptop when ready.");
  return <section className="rounded-2xl border border-blue-400/60 bg-zinc-900 p-6 shadow-[inset_3px_0_0_#81c4ff,inset_-3px_0_0_#e7222e]">
    <h1 className="text-2xl font-semibold">TuneSight Bridge for Windows</h1>
    <p className="mt-3 text-zinc-300">Connect your BMW to hosted TuneSight through a read-only bridge on this laptop.</p>
    {release && <div className="mt-4 space-y-2"><a className="text-blue-300 underline" href={release.url}>Download TuneSight Bridge {release.version} for Windows</a><p className="break-all text-xs">SHA-256: {release.sha256}</p><p className="text-sm">Signed installer · {release.bytes.toLocaleString()} bytes</p></div>}
    {!release && <><p className="mt-4">Founder beta: {DESKTOP_BRIDGE_VERSION}. Public installer release pending.</p>
    <p className="mt-2 text-sm text-zinc-400">Download and SHA-256 checksum will appear with a verified public installer release. The unsigned draft is for Founder testing and is not yet subscriber-ready.</p></>}
    <ol className="mt-5 list-decimal space-y-2 pl-6 text-zinc-300">
      <li>Install the approved Windows x64 package when available. Node.js and command-line tools are not required.</li>
      <li>Keep Start with Windows enabled, or open TuneSight Bridge from the Start menu. Look for its notification tray icon.</li>
      <li>Connect a direct ENET cable and turn on vehicle ignition. Windows automatically assigns the Ethernet link-local address; Wi-Fi can provide internet access.</li>
      <li>Open Live Telemetry, allow Local Network Access for this site when asked, then press Connect BMW.</li>
    </ol>
    <p role="status" className="mt-5 text-sm">{status}</p>
    <button type="button" disabled={checking} onClick={async () => {
      if (checking) return; setChecking(true);
      try {
        // A fresh authenticated status read prevents a cached pairing from claiming a stopped bridge is running.
        await client.call("/v1/status"); const version = client.version();
        setStatus(version?.desktopVersion ? `Installed and running: TuneSight Bridge ${version.desktopVersion}. Compatible with this page.` : "Local bridge running with the legacy Node workflow. Desktop installation cannot be confirmed.");
      } catch (error) { setStatus(bridgeFailureMessage(error)); }
      finally { setChecking(false); }
    }} className="mt-3 rounded-xl bg-blue-500 px-4 py-3 font-semibold disabled:opacity-50">{checking ? "Checking local bridge..." : "Check installed bridge"}</button>
    <p className="mt-4 text-sm text-zinc-400">An unreachable bridge does not prove it is uninstalled: it may be stopped or blocked by browser permissions. Restart, updates, diagnostics and removal are available from the tray or Windows installed apps.</p>
  </section>;
}

"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { readWorkspaceSelectionHints, type WorkspaceManifest, type WorkspaceBootstrapResponse } from "@/lib/calibration-workshop/workspaceBootstrapContract";
import dynamic from "next/dynamic";
import type { WorkspaceVehicle } from "./shared-workspace-client";

const SharedWorkspaceClient = dynamic(() => import("./shared-workspace-client"), { ssr: false });
const EmptySharedWorkspace = dynamic(() => import("./shared-workspace-client").then(module => module.EmptySharedWorkspace), { ssr: false });

/** The page supplies authenticated owner/vehicle identifiers, not Calibration
 * evidence. The existing guarded Sydney route admits any saved-selection hint.
 */
export default function WorkspaceBootstrapClient({ manifest, vehicle, upload }: {
  manifest: WorkspaceManifest; vehicle: WorkspaceVehicle; upload: ReactNode;
}) {
  const key = JSON.stringify(manifest);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; value: WorkspaceBootstrapResponse } | null>(null);
  const [timings, setTimings] = useState<Record<string, number>>({});
  const [serverTiming, setServerTiming] = useState("");
  const [cachePolicy, setCachePolicy] = useState("");
  const [interactive, setInteractive] = useState(false);
  const onInteractive = useCallback((workspaceMs: number) => {
    setInteractive(true);
    setTimings(previous => ({ ...previous, workspaceMs, interactiveAtMs: performance.now() }));
  }, []);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    // Strict Mode's discarded effect never starts a request. Real unmounts abort
    // the request and cannot publish a response into a newer vehicle or session.
    queueMicrotask(async () => {
      if (!active) return;
      setResult(null); setInteractive(false);
      const started = performance.now(), request: WorkspaceManifest = JSON.parse(key);
      const hintsStart = performance.now();
      let hints: ReturnType<typeof readWorkspaceSelectionHints> = [];
      try { hints = readWorkspaceSelectionHints(window.localStorage, request); } catch { /* Existing restoration reports storage denial. */ }
      const hintsMs = performance.now() - hintsStart;
      try {
        // Fetch and workspace-code loading overlap; the loader has no runtime
        // dependency on the Grid, plots, Working engine or projection machinery.
        const workspaceCode = import("./shared-workspace-client").then(() => null, () => new Error("Workspace code unavailable"));
        const fetchStart = performance.now();
        const response = await fetch("/api/calibration-workshop/projection", { method: "POST", cache: "no-store", credentials: "same-origin",
          headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...request, kind: "workspace", hints }), signal: controller.signal });
        const headersMs = performance.now() - fetchStart;
        const bodyStart = performance.now(), text = await response.text(), bodyMs = performance.now() - bodyStart;
        const parseStart = performance.now(), value = JSON.parse(text) as WorkspaceBootstrapResponse, parseMs = performance.now() - parseStart;
        if ((!response.ok && value.status !== "unavailable") || !["ready", "empty", "session_unavailable", "unavailable"].includes(value.status)) throw Error("Workspace request failed");
        const codeFailure = await workspaceCode;
        if (codeFailure) throw codeFailure;
        if (value.status !== "unavailable" && (value.context.ownerId !== request.ownerScope || value.context.vehicleId !== request.vehicleId ||
          value.context.sourceMode !== "subscriber" || request.requestedSession !== undefined && value.status === "ready" && value.context.sessionId !== request.requestedSession))
          throw Error("Workspace response identity differs");
        if (!active) return;
        // Durations/counts only. No identities, values, paths or tokens in metrics.
        const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
        const sameDocument = navigation && new URL(navigation.name).pathname === window.location.pathname;
        const transfer = performance.getEntriesByName(new URL("/api/calibration-workshop/projection", window.location.origin).href).at(-1) as PerformanceResourceTiming | undefined;
        setTimings({ manifestEffectAtMs: started, hintsMs, headersMs, bodyMs, parseMs, responseCharacters: text.length,
          ...(transfer ? { encodedResponseBytes: transfer.encodedBodySize, decodedResponseBytes: transfer.decodedBodySize } : {}),
          ...(sameDocument ? { documentTtfbMs: navigation.responseStart - navigation.requestStart,
            documentTransferMs: navigation.responseEnd - navigation.responseStart, documentBytes: navigation.encodedBodySize } : {}) });
        setServerTiming(response.headers.get("Server-Timing") ?? "");
        setCachePolicy(response.headers.get("Cache-Control") ?? "");
        setResult({ key, value });
      } catch {
        if (active) setResult({ key, value: { status: "unavailable", code: "REQUEST_FAILED",
          finding: "Calibration evidence could not be restored. Retry; no values were substituted." } });
      }
    });
    return () => { active = false; controller.abort(); };
  }, [key, attempt]);
  const response = result?.key === key ? result.value : null;
  if (response?.status === "ready") return <div className="contents" data-calibration-interactive={interactive ? "true" : "false"}
    data-calibration-timings={JSON.stringify(timings)} data-calibration-server-timing={serverTiming} data-calibration-cache-policy={cachePolicy}>
    <SharedWorkspaceClient workshop={response.workshop} evidence={response.evidence} context={response.context} vehicle={vehicle}
      requestedKey={manifest.requestedKey} upload={upload} onInteractive={onInteractive}/>
  </div>;
  if (response?.status === "empty") return <EmptySharedWorkspace vehicle={vehicle} context={response.context} upload={upload} reason={response.finding}/>;
  return <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6"><div className="mx-auto max-w-4xl space-y-6">
    <a href={`/dashboard/vehicles/${vehicle.id}`} className="text-sm text-zinc-400">← Back to Vehicle</a>
    <header className="bmw-border rounded-2xl bg-zinc-900 p-6"><h1 className="text-3xl font-bold">{vehicle.nickname || "Unnamed Vehicle"}</h1>{upload}</header>
    <section className="bmw-border rounded-2xl bg-zinc-900 p-6" role={response ? "alert" : "status"} aria-busy={!response}>
      <h2 className="text-xl font-bold">{response ? "Calibration evidence unavailable" : "Restoring Calibration workspace…"}</h2>
      <p className="mt-3 text-sm text-zinc-400">{response?.finding ?? "Verifying the current session and exact saved Table before opening the workspace."}</p>
      {response && <button type="button" className="mt-4 rounded border border-blue-400 px-4 py-2" onClick={() => setAttempt(value => value + 1)}>Retry</button>}
    </section>
  </div></main>;
}

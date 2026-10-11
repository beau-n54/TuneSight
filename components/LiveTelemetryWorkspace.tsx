"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deriveBoostActualKpa } from "@/lib/vehicle-interface/enetObd";
import { type RecordedTelemetrySample, type RecordingState } from "@/lib/vehicle-interface/liveRecording";
import LiveTelemetryGauge, { type GraphTiming } from "./LiveTelemetryGauge";
import LiveBridgeControls from "./LiveBridgeControls";
import { bridgeFailureMessage, createLocalBridgeClient } from "@/lib/vehicle-interface/localBridgeClient";
import { appendTrace, channelTitles as titles, isObservedSample as isValidSample, type LiveSample, type TracePoint } from "@/lib/vehicle-interface/liveTelemetryPresentation";
import { createTelemetryScheduler } from "@/lib/vehicle-interface/liveTelemetryScheduler";
import { BrowserRecordingStore, RECORDING_LIMITS, type RecordingJournal } from "@/lib/vehicle-interface/offlineRecordingQueue";

type Props = { ownerId: string; vehicle: Readonly<{ id: string; name: string; description: string; engineCode: string }> };
type ConnectionState = "disconnected" | "connecting" | "connected" | "disconnecting" | "failed";
type Channel = Readonly<{ key: string; unit: string; revisionId: string; state: "qualified_available" | "unsupported" }>;
type Sample = LiveSample & { browserReceivedMonotonicMs?: number };
type Session = Readonly<{ id: string; host: string; identity: Readonly<{ dme: string | null; vin: string | null; applicationSoftwareVersion: string | null; sparePartNumber: string | null; romSoftwareIdentity: string | null }>; identityReads?: Readonly<Record<string, string>> }>;



export default function LiveTelemetryWorkspace({ ownerId, vehicle }: Props) {
  const [bridge] = useState(() => createLocalBridgeClient());
  const [manualToken, setManualToken] = useState("");
  const [bridgeFinding, setBridgeFinding] = useState("Looking for the local TuneSight Bridge…");
  const connectionRequest = useRef(false);
  const [state, setState] = useState<ConnectionState>("disconnected");
  const [finding, setFinding] = useState("No live vehicle session. Values are never simulated on this page.");
  const [session, setSession] = useState<Session | null>(null);
  const [channels, setChannels] = useState<readonly Channel[]>([]);
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [latest, setLatest] = useState<Readonly<Record<string, Sample>>>({});
  const [traces, setTraces] = useState<Readonly<Record<string, readonly TracePoint[]>>>({});
  const [recordingState, setRecordingState] = useState<RecordingState>("ready");
  const [recordedSampleCount, setRecordedSampleCount] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [traceOrigin, setTraceOrigin] = useState(0);
  const store = useMemo(() => new BrowserRecordingStore(ownerId, vehicle.id), [ownerId, vehicle.id]);
  const recordingId = useRef<string | null>(null);
  const committedCount = useRef(0);
  const recordingInterrupted = useRef(false);
  const [activeRecordingId, setActiveRecordingId] = useState<string | null>(null);
  const flushRequest = useRef<Promise<void> | null>(null);
  const [history, setHistory] = useState<readonly RecordingJournal[]>([]);
  const [recordingFinding, setRecordingFinding] = useState("Up to 20 recordings per owner/vehicle, 50,000 samples each. Stored only on this browser.");
  const refreshHistory = useCallback(async () => { setHistory(await store.list()); }, [store]);
  useEffect(() => { let active = true; void store.list().then(items => { if (active) setHistory(items); }).catch(() => { if (active) setRecordingFinding("Local recording storage is unavailable. Live values remain read-only; recording cannot be confirmed."); }); return () => { active = false; }; }, [store]);
  const recordingSamples = useRef<RecordedTelemetrySample[]>([]);
  const flushRecording = useCallback(async () => {
    if (flushRequest.current) return flushRequest.current;
    const task = (async () => {
      while (recordingSamples.current.length && recordingId.current) {
        const batch = recordingSamples.current.slice(0, RECORDING_LIMITS.chunk);
        const count = await store.append(recordingId.current, batch);
        recordingSamples.current.splice(0, batch.length);
        committedCount.current = count;
        setRecordedSampleCount(count);
      }
    })();
    flushRequest.current = task;
    try { await task; } finally { flushRequest.current = null; }
  }, [store]);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => { if (recordingRef.current === "recording" || recordingRef.current === "processing" || recordingSamples.current.length) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", guard); return () => window.removeEventListener("beforeunload", guard);
  }, []);
  const selectedRef = useRef(selected);
  const recordingRef = useRef(recordingState);
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { recordingRef.current = recordingState; }, [recordingState]);
  useEffect(() => () => { if (downloadUrl) URL.revokeObjectURL(downloadUrl); }, [downloadUrl]);
  useEffect(() => {
    let active = true;
    void bridge.pair().then(() => { if (active) setBridgeFinding("Local bridge found"); })
      .catch(error => { if (active) setBridgeFinding(bridgeFailureMessage(error)); });
    return () => { active = false; };
  }, [bridge]);

  const call = useCallback(<T,>(path: "/v1/connect" | "/v1/sample" | "/v1/disconnect", init?: RequestInit): Promise<T> => bridge.call<T>(path, init), [bridge]);

  const connect = useCallback(async () => {
    if (connectionRequest.current || state === "connected") return;
    connectionRequest.current = true;
    setState("connecting"); setFinding("Pairing with the local bridge, then discovering BMW ENET…");
    try {
      await bridge.setManualToken(manualToken);
      const payload = await call<{ session: Session; channels: readonly Channel[] }>("/v1/connect", { method: "POST", body: "{}" });
      setBridgeFinding("Local bridge found"); setManualToken("");
      const exactRom = payload.session.identity.romSoftwareIdentity;
      const resolvedSession = payload.session;
      setLatest({}); setTraces({}); setTraceOrigin(Date.now());
      setSession(resolvedSession); setChannels(payload.channels); setSelected(payload.channels.filter((item) => item.state === "qualified_available").slice(0, 6).map((item) => item.key)); setState("connected");
      setFinding(exactRom ? `Bridge reports observed exact ROM/software identifier ${exactRom}; offline context is separate.` : "Read-only session established. Exact ROM/software identity was not independently returned, so offline expected-ROM context remains unconfirmed (not a conflict).");
    } catch (error) { setState("failed"); setSession(null); setChannels([]); const message = bridgeFailureMessage(error); setBridgeFinding(message); setFinding(message); }
    finally { connectionRequest.current = false; }
  }, [bridge, call, manualToken, state]);

  const disconnect = useCallback(async () => {
    if (connectionRequest.current) return;
    if (recordingId.current) { setFinding("Stop or retry saving the recording before disconnecting. Committed batches remain in local history."); return; }
    connectionRequest.current = true; setState("disconnecting");
    try { if (session) await call("/v1/disconnect", { method: "POST", body: "{}" }); } catch { /* local detach is still completed */ }
    setState("disconnected"); setSession(null); setChannels([]); setSelected([]); setLatest({}); setTraces({}); recordingRef.current = "ready"; setRecordingState("ready"); setRecordedSampleCount(0); recordingSamples.current = []; setFinding("Disconnected. The next Connect creates a replacement read-only vehicle session.");
    connectionRequest.current = false;
  }, [call, session]);

  useEffect(() => {
    if (state !== "connected") return;
    let stopped = false, timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController(), scheduler = createTelemetryScheduler();
    const poll = async () => {
      if (stopped) return;
      const selectedKeys = selectedRef.current, next = scheduler.next(selectedKeys, performance.now());
      if (!next.channels.length) { timer = setTimeout(() => void poll(), next.waitMs); return; }
      try {
        const started = performance.now();
        const payload = await call<{ samples: readonly Sample[] }>("/v1/sample", { method: "POST", body: JSON.stringify({ channels: next.channels }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]) });
        if (stopped) return;
        const browserReceivedAt = new Date().toISOString(), browserReceivedMonotonicMs = performance.now();
        const delivered: Sample[] = payload.samples.map(item => ({ ...item, browserReceivedMonotonicMs,
          timing: item.timing ? { ...item.timing, browserReceivedAt, httpRoundTripMs: browserReceivedMonotonicMs - started,
            responseToBrowserMs: Date.parse(browserReceivedAt) - Date.parse(item.timing.responseReceivedAt) } : undefined }));
        const valid = delivered.filter(isValidSample);
        const map = valid.find(item => item.key === "map.absolute"), ambient = valid.find(item => item.key === "ambient.pressure");
        const augmented: Sample[] = [...delivered];
        if (selectedKeys.includes("boost.actual") && map && ambient) augmented.push({ ...map, key: "boost.actual", value: deriveBoostActualKpa({ manifoldAbsoluteKpa: map.value, ambientAbsoluteKpa: ambient.value }),
          channelRevisionId: `${map.channelRevisionId}+${ambient.channelRevisionId}:gauge-pressure-v1`, sequence: map.sequence,
          timing: map.timing && ambient.timing ? { ...ambient.timing, requestStartedAt: map.timing.requestStartedAt,
            transactionMs: Date.parse(ambient.receivedAt) - Date.parse(map.timing.requestStartedAt) } : undefined,
          latencyMs: map.timing ? Date.parse(ambient.receivedAt) - Date.parse(map.timing.requestStartedAt) : map.latencyMs + ambient.latencyMs,
          acquiredAt: ambient.acquiredAt, receivedAt: ambient.receivedAt, droppedSincePrevious: Math.max(map.droppedSincePrevious ?? 0, ambient.droppedSincePrevious ?? 0),
          finding: `Derived serial pair; source response separation ${Math.abs(Date.parse(ambient.acquiredAt) - Date.parse(map.acquiredAt))} ms.` });
        else if (selectedKeys.includes("boost.actual") && next.channels.includes("map.absolute")) augmented.push({ key: "boost.actual", state: "invalid", finding: "Fresh pressure pair unavailable; no cached pressure substituted." });
        setLatest(current => ({ ...current, ...Object.fromEntries(augmented.map(item => [item.key, item])) }));
        setTraces(current => ({ ...current, ...Object.fromEntries(augmented.filter(isValidSample).map(item => [item.key, appendTrace(current[item.key] ?? [], item)])) }));
        if (recordingRef.current === "recording") {
          // One sequential poll owns the queue. Await the previous durable batch
          // before accepting another; a slow/quota-failed store stops recording.
          await flushRecording();
          if (recordingRef.current === "recording") {
          if (recordingSamples.current.length + augmented.length > RECORDING_LIMITS.buffered) throw new Error("recording_backpressure_limit");
          const observed = augmented.filter(item => selectedKeys.includes(item.key)).filter(isValidSample).map(item => ({ channelKey: item.key, channelRevisionId: item.channelRevisionId, sequence: item.sequence,
            acquiredAt: item.acquiredAt, receivedAt: item.receivedAt, latencyMs: item.latencyMs, timing: item.timing, droppedSincePrevious: item.droppedSincePrevious ?? 0, value: item.value, unit: item.unit,
            provenance: item.key === "boost.actual" ? `Derived from fresh serial Mode 01 absolute pressures; ${item.finding}` : "Observed response from the connected DME. acquiredAt is bridge response completion; ECU internal acquisition time is unknown." }));
          if (committedCount.current + observed.length > RECORDING_LIMITS.samples) {
            recordingRef.current = "processing"; setRecordingState("processing");
            await store.finish(recordingId.current!, "interrupted", new Date().toISOString());
            recordingId.current = null; setActiveRecordingId(null);
            recordingRef.current = "interrupted"; setRecordingState("interrupted");
            setRecordingFinding(`Recording stopped at the bounded sample limit with ${committedCount.current} committed samples. The next observed batch was not recorded. Export the retained partial recording below; live reading continues.`);
            await refreshHistory();
          } else recordingSamples.current.push(...observed);
          }

        }
      } catch (error) { if (!stopped) { if (recordingId.current) { recordingInterrupted.current = true; recordingRef.current = "failed"; setRecordingState("failed"); setRecordingFinding("Recording stopped before accepting more samples. Retry saving the buffered batch; committed batches remain recoverable in Local recordings."); } setState("failed"); setFinding(`Live read stopped. ${bridgeFailureMessage(error)}`); return; } }
      if (!stopped) timer = setTimeout(() => void poll(), 0);
    };
    void poll();
    return () => { stopped = true; controller.abort(); clearTimeout(timer); };
  }, [call, state, flushRecording, store, refreshHistory]);

  const onPresented = useCallback((key: string, sequence: number, timing: GraphTiming) => {
    if (recordingRef.current !== "recording") return;
    const index = recordingSamples.current.findLastIndex(item => item.channelKey === key && item.sequence === sequence);
    if (index >= 0) recordingSamples.current[index] = { ...recordingSamples.current[index], presentationTiming: timing };
  }, []);

  const available = useMemo(() => channels.filter((item) => item.state === "qualified_available"), [channels]);
  const canDeriveBoost = available.some((item) => item.key === "map.absolute") && available.some((item) => item.key === "ambient.pressure");
  const selectable = useMemo(() => canDeriveBoost ? [...available, { key: "boost.actual", unit: "kPa", revisionId: "derived:gauge-pressure-v1", state: "qualified_available" as const }] : available, [available, canDeriveBoost]);
  const exportRecording = async (id: string) => {
    const recording = await store.export(id);
    const url = URL.createObjectURL(new Blob([JSON.stringify(recording, null, 2)], { type: "application/json" }));
    setDownloadUrl(old => { if (old) URL.revokeObjectURL(old); return url; });
    setRecordingFinding(recording.recovery ?? "Every exported sample was committed to local storage. This is not cloud Log History.");
  };
  const startRecording = async () => {
    if (state !== "connected" || !session || selected.length === 0 || recordingId.current || recordingRef.current === "processing") return;
    recordingRef.current = "processing"; setRecordingState("processing");
    try {
      const id = crypto.randomUUID();
      await store.begin({ recordingId: id, vehicleId: vehicle.id, sessionId: session.id, transport: "bmw-enet-hsfz-read-only", dmeIdentity: session.identity.dme, romSoftwareIdentity: session.identity.romSoftwareIdentity, startedAt: new Date().toISOString() });
      recordingId.current = id; setActiveRecordingId(id); recordingSamples.current = []; committedCount.current = 0; recordingInterrupted.current = false; setRecordedSampleCount(0); recordingRef.current = "recording"; setRecordingState("recording"); setDownloadUrl(null);
      setRecordingFinding("Recording in bounded durable batches. A browser interruption can lose the final uncommitted batch; recovered exports say so explicitly.");
    } catch { recordingRef.current = "failed"; setRecordingState("failed"); setRecordingFinding("Cannot start local recording. Storage may be unavailable or full; export/delete an existing recording and retry."); }
  };
  const stopRecording = async () => {
    const id = recordingId.current;
    if (!id || recordingRef.current === "processing") return;
    recordingRef.current = "processing"; setRecordingState("processing");
    try {
      await flushRecording();
      const finalState = recordingInterrupted.current || committedCount.current === 0 ? "interrupted" : "recorded";
      await store.finish(id, finalState, new Date().toISOString());
      if (committedCount.current) await exportRecording(id);
      else setRecordingFinding("Recording stopped before any samples were acquired. No log was fabricated; the empty local entry can be deleted below.");
      recordingId.current = null; setActiveRecordingId(null); recordingRef.current = finalState; setRecordingState(finalState); await refreshHistory();
    }
    catch { recordingRef.current = "failed"; setRecordingState("failed"); setRecordingFinding("Save/export did not complete. Retry saving while this tab remains open. Local history retains committed batches; no Saved state is claimed."); await refreshHistory().catch(() => undefined); }
  };
  const deleteRecording = async (id: string) => { try { await store.delete(id); await refreshHistory(); setRecordingFinding("Local recording deleted from this owner/vehicle scope."); } catch { setRecordingFinding("Deletion could not be confirmed. Retry later."); } };

  return <div className="space-y-6">
    <section className="bmw-border rounded-2xl bg-gradient-to-br from-zinc-900 to-blue-950/30 p-6"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">BMW-wide · Read only</p><div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h1 className="text-3xl font-bold">Live Telemetry</h1><p className="mt-2 text-zinc-300">{vehicle.name}</p><p className="text-sm text-zinc-500">{vehicle.description} · Garage engine context: {vehicle.engineCode}</p></div><LiveBridgeControls state={state} finding={bridgeFinding} manualToken={manualToken} onManualToken={setManualToken} onConnect={() => void connect()} onDisconnect={() => void disconnect()} /></div></section>
    <p className="text-sm text-zinc-400">Start the TuneSight Bridge on this laptop, then press Connect BMW. Allow Local Network Access for your trusted TuneSight site if prompted. The bridge stays on 127.0.0.1:57631; automatic pairing does not expose your vehicle publicly.</p>
    <section className="grid gap-4 md:grid-cols-4"><Status title="Connection" value={state} /><Status title="Transport" value={session ? `ENET · ${session.host}` : "ENET cable"} /><Status title="DME / ECU" value={session?.identity.dme ?? "Not observed"} /><Status title="ROM / software" value={session?.identity.romSoftwareIdentity ?? "Not observed; exact ROM unconfirmed"} /></section>
    <section className="rounded-2xl border border-amber-700/50 bg-amber-950/20 p-5"><p className="font-semibold text-amber-200">Current finding</p><p className="mt-2 text-sm text-amber-100/80">{finding}</p>{session && <p className="mt-2 text-xs text-zinc-400">Application software DID: {session.identity.applicationSoftwareVersion ?? "unavailable"} · Spare-part DID: {session.identity.sparePartNumber ?? "unavailable"}. Neither is relabelled as exact ROM authority. Read outcomes: {JSON.stringify(session.identityReads ?? "not reported by this bridge version")}.</p>}</section>
    <section className="bmw-border rounded-2xl bg-zinc-900 p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-semibold">Live channels</h2><p className="mt-1 text-sm text-zinc-400">Only channels advertised by this connected DME are selectable. Requested spacing: RPM 100 ms, other fast channels 250 ms, slow channels 1000 ms; actual rates below are measured, not guaranteed. Times mark bridge response completion, not the ECU internal sensor instant.</p></div><p className="text-sm text-zinc-400">{selected.length} selected · {available.length} DME-advertised</p></div>{selectable.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-zinc-700 p-6 text-sm text-zinc-400">Connect the authenticated local ENET bridge. No Development Preview or synthetic fallback is used.</div> : <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{selectable.map((channel) => <button key={channel.key} onClick={() => setSelected((current) => current.includes(channel.key) ? current.filter((key) => key !== channel.key) : [...current, channel.key])} className={`rounded-xl border p-4 text-left ${selected.includes(channel.key) ? "border-blue-400 bg-blue-950/40" : "border-zinc-700"}`}><p className="font-medium">{titles[channel.key] ?? channel.key}</p><p className="mt-1 text-xs text-zinc-500">{channel.unit} · {channel.key === "boost.actual" ? "derived from two observed absolute pressures" : "DME advertised Mode 01 support"}</p></button>)}</div>}</section>
    {selected.length > 0 && <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{selected.map((key) => <LiveTelemetryGauge key={key} channelKey={key} title={titles[key] ?? key} unit={selectable.find(item => item.key === key)?.unit ?? ""} sample={latest[key]} points={traces[key] ?? []} origin={traceOrigin} connected={state === "connected"} onPresented={onPresented} />)}</section>}
    <section className="bmw-border rounded-2xl bg-zinc-900 p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-xl font-semibold">Record Log</h2><p className="mt-1 text-sm text-zinc-400">Records actual acquired samples in bounded local batches. Storage latency applies backpressure instead of inventing or dropping observations. Reported drops count failed requests, not unpolled ECU updates. Cloud Log History import remains separate.</p></div><div className="flex gap-3">{!activeRecordingId ? <button onClick={() => void startRecording()} disabled={state !== "connected" || selected.length === 0 || recordingState === "processing"} className="rounded-xl bg-red-600 px-5 py-3 font-semibold disabled:opacity-40">Record Log</button> : <button onClick={() => void stopRecording()} disabled={recordingState === "processing"} className="rounded-xl bg-amber-500 px-5 py-3 font-semibold text-black">{recordingState === "failed" ? "Retry saving" : "Stop recording"}</button>}{downloadUrl && <a href={downloadUrl} download={`tunesight-live-${session?.id ?? "recording"}.json`} className="rounded-xl border border-emerald-600 px-5 py-3 text-emerald-300">Export retained recording</a>}</div></div><p className="mt-4 text-sm capitalize text-zinc-300">Lifecycle: {recordingState} · {recordedSampleCount} samples committed</p><p role="status" className="mt-2 text-sm text-amber-200">{recordingFinding}</p>
      <h3 className="mt-6 font-semibold">Local recordings for this account and vehicle</h3><p className="text-xs text-zinc-400">Older unowned recordings are not imported automatically. Browser storage is not encrypted against another person using this operating-system account. Export required evidence before clearing browser data.</p>
      <ul className="mt-3 space-y-2">{history.filter(item => item.metadata.recordingId !== activeRecordingId).map(item => <li key={item.metadata.recordingId} className="flex flex-wrap items-center gap-3 rounded border border-zinc-700 p-3 text-sm"><span>{item.metadata.startedAt} · {item.count} committed samples · {item.state === "recording" ? "interrupted or active in another tab" : item.state}</span><button onClick={() => void exportRecording(item.metadata.recordingId).catch(() => setRecordingFinding("Export unavailable. The retained record has not been deleted."))} className="underline">Prepare export</button><button onClick={() => void deleteRecording(item.metadata.recordingId)} className="text-red-300 underline">Delete local recording</button></li>)}</ul></section>
  </div>;
}

function Status({ title, value }: { title: string; value: string }) { return <div className="bmw-border rounded-2xl bg-zinc-900 p-5"><p className="text-xs uppercase tracking-wider text-zinc-500">{title}</p><p className="mt-2 text-sm font-semibold text-white">{value}</p></div>; }

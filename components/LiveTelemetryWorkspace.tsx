"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deriveBoostActualKpa, resolveExactRomSoftwareIdentity } from "@/lib/vehicle-interface/enetObd";
import { createCanonicalLiveRecording, type RecordedTelemetrySample, type RecordingState } from "@/lib/vehicle-interface/liveRecording";

type Props = { vehicle: Readonly<{ id: string; name: string; description: string; engineCode: string }> };
type ConnectionState = "disconnected" | "connecting" | "connected" | "failed";
type Channel = Readonly<{ key: string; unit: string; revisionId: string; state: "qualified_available" | "unsupported" }>;
type Sample = Readonly<{ key: string; state: "valid" | "invalid" | "unsupported"; value?: number; unit?: string; channelRevisionId?: string; sequence?: number; acquiredAt?: string; receivedAt?: string; latencyMs?: number; droppedSincePrevious?: number; finding?: string }>;
type Session = Readonly<{ id: string; host: string; identity: Readonly<{ dme: string | null; vin: string | null; applicationSoftwareVersion: string | null; sparePartNumber: string | null; romSoftwareIdentity: string | null }> }>;
const BRIDGE = "http://127.0.0.1:57631";
const EXPECTED_ROM = "00003076501103";
const titles: Record<string, string> = { "engine.speed": "Engine speed", "map.absolute": "Manifold pressure (absolute)", "boost.actual": "Boost actual (derived)", "coolant.temperature": "Coolant temperature", "charge.temperature": "Intake-air temperature", "throttle.position": "Throttle position", "vehicle.speed": "Vehicle speed", "airflow.mass": "Mass airflow", "ambient.pressure": "Ambient pressure", "oil.temperature": "Oil temperature", "control-module.voltage": "Control-module voltage" };

export default function LiveTelemetryWorkspace({ vehicle }: Props) {
  const [token, setToken] = useState("");
  const [state, setState] = useState<ConnectionState>("disconnected");
  const [finding, setFinding] = useState("No live vehicle session. Values are never simulated on this page.");
  const [session, setSession] = useState<Session | null>(null);
  const [channels, setChannels] = useState<readonly Channel[]>([]);
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [latest, setLatest] = useState<Readonly<Record<string, Sample>>>({});
  const [traces, setTraces] = useState<Readonly<Record<string, readonly number[]>>>({});
  const [recordingState, setRecordingState] = useState<RecordingState>("ready");
  const [recordedSampleCount, setRecordedSampleCount] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const recordingStarted = useRef<string | null>(null);
  const recordingSamples = useRef<RecordedTelemetrySample[]>([]);
  const selectedRef = useRef(selected);
  const recordingRef = useRef(recordingState);
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { recordingRef.current = recordingState; }, [recordingState]);
  useEffect(() => () => { if (downloadUrl) URL.revokeObjectURL(downloadUrl); }, [downloadUrl]);

  const call = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(`${BRIDGE}${path}`, { ...init, headers: { Accept: "application/json", Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers }, cache: "no-store", signal: AbortSignal.timeout(5000) });
    const payload = await response.json() as T & { error?: string };
    if (!response.ok) throw new Error(payload.error ?? `bridge_${response.status}`);
    return payload;
  }, [token]);

  const connect = useCallback(async () => {
    if (token.length < 16) { setFinding("Enter the one-time token printed by the local bridge. It is held only in this page memory."); return; }
    setState("connecting"); setFinding("Discovering BMW ENET and opening a read-only DME session…");
    try {
      const payload = await call<{ session: Session; channels: readonly Channel[] }>("/v1/connect", { method: "POST", body: "{}" });
      const exactRom = resolveExactRomSoftwareIdentity(EXPECTED_ROM, [payload.session.identity.applicationSoftwareVersion, payload.session.identity.sparePartNumber]);
      const resolvedSession = { ...payload.session, identity: { ...payload.session.identity, romSoftwareIdentity: exactRom } };
      setSession(resolvedSession); setChannels(payload.channels); setSelected(payload.channels.filter((item) => item.state === "qualified_available").slice(0, 6).map((item) => item.key)); setState("connected");
      setFinding(exactRom ? `Live DME returned the expected exact ROM/software identifier ${EXPECTED_ROM}.` : "Read-only session established. Exact ROM/software identity was not independently returned, so offline expected-ROM context remains unconfirmed (not a conflict).");
    } catch (error) { setState("failed"); setSession(null); setChannels([]); setFinding(`Connection failed: ${error instanceof Error ? error.message : "unknown_error"}. No value was inferred.`); }
  }, [call, token]);

  const disconnect = useCallback(async () => {
    try { if (session) await call("/v1/disconnect", { method: "POST", body: "{}" }); } catch { /* local detach is still completed */ }
    setState("disconnected"); setSession(null); setChannels([]); setSelected([]); setLatest({}); setTraces({}); setRecordingState("ready"); setRecordedSampleCount(0); recordingSamples.current = []; recordingStarted.current = null; setFinding("Disconnected. The next Connect creates a replacement read-only vehicle session.");
  }, [call, session]);

  useEffect(() => {
    if (state !== "connected") return;
    let stopped = false, running = false;
    const poll = async () => {
      const selectedKeys = selectedRef.current;
      const requested = [...new Set([...selectedKeys.filter((key) => key !== "boost.actual"), ...(selectedKeys.includes("boost.actual") ? ["map.absolute", "ambient.pressure"] : [])])];
      if (running || requested.length === 0) return;
      running = true;
      try {
        const payload = await call<{ samples: readonly Sample[] }>("/v1/sample", { method: "POST", body: JSON.stringify({ channels: requested }) });
        if (stopped) return;
        const valid = payload.samples.filter(isValidSample);
        const map = valid.find((item) => item.key === "map.absolute"), ambient = valid.find((item) => item.key === "ambient.pressure");
        const augmented: Sample[] = [...payload.samples];
        if (map && ambient) augmented.push({ key: "boost.actual", state: "valid", value: deriveBoostActualKpa({ manifoldAbsoluteKpa: map.value, ambientAbsoluteKpa: ambient.value }), unit: "kPa", channelRevisionId: `${map.channelRevisionId}+${ambient.channelRevisionId}:gauge-pressure-v1`, sequence: Math.max(map.sequence, ambient.sequence), acquiredAt: map.acquiredAt, receivedAt: map.receivedAt, latencyMs: Math.max(map.latencyMs, ambient.latencyMs), droppedSincePrevious: Math.max(map.droppedSincePrevious ?? 0, ambient.droppedSincePrevious ?? 0) });
        setLatest((current) => ({ ...current, ...Object.fromEntries(augmented.map((item) => [item.key, item])) }));
        setTraces((current) => ({ ...current, ...Object.fromEntries(augmented.filter(isValidSample).map((item) => [item.key, [...(current[item.key] ?? []), item.value].slice(-30)])) }));
        if (recordingRef.current === "recording") { recordingSamples.current.push(...augmented.filter((item) => selectedKeys.includes(item.key)).filter(isValidSample).map((item) => ({ channelKey: item.key, channelRevisionId: item.channelRevisionId, sequence: item.sequence, acquiredAt: item.acquiredAt, receivedAt: item.receivedAt, latencyMs: item.latencyMs, droppedSincePrevious: item.droppedSincePrevious ?? 0, value: item.value, unit: item.unit, provenance: item.key === "boost.actual" ? "Derived from same-cycle Mode 01 manifold absolute pressure minus ambient absolute pressure." : "Observed from the connected DME through the authenticated read-only ENET bridge." }))); setRecordedSampleCount(recordingSamples.current.length); }
      } catch (error) { if (!stopped) { setState("failed"); setFinding(`Live read stopped: ${error instanceof Error ? error.message : "unknown_error"}.`); } } finally { running = false; }
    };
    void poll(); const timer = window.setInterval(() => void poll(), 750);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [call, state]);

  const available = useMemo(() => channels.filter((item) => item.state === "qualified_available"), [channels]);
  const canDeriveBoost = available.some((item) => item.key === "map.absolute") && available.some((item) => item.key === "ambient.pressure");
  const selectable = useMemo(() => canDeriveBoost ? [...available, { key: "boost.actual", unit: "kPa", revisionId: "derived:gauge-pressure-v1", state: "qualified_available" as const }] : available, [available, canDeriveBoost]);
  const startRecording = () => { if (state !== "connected" || selected.length === 0) return; recordingSamples.current = []; setRecordedSampleCount(0); recordingStarted.current = new Date().toISOString(); setRecordingState("recording"); setDownloadUrl(null); };
  const stopRecording = () => {
    if (!session || !recordingStarted.current) return; setRecordingState("processing");
    try { const recording = createCanonicalLiveRecording({ recordingId: crypto.randomUUID(), vehicleId: vehicle.id, sessionId: session.id, transport: "bmw-enet-hsfz-read-only", dmeIdentity: session.identity.dme, romSoftwareIdentity: session.identity.romSoftwareIdentity, startedAt: recordingStarted.current, stoppedAt: new Date().toISOString(), samples: recordingSamples.current }); const url = URL.createObjectURL(new Blob([JSON.stringify(recording, null, 2)], { type: "application/json" })); setDownloadUrl((old) => { if (old) URL.revokeObjectURL(old); return url; }); setRecordingState("recorded"); } catch { setRecordingState("failed"); }
  };

  return <div className="space-y-6">
    <section className="bmw-border rounded-2xl bg-gradient-to-br from-zinc-900 to-blue-950/30 p-6"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">BMW-wide · Read only</p><div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h1 className="text-3xl font-bold">Live Telemetry</h1><p className="mt-2 text-zinc-300">{vehicle.name}</p><p className="text-sm text-zinc-500">{vehicle.description} · Garage engine context: {vehicle.engineCode}</p></div><div className="flex flex-wrap items-end gap-3"><label className="text-xs text-zinc-400">Bridge token<input aria-label="Bridge token" type="password" value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off" className="mt-1 block w-64 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-white" /></label><button onClick={connect} disabled={state === "connecting" || state === "connected"} className="rounded-xl bg-blue-500 px-5 py-3 font-semibold text-white disabled:opacity-50">{state === "connecting" ? "Connecting…" : "Connect BMW"}</button><button onClick={disconnect} className="rounded-xl border border-zinc-600 px-5 py-3">Disconnect</button></div></div></section>
    <section className="grid gap-4 md:grid-cols-4"><Status title="Connection" value={state} /><Status title="Transport" value={session ? `ENET · ${session.host}` : "ENET cable"} /><Status title="DME / ECU" value={session?.identity.dme ?? "Not observed"} /><Status title="ROM / software" value={session?.identity.romSoftwareIdentity ?? `Expected ${EXPECTED_ROM} · not observed`} /></section>
    <section className="rounded-2xl border border-amber-700/50 bg-amber-950/20 p-5"><p className="font-semibold text-amber-200">Current finding</p><p className="mt-2 text-sm text-amber-100/80">{finding}</p>{session && <p className="mt-2 text-xs text-zinc-400">Application software DID: {session.identity.applicationSoftwareVersion ?? "unavailable"} · Spare-part DID: {session.identity.sparePartNumber ?? "unavailable"}. Neither is relabelled as exact ROM authority.</p>}</section>
    <section className="bmw-border rounded-2xl bg-zinc-900 p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-semibold">Live channels</h2><p className="mt-1 text-sm text-zinc-400">Only channels advertised by this connected DME are selectable. Unsupported targets remain absent.</p></div><p className="text-sm text-zinc-400">{selected.length} selected · {available.length} DME-advertised</p></div>{selectable.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-zinc-700 p-6 text-sm text-zinc-400">Connect the authenticated local ENET bridge. No Development Preview or synthetic fallback is used.</div> : <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{selectable.map((channel) => <button key={channel.key} onClick={() => setSelected((current) => current.includes(channel.key) ? current.filter((key) => key !== channel.key) : [...current, channel.key])} className={`rounded-xl border p-4 text-left ${selected.includes(channel.key) ? "border-blue-400 bg-blue-950/40" : "border-zinc-700"}`}><p className="font-medium">{titles[channel.key] ?? channel.key}</p><p className="mt-1 text-xs text-zinc-500">{channel.unit} · {channel.key === "boost.actual" ? "derived from two observed absolute pressures" : "DME advertised Mode 01 support"}</p></button>)}</div>}</section>
    {selected.length > 0 && <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{selected.map((key) => <Gauge key={key} title={titles[key] ?? key} sample={latest[key]} points={traces[key] ?? []} />)}</section>}
    <section className="bmw-border rounded-2xl bg-zinc-900 p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-xl font-semibold">Record Log</h2><p className="mt-1 text-sm text-zinc-400">Records the exact same canonical live samples shown above. This milestone provides a local JSON proof download; it does not claim durable Log History ingestion.</p></div><div className="flex gap-3">{recordingState !== "recording" ? <button onClick={startRecording} disabled={state !== "connected" || selected.length === 0} className="rounded-xl bg-red-600 px-5 py-3 font-semibold disabled:opacity-40">Record Log</button> : <button onClick={stopRecording} className="rounded-xl bg-amber-500 px-5 py-3 font-semibold text-black">Stop recording</button>}{downloadUrl && <a href={downloadUrl} download={`tunesight-live-${session?.id ?? "recording"}.json`} className="rounded-xl border border-emerald-600 px-5 py-3 text-emerald-300">Download recorded proof</a>}</div></div><p className="mt-4 text-sm capitalize text-zinc-300">Lifecycle: {recordingState} · {recordedSampleCount} samples buffered</p></section>
  </div>;
}

function isValidSample(item: Sample): item is Sample & Required<Pick<Sample, "value" | "unit" | "channelRevisionId" | "sequence" | "acquiredAt" | "receivedAt" | "latencyMs">> { return item.state === "valid" && item.value !== undefined && item.unit !== undefined && item.channelRevisionId !== undefined && item.sequence !== undefined && item.acquiredAt !== undefined && item.receivedAt !== undefined && item.latencyMs !== undefined; }
function Status({ title, value }: { title: string; value: string }) { return <div className="bmw-border rounded-2xl bg-zinc-900 p-5"><p className="text-xs uppercase tracking-wider text-zinc-500">{title}</p><p className="mt-2 text-sm font-semibold text-white">{value}</p></div>; }
function Gauge({ title, sample, points }: { title: string; sample?: Sample; points: readonly number[] }) { const min = Math.min(...points), max = Math.max(...points), range = max - min || 1; const path = points.map((value, index) => `${index ? "L" : "M"}${(index / Math.max(1, points.length - 1)) * 100},${38 - ((value - min) / range) * 34}`).join(" "); return <article className="bmw-border rounded-2xl bg-zinc-900 p-5"><p className="text-sm text-zinc-400">{title}</p><p className="mt-2 text-4xl font-semibold tabular-nums">{sample?.state === "valid" && sample.value !== undefined ? sample.value.toFixed(sample.unit === "rpm" || sample.unit === "km/h" ? 0 : 1) : "—"} <span className="text-base text-zinc-500">{sample?.unit}</span></p><svg viewBox="0 0 100 40" className="mt-4 h-20 w-full" role="img" aria-label={`${title} recent trace`}><path d={path} fill="none" stroke="rgb(96 165 250)" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg><p className="text-xs text-zinc-500">{sample?.state === "invalid" ? sample.finding : sample?.latencyMs !== undefined ? `${sample.latencyMs} ms measured bridge latency` : "Awaiting observed sample"}</p></article>; }

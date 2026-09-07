"use client";

import { useCallback, useMemo, useState } from "react";
import { F30_00003076501103_CHANNEL_CATALOGUE, qualifiedGaugeChannels, type TelemetryQualification } from "@/lib/vehicle-interface/bmwLiveTelemetry";

type Props = { vehicle: Readonly<{ id: string; name: string; description: string; engineCode: string }> };
type ConnectionState = "bridge_unavailable" | "disconnected" | "connecting" | "connected" | "failed";
const labels: Record<TelemetryQualification, string> = { qualified_available: "Qualified / available", available_unqualified: "Available, unqualified", unsupported: "Unsupported", transport_unavailable: "Transport unavailable", rom_not_qualified: "ROM not qualified", conversion_unavailable: "Conversion unavailable", conflict: "Conflict", invalid: "Invalid" };

export default function LiveTelemetryWorkspace({ vehicle }: Props) {
  const [state, setState] = useState<ConnectionState>("disconnected");
  const [finding, setFinding] = useState("No live vehicle session. Values are never simulated on this page.");
  const [selected, setSelected] = useState<readonly string[]>([]);
  const gauges = useMemo(() => qualifiedGaugeChannels(F30_00003076501103_CHANNEL_CATALOGUE), []);
  const connect = useCallback(async () => {
    setState("connecting"); setFinding("Checking the authenticated loopback bridge…");
    try {
      const response = await fetch("http://127.0.0.1:57631/v1/status", { method: "GET", headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(2500) });
      if (!response.ok) throw new Error(`bridge_status_${response.status}`);
      const payload = await response.json() as { state?: string; authenticatedSession?: boolean };
      if (!payload.authenticatedSession) throw new Error("bridge_session_not_authenticated");
      setState(payload.state === "connected" ? "connected" : "disconnected"); setFinding(payload.state === "connected" ? "Bridge reports a connected read-only vehicle session. Identity and channels remain unavailable until returned by the bridge." : "Bridge is available; start an authenticated vehicle session in the bridge before connecting.");
    } catch (error) { setState("bridge_unavailable"); setFinding(`Local bridge unavailable or unpaired (${error instanceof Error ? error.message : "unknown_error"}). No vehicle data was inferred.`); }
  }, []);
  const disconnect = useCallback(() => { setState("disconnected"); setFinding("UI detached from the local session. No vehicle command was issued."); }, []);
  return <div className="space-y-6">
    <section className="bmw-border rounded-2xl bg-gradient-to-br from-zinc-900 to-blue-950/30 p-6"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">BMW-wide · Read only</p><div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-3xl font-bold">Live Telemetry</h1><p className="mt-2 text-zinc-300">{vehicle.name}</p><p className="text-sm text-zinc-500">{vehicle.description} · Garage engine context: {vehicle.engineCode}</p></div><div className="flex gap-3"><button onClick={connect} disabled={state === "connecting"} className="rounded-xl bg-blue-500 px-5 py-3 font-semibold text-white disabled:opacity-50">{state === "connecting" ? "Checking…" : "Connect"}</button><button onClick={disconnect} className="rounded-xl border border-zinc-600 px-5 py-3">Disconnect</button></div></div></section>
    <section className="grid gap-4 md:grid-cols-4"><Status title="Connection" value={state.replaceAll("_", " ")} /><Status title="Preferred transport" value="ENET cable" /><Status title="DME / ECU" value="Not observed" /><Status title="ROM / software" value="Expected 00003076501103 · not observed" /></section>
    <section className="rounded-2xl border border-amber-700/50 bg-amber-950/20 p-5"><p className="font-semibold text-amber-200">Current finding</p><p className="mt-2 text-sm text-amber-100/80">{finding}</p></section>
    <section className="bmw-border rounded-2xl bg-zinc-900 p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-semibold">Selected gauges</h2><p className="mt-1 text-sm text-zinc-400">Only exact-ROM qualified native channels can be selected.</p></div><p className="text-sm text-zinc-400">{selected.length} selected · {gauges.length} presently qualified</p></div>{gauges.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-zinc-700 p-6 text-sm text-zinc-400">No normal gauges are exposed yet. The connected DME must first return identity, then native request and conversion evidence must qualify channels. Calibration tables are not used as runtime-channel authority.</div> : <div className="mt-5 grid gap-3 sm:grid-cols-2">{gauges.map((channel) => <button key={channel.key} onClick={() => setSelected((current) => current.includes(channel.key) ? current.filter((key) => key !== channel.key) : [...current, channel.key])} className="rounded-xl border border-zinc-700 p-4 text-left">{channel.concept}</button>)}</div>}</section>
    <section className="bmw-border rounded-2xl bg-zinc-900 p-6"><h2 className="text-xl font-semibold">F30 expected-ROM channel qualification queue</h2><p className="mt-1 text-sm text-zinc-400">Platform-neutral concepts awaiting governed native telemetry authority for the live-observed ROM.</p><div className="mt-5 grid gap-3 md:grid-cols-2">{F30_00003076501103_CHANNEL_CATALOGUE.map((channel) => <div key={channel.key} className="rounded-xl bg-zinc-950 p-4"><div className="flex justify-between gap-3"><p className="font-medium">{channel.concept}{channel.role !== "observation" ? ` ${channel.role}` : ""}</p><span className="text-xs text-amber-300">{labels[channel.qualification]}</span></div><p className="mt-2 font-mono text-xs text-zinc-500">{channel.key} · {channel.unit}</p></div>)}</div></section>
  </div>;
}
function Status({ title, value }: { title: string; value: string }) { return <div className="bmw-border rounded-2xl bg-zinc-900 p-5"><p className="text-xs uppercase tracking-wider text-zinc-500">{title}</p><p className="mt-2 text-sm font-semibold capitalize text-white">{value}</p></div>; }

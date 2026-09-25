"use client";

import { useId, useLayoutEffect, useState } from "react";
import { displayRange, observedCadence, timeDomain, type LiveSample, type TracePoint } from "@/lib/vehicle-interface/liveTelemetryPresentation";

export type GraphTiming = { commitAt: string; frameOpportunityAt: string; browserToCommitMs: number; browserToFrameMs: number; requestToFrameMs: number | null };
const ticks = (min: number, max: number) => Array.from({ length: 5 }, (_, i) => min + (max - min) * i / 4);
const label = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(Math.abs(value) < 10 ? 2 : 1);
export default function LiveTelemetryGauge({ channelKey, title, unit, sample, points, origin, connected, onPresented }: {
  channelKey: string; title: string; unit: string; sample?: LiveSample & { browserReceivedMonotonicMs?: number }; points: readonly TracePoint[];
  origin: number; connected: boolean; onPresented?: (key: string, sequence: number, timing: GraphTiming) => void;
}) {
  const dialColourId = useId();
  const dialGlossId = `${dialColourId}-gloss`;
  // The session supplies qualified channel decoding/units, but no vehicle-qualified operating limits.
  // Match the existing BMW border palette; these gradient stops are artwork, never threshold values.
  const colourFinding = channelKey === "engine.speed" ? "Connected-vehicle redline unverified."
    : ["oil.temperature", "coolant.temperature"].includes(channelKey) ? "Connected-vehicle temperature warning limits unverified."
    : "Connected-vehicle warning limits unverified.";
  const [presentation, setPresentation] = useState<GraphTiming | null>(null);
  useLayoutEffect(() => {
    if (sample?.browserReceivedMonotonicMs === undefined || sample.sequence === undefined) return;
    const commitAt = new Date().toISOString(), commit = performance.now(), received = sample.browserReceivedMonotonicMs;
    const frame = requestAnimationFrame(() => {
      const now = performance.now();
      const timing = { commitAt, frameOpportunityAt: new Date().toISOString(), browserToCommitMs: commit - received, browserToFrameMs: now - received,
        requestToFrameMs: sample.timing ? Date.now() - Date.parse(sample.timing.requestStartedAt) : null };
      setPresentation(timing); onPresented?.(channelKey, sample.sequence!, timing);
    });
    return () => cancelAnimationFrame(frame);
  }, [sample, channelKey, onPresented]);
  const [min, max] = displayRange(channelKey, points), [start, end] = timeDomain(points, origin);
  const valid = connected && sample?.state === "valid" && Number.isFinite(sample.value);
  const value = valid ? sample!.value! : null;
  const angle = value === null ? null : Math.PI + ((value - min) / (max - min)) * Math.PI;
  const x = (at: number) => 58 + (((at - origin) / 1000 - start) / (end - start)) * 248;
  const y = (v: number) => 152 - (v - min) / (max - min) * 118;
  const cadence = observedCadence(points);
  // Observation dots only: no tweening, invented samples or equal-index spacing.
  return <article className="bmw-border min-w-0 rounded-2xl bg-zinc-900 p-5">
    <h3 className="text-base font-semibold text-zinc-200">{title}</h3>
    <p className="mt-2 text-3xl font-semibold tabular-nums">{value === null ? "—" : label(value)} <span className="text-base text-zinc-400">{unit}</span></p>
    {!connected && <p className="text-sm text-amber-200">Not live · retained trace</p>}
    <svg viewBox="0 0 320 156" className="mt-2 w-full" role="img" aria-label={`${title} dial in ${unit}; display scale, not a validated operating limit. BMW colours are decorative. ${colourFinding}`}>
      <defs><linearGradient id={dialColourId} x1="40" y1="126" x2="280" y2="126" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#00aaff"/><stop offset="45%" stopColor="#00aaff"/>
        <stop offset="65%" stopColor="#0046ff"/><stop offset="80%" stopColor="#0046ff"/>
        <stop offset="85%" stopColor="#ff1e1e"/><stop offset="100%" stopColor="#ff1e1e"/>
      </linearGradient>
        <linearGradient id={dialGlossId} x1="0" y1="6" x2="0" y2="126" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.42"/><stop offset="100%" stopColor="#ffffff" stopOpacity="0.06"/>
        </linearGradient>
      </defs>
      <path d="M 40 126 A 120 120 0 0 1 280 126" stroke={`url(#${dialColourId})`} strokeWidth="9" strokeLinecap="round" fill="none"/>
      {/* Static SVG highlight: no filters, animation or extra live-update work. */}
      <path d="M 40 125 A 120 120 0 0 1 280 125" stroke={`url(#${dialGlossId})`} strokeWidth="2" strokeLinecap="round" fill="none" aria-hidden="true"/>
      {ticks(min, max).map((tick, i) => { const a = Math.PI + i * Math.PI / 4; return <g key={i}><line x1={160 + Math.cos(a) * 111} y1={126 + Math.sin(a) * 111} x2={160 + Math.cos(a) * 120} y2={126 + Math.sin(a) * 120} stroke="#e4e4e7"/><text x={160 + Math.cos(a) * 94} y={130 + Math.sin(a) * 94} textAnchor="middle" fill="#d4d4d8" fontSize="12">{label(tick)}</text></g>; })}
      {angle !== null && <line x1="160" y1="126" x2={160 + Math.cos(angle) * 82} y2={126 + Math.sin(angle) * 82} stroke="#e4e4e7" strokeWidth="3"/>}
      <circle cx="160" cy="126" r="5" fill="#60a5fa"/><text x="160" y="151" textAnchor="middle" fill="#a1a1aa" fontSize="12">{unit}</text>
    </svg>
    <p className="text-xs text-zinc-300">BMW colours are styling only; red is not a confirmed warning limit. {colourFinding} Scale is a display range, not a vehicle-qualified limit.</p>
    <svg viewBox="0 0 320 202" className="mt-2 w-full" role="img" aria-label={`${title}: value in ${unit} against elapsed time in seconds; observed samples only`}>
      {ticks(min, max).map((tick, i) => <g key={i}><line x1="58" x2="306" y1={y(tick)} y2={y(tick)} stroke="#3f3f46"/><text x="52" y={y(tick) + 4} textAnchor="end" fill="#d4d4d8" fontSize="11">{label(tick)}</text></g>)}
      <text x="58" y="18" fill="#d4d4d8" fontSize="12">Value ({unit})</text>
      {ticks(start, end).map((tick, i) => <text key={i} x={58 + i * 62} y="173" textAnchor="middle" fill="#d4d4d8" fontSize="11">{label(tick)}</text>)}
      <text x="182" y="194" textAnchor="middle" fill="#d4d4d8" fontSize="12">Elapsed time (s)</text>
      {points.filter(p => (p.at - origin) / 1000 >= start).map((p, i) => <circle key={`${p.at}:${i}`} cx={x(p.at)} cy={y(p.value)} r="2" fill="#60a5fa"><title>{`${((p.at - origin) / 1000).toFixed(3)} s: ${p.value} ${unit}`}</title></circle>)}
    </svg>
    <p className="text-xs text-zinc-400">Display scale only · no validated warning thresholds. {cadence ? `${cadence.hz.toFixed(2)} observed samples/s · ${cadence.intervalMs.toFixed(0)} ms mean spacing` : "Awaiting two observations"}</p>
    <p className="mt-2 text-xs text-zinc-400">{sample?.state === "invalid" ? sample.finding : sample?.timing ? `${channelKey === "boost.actual" ? "Derived pressure pair span" : "DME request/response"} ${sample.timing.transactionMs.toFixed(1)} ms · batch wait ${sample.timing.batchWaitMs.toFixed(1)} ms · HTTP ${sample.timing.httpRoundTripMs?.toFixed(1) ?? "—"} ms` : "Per-stage timing unavailable from this bridge version"}</p>
    {sample?.finding && sample.state === "valid" && <p className="mt-1 text-xs text-zinc-400">{sample.finding}</p>}
    {sample && presentation && <p className="mt-1 text-xs text-zinc-400">Browser receive → commit {presentation.browserToCommitMs.toFixed(1)} ms · frame opportunity {presentation.browserToFrameMs.toFixed(1)} ms · request → frame opportunity {presentation.requestToFrameMs?.toFixed(1) ?? "—"} ms. Pixel presentation and ECU sensor age are not measured.</p>}
  </article>;
}

/** Host-observed response timestamps; the DME's internal measurement instant is unknown. */
export type TelemetryTiming = Readonly<{
  requestStartedAt: string; responseReceivedAt: string; responseReadyAt: string;
  transactionMs: number; batchWaitMs: number;
  browserReceivedAt?: string; httpRoundTripMs?: number; responseToBrowserMs?: number;
}>;
export type LiveSample = Readonly<{ key: string; state: "valid" | "invalid" | "unsupported"; value?: number; unit?: string;
  channelRevisionId?: string; sequence?: number; acquiredAt?: string; receivedAt?: string; latencyMs?: number;
  droppedSincePrevious?: number; finding?: string; timing?: TelemetryTiming }>;
export type ObservedSample = LiveSample & Required<Pick<LiveSample, "value" | "unit" | "channelRevisionId" | "sequence" | "acquiredAt" | "receivedAt" | "latencyMs">>;
export type TracePoint = Readonly<{ value: number; at: number }>;
export function isObservedSample(item: LiveSample): item is ObservedSample {
  return item.state === "valid" && Number.isFinite(item.value) && typeof item.unit === "string" && typeof item.channelRevisionId === "string"
    && Number.isSafeInteger(item.sequence) && Number.isFinite(Date.parse(item.acquiredAt ?? "")) && Number.isFinite(Date.parse(item.receivedAt ?? "")) && Number.isFinite(item.latencyMs);
}
export const channelTitles: Record<string, string> = { "engine.speed": "Engine speed", "map.absolute": "Manifold pressure (absolute)", "boost.actual": "Boost actual (derived)", "coolant.temperature": "Coolant temperature", "charge.temperature": "Intake-air temperature", "throttle.position": "Throttle position", "vehicle.speed": "Vehicle speed", "airflow.mass": "Mass airflow", "ambient.pressure": "Ambient pressure", "oil.temperature": "Oil temperature", "control-module.voltage": "Control-module voltage" };
const displays: Record<string, readonly [number, number]> = { "engine.speed": [0, 8000], "map.absolute": [0, 255], "boost.actual": [-100, 200], "coolant.temperature": [-40, 150], "charge.temperature": [-40, 150], "throttle.position": [0, 100], "vehicle.speed": [0, 240], "airflow.mass": [0, 500], "ambient.pressure": [0, 150], "oil.temperature": [-40, 160], "control-module.voltage": [0, 20] };
/** Presentation ranges only: expand for observations; never clamp or imply safety/redline. */
export function displayRange(key: string, points: readonly TracePoint[]) {
  const [low, high] = displays[key] ?? [0, 100];
  return [Math.min(low, ...points.map(p => p.value)), Math.max(high, ...points.map(p => p.value))] as const;
}
export function appendTrace(points: readonly TracePoint[], sample: ObservedSample): readonly TracePoint[] {
  const at = Date.parse(sample.acquiredAt);
  if (points.length && at < points[points.length - 1].at) return points;
  return [...points.filter(p => p.at >= at - 60_000), { at, value: sample.value }].slice(-600);
}
export function observedCadence(points: readonly TracePoint[]) {
  if (points.length < 2) return null;
  const elapsed = points[points.length - 1].at - points[0].at;
  return elapsed > 0 ? { hz: (points.length - 1) * 1000 / elapsed, intervalMs: elapsed / (points.length - 1) } : null;
}
export function timeDomain(points: readonly TracePoint[], origin: number) {
  const end = Math.max(1, ...points.map(p => (p.at - origin) / 1000));
  return [Math.max(0, end - 60), end] as const;
}

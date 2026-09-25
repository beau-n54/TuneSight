/** Desired request spacing, not a measured/qualified ECU sampling rate. One in-flight read only. */
export function requestedIntervalMs(key: string) {
  return key === "engine.speed" ? 100 : ["map.absolute", "throttle.position", "vehicle.speed", "airflow.mass"].includes(key) ? 250 : 1000;
}
export function createTelemetryScheduler() {
  const last = new Map<string, number>();
  return {
    next(selected: readonly string[], now: number): { channels: string[]; waitMs: number } {
      const boost = selected.includes("boost.actual");
      const keys = [...new Set([...selected.filter(k => k !== "boost.actual"), ...(boost ? ["map.absolute", "ambient.pressure"] : [])])];
      for (const k of last.keys()) if (!keys.includes(k)) last.delete(k);
      for (const key of keys) if (!last.has(key)) last.set(key, now - requestedIntervalMs(key));
      // A requested derived boost uses a fresh serial pair, never a cached ambient value.
      const candidates = keys.filter(k => !(boost && k === "ambient.pressure"));
      if (!candidates.length) return { channels: [], waitMs: 100 };
      const due = (k: string) => (now - (last.get(k) ?? (now - requestedIntervalMs(k)))) / requestedIntervalMs(k);
      candidates.sort((a, b) => due(b) - due(a) || (a === "engine.speed" ? -1 : b === "engine.speed" ? 1 : 0));
      const key = candidates[0];
      if (due(key) < 1) return { channels: [], waitMs: Math.max(1, Math.ceil(Math.min(...candidates.map(k => requestedIntervalMs(k) - (now - last.get(k)!))))) };
      const channels = boost && key === "map.absolute" ? [key, "ambient.pressure"] : [key];
      for (const k of channels) last.set(k, now);
      return { channels, waitMs: 0 };
    },
  };
}

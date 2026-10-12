import type { WorkingCalibration } from "./workingCalibration.ts";
import type { DurableWorkingSnapshot } from "./durableWorking.ts";

type Scope = { vehicleId: string; sessionId: string; datasetId: string; datasetRevision: string };
type Command = { action: "read" } | { action: "save"; working: WorkingCalibration; expectedHead: string | null } |
  { action: "restore"; restoreId: string; expectedHead: string | null };
/** Page-memory only. An uncertain write retains its exact idempotency key and
 * body until retry succeeds. No hidden autosave or persistent token/state. */
export function createDurableWorkingClient(scope: Scope, transport: typeof fetch = fetch, key: () => string = () => crypto.randomUUID()) {
  let running: Promise<DurableWorkingSnapshot> | null = null;
  let uncertain: { command: string; body: string } | null = null;
  return {
    get uncertain() { return uncertain !== null; },
    retry(): Promise<DurableWorkingSnapshot> {
      if (!uncertain) return Promise.reject(Error("No pending Working save."));
      return this.request(JSON.parse(uncertain.command) as Command);
    },
    discardUncertain() { if (running) throw Error("Working request is still running."); uncertain = null; },
    request(command: Command): Promise<DurableWorkingSnapshot> {
      if (running) return Promise.reject(Error("A Working request is already running."));
      const serialized = JSON.stringify(command);
      if (uncertain && uncertain.command !== serialized) return Promise.reject(Error("Retry the pending save before changing Working history."));
      if (command.action !== "read" && !uncertain) uncertain = { command: serialized, body: JSON.stringify({ ...scope, ...command, key: key() }) };
      const body = uncertain?.body ?? JSON.stringify({ ...scope, ...command });
      running = (async () => {
        const response = await transport("/api/calibration-workshop/working", { method: "POST", credentials: "same-origin", cache: "no-store",
          headers: { "Content-Type": "application/json" }, body, signal: AbortSignal.timeout(60_000) });
        const result = await response.json();
        if (!response.ok || result.status !== "ready") throw Error(result.finding ?? "Durable Working is unavailable. Keep this page open and retry.");
        uncertain = null;
        return result as DurableWorkingSnapshot;
      })().finally(() => { running = null; });
      return running;
    },
  };
}

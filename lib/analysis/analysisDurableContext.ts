import type { OwnedLog } from "./analysisCapabilities";
import type { AnalysisCalibrationContext } from "./analysisCalibrationContext";
import { resolveAnalysisCalibration } from "./analysisCalibrationContext.ts";

/** Both dependencies are read-only; no session writer or repair lease is accepted. */
export async function resolveDurableAnalysisContext(log: OwnedLog | null, owner: string, vehicle: string,
  readSession: () => Promise<AnalysisCalibrationContext>,
  reconstruct: (session: AnalysisCalibrationContext) => Promise<AnalysisCalibrationContext>): Promise<AnalysisCalibrationContext> {
  if (!log || log.user_id !== owner || log.vehicle_id !== vehicle) return {state: "unavailable", reason: "An owned selected log for this vehicle is required."};
  const session = await readSession();
  const durable = await reconstruct(session);
  if (durable.state !== "available") return durable;
  if (!resolveAnalysisCalibration(durable, log, owner, vehicle, []).identity) return {state: "unavailable", reason: "Durable source/Dataset/Definition admission is inconsistent."};
  if (session.state === "available" && resolveAnalysisCalibration(session, log, owner, vehicle, []).identity) {
    const a = session.result, b = durable.result;
    if (a.digest === b.digest && a.byteLength === b.byteLength && a.identity === b.identity
      && a.material.current.relationshipRevision === b.material.current.relationshipRevision
      && a.material.current.definitionSetRevisionId === b.material.current.definitionSetRevisionId) {
      return {...session, sourceId: durable.sourceId, resolutionPath: "Current admitted session, independently matched to the durable owned source and current Definition admission; no writes."};
    }
  }
  return {...durable, sessionId: null, resolutionPath: `${durable.resolutionPath} ${session.state === "available" ? "Stale or conflicting session rejected." : "Expired, absent or unavailable session was not used as authority."} No session created, renewed or replaced.`};
}

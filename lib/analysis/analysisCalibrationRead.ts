import type { OwnedLog } from "./analysisCapabilities";
import type { AnalysisCalibrationContext } from "./analysisCalibrationContext";
import { activeSubscriberSessionObjectPath } from "../calibration-workshop/subscriberSessionPointer.ts";
import { inspectSubscriberSession } from "../calibration-workshop/subscriberCalibrationPersistence.ts";
import { isSubscriberWorkshopSessionId } from "../calibration-workshop/subscriberUploadNavigation.ts";

type Download = (path: string) => Promise<{data: Blob | null; error: {statusCode?: string | number; message: string} | null}>;
/** Download-only capability. Expiry is respected; no recovery, refresh or cleanup. */
export async function readAnalysisCalibrationContext(log: OwnedLog | null, owner: string, vehicle: string, secret: string, download: Download): Promise<AnalysisCalibrationContext> {
  const unavailable = (reason: string): AnalysisCalibrationContext => ({state: "unavailable", reason});
  if (!log || log.user_id !== owner || log.vehicle_id !== vehicle) return unavailable("An owned selected log for this vehicle is required.");
  try {
    const pointer = await download(activeSubscriberSessionObjectPath(owner, vehicle, secret));
    if (pointer.error || !pointer.data) return unavailable(pointer.error && String(pointer.error.statusCode) !== "404" && pointer.error.message !== "Object not found"
      ? "The owned Calibration session pointer is temporarily unreadable." : "No active owned Calibration session pointer exists.");
    const sessionId = (await pointer.data.text()).trim();
    if (!isSubscriberWorkshopSessionId(sessionId)) return unavailable("The owned Calibration session pointer is invalid.");
    const session = await download(`sessions/${sessionId}`);
    if (session.error || !session.data) return unavailable("The referenced owned Calibration session object is missing or temporarily unreadable.");
    const inspected = inspectSubscriberSession(new Uint8Array(await session.data.arrayBuffer()), owner, vehicle);
    if (inspected.state !== "available") return unavailable({
      expired: "The existing owned Calibration session has expired. Its Dataset and Definition occurrences cannot be admitted as current context. No session was renewed or source substituted.",
      scope_mismatch: "The stored Calibration session owner/vehicle scope does not match.",
      corrupt: "The stored Calibration session cannot be decoded under its existing contract.",
    }[inspected.state]);
    if (inspected.result.status !== "workshop_ready") return unavailable("The owned Calibration session has no admitted workshop Dataset.");
    return {state: "available", owner, vehicle, sessionId, result: inspected.result};
  } catch {
    return unavailable("The owned Calibration context is temporarily unavailable. No recovery or persistence was attempted.");
  }
}

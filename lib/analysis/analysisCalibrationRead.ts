import type { OwnedLog } from "./analysisCapabilities";
import type { AnalysisCalibrationContext } from "./analysisCalibrationContext";
import { activeSubscriberSessionObjectPath } from "../calibration-workshop/subscriberSessionPointer.ts";
import { inspectSubscriberSession } from "../calibration-workshop/subscriberCalibrationPersistence.ts";
import { isSubscriberWorkshopSessionId } from "../calibration-workshop/subscriberUploadNavigation.ts";
import { deserialize } from "node:v8";

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
    const bytes = new Uint8Array(await session.data.arrayBuffer());
    const inspected = inspectSubscriberSession(bytes, owner, vehicle);
    if (inspected.state !== "available") {
      const failure = unavailable({
      expired: "The existing owned Calibration session has expired. Its Dataset and Definition occurrences cannot be admitted as current context. No session was renewed or source substituted.",
      scope_mismatch: "The stored Calibration session owner/vehicle scope does not match.",
      corrupt: "The stored Calibration session cannot be decoded under its existing contract.",
      }[inspected.state]);
      if (inspected.state !== "expired") return failure;
      // Founder-authorised locator only. No expired Dataset or Definition is returned.
      // Scope and version have already been checked by the existing inspector.
      const stored = deserialize(bytes) as {result?: {digest?: unknown; byteLength?: unknown; identity?: unknown}};
      const r = stored.result;
      return r && typeof r.digest === "string" && /^[a-f0-9]{64}$/i.test(r.digest)
        && typeof r.byteLength === "number" && Number.isSafeInteger(r.byteLength) && r.byteLength > 0
        && typeof r.identity === "string" && r.identity.length > 0
        ? {...failure, locator: {digest: r.digest, byteLength: r.byteLength, software: r.identity}}
        : failure;
    }
    if (inspected.result.status !== "workshop_ready") return unavailable("The owned Calibration session has no admitted workshop Dataset.");
    return {state: "available", owner, vehicle, sessionId, result: inspected.result,
      locator: {digest: inspected.result.digest, byteLength: inspected.result.byteLength, software: inspected.result.identity}};
  } catch {
    return unavailable("The owned Calibration context is temporarily unavailable. No recovery or persistence was attempted.");
  }
}

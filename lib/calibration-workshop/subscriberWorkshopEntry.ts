import type { SubscriberCalibrationResult } from "./subscriberCalibrationProvider.ts";
import { isSubscriberWorkshopSessionId } from "./subscriberUploadNavigation.ts";

type RecoveredSession = Readonly<{ sessionId: string; result: SubscriberCalibrationResult }>;

export async function resolveSubscriberWorkshopSession(input: Readonly<{
  requestedSession: string | string[] | undefined;
  ownerId: string;
  vehicleId: string;
}>, readers: Readonly<{
  readSession: (id: string, ownerId: string, vehicleId: string) => Promise<SubscriberCalibrationResult | null>;
  readLatest: (ownerId: string, vehicleId: string) => Promise<RecoveredSession | null>;
  recoverVehicle: (ownerId: string, vehicleId: string) => Promise<RecoveredSession | null>;
}>) {
  // Presence, not validity, decides whether recovery is permitted. Repeated
  // query parameters are ambiguous and must not silently select one token.
  if (input.requestedSession !== undefined) {
    const sessionId = typeof input.requestedSession === "string" && isSubscriberWorkshopSessionId(input.requestedSession) ? input.requestedSession : undefined;
    const result = sessionId ? await readers.readSession(sessionId, input.ownerId, input.vehicleId) : null;
    return { explicit: true, sessionId, result };
  }
  const recovered = await readers.readLatest(input.ownerId, input.vehicleId)
    ?? await readers.recoverVehicle(input.ownerId, input.vehicleId);
  return { explicit: false, sessionId: recovered?.sessionId, result: recovered?.result ?? null };
}

export type SubscriberWorkshopEntry =
  | Readonly<{ mode: "subscriber" }>
  | Readonly<{ mode: "session_unavailable" }>
  | Readonly<{ mode: "development_preview"; requestedPreviewRom: string }>
  | Readonly<{ mode: "empty" }>;

export function selectSubscriberWorkshopEntry(input: Readonly<{
  subscriberReady: boolean;
  explicitSession?: boolean;
  requestedPreviewRom: string | undefined;
  runtimeEnvironment: string | undefined;
}>): SubscriberWorkshopEntry {
  if (input.subscriberReady) return Object.freeze({ mode: "subscriber" });
  if (input.explicitSession) return Object.freeze({ mode: "session_unavailable" });
  if (input.runtimeEnvironment !== "production" && input.requestedPreviewRom?.trim()) return Object.freeze({ mode: "development_preview", requestedPreviewRom: input.requestedPreviewRom });
  return Object.freeze({ mode: "empty" });
}

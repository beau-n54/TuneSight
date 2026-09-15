import { createHmac } from "node:crypto";

export const SUBSCRIBER_ACTIVE_SESSION_PREFIX = "session-active";

export function activeSubscriberSessionObjectPath(ownerId: string, vehicleId: string, secret: string): string {
  if (![ownerId, vehicleId, secret].every((value) => value.trim())) throw new Error("Subscriber session pointer scope is incomplete.");
  const opaqueScope = createHmac("sha256", secret).update("tunesight.subscriber-session-active.v1\0").update(ownerId).update("\0").update(vehicleId).digest("base64url");
  return `${SUBSCRIBER_ACTIVE_SESSION_PREFIX}/${opaqueScope}`;
}

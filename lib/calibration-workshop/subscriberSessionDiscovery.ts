import { isSubscriberWorkshopSessionId } from "./subscriberUploadNavigation.ts";

/** The fresh pointer is always authoritative. At most one scoped candidate read
 * may overlap discovery. A stale hint can never become fallback evidence.
 * Readers must already be bound to the authenticated owner and owned vehicle.
 */
export async function discoverSubscriberSession<T>(readPointer: () => Promise<string | null>,
  readSession: (id: string) => Promise<T | null>, hint?: string): Promise<{ sessionId: string; result: T } | null> {
  const candidate = hint && isSubscriberWorkshopSessionId(hint) ? hint : undefined;
  const pointer = readPointer();
  const speculative = candidate ? readSession(candidate).then(result => ({ result }), error => ({ error })) : null;
  const sessionId = await pointer;
  if (!sessionId) return null;
  let result: T | null;
  if (sessionId === candidate && speculative) {
    const completed = await speculative;
    if ("error" in completed) throw completed.error;
    result = completed.result;
  } else result = await readSession(sessionId);
  return result === null ? null : { sessionId, result };
}

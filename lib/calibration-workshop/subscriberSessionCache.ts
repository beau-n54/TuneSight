import { decodeSubscriberSession, type SessionReadTiming } from "./subscriberCalibrationPersistence.ts";
import { isSubscriberWorkshopSessionId } from "./subscriberUploadNavigation.ts";

type SessionScope = Readonly<{ sessionId: string; ownerId: string; vehicleId: string }>;
export type SessionObjectInfo = Readonly<{
  id?: string; version?: string; etag?: string; lastModified?: string; size?: number;
  isDeleteMarker?: boolean; archivedAt?: unknown;
}>;
export type SessionObjectReader = Readonly<{
  info(): Promise<SessionObjectInfo | null>;
  download(): Promise<Uint8Array | null>;
}>;
type Entry = { stamp: string; bytes: Uint8Array; until: number };

function stamp(info: SessionObjectInfo): string | null {
  const fields = [info.id, info.version, info.etag, info.lastModified];
  return fields.every(value => typeof value === "string" && value.length > 0) &&
    Number.isSafeInteger(info.size) && info.size! > 0
    ? JSON.stringify([...fields, info.size]) : null;
}
const readable = (info: SessionObjectInfo | null): info is SessionObjectInfo =>
  Boolean(info && !info.isDeleteMarker && info.archivedAt == null);

/** Process-local bytes only: never an entitlement, decoded-object or HTTP cache.
 * Every read checks fresh storage metadata. Every caller receives a fresh scoped,
 * expiry-checked decode, so Dataset/Definition/Working objects are never shared.
 * A metadata failure, deletion or replacement cannot fall back to cached evidence.
 */
export function createSubscriberSessionCache(options: {
  maxBytes?: number; maxEntries?: number; lifetimeMs?: number; now?: () => number;
} = {}) {
  const maxBytes = options.maxBytes ?? 96 * 1024 * 1024, maxEntries = options.maxEntries ?? 4;
  const lifetimeMs = options.lifetimeMs ?? 120_000, now = options.now ?? Date.now;
  const entries = new Map<string, Entry>(), pending = new Map<string, Promise<Uint8Array | null>>();
  let retainedBytes = 0;
  const remove = (key: string) => {
    retainedBytes -= entries.get(key)?.bytes.byteLength ?? 0;
    entries.delete(key);
  };
  const prune = () => { for (const [key, entry] of entries) if (entry.until <= now()) remove(key); };
  return {
    async read(scope: SessionScope, reader: SessionObjectReader, timing?: SessionReadTiming) {
      if (!isSubscriberWorkshopSessionId(scope.sessionId) || !scope.ownerId || !scope.vehicleId) return null;
      const key = JSON.stringify([scope.ownerId, scope.vehicleId, scope.sessionId]);
      prune();
      try {
        const metadataStart = performance.now(), info = await reader.info();
        timing?.("metadata", performance.now() - metadataStart);
        if (!readable(info)) { remove(key); return null; }
        const version = stamp(info), cached = entries.get(key);
        let bytes: Uint8Array | null;
        if (version && cached?.stamp === version && cached.until > now()) {
          entries.delete(key); entries.set(key, cached); // bounded LRU, not sliding lifetime
          bytes = cached.bytes;
          timing?.("retained", 0);
        } else {
          remove(key);
          const pendingKey = JSON.stringify([key, version]);
          let load = version ? pending.get(pendingKey) : undefined;
          if (!load) {
            load = (async () => {
              const downloadStart = performance.now(), downloaded = await reader.download();
              timing?.("download", performance.now() - downloadStart);
              if (!downloaded) return null;
              // A replacement/deletion during a download must not seed the cache.
              const versionStart = performance.now(), after = await reader.info();
              timing?.("version_check", performance.now() - versionStart);
              if (!readable(after) || (version && stamp(after) !== version) ||
                (typeof after.size === "number" && after.size !== downloaded.byteLength)) return null;
              const ownedBytes = Uint8Array.from(downloaded);
              if (version && maxEntries > 0 && lifetimeMs > 0 && ownedBytes.byteLength <= maxBytes) {
                prune(); remove(key);
                while (entries.size && (entries.size >= maxEntries || retainedBytes + ownedBytes.byteLength > maxBytes)) remove(entries.keys().next().value!);
                entries.set(key, { stamp: version, bytes: ownedBytes, until: now() + lifetimeMs });
                retainedBytes += ownedBytes.byteLength;
              }
              return ownedBytes;
            })();
            // Bound bookkeeping even under many distinct simultaneous requests.
            if (version && pending.size < 32) {
              pending.set(pendingKey, load);
              void load.finally(() => { if (pending.get(pendingKey) === load) pending.delete(pendingKey); }).catch(() => {});
            }
          }
          bytes = await load;
        }
        // V8 may deserialize typed arrays as views into the input buffer. Give
        // each decode its own bytes so callers cannot alter the retained entry.
        const result = bytes ? decodeSubscriberSession(Uint8Array.from(bytes), scope.ownerId, scope.vehicleId, now(), timing) : null;
        if (!result) remove(key);
        return result;
      } catch {
        remove(key);
        throw new Error("SUBSCRIBER_SESSION_TEMPORARILY_UNAVAILABLE");
      }
    },
  };
}

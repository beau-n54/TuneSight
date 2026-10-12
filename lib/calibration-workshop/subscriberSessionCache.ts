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
  downloadVersioned?(): Promise<{ bytes: Uint8Array; etag: string | null } | null>;
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
const strongEtag = (value: string | null | undefined) => typeof value === "string" &&
  value.length > 0 && !value.startsWith("W/") ? value.replace(/^"|"$/g, "") : null;

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
  const firstReads = new Map<string, Promise<{ stamp: string; bytes: Uint8Array } | null>>();
  let retainedBytes = 0;
  const remove = (key: string) => {
    retainedBytes -= entries.get(key)?.bytes.byteLength ?? 0;
    entries.delete(key);
  };
  const prune = () => { for (const [key, entry] of entries) if (entry.until <= now()) remove(key); };
  const retain = (key: string, version: string, bytes: Uint8Array) => {
    if (maxEntries <= 0 || lifetimeMs <= 0 || bytes.byteLength > maxBytes) return;
    prune(); remove(key);
    while (entries.size && (entries.size >= maxEntries || retainedBytes + bytes.byteLength > maxBytes)) remove(entries.keys().next().value!);
    entries.set(key, { stamp: version, bytes, until: now() + lifetimeMs });
    retainedBytes += bytes.byteLength;
  };
  return {
    async read(scope: SessionScope, reader: SessionObjectReader, timing?: SessionReadTiming) {
      if (!isSubscriberWorkshopSessionId(scope.sessionId) || !scope.ownerId || !scope.vehicleId) return null;
      const key = JSON.stringify([scope.ownerId, scope.vehicleId, scope.sessionId]);
      prune();
      try {
        // Only a body carrying its own strong content validator can overlap the
        // initial metadata read. Otherwise a same-size replacement could pair old
        // bytes with new metadata. Both fresh metadata versions must still agree.
        if (!entries.has(key) && reader.downloadVersioned) {
          const metadataStart = performance.now();
          const metadata = reader.info().then(info => { timing?.("metadata", performance.now() - metadataStart); return info; });
          let first = firstReads.get(key);
          if (!first) {
            const downloadStart = performance.now();
            first = (async () => {
              const [before, body] = await Promise.all([metadata, reader.downloadVersioned!().then(value => {
                timing?.("download", performance.now() - downloadStart); return value;
              })]);
              if (!readable(before) || !body) return null;
              const version = stamp(before), etag = strongEtag(body.etag);
              if (!version || !etag || etag !== strongEtag(before.etag)) return null;
              const checkStart = performance.now(), after = await reader.info();
              timing?.("version_check", performance.now() - checkStart);
              if (!readable(after) || stamp(after) !== version || body.bytes.byteLength !== after.size) return null;
              return { stamp: version, bytes: Uint8Array.from(body.bytes) };
            })();
            if (firstReads.size < 32) {
              firstReads.set(key, first);
              void first.finally(() => { if (firstReads.get(key) === first) firstReads.delete(key); }).catch(() => {});
            }
          }
          // Each joining caller performs its own fresh metadata check even when
          // it shares a transfer; no failure can fall back to retained evidence.
          const [info, loaded] = await Promise.all([metadata, first]);
          if (!readable(info) || !loaded || stamp(info) !== loaded.stamp) { remove(key); return null; }
          retain(key, loaded.stamp, loaded.bytes);
          const result = decodeSubscriberSession(Uint8Array.from(loaded.bytes), scope.ownerId, scope.vehicleId, now(), timing);
          if (!result) remove(key);
          return result;
        }
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
              if (version) retain(key, version, ownedBytes);
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

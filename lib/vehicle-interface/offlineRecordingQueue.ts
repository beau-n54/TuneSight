import { createCanonicalLiveRecording, type CanonicalLiveRecording, type RecordedTelemetrySample } from "./liveRecording.ts";

export type RetainedRecording = Readonly<{ recording: CanonicalLiveRecording; adapterProfileReference: string; retainedAt: string; synchronization: "pending_export" | "exported" }>;
export function retainRecording(input: { recording: CanonicalLiveRecording; adapterProfileReference: string; retainedAt: string }): RetainedRecording { if (!input.adapterProfileReference.trim() || !Number.isFinite(Date.parse(input.retainedAt))) throw new Error("Offline recording retention metadata is invalid."); return Object.freeze({ ...input, synchronization: "pending_export" }); }
export function markRecordingExported(input: RetainedRecording): RetainedRecording { return Object.freeze({ ...input, synchronization: "exported" }); }

export const RECORDING_LIMITS = Object.freeze({ retained: 20, samples: 50_000, chunk: 128, buffered: 256 });
export type RecordingMetadata = Omit<CanonicalLiveRecording, "contractVersion" | "state" | "samples" | "stoppedAt">;
export type RecordingJournal = Readonly<{ ownerId: string; vehicleId: string; metadata: RecordingMetadata; state: "recording" | "recorded" | "interrupted"; stoppedAt: string | null; count: number; chunks: number; lastSequences: Readonly<Record<string, number>> }>;
type StoredChunk = { ownerId: string; vehicleId: string; recordingId: string; index: number; samples: readonly RecordedTelemetrySample[] };

export function validateRecordingChunk(samples: readonly RecordedTelemetrySample[], previous: Readonly<Record<string, number>>): Record<string, number> {
  if (!samples.length || samples.length > RECORDING_LIMITS.chunk || JSON.stringify(samples).length > 256 * 1024) throw new Error("recording_chunk_bound");
  const sequences = { ...previous };
  for (const sample of samples) {
    if (!sample.channelKey || sample.channelKey.length > 128 || !sample.channelRevisionId || sample.channelRevisionId.length > 256
      || sample.provenance.length > 1024 || sample.unit.length > 64 || !Number.isFinite(sample.value)
      || !Number.isSafeInteger(sample.sequence) || sample.sequence < 0 || sample.sequence <= (sequences[sample.channelKey] ?? -1)
      || !Number.isFinite(Date.parse(sample.acquiredAt)) || !Number.isFinite(Date.parse(sample.receivedAt))
      || !Number.isFinite(sample.latencyMs) || sample.latencyMs < 0 || !Number.isSafeInteger(sample.droppedSincePrevious) || sample.droppedSincePrevious < 0) throw new Error("recording_sample_invalid_or_regressed");
    sequences[sample.channelKey] = sample.sequence;
  }
  return sequences;
}

/** Version 2 deliberately does not import v1's unowned recordings. Scope is
 * supplied by the authenticated server page, never a browser plan preference.
 * This is account isolation in the app, not protection against local malware. */
export class BrowserRecordingStore {
  private readonly ownerId: string;
  private readonly vehicleId: string;
  private readonly factory: IDBFactory | undefined;
  constructor(ownerId: string, vehicleId: string, factory?: IDBFactory) {
    if (!ownerId || !vehicleId) throw new Error("recording_owner_scope_required");
    this.ownerId = ownerId; this.vehicleId = vehicleId; this.factory = factory;
  }
  private key(id: string): string[] { return [this.ownerId, this.vehicleId, id]; }
  private open(): Promise<IDBDatabase> {
    const factory = this.factory ?? globalThis.indexedDB;
    if (!factory) return Promise.reject(new Error("recording_storage_unavailable"));
    return new Promise((resolve, reject) => {
      const request = factory.open("tunesight-local-telemetry-v2", 1);
      request.onupgradeneeded = () => {
        const records = request.result.createObjectStore("recordings");
        records.createIndex("scope", ["ownerId", "vehicleId"]);
        const chunks = request.result.createObjectStore("chunks");
        chunks.createIndex("recording", ["ownerId", "vehicleId", "recordingId"]);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error("recording_storage_unavailable"));
      request.onblocked = () => reject(new Error("recording_storage_blocked_close_other_tabs"));
    });
  }
  private async run<T>(mode: IDBTransactionMode, action: (tx: IDBTransaction) => Promise<T>): Promise<T> {
    const db = await this.open();
    try {
      const tx = db.transaction(["recordings", "chunks"], mode);
      const completed = new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = tx.onerror = () => reject(new Error("recording_transaction_not_committed")); });
      // Attach both rejection handlers immediately, including quota failure after
      // an individual request's success. Only tx.oncomplete grants durability.
      const work = action(tx).catch(error => { try { tx.abort(); } catch { /* already aborted */ } throw error; });
      const [result] = await Promise.all([work, completed]);
      return result;
    } finally { db.close(); }
  }
  async begin(metadata: RecordingMetadata): Promise<void> {
    if (metadata.vehicleId !== this.vehicleId || !Number.isFinite(Date.parse(metadata.startedAt))) throw new Error("recording_scope_invalid");
    await this.run("readwrite", async tx => {
      const records = tx.objectStore("recordings");
      const count = await idbRequest<number>(records.index("scope").count([this.ownerId, this.vehicleId]));
      if (count >= RECORDING_LIMITS.retained) throw new Error("Local recording limit reached. Export or delete a retained recording first.");
      await idbRequest(records.add({ ownerId: this.ownerId, vehicleId: this.vehicleId, metadata, state: "recording", stoppedAt: null, count: 0, chunks: 0, lastSequences: {} } satisfies RecordingJournal, this.key(metadata.recordingId)));
    });
  }
  async append(id: string, samples: readonly RecordedTelemetrySample[]): Promise<number> {
    return this.run("readwrite", async tx => {
      const records = tx.objectStore("recordings"), entry = await idbRequest<RecordingJournal | undefined>(records.get(this.key(id)));
      if (!entry || entry.state !== "recording") throw new Error("recording_not_active");
      if (entry.count + samples.length > RECORDING_LIMITS.samples) throw new Error("Recording sample limit reached. Stop and export this recording.");
      const lastSequences = validateRecordingChunk(samples, entry.lastSequences);
      await idbRequest(tx.objectStore("chunks").add({ ownerId: this.ownerId, vehicleId: this.vehicleId, recordingId: id, index: entry.chunks, samples } satisfies StoredChunk, [...this.key(id), entry.chunks]));
      const count = entry.count + samples.length;
      await idbRequest(records.put({ ...entry, count, chunks: entry.chunks + 1, lastSequences }, this.key(id)));
      return count;
    });
  }
  async finish(id: string, state: "recorded" | "interrupted", stoppedAt: string): Promise<void> {
    await this.run("readwrite", async tx => {
      const records = tx.objectStore("recordings"), entry = await idbRequest<RecordingJournal | undefined>(records.get(this.key(id)));
      if (!entry || !Number.isFinite(Date.parse(stoppedAt))) throw new Error("recording_unavailable");
      await idbRequest(records.put({ ...entry, state, stoppedAt }, this.key(id)));
    });
  }
  async list(): Promise<readonly RecordingJournal[]> {
    return this.run("readonly", tx => idbRequest<RecordingJournal[]>(tx.objectStore("recordings").index("scope").getAll([this.ownerId, this.vehicleId], RECORDING_LIMITS.retained)));
  }
  async export(id: string): Promise<CanonicalLiveRecording & { recovery?: string }> {
    const { entry, chunks } = await this.run("readonly", async tx => {
      const entry = await idbRequest<RecordingJournal | undefined>(tx.objectStore("recordings").get(this.key(id)));
      if (!entry) throw new Error("recording_unavailable");
      const chunks = await idbRequest<StoredChunk[]>(tx.objectStore("chunks").index("recording").getAll(this.key(id), RECORDING_LIMITS.samples));
      return { entry, chunks };
    });
    const samples = chunks.sort((a,b) => a.index-b.index).flatMap(chunk => chunk.samples);
    if (samples.length !== entry.count || samples.length > RECORDING_LIMITS.samples) throw new Error("recording_journal_incomplete");
    const stoppedAt = entry.stoppedAt ?? samples.at(-1)?.receivedAt ?? entry.metadata.startedAt;
    const recording = createCanonicalLiveRecording({ ...entry.metadata, stoppedAt, samples });
    return entry.state === "recorded" ? recording : Object.freeze({ ...recording, recovery: "Interrupted recording: only transaction-committed samples are present. The final in-memory batch may be unavailable; completion is not claimed." });
  }
  async delete(id: string): Promise<void> {
    await this.run("readwrite", async tx => {
      const keys = await idbRequest<IDBValidKey[]>(tx.objectStore("chunks").index("recording").getAllKeys(this.key(id), RECORDING_LIMITS.samples));
      await Promise.all(keys.map(key => idbRequest(tx.objectStore("chunks").delete(key))));
      await idbRequest(tx.objectStore("recordings").delete(this.key(id)));
    });
  }
}
function idbRequest<T = unknown>(request: IDBRequest): Promise<T> { return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result as T); request.onerror = () => reject(new Error("recording_storage_request_failed")); }); }

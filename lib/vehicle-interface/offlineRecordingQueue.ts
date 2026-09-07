import type { CanonicalLiveRecording } from "./liveRecording.ts";

export type RetainedRecording = Readonly<{ recording: CanonicalLiveRecording; adapterProfileReference: string; retainedAt: string; synchronization: "pending_export" | "exported" }>;
export function retainRecording(input: { recording: CanonicalLiveRecording; adapterProfileReference: string; retainedAt: string }): RetainedRecording { if (!input.adapterProfileReference.trim() || !Number.isFinite(Date.parse(input.retainedAt))) throw new Error("Offline recording retention metadata is invalid."); return Object.freeze({ ...input, synchronization: "pending_export" }); }
export function markRecordingExported(input: RetainedRecording): RetainedRecording { return Object.freeze({ ...input, synchronization: "exported" }); }

export class BrowserRecordingStore {
  private readonly database = "tunesight-local-telemetry-v1";
  async put(item: RetainedRecording): Promise<void> { const db = await this.open(); await transaction(db, "readwrite", (store) => store.put(item, item.recording.recordingId)); db.close(); }
  async get(recordingId: string): Promise<RetainedRecording | null> { const db = await this.open(); const result = await transaction(db, "readonly", (store) => store.get(recordingId)); db.close(); return (result as RetainedRecording | undefined) ?? null; }
  private open(): Promise<IDBDatabase> { return new Promise((resolve, reject) => { const request = indexedDB.open(this.database, 1); request.onupgradeneeded = () => request.result.createObjectStore("recordings"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error ?? new Error("offline_recording_database_failed")); }); }
}
function transaction(db: IDBDatabase, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest): Promise<unknown> { return new Promise((resolve, reject) => { const tx = db.transaction("recordings", mode), request = action(tx.objectStore("recordings")); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error ?? new Error("offline_recording_write_failed")); }); }

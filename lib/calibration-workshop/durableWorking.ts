import { createHash } from "node:crypto";
import { createBrowserWorkingCalibrationStore } from "./workingCalibrationPersistence.ts";
import type { WorkingCalibration, WorkingDefinitionSeed, WorkingCellAddress } from "./workingCalibration.ts";

export const DURABLE_WORKING_CONTRACT = "tunesight.durable-working.v1" as const;
export const MAX_WORKING_BYTES = 2 * 1024 * 1024;
export type DurableWorkingIdentity = Readonly<{
  ownerId: string; vehicleId: string; sessionId: string; currentDatasetId: string; currentDatasetRevision: string;
  romLayoutId: string; relationshipRevision: string; definitionSetRevision: string;
  sourceDigest: string; containerDigest: string; containerType: string; sourceBytes: number;
  definitionSourceId: string; definitionSourceDigest: string;
}>;
export type DurableRevisionSummary = Readonly<{
  id: string; sequence: number; parent_id: string | null; previous_head_id: string | null; restored_from_id: string | null;
  content_hash: string; created_at: string; contract_version: typeof DURABLE_WORKING_CONTRACT; capability_state: "EDIT_ONLY_OUTPUT_LOCKED";
}>;
export type DurableWorkingSnapshot = Readonly<{
  head: DurableRevisionSummary | null; working: WorkingCalibration | null; history: readonly DurableRevisionSummary[];
}>;
export function canonicalWorkingJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalWorkingJson).join(",")}]`;
  if (!value || typeof value !== "object") throw Error("WORKING_INVALID_PAYLOAD");
  return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalWorkingJson(v)}`).join(",")}}`;
}
export const workingSha256 = (text: string) => createHash("sha256").update(text).digest("hex");
export function durableWorkingScope(identity: DurableWorkingIdentity) {
  const identityText = canonicalWorkingJson(identity);
  if (Object.values(identity).some(v => typeof v === "string" && (!v || v.length > 512)) ||
    !Number.isSafeInteger(identity.sourceBytes) || identity.sourceBytes <= 0 || identityText.length > 8192)
    throw Error("WORKING_SCOPE_UNAVAILABLE");
  return { identityText, scopeId: workingSha256(identityText) };
}
/** The browser supplies a proposal. Only replay against fresh owner evidence can
 * produce the canonical revision. This does not read/write browser storage. */
export function replayDurableWorking(value: unknown, seed: WorkingCalibration,
  resolve: (revision: string, occurrence: number) => WorkingDefinitionSeed | undefined): WorkingCalibration {
  const text = canonicalWorkingJson(value);
  if (Buffer.byteLength(text) > MAX_WORKING_BYTES) throw Error("WORKING_PAYLOAD_LIMIT");
  const proposed = JSON.parse(text) as WorkingCalibration;
  if (!proposed || proposed.contractVersion !== seed.contractVersion || !Array.isArray(proposed.mutations) ||
    proposed.mutations.length > 4096 || !Number.isSafeInteger(proposed.cursor) || proposed.cursor < 0 ||
    proposed.cursor > proposed.mutations.length || !Number.isFinite(Date.parse(proposed.createdAt)) ||
    !Number.isFinite(Date.parse(proposed.updatedAt))) throw Error("WORKING_INVALID_PAYLOAD");
  let cells = 0;
  for (const mutation of proposed.mutations) {
    if (mutation && !["assign", "delta", "percentage"].includes(mutation.operation) && !mutation.exactRaw) throw Error("WORKING_INVALID_MUTATION");
    if (!mutation || !["assign", "raw", "delta", "percentage", "multiply", "matrix", "revert", "interpolate-horizontal", "interpolate-vertical"].includes(mutation.operation) ||
      !Array.isArray(mutation.targets) || !mutation.targets.length || (cells += mutation.targets.length) > 16384 ||
      mutation.targets.some((t: WorkingCellAddress) => !t || typeof t.definitionRevision !== "string" ||
        ![t.occurrence, t.index, t.row, t.column].every(n => Number.isSafeInteger(n) && n >= 0))) throw Error("WORKING_INVALID_MUTATION");
  }
  const restored = createBrowserWorkingCalibrationStore({ getItem: () => text, setItem: () => { throw Error("READ_ONLY"); }, removeItem: () => { throw Error("READ_ONLY"); } }, true)
    .load(seed, seed, resolve);
  if (!restored || proposed.workingCalibrationId !== restored.workingCalibrationId ||
    canonicalWorkingJson(proposed.mutations.map(m => ({ ...m, source: m.source ?? "toolbar" }))) !== canonicalWorkingJson(restored.mutations))
    throw Error("WORKING_REPLAY_MISMATCH");
  return restored;
}

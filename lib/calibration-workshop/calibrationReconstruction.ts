import { createHash } from "node:crypto";
import type { EngineeringBinary, ContainerType } from "../tunes/binaryContainer.ts";
import type { QualifiedCalibrationDataset } from "../xdf/qualifiedCalibrationDataset.ts";
import type { XdfDefinitionRevision } from "../xdf/canonicalXdfDefinition.ts";
import { listWorkingChanges, type WorkingCalibration } from "./workingCalibration.ts";

export const RAW_MUTATION_PLAN_CONTRACT = "tunesight.raw-mutation-plan.v1" as const;
export const CALIBRATION_RECONSTRUCTION_CONTRACT = "tunesight.calibration-reconstruction.v1" as const;

export type ReconstructionBlocker = "BINDING_MISMATCH" | "INVERSE_CONVERSION" | "UNSUPPORTED_RAW_REPRESENTATION" | "ADDRESS_BOUNDS" | "QUARANTINE" | "CONFLICTING_WRITE" | "CURRENT_BYTES_MISMATCH" | "RECONSTRUCTION_VALIDATION_FAILURE";
export type PlannedRawMutation = Readonly<{ sequence: number; workingCalibrationId: string; workingCalibrationRevision: string; currentDatasetId: string; currentDatasetRevision: string; romLayoutId: string; relationshipRevision: string; definitionSetRevision: string; definitionIdentity: string; definitionRevision: string; occurrence: number; index: number; row: number; column: number; currentEngineeringValue: number; workingEngineeringTarget: number; inverseScale: number; inverseOffset: number; rawCurrentValue: number; rawTargetValue: number; roundTripEngineeringValue: number; binaryOffset: number; widthBits: 8 | 16 | 32; signed: boolean; endianness: "little" | "big"; byteRange: Readonly<{ start: number; endExclusive: number }>; targetBytes: readonly number[]; validation: "VALID" }>;
export type RawMutationPlan = Readonly<{ contractVersion: typeof RAW_MUTATION_PLAN_CONTRACT; planId: string; planRevision: string; workingCalibrationId: string; workingCalibrationRevision: string; currentDatasetId: string; currentDatasetRevision: string; exactCurrentBinaryDigest: string; mutations: readonly PlannedRawMutation[]; blocked: readonly Readonly<{ blocker: ReconstructionBlocker; finding: string }>[]; validation: "VALID" | "BLOCKED" }>;
export type IntegrityCapability = Readonly<{ state: "CHECKSUM_QUALIFIED" | "CHECKSUM_UNKNOWN" | "CHECKSUM_UNSUPPORTED"; strategyRevision: string | null; findings: readonly string[] }>;
export type ExportCapability = Readonly<{ reconstruct: "RECONSTRUCT_QUALIFIED" | "RECONSTRUCT_BLOCKED"; export: "EXPORT_QUALIFIED" | "EXPORT_BLOCKED_CHECKSUM_UNKNOWN" | "EXPORT_BLOCKED_CHECKSUM_UNSUPPORTED" | "EXPORT_BLOCKED_RECONSTRUCTION"; flash: "FLASH_NOT_QUALIFIED"; findings: readonly string[] }>;

const canonical = (value: unknown): string => { if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value); if (typeof value === "number") { if (!Number.isFinite(value)) throw new Error("Identity contains a non-finite number."); return JSON.stringify(Object.is(value, -0) ? 0 : value); } if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`; if (!value || typeof value !== "object") throw new Error("Identity contains unsupported material."); const record = value as Record<string, unknown>; return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`; };
const hash = (domain: string, value: unknown) => createHash("sha256").update(domain).update(Buffer.from([0])).update(canonical(value)).digest("hex");
const freeze = <T>(value: T): T => { if (Array.isArray(value)) return Object.freeze(value.map(freeze)) as T; if (value && typeof value === "object" && !ArrayBuffer.isView(value)) return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, freeze(item)]))) as T; return value; };
const occurrenceKey = (revision: string, occurrence: number) => `${revision}:${occurrence}`;

export function validateRawMutationConflicts(mutations: readonly Pick<PlannedRawMutation, "binaryOffset" | "targetBytes">[]): readonly Readonly<{ blocker: "CONFLICTING_WRITE"; finding: string }>[] {
  const writes = new Map<number, number>(), blocked: { blocker: "CONFLICTING_WRITE"; finding: string }[] = [];
  for (const mutation of mutations) mutation.targetBytes.forEach((byte, index) => { const offset = mutation.binaryOffset + index, prior = writes.get(offset); if (prior !== undefined && prior !== byte) blocked.push({ blocker: "CONFLICTING_WRITE", finding: "Different canonical writes target the same byte." }); else writes.set(offset, byte); });
  return freeze(blocked);
}

function integerBytes(value: number, widthBits: 8 | 16 | 32, signed: boolean, endianness: "little" | "big"): readonly number[] {
  const buffer = Buffer.alloc(widthBits / 8);
  if (widthBits === 8) { if (signed) buffer.writeInt8(value); else buffer.writeUInt8(value); }
  else if (widthBits === 16) { if (signed) { if (endianness === "little") buffer.writeInt16LE(value); else buffer.writeInt16BE(value); } else if (endianness === "little") buffer.writeUInt16LE(value); else buffer.writeUInt16BE(value); }
  else if (signed) { if (endianness === "little") buffer.writeInt32LE(value); else buffer.writeInt32BE(value); } else if (endianness === "little") buffer.writeUInt32LE(value); else buffer.writeUInt32BE(value);
  return Object.freeze([...buffer]);
}

export function buildRawMutationPlan(input: Readonly<{ original: EngineeringBinary; dataset: QualifiedCalibrationDataset; working: WorkingCalibration; definitions: readonly XdfDefinitionRevision[] }>): RawMutationPlan {
  const blocked: { blocker: ReconstructionBlocker; finding: string }[] = [], mutations: PlannedRawMutation[] = [];
  const digest = createHash("sha256").update(input.original.bytes).digest("hex");
  if (digest !== input.dataset.exactBinaryIdentity.digest || input.original.byteLength !== input.dataset.exactBinaryIdentity.byteLength || input.working.currentDatasetId !== input.dataset.datasetId || input.working.currentDatasetRevision !== input.dataset.datasetRevision || input.working.romLayoutId !== input.dataset.romLayoutId || input.working.relationshipRevision !== input.dataset.relationshipRevision || input.working.definitionSetRevision !== input.dataset.definitionSetRevisionId) blocked.push({ blocker: "BINDING_MISMATCH", finding: "Original bytes, Current Dataset, Working Calibration, layout, relationship and Definition Set must bind exactly." });
  const datasetOccurrences = new Map<string, QualifiedCalibrationDataset["definitions"][number]>(), definitionOccurrences = new Map<string, XdfDefinitionRevision>();
  const datasetCounts = new Map<string, number>(), definitionCounts = new Map<string, number>();
  for (const item of input.dataset.definitions) { const occurrence = datasetCounts.get(item.definitionRevisionId) ?? 0; datasetCounts.set(item.definitionRevisionId, occurrence + 1); datasetOccurrences.set(occurrenceKey(item.definitionRevisionId, occurrence), item); }
  for (const item of input.definitions) { const occurrence = definitionCounts.get(item.revisionId) ?? 0; definitionCounts.set(item.revisionId, occurrence + 1); definitionOccurrences.set(occurrenceKey(item.revisionId, occurrence), item); }
  for (const [sequence, change] of listWorkingChanges(input.working).entries()) {
    const seed = input.working.definitions.find((item) => item.definitionRevision === change.address.definitionRevision && item.occurrence === change.address.occurrence), capability = seed?.capability;
    const datasetDefinition = datasetOccurrences.get(occurrenceKey(change.address.definitionRevision, change.address.occurrence)), definition = definitionOccurrences.get(occurrenceKey(change.address.definitionRevision, change.address.occurrence));
    if (!seed || seed.availability !== "available") { blocked.push({ blocker: "QUARANTINE", finding: "Unavailable or quarantined definitions cannot enter reconstruction." }); continue; }
    if (!capability || capability.state !== "EDIT_QUALIFIED" || !capability.inverse || !datasetDefinition?.engineeringEvidence || !datasetDefinition.rawEvidence || !definition || definition.identity.status !== "derived" || !definition.identity.stableId) { blocked.push({ blocker: "BINDING_MISMATCH", finding: "Mutation lacks exact qualified Definition, Dataset, or EDIT binding." }); continue; }
    const rawEvidence = datasetDefinition.rawEvidence, widthBits = rawEvidence.widthBits, signed = rawEvidence.signed, endianness = rawEvidence.endianness;
    if ((widthBits !== 8 && widthBits !== 16 && widthBits !== 32) || signed === null || endianness === null) { blocked.push({ blocker: "UNSUPPORTED_RAW_REPRESENTATION", finding: "Exact integer width, signedness and endianness are required." }); continue; }
    const raw = (change.working - capability.inverse.offset) / capability.inverse.scale, rawTarget = Math.round(raw), roundTrip = capability.inverse.offset + capability.inverse.scale * rawTarget;
    const tolerance = Math.max(Number.EPSILON * Math.max(1, Math.abs(change.working)) * 8, Math.abs(capability.inverse.scale) * 1e-9);
    if (!Number.isFinite(raw) || Math.abs(raw - rawTarget) > 1e-7 || rawTarget < capability.inverse.rawMinimum || rawTarget > capability.inverse.rawMaximum || Math.abs(roundTrip - change.working) > tolerance) { blocked.push({ blocker: "INVERSE_CONVERSION", finding: "Engineering target cannot round-trip through the exact qualified raw representation." }); continue; }
    const offset = rawEvidence.exactRawOffsets[change.address.index], rawCurrent = rawEvidence.rawValues[change.address.index], trace = datasetDefinition.engineeringEvidence.cellTrace[change.address.index];
    if (offset === undefined || rawCurrent === undefined || !trace || trace.rawOffset !== offset || trace.rawValue !== rawCurrent || trace.engineeringValue !== change.current || offset < 0 || offset + widthBits / 8 > input.original.byteLength) { blocked.push({ blocker: offset === undefined || offset < 0 || offset + widthBits / 8 > input.original.byteLength ? "ADDRESS_BOUNDS" : "CURRENT_BYTES_MISMATCH", finding: "Current raw evidence, cell trace, source bytes and address bounds must agree exactly." }); continue; }
    const currentBytes = integerBytes(rawCurrent, widthBits, signed, endianness), actual = [...input.original.bytes.subarray(offset, offset + widthBits / 8)];
    if (!Buffer.from(currentBytes).equals(Buffer.from(actual))) { blocked.push({ blocker: "CURRENT_BYTES_MISMATCH", finding: "Original bytes do not match the Current Dataset pre-mutation representation." }); continue; }
    mutations.push(freeze({ sequence: sequence + 1, workingCalibrationId: input.working.workingCalibrationId, workingCalibrationRevision: input.working.workingCalibrationRevision, currentDatasetId: input.dataset.datasetId, currentDatasetRevision: input.dataset.datasetRevision, romLayoutId: input.dataset.romLayoutId, relationshipRevision: input.dataset.relationshipRevision, definitionSetRevision: input.dataset.definitionSetRevisionId, definitionIdentity: definition.identity.stableId, definitionRevision: definition.revisionId, occurrence: change.address.occurrence, index: change.address.index, row: change.address.row, column: change.address.column, currentEngineeringValue: change.current, workingEngineeringTarget: change.working, inverseScale: capability.inverse.scale, inverseOffset: capability.inverse.offset, rawCurrentValue: rawCurrent, rawTargetValue: rawTarget, roundTripEngineeringValue: roundTrip, binaryOffset: offset, widthBits, signed, endianness, byteRange: { start: offset, endExclusive: offset + widthBits / 8 }, targetBytes: integerBytes(rawTarget, widthBits, signed, endianness), validation: "VALID" as const }));
  }
  blocked.push(...validateRawMutationConflicts(mutations));
  const identity = { workingCalibrationRevision: input.working.workingCalibrationRevision, currentDatasetRevision: input.dataset.datasetRevision, exactCurrentBinaryDigest: digest }, material = { ...identity, mutations, blocked };
  return freeze({ contractVersion: RAW_MUTATION_PLAN_CONTRACT, planId: `raw-mutation-plan:${hash("tunesight.raw-mutation-plan-identity.v1", identity)}`, planRevision: `raw-mutation-plan-revision:${hash("tunesight.raw-mutation-plan-revision.v1", material)}`, workingCalibrationId: input.working.workingCalibrationId, workingCalibrationRevision: input.working.workingCalibrationRevision, currentDatasetId: input.dataset.datasetId, currentDatasetRevision: input.dataset.datasetRevision, exactCurrentBinaryDigest: digest, mutations, blocked, validation: blocked.length ? "BLOCKED" as const : "VALID" as const });
}

export function reconstructCalibrationBinary(input: Readonly<{ original: EngineeringBinary; plan: RawMutationPlan; validate: (candidate: Readonly<{ bytes: Uint8Array; containerType: ContainerType }>) => boolean }>) {
  if (input.plan.validation !== "VALID") throw new Error("A blocked Raw Mutation Plan cannot reconstruct a binary.");
  const original = input.original.bytes, bytes = Buffer.from(original), authorized = new Set<number>();
  for (const mutation of input.plan.mutations) mutation.targetBytes.forEach((byte, index) => { const offset = mutation.binaryOffset + index; authorized.add(offset); bytes[offset] = byte; });
  const changedOffsets: number[] = []; for (let index = 0; index < bytes.length; index++) if (bytes[index] !== original[index]) changedOffsets.push(index);
  const unexplained = changedOffsets.filter((offset) => !authorized.has(offset)); if (unexplained.length) throw new Error("Reconstruction changed bytes outside the authorized mutation plan.");
  const ranges: { start: number; endExclusive: number }[] = []; for (const offset of changedOffsets) { const last = ranges.at(-1); if (last?.endExclusive === offset) last.endExclusive++; else ranges.push({ start: offset, endExclusive: offset + 1 }); }
  if (!input.validate({ bytes, containerType: input.original.source.containerType })) throw new Error("Post-reconstruction membership or container validation failed.");
  const digest = createHash("sha256").update(bytes).digest("hex"), material = { planRevision: input.plan.planRevision, originalDigest: input.plan.exactCurrentBinaryDigest, reconstructedDigest: digest, changedRanges: ranges };
  return freeze({ contractVersion: CALIBRATION_RECONSTRUCTION_CONTRACT, reconstructionId: `calibration-reconstruction:${hash("tunesight.calibration-reconstruction-identity.v1", material)}`, reconstructionRevision: `calibration-reconstruction-revision:${hash("tunesight.calibration-reconstruction-revision.v1", material)}`, bytes: Buffer.from(bytes), totalBinaryBytes: bytes.length, changedByteCount: changedOffsets.length, unchangedByteCount: bytes.length - changedOffsets.length, changedByteRanges: ranges, unexplainedChangedBytes: 0, appliedMutationCount: input.plan.mutations.length, blockedMutationCount: 0, validation: "RECONSTRUCT_QUALIFIED" as const });
}

export function decideExportCapability(reconstructionQualified: boolean, integrity: IntegrityCapability): ExportCapability {
  if (!reconstructionQualified) return freeze({ reconstruct: "RECONSTRUCT_BLOCKED", export: "EXPORT_BLOCKED_RECONSTRUCTION", flash: "FLASH_NOT_QUALIFIED", findings: ["Reconstruction validation has not passed."] });
  if (integrity.state === "CHECKSUM_UNKNOWN") return freeze({ reconstruct: "RECONSTRUCT_QUALIFIED", export: "EXPORT_BLOCKED_CHECKSUM_UNKNOWN", flash: "FLASH_NOT_QUALIFIED", findings: integrity.findings });
  if (integrity.state === "CHECKSUM_UNSUPPORTED") return freeze({ reconstruct: "RECONSTRUCT_QUALIFIED", export: "EXPORT_BLOCKED_CHECKSUM_UNSUPPORTED", flash: "FLASH_NOT_QUALIFIED", findings: integrity.findings });
  return freeze({ reconstruct: "RECONSTRUCT_QUALIFIED", export: "EXPORT_QUALIFIED", flash: "FLASH_NOT_QUALIFIED", findings: integrity.findings });
}

import { createHash } from "node:crypto";
import type { EngineeringBinary } from "../tunes/binaryContainer.ts";
import type { XdfAxisDefinition, XdfDefinitionRevision } from "./canonicalXdfDefinition.ts";

export const CALIBRATION_VALUE_EXTRACTOR_CONTRACT = "tunesight.calibration-value-extraction.v1" as const;

export type ExtractionCapability = Readonly<{
  state: "extraction_capable" | "unsupported" | "unresolved";
  reasons: readonly string[];
}>;

export type RawValueShape =
  | Readonly<{ kind: "scalar"; rows: 1; columns: 1; values: readonly [number] }>
  | Readonly<{ kind: "array_1d"; rows: 1; columns: number; values: readonly number[] }>
  | Readonly<{ kind: "table_2d"; rows: number; columns: number; values: readonly number[] }>;

export type RawAxisEvidence = Readonly<{
  axisId: string;
  outcome: "extracted" | "static_literal" | "unavailable" | "unsupported";
  representation: XdfAxisDefinition["representation"];
  shape: RawValueShape | null;
  literalValues: readonly string[];
  offsets: readonly number[];
  finding: string | null;
}>;

export type CalibrationValueExtractionEvidence = Readonly<{
  contractVersion: typeof CALIBRATION_VALUE_EXTRACTOR_CONTRACT;
  outcome: "extracted" | "unsupported" | "unresolved" | "invalid";
  binaryIdentity: Readonly<{ digest: string; byteLength: number; containerType: string; fileName: string }>;
  definitionRevisionId: string;
  definitionStructuralDigest: string;
  definitionSourceBindingDigest: string;
  resolvedAddress: Readonly<{ declaredAddress: number; baseOffset: number; subtractBaseOffset: boolean; binaryOffset: number; regionName: string | null }> | null;
  datatype: "integer" | null;
  widthBits: 8 | 16 | 32 | null;
  signed: boolean | null;
  endianness: "little" | "big" | null;
  shape: RawValueShape | null;
  offsets: readonly number[];
  axes: readonly RawAxisEvidence[];
  findings: readonly string[];
}>;

export type CalibrationValueExtractionBatchContext = Readonly<{
  engineeringBinary: EngineeringBinary;
  binaryIdentity: CalibrationValueExtractionEvidence["binaryIdentity"];
}>;

const issuedBatchContexts = new WeakSet<object>();

type ResolvedCalibrationAddress = NonNullable<CalibrationValueExtractionEvidence["resolvedAddress"]>;

function binaryIdentity(binary: EngineeringBinary) {
  const bytes = binary.bytes;
  return Object.freeze({
    digest: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
    byteLength: binary.byteLength,
    containerType: binary.source.containerType,
    fileName: binary.source.fileName,
  });
}

export function createCalibrationValueExtractionBatchContext(binary: EngineeringBinary): CalibrationValueExtractionBatchContext {
  const context = Object.freeze({ engineeringBinary: binary, binaryIdentity: binaryIdentity(binary) });
  issuedBatchContexts.add(context);
  return context;
}

function checkedProduct(left: number, right: number, label: string): number {
  if (!Number.isSafeInteger(left) || !Number.isSafeInteger(right) || left <= 0 || right <= 0) throw new Error(`${label} must contain positive safe integers.`);
  const result = left * right;
  if (!Number.isSafeInteger(result)) throw new Error(`${label} overflows safe integer arithmetic.`);
  return result;
}

function checkedSum(left: number, right: number, label: string): number {
  if (!Number.isSafeInteger(left) || !Number.isSafeInteger(right)) throw new Error(`${label} must contain safe integers.`);
  const result = left + right;
  if (!Number.isSafeInteger(result)) throw new Error(`${label} overflows safe integer arithmetic.`);
  return result;
}

function layout(definition: XdfDefinitionRevision, axis: XdfAxisDefinition): { widthBits: 8 | 16 | 32; widthBytes: number; signed: boolean; endianness: "little" | "big"; rows: number; columns: number; rowStride: number; columnStride: number } | string {
  const width = axis.embeddedData.elementSizeBits ?? definition.defaultDataLayout.elementSizeBits;
  if (width !== 8 && width !== 16 && width !== 32) return "Only 8-bit, 16-bit and 32-bit integer widths are supported.";
  if (axis.dataTypeMetadata.kind === "unresolved") return "XDF datatype is unresolved.";
  if (axis.dataTypeMetadata.kind === "unsupported" || axis.dataType !== "0") return `XDF datatype ${axis.dataTypeMetadata.sourceValue ?? axis.dataType ?? "unknown"} is unsupported.`;
  if (definition.defaultDataLayout.signed === null) return "Signedness is unresolved.";
  if (definition.byteOrderMetadata.lsbFirst === null) return "Byte order is unresolved.";
  const rows = axis.embeddedData.rowCount ?? 1;
  const columns = axis.embeddedData.columnCount ?? axis.indexCount ?? 1;
  try { checkedProduct(rows, columns, "Value dimensions"); } catch (error) { return error instanceof Error ? error.message : "Value dimensions are invalid."; }
  const widthBytes = width / 8;
  const majorBits = axis.embeddedData.majorStrideBits ?? 0;
  const minorBits = axis.embeddedData.minorStrideBits ?? 0;
  if (majorBits < 0 || minorBits < 0 || majorBits % 8 !== 0 || minorBits % 8 !== 0) return "Negative or non-byte-aligned strides are unsupported.";
  const packedRowStride = checkedProduct(columns, widthBytes, "Packed row stride");
  return { widthBits: width, widthBytes, signed: definition.defaultDataLayout.signed, endianness: definition.byteOrderMetadata.lsbFirst ? "little" : "big", rows, columns, rowStride: majorBits === 0 ? packedRowStride : majorBits / 8, columnStride: minorBits === 0 ? widthBytes : minorBits / 8 };
}

function resolveAddress(definition: XdfDefinitionRevision, declaredAddress: number): ResolvedCalibrationAddress | string {
  const baseOffset = definition.addressSpace.baseOffset ?? 0;
  const subtract = definition.addressSpace.subtractBaseOffset ?? false;
  const binaryOffset = subtract ? declaredAddress - baseOffset : declaredAddress + baseOffset;
  if (!Number.isSafeInteger(binaryOffset) || binaryOffset < 0) return "Address translation produced a negative or unsafe binary offset.";
  let region: XdfDefinitionRevision["addressSpace"]["regions"][number] | null = null;
  for (const candidate of definition.addressSpace.regions) {
    if (!Number.isSafeInteger(candidate.startAddress) || candidate.startAddress < 0 || !Number.isSafeInteger(candidate.size) || candidate.size <= 0) return "Address region has invalid bounds.";
    let regionEnd: number;
    try { regionEnd = checkedSum(candidate.startAddress, candidate.size, "Address region end"); } catch (error) { return error instanceof Error ? error.message : "Address region end is invalid."; }
    if (declaredAddress >= candidate.startAddress && declaredAddress < regionEnd) { region = candidate; break; }
  }
  if (definition.addressSpace.regions.length > 0 && region === null) return "The declared address is outside every supported XDF region.";
  return Object.freeze({ declaredAddress, baseOffset, subtractBaseOffset: subtract, binaryOffset, regionName: region?.name ?? null });
}

function readInteger(bytes: Buffer, offset: number, widthBits: 8 | 16 | 32, signed: boolean, endianness: "little" | "big"): number {
  if (widthBits === 8) return signed ? bytes.readInt8(offset) : bytes.readUInt8(offset);
  if (widthBits === 16) return signed ? (endianness === "little" ? bytes.readInt16LE(offset) : bytes.readInt16BE(offset)) : (endianness === "little" ? bytes.readUInt16LE(offset) : bytes.readUInt16BE(offset));
  return signed ? (endianness === "little" ? bytes.readInt32LE(offset) : bytes.readInt32BE(offset)) : (endianness === "little" ? bytes.readUInt32LE(offset) : bytes.readUInt32BE(offset));
}

function extractAxis(bytes: Buffer, definition: XdfDefinitionRevision, axis: XdfAxisDefinition): { shape: RawValueShape; offsets: number[]; address: ResolvedCalibrationAddress; widthBits: 8 | 16 | 32; signed: boolean; endianness: "little" | "big" } | string {
  const declaredAddress = axis.embeddedData.address;
  if (declaredAddress === null) return "Axis has no directly embedded address.";
  const address = resolveAddress(definition, declaredAddress); if (typeof address === "string") return address;
  const resolvedLayout = layout(definition, axis); if (typeof resolvedLayout === "string") return resolvedLayout;
  const count = checkedProduct(resolvedLayout.rows, resolvedLayout.columns, "Cell count");
  const values: number[] = []; const offsets: number[] = [];
  try {
    for (let index = 0; index < count; index += 1) {
      const row = Math.floor(index / resolvedLayout.columns); const column = index % resolvedLayout.columns;
      const rowOffset = checkedProduct(row + 1, resolvedLayout.rowStride, "Row offset") - resolvedLayout.rowStride;
      const columnOffset = checkedProduct(column + 1, resolvedLayout.columnStride, "Column offset") - resolvedLayout.columnStride;
      const offset = checkedSum(checkedSum(address.binaryOffset, rowOffset, "Cell offset"), columnOffset, "Cell offset");
      const readEnd = checkedSum(offset, resolvedLayout.widthBytes, "Read boundary");
      if (offset < 0 || readEnd > bytes.length) return "Definition read exceeds the Engineering Binary boundary.";
      offsets.push(offset); values.push(readInteger(bytes, offset, resolvedLayout.widthBits, resolvedLayout.signed, resolvedLayout.endianness));
    }
  } catch (error) { return error instanceof Error ? error.message : "Definition offset arithmetic is invalid."; }
  const frozenValues = Object.freeze(values);
  const shape: RawValueShape = resolvedLayout.rows === 1 && resolvedLayout.columns === 1
    ? Object.freeze({ kind: "scalar", rows: 1, columns: 1, values: frozenValues as readonly [number] })
    : resolvedLayout.rows === 1
      ? Object.freeze({ kind: "array_1d", rows: 1, columns: resolvedLayout.columns, values: frozenValues })
      : Object.freeze({ kind: "table_2d", rows: resolvedLayout.rows, columns: resolvedLayout.columns, values: frozenValues });
  return { shape, offsets, address, widthBits: resolvedLayout.widthBits, signed: resolvedLayout.signed, endianness: resolvedLayout.endianness };
}

export function assessDefinitionExtractionCapability(definition: XdfDefinitionRevision): ExtractionCapability {
  const reasons: string[] = [];
  if (definition.identity.status !== "derived") reasons.push(`Definition identity is ${definition.identity.status}.`);
  const valueAxis = definition.axes.find((axis) => axis.axisId.toLowerCase() === "z") ?? definition.axes.at(-1);
  if (!valueAxis) reasons.push("Definition has no value axis.");
  else {
    if (valueAxis.embeddedData.address === null) reasons.push("Value axis has no embedded address.");
    const resolvedLayout = layout(definition, valueAxis); if (typeof resolvedLayout === "string") reasons.push(resolvedLayout);
  }
  return Object.freeze({ state: reasons.length === 0 ? "extraction_capable" : reasons.some((reason) => reason.includes("unresolved") || reason.includes("no embedded")) ? "unresolved" : "unsupported", reasons: Object.freeze(reasons) });
}

export function extractRawCalibrationValues(binary: EngineeringBinary, definition: XdfDefinitionRevision, batchContext?: CalibrationValueExtractionBatchContext): CalibrationValueExtractionEvidence {
  const identity = batchContext && issuedBatchContexts.has(batchContext) && batchContext.engineeringBinary === binary
    ? batchContext.binaryIdentity
    : binaryIdentity(binary);
  const capability = assessDefinitionExtractionCapability(definition);
  const base = { contractVersion: CALIBRATION_VALUE_EXTRACTOR_CONTRACT, binaryIdentity: identity, definitionRevisionId: definition.revisionId, definitionStructuralDigest: definition.structuralDigest, definitionSourceBindingDigest: definition.sourceBindingDigest } as const;
  if (capability.state !== "extraction_capable") return Object.freeze({ ...base, outcome: capability.state, resolvedAddress: null, datatype: null, widthBits: null, signed: null, endianness: null, shape: null, offsets: Object.freeze([]), axes: Object.freeze([]), findings: capability.reasons });
  const valueAxis = definition.axes.find((axis) => axis.axisId.toLowerCase() === "z") ?? definition.axes.at(-1)!;
  const extracted = extractAxis(binary.bytes, definition, valueAxis);
  if (typeof extracted === "string") return Object.freeze({ ...base, outcome: "invalid", resolvedAddress: null, datatype: null, widthBits: null, signed: null, endianness: null, shape: null, offsets: Object.freeze([]), axes: Object.freeze([]), findings: Object.freeze([extracted]) });
  const axes = definition.axes.filter((axis) => axis !== valueAxis).map((axis) => {
    if (axis.representation === "static_literal") return Object.freeze({ axisId: axis.axisId, outcome: "static_literal" as const, representation: axis.representation, shape: null, literalValues: Object.freeze(axis.literalLabels.map((label) => label.value)), offsets: Object.freeze([]), finding: null });
    const result = extractAxis(binary.bytes, definition, axis);
    return typeof result === "string" ? Object.freeze({ axisId: axis.axisId, outcome: result.includes("no directly") ? "unavailable" as const : "unsupported" as const, representation: axis.representation, shape: null, literalValues: Object.freeze([]), offsets: Object.freeze([]), finding: result }) : Object.freeze({ axisId: axis.axisId, outcome: "extracted" as const, representation: axis.representation, shape: result.shape, literalValues: Object.freeze([]), offsets: Object.freeze(result.offsets), finding: null });
  });
  return Object.freeze({ ...base, outcome: "extracted", resolvedAddress: extracted.address, datatype: "integer", widthBits: extracted.widthBits, signed: extracted.signed, endianness: extracted.endianness, shape: extracted.shape, offsets: Object.freeze(extracted.offsets), axes: Object.freeze(axes), findings: Object.freeze([]) });
}

import assert from "node:assert/strict";
import test from "node:test";
import { resolveBinaryContainer, type EngineeringBinary } from "../tunes/binaryContainer.ts";
import { defineXdfDefinitionRevision, deriveDefinitionIdentity, type XdfAxisDefinition, type XdfDefinitionRevision } from "./canonicalXdfDefinition.ts";
import { assessDefinitionExtractionCapability, createCalibrationValueExtractionBatchContext, extractRawCalibrationValues } from "./calibrationValueExtraction.ts";

function binary(values: readonly number[]): EngineeringBinary {
  const result = resolveBinaryContainer({ bytes: Uint8Array.from(values), fileName: "fixture.bin", mimeType: "application/octet-stream" });
  assert.equal(result.status, "resolved");
  return result.engineeringBinary;
}

function revision(input: { address?: number; width?: number; signed?: boolean | null; lsbFirst?: boolean | null; rows?: number; columns?: number; majorStrideBits?: number; minorStrideBits?: number; dataType?: string | null; baseOffset?: number; subtract?: boolean; axisAddress?: number | null; axisLiteralValues?: readonly string[]; title?: string }): XdfDefinitionRevision {
  const address = input.address ?? 0;
  const axis = (axisId: string, embeddedAddress: number | null, rowCount: number, columnCount: number): XdfAxisDefinition => ({
    axisId, indexCount: columnCount, dataType: input.dataType === undefined ? "0" : input.dataType,
    dataTypeMetadata: input.dataType === null ? { kind: "unresolved", resolution: "unresolved", sourceValue: null } : input.dataType !== undefined && input.dataType !== "0" ? { kind: "unsupported", resolution: "explicit", sourceValue: input.dataType } : { kind: "integer", resolution: "explicit", sourceValue: "0" },
    representation: axisId === "x" && input.axisLiteralValues ? "static_literal" : embeddedAddress === null ? "unresolved" : "address_backed", literalLabels: axisId === "x" ? (input.axisLiteralValues ?? []).map((value, index) => ({ index: String(index), value })) : [], units: axisId === "z" ? "not-converted" : "axis-unit",
    embeddedData: { address: embeddedAddress, addressSource: embeddedAddress === null ? null : `0x${embeddedAddress.toString(16)}`, elementSizeBits: input.width ?? 8, rowCount, columnCount, majorStrideBits: input.majorStrideBits ?? 0, minorStrideBits: input.minorStrideBits ?? 0, typeFlags: null },
    equationSource: "X", equationVariables: ["X"],
  });
  const axes = [axis("x", input.axisAddress ?? null, 1, input.columns ?? 1), axis("z", address, input.rows ?? 1, input.columns ?? 1)];
  const identity = deriveDefinitionIdentity({ definitionKind: "table", primaryAddress: address, storageLayout: axes.map((value) => ({ axisId: value.axisId, embeddedData: value.embeddedData, dataTypeKind: value.dataTypeMetadata.kind })) });
  return defineXdfDefinitionRevision({ identity, sourceArtifactDigest: "sha256:xdf-source", definitionKind: "table", title: input.title ?? "Fixture", description: null, primaryAddress: address, addressSpace: { baseOffset: input.baseOffset ?? 0, subtractBaseOffset: input.subtract ?? false, regions: [] }, defaultDataLayout: { elementSizeBits: input.width ?? 8, signed: input.signed === undefined ? false : input.signed, floatingPoint: false, outputType: "1" }, byteOrderMetadata: { lsbFirst: input.lsbFirst === undefined ? true : input.lsbFirst, source: input.lsbFirst === false ? "0" : "1" }, axes, qualificationState: "applicability_unresolved" });
}

test("binds extraction Evidence to exact binary and exact Definition Revision", () => {
  const definition = revision({ address: 0, width: 8 });
  const first = extractRawCalibrationValues(binary([1]), definition);
  const changed = extractRawCalibrationValues(binary([2]), definition);
  assert.equal(first.outcome, "extracted");
  assert.equal(first.definitionRevisionId, definition.revisionId);
  assert.equal(first.definitionStructuralDigest, definition.structuralDigest);
  assert.notEqual(first.binaryIdentity.digest, changed.binaryIdentity.digest);
  assert.notDeepEqual(first.shape, changed.shape);
});

test("a verified batch context preserves exact extraction Evidence across definitions", () => {
  const source = binary([1, 2, 3, 4]);
  const context = createCalibrationValueExtractionBatchContext(source);
  for (const definition of [revision({ address: 0 }), revision({ address: 1, columns: 2 })]) {
    assert.deepEqual(extractRawCalibrationValues(source, definition, context), extractRawCalibrationValues(source, definition));
  }
  const other = binary([9, 8, 7, 6]);
  assert.equal(extractRawCalibrationValues(other, revision({ address: 0 }), context).binaryIdentity.digest, extractRawCalibrationValues(other, revision({ address: 0 })).binaryIdentity.digest);
});

test("reads unsigned and signed 8-bit scalar values", () => {
  assert.deepEqual(extractRawCalibrationValues(binary([0xff]), revision({ signed: false })).shape?.values, [255]);
  assert.deepEqual(extractRawCalibrationValues(binary([0xff]), revision({ signed: true })).shape?.values, [-1]);
});

test("reads 16-bit and 32-bit values in both endian orders", () => {
  assert.deepEqual(extractRawCalibrationValues(binary([0x12, 0x34]), revision({ width: 16, lsbFirst: false })).shape?.values, [0x1234]);
  assert.deepEqual(extractRawCalibrationValues(binary([0x34, 0x12]), revision({ width: 16, lsbFirst: true })).shape?.values, [0x1234]);
  assert.deepEqual(extractRawCalibrationValues(binary([0x01, 0x02, 0x03, 0x04]), revision({ width: 32, lsbFirst: false })).shape?.values, [0x01020304]);
  assert.deepEqual(extractRawCalibrationValues(binary([0x04, 0x03, 0x02, 0x01]), revision({ width: 32, lsbFirst: true })).shape?.values, [0x01020304]);
});

test("preserves deterministic scalar, 1D and 2D shapes", () => {
  assert.equal(extractRawCalibrationValues(binary([1]), revision({})).shape?.kind, "scalar");
  assert.deepEqual(extractRawCalibrationValues(binary([1, 2, 3]), revision({ columns: 3 })).shape, { kind: "array_1d", rows: 1, columns: 3, values: [1, 2, 3] });
  assert.deepEqual(extractRawCalibrationValues(binary([1, 2, 3, 4]), revision({ rows: 2, columns: 2 })).shape, { kind: "table_2d", rows: 2, columns: 2, values: [1, 2, 3, 4] });
});

test("applies explicit row and column strides deterministically", () => {
  const result = extractRawCalibrationValues(binary([1, 0, 2, 0, 0, 0, 3, 0, 4]), revision({ rows: 2, columns: 2, majorStrideBits: 48, minorStrideBits: 16 }));
  assert.deepEqual(result.shape?.values, [1, 2, 3, 4]);
  assert.deepEqual(result.offsets, [0, 2, 6, 8]);
});

test("translates additive and subtractive base offsets", () => {
  const additive = extractRawCalibrationValues(binary([0, 7]), revision({ address: 0, baseOffset: 1 }));
  const subtractive = extractRawCalibrationValues(binary([9]), revision({ address: 1, baseOffset: 1, subtract: true }));
  assert.equal(additive.resolvedAddress?.binaryOffset, 1);
  assert.deepEqual(additive.shape?.values, [7]);
  assert.equal(subtractive.resolvedAddress?.binaryOffset, 0);
  assert.deepEqual(subtractive.shape?.values, [9]);
});

test("extracts directly embedded raw axis values separately", () => {
  const result = extractRawCalibrationValues(binary([10, 20, 30, 40]), revision({ address: 2, columns: 2, axisAddress: 0 }));
  assert.deepEqual(result.shape?.values, [30, 40]);
  assert.equal(result.axes[0].outcome, "extracted");
  assert.deepEqual(result.axes[0].shape?.values, [10, 20]);
});

test("preserves unavailable externally represented axes", () => {
  const result = extractRawCalibrationValues(binary([1]), revision({ axisAddress: null }));
  assert.equal(result.axes[0].outcome, "unavailable");
  assert.match(result.axes[0].finding ?? "", /no directly embedded address/);
});

test("preserves static literal axes separately from binary raw values", () => {
  const result = extractRawCalibrationValues(binary([1, 2]), revision({ columns: 2, axisLiteralValues: ["1000", "2000"] }));
  assert.equal(result.axes[0].outcome, "static_literal");
  assert.deepEqual(result.axes[0].literalValues, ["1000", "2000"]);
  assert.deepEqual(result.shape?.values, [1, 2]);
});

test("allows an exact boundary read and rejects out-of-bounds, negative, unsafe and overflowed layouts", () => {
  assert.equal(extractRawCalibrationValues(binary([0, 1]), revision({ address: 1 })).outcome, "extracted");
  assert.equal(extractRawCalibrationValues(binary([0]), revision({ address: 1 })).outcome, "invalid");
  assert.equal(extractRawCalibrationValues(binary([0]), revision({ address: 0, baseOffset: 1, subtract: true })).outcome, "invalid");
  assert.equal(extractRawCalibrationValues(binary([0]), revision({ address: Number.MAX_SAFE_INTEGER, baseOffset: 1 })).outcome, "invalid");
  assert.equal(assessDefinitionExtractionCapability(revision({ rows: Number.MAX_SAFE_INTEGER, columns: 2 })).state, "unsupported");
  assert.equal(extractRawCalibrationValues(binary([0]), revision({ rows: 2, majorStrideBits: Number.MAX_SAFE_INTEGER - 7 })).outcome, "invalid");
});

test("rejects unsupported datatype, width, signedness, endian and stride layouts", () => {
  assert.equal(assessDefinitionExtractionCapability(revision({ dataType: "9" })).state, "unsupported");
  assert.equal(assessDefinitionExtractionCapability(revision({ dataType: null })).state, "unresolved");
  assert.equal(assessDefinitionExtractionCapability(revision({ width: 24 })).state, "unsupported");
  assert.equal(assessDefinitionExtractionCapability(revision({ signed: null })).state, "unresolved");
  assert.equal(assessDefinitionExtractionCapability(revision({ lsbFirst: null })).state, "unresolved");
  assert.equal(assessDefinitionExtractionCapability(revision({ majorStrideBits: -8 })).state, "unsupported");
});

test("is deterministic, immutable, and unaffected by display metadata", () => {
  const source = binary([1, 2]);
  const first = extractRawCalibrationValues(source, revision({ columns: 2, title: "First title" }));
  const repeated = extractRawCalibrationValues(source, revision({ columns: 2, title: "Renamed" }));
  assert.deepEqual(first, repeated);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.shape));
  assert.ok(Object.isFrozen(first.shape?.values));
});

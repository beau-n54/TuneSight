import assert from "node:assert/strict";
import test from "node:test";
import {
  defineXdfDefinitionRevision,
  defineXdfSourceArtifact,
  deriveDefinitionIdentity,
  type XdfAxisDefinition,
} from "./canonicalXdfDefinition.ts";

const axis = (address = 0x1234): XdfAxisDefinition => ({
  axisId: "z",
  indexCount: 4,
  dataType: "0",
  dataTypeMetadata: { kind: "integer", resolution: "explicit", sourceValue: "0" },
  representation: "address_backed",
  literalLabels: [],
  units: "hPa",
  embeddedData: {
    address,
    addressSource: `0x${address.toString(16)}`,
    elementSizeBits: 16,
    rowCount: 1,
    columnCount: 4,
    majorStrideBits: 0,
    minorStrideBits: 0,
    typeFlags: "0x02",
  },
  equationSource: "X*2",
  equationVariables: ["X"],
});

test("XDF source identity is byte-derived and filename-independent", () => {
  const bytes = new TextEncoder().encode("<XDFFORMAT version=\"1.60\" />");
  const first = defineXdfSourceArtifact({ bytes, filename: "first.xdf", provenance: "repository fixture" });
  const second = defineXdfSourceArtifact({ bytes, filename: "renamed.xdf", provenance: "repository fixture" });
  assert.equal(first.sourceDigest, second.sourceDigest);
  assert.equal(first.artifactId, second.artifactId);
  assert.notEqual(first.filename, second.filename);
});

test("stable Definition identity excludes display metadata and source ordering", () => {
  const layout = [{ axisId: "x", address: 1 }, { axisId: "y", address: 2 }, { axisId: "z", address: 3 }];
  const first = deriveDefinitionIdentity({ definitionKind: "table", primaryAddress: 0x1234, storageLayout: layout });
  const reordered = deriveDefinitionIdentity({ definitionKind: "table", primaryAddress: 0x1234, storageLayout: layout });
  assert.equal(first.stableId, reordered.stableId);
  assert.equal(first.status, "derived");
});

test("Definition revision digest is canonical and material-structure-sensitive", () => {
  const identity = deriveDefinitionIdentity({ definitionKind: "table", primaryAddress: 0x1234, storageLayout: [{ axisId: "z", address: 0x1234 }] });
  const create = (title: string, valueAxis: XdfAxisDefinition) => defineXdfDefinitionRevision({
    identity,
    sourceArtifactDigest: "sha256:source",
    definitionKind: "table",
    title,
    description: null,
    primaryAddress: valueAxis.embeddedData.address,
    addressSpace: { baseOffset: 0, subtractBaseOffset: false, regions: [] },
    defaultDataLayout: { elementSizeBits: 16, signed: false, floatingPoint: false, outputType: "1" },
    byteOrderMetadata: { lsbFirst: false, source: "0" },
    axes: [valueAxis],
    qualificationState: "applicability_unresolved",
  });
  const first = create("Mutable display name", axis());
  const renamed = create("Changed display name", axis());
  const changed = create("Mutable display name", axis(0x1235));
  assert.equal(first.revisionId, renamed.revisionId);
  assert.equal(first.structuralDigest, renamed.structuralDigest);
  assert.notEqual(first.structuralDigest, changed.structuralDigest);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.axes));
});

test("missing and conflicting structural identity remain explicit", () => {
  assert.equal(deriveDefinitionIdentity({ definitionKind: "table", primaryAddress: null, storageLayout: [] }).status, "unresolved");
  assert.equal(deriveDefinitionIdentity({ definitionKind: "table", primaryAddress: 1, storageLayout: [], conflict: true }).status, "conflicting");
});

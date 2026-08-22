import { createHash } from "node:crypto";

export type XdfQualificationState =
  | "source_discovered"
  | "structurally_interpreted"
  | "applicability_unresolved"
  | "unsupported"
  | "invalid";

export type XdfSourceArtifact = Readonly<{
  artifactId: string;
  sourceDigest: string;
  byteLength: number;
  format: "xdf-xml";
  observedVersion: string | null;
  filename: string | null;
  provenance: string;
  sourceRevision: string | null;
  qualificationState: XdfQualificationState;
}>;

export type XdfEmbeddedData = Readonly<{
  address: number | null;
  addressSource: string | null;
  elementSizeBits: number | null;
  rowCount: number | null;
  columnCount: number | null;
  majorStrideBits: number | null;
  minorStrideBits: number | null;
  typeFlags: string | null;
}>;

export type XdfAxisDefinition = Readonly<{
  axisId: string;
  indexCount: number | null;
  dataType: string | null;
  units: string | null;
  embeddedData: XdfEmbeddedData;
  equationSource: string | null;
  equationVariables: readonly string[];
}>;

export type XdfDefinitionIdentity = Readonly<{
  status: "derived" | "unresolved" | "conflicting";
  stableId: string | null;
  derivationBasis: "kind-primary-address-axis-roles" | null;
  unresolvedReason: string | null;
}>;

export type XdfDefinitionRevision = Readonly<{
  identity: XdfDefinitionIdentity;
  revisionId: string;
  structuralDigest: string;
  sourceArtifactDigest: string;
  sourceBindingDigest: string;
  definitionKind: "table";
  title: string | null;
  description: string | null;
  primaryAddress: number | null;
  byteOrderMetadata: Readonly<{ lsbFirst: boolean | null; source: string | null }>;
  axes: readonly XdfAxisDefinition[];
  qualificationState: "structurally_interpreted" | "applicability_unresolved";
}>;

function canonicalize(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) {
      throw new Error("Canonical XDF number must be finite and safe.");
    }
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (typeof value !== "object" || value === undefined) {
    throw new Error("Canonical XDF value has an unsupported type.");
  }
  const object = value as Readonly<Record<string, unknown>>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(object[key])}`).join(",")}}`;
}

function digest(domain: string, value: unknown): string {
  const hash = createHash("sha256");
  hash.update(domain, "utf8");
  hash.update(Buffer.from([0]));
  hash.update(canonicalize(value), "utf8");
  return `sha256:${hash.digest("hex")}`;
}

export function defineXdfSourceArtifact(input: {
  bytes: Uint8Array;
  observedVersion?: string | null;
  filename?: string | null;
  provenance: string;
  sourceRevision?: string | null;
}): XdfSourceArtifact {
  if (!input.provenance.trim()) throw new Error("XDF source provenance is required.");
  const sourceDigest = digest("tunesight.xdf.source-artifact.v1", Array.from(input.bytes));
  return Object.freeze({
    artifactId: `xdf-source:${sourceDigest.slice("sha256:".length)}`,
    sourceDigest,
    byteLength: input.bytes.byteLength,
    format: "xdf-xml",
    observedVersion: input.observedVersion ?? null,
    filename: input.filename ?? null,
    provenance: input.provenance,
    sourceRevision: input.sourceRevision ?? null,
    qualificationState: "source_discovered",
  });
}

export function deriveDefinitionIdentity(input: {
  definitionKind: "table";
  primaryAddress: number | null;
  axisRoles: readonly string[];
  conflict?: boolean;
}): XdfDefinitionIdentity {
  if (input.primaryAddress === null) {
    return Object.freeze({ status: "unresolved", stableId: null, derivationBasis: null, unresolvedReason: "A primary embedded-data address is unavailable." });
  }
  if (input.conflict) {
    return Object.freeze({ status: "conflicting", stableId: null, derivationBasis: null, unresolvedReason: "Multiple definitions share the same derived structural identity." });
  }
  const qualifiedDigest = digest("tunesight.xdf.definition-identity.v1", {
    definitionKind: input.definitionKind,
    primaryAddress: input.primaryAddress,
    axisRoles: [...input.axisRoles].sort(),
  });
  return Object.freeze({
    status: "derived",
    stableId: `xdf-definition:${qualifiedDigest.slice("sha256:".length)}`,
    derivationBasis: "kind-primary-address-axis-roles",
    unresolvedReason: null,
  });
}

export function defineXdfDefinitionRevision(input: Omit<XdfDefinitionRevision, "revisionId" | "structuralDigest" | "sourceBindingDigest">): XdfDefinitionRevision {
  const structuralPayload = {
    definitionKind: input.definitionKind,
    primaryAddress: input.primaryAddress,
    byteOrderMetadata: input.byteOrderMetadata,
    axes: input.axes,
  };
  const structuralDigest = digest("tunesight.xdf.definition-structure.v1", structuralPayload);
  const sourceBindingDigest = digest("tunesight.xdf.definition-source-binding.v1", {
    structuralDigest,
    sourceArtifactDigest: input.sourceArtifactDigest,
  });
  return Object.freeze({
    ...input,
    axes: Object.freeze(input.axes.map((axis) => Object.freeze({ ...axis, embeddedData: Object.freeze({ ...axis.embeddedData }), equationVariables: Object.freeze([...axis.equationVariables]) }))),
    structuralDigest,
    sourceBindingDigest,
    revisionId: `xdf-definition-revision:${structuralDigest.slice("sha256:".length)}`,
  });
}

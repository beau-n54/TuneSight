import { createHash, randomBytes } from "node:crypto";
import { defineDefinitionSetRevision } from "../xdf/definitionRomApplicability.ts";
import { interpretXdfStructure, XDF_STRUCTURAL_LIMITS } from "../xdf/interpretXdfStructure.ts";

export const ACQUIRED_XDF_PARSER_VERSION = "tunesight.bounded-xdf-structural-interpreter.v1";
export const ACQUIRED_XDF_MAX_CONTRIBUTION_BYTES = XDF_STRUCTURAL_LIMITS.maximumInputBytes;
export type AcquiredXdfLifecycle = "CONTRIBUTED_UNTRUSTED" | "STRUCTURALLY_PARSED" | "VALIDATED_CANDIDATE" | "SOURCE_AUTHORITY_REVIEW" | "APPLICABILITY_REVIEW" | "QUALIFIED_ADMITTED" | "ACTIVE" | "DUPLICATE_CONTENT" | "INVALID" | "UNSUPPORTED" | "DEFINITION_CONFLICT" | "QUARANTINED" | "REJECTED" | "SUPERSEDED";
export type AcquiredXdfValidation = Readonly<{ extraction: "pending" | "passed" | "failed"; conversion: "pending" | "passed" | "failed"; addressBounds: "pending" | "passed" | "failed"; conflicts: number; quarantines: number; dependencies: "pending" | "passed" | "failed" }>;
export type AcquiredXdfSourceRecord = Readonly<{ sourceRecordId: string; sourceArtifactId: string | null; sourceDigest: string; byteLength: number; parserVersion: typeof ACQUIRED_XDF_PARSER_VERSION; storageObjectId: string; provenanceClass: "subscriber_contribution"; lifecycle: AcquiredXdfLifecycle; definitionSetId: string | null; definitionSetRevision: string | null; definitionCount: number; parserOutcome: "structurally_interpreted" | "invalid" | "unsupported"; safeFindingCodes: readonly string[]; validation: AcquiredXdfValidation; sourceAuthorityState: "unresolved" | "candidate" | "qualified"; applicabilityState: "unpublished" | "candidate" | "published"; admissionState: "not_admitted" | "qualified_admitted" | "active" | "rejected" | "superseded" }>;
export type AcquiredXdfContributionReceipt = Readonly<{ receiptId: string; sourceRecordId: string; ownerId: string; contributedAt: string; state: "accepted" | "duplicate_content" }>;

export interface AcquiredXdfPrivateObjectStore { putPrivate(objectKey: string, bytes: Uint8Array): Promise<void> }
export interface AcquiredXdfMetadataStore {
  findSourceByDigest(digest: string): Promise<AcquiredXdfSourceRecord | null>;
  insertSource(record: AcquiredXdfSourceRecord): Promise<void>;
  insertReceipt(receipt: AcquiredXdfContributionReceipt): Promise<void>;
}

const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const opaque = () => randomBytes(24).toString("base64url");
const pendingValidation: AcquiredXdfValidation = Object.freeze({ extraction: "pending", conversion: "pending", addressBounds: "pending", conflicts: 0, quarantines: 0, dependencies: "pending" });
const forwardLifecycle: Readonly<Partial<Record<AcquiredXdfLifecycle, readonly AcquiredXdfLifecycle[]>>> = {
  CONTRIBUTED_UNTRUSTED: ["STRUCTURALLY_PARSED", "INVALID", "UNSUPPORTED", "DUPLICATE_CONTENT"],
  STRUCTURALLY_PARSED: ["VALIDATED_CANDIDATE", "DEFINITION_CONFLICT", "QUARANTINED", "REJECTED"],
  VALIDATED_CANDIDATE: ["SOURCE_AUTHORITY_REVIEW", "DEFINITION_CONFLICT", "QUARANTINED", "REJECTED"],
  SOURCE_AUTHORITY_REVIEW: ["APPLICABILITY_REVIEW", "QUARANTINED", "REJECTED"],
  APPLICABILITY_REVIEW: ["QUALIFIED_ADMITTED", "QUARANTINED", "REJECTED"],
  QUALIFIED_ADMITTED: ["ACTIVE", "REJECTED"],
  ACTIVE: ["SUPERSEDED"],
};

export function transitionAcquiredXdfLifecycle(current: AcquiredXdfLifecycle, next: AcquiredXdfLifecycle): AcquiredXdfLifecycle {
  if (!forwardLifecycle[current]?.includes(next)) throw new Error("ACQUIRED_XDF_LIFECYCLE_TRANSITION_REJECTED");
  return next;
}

export async function persistAcquiredXdfContribution(input: Readonly<{ bytes: Uint8Array; ownerId: string; contributedAt: string; objectStore: AcquiredXdfPrivateObjectStore; metadataStore: AcquiredXdfMetadataStore; opaqueId?: () => string }>): Promise<Readonly<{ source: AcquiredXdfSourceRecord; receipt: AcquiredXdfContributionReceipt; duplicate: boolean }>> {
  if (!input.ownerId.trim()) throw new Error("ACQUIRED_XDF_OWNER_REQUIRED");
  if (!input.bytes.byteLength || input.bytes.byteLength > ACQUIRED_XDF_MAX_CONTRIBUTION_BYTES) throw new Error("ACQUIRED_XDF_SIZE_INVALID");
  const sourceDigest = digest(input.bytes), existing = await input.metadataStore.findSourceByDigest(sourceDigest), makeId = input.opaqueId ?? opaque;
  if (existing) {
    const receipt = Object.freeze({ receiptId: `acquired-xdf-receipt:${makeId()}`, sourceRecordId: existing.sourceRecordId, ownerId: input.ownerId, contributedAt: input.contributedAt, state: "duplicate_content" as const });
    await input.metadataStore.insertReceipt(receipt);
    return Object.freeze({ source: existing, receipt, duplicate: true });
  }
  let xml: string;
  try { xml = new TextDecoder("utf-8", { fatal: true }).decode(input.bytes); } catch { xml = ""; }
  const interpretation = xml ? interpretXdfStructure({ xml, filename: null, provenance: "Private acquired XDF contribution" }) : Object.freeze({ outcome: "invalid" as const, sourceArtifact: null, definitions: Object.freeze([]), findings: Object.freeze([{ code: "invalid_utf8", path: "$", message: "XDF must be valid UTF-8." }]) });
  const definitionSet = interpretation.outcome === "structurally_interpreted" && interpretation.sourceArtifact ? defineDefinitionSetRevision({ sourceArtifact: interpretation.sourceArtifact, definitions: interpretation.definitions }) : null;
  const storageObjectId = makeId(), sourceRecordId = `acquired-xdf-source:${sourceDigest}`;
  await input.objectStore.putPrivate(`acquired-xdf/raw/${storageObjectId}`, input.bytes);
  const lifecycle: AcquiredXdfLifecycle = interpretation.outcome === "structurally_interpreted" ? "STRUCTURALLY_PARSED" : interpretation.outcome === "unsupported" ? "UNSUPPORTED" : "INVALID";
  const source = Object.freeze({ sourceRecordId, sourceArtifactId: interpretation.sourceArtifact?.artifactId ?? null, sourceDigest, byteLength: input.bytes.byteLength, parserVersion: ACQUIRED_XDF_PARSER_VERSION, storageObjectId, provenanceClass: "subscriber_contribution" as const, lifecycle, definitionSetId: definitionSet?.definitionSetId ?? null, definitionSetRevision: definitionSet?.revisionId ?? null, definitionCount: interpretation.definitions.length, parserOutcome: interpretation.outcome, safeFindingCodes: Object.freeze(interpretation.findings.map((item) => item.code)), validation: pendingValidation, sourceAuthorityState: "unresolved" as const, applicabilityState: "unpublished" as const, admissionState: "not_admitted" as const });
  const receipt = Object.freeze({ receiptId: `acquired-xdf-receipt:${makeId()}`, sourceRecordId, ownerId: input.ownerId, contributedAt: input.contributedAt, state: "accepted" as const });
  await input.metadataStore.insertSource(source); await input.metadataStore.insertReceipt(receipt);
  return Object.freeze({ source, receipt, duplicate: false });
}

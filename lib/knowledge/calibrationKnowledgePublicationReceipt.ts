import type { AdmissionStableIdentity } from "./calibrationKnowledgeAdmission.ts";
import type { AuthorisedCalibrationKnowledgeAdmissionDecision } from "./calibrationKnowledgeAuthorisedAdmissionDecision.ts";
import type { DeterministicCalibrationKnowledgePublicationInstruction } from "./calibrationKnowledgeDeterministicPublicationInstruction.ts";
import {
  derivePublicationExecutionResult,
  type PublicationAtomicCommitCertainty,
  type PublicationExecutionIdempotencyReference,
  type PublicationExecutionResult,
  type PublicationExecutionResultReference,
  type PublicationExecutionState,
  type PublicationReasonCode,
  type PublicationReplayStatus,
  type PublicationRetryClassification,
  type PublicationValidationFinding,
} from "./calibrationKnowledgePublicationExecutionResult.ts";
import {
  definePublicationSourceIdentity,
  deriveRegistryRecordSet,
  deriveRegistrySnapshotEnvelope,
  type PublicationSourceIdentity,
  type RegistrySnapshotIdentity,
  type RegistrySnapshotReference,
} from "./calibrationKnowledgePublicationSourceRegistrySnapshot.ts";
import {
  canonicalizeDigestDomainPayload,
  deriveDomainSeparatedDigest,
  type CanonicalDomainPayload,
  type DomainSeparatedDigest,
} from "./calibrationKnowledgeCanonicalSerialization.ts";

export type PublicationReceiptLifecycleState = "published" | "recorded";
export type PublicationReceiptConstructionKind = "initial" | "correction" | "recovery";
export type PublicationReceiptFindingCategory = "binding" | "digest" | "snapshot" | "outcome" | "replay" | "recovery" | "uncertainty";
export type PublicationReceiptFindingSeverity = "information" | "warning" | "error" | "critical";

export type PublicationReceiptFinding = Readonly<{
  findingId: string;
  code: string;
  category: PublicationReceiptFindingCategory;
  severity: PublicationReceiptFindingSeverity;
  affectedReference: string;
  message: string;
  blocking: boolean;
  resolutionRequirement: string | null;
}>;

export type PublicationReceiptRevisionReference = Readonly<{
  receiptId: string;
  receiptRevision: string;
  receiptDigest: string;
  instructionIdentity: AdmissionStableIdentity;
  executionResultReference: PublicationExecutionResultReference;
}>;

export type PriorSuccessfulPublicationReceiptProof = Readonly<{
  receiptReference: PublicationReceiptRevisionReference;
  executionState: "published";
  reasonCode: "publication_completed";
  atomicCommitCertainty: "complete";
  idempotencyReference: PublicationExecutionIdempotencyReference;
  resultingKnowledgeId: string;
  resultingKnowledgeVersion: string;
  resultingCanonicalKnowledgeDigest: string;
  resultingSnapshotIdentity: RegistrySnapshotReference;
  resultingRecordSetDigest: string;
}>;

export type EvidentiaryPublicationReceipt = Readonly<{
  receiptId: string;
  receiptRevision: string;
  receiptContractVersion: string;
  receiptDigest: string;
  constructionKind: PublicationReceiptConstructionKind;
  lifecycleState: PublicationReceiptLifecycleState;
  supersededReceipt: PublicationReceiptRevisionReference | null;
  correctionRationale: string | null;
  instructionIdentity: AdmissionStableIdentity;
  idempotencyReference: PublicationExecutionIdempotencyReference;
  authorisedDecisionIdentity: AdmissionStableIdentity;
  executionResultReference: PublicationExecutionResultReference;
  executionAttemptIdentity: PublicationExecutionResult["executionAttemptIdentity"];
  publicationSourceIdentity: PublicationExecutionResult["publicationSourceIdentity"];
  predecessorSnapshotIdentity: RegistrySnapshotReference;
  resultingSnapshotIdentity: RegistrySnapshotReference | null;
  resultingRecordSetDigest: string | null;
  resultingKnowledgeId: string | null;
  resultingKnowledgeVersion: string | null;
  resultingCanonicalKnowledgeDigest: string | null;
  observedPredecessorKnowledgeId: string | null;
  observedPredecessorKnowledgeVersion: string | null;
  executionState: PublicationExecutionState;
  reasonCode: PublicationReasonCode;
  retryClassification: PublicationRetryClassification;
  replayStatus: PublicationReplayStatus;
  atomicCommitCertainty: PublicationAtomicCommitCertainty;
  executionValidationFindings: readonly PublicationValidationFinding[];
  receiptValidationFindings: readonly PublicationReceiptFinding[];
  failureReason: string | null;
  reconciliationRequirement: string | null;
  unresolvedExecutionEvidenceReferences: readonly string[];
  priorSuccessfulReceipt: PriorSuccessfulPublicationReceiptProof | null;
  executionTimestamp: string;
  receiptTimestamp: string;
}>;

export type EvidentiaryPublicationReceiptInput = Omit<EvidentiaryPublicationReceipt,
  "receiptDigest" | "instructionIdentity" | "idempotencyReference" | "authorisedDecisionIdentity" |
  "executionResultReference" | "executionAttemptIdentity" | "publicationSourceIdentity" |
  "predecessorSnapshotIdentity" | "resultingSnapshotIdentity" | "resultingRecordSetDigest" |
  "resultingKnowledgeId" | "resultingKnowledgeVersion" | "observedPredecessorKnowledgeId" |
  "observedPredecessorKnowledgeVersion" | "executionState" | "reasonCode" | "retryClassification" |
  "replayStatus" | "atomicCommitCertainty" | "executionValidationFindings" | "executionTimestamp"
> & Readonly<{
  receiptDigest: string;
  instruction: DeterministicCalibrationKnowledgePublicationInstruction;
  authorisedDecision: AuthorisedCalibrationKnowledgeAdmissionDecision;
  executionResult: PublicationExecutionResult;
  publicationSource: PublicationSourceIdentity;
  resultingSnapshot: RegistrySnapshotIdentity | null;
}>;

export type PublicationReceiptDigestDerivation = Readonly<{ payload: CanonicalDomainPayload; digest: DomainSeparatedDigest }>;

const lifecycleStates = new Set<PublicationReceiptLifecycleState>(["published", "recorded"]);
const constructionKinds = new Set<PublicationReceiptConstructionKind>(["initial", "correction", "recovery"]);
const findingCategories = new Set<PublicationReceiptFindingCategory>(["binding", "digest", "snapshot", "outcome", "replay", "recovery", "uncertainty"]);
const findingSeverities = new Set<PublicationReceiptFindingSeverity>(["information", "warning", "error", "critical"]);

function requireNonBlank(value: string, field: string): void { if (!value.trim()) throw new Error(`${field} is required.`); }
function requireVersion(value: string, field: string): void { requireNonBlank(value, field); if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) throw new Error(`${field} is invalid.`); }
function requireDigest(value: string, field: string): void { if (!/^sha256:[a-f0-9]{64}$/.test(value)) throw new Error(`${field} must be a qualified lowercase SHA-256 digest.`); }
function requireTimestamp(value: string, field: string): void { const parsed = new Date(value); if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString() !== value) throw new Error(`${field} must be canonical UTC RFC 3339.`); }
function compareText(left: string, right: string): number { return left < right ? -1 : left > right ? 1 : 0; }
function sameIdentity(left: AdmissionStableIdentity, right: AdmissionStableIdentity): boolean { return left.id === right.id && left.revision === right.revision && left.contentDigest === right.contentDigest; }
function deepFreeze<T>(value: T): T { if (Array.isArray(value)) return Object.freeze(value.map(deepFreeze)) as T; if (value !== null && typeof value === "object") { const clone: Record<PropertyKey, unknown> = {}; for (const key of Reflect.ownKeys(value)) clone[key] = deepFreeze((value as Record<PropertyKey, unknown>)[key]); return Object.freeze(clone) as T; } return value; }
function requireUnique(values: readonly string[], field: string): void { const seen = new Set<string>(); for (const value of values) { requireNonBlank(value, field); if (seen.has(value)) throw new Error(`${field} contains duplicate identity ${value}.`); seen.add(value); } }

function resultReference(value: PublicationExecutionResult): PublicationExecutionResultReference { return deepFreeze({ resultId: value.resultId, resultRevision: value.resultRevision, resultDigest: value.resultDigest }); }
function snapshotReference(value: RegistrySnapshotIdentity): RegistrySnapshotReference { return deepFreeze({ snapshotId: value.snapshotId, snapshotRevision: value.snapshotRevision, snapshotEnvelopeDigest: value.snapshotEnvelopeDigest }); }

function validateIdentity(value: AdmissionStableIdentity, field: string): void { requireNonBlank(value.id, `${field} identity`); requireVersion(value.revision, `${field} revision`); requireDigest(value.contentDigest, `${field} digest`); }
function validateResultReference(value: PublicationExecutionResultReference, field: string): void { requireNonBlank(value.resultId, `${field} identity`); requireVersion(value.resultRevision, `${field} revision`); requireDigest(value.resultDigest, `${field} digest`); }
function validateSnapshotReference(value: RegistrySnapshotReference, field: string): void { requireNonBlank(value.snapshotId, `${field} identity`); requireVersion(value.snapshotRevision, `${field} revision`); requireDigest(value.snapshotEnvelopeDigest, `${field} digest`); }

function validateInstruction(value: DeterministicCalibrationKnowledgePublicationInstruction): void {
  validateIdentity(value.instructionIdentity, "Publication instruction");
  if (value.instructionIdentity.contentDigest !== value.instructionContentDigest || !sameIdentity(value.instruction.instructionIdentity, value.instructionIdentity)) throw new Error("Publication Instruction digest or embedded identity is inconsistent.");
}

function validateExecutionResult(value: PublicationExecutionResult): void {
  requireNonBlank(value.resultId, "Publication execution-result identity");
  requireVersion(value.resultRevision, "Publication execution-result revision");
  requireDigest(value.resultDigest, "Publication execution-result digest");
  const { resultDigest, ...material } = value;
  if (derivePublicationExecutionResult(material).digest.qualifiedDigest !== resultDigest) throw new Error("Publication execution-result digest is inconsistent.");
}

function validateSource(value: PublicationSourceIdentity): PublicationSourceIdentity { return definePublicationSourceIdentity(value); }

function validateSnapshot(value: RegistrySnapshotIdentity): RegistrySnapshotIdentity {
  const recordSet = deriveRegistryRecordSet(value.recordManifest.records);
  if (recordSet.digest.qualifiedDigest !== value.recordSetDigest || value.recordCount !== recordSet.manifest.records.length) throw new Error("Registry Snapshot record-set identity is inconsistent.");
  const envelope = deriveRegistrySnapshotEnvelope({ snapshotId: value.snapshotId, snapshotRevision: value.snapshotRevision, registryContractId: value.registryContractId, registryContractVersion: value.registryContractVersion, recordSetDigest: value.recordSetDigest, recordCount: value.recordCount, predecessorSnapshot: value.predecessorSnapshot, sourceReceiptReferences: value.sourceReceiptReferences, constructedAt: value.constructedAt, lifecycle: value.lifecycle });
  if (envelope.digest.qualifiedDigest !== value.snapshotEnvelopeDigest) throw new Error("Registry Snapshot envelope digest is inconsistent.");
  return value;
}

function canonicalReceiptFindings(values: readonly PublicationReceiptFinding[]): readonly PublicationReceiptFinding[] {
  const canonical = values.map((value) => {
    requireNonBlank(value.findingId, "Receipt finding identity");
    requireNonBlank(value.code, "Receipt finding code");
    if (!findingCategories.has(value.category)) throw new Error("Receipt finding category is invalid.");
    if (!findingSeverities.has(value.severity)) throw new Error("Receipt finding severity is invalid.");
    requireNonBlank(value.affectedReference, "Receipt finding affected reference");
    requireNonBlank(value.message, "Receipt finding message");
    if (value.blocking && !value.resolutionRequirement?.trim()) throw new Error("Blocking receipt finding requires a resolution requirement.");
    return { ...value };
  }).sort((left, right) => compareText(left.findingId, right.findingId));
  requireUnique(canonical.map((value) => value.findingId), "Receipt finding identity");
  return canonical;
}

function canonicalStrings(values: readonly string[], field: string): readonly string[] { requireUnique(values, field); return [...values].sort(compareText); }

function validateReceiptRevision(input: EvidentiaryPublicationReceiptInput): void {
  if (!constructionKinds.has(input.constructionKind)) throw new Error("Publication receipt construction kind is invalid.");
  if (!lifecycleStates.has(input.lifecycleState)) throw new Error("Publication receipt lifecycle state is invalid.");
  if (input.constructionKind === "initial") {
    if (input.receiptRevision !== "1" || input.supersededReceipt !== null || input.correctionRationale !== null) throw new Error("Initial receipt cannot contain revision or correction lineage.");
    return;
  }
  if (input.receiptRevision === "1" || input.supersededReceipt === null) throw new Error("Corrected or recovered receipt requires a prior receipt revision reference.");
  requireNonBlank(input.correctionRationale ?? "", "Receipt correction rationale");
  const prior = input.supersededReceipt;
  requireNonBlank(prior.receiptId, "Prior receipt identity");
  requireVersion(prior.receiptRevision, "Prior receipt revision");
  requireDigest(prior.receiptDigest, "Prior receipt digest");
  validateIdentity(prior.instructionIdentity, "Prior receipt instruction");
  validateResultReference(prior.executionResultReference, "Prior receipt execution result");
  if (prior.receiptId !== input.receiptId || prior.receiptRevision === input.receiptRevision) throw new Error("Receipt revision must preserve stable identity and identify a distinct prior revision.");
  if (!sameIdentity(prior.instructionIdentity, input.instruction.instructionIdentity) || prior.executionResultReference.resultId !== input.executionResult.resultId || prior.executionResultReference.resultRevision !== input.executionResult.resultRevision || prior.executionResultReference.resultDigest !== input.executionResult.resultDigest) throw new Error("Receipt correction or recovery cannot alter underlying execution history.");
}

function validateBindings(input: EvidentiaryPublicationReceiptInput, source: PublicationSourceIdentity): void {
  const instruction = input.instruction;
  const result = input.executionResult;
  if (!sameIdentity(result.instructionIdentity, instruction.instructionIdentity)) throw new Error("Receipt execution result does not bind the exact Publication Instruction.");
  if (!sameIdentity(input.authorisedDecision.decision.decisionIdentity, instruction.instruction.acceptedDecisionIdentity)) throw new Error("Receipt does not bind the exact authorised Admission Decision.");
  if (input.authorisedDecision.decision.publicationInstructionId !== instruction.instructionIdentity.id) throw new Error("Authorised Admission Decision does not identify the Publication Instruction.");
  if (result.idempotencyReference.instructionId !== instruction.instructionIdentity.id || result.idempotencyReference.instructionRevision !== instruction.instructionIdentity.revision || result.idempotencyReference.instructionDigest !== instruction.instructionIdentity.contentDigest) throw new Error("Receipt idempotency reference does not bind the instruction.");
  if (result.publicationSourceIdentity.sourceId !== source.sourceId || result.publicationSourceIdentity.sourceRevision !== source.sourceRevision || result.publicationSourceIdentity.sourceEnvelopeDigest !== source.sourceEnvelopeDigest) throw new Error("Receipt does not bind the exact Publication Source Identity.");
}

function proveSnapshot(input: EvidentiaryPublicationReceiptInput, snapshot: RegistrySnapshotIdentity): void {
  const result = input.executionResult;
  if (result.resultingSnapshotIdentity === null || result.resultingSnapshotIdentity.snapshotId !== snapshot.snapshotId || result.resultingSnapshotIdentity.snapshotRevision !== snapshot.snapshotRevision || result.resultingSnapshotIdentity.snapshotEnvelopeDigest !== snapshot.snapshotEnvelopeDigest) throw new Error("Resulting Registry Snapshot identity does not match the Execution Result.");
  if (snapshot.predecessorSnapshot === null || snapshot.predecessorSnapshot.snapshotId !== result.predecessorSnapshotIdentity.snapshotId || snapshot.predecessorSnapshot.snapshotRevision !== result.predecessorSnapshotIdentity.snapshotRevision || snapshot.predecessorSnapshot.snapshotEnvelopeDigest !== result.predecessorSnapshotIdentity.snapshotEnvelopeDigest) throw new Error("Resulting Registry Snapshot predecessor does not match the execution evidence.");
  const matching = snapshot.recordManifest.records.filter((record) => record.stableKnowledgeId === input.instruction.targetStableKnowledgeId && record.knowledgeVersion === input.instruction.targetKnowledgeVersion);
  if (matching.length !== 1) throw new Error("Resulting Registry Snapshot must contain exactly one published Knowledge record.");
  if (matching[0].canonicalContentDigest !== input.resultingCanonicalKnowledgeDigest) throw new Error("Resulting Registry Snapshot Knowledge digest does not match the receipt.");
}

function validatePublished(input: EvidentiaryPublicationReceiptInput, snapshot: RegistrySnapshotIdentity | null): void {
  const result = input.executionResult;
  if (snapshot === null) throw new Error("Published receipt requires the exact resulting Registry Snapshot.");
  if (result.resultingKnowledgeId !== input.instruction.targetStableKnowledgeId || result.resultingKnowledgeVersion !== input.instruction.targetKnowledgeVersion) throw new Error("Published receipt Knowledge identity or version does not match the instruction target.");
  if (result.observedPredecessorKnowledgeId !== input.instruction.expectedPredecessorStableKnowledgeId || result.observedPredecessorKnowledgeVersion !== input.instruction.expectedPredecessorKnowledgeVersion) throw new Error("Published receipt predecessor does not match the instruction.");
  requireDigest(input.resultingCanonicalKnowledgeDigest ?? "", "Published canonical Knowledge digest");
  if (input.resultingCanonicalKnowledgeDigest !== input.instruction.expectedResultingCanonicalDigest || input.resultingCanonicalKnowledgeDigest !== input.instruction.acceptedKnowledgeDigest) throw new Error("Published canonical Knowledge digest does not match the deterministic instruction.");
  if (result.atomicCommitCertainty !== "complete" || result.reasonCode !== "publication_completed" || input.failureReason !== null || input.lifecycleState !== "published") throw new Error("Published receipt requires complete atomic publication evidence and published lifecycle.");
  proveSnapshot(input, snapshot);
}

function validatePriorSuccessfulProof(value: PriorSuccessfulPublicationReceiptProof): void {
  requireNonBlank(value.receiptReference.receiptId, "Prior successful receipt identity");
  requireVersion(value.receiptReference.receiptRevision, "Prior successful receipt revision");
  requireDigest(value.receiptReference.receiptDigest, "Prior successful receipt digest");
  validateIdentity(value.receiptReference.instructionIdentity, "Prior successful receipt instruction");
  validateResultReference(value.receiptReference.executionResultReference, "Prior successful execution result");
  requireNonBlank(value.resultingKnowledgeId, "Prior successful Knowledge identity");
  requireVersion(value.resultingKnowledgeVersion, "Prior successful Knowledge version");
  requireDigest(value.resultingCanonicalKnowledgeDigest, "Prior successful Knowledge digest");
  validateSnapshotReference(value.resultingSnapshotIdentity, "Prior successful snapshot");
  requireDigest(value.resultingRecordSetDigest, "Prior successful record-set digest");
  if (value.executionState !== "published" || value.reasonCode !== "publication_completed" || value.atomicCommitCertainty !== "complete") throw new Error("Prior successful receipt proof must preserve completed publication evidence.");
}

function validateReplay(input: EvidentiaryPublicationReceiptInput, snapshot: RegistrySnapshotIdentity | null): void {
  const prior = input.priorSuccessfulReceipt;
  if (prior === null || snapshot === null) throw new Error("Idempotent replay receipt requires prior successful receipt and snapshot proof.");
  validatePriorSuccessfulProof(prior);
  if (!sameIdentity(prior.receiptReference.instructionIdentity, input.instruction.instructionIdentity)) throw new Error("Replay receipt instruction differs from the prior successful receipt.");
  if (canonicalizeDigestDomainPayload(prior.idempotencyReference).canonicalJson !== canonicalizeDigestDomainPayload(input.executionResult.idempotencyReference).canonicalJson) throw new Error("Replay receipt idempotency reference differs from the prior successful receipt.");
  if (prior.resultingKnowledgeId !== input.executionResult.resultingKnowledgeId || prior.resultingKnowledgeVersion !== input.executionResult.resultingKnowledgeVersion || prior.resultingCanonicalKnowledgeDigest !== input.resultingCanonicalKnowledgeDigest) throw new Error("Replay receipt cannot claim a new or different Knowledge result.");
  if (prior.resultingSnapshotIdentity.snapshotId !== snapshot.snapshotId || prior.resultingSnapshotIdentity.snapshotRevision !== snapshot.snapshotRevision || prior.resultingSnapshotIdentity.snapshotEnvelopeDigest !== snapshot.snapshotEnvelopeDigest || prior.resultingRecordSetDigest !== snapshot.recordSetDigest) throw new Error("Replay receipt must preserve the already-proven successful snapshot.");
  if (input.executionResult.replayStatus === "original" || input.executionResult.state !== "idempotent_replay") throw new Error("Replay receipt requires explicit idempotent replay state.");
  proveSnapshot(input, snapshot);
}

function validateNonPublished(input: EvidentiaryPublicationReceiptInput): void {
  const result = input.executionResult;
  if (input.resultingCanonicalKnowledgeDigest !== null || input.resultingSnapshot !== null || result.resultingKnowledgeId !== null || result.resultingKnowledgeVersion !== null || result.resultingSnapshotIdentity !== null) throw new Error("Non-published receipt cannot fabricate resulting Knowledge or Registry Snapshot identity.");
  if (input.lifecycleState !== "recorded") throw new Error("Non-published receipt requires recorded lifecycle.");
  if (result.state === "blocked") {
    requireNonBlank(input.failureReason ?? "", "Blocked publication reason");
    if (result.atomicCommitCertainty !== "incomplete" || ![...result.validationFindings, ...input.receiptValidationFindings].some((finding) => finding.blocking)) throw new Error("Blocked receipt requires proven atomic non-publication and a blocking finding.");
  } else if (result.state === "failed") {
    requireNonBlank(input.failureReason ?? "", "Publication failure reason");
    if (result.atomicCommitCertainty !== "incomplete" || result.retryClassification === "not_required") throw new Error("Failed receipt requires proven non-publication and retry classification.");
  } else if (result.state === "indeterminate") {
    requireNonBlank(input.reconciliationRequirement ?? "", "Indeterminate reconciliation requirement");
    if (result.atomicCommitCertainty !== "indeterminate" || result.retryClassification !== "manual_review_required" || input.failureReason !== null || input.unresolvedExecutionEvidenceReferences.length === 0) throw new Error("Indeterminate receipt must preserve uncertainty, prohibit blind retry, and require reconciliation evidence.");
  }
}

function receiptMaterial(input: Omit<EvidentiaryPublicationReceipt, "receiptDigest">): Readonly<Record<string, unknown>> { return { ...input }; }

export function derivePublicationReceiptDigest(input: Omit<EvidentiaryPublicationReceipt, "receiptDigest">): PublicationReceiptDigestDerivation {
  const canonical = deepFreeze({ ...input, receiptValidationFindings: canonicalReceiptFindings(input.receiptValidationFindings), unresolvedExecutionEvidenceReferences: canonicalStrings(input.unresolvedExecutionEvidenceReferences, "Unresolved execution Evidence reference") });
  const payload = canonicalizeDigestDomainPayload(receiptMaterial(canonical));
  const digest = deriveDomainSeparatedDigest(payload.canonicalBytes, "publication_receipt");
  return deepFreeze({ payload, digest });
}

export function constructEvidentiaryPublicationReceipt(input: EvidentiaryPublicationReceiptInput): EvidentiaryPublicationReceipt {
  requireNonBlank(input.receiptId, "Publication receipt stable identity");
  requireVersion(input.receiptRevision, "Publication receipt revision");
  requireVersion(input.receiptContractVersion, "Publication receipt contract version");
  requireDigest(input.receiptDigest, "Publication receipt digest");
  requireTimestamp(input.receiptTimestamp, "Publication receipt timestamp");
  validateInstruction(input.instruction);
  validateExecutionResult(input.executionResult);
  const source = validateSource(input.publicationSource);
  const snapshot = input.resultingSnapshot === null ? null : validateSnapshot(input.resultingSnapshot);
  validateBindings(input, source);
  validateReceiptRevision(input);
  const receiptFindings = canonicalReceiptFindings(input.receiptValidationFindings);
  const unresolvedEvidence = canonicalStrings(input.unresolvedExecutionEvidenceReferences, "Unresolved execution Evidence reference");
  if (input.executionResult.state === "published") validatePublished(input, snapshot);
  else if (input.executionResult.state === "idempotent_replay") validateReplay(input, snapshot);
  else validateNonPublished(input);
  if (input.executionResult.state !== "idempotent_replay" && input.priorSuccessfulReceipt !== null) throw new Error("Only idempotent replay may bind a prior successful receipt proof.");
  if (input.executionResult.state !== "indeterminate" && (input.reconciliationRequirement !== null || unresolvedEvidence.length > 0)) throw new Error("Only indeterminate receipt may preserve unresolved reconciliation evidence.");
  const material = deepFreeze({ receiptId: input.receiptId, receiptRevision: input.receiptRevision, receiptContractVersion: input.receiptContractVersion, constructionKind: input.constructionKind, lifecycleState: input.lifecycleState, supersededReceipt: input.supersededReceipt, correctionRationale: input.correctionRationale, instructionIdentity: input.instruction.instructionIdentity, idempotencyReference: input.executionResult.idempotencyReference, authorisedDecisionIdentity: input.authorisedDecision.decision.decisionIdentity, executionResultReference: resultReference(input.executionResult), executionAttemptIdentity: input.executionResult.executionAttemptIdentity, publicationSourceIdentity: input.executionResult.publicationSourceIdentity, predecessorSnapshotIdentity: input.executionResult.predecessorSnapshotIdentity, resultingSnapshotIdentity: snapshot === null ? null : snapshotReference(snapshot), resultingRecordSetDigest: snapshot?.recordSetDigest ?? null, resultingKnowledgeId: input.executionResult.resultingKnowledgeId, resultingKnowledgeVersion: input.executionResult.resultingKnowledgeVersion, resultingCanonicalKnowledgeDigest: input.resultingCanonicalKnowledgeDigest, observedPredecessorKnowledgeId: input.executionResult.observedPredecessorKnowledgeId, observedPredecessorKnowledgeVersion: input.executionResult.observedPredecessorKnowledgeVersion, executionState: input.executionResult.state, reasonCode: input.executionResult.reasonCode, retryClassification: input.executionResult.retryClassification, replayStatus: input.executionResult.replayStatus, atomicCommitCertainty: input.executionResult.atomicCommitCertainty, executionValidationFindings: input.executionResult.validationFindings, receiptValidationFindings: receiptFindings, failureReason: input.failureReason, reconciliationRequirement: input.reconciliationRequirement, unresolvedExecutionEvidenceReferences: unresolvedEvidence, priorSuccessfulReceipt: input.priorSuccessfulReceipt, executionTimestamp: input.executionResult.executedAt, receiptTimestamp: input.receiptTimestamp });
  const derived = derivePublicationReceiptDigest(material);
  if (derived.digest.qualifiedDigest !== input.receiptDigest) throw new Error("Publication receipt digest does not match its canonical evidentiary envelope.");
  return deepFreeze({ ...material, receiptDigest: input.receiptDigest });
}

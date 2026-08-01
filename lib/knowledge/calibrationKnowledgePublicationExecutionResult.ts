import type { AdmissionStableIdentity, PublicationOperation } from "./calibrationKnowledgeAdmission.ts";
import type { DeterministicCalibrationKnowledgePublicationInstruction } from "./calibrationKnowledgeDeterministicPublicationInstruction.ts";
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

export type PublicationExecutionState = "published" | "blocked" | "failed" | "indeterminate" | "idempotent_replay";
export type PublicationReasonCode =
  | "publication_completed"
  | "instruction_mismatch"
  | "source_ineligible"
  | "operation_unsupported"
  | "predecessor_mismatch"
  | "validation_failed"
  | "execution_failed"
  | "atomicity_indeterminate"
  | "duplicate_execution"
  | "prior_result_replayed";
export type PublicationRetryClassification = "not_required" | "not_retryable" | "retry_same_instruction" | "retry_corrected_instruction" | "manual_review_required";
export type PublicationReplayStatus = "original" | "duplicate_detected" | "replayed";
export type PublicationAtomicCommitCertainty = "complete" | "incomplete" | "indeterminate";
export type PublicationValidationFindingSeverity = "information" | "warning" | "error" | "critical";

export type PublicationValidationFinding = Readonly<{
  findingId: string;
  code: string;
  severity: PublicationValidationFindingSeverity;
  message: string;
  blocking: boolean;
  instructionPaths: readonly string[];
  sourcePaths: readonly string[];
  snapshotPaths: readonly string[];
}>;

export type PublicationExecutionResultReference = Readonly<{
  resultId: string;
  resultRevision: string;
  resultDigest: string;
}>;

export type ExecutionAttemptIdentity = Readonly<{
  attemptId: string;
  attemptRevision: string;
  retrySequence: number;
  previousAttemptId: string | null;
  previousAttemptRevision: string | null;
}>;

export type PublicationExecutionIdempotencyReference = Readonly<{
  idempotencyId: string;
  instructionId: string;
  instructionRevision: string;
  instructionDigest: string;
  sourceId: string;
  sourceRevision: string;
  sourceEnvelopeDigest: string;
  predecessorSnapshotId: string;
  predecessorSnapshotRevision: string;
  predecessorSnapshotDigest: string;
}>;

export type PublicationExecutionRequest = Readonly<{
  requestId: string;
  requestRevision: string;
  instruction: DeterministicCalibrationKnowledgePublicationInstruction;
  publicationSource: PublicationSourceIdentity;
  predecessorSnapshot: RegistrySnapshotIdentity;
  attemptIdentity: ExecutionAttemptIdentity;
  idempotencyReference: PublicationExecutionIdempotencyReference;
  requestedAt: string;
}>;

export type PublicationExecutionRequestInput = Readonly<{
  requestId: string;
  requestRevision: string;
  instruction: DeterministicCalibrationKnowledgePublicationInstruction;
  publicationSource: PublicationSourceIdentity;
  predecessorSnapshot: RegistrySnapshotIdentity;
  attemptId: string;
  attemptRevision: string;
  retrySequence: number;
  previousAttemptId: string | null;
  previousAttemptRevision: string | null;
  requestedAt: string;
}>;

export type PublicationExecutionResult = Readonly<{
  resultId: string;
  resultRevision: string;
  resultDigest: string;
  instructionIdentity: AdmissionStableIdentity;
  idempotencyReference: PublicationExecutionIdempotencyReference;
  executionAttemptIdentity: ExecutionAttemptIdentity;
  state: PublicationExecutionState;
  reasonCode: PublicationReasonCode;
  retryClassification: PublicationRetryClassification;
  resultingKnowledgeId: string | null;
  resultingKnowledgeVersion: string | null;
  observedPredecessorKnowledgeId: string | null;
  observedPredecessorKnowledgeVersion: string | null;
  publicationSourceIdentity: Readonly<{ sourceId: string; sourceRevision: string; sourceEnvelopeDigest: string }>;
  predecessorSnapshotIdentity: RegistrySnapshotReference;
  resultingSnapshotIdentity: RegistrySnapshotReference | null;
  validationFindings: readonly PublicationValidationFinding[];
  executedAt: string;
  replayStatus: PublicationReplayStatus;
  previousExecutionResult: PublicationExecutionResultReference | null;
  atomicCommitCertainty: PublicationAtomicCommitCertainty;
}>;

export type PublicationExecutionResultInput = Omit<PublicationExecutionResult, "resultDigest" | "instructionIdentity" | "idempotencyReference" | "executionAttemptIdentity" | "publicationSourceIdentity" | "predecessorSnapshotIdentity"> & Readonly<{
  resultDigest: string;
  request: PublicationExecutionRequest;
}>;

export type PublicationExecutionResultDerivation = Readonly<{
  payload: CanonicalDomainPayload;
  digest: DomainSeparatedDigest;
}>;

const states = new Set<PublicationExecutionState>(["published", "blocked", "failed", "indeterminate", "idempotent_replay"]);
const reasons = new Set<PublicationReasonCode>(["publication_completed", "instruction_mismatch", "source_ineligible", "operation_unsupported", "predecessor_mismatch", "validation_failed", "execution_failed", "atomicity_indeterminate", "duplicate_execution", "prior_result_replayed"]);
const retries = new Set<PublicationRetryClassification>(["not_required", "not_retryable", "retry_same_instruction", "retry_corrected_instruction", "manual_review_required"]);
const replayStates = new Set<PublicationReplayStatus>(["original", "duplicate_detected", "replayed"]);
const atomicStates = new Set<PublicationAtomicCommitCertainty>(["complete", "incomplete", "indeterminate"]);
const findingSeverities = new Set<PublicationValidationFindingSeverity>(["information", "warning", "error", "critical"]);

function requireNonBlank(value: string, field: string): void { if (!value.trim()) throw new Error(`${field} is required.`); }
function requireVersion(value: string, field: string): void { requireNonBlank(value, field); if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) throw new Error(`${field} is invalid.`); }
function requireDigest(value: string, field: string): void { if (!/^sha256:[a-f0-9]{64}$/.test(value)) throw new Error(`${field} must be a qualified lowercase SHA-256 digest.`); }
function requireTimestamp(value: string, field: string): void { const parsed = new Date(value); if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString() !== value) throw new Error(`${field} must be canonical UTC RFC 3339.`); }
function compareText(left: string, right: string): number { return left < right ? -1 : left > right ? 1 : 0; }
function deepFreeze<T>(value: T): T { if (Array.isArray(value)) return Object.freeze(value.map(deepFreeze)) as T; if (value !== null && typeof value === "object") { const clone: Record<PropertyKey, unknown> = {}; for (const key of Reflect.ownKeys(value)) clone[key] = deepFreeze((value as Record<PropertyKey, unknown>)[key]); return Object.freeze(clone) as T; } return value; }
function requireUnique(values: readonly string[], field: string): void { const seen = new Set<string>(); for (const value of values) { requireNonBlank(value, field); if (seen.has(value)) throw new Error(`${field} contains duplicate identity ${value}.`); seen.add(value); } }
function sameIdentity(left: AdmissionStableIdentity, right: AdmissionStableIdentity): boolean { return left.id === right.id && left.revision === right.revision && left.contentDigest === right.contentDigest; }

function validateInstruction(value: DeterministicCalibrationKnowledgePublicationInstruction): void {
  requireNonBlank(value.instructionIdentity.id, "Publication instruction identity");
  requireVersion(value.instructionIdentity.revision, "Publication instruction revision");
  requireDigest(value.instructionIdentity.contentDigest, "Publication instruction digest");
  if (value.instructionIdentity.contentDigest !== value.instructionContentDigest) throw new Error("Publication instruction identity does not match its content digest.");
  if (!sameIdentity(value.instruction.instructionIdentity, value.instructionIdentity)) throw new Error("Embedded Publication Instruction identity is inconsistent.");
}

function validateSnapshot(value: RegistrySnapshotIdentity): void {
  requireNonBlank(value.snapshotId, "Registry snapshot identity");
  requireVersion(value.snapshotRevision, "Registry snapshot revision");
  requireDigest(value.snapshotEnvelopeDigest, "Registry snapshot envelope digest");
  const recordSet = deriveRegistryRecordSet(value.recordManifest.records);
  if (recordSet.digest.qualifiedDigest !== value.recordSetDigest || value.recordCount !== recordSet.manifest.records.length) throw new Error("Registry snapshot record manifest is inconsistent.");
  const envelope = deriveRegistrySnapshotEnvelope({ snapshotId: value.snapshotId, snapshotRevision: value.snapshotRevision, registryContractId: value.registryContractId, registryContractVersion: value.registryContractVersion, recordSetDigest: value.recordSetDigest, recordCount: value.recordCount, predecessorSnapshot: value.predecessorSnapshot, sourceReceiptReferences: value.sourceReceiptReferences, constructedAt: value.constructedAt, lifecycle: value.lifecycle });
  if (envelope.digest.qualifiedDigest !== value.snapshotEnvelopeDigest) throw new Error("Registry snapshot envelope identity is inconsistent.");
}

function validateAttempt(value: ExecutionAttemptIdentity): void {
  requireNonBlank(value.attemptId, "Execution attempt identity");
  requireVersion(value.attemptRevision, "Execution attempt revision");
  if (!Number.isSafeInteger(value.retrySequence) || value.retrySequence < 0) throw new Error("Execution retry sequence is invalid.");
  if ((value.previousAttemptId === null) !== (value.previousAttemptRevision === null)) throw new Error("Previous execution attempt identity and revision must be supplied together.");
  if (value.retrySequence === 0 && value.previousAttemptId !== null) throw new Error("Initial execution attempt cannot reference a previous attempt.");
  if (value.retrySequence > 0 && value.previousAttemptId === null) throw new Error("Retried execution attempt requires previous-attempt linkage.");
  if (value.previousAttemptId !== null) requireNonBlank(value.previousAttemptId, "Previous execution attempt identity");
  if (value.previousAttemptRevision !== null) requireVersion(value.previousAttemptRevision, "Previous execution attempt revision");
}

export function derivePublicationExecutionIdempotencyId(instruction: DeterministicCalibrationKnowledgePublicationInstruction, source: PublicationSourceIdentity, snapshot: RegistrySnapshotIdentity): string {
  const identity = canonicalizeDigestDomainPayload({ instruction: { id: instruction.instructionIdentity.id, revision: instruction.instructionIdentity.revision, digest: instruction.instructionIdentity.contentDigest }, source: { id: source.sourceId, revision: source.sourceRevision, digest: source.sourceEnvelopeDigest }, predecessorSnapshot: { id: snapshot.snapshotId, revision: snapshot.snapshotRevision, digest: snapshot.snapshotEnvelopeDigest } });
  return `publication-idempotency:${identity.canonicalJson}`;
}

function createIdempotencyReference(instruction: DeterministicCalibrationKnowledgePublicationInstruction, source: PublicationSourceIdentity, snapshot: RegistrySnapshotIdentity): PublicationExecutionIdempotencyReference {
  return deepFreeze({ idempotencyId: derivePublicationExecutionIdempotencyId(instruction, source, snapshot), instructionId: instruction.instructionIdentity.id, instructionRevision: instruction.instructionIdentity.revision, instructionDigest: instruction.instructionIdentity.contentDigest, sourceId: source.sourceId, sourceRevision: source.sourceRevision, sourceEnvelopeDigest: source.sourceEnvelopeDigest, predecessorSnapshotId: snapshot.snapshotId, predecessorSnapshotRevision: snapshot.snapshotRevision, predecessorSnapshotDigest: snapshot.snapshotEnvelopeDigest });
}

export function deriveExecutionAttemptId(reference: PublicationExecutionIdempotencyReference, retrySequence: number): string {
  if (!Number.isSafeInteger(retrySequence) || retrySequence < 0) throw new Error("Execution retry sequence is invalid.");
  return `execution-attempt:${reference.idempotencyId}:retry:${retrySequence}`;
}

function supportedCapability(source: PublicationSourceIdentity, operation: PublicationOperation): boolean {
  return source.capabilities.some((capability) => capability.operation === operation && capability.supportState === "supported");
}

export function constructPublicationExecutionRequest(input: PublicationExecutionRequestInput): PublicationExecutionRequest {
  requireNonBlank(input.requestId, "Publication execution request identity");
  requireVersion(input.requestRevision, "Publication execution request revision");
  requireTimestamp(input.requestedAt, "Publication execution request timestamp");
  validateInstruction(input.instruction);
  const source = definePublicationSourceIdentity(input.publicationSource);
  validateSnapshot(input.predecessorSnapshot);
  if (source.lifecycle.state !== "active") throw new Error("Publication execution request requires an active publication source revision.");
  if (!supportedCapability(source, input.instruction.instruction.operation)) throw new Error("Publication source does not support the instruction operation.");
  const idempotencyReference = createIdempotencyReference(input.instruction, source, input.predecessorSnapshot);
  const attemptIdentity = deepFreeze({ attemptId: input.attemptId, attemptRevision: input.attemptRevision, retrySequence: input.retrySequence, previousAttemptId: input.previousAttemptId, previousAttemptRevision: input.previousAttemptRevision });
  validateAttempt(attemptIdentity);
  if (attemptIdentity.attemptId !== deriveExecutionAttemptId(idempotencyReference, attemptIdentity.retrySequence)) throw new Error("Execution attempt identity is not the deterministic identity for its instruction, source, snapshot, and retry sequence.");
  if (attemptIdentity.retrySequence > 0 && attemptIdentity.previousAttemptId !== deriveExecutionAttemptId(idempotencyReference, attemptIdentity.retrySequence - 1)) throw new Error("Previous execution attempt does not match the deterministic retry lineage.");
  return deepFreeze({ requestId: input.requestId, requestRevision: input.requestRevision, instruction: input.instruction, publicationSource: source, predecessorSnapshot: input.predecessorSnapshot, attemptIdentity, idempotencyReference, requestedAt: input.requestedAt });
}

function validateResultReference(value: PublicationExecutionResultReference): void { requireNonBlank(value.resultId, "Previous execution-result identity"); requireVersion(value.resultRevision, "Previous execution-result revision"); requireDigest(value.resultDigest, "Previous execution-result digest"); }
function validateSnapshotReference(value: RegistrySnapshotReference, field: string): void { requireNonBlank(value.snapshotId, `${field} identity`); requireVersion(value.snapshotRevision, `${field} revision`); requireDigest(value.snapshotEnvelopeDigest, `${field} digest`); }

function canonicalFindings(values: readonly PublicationValidationFinding[]): readonly PublicationValidationFinding[] {
  const canonical = values.map((value) => { requireNonBlank(value.findingId, "Publication validation finding identity"); requireNonBlank(value.code, "Publication validation finding code"); if (!findingSeverities.has(value.severity)) throw new Error("Publication validation finding severity is invalid."); requireNonBlank(value.message, "Publication validation finding message"); const lists = [value.instructionPaths, value.sourcePaths, value.snapshotPaths].map((items) => { requireUnique(items, "Publication validation finding path"); return [...items].sort(compareText); }); return { ...value, instructionPaths: lists[0], sourcePaths: lists[1], snapshotPaths: lists[2] }; }).sort((left, right) => compareText(left.findingId, right.findingId));
  requireUnique(canonical.map((value) => value.findingId), "Publication validation finding identity");
  return canonical;
}

function resultMaterial(input: Omit<PublicationExecutionResult, "resultDigest">): Readonly<Record<string, unknown>> { return { ...input }; }

export function derivePublicationExecutionResult(input: Omit<PublicationExecutionResult, "resultDigest">): PublicationExecutionResultDerivation {
  const canonical = deepFreeze({ ...input, validationFindings: canonicalFindings(input.validationFindings) });
  const payload = canonicalizeDigestDomainPayload(resultMaterial(canonical));
  const digest = deriveDomainSeparatedDigest(payload.canonicalBytes, "publication_execution_result");
  return deepFreeze({ payload, digest });
}

function validateOutcome(input: Omit<PublicationExecutionResult, "resultDigest">): void {
  if (!states.has(input.state)) throw new Error("Publication execution state is invalid.");
  if (!reasons.has(input.reasonCode)) throw new Error("Publication execution reason code is invalid.");
  if (!retries.has(input.retryClassification)) throw new Error("Publication retry classification is invalid.");
  if (!replayStates.has(input.replayStatus)) throw new Error("Publication replay status is invalid.");
  if (!atomicStates.has(input.atomicCommitCertainty)) throw new Error("Publication atomic-commit certainty is invalid.");
  const hasKnowledge = input.resultingKnowledgeId !== null && input.resultingKnowledgeVersion !== null;
  if ((input.resultingKnowledgeId === null) !== (input.resultingKnowledgeVersion === null)) throw new Error("Resulting Knowledge identity and version must be supplied together.");
  if ((input.observedPredecessorKnowledgeId === null) !== (input.observedPredecessorKnowledgeVersion === null)) throw new Error("Observed predecessor identity and version must be supplied together.");
  if (input.resultingKnowledgeId !== null) requireNonBlank(input.resultingKnowledgeId, "Resulting Knowledge identity");
  if (input.resultingKnowledgeVersion !== null) requireVersion(input.resultingKnowledgeVersion, "Resulting Knowledge version");
  if (input.observedPredecessorKnowledgeId !== null) requireNonBlank(input.observedPredecessorKnowledgeId, "Observed predecessor Knowledge identity");
  if (input.observedPredecessorKnowledgeVersion !== null) requireVersion(input.observedPredecessorKnowledgeVersion, "Observed predecessor Knowledge version");
  if (input.resultingSnapshotIdentity !== null) validateSnapshotReference(input.resultingSnapshotIdentity, "Resulting snapshot");
  if (input.previousExecutionResult !== null) validateResultReference(input.previousExecutionResult);
  if (input.state === "published" && (!hasKnowledge || input.resultingSnapshotIdentity === null || input.atomicCommitCertainty !== "complete" || input.reasonCode !== "publication_completed" || input.retryClassification !== "not_required" || input.replayStatus !== "original" || input.previousExecutionResult !== null)) throw new Error("Published execution result has an invalid published-state combination.");
  if (input.state === "published" && input.validationFindings.some((finding) => finding.blocking)) throw new Error("Published execution result cannot retain a blocking validation finding.");
  if (input.state === "blocked" && (hasKnowledge || input.resultingSnapshotIdentity !== null || input.atomicCommitCertainty !== "incomplete" || input.replayStatus !== "original" || !["instruction_mismatch", "source_ineligible", "operation_unsupported", "predecessor_mismatch", "validation_failed"].includes(input.reasonCode))) throw new Error("Blocked execution result cannot contain published output or an incompatible reason.");
  if (input.state === "failed" && (hasKnowledge || input.resultingSnapshotIdentity !== null || input.atomicCommitCertainty === "complete" || input.reasonCode !== "execution_failed" || input.replayStatus !== "original")) throw new Error("Failed execution result has an invalid failed-state combination.");
  if (input.state === "indeterminate" && (input.atomicCommitCertainty !== "indeterminate" || input.reasonCode !== "atomicity_indeterminate" || input.retryClassification !== "manual_review_required" || input.replayStatus !== "original")) throw new Error("Indeterminate execution result must preserve indeterminate atomicity and manual review.");
  if (input.state === "idempotent_replay" && (input.replayStatus === "original" || input.previousExecutionResult === null || !["duplicate_execution", "prior_result_replayed"].includes(input.reasonCode) || (input.reasonCode === "duplicate_execution" && input.replayStatus !== "duplicate_detected") || (input.reasonCode === "prior_result_replayed" && input.replayStatus !== "replayed"))) throw new Error("Idempotent replay requires compatible replay status and previous-result linkage.");
  if (input.state !== "idempotent_replay" && input.previousExecutionResult !== null) throw new Error("Only idempotent replay may reference a previous execution result.");
  if (input.previousExecutionResult !== null && input.previousExecutionResult.resultId === input.resultId && input.previousExecutionResult.resultRevision === input.resultRevision) throw new Error("Execution result cannot reference itself as its previous result.");
}

export function constructPublicationExecutionResult(input: PublicationExecutionResultInput): PublicationExecutionResult {
  requireNonBlank(input.resultId, "Publication execution-result identity");
  requireVersion(input.resultRevision, "Publication execution-result revision");
  requireDigest(input.resultDigest, "Publication execution-result digest");
  requireTimestamp(input.executedAt, "Publication execution timestamp");
  const request = constructPublicationExecutionRequest({ requestId: input.request.requestId, requestRevision: input.request.requestRevision, instruction: input.request.instruction, publicationSource: input.request.publicationSource, predecessorSnapshot: input.request.predecessorSnapshot, attemptId: input.request.attemptIdentity.attemptId, attemptRevision: input.request.attemptIdentity.attemptRevision, retrySequence: input.request.attemptIdentity.retrySequence, previousAttemptId: input.request.attemptIdentity.previousAttemptId, previousAttemptRevision: input.request.attemptIdentity.previousAttemptRevision, requestedAt: input.request.requestedAt });
  const findings = canonicalFindings(input.validationFindings);
  const material = deepFreeze({ resultId: input.resultId, resultRevision: input.resultRevision, instructionIdentity: request.instruction.instructionIdentity, idempotencyReference: request.idempotencyReference, executionAttemptIdentity: request.attemptIdentity, state: input.state, reasonCode: input.reasonCode, retryClassification: input.retryClassification, resultingKnowledgeId: input.resultingKnowledgeId, resultingKnowledgeVersion: input.resultingKnowledgeVersion, observedPredecessorKnowledgeId: input.observedPredecessorKnowledgeId, observedPredecessorKnowledgeVersion: input.observedPredecessorKnowledgeVersion, publicationSourceIdentity: { sourceId: request.publicationSource.sourceId, sourceRevision: request.publicationSource.sourceRevision, sourceEnvelopeDigest: request.publicationSource.sourceEnvelopeDigest }, predecessorSnapshotIdentity: { snapshotId: request.predecessorSnapshot.snapshotId, snapshotRevision: request.predecessorSnapshot.snapshotRevision, snapshotEnvelopeDigest: request.predecessorSnapshot.snapshotEnvelopeDigest }, resultingSnapshotIdentity: input.resultingSnapshotIdentity, validationFindings: findings, executedAt: input.executedAt, replayStatus: input.replayStatus, previousExecutionResult: input.previousExecutionResult, atomicCommitCertainty: input.atomicCommitCertainty });
  validateOutcome(material);
  if (material.resultingKnowledgeId !== null && (material.resultingKnowledgeId !== request.instruction.targetStableKnowledgeId || material.resultingKnowledgeVersion !== request.instruction.targetKnowledgeVersion)) throw new Error("Publication execution result does not match the instruction target Knowledge identity.");
  if (material.observedPredecessorKnowledgeId !== request.instruction.expectedPredecessorStableKnowledgeId || material.observedPredecessorKnowledgeVersion !== request.instruction.expectedPredecessorKnowledgeVersion) throw new Error("Observed predecessor does not match the deterministic instruction.");
  const derived = derivePublicationExecutionResult(material);
  if (derived.digest.qualifiedDigest !== input.resultDigest) throw new Error("Publication execution-result digest does not match its canonical result material.");
  return deepFreeze({ ...material, resultDigest: input.resultDigest });
}

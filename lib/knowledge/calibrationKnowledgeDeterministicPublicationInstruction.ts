import {
  defineCalibrationKnowledgePublicationInstruction,
  type AdmissionAssertionChangeManifest,
  type AdmissionLifecycleChangeManifest,
  type AdmissionPolicyReference,
  type AdmissionStableIdentity,
  type CalibrationKnowledgeAdmissionProposal,
  type CalibrationKnowledgePublicationInstruction,
  type PublicationOperation,
} from "./calibrationKnowledgeAdmission.ts";
import type { AuthorisedCalibrationKnowledgeAdmissionDecision } from "./calibrationKnowledgeAuthorisedAdmissionDecision.ts";
import {
  canonicalizeCalibrationKnowledge,
  canonicalizeDigestDomainPayload,
  defineCalibrationKnowledgeDigestPolicy,
  defineCanonicalSerializationPolicy,
  deriveCalibrationKnowledgeContentDigests,
  deriveDomainSeparatedDigest,
  type CalibrationKnowledgeDigestPolicy,
  type CanonicalCalibrationKnowledgePayload,
  type CanonicalSerializationPolicy,
} from "./calibrationKnowledgeCanonicalSerialization.ts";

export type CalibrationKnowledgePublicationPolicyReference = Readonly<{
  policyId: string;
  policyVersion: string;
  compatibleAdmissionPolicyId: string;
  compatibleAdmissionPolicyVersion: string;
}>;

export type CalibrationKnowledgePublicationSourceRequirement = Readonly<{
  requirementId: string;
  requirementVersion: string;
  qualifiedIdentityRequired: true;
  immutableRevisionRequired: true;
}>;

export type CalibrationKnowledgePublicationIdempotencyReference = Readonly<{
  instructionId: string;
  instructionRevision: string;
  instructionContentDigest: string;
  targetStableKnowledgeId: string;
  targetKnowledgeVersion: string;
  expectedPredecessorStableKnowledgeId: string | null;
  expectedPredecessorKnowledgeVersion: string | null;
}>;

export type DeterministicCalibrationKnowledgePublicationInstructionInput = Readonly<{
  instructionId: string;
  instructionRevision: string;
  instructionContractVersion: string;
  createdAt: string;
  supersededInstructionIdentity: AdmissionStableIdentity | null;
  authorisedDecision: AuthorisedCalibrationKnowledgeAdmissionDecision;
  proposal: CalibrationKnowledgeAdmissionProposal;
  canonicalPayload: CanonicalCalibrationKnowledgePayload;
  acceptedKnowledgeDigest: string;
  expectedResultingCanonicalDigest: string;
  admissionPolicy: AdmissionPolicyReference;
  publicationPolicy: CalibrationKnowledgePublicationPolicyReference;
  serializationPolicy: CanonicalSerializationPolicy;
  digestPolicy: CalibrationKnowledgeDigestPolicy;
  operation: PublicationOperation;
  assertionChangeManifest: AdmissionAssertionChangeManifest;
  lifecycleChangeManifest: AdmissionLifecycleChangeManifest;
  publicationSourceRequirement: CalibrationKnowledgePublicationSourceRequirement;
}>;

export type DeterministicCalibrationKnowledgePublicationInstruction = Readonly<{
  instruction: CalibrationKnowledgePublicationInstruction;
  instructionIdentity: AdmissionStableIdentity;
  instructionContractVersion: string;
  instructionContentDigest: string;
  createdAt: string;
  supersededInstructionIdentity: AdmissionStableIdentity | null;
  acceptedDecisionOutcome: "accepted_provisional" | "accepted_authoritative" | "accepted_lifecycle_change";
  proposalIdentity: AdmissionStableIdentity;
  proposedRevisionIdentity: AdmissionStableIdentity;
  proposedRevisionNumber: string;
  proposedObjectDigest: string;
  targetStableKnowledgeId: string;
  targetKnowledgeVersion: string;
  expectedPredecessorStableKnowledgeId: string | null;
  expectedPredecessorKnowledgeVersion: string | null;
  assertionChangeManifest: AdmissionAssertionChangeManifest;
  lifecycleChangeManifest: AdmissionLifecycleChangeManifest;
  canonicalPayload: CanonicalCalibrationKnowledgePayload;
  acceptedKnowledgeDigest: string;
  expectedResultingCanonicalDigest: string;
  admissionPolicy: AdmissionPolicyReference;
  publicationPolicy: CalibrationKnowledgePublicationPolicyReference;
  serializationPolicy: CanonicalSerializationPolicy;
  digestPolicy: CalibrationKnowledgeDigestPolicy;
  publicationSourceRequirement: CalibrationKnowledgePublicationSourceRequirement;
  idempotencyReference: CalibrationKnowledgePublicationIdempotencyReference;
}>;

type AcceptedAdmissionDecisionOutcome = "accepted_provisional" | "accepted_authoritative" | "accepted_lifecycle_change";
const acceptedOutcomes = new Set<AcceptedAdmissionDecisionOutcome>(["accepted_provisional", "accepted_authoritative", "accepted_lifecycle_change"]);
const lifecycleOperations = new Set<PublicationOperation>(["record_dispute", "resolve_conflict", "supersede", "deprecate", "reject", "restore"]);

function requireNonBlank(value: string, field: string): void { if (!value.trim()) throw new Error(`${field} is required.`); }
function sameIdentity(left: AdmissionStableIdentity, right: AdmissionStableIdentity): boolean { return left.id === right.id && left.revision === right.revision && left.contentDigest === right.contentDigest; }
function deepFreeze<T>(value: T): T { if (Array.isArray(value)) return Object.freeze(value.map(deepFreeze)) as T; if (value !== null && typeof value === "object") { const clone: Record<PropertyKey, unknown> = {}; for (const key of Reflect.ownKeys(value)) clone[key] = deepFreeze((value as Record<PropertyKey, unknown>)[key]); return Object.freeze(clone) as T; } return value; }
function canonicalKey(value: unknown): string { return canonicalizeDigestDomainPayload(value).canonicalJson; }
function validateDigest(value: string, field: string): void { if (!/^sha256:[a-f0-9]{64}$/.test(value)) throw new Error(`${field} must be a qualified lowercase SHA-256 digest.`); }
function validateTimestamp(value: string): void { const parsed = new Date(value); if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString() !== value) throw new Error("Instruction creation timestamp must be canonical UTC RFC 3339."); }
function validateIdentity(value: AdmissionStableIdentity, field: string): void { requireNonBlank(value.id, `${field} identity`); requireNonBlank(value.revision, `${field} revision`); validateDigest(value.contentDigest, `${field} content digest`); }
function isAcceptedOutcome(value: string): value is AcceptedAdmissionDecisionOutcome { return acceptedOutcomes.has(value as AcceptedAdmissionDecisionOutcome); }
function canonicalAssertionManifest(value: AdmissionAssertionChangeManifest): AdmissionAssertionChangeManifest { return deepFreeze({ addedAssertionIds: [...value.addedAssertionIds].sort(), amendedAssertionIds: [...value.amendedAssertionIds].sort(), retainedAssertionIds: [...value.retainedAssertionIds].sort(), supersededAssertionIds: [...value.supersededAssertionIds].sort(), removedFromCurrentAssertionIds: [...value.removedFromCurrentAssertionIds].sort() }); }
function canonicalLifecycleManifest(value: AdmissionLifecycleChangeManifest): AdmissionLifecycleChangeManifest { return deepFreeze({ changes: [...value.changes].map((change) => ({ ...change, relatedStableKnowledgeIds: [...change.relatedStableKnowledgeIds].sort() })).sort((left, right) => left.sequence - right.sequence || (left.changeId < right.changeId ? -1 : left.changeId > right.changeId ? 1 : 0)) }); }
function canonicalAdmissionPolicy(value: AdmissionPolicyReference): AdmissionPolicyReference { return deepFreeze({ ...value, applicableProposalKinds: [...value.applicableProposalKinds].sort(), validationRuleVersions: [...value.validationRuleVersions].sort() }); }

function validatePolicies(input: DeterministicCalibrationKnowledgePublicationInstructionInput): void {
  const serialization = defineCanonicalSerializationPolicy(input.serializationPolicy);
  const digest = defineCalibrationKnowledgeDigestPolicy(input.digestPolicy);
  if (serialization.policyVersion !== "1" || serialization.supportState !== "supported") throw new Error("Publication instruction requires supported serialization policy version 1.");
  if (digest.policyVersion !== "1" || digest.supportState !== "supported") throw new Error("Publication instruction requires supported digest policy version 1.");
  if (input.authorisedDecision.policyId !== input.admissionPolicy.policyId || input.authorisedDecision.policyVersion !== input.admissionPolicy.policyVersion) throw new Error("Admission policy does not match the exact authorised decision policy.");
  requireNonBlank(input.publicationPolicy.policyId, "Publication policy identity");
  requireNonBlank(input.publicationPolicy.policyVersion, "Publication policy version");
  if (input.publicationPolicy.compatibleAdmissionPolicyId !== input.admissionPolicy.policyId || input.publicationPolicy.compatibleAdmissionPolicyVersion !== input.admissionPolicy.policyVersion) throw new Error("Publication policy is incompatible with the authorised admission policy.");
}

function validateDecisionAndRevision(input: DeterministicCalibrationKnowledgePublicationInstructionInput): void {
  const decision = input.authorisedDecision.decision;
  if (!isAcceptedOutcome(decision.outcome)) throw new Error(`Admission Decision outcome ${decision.outcome} cannot produce a Publication Instruction.`);
  if (decision.publicationInstructionId !== input.instructionId) throw new Error("Instruction identity does not match the exact publication instruction authorised by the decision.");
  if (!sameIdentity(input.authorisedDecision.proposalIdentity, input.proposal.proposalIdentity)) throw new Error("Publication Instruction must bind the exact Admission Proposal identity and revision.");
  const revision = input.proposal.proposedRevision;
  const binding = input.authorisedDecision.proposedRevisionBinding;
  if (!sameIdentity(revision.revisionIdentity, binding.revisionIdentity) || revision.revisionIdentity.revision !== binding.revisionNumber || revision.revisionIdentity.contentDigest !== binding.proposedObjectDigest) throw new Error("Publication Instruction proposed revision does not match the authorised revision identity, number, and digest.");
  if (revision.proposedStableKnowledgeId !== binding.proposedStableKnowledgeId || revision.proposedKnowledgeVersion !== binding.proposedKnowledgeVersion) throw new Error("Publication Instruction target Knowledge identity or version does not match the authorised revision.");
  if (revision.expectedPredecessorStableKnowledgeId !== binding.expectedPredecessorStableKnowledgeId || revision.expectedPredecessorKnowledgeVersion !== binding.expectedPredecessorKnowledgeVersion) throw new Error("Publication Instruction predecessor does not match the authorised revision.");
  if (canonicalKey(input.assertionChangeManifest) !== canonicalKey(binding.assertionChangeManifest) || canonicalKey(revision.changeManifest) !== canonicalKey(binding.assertionChangeManifest)) throw new Error("Publication Instruction assertion change manifest does not match the authorised revision.");
  if (canonicalKey(input.lifecycleChangeManifest) !== canonicalKey(binding.lifecycleChangeManifest) || canonicalKey(revision.lifecycleChangeManifest) !== canonicalKey(binding.lifecycleChangeManifest)) throw new Error("Publication Instruction lifecycle-change manifest does not match the authorised revision.");
  if (input.operation !== input.authorisedDecision.publicationOperation) throw new Error("Publication operation does not match the authorised decision.");
  const lifecycle = lifecycleOperations.has(input.operation);
  if (lifecycle !== (decision.outcome === "accepted_lifecycle_change")) throw new Error("Publication operation is incompatible with the accepted decision outcome.");
  if (input.operation === "register" && (binding.expectedPredecessorStableKnowledgeId !== null || binding.expectedPredecessorKnowledgeVersion !== null)) throw new Error("Register publication cannot declare a predecessor.");
  if (input.operation !== "register" && (binding.expectedPredecessorStableKnowledgeId === null || binding.expectedPredecessorKnowledgeVersion === null)) throw new Error("Amending publication requires the exact predecessor identity and version.");
  if (lifecycle && binding.lifecycleChangeManifest.changes.length === 0) throw new Error("Lifecycle publication requires the authorised lifecycle-change manifest.");
  if (!lifecycle && binding.lifecycleChangeManifest.changes.length > 0) throw new Error("Non-lifecycle publication cannot carry lifecycle changes.");
  if (lifecycle && binding.lifecycleChangeManifest.changes.some((change) => change.operation !== input.operation || change.targetStableKnowledgeId !== binding.proposedStableKnowledgeId || change.targetKnowledgeVersion !== binding.proposedKnowledgeVersion)) throw new Error("Lifecycle-change manifest is incompatible with the authorised operation and target.");
}

function validatePayload(input: DeterministicCalibrationKnowledgePublicationInstructionInput): CanonicalCalibrationKnowledgePayload {
  const recomputed = canonicalizeCalibrationKnowledge(input.proposal.proposedRevision.knowledge, input.serializationPolicy);
  if (canonicalKey(input.canonicalPayload.serializationPolicy) !== canonicalKey(input.serializationPolicy)) throw new Error("Canonical payload serialization policy does not match the instruction policy.");
  if (recomputed.canonicalJson !== input.canonicalPayload.canonicalJson || canonicalKey(recomputed.canonicalBytes) !== canonicalKey(input.canonicalPayload.canonicalBytes) || recomputed.canonicalJson !== canonicalizeCalibrationKnowledge(input.canonicalPayload.knowledge, input.serializationPolicy).canonicalJson) throw new Error("Canonical payload or embedded bytes do not match the exact authorised Knowledge revision.");
  const digests = deriveCalibrationKnowledgeContentDigests(input.proposal.proposedRevision.knowledge, input.serializationPolicy, input.digestPolicy);
  validateDigest(input.acceptedKnowledgeDigest, "Accepted Knowledge digest");
  validateDigest(input.expectedResultingCanonicalDigest, "Expected resulting canonical digest");
  if (input.acceptedKnowledgeDigest !== digests.acceptedKnowledgeDigest || input.expectedResultingCanonicalDigest !== digests.expectedResultingCanonicalDigest) throw new Error("Caller-supplied Knowledge digest does not match the independently derived canonical payload digest.");
  if (input.acceptedKnowledgeDigest !== input.expectedResultingCanonicalDigest) throw new Error("Version 1 accepted and expected resulting Knowledge digests must be equal.");
  return recomputed;
}

export function constructDeterministicCalibrationKnowledgePublicationInstruction(input: DeterministicCalibrationKnowledgePublicationInstructionInput): DeterministicCalibrationKnowledgePublicationInstruction {
  requireNonBlank(input.instructionId, "Instruction stable identity");
  requireNonBlank(input.instructionRevision, "Instruction revision");
  requireNonBlank(input.instructionContractVersion, "Instruction contract version");
  validateTimestamp(input.createdAt);
  validatePolicies(input);
  validateDecisionAndRevision(input);
  if (!isAcceptedOutcome(input.authorisedDecision.decision.outcome)) throw new Error("Publication Instruction requires an accepted Admission Decision.");
  const payload = validatePayload(input);
  requireNonBlank(input.publicationSourceRequirement.requirementId, "Publication source requirement identity");
  requireNonBlank(input.publicationSourceRequirement.requirementVersion, "Publication source requirement version");
  if (input.publicationSourceRequirement.qualifiedIdentityRequired !== true || input.publicationSourceRequirement.immutableRevisionRequired !== true) throw new Error("Publication source requirement must preserve qualified immutable source identity requirements.");
  if (input.instructionRevision === "1" && input.supersededInstructionIdentity !== null) throw new Error("Initial Publication Instruction cannot supersede another instruction.");
  if (input.instructionRevision !== "1" && input.supersededInstructionIdentity === null) throw new Error("Corrected Publication Instruction requires an explicit superseded instruction reference.");
  if (input.supersededInstructionIdentity) {
    validateIdentity(input.supersededInstructionIdentity, "Superseded instruction");
    if (input.supersededInstructionIdentity.id === input.instructionId) throw new Error("Corrected Publication Instruction requires a new stable instruction identity.");
    if (input.authorisedDecision.supersededDecisionIdentity === null) throw new Error("Corrected Publication Instruction requires a corrected or superseding authorised decision.");
  }

  const binding = input.authorisedDecision.proposedRevisionBinding;
  const assertionChangeManifest = canonicalAssertionManifest(binding.assertionChangeManifest);
  const lifecycleChangeManifest = canonicalLifecycleManifest(binding.lifecycleChangeManifest);
  const proposedRevisionBinding = deepFreeze({ ...binding, assertionChangeManifest, lifecycleChangeManifest });
  const admissionPolicy = canonicalAdmissionPolicy(input.admissionPolicy);
  const digestEnvelope = {
    instructionId: input.instructionId,
    instructionRevision: input.instructionRevision,
    instructionContractVersion: input.instructionContractVersion,
    createdAt: input.createdAt,
    supersededInstructionIdentity: input.supersededInstructionIdentity,
    acceptedDecisionIdentity: input.authorisedDecision.decision.decisionIdentity,
    acceptedDecisionOutcome: input.authorisedDecision.decision.outcome,
    proposalIdentity: input.authorisedDecision.proposalIdentity,
    proposedRevisionBinding,
    operation: input.operation,
    canonicalPayload: payload,
    acceptedKnowledgeDigest: input.acceptedKnowledgeDigest,
    expectedResultingCanonicalDigest: input.expectedResultingCanonicalDigest,
    admissionPolicy,
    publicationPolicy: input.publicationPolicy,
    serializationPolicy: input.serializationPolicy,
    digestPolicy: input.digestPolicy,
    publicationSourceRequirement: input.publicationSourceRequirement,
  };
  const instructionBytes = canonicalizeDigestDomainPayload(digestEnvelope).canonicalBytes;
  const instructionContentDigest = deriveDomainSeparatedDigest(instructionBytes, "publication_instruction", input.serializationPolicy, input.digestPolicy).qualifiedDigest;
  const instructionIdentity = deepFreeze({ id: input.instructionId, revision: input.instructionRevision, contentDigest: instructionContentDigest });
  const instruction = defineCalibrationKnowledgePublicationInstruction({ instructionIdentity, acceptedDecisionIdentity: input.authorisedDecision.decision.decisionIdentity, operation: input.operation, targetStableKnowledgeId: binding.proposedStableKnowledgeId, expectedPredecessorKnowledgeVersion: binding.expectedPredecessorKnowledgeVersion, acceptedKnowledgeDigest: input.acceptedKnowledgeDigest, resultingKnowledgeVersion: binding.proposedKnowledgeVersion, changeManifest: assertionChangeManifest, policy: admissionPolicy, expectedResultingCanonicalDigest: input.expectedResultingCanonicalDigest, lifecycle: { status: "publication_ready", version: input.instructionRevision, effectiveAt: input.createdAt, ...(input.supersededInstructionIdentity ? { supersedesIds: [input.supersededInstructionIdentity.id] } : {}) } });
  const idempotencyReference = deepFreeze({ instructionId: input.instructionId, instructionRevision: input.instructionRevision, instructionContentDigest, targetStableKnowledgeId: binding.proposedStableKnowledgeId, targetKnowledgeVersion: binding.proposedKnowledgeVersion, expectedPredecessorStableKnowledgeId: binding.expectedPredecessorStableKnowledgeId, expectedPredecessorKnowledgeVersion: binding.expectedPredecessorKnowledgeVersion });
  return deepFreeze({ instruction, instructionIdentity, instructionContractVersion: input.instructionContractVersion, instructionContentDigest, createdAt: input.createdAt, supersededInstructionIdentity: input.supersededInstructionIdentity, acceptedDecisionOutcome: input.authorisedDecision.decision.outcome, proposalIdentity: input.authorisedDecision.proposalIdentity, proposedRevisionIdentity: binding.revisionIdentity, proposedRevisionNumber: binding.revisionNumber, proposedObjectDigest: binding.proposedObjectDigest, targetStableKnowledgeId: binding.proposedStableKnowledgeId, targetKnowledgeVersion: binding.proposedKnowledgeVersion, expectedPredecessorStableKnowledgeId: binding.expectedPredecessorStableKnowledgeId, expectedPredecessorKnowledgeVersion: binding.expectedPredecessorKnowledgeVersion, assertionChangeManifest, lifecycleChangeManifest, canonicalPayload: payload, acceptedKnowledgeDigest: input.acceptedKnowledgeDigest, expectedResultingCanonicalDigest: input.expectedResultingCanonicalDigest, admissionPolicy, publicationPolicy: input.publicationPolicy, serializationPolicy: input.serializationPolicy, digestPolicy: input.digestPolicy, publicationSourceRequirement: input.publicationSourceRequirement, idempotencyReference });
}

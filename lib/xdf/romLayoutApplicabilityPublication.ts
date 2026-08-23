import { createHash } from "node:crypto";
import type { CandidateBinaryRole } from "./applicabilityEvidenceProposal.ts";
import type { GovernedRomLayoutReviewPackage, RomLayoutAuthorityPathway } from "./romLayoutApplicability.ts";

export type GovernedRomLayoutReviewReference = Readonly<{
  packageId: string;
  packageRevision: string;
  sourceArtifactId: string;
  sourceArtifactDigest: string;
  definitionSetId: string;
  definitionSetRevisionId: string;
  romLayoutId: string;
  authorityPathway: RomLayoutAuthorityPathway;
  sourceAuthorityDisposition: "authoritative" | "disclosed_non_authoritative";
  assessmentOutcome: "evidence_sufficient_for_governed_review";
  supportingExactBinaries: readonly Readonly<{ binaryDigest: string; sourceRole: CandidateBinaryRole; byteLength: number; internalRomIdentifiers: readonly string[] }>[],
  representationConflictCount: number;
  provenanceDisclosure: readonly string[];
  limitations: readonly string[];
}>;

export type RomLayoutDecisionAuthority = Readonly<{
  authorityId: string;
  authorityClass: "founder" | "governed_engineering_authority";
  authorityRevision: string;
  provenance: readonly string[];
  acceptedPathways: readonly RomLayoutAuthorityPathway[];
}>;

export type RomLayoutApplicabilityDecisionRecord = Readonly<{
  decisionId: string;
  decisionRevision: string;
  contractVersion: "tunesight.rom-layout-applicability-decision.v1";
  outcome: "accept_rom_layout_applicability";
  reviewPackageId: string;
  reviewPackageRevision: string;
  sourceArtifactId: string;
  sourceArtifactDigest: string;
  definitionSetId: string;
  definitionSetRevisionId: string;
  romLayoutId: string;
  authorityPathway: RomLayoutAuthorityPathway;
  authority: RomLayoutDecisionAuthority;
  acceptedEvidenceThreshold: readonly string[];
  rationale: string;
  provenanceLimitations: readonly string[];
  decidedAt: string;
  decisionReference: string;
  publicationState: "not_published";
}>;

export type RomLayoutPublicationInstruction = Readonly<{
  instructionId: string;
  instructionRevision: string;
  contractVersion: "tunesight.rom-layout-applicability-publication-instruction.v1";
  decisionId: string;
  decisionRevision: string;
  reviewPackageId: string;
  reviewPackageRevision: string;
  sourceArtifactId: string;
  sourceArtifactDigest: string;
  definitionSetId: string;
  definitionSetRevisionId: string;
  romLayoutId: string;
  authorityPathway: RomLayoutAuthorityPathway;
  authorityProvenance: readonly string[];
  sourceProvenanceDisclosure: readonly string[];
  provenanceLimitations: readonly string[];
  supportingExactBinaries: GovernedRomLayoutReviewReference["supportingExactBinaries"];
  representationConflictCount: number;
  expectedRegistrySnapshotId: string;
  createdAt: string;
}>;

export type QualifiedRomLayoutApplicabilityRelationship = Readonly<{
  relationshipId: string;
  relationshipRevision: string;
  contractVersion: "tunesight.qualified-rom-layout-applicability-relationship.v1";
  sourceArtifactId: string;
  sourceArtifactDigest: string;
  definitionSetId: string;
  definitionSetRevisionId: string;
  romLayoutId: string;
  authorityPathway: RomLayoutAuthorityPathway;
  qualificationProvenance: "tunesight_qualified_through_governed_engineering_evidence" | "external_source_authority";
  supportingExactBinaries: GovernedRomLayoutReviewReference["supportingExactBinaries"];
  decisionId: string;
  decisionRevision: string;
  instructionId: string;
  instructionRevision: string;
  authorityProvenance: readonly string[];
  sourceProvenanceDisclosure: readonly string[];
  provenanceLimitations: readonly string[];
  representationConflictCount: number;
  lifecycleState: "active";
  publicationScope: "local_domain_only";
  publishedAt: string;
}>;

export type RomLayoutPublicationReceipt = Readonly<{
  receiptId: string;
  receiptRevision: string;
  contractVersion: "tunesight.rom-layout-applicability-publication-receipt.v1";
  instructionId: string;
  instructionRevision: string;
  relationshipRevision: string;
  priorSnapshotId: string;
  resultingSnapshotId: string;
  result: "published" | "idempotent_replay";
  publishedAt: string;
}>;

export type RomLayoutApplicabilityRegistrySnapshot = Readonly<{
  snapshotId: string;
  contractVersion: "tunesight.rom-layout-applicability-registry-snapshot.v1";
  relationships: readonly QualifiedRomLayoutApplicabilityRelationship[];
  receipts: readonly RomLayoutPublicationReceipt[];
  createdAt: string;
}>;

export type RomLayoutRegistryLookup = Readonly<{ outcome: "exact_active" | "multiple_conflict" | "none" | "invalid"; romLayoutId: string; relationships: readonly QualifiedRomLayoutApplicabilityRelationship[]; explanation: string }>;
export type RomLayoutPublicationResult = Readonly<{ status: "published" | "idempotent_replay"; priorSnapshot: RomLayoutApplicabilityRegistrySnapshot; resultingSnapshot: RomLayoutApplicabilityRegistrySnapshot; relationship: QualifiedRomLayoutApplicabilityRelationship; receipt: RomLayoutPublicationReceipt }> | Readonly<{ status: "rejected"; priorSnapshot: RomLayoutApplicabilityRegistrySnapshot; resultingSnapshot: RomLayoutApplicabilityRegistrySnapshot; error: string }>;

function canonical(value: unknown): string { if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value); if (typeof value === "number") { if (!Number.isFinite(value) || !Number.isSafeInteger(value)) throw new Error("ROM-layout publication identity contains an unsafe number."); return JSON.stringify(value); } if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`; if (!value || typeof value !== "object") throw new Error("ROM-layout publication identity contains an unsupported value."); const record=value as Readonly<Record<string,unknown>>; return `{${Object.keys(record).filter((key)=>record[key]!==undefined).sort().map((key)=>`${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`; }
function digest(domain:string,value:unknown):string{return createHash("sha256").update(domain).update(Buffer.from([0])).update(canonical(value)).digest("hex");}
function freeze<T>(value:T):T{if(Array.isArray(value))return Object.freeze(value.map(freeze)) as T;if(value&&typeof value==="object"){const clone:Record<PropertyKey,unknown>={};for(const key of Reflect.ownKeys(value))clone[key]=freeze((value as Record<PropertyKey,unknown>)[key]);return Object.freeze(clone) as T;}return value;}
function timestamp(value:string,field:string):void{const parsed=new Date(value);if(!Number.isFinite(parsed.valueOf())||parsed.toISOString()!==value)throw new Error(`${field} must be canonical UTC.`);}
function nonblank(values:readonly string[],field:string):readonly string[]{const result=[...new Set(values.map((value)=>value.trim()).filter(Boolean))].sort();if(!result.length||result.length!==values.length)throw new Error(`${field} requires unique nonblank values.`);return result;}
function validLayoutId(value:string):boolean{return /^rom-layout:[a-f0-9]{64}$/.test(value);}
function validSourceDigest(value:string):boolean{return /^sha256:[a-f0-9]{64}$/.test(value);}
function exactBinaries(values:GovernedRomLayoutReviewReference["supportingExactBinaries"]){if(values.length<2)throw new Error("Governed layout publication requires at least two supporting exact binary instances.");const digests=new Set<string>();return values.map((value)=>{if(!/^[a-f0-9]{64}$/.test(value.binaryDigest)||value.byteLength<=0||!value.internalRomIdentifiers.length)throw new Error("Supporting exact binary identity is invalid.");if(digests.has(value.binaryDigest))throw new Error("Supporting exact binary digests must be distinct.");digests.add(value.binaryDigest);return {...value,internalRomIdentifiers:[...new Set(value.internalRomIdentifiers)].sort()};}).sort((a,b)=>a.binaryDigest.localeCompare(b.binaryDigest));}

export function referenceGovernedRomLayoutReviewPackage(review:GovernedRomLayoutReviewPackage):GovernedRomLayoutReviewReference{
  if(review.assessment.outcome!=="evidence_sufficient_for_governed_review"||!review.assessment.reviewEligible||!review.assessment.explicitAuthorisedReviewerRequired)throw new Error("Only an Evidence-sufficient governed package can become a decision reference.");
  return freeze({packageId:review.packageId,packageRevision:review.packageRevision,sourceArtifactId:review.sourceArtifact.artifactId,sourceArtifactDigest:review.sourceArtifact.sourceDigest,definitionSetId:review.definitionSet.definitionSetId,definitionSetRevisionId:review.definitionSet.revisionId,romLayoutId:review.romLayoutIdentity.layoutId,authorityPathway:review.authorityPathway,sourceAuthorityDisposition:review.sourceAuthorityDisposition,assessmentOutcome:review.assessment.outcome,supportingExactBinaries:review.binaryEvidence.map((value)=>({binaryDigest:value.binaryIdentity.digest,sourceRole:value.sourceRole,byteLength:value.binaryIdentity.byteLength,internalRomIdentifiers:value.binaryIdentity.internalRomIdentifiers})),representationConflictCount:review.representationConflictCount,provenanceDisclosure:review.provenanceDisclosure,limitations:review.limitations});
}

export function constructRomLayoutApplicabilityDecision(input:{review:GovernedRomLayoutReviewReference;authority:RomLayoutDecisionAuthority;acceptedEvidenceThreshold:readonly string[];rationale:string;provenanceLimitations:readonly string[];decidedAt:string;decisionReference:string}):RomLayoutApplicabilityDecisionRecord{
  timestamp(input.decidedAt,"Decision timestamp");const review=input.review;if(review.assessmentOutcome!=="evidence_sufficient_for_governed_review"||review.representationConflictCount!==0)throw new Error("Accepted ROM-layout applicability requires an Evidence-sufficient conflict-free review package.");if(!validLayoutId(review.romLayoutId))throw new Error("Accepted ROM-layout decision requires an exact ROM Layout Identity.");if(!validSourceDigest(review.sourceArtifactDigest))throw new Error("Accepted ROM-layout decision requires an exact XDF Source digest.");if(!review.definitionSetRevisionId||!review.packageId||!review.packageRevision)throw new Error("Accepted ROM-layout decision package bindings are invalid.");if(!input.authority.authorityId.trim()||!input.authority.authorityRevision.trim()||!input.authority.provenance.length||!input.authority.acceptedPathways.includes(review.authorityPathway))throw new Error("Reviewer authority does not accept the review package authority pathway.");if(!input.rationale.trim()||!input.decisionReference.trim())throw new Error("Decision rationale and external decision reference are required.");const acceptedEvidenceThreshold=nonblank(input.acceptedEvidenceThreshold,"Accepted Evidence threshold");const provenanceLimitations=nonblank(input.provenanceLimitations,"Provenance limitations");const authority=freeze({...input.authority,provenance:nonblank(input.authority.provenance,"Authority provenance"),acceptedPathways:[...new Set(input.authority.acceptedPathways)].sort()});const relationship={definitionSetRevisionId:review.definitionSetRevisionId,romLayoutId:review.romLayoutId,authorityId:authority.authorityId};const decisionId=`rom-layout-applicability-decision:${digest("tunesight.rom-layout-applicability-decision-identity.v1",relationship)}`;const material={outcome:"accept_rom_layout_applicability" as const,reviewPackageId:review.packageId,reviewPackageRevision:review.packageRevision,sourceArtifactId:review.sourceArtifactId,sourceArtifactDigest:review.sourceArtifactDigest,definitionSetId:review.definitionSetId,definitionSetRevisionId:review.definitionSetRevisionId,romLayoutId:review.romLayoutId,authorityPathway:review.authorityPathway,authority,acceptedEvidenceThreshold,rationale:input.rationale.trim(),provenanceLimitations,decidedAt:input.decidedAt,decisionReference:input.decisionReference.trim(),publicationState:"not_published" as const,contractVersion:"tunesight.rom-layout-applicability-decision.v1" as const};return freeze({decisionId,decisionRevision:`rom-layout-applicability-decision-revision:${digest("tunesight.rom-layout-applicability-decision-revision.v1",material)}`,...material});
}

export function constructRomLayoutPublicationInstruction(input:{review:GovernedRomLayoutReviewReference;decision:RomLayoutApplicabilityDecisionRecord;expectedRegistrySnapshotId:string;createdAt:string}):RomLayoutPublicationInstruction{
  timestamp(input.createdAt,"Instruction timestamp");const {review,decision}=input;if(decision.outcome!=="accept_rom_layout_applicability"||decision.publicationState!=="not_published")throw new Error("Only an accepted unpublished ROM-layout decision can publish.");if(decision.reviewPackageId!==review.packageId||decision.reviewPackageRevision!==review.packageRevision||decision.definitionSetRevisionId!==review.definitionSetRevisionId||decision.romLayoutId!==review.romLayoutId||decision.sourceArtifactDigest!==review.sourceArtifactDigest)throw new Error("Publication requires the exact accepted review package and relationship bindings.");if(!input.expectedRegistrySnapshotId.trim())throw new Error("Expected registry Snapshot identity is required.");const material={decisionId:decision.decisionId,decisionRevision:decision.decisionRevision,reviewPackageId:review.packageId,reviewPackageRevision:review.packageRevision,sourceArtifactId:review.sourceArtifactId,sourceArtifactDigest:review.sourceArtifactDigest,definitionSetId:review.definitionSetId,definitionSetRevisionId:review.definitionSetRevisionId,romLayoutId:review.romLayoutId,authorityPathway:review.authorityPathway,authorityProvenance:nonblank(decision.authority.provenance,"Authority provenance"),sourceProvenanceDisclosure:nonblank(review.provenanceDisclosure,"Source provenance disclosure"),provenanceLimitations:nonblank(decision.provenanceLimitations,"Provenance limitations"),supportingExactBinaries:exactBinaries(review.supportingExactBinaries),representationConflictCount:review.representationConflictCount,expectedRegistrySnapshotId:input.expectedRegistrySnapshotId,createdAt:input.createdAt,contractVersion:"tunesight.rom-layout-applicability-publication-instruction.v1" as const};const instructionId=`rom-layout-applicability-publication:${digest("tunesight.rom-layout-applicability-publication-identity.v1",{decisionId:decision.decisionId})}`;return freeze({instructionId,instructionRevision:`rom-layout-applicability-publication-revision:${digest("tunesight.rom-layout-applicability-publication-revision.v1",material)}`,...material});
}

function makeSnapshot(relationships:readonly QualifiedRomLayoutApplicabilityRelationship[],receipts:readonly RomLayoutPublicationReceipt[],createdAt:string):RomLayoutApplicabilityRegistrySnapshot{const orderedRelationships=[...relationships].sort((a,b)=>a.relationshipRevision.localeCompare(b.relationshipRevision));const orderedReceipts=[...receipts].sort((a,b)=>a.receiptRevision.localeCompare(b.receiptRevision));const snapshotId=`rom-layout-applicability-registry-snapshot:${digest("tunesight.rom-layout-applicability-registry-snapshot.v1",{relationships:orderedRelationships,createdAt})}`;return freeze({snapshotId,contractVersion:"tunesight.rom-layout-applicability-registry-snapshot.v1",relationships:orderedRelationships,receipts:orderedReceipts,createdAt});}
export function createEmptyRomLayoutApplicabilityRegistry(createdAt:string):RomLayoutApplicabilityRegistrySnapshot{timestamp(createdAt,"Snapshot timestamp");return makeSnapshot([],[],createdAt);}
function reject(snapshot:RomLayoutApplicabilityRegistrySnapshot,error:string):RomLayoutPublicationResult{return freeze({status:"rejected",priorSnapshot:snapshot,resultingSnapshot:snapshot,error});}
function validateInstruction(instruction:RomLayoutPublicationInstruction):void{const {instructionId,instructionRevision,...material}=instruction;const expectedId=`rom-layout-applicability-publication:${digest("tunesight.rom-layout-applicability-publication-identity.v1",{decisionId:instruction.decisionId})}`;const expectedRevision=`rom-layout-applicability-publication-revision:${digest("tunesight.rom-layout-applicability-publication-revision.v1",material)}`;if(instructionId!==expectedId||instructionRevision!==expectedRevision)throw new Error("ROM-layout publication instruction identity or revision is invalid.");}

export function publishRomLayoutApplicability(input:{instruction:RomLayoutPublicationInstruction;snapshot:RomLayoutApplicabilityRegistrySnapshot;publishedAt:string}):RomLayoutPublicationResult{const {instruction,snapshot}=input;try{timestamp(input.publishedAt,"Publication timestamp");validateInstruction(instruction);const replay=snapshot.receipts.find((item)=>item.instructionId===instruction.instructionId&&item.instructionRevision===instruction.instructionRevision);if(replay){const relationship=snapshot.relationships.find((item)=>item.relationshipRevision===replay.relationshipRevision);if(!relationship)return reject(snapshot,"Replay receipt relationship is missing.");return freeze({status:"idempotent_replay",priorSnapshot:snapshot,resultingSnapshot:snapshot,relationship,receipt:{...replay,result:"idempotent_replay"}});}if(instruction.expectedRegistrySnapshotId!==snapshot.snapshotId)return reject(snapshot,"Registry Snapshot is stale relative to the instruction precondition.");const relationshipId=`qualified-rom-layout-applicability:${digest("tunesight.qualified-rom-layout-applicability-identity.v1",{definitionSetId:instruction.definitionSetId,romLayoutId:instruction.romLayoutId})}`;if(snapshot.relationships.some((item)=>item.relationshipId===relationshipId&&item.lifecycleState==="active"))return reject(snapshot,"An active qualified ROM-layout relationship already exists.");const relationshipMaterial={relationshipId,sourceArtifactId:instruction.sourceArtifactId,sourceArtifactDigest:instruction.sourceArtifactDigest,definitionSetId:instruction.definitionSetId,definitionSetRevisionId:instruction.definitionSetRevisionId,romLayoutId:instruction.romLayoutId,authorityPathway:instruction.authorityPathway,qualificationProvenance:instruction.authorityPathway==="tunesight_governed_engineering_evidence"?"tunesight_qualified_through_governed_engineering_evidence" as const:"external_source_authority" as const,supportingExactBinaries:instruction.supportingExactBinaries,decisionId:instruction.decisionId,decisionRevision:instruction.decisionRevision,instructionId:instruction.instructionId,instructionRevision:instruction.instructionRevision,authorityProvenance:instruction.authorityProvenance,sourceProvenanceDisclosure:instruction.sourceProvenanceDisclosure,provenanceLimitations:instruction.provenanceLimitations,representationConflictCount:instruction.representationConflictCount,lifecycleState:"active" as const,publicationScope:"local_domain_only" as const,publishedAt:input.publishedAt,contractVersion:"tunesight.qualified-rom-layout-applicability-relationship.v1" as const};const relationship=freeze({...relationshipMaterial,relationshipRevision:`qualified-rom-layout-applicability-revision:${digest("tunesight.qualified-rom-layout-applicability-revision.v1",relationshipMaterial)}`});const provisional=makeSnapshot([...snapshot.relationships,relationship],snapshot.receipts,input.publishedAt);const receiptMaterial={instructionId:instruction.instructionId,instructionRevision:instruction.instructionRevision,relationshipRevision:relationship.relationshipRevision,priorSnapshotId:snapshot.snapshotId,resultingSnapshotId:provisional.snapshotId,result:"published" as const,publishedAt:input.publishedAt,contractVersion:"tunesight.rom-layout-applicability-publication-receipt.v1" as const};const receiptId=`rom-layout-applicability-publication-receipt:${digest("tunesight.rom-layout-applicability-publication-receipt-identity.v1",{instructionId:instruction.instructionId})}`;const receipt=freeze({receiptId,receiptRevision:`rom-layout-applicability-publication-receipt-revision:${digest("tunesight.rom-layout-applicability-publication-receipt-revision.v1",receiptMaterial)}`,...receiptMaterial});const resultingSnapshot=makeSnapshot([...snapshot.relationships,relationship],[...snapshot.receipts,receipt],input.publishedAt);return freeze({status:"published",priorSnapshot:snapshot,resultingSnapshot,relationship,receipt});}catch(error){return reject(snapshot,error instanceof Error?error.message:"ROM-layout publication failed.");}}

export function lookupActiveRomLayoutApplicability(snapshot:RomLayoutApplicabilityRegistrySnapshot,romLayoutId:string):RomLayoutRegistryLookup{if(!validLayoutId(romLayoutId))return freeze({outcome:"invalid",romLayoutId,relationships:[],explanation:"Lookup requires an exact ROM Layout Identity."});const relationships=snapshot.relationships.filter((item)=>item.romLayoutId===romLayoutId&&item.lifecycleState==="active");if(!relationships.length)return freeze({outcome:"none",romLayoutId,relationships:[],explanation:"No active qualified ROM-layout relationship exists."});if(relationships.length>1)return freeze({outcome:"multiple_conflict",romLayoutId,relationships,explanation:"Multiple active qualified relationships require governance resolution."});return freeze({outcome:"exact_active",romLayoutId,relationships,explanation:"One exact active qualified current Definition Set relationship exists."});}

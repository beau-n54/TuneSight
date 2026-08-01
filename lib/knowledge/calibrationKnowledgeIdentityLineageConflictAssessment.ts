import type { KnowledgeConfidenceState } from "./stockVariants.ts";
import type { AdmissionStableIdentity, CalibrationKnowledgeAdmissionProposal, PublicationOperation } from "./calibrationKnowledgeAdmission.ts";

export type CalibrationIdentityAssessmentState = "new_calibration" | "existing_calibration" | "correction" | "enrichment" | "applicability_refinement" | "lifecycle_amendment" | "supersession" | "source_representation" | "restoration" | "unresolved" | "conflict";
export type CalibrationIdentityBasis = "canonical_identity" | "verified_source_mapping" | "qualified_identity_evidence" | "xdf_label" | "filename" | "folder" | "table_address" | "display_name";
export type CalibrationIdentityClaimState = "supports" | "contradicts" | "unresolved";
export type CalibrationLineageState = "new_root" | "valid_successor" | "enrichment" | "correction" | "refinement" | "supersession" | "restoration" | "deprecation" | "lifecycle_amendment" | "unresolved" | "conflict";
export type CalibrationConflictCategory = "identity" | "applicability" | "source" | "authority" | "lifecycle" | "lineage" | "concurrent_proposal";

export type CalibrationIdentityCorrespondenceClaim = Readonly<{ claimId: string; state: CalibrationIdentityClaimState; basis: CalibrationIdentityBasis; canonicalKnowledgeId: string | null; assertionIds: readonly string[]; evidenceIds: readonly string[]; authorityClaimIds: readonly string[]; confidence: KnowledgeConfidenceState; unresolvedReason: string | null }>;
export type CalibrationCanonicalHistoryEntry = Readonly<{ stableKnowledgeId: string; versions: readonly string[]; currentVersion: string; lifecycleStatus: "active" | "superseded" | "deprecated" | "rejected"; predecessorKnowledgeId: string | null; successorKnowledgeIds: readonly string[] }>;
export type CalibrationReportedConflict = Readonly<{ conflictId: string; category: CalibrationConflictCategory; material: boolean; ambiguityOnly: boolean; summary: string; assertionIds: readonly string[]; evidenceIds: readonly string[]; authorityClaimIds: readonly string[]; canonicalKnowledgeIds: readonly string[]; proposalIds: readonly string[]; unresolvedReason: string }>;
export type CalibrationConcurrentProposalReference = Readonly<{ proposalId: string; targetStableKnowledgeId: string; expectedPredecessorVersion: string | null; operation: PublicationOperation }>;
export type CalibrationIdentityLineageConflictAssessmentInput = Readonly<{ assessmentIdentity: AdmissionStableIdentity; proposal: CalibrationKnowledgeAdmissionProposal; canonicalHistory: readonly CalibrationCanonicalHistoryEntry[]; identityClaims: readonly CalibrationIdentityCorrespondenceClaim[]; reportedConflicts: readonly CalibrationReportedConflict[]; concurrentProposals: readonly CalibrationConcurrentProposalReference[] }>;
export type CalibrationIdentityAssessment = Readonly<{ state: CalibrationIdentityAssessmentState; proposedStableKnowledgeId: string; matchedCanonicalKnowledgeIds: readonly string[]; consideredClaimIds: readonly string[]; prohibitedClaimIds: readonly string[]; confidence: KnowledgeConfidenceState; unresolvedReason: string | null }>;
export type CalibrationLineageAssessment = Readonly<{ state: CalibrationLineageState; operation: PublicationOperation; targetStableKnowledgeId: string; predecessorVersion: string | null; currentCanonicalVersion: string | null; historyPreserved: true; unresolvedReason: string | null }>;
export type CalibrationConflictAssessment = Readonly<{ status: "none" | "unresolved"; conflicts: readonly CalibrationReportedConflict[]; ambiguityProposalIds: readonly string[] }>;
export type CalibrationIdentityLineageConflictAssessment = Readonly<{ assessmentIdentity: AdmissionStableIdentity; proposalIdentity: AdmissionStableIdentity; identity: CalibrationIdentityAssessment; lineage: CalibrationLineageAssessment; conflict: CalibrationConflictAssessment; canonicalHistorySnapshot: readonly CalibrationCanonicalHistoryEntry[] }>;

const prohibitedBases = new Set<CalibrationIdentityBasis>(["xdf_label", "filename", "folder", "table_address", "display_name"]);
const confidenceOrder: readonly KnowledgeConfidenceState[] = ["unknown", "low", "medium", "high"];
const operationByProposal: Readonly<Record<CalibrationKnowledgeAdmissionProposal["proposalKind"], PublicationOperation>> = { register_new: "register", enrich_existing: "enrich", correct_existing: "correct", refine_applicability: "refine_applicability", add_evidence: "add_evidence", record_dispute: "record_dispute", resolve_conflict: "resolve_conflict", supersede: "supersede", deprecate: "deprecate", reject: "reject", restore: "restore" };

function nonBlank(value: string, field: string): void { if (!value.trim()) throw new Error(`${field} is required.`); }
function unique(values: readonly string[], field: string): readonly string[] { const sorted=[...values].sort(); for(let i=1;i<sorted.length;i++) if(sorted[i]===sorted[i-1]) throw new Error(`${field} contains duplicate ${sorted[i]}.`); sorted.forEach(item=>nonBlank(item,field)); return sorted; }
function distinct(values: readonly string[]): readonly string[] { return [...new Set(values)].sort(); }
function freeze<T>(value:T):T { if(Array.isArray(value)) return Object.freeze(value.map(freeze)) as T; if(value!==null&&typeof value==="object"){const clone:Record<PropertyKey,unknown>={}; for(const key of Reflect.ownKeys(value)) clone[key]=freeze((value as Record<PropertyKey,unknown>)[key]); return Object.freeze(clone) as T;} return value; }
function weakest(values:readonly KnowledgeConfidenceState[]):KnowledgeConfidenceState { return values.reduce((result,item)=>confidenceOrder.indexOf(item)<confidenceOrder.indexOf(result)?item:result,"high"); }
function proposalIdentityState(proposal:CalibrationKnowledgeAdmissionProposal, matched:boolean):CalibrationIdentityAssessmentState { if(!matched)return "new_calibration"; switch(proposal.proposalKind){case "correct_existing":return "correction";case "enrich_existing":case "add_evidence":return "enrichment";case "refine_applicability":return "applicability_refinement";case "supersede":return "supersession";case "restore":return "restoration";case "deprecate":case "reject":case "record_dispute":case "resolve_conflict":return "lifecycle_amendment";default:return "existing_calibration";} }
function lineageState(operation:PublicationOperation,valid:boolean,newRoot:boolean):CalibrationLineageState { if(newRoot)return "new_root"; if(!valid)return "conflict"; switch(operation){case "enrich":case "add_evidence":return "enrichment";case "correct":return "correction";case "refine_applicability":return "refinement";case "supersede":return "supersession";case "restore":return "restoration";case "deprecate":return "deprecation";case "record_dispute":case "resolve_conflict":case "reject":return "lifecycle_amendment";default:return "valid_successor";} }

export function assessCalibrationIdentityLineageAndConflict(input:CalibrationIdentityLineageConflictAssessmentInput):CalibrationIdentityLineageConflictAssessment {
  nonBlank(input.assessmentIdentity.id,"Assessment identity");
  const snapshot=freeze(input);
  unique(snapshot.canonicalHistory.map(item=>item.stableKnowledgeId),"Canonical Knowledge identity");
  unique(snapshot.identityClaims.map(item=>item.claimId),"Identity claim");
  const history=new Map(snapshot.canonicalHistory.map(item=>[item.stableKnowledgeId,item]));
  const prohibited=snapshot.identityClaims.filter(item=>prohibitedBases.has(item.basis)).map(item=>item.claimId).sort();
  const usable=snapshot.identityClaims.filter(item=>!prohibitedBases.has(item.basis));
  const supported=[...new Set(usable.filter(item=>item.state==="supports"&&item.canonicalKnowledgeId!==null).map(item=>item.canonicalKnowledgeId as string))].sort();
  const identityContradiction=usable.some(item=>item.state==="contradicts")||supported.length>1;
  const identityUnresolved=usable.some(item=>item.state==="unresolved");
  const missingCanonical=supported.some(id=>!history.has(id));
  const identityState:CalibrationIdentityAssessmentState=identityContradiction||missingCanonical?"conflict":identityUnresolved?"unresolved":proposalIdentityState(snapshot.proposal,supported.length===1);
  const identityConfidence:KnowledgeConfidenceState=identityState==="conflict"||identityState==="unresolved"?"unknown":usable.filter(item=>item.state==="supports").length?weakest(usable.filter(item=>item.state==="supports").map(item=>item.confidence)):"unknown";
  const target=supported[0]??snapshot.proposal.proposedRevision.proposedStableKnowledgeId;
  const canonical=history.get(target);
  const operation=operationByProposal[snapshot.proposal.proposalKind];
  const predecessor=snapshot.proposal.proposedRevision.expectedPredecessorKnowledgeVersion;
  const validPredecessor=canonical!==undefined&&predecessor===canonical.currentVersion;
  let lineageStateValue=lineageState(operation,validPredecessor,operation==="register"&&canonical===undefined);
  if(identityState==="unresolved")lineageStateValue="unresolved";
  if(identityState==="conflict")lineageStateValue="conflict";
  const generated:CalibrationReportedConflict[]=[];
  if(identityState==="conflict")generated.push({conflictId:`identity:${snapshot.proposal.proposalIdentity.id}`,category:"identity",material:true,ambiguityOnly:false,summary:"Identity claims materially disagree or reference unavailable canonical Knowledge.",assertionIds:distinct(usable.flatMap(item=>item.assertionIds)),evidenceIds:distinct(usable.flatMap(item=>item.evidenceIds)),authorityClaimIds:distinct(usable.flatMap(item=>item.authorityClaimIds)),canonicalKnowledgeIds:supported,proposalIds:[snapshot.proposal.proposalIdentity.id],unresolvedReason:"Identity requires authorised resolution."});
  if(lineageStateValue==="conflict"&&identityState!=="conflict")generated.push({conflictId:`lineage:${snapshot.proposal.proposalIdentity.id}`,category:"lineage",material:true,ambiguityOnly:false,summary:"Expected predecessor does not match canonical history.",assertionIds:[],evidenceIds:[],authorityClaimIds:[],canonicalKnowledgeIds:[target],proposalIds:[snapshot.proposal.proposalIdentity.id],unresolvedReason:"Lineage requires reconciliation against immutable history."});
  const competing=snapshot.concurrentProposals.filter(item=>item.proposalId!==snapshot.proposal.proposalIdentity.id&&item.targetStableKnowledgeId===target);
  const concurrentConflicts=competing.filter(item=>item.expectedPredecessorVersion===predecessor&&item.operation!==operation).map(item=>({conflictId:`concurrent:${item.proposalId}`,category:"concurrent_proposal" as const,material:true,ambiguityOnly:false,summary:"Concurrent proposals request incompatible operations against the same predecessor.",assertionIds:[],evidenceIds:[],authorityClaimIds:[],canonicalKnowledgeIds:[target],proposalIds:[snapshot.proposal.proposalIdentity.id,item.proposalId].sort(),unresolvedReason:"Concurrent proposal conflict requires authorised resolution."}));
  const reported=snapshot.reportedConflicts.filter(item=>item.material&&!item.ambiguityOnly);
  const ambiguityProposalIds=unique(snapshot.reportedConflicts.filter(item=>item.ambiguityOnly).flatMap(item=>item.proposalIds),"Ambiguous proposal identity");
  const conflicts=[...reported,...generated,...concurrentConflicts].sort((a,b)=>a.conflictId.localeCompare(b.conflictId));
  const identity:CalibrationIdentityAssessment={state:identityState,proposedStableKnowledgeId:snapshot.proposal.proposedRevision.proposedStableKnowledgeId,matchedCanonicalKnowledgeIds:supported,consideredClaimIds:usable.map(item=>item.claimId).sort(),prohibitedClaimIds:prohibited,confidence:identityConfidence,unresolvedReason:identityState==="conflict"?"Material identity conflict remains unresolved.":identityState==="unresolved"?"Identity evidence remains unresolved.":null};
  const lineage:CalibrationLineageAssessment={state:lineageStateValue,operation,targetStableKnowledgeId:target,predecessorVersion:predecessor,currentCanonicalVersion:canonical?.currentVersion??null,historyPreserved:true,unresolvedReason:lineageStateValue==="conflict"?"Lineage conflicts with canonical history.":lineageStateValue==="unresolved"?"Lineage awaits identity resolution.":null};
  return freeze({assessmentIdentity:snapshot.assessmentIdentity,proposalIdentity:snapshot.proposal.proposalIdentity,identity,lineage,conflict:{status:conflicts.length?"unresolved":"none",conflicts,ambiguityProposalIds},canonicalHistorySnapshot:snapshot.canonicalHistory});
}

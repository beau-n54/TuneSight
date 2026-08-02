import type { AdmissionStableIdentity } from "./calibrationKnowledgeAdmission.ts";
import type { KnowledgeProvenanceReference } from "./calibrationKnowledge.ts";
import type { ExactEngineeringAssertionRevisionReference } from "./engineeringAssertionAdmissionBinding.ts";
import type { RegistrySnapshotReference } from "./calibrationKnowledgePublicationSourceRegistrySnapshot.ts";

export type EngineeringAssertionConflictClassification =
  | "direct_contradiction" | "scope_separated_compatibility" | "conditional_compatibility"
  | "terminology_conflict" | "evidence_incompleteness" | "authority_conflict"
  | "unresolved_conflict" | "proposal_ambiguity";
export type EngineeringAssertionConflictResolutionState =
  | "unresolved" | "scope_separated" | "conditionally_compatible" | "resolved" | "withdrawn";
export type EngineeringAssertionConflictLifecycleState = "active" | "resolved" | "superseded" | "deprecated";
export type EngineeringAssertionSupersessionKind = "complete" | "partial";

export type ExactConflictEvidenceReference = Readonly<{
  evidenceId: string;
  evidencePackageIdentity: AdmissionStableIdentity;
  role: "supports_conflict" | "contradicts_conflict" | "supports_resolution";
}>;
export type ExactConflictAuthorityReference = Readonly<{
  authorityClaimIdentity: AdmissionStableIdentity;
  role: "establishes" | "disputes" | "resolves";
}>;
export type AssertionMaterialPathReference = Readonly<{
  assertion: ExactEngineeringAssertionRevisionReference;
  propositionPaths: readonly string[];
  scopePaths: readonly string[];
}>;
export type EngineeringAssertionConflictLifecycle = Readonly<{
  state: EngineeringAssertionConflictLifecycleState;
  lifecycleVersion: string;
  supersededByConflictIdentity: AdmissionStableIdentity | null;
}>;
export type EngineeringAssertionConflict = Readonly<{
  conflictIdentity: AdmissionStableIdentity;
  firstAssertion: ExactEngineeringAssertionRevisionReference;
  secondAssertion: ExactEngineeringAssertionRevisionReference;
  materialPaths: readonly AssertionMaterialPathReference[];
  classification: EngineeringAssertionConflictClassification;
  evidence: readonly ExactConflictEvidenceReference[];
  authority: readonly ExactConflictAuthorityReference[];
  rationale: string;
  resolutionState: EngineeringAssertionConflictResolutionState;
  resolutionSuccessorAssertion: ExactEngineeringAssertionRevisionReference | null;
  lifecycle: EngineeringAssertionConflictLifecycle;
  provenance: readonly KnowledgeProvenanceReference[];
  contractVersion: string;
}>;

export type DeclarativeAssertionScope = Readonly<{
  scopeId: string;
  assertion: ExactEngineeringAssertionRevisionReference;
  includedScopePaths: readonly string[];
  excludedScopePaths: readonly string[];
  description: string;
}>;
export type DeclarativeScopeComparison = Readonly<{
  comparisonId: string;
  basis: "equivalent" | "predecessor_contains_successor" | "overlap" | "disjoint" | "unresolved";
  comparedScopePaths: readonly string[];
  unresolvedOverlapConflictIdentity: AdmissionStableIdentity | null;
  rationale: string;
}>;
export type EffectivePublicationReference = Readonly<{
  publicationInstructionId: string;
  publicationInstructionRevision: string;
  publicationInstructionDigest: string;
}>;
export type EngineeringAssertionSupersession = Readonly<{
  supersessionIdentity: AdmissionStableIdentity;
  kind: EngineeringAssertionSupersessionKind;
  predecessor: ExactEngineeringAssertionRevisionReference;
  successor: ExactEngineeringAssertionRevisionReference;
  supersededScope: DeclarativeAssertionScope;
  retainedScope: DeclarativeAssertionScope | null;
  scopeComparison: DeclarativeScopeComparison;
  evidence: readonly ExactConflictEvidenceReference[];
  authority: readonly ExactConflictAuthorityReference[];
  rationale: string;
  effectivePublication: EffectivePublicationReference;
  registrySnapshot: RegistrySnapshotReference;
  provenance: readonly KnowledgeProvenanceReference[];
  contractVersion: string;
}>;

const classifications = new Set<EngineeringAssertionConflictClassification>(["direct_contradiction","scope_separated_compatibility","conditional_compatibility","terminology_conflict","evidence_incompleteness","authority_conflict","unresolved_conflict","proposal_ambiguity"]);
const resolutionStates = new Set<EngineeringAssertionConflictResolutionState>(["unresolved","scope_separated","conditionally_compatible","resolved","withdrawn"]);
const lifecycleStates = new Set<EngineeringAssertionConflictLifecycleState>(["active","resolved","superseded","deprecated"]);
function nonblank(value:string,field:string):void{if(!value.trim())throw new Error(`${field} is required.`);}
function digest(value:string,field:string):void{if(!/^sha256:[a-f0-9]{64}$/.test(value))throw new Error(`${field} must be a qualified lowercase SHA-256 digest.`);}
function identity(value:AdmissionStableIdentity,field:string):void{nonblank(value.id,`${field} identity`);nonblank(value.revision,`${field} revision`);if(!/^[a-z0-9][a-z0-9_-]*:[a-f0-9]{32,}$/i.test(value.contentDigest))throw new Error(`${field} content digest is invalid.`);}
function assertion(value:ExactEngineeringAssertionRevisionReference,field:string):void{nonblank(value.stableAssertionId,`${field} stable identity`);nonblank(value.assertionRevision,`${field} revision`);digest(value.canonicalAssertionDigest,`${field} canonical digest`);digest(value.assertionRevisionEnvelopeDigest,`${field} revision-envelope digest`);}
function assertionKey(value:ExactEngineeringAssertionRevisionReference):string{return [value.stableAssertionId,value.assertionRevision,value.canonicalAssertionDigest,value.assertionRevisionEnvelopeDigest].join("\0");}
function unique(values:readonly string[],field:string):void{const seen=new Set<string>();for(const value of values){nonblank(value,field);if(seen.has(value))throw new Error(`${field} ${value} is duplicated.`);seen.add(value);}}
function pointer(value:string,root:"proposition"|"scope",field:string):void{if(!value.startsWith(`/${root}/`)||value.includes("//")||/~(?![01])/.test(value))throw new Error(`${field} must be a canonical ${root} JSON Pointer.`);}
function cloneFreeze<T>(value:T):T{if(Array.isArray(value))return Object.freeze(value.map(cloneFreeze)) as T;if(value!==null&&typeof value==="object"){const clone:Record<PropertyKey,unknown>={};for(const key of Reflect.ownKeys(value))clone[key]=cloneFreeze((value as Record<PropertyKey,unknown>)[key]);return Object.freeze(clone) as T;}return value;}
function validateEvidence(values:readonly ExactConflictEvidenceReference[]):void{unique(values.map(v=>`${v.evidencePackageIdentity.id}\0${v.evidencePackageIdentity.revision}\0${v.evidenceId}\0${v.role}`),"Conflict Evidence reference");for(const value of values){nonblank(value.evidenceId,"Conflict Evidence identity");identity(value.evidencePackageIdentity,"Conflict Evidence package");}}
function validateAuthority(values:readonly ExactConflictAuthorityReference[]):void{unique(values.map(v=>`${v.authorityClaimIdentity.id}\0${v.authorityClaimIdentity.revision}\0${v.role}`),"Conflict authority reference");values.forEach(v=>identity(v.authorityClaimIdentity,"Conflict authority claim"));}
function validateProvenance(values:readonly KnowledgeProvenanceReference[]):void{if(values.length===0)throw new Error("Contract provenance is required.");unique(values.map(v=>`${v.sourceType}\0${v.sourceIdentifier}`),"Contract provenance");values.forEach(v=>{nonblank(v.sourceType,"Provenance source type");nonblank(v.sourceIdentifier,"Provenance source identity");});}
function validatePaths(value:AssertionMaterialPathReference,allowed:ReadonlySet<string>):void{assertion(value.assertion,"Material-path assertion");if(!allowed.has(assertionKey(value.assertion)))throw new Error("Material paths must reference one of the conflict assertions.");unique(value.propositionPaths,"Material proposition path");unique(value.scopePaths,"Material scope path");value.propositionPaths.forEach(v=>pointer(v,"proposition","Material proposition path"));value.scopePaths.forEach(v=>pointer(v,"scope","Material scope path"));}

export function defineEngineeringAssertionConflict(input:EngineeringAssertionConflict):EngineeringAssertionConflict{
  identity(input.conflictIdentity,"Conflict");assertion(input.firstAssertion,"First assertion");assertion(input.secondAssertion,"Second assertion");
  if(assertionKey(input.firstAssertion)===assertionKey(input.secondAssertion))throw new Error("Conflict requires two distinct assertion revisions.");
  if(!classifications.has(input.classification))throw new Error("Conflict classification is invalid.");
  if(!resolutionStates.has(input.resolutionState))throw new Error("Conflict resolution state is invalid.");
  const allowed=new Set([assertionKey(input.firstAssertion),assertionKey(input.secondAssertion)]);input.materialPaths.forEach(v=>validatePaths(v,allowed));unique(input.materialPaths.map(v=>assertionKey(v.assertion)),"Material-path assertion reference");
  if(input.classification==="direct_contradiction"&&!input.materialPaths.some(v=>v.propositionPaths.length>0))throw new Error("Direct contradiction requires a material proposition path.");
  if((input.classification==="scope_separated_compatibility"||input.classification==="conditional_compatibility")&&!input.materialPaths.some(v=>v.scopePaths.length>0))throw new Error("Scoped compatibility requires a material scope path.");
  validateEvidence(input.evidence);validateAuthority(input.authority);nonblank(input.rationale,"Conflict rationale");
  if(input.resolutionSuccessorAssertion!==null)assertion(input.resolutionSuccessorAssertion,"Conflict resolution successor");
  if(input.resolutionState==="unresolved"&&input.resolutionSuccessorAssertion!==null)throw new Error("Unresolved conflict cannot identify a resolution successor.");
  if(input.resolutionSuccessorAssertion!==null&&[assertionKey(input.firstAssertion),assertionKey(input.secondAssertion)].includes(assertionKey(input.resolutionSuccessorAssertion)))throw new Error("Conflict resolution successor must be a distinct revision.");
  if(!lifecycleStates.has(input.lifecycle.state))throw new Error("Conflict lifecycle state is invalid.");nonblank(input.lifecycle.lifecycleVersion,"Conflict lifecycle version");
  if(input.lifecycle.state==="superseded"&&input.lifecycle.supersededByConflictIdentity===null)throw new Error("Superseded conflict requires a successor conflict identity.");
  if(input.lifecycle.state!=="superseded"&&input.lifecycle.supersededByConflictIdentity!==null)throw new Error("Only a superseded conflict may identify its successor.");
  if(input.lifecycle.supersededByConflictIdentity)identity(input.lifecycle.supersededByConflictIdentity,"Successor conflict");validateProvenance(input.provenance);nonblank(input.contractVersion,"Conflict contract version");return cloneFreeze(input);
}

function validateScope(value:DeclarativeAssertionScope,expected:ExactEngineeringAssertionRevisionReference,field:string):void{nonblank(value.scopeId,`${field} identity`);assertion(value.assertion,`${field} assertion`);if(assertionKey(value.assertion)!==assertionKey(expected))throw new Error(`${field} must bind the predecessor assertion revision.`);unique(value.includedScopePaths,`${field} included path`);unique(value.excludedScopePaths,`${field} excluded path`);value.includedScopePaths.forEach(v=>pointer(v,"scope",`${field} included path`));value.excludedScopePaths.forEach(v=>pointer(v,"scope",`${field} excluded path`));if(value.includedScopePaths.length===0)throw new Error(`${field} requires an included scope path.`);nonblank(value.description,`${field} description`);}
export function defineEngineeringAssertionSupersession(input:EngineeringAssertionSupersession):EngineeringAssertionSupersession{
  identity(input.supersessionIdentity,"Supersession");assertion(input.predecessor,"Predecessor assertion");assertion(input.successor,"Successor assertion");if(assertionKey(input.predecessor)===assertionKey(input.successor))throw new Error("Supersession requires distinct predecessor and successor revisions.");
  if(input.kind!=="complete"&&input.kind!=="partial")throw new Error("Supersession kind is invalid.");validateScope(input.supersededScope,input.predecessor,"Superseded scope");
  if(input.kind==="complete"&&input.retainedScope!==null)throw new Error("Complete supersession cannot declare retained scope.");if(input.kind==="partial"&&input.retainedScope===null)throw new Error("Partial supersession requires explicit retained scope.");if(input.retainedScope)validateScope(input.retainedScope,input.predecessor,"Retained scope");
  if(input.retainedScope){const overlap=input.retainedScope.includedScopePaths.filter(v=>input.supersededScope.includedScopePaths.includes(v));if(overlap.length)throw new Error("Retained and superseded scope paths must be distinct.");}
  nonblank(input.scopeComparison.comparisonId,"Scope comparison identity");if(!["equivalent","predecessor_contains_successor","overlap","disjoint","unresolved"].includes(input.scopeComparison.basis))throw new Error("Scope comparison basis is invalid.");unique(input.scopeComparison.comparedScopePaths,"Compared scope path");input.scopeComparison.comparedScopePaths.forEach(v=>pointer(v,"scope","Compared scope path"));nonblank(input.scopeComparison.rationale,"Scope comparison rationale");
  if(input.kind==="complete"&&input.scopeComparison.basis!=="equivalent")throw new Error("Complete supersession requires equivalent admitted scope.");if(input.kind==="partial"&&input.scopeComparison.basis==="equivalent")throw new Error("Partial supersession cannot claim equivalent scope.");if((input.scopeComparison.basis==="overlap"||input.scopeComparison.basis==="unresolved")!== (input.scopeComparison.unresolvedOverlapConflictIdentity!==null))throw new Error("Unresolved scope overlap requires exactly one conflict identity.");if(input.scopeComparison.unresolvedOverlapConflictIdentity)identity(input.scopeComparison.unresolvedOverlapConflictIdentity,"Scope-overlap conflict");
  validateEvidence(input.evidence);validateAuthority(input.authority);if(input.evidence.length===0||input.authority.length===0)throw new Error("Supersession requires Evidence and authority.");nonblank(input.rationale,"Supersession rationale");
  nonblank(input.effectivePublication.publicationInstructionId,"Effective publication identity");nonblank(input.effectivePublication.publicationInstructionRevision,"Effective publication revision");digest(input.effectivePublication.publicationInstructionDigest,"Effective publication digest");nonblank(input.registrySnapshot.snapshotId,"Registry Snapshot identity");nonblank(input.registrySnapshot.snapshotRevision,"Registry Snapshot revision");digest(input.registrySnapshot.snapshotEnvelopeDigest,"Registry Snapshot digest");validateProvenance(input.provenance);nonblank(input.contractVersion,"Supersession contract version");return cloneFreeze(input);
}

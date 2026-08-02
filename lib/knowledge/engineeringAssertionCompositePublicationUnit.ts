import { createHash } from "node:crypto";
import type { AdmissionStableIdentity, PublicationOperation } from "./calibrationKnowledgeAdmission.ts";
import { canonicalizeDigestDomainPayload, type CanonicalDomainPayload, type ImmutableCanonicalByteSequence } from "./calibrationKnowledgeCanonicalSerialization.ts";
import type { PublicationSourceIdentity, RegistrySnapshotReference } from "./calibrationKnowledgePublicationSourceRegistrySnapshot.ts";

export type CompositePublicationEntityKind = "calibration_knowledge"|"engineering_assertion"|"assertion_membership"|"knowledge_relationship"|"assertion_conflict"|"assertion_supersession";
export type CompositeMemberRequirement = "required"|"optional"|"context_only";
export type CompositeMemberState = "included"|"withheld"|"blocking";
export type CompositeAtomicityPolicy = "all_required_or_none";
export type CompositeLifecycleEffect = "create"|"retain"|"amend"|"supersede"|"deprecate"|"reject"|"restore"|"record_dispute"|"resolve_conflict";

export type CompositeEntityRevisionReference = Readonly<{
  entityKind: CompositePublicationEntityKind; stableId:string; revision:string;
  canonicalPayloadDigest:string; revisionEnvelopeDigest:string|null;
  lifecycleIdentity:string; provenanceIdentityIds:readonly string[];
}>;
export type CompositeAdmissionDecisionReference = Readonly<{
  decisionIdentity:AdmissionStableIdentity; entity:CompositeEntityRevisionReference;
  authorisedOperation:PublicationOperation; lifecycleEffect:CompositeLifecycleEffect;
}>;
export type CanonicalAssertionMembershipRecord = Readonly<{
  membership:CompositeEntityRevisionReference; knowledge:CompositeEntityRevisionReference;
  assertion:CompositeEntityRevisionReference; role:string; requirement:"required"|"optional";
  admissionDecision:CompositeAdmissionDecisionReference;
}>;
export type CanonicalKnowledgeRelationshipRecord = Readonly<{
  relationship:CompositeEntityRevisionReference; source:CompositeEntityRevisionReference;
  target:CompositeEntityRevisionReference; direction:string; relationshipType:string;
  admissionDecision:CompositeAdmissionDecisionReference;
}>;
export type CompositePublicationMember = Readonly<{
  entity:CompositeEntityRevisionReference; requirement:CompositeMemberRequirement;
  state:CompositeMemberState; admissionDecision:CompositeAdmissionDecisionReference;
  dependencyEntityKeys:readonly string[]; withholdingReason:string|null; blockingReason:string|null;
}>;
export type CompositePublicationDependency = Readonly<{dependentEntityKey:string;requiredEntityKey:string;relationship:"membership"|"governed_relationship"|"conflict_context"|"supersession_lineage"|"publication_dependency"}>;
export type CompositePublicationUnitInput = Readonly<{
  unitId:string; unitRevision:string; unitDigest:string; contractVersion:string;
  publicationSource:PublicationSourceIdentity; predecessorSnapshot:RegistrySnapshotReference;
  operation:PublicationOperation; members:readonly CompositePublicationMember[];
  memberships:readonly CanonicalAssertionMembershipRecord[]; relationships:readonly CanonicalKnowledgeRelationshipRecord[];
  dependencies:readonly CompositePublicationDependency[]; atomicityPolicy:CompositeAtomicityPolicy;
}>;
export type CompositePublicationCanonicalPayload = Readonly<{payload:CanonicalDomainPayload;canonicalBytes:ImmutableCanonicalByteSequence;digest:string}>;
export type EngineeringAssertionCompositePublicationUnit = Readonly<CompositePublicationUnitInput & {
  entityCount:number; requiredEntityKeys:readonly string[]; optionalEntityKeys:readonly string[];
  withheldOptionalEntityKeys:readonly string[]; blockingEntityKeys:readonly string[];
  idempotencyIdentity:string; canonicalPayload:CompositePublicationCanonicalPayload;
}>;

const kinds=new Set<CompositePublicationEntityKind>(["calibration_knowledge","engineering_assertion","assertion_membership","knowledge_relationship","assertion_conflict","assertion_supersession"]);
const operations=new Set<PublicationOperation>(["register","enrich","correct","refine_applicability","add_evidence","record_dispute","resolve_conflict","supersede","deprecate","reject","restore"]);
function nonblank(v:string,f:string):void{if(!v.trim())throw new Error(`${f} is required.`);}
function digest(v:string,f:string):void{if(!/^sha256:[a-f0-9]{64}$/.test(v))throw new Error(`${f} must be a qualified lowercase SHA-256 digest.`);}
function identity(v:AdmissionStableIdentity,f:string):void{nonblank(v.id,`${f} identity`);nonblank(v.revision,`${f} revision`);if(!/^[a-z0-9][a-z0-9_-]*:[a-f0-9]{32,}$/i.test(v.contentDigest))throw new Error(`${f} digest is invalid.`);}
function compare(a:string,b:string):number{return a<b?-1:a>b?1:0;}
function unique(v:readonly string[],f:string):void{const s=new Set<string>();for(const x of v){nonblank(x,f);if(s.has(x))throw new Error(`${f} ${x} is duplicated.`);s.add(x);}}
function freeze<T>(v:T):T{if(Array.isArray(v))return Object.freeze(v.map(freeze)) as T;if(v!==null&&typeof v==="object"){const c:Record<PropertyKey,unknown>={};for(const k of Reflect.ownKeys(v))c[k]=freeze((v as Record<PropertyKey,unknown>)[k]);return Object.freeze(c) as T;}return v;}
export function compositeEntityKey(v:CompositeEntityRevisionReference):string{return [v.entityKind,v.stableId,v.revision,v.canonicalPayloadDigest,v.revisionEnvelopeDigest??""].join("\0");}
function validateEntity(v:CompositeEntityRevisionReference,f:string):void{if(!kinds.has(v.entityKind))throw new Error(`${f} kind is invalid.`);nonblank(v.stableId,`${f} stable identity`);nonblank(v.revision,`${f} revision`);digest(v.canonicalPayloadDigest,`${f} canonical payload digest`);if(v.revisionEnvelopeDigest!==null)digest(v.revisionEnvelopeDigest,`${f} revision-envelope digest`);nonblank(v.lifecycleIdentity,`${f} lifecycle identity`);unique(v.provenanceIdentityIds,`${f} provenance identity`);}
function validateDecision(v:CompositeAdmissionDecisionReference,entity:CompositeEntityRevisionReference):void{identity(v.decisionIdentity,"Admission Decision");if(compositeEntityKey(v.entity)!==compositeEntityKey(entity))throw new Error("Admission Decision does not bind the exact entity revision.");if(!operations.has(v.authorisedOperation))throw new Error("Admission Decision operation is invalid.");}
function domainDigest(bytes:ImmutableCanonicalByteSequence):string{const hash=createHash("sha256");hash.update(Buffer.from("tunesight.engineering-assertion.composite-publication-unit","utf8"));hash.update(Buffer.from([0]));hash.update(Buffer.from(bytes.bytes));return `sha256:${hash.digest("hex")}`;}
function canonicalMaterial(input:CompositePublicationUnitInput){return{unitId:input.unitId,unitRevision:input.unitRevision,contractVersion:input.contractVersion,publicationSource:{sourceId:input.publicationSource.sourceId,sourceRevision:input.publicationSource.sourceRevision,sourceEnvelopeDigest:input.publicationSource.sourceEnvelopeDigest},predecessorSnapshot:input.predecessorSnapshot,operation:input.operation,members:input.members,memberships:input.memberships,relationships:input.relationships,dependencies:input.dependencies,atomicityPolicy:input.atomicityPolicy};}
function canonicalEntity(v:CompositeEntityRevisionReference):CompositeEntityRevisionReference{return{...v,provenanceIdentityIds:[...v.provenanceIdentityIds].sort(compare)};}
function canonicalDecision(v:CompositeAdmissionDecisionReference):CompositeAdmissionDecisionReference{return{...v,entity:canonicalEntity(v.entity)};}
function canonicalInputFor(input:CompositePublicationUnitInput):CompositePublicationUnitInput{return freeze({...input,members:input.members.map(m=>({...m,entity:canonicalEntity(m.entity),admissionDecision:canonicalDecision(m.admissionDecision),dependencyEntityKeys:[...m.dependencyEntityKeys].sort(compare)})).sort((a,b)=>compare(compositeEntityKey(a.entity),compositeEntityKey(b.entity))),memberships:input.memberships.map(v=>({...v,membership:canonicalEntity(v.membership),knowledge:canonicalEntity(v.knowledge),assertion:canonicalEntity(v.assertion),admissionDecision:canonicalDecision(v.admissionDecision)})).sort((a,b)=>compare(compositeEntityKey(a.membership),compositeEntityKey(b.membership))),relationships:input.relationships.map(v=>({...v,relationship:canonicalEntity(v.relationship),source:canonicalEntity(v.source),target:canonicalEntity(v.target),admissionDecision:canonicalDecision(v.admissionDecision)})).sort((a,b)=>compare(compositeEntityKey(a.relationship),compositeEntityKey(b.relationship))),dependencies:[...input.dependencies].sort((a,b)=>compare(`${a.dependentEntityKey}\0${a.requiredEntityKey}\0${a.relationship}`,`${b.dependentEntityKey}\0${b.requiredEntityKey}\0${b.relationship}`))});}

export function defineEngineeringAssertionCompositePublicationUnit(input:CompositePublicationUnitInput):EngineeringAssertionCompositePublicationUnit{
  nonblank(input.unitId,"Composite publication-unit identity");nonblank(input.unitRevision,"Composite publication revision");digest(input.unitDigest,"Composite publication-unit digest");nonblank(input.contractVersion,"Composite publication contract version");
  nonblank(input.publicationSource.sourceId,"Publication source identity");nonblank(input.publicationSource.sourceRevision,"Publication source revision");digest(input.publicationSource.sourceEnvelopeDigest,"Publication source envelope digest");nonblank(input.predecessorSnapshot.snapshotId,"Predecessor Registry Snapshot identity");nonblank(input.predecessorSnapshot.snapshotRevision,"Predecessor Registry Snapshot revision");digest(input.predecessorSnapshot.snapshotEnvelopeDigest,"Predecessor Registry Snapshot digest");
  if(!operations.has(input.operation))throw new Error("Composite publication operation is invalid.");if(input.atomicityPolicy!=="all_required_or_none")throw new Error("Composite publication atomicity policy is invalid.");if(input.members.length===0)throw new Error("Composite publication unit requires members.");
  input.members.forEach(m=>{validateEntity(m.entity,"Composite member");validateDecision(m.admissionDecision,m.entity);unique(m.dependencyEntityKeys,"Member dependency");if(m.requirement==="required"&&m.state==="withheld")throw new Error("Required member cannot be withheld.");if(m.state==="withheld"&&(m.requirement!=="optional"||!m.withholdingReason?.trim()))throw new Error("Withheld member must be optional with an explicit reason.");if(m.state!=="withheld"&&m.withholdingReason!==null)throw new Error("Only withheld optional member may have a withholding reason.");if(m.state==="blocking"&&!m.blockingReason?.trim())throw new Error("Blocking member requires an explicit reason.");if(m.state!=="blocking"&&m.blockingReason!==null)throw new Error("Only blocking member may have a blocking reason.");});
  const memberKeys=input.members.map(m=>compositeEntityKey(m.entity));unique(memberKeys,"Composite member");const included=new Set(input.members.filter(m=>m.state==="included").map(m=>compositeEntityKey(m.entity)));const all=new Set(memberKeys);
  const knowledge=input.members.filter(m=>m.entity.entityKind==="calibration_knowledge"&&m.state==="included");if(knowledge.length!==1)throw new Error("Composite publication unit requires exactly one included Calibration Knowledge revision.");
  for(const m of input.members)for(const dependency of m.dependencyEntityKeys)if(!included.has(dependency))throw new Error(`Member ${compositeEntityKey(m.entity)} has dangling or unavailable dependency ${dependency}.`);
  unique(input.memberships.map(v=>compositeEntityKey(v.membership)),"Canonical membership");for(const v of input.memberships){validateEntity(v.membership,"Membership");validateEntity(v.knowledge,"Membership Knowledge");validateEntity(v.assertion,"Membership assertion");validateDecision(v.admissionDecision,v.membership);nonblank(v.role,"Membership role");if(v.membership.entityKind!=="assertion_membership"||v.knowledge.entityKind!=="calibration_knowledge"||v.assertion.entityKind!=="engineering_assertion")throw new Error("Canonical membership entity kinds are invalid.");if(!included.has(compositeEntityKey(v.membership))||!included.has(compositeEntityKey(v.knowledge))||!included.has(compositeEntityKey(v.assertion)))throw new Error("Canonical membership contains a dangling entity reference.");}
  unique(input.relationships.map(v=>compositeEntityKey(v.relationship)),"Canonical relationship");for(const v of input.relationships){validateEntity(v.relationship,"Relationship");validateEntity(v.source,"Relationship source");validateEntity(v.target,"Relationship target");validateDecision(v.admissionDecision,v.relationship);nonblank(v.direction,"Relationship direction");nonblank(v.relationshipType,"Relationship type");if(v.relationship.entityKind!=="knowledge_relationship")throw new Error("Canonical relationship kind is invalid.");if(!included.has(compositeEntityKey(v.relationship))||!included.has(compositeEntityKey(v.source))||!included.has(compositeEntityKey(v.target)))throw new Error("Canonical relationship contains a dangling entity reference.");}
  const requiredAssertionKeys=new Set(input.members.filter(m=>m.entity.entityKind==="engineering_assertion"&&m.requirement==="required"&&m.state==="included").map(m=>compositeEntityKey(m.entity)));const membershipAssertionKeys=new Set(input.memberships.filter(v=>v.requirement==="required").map(v=>compositeEntityKey(v.assertion)));for(const key of requiredAssertionKeys)if(!membershipAssertionKeys.has(key))throw new Error("Required assertion lacks its canonical required membership.");
  unique(input.dependencies.map(v=>`${v.dependentEntityKey}\0${v.requiredEntityKey}\0${v.relationship}`),"Dependency manifest entry");for(const v of input.dependencies)if(!all.has(v.dependentEntityKey)||!included.has(v.requiredEntityKey))throw new Error("Dependency manifest contains a dangling entity reference.");
  const canonicalInput=canonicalInputFor(input);
  const payload=canonicalizeDigestDomainPayload(canonicalMaterial(canonicalInput));const derived=domainDigest(payload.canonicalBytes);if(derived!==input.unitDigest)throw new Error("Composite publication-unit digest does not match canonical payload.");const idempotencyIdentity=`composite:${derived.slice(7)}`;
  const by=(requirement:CompositeMemberRequirement,state?:CompositeMemberState)=>canonicalInput.members.filter(m=>m.requirement===requirement&&(!state||m.state===state)).map(m=>compositeEntityKey(m.entity));
  return freeze({...canonicalInput,entityCount:canonicalInput.members.length,requiredEntityKeys:by("required"),optionalEntityKeys:by("optional"),withheldOptionalEntityKeys:by("optional","withheld"),blockingEntityKeys:canonicalInput.members.filter(m=>m.state==="blocking").map(m=>compositeEntityKey(m.entity)),idempotencyIdentity,canonicalPayload:{payload,canonicalBytes:payload.canonicalBytes,digest:derived}});
}

export function deriveCompositePublicationUnitDigest(input:Omit<CompositePublicationUnitInput,"unitDigest">):string{const normalized={...input,unitDigest:`sha256:${"0".repeat(64)}`};const payload=canonicalizeDigestDomainPayload(canonicalMaterial(canonicalInputFor(normalized)));return domainDigest(payload.canonicalBytes);}

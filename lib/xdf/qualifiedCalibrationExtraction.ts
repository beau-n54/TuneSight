import { createHash } from "node:crypto";
import type { EngineeringBinary } from "../tunes/binaryContainer.ts";
import { assessDefinitionExtractionCapability, createCalibrationValueExtractionBatchContext, extractRawCalibrationValues, type CalibrationValueExtractionBatchContext, type CalibrationValueExtractionEvidence } from "./calibrationValueExtraction.ts";
import { defineXdfDefinitionRevision, type XdfDefinitionRevision } from "./canonicalXdfDefinition.ts";
import type { DefinitionSetRevision, EngineeringBinaryIdentity } from "./definitionRomApplicability.ts";
import { verifyQualifiedBinaryLayoutMembership, type QualifiedBinaryToRomLayoutMembership } from "./binaryRomLayoutMembership.ts";
import { lookupActiveRomLayoutApplicability, type QualifiedRomLayoutApplicabilityRelationship, type RomLayoutApplicabilityRegistrySnapshot, type RomLayoutRegistryLookup } from "./romLayoutApplicabilityPublication.ts";

export const QUALIFIED_CALIBRATION_EXTRACTION_CONTRACT = "tunesight.qualified-calibration-extraction.v1" as const;

export type QualifiedCalibrationExtractionRequest = Readonly<{
  requestId: string;
  contractVersion: typeof QUALIFIED_CALIBRATION_EXTRACTION_CONTRACT;
  engineeringBinary: EngineeringBinary;
  binaryIdentity: EngineeringBinaryIdentity;
  romLayoutId: string;
  registrySnapshot: RomLayoutApplicabilityRegistrySnapshot;
  expectedRelationshipId: string;
  expectedRelationshipRevision: string;
  definitionSet: DefinitionSetRevision;
  definition: XdfDefinitionRevision;
  binaryLayoutMembership?: QualifiedBinaryToRomLayoutMembership | null;
  batchContext?: QualifiedCalibrationExtractionBatchContext;
}>;

export type QualifiedCalibrationExtractionBatchContext = Readonly<{
  exactBinaryDigest: string;
  engineeringBinary: EngineeringBinary;
  binaryIdentity: EngineeringBinaryIdentity;
  rawExtractionContext: CalibrationValueExtractionBatchContext;
}>;

export type QualifiedApplicabilityAuthorityChain = Readonly<{
  registrySnapshotId: string;
  relationshipId: string;
  relationshipRevision: string;
  romLayoutId: string;
  definitionSetId: string;
  definitionSetRevisionId: string;
  sourceArtifactId: string;
  sourceArtifactDigest: string;
  decisionId: string;
  decisionRevision: string;
  instructionId: string;
  instructionRevision: string;
  authorityPathway: QualifiedRomLayoutApplicabilityRelationship["authorityPathway"];
  qualificationProvenance: QualifiedRomLayoutApplicabilityRelationship["qualificationProvenance"];
  authorityProvenance: readonly string[];
  sourceProvenanceDisclosure: readonly string[];
  provenanceLimitations: readonly string[];
}>;

export type QualifiedRawCalibrationValueEvidence = Readonly<{
  evidenceId: string;
  evidenceRevision: string;
  contractVersion: "tunesight.qualified-raw-calibration-value-evidence.v1";
  outcome: "qualified_raw_extracted";
  exactBinaryDigest: string;
  exactBinaryIdentityId: string;
  romLayoutId: string;
  authorityChain: QualifiedApplicabilityAuthorityChain;
  definitionSetId: string;
  definitionSetRevisionId: string;
  definitionIdentity: string;
  definitionRevisionId: string;
  definitionSourceBindingDigest: string;
  exactRawOffsets: readonly number[];
  datatype: CalibrationValueExtractionEvidence["datatype"];
  widthBits: CalibrationValueExtractionEvidence["widthBits"];
  signed: boolean | null;
  endianness: CalibrationValueExtractionEvidence["endianness"];
  dimensions: Readonly<{ kind: "scalar" | "array_1d" | "table_2d"; rows: number; columns: number }>;
  rawValues: readonly number[];
  rawAxes: CalibrationValueExtractionEvidence["axes"];
  resolvedAddress: CalibrationValueExtractionEvidence["resolvedAddress"];
  inertEquationSources: readonly string[];
  rawExtractionContractVersion: CalibrationValueExtractionEvidence["contractVersion"];
  provenance: readonly string[];
}>;

export type QualifiedCalibrationExtractionResult =
  | Readonly<{ status: "qualified_extracted"; requestId: string; lookup: RomLayoutRegistryLookup; applicabilityRelationship: QualifiedRomLayoutApplicabilityRelationship; rawExtraction: CalibrationValueExtractionEvidence; evidence: QualifiedRawCalibrationValueEvidence }>
  | Readonly<{ status: "extraction_failed"; requestId: string; lookup: RomLayoutRegistryLookup; applicabilityRelationship: QualifiedRomLayoutApplicabilityRelationship; authorityChain: QualifiedApplicabilityAuthorityChain; rawExtraction: CalibrationValueExtractionEvidence; errorCode: "raw_extraction_failed"; explanation: string }>
  | Readonly<{ status: "rejected"; requestId: string; lookup: RomLayoutRegistryLookup; applicabilityRelationship: QualifiedRomLayoutApplicabilityRelationship | null; rawExtraction: null; errorCode: "binary_identity_mismatch" | "layout_unqualified" | "relationship_mismatch" | "binary_layout_membership_unqualified" | "definition_set_mismatch" | "definition_membership_invalid" | "definition_conflicting" | "definition_invalid" | "definition_extraction_unsupported"; explanation: string }>;

function canonical(value:unknown):string{if(value===null||typeof value==="boolean"||typeof value==="string")return JSON.stringify(value);if(typeof value==="number"){if(!Number.isFinite(value)||!Number.isSafeInteger(value))throw new Error("Qualified extraction identity contains an unsafe number.");return JSON.stringify(value);}if(Array.isArray(value))return`[${value.map(canonical).join(",")}]`;if(!value||typeof value!=="object")throw new Error("Qualified extraction identity contains an unsupported value.");const record=value as Readonly<Record<string,unknown>>;return`{${Object.keys(record).filter((key)=>record[key]!==undefined).sort().map((key)=>`${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;}
function digest(domain:string,value:unknown):string{return createHash("sha256").update(domain).update(Buffer.from([0])).update(canonical(value)).digest("hex");}
function freeze<T>(value:T):T{if(Array.isArray(value))return Object.freeze(value.map(freeze)) as T;if(value&&typeof value==="object"){const clone:Record<PropertyKey,unknown>={};for(const key of Reflect.ownKeys(value))clone[key]=freeze((value as Record<PropertyKey,unknown>)[key]);return Object.freeze(clone) as T;}return value;}
const verifiedBatchContexts = new WeakSet<object>();

export function createQualifiedCalibrationExtractionBatchContext(input:{engineeringBinary:EngineeringBinary;binaryIdentity:EngineeringBinaryIdentity}):QualifiedCalibrationExtractionBatchContext{
  const rawExtractionContext=createCalibrationValueExtractionBatchContext(input.engineeringBinary),exactBinaryDigest=rawExtractionContext.binaryIdentity.digest.slice("sha256:".length);
  if(exactBinaryDigest!==input.binaryIdentity.digest||input.binaryIdentity.byteLength!==input.engineeringBinary.byteLength||input.binaryIdentity.identityId!==`engineering-binary:${exactBinaryDigest}`)throw new Error("Engineering Binary bytes do not match the supplied exact Binary Identity.");
  const context=Object.freeze({exactBinaryDigest,engineeringBinary:input.engineeringBinary,binaryIdentity:input.binaryIdentity,rawExtractionContext});verifiedBatchContexts.add(context);return context;
}
function exactDigest(request:Pick<QualifiedCalibrationExtractionRequest,"engineeringBinary"|"binaryIdentity"|"batchContext">):string{
  const context=request.batchContext;
  return context&&verifiedBatchContexts.has(context)&&context.engineeringBinary===request.engineeringBinary&&context.binaryIdentity===request.binaryIdentity?context.exactBinaryDigest:createHash("sha256").update(request.engineeringBinary.bytes).digest("hex");
}

export function constructQualifiedCalibrationExtractionRequest(input:Omit<QualifiedCalibrationExtractionRequest,"requestId"|"contractVersion">):QualifiedCalibrationExtractionRequest{
  const digestValue=exactDigest(input);
  const requestId=`qualified-calibration-extraction-request:${digest("tunesight.qualified-calibration-extraction-request.v1",{exactBinaryDigest:digestValue,romLayoutId:input.romLayoutId,registrySnapshotId:input.registrySnapshot.snapshotId,expectedRelationshipId:input.expectedRelationshipId,expectedRelationshipRevision:input.expectedRelationshipRevision,definitionSetRevisionId:input.definitionSet.revisionId,definitionRevisionId:input.definition.revisionId,definitionSourceBindingDigest:input.definition.sourceBindingDigest,binaryLayoutMembershipRevision:input.binaryLayoutMembership?.membershipRevision??null})}`;
  return Object.freeze({requestId,contractVersion:QUALIFIED_CALIBRATION_EXTRACTION_CONTRACT,...input});
}

function authorityChain(snapshot:RomLayoutApplicabilityRegistrySnapshot,relationship:QualifiedRomLayoutApplicabilityRelationship):QualifiedApplicabilityAuthorityChain{return freeze({registrySnapshotId:snapshot.snapshotId,relationshipId:relationship.relationshipId,relationshipRevision:relationship.relationshipRevision,romLayoutId:relationship.romLayoutId,definitionSetId:relationship.definitionSetId,definitionSetRevisionId:relationship.definitionSetRevisionId,sourceArtifactId:relationship.sourceArtifactId,sourceArtifactDigest:relationship.sourceArtifactDigest,decisionId:relationship.decisionId,decisionRevision:relationship.decisionRevision,instructionId:relationship.instructionId,instructionRevision:relationship.instructionRevision,authorityPathway:relationship.authorityPathway,qualificationProvenance:relationship.qualificationProvenance,authorityProvenance:relationship.authorityProvenance,sourceProvenanceDisclosure:relationship.sourceProvenanceDisclosure,provenanceLimitations:relationship.provenanceLimitations});}
function rejected(request:QualifiedCalibrationExtractionRequest,lookup:RomLayoutRegistryLookup,relationship:QualifiedRomLayoutApplicabilityRelationship|null,errorCode:Extract<QualifiedCalibrationExtractionResult,{status:"rejected"}>["errorCode"],explanation:string):QualifiedCalibrationExtractionResult{return freeze({status:"rejected",requestId:request.requestId,lookup,applicabilityRelationship:relationship,rawExtraction:null,errorCode,explanation});}

export function extractQualifiedCalibrationValue(request:QualifiedCalibrationExtractionRequest):QualifiedCalibrationExtractionResult{
  const binaryBytes=request.engineeringBinary.bytes;const exactDigestValue=exactDigest(request);const lookup=lookupActiveRomLayoutApplicability(request.registrySnapshot,request.romLayoutId);
  if(exactDigestValue!==request.binaryIdentity.digest||request.binaryIdentity.byteLength!==binaryBytes.byteLength||request.binaryIdentity.identityId!==`engineering-binary:${exactDigestValue}`)return rejected(request,lookup,null,"binary_identity_mismatch","Engineering Binary bytes do not match the supplied exact Binary Identity.");
  if(lookup.outcome!=="exact_active")return rejected(request,lookup,null,"layout_unqualified",`Qualified ROM-layout lookup returned ${lookup.outcome}; exactly one active relationship is required.`);
  const relationship=lookup.relationships[0]!;
  if(relationship.relationshipId!==request.expectedRelationshipId||relationship.relationshipRevision!==request.expectedRelationshipRevision)return rejected(request,lookup,relationship,"relationship_mismatch","The active relationship does not match the exact relationship requested.");
  const binaryMembership=relationship.supportingExactBinaries.find((item)=>item.binaryDigest===exactDigestValue&&item.byteLength===binaryBytes.byteLength),historicallyAdmitted=Boolean(binaryMembership&&binaryMembership.internalRomIdentifiers.some((identifier)=>request.binaryIdentity.internalRomIdentifiers.includes(identifier))),newlyQualified=Boolean(request.binaryLayoutMembership&&verifyQualifiedBinaryLayoutMembership({membership:request.binaryLayoutMembership,binaryIdentity:request.binaryIdentity,romLayoutId:request.romLayoutId,relationship,definitionSet:request.definitionSet}));
  if(!historicallyAdmitted&&!newlyQualified)return rejected(request,lookup,relationship,"binary_layout_membership_unqualified","The exact Engineering Binary has neither historical subordinate Evidence nor a verified qualified binary-to-layout membership record.");
  if(relationship.definitionSetId!==request.definitionSet.definitionSetId||relationship.definitionSetRevisionId!==request.definitionSet.revisionId||relationship.sourceArtifactDigest!==request.definitionSet.sourceArtifactDigest)return rejected(request,lookup,relationship,"definition_set_mismatch","The Definition Set does not match the exact active qualified relationship.");
  const member=request.definitionSet.definitionRevisionIds.includes(request.definition.revisionId)&&request.definitionSet.definitionSourceBindingDigests.includes(request.definition.sourceBindingDigest)&&request.definition.sourceArtifactDigest===request.definitionSet.sourceArtifactDigest;
  if(!member)return rejected(request,lookup,relationship,"definition_membership_invalid","The Definition Revision is not a member of the exact qualified Definition Set Revision.");
  const {revisionId,structuralDigest,sourceBindingDigest,...definitionMaterial}=request.definition;const canonicalDefinition=defineXdfDefinitionRevision(definitionMaterial);if(canonicalDefinition.revisionId!==revisionId||canonicalDefinition.structuralDigest!==structuralDigest||canonicalDefinition.sourceBindingDigest!==sourceBindingDigest)return rejected(request,lookup,relationship,"definition_invalid","Definition Revision structural identity or source binding is invalid.");
  if(request.definition.identity.status==="conflicting")return rejected(request,lookup,relationship,"definition_conflicting","A representation-conflicted Definition cannot produce qualified raw Calibration Value Evidence.");
  if(request.definition.identity.status!=="derived"||!request.definition.identity.stableId)return rejected(request,lookup,relationship,"definition_invalid","The Definition Revision is not structurally valid for qualified extraction.");
  const capability=assessDefinitionExtractionCapability(request.definition);if(capability.state!=="extraction_capable")return rejected(request,lookup,relationship,"definition_extraction_unsupported",capability.reasons.join(" ")||"Definition is not extraction-capable.");
  const chain=authorityChain(request.registrySnapshot,relationship);const rawExtraction=extractRawCalibrationValues(request.engineeringBinary,request.definition,request.batchContext?.rawExtractionContext);
  if(rawExtraction.outcome!=="extracted"||!rawExtraction.shape||!rawExtraction.resolvedAddress)return freeze({status:"extraction_failed",requestId:request.requestId,lookup,applicabilityRelationship:relationship,authorityChain:chain,rawExtraction,errorCode:"raw_extraction_failed",explanation:rawExtraction.findings.join(" ")||`Raw extraction returned ${rawExtraction.outcome}.`});
  const inertEquationSources=[...new Set(request.definition.axes.map((axis)=>axis.equationSource).filter((value):value is string=>value!==null))].sort();const material={exactBinaryDigest:exactDigestValue,exactBinaryIdentityId:request.binaryIdentity.identityId,romLayoutId:relationship.romLayoutId,authorityChain:chain,definitionSetId:request.definitionSet.definitionSetId,definitionSetRevisionId:request.definitionSet.revisionId,definitionIdentity:request.definition.identity.stableId,definitionRevisionId:request.definition.revisionId,definitionSourceBindingDigest:request.definition.sourceBindingDigest,exactRawOffsets:rawExtraction.offsets,datatype:rawExtraction.datatype,widthBits:rawExtraction.widthBits,signed:rawExtraction.signed,endianness:rawExtraction.endianness,dimensions:{kind:rawExtraction.shape.kind,rows:rawExtraction.shape.rows,columns:rawExtraction.shape.columns},rawValues:rawExtraction.shape.values,rawAxes:rawExtraction.axes,resolvedAddress:rawExtraction.resolvedAddress,inertEquationSources,rawExtractionContractVersion:rawExtraction.contractVersion,provenance:[`Exact bytes: engineering-binary:${exactDigestValue}`,`Definition applicability: ${relationship.definitionSetRevisionId} -> ${relationship.romLayoutId}`,`Founder accepted Decision: ${relationship.decisionId}`,`Active qualified relationship: ${relationship.relationshipRevision}`].sort(),outcome:"qualified_raw_extracted" as const,contractVersion:"tunesight.qualified-raw-calibration-value-evidence.v1" as const};const evidenceId=`qualified-raw-calibration-evidence:${digest("tunesight.qualified-raw-calibration-evidence-identity.v1",{exactBinaryDigest:exactDigestValue,relationshipRevision:relationship.relationshipRevision,definitionRevisionId:request.definition.revisionId,definitionSourceBindingDigest:request.definition.sourceBindingDigest})}`;const evidence=freeze({evidenceId,evidenceRevision:`qualified-raw-calibration-evidence-revision:${digest("tunesight.qualified-raw-calibration-evidence-revision.v1",material)}`,...material});return freeze({status:"qualified_extracted",requestId:request.requestId,lookup,applicabilityRelationship:relationship,rawExtraction,evidence});
}

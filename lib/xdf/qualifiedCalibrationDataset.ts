import { createHash } from "node:crypto";
import type { InternalIdentityObservation } from "./applicabilityEvidenceProposal.ts";
import { assessDefinitionExtractionCapability } from "./calibrationValueExtraction.ts";
import type { XdfDefinitionRevision } from "./canonicalXdfDefinition.ts";
import {
  constructEngineeringValueConversionRequest,
  convertQualifiedCalibrationValue,
  ENGINEERING_VALUE_CONVERSION_CONTRACT,
  type QualifiedEngineeringCalibrationValueEvidence,
} from "./engineeringValueConversion.ts";
import {
  constructQualifiedCalibrationExtractionRequest,
  extractQualifiedCalibrationValue,
  QUALIFIED_CALIBRATION_EXTRACTION_CONTRACT,
  type QualifiedRawCalibrationValueEvidence,
} from "./qualifiedCalibrationExtraction.ts";
import {
  discoverAndQualifyBinaryRomLayout,
  constructRomLayoutDiscoveryRequest,
  ROM_LAYOUT_DISCOVERY_CONTRACT,
  type QualifiedRomLayoutDiscoveryRegistry,
  type RomLayoutDiscoveryResult,
  type RomLayoutMembershipAuthority,
} from "./romLayoutDiscovery.ts";
import type { QualifiedBinaryToRomLayoutMembership } from "./binaryRomLayoutMembership.ts";
import type { EngineeringBinary } from "../tunes/binaryContainer.ts";
import type { EngineeringBinaryIdentity } from "./definitionRomApplicability.ts";
import type { RomLayoutApplicabilityRegistrySnapshot } from "./romLayoutApplicabilityPublication.ts";

export const QUALIFIED_CALIBRATION_DATASET_CONTRACT = "tunesight.qualified-calibration-dataset.v1" as const;
export const QUALIFIED_CALIBRATION_DATASET_LIMITS = Object.freeze({ maximumDefinitions: 10_000, maximumCellsPerDefinition: 1_000_000 });

export type CalibrationDatasetSourceRole = "verified_stock" | "stock_candidate" | "reference" | "mapswitch" | "modified_candidate" | "user_modified" | "other_observed";
export type DatasetDefinitionUnavailableStage = "extraction" | "equation_parse" | "conversion" | "authority" | "structure" | "representation" | "other";
export type DatasetDefinitionState = "qualified_engineering_value" | "identity_conversion" | "extraction_unavailable" | "conversion_unsupported" | "malformed_conversion" | "invalid_numeric_conversion" | "missing_equation" | "representation_conflict" | "structurally_invalid" | "authority_unavailable" | "other_unavailable";

type DatasetDefinitionBase = Readonly<{
  definitionIdentity: string | null;
  definitionRevisionId: string;
  title: string | null;
  description: string | null;
  sourceArtifactDigest: string;
  sourceBindingDigest: string;
  state: DatasetDefinitionState;
  unavailableStage: DatasetDefinitionUnavailableStage | null;
  dimensions: Readonly<{ kind: "scalar" | "array_1d" | "table_2d"; rows: number; columns: number }> | null;
  units: string | null;
  findings: readonly string[];
  provenance: readonly string[];
}>;

export type AvailableCalibrationDatasetDefinition = DatasetDefinitionBase & Readonly<{
  state: "qualified_engineering_value" | "identity_conversion";
  unavailableStage: null;
  dimensions: NonNullable<DatasetDefinitionBase["dimensions"]>;
  rawEvidence: QualifiedRawCalibrationValueEvidence;
  engineeringEvidence: QualifiedEngineeringCalibrationValueEvidence;
}>;

export type UnavailableCalibrationDatasetDefinition = DatasetDefinitionBase & Readonly<{
  state: Exclude<DatasetDefinitionState, "qualified_engineering_value" | "identity_conversion">;
  unavailableStage: DatasetDefinitionUnavailableStage;
  rawEvidence: QualifiedRawCalibrationValueEvidence | null;
  engineeringEvidence: null;
}>;

export type CalibrationDatasetDefinition = AvailableCalibrationDatasetDefinition | UnavailableCalibrationDatasetDefinition;

export type QualifiedCalibrationDatasetSummary = Readonly<{
  totalDefinitions: number;
  availableQualifiedDefinitions: number;
  identityConversions: number;
  unavailableDefinitions: number;
  conflictedDefinitions: number;
  scalars: number;
  oneDimensionalTables: number;
  twoDimensionalTables: number;
  axesAvailable: number;
  unitsRepresented: readonly string[];
  equationFormsRepresented: readonly string[];
  findings: readonly string[];
}>;

export type QualifiedCalibrationDataset = Readonly<{
  datasetId: string;
  datasetRevision: string;
  contractVersion: typeof QUALIFIED_CALIBRATION_DATASET_CONTRACT;
  exactBinaryIdentity: EngineeringBinaryIdentity;
  sourceRole: CalibrationDatasetSourceRole;
  discoveryResultId: string;
  discoveryResultRevision: string;
  romLayoutId: string;
  discoveryRegistrySnapshotId: string;
  applicabilityRegistrySnapshotId: string;
  relationshipId: string;
  relationshipRevision: string;
  definitionSetId: string;
  definitionSetRevisionId: string;
  sourceArtifactId: string;
  sourceArtifactDigest: string;
  membershipId: string;
  membershipRevision: string;
  discoveryContractVersion: typeof ROM_LAYOUT_DISCOVERY_CONTRACT;
  extractionContractVersion: typeof QUALIFIED_CALIBRATION_EXTRACTION_CONTRACT;
  conversionContractVersion: typeof ENGINEERING_VALUE_CONVERSION_CONTRACT;
  definitions: readonly CalibrationDatasetDefinition[];
  summary: QualifiedCalibrationDatasetSummary;
  provenance: readonly string[];
  limitations: readonly string[];
  stockAuthenticity: "not_assessed";
  semanticKnowledge: "not_assessed";
  recommendation: "not_assessed";
}>;

export type QualifiedCalibrationDatasetRequest = Readonly<{
  requestId: string;
  requestRevision: string;
  contractVersion: "tunesight.qualified-calibration-dataset-materialization-request.v1";
  engineeringBinary: EngineeringBinary;
  binaryIdentity: EngineeringBinaryIdentity;
  observations: readonly InternalIdentityObservation[];
  discoveryRegistry: QualifiedRomLayoutDiscoveryRegistry;
  applicabilityRegistry: RomLayoutApplicabilityRegistrySnapshot;
  membershipAuthorities: readonly RomLayoutMembershipAuthority[];
  sourceRole: CalibrationDatasetSourceRole;
  sourceProvenance: readonly string[];
  independentlyQualifiedEcuFamily: string | null;
}>;

export type QualifiedCalibrationDatasetResult =
  | Readonly<{ status: "materialized" | "dataset_partial"; requestId: string; discovery: RomLayoutDiscoveryResult; membership: QualifiedBinaryToRomLayoutMembership; dataset: QualifiedCalibrationDataset }>
  | Readonly<{ status: "discovery_failed"; requestId: string; discovery: RomLayoutDiscoveryResult; membership: null; dataset: null; finding: string }>
  | Readonly<{ status: "membership_failed"; requestId: string; discovery: RomLayoutDiscoveryResult; membership: null; dataset: null; finding: string }>
  | Readonly<{ status: "authority_unavailable" | "invalid"; requestId: string; discovery: RomLayoutDiscoveryResult | null; membership: null; dataset: null; finding: string }>;

function canonical(value: unknown): string { if(value===null||typeof value==="boolean"||typeof value==="string")return JSON.stringify(value);if(typeof value==="number"){if(!Number.isFinite(value)||!Number.isSafeInteger(value))throw new Error("Dataset identity contains an unsafe number.");return JSON.stringify(value);}if(Array.isArray(value))return`[${value.map(canonical).join(",")}]`;if(!value||typeof value!=="object")throw new Error("Dataset identity contains unsupported material.");const record=value as Readonly<Record<string,unknown>>;return`{${Object.keys(record).filter((key)=>record[key]!==undefined).sort().map((key)=>`${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`; }
function digest(domain:string,value:unknown):string{return createHash("sha256").update(domain).update(Buffer.from([0])).update(canonical(value)).digest("hex");}
function freeze<T>(value:T):T{if(ArrayBuffer.isView(value))return value;if(Array.isArray(value))return Object.freeze(value.map(freeze)) as T;if(value&&typeof value==="object"){const clone:Record<PropertyKey,unknown>={};for(const key of Reflect.ownKeys(value))clone[key]=freeze((value as Record<PropertyKey,unknown>)[key]);return Object.freeze(clone) as T;}return value;}

export function constructQualifiedCalibrationDatasetRequest(input: Omit<QualifiedCalibrationDatasetRequest,"requestId"|"requestRevision"|"contractVersion">): QualifiedCalibrationDatasetRequest {
  const provenance=[...new Set(input.sourceProvenance.map((value)=>value.trim()).filter(Boolean))].sort(),identity={binaryDigest:input.binaryIdentity.digest,discoveryRegistrySnapshotId:input.discoveryRegistry.snapshotId,applicabilityRegistrySnapshotId:input.applicabilityRegistry.snapshotId,authorityRevisions:input.membershipAuthorities.map((value)=>[value.layout.layoutId,value.relationship.relationshipRevision,value.definitionSet.revisionId]).sort(),datasetContract:QUALIFIED_CALIBRATION_DATASET_CONTRACT},material={...identity,observationIds:input.observations.map((value)=>value.observationId).sort(),sourceRole:input.sourceRole,provenance,independentlyQualifiedEcuFamily:input.independentlyQualifiedEcuFamily?.trim().toUpperCase()??null};
  return freeze({requestId:`qualified-calibration-dataset-request:${digest("tunesight.qualified-calibration-dataset-request-identity.v1",identity)}`,requestRevision:`qualified-calibration-dataset-request-revision:${digest("tunesight.qualified-calibration-dataset-request-revision.v1",material)}`,contractVersion:"tunesight.qualified-calibration-dataset-materialization-request.v1",...input,sourceProvenance:provenance,independentlyQualifiedEcuFamily:material.independentlyQualifiedEcuFamily});
}

function unavailable(definition:XdfDefinitionRevision,state:UnavailableCalibrationDatasetDefinition["state"],stage:DatasetDefinitionUnavailableStage,findings:readonly string[],rawEvidence:QualifiedRawCalibrationValueEvidence|null=null):UnavailableCalibrationDatasetDefinition{return freeze({definitionIdentity:definition.identity.stableId,definitionRevisionId:definition.revisionId,title:definition.title,description:definition.description,sourceArtifactDigest:definition.sourceArtifactDigest,sourceBindingDigest:definition.sourceBindingDigest,state,unavailableStage:stage,dimensions:rawEvidence?.dimensions??null,units:null,rawEvidence,engineeringEvidence:null,findings:[...findings],provenance:[`Definition revision: ${definition.revisionId}`,`Definition source: ${definition.sourceArtifactDigest}`].sort()});}
export function classifyUnmaterializableDatasetDefinition(definition:XdfDefinitionRevision):UnavailableCalibrationDatasetDefinition|null{if(definition.identity.status==="conflicting")return unavailable(definition,"representation_conflict","representation",["Definition representation is conflicting; no representation was selected."]);if(definition.identity.status!=="derived")return unavailable(definition,"structurally_invalid","structure",[definition.identity.unresolvedReason??"Definition identity is structurally unresolved."]);const capability=assessDefinitionExtractionCapability(definition);return capability.state==="extraction_capable"?null:unavailable(definition,"structurally_invalid","structure",capability.reasons.length?capability.reasons:["Definition is not extraction-capable."]);}

function materializeDefinition(input:{request:QualifiedCalibrationDatasetRequest;authority:RomLayoutMembershipAuthority;membership:QualifiedBinaryToRomLayoutMembership;definition:XdfDefinitionRevision}):CalibrationDatasetDefinition{
  const {request,authority,membership,definition}=input;
  const preflight=classifyUnmaterializableDatasetDefinition(definition);if(preflight)return preflight;
  const extracted=extractQualifiedCalibrationValue(constructQualifiedCalibrationExtractionRequest({engineeringBinary:request.engineeringBinary,binaryIdentity:request.binaryIdentity,romLayoutId:authority.layout.layoutId,registrySnapshot:request.applicabilityRegistry,expectedRelationshipId:authority.relationship.relationshipId,expectedRelationshipRevision:authority.relationship.relationshipRevision,definitionSet:authority.definitionSet,definition,binaryLayoutMembership:membership}));
  if(extracted.status!=="qualified_extracted"){const stage=extracted.status==="rejected"?"authority":"extraction",state=extracted.status==="rejected"?"authority_unavailable":"extraction_unavailable";return unavailable(definition,state,stage,[extracted.explanation]);}
  const valueAxis=definition.axes.find((axis)=>axis.axisId.toLowerCase()==="z")??definition.axes.at(-1);if(!valueAxis?.equationSource)return unavailable(definition,"missing_equation","conversion",["Definition value equation is missing."],extracted.evidence);
  const converted=convertQualifiedCalibrationValue(constructEngineeringValueConversionRequest({rawEvidence:extracted.evidence,definition,expectedEquationSource:valueAxis.equationSource,expectedUnits:valueAxis.units}));
  if(converted.status!=="converted"){const state=converted.status==="unsupported_expression"?"conversion_unsupported":converted.status==="malformed_equation"?"malformed_conversion":converted.status==="invalid_numeric_result"?"invalid_numeric_conversion":converted.status==="missing_equation"?"missing_equation":"other_unavailable",stage=converted.status==="unsupported_expression"||converted.status==="malformed_equation"?"equation_parse":"conversion";return unavailable(definition,state,stage,[converted.finding],extracted.evidence);}
  const engineering=converted.evidence,state=engineering.valueEquation.outcome==="identity"?"identity_conversion" as const:"qualified_engineering_value" as const;
  return freeze({definitionIdentity:definition.identity.stableId,definitionRevisionId:definition.revisionId,title:definition.title,description:definition.description,sourceArtifactDigest:definition.sourceArtifactDigest,sourceBindingDigest:definition.sourceBindingDigest,state,unavailableStage:null,dimensions:engineering.dimensions,units:engineering.units,rawEvidence:extracted.evidence,engineeringEvidence:engineering,findings:engineering.conversionFindings,provenance:engineering.provenance});
}

function summarize(definitions:readonly CalibrationDatasetDefinition[]):QualifiedCalibrationDatasetSummary{const available=definitions.filter((value):value is AvailableCalibrationDatasetDefinition=>value.engineeringEvidence!==null),unavailable=definitions.length-available.length,units=[...new Set(available.map((value)=>value.units).filter((value):value is string=>value!==null))].sort(),equations=[...new Set(available.map((value)=>value.engineeringEvidence.valueEquation.canonicalSource))].sort(),findings=[...new Set(definitions.flatMap((value)=>value.findings))].sort();return freeze({totalDefinitions:definitions.length,availableQualifiedDefinitions:available.length,identityConversions:available.filter((value)=>value.state==="identity_conversion").length,unavailableDefinitions:unavailable,conflictedDefinitions:definitions.filter((value)=>value.state==="representation_conflict").length,scalars:available.filter((value)=>value.dimensions.kind==="scalar").length,oneDimensionalTables:available.filter((value)=>value.dimensions.kind==="array_1d").length,twoDimensionalTables:available.filter((value)=>value.dimensions.kind==="table_2d").length,axesAvailable:available.reduce((sum,value)=>sum+value.engineeringEvidence.axes.filter((axis)=>axis.outcome==="converted"||axis.outcome==="identity"||axis.outcome==="static_literal").length,0),unitsRepresented:units,equationFormsRepresented:equations,findings});}

export function materializeQualifiedCalibrationDataset(request:QualifiedCalibrationDatasetRequest):QualifiedCalibrationDatasetResult{
  if(!request.engineeringBinary.byteLength||request.membershipAuthorities.length===0||request.membershipAuthorities.length>QUALIFIED_CALIBRATION_DATASET_LIMITS.maximumDefinitions)return freeze({status:"invalid",requestId:request.requestId,discovery:null,membership:null,dataset:null,finding:"Dataset request is empty or outside bounded authority limits."});
  const discoveryRequest=constructRomLayoutDiscoveryRequest({engineeringBinary:request.engineeringBinary,binaryIdentity:request.binaryIdentity,observations:request.observations,qualifiedRegistry:request.discoveryRegistry,independentlyQualifiedEcuFamily:request.independentlyQualifiedEcuFamily,provenance:request.sourceProvenance}),orchestration=discoverAndQualifyBinaryRomLayout({request:discoveryRequest,membershipAuthorities:request.membershipAuthorities,credibleRomIdentifiers:request.observations.map((value)=>value.normalizedForm),sourceRole:request.sourceRole,sourceProvenance:request.sourceProvenance,qualifiedAt:null});
  if(orchestration.discovery.outcome==="invalid")return freeze({status:"invalid",requestId:request.requestId,discovery:orchestration.discovery,membership:null,dataset:null,finding:"ROM-layout discovery input is invalid."});
  if(orchestration.discovery.outcome!=="exact_candidate")return freeze({status:"discovery_failed",requestId:request.requestId,discovery:orchestration.discovery,membership:null,dataset:null,finding:`ROM-layout discovery returned ${orchestration.discovery.outcome}.`});
  if(!orchestration.membership||orchestration.membership.outcome!=="qualified_member")return freeze({status:"membership_failed",requestId:request.requestId,discovery:orchestration.discovery,membership:null,dataset:null,finding:`Binary-to-layout membership returned ${orchestration.membership?.outcome??"unavailable"}.`});
  const layoutId=orchestration.discovery.selectedRomLayoutId!,matches=request.membershipAuthorities.filter((value)=>value.layout.layoutId===layoutId);if(matches.length!==1)return freeze({status:"authority_unavailable",requestId:request.requestId,discovery:orchestration.discovery,membership:null,dataset:null,finding:"Exactly one Definition Set authority is required for the discovered layout."});
  const authority=matches[0]!,active=request.applicabilityRegistry.relationships.filter((value)=>value.lifecycleState==="active"&&value.romLayoutId===layoutId);if(active.length!==1||active[0]!.relationshipRevision!==authority.relationship.relationshipRevision||authority.definitionSet.definitionCount!==authority.definitions.length||authority.definitions.some((value)=>!authority.definitionSet.definitionRevisionIds.includes(value.revisionId)||value.sourceArtifactDigest!==authority.definitionSet.sourceArtifactDigest))return freeze({status:"authority_unavailable",requestId:request.requestId,discovery:orchestration.discovery,membership:null,dataset:null,finding:"Active relationship, exact Definition Set, and complete Definition source bindings are required."});
  const membership=orchestration.membership.membership,definitions=[...authority.definitions].sort((a,b)=>a.revisionId.localeCompare(b.revisionId)).map((definition)=>materializeDefinition({request,authority,membership,definition})),summary=summarize(definitions),identityMaterial={exactBinaryDigest:request.binaryIdentity.digest,romLayoutId:layoutId,relationshipRevision:authority.relationship.relationshipRevision,definitionSetRevisionId:authority.definitionSet.revisionId,discoveryContract:ROM_LAYOUT_DISCOVERY_CONTRACT,extractionContract:QUALIFIED_CALIBRATION_EXTRACTION_CONTRACT,conversionContract:ENGINEERING_VALUE_CONVERSION_CONTRACT,datasetContract:QUALIFIED_CALIBRATION_DATASET_CONTRACT},provenance=[...new Set([...request.sourceProvenance,orchestration.discovery.resultRevision,membership.membershipRevision])].sort(),limitations=["Dataset materialization does not establish Stock authenticity.","Definition titles and categories remain source metadata, not Calibration Knowledge semantics.","Calibration quality, safety, significance and recommendations are not assessed."];
  const material={...identityMaterial,discoveryResultRevision:orchestration.discovery.resultRevision,discoveryRegistrySnapshotId:request.discoveryRegistry.snapshotId,applicabilityRegistrySnapshotId:request.applicabilityRegistry.snapshotId,relationshipId:authority.relationship.relationshipId,definitionSetId:authority.definitionSet.definitionSetId,sourceArtifactId:authority.definitionSet.sourceArtifactId,sourceArtifactDigest:authority.definitionSet.sourceArtifactDigest,membershipRevision:orchestration.membership.membership.membershipRevision,definitionRecords:definitions.map((value)=>[value.definitionRevisionId,value.state,value.engineeringEvidence?.evidenceRevision??value.rawEvidence?.evidenceRevision??null,value.findings]),summary,provenance,limitations};
  const dataset=freeze({datasetId:`qualified-calibration-dataset:${digest("tunesight.qualified-calibration-dataset-identity.v1",identityMaterial)}`,datasetRevision:`qualified-calibration-dataset-revision:${digest("tunesight.qualified-calibration-dataset-revision.v1",material)}`,contractVersion:QUALIFIED_CALIBRATION_DATASET_CONTRACT,exactBinaryIdentity:request.binaryIdentity,sourceRole:request.sourceRole,discoveryResultId:orchestration.discovery.resultId,discoveryResultRevision:orchestration.discovery.resultRevision,romLayoutId:layoutId,discoveryRegistrySnapshotId:request.discoveryRegistry.snapshotId,applicabilityRegistrySnapshotId:request.applicabilityRegistry.snapshotId,relationshipId:authority.relationship.relationshipId,relationshipRevision:authority.relationship.relationshipRevision,definitionSetId:authority.definitionSet.definitionSetId,definitionSetRevisionId:authority.definitionSet.revisionId,sourceArtifactId:authority.definitionSet.sourceArtifactId,sourceArtifactDigest:authority.definitionSet.sourceArtifactDigest,membershipId:membership.membershipId,membershipRevision:membership.membershipRevision,discoveryContractVersion:ROM_LAYOUT_DISCOVERY_CONTRACT,extractionContractVersion:QUALIFIED_CALIBRATION_EXTRACTION_CONTRACT,conversionContractVersion:ENGINEERING_VALUE_CONVERSION_CONTRACT,definitions,summary,provenance,limitations,stockAuthenticity:"not_assessed" as const,semanticKnowledge:"not_assessed" as const,recommendation:"not_assessed" as const});
  return freeze({status:summary.unavailableDefinitions?"dataset_partial":"materialized",requestId:request.requestId,discovery:orchestration.discovery,membership,dataset});
}

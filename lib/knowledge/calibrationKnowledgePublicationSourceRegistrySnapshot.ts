import type {
  GovernedVocabularyReference,
  KnowledgeAuthorityReference,
  KnowledgeLifecycleStatus,
} from "./calibrationKnowledge.ts";
import type { PublicationOperation } from "./calibrationKnowledgeAdmission.ts";
import {
  canonicalizeDigestDomainPayload,
  deriveDomainSeparatedDigest,
  type CanonicalDomainPayload,
  type DomainSeparatedDigest,
} from "./calibrationKnowledgeCanonicalSerialization.ts";

export type PublicationSourceSupportState = "supported" | "unsupported" | "deprecated";
export type PublicationSourceLifecycleState = "active" | "inactive" | "deprecated" | "superseded" | "unavailable";
export type RegistrySnapshotLifecycleState = "active" | "deprecated" | "superseded";

export type PublicationSourcePolicyCompatibility = Readonly<{
  policyId: string;
  policyVersion: string;
}>;

export type PublicationSourceCapability = Readonly<{
  capabilityId: string;
  operation: PublicationOperation;
  supportState: PublicationSourceSupportState;
  contractRequirements: readonly string[];
  limitations: readonly string[];
  compatiblePolicies: readonly PublicationSourcePolicyCompatibility[];
}>;

export type PublicationSourceProvenanceReference = Readonly<{
  provenanceId: string;
  sourceType: string;
  sourceIdentifier: string;
  sourceRevisionOrigin: string;
  implementationOrigin: string | null;
  sourceContractId: string;
  sourceContractVersion: string;
  validationAuthority: string;
  transformationHistory: readonly string[];
}>;

export type PublicationSourceLifecycle = Readonly<{
  state: PublicationSourceLifecycleState;
  lifecycleVersion: string;
  supersededBySourceId: string | null;
  supersededBySourceRevision: string | null;
}>;

export type PublicationSourceIdentity = Readonly<{
  sourceId: string;
  sourceRevision: string;
  sourceContentDigest: string;
  sourceEnvelopeDigest: string;
  sourceType: GovernedVocabularyReference;
  sourceContractId: string;
  sourceContractVersion: string;
  authority: KnowledgeAuthorityReference;
  provenance: readonly PublicationSourceProvenanceReference[];
  lifecycle: PublicationSourceLifecycle;
  capabilities: readonly PublicationSourceCapability[];
  knownLimitations: readonly string[];
}>;

export type PublicationSourceIdentityInput = Omit<PublicationSourceIdentity, "sourceEnvelopeDigest"> & Readonly<{
  sourceEnvelopeDigest: string;
}>;

export type PublicationSourceEnvelopeDerivation = Readonly<{
  payload: CanonicalDomainPayload;
  digest: DomainSeparatedDigest;
}>;

export type RegistryRecordReference = Readonly<{
  stableKnowledgeId: string;
  knowledgeVersion: string;
  canonicalContentDigest: string;
  lifecycleState: KnowledgeLifecycleStatus;
}>;

export type RegistryRecordManifest = Readonly<{
  records: readonly RegistryRecordReference[];
}>;

export type RegistryRecordSetDerivation = Readonly<{
  manifest: RegistryRecordManifest;
  payload: CanonicalDomainPayload;
  digest: DomainSeparatedDigest;
}>;

export type PublicationReceiptReference = Readonly<{
  receiptId: string;
  receiptRevision: string;
  receiptDigest: string;
}>;

export type RegistrySnapshotReference = Readonly<{
  snapshotId: string;
  snapshotRevision: string;
  snapshotEnvelopeDigest: string;
}>;

export type RegistrySnapshotLifecycle = Readonly<{
  state: RegistrySnapshotLifecycleState;
  lifecycleVersion: string;
}>;

export type RegistrySnapshotIdentity = Readonly<{
  snapshotId: string;
  snapshotRevision: string;
  snapshotEnvelopeDigest: string;
  registryContractId: string;
  registryContractVersion: string;
  recordSetDigest: string;
  recordManifest: RegistryRecordManifest;
  recordCount: number;
  predecessorSnapshot: RegistrySnapshotReference | null;
  sourceReceiptReferences: readonly PublicationReceiptReference[];
  constructedAt: string;
  lifecycle: RegistrySnapshotLifecycle;
}>;

export type RegistrySnapshotIdentityInput = RegistrySnapshotIdentity & Readonly<{
  snapshotKind: "initial" | "successor";
}>;

export type RegistrySnapshotEnvelopeDerivation = Readonly<{
  payload: CanonicalDomainPayload;
  digest: DomainSeparatedDigest;
}>;

const publicationOperations = new Set<PublicationOperation>([
  "register", "enrich", "correct", "refine_applicability", "add_evidence",
  "record_dispute", "resolve_conflict", "supersede", "deprecate", "reject", "restore",
]);
const sourceSupportStates = new Set<PublicationSourceSupportState>(["supported", "unsupported", "deprecated"]);
const sourceLifecycleStates = new Set<PublicationSourceLifecycleState>(["active", "inactive", "deprecated", "superseded", "unavailable"]);
const snapshotLifecycleStates = new Set<RegistrySnapshotLifecycleState>(["active", "deprecated", "superseded"]);
const recordLifecycleStates = new Set<KnowledgeLifecycleStatus>(["active", "superseded", "deprecated", "rejected"]);

function requireNonBlank(value: string, field: string): void {
  if (!value.trim()) throw new Error(`${field} is required.`);
}

function requireDigest(value: string, field: string): void {
  if (!/^sha256:[a-f0-9]{64}$/.test(value)) throw new Error(`${field} must be a qualified lowercase SHA-256 digest.`);
}

function requireVersion(value: string, field: string): void {
  requireNonBlank(value, field);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) throw new Error(`${field} is invalid.`);
}

function requireCanonicalTimestamp(value: string, field: string): void {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString() !== value) throw new Error(`${field} must be canonical UTC RFC 3339.`);
}

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) return Object.freeze(value.map(deepFreeze)) as T;
  if (value !== null && typeof value === "object") {
    const clone: Record<PropertyKey, unknown> = {};
    for (const key of Reflect.ownKeys(value)) clone[key] = deepFreeze((value as Record<PropertyKey, unknown>)[key]);
    return Object.freeze(clone) as T;
  }
  return value;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function requireUnique(values: readonly string[], field: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    requireNonBlank(value, field);
    if (seen.has(value)) throw new Error(`${field} contains duplicate identity ${value}.`);
    seen.add(value);
  }
}

function canonicalStrings(values: readonly string[], field: string): readonly string[] {
  requireUnique(values, field);
  return [...values].sort(compareText);
}

function validateVocabulary(value: GovernedVocabularyReference): void {
  requireNonBlank(value.vocabularyId, "Source type vocabulary identity");
  requireVersion(value.vocabularyVersion, "Source type vocabulary version");
  requireNonBlank(value.termId, "Source type term identity");
  requireNonBlank(value.label, "Source type label");
  if (value.recognition !== "known") throw new Error("Publication source type must be a known governed term.");
}

function canonicalPolicies(values: readonly PublicationSourcePolicyCompatibility[]): readonly PublicationSourcePolicyCompatibility[] {
  const canonical = values.map((value) => {
    requireNonBlank(value.policyId, "Compatible policy identity");
    requireVersion(value.policyVersion, "Compatible policy version");
    return { policyId: value.policyId, policyVersion: value.policyVersion };
  }).sort((left, right) => compareText(left.policyId, right.policyId) || compareText(left.policyVersion, right.policyVersion));
  requireUnique(canonical.map((value) => `${value.policyId}\u0000${value.policyVersion}`), "Compatible policy");
  return canonical;
}

function canonicalCapabilities(values: readonly PublicationSourceCapability[]): readonly PublicationSourceCapability[] {
  const canonical = values.map((value) => {
    requireNonBlank(value.capabilityId, "Source capability identity");
    if (!publicationOperations.has(value.operation)) throw new Error("Source capability operation is unsupported.");
    if (!sourceSupportStates.has(value.supportState)) throw new Error("Source capability support state is invalid.");
    return {
      capabilityId: value.capabilityId,
      operation: value.operation,
      supportState: value.supportState,
      contractRequirements: canonicalStrings(value.contractRequirements, "Capability contract requirement"),
      limitations: canonicalStrings(value.limitations, "Capability limitation"),
      compatiblePolicies: canonicalPolicies(value.compatiblePolicies),
    };
  }).sort((left, right) => compareText(left.capabilityId, right.capabilityId));
  requireUnique(canonical.map((value) => value.capabilityId), "Source capability identity");
  const operations = new Map<PublicationOperation, string>();
  for (const capability of canonical) {
    const representation = canonicalizeDigestDomainPayload({
      supportState: capability.supportState,
      contractRequirements: capability.contractRequirements,
      limitations: capability.limitations,
      compatiblePolicies: capability.compatiblePolicies,
    }).canonicalJson;
    const previous = operations.get(capability.operation);
    if (previous !== undefined && previous !== representation) throw new Error(`Source capability operation ${capability.operation} is contradictory.`);
    operations.set(capability.operation, representation);
  }
  return canonical;
}

function canonicalProvenance(values: readonly PublicationSourceProvenanceReference[]): readonly PublicationSourceProvenanceReference[] {
  const canonical = values.map((value) => {
    requireNonBlank(value.provenanceId, "Source provenance identity");
    requireNonBlank(value.sourceType, "Source provenance type");
    requireNonBlank(value.sourceIdentifier, "Source provenance source identity");
    requireNonBlank(value.sourceRevisionOrigin, "Source revision origin");
    if (value.implementationOrigin !== null) requireNonBlank(value.implementationOrigin, "Source implementation origin");
    requireNonBlank(value.sourceContractId, "Source provenance contract identity");
    requireVersion(value.sourceContractVersion, "Source provenance contract version");
    requireNonBlank(value.validationAuthority, "Source provenance validation authority");
    return { ...value, transformationHistory: canonicalStrings(value.transformationHistory, "Source transformation history") };
  }).sort((left, right) => compareText(left.provenanceId, right.provenanceId));
  requireUnique(canonical.map((value) => value.provenanceId), "Source provenance identity");
  return canonical;
}

function canonicalSourceLifecycle(value: PublicationSourceLifecycle): PublicationSourceLifecycle {
  if (!sourceLifecycleStates.has(value.state)) throw new Error("Publication source lifecycle state is invalid.");
  requireVersion(value.lifecycleVersion, "Publication source lifecycle version");
  if ((value.supersededBySourceId === null) !== (value.supersededBySourceRevision === null)) throw new Error("Publication source supersession identity and revision must be supplied together.");
  if (value.state === "superseded" && value.supersededBySourceId === null) throw new Error("Superseded publication source requires its successor identity.");
  if (value.state !== "superseded" && value.supersededBySourceId !== null) throw new Error("Only a superseded publication source may identify a successor.");
  if (value.supersededBySourceId !== null) requireNonBlank(value.supersededBySourceId, "Successor source identity");
  if (value.supersededBySourceRevision !== null) requireVersion(value.supersededBySourceRevision, "Successor source revision");
  return { ...value };
}

function sourceEnvelopeMaterial(input: Omit<PublicationSourceIdentity, "sourceEnvelopeDigest">): Readonly<Record<string, unknown>> {
  return {
    sourceId: input.sourceId,
    sourceRevision: input.sourceRevision,
    sourceContentDigest: input.sourceContentDigest,
    sourceType: input.sourceType,
    sourceContractId: input.sourceContractId,
    sourceContractVersion: input.sourceContractVersion,
    authority: input.authority,
    provenance: input.provenance,
    lifecycle: input.lifecycle,
    capabilities: input.capabilities,
    knownLimitations: input.knownLimitations,
  };
}

function canonicalSourceMaterial(input: Omit<PublicationSourceIdentity, "sourceEnvelopeDigest">): Omit<PublicationSourceIdentity, "sourceEnvelopeDigest"> {
  requireNonBlank(input.sourceId, "Publication source stable identity");
  requireVersion(input.sourceRevision, "Publication source revision");
  requireDigest(input.sourceContentDigest, "Publication source content digest");
  validateVocabulary(input.sourceType);
  requireNonBlank(input.sourceContractId, "Publication source contract identity");
  requireVersion(input.sourceContractVersion, "Publication source contract version");
  requireNonBlank(input.authority.authorityType, "Publication source authority type");
  requireNonBlank(input.authority.authorityIdentifier, "Publication source authority identity");
  if (input.provenance.length === 0) throw new Error("Publication source requires provenance.");
  return deepFreeze({
    ...input,
    provenance: canonicalProvenance(input.provenance),
    lifecycle: canonicalSourceLifecycle(input.lifecycle),
    capabilities: canonicalCapabilities(input.capabilities),
    knownLimitations: canonicalStrings(input.knownLimitations, "Publication source limitation"),
  });
}

export function derivePublicationSourceEnvelope(input: Omit<PublicationSourceIdentity, "sourceEnvelopeDigest">): PublicationSourceEnvelopeDerivation {
  const material = canonicalSourceMaterial(input);
  const payload = canonicalizeDigestDomainPayload(sourceEnvelopeMaterial(material));
  const digest = deriveDomainSeparatedDigest(payload.canonicalBytes, "publication_source_identity");
  return deepFreeze({ payload, digest });
}

export function definePublicationSourceIdentity(input: PublicationSourceIdentityInput): PublicationSourceIdentity {
  requireDigest(input.sourceEnvelopeDigest, "Publication source envelope digest");
  const { sourceEnvelopeDigest, ...materialInput } = input;
  const material = canonicalSourceMaterial(materialInput);
  const derived = derivePublicationSourceEnvelope(material);
  if (sourceEnvelopeDigest !== derived.digest.qualifiedDigest) throw new Error("Publication source envelope digest does not match its canonical source material.");
  return deepFreeze({ ...material, sourceEnvelopeDigest });
}

export function defineRegistryRecordReference(input: RegistryRecordReference): RegistryRecordReference {
  requireNonBlank(input.stableKnowledgeId, "Registry record stable Knowledge identity");
  requireVersion(input.knowledgeVersion, "Registry record Knowledge version");
  requireDigest(input.canonicalContentDigest, "Registry record content digest");
  if (!recordLifecycleStates.has(input.lifecycleState)) throw new Error("Registry record lifecycle state is invalid.");
  return deepFreeze(input);
}

function recordKey(value: RegistryRecordReference): string {
  return `${value.stableKnowledgeId}\u0000${value.knowledgeVersion}\u0000${value.canonicalContentDigest}`;
}

export function defineRegistryRecordManifest(records: readonly RegistryRecordReference[]): RegistryRecordManifest {
  const canonical = records.map(defineRegistryRecordReference).sort((left, right) => compareText(left.stableKnowledgeId, right.stableKnowledgeId) || compareText(left.knowledgeVersion, right.knowledgeVersion) || compareText(left.canonicalContentDigest, right.canonicalContentDigest));
  requireUnique(canonical.map(recordKey), "Registry record reference");
  const versions = new Map<string, string>();
  for (const record of canonical) {
    const identityVersion = `${record.stableKnowledgeId}\u0000${record.knowledgeVersion}`;
    const representation = `${record.canonicalContentDigest}\u0000${record.lifecycleState}`;
    const previous = versions.get(identityVersion);
    if (previous !== undefined && previous !== representation) throw new Error(`Registry record identity and version ${record.stableKnowledgeId}@${record.knowledgeVersion} are conflicting.`);
    versions.set(identityVersion, representation);
  }
  return deepFreeze({ records: canonical });
}

export function deriveRegistryRecordSet(records: readonly RegistryRecordReference[]): RegistryRecordSetDerivation {
  const manifest = defineRegistryRecordManifest(records);
  const payload = canonicalizeDigestDomainPayload(manifest);
  const digest = deriveDomainSeparatedDigest(payload.canonicalBytes, "registry_record_set_manifest");
  return deepFreeze({ manifest, payload, digest });
}

export function definePublicationReceiptReference(input: PublicationReceiptReference): PublicationReceiptReference {
  requireNonBlank(input.receiptId, "Publication receipt stable identity");
  requireVersion(input.receiptRevision, "Publication receipt revision");
  requireDigest(input.receiptDigest, "Publication receipt digest");
  return deepFreeze(input);
}

function canonicalReceiptReferences(values: readonly PublicationReceiptReference[]): readonly PublicationReceiptReference[] {
  const canonical = values.map(definePublicationReceiptReference).sort((left, right) => compareText(left.receiptId, right.receiptId) || compareText(left.receiptRevision, right.receiptRevision) || compareText(left.receiptDigest, right.receiptDigest));
  requireUnique(canonical.map((value) => `${value.receiptId}\u0000${value.receiptRevision}\u0000${value.receiptDigest}`), "Publication receipt reference");
  const revisions = new Map<string, string>();
  for (const receipt of canonical) {
    const identityRevision = `${receipt.receiptId}\u0000${receipt.receiptRevision}`;
    const previous = revisions.get(identityRevision);
    if (previous !== undefined && previous !== receipt.receiptDigest) throw new Error(`Publication receipt identity and revision ${receipt.receiptId}@${receipt.receiptRevision} are conflicting.`);
    revisions.set(identityRevision, receipt.receiptDigest);
  }
  return canonical;
}

function validateSnapshotReference(value: RegistrySnapshotReference): void {
  requireNonBlank(value.snapshotId, "Predecessor snapshot identity");
  requireVersion(value.snapshotRevision, "Predecessor snapshot revision");
  requireDigest(value.snapshotEnvelopeDigest, "Predecessor snapshot envelope digest");
}

function canonicalSnapshotLifecycle(value: RegistrySnapshotLifecycle): RegistrySnapshotLifecycle {
  if (!snapshotLifecycleStates.has(value.state)) throw new Error("Registry snapshot lifecycle state is invalid.");
  requireVersion(value.lifecycleVersion, "Registry snapshot lifecycle version");
  return { ...value };
}

function snapshotEnvelopeMaterial(input: Omit<RegistrySnapshotIdentity, "snapshotEnvelopeDigest" | "recordManifest">): Readonly<Record<string, unknown>> {
  return {
    snapshotId: input.snapshotId,
    snapshotRevision: input.snapshotRevision,
    registryContractId: input.registryContractId,
    registryContractVersion: input.registryContractVersion,
    recordSetDigest: input.recordSetDigest,
    recordCount: input.recordCount,
    predecessorSnapshot: input.predecessorSnapshot,
    sourceReceiptReferences: input.sourceReceiptReferences,
    constructedAt: input.constructedAt,
    lifecycle: input.lifecycle,
  };
}

export function deriveRegistrySnapshotEnvelope(input: Omit<RegistrySnapshotIdentity, "snapshotEnvelopeDigest" | "recordManifest">): RegistrySnapshotEnvelopeDerivation {
  requireNonBlank(input.snapshotId, "Registry snapshot stable identity");
  requireVersion(input.snapshotRevision, "Registry snapshot revision");
  requireNonBlank(input.registryContractId, "Registry contract identity");
  requireVersion(input.registryContractVersion, "Registry contract version");
  requireDigest(input.recordSetDigest, "Registry record-set digest");
  if (!Number.isSafeInteger(input.recordCount) || input.recordCount < 0) throw new Error("Registry snapshot record count is invalid.");
  if (input.predecessorSnapshot !== null) validateSnapshotReference(input.predecessorSnapshot);
  const canonical = deepFreeze({
    ...input,
    predecessorSnapshot: input.predecessorSnapshot === null ? null : { ...input.predecessorSnapshot },
    sourceReceiptReferences: canonicalReceiptReferences(input.sourceReceiptReferences),
    constructedAt: new Date(input.constructedAt).toISOString(),
    lifecycle: canonicalSnapshotLifecycle(input.lifecycle),
  });
  requireCanonicalTimestamp(input.constructedAt, "Registry snapshot construction timestamp");
  const payload = canonicalizeDigestDomainPayload(snapshotEnvelopeMaterial(canonical));
  const digest = deriveDomainSeparatedDigest(payload.canonicalBytes, "registry_snapshot_envelope");
  return deepFreeze({ payload, digest });
}

export function defineRegistrySnapshotIdentity(input: RegistrySnapshotIdentityInput): RegistrySnapshotIdentity {
  requireNonBlank(input.snapshotId, "Registry snapshot stable identity");
  requireVersion(input.snapshotRevision, "Registry snapshot revision");
  requireDigest(input.snapshotEnvelopeDigest, "Registry snapshot envelope digest");
  requireNonBlank(input.registryContractId, "Registry contract identity");
  requireVersion(input.registryContractVersion, "Registry contract version");
  requireDigest(input.recordSetDigest, "Registry record-set digest");
  requireCanonicalTimestamp(input.constructedAt, "Registry snapshot construction timestamp");
  const recordSet = deriveRegistryRecordSet(input.recordManifest.records);
  if (recordSet.digest.qualifiedDigest !== input.recordSetDigest) throw new Error("Registry record-set digest does not match its canonical manifest.");
  if (input.recordCount !== recordSet.manifest.records.length) throw new Error("Registry snapshot record count does not match its canonical manifest.");
  const predecessor = input.predecessorSnapshot === null ? null : deepFreeze(input.predecessorSnapshot);
  if (input.snapshotKind === "initial" && predecessor !== null) throw new Error("Initial registry snapshot cannot declare a predecessor.");
  if (input.snapshotKind === "successor" && predecessor === null) throw new Error("Successor registry snapshot requires a predecessor.");
  if (predecessor !== null) {
    validateSnapshotReference(predecessor);
    if (predecessor.snapshotId === input.snapshotId) throw new Error("Predecessor snapshot identity must differ from the current snapshot identity.");
  }
  const receipts = canonicalReceiptReferences(input.sourceReceiptReferences);
  const lifecycle = canonicalSnapshotLifecycle(input.lifecycle);
  const envelope = deriveRegistrySnapshotEnvelope({
    snapshotId: input.snapshotId,
    snapshotRevision: input.snapshotRevision,
    registryContractId: input.registryContractId,
    registryContractVersion: input.registryContractVersion,
    recordSetDigest: input.recordSetDigest,
    recordCount: input.recordCount,
    predecessorSnapshot: predecessor,
    sourceReceiptReferences: receipts,
    constructedAt: input.constructedAt,
    lifecycle,
  });
  if (envelope.digest.qualifiedDigest !== input.snapshotEnvelopeDigest) throw new Error("Registry snapshot envelope digest does not match its canonical snapshot material.");
  return deepFreeze({
    snapshotId: input.snapshotId,
    snapshotRevision: input.snapshotRevision,
    snapshotEnvelopeDigest: input.snapshotEnvelopeDigest,
    registryContractId: input.registryContractId,
    registryContractVersion: input.registryContractVersion,
    recordSetDigest: input.recordSetDigest,
    recordManifest: recordSet.manifest,
    recordCount: input.recordCount,
    predecessorSnapshot: predecessor,
    sourceReceiptReferences: receipts,
    constructedAt: input.constructedAt,
    lifecycle,
  });
}

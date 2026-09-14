import { FOUNDER_00003076501103_ACTIVE_RELATIONSHIP, FOUNDER_00003076501103_ROM_LAYOUT_REGISTRY } from "../xdf/b58PhysicalAcceptedPublication.ts";
import { FOUNDER_00003076501103_DEFINITION_SET, FOUNDER_00003076501103_DEFINITIONS, FOUNDER_00003076501103_ROM_LAYOUT } from "../xdf/b58PhysicalPublicationCandidate.ts";
import { FOUNDER_00003076501103_INJECTOR_SCALAR_QUARANTINE } from "../xdf/b58PhysicalTableQuarantine.ts";
import { N54_CURRENT_ROM_LAYOUT_REGISTRY } from "../xdf/n54GovernedApplicabilityAdmission.ts";
import { constructQualifiedRomLayoutDiscoveryRegistry, type RomLayoutMembershipAuthority } from "../xdf/romLayoutDiscovery.ts";
import { constructN54RepositoryDefinitionDescriptor, N54_REPOSITORY_IDENTITIES } from "./n54RepositoryDefinitionAdapter.ts";
import type { DefinitionCatalog, DefinitionCatalogEntry, DefinitionCatalogIdentity } from "./masterCalibrationResolver.ts";
import { BulkViewAdmissionCatalog } from "./bulkViewAdmissionCatalog.ts";

const B58_GEN1 = ["00003076501103", "00003076501D02", "000030765A3C06", "000030765A5005", "00003081501102", "00003081501D04", "00007972000705"] as const;
const B58_GEN2 = ["00005D55289606", "00005D5528AA06", "00005D5528B405", "00005D5528BE07", "00005D5528BE09", "00005D55327806", "00005D55328C05", "00005D55329606", "00005D5532BE07", "00005D5532BE09", "00005D5532C808", "00005D5532DC05", "00005D5532E605", "00005D553C6405", "00005D553C6E05", "00005D553C7805", "00005D553C7807", "00005D553C8207", "00005D553C8C05", "00005D553C9607", "00005D553CA007", "00005D553CA009", "00005D553CAA08", "00005D553CBE05", "00005D553CC805", "00005D55461E08", "00005D55463208", "00005D55463C07", "00005D55464605", "00005D55465005", "00005D55465A07", "00005D55465A09", "00005D55466408", "00005D55467805", "00005D55468205", "00005D55502807", "00005D55503705", "00005D55503C05", "00005D55504807", "00005D55504809", "00005D5550480C", "00005D55505008", "00005D55506405", "00005D55506406", "00005D55508C05"] as const;

const identity = (romSoftwareIdentity: string, family: string, ecuDmeFamily: string | null, encodings: DefinitionCatalogIdentity["encodings"], markerProfile: DefinitionCatalogIdentity["markerProfile"] = null): DefinitionCatalogIdentity => Object.freeze({ romSoftwareIdentity, family, ecuDmeFamily, encodings: Object.freeze([...encodings]), markerProfile });

const baseIdentities: readonly DefinitionCatalogIdentity[] = Object.freeze([
  ...N54_REPOSITORY_IDENTITIES.map((rom) => identity(rom, "N54", rom === "I8A0S" ? "MSD80" : "MSD81", ["ascii"])),
  ...B58_GEN1.map((rom) => identity(rom, "B58gen1", rom === "00003076501103" ? "MG1" : null, ["ascii", "hex_encoded"], Object.freeze({ identity: rom, detector: "bounded_hex_encoded_exact" as const, requiredOffsets: Object.freeze([262469, 6814977, 7863823]) }))),
  ...B58_GEN2.map((rom) => identity(rom, "B58gen2", null, ["ascii", "hex_encoded"], Object.freeze({ identity: rom, detector: "bounded_hex_encoded_exact" as const, requiredOffsets: Object.freeze([524613, 7339265, 8388111]) }))),
]);
const bulkIdentities = BulkViewAdmissionCatalog.listIdentities();
const identities: readonly DefinitionCatalogIdentity[] = Object.freeze([...new Map([...baseIdentities, ...bulkIdentities].map((item) => [item.romSoftwareIdentity, item])).values()]);

let cachedEntries: readonly DefinitionCatalogEntry[] | null = null;

function entries(): readonly DefinitionCatalogEntry[] {
  if (cachedEntries) return cachedEntries;
  const n54Descriptors = N54_REPOSITORY_IDENTITIES.map((rom) => constructN54RepositoryDefinitionDescriptor(rom));
  const n54DiscoveryRegistry = constructQualifiedRomLayoutDiscoveryRegistry({ authoritySnapshot: N54_CURRENT_ROM_LAYOUT_REGISTRY, layouts: n54Descriptors.map((item) => item.layout) });
  const n54Entries = n54Descriptors.map((descriptor): DefinitionCatalogEntry => {
    const authority: RomLayoutMembershipAuthority = { layout: descriptor.layout, relationship: descriptor.relationship, definitionSet: descriptor.source.set, definitions: descriptor.source.definitions };
    const rom = descriptor.identity;
    return Object.freeze({
      catalogEntryId: `repository-definition:${descriptor.relationship.relationshipRevision}`,
      sourceKind: "repository",
      lifecycleState: "active",
      sourceAuthorityState: "qualified",
      applicabilityState: "published",
      identity: identities.find((item) => item.romSoftwareIdentity === rom)!,
      coverageCandidate: Object.freeze({ candidateId: `n54-qualified-coverage:${rom}`, family: "N54", romSoftwareIdentity: rom, calibrationIdentity: rom, sourceArtifactId: descriptor.source.set.sourceArtifactId, sourceArtifactRevision: descriptor.source.set.sourceArtifactDigest, definitionSetRevision: descriptor.source.set.revisionId, coverageState: "exact_qualified", exactIdentityEvidence: Object.freeze([descriptor.relationship.relationshipRevision]), provenance: Object.freeze(["Published exact current N54 governed relationship"]), limitations: Object.freeze(["Applicability is limited to the exact published ROM/software identity."]) }),
      authority,
      discoveryRegistry: n54DiscoveryRegistry,
      applicabilityRegistry: N54_CURRENT_ROM_LAYOUT_REGISTRY,
      quarantines: Object.freeze([]),
      referenceCapability: Object.freeze({ state: "authoritative_reference_available", datasetInput: Object.freeze({ engineeringBinary: descriptor.referenceBinary.engineering, binaryIdentity: descriptor.referenceBinary.identity, observations: descriptor.referenceBinary.observations, sourceRole: "stock_candidate", sourceProvenance: Object.freeze(["Published exact N54 governed relationship", "Governed Reference capability input"]) }) }),
    });
  });
  const b58Authority: RomLayoutMembershipAuthority = { layout: FOUNDER_00003076501103_ROM_LAYOUT, relationship: FOUNDER_00003076501103_ACTIVE_RELATIONSHIP, definitionSet: FOUNDER_00003076501103_DEFINITION_SET, definitions: FOUNDER_00003076501103_DEFINITIONS };
  const b58DiscoveryRegistry = constructQualifiedRomLayoutDiscoveryRegistry({ authoritySnapshot: FOUNDER_00003076501103_ROM_LAYOUT_REGISTRY, layouts: [FOUNDER_00003076501103_ROM_LAYOUT] });
  const rom = "00003076501103";
  const b58Entry: DefinitionCatalogEntry = Object.freeze({
    catalogEntryId: `repository-definition:${FOUNDER_00003076501103_ACTIVE_RELATIONSHIP.relationshipRevision}`,
    sourceKind: "repository",
    lifecycleState: "active",
    sourceAuthorityState: "qualified",
    applicabilityState: "published",
    identity: identities.find((item) => item.romSoftwareIdentity === rom)!,
    coverageCandidate: Object.freeze({ candidateId: `b58-gen1-qualified-coverage:${rom}`, family: "B58gen1", romSoftwareIdentity: rom, calibrationIdentity: rom, sourceArtifactId: FOUNDER_00003076501103_DEFINITION_SET.sourceArtifactId, sourceArtifactRevision: FOUNDER_00003076501103_DEFINITION_SET.sourceArtifactDigest, definitionSetRevision: FOUNDER_00003076501103_DEFINITION_SET.revisionId, coverageState: "exact_qualified", exactIdentityEvidence: Object.freeze([FOUNDER_00003076501103_ACTIVE_RELATIONSHIP.relationshipRevision]), provenance: Object.freeze(["Published exact quarantine-aware B58 Gen1 relationship"]), limitations: Object.freeze(["Applicability is limited to exact ROM/software 00003076501103.", "Authoritative Stock/Reference status is not established."]) }),
    authority: b58Authority,
    discoveryRegistry: b58DiscoveryRegistry,
    applicabilityRegistry: FOUNDER_00003076501103_ROM_LAYOUT_REGISTRY,
    quarantines: Object.freeze([FOUNDER_00003076501103_INJECTOR_SCALAR_QUARANTINE]),
    referenceCapability: Object.freeze({ state: "reference_unavailable" }),
  });
  cachedEntries = Object.freeze([...n54Entries, b58Entry, ...BulkViewAdmissionCatalog.listEntries()]);
  return cachedEntries;
}

export const RepositoryDefinitionCatalog: DefinitionCatalog = Object.freeze({
  catalogId: "repository-definition-catalog:active-governed-publications-v1",
  listIdentities: () => identities,
  listEntries: () => entries(),
});

export function findRepositoryIdentity(romSoftwareIdentity: string | null): DefinitionCatalogIdentity | null {
  if (!romSoftwareIdentity) return null;
  return identities.find((item) => item.romSoftwareIdentity === romSoftwareIdentity.toUpperCase()) ?? null;
}

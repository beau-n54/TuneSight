import fs from "node:fs";
import path from "node:path";
import { collectInternalIdentityObservations, type InternalIdentityObservation } from "../xdf/applicabilityEvidenceProposal.ts";
import type { XdfDefinitionRevision } from "../xdf/canonicalXdfDefinition.ts";
import { defineDefinitionSetRevision, identifyEngineeringBinary, type DefinitionSetRevision, type EngineeringBinaryIdentity } from "../xdf/definitionRomApplicability.ts";
import { interpretXdfStructure } from "../xdf/interpretXdfStructure.ts";
import { N54_CURRENT_GOVERNED_REVIEW_REFERENCES, N54_CURRENT_ROM_LAYOUT_REGISTRY } from "../xdf/n54GovernedApplicabilityAdmission.ts";
import { defineRomLayoutIdentity, type RomLayoutIdentity, type RomLayoutMarker } from "../xdf/romLayoutApplicability.ts";
import { resolveBinaryContainer, type EngineeringBinary } from "../tunes/binaryContainer.ts";

export const N54_REPOSITORY_IDENTITIES = ["I8A0S", "IJE0S", "IKM0S", "INA0S"] as const;
export type N54RepositoryIdentity = (typeof N54_REPOSITORY_IDENTITIES)[number];

type ExactBinary = Readonly<{ engineering: EngineeringBinary; identity: EngineeringBinaryIdentity; observations: readonly InternalIdentityObservation[]; markers: readonly RomLayoutMarker[] }>;
type Source = Readonly<{ definitions: readonly XdfDefinitionRevision[]; set: DefinitionSetRevision }>;
export type N54RepositoryDefinitionDescriptor = Readonly<{ identity: N54RepositoryIdentity; source: Source; referenceBinary: ExactBinary; layout: RomLayoutIdentity; relationship: (typeof N54_CURRENT_ROM_LAYOUT_REGISTRY.relationships)[number] }>;

const root = path.resolve("BMW-XDFs-master/N54");
const cache = new Map<N54RepositoryIdentity, N54RepositoryDefinitionDescriptor>();

function parseSource(identity: N54RepositoryIdentity): Source {
  const fileName = `${identity}.xdf`;
  const parsed = interpretXdfStructure({ xml: fs.readFileSync(path.join(root, fileName), "utf8"), filename: fileName, provenance: "Repository-controlled governed N54 Definition source" });
  if (parsed.outcome !== "structurally_interpreted" || !parsed.sourceArtifact) throw new Error("Governed N54 Definition source could not be interpreted.");
  return Object.freeze({ definitions: parsed.definitions, set: defineDefinitionSetRevision({ sourceArtifact: parsed.sourceArtifact, definitions: parsed.definitions }) });
}

function loadReference(identity: N54RepositoryIdentity): ExactBinary {
  const fileName = `${identity}_original.bin`, resolved = resolveBinaryContainer({ bytes: fs.readFileSync(path.join(root, fileName)), fileName });
  if (resolved.status !== "resolved") throw new Error("Governed N54 Reference capability binary could not be resolved.");
  const engineering = resolved.engineeringBinary;
  const observations = collectInternalIdentityObservations({ binaryBytes: engineering.bytes, credibleIdentifiers: N54_REPOSITORY_IDENTITIES.map((identifier) => ({ identifier, kind: "ascii_rom_marker" as const, confidence: "known_identity" as const, reason: "Governed N54 identity vocabulary", encodings: ["ascii" as const] })) });
  const binaryIdentity = identifyEngineeringBinary({ engineeringBinary: engineering, romFamily: "N54", softwareIdentity: identity, internalRomIdentifiers: observations.map((item) => item.normalizedForm), identityProvenance: ["Published exact N54 governed relationship"] });
  const markers = observations.filter((item) => item.normalizedForm === identity).map((item) => ({ kind: item.kind, normalizedForm: item.normalizedForm, offsets: item.offsets, detector: item.detector }));
  return Object.freeze({ engineering, identity: binaryIdentity, observations, markers: Object.freeze(markers) });
}

export function constructN54RepositoryDefinitionDescriptor(identity: N54RepositoryIdentity): N54RepositoryDefinitionDescriptor {
  const cached = cache.get(identity);
  if (cached) return cached;
  const source = parseSource(identity), referenceBinary = loadReference(identity), addresses = source.definitions.map((item) => item.primaryAddress).filter((item): item is number => item !== null), region = source.definitions[0]?.addressSpace.regions[0];
  if (!region || !addresses.length) throw new Error("Governed N54 Definition source has no qualified address space.");
  const layout = defineRomLayoutIdentity({ romSoftwareIdentifiers: [identity], calibrationSoftwareIdentifiers: [identity], ecuDmeFamily: identity === "I8A0S" ? "MSD80" : "MSD81", binaryByteLength: referenceBinary.identity.byteLength, containerTypes: [referenceBinary.identity.containerType], internalMarkers: referenceBinary.markers, calibrationAddressSpace: [{ startAddress: region.startAddress, size: region.size }], definitionCompatibleAddressRange: { minimum: Math.min(...addresses), maximum: Math.max(...addresses) }, xdfSideIdentities: [identity], evidenceProvenance: ["Accepted current N54 governed layout evidence"] });
  const review = N54_CURRENT_GOVERNED_REVIEW_REFERENCES.find((item) => item.identity === identity)?.review;
  const relationship = N54_CURRENT_ROM_LAYOUT_REGISTRY.relationships.find((item) => item.romLayoutId === layout.layoutId);
  if (!review || !relationship || source.set.revisionId !== review.definitionSetRevisionId || source.set.sourceArtifactDigest !== review.sourceArtifactDigest) throw new Error("Repository N54 Definition material differs from governed publication.");
  const descriptor = Object.freeze({ identity, source, referenceBinary, layout, relationship });
  cache.set(identity, descriptor);
  return descriptor;
}

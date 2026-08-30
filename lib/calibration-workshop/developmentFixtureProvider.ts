import fs from "node:fs";
import path from "node:path";
import { collectInternalIdentityObservations, type InternalIdentityObservation } from "../xdf/applicabilityEvidenceProposal.ts";
import type { XdfDefinitionRevision } from "../xdf/canonicalXdfDefinition.ts";
import { defineDefinitionSetRevision, identifyEngineeringBinary, type DefinitionSetRevision, type EngineeringBinaryIdentity } from "../xdf/definitionRomApplicability.ts";
import { interpretXdfStructure } from "../xdf/interpretXdfStructure.ts";
import { N54_CURRENT_GOVERNED_REVIEW_REFERENCES, N54_CURRENT_ROM_LAYOUT_REGISTRY } from "../xdf/n54GovernedApplicabilityAdmission.ts";
import { compareQualifiedCalibrationDatasets, constructQualifiedCalibrationDatasetComparisonRequest, QUALIFIED_CALIBRATION_COMPARISON_CONTRACT } from "../xdf/qualifiedCalibrationComparison.ts";
import { constructQualifiedCalibrationDatasetRequest, materializeQualifiedCalibrationDataset, QUALIFIED_CALIBRATION_DATASET_CONTRACT, type QualifiedCalibrationDataset } from "../xdf/qualifiedCalibrationDataset.ts";
import { defineRomLayoutIdentity, type RomLayoutIdentity, type RomLayoutMarker } from "../xdf/romLayoutApplicability.ts";
import { constructQualifiedRomLayoutDiscoveryRegistry, constructRomLayoutDiscoveryRequest, discoverAndQualifyBinaryRomLayout, ROM_LAYOUT_DISCOVERY_CONTRACT, type RomLayoutMembershipAuthority } from "../xdf/romLayoutDiscovery.ts";
import { resolveBinaryContainer, type EngineeringBinary } from "../tunes/binaryContainer.ts";
import { buildWorkshopViewModel, type WorkshopViewModel } from "./viewModel.ts";

export type ExactBinary = Readonly<{
  engineering: EngineeringBinary;
  identity: EngineeringBinaryIdentity;
  observations: readonly InternalIdentityObservation[];
  markers: readonly RomLayoutMarker[];
}>;

type FixtureMaterial = Readonly<{
  descriptor: N54PreviewFixtureDescriptor;
  reference: QualifiedCalibrationDataset;
  current: QualifiedCalibrationDataset;
  comparison: ReturnType<typeof compareQualifiedCalibrationDatasets>;
}>;

export interface CalibrationWorkshopProvider {
  loadVehicleWorkshop(
    vehicleId: string,
    userId: string,
    selectedDefinition?: string | null,
    previewRom?: N54PreviewRom,
  ): Promise<WorkshopViewModel>;
}

const ROOT = path.resolve("BMW-XDFs-master/N54");
const VOCABULARY = ["I8A0S", "IJE0S", "IKM0S", "INA0S"] as const;
export type N54PreviewRom = (typeof VOCABULARY)[number];
export const DEFAULT_N54_PREVIEW_ROM: N54PreviewRom = "IJE0S";

type N54PreviewFixtureConfiguration = Readonly<{
  identity: N54PreviewRom;
  xdfFile: string;
  referenceFile: string;
  modifiedFile: string;
  referenceRole: "stock_candidate";
  modifiedRole: "mapswitch";
  fixtureIdentity: string;
  provenance: readonly string[];
  limitations: readonly string[];
}>;

const CONFIGURATIONS: Readonly<Record<N54PreviewRom, N54PreviewFixtureConfiguration>> = Object.freeze({
  I8A0S: Object.freeze({ identity: "I8A0S", xdfFile: "I8A0S.xdf", referenceFile: "I8A0S_original.bin", modifiedFile: "I8A0S_MapSwitchBase.bin", referenceRole: "stock_candidate", modifiedRole: "mapswitch", fixtureIdentity: "n54-i8a0s-original-mapswitch-v1", provenance: Object.freeze(["Controlled I8A0S Workshop development fixture"]), limitations: Object.freeze(["This controlled fixture is not derived from the selected vehicle.", "Original is a Stock Candidate, not Verified Stock."]) }),
  IJE0S: Object.freeze({ identity: "IJE0S", xdfFile: "IJE0S.xdf", referenceFile: "IJE0S_original.bin", modifiedFile: "IJE0S_MapSwitchBase.bin", referenceRole: "stock_candidate", modifiedRole: "mapswitch", fixtureIdentity: "n54-ije0s-original-mapswitch-v1", provenance: Object.freeze(["Controlled IJE0S Workshop development fixture"]), limitations: Object.freeze(["This controlled fixture is not derived from the selected vehicle.", "Original is a Stock Candidate, not Verified Stock."]) }),
  IKM0S: Object.freeze({ identity: "IKM0S", xdfFile: "IKM0S.xdf", referenceFile: "IKM0S_original.bin", modifiedFile: "IKM0S_MapSwitchBase.bin", referenceRole: "stock_candidate", modifiedRole: "mapswitch", fixtureIdentity: "n54-ikm0s-original-mapswitch-v1", provenance: Object.freeze(["Controlled IKM0S Workshop development fixture"]), limitations: Object.freeze(["This controlled fixture is not derived from the selected vehicle.", "Original is a Stock Candidate, not Verified Stock."]) }),
  INA0S: Object.freeze({ identity: "INA0S", xdfFile: "INA0S.xdf", referenceFile: "INA0S_original.bin", modifiedFile: "INA0S_MapSwitchBase.bin", referenceRole: "stock_candidate", modifiedRole: "mapswitch", fixtureIdentity: "n54-ina0s-original-mapswitch-v1", provenance: Object.freeze(["Controlled INA0S Workshop development fixture"]), limitations: Object.freeze(["This controlled fixture is not derived from the selected vehicle.", "Original is a Stock Candidate, not Verified Stock."]) }),
});

export type N54PreviewSelection = Readonly<{ status: "valid"; rom: N54PreviewRom }> | Readonly<{ status: "invalid"; requested: string }>;

export function selectN54PreviewRom(value?: string | null): N54PreviewSelection {
  if (value === undefined || value === null || value === "") return Object.freeze({ status: "valid", rom: DEFAULT_N54_PREVIEW_ROM });
  return (VOCABULARY as readonly string[]).includes(value)
    ? Object.freeze({ status: "valid", rom: value as N54PreviewRom })
    : Object.freeze({ status: "invalid", requested: value });
}

function parseSource(configuration: N54PreviewFixtureConfiguration): Readonly<{ definitions: readonly XdfDefinitionRevision[]; set: DefinitionSetRevision }> {
  const filename = configuration.xdfFile;
  const result = interpretXdfStructure({
    xml: fs.readFileSync(path.join(ROOT, filename), "utf8"),
    filename,
    provenance: "Controlled Calibration Workshop development fixture",
  });
  if (result.outcome !== "structurally_interpreted" || !result.sourceArtifact) {
    throw new Error("Workshop fixture XDF could not be structurally interpreted.");
  }
  return Object.freeze({
    definitions: result.definitions,
    set: defineDefinitionSetRevision({ sourceArtifact: result.sourceArtifact, definitions: result.definitions }),
  });
}

function exactBinary(identity: N54PreviewRom, fileName: string): ExactBinary {
  const resolved = resolveBinaryContainer({ bytes: fs.readFileSync(path.join(ROOT, fileName)), fileName });
  if (resolved.status !== "resolved") throw new Error(`Workshop fixture ${fileName} could not be resolved.`);
  const engineering = resolved.engineeringBinary;
  const observations = collectInternalIdentityObservations({
    binaryBytes: engineering.bytes,
    credibleIdentifiers: VOCABULARY.map((identifier) => ({
      identifier,
      kind: "ascii_rom_marker" as const,
      confidence: "known_identity" as const,
      reason: "Governed N54 Workshop fixture vocabulary",
      encodings: ["ascii" as const],
    })),
  });
  const binaryIdentity = identifyEngineeringBinary({
    engineeringBinary: engineering,
    romFamily: "N54",
    softwareIdentity: identity,
    internalRomIdentifiers: observations.map((value) => value.normalizedForm),
    identityProvenance: ["Controlled Workshop exact binary fixture"],
  });
  const markers = observations
    .filter((value) => value.normalizedForm === identity)
    .map((value) => ({ kind: value.kind, normalizedForm: value.normalizedForm, offsets: value.offsets, detector: value.detector }));
  return Object.freeze({ engineering, identity: binaryIdentity, observations, markers: Object.freeze(markers) });
}

function fixtureLayout(identity: N54PreviewRom, source: ReturnType<typeof parseSource>, original: ExactBinary): RomLayoutIdentity {
  const addresses = source.definitions.map((value) => value.primaryAddress).filter((value): value is number => value !== null);
  const region = source.definitions[0]?.addressSpace.regions[0];
  if (!region || addresses.length === 0) throw new Error("Workshop fixture has no qualified address space.");
  const layout = defineRomLayoutIdentity({
    romSoftwareIdentifiers: [identity],
    calibrationSoftwareIdentifiers: [identity],
    ecuDmeFamily: identity === "I8A0S" ? "MSD80" : "MSD81",
    binaryByteLength: original.identity.byteLength,
    containerTypes: [original.identity.containerType],
    internalMarkers: original.markers,
    calibrationAddressSpace: [{ startAddress: region.startAddress, size: region.size }],
    definitionCompatibleAddressRange: { minimum: Math.min(...addresses), maximum: Math.max(...addresses) },
    xdfSideIdentities: [identity],
    evidenceProvenance: ["Accepted current N54 governed layout evidence"],
  });
  const expected = N54_CURRENT_GOVERNED_REVIEW_REFERENCES.find((item) => item.identity === identity)?.review.romLayoutId;
  if (layout.layoutId !== expected) throw new Error(`Workshop fixture layout differs from governed ${identity} authority.`);
  return layout;
}

export function constructWorkshopDiscoveryRegistry(layouts: readonly RomLayoutIdentity[]) {
  return constructQualifiedRomLayoutDiscoveryRegistry({
    authoritySnapshot: N54_CURRENT_ROM_LAYOUT_REGISTRY,
    layouts,
  });
}

export type N54PreviewFixtureDescriptor = Readonly<{
  configuration: N54PreviewFixtureConfiguration;
  source: ReturnType<typeof parseSource>;
  referenceBinary: ExactBinary;
  modifiedBinary: ExactBinary;
  layout: RomLayoutIdentity;
  relationship: (typeof N54_CURRENT_ROM_LAYOUT_REGISTRY.relationships)[number];
  cacheKey: string;
}>;

const fixtureDescriptorCache = new Map<N54PreviewRom, N54PreviewFixtureDescriptor>();

export function constructN54PreviewFixtureDescriptor(identity: N54PreviewRom): N54PreviewFixtureDescriptor {
  const cached = fixtureDescriptorCache.get(identity);
  if (cached) return cached;
  const configuration = CONFIGURATIONS[identity];
  const source = parseSource(configuration);
  const referenceBinary = exactBinary(identity, configuration.referenceFile);
  const modifiedBinary = exactBinary(identity, configuration.modifiedFile);
  const layout = fixtureLayout(identity, source, referenceBinary);
  const review = N54_CURRENT_GOVERNED_REVIEW_REFERENCES.find((item) => item.identity === identity)?.review;
  const relationship = N54_CURRENT_ROM_LAYOUT_REGISTRY.relationships.find((value) => value.romLayoutId === layout.layoutId);
  if (!review || !relationship) throw new Error(`Workshop fixture ${identity} has no active governed relationship.`);
  if (source.set.revisionId !== review.definitionSetRevisionId || source.set.sourceArtifactDigest !== review.sourceArtifactDigest) throw new Error(`Workshop fixture ${identity} Definition source differs from governed authority.`);
  for (const binary of [referenceBinary, modifiedBinary]) if (binary.identity.softwareIdentity !== identity) throw new Error(`Workshop fixture ${identity} contains a mismatched binary identity.`);
  const cacheKey = [QUALIFIED_CALIBRATION_DATASET_CONTRACT, QUALIFIED_CALIBRATION_COMPARISON_CONTRACT, ROM_LAYOUT_DISCOVERY_CONTRACT, N54_CURRENT_ROM_LAYOUT_REGISTRY.snapshotId, layout.layoutId, source.set.revisionId, source.set.sourceArtifactDigest, referenceBinary.identity.digest, modifiedBinary.identity.digest].join("|");
  const descriptor = Object.freeze({ configuration, source, referenceBinary, modifiedBinary, layout, relationship, cacheKey });
  fixtureDescriptorCache.set(identity, descriptor);
  return descriptor;
}

export function assertN54PreviewFixtureDescriptor(descriptor: N54PreviewFixtureDescriptor): void {
  const identity = descriptor.configuration.identity;
  if (descriptor.referenceBinary.identity.softwareIdentity !== identity || descriptor.modifiedBinary.identity.softwareIdentity !== identity) throw new Error(`Workshop fixture ${identity} contains a mismatched binary identity.`);
  if (!descriptor.layout.romSoftwareIdentifiers.includes(identity) || descriptor.relationship.romLayoutId !== descriptor.layout.layoutId || descriptor.relationship.definitionSetRevisionId !== descriptor.source.set.revisionId) throw new Error(`Workshop fixture ${identity} descriptor chain differs from governed authority.`);
}

const fixtureMaterialCache = new Map<string, Promise<FixtureMaterial>>();

async function materializeFixture(descriptor: N54PreviewFixtureDescriptor): Promise<FixtureMaterial> {
  const profile = process.env.TUNESIGHT_WORKSHOP_PROFILE === "1";
  const timings: Record<string, number> = {};
  let mark = performance.now();
  const record = (name: string) => {
    const now = performance.now();
    timings[name] = Math.round(now - mark);
    mark = now;
  };
  assertN54PreviewFixtureDescriptor(descriptor);
  const cohort = VOCABULARY.map((identity) => constructN54PreviewFixtureDescriptor(identity));
  record("authorityLayoutAssemblyMs");
  const { source, referenceBinary, modifiedBinary: currentBinary, layout, relationship, configuration } = descriptor;
  const authority: RomLayoutMembershipAuthority = { layout, relationship, definitionSet: source.set, definitions: source.definitions };
  const discoveryRegistry = constructWorkshopDiscoveryRegistry(cohort.map((item) => item.layout));
  record("discoveryRegistryAssemblyMs");
  const profileDiscovery = (binary: ExactBinary, sourceRole: "stock_candidate" | "mapswitch") => {
    if (!profile) return;
    const request = constructRomLayoutDiscoveryRequest({
      engineeringBinary: binary.engineering,
      binaryIdentity: binary.identity,
      observations: binary.observations,
      qualifiedRegistry: discoveryRegistry,
      independentlyQualifiedEcuFamily: null,
      provenance: ["Controlled Workshop performance diagnostic"],
    });
    discoverAndQualifyBinaryRomLayout({
      request,
      membershipAuthorities: [authority],
      credibleRomIdentifiers: VOCABULARY,
      sourceRole,
      sourceProvenance: ["Controlled Workshop performance diagnostic"],
      qualifiedAt: null,
    });
  };
  const materialize = (binary: ExactBinary, sourceRole: "stock_candidate" | "mapswitch") => {
    const result = materializeQualifiedCalibrationDataset(constructQualifiedCalibrationDatasetRequest({
      engineeringBinary: binary.engineering,
      binaryIdentity: binary.identity,
      observations: binary.observations,
      discoveryRegistry,
      applicabilityRegistry: N54_CURRENT_ROM_LAYOUT_REGISTRY,
      membershipAuthorities: [authority],
      sourceRole,
      sourceProvenance: [...configuration.provenance, `Controlled ${identityFor(layout)} ${sourceRole} role`],
      independentlyQualifiedEcuFamily: null,
    }));
    if (!result.dataset) throw new Error(`Workshop fixture Dataset failed: ${result.finding}`);
    return result.dataset;
  };
  profileDiscovery(referenceBinary, "stock_candidate");
  record("referenceDiscoveryMembershipMs");
  const reference = materialize(referenceBinary, "stock_candidate");
  record("referenceDatasetMaterializationMs");
  profileDiscovery(currentBinary, "mapswitch");
  record("currentDiscoveryMembershipMs");
  const current = materialize(currentBinary, "mapswitch");
  record("currentDatasetMaterializationMs");
  const comparison = compareQualifiedCalibrationDatasets(constructQualifiedCalibrationDatasetComparisonRequest({ reference, modified: current }));
  record("datasetComparisonMs");
  if (comparison.status === "rejected") throw new Error(`Workshop fixture comparison failed: ${comparison.finding}`);
  if (profile) console.info("TUNESIGHT_WORKSHOP_PROFILE", JSON.stringify({ previewRom: configuration.identity, cacheKey: descriptor.cacheKey, ...timings, totalMaterializationMs: Object.values(timings).reduce((sum, value) => sum + value, 0) }));
  return Object.freeze({ descriptor, reference, current, comparison });
}

function identityFor(layout: RomLayoutIdentity): string { return layout.romSoftwareIdentifiers[0] ?? "unknown"; }

function loadFixtureMaterial(previewRom: N54PreviewRom): Promise<FixtureMaterial> {
  const descriptor = constructN54PreviewFixtureDescriptor(previewRom);
  const cached = fixtureMaterialCache.get(descriptor.cacheKey);
  if (cached) return cached;
  const pending = materializeFixture(descriptor).catch((error) => {
    fixtureMaterialCache.delete(descriptor.cacheKey);
    throw error;
  });
  fixtureMaterialCache.set(descriptor.cacheKey, pending);
  return pending;
}

export function clearDevelopmentFixtureCacheForTests(): void { fixtureMaterialCache.clear(); fixtureDescriptorCache.clear(); }

export const developmentCalibrationWorkshopProvider: CalibrationWorkshopProvider = Object.freeze({
  async loadVehicleWorkshop(vehicleId: string, userId: string, selectedDefinition?: string | null, previewRom: N54PreviewRom = DEFAULT_N54_PREVIEW_ROM) {
    if (!vehicleId.trim() || !userId.trim()) throw new Error("Vehicle and user identity are required.");
    const providerStarted = performance.now();
    const material = await loadFixtureMaterial(previewRom);
    const adaptationStarted = performance.now();
    if (material.comparison.status === "rejected") throw new Error(material.comparison.finding);
    const workshop = buildWorkshopViewModel({
      reference: material.reference,
      current: material.current,
      comparison: material.comparison.evidence,
      source: {
        label: `${material.descriptor.configuration.identity} Original → ${material.descriptor.configuration.identity} MapSwitch`,
        fixtureIdentity: material.descriptor.configuration.fixtureIdentity,
      },
      selectedKey: selectedDefinition,
    });
    if (process.env.TUNESIGHT_WORKSHOP_PROFILE === "1") console.info("TUNESIGHT_WORKSHOP_VIEW_MODEL_PROFILE", JSON.stringify({ previewRom, adaptationMs: Math.round(performance.now() - adaptationStarted), totalProviderLoadMs: Math.round(performance.now() - providerStarted), cacheKey: material.descriptor.cacheKey }));
    return workshop;
  },
});

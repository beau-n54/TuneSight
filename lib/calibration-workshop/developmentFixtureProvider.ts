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
  reference: QualifiedCalibrationDataset;
  current: QualifiedCalibrationDataset;
  comparison: ReturnType<typeof compareQualifiedCalibrationDatasets>;
}>;

export interface CalibrationWorkshopProvider {
  loadVehicleWorkshop(
    vehicleId: string,
    userId: string,
    selectedDefinition?: string | null,
  ): Promise<WorkshopViewModel>;
}

const ROOT = path.resolve("BMW-XDFs-master/N54");
const VOCABULARY = ["I8A0S", "IJE0S", "IKM0S", "INA0S"] as const;
type N54Identity = (typeof VOCABULARY)[number];

function parseSource(identity: N54Identity): Readonly<{ definitions: readonly XdfDefinitionRevision[]; set: DefinitionSetRevision }> {
  const filename = `${identity}.xdf`;
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

function exactBinary(identity: N54Identity, role: "original" | "MapSwitchBase"): ExactBinary {
  const fileName = `${identity}_${role}.bin`;
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

function fixtureLayout(identity: N54Identity, source: ReturnType<typeof parseSource>, original: ExactBinary): RomLayoutIdentity {
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

const FIXTURE_CACHE_KEY = [
  QUALIFIED_CALIBRATION_DATASET_CONTRACT,
  QUALIFIED_CALIBRATION_COMPARISON_CONTRACT,
  ROM_LAYOUT_DISCOVERY_CONTRACT,
  N54_CURRENT_ROM_LAYOUT_REGISTRY.snapshotId,
  ...N54_CURRENT_GOVERNED_REVIEW_REFERENCES.flatMap(({ review }) => [
    review.romLayoutId,
    review.definitionSetRevisionId,
    review.sourceArtifactDigest,
    ...review.supportingExactBinaries.map((binary) => binary.binaryDigest),
  ]),
].join("|");
const fixtureMaterialCache = new Map<string, Promise<FixtureMaterial>>();

async function materializeFixture(): Promise<FixtureMaterial> {
  const profile = process.env.TUNESIGHT_WORKSHOP_PROFILE === "1";
  const timings: Record<string, number> = {};
  let mark = performance.now();
  const record = (name: string) => {
    const now = performance.now();
    timings[name] = Math.round(now - mark);
    mark = now;
  };
  const cohort = VOCABULARY.map((identity) => {
    const source = parseSource(identity);
    const original = exactBinary(identity, "original");
    return Object.freeze({ identity, source, original, layout: fixtureLayout(identity, source, original) });
  });
  record("authorityLayoutAssemblyMs");
  const fixture = cohort.find((item) => item.identity === "IJE0S");
  if (!fixture) throw new Error("Controlled IJE0S Workshop fixture is unavailable.");
  const { source, original: referenceBinary, layout } = fixture;
  const currentBinary = exactBinary("IJE0S", "MapSwitchBase");
  const relationship = N54_CURRENT_ROM_LAYOUT_REGISTRY.relationships.find((value) => value.romLayoutId === layout.layoutId);
  if (!relationship) throw new Error("Workshop fixture has no active governed relationship.");
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
      sourceProvenance: [`Controlled IJE0S ${sourceRole} Workshop development fixture`],
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
  if (profile) console.info("TUNESIGHT_WORKSHOP_PROFILE", JSON.stringify({ cacheKey: FIXTURE_CACHE_KEY, ...timings, totalMaterializationMs: Object.values(timings).reduce((sum, value) => sum + value, 0) }));
  return Object.freeze({ reference, current, comparison });
}

function loadFixtureMaterial(): Promise<FixtureMaterial> {
  const cached = fixtureMaterialCache.get(FIXTURE_CACHE_KEY);
  if (cached) return cached;
  const pending = materializeFixture().catch((error) => {
    fixtureMaterialCache.delete(FIXTURE_CACHE_KEY);
    throw error;
  });
  fixtureMaterialCache.set(FIXTURE_CACHE_KEY, pending);
  return pending;
}

export const developmentCalibrationWorkshopProvider: CalibrationWorkshopProvider = Object.freeze({
  async loadVehicleWorkshop(vehicleId: string, userId: string, selectedDefinition?: string | null) {
    if (!vehicleId.trim() || !userId.trim()) throw new Error("Vehicle and user identity are required.");
    const providerStarted = performance.now();
    const material = await loadFixtureMaterial();
    const adaptationStarted = performance.now();
    if (material.comparison.status === "rejected") throw new Error(material.comparison.finding);
    const workshop = buildWorkshopViewModel({
      reference: material.reference,
      current: material.current,
      comparison: material.comparison.evidence,
      selectedKey: selectedDefinition,
    });
    if (process.env.TUNESIGHT_WORKSHOP_PROFILE === "1") console.info("TUNESIGHT_WORKSHOP_VIEW_MODEL_PROFILE", JSON.stringify({ adaptationMs: Math.round(performance.now() - adaptationStarted), totalProviderLoadMs: Math.round(performance.now() - providerStarted), cacheKey: FIXTURE_CACHE_KEY }));
    return workshop;
  },
});

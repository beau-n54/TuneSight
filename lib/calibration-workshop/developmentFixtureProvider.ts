import "server-only";

import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import { collectInternalIdentityObservations, type InternalIdentityObservation } from "../xdf/applicabilityEvidenceProposal.ts";
import type { XdfDefinitionRevision } from "../xdf/canonicalXdfDefinition.ts";
import { defineDefinitionSetRevision, identifyEngineeringBinary, type DefinitionSetRevision, type EngineeringBinaryIdentity } from "../xdf/definitionRomApplicability.ts";
import { interpretXdfStructure } from "../xdf/interpretXdfStructure.ts";
import { N54_CURRENT_GOVERNED_REVIEW_REFERENCES, N54_CURRENT_ROM_LAYOUT_REGISTRY } from "../xdf/n54GovernedApplicabilityAdmission.ts";
import { compareQualifiedCalibrationDatasets, constructQualifiedCalibrationDatasetComparisonRequest } from "../xdf/qualifiedCalibrationComparison.ts";
import { constructQualifiedCalibrationDatasetRequest, materializeQualifiedCalibrationDataset, type QualifiedCalibrationDataset } from "../xdf/qualifiedCalibrationDataset.ts";
import { defineRomLayoutIdentity, type RomLayoutIdentity, type RomLayoutMarker } from "../xdf/romLayoutApplicability.ts";
import { constructQualifiedRomLayoutDiscoveryRegistry, type RomLayoutMembershipAuthority } from "../xdf/romLayoutDiscovery.ts";
import { resolveBinaryContainer, type EngineeringBinary } from "../tunes/binaryContainer.ts";
import { buildWorkshopViewModel, type WorkshopViewModel } from "./viewModel.ts";

type ExactBinary = Readonly<{
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
const IDENTITY = "IJE0S";
const VOCABULARY = ["I8A0S", "IJE0S", "IKM0S", "INA0S"] as const;

function parseSource(): Readonly<{ definitions: readonly XdfDefinitionRevision[]; set: DefinitionSetRevision }> {
  const filename = `${IDENTITY}.xdf`;
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

function exactBinary(role: "original" | "MapSwitchBase"): ExactBinary {
  const fileName = `${IDENTITY}_${role}.bin`;
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
  const identity = identifyEngineeringBinary({
    engineeringBinary: engineering,
    romFamily: "N54",
    softwareIdentity: IDENTITY,
    internalRomIdentifiers: observations.map((value) => value.normalizedForm),
    identityProvenance: ["Controlled Workshop exact binary fixture"],
  });
  const markers = observations
    .filter((value) => value.normalizedForm === IDENTITY)
    .map((value) => ({ kind: value.kind, normalizedForm: value.normalizedForm, offsets: value.offsets, detector: value.detector }));
  return Object.freeze({ engineering, identity, observations, markers: Object.freeze(markers) });
}

function fixtureLayout(source: ReturnType<typeof parseSource>, original: ExactBinary): RomLayoutIdentity {
  const addresses = source.definitions.map((value) => value.primaryAddress).filter((value): value is number => value !== null);
  const region = source.definitions[0]?.addressSpace.regions[0];
  if (!region || addresses.length === 0) throw new Error("Workshop fixture has no qualified address space.");
  const layout = defineRomLayoutIdentity({
    romSoftwareIdentifiers: [IDENTITY],
    calibrationSoftwareIdentifiers: [IDENTITY],
    ecuDmeFamily: "MSD81",
    binaryByteLength: original.identity.byteLength,
    containerTypes: [original.identity.containerType],
    internalMarkers: original.markers,
    calibrationAddressSpace: [{ startAddress: region.startAddress, size: region.size }],
    definitionCompatibleAddressRange: { minimum: Math.min(...addresses), maximum: Math.max(...addresses) },
    xdfSideIdentities: [IDENTITY],
    evidenceProvenance: ["Accepted current N54 governed layout evidence"],
  });
  const expected = N54_CURRENT_GOVERNED_REVIEW_REFERENCES.find((item) => item.identity === IDENTITY)?.review.romLayoutId;
  if (layout.layoutId !== expected) throw new Error("Workshop fixture layout differs from governed IJE0S authority.");
  return layout;
}

const loadFixtureMaterial = cache(async (): Promise<FixtureMaterial> => {
  const source = parseSource();
  const referenceBinary = exactBinary("original");
  const currentBinary = exactBinary("MapSwitchBase");
  const layout = fixtureLayout(source, referenceBinary);
  const relationship = N54_CURRENT_ROM_LAYOUT_REGISTRY.relationships.find((value) => value.romLayoutId === layout.layoutId);
  if (!relationship) throw new Error("Workshop fixture has no active governed relationship.");
  const authority: RomLayoutMembershipAuthority = { layout, relationship, definitionSet: source.set, definitions: source.definitions };
  const discoveryRegistry = constructQualifiedRomLayoutDiscoveryRegistry({ authoritySnapshot: N54_CURRENT_ROM_LAYOUT_REGISTRY, layouts: [layout] });
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
  const reference = materialize(referenceBinary, "stock_candidate");
  const current = materialize(currentBinary, "mapswitch");
  const comparison = compareQualifiedCalibrationDatasets(constructQualifiedCalibrationDatasetComparisonRequest({ reference, modified: current }));
  if (comparison.status === "rejected") throw new Error(`Workshop fixture comparison failed: ${comparison.finding}`);
  return Object.freeze({ reference, current, comparison });
});

export const developmentCalibrationWorkshopProvider: CalibrationWorkshopProvider = Object.freeze({
  async loadVehicleWorkshop(vehicleId: string, userId: string, selectedDefinition?: string | null) {
    if (!vehicleId.trim() || !userId.trim()) throw new Error("Vehicle and user identity are required.");
    const material = await loadFixtureMaterial();
    if (material.comparison.status === "rejected") throw new Error(material.comparison.finding);
    return buildWorkshopViewModel({
      reference: material.reference,
      current: material.current,
      comparison: material.comparison.evidence,
      selectedKey: selectedDefinition,
    });
  },
});

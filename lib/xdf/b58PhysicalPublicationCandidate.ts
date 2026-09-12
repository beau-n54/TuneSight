import fs from "node:fs";
import path from "node:path";
import { FOUNDER_00003076501103_ACCEPTED_APPLICABILITY_DECISION } from "./b58PhysicalAcceptedApplicabilityDecision.ts";
import { B58_PHYSICAL_ARTIFACT_EVIDENCE } from "./b58PhysicalArtifactEvidence.ts";
import { FOUNDER_00003076501103_COMPLETE_VALIDATIONS, FOUNDER_00003076501103_INJECTOR_SCALAR_QUARANTINE, FOUNDER_00003076501103_INJECTOR_SCALAR_SAFETY_ASSESSMENT } from "./b58PhysicalTableQuarantine.ts";
import { interpretXdfStructure } from "./interpretXdfStructure.ts";
import { constructQuarantineAwarePublicationCandidate } from "./quarantineAwarePublicationCandidate.ts";
import { defineRomLayoutIdentity } from "./romLayoutApplicability.ts";

const rom = "00003076501103", xdf = interpretXdfStructure({ xml: fs.readFileSync(path.resolve(`BMW-XDFs-master/B58gen1/${rom}.xdf`), "utf8"), filename: `${rom}.xdf`, provenance: "Accepted B58 Gen1 publication-candidate layout Evidence" });
if (xdf.outcome !== "structurally_interpreted") throw new Error("Accepted B58 Gen1 Definition source no longer resolves.");
const addresses = xdf.definitions.map((item) => item.primaryAddress).filter((item): item is number => item !== null), region = xdf.definitions[0]!.addressSpace.regions[0]!, physical = B58_PHYSICAL_ARTIFACT_EVIDENCE[0];
export const FOUNDER_00003076501103_ROM_LAYOUT = defineRomLayoutIdentity({ romSoftwareIdentifiers: [rom], calibrationSoftwareIdentifiers: [rom], ecuDmeFamily: "MG1", binaryByteLength: physical.byteLength, containerTypes: [physical.container], internalMarkers: [{ kind: "calibration_identifier", normalizedForm: rom, offsets: physical.primaryMarker.offsets, detector: "bounded_hex_encoded_exact" }], calibrationAddressSpace: [{ startAddress: region.startAddress, size: region.size }], definitionCompatibleAddressRange: { minimum: Math.min(...addresses), maximum: Math.max(...addresses) }, xdfSideIdentities: [rom], evidenceProvenance: [FOUNDER_00003076501103_ACCEPTED_APPLICABILITY_DECISION.decisionRevision, "Exact accepted physical binary marker topology", "Exact governed Definition address space"] });
export const FOUNDER_00003076501103_ROM_LAYOUT_ID = FOUNDER_00003076501103_ROM_LAYOUT.layoutId;
export const FOUNDER_00003076501103_PUBLICATION_CANDIDATE = constructQuarantineAwarePublicationCandidate({ decision: FOUNDER_00003076501103_ACCEPTED_APPLICABILITY_DECISION, romLayoutId: FOUNDER_00003076501103_ROM_LAYOUT_ID, validations: FOUNDER_00003076501103_COMPLETE_VALIDATIONS, quarantines: [FOUNDER_00003076501103_INJECTOR_SCALAR_QUARANTINE], safetyAssessments: [FOUNDER_00003076501103_INJECTOR_SCALAR_SAFETY_ASSESSMENT] });
